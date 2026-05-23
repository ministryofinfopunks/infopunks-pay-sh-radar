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
    if (path === '/v1/radar/mappings') return json({ generated_at: now, source: 'infopunks-pay-sh-radar', count: 0, mappings: [] });
    if (path === '/v1/radar/mapping-targets') return json({ generated_at: now, source: 'infopunks-pay-sh-radar', count: 0, targets: [] });
    if (path === '/v1/radar/history/ecosystem') return json({ generated_at: now, window: '24h', sample_count: 0, history_available: false, reason: 'warming up', series: {}, deltas: { average_trust_delta_24h: null, average_signal_delta_24h: null, degradation_delta_24h: null, trend_direction: 'unknown' }, warnings: [] });
    if (path === '/v1/radar/risk/ecosystem') return json({ generated_at: now, subject_type: 'ecosystem', subject_id: 'ecosystem', risk_score: 0, risk_level: 'unknown', history_available: false, sample_count: 0, explanation: 'warming up', anomalies: [], evidence: [], warnings: [], recommended_action: 'insufficient history', summary: { providers_by_risk_level: { low: 0, watch: 0, elevated: 0, critical: 0, unknown: 0 }, top_anomalies: [], categories_most_affected: [], recent_critical_events: [], stale_catalog_warning: null, anomaly_watch: [] } });
    if (path === '/v1/radar/bundles/morning-briefing/plan') return json({
      bundle_id: 'morning-briefing',
      label: 'Morning Briefing',
      status: 'recipe_scaffold',
      topic: 'AI, crypto, world news',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.05, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'world_news_search', label: 'World News Search', intent: 'Search and summarize current world news.', plan_status: 'included', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'ai_news_search', label: 'AI News Search', intent: 'Search and summarize current AI news.', plan_status: 'included', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'crypto_market_scan', label: 'Crypto Market Scan', intent: 'Pull token discovery, metadata, and SOL price context for briefing.', plan_status: 'included', evidence_dependencies: ['finance-data-sol-price'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'top_story_selection', label: 'Top Story Selection', intent: 'Select one top story for deeper analysis using prior evidence.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'deep_dive_synthesis', label: 'Deep Dive Synthesis', intent: 'Synthesize briefing findings into an agent-ready deep dive.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [],
      execution_boundary_summary: { clean_402: 3, paid_proven: 0, billing_unclear: 2, billable_probe_observed: 0, blocked: 0 },
      evidence_summary: { recorded: 5, caveated: 0, scaffold: 0, unknown: 0 },
      estimated_cost_usd: '0.02-0.05',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
    if (path === '/v1/radar/bundles/market-research/plan') return json({
      bundle_id: 'market-research',
      label: 'Market Research',
      status: 'research_only_pending_billing_review',
      topic: 'Circle Internet Group',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.1, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'web_research', label: 'Web Research', intent: 'Collect and normalize public web research results for the topic.', plan_status: 'blocked', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billable_probe_observed', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'entity_enrichment', label: 'Entity Enrichment', intent: 'Resolve entity metadata and identity context where available.', plan_status: 'blocked', evidence_dependencies: ['finance-data-token-search'], evidence_health: 'recorded', execution_boundary: 'billable_probe_observed', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'web_source_review', label: 'Web Source Review', intent: 'Review retrieved source coverage.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'company_profile', label: 'Company Profile', intent: 'Build entity profile.', plan_status: 'review_required', evidence_dependencies: ['finance-data-token-search'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'market_context', label: 'Market Context', intent: 'Summarize market context.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'risk_scan', label: 'Risk Scan', intent: 'Scan risks.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [{ step_id: 'web_research', reason: 'billable_probe_observed_not_allowed' }, { step_id: 'entity_enrichment', reason: 'billable_probe_observed_not_allowed' }],
      execution_boundary_summary: { clean_402: 0, paid_proven: 0, billing_unclear: 4, billable_probe_observed: 2, blocked: 2 },
      evidence_summary: { recorded: 2, caveated: 0, scaffold: 0, unknown: 0 },
      estimated_cost_usd: '0.05-0.20',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
    if (path === '/v1/radar/bundles/talent-market-scanner/plan') return json({
      bundle_id: 'talent-market-scanner',
      label: 'Talent Market Scanner',
      status: 'recipe_scaffold',
      topic: 'AI engineer',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.05, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'role_search', label: 'Role Search', intent: 'Search role demand signals across public hiring sources.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'company_enrichment', label: 'Company Enrichment', intent: 'Enrich target companies with publicly visible hiring context.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'salary_scan', label: 'Salary Scan', intent: 'Collect salary context for comparable roles.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'hiring_signal_review', label: 'Hiring Signal Review', intent: 'Review hiring velocity and role demand signals.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'candidate_source_map', label: 'Candidate Source Map', intent: 'Map candidate source coverage.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [{ step_id: 'role_search', reason: 'scaffold_not_allowed' }, { step_id: 'company_enrichment', reason: 'scaffold_not_allowed' }, { step_id: 'salary_scan', reason: 'scaffold_not_allowed' }, { step_id: 'hiring_signal_review', reason: 'scaffold_not_allowed' }, { step_id: 'candidate_source_map', reason: 'scaffold_not_allowed' }],
      execution_boundary_summary: { clean_402: 0, paid_proven: 0, billing_unclear: 0, billable_probe_observed: 0, blocked: 5 },
      evidence_summary: { recorded: 0, caveated: 0, scaffold: 5, unknown: 0 },
      estimated_cost_usd: '0.03-0.12',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
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

    const primaryNav = container.querySelector('[aria-label="Primary radar zones"]');
    expect(primaryNav?.textContent).not.toContain('Machine Economy');
    expect(container.textContent).toContain('API Docs');
    expect(container.textContent).toContain('Agent Mode');
    expect(container.textContent).toContain('Machine Economy Module');
    expect(container.textContent).toContain('Machine Economy');
    expect(container.textContent).toContain('Radar now maps the robotic.sh machine-service market: 12 listed services, bounded authority policies, preflight decisions, and machine receipts.');
    expect(container.textContent).toContain('Same terminal. New species of spender.');
    expect(container.textContent).toContain('Open Machine Market');
    expect(container.querySelector('a[href="/machine-market"]')).not.toBeNull();
    expect(container.querySelector('a[href="/machine-preflight"]')).not.toBeNull();
    expect(container.querySelector('a[href="/machine-receipts"]')).not.toBeNull();
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

    for (const text of ['Export Intelligence', 'Agent Preflight', 'Provider/Endpoint Comparison Engine', 'Cost / Performance Intelligence', 'Benchmark Readiness', 'Comparison Policy', 'Anomaly Watch']) {
      expect(container.textContent).toContain(text);
    }

    expect(container.querySelector('button[aria-label="Copy OpenAPI URL"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy API URL"]')).not.toBeNull();
    expect(container.querySelector('.agent-examples-drawer[aria-label="Agent benchmark curl examples"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy Evidence Ledger"]')).not.toBeNull();
    expect(container.querySelector('.safe-code-block[aria-label="Batch preflight example"]')).not.toBeNull();
    expect(container.textContent).toContain('No comparison selected.');
    expect(container.textContent).toContain('No anomalies detected.');
  });

  it('renders agent benchmark API endpoints, curl examples, and interpretation guidance', async () => {
    root = await renderApp(container);

    expect(container.textContent).toContain('Agent Benchmark API');
    expect(container.textContent).toContain('Bundle Planner');
    expect(container.textContent).toContain('Bundles are non-executing spend recipes.');
    expect(container.textContent).toContain('Radar does not execute paid APIs from bundle plans');
    expect(container.textContent).toContain('API host: https://infopunks-pay-sh-radar.onrender.com. The public UI lives at radar.infopunks.fun; copyable API calls target the API host.');
    expect(container.textContent).toContain('GET /v1/radar/evidence-ledger/brief');
    expect(container.textContent).toContain('Compact preflight memory from the Evidence Ledger.');
    expect(container.textContent).toContain('GET /v1/radar/benchmark-summary');
    expect(container.textContent).toContain('POST /v1/radar/bundles/:bundle_id/plan');
    expect(container.textContent).toContain('GET /openapi.json');
    expect(container.textContent).toContain('Copyable curl examples');
    for (const label of ['Evidence Ledger', 'Evidence Brief', 'Morning Briefing Plan', 'Market Research Plan', 'Talent Scanner Plan', 'Morning Briefing Run Ledger', 'OpenAPI']) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toContain('Morning Briefing');
    expect(container.textContent).toContain('Market Research');
    expect(container.textContent).toContain('Talent Market Scanner');
    expect(container.textContent).toContain('3 included · 2 review-required · 0 blocked · winner_claimed=false');
    expect(container.textContent).toContain('Cleanest future Harness candidate, but not execution-ready until review-required billing boundaries are cleared.');
    expect(container.textContent).toContain('0 included · 4 review-required · 2 blocked');
    expect(container.textContent).toContain('Two billable-probe steps are blocked under strict constraints; remaining steps require billing-boundary review.');
    expect(container.textContent).toContain('0 included · 0 review-required · 5 blocked');
    expect(container.textContent).toContain('Job, salary, and hiring primitives are not yet recorded.');
    expect(container.textContent).toContain('/openapi.json');
    expect(container.textContent).toContain('winner_claimed=false');
    expect(container.textContent).toContain('Do not treat route as winner.');
    expect(container.textContent).toContain('status_code may be null in pay_cli mode');
    expect(container.textContent).toContain('Use status_evidence.');
    expect(container.textContent).not.toMatch(/best route|top route|winner route|loser route|superiority proof|ranking authority|guaranteed trust/i);
  });

  it('command palette includes expected commands and can toggle Agent Mode', async () => {
    root = await renderApp(container);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });

    for (const label of ['Open Compare', 'Open Cost / Performance', 'Open Benchmark Readiness', 'Open Agent Benchmark API', 'Open API Docs', 'Open Machine Market', 'Open Machine Market Map', 'Open Machine Readiness Matrix', 'Open Machine Service Dossier', 'Open Robotic.sh Execution Shortlist', 'Run Machine Preflight', 'View Machine Receipts', 'View Machine Translation Repeatability Artifact', 'Search Machine Dossier', 'Toggle Agent Mode', 'Jump to Degradations', 'Jump to Selected Dossier', 'Jump to Anomaly Watch']) {
      expect(container.textContent).toContain(label);
    }

    clickButton(container, 'Open Machine Market');
    expect(window.open).toHaveBeenCalledWith('/machine-market', '_self');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });

    clickButton(container, 'Open Machine Market Map');
    expect(window.open).toHaveBeenCalledWith('/machine-market-map', '_self');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });

    clickButton(container, 'Open Machine Readiness Matrix');
    expect(window.open).toHaveBeenCalledWith('/machine-readiness-matrix', '_self');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });

    clickButton(container, 'Toggle Agent Mode');
    expect(container.textContent).toContain('Agent Mode removes narrative panels');
  });
});
