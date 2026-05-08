// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const now = '2026-05-08T10:00:00.000Z';

const providerAlpha = {
  id: 'provider-alpha',
  name: 'Alpha Pay',
  namespace: 'alpha',
  fqn: 'pay.alpha.router',
  category: 'payments',
  description: 'Primary routing provider.',
  endpointCount: 0,
  pricing: { min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['routing'],
  status: 'metered',
  lastSeenAt: now,
  latestTrustScore: 88,
  latestSignalScore: 73
};

const providerBetaMalformedPricing = {
  id: 'provider-beta',
  name: 'Beta Pay',
  namespace: 'beta',
  fqn: 'pay.beta.router',
  category: 'payments',
  description: 'Secondary routing provider with malformed pricing payload.',
  endpointCount: 0,
  tags: ['routing'],
  status: 'metered',
  lastSeenAt: now,
  latestTrustScore: 80,
  latestSignalScore: 61
} as unknown as typeof providerAlpha;

const dataSource = {
  mode: 'live_pay_sh_catalog',
  url: 'https://pay.sh/api/catalog',
  generated_at: now,
  provider_count: 2,
  last_ingested_at: now,
  used_fixture: false,
  error: null
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetch() {
  let featuredCallCount = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/providers') return json([providerAlpha, providerBetaMalformedPricing]);
    if (path === '/v1/pulse') return json({
      providerCount: 2,
      endpointCount: 0,
      eventCount: 1,
      averageTrust: 84,
      averageSignal: 67,
      hottestNarrative: null,
      topTrust: [],
      topSignal: [],
      data_source: dataSource,
      updatedAt: now
    });
    if (path === '/v1/narratives') return json([]);
    if (path === '/v1/graph') return json({ nodes: [], edges: [] });
    if (path === '/v1/pulse/summary') return json({
      generatedAt: now,
      latest_event_at: now,
      latest_batch_event_count: 1,
      ingest_interval_ms: 450000,
      latest_ingestion_run: null,
      counters: { providers: 2, endpoints: 0, events: 1, narratives: 0, unknownTelemetry: 0 },
      eventGroups: {
        discovery: { count: 1, recent: [] },
        trust: { count: 0, recent: [] },
        monitoring: { count: 0, recent: [] },
        pricing: { count: 0, recent: [] },
        schema: { count: 0, recent: [] },
        signal: { count: 0, recent: [] }
      },
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
    if (path === '/v1/providers/featured') {
      featuredCallCount += 1;
      if (featuredCallCount === 1) {
        return json({
          providerId: providerAlpha.id,
          providerName: providerAlpha.name,
          category: providerAlpha.category,
          rotationWindowMs: 1000,
          windowStartedAt: now,
          nextRotationAt: '2026-05-08T10:00:01.000Z',
          index: 0,
          providerCount: 2,
          strategy: 'time_window_round_robin'
        });
      }
      return json({
        providerId: providerBetaMalformedPricing.id,
        providerName: providerBetaMalformedPricing.name,
        category: providerBetaMalformedPricing.category,
        rotationWindowMs: 1000,
        windowStartedAt: now,
        nextRotationAt: '2026-05-08T10:00:15.000Z',
        index: 1,
        providerCount: 2,
        strategy: 'time_window_round_robin'
      });
    }
    if (path === '/v1/providers/provider-alpha') return json({ provider: providerAlpha, endpoints: [], trustAssessment: null, signalAssessment: null });
    if (path === '/v1/providers/provider-beta') return json({ provider: providerBetaMalformedPricing, endpoints: [], trustAssessment: null, signalAssessment: null });
    if (path === '/v1/providers/provider-alpha/intelligence' || path === '/v1/providers/provider-beta/intelligence') return json({
      provider: path.includes('provider-beta') ? providerBetaMalformedPricing : providerAlpha,
      latest_trust_score: 80,
      latest_signal_score: 61,
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
    if (path === '/v1/search') return json([]);
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

describe('radar delayed malformed pricing range resilience', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps dashboard visible when a later featured provider has missing pricing min/max', async () => {
    installFetch();

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(container.textContent).toContain('Alpha Pay');

    await act(async () => {
      vi.advanceTimersByTime(20_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Intelligence Terminal');
    expect(container.textContent).toContain('Provider Intelligence Dossier');
    expect(container.textContent).toContain('Beta Pay');
    expect(container.textContent).not.toContain('Radar UI degraded: rendering fallback shell');
  });
});
