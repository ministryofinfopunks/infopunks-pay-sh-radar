// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const now = '2026-05-13T10:00:00.000Z';
const dataSource = {
  mode: 'live_pay_sh_catalog',
  url: 'https://pay.sh/api/catalog',
  generated_at: now,
  provider_count: 0,
  last_ingested_at: now,
  used_fixture: false,
  error: null
};

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function pulseSummary() {
  return {
    generatedAt: now,
    latest_event_at: now,
    latest_batch_event_count: 0,
    ingest_interval_ms: 450000,
    latest_ingestion_run: null,
    counters: { providers: 0, endpoints: 0, events: 0, narratives: 1, unknownTelemetry: 0 },
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
    propagation: { propagation_state: 'unknown', propagation_reason: 'No propagation.', affected_cluster: null, affected_categories: [], affected_providers: [], first_observed_at: null, latest_observed_at: null, supporting_event_ids: [], confidence: 1, severity: 'unknown' },
    providerActivity: { '1h': [], '24h': [], '7d': [] },
    signalSpikes: [],
    interpretations: [],
    data_source: dataSource
  };
}

function installFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/pulse') return json({
      providerCount: 0,
      endpointCount: 0,
      eventCount: 0,
      averageTrust: null,
      averageSignal: null,
      hottestNarrative: null,
      topTrust: [],
      topSignal: [],
      interpretations: [],
      data_source: dataSource,
      updatedAt: now
    });
    if (path === '/v1/providers') return json([]);
    if (path === '/v1/narratives') return json([{ id: 'n1', title: 'Narrative test', heat: 10, momentum: 1, providerIds: [], keywords: ['test'], summary: 'Narrative.' }]);
    if (path === '/v1/graph') return json({ nodes: [], edges: [] });
    if (path === '/v1/pulse/summary') return json(pulseSummary());
    if (path === '/v1/providers/featured') return json({ providerId: null, providerName: null, category: null, rotationWindowMs: 60000, windowStartedAt: now, nextRotationAt: now, index: null, providerCount: 0, strategy: 'time_window_round_robin' });
    if (path === '/v1/radar/endpoints') return json({ generated_at: now, source: {}, count: 0, endpoints: [] });
    if (path === '/v1/radar/superiority-readiness') return json({ generated_at: now, executable_provider_mappings_count: 0, categories_with_at_least_two_executable_mappings: [], categories_not_ready_for_comparison: [], providers_with_proven_paid_execution: [], providers_with_only_catalog_metadata: [], next_mappings_needed: [] });
    if (path === '/v1/radar/benchmark-readiness') return json({ generated_at: now, source: 'infopunks-pay-sh-radar', categories: [], benchmark_ready_categories: [], superiority_ready_categories: [], not_ready_categories: [], missing_requirements: [], recommended_next_mappings: [], metadata_only_warning: 'Catalog metadata only.' });
    if (path === '/v1/radar/benchmarks') return json({ generated_at: now, source: 'infopunks-pay-sh-radar', benchmarks: [] });
    if (path === '/v1/radar/history/ecosystem') return json({ generated_at: now, window: '24h', sample_count: 0, history_available: false, reason: 'warming up', series: {}, deltas: { average_trust_delta_24h: null, average_signal_delta_24h: null, degradation_delta_24h: null, trend_direction: 'unknown' }, warnings: [] });
    if (path === '/v1/radar/risk/ecosystem') return json({ generated_at: now, subject_type: 'ecosystem', subject_id: 'ecosystem', risk_score: 0, risk_level: 'unknown', history_available: false, sample_count: 0, explanation: 'warming up', anomalies: [], evidence: [], warnings: [], recommended_action: 'insufficient history', summary: { providers_by_risk_level: { low: 0, watch: 0, elevated: 0, critical: 0, unknown: 0 }, top_anomalies: [], categories_most_affected: [], recent_critical_events: [], stale_catalog_warning: null, anomaly_watch: [] } });
    if (path === '/v1/search') return json([]);
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderApp(container: HTMLElement) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('agent mode and command palette', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    installFetch();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    root = null;
  });

  it('renders API Docs and Agent Mode controls', async () => {
    root = await renderApp(container);

    expect(container.textContent).toContain('API Docs');
    expect(container.textContent).toContain('Agent Mode');
  });

  it('Agent Mode hides narrative panels and keeps preflight export and API docs visible', async () => {
    root = await renderApp(container);
    expect(container.textContent).toContain('Narrative Heatmap');

    clickButton(container, 'Agent Mode');

    expect(container.textContent).toContain('Agent Mode removes narrative panels');
    expect(container.textContent).not.toContain('Narrative Heatmap');
    expect(container.textContent).toContain('Agent Preflight');
    expect(container.textContent).toContain('Export Intelligence');
    expect(container.textContent).toContain('API Docs');
  });

  it('Cmd+K opens command palette and Escape closes it', async () => {
    root = await renderApp(container);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      await Promise.resolve();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });

    expect(container.querySelector('[role="dialog"][aria-label="Command palette"]')).not.toBeNull();
    expect(container.textContent).toContain('Focus Semantic Search');
    expect(container.textContent).toContain('Open Agent Preflight');
    expect(container.textContent).toContain('Export Providers CSV');

    const input = container.querySelector('input[aria-label="Search commands"]');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input?.getAttribute('aria-controls')).toBe('command-palette-list');
    expect(input?.getAttribute('aria-activedescendant')).toBe('command-focus-search');
    expect(container.querySelector('#command-focus-search')?.getAttribute('aria-label')).toContain('Focus Semantic Search');
    await act(async () => {
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"][aria-label="Command palette"]')).toBeNull();
  });

  it('renders mobile-safe actionable Agent Mode sections and accessible copy/code controls', async () => {
    root = await renderApp(container);

    clickButton(container, 'Agent Mode');

    for (const text of ['Export Intelligence', 'Agent Preflight', 'Provider/Endpoint Comparison Engine', 'Cost / Performance Intelligence', 'Benchmark Readiness', 'Superiority Proof Readiness', 'Anomaly Watch']) {
      expect(container.textContent).toContain(text);
    }

    expect(container.querySelector('button[aria-label="Copy OpenAPI URL"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy API URL"]')).not.toBeNull();
    expect(container.querySelector('.safe-code-block[aria-label="Batch preflight example"]')).not.toBeNull();
    expect(container.textContent).toContain('No comparison selected.');
    expect(container.textContent).toContain('No anomalies detected.');
  });

  it('command palette includes expected commands and can toggle Agent Mode', async () => {
    root = await renderApp(container);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });

    for (const label of ['Open Compare', 'Open Cost / Performance', 'Open Benchmark Readiness', 'Open API Docs', 'Toggle Agent Mode', 'Jump to Degradations', 'Jump to Selected Dossier', 'Jump to Anomaly Watch']) {
      expect(container.textContent).toContain(label);
    }

    clickButton(container, 'Toggle Agent Mode');
    expect(container.textContent).toContain('Agent Mode removes narrative panels');
  });
});
