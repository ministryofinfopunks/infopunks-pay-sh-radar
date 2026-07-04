// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHermesDeskSummary } from '../src/services/hermesBridge';
import { getHermesSkillPack } from '../src/data/hermesSkillPack';
import { buildHermesReputationLedger } from '../src/services/hermesReputationLedger';
import { createHermesPreSpendDecisionExample } from '../src/services/hermesPreSpendDecision';
import { buildHermesMemoryLoopSummary } from '../src/services/hermesMemoryLoop';
import { createHermesSpendPolicyExample, listHermesSpendPolicies, listHermesSpendPolicyRules } from '../src/services/hermesSpendPolicy';
import { buildHermesWalletAuditTrailSummary } from '../src/services/hermesWalletAuditTrail';
import { buildHermesWalletRiskScoreSummary } from '../src/services/hermesWalletRiskScore';
import { getHermesWalletSafetyExampleCheck } from '../src/services/hermesWalletSafetyBundle';
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
      if (pathOf(input) === '/v1/hermes/memory-loop') return json(buildHermesMemoryLoopSummary());
      if (pathOf(input) === '/v1/hermes/wallet-audit-trail') return json(buildHermesWalletAuditTrailSummary());
      if (pathOf(input) === '/v1/hermes/wallet-risk-score') return json(buildHermesWalletRiskScoreSummary());
      if (pathOf(input) === '/v1/hermes/wallet-safety/example') return json(getHermesWalletSafetyExampleCheck());
      if (pathOf(input) === '/v1/hermes/reputation-ledger') return json(buildHermesReputationLedger());
      if (pathOf(input) === '/v1/hermes/pre-spend-decision/example') return json(createHermesPreSpendDecisionExample());
      if (pathOf(input) === '/v1/hermes/spend-policy') return json({
        generated_at: '2026-07-03T00:00:00.000Z',
        count: listHermesSpendPolicies().length,
        policies: listHermesSpendPolicies(),
        rules: listHermesSpendPolicyRules()
      });
      if (pathOf(input) === '/v1/hermes/spend-policy/example') return json(createHermesSpendPolicyExample());
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
    expect(text).toContain('Agent Memory Loop');
    expect(text).toContain('Agents do not need chat history.');
    expect(text).toContain('Agents need memory that changes future action.');
    expect(text).toContain('Policy sits between Decision and Outcome as the wallet safety gate.');
    expect(text).toContain('Open Memory Loop');
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
    expect(text).toContain('Autonomous Wallet Audit Trail');
    expect(text).toContain('Open Wallet Audit Trail');
    expect(text).toContain('Wallet Risk Score');
    expect(text).toContain('Open Wallet Risk Score');
    expect(text).toContain('Wallet Safety API Bundle');
    expect(text).toContain('Agents should not stitch safety together.');
    expect(text).toContain('Open Wallet Safety API');
    expect(text).toContain('Open developer quickstart');
    expect(text).toContain('Before an agent spends, it checks the ledger.');
    expect(text).toContain('Reputation is not just displayed.');
    expect(text).toContain('Reputation now decides.');
    expect(text).toContain('Agent Spend Policy Layer');
    expect(text).toContain('Decision tells an agent what to do.');
    expect(text).toContain('Policy tells an agent what it is allowed to do.');
    expect(text).toContain('Policy Decision Receipts');
    expect(text).toContain('A policy decision should not disappear after the wallet acts.');
    expect(text).toContain('policy_receipt_id');
    expect(text).toContain('Policy Outcome Reconciliation');
    expect(text).toContain('A policy receipt proves what was allowed.');
    expect(text).toContain('A reconciliation proves what actually happened.');
    expect(text).toContain('Decision Receipt and Feedback Loop');
    expect(text).toContain('A decision without an outcome is advice.');
    expect(text).toContain('A decision with a receipt becomes intelligence.');
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
    expect(text).toContain('Feedback-ready skills');
    expect(text).toContain('Memory-loop-ready skills');
    expect(text).toContain('Hermes skills should produce outputs that can flow through: Run → Receipt → Claim → Review → Reputation → Decision → Outcome → Feedback');
    expect(text).toContain('Audit-trail-ready outputs');
    expect(text).toContain('spend intent');
    expect(text).toContain('feedback action');
    expect(text).toContain('Risk-score-ready outputs');
    expect(text).toContain('compliance state');
    expect(text).toContain('evidence completeness');
    expect(text).toContain('Bundle-ready outputs');
    expect(text).toContain('Developer-ready outputs');
    expect(text).toContain('final recommendation');
    expect(text).toContain('safety rating');
    expect(text).toContain('expected result');
    expect(text).toContain('success criteria');
    expect(text).toContain('failure reasons');
    expect(text).toContain('evidence artifacts');
    expect(text).toContain('Hermes skills should produce outputs that can update reputation over time.');
    expect(text).toContain('route reputation');
    expect(text).toContain('provider reputation');
    expect(text).toContain('service reputation');
    expect(text).toContain('disputed evidence');
    expect(text).toContain('watchlist state');
    expect(text).toContain('Policy-ready outputs');
    expect(text).toContain('risk level');
    expect(text).toContain('required action');
    expect(text).toContain('provider status');
    expect(text).toContain('route status');
    expect(text).toContain('spend amount sensitivity');
    expect(text).toContain('chain/payment rail context');
    expect(text).toContain('Reconciliation-ready outputs');
    expect(text).toContain('expected action');
    expect(text).toContain('allowed amount');
    expect(text).toContain('observed spend');
    expect(text).toContain('Audit-ready outputs');
    expect(text).toContain('decision reason');
    expect(text).toContain('outcome criteria');
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
    expect(text).toContain('Agent Spend Policy Layer');
    expect(text).toContain('Policy Decision Receipts');
    expect(text).toContain('Policy checks should not be invisible runtime decisions.');
    expect(text).toContain('Every allow, test, review, or block should be auditable.');
    expect(text).toContain('A policy decision should not disappear after the wallet acts. It should become an audit receipt.');
    expect(text).toContain('Policy Outcome Reconciliation');
    expect(text).toContain('Reconciliation turns enforcement into feedback.');
    expect(text).toContain('A reconciliation proves what actually happened.');
    expect(text).toContain('Decisions recommend action.');
    expect(text).toContain('Policies enforce boundaries.');
    expect(text).toContain('Autonomous wallets need both judgment and rules.');
    expect(text).toContain('Decision tells an agent what to do.');
    expect(text).toContain('Policy tells an agent what it is allowed to do.');
    expect(text).toContain('Decision Receipt and Feedback Loop');
    expect(text).toContain('The Pre-Spend Decision Engine recommends action before money moves.');
    expect(text).toContain('Decision Receipts preserve why the recommendation was made.');
    expect(text).toContain('Outcomes record what actually happened after the decision.');
    expect(text).toContain('Feedback turns the result into future reputation input.');
    expect(text).toContain('This closes the loop from advice to intelligence.');
    expect(text).toContain('A decision without an outcome is advice.');
    expect(text).toContain('A decision with a receipt becomes intelligence.');
    expect(text).toContain('One receipt is evidence.');
    expect(text).toContain('One claim is judgment.');
    expect(text).toContain('Many judgments become reputation.');
    expect(text).toContain('Agent Memory Loop');
    expect(text).toContain('Hermes runs create evidence.');
    expect(text).toContain('Receipts preserve what happened.');
    expect(text).toContain('Claims interpret the evidence.');
    expect(text).toContain('Reviews decide whether the claim should affect trust.');
    expect(text).toContain('Reputation accumulates across claims.');
    expect(text).toContain('Decisions use reputation before money moves.');
    expect(text).toContain('Policy sits between Decision and Outcome as the wallet safety gate.');
    expect(text).toContain('Outcomes teach the next decision.');
    expect(text).toContain('A policy receipt proves what was allowed.');
    expect(text).toContain('A reconciliation proves what actually happened.');
    expect(text).toContain('Agents do not need chat history.');
    expect(text).toContain('Agents need memory that changes future action.');
    expect(text).toContain('Autonomous Wallet Audit Trail');
    expect(text).toContain('Logs say what happened.');
    expect(text).toContain('Audit trails explain why it happened and whether it obeyed policy.');
    expect(text).toContain('This makes autonomous wallet behavior understandable to builders, users, communities, and eventually regulators.');
    expect(text).toContain('Wallet Risk Score');
    expect(text).toContain('Audit trails explain what happened. Risk scores tell the wallet what to do next.');
    expect(text).toContain('Wallet risk scores compress the chain into a usable safety signal.');
    expect(text).toContain('Wallet Safety API Bundle');
    expect(text).toContain('Agents should not stitch safety together.');
    expect(text).toContain('They should ask once before spend.');
    expect(text).toContain('This is the developer-facing surface for autonomous wallet safety.');
    expect(text).toContain('Developer Quickstart');
    expect(text).toContain('The machinery is built.');
    expect(text).toContain('Now make it easy to plug into.');
    expect(text).toContain('The safety stack is now accessible through one developer endpoint.');
    expect(text).toContain('Builders do not need to stitch decision, policy, receipts, audit trail, and risk score manually.');
    expect(text).toContain('The quickstart explains how to plug Wallet Safety into agents and autonomous wallets.');
    expect(container.querySelector('a[href="/narratives/hermes-desk"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Agent Memory Loop dashboard', async () => {
    root = await renderPath(container, '/hermes/memory-loop');

    const text = container.textContent ?? '';
    expect(text).toContain('Agent Memory Loop');
    expect(text).toContain('Agents do not need chat history.');
    expect(text).toContain('Agents need memory that changes future action.');
    expect(text).toContain('Run → Receipt → Claim → Review → Reputation → Decision → Outcome → Feedback');
    expect(text).toContain('Pay.sh Route Pre-Spend Check');
    expect(text).toContain('Receipt');
    expect(text).toContain('Claim');
    expect(text).toContain('Review');
    expect(text).toContain('Reputation');
    expect(text).toContain('Decision');
    expect(text).toContain('Outcome');
    expect(text).toContain('Feedback');
    expect(text).toContain('Evidence count');
    expect(text).toContain('Claim review state');
    expect(text).toContain('Reputation state');
    expect(text).toContain('Pre-spend decision');
    expect(text).toContain('Required action');
    expect(text).toContain('Outcome state');
    expect(text).toContain('Feedback direction');
    expect(text).toContain('What changed for the next spend?');
    expect(text).toContain('The next agent does not start from zero. It inherits receipts, reviewed claims, reputation state, and feedback from previous outcomes.');
    expect(text).toContain('Policy sits between Decision and Outcome as the wallet safety gate.');
    expect(text).toContain('Policy decisions can now become receipts, making the safety gate auditable before the outcome feeds back into reputation.');
    expect(text).toContain('Policy reconciliation compares the policy receipt against the actual wallet outcome before feedback is used for the next spend.');
    expect(text).toContain('The memory loop teaches future action. The wallet audit trail makes that action inspectable.');
    expect(text).toContain('The memory loop produces judgment. The wallet risk score compresses that judgment into a usable wallet safety signal.');
    expect(container.querySelector('a[href="/hermes/memory-loop"]')?.getAttribute('aria-current')).toBe('page');
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
    expect(text).toContain('The decision engine is part of a larger memory loop. Decisions produce receipts. Outcomes produce feedback. Feedback changes future reputation.');
    expect(text).toContain('The Pre-Spend Decision Engine recommends action. The Spend Policy Layer converts that recommendation into an allow, test, review, or block decision.');
    expect(text).toContain('Policy reconciliation compares the policy receipt against the actual wallet outcome before feedback is used for the next spend.');
    expect(text).toContain('For developers, the Wallet Safety API bundles the pre-spend decision with policy, receipts, reconciliation, audit trail, risk score, and final recommendation.');
    expect(container.querySelector('a[href="/hermes/wallet-safety"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/pre-spend-decision"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Hermes Spend Policy page', async () => {
    root = await renderPath(container, '/hermes/spend-policy');

    const text = container.textContent ?? '';
    expect(text).toContain('Agent Spend Policy Layer');
    expect(text).toContain('Decision tells an agent what to do.');
    expect(text).toContain('Policy tells an agent what it is allowed to do.');
    expect(text).toContain('Before an agent spends, it checks the ledger. Before a wallet signs, it checks policy.');
    expect(text).toContain('Policy Summary');
    expect(text).toContain('Example Spend Intent');
    expect(text).toContain('Policy Check Result');
    expect(text).toContain('Policy Decision Receipts');
    expect(text).toContain('Policy Outcome Reconciliation');
    expect(text).toContain('A policy receipt proves what was allowed.');
    expect(text).toContain('A policy decision should not disappear');
    expect(text).toContain('Policy Receipt');
    expect(text).toContain('Audit Trail');
    expect(text).toContain('Future Feedback');
    expect(text).toContain('Violations and Warnings');
    expect(text).toContain('Pre-Spend Decision Used');
    expect(text).toContain('References Used');
    expect(text).toContain('Rule Map');
    expect(text).toContain('Policy checks, policy receipts, and reconciliations now roll up into one autonomous wallet audit trail.');
    expect(text).toContain('Policy checks and reconciliation feed the wallet risk score, which tells the wallet whether to continue, test, review, tighten policy, or pause.');
    expect(text).toContain('The Spend Policy Layer is available directly, but agents can call the Wallet Safety API for the complete bundled answer before spend.');
    expect(container.querySelector('a[href="/hermes/wallet-audit-trail"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/wallet-risk-score"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/wallet-safety"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/spend-policy"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the expanded Hermes Decision Feedback page', async () => {
    root = await renderPath(container, '/hermes/decision-feedback');

    const text = container.textContent ?? '';
    expect(text).toContain('Decision Receipt and Feedback Loop');
    expect(text).toContain('A decision becomes intelligence when the outcome is recorded.');
    expect(text).toContain('A decision without an outcome is advice.');
    expect(text).toContain('A decision with a receipt becomes intelligence.');
    expect(text).toContain('Example Decision Receipt');
    expect(text).toContain('Example Outcome');
    expect(text).toContain('Reputation Feedback');
    expect(text).toContain('What the system learns');
    expect(text).toContain('Feedback is not the end of the loop. It becomes input for the next pre-spend decision.');
    expect(text).toContain('Policy receipts can become part of the feedback trail when comparing what the wallet was allowed to do against what actually happened.');
    expect(text).toContain('Decision feedback tells whether the spend outcome matched the recommendation. Policy reconciliation tells whether the wallet obeyed the safety gate.');
    expect(text).toContain('Decision feedback is one part of the larger wallet audit trail that shows what was recommended, what was allowed, what happened, and what changed.');
    expect(container.querySelector('a[href="/hermes/wallet-audit-trail"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/decision-feedback"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Autonomous Wallet Audit Trail page', async () => {
    root = await renderPath(container, '/hermes/wallet-audit-trail');

    const text = container.textContent ?? '';
    expect(text).toContain('Autonomous Wallet Audit Trail');
    expect(text).toContain('Autonomous wallets need more than logs. They need audit trails with judgment.');
    expect(text).toContain('Audit Trail Summary');
    expect(text).toContain('Risk Posture');
    expect(text).toContain('Timeline');
    expect(text).toContain('Signals');
    expect(text).toContain('References');
    expect(text).toContain('What builders can inspect');
    expect(text).toContain('Wallet Risk Score');
    expect(text).toContain('The audit trail now compresses into a safety score that agents and wallets can use before the next action.');
    expect(text).toContain('The Wallet Safety API includes the audit trail so agents can inspect the full reasoning chain behind the final recommendation.');
    expect(text).toContain('Spend Intent');
    expect(text).toContain('Pre-Spend Decision');
    expect(text).toContain('Decision Receipt');
    expect(text).toContain('Policy Check');
    expect(text).toContain('Policy Receipt');
    expect(text).toContain('Wallet Outcome');
    expect(text).toContain('Reconciliation');
    expect(text).toContain('Feedback');
    expect(container.querySelector('a[href="/hermes/wallet-audit-trail"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Wallet Risk Score page', async () => {
    root = await renderPath(container, '/hermes/wallet-risk-score');

    const text = container.textContent ?? '';
    expect(text).toContain('Wallet Risk Score');
    expect(text).toContain('Audit trails explain what happened. Risk scores tell the wallet what to do next.');
    expect(text).toContain('Score Summary');
    expect(text).toContain('Safety Rating');
    expect(text).toContain('Required Next Action');
    expect(text).toContain('Top Risks');
    expect(text).toContain('Positive Controls');
    expect(text).toContain('Score Breakdown');
    expect(text).toContain('Inputs Used');
    expect(text).toContain('How the score is calculated');
    expect(text).toContain('The Wallet Safety API includes this risk score inside a complete pre-spend bundle.');
    expect(container.querySelector('a[href="/hermes/wallet-risk-score"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Wallet Safety API page', async () => {
    root = await renderPath(container, '/hermes/wallet-safety');

    const text = container.textContent ?? '';
    expect(text).toContain('Wallet Safety API');
    expect(text).toContain('Agents should not stitch safety together.');
    expect(text).toContain('They should ask once before spend.');
    expect(text).toContain('One endpoint returns the decision, policy check, audit trail, risk score, and final recommendation.');
    expect(text).toContain('Example Spend Intent');
    expect(text).toContain('Final Recommendation');
    expect(text).toContain('Pre-Spend Decision');
    expect(text).toContain('Spend Policy Check');
    expect(text).toContain('Policy Receipt');
    expect(text).toContain('Reconciliation Preview');
    expect(text).toContain('Wallet Audit Trail');
    expect(text).toContain('Wallet Risk Score');
    expect(text).toContain('References');
    expect(text).toContain('Developer Response Shape');
    expect(text).toContain('Developer Quickstart');
    expect(text).toContain('The quickstart explains how to plug Wallet Safety into agents and autonomous wallets.');
    expect(text).toContain('POST /v1/hermes/wallet-safety/check');
    expect(container.querySelector('a[href="/developers/wallet-safety"]')).not.toBeNull();
    expect(container.querySelector('a[href="/hermes/wallet-safety"]')?.getAttribute('aria-current')).toBe('page');
  });
});
