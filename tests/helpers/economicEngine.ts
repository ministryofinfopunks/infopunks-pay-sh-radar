import { vi } from 'vitest';
import { issuerFixture } from './judgmentIssuer';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { createExecutionAuthorizationIssuer } from '../../src/security/executionAuthorization';
import { MemoryEconomicEngineStore } from '../../src/persistence/economicEngineStore';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { createEconomicJudgmentEngine, type EconomicEngineOptions, type EconomicExecutor } from '../../src/services/economicJudgmentEngine';
import type { EconomicJob, EconomicPolicy } from '../../src/schemas/economicEngine';

export const economicJob = (): EconomicJob => ({
  request_id: 'request-1', principal_id: 'agent-1', subject_type: 'provider', subject_id: 'provider-1', role: 'select',
  intent_hash: hashCanonical({ intent: 'fetch a verified balance' }), state: { intent: 'fetch a verified balance', evidence: 'qualified snapshot' }, model_id: 'jev-1.13.0',
  candidates: [{ id: 'route-a', action: 'execute_route', handler_id: 'balance', description: 'Verified balance route', evidence_ids: ['economic-observation-1'],
    operation: { profile_id: 'fixture-base-usdc', chain_id: 'eip155:8453', asset_id: 'eip155:8453/test-usdc-contract', asset_contract: 'test-usdc-contract', fee_asset_id: 'eip155:8453/test-usdc-contract', decimals: 6,
      payer: 'payer-1', recipient: 'provider-1', router: 'router-1', method: 'balance', arguments_hash: hashCanonical({ account: 'account-1' }),
      amount_atomic: '10000', max_fee_atomic: '1000', max_slippage_bps: 0 } }], evidence_ids: ['economic-observation-1'],
  question: { type: 'choice', instructions: 'Select the qualified route or abstain.' },
  policy: { version: 'policy-v1', principal_id: 'agent-1', delegate_id: 'delegate-1', audience: 'executor-1', enabled: true,
    manual_review_required: false, allowed_handlers: ['balance'], allowed_profiles: ['fixture-base-usdc'], allowed_chains: ['eip155:8453'],
    allowed_assets: ['eip155:8453/test-usdc-contract'], asset_decimals: { 'eip155:8453/test-usdc-contract': 6 }, allowed_payers: ['payer-1'], allowed_recipients: ['provider-1'], allowed_routers: ['router-1'], revoked_candidate_ids: [],
    max_amount_atomic: '10000', max_fee_atomic: '1000', budget_atomic: '100000', bounded_test_amount_atomic: '10000',
    velocity_window_ms: 60000, max_calls_per_window: 10, max_slippage_bps: 0, evidence_threshold: 80,
    choice_confidence_threshold: 0.8, choice_probability_threshold: 0.9, ttl_ms: 60000 }
});
export const jevChoice = () => ({ model: 'jev-1.13.0', answers: { decision: { type: 'choice', choice: 'route-a', probabilities: { 'route-a': 0.99, abstain: 0.01 }, confidence: 0.95 } }, usage: { input_tokens: 100, output_tokens: 10 } });
export async function economicFixture(overrides: Partial<EconomicEngineOptions> = {}, mutateJob?: (job: EconomicJob) => void) {
  const job = economicJob(); mutateJob?.(job);
  let at = new Date('2026-10-08T00:00:02Z');
  let policy: EconomicPolicy | null = job.policy;
  const signerConfig = issuerFixture(), judgmentIssuer = createJudgmentIssuer(signerConfig);
  const authorizationIssuer = createExecutionAuthorizationIssuer(signerConfig);
  const receipts = new MemoryCanonicalReceiptStore(80, judgmentIssuer);
  const authority = createReceiptAuthorityService(receipts, 80, judgmentIssuer);
  const observation = await authority.appendObservation({ observation_id: 'economic-observation-1', subject_type: job.subject_type,
    subject_id: job.subject_id, intent_hash: job.intent_hash, source_type: 'reviewed_economic_facts', source_id: 'provider-snapshot',
    observed_at: '2026-10-08T00:00:00Z', ingested_at: '2026-10-08T00:00:01Z', freshness_expires_at: '2026-10-08T00:10:00Z',
    evidence_state: 'sufficient', evidence_refs: ['artifact://verified'], provenance: { catalog_source: 'live' },
    payload: { version: 'infopunks.economic-evidence.v1', candidate_hash: hashCanonical(job.candidates[0]), authenticity: 'verified', completeness: 'complete',
      finality: 'finalized', confidence: 95, deterministic_veto: false, bounded_test_required: false, policy_hash: hashCanonical(job.policy) } });
  const provider = { evaluate: vi.fn(async () => jevChoice()) };
  const executor: EconomicExecutor = { profile_id: 'fixture-base-usdc', preflight: vi.fn(async () => true),
    execute: vi.fn(async () => ({ finalized: true as const, settlement_ref: 'fixture-settlement-1', response_hash: hashCanonical({ balance: 100 }),
      status: 'succeeded' as const, amount_atomic: '10000', fee_atomic: '500', artifact_refs: ['artifact://execution'] })),
    verify: vi.fn(async () => true), reconcile: vi.fn(async () => null) };
  const options: EconomicEngineOptions = { store: new MemoryEconomicEngineStore(), receipts, threshold: 80, judgmentIssuer, authorizationIssuer,
    provider, executors: [executor], currentPolicy: async () => policy, shadow: false, allowAuthorizations: true, now: () => at, ...overrides };
  const engine = createEconomicJudgmentEngine(options);
  return { job, receipts, authority, observation, provider, executor, engine, options, authorizationIssuer, judgmentIssuer,
    setTime: (time: string) => { at = new Date(time); }, setPolicy: (next: EconomicPolicy | null) => { policy = next; } };
}
