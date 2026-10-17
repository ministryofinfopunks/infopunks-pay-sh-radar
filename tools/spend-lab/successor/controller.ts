import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LabDatabase } from '../harness/storage';
import { labIdentity } from '../harness/identity';
import { createExecutionAuthorizationIssuer } from '../../../src/security/executionAuthorization';
import { createJudgmentIssuer } from '../../../src/security/judgmentIssuer';
import {
  isLocalSimulationOperation,
  localSimulationDomain,
} from '../../../src/security/evidenceProvenance';
import { MemoryCanonicalReceiptStore } from '../../../src/persistence/canonicalReceiptStore';
import {
  createReceiptAuthorityService,
  verifyReceiptChain,
} from '../../../src/services/receiptAuthorityService';
import { hashCanonical, canonicalSerialize } from '../../../src/services/receiptIntegrityService';
import type { JudgmentResult } from '../../../src/sdk/judgmentClient';
import {
  ExecutionAuthorizationSchema,
  type ExecutionAuthorization,
  type EconomicOperation,
} from '../../../src/schemas/economicEngine';
import type { ExecutionReceipt, ObservationReceipt } from '../../../src/schemas/receipts';
import type { DecisionContext } from '../../../src/schemas/decisionContext';
import type { HttpLab } from './http-client';
import { localApiKey } from './http-client';
import { tasks, runProvider, type Task, type Delivery } from './profiles';

export class LocalReceipts extends MemoryCanonicalReceiptStore {
  readonly evidenceDomain = localSimulationDomain();
}
export type Archive = {
  observations: ObservationReceipt[];
  context: DecisionContext;
  judgment: NonNullable<JudgmentResult['receipt']>;
  capability: ExecutionAuthorization;
  execution: ExecutionReceipt;
  task_id: string;
  input_hash: string;
};
export async function importArchive(
  archive: Archive,
  trust: ReturnType<typeof createJudgmentIssuer>,
) {
  const receipts = new LocalReceipts(80, trust);
  for (const observation of archive.observations) await receipts.append('observation', observation);
  await receipts.appendDecisionContext(archive.context);
  await receipts.append('judgment', archive.judgment);
  await receipts.append('execution', archive.execution);
  if (!(await verifyReceiptChain('execution', archive.execution, receipts)))
    throw new Error('archive_lineage_invalid');
  return receipts;
}
/** Assessment evidence never crosses this boundary as execution permission. */
export async function openController(directory: string, lab: HttpLab) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new LabDatabase(join(directory, 'controller.sqlite'));
  const issuer = createExecutionAuthorizationIssuer(labIdentity(db, 'execution'));
  const judgmentTrust = createJudgmentIssuer({
    ...lab.trustedIssuer,
    keys: lab.trustedIssuer.keys.map((k) => ({ ...k, revoked: k.revoked ?? false })),
    requireSigned: true,
  });
  db.db.exec(
    `CREATE TABLE IF NOT EXISTS local_capabilities(id TEXT PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS local_deliveries(id TEXT PRIMARY KEY,body TEXT NOT NULL,body_hash TEXT NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS local_task_once ON local_capabilities(json_extract(body,'$.payload.candidate_id'))`,
  );
  function check(raw: unknown, t: Task, at = new Date()) {
    const parsed = ExecutionAuthorizationSchema.safeParse(raw);
    if (!parsed.success) throw new Error('local_provider_capability_denied');
    if (!Number.isFinite(at.getTime())) throw new Error('local_provider_capability_denied');
    const cap = parsed.data,
      op = cap.payload.operation;
    const fixed = tasks.find((task) => task.id === t.id);
    if (!fixed || hashCanonical(fixed) !== hashCanonical(t))
      throw new Error('local_provider_capability_denied');
    if (
      !issuer.verify(cap, at) ||
      !isLocalSimulationOperation(op) ||
      op.profile_id !== 'spend-lab/provider-v2' ||
      op.arguments_hash !== hashCanonical({ task_id: t.id, input: t.input }) ||
      op.amount_atomic !== String(t.price_units) ||
      op.max_fee_atomic !== String(t.fee_units) ||
      cap.payload.delegate_id !== 'lab-controller-v2' ||
      cap.payload.audience !== 'lab-provider-v2'
    )
      throw new Error('local_provider_capability_denied');
    const stored = db.db
      .prepare('SELECT body FROM local_capabilities WHERE id=?')
      .get(cap.payload.authorization_id);
    if (!stored || canonicalSerialize(JSON.parse(String(stored.body))) !== canonicalSerialize(cap))
      throw new Error('local_capability_not_issued');
  }
  async function issue(result: JudgmentResult, t: Task) {
    const fixed = tasks.find((task) => task.id === t.id);
    if (!fixed || hashCanonical(fixed) !== hashCanonical(t) || t.price_units + t.fee_units > 50)
      throw new Error('controller_task_policy_denied');
    if (
      result.state !== 'RECEIPT_VERIFIED' ||
      result.verification?.issuer !== 'verified' ||
      result.verification.historical ||
      result.decision !== 'proceed' ||
      !result.receipt ||
      result.receipt.decision !== 'proceed' ||
      result.receipt.judgment_id !== result.judgment_id ||
      result.receipt.valid_until !== result.valid_until ||
      !judgmentTrust.verify(result.receipt) ||
      Date.parse(result.valid_until) <= Date.now()
    )
      throw new Error('verified_assessment_required');
    const read = async (path: string) => {
      const response = await lab.transport(lab.origin + path, {
        headers: { authorization: 'Bearer ' + localApiKey },
      });
      if (!response.ok) throw new Error('private_lineage_unavailable');
      return (await response.json()).data;
    };
    const observations: ObservationReceipt[] = [];
    for (const id of result.receipt.cited_observation_ids)
      observations.push(await read('/v1/receipt-spine/observation/' + id));
    const context = (
      await read('/v1/receipt-spine/judgment/' + result.receipt.judgment_id + '/context')
    ).context as DecisionContext;
    if (context.request.intent !== 'buy_market_research lab-' + t.id)
      throw new Error('intent_assessment_binding_denied');
    const receipts = new LocalReceipts(80, judgmentTrust);
    for (const obs of observations) await receipts.append('observation', obs);
    await receipts.appendDecisionContext(context);
    await receipts.append('judgment', result.receipt);
    const operation: EconomicOperation = {
      profile_id: 'spend-lab/provider-v2',
      chain_id: 'lab:simulation',
      asset_id: 'lab:simulation/MOCK',
      asset_contract: 'MOCK',
      fee_asset_id: 'lab:simulation/MOCK',
      decimals: 0,
      payer: 'lab-payer',
      recipient: 'lab-provider',
      router: 'lab-router',
      method: 'local-service',
      arguments_hash: hashCanonical({ task_id: t.id, input: t.input }),
      amount_atomic: String(t.price_units),
      max_fee_atomic: String(t.fee_units),
      max_slippage_bps: 0,
    };
    const id =
      'local-capability-' +
      hashCanonical({ judgment: result.receipt.receipt_hash, task: t.id }).slice(7);
    const priorTask = db.db
      .prepare(
        "SELECT id FROM local_capabilities WHERE json_extract(body,'$.payload.candidate_id')=?",
      )
      .get(t.id);
    if (priorTask && priorTask.id !== id) throw new Error('controller_task_already_authorized');
    const prior = db.db.prepare('SELECT body FROM local_capabilities WHERE id=?').get(id);
    const capability = prior
      ? (JSON.parse(String(prior.body)) as ExecutionAuthorization)
      : issuer.issue({
          version: 'infopunks.execution-authorization.v1',
          authorization_id: id,
          nonce: id,
          judgment_id: result.judgment_id,
          judgment_hash: result.receipt.receipt_hash,
          envelope_hash: hashCanonical(context.request),
          witness_hash: hashCanonical({ source: 'deterministic-local-controller', task: t.id }),
          principal_id: 'agent',
          delegate_id: 'lab-controller-v2',
          audience: 'lab-provider-v2',
          candidate_id: t.id,
          policy_hash: hashCanonical({
            simulation: true,
            max_price: t.price_units,
            max_fee: t.fee_units,
          }),
          reservation_id: id,
          operation,
          issued_at: new Date().toISOString(),
          valid_until: result.valid_until,
        });
    db.db
      .prepare('INSERT OR IGNORE INTO local_capabilities VALUES(?,?)')
      .run(id, JSON.stringify(capability));
    return { capability, receipts, observations, context, judgment: result.receipt };
  }
  async function execute(
    capability: ExecutionAuthorization,
    t: Task,
    loseResponse = false,
  ): Promise<Delivery> {
    check(capability, t);
    const id = capability.payload.authorization_id,
      prior = db.db.prepare('SELECT body,body_hash FROM local_deliveries WHERE id=?').get(id);
    if (prior) {
      const value = JSON.parse(String(prior.body));
      if (hashCanonical(value) !== prior.body_hash) throw new Error('local_delivery_corruption');
      if (value.state) throw new Error('local_execution_pending_reconciliation');
      return reconcile(capability, t);
    }
    // Reserve before awaiting provider code; a concurrent caller cannot create a second charge.
    const claim = db.db
      .prepare('INSERT OR IGNORE INTO local_deliveries VALUES(?,?,?)')
      .run(id, JSON.stringify({ state: 'submitted' }), hashCanonical({ state: 'submitted' }));
    if (!claim.changes) throw new Error('local_execution_pending_reconciliation');
    const delivery = { ...(await runProvider(t)), input_hash: hashCanonical(t.input) };
    db.db
      .prepare('UPDATE local_deliveries SET body=?,body_hash=? WHERE id=?')
      .run(JSON.stringify(delivery), hashCanonical(delivery), id);
    writeFileSync(join(directory, t.id + '.delivery.json'), JSON.stringify(delivery, null, 2), {
      mode: 0o600,
    });
    if (loseResponse) throw new Error('simulated_provider_response_lost');
    return delivery;
  }
  function reconcile(capability: ExecutionAuthorization, t: Task): Delivery {
    // Historical recovery observes committed output; it cannot submit or renew authority.
    check(capability, t, new Date(capability.payload.issued_at));
    const row = db.db
      .prepare('SELECT body,body_hash FROM local_deliveries WHERE id=?')
      .get(capability.payload.authorization_id);
    if (!row) throw new Error('local_delivery_missing');
    const delivery = JSON.parse(String(row.body));
    if (hashCanonical(delivery) !== row.body_hash) throw new Error('local_delivery_corruption');
    if (
      delivery.state ||
      delivery.task_id !== t.id ||
      delivery.input_hash !== hashCanonical(t.input)
    )
      throw new Error('local_execution_pending_reconciliation');
    writeFileSync(join(directory, t.id + '.delivery.json'), JSON.stringify(delivery, null, 2), {
      mode: 0o600,
    });
    return delivery;
  }
  async function receipt(issued: Awaited<ReturnType<typeof issue>>, t: Task, delivery: Delivery) {
    const { capability, receipts } = issued;
    const execution = await createReceiptAuthorityService(
      receipts,
      80,
      judgmentTrust,
    ).appendExecution({
      execution_id: 'local-execution-' + capability.payload.authorization_id,
      judgment_id: issued.judgment.judgment_id,
      executed_at: capability.payload.issued_at,
      settlement_rail: 'spend-lab/provider-v2',
      settlement_ref: 'simulation:provider/' + capability.payload.authorization_id,
      request_hash: capability.payload.operation.arguments_hash,
      response_hash: hashCanonical(delivery),
      payload_signature: capability.signature,
      latency_ms: delivery.elapsed_ms,
      status: delivery.status === 'ok' ? 'succeeded' : 'failed',
      execution_authorization: {
        version: 'infopunks.execution-authorization.v1',
        authorization_id: capability.payload.authorization_id,
        payload_hash: capability.payload_hash,
      },
      cost_amount: String(delivery.charged_units),
      cost_asset: 'lab:simulation/MOCK',
      artifact_refs: ['lab-delivery/' + hashCanonical(delivery)],
    });
    const archive: Archive = {
      observations: issued.observations,
      context: issued.context,
      judgment: issued.judgment,
      capability,
      execution,
      task_id: t.id,
      input_hash: delivery.input_hash,
    };
    writeFileSync(join(directory, t.id + '.archive.json'), JSON.stringify(archive, null, 2), {
      mode: 0o600,
    });
    return archive;
  }
  return {
    issue,
    execute,
    reconcile,
    receipt,
    publicKeys: issuer.publicKeys(),
    check,
    charges: () =>
      Number(
        db.db
          .prepare(
            "SELECT count(*) AS n FROM local_deliveries WHERE json_extract(body,'$.state') IS NULL",
          )
          .get()!.n,
      ),
    close: () => db.close(),
  };
}
/** An agent controls only a fixed task identifier and cannot supply a transport, policy, wallet, or execution operation. */
export function boundedIntentTool(
  allowed: ReadonlyMap<string, Task>,
  submit: (t: Task) => Promise<unknown>,
) {
  return Object.freeze({
    name: 'request_radar_judgment',
    invoke: (input: unknown) => {
      if (typeof input !== 'string' || !allowed.has(input))
        throw new Error('bounded_intent_denied');
      return submit(structuredClone(allowed.get(input)!));
    },
  });
}
