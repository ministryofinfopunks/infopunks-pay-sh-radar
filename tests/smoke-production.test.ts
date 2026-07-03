import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_BASE_URL,
  DEFAULT_PUBLIC_PAGE_RETRY_ATTEMPTS,
  DEFAULT_PUBLIC_PAGE_RETRY_DELAY_MS,
  DEFAULT_PUBLIC_PAGE_TIMEOUT_MS,
  ATTENTION_MARKET_INTAKE_PAYLOAD,
  HERMES_PRE_SPEND_DECISION_PAYLOAD,
  PRE_SPEND_CHECK_PAYLOAD,
  assertSignalHuntDeployment,
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
      '/signal-hunt',
      '/loops',
      '/routes',
      '/providers',
      '/services',
      '/receipts',
      '/claim',
      '/graph',
      '/narratives',
      '/narratives/attention-markets',
      '/narratives/attention-market-watch',
      '/abundance',
      '/narratives/abundance-desk',
      '/hermes',
      '/hermes/pre-spend-decision',
      '/hermes/decision-feedback',
      '/hermes/reputation-ledger',
      '/hermes/skill-pack',
      '/narratives/hermes-desk',
      '/attention-market-watch',
      '/attention-market-watch/ansem',
      '/signals/ansem',
      '/signals/black-bull',
      '/signals/troll',
      '/openapi.json',
      '/routes/route_pay_sh_market_research_01',
      '/providers/provider_pay_sh_lattice',
      '/services/service_market_research',
      '/receipts/receipt_001',
      '/claims/claim_001',
      '/loops/loop_pre_spend_route',
      '/signal-hunt/hunt_black_bull_coordination'
    ]));
  });

  it('covers the expected read-only API checks and pre-spend payload', () => {
    const plan = buildSmokePlan();

    expect(plan.apiGetPaths).toEqual([
      '/v1/graph',
      '/v1/graph/ripples',
      '/v1/loops',
      '/v1/signal-hunt',
      '/v1/routes',
      '/v1/narratives',
      '/v1/abundance',
      '/v1/abundance/claims',
      '/v1/abundance/receipts',
      '/v1/hermes',
      '/v1/hermes/skill-pack',
      '/v1/hermes/skill-pack/skills',
      '/v1/hermes/runs',
      '/v1/hermes/health',
      '/v1/hermes/pre-spend-decision/example',
      '/v1/hermes/reputation-ledger',
      '/v1/hermes/reputation-ledger/providers',
      '/v1/hermes/reputation-ledger/routes',
      '/v1/hermes/reputation-ledger/provider/provider_pay_sh_lattice',
      '/v1/attention-market-watch',
      '/v1/attention-market-watch/ansem',
      '/v1/attention-market-watch/intake/requirements',
      '/v1/signal-desk',
      '/v1/signal-desk/candidates',
      '/v1/signal-desk/candidates/candidate_sol_persona_attention',
      '/v1/signal-hunt/hunt_black_bull_coordination',
      '/v1/narratives/black-bull',
      '/v1/signals',
      '/v1/signals/black-bull',
      '/v1/signals/black-bull/updates',
      '/v1/signals/troll',
      '/v1/signals/troll/updates',
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
    expect(plan.pngPaths).toEqual([
      '/og/narratives.png',
      '/og/attention-market-watch.png',
      '/og/attention-market-watch/ansem.png',
      '/og/signals/black-bull.png',
      '/og/signals/black-bull/updates/seu_black_bull_007.png',
      '/og/signals/troll.png',
      '/og/signals/troll/updates/seu_troll_002.png'
    ]);
    expect(plan.claimsApiPaths).toEqual([
      '/v1/claims',
      '/v1/claims/claim_001',
      '/v1/claims/claim_001/challenges'
    ]);
    expect(plan.preSpendPath).toBe('/v1/pre-spend/check');
    expect(plan.attentionMarketIntakePath).toBe('/v1/attention-market-watch/intake');
    expect(plan.attentionMarketIntakeRequirementsPath).toBe('/v1/attention-market-watch/intake/requirements');
    expect(plan.graphCheckPath).toBe('/v1/graph/check');
    expect(plan.hermesReceiptPath).toBe('/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/receipt');
    expect(plan.hermesClaimPromotionPath).toBe('/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/claim/promote');
    expect(plan.hermesPreSpendDecisionPath).toBe('/v1/hermes/pre-spend-decision');
    expect(plan.hermesDecisionReceiptPath).toContain('/v1/hermes/pre-spend-decision/');
    expect(plan.hermesDecisionReceiptPath).toContain('/receipt');
    expect(plan.hermesDecisionOutcomePath).toContain('/v1/hermes/pre-spend-decision/');
    expect(plan.hermesDecisionOutcomePath).toContain('/outcome');
    expect(plan.livePulsePath).toBe('/v1/pulse');
    expect(PRE_SPEND_CHECK_PAYLOAD).toEqual({
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    });
    expect(ATTENTION_MARKET_INTAKE_PAYLOAD).toEqual({
      ticker: 'SAFE',
      name: 'Safe Persona Object',
      chain: 'Solana',
      attention_source_type: 'influencer',
      attention_source_label: 'Smoke test observer',
      submitter_handle: '@smoke',
      why_it_matters: 'This attention-market object needs evidence review before any watch-profile promotion.',
      evidence_links: ['/narratives/attention-market-watch']
    });
    expect(HERMES_PRE_SPEND_DECISION_PAYLOAD).toEqual({
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    });
  });

  it('proves Signal Hunt is deployed with OpenAPI coverage and seeded API data', () => {
    expect(() => assertSignalHuntDeployment(
      {
        paths: {
          '/v1/signal-hunt': {},
          '/v1/signal-hunt/{signalId}': {}
        }
      },
      {
        data: {
          candidates: [
            {
              id: 'hunt_black_bull_coordination',
              title: 'Black Bull Coordination'
            }
          ]
        }
      },
      {
        data: {
          id: 'hunt_black_bull_coordination',
          title: 'Black Bull Coordination'
        }
      },
      'hunt_black_bull_coordination',
      'Black Bull Coordination'
    )).not.toThrow();
  });

  it('fails clearly when Signal Hunt OpenAPI coverage is missing', () => {
    expect(() => assertSignalHuntDeployment(
      { paths: {} },
      { data: { candidates: [] } },
      { data: { id: 'hunt_black_bull_coordination', title: 'Black Bull Coordination' } },
      'hunt_black_bull_coordination',
      'Black Bull Coordination'
    )).toThrow('Signal Hunt OpenAPI paths missing');
  });
});
