import { describe, expect, it } from 'vitest';
import { createInMemoryPreSpendRepository } from '../src/repositories/preSpendRepository';
import { createPreSpendIntelligenceService } from '../src/services/preSpendIntelligenceService';

describe('pre-spend intelligence service', () => {
  it('supports repository injection without changing decision behavior', () => {
    const service = createPreSpendIntelligenceService(createInMemoryPreSpendRepository());

    const result = service.check({
      agent_id: 'agent_001',
      intent: 'price_token_quote',
      budget: 5,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 70
    });

    expect(result.decision).toBe('approved');
    expect(result.recommended_route).toBe('route_pay_sh_token_quote_01');
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('keeps default singleton-backed behavior unchanged for read-only service calls', () => {
    const service = createPreSpendIntelligenceService();
    const providers = service.listProviderSummaries();

    expect(providers.source).toBe('infopunks-pay-sh-radar');
    expect(providers.providers.some((provider) => provider.provider_id === 'provider_pay_sh_quartz')).toBe(true);
    expect(providers.metrics.routes_indexed).toBeGreaterThanOrEqual(6);
  });
});
