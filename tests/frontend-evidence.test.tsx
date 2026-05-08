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
  });
});
