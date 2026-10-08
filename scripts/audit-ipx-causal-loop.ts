/** Local audit only: synthetic evidence and payment responses; no network or funds. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { createReceiptAuthorityService, verifyReceiptChain } from '../src/services/receiptAuthorityService';
import { createJudgmentService } from '../src/services/judgmentService';
import { createEvaluationService } from '../src/services/evaluationService';
import { createDerivedScoreService } from '../src/services/derivedScoreService';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import type { JudgmentPaymentGateway } from '../src/middleware/x402JudgmentMiddleware';
import { request, facts, legacy } from '../tests/helpers/judgmentFixtures';
import { observationInput, executionInput } from '../tests/helpers/canonicalReceipts';

const at = '2026-10-07T00:00:05.000Z';
const requirement = { scheme: 'exact', network: 'eip155:8453' as const,
  asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', amount: '10000',
  payTo: '0x' + '2'.repeat(40), maxTimeoutSeconds: 120, extra: {} };
let paymentOrdinal = 0;
const gateway: JudgmentPaymentGateway = {
  asset: 'USDC', requirements: [requirement],
  challenge: async () => ({ x402Version: 2, resource: { url: 'https://fixture.invalid', description: 'AUDIT FIXTURE', mimeType: 'application/json' }, accepts: [requirement] }),
  verify: async () => true,
  settle: async () => ({ success: true, transaction: '0x' + (++paymentOrdinal).toString(16).padStart(64, '0'), network: 'eip155:8453', payer: '0x' + '1'.repeat(40) })
};
const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: requirement, payload: { fixture: true } });
async function setup() {
  const store = new MemoryCanonicalReceiptStore();
  const authority = createReceiptAuthorityService(store);
  const observation = await authority.appendObservation({ ...observationInput(), intent_hash: hashCanonical(request),
    source_type: 'reviewed_judgment_facts', payload: facts });
  const serviceAt = (time: string) => createJudgmentService({ store, journal: new MemoryJudgmentRequestRepository(), gateway,
    legacyCheck: () => legacy, observations: async () => [observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date(time) });
  const first = await serviceAt('2026-10-07T00:00:02.000Z').check(request, 'audit-first', signature);
  const execution = await authority.appendExecution({ ...executionInput(), judgment_id: first.response.judgment_id });
  return { store, authority, observation, first, execution, serviceAt };
}
async function main() {
const fixture = await setup();
const without = await fixture.serviceAt(at).check(request, 'audit-without', signature);
const before = await createDerivedScoreService(fixture.store).project('provider', 'provider_test');
const evaluation = await createEvaluationService(fixture.store, 80, () => new Date('2026-10-07T00:00:04.000Z')).submit({
  execution_receipt_id: fixture.execution.execution_id, outcome: 'contradicted', evidence_refs: ['artifact://synthetic-audit-outcome'],
  evaluator: { type: 'internal', id: 'canonical-admin' }, idempotency_key: 'audit-evaluation'
}, 'canonical-admin');
const after = await createDerivedScoreService(fixture.store).project('provider', 'provider_test');
const withHistory = await fixture.serviceAt(at).check(request, 'audit-with', signature);
assert.equal(without.response.decision, 'proceed');
assert.equal(withHistory.response.decision, 'do_not_spend');
assert.equal(after.score, -15);
assert.equal(await verifyReceiptChain('evaluation', evaluation, fixture.store), true);

const inflation = await setup();
for (let i = 0; i < 20; i++) {
  const execution = await inflation.authority.appendExecution({ ...executionInput(), execution_id: 'audit-inflation-' + i,
    judgment_id: inflation.first.response.judgment_id });
  await createEvaluationService(inflation.store).createEvaluation({ evaluation_id: 'audit-inflation-e-' + i,
    execution_id: execution.execution_id, evaluated_at: at, outcome: 'confirmed', reasons: ['synthetic'], evidence_refs: ['artifact://synthetic'] });
}
const inflated = await createDerivedScoreService(inflation.store).project('provider', 'provider_test');
assert.equal(inflated.score, 100);

const temporal = await setup();
await createEvaluationService(temporal.store).createEvaluation({ evaluation_id: 'audit-future', execution_id: temporal.execution.execution_id,
  evaluated_at: '2027-01-01T00:00:00.000Z', outcome: 'contradicted', reasons: ['synthetic'], evidence_refs: ['artifact://synthetic'] });
const futureAffected = await temporal.serviceAt(at).check(request, 'audit-future-judgment', signature);
assert.equal(futureAffected.response.decision, 'do_not_spend');

const output = 'output/ipx-strategic-review'; mkdirSync(output, { recursive: true });
const bundle = {
  version: 'ipx.audit-fixture.v1', classification: 'SYNTHETIC_LOCAL_ONLY', production_proof: false,
  limitations: ['Memory store', 'Mock payment verification and settlement', 'Unsigned judgment', 'Unverified execution settlement', 'Synthetic artifacts', 'No persisted evaluation-to-next-judgment binding'],
  request, facts, legacy, decision_time: at,
  observation: fixture.observation, first_judgment: fixture.first.response.receipt, execution: fixture.execution, evaluation,
  next_judgment: withHistory.response.receipt, before_projection: before, after_projection: after,
  counterfactual_without_evaluation: without.response.receipt,
  result: { without_evaluation: without.response.decision, with_evaluation: withHistory.response.decision, improved_judgment: 'NOT_MEASURED', qualifying_public_loops: 0 }
};
writeFileSync(output + '/causal-loop-fixture.json', JSON.stringify(bundle, null, 2) + '\n');
writeFileSync(output + '/audit-probes.json', JSON.stringify({
  synthetic_causal_feedback: 'REPRODUCED', unverified_execution_counts_toward_score: after.score,
  same_settlement_twenty_unverified_executions_score: inflated.score,
  future_dated_evaluation_changes_earlier_judgment: futureAffected.response.decision,
  note: 'Authenticated/internal authority boundaries, not unauthenticated public exploits. Expected current behavior; findings remain unresolved.'
}, null, 2) + '\n');
console.log('Local causal fixture and three audit probes reproduced. Qualifying live loops: 0.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
