// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-01-01T00:05:00.000Z';
const leakedProviderId = '0x8f91aa6617f18f996f4db6c7be12ac5f0a85f911';
const leakedEventId = 'f4a0f5dd1c2a4cfe8a1477f4f8bc62f8a5bd6c92f18e4780aee70b4d88f4bd11';

const receipt = {
  event_id: leakedEventId,
  provider_id: leakedProviderId,
  endpoint_id: null,
  observed_at: observedAt,
  catalog_generated_at: '2026-01-01T00:00:00.000Z',
  ingested_at: observedAt,
  source: 'pay.sh:test',
  derivation_reason: 'Detailed receipt keeps raw IDs for proof integrity.',
  confidence: 0.82
};

const provider = {
  ...receipt,
  id: 'provider-a',
  name: 'Provider A',
  namespace: 'pay/provider-a',
  fqn: 'pay/provider-a',
  category: 'Data',
  description: 'Test provider',
  endpointCount: 1,
  endpointMetadataPartial: false,
  hasMetering: true,
  hasFreeTier: false,
  sourceSha: 'abc123',
  catalogGeneratedAt: '2026-01-01T00:00:00.000Z',
  pricing: { ...receipt, min: 0.01, max: 0.01, clarity: 'clear', raw: '$0.01' },
  tags: ['test'],
  status: 'metered',
  lastSeenAt: observedAt,
  latestTrustScore: 70,
  latestTrustGrade: 'B',
  latestSignalScore: 55,
  evidence: [receipt]
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
      endpointCount: 1,
      eventCount: 1,
      averageTrust: 70,
      averageSignal: 55,
      hottestNarrative: null,
      topTrust: [],
      topSignal: [],
      data_source: dataSource,
      updatedAt: observedAt
    });
    if (url.endsWith('/v1/narratives')) return response([]);
    if (url.endsWith('/v1/graph')) return response({ nodes: [{ id: 'provider-a' }], edges: [], evidence: receipt });
    if (url.endsWith('/v1/providers/featured')) return response({ providerId: 'provider-a', providerName: 'Provider A', category: 'Data', rotationWindowMs: 600000, windowStartedAt: observedAt, nextRotationAt: '2026-01-01T00:15:00.000Z', index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
    if (url.endsWith('/v1/providers/provider-a')) return response({ provider, endpoints: [], trustAssessment: null, signalAssessment: null });
    if (url.endsWith('/v1/providers/provider-a/intelligence')) return response({
      provider,
      latest_trust_score: 70,
      latest_signal_score: 55,
      risk_level: 'medium',
      coordination_eligible: true,
      unknown_telemetry: [],
      recent_changes: [],
      endpoint_count: 1,
      endpoint_health: { healthy: 1, degraded: 0, failed: 0, unknown: 0, last_checked_at: observedAt, median_latency_ms: 120, recent_failures: [] },
      service_monitor: { status: 'reachable', service_url: null, last_checked_at: observedAt, response_time_ms: 120, status_code: 200, monitor_mode: 'SAFE', check_type: 'HEAD', safe_mode: true, explanation: 'Reachable.' },
      category_tags: ['Data'],
      last_seen_at: observedAt,
      trust_assessment: null,
      signal_assessment: null
    });
    if (url.endsWith('/v1/search')) return response([]);
    if (url.endsWith('/v1/pulse/summary')) return response({
      generatedAt: observedAt,
      latest_event_at: observedAt,
      latest_batch_event_count: 1,
      ingest_interval_ms: 450000,
      latest_ingestion_run: null,
      counters: { providers: 1, endpoints: 1, events: 1, narratives: 0, unknownTelemetry: 0 },
      eventGroups: {
        discovery: { count: 0, recent: [] },
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
      providerActivity: { '1h': [], '24h': [], '7d': [] },
      signalSpikes: [],
      propagation: null,
      interpretations: [{
        interpretation_id: 'interp-1',
        interpretation_title: 'Metadata reliability degrading across discovery surfaces.',
        interpretation_summary: `Unknown telemetry movement tied to ${leakedProviderId} and ${leakedEventId}.`,
        interpretation_reason: 'Detailed explanation appears in public interpretation page, not dashboard cards.',
        affected_categories: ['Data', 'Image', 'Video', 'OCR', 'Audio'],
        affected_providers: [
          leakedProviderId,
          'provider-2',
          'provider-3',
          'provider-4',
          'provider-5',
          'provider-6'
        ],
        supporting_event_ids: Array.from({ length: 124 }, (_, index) => `${leakedEventId}-${index}`),
        confidence: 0.82,
        severity: 'watch',
        observed_window: { started_at: '2026-01-01T00:00:00.000Z', ended_at: observedAt, event_count: 124 },
        evidence: receipt
      }],
      data_source: dataSource
    });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not_found' }) } as Response);
  }));
}

describe('dashboard interpretation card rendering', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    vi.unstubAllGlobals();
    root = null;
    container = null;
  });

  it('summarizes long interpretation fields while keeping receipt IDs available', async () => {
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

    const meta = container.querySelector('.interpretation-meta');
    const summary = container.querySelector('.interpretation-summary');

    expect(meta?.textContent ?? '').toContain('categories: Data, Image, Video +2 more');
    expect(meta?.textContent ?? '').toContain('providers: 6 affected providers');
    expect(meta?.textContent ?? '').toContain('evidence: 124 supporting events');
    expect(meta?.textContent ?? '').not.toContain(leakedProviderId);
    expect(meta?.textContent ?? '').not.toContain(leakedEventId);

    expect(summary?.textContent ?? '').not.toContain(leakedProviderId);
    expect(summary?.textContent ?? '').not.toContain(leakedEventId);

    expect(container.textContent).toContain('event_id');
    expect(container.textContent).toContain(leakedEventId);
  });
});
