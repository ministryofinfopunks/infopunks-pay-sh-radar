// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const now = '2026-05-08T10:00:00.000Z';

const provider = {
  id: 'provider-alpha',
  name: 'Alpha Pay',
  namespace: 'alpha',
  fqn: 'pay.alpha.router',
  category: 'payments',
  description: 'Payment routing provider.',
  endpointCount: 0,
  pricing: { min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['routing'],
  status: 'metered',
  lastSeenAt: now,
  latestTrustScore: 88,
  latestSignalScore: 73
};

const malformedProvider = {
  ...provider,
  fqn: undefined,
  category: undefined,
  pricing: { min: null, max: null, clarity: 'unknown', raw: 'unknown', type: undefined, model: undefined },
  tags: undefined,
  status: undefined
};

const dataSource = {
  mode: 'live_pay_sh_catalog',
  url: 'https://pay.sh/api/catalog',
  generated_at: now,
  provider_count: 1,
  last_ingested_at: now,
  used_fixture: false
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetch(options: { corePulse: 'ok' | 'fail' | 'timeout'; optionalFail?: boolean; searchFail?: boolean; malformedProvider?: boolean; delayFeaturedProviderSelection?: boolean; pulseTimeoutAttempts?: number; summaryFailAttempts?: number; fetchFailureMode?: 'cors_or_fetch_failed' }) {
  const calls: string[] = [];
  const requestInits: { path: string; init?: RequestInit }[] = [];
  let featuredFetchCount = 0;
  let pulseCallCount = 0;
  const activeProvider = options.malformedProvider ? malformedProvider : provider;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const path = pathOf(input);
    calls.push(path);
    requestInits.push({ path, init });
    if (path === '/v1/providers') return json([activeProvider]);
    if (path === '/v1/pulse') {
      pulseCallCount += 1;
      if (options.optionalFail && pulseCallCount > 1) return Promise.resolve(new Response(JSON.stringify({ error: 'refresh down' }), { status: 503 }));
      if (options.pulseTimeoutAttempts && pulseCallCount <= options.pulseTimeoutAttempts) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      if (options.corePulse === 'fail') return Promise.resolve(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));
      if (options.corePulse === 'timeout') {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      if (options.fetchFailureMode === 'cors_or_fetch_failed') return Promise.reject(new TypeError('Failed to fetch'));
      return json({
        providerCount: 1,
        endpointCount: 0,
        eventCount: 1,
        averageTrust: 88,
        averageSignal: 73,
        hottestNarrative: null,
        topTrust: [],
        topSignal: [],
        data_source: dataSource,
        updatedAt: now
      });
    }
    if (path === '/v1/narratives') return options.optionalFail ? Promise.resolve(new Response('{}', { status: 500 })) : json([]);
    if (path === '/v1/graph') return options.optionalFail ? Promise.resolve(new Response('{}', { status: 500 })) : json({ nodes: [], edges: [] });
    if (path === '/v1/pulse/summary') {
      if (options.summaryFailAttempts && featuredFetchCount < options.summaryFailAttempts) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'summary_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
      }
      return options.optionalFail ? Promise.resolve(new Response(JSON.stringify({ error: 'summary_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })) : json({
      generatedAt: now,
      latest_event_at: now,
      latest_batch_event_count: 1,
      ingest_interval_ms: 450000,
      latest_ingestion_run: null,
      counters: { providers: 1, endpoints: 0, events: 1, narratives: 0, unknownTelemetry: 0 },
      eventGroups: { discovery: { count: 1, recent: [] }, trust: { count: 0, recent: [] }, monitoring: { count: 0, recent: [] }, pricing: { count: 0, recent: [] }, schema: { count: 0, recent: [] }, signal: { count: 0, recent: [] } },
      timeline: [],
      trustDeltas: [],
      signalDeltas: [],
      recentDegradations: [],
      propagation: { propagation_state: 'unknown', propagation_reason: 'none', affected_cluster: null, affected_categories: [], affected_providers: [], first_observed_at: null, latest_observed_at: null, supporting_event_ids: [], confidence: 1, severity: 'unknown' },
      providerActivity: { '1h': [], '24h': [], '7d': [] },
      signalSpikes: [],
      interpretations: [],
      data_source: dataSource
      });
    }
    if (path === '/v1/providers/featured') {
      featuredFetchCount += 1;
      if (options.delayFeaturedProviderSelection && featuredFetchCount === 1) return Promise.resolve(new Response('{}', { status: 500 }));
      if (options.optionalFail) return Promise.resolve(new Response('{}', { status: 500 }));
      return json({ providerId: activeProvider.id, providerName: activeProvider.name, category: activeProvider.category, rotationWindowMs: 60000, windowStartedAt: now, nextRotationAt: now, index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
    }
    if (path === '/v1/radar/risk/ecosystem' && options.optionalFail) return Promise.resolve(new Response(JSON.stringify({ error: 'ecosystem_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    if (path === `/v1/providers/${provider.id}`) return json({ provider: activeProvider, endpoints: [], trustAssessment: null, signalAssessment: null });
    if (path === `/v1/providers/${provider.id}/intelligence`) return json({
      provider: activeProvider,
      latest_trust_score: 88,
      latest_signal_score: 73,
      risk_level: 'low',
      coordination_eligible: true,
      unknown_telemetry: [],
      recent_changes: [],
      endpoint_count: 0,
      endpoint_health: { healthy: 0, degraded: 0, failed: 0, unknown: 0, last_checked_at: null, median_latency_ms: null, recent_failures: [] },
      service_monitor: { status: 'unknown', service_url: null, last_checked_at: null, response_time_ms: null, status_code: null, monitor_mode: 'UNKNOWN', check_type: null, safe_mode: true, explanation: 'No monitor evidence.' },
      category_tags: [],
      last_seen_at: now
    });
    if (path === '/v1/search') return options.searchFail ? Promise.resolve(new Response(JSON.stringify({ error: 'search_timeout' }), { status: 503 })) : json([]);
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
  return { calls, requestInits };
}

function getHeaderFromInit(init: RequestInit | undefined, name: string) {
  const headers = new Headers(init?.headers ?? {});
  return headers.get(name);
}

describe('radar boot loading behavior', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('API timeout exits boot state', async () => {
    vi.useFakeTimers();
    const fetchState = installFetch({ corePulse: 'timeout' });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    expect(container.textContent).toContain('INFOPUNKS//PAY.SH COGNITIVE LAYER BOOTING...');

    await act(async () => {
      vi.advanceTimersByTime(10_100);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('INFOPUNKS//PAY.SH COGNITIVE LAYER BOOTING...');
    expect(container.textContent).toContain('Radar degraded: unable to load live pulse');
    expect(container.textContent).toContain('Retry');
    expect(fetchState.calls).not.toContain('/v1/search');
  });

  it('failed optional API still renders shell', async () => {
    const fetchState = installFetch({ corePulse: 'ok', optionalFail: true });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(container.textContent).toContain('Provider Directory');
    expect(container.textContent).toContain('Radar live. Some enrichment panels failed to load.');
    expect(container.textContent).toContain('Developer diagnostics');
    expect(container.textContent).not.toContain('Browser may have blocked the request during CORS/preflight');
    expect(fetchState.calls).not.toContain('/v1/search');
  });

  it('failed core API renders degraded shell', async () => {
    const fetchState = installFetch({ corePulse: 'fail' });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Radar degraded: unable to load live pulse');
    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(fetchState.calls).not.toContain('/v1/search');
  });

  it('successful API renders dashboard', async () => {
    const fetchState = installFetch({ corePulse: 'ok' });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(container.textContent).toContain('Cognitive Coordination Layer');
    expect(container.textContent).not.toContain('Radar degraded: unable to load live pulse');
    expect(fetchState.calls).not.toContain('/v1/search');
  });

  it('search failure stays local to semantic search card', async () => {
    const fetchState = installFetch({ corePulse: 'ok', searchFail: true });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = container.querySelector('input[aria-label="Search Pay.sh ecosystem intelligence"]') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(input, 'multimodal generation');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchState.calls).toContain('/v1/search');
    expect(container.textContent).toContain('Semantic search unavailable');
    expect(container.textContent).not.toContain('Radar degraded: unable to load live pulse');
  });

  it('malformed provider pricing metadata does not crash render', async () => {
    const fetchState = installFetch({ corePulse: 'ok', malformedProvider: true, delayFeaturedProviderSelection: true });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchState.calls).toContain('/v1/providers/featured');
    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(container.textContent).toContain('Provider Directory');
    expect(container.textContent).not.toContain('Radar UI degraded: rendering fallback shell');
    expect(container.textContent).not.toContain("Cannot read properties of undefined (reading 'includes')");
  });

  it('GET requests use Accept and do not send Content-Type', async () => {
    const fetchState = installFetch({ corePulse: 'ok' });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const pulseInit = fetchState.requestInits.find((item) => item.path === '/v1/pulse')?.init;
    expect(getHeaderFromInit(pulseInit, 'Accept')).toBe('application/json');
    expect(getHeaderFromInit(pulseInit, 'Content-Type')).toBeNull();
  });

  it('POST requests keep JSON Content-Type', async () => {
    const fetchState = installFetch({ corePulse: 'ok' });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = container.querySelector('input[aria-label="Search Pay.sh ecosystem intelligence"]') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(input, 'provider trust');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const searchInit = fetchState.requestInits.find((item) => item.path === '/v1/search')?.init;
    expect(getHeaderFromInit(searchInit, 'Accept')).toBe('application/json');
    expect(getHeaderFromInit(searchInit, 'Content-Type')).toBe('application/json');
  });

  it('preserves last live pulse when refresh pulse fails', async () => {
    vi.useFakeTimers();
    installFetch({ corePulse: 'ok', optionalFail: true });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Providers1');
    expect(container.textContent).toContain('Endpoints0');

    await act(async () => {
      vi.advanceTimersByTime(15_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Providers1');
    expect(container.textContent).toContain('Endpoints0');
    expect(container.textContent).toContain('Radar stale: showing last successful live data.');
  });

  it('timeout diagnostic uses timeout-specific hint and not CORS hint', async () => {
    vi.useFakeTimers();
    installFetch({ corePulse: 'timeout' });
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      vi.advanceTimersByTime(10_100);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Request timed out before a response was received.');
    expect(container.textContent).not.toContain('Browser may have blocked the request during CORS/preflight');
  });

  it('CORS/fetch failures use CORS hint', async () => {
    installFetch({ corePulse: 'ok', fetchFailureMode: 'cors_or_fetch_failed' });
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Browser may have blocked the request during CORS/preflight');
  });

  it('deduplicates repeated pulse failures and marks recovery', async () => {
    vi.useFakeTimers();
    installFetch({ corePulse: 'ok', pulseTimeoutAttempts: 1 });
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(25_100);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Startup recovered after retry.');
    const diagnosticsText = container.textContent ?? '';
    expect(diagnosticsText.match(/\/v1\/pulse/g)?.length ?? 0).toBeLessThan(4);
    expect(container.textContent).not.toContain('Radar degraded: unable to load live pulse');
  });

  it('agent mode shows compact startup status with partial enrichment', async () => {
    installFetch({ corePulse: 'ok', optionalFail: true });
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const toggle = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Agent Mode'));
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Live with partial enrichment');
  });
});
