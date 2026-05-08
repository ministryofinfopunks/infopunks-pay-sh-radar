// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-05-08T10:00:00.000Z';

const receipt = {
  event_id: 'evt-provider',
  provider_id: 'alpha',
  endpoint_id: null,
  observed_at: observedAt,
  catalog_generated_at: observedAt,
  ingested_at: observedAt,
  source: 'pay.sh:test',
  derivation_reason: 'Deterministic provider intelligence evidence.',
  confidence: 1
};

const provider = {
  ...receipt,
  id: 'alpha',
  name: 'Alpha Provider',
  namespace: 'alpha/pay',
  fqn: 'alpha.pay.provider',
  category: 'payments',
  description: 'Public provider dossier sample.',
  endpointCount: 2,
  pricing: { ...receipt, min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['pay'],
  status: 'metered',
  lastSeenAt: observedAt
};

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetchMock(missing = false) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (missing && (path === '/v1/providers/alpha' || path === '/v1/providers/alpha/intelligence')) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'provider_not_found' }), { status: 404 }));
    }
    if (path === '/v1/providers/alpha') return ok({ provider, endpoints: [], trustAssessment: { entityId: 'alpha', score: 84, grade: 'A-', components: {}, unknowns: [] }, signalAssessment: { entityId: 'alpha', score: 70, narratives: ['routing'], components: {}, unknowns: [] } });
    if (path === '/v1/providers/alpha/intelligence') return ok({
      ...receipt,
      provider,
      latest_trust_score: 84,
      latest_signal_score: 70,
      risk_level: 'low',
      coordination_eligible: true,
      unknown_telemetry: ['uptime'],
      recent_changes: [{ ...receipt, id: 'chg-1', type: 'provider.updated', observedAt, summary: 'Provider changed.', source: 'pay.sh:test' }],
      endpoint_count: 2,
      endpoint_health: { healthy: 0, degraded: 0, failed: 0, unknown: 2, last_checked_at: observedAt, median_latency_ms: null, recent_failures: [] },
      service_monitor: { status: 'unknown', service_url: null, last_checked_at: null, response_time_ms: null, status_code: null, monitor_mode: 'UNKNOWN', check_type: null, safe_mode: true, explanation: 'No monitor evidence.' },
      propagation_context: { propagation_state: 'isolated', severity: 'low', affected: false, affected_cluster: null, propagation_reason: 'No spreading risk.' },
      category_tags: ['payments'],
      last_seen_at: observedAt,
      severity: 'informational',
      severity_reason: 'Stable'
    });
    if (path === '/v1/pulse') return ok({
      providerCount: 1,
      endpointCount: 2,
      eventCount: 1,
      averageTrust: 84,
      averageSignal: 70,
      hottestNarrative: null,
      topTrust: [],
      topSignal: [],
      data_source: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: observedAt, provider_count: 1, last_ingested_at: observedAt, used_fixture: false },
      updatedAt: observedAt
    });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

describe('public provider route', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    vi.restoreAllMocks();
    root = null;
    container = null;
    window.history.replaceState({}, '', '/');
  });

  it('renders valid provider page', async () => {
    window.history.pushState({}, '', '/providers/alpha');
    installFetchMock(false);
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

    expect(container.textContent).toContain('Alpha Provider');
    expect(container.textContent).toContain('provider_id');
    expect(container.textContent).toContain('alpha.pay.provider');
  });

  it('renders useful missing provider state', async () => {
    window.history.pushState({}, '', '/providers/alpha');
    installFetchMock(true);
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

    expect(container.textContent).toContain('Provider Not Found');
    expect(container.textContent).toContain('alpha');
  });

  it('renders evidence metadata', async () => {
    window.history.pushState({}, '', '/providers/alpha');
    installFetchMock(false);
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

    expect(container.textContent).toContain('Evidence Metadata');
    expect(container.textContent).toContain('Provider Intelligence Receipt');
    expect(container.textContent).toContain('event_id');
    expect(container.textContent).toContain('source');
  });

  it('renders share URL and copy/share control', async () => {
    window.history.pushState({}, '', '/providers/alpha');
    installFetchMock(false);
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

    expect(container.textContent).toContain('Share URL:');
    expect(container.textContent).toContain('/providers/alpha');
    expect(container.querySelector('button[aria-label="Copy share URL"]')).not.toBeNull();
  });
});
