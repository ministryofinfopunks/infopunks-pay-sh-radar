import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import {
  createInfopunksPreSpendClient,
  InfopunksPreSpendClientError
} from '../src/sdk';

describe('pre-spend SDK', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts check requests to the pre-spend endpoint and returns typed decisions', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: {
        intent: 'buy_market_research',
        decision: 'approved_with_warning',
        recommended_route: 'route_pay_sh_market_research_03',
        confidence_score: 89,
        risk_level: 'low',
        estimated_cost: '0.31 USDC',
        last_successful_run: '2026-06-15T07:30:00.000Z',
        known_blockers: ['budget cap below 0.30 USDC'],
        requires_human_approval: false,
        receipt_references: ['receipt_003', 'receipt_004'],
        safer_alternatives: ['route_pay_sh_market_research_01'],
        do_not_use: [],
        rationale: ['Structured route evidence exists.']
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    const client = createInfopunksPreSpendClient({
      baseUrl: 'https://radar.infopunks.fun/',
      fetch: fetchMock
    });

    const decision = await client.checkPreSpend({
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    });

    expect(decision.decision).toBe('approved_with_warning');
    expect(decision.recommended_route).toBe('route_pay_sh_market_research_03');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://radar.infopunks.fun/v1/pre-spend/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          accept: 'application/json',
          'content-type': 'application/json'
        })
      })
    );
  });

  it('surfaces API errors with status and code', async () => {
    const client = createInfopunksPreSpendClient({
      baseUrl: 'https://radar.infopunks.fun',
      fetch: async () => new Response(JSON.stringify({
        error: 'invalid_pre_spend_check_request',
        details: { formErrors: [], fieldErrors: { budget: ['Required'] } }
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    });

    await expect(client.checkPreSpend({
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    })).rejects.toMatchObject({
      name: 'InfopunksPreSpendClientError',
      status: 400,
      code: 'invalid_pre_spend_check_request'
    });
  });

  it('works end-to-end against the live Fastify app contract', async () => {
    const app = await createApp(emptyIntelligenceStore());
    await app.listen({ port: 0, host: '127.0.0.1' });

    try {
      const address = new URL(String(app.server.address() && `http://127.0.0.1:${(app.server.address() as { port: number }).port}`));
      const client = createInfopunksPreSpendClient({
        baseUrl: address.toString().replace(/\/$/, '')
      });

      const decision = await client.checkPreSpend({
        agent_id: 'agent_001',
        intent: 'buy_market_research',
        budget: 25,
        risk_tolerance: 'low',
        preferred_settlement: 'stablecoin',
        required_confidence: 75
      });

      expect(decision.decision).toBe('approved_with_warning');
      expect(decision.recommended_route).toMatch(/^route_pay_sh_market_research_/);
      expect(decision.rationale.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
