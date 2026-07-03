// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHermesDeskSummary } from '../src/services/hermesBridge';
import { getHermesSkillPack } from '../src/data/hermesSkillPack';
import { buildHermesReputationLedger } from '../src/services/hermesReputationLedger';
import { createHermesPreSpendDecisionExample } from '../src/services/hermesPreSpendDecision';
import { App } from '../src/web/main';

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
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

describe('Hermes Desk page', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (pathOf(input) === '/v1/hermes') return json(getHermesDeskSummary({}));
      if (pathOf(input) === '/v1/hermes/skill-pack') return json(getHermesSkillPack());
      if (pathOf(input) === '/v1/hermes/reputation-ledger') return json(buildHermesReputationLedger());
      if (pathOf(input) === '/v1/hermes/pre-spend-decision/example') return json(createHermesPreSpendDecisionExample());
      if (pathOf(input) === '/v1/hermes/health') return json({
        enabled: false,
        mode: 'mock',
        status: 'mock',
        checked_at: '2026-07-03T00:00:00.000Z'
      });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the Hermes Desk run surface and skill pack', async () => {
    root = await renderPath(container, '/hermes');

    const text = container.textContent ?? '';
    expect(text).toContain('Hermes Desk');
    expect(text).toContain('Agentic investigations before money moves.');
    expect(text).toContain('Hermes runs the loop. Infopunks keeps the receipts.');
    expect(text).toContain('Pay.sh Route Pre-Spend Check');
    expect(text).toContain('Agentic Market Provider Risk Review');
    expect(text).toContain('Signal Hunt Narrative Scan');
    expect(text).toContain('Bridge status');
    expect(text).toContain('Mock-safe sidecar reachability.');
    expect(text).toContain('source: mock');
    expect(text).toContain('Queued');
    expect(text).toContain('Running');
    expect(text).toContain('Completed');
    expect(text).toContain('receipt: receipt_001');
    expect(text).toContain('claim: claim_001');
    expect(text).toContain('loop: loop_pre_spend_route');
    expect(text).toContain('pre-spend route check');
    expect(text).toContain('provider risk check');
    expect(text).toContain('receipt validator');
    expect(text).toContain('claim dispute review');
    expect(text).toContain('signal hunt analyst');
    expect(text).toContain('carbon credit instrument check');
    expect(text).toContain('Agent Run Receipts');
    expect(text).toContain('Every Hermes investigation can become a receipt');
    expect(text).toContain('receipt_hermes_hermes_pay_sh_route_pre_spend_check');
    expect(text).toContain('Receipt-ready');
    expect(text).toContain('Claim Candidate Review');
    expect(text).toContain('Receipts remember what happened.');
    expect(text).toContain('Claims decide what it means.');
    expect(text).toContain('Reputation decides who gets trusted next.');
    expect(text).toContain('claim_hermes_promoted_hermes_pay_sh_route_pre_spend_check');
    expect(text).toContain('needs_more_evidence');
    expect(text).toContain('Reputation Impact');
    expect(text).toContain('Reputation Ledger');
    expect(text).toContain('One receipt is evidence.');
    expect(text).toContain('One claim is judgment.');
    expect(text).toContain('Many judgments become reputation.');
    expect(text).toContain('Pre-Spend Decision Engine');
    expect(text).toContain('Before an agent spends, it checks the ledger.');
    expect(text).toContain('Reputation is not just displayed.');
    expect(text).toContain('Reputation now decides.');
    expect(text).toContain('Provider Impact Surface');
    expect(text).toContain('Route Impact Surface');
    expect(text).toContain('provider_pay_sh_lattice');
    expect(text).toContain('route_pay_sh_market_research_01');
    expect(container.querySelector('a[href="/hermes"]')?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('a[href="/v1/hermes/skills"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/skill-pack"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/pre-spend-decision"]')).not.toBeNull();
  });

  it('renders the Hermes Skill Pack page', async () => {
    root = await renderPath(container, '/hermes/skill-pack');

    const text = container.textContent ?? '';
    expect(text).toContain('Infopunks Hermes Skill Pack');
    expect(text).toContain('How Hermes learns to investigate before money moves.');
    expect(text).toContain('Hermes runs the investigation. Infopunks turns the investigation into market memory.');
    expect(text).toContain('Pre-Spend Route Check');
    expect(text).toContain('Provider Risk Check');
    expect(text).toContain('Receipt Validator');
    expect(text).toContain('Claim Dispute Review');
    expect(text).toContain('Signal Hunt Analyst');
    expect(text).toContain('Carbon Credit Instrument Check');
    expect(text).toContain('No receipt, no trust.');
    expect(text).toContain('Expected output schema');
    expect(text).toContain('Decision state mapping');
    expect(text).toContain('routes');
    expect(text).toContain('providers');
    expect(text).toContain('receipts');
    expect(text).toContain('claims');
    expect(text).toContain('loops');
    expect(text).toContain('proof checks');
    expect(text).toContain('Promotion-ready outputs');
    expect(text).toContain('receipt generation');
    expect(text).toContain('claim candidate creation');
    expect(text).toContain('claim review');
    expect(text).toContain('reputation impact');
    expect(text).toContain('Decision-ready outputs');
    expect(text).toContain('pre-spend decisions');
    expect(text).toContain('required actions');
    expect(text).toContain('risk factors');
    expect(text).toContain('reputation inputs');
    expect(text).toContain('Hermes skills should produce outputs that can update reputation over time.');
    expect(text).toContain('route reputation');
    expect(text).toContain('provider reputation');
    expect(text).toContain('service reputation');
    expect(text).toContain('disputed evidence');
    expect(text).toContain('watchlist state');
    expect(container.querySelector('a[href="/hermes/skill-pack"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Hermes Desk narrative page', async () => {
    root = await renderPath(container, '/narratives/hermes-desk');

    const text = container.textContent ?? '';
    expect(text).toContain('Hermes as the execution brain');
    expect(text).toContain('Infopunks as the evidence and judgment layer');
    expect(text).toContain('Every agent run can become a receipt');
    expect(text).toContain('Every receipt can become a claim');
    expect(text).toContain('Every claim can update provider or route reputation');
    expect(text).toContain('Agent Run Receipts');
    expect(text).toContain('Hermes runs are not chat logs. They are pre-spend investigations.');
    expect(text).toContain('Infopunks converts those investigations into receipts, claims, and eventually reputation.');
    expect(text).toContain('This is how agent experience becomes market memory.');
    expect(text).toContain('Claim Candidate Review');
    expect(text).toContain('Agent Run Receipts preserve what happened.');
    expect(text).toContain('Claim Candidates propose what the evidence means.');
    expect(text).toContain('Reputation Impact determines who gets trusted next.');
    expect(text).toContain('Receipts remember what happened. Claims decide what it means. Reputation decides who gets trusted next.');
    expect(text).toContain('Reputation Ledger');
    expect(text).toContain('Agent Run Receipts preserve evidence.');
    expect(text).toContain('Claim Review decides what the evidence means.');
    expect(text).toContain('Reputation Ledger accumulates many reviewed claims.');
    expect(text).toContain('Providers, routes, and services become more or less trusted based on evidence-backed history.');
    expect(text).toContain('Pre-Spend Decision Engine');
    expect(text).toContain('The Reputation Ledger is not only for display.');
    expect(text).toContain('Agents should query it before money moves.');
    expect(text).toContain('The decision engine turns accumulated evidence into a spend recommendation.');
    expect(text).toContain('Reputation is not just displayed.');
    expect(text).toContain('Reputation now decides.');
    expect(text).toContain('Before an agent spends, it checks the ledger.');
    expect(text).toContain('One receipt is evidence.');
    expect(text).toContain('One claim is judgment.');
    expect(text).toContain('Many judgments become reputation.');
    expect(container.querySelector('a[href="/narratives/hermes-desk"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the expanded Hermes Reputation Ledger page', async () => {
    root = await renderPath(container, '/hermes/reputation-ledger');

    const text = container.textContent ?? '';
    expect(text).toContain('Reputation Ledger');
    expect(text).toContain('One receipt is evidence.');
    expect(text).toContain('Provider Impact Surface');
    expect(text).toContain('Route Impact Surface');
    expect(text).toContain('provider_pay_sh_lattice');
    expect(text).toContain('route_pay_sh_market_research_01');
    expect(container.querySelector('a[href="/hermes/reputation-ledger"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the expanded Hermes Pre-Spend Decision page', async () => {
    root = await renderPath(container, '/hermes/pre-spend-decision');

    const text = container.textContent ?? '';
    expect(text).toContain('Pre-Spend Decision Engine');
    expect(text).toContain('Before an agent spends, it checks the ledger.');
    expect(text).toContain('Spend Intent');
    expect(text).toContain('Reputation Ledger');
    expect(text).toContain('Decision');
    expect(text).toContain('Required Action');
    expect(text).toContain('New Receipt');
    expect(text).toContain('Example decision card');
    expect(text).toContain('Decision state mapping');
    expect(text).toContain('Required action mapping');
    expect(text).toContain('Risk factors');
    expect(text).toContain('Inputs used');
    expect(container.querySelector('a[href="/hermes/pre-spend-decision"]')?.getAttribute('aria-current')).toBe('page');
  });
});
