// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-05-08T10:00:00.000Z';

const receipt = {
  event_id: 'evt-alpha',
  provider_id: 'alpha',
  endpoint_id: null,
  observed_at: observedAt,
  catalog_generated_at: observedAt,
  ingested_at: observedAt,
  source: 'pay.sh:test',
  derivation_reason: 'Endpoint intelligence test evidence.',
  confidence: 1,
  severity: 'informational'
};

const provider = {
  ...receipt,
  id: 'alpha',
  name: 'Alpha Data',
  namespace: 'pay/alpha',
  fqn: 'pay.alpha.data',
  category: 'data',
  description: 'Provider with endpoint intelligence.',
  endpointCount: 2,
  pricing: { ...receipt, min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['data'],
  status: 'metered',
  serviceUrl: 'https://alpha.test',
  lastSeenAt: observedAt,
  latestTrustScore: 86,
  latestSignalScore: 74
};

const endpoint = {
  ...receipt,
  id: 'ep-lookup',
  endpoint_id: 'ep-lookup',
  endpointId: 'ep-lookup',
  providerId: 'alpha',
  provider_id: 'alpha',
  name: 'Lookup',
  path: '/lookup',
  method: 'GET',
  category: 'data',
  description: 'Lookup endpoint.',
  pricing: { ...receipt, min: 0.01, max: 0.01, clarity: 'clear', raw: '$0.01' },
  status: 'available',
  lastSeenAt: observedAt,
  latencyMsP50: null,
  routeEligible: true,
  schema: { input: { type: 'object' }, output: { type: 'object' } }
};

const normalizedEndpoint = {
  endpoint_id: 'ep-lookup',
  endpoint_name: 'Lookup',
  provider_id: 'alpha',
  provider_name: 'Alpha Data',
  category: 'data',
  method: 'GET',
  path: '/lookup',
  url: 'https://alpha.test/lookup',
  description: 'Lookup endpoint.',
  pricing: { min: 0.01, max: 0.01, currency: null, unit: null, clarity: 'clear', raw: '$0.01', source: null },
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  catalog_observed_at: observedAt,
  catalog_generated_at: observedAt,
  provider_trust_score: 86,
  provider_signal_score: 74,
  provider_grade: 'A',
  reachability_status: 'reachable',
  degradation_status: 'healthy',
  route_eligibility: true,
  route_rejection_reasons: [],
  metadata_quality_score: 90,
  pricing_clarity_score: 95,
  source: 'pay.sh:test'
};

const incompleteEndpoint = {
  ...normalizedEndpoint,
  endpoint_id: 'ep-incomplete',
  endpoint_name: null,
  method: null,
  path: null,
  url: null,
  category: null,
  pricing: { min: null, max: null, raw: null },
  input_schema: null,
  output_schema: null,
  catalog_observed_at: null,
  reachability_status: 'degraded',
  degradation_status: 'degraded',
  route_eligibility: false,
  route_rejection_reasons: ['endpoint_method_unknown', 'provider_degraded']
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function pulseSummary(recentDegraded = false) {
  return {
    generatedAt: observedAt,
    latest_event_at: observedAt,
    latest_batch_event_count: 1,
    ingest_interval_ms: 450000,
    latest_ingestion_run: null,
    counters: { providers: 1, endpoints: 2, events: 1, narratives: 0, unknownTelemetry: 1 },
    eventGroups: { discovery: { count: 1, recent: [] }, trust: { count: 0, recent: [] }, monitoring: { count: recentDegraded ? 1 : 0, recent: [] }, pricing: { count: 0, recent: [] }, schema: { count: 0, recent: [] }, signal: { count: 0, recent: [] } },
    timeline: [],
    trustDeltas: [],
    signalDeltas: [],
    recentDegradations: recentDegraded ? [{ ...receipt, id: 'degraded', type: 'provider.failed', category: 'monitoring', entityType: 'provider', entityId: 'alpha', providerId: 'alpha', providerName: 'Alpha Data', observedAt, summary: 'Provider failed safe metadata monitor.' }] : [],
    propagation: { propagation_state: 'unknown', propagation_reason: 'none', affected_cluster: null, affected_categories: [], affected_providers: [], first_observed_at: null, latest_observed_at: null, supporting_event_ids: [], confidence: 1, severity: 'unknown' },
    providerActivity: { '1h': [], '24h': [], '7d': [] },
    signalSpikes: [],
    interpretations: [],
    data_source: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: observedAt, provider_count: 1, last_ingested_at: observedAt, used_fixture: false }
  };
}

function installFetch(options: { endpoints?: unknown[]; detailEndpoints?: unknown[]; degraded?: boolean } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/pulse') return json({ providerCount: 1, endpointCount: options.endpoints?.length ?? 0, eventCount: 1, averageTrust: 86, averageSignal: 74, hottestNarrative: null, topTrust: [], topSignal: [], data_source: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: observedAt, provider_count: 1, last_ingested_at: observedAt, used_fixture: false }, updatedAt: observedAt });
    if (path === '/v1/providers') return json([provider]);
    if (path === '/v1/narratives') return json([]);
    if (path === '/v1/graph') return json({ nodes: [], edges: [] });
    if (path === '/v1/pulse/summary') return json(pulseSummary(options.degraded));
    if (path === '/v1/providers/featured') return json({ providerId: 'alpha', providerName: 'Alpha Data', category: 'data', rotationWindowMs: 60000, windowStartedAt: observedAt, nextRotationAt: '2026-05-08T10:01:00.000Z', index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
    if (path === '/v1/radar/endpoints') return json({ generated_at: observedAt, source: {}, count: options.endpoints?.length ?? 0, endpoints: options.endpoints ?? [] });
    if (path === '/v1/providers/alpha') return json({ provider, endpoints: options.detailEndpoints ?? [], trustAssessment: { entityId: 'alpha', score: 86, grade: 'A', components: {}, unknowns: [] }, signalAssessment: { entityId: 'alpha', score: 74, narratives: ['data'], components: {}, unknowns: [] } });
    if (path === '/v1/providers/alpha/intelligence') return json({
      ...receipt,
      provider,
      latest_trust_score: 86,
      latest_signal_score: 74,
      risk_level: options.degraded ? 'high' : 'low',
      coordination_eligible: !options.degraded,
      unknown_telemetry: ['uptime'],
      recent_changes: options.degraded ? [{ ...receipt, id: 'degraded', type: 'provider.failed', observedAt, summary: 'Provider failed safe metadata monitor.' }] : [],
      endpoint_count: provider.endpointCount,
      endpoint_health: { healthy: options.degraded ? 0 : 1, degraded: options.degraded ? 1 : 0, failed: 0, unknown: 1, last_checked_at: observedAt, median_latency_ms: null, recent_failures: [] },
      service_monitor: { status: options.degraded ? 'failed' : 'reachable', service_url: null, last_checked_at: observedAt, response_time_ms: null, status_code: null, monitor_mode: 'SAFE METADATA', check_type: null, safe_mode: true, explanation: options.degraded ? 'Provider failed safe metadata monitor.' : 'Provider reachable.' },
      category_tags: ['data'],
      last_seen_at: observedAt
    });
    if (path === '/v1/endpoints/ep-lookup/monitor') return json({ health: 'reachable', lastCheck: { observedAt, payload: {} }, recentFailures: [] });
    if (path === '/v1/radar/superiority-readiness') return json({
      generated_at: observedAt,
      executable_provider_mappings_count: 1,
      categories_with_at_least_two_executable_mappings: [],
      categories_not_ready_for_comparison: ['data'],
      providers_with_proven_paid_execution: [],
      providers_with_only_catalog_metadata: ['alpha'],
      next_mappings_needed: ['data: +1 executable mapping(s)']
    });
    if (path === '/v1/radar/preflight') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      input: { intent: 'get SOL price', category: 'data', constraints: { min_trust: 80 } },
      recommended_route: { provider_id: 'alpha', provider_name: 'Alpha Data', endpoint_id: 'ep-lookup', endpoint_name: 'Lookup', trust_score: 86, signal_score: 74, route_eligibility: true, confidence: 90, reasons: ['mapping_complete'], rejection_reasons: [], mapping_status: 'complete', reachability_status: 'reachable', pricing_status: 'clear', last_seen_healthy: observedAt },
      accepted_candidates: [],
      rejected_candidates: [],
      warnings: [],
      superiority_evidence_available: false
    });
    if (path === '/v1/radar/compare') return json({ generated_at: observedAt, mode: 'provider', rows: [{ id: 'alpha', type: 'provider', name: 'Alpha Data', trust_score: 86, signal_score: 74, endpoint_count: 2, mapped_endpoint_count: 2, route_eligible_endpoint_count: 1, degradation_count: 0, pricing_clarity: 95, metadata_quality: 90, reachability: 'reachable', last_observed: observedAt, last_seen_healthy: observedAt, route_recommendation: 'route_eligible', rejection_reasons: [] }] });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderApp(container: HTMLElement) {
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return root!;
}

describe('radar endpoint intelligence UI', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders selected provider endpoint intelligence from normalized endpoint export', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Endpoint Intelligence');
    expect(container.textContent).toContain('Lookup');
    expect(container.textContent).toContain('route eligible');
  });

  it('renders selected provider with no endpoint rows without hiding the provider', async () => {
    installFetch({ endpoints: [], detailEndpoints: [] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Alpha Data');
    expect(container.textContent).toContain('Mapping incomplete');
    expect(container.textContent).toContain('Pay.sh catalog reports 2 endpoints');
  });

  it('shows expandable endpoint details and copy JSON button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const details = container.querySelector('.endpoint-intelligence-card') as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    details!.open = true;
    const copyButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Copy JSON') as HTMLButtonElement | undefined;
    expect(copyButton).toBeTruthy();

    await act(async () => {
      copyButton!.click();
    });

    expect(container.textContent).toContain('Normalized Endpoint JSON');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"endpoint_id": "ep-lookup"'));
  });

  it('shows incomplete mapping state instead of fake curl', async () => {
    installFetch({ endpoints: [incompleteEndpoint], detailEndpoints: [] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Mapping incomplete');
    expect(container.textContent).toContain('curl unavailable: endpoint mapping incomplete');
    expect(container.textContent).toContain('not recommended for routing');
  });

  it('shows degraded route warning while keeping provider visible', async () => {
    installFetch({ endpoints: [incompleteEndpoint], detailEndpoints: [], degraded: true });
    root = await renderApp(container);

    expect(container.textContent).toContain('Alpha Data');
    expect(container.textContent).toContain('Provider degraded warning');
    expect(container.textContent).toContain('not recommended for routing');
    expect(container.textContent).toContain('last seen healthy');
  });

  it('renders premium navigation and runs agent preflight without executing paid APIs', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Global Pulse');
    expect(container.textContent).toContain('Preflight');
    expect(container.textContent).toContain('Routing intelligence for the Pay.sh agent economy.');
    expect(container.textContent).toContain('Ask Radar where an agent should route before spending.');

    const example = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Find SOL price route') as HTMLButtonElement | undefined;
    expect(example).toBeTruthy();
    await act(async () => {
      example!.click();
    });

    const run = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Run Preflight') as HTMLButtonElement | undefined;
    expect(run).toBeTruthy();
    await act(async () => {
      run!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Route candidate found');
    expect(container.textContent).toContain('Accepted candidate');
    expect(container.textContent).toContain('/v1/radar/preflight');
    expect(container.textContent).toContain('Superiority Proof Readiness');
  });
});
