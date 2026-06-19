import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, PRE_SPEND_CHECK_PAYLOAD, buildSmokePlan, resolveBaseUrl } from '../scripts/smoke-production';

describe('production smoke plan', () => {
  it('uses the public production deployment by default', () => {
    expect(DEFAULT_BASE_URL).toBe('https://radar.infopunks.fun');
    expect(resolveBaseUrl({} as NodeJS.ProcessEnv)).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl({ SMOKE_BASE_URL: 'http://localhost:8787/' } as NodeJS.ProcessEnv)).toBe('http://localhost:8787');
  });

  it('covers the expected public pages and seeded detail routes', () => {
    const plan = buildSmokePlan();

    expect(plan.publicPaths).toEqual(expect.arrayContaining([
      '/',
      '/developers',
      '/spend-terminal',
      '/routes',
      '/providers',
      '/services',
      '/receipts',
      '/claim',
      '/openapi.json',
      '/routes/route_pay_sh_market_research_01',
      '/providers/provider_pay_sh_lattice',
      '/services/service_market_research',
      '/receipts/receipt_001',
      '/claims/claim_001'
    ]));
  });

  it('covers the expected read-only API checks and pre-spend payload', () => {
    const plan = buildSmokePlan();

    expect(plan.apiGetPaths).toEqual([
      '/v1/routes',
      '/v1/pre-spend/providers',
      '/v1/services',
      '/v1/receipts',
      '/v1/claims',
      '/openapi.json'
    ]);
    expect(plan.claimsApiPaths).toEqual([
      '/v1/claims',
      '/v1/claims/claim_001',
      '/v1/claims/claim_001/challenges'
    ]);
    expect(plan.preSpendPath).toBe('/v1/pre-spend/check');
    expect(plan.livePulsePath).toBe('/v1/pulse');
    expect(PRE_SPEND_CHECK_PAYLOAD).toEqual({
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    });
  });
});
