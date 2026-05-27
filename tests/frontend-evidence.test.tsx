// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-01-01T00:05:00.000Z';
const receipt = {
  event_id: 'evt-receipt',
  provider_id: 'receipt',
  endpoint_id: null,
  observed_at: observedAt,
  catalog_generated_at: '2026-01-01T00:00:00.000Z',
  ingested_at: observedAt,
  source: 'pay.sh:test',
  derivation_reason: 'Provider-level evidence for partial catalog metadata.',
  confidence: 1
};

const provider = {
  ...receipt,
  id: 'receipt',
  name: 'Receipt API',
  namespace: 'pay/receipt',
  fqn: 'pay/receipt',
  category: 'Data',
  description: 'Receipt provider with partial endpoint metadata.',
  endpointCount: 2,
  endpointMetadataPartial: true,
  hasMetering: true,
  hasFreeTier: false,
  sourceSha: 'abc123',
  catalogGeneratedAt: '2026-01-01T00:00:00.000Z',
  pricing: { ...receipt, min: 0.01, max: 0.01, clarity: 'clear', raw: '$0.01' },
  tags: ['receipt'],
  status: 'metered',
  lastSeenAt: observedAt,
  latestTrustScore: 72,
  latestTrustGrade: 'B',
  latestSignalScore: 60,
  evidence: [receipt]
};

const trustAssessment = {
  ...receipt,
  entityId: 'receipt',
  score: 72,
  grade: 'B',
  components: { uptime: null, responseValidity: null, metadataQuality: 80, pricingClarity: 96, latency: null, receiptReliability: null, freshness: 90 },
  unknowns: ['uptime', 'responseValidity']
};

const signalAssessment = {
  ...receipt,
  entityId: 'receipt',
  score: 60,
  narratives: ['data exhaust'],
  components: { ecosystemMomentum: 70, categoryHeat: 80, metadataChangeVelocity: null, socialVelocity: null, onchainLiquidityResonance: null },
  unknowns: ['socialVelocity']
};

const dataSource = {
  mode: 'live_pay_sh_catalog',
  url: 'https://pay.sh/api/catalog',
  generated_at: '2026-01-01T00:00:00.000Z',
  provider_count: 1,
  last_ingested_at: observedAt,
  used_fixture: false,
  error: null
};

function response(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) } as Response);
}

function installFetchMock() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/v1/providers')) return response([provider]);
    if (url.endsWith('/v1/pulse')) return response({
      providerCount: 1,
      endpointCount: 2,
      eventCount: 1,
      averageTrust: 72,
      averageSignal: 60,
      hottestNarrative: null,
      topTrust: [trustAssessment],
      topSignal: [signalAssessment],
      data_source: dataSource,
      updatedAt: observedAt
    });
    if (url.endsWith('/v1/narratives')) return response([]);
    if (url.endsWith('/v1/graph')) return response({ nodes: [{ id: 'receipt' }], edges: [{ source: 'receipt', target: 'category-Data' }], evidence: receipt });
    if (url.endsWith('/v1/pulse/summary')) return response({
      generatedAt: observedAt,
      latest_event_at: observedAt,
      latest_batch_event_count: 1,
      ingest_interval_ms: 450000,
      latest_ingestion_run: null,
      counters: { providers: 1, endpoints: 2, events: 1, narratives: 0, unknownTelemetry: 3 },
      eventGroups: {
        discovery: { count: 1, recent: [] },
        trust: { count: 1, recent: [] },
        monitoring: { count: 0, recent: [] },
        pricing: { count: 0, recent: [] },
        schema: { count: 0, recent: [] },
        signal: { count: 1, recent: [] }
      },
      timeline: [{ ...receipt, id: 'evt-receipt', type: 'provider.updated', category: 'discovery', entityType: 'provider', entityId: 'receipt', providerId: 'receipt', providerName: 'Receipt API', observedAt, source: 'pay.sh:test', summary: 'Provider updated.' }],
      trustDeltas: [{ ...receipt, eventId: 'score-trust', providerId: 'receipt', providerName: 'Receipt API', score: 72, previousScore: null, delta: null, observedAt, direction: 'unknown' }],
      signalDeltas: [{ ...receipt, eventId: 'score-signal', providerId: 'receipt', providerName: 'Receipt API', score: 60, previousScore: null, delta: null, observedAt, direction: 'unknown' }],
      recentDegradations: [{ ...receipt, id: 'evt-degraded', type: 'provider.degraded', category: 'monitoring', entityType: 'provider', entityId: 'receipt', providerId: 'receipt', providerName: 'Receipt API', observedAt, source: 'pay.sh:test', summary: 'Provider degraded.' }],
      providerActivity: {
        '1h': [{ ...receipt, providerId: 'receipt', providerName: 'Receipt API', count: 1, categories: { discovery: 1, trust: 0, monitoring: 0, pricing: 0, schema: 0, signal: 0 }, lastObservedAt: observedAt }],
        '24h': [{ ...receipt, providerId: 'receipt', providerName: 'Receipt API', count: 1, categories: { discovery: 1, trust: 0, monitoring: 0, pricing: 0, schema: 0, signal: 0 }, lastObservedAt: observedAt }],
        '7d': [{ ...receipt, providerId: 'receipt', providerName: 'Receipt API', count: 1, categories: { discovery: 1, trust: 0, monitoring: 0, pricing: 0, schema: 0, signal: 0 }, lastObservedAt: observedAt }]
      },
      signalSpikes: [{ ...receipt, eventId: 'score-signal', providerId: 'receipt', providerName: 'Receipt API', score: 60, previousScore: 50, delta: 10, observedAt, direction: 'up' }],
      data_source: dataSource
    });
    if (url.endsWith('/v1/providers/featured')) return response({ providerId: 'receipt', providerName: 'Receipt API', category: 'Data', rotationWindowMs: 600000, windowStartedAt: observedAt, nextRotationAt: '2026-01-01T00:15:00.000Z', index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
    if (url.endsWith('/v1/radar/agent-readiness')) return response({
      count: 1,
      generated_at: observedAt,
      cards: [{
        provider_id: 'receipt',
        provider_label: 'Receipt API',
        readiness_state: 'recorded_evidence',
        agent_spend_readiness: 'ready_for_inspection',
        evidence_summary: {
          recorded_benchmarks: 1,
          proven_routes: 1,
          controlled_bundle_runs: 0,
          scaffold_lanes: 0,
          caveat_count: 0,
          latest_artifact_id: 'artifact-1',
          latest_observed_at: observedAt
        },
        proof_links: {
          benchmark_history: ['/v1/radar/benchmark-history/example'],
          route_timelines: ['/v1/radar/benchmark-history/example/routes/receipt'],
          bundle_runs: []
        },
        builder_next_step: 'Inspect latest route timeline and caveats before routing agents.',
        agent_guidance: 'Artifact-backed route evidence exists; inspect latest route timelines and caveats before spend.',
        winner_claimed: false,
        share_copy: 'Radar card: Receipt API is recorded_evidence. Proof exists: 1 recorded benchmarks, 1 proven routes, winner_claimed=false. Agents should inspect caveats before spend.'
      }, {
        provider_id: 'catalog-only',
        provider_label: 'Catalog Only API',
        readiness_state: 'catalog_only',
        agent_spend_readiness: 'not_ready',
        evidence_summary: {
          recorded_benchmarks: 0,
          proven_routes: 0,
          controlled_bundle_runs: 0,
          scaffold_lanes: 0,
          caveat_count: 0,
          latest_artifact_id: null,
          latest_observed_at: null
        },
        proof_links: {
          benchmark_history: [],
          route_timelines: [],
          bundle_runs: []
        },
        builder_next_step: 'No artifact-backed route evidence yet; start with unpaid 402 verification and one controlled paid proof.',
        agent_guidance: 'Catalog metadata exists, but no proof lane is recorded yet.',
        winner_claimed: false,
        share_copy: 'Radar card: Catalog Only API is catalog_only. Proof exists: 0 recorded benchmarks, 0 proven routes, winner_claimed=false. Agents should inspect caveats before spend.'
      }],
      winner_claimed: false,
      agent_guidance: ['Readiness cards are proof-state diagnostics, not rankings.']
    });
    if (url.endsWith('/v1/providers/receipt')) return response({ provider, endpoints: [], trustAssessment, signalAssessment });
    if (url.endsWith('/v1/providers/receipt/intelligence')) return response({
      provider,
      latest_trust_score: 72,
      latest_signal_score: 60,
      risk_level: 'medium',
      coordination_eligible: true,
      unknown_telemetry: ['uptime'],
      recent_changes: [{ ...receipt, id: 'evt-receipt', type: 'provider.updated', observedAt, source: 'pay.sh:test', summary: 'Provider updated.' }],
      endpoint_count: 2,
      endpoint_health: { healthy: 0, degraded: 0, failed: 0, unknown: 2, last_checked_at: null, median_latency_ms: null, recent_failures: [] },
      service_monitor: { status: 'unknown', service_url: null, last_checked_at: null, response_time_ms: null, status_code: null, monitor_mode: 'UNKNOWN', check_type: null, safe_mode: false, explanation: 'No monitor evidence.' },
      category_tags: ['Data'],
      last_seen_at: observedAt,
      trust_assessment: trustAssessment,
      signal_assessment: signalAssessment
    });
    if (url.endsWith('/v1/search')) return response([]);
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not_found' }) } as Response);
  }));
}

describe('frontend evidence receipts', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    vi.unstubAllGlobals();
    root = null;
    container = null;
  });

  it('renders evidence metadata without crashing on partial catalog data', async () => {
    installFetchMock();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Evidence');
    expect(container.textContent).toContain('Receipt');
    expect(container.textContent).toContain('provider-level evidence only');
    expect(container.textContent).toContain('LIVE CATALOG PARTIAL');
    expect(container.textContent).toContain('Provider Intelligence Dossier');
    expect(container.textContent).toContain('Agent Spend Readiness Cards');
    expect(container.textContent).toContain('Builders can now see what agents see before spending.');
    expect(container.textContent).toContain('proof-state diagnostics, not rankings.');
    expect(container.textContent).toContain('Grouped by proof maturity, not ranked.');
    expect(container.textContent).toContain('Artifact-backed cards');
    expect(container.textContent).toContain('Explored / catalog-only cards');
    expect(container.textContent).toContain('recorded_evidence');
    expect(container.textContent).toContain('ready_for_inspection');
    expect(container.textContent).toContain('winner_claimed=false');
    expect(container.textContent).toContain('Artifact-backed route evidence exists. Agents should still inspect caveats before spend.');
    expect(container.textContent).toContain('Catalog presence exists, but no artifact-backed route evidence has been recorded yet.');
    expect(container.textContent).toContain('Public share card');
    expect(container.textContent).toContain('Open readiness card');
    expect(container.textContent).toContain('Share card');
    expect(container.querySelector('a[href="/radar/readiness/receipt"]')).not.toBeNull();
  });
});
