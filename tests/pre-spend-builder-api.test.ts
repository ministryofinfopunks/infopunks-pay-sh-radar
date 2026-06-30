import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

async function postCheck(payload: Record<string, unknown>, fixedNow?: string) {
  const app = await createApp(emptyIntelligenceStore());
  const RealDate = Date;
  try {
    if (fixedNow) {
      const fixedMs = new RealDate(fixedNow).getTime();
      class MockDate extends RealDate {
        constructor(value?: string | number | Date) {
          super(arguments.length === 0 ? fixedMs : value as string | number | Date);
        }

        static now() {
          return fixedMs;
        }

        static parse = RealDate.parse;
        static UTC = RealDate.UTC;
      }

      globalThis.Date = MockDate as DateConstructor;
    }

    const response = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload });

    if (fixedNow) globalThis.Date = RealDate;
    await app.close();
    return response;
  } catch (error) {
    if (fixedNow) globalThis.Date = RealDate;
    await app.close();
    throw error;
  }
}

describe('pre-spend builder API', () => {
  it('returns approved for a high-confidence low-risk route', async () => {
    const response = await postCheck({
      agent_id: 'agent_001',
      intent: 'price_token_quote',
      budget: 5,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 70
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('approved');
    expect(body.recommended_route).toBe('route_pay_sh_token_quote_01');
    expect(body.rationale.length).toBeGreaterThan(0);
  });

  it('returns approved_with_warning when the cheaper market research route wins within the cost-selection threshold', async () => {
    const response = await postCheck({
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    }, '2026-06-20T00:00:00.000Z');
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('approved_with_warning');
    expect(body.recommended_route).toBe('route_pay_sh_market_research_01');
    expect(body.known_blockers).toEqual([
      'occasional timeout under high load',
      'output quality varies by prompt specificity'
    ]);
    expect(body.safer_alternatives).toContain('route_pay_sh_market_research_03');
    expect(body.rationale.length).toBeGreaterThan(0);
  });

  it('returns use_with_caution for stale receipts or mixed reliability', async () => {
    const response = await postCheck({
      agent_id: 'agent_002',
      intent: 'extract_receipt_fields',
      budget: 10,
      risk_tolerance: 'medium',
      preferred_settlement: 'stablecoin',
      required_confidence: 70
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.decision).toBe('use_with_caution');
    expect(response.json().data.rationale.length).toBeGreaterThan(0);
  });

  it('returns requires_human_approval for high budget or sensitive spend', async () => {
    const response = await postCheck({
      agent_id: 'agent_003',
      intent: 'run_compliance_scan',
      budget: 250,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('requires_human_approval');
    expect(body.requires_human_approval).toBe(true);
    expect(body.rationale.length).toBeGreaterThan(0);
  });

  it('returns do_not_use for repeated failures or no recent successful receipts', async () => {
    const response = await postCheck({
      agent_id: 'agent_004',
      intent: 'scrape_private_profile',
      budget: 8,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.decision).toBe('do_not_use');
    expect(response.json().data.rationale.length).toBeGreaterThan(0);
  });

  it('lists route intelligence and returns route details', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = await app.inject({ method: 'GET', url: '/v1/routes' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.routes.length).toBeGreaterThanOrEqual(6);

    const detail = await app.inject({ method: 'GET', url: '/v1/routes/route_pay_sh_token_quote_01' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.route.route_id).toBe('route_pay_sh_token_quote_01');
    expect(detail.json().data.validation_state).toBeTruthy();
    expect(detail.json().data.trust_summary.successful_receipt_count).toBeGreaterThan(0);
    await app.close();
  });

  it('lists canonical pre-spend providers and returns enriched provider details', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = await app.inject({ method: 'GET', url: '/v1/pre-spend/providers' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.providers.some((entry: any) => entry.provider_id === 'provider_pay_sh_quartz')).toBe(true);
    expect(list.json().data.providers.every((entry: any) => entry.provider_id.startsWith('provider_'))).toBe(true);
    expect(list.json().data.providers[0].trust_profile.summary.length).toBeGreaterThan(0);

    const detail = await app.inject({ method: 'GET', url: '/v1/pre-spend/providers/provider_pay_sh_quartz' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.provider.provider_id).toBe('provider_pay_sh_quartz');
    expect(detail.json().data.receipts.length).toBeGreaterThan(0);
    expect(detail.json().data.trust_profile.safe_for_first_attempt).toBe(true);
    await app.close();
  });

  it('supports /v1/providers?scope=pre-spend as a compatibility alias', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/providers?scope=pre-spend' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.providers.some((entry: any) => entry.provider_id === 'provider_pay_sh_lattice')).toBe(true);
    await app.close();
  });

  it('keeps legacy /v1/providers behavior intact when the Radar store is populated', async () => {
    const store = emptyIntelligenceStore();
    store.providers = [{
      id: 'legacy_alpha',
      name: 'Legacy Alpha',
      slug: 'legacy-alpha',
      namespace: 'pay.sh',
      category: 'payments',
      description: 'Legacy provider directory record.',
      status: 'metered',
      endpointCount: 2,
      tags: ['payments'],
      source: 'pay.sh',
      catalogUrl: 'https://pay.sh/providers/legacy-alpha',
      firstSeenAt: '2026-06-01T00:00:00.000Z',
      lastSeenAt: '2026-06-16T00:00:00.000Z',
      pricing: {
        id: 'pricing_legacy_alpha',
        entityId: 'legacy_alpha',
        providerId: 'legacy_alpha',
        currency: 'USD',
        unit: 'request',
        clarity: 'clear',
        raw: '$0.10/request',
        min: 0.1,
        max: 0.1,
        evidence: []
      },
      evidence: []
    }];
    const app = await createApp(store);
    const response = await app.inject({ method: 'GET', url: '/v1/providers' });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
    expect(response.json().data[0].id).toBe('legacy_alpha');
    expect(response.json().data[0].provider_id).toBe('legacy_alpha');
    expect(response.json().data[0].category).toBe('payments');
    await app.close();
  });

  it('lists services and returns service details', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = await app.inject({ method: 'GET', url: '/v1/services' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.services.length).toBeGreaterThanOrEqual(4);

    const detail = await app.inject({ method: 'GET', url: '/v1/services/service_market_research' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.service.service_id).toBe('service_market_research');
    expect(detail.json().data.best_route_decision_map.best_observed_route).toBe('route_pay_sh_market_research_03');
    await app.close();
  });

  it('lists receipts, returns receipt detail, creates receipts, and accepts validation', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = await app.inject({ method: 'GET', url: '/v1/receipts' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.receipts.length).toBeGreaterThanOrEqual(10);

    const detail = await app.inject({ method: 'GET', url: '/v1/receipts/receipt_003' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.receipt_id).toBe('receipt_003');
    expect(detail.json().data.impact.should_affect_future_pre_spend_decisions).toBe(true);

    const create = await app.inject({
      method: 'POST',
      url: '/v1/receipts',
      payload: {
        agent_id: 'agent_020',
        route_id: 'route_pay_sh_token_quote_01',
        provider_id: 'provider_pay_sh_quartz',
        service_id: 'service_token_pricing',
        task_type: 'price_token_quote',
        cost: '0.07 USDC',
        payment_method: 'stablecoin',
        latency_ms: 260,
        input_summary: 'SOL/USDC quote request',
        output_summary: 'bounded quote JSON',
        status: 'succeeded',
        failure_reason: null,
        validation_state: 'machine_checked',
        human_notes: [],
        confidence_delta: 3,
        evidence_artifact: 'artifact_token_quote_run_004'
      }
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().data.receipt_id).toMatch(/^receipt_/);

    const validation = await app.inject({
      method: 'POST',
      url: '/v1/validation/submit',
      payload: {
        target_type: 'receipt',
        target_id: create.json().data.receipt_id,
        validator_id: 'validator_100',
        validation_state: 'human_validated',
        output_quality_note: 'useful',
        blocker_note: null,
        dispute_note: null,
        confidence_adjustment: 5,
        human_notes: 'Looks good.'
      }
    });
    expect(validation.statusCode).toBe(200);
    expect(validation.json().data.validation_state).toBe('human_validated');
    await app.close();
  });

  it('lists claims, returns claim detail, and accepts claim and challenge submission', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const list = await app.inject({ method: 'GET', url: '/v1/claims' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.claims.length).toBeGreaterThanOrEqual(2);

    const detail = await app.inject({ method: 'GET', url: '/v1/claims/claim_001' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.claim_id).toBe('claim_001');
    expect(Array.isArray(detail.json().data.challenges)).toBe(true);

    const create = await app.inject({
      method: 'POST',
      url: '/v1/claims',
      payload: {
        submitted_by: 'builder_ui',
        claim_type: 'blocker',
        target_type: 'service',
        target_id: 'service_receipt_parsing',
        statement: 'Layout-heavy parsing still needs human validation.',
        evidence_receipt_ids: ['receipt_009'],
        evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_002'],
        status: 'submitted',
        confidence_score: 62,
        validation_state: 'machine_checked',
        support_count: 0,
        human_notes: ['Submitted in test.']
      }
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().data.claim_id).toMatch(/^claim_/);

    const challenges = await app.inject({ method: 'GET', url: `/v1/claims/${create.json().data.claim_id}/challenges` });
    expect(challenges.statusCode).toBe(200);
    expect(challenges.json().data.claim_id).toBe(create.json().data.claim_id);

    const challenge = await app.inject({
      method: 'POST',
      url: `/v1/claims/${create.json().data.claim_id}/challenges`,
      payload: {
        challenged_by: 'validator_500',
        reason: 'Fresh replacement receipts are still missing.',
        evidence_receipt_ids: ['receipt_008'],
        evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_001'],
        status: 'submitted',
        human_notes: ['Challenge submitted in test.']
      }
    });
    expect(challenge.statusCode).toBe(200);
    expect(challenge.json().data.claim_id).toBe(create.json().data.claim_id);
    await app.close();
  });

  it('keeps pre-spend API state isolated per app instance in tests', async () => {
    const firstApp = await createApp(emptyIntelligenceStore());
    const secondApp = await createApp(emptyIntelligenceStore());

    const created = await firstApp.inject({
      method: 'POST',
      url: '/v1/receipts',
      payload: {
        agent_id: 'agent_022',
        route_id: 'route_pay_sh_token_quote_01',
        provider_id: 'provider_pay_sh_quartz',
        service_id: 'service_token_pricing',
        task_type: 'price_token_quote',
        cost: '0.07 USDC',
        payment_method: 'stablecoin',
        latency_ms: 250,
        input_summary: 'BTC/USDC quote request',
        output_summary: 'bounded quote JSON',
        status: 'succeeded',
        failure_reason: null,
        validation_state: 'machine_checked',
        human_notes: [],
        confidence_delta: 4,
        evidence_artifact: 'artifact_token_quote_run_006'
      }
    });

    expect(created.statusCode).toBe(200);
    const createdReceiptId = created.json().data.receipt_id as string;

    const isolated = await secondApp.inject({ method: 'GET', url: `/v1/receipts/${createdReceiptId}` });
    expect(isolated.statusCode).toBe(404);

    await firstApp.close();
    await secondApp.close();
  });

  it('returns 404 for missing pre-spend detail entities', async () => {
    const app = await createApp(emptyIntelligenceStore());
    expect((await app.inject({ method: 'GET', url: '/v1/routes/missing-route' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/providers/provider_missing' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/pre-spend/providers/provider_missing' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/services/service_missing' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/receipts/receipt_missing' })).statusCode).toBe(404);
    await app.close();
  });
});
