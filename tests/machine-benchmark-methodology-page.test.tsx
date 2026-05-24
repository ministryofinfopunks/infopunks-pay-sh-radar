// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/machine-execution/benchmark-methodology') return json({
      generated_at: '2026-05-24T00:00:00.000Z',
      artifact_schema_version: 'machine_benchmark_methodology.v1',
      methodology_artifacts: [
        { benchmark_id: 'machine-benchmark-machine_translation', lane_id: 'machine_translation', task_class: 'Machine Translation lane', routes_compared: [{ service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' }], input_set: 'same phrase set', normalization_strategy: 'trim/lowercase canonical comparison', success_criteria: 'parseable translation output', run_count: 0, cost_fields: ['payment_status', 'payment_evidence'], latency_fields: ['execution_latency_ms'], payment_fields: ['payment_status', 'payment_evidence'], safety_constraints: ['no benchmark ranking claims'], policy_constraints: ['methodology_only'], comparable_route_count: 1, readiness_status: 'single_route_repeatability_ready', methodology_status: 'missing_comparable_routes', artifact_status: 'scaffold', winner_policy: 'no_winner_default', winner_claim: false, benchmark_claim: false, methodology_artifact_schema: 'present', output_normalization: 'trim/lowercase canonical comparison', run_count_target: 3, cost_fields_required: ['payment_status', 'payment_evidence'], latency_fields_required: ['execution_latency_ms'], payment_fields_required: ['payment_status', 'payment_evidence'], missing_requirements: ['comparable_routes_missing'], benchmark_allowed: false, caveats: ['Methodology artifact schema is not benchmark evidence.'], generated_at: '2026-05-24T00:00:00.000Z' },
        { benchmark_id: 'machine-benchmark-data_query_bigquery', lane_id: 'data_query_bigquery', task_class: 'Data Query / BigQuery lane', routes_compared: [{ service_id: 'bigquery', route_id: 'bigquery:POST:/query', profile_id: 'bigquery_bounded_query' }], input_set: 'bounded public/synthetic SQL', normalization_strategy: 'stable row ordering', success_criteria: 'query completes', run_count: 0, cost_fields: ['payment_status', 'payment_evidence'], latency_fields: ['execution_latency_ms'], payment_fields: ['payment_status', 'payment_evidence'], safety_constraints: ['no sensitive datasets'], policy_constraints: ['methodology_only'], comparable_route_count: 1, readiness_status: 'comparable_routes_missing', methodology_status: 'missing_comparable_routes', artifact_status: 'scaffold', winner_policy: 'no_winner_default', winner_claim: false, benchmark_claim: false, methodology_artifact_schema: 'present', output_normalization: 'stable row ordering', run_count_target: 3, cost_fields_required: ['payment_status', 'payment_evidence'], latency_fields_required: ['execution_latency_ms'], payment_fields_required: ['payment_status', 'payment_evidence'], missing_requirements: ['comparable_routes_missing'], benchmark_allowed: false, caveats: ['Methodology artifact schema is not benchmark evidence.'], generated_at: '2026-05-24T00:00:00.000Z' },
        { benchmark_id: 'machine-benchmark-storage_stableupload', lane_id: 'storage_stableupload', task_class: 'Storage / Stableupload lane', routes_compared: [{ service_id: 'stableupload', route_id: 'stableupload:POST:/upload', profile_id: 'stableupload_tiny_fixture' }], input_set: 'tiny fixture only', normalization_strategy: 'hash-first', success_criteria: 'upload accepted', run_count: 0, cost_fields: ['payment_status', 'payment_evidence'], latency_fields: ['execution_latency_ms'], payment_fields: ['payment_status', 'payment_evidence'], safety_constraints: ['no private uploads'], policy_constraints: ['methodology_only'], comparable_route_count: 1, readiness_status: 'comparable_routes_missing', methodology_status: 'missing_comparable_routes', artifact_status: 'scaffold', winner_policy: 'no_winner_default', winner_claim: false, benchmark_claim: false, methodology_artifact_schema: 'present', output_normalization: 'hash-first', run_count_target: 3, cost_fields_required: ['payment_status', 'payment_evidence'], latency_fields_required: ['execution_latency_ms'], payment_fields_required: ['payment_status', 'payment_evidence'], missing_requirements: ['comparable_routes_missing'], benchmark_allowed: false, caveats: ['Methodology artifact schema is not benchmark evidence.'], generated_at: '2026-05-24T00:00:00.000Z' },
        { benchmark_id: 'machine-benchmark-navigation_naver_geocode', lane_id: 'navigation_naver_geocode', task_class: 'Navigation / NAVER geocode lane', routes_compared: [{ service_id: 'naver-maps', route_id: 'naver-maps:GET:/map-geocode/v2/geocode', profile_id: 'naver_geocode_lookup' }], input_set: 'public landmark set', normalization_strategy: 'coordinate precision normalization', success_criteria: 'coordinate pair returned', run_count: 0, cost_fields: ['payment_status', 'payment_evidence'], latency_fields: ['execution_latency_ms'], payment_fields: ['payment_status', 'payment_evidence'], safety_constraints: ['no robot command'], policy_constraints: ['methodology_only'], comparable_route_count: 1, readiness_status: 'comparable_routes_missing', methodology_status: 'missing_comparable_routes', artifact_status: 'scaffold', winner_policy: 'no_winner_default', winner_claim: false, benchmark_claim: false, methodology_artifact_schema: 'present', output_normalization: 'coordinate precision normalization', run_count_target: 3, cost_fields_required: ['payment_status', 'payment_evidence'], latency_fields_required: ['execution_latency_ms'], payment_fields_required: ['payment_status', 'payment_evidence'], missing_requirements: ['comparable_routes_missing'], benchmark_allowed: false, caveats: ['Methodology artifact schema is not benchmark evidence.'], generated_at: '2026-05-24T00:00:00.000Z' }
      ],
      global_gate: {
        benchmark_execution_allowed: false,
        reason: 'Blocked: benchmark execution requires readiness_status=benchmark_ready, methodology_artifact_schema=present, and comparable_route_count>=2.',
        required_conditions: [
          'readiness_status = benchmark_ready',
          'methodology_artifact_schema = present',
          'comparable_route_count >= 2'
        ]
      },
      caveats: [
        'Methodology artifact schema is not benchmark evidence.',
        'No benchmark execution has been run by this scaffold.'
      ]
    });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderPage(container: HTMLDivElement) {
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('machine benchmark methodology page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-benchmark-methodology');
    container = document.createElement('div');
    document.body.append(container);
    installFetch();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders methodology page with strict no-claim posture and lane scaffolds', async () => {
    root = await renderPage(container);
    const text = container.textContent ?? '';
    expect(text).toContain('Methodology before benchmarks.');
    expect(text).toContain('This is the inspection form, not the race.');
    expect(text).toContain('No comparable route, no benchmark.');
    expect(text).toContain('No criteria, no winner.');
    expect(text).toContain('No artifact, no claim.');
    expect(text).toContain('machine_translation');
    expect(text).toContain('data_query_bigquery');
    expect(text).toContain('storage_stableupload');
    expect(text).toContain('navigation_naver_geocode');
    expect(text).toContain('Machine Translation lane');
    expect(text).toContain('Data Query / BigQuery lane');
    expect(text).toContain('Storage / Stableupload lane');
    expect(text).toContain('Navigation / NAVER geocode lane');
    expect(text).not.toMatch(/best route|best provider|winner claimed true|benchmark winner/i);
  });
});
