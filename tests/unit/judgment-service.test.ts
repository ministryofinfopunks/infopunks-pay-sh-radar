import { describe, expect, it } from 'vitest';
import { adaptDecision, judgmentExpired } from '../../src/services/judgmentService';
import { request, setupJudgment } from '../helpers/judgments';

describe('canonical judgment policy', () => {
  it.each([
    ['approved', false, 'proceed'], ['approved_with_warning', false, 'insufficient_evidence'],
    ['approved_with_warning', true, 'test_spend_first'], ['use_with_caution', false, 'insufficient_evidence'],
    ['use_with_caution', true, 'test_spend_first'], ['requires_human_approval', true, 'insufficient_evidence'],
    ['do_not_use', false, 'do_not_spend'], ['unknown', true, 'insufficient_evidence']
  ])('maps %s bounded=%s to %s', (state, bounded, decision) => expect(adaptDecision(String(state), Boolean(bounded))).toBe(decision));
  it.each([
    [{}, { evidence_state: 'stale' }], [{}, { freshness_expires_at: '2026-10-07T00:00:01Z' }],
    [{}, { provenance: { catalog_source: 'fixture' } }], [{}, { source_type: 'fixture' }],
    [{ confidence: 79 }, {}], [{ required_proof_complete: false }, {}], [{ identity_resolved: false }, {}],
    [{ catalog_live: false }, {}], [{ intent_satisfied: false }, {}], [{ constraints_satisfied: false }, {}],
    [{}, { subject_id: 'unrelated' }], [{}, { intent_hash: 'sha256:' + 'f'.repeat(64) }],
    [{ route_id: 'unrelated' }, {}], [{ max_cost: 2 }, {}], [{}, { evidence_refs: [] }]
  ])('fails closed for invalid evidence %j / %j', async (policy, observation) => {
    const fixture = await setupJudgment(policy, observation);
    const result = await fixture.service.check(request);
    expect(result.status).toBe(200); expect(result.response.decision).toBe('insufficient_evidence');
    expect(result.response.cost.amount).toBe('0'); expect(result.response.payment_required).toBe(false);
    expect(result.headers).not.toHaveProperty('PAYMENT-REQUIRED'); expect(await fixture.store.list('judgment')).toHaveLength(0);
  });
  it('proceed cites a valid scoped observation and expires at policy TTL', async () => {
    const f = await setupJudgment(); await f.service.check(request);
    const result = await f.service.check(request, undefined, f.signature);
    expect(result.response.decision).toBe('proceed'); expect(result.response.receipt?.cited_observation_ids).toEqual([f.observation.observation_id]);
    expect(result.response.valid_until).toBe('2026-10-07T00:01:02.000Z');
    expect(judgmentExpired(result.response.receipt!, new Date('2026-10-07T00:01:02Z'))).toBe(true);
    expect((await f.authority.projectScore('provider', 'provider_test')).score).toBe(0);
  });
  it('returns a negative judgment only with sufficient evidence', async () => {
    const f = await setupJudgment({ deterministic_veto: true });
    expect((await f.service.check(request)).response.decision).toBe('do_not_spend');
  });
  it('does not upgrade reviewed warnings or negatives when the legacy engine approves', async () => {
    const warning = await setupJudgment({ decision_state: 'approved_with_warning' }, {}, { decision: 'approved' });
    expect((await warning.service.check(request)).response.decision).toBe('insufficient_evidence');
    const negative = await setupJudgment({ decision_state: 'do_not_use' }, {}, { decision: 'approved' });
    expect((await negative.service.check(request)).response.decision).toBe('do_not_spend');
  });
  it('allows a bounded test only with explicit sufficient policy', async () => {
    const f = await setupJudgment({ decision_state: 'use_with_caution', bounded_test_allowed: true });
    expect((await f.service.check(request)).response.decision).toBe('test_spend_first');
  });
});
