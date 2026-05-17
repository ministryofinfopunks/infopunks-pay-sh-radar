// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const now = '2026-05-08T10:00:00.000Z';

const provider = {
  id: 'provider-alpha',
  name: 'Alpha Pay',
  title: 'Alpha Pay Router',
  namespace: 'alpha',
  fqn: 'pay.alpha.router',
  category: 'payments',
  description: 'Payment routing provider.',
  useCase: 'agent payments',
  serviceUrl: 'https://alpha.example',
  endpointCount: 1,
  hasMetering: true,
  hasFreeTier: false,
  sourceSha: 'abc123',
  catalogGeneratedAt: now,
  pricing: { min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['routing', 'payments'],
  status: 'metered',
  lastSeenAt: now,
  latestTrustScore: 88,
  latestTrustGrade: 'A',
  latestSignalScore: 73
};

const endpoint = {
  id: 'endpoint-alpha',
  providerId: provider.id,
  name: 'Create payment',
  path: '/payments',
  method: 'POST',
  category: 'payments',
  description: 'Create a payment.',
  status: 'metered',
  pricing: provider.pricing,
  lastSeenAt: now,
  latencyMsP50: 120,
  routeEligible: true
};

const dataSource = {
  mode: 'live_pay_sh_catalog',
  url: 'https://pay.sh/api/catalog',
  generated_at: now,
  provider_count: 1,
  last_ingested_at: now,
  used_fixture: false,
  error: null
};

const trustAssessment = {
  entityId: provider.id,
  score: 88,
  grade: 'A',
  components: { metadataQuality: 90, pricingClarity: 80, freshness: 95, uptime: null, latency: null },
  unknowns: ['receipt reliability']
};

const signalAssessment = {
  entityId: provider.id,
  score: 73,
  narratives: ['Payment routing'],
  components: { categoryHeat: 70, ecosystemMomentum: 65, metadataChangeVelocity: 55 },
  unknowns: ['social velocity']
};

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

describe('web accessibility landmarks', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/providers') return json([provider]);
      if (path === '/v1/pulse') return json({
        providerCount: 1,
        endpointCount: 1,
        eventCount: 1,
        averageTrust: 88,
        averageSignal: 73,
        hottestNarrative: { id: 'n1', title: 'Payment routing', heat: 72, momentum: 9, providerIds: [provider.id], keywords: ['pay'], summary: 'Routing heat' },
        topTrust: [trustAssessment],
        topSignal: [signalAssessment],
        data_source: dataSource,
        updatedAt: now
      });
      if (path === '/v1/narratives') return json([{ id: 'n1', title: 'Payment routing', heat: 72, momentum: 9, providerIds: [provider.id], keywords: ['pay'], summary: 'Routing heat' }]);
      if (path === '/v1/graph') return json({ nodes: [{ id: provider.id }], edges: [] });
      if (path === '/v1/pulse/summary') return json({
        generatedAt: now,
        latest_event_at: now,
        latest_batch_event_count: 1,
        ingest_interval_ms: 450000,
        latest_ingestion_run: null,
        counters: { providers: 1, endpoints: 1, events: 1, narratives: 1, unknownTelemetry: 2 },
        eventGroups: {
          discovery: { count: 1, recent: [] },
          trust: { count: 0, recent: [] },
          monitoring: { count: 0, recent: [] },
          pricing: { count: 0, recent: [] },
          schema: { count: 0, recent: [] },
          signal: { count: 0, recent: [] }
        },
        timeline: [{ id: 'event-1', type: 'provider_seen', category: 'discovery', source: 'catalog', entityType: 'provider', entityId: provider.id, providerId: provider.id, providerName: provider.name, observedAt: now, summary: 'Provider discovered' }],
        trustDeltas: [],
        signalDeltas: [],
        recentDegradations: [],
        providerActivity: { '1h': [], '24h': [{ providerId: provider.id, providerName: provider.name, count: 1, categories: { discovery: 1, trust: 0, monitoring: 0, pricing: 0, schema: 0, signal: 0 }, lastObservedAt: now }], '7d': [] },
        signalSpikes: [],
        data_source: dataSource
      });
      if (path === '/v1/providers/featured') return json({ providerId: provider.id, providerName: provider.name, category: provider.category, rotationWindowMs: 60000, windowStartedAt: now, nextRotationAt: now, index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
      if (path === '/v1/radar/endpoints') return json({ generated_at: now, source: {}, count: 1, endpoints: [] });
      if (path === '/v1/radar/superiority-readiness') return json({
        generated_at: now,
        executable_provider_mappings_count: 1,
        categories_with_at_least_two_executable_mappings: [],
        categories_not_ready_for_comparison: [],
        providers_with_proven_paid_execution: [],
        providers_with_only_catalog_metadata: [provider.id],
        next_mappings_needed: []
      });
      if (path === '/v1/radar/benchmark-readiness') return json({
        generated_at: now,
        source: 'test',
        categories: [],
        benchmark_ready_categories: [],
        superiority_ready_categories: [],
        not_ready_categories: [],
        missing_requirements: [],
        recommended_next_mappings: [],
        metadata_only_warning: ''
      });
      if (path === '/v1/radar/benchmarks') return json({
        generated_at: now,
        source: 'infopunks-pay-sh-radar',
        benchmarks: []
      });
      if (path === '/v1/radar/mappings') return json({
        generated_at: now,
        source: 'infopunks-pay-sh-radar',
        count: 2,
        mappings: [
          {
            provider_name: 'StableCrypto',
            provider_id: 'merit-systems-stablecrypto-market-data',
            category: 'finance/data',
            benchmark_intent: 'get SOL price',
            endpoint_url: 'https://stablecrypto.dev/api/coingecko/price',
            method: 'POST',
            mapping_status: 'verified',
            execution_evidence_status: 'proven',
            proof_source: 'pay_cli',
            proof_reference: 'stablecrypto-sol-price-post-2026-05',
            verified_at: '2026-05-15',
            notes: 'Known successful executable mapping from Pay CLI.'
          },
          {
            provider_name: 'CoinGecko Onchain DEX API',
            provider_id: 'paysponge-coingecko',
            category: 'finance/data',
            benchmark_intent: 'get SOL price',
            endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
            method: 'GET',
            mapping_status: 'verified',
            execution_evidence_status: 'proven',
            proof_source: 'infopunks-pay-sh-agent-harness',
            proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
            verified_at: '2026-05-15',
            notes: 'Paid x402 execution succeeded.'
          }
        ]
      });
      if (path === '/v1/radar/mapping-targets') return json({
        generated_at: now,
        source: 'infopunks-pay-sh-radar',
        count: 5,
        targets: [
          { category: 'finance/data', benchmark_intent: 'token metadata', current_state: 'needs_candidate', needed_next_step: 'Add at least one candidate route mapping row for token metadata retrieval.', suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'], why_it_matters: 'Token metadata is needed for normalization before comparisons.', readiness_blocker: 'No candidate mapping exists yet for this benchmark intent.' },
          { category: 'finance/data', benchmark_intent: 'token search', current_state: 'benchmark_ready', needed_next_step: 'Run normalized token-search benchmark.', suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'], why_it_matters: 'Search intent supports benchmark input shaping.', readiness_blocker: 'None; two comparable proven routes exist, but benchmark has not been recorded yet.' },
          { category: 'ai_ml/data', benchmark_intent: 'OCR comparison', current_state: 'needs_two_comparable_mappings', needed_next_step: 'Record two comparable verified OCR mappings.', suggested_provider_candidates: [], why_it_matters: 'OCR benchmarking needs comparable workloads.', readiness_blocker: 'Fewer than two comparable mappings are available.' },
          { category: 'messaging', benchmark_intent: 'SMS/send message', current_state: 'needs_candidate', needed_next_step: 'Add initial SMS send candidate mappings.', suggested_provider_candidates: [], why_it_matters: 'Messaging routes support agent notifications.', readiness_blocker: 'No candidate mapping rows are tracked yet.' },
          { category: 'search', benchmark_intent: 'knowledge/search answer', current_state: 'needs_candidate', needed_next_step: 'Add first candidate mapping for answer-oriented search.', suggested_provider_candidates: [], why_it_matters: 'Search answer benchmarks improve route quality.', readiness_blocker: 'No candidate mapping exists for this search intent.' }
        ]
      });
      if (path === '/v1/radar/history/ecosystem') return json({
        generated_at: now,
        window: '24h',
        sample_count: 1,
        history_available: true,
        reason: null,
        series: {},
        deltas: { average_trust_delta_24h: 0, average_signal_delta_24h: 0, degradation_delta_24h: 0, trend_direction: 'stable' },
        warnings: []
      });
      if (path === '/v1/radar/risk/ecosystem') return json({
        generated_at: now,
        subject_type: 'ecosystem',
        subject_id: 'ecosystem',
        risk_score: 12,
        risk_level: 'low',
        history_available: true,
        sample_count: 1,
        explanation: 'No current predictive risk pressure.',
        anomalies: [],
        evidence: [],
        warnings: [],
        recommended_action: 'route normally',
        summary: { providers_by_risk_level: { low: 1, watch: 0, elevated: 0, critical: 0, unknown: 0 }, top_anomalies: [], categories_most_affected: [], recent_critical_events: [], stale_catalog_warning: null, anomaly_watch: [] }
      });
      if (path === `/v1/providers/${provider.id}`) return json({ provider, endpoints: [endpoint], trustAssessment, signalAssessment });
      if (path === `/v1/providers/${provider.id}/intelligence`) return json({
        provider,
        latest_trust_score: 88,
        latest_signal_score: 73,
        risk_level: 'low',
        coordination_eligible: true,
        unknown_telemetry: ['receipt reliability'],
        recent_changes: [],
        endpoint_count: 1,
        endpoint_health: { healthy: 1, degraded: 0, failed: 0, unknown: 0, last_checked_at: now, median_latency_ms: 120, recent_failures: [] },
        service_monitor: { status: 'reachable', service_url: provider.serviceUrl, last_checked_at: now, response_time_ms: 120, status_code: 200, monitor_mode: 'SAFE METADATA', check_type: 'HEAD', safe_mode: true, explanation: 'Reachable.' },
        category_tags: ['payments'],
        last_seen_at: now,
        endpoints: [endpoint]
      });
      if (path === `/v1/endpoints/${endpoint.id}/monitor`) return json({ health: 'healthy', lastCheck: { observedAt: now, payload: { response_time_ms: 120 } }, recentFailures: [] });
      if (path === '/v1/search') return json([]);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders semantic landmarks and important accessible control names', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.skip-link')?.textContent).toBe('Skip to content');
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('main#terminal-content')).not.toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();
    expect(container.querySelector('nav[aria-label="Global controls"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Realtime ecosystem intelligence sidebar"]')).not.toBeNull();
    expect(container.querySelector('section[aria-label="Anomaly Watch panel"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Predictive risk summary counts"]')?.textContent).toContain('low1');
    expect(container.querySelector('section[aria-labelledby="ecosystem-zone-title"]')).not.toBeNull();
    expect(container.querySelector('section[aria-labelledby="provider-zone-title"]')).not.toBeNull();

    expect(container.querySelector('button[aria-label="Open methodology drawer"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="Filter providers by name tag FQN or category"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Sort providers"]')).not.toBeNull();
    expect(container.querySelector('[role="group"][aria-label="Filter providers by category"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="Toggle featured provider rotation"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="Route task text"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="Agent preflight JSON input"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy API URL"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy OpenAPI URL"]')).not.toBeNull();
    expect(container.querySelector('.safe-code-block[aria-label="Batch preflight example"]')).not.toBeNull();
    expect(container.textContent).toContain('[OK] reachable');
    expect(container.textContent).not.toContain('Developer diagnostics');
  });
});
