import { generateKeyPairSync, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createJudgmentIssuer } from '../../../src/security/judgmentIssuer';
import { createExecutionAuthorizationIssuer } from '../../../src/security/executionAuthorization';
import { createEvaluationService } from '../../../src/services/evaluationService';
import { importArchive } from './controller';
import { isLocalSimulationOperation } from '../../../src/security/evidenceProvenance';
import { reference } from './oracle';
import { canonicalSerialize, hashCanonical } from '../../../src/services/receiptIntegrityService';
import type { Delivery, Task } from './profiles';
const directory = process.argv[2];
mkdirSync(directory, { recursive: true, mode: 0o700 });
const keyPath = join(directory, 'evaluator-private.pem');
if (!existsSync(keyPath)) {
  const pair = generateKeyPairSync('ed25519');
  writeFileSync(keyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  writeFileSync(
    join(directory, 'evaluator-public.pem'),
    pair.publicKey.export({ type: 'spki', format: 'pem' }),
    { mode: 0o600 },
  );
}
const key = createPrivateKey(readFileSync(keyPath)),
  publicKey = readFileSync(join(directory, 'evaluator-public.pem'), 'utf8');
const signBody = (body: unknown) => ({
  body,
  signature: sign(
    null,
    Buffer.from(canonicalSerialize({ domain: 'spend-lab/evaluator-attestation.v1', body })),
    key,
  ).toString('base64'),
});
let pinned:
  | {
      judgment: Parameters<typeof createJudgmentIssuer>[0];
      execution: Parameters<typeof createExecutionAuthorizationIssuer>[0];
    }
  | undefined;
let commitment: string | undefined;
let labels: Array<{
  task_id: string;
  correct: boolean;
  within_deadline: boolean;
  gross_units: number;
  net_units: number;
  should_spend: boolean;
  input_hash: string;
  output_hash: string;
  arguments_hash: string;
  deadline_ms: number;
  price_units: number;
  fee_units: number;
}> = [];
process.send?.({ ready: true, publicKey });
process.on('message', async (raw: any) => {
  try {
    if (raw.kind === 'configure') {
      if (pinned) throw new Error('evaluator_trust_already_pinned');
      if (
        !raw.judgment.issuer.startsWith('spend-lab/') ||
        !raw.execution.issuer.startsWith('spend-lab/') ||
        raw.judgment.privateKeyPem ||
        raw.execution.privateKeyPem
      )
        throw new Error('public_local_trust_required');
      pinned = { judgment: raw.judgment, execution: raw.execution };
      process.send?.({
        id: raw.id,
        ...signBody({
          kind: 'pinned-public-trust',
          judgment: hashCanonical(raw.judgment),
          execution: hashCanonical(raw.execution),
        }),
      });
    } else if (raw.kind === 'commit') {
      if (commitment) throw new Error('oracle_already_committed');
      // Only task specs and actual audit outputs are accepted. Decision/probe fields never enter the oracle.
      labels = raw.specs.map((t: Omit<Task, 'probe' | 'implementation'>) => {
        const delivery: Delivery = JSON.parse(
          readFileSync(join(raw.auditDirectory, t.id + '.json'), 'utf8'),
        );
        const input_hash = hashCanonical(t.input);
        if (
          delivery.task_id !== t.id ||
          delivery.input_hash !== input_hash ||
          delivery.charged_units !== t.price_units ||
          delivery.fee_units !== t.fee_units
        )
          throw new Error('audit_binding_invalid');
        const expected = reference(t.family, t.input),
          correct =
            delivery.status === 'ok' &&
            canonicalSerialize(delivery.output) === canonicalSerialize(expected),
          within_deadline = delivery.elapsed_ms <= t.deadline_ms;
        const gross_units = correct && within_deadline ? t.value_units : 0,
          net_units = gross_units - t.price_units - t.fee_units;
        return {
          task_id: t.id,
          deadline_ms: t.deadline_ms,
          price_units: t.price_units,
          fee_units: t.fee_units,
          correct,
          within_deadline,
          gross_units,
          net_units,
          should_spend: net_units > 0,
          input_hash,
          output_hash: hashCanonical(delivery.output),
          arguments_hash: hashCanonical({ task_id: t.id, input: t.input }),
        };
      });
      commitment = hashCanonical(labels);
      process.send?.({
        id: raw.id,
        ...signBody({
          kind: 'ground-truth-commitment',
          commitment,
          count: labels.length,
          specs_hash: hashCanonical(raw.specs),
        }),
      });
    } else if (raw.kind === 'reveal') {
      const frozen = JSON.parse(readFileSync(raw.decisionsPath, 'utf8'));
      if (hashCanonical(frozen) !== raw.decisionsHash) throw new Error('decisions_changed');
      if (!commitment) throw new Error('oracle_not_committed');
      process.send?.({
        id: raw.id,
        ...signBody({
          kind: 'ground-truth-reveal',
          commitment,
          decisions_hash: raw.decisionsHash,
          labels,
        }),
      });
    } else if (raw.kind === 'attest') {
      // No proposed success or score is accepted; observe the durable delivery directly.
      if (!pinned) throw new Error('evaluator_trust_not_pinned');
      const archive = JSON.parse(readFileSync(raw.archivePath, 'utf8'));
      const delivery = JSON.parse(readFileSync(raw.deliveryPath, 'utf8')) as Delivery;
      const label = labels.find((t) => t.task_id === delivery.task_id);
      if (
        !label ||
        delivery.input_hash !== label.input_hash ||
        hashCanonical(delivery.output) !== label.output_hash
      )
        throw new Error('delivery_not_grounded');
      const cap = archive.capability,
        execution = archive.execution;
      if (
        !createExecutionAuthorizationIssuer(pinned.execution).verify(
          cap,
          new Date(cap.payload.issued_at),
        ) ||
        !isLocalSimulationOperation(cap.payload.operation) ||
        cap.payload.judgment_hash !== archive.judgment.receipt_hash ||
        cap.payload.judgment_id !== archive.judgment.judgment_id ||
        cap.payload.candidate_id !== label.task_id ||
        cap.payload.principal_id !== archive.context.request.agent_id ||
        cap.payload.delegate_id !== 'lab-controller-v2' ||
        cap.payload.audience !== 'lab-provider-v2' ||
        cap.payload.operation.arguments_hash !== label.arguments_hash ||
        archive.context.request.intent !== 'buy_market_research lab-' + label.task_id ||
        cap.payload.envelope_hash !== hashCanonical(archive.context.request) ||
        Date.parse(cap.payload.valid_until) > Date.parse(archive.judgment.valid_until) ||
        archive.judgment.decision !== 'proceed' ||
        archive.task_id !== delivery.task_id ||
        archive.input_hash !== label.input_hash ||
        execution.response_hash !== hashCanonical(delivery) ||
        execution.execution_authorization?.payload_hash !== cap.payload_hash ||
        execution.request_hash !== cap.payload.operation.arguments_hash ||
        delivery.charged_units !== label.price_units ||
        delivery.fee_units !== label.fee_units ||
        delivery.charged_units !== Number(cap.payload.operation.amount_atomic) ||
        delivery.fee_units !== Number(cap.payload.operation.max_fee_atomic)
      )
        throw new Error('attestation_lineage_invalid');
      const store = await importArchive(
        archive,
        createJudgmentIssuer({ ...pinned.judgment, requireSigned: true }),
      );
      const outcome =
        label.correct && delivery.status === 'ok' && delivery.elapsed_ms <= label.deadline_ms
          ? 'confirmed'
          : 'contradicted';
      const evaluation = await createEvaluationService(store, 80).createEvaluation({
        evaluation_id: 'local-evaluation-' + cap.payload.authorization_id,
        execution_id: execution.execution_id,
        evaluated_at: new Date().toISOString(),
        outcome,
        reasons: ['independent_local_oracle_output_comparison'],
        evidence_refs: [hashCanonical(delivery), commitment!],
      });
      const body = {
        kind: 'delivery-evaluation',
        task_id: delivery.task_id,
        execution_hash: execution.receipt_hash,
        capability_hash: cap.payload_hash,
        judgment_hash: archive.judgment.receipt_hash,
        delivery_hash: hashCanonical(delivery),
        outcome,
        commitment,
        evaluation_receipt: evaluation,
      };
      process.send?.({ id: raw.id, ...signBody(body) });
    } else if (raw.kind === 'close') process.exit(0);
    else throw new Error('evaluator_operation_denied');
  } catch (e) {
    process.send?.({ id: raw.id, error: e instanceof Error ? e.message : 'evaluator_failure' });
  }
});
