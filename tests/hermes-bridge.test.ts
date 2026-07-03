import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLivePreSpendRun, getHermesBridgeConfig } from '../src/services/hermesBridge';

const INPUT = {
  route_id: 'route_pay_sh_market_research_01',
  provider_id: 'provider_pay_sh_lattice',
  service_id: 'service_market_research',
  spend_context: {
    intent: 'buy_market_research',
    budget_usd: 25
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hermes bridge', () => {
  it('normalizes Hermes bridge config into safe defaults', () => {
    expect(getHermesBridgeConfig({})).toEqual({
      enabled: false,
      mode: 'mock',
      baseUrl: undefined,
      hasApiKey: false
    });

    expect(getHermesBridgeConfig({
      HERMES_ENABLED: 'true',
      HERMES_MODE: 'http',
      HERMES_BASE_URL: ' http://localhost:8000 ',
      HERMES_API_KEY: ' secret '
    })).toEqual({
      enabled: true,
      mode: 'http',
      baseUrl: 'http://localhost:8000',
      hasApiKey: true
    });
  });

  it('falls back to a mock run when Hermes is not enabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const run = await createLivePreSpendRun(INPUT, {
      HERMES_ENABLED: 'false',
      HERMES_MODE: 'http',
      HERMES_BASE_URL: 'http://localhost:8000'
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(run.source).toBe('mock');
    expect(run.summary).toContain('No live Hermes sidecar call was made');
  });

  it('falls back to a mock run on Hermes HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

    const run = await createLivePreSpendRun(INPUT, {
      HERMES_ENABLED: 'true',
      HERMES_MODE: 'http',
      HERMES_BASE_URL: 'http://localhost:8000'
    });

    expect(run.source).toBe('hermes_http_fallback');
    expect(run.fallback_reason).toContain('ECONNREFUSED');
    expect(run.lifecycle_events?.map((event) => event.state)).toEqual([
      'queued',
      'mock_investigation_started',
      'mock_receipt_generated',
      'completed'
    ]);
  });
});
