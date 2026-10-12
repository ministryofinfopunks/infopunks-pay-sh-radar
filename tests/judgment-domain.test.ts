import { createApp } from '../src/api/app';
import { observationInput } from './helpers/canonicalReceipts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JudgmentDomainContextSchema } from '../src/schemas/judgmentDomain';
import { PreSpendCheckRequestSchema } from '../src/schemas/entities';
import { createJudgmentService } from '../src/services/judgmentService';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { verifyDecisionContext } from '../src/services/decisionContextService';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import { normalizeRhMarketEvidence } from '../src/services/judgmentEvidenceAdapters';
import { request, legacy, setupJudgment } from './helpers/judgments';

afterEach(() => vi.unstubAllEnvs());
const context = {
  version: 'radar-judgment-context.v1' as const,
  subject: { type: 'service_route' as const, id: 'solana:mainnet:service_route:route_test', network: 'solana:mainnet' as const },
  policy: { id: 'solana.service-spend' as const, version: '1' as const },
  evidence_refs: ['observation_domain'], settlement_network: 'eip155:8453', expires_at: '2026-10-07T00:00:32Z'
};
const marketContext = { ...context, subject: { type: 'stock_token_market' as const, id: 'eip155:4663:stock_token_market:0x' + 'a'.repeat(64), network: 'eip155:4663' as const }, policy: { id: 'rh.market-inspection' as const, version: '1' as const } };

async function typedFixture() {
  const f = await setupJudgment();
  const input = { ...request, subject_id: context.subject.id, judgment_context: context };
  const { schema_version: _, payload_hash: __, receipt_hash: ___, ...source } = f.observation;
  const observation = await createReceiptAuthorityService(f.store).appendObservation({ ...source,
    observation_id: context.evidence_refs[0], subject_type: context.subject.type, subject_id: context.subject.id,
    intent_hash: hashCanonical(input), provenance: { catalog_source: 'live', subject_network: context.subject.network, policy_id: context.policy.id, policy_version: '1' }
  });
  const service = createJudgmentService({ store: f.store, journal: f.journal, gateway: f.gateway,
    observations: async () => [observation], legacyCheck: () => legacy, threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
  return { ...f, input, observation, service };
}
describe('one Judgment authority with reviewed domain admission', () => {
  it('keeps legacy parsed request/hash unchanged', () => {
    expect(PreSpendCheckRequestSchema.parse(request)).toEqual(request);
    expect(hashCanonical(PreSpendCheckRequestSchema.parse(request))).toBe(hashCanonical(request));
  });
  it.each([
    { ...context, subject: { ...context.subject, id: 'route_test' } },
    { ...context, subject: { ...context.subject, network: 'eip155:4663' } },
    { ...context, policy: { id: 'client-approved', version: '1' } },
    { ...context, policy: { ...context.policy, version: '2' } },
    { ...context, subject: { ...context.subject, type: 'arbitrary' } },
    { ...context, execution_authorized: true }
  ])('rejects unknown/colliding policy and subject context', raw => {
    expect(JudgmentDomainContextSchema.safeParse(raw).success).toBe(false);
  });
  it('issues through the existing paid authority and replay-verifies a typed context with bounded expiry', async () => {
    const f = await typedFixture();
    const result = await f.service.check(f.input, 'typed-paid', f.signature);
    expect(result.response.decision).toBe('proceed');
    expect(result.response.valid_until).toBe('2026-10-07T00:00:32.000Z');
    const frozen = await f.store.getDecisionContext(result.response.judgment_id);
    expect(frozen?.request.judgment_context).toEqual(context);
    expect(await verifyDecisionContext(frozen!, result.response.receipt!, f.store)).toBe(true);
    expect((await f.service.check(f.input, 'typed-paid', f.signature)).response.receipt).toEqual(result.response.receipt);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it.each(['solana:mainnet', 'eip155:4663', 'unknown'])('never infers unsupported fee settlement %s from the subject chain', async rail => {
    const f = await typedFixture();
    const result = await f.service.check({ ...f.input, judgment_context: { ...context, settlement_network: rail } });
    expect(result.response).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, receipt: null, cost: { amount: '0' } });
    expect(f.facilitator.settle).not.toHaveBeenCalled();
  });
  it('abstains on evidence mismatch and unsupported provider policy before payment', async () => {
    const f = await typedFixture();
    for (const changed of [{ ...context, evidence_refs: ['other'] }, { ...context, expires_at: '2026-10-07T00:00:01Z' }, { ...context, subject: { ...context.subject, type: 'provider' as const, id: 'solana:mainnet:provider:test' } }]) {
      const result = await f.service.check({ ...request, subject_id: changed.subject.id, judgment_context: changed });
      expect(result.response.decision).toBe('insufficient_evidence'); expect(result.headers['PAYMENT-REQUIRED']).toBeUndefined();
    }
  });
  it('accepts RH context through the same authority, remains free/read-only and never calls a payment gateway', async () => {
    const f = await typedFixture();
    const marketEvidence = vi.fn(async () => null);
    const service = createJudgmentService({ store: f.store, journal: f.journal, gateway: f.gateway,
      observations: async () => [], legacyCheck: () => legacy, marketEvidence, threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
    const input = { ...request, subject_id: marketContext.subject.id, judgment_context: marketContext };
    const first = await service.check(input, 'rh-read', f.signature);
    expect(first.response).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, receipt: null, cost: { amount: '0' } });
    expect(first.response.reasons).toContain('rh_execution_policy_unqualified');
    expect((await service.check(input, 'rh-read')).response).toEqual(first.response);
    expect(marketEvidence).toHaveBeenCalledTimes(1); expect(f.facilitator.settle).not.toHaveBeenCalled();
    expect(await f.store.list('judgment')).toHaveLength(0);
    expect(normalizeRhMarketEvidence(marketContext, null, new Date()).execution_authorized).toBe(false);
  });
});

it('routes the namespaced Solana subject into the existing catalog without dropping canonical scope', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'domain-test-authority');
  const f = await setupJudgment();
  const app = await createApp(undefined, undefined, { judgmentGateway: f.gateway });
  try {
    const route = 'route_pay_sh_market_research_03';
    const at = new Date();
    const scoped = { ...context, subject: { ...context.subject, id: `solana:mainnet:service_route:${route}` }, expires_at: new Date(at.getTime() + 60000).toISOString() };
    const input = { ...request, intent: 'buy_market_research', subject_id: scoped.subject.id, judgment_context: scoped };
    const diagnostic = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'typed-diagnostic' } });
    expect(diagnostic.json().data.recommended_route).toBe(route);
    const headers = { authorization: 'Bearer domain-test-authority' };
    const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers, payload: {
      ...observationInput(), observation_id: scoped.evidence_refs[0], subject_type: 'service_route', subject_id: scoped.subject.id,
      intent_hash: hashCanonical(input), source_type: 'reviewed_judgment_facts', observed_at: at.toISOString(), ingested_at: at.toISOString(),
      freshness_expires_at: new Date(at.getTime() + 120000).toISOString(), provenance: { catalog_source: 'live', subject_network: 'solana:mainnet', policy_id: 'solana.service-spend', policy_version: '1' },
      payload: { ...f.observation.payload as object, route_id: route }
    } });
    expect(seed.statusCode).toBe(200);
    const check = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { ...headers, 'idempotency-key': 'typed-qualified' } });
    expect(check.statusCode, check.body).toBe(402);
    expect(check.json()).toMatchObject({ decision: 'proceed', execution_authorized: false, receipt: null });
    const anonymous = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'typed-private-quote' } });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toEqual({ error: 'judgment_authentication_required' });
  } finally { await app.close(); }
});

it.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('preserves typed domain context and canonical receipt hashes across a PostgreSQL restart', async () => {
  const { createCanonicalTestDatabase } = await import('./helpers/canonicalPostgres');
  const { PostgresCanonicalReceiptStore } = await import('../src/persistence/canonicalReceiptStore');
  const { PostgresJudgmentRequestRepository } = await import('../src/repositories/judgmentRequestRepository');
  const database = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'typed_domain', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261008_018_decision_context', '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts', '20261008_022_publication_boundaries']);
  try {
    const f = await typedFixture();
    const store = new PostgresCanonicalReceiptStore(database.pool);
    await store.append('observation', f.observation);
    const service = () => createJudgmentService({ store: new PostgresCanonicalReceiptStore(database.pool), journal: new PostgresJudgmentRequestRepository(database.pool), gateway: f.gateway,
      legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
    const paid = await service().check(f.input, 'typed-durable', f.signature);
    const replay = await service().check(f.input, 'typed-durable', f.signature);
    expect(replay.response.receipt).toEqual(paid.response.receipt);
    const restarted = new PostgresCanonicalReceiptStore(database.pool);
    const frozen = await restarted.getDecisionContext(paid.response.judgment_id);
    expect(frozen?.request.judgment_context).toEqual(context);
    expect(await verifyDecisionContext(frozen!, replay.response.receipt!, restarted)).toBe(true);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  } finally { await database.close(); }
});
