import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_BASE_URL,
  DEFAULT_PUBLIC_PAGE_RETRY_ATTEMPTS,
  DEFAULT_PUBLIC_PAGE_RETRY_DELAY_MS,
  DEFAULT_PUBLIC_PAGE_TIMEOUT_MS,
  PRE_SPEND_CHECK_PAYLOAD,
  buildSmokePlan,
  resolveBaseUrl,
  resolveSmokeConfig
} from '../scripts/smoke-production';

describe('production smoke plan', () => {
  it('uses the public production deployment by default', () => {
    expect(DEFAULT_BASE_URL).toBe('https://radar.infopunks.fun');
    expect(resolveBaseUrl({} as NodeJS.ProcessEnv)).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl({ SMOKE_BASE_URL: 'http://localhost:8787/' } as NodeJS.ProcessEnv)).toBe('http://localhost:8787');
  });

  it('uses explicit smoke timeout and retry defaults with env overrides', () => {
    expect(resolveSmokeConfig({} as NodeJS.ProcessEnv)).toEqual({
      publicPageTimeoutMs: DEFAULT_PUBLIC_PAGE_TIMEOUT_MS,
      apiTimeoutMs: DEFAULT_API_TIMEOUT_MS,
      publicPageRetryAttempts: DEFAULT_PUBLIC_PAGE_RETRY_ATTEMPTS,
      publicPageRetryDelayMs: DEFAULT_PUBLIC_PAGE_RETRY_DELAY_MS
    });

    expect(resolveSmokeConfig({
      SMOKE_PUBLIC_PAGE_TIMEOUT_MS: '22000',
      SMOKE_API_TIMEOUT_MS: '7000',
      SMOKE_PUBLIC_PAGE_RETRY_ATTEMPTS: '2',
      SMOKE_PUBLIC_PAGE_RETRY_DELAY_MS: '1500'
    } as NodeJS.ProcessEnv)).toEqual({
      publicPageTimeoutMs: 22000,
      apiTimeoutMs: 7000,
      publicPageRetryAttempts: 2,
      publicPageRetryDelayMs: 1500
    });
  });

  it('covers the expected public pages and seeded detail routes', () => {
    const plan = buildSmokePlan();

    expect(plan.publicPaths).toEqual(expect.arrayContaining([
      '/',
      '/developers',
      '/spend-terminal',
      '/loops',
      '/routes',
      '/providers',
      '/services',
      '/receipts',
      '/claim',
      '/graph',
      '/narratives',
      '/narratives/attention-markets',
      '/signals/ansem',
      '/signals/black-bull',
      '/openapi.json',
      '/routes/route_pay_sh_market_research_01',
      '/providers/provider_pay_sh_lattice',
      '/services/service_market_research',
      '/receipts/receipt_001',
      '/claims/claim_001',
      '/loops/loop_pre_spend_route'
    ]));
  });

  it('covers the expected read-only API checks and pre-spend payload', () => {
    const plan = buildSmokePlan();

    expect(plan.apiGetPaths).toEqual([
      '/v1/graph',
      '/v1/graph/ripples',
      '/v1/loops',
      '/v1/routes',
      '/v1/narratives',
      '/v1/narratives/black-bull',
      '/v1/signals',
      '/v1/signals/black-bull',
      '/v1/signals/black-bull/updates',
      '/v1/pre-spend/providers',
      '/v1/services',
      '/v1/receipts',
      '/v1/claims',
      '/openapi.json'
    ]);
    expect(plan.apiHeadJsonPaths).toEqual([
      '/openapi.json',
      '/v1/loops',
      '/v1/checks'
    ]);
    expect(plan.claimsApiPaths).toEqual([
      '/v1/claims',
      '/v1/claims/claim_001',
      '/v1/claims/claim_001/challenges'
    ]);
    expect(plan.preSpendPath).toBe('/v1/pre-spend/check');
    expect(plan.graphCheckPath).toBe('/v1/graph/check');
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
