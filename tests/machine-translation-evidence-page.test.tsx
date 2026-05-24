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
    if (path === '/v1/machine-execution/translation-evidence-plan') return json({
      generated_at: '2026-05-24T00:00:00.000Z',
      lane_id: 'machine_translation',
      benchmark_execution_allowed: false,
      comparable_route_count: 1,
      proven_comparable_route_count: 0,
      run_count_target: 3,
      required_proven_comparable_routes: 2,
      routes: [
        {
          service_id: 'anytrans',
          route_id: 'translation:POST:/translate',
          source_hint: 'seed',
          evidence_state: 'candidate_unproven',
          service_identity_state: 'missing',
          route_surface_state: 'missing',
          proof_profile_match: 'machine_translation_safe_phrase',
          receipt_state: 'none',
          repeatability_state: 'missing',
          comparable_route_eligible: false,
          missing_evidence: ['missing_service_identity', 'missing_route_surface', 'missing_receipt', 'missing_run_count_target'],
          next_action: 'Record route identity'
        },
        {
          service_id: 'alibaba-machine-translation-general',
          route_id: 'alibaba-machine-translation-general:POST:/api/translate/web/general',
          source_hint: 'seed',
          evidence_state: 'fixture_only',
          service_identity_state: 'present',
          route_surface_state: 'present',
          proof_profile_match: 'machine_translation_safe_phrase',
          receipt_state: 'fixture_only',
          repeatability_state: 'insufficient_runs',
          comparable_route_eligible: true,
          missing_evidence: ['missing_run_count_target'],
          next_action: 'Generate repeatability pack'
        }
      ],
      blockers: ['missing_service_identity', 'missing_route_surface', 'missing_receipt', 'missing_comparable_route', 'missing_run_count_target'],
      ctas: ['Record route identity', 'Record route surface', 'Ingest service-specific receipt', 'Generate repeatability pack', 'Re-check benchmark gate'],
      caveats: [
        'candidate_unproven does not open benchmark gate.',
        'fixture_only does not open benchmark gate unless explicitly allowed by methodology.',
        'proven requires successful service-specific receipt evidence.'
      ]
    });
    if (path === '/v1/machine-execution/benchmark-gate') return json({
      benchmark_execution_allowed: false,
      allowed_lanes: [],
      blocked_lanes: ['machine_translation'],
      blocking_reasons: ['comparable_routes_missing', 'comparable_routes_not_proven', 'readiness_not_benchmark_ready'],
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

describe('machine translation evidence page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-translation-evidence');
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

  it('renders evidence acquisition planning without benchmark or winner claims', async () => {
    root = await renderPage(container);
    const text = container.textContent ?? '';
    expect(text).toContain('Machine Translation Evidence Plan');
    expect(text).toContain('anytrans');
    expect(text).toContain('alibaba-machine-translation-general');
    expect(text).toContain('missing_service_identity');
    expect(text).toContain('missing_route_surface');
    expect(text).toContain('missing_receipt');
    expect(text).toContain('candidate_unproven does not open benchmark gate.');
    expect(text).toContain('fixture_only does not open benchmark gate unless explicitly allowed by methodology.');
    expect(text).toContain('proven requires successful service-specific receipt evidence.');
    expect(text).toContain('Benchmark gateclosed');
    expect(text).toMatch(/No benchmark claim:\s*true/);
    expect(text).toMatch(/No winner claim:\s*true/);
    expect(text).not.toMatch(/best route|winner is|benchmark winner/i);
  });
});
