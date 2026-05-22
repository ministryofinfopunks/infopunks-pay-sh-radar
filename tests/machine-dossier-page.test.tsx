// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const machineId = 'did:peaq:delivery-bot-01';

const observedDossier = {
  machine_id: machineId,
  phase_scope: 'phase_2_pay_sh_robotic_sh',
  status: 'observed',
  suggested_next_action: null,
  summary: {
    total_receipts: 3,
    allow_count: 1,
    deny_count: 1,
    review_count: 1,
    unique_services: 1,
    unique_categories: 1,
    unique_source_markets: 1,
    latest_activity_at: '2026-05-22T00:03:00.000Z'
  },
  policy_profile: {
    active_policy_id: 'delivery-robot',
    policy_name: 'Delivery Robot',
    risk_tolerance: 'low',
    daily_budget_usd: 3,
    per_call_budget_usd: 0.05,
    allowed_categories: ['vision', 'translation', 'web'],
    allowed_source_markets: [],
    allowed_chains: []
  },
  service_usage: [{ service_id: 'document-ai', service_name: 'Document AI', count: 3 }],
  category_usage: [{ category: 'vision', count: 3 }],
  market_usage: [{ source_market: 'pay.sh', count: 3 }],
  chain_usage: [{ chain: 'solana', count: 3 }],
  recent_receipts: [
    { receipt_id: 'mrx_3', receipt_type: 'machine_preflight', machine_id: machineId, policy_id: 'delivery-robot', intent: 'review invoice parse', requested_category: 'vision', selected_service_id: 'document-ai', selected_service_name: 'Document AI', source_market: 'pay.sh', chain: 'solana', decision: 'review', reason: 'review', policy_checks: [], violations: [], review_reasons: ['evidence_stage_meets_minimum'], caveats: [], max_cost_usd: 0.05, evidence_stage: 'policy-mapped', evidence_health: 'scaffold', phase_scope: 'phase_2_pay_sh_robotic_sh', created_at: '2026-05-22T00:03:00.000Z' }
  ],
  caveats: [
    'This dossier represents Radar-observed machine preflight decisions only.',
    'It does not verify live peaqOS identity, wallet ownership, payment execution, or physical-world robot activity.'
  ],
  evidence_summary: { highest_stage_seen: 'policy-mapped', stage_counts: { 'policy-mapped': 3 } }
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function installDossierFetch(dossier: any) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, 'http://localhost').pathname;
    if (path.startsWith('/v1/machine-dossier/')) return json(dossier);
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
  });
  return root;
}

describe('machine dossier page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('empty machine dossier renders', async () => {
    installDossierFetch({
      ...observedDossier,
      machine_id: 'did:peaq:empty-bot',
      status: 'no_activity',
      suggested_next_action: 'Run machine preflight to create the first Radar-observed receipt.',
      summary: { ...observedDossier.summary, total_receipts: 0, allow_count: 0, deny_count: 0, review_count: 0, unique_services: 0, latest_activity_at: null },
      recent_receipts: [],
      service_usage: [],
      category_usage: [],
      market_usage: [],
      chain_usage: [],
      evidence_summary: { highest_stage_seen: 'none', stage_counts: {} }
    });
    root = await renderPath(container, '/machine-dossier/did%3Apeaq%3Aempty-bot');

    expect(container.textContent).toContain('No Radar-observed activity.');
    expect(container.textContent).toContain('Run machine preflight');
  });

  it('dossier after preflight shows receipt counts and caveats', async () => {
    installDossierFetch(observedDossier);
    root = await renderPath(container, `/machine-dossier/${encodeURIComponent(machineId)}`);

    expect(container.textContent).toContain(machineId);
    expect(container.textContent).toContain('Delivery Robot');
    expect(container.textContent).toContain('Total receipts3');
    expect(container.textContent).toContain('Allowed1');
    expect(container.textContent).toContain('Denied1');
    expect(container.textContent).toContain('Review1');
    expect(container.textContent).toContain('This dossier represents Radar-observed machine preflight decisions only.');
    expect(container.textContent).toContain('It does not verify live peaqOS identity');
  });

  it('shows guarded claim status for highest observed stage', async () => {
    installDossierFetch(observedDossier);
    root = await renderPath(container, `/machine-dossier/${encodeURIComponent(machineId)}`);

    const evidenceText = container.querySelector('[aria-label="Machine dossier evidence summary"]')?.textContent ?? '';
    expect(evidenceText).toContain('execution-tested claim: not yet');
    expect(evidenceText).toContain('benchmark-recorded claim: not yet');
    expect(evidenceText).not.toContain('winner');
    expect(evidenceText).not.toContain('proven');
  });
});
