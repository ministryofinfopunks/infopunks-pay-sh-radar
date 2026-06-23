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
  return new URL(raw, 'http://localhost').pathname + new URL(raw, 'http://localhost').search;
}

function installFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/providers/alpha/intelligence') return json({
      provider: { id: 'alpha', name: 'Alpha Provider', category: 'payments', description: 'Public provider dossier sample.' },
      latest_trust_score: 84,
      latest_signal_score: 70,
      risk_level: 'low',
      recent_changes: [{ id: 'chg-1' }, { id: 'chg-2' }],
      endpoint_count: 2,
      endpoint_health: { healthy: 2, degraded: 0, failed: 0, unknown: 0, recent_failures: [] },
      service_monitor: { status: 'reachable' },
      severity: 'informational',
      severity_reason: 'Stable'
    });
    if (path === '/v1/providers/missing/intelligence') return Promise.resolve(new Response(JSON.stringify({ error: 'provider_not_found' }), { status: 404 }));
    if (path === '/v1/radar/benchmarks/finance-data-sol-price') return json({
      benchmark_id: 'finance-data-sol-price',
      category: 'finance/data',
      benchmark_intent: 'get sol price',
      benchmark_recorded: true,
      winner_claimed: false,
      winner_status: 'no_clear_winner',
      next_step: 'inspect the artifact',
      readiness_note: 'Recorded evidence exists. No winner is claimed.',
      routes: [
        { provider_id: 'alpha', route_id: 'alpha-sol-price', execution_status: 'proven', paid_execution_proven: true, comparison_notes: 'no winner claim' },
        { provider_id: 'beta', route_id: 'beta-sol-price', execution_status: 'proven', paid_execution_proven: true, comparison_notes: 'no winner claim' }
      ]
    });
    if (path === '/v1/radar/benchmarks/finance-data-sol-price/history') return json({
      benchmark_id: 'finance-data-sol-price',
      entries: [],
      artifact_count: 1,
      latest_artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16',
      total_recorded_runs: 10,
      winner_claimed: false,
      winner_status: 'no_clear_winner'
    });
    if (path === '/v1/machine-market/services') return json({
      count: 1,
      services: [{
        id: 'cloud-translation',
        name: 'Cloud Translation',
        provider: 'Google',
        category: 'translation',
        source_market: 'pay.sh',
        chain: 'solana',
        status: 'ready',
        description: 'Cloud translation machine route.',
        evidence_health: 'scaffold',
        evidence_stage: 'preflight-ready',
        policy_risk: 'Translation requires spend policy.',
        caveats: ['Static robotic.sh service mirror for Phase 2 only.'],
        rail_status: 'proof_plan_selected',
        route_surface_status: 'callable_routes_listed'
      }]
    });
    if (path === '/v1/machine-preflight/receipts/recent?service_id=cloud-translation&limit=25') return json({
      count: 1,
      receipts: [{
        receipt_id: 'mrx_cloud_translation_001',
        receipt_type: 'machine_preflight',
        selected_service_id: 'cloud-translation',
        execution_service_id: null,
        decision: 'review',
        evidence_stage: 'preflight-ready',
        execution_occurred: false,
        execution_status: 'not_attempted',
        caveats: ['Coverage run records decision receipts only.'],
        review_reasons: ['proof plan selected'],
        violations: [],
        created_at: '2026-05-22T00:00:00.000Z'
      }]
    });
    if (path === '/v1/machine-preflight/receipts/recent?service_id=missing&limit=25') return json({ count: 0, receipts: [] });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderPath(container: HTMLDivElement, path: string) {
  window.history.pushState({}, '', path);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('shareable preflight cards', () => {
  let root: Root;
  let container: HTMLDivElement;
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    installFetch();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    writeText.mockClear();
    window.history.pushState({}, '', '/');
  });

  it('renders a radar provider card for a known provider', async () => {
    root = await renderPath(container, '/radar/cards/provider/alpha');
    const text = container.textContent ?? '';
    expect(text).toContain('INFOPUNKS PREFLIGHT CARD');
    expect(text).toContain('Alpha Provider');
    expect(text).toContain('provider');
    expect(text).toContain('ALLOW');
    expect(text).toContain('No receipt, no trust.');
  });

  it('renders NO WINNER for a benchmark with winner_claimed=false', async () => {
    root = await renderPath(container, '/radar/cards/benchmark/finance-data-sol-price');
    const text = container.textContent ?? '';
    expect(text).toContain('NO WINNER');
    expect(text).toContain('No winner claimed');
  });

  it('renders machine-market policy readiness with planning-only wording', async () => {
    root = await renderPath(container, '/machine-market/cards/cloud-translation');
    const text = container.textContent ?? '';
    expect(text).toContain('Cloud Translation');
    expect(text).toContain('PROOF PLAN READY');
    expect(text).toContain('planning only');
    expect(text).toContain('no execution claim');
    expect(text).toContain('review');
    expect(text).toContain('preflight-ready');
  });

  it('copies radar tweet text with the Infopunks spending line', async () => {
    root = await renderPath(container, '/radar/cards/provider/alpha');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Copy tweet')) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('My agent checked Infopunks before spending.'));
  });

  it('copies agent JSON containing id, type, state, verdict, and canonicalPath', async () => {
    root = await renderPath(container, '/radar/cards/provider/alpha');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Copy agent JSON')) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    const payload = writeText.mock.calls.at(-1)?.[0] as string;
    expect(payload).toContain('"id": "alpha"');
    expect(payload).toContain('"type": "provider"');
    expect(payload).toContain('"state": "ALLOW"');
    expect(payload).toContain('"verdict": "Provider has usable monitoring and intelligence evidence."');
    expect(payload).toContain('"canonicalPath": "/radar/cards/provider/alpha"');
  });

  it('renders a useful not-found state without crashing', async () => {
    root = await renderPath(container, '/radar/cards/provider/missing');
    const text = container.textContent ?? '';
    expect(text).toContain('provider card not found');
    expect(text).toContain('missing');
  });
});
