import { readFileSync } from 'node:fs';
import { DecisionContextSchema } from '../src/schemas/decisionContext';
import { JudgmentReceiptSchema } from '../src/schemas/receipts';
import { receiptSchemas, verifyReceiptIntegrity } from '../src/services/receiptIntegrityService';
import { verifyDecisionContext } from '../src/services/decisionContextService';
import { verifyReceiptChain, type ReceiptReader, type ReceiptRecord } from '../src/services/receiptAuthorityService';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { canonicalSerialize } from '../src/services/receiptIntegrityService';
import type { ReceiptKind } from '../src/schemas/receipts';

/** Offline JSON bundle: {context, judgment, receipts:{observation:[], judgment:[], execution:[], evaluation:[]}, contexts:[], issuer_registry:{issuer,keys}}. */
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('usage: tsx scripts/verify-decision-context.ts bundle.json');
  const bundle = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const context = DecisionContextSchema.parse(bundle.context);
  const judgment = JudgmentReceiptSchema.parse(bundle.judgment);
  const source = bundle.receipts as Record<ReceiptKind, unknown[]>;
  const records = new Map<string, ReceiptRecord>();
  const idFields = { observation: 'observation_id', judgment: 'judgment_id', execution: 'execution_id', evaluation: 'evaluation_id' } as const;
  for (const kind of Object.keys(idFields) as ReceiptKind[]) {
    for (const raw of source?.[kind] ?? []) {
      const receipt = receiptSchemas[kind].parse(raw) as ReceiptRecord;
      const id = String((receipt as unknown as Record<string, unknown>)[idFields[kind]]);
      const key = `${kind}:${id}`;
      if (records.has(key)) throw new Error('duplicate_receipt_in_bundle');
      records.set(key, receipt);
    }
  }
  records.set(`judgment:${judgment.judgment_id}`, judgment);
  const contexts = new Map<string, typeof context>();
  for (const raw of [...((bundle.contexts as unknown[] | undefined) ?? []), context]) {
    const item = DecisionContextSchema.parse(raw);
    if (contexts.has(item.assessment_id)) {
      if (canonicalSerialize(contexts.get(item.assessment_id)) !== canonicalSerialize(item)) throw new Error('conflicting_context_in_bundle');
      continue;
    }
    contexts.set(item.assessment_id, item);
  }
  const registry = bundle.issuer_registry as Parameters<typeof createJudgmentIssuer>[0] | undefined;
  const issuer = registry ? createJudgmentIssuer({ ...registry, requireSigned: true }) : null;
  const reader: ReceiptReader = {
    judgmentTrust: issuer ?? undefined,
    get: async (kind, id) => records.get(`${kind}:${id}`) ?? null,
    getDecisionContext: async id => contexts.get(id) ?? null
  };
  const receiptHashValid = verifyReceiptIntegrity('judgment', judgment);
  const replayValid = await verifyDecisionContext(context, judgment, reader);
  const ancestryValid = await verifyReceiptChain('judgment', judgment, reader);
  const issuerAuthenticated = Boolean(issuer?.verify(judgment));
  const valid = receiptHashValid && replayValid && ancestryValid && issuerAuthenticated;
  process.stdout.write(JSON.stringify({ valid, judgment_id: judgment.judgment_id, receipt_hash_valid: receiptHashValid,
    replay_valid: replayValid, ancestry_valid: ancestryValid, issuer_authenticated: issuerAuthenticated }) + '\n');
  if (!valid) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'verification_failed' }) + '\n'); process.exitCode = 1; });
