import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

const seededInput = {
  route_id: 'route_pay_sh_market_research_01',
  provider_id: 'provider_pay_sh_lattice',
  service_id: 'service_market_research',
  amount_usd: 25,
  payment_rail: 'x402',
  chain: 'base'
};

describe('Hermes Wallet Safety API', () => {
  it('returns a bundled response for seeded input', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/wallet-safety/check',
      payload: seededInput
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      pre_spend_decision: expect.any(Object),
      spend_policy_check: expect.any(Object),
      policy_receipt: expect.any(Object),
      reconciliation_preview: expect.any(Object),
      wallet_audit_trail: expect.any(Object),
      wallet_risk_score: expect.any(Object),
      final_recommendation: expect.any(Object)
    }));
    expect(body.data.input.route_id).toBe(seededInput.route_id);

    await app.close();
  });

  it('returns an insufficient-evidence or manual-review response for unknown IDs', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/wallet-safety/check',
      payload: {
        route_id: 'route_unknown',
        provider_id: 'provider_unknown',
        service_id: 'service_unknown',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'base'
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.pre_spend_decision.decision).toBe('insufficient_evidence');
    expect(['insufficient_evidence', 'manual_review_required']).toContain(body.data.final_recommendation.decision);
    expect(body.data.final_recommendation.allowed).toBe(false);

    await app.close();
  });

  it('blocks unsupported chains through policy', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/wallet-safety/check',
      payload: {
        ...seededInput,
        chain: 'ethereum'
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.spend_policy_check.decision).toBe('block');
    expect(body.data.final_recommendation.decision).toBe('block_spend');

    await app.close();
  });

  it('returns a deterministic example bundle', async () => {
    const app = await createApp();

    const left = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/example' });
    const right = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/example' });

    expect(left.statusCode).toBe(200);
    expect(left.json()).toEqual(right.json());

    await app.close();
  });
});
