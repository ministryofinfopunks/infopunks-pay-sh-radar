import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { OpenAIDecisionsAdapter } from '../../src/services/openAIDecisionsAdapter';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { facts, request, setupJudgment } from '../helpers/judgments';
import { observationInput } from '../helpers/canonicalReceipts';

afterEach(() => vi.unstubAllEnvs());

it('runs Decisions in shadow only after verified evidence and leaves quotes, receipts, and replays deterministic', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'reviewer');
  vi.stubEnv('OPENAI_DECISIONS_SHADOW_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const fetch = vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-6-luna',
    answers: [{ type: 'choice', name: 'pre_spend_suggestion', choice: 'insufficient_evidence', confidence: 0.9,
      probabilities: [{ value: 'proceed', probability: 0.02 }, { value: 'test_spend_first', probability: 0.02 },
        { value: 'do_not_spend', probability: 0.06 }, { value: 'insufficient_evidence', probability: 0.90 }] }],
    usage: { input_tokens: 30, output_tokens: 2, total_tokens: 32 }
  }), { status: 200 }));
  const adapter = new OpenAIDecisionsAdapter({ apiKey: 'test-only', fetch });
  const fixture = await setupJudgment();
  const app = await createApp(undefined, undefined, { judgmentGateway: fixture.gateway, decisionsAdapter: adapter });
  const input = { ...request, intent: 'buy_market_research', subject_id: 'route_pay_sh_market_research_03' };
  try {
    const missing = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input });
    expect(missing.statusCode).toBe(200);
    expect(missing.json()).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, receipt: null, cost: { amount: '0' } });
    expect(fetch).not.toHaveBeenCalled();

    const route = missing.json().data.recommended_route;
    const at = new Date();
    const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
      ...observationInput(), subject_type: 'route', subject_id: input.subject_id, intent_hash: hashCanonical(input), source_type: 'reviewed_judgment_facts',
      observed_at: at.toISOString(), ingested_at: at.toISOString(), freshness_expires_at: new Date(at.getTime() + 120000).toISOString(),
      provenance: { catalog_source: 'live' }, payload: { ...facts, route_id: route }
    } });
    expect(seed.statusCode).toBe(200);
    const quoted = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'shadow-replay' } });
    expect(quoted.statusCode).toBe(402);
    expect(quoted.json()).toMatchObject({ decision: 'proceed', receipt: null });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const replay = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'shadow-replay' } });
    expect(replay.statusCode).toBe(402);
    expect(replay.json().judgment_id).toBe(quoted.json().judgment_id);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await app.inject('/v1/receipt-spine/scores/route/' + input.subject_id)).json().data.score).toBe(0);
  } finally { await app.close(); }
});

it('does not invoke an injected Decisions adapter when the feature flag is disabled', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'reviewer');
  vi.stubEnv('OPENAI_DECISIONS_SHADOW_ENABLED', 'false');
  const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
  const adapter = new OpenAIDecisionsAdapter({ apiKey: 'test-only', fetch });
  const fixture = await setupJudgment();
  const app = await createApp(undefined, undefined, { judgmentGateway: fixture.gateway, decisionsAdapter: adapter });
  const input = { ...request, intent: 'buy_market_research', subject_id: 'route_pay_sh_market_research_03' };
  try {
    const missing = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input });
    const at = new Date();
    const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
      ...observationInput(), subject_type: 'route', subject_id: input.subject_id, intent_hash: hashCanonical(input), source_type: 'reviewed_judgment_facts',
      observed_at: at.toISOString(), ingested_at: at.toISOString(), freshness_expires_at: new Date(at.getTime() + 120000).toISOString(),
      provenance: { catalog_source: 'live' }, payload: { ...facts, route_id: missing.json().data.recommended_route }
    } });
    expect(seed.statusCode).toBe(200);
    const result = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input });
    expect(result.statusCode).toBe(402);
    expect(result.json().decision).toBe('proceed');
    expect(fetch).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
