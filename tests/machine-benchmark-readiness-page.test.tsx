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
    if (path === '/v1/machine-execution/benchmark-readiness') return json({
      generated_at: '2026-05-24T00:00:00.000Z',
      benchmark_claims: 0,
      winner_claims: 0,
      market_wide_execution_claims: 0,
      payment_success_claims: 0,
      lanes: [
        {
          lane_id: 'machine_translation',
          task_class: 'translation safe phrase',
          candidate_routes: [{ service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' }],
          comparable_route_count: 1,
          repeatability_state: 'single_route_repeatability_ready',
          missing_requirements: ['comparable_routes_missing'],
          readiness_status: 'single_route_repeatability_ready',
          next_action: 'Add at least one more comparable route before any benchmark artifact.',
          caveats: ['Benchmark readiness is not benchmark evidence.']
        },
        {
          lane_id: 'data_query_bigquery',
          task_class: 'bounded data query',
          candidate_routes: [{ service_id: 'bigquery', route_id: 'bigquery:POST:/query', profile_id: 'bigquery_bounded_query' }],
          comparable_route_count: 1,
          repeatability_state: 'missing',
          missing_requirements: ['comparable_routes_missing'],
          readiness_status: 'comparable_routes_missing',
          next_action: 'Add at least one more comparable route before any benchmark artifact.',
          caveats: ['Benchmark readiness is not benchmark evidence.']
        },
        {
          lane_id: 'storage_stableupload',
          task_class: 'tiny non-sensitive fixture upload',
          candidate_routes: [{ service_id: 'stableupload', route_id: 'stableupload:POST:/upload', profile_id: 'stableupload_tiny_fixture' }],
          comparable_route_count: 1,
          repeatability_state: 'missing',
          missing_requirements: ['comparable_routes_missing'],
          readiness_status: 'comparable_routes_missing',
          next_action: 'Add at least one more comparable route before any benchmark artifact.',
          caveats: ['Benchmark readiness is not benchmark evidence.']
        },
        {
          lane_id: 'navigation_naver_geocode',
          task_class: 'non-operational geocode lookup',
          candidate_routes: [{ service_id: 'naver-maps', route_id: 'naver-maps:GET:/map-geocode/v2/geocode', profile_id: 'naver_geocode_lookup' }],
          comparable_route_count: 1,
          repeatability_state: 'missing',
          missing_requirements: ['comparable_routes_missing'],
          readiness_status: 'comparable_routes_missing',
          next_action: 'Add at least one more comparable route before any benchmark artifact.',
          caveats: ['Benchmark readiness is not benchmark evidence.']
        }
      ],
      caveats: ['Readiness state only; no benchmark execution is run by this endpoint.']
    });
    if (path === '/v1/machine-execution/benchmark-gate') return json({
      benchmark_execution_allowed: false,
      allowed_lanes: [],
      blocked_lanes: ['machine_translation', 'data_query_bigquery', 'storage_stableupload', 'navigation_naver_geocode'],
      blocking_reasons: ['comparable_routes_missing', 'readiness_not_benchmark_ready', 'methodology_incomplete'],
      required_conditions: ['readiness_status = benchmark_ready', 'methodology_artifact_schema = present', 'comparable_route_count >= 2'],
      generated_at: '2026-05-24T00:00:00.000Z'
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

describe('machine benchmark readiness page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-benchmark-readiness');
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

  it('renders readiness page and required copy with lane rows', async () => {
    root = await renderPage(container);
    const text = container.textContent ?? '';
    expect(text).toContain('Machine Benchmark Readiness');
    expect(text).toContain('Benchmark readiness is not benchmark evidence.');
    expect(text).toContain('Machine Market benchmarks require robotic.sh-listed services.');
    expect(text).toContain('No robotic.sh-listed comparable route, no Machine Market benchmark.');
    expect(text).toContain('Repeatability is not route superiority.');
    expect(text).toContain('No winner claim exists until criteria and artifacts exist.');
    expect(container.querySelector('a[href="/machine-comparable-routes"]')).not.toBeNull();
    expect(text).toContain('machine_translation');
    expect(text).toContain('data_query_bigquery');
    expect(text).toContain('storage_stableupload');
    expect(text).toContain('navigation_naver_geocode');
    expect(text).toMatch(/single_route_repeatability_ready|comparable_routes_missing/);
    expect(text).toContain('Benchmark claims0');
    expect(text).toContain('Winner claims0');
    expect(text).toContain('Benchmark gate is closed');
    expect(text).toMatch(/Gate status:\s*closed/);
    expect(text).toMatch(/No benchmark claim:\s*true/);
    expect(text).toMatch(/No winner claim:\s*true/);
    expect(text).not.toMatch(/benchmark winner|best provider|worst provider/i);
  });
});
