// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

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

describe('machine proof ladder page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-proof-ladder');
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(raw, 'http://localhost').pathname;
      if (path === '/v1/machine-execution/benchmark-gate') {
        return Promise.resolve(new Response(JSON.stringify({
          data: {
            benchmark_execution_allowed: false,
            allowed_lanes: [],
            blocked_lanes: ['machine_translation', 'data_query_bigquery', 'storage_stableupload', 'navigation_naver_geocode'],
            blocking_reasons: ['comparable_routes_missing', 'readiness_not_benchmark_ready'],
            required_conditions: ['readiness_status = benchmark_ready', 'methodology_artifact_schema = present', 'comparable_route_count >= 2'],
            generated_at: '2026-05-24T00:00:00.000Z'
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders proof ladder doctrine, stages, and bounded claims', async () => {
    root = await renderPage(container);
    const text = container.textContent ?? '';

    expect(text).toContain('Machine Market Proof Ladder');
    expect(text).toContain('Radar does not jump from catalog listing to benchmark. It records the steps between visibility, proof, repeatability, methodology, and trust.');

    expect(text).toContain('No comparable route, no benchmark.');
    expect(text).toContain('No methodology, no artifact.');
    expect(text).toContain('No artifact, no claim.');
    expect(text).toContain('No criteria, no winner.');

    for (const stage of ['Mapped', 'First-safe', 'Receipt', 'Repeatability', 'Readiness', 'Comparable routes', 'Methodology', 'Benchmark later']) {
      expect(text).toContain(stage);
    }

    const stageTable = container.querySelector('[aria-label="Machine proof ladder stage table"]');
    expect(stageTable?.querySelector('a[href="/machine-benchmark-readiness"]')?.textContent).toContain('/machine-benchmark-readiness');
    expect(stageTable?.querySelector('a[href="/machine-comparable-routes"]')?.textContent).toContain('/machine-comparable-routes');
    expect(stageTable?.querySelector('a[href="/machine-benchmark-methodology"]')?.textContent).toContain('/machine-benchmark-methodology');

    expect(text).toContain('Benchmark gate is closed');
    expect(text).toContain('Gate status: closed');
    expect(text).toContain('Why closed');
    expect(text).toContain('What must happen next');
    expect(text).toContain('No benchmark claim: true');
    expect(text).toContain('No winner claim: true');
    expect(text).toContain('Evidence-state summary only. This page does not claim benchmark execution and does not claim a winner.');
    expect(text).not.toMatch(/benchmark executed|benchmark execution succeeded|winner is|winner_claimed=true|benchmark winner/i);
  });
});
