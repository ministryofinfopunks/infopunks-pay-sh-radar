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
    if (path === '/v1/machine-execution/comparable-routes') return json({
      generated_at: '2026-05-24T00:00:00.000Z',
      benchmark_claims: 0,
      winner_claims: 0,
      lanes: [
        {
          lane_id: 'machine_translation',
          task_class: 'Machine Translation',
          candidate_routes: [{ service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' }],
          comparable_route_count: 1,
          required_methodology: ['same_task'],
          missing_methodology: ['comparable_route_missing'],
          comparable_inputs: 'same phrase set',
          comparable_outputs: 'normalized translated_text',
          normalization_strategy: 'trim/lowercase',
          success_criteria: 'parseable translation output',
          run_count_target: 3,
          cost_latency_fields_required: ['execution_latency_ms', 'payment_status'],
          safety_constraints: ['no benchmark ranking claims'],
          readiness_effect: 'single route only; benchmark lane remains blocked',
          next_action: 'Add a second comparable route.'
        },
        {
          lane_id: 'data_query_bigquery',
          task_class: 'Data Query / BigQuery',
          candidate_routes: [{ service_id: 'bigquery', route_id: 'bigquery:POST:/query', profile_id: 'bigquery_bounded_query' }],
          comparable_route_count: 1,
          required_methodology: ['same_task'],
          missing_methodology: ['comparable_route_missing'],
          comparable_inputs: 'bounded query',
          comparable_outputs: 'normalized rows',
          normalization_strategy: 'stable sort',
          success_criteria: 'bounded rows returned',
          run_count_target: 3,
          cost_latency_fields_required: ['execution_latency_ms', 'payment_status'],
          safety_constraints: ['no sensitive datasets'],
          readiness_effect: 'single route only; benchmark lane remains blocked',
          next_action: 'Add a second comparable route.'
        },
        {
          lane_id: 'storage_stableupload',
          task_class: 'Storage / Stableupload',
          candidate_routes: [{ service_id: 'stableupload', route_id: 'stableupload:POST:/upload', profile_id: 'stableupload_tiny_fixture' }],
          comparable_route_count: 1,
          required_methodology: ['same_task'],
          missing_methodology: ['comparable_route_missing'],
          comparable_inputs: 'same tiny fixture',
          comparable_outputs: 'normalized upload metadata',
          normalization_strategy: 'hash-first',
          success_criteria: 'upload accepted',
          run_count_target: 3,
          cost_latency_fields_required: ['execution_latency_ms', 'payment_status'],
          safety_constraints: ['no private uploads'],
          readiness_effect: 'single route only; benchmark lane remains blocked',
          next_action: 'Add a second comparable route.'
        },
        {
          lane_id: 'navigation_naver_geocode',
          task_class: 'Navigation / NAVER geocode',
          candidate_routes: [{ service_id: 'naver-maps', route_id: 'naver-maps:GET:/map-geocode/v2/geocode', profile_id: 'naver_geocode_lookup' }],
          comparable_route_count: 1,
          required_methodology: ['same_task'],
          missing_methodology: ['comparable_route_missing'],
          comparable_inputs: 'same address set',
          comparable_outputs: 'normalized coordinates',
          normalization_strategy: 'fixed precision',
          success_criteria: 'coordinate pair returned',
          run_count_target: 3,
          cost_latency_fields_required: ['execution_latency_ms', 'payment_status'],
          safety_constraints: ['no robot command'],
          readiness_effect: 'single route only; benchmark lane remains blocked',
          next_action: 'Add a second comparable route.'
        }
      ],
      caveats: ['Comparable routes are required before benchmarks.']
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

describe('machine comparable routes page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-comparable-routes');
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

  it('renders comparable route discovery with required copy and no winner claims', async () => {
    root = await renderPage(container);
    const text = container.textContent ?? '';
    expect(text).toContain('Machine Comparable Routes');
    expect(text).toContain('Comparable routes are required before benchmarks.');
    expect(text).toContain('No comparable route, no benchmark.');
    expect(text).toContain('Methodology before leaderboard.');
    expect(text).toContain('Machine Translation');
    expect(text).toContain('Data Query / BigQuery');
    expect(text).toContain('Storage / Stableupload');
    expect(text).toContain('Navigation / NAVER geocode');
    expect(text).not.toMatch(/winner|best route|best provider/i);
  });
});
