// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const route = { route_id: 'route_pay_sh_market_research_01', provider_id: 'provider_pay_sh_lattice', service_id: 'service_market_research', endpoint: 'POST /market/research', payment_method: 'stablecoin', estimated_cost: '0.25 USDC', latency_ms_p50: 900, latency_ms_p95: 1600, success_rate: 0.91, last_tested_at: '2026-06-15T10:10:00.000Z', last_successful_run: '2026-06-14T09:40:00.000Z', last_failed_run: '2026-06-10T11:05:00.000Z', confidence_score: 82, risk_level: 'medium', known_blockers: ['occasional timeout under high load'], receipt_references: ['receipt_001'], recommended_use_case: 'buy_market_research', avoid_conditions: ['strict sub-second latency required'] };
const provider = { provider_id: 'provider_pay_sh_lattice', name: 'Lattice Research Relay', service_categories: ['market_research'], reliability_score: 89, pricing_consistency: 'mostly consistent', output_quality_notes: ['prompt-specific variability under vague requests'], uptime_notes: ['minor timeout spikes during high load'], dispute_history: [], human_validation_status: 'human_validated', known_risks: ['broad prompts widen output variance'], agent_compatibility: ['research_agents'], route_coverage: 1, recent_receipt_count: 1 };
const quartzProvider = { provider_id: 'provider_pay_sh_quartz', name: 'Quartz Route Index', service_categories: ['token_pricing'], reliability_score: 96, pricing_consistency: 'highly consistent', output_quality_notes: ['precise output shape'], uptime_notes: ['healthy'], dispute_history: [], human_validation_status: 'human_validated', known_risks: [], agent_compatibility: ['wallets'], route_coverage: 1, recent_receipt_count: 3 };
const service = { service_id: 'service_market_research', category: 'market_research', available_routes: ['route_pay_sh_market_research_01'], supported_inputs: ['query'], observed_cost_range: { min: '0.25 USDC', max: '0.31 USDC' }, observed_latency_range: { min_ms: 780, max_ms: 1600 }, best_observed_route: 'route_pay_sh_market_research_01', cheapest_observed_route: 'route_pay_sh_market_research_01', safest_first_attempt: 'route_pay_sh_market_research_01', fastest_repeatable_route: 'route_pay_sh_market_research_01', known_blockers: ['prompt specificity'], evidence_artifacts: ['artifact_market_research_benchmark_001'], benchmark_readiness: 'human_validated', pre_spend_recommendation: 'Use verified route first.' };
const receipt = { receipt_id: 'receipt_001', timestamp: '2026-06-14T09:40:00.000Z', agent_id: 'agent_001', route_id: 'route_pay_sh_market_research_01', provider_id: 'provider_pay_sh_lattice', service_id: 'service_market_research', task_type: 'buy_market_research', cost: '0.25 USDC', payment_method: 'stablecoin', latency_ms: 980, input_summary: 'brief request', output_summary: 'structured brief returned', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['useful baseline summary'], confidence_delta: 4, evidence_artifact: 'artifact_market_research_run_001' };
const claim = { claim_id: 'claim_001', created_at: '2026-06-16T09:15:00.000Z', submitted_by: 'analyst_001', claim_type: 'reliability', target_type: 'route', target_id: route.route_id, statement: 'Receipt-backed route remains safe for stablecoin quote checks.', evidence_receipt_ids: [receipt.receipt_id], evidence_artifact_uris: ['artifact://artifact_market_research_run_001'], status: 'supported', confidence_score: 91, validation_state: 'human_validated', challenge_count: 0, support_count: 2, human_notes: ['Receipt-backed route intelligence supports repeatable use.'] };
const metrics = { verified_pre_spend_decisions: 2, routes_indexed: 6, providers_scored: 5, receipts_generated: 11, pre_spend_checks_completed: 4, human_validations_submitted: 3, failed_routes_avoided: 1, claims_challenged: 1, repeatable_routes_discovered: 3, agent_builders_using_the_api: 7, amount_of_spend_protected_or_intelligently_routed: '184.90 USDC' };
const decision = { intent: 'buy_market_research', decision: 'approved_with_warning', recommended_route: 'route_pay_sh_market_research_01', confidence_score: 82, risk_level: 'medium', estimated_cost: '0.25 USDC', last_successful_run: '2026-06-14T09:40:00.000Z', known_blockers: ['occasional timeout under high load'], requires_human_approval: false, receipt_references: ['receipt_001'], safer_alternatives: ['route_pay_sh_market_research_03'], do_not_use: [{ provider: 'provider_x', reason: 'no recent successful receipt' }], rationale: ['Confidence meets required threshold.'] };

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

async function render(path: string) {
  window.history.pushState({}, '', path);
  const container = document.createElement('div');
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { root, container };
}

describe('pre-spend builder pages', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      const method = typeof input === 'string' || input instanceof URL ? 'GET' : input.method ?? 'GET';
      if (path === '/v1/routes') return json({ metrics, routes: [route] });
      if (path === '/v1/routes/route_pay_sh_market_research_01') return json({
        route,
        provider,
        service,
        receipts: [receipt],
        metrics,
        validation_state: 'human_validated',
        decision_implications: ['Confidence is below silent-autonomy grade and should be inspected before spend.'],
        trust_summary: {
          receipt_freshness: 'Fresh receipts observed within 3 days.',
          successful_receipt_count: 1,
          failure_patterns: [],
          blocker_severity: 'low',
          provider_reliability: 'Provider reliability is usable, but route conditions should still be inspected.',
          human_validation: 'Human validation exists across 1 receipt.',
          summary: 'Fresh receipts observed within 3 days. 1 successful receipt backs this route.'
        }
      });
      if (path === '/v1/routes/missing-route') return Promise.resolve(new Response(JSON.stringify({ error: 'route_not_found' }), { status: 404 }));
      if (path === '/v1/pre-spend/providers') return json({
        generated_at: '2026-06-16T04:00:00.000Z',
        source: 'infopunks-pay-sh-radar',
        metrics,
        providers: [
          {
            ...provider,
            linked_routes: [route.route_id],
            linked_receipts: [receipt.receipt_id],
            trust_profile: {
              safe_for_first_attempt: true,
              better_for_repeatable_routes: false,
              requires_human_approval: false,
              not_recommended: false,
              summary: 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.'
            }
          },
          {
            ...quartzProvider,
            linked_routes: ['route_pay_sh_token_quote_01'],
            linked_receipts: ['receipt_005', 'receipt_006', 'receipt_007'],
            trust_profile: {
              safe_for_first_attempt: true,
              better_for_repeatable_routes: true,
              requires_human_approval: false,
              not_recommended: false,
              summary: 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.'
            }
          }
        ]
      });
      if (path === '/v1/providers/provider_pay_sh_lattice') return json({
        provider,
        routes: [route],
        services: [service],
        receipts: [receipt],
        metrics,
        provider_level_warnings: ['broad prompts widen output variance'],
        trust_profile: {
          safe_for_first_attempt: true,
          better_for_repeatable_routes: false,
          requires_human_approval: false,
          not_recommended: false,
          summary: 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.'
        }
      });
      if (path === '/v1/providers/provider_missing') return Promise.resolve(new Response(JSON.stringify({ error: 'provider_not_found' }), { status: 404 }));
      if (path === '/v1/services') return json({ metrics, services: [service] });
      if (path === '/v1/services/service_market_research') return json({
        service,
        routes: [route],
        receipts: [receipt],
        metrics,
        best_route_decision_map: {
          best_observed_route: 'route_pay_sh_market_research_01',
          cheapest_route: 'route_pay_sh_market_research_01',
          safest_first_attempt: 'route_pay_sh_market_research_01',
          fastest_repeatable_route: 'route_pay_sh_market_research_01',
          summary: 'Best observed route is route_pay_sh_market_research_01.'
        }
      });
      if (path === '/v1/services/missing-service') return Promise.resolve(new Response(JSON.stringify({ error: 'service_not_found' }), { status: 404 }));
      if (path === '/v1/receipts') return json({ metrics, receipts: [receipt] });
      if (path === '/v1/receipts/receipt_001') return json({
        ...receipt,
        route,
        provider,
        service,
        impact: {
          improves_route_confidence: true,
          reduces_route_confidence: false,
          freshness: 'fresh',
          human_validated: true,
          should_affect_future_pre_spend_decisions: true,
          summary: 'This receipt improves route confidence by 4 and should strengthen future pre-spend decisions while it remains fresh.'
        }
      });
      if (path === '/v1/receipts/receipt_missing') return Promise.resolve(new Response(JSON.stringify({ error: 'receipt_not_found' }), { status: 404 }));
      if (path === '/v1/claims' && method === 'POST') return json(claim);
      if (path === '/v1/claims') return json({ metrics, claims: [claim] });
      if (path === '/v1/claims/claim_001') return json({ ...claim, challenges: [] });
      if (path === '/v1/claims/missing-claim') return Promise.resolve(new Response(JSON.stringify({ error: 'claim_not_found' }), { status: 404 }));
      if (path === '/v1/claims/claim_001/challenges') return json({ claim_id: 'claim_001', challenges: [] });
      if (path === '/v1/pre-spend/check') return json(decision);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('renders spend terminal and links result routes and receipts', async () => {
    const { root, container } = await render('/spend-terminal');
    expect(container.textContent).toContain('Should this agent spend?');
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('approved_with_warning');
    expect(container.querySelector('a[href="/routes/route_pay_sh_market_research_01"]')).toBeTruthy();
    expect(container.querySelector('a[href="/receipts/receipt_001"]')).toBeTruthy();
    root.unmount();
  });

  it('renders developers page with SDK, API, decision states, trust copy, and public links', async () => {
    const { root, container } = await render('/developers');
    const text = container.textContent ?? '';
    expect(text).toContain('Before your agent pays, it checks Infopunks.');
    expect(text).toContain('createInfopunksPreSpendClient');
    expect(text).toContain('POST /v1/pre-spend/check');
    expect(text).toContain('https://radar.infopunks.fun');
    expect(text).toContain('approved');
    expect(text).toContain('approved_with_warning');
    expect(text).toContain('use_with_caution');
    expect(text).toContain('requires_human_approval');
    expect(text).toContain('do_not_use');
    expect(text).toContain('No receipt, no trust.');
    expect(text).toContain('Every decision should point back to receipts.');
    expect(text).toContain('Receipts capture route runs, cost, latency, status, validation, confidence delta, and evidence artifacts.');
    expect(text).toContain('Wallet Safety API');
    expect(text).toContain('Ask once before spend. Get decision, policy, audit trail, risk score, final recommendation, and copy-paste SDK snippets.');
    expect(container.querySelector('a[href="/developers/wallet-safety"]')).toBeTruthy();
    expect(container.querySelector('a[href="/spend-terminal"]')).toBeTruthy();
    expect(container.querySelector('a[href="/routes"]')).toBeTruthy();
    expect(container.querySelector('a[href="/providers"]')).toBeTruthy();
    expect(container.querySelector('a[href="/services"]')).toBeTruthy();
    expect(container.querySelector('a[href="/receipts"]')).toBeTruthy();
    expect(container.querySelector('a[href="/claim"]')).toBeTruthy();
    expect(container.querySelector('a[href="/openapi.json"]')).toBeTruthy();
    root.unmount();
  });

  it('renders Wallet Safety Developer Quickstart with examples and integration guidance', async () => {
    const { root, container } = await render('/developers/wallet-safety');
    const text = container.textContent ?? '';

    expect(text).toContain('Wallet Safety Developer Quickstart');
    expect(text).toContain('The machinery is built. Now make it easy to plug into.');
    expect(text).toContain('Agents should not stitch safety together. They should ask once before spend.');
    expect(text).toContain('POST /v1/hermes/wallet-safety/check');
    expect(text).toContain('View SDK snippets');
    expect(text).toContain('SDK Snippets');
    expect(text).toContain('Copy-paste patterns for checking wallet safety before spend.');
    expect(text).toContain('"route_id": "route_pay_sh_market_research_01"');
    expect(text).toContain('"agent_type": "research_agent"');
    expect(text).toContain('final_recommendation');
    expect(text).toContain('type WalletSafetyIntent');
    expect(text).toContain('type WalletSafetyResponse');
    expect(text).toContain('export async function checkWalletSafety(intent: WalletSafetyIntent)');
    expect(text).toContain('module.exports = { checkWalletSafety };');
    expect(text).toContain('async function guardSpend(intent, wallet)');
    expect(text).toContain('async function safeCheckBeforeSpend(intent)');
    expect(text).toContain('switch (safety.final_recommendation.decision)');
    expect(text).toContain('Most agents only need');
    expect(text).toContain('final_recommendation.allowed');
    expect(text).toContain('final_recommendation.required_action');
    expect(text).toContain('final_recommendation.risk_score');
    expect(text).toContain('final_recommendation.safety_rating');
    expect(text).toContain('final_recommendation.reason');
    expect(text).toContain('safe_to_spend');
    expect(text).toContain('test_spend_required');
    expect(text).toContain('manual_review_required');
    expect(text).toContain('block_spend');
    expect(text).toContain('insufficient_evidence');
    expect(text).toContain('Do not treat API failure as approval.');
    expect(text).toContain('If the safety check fails, pause, request more evidence, or send the spend to manual review.');
    expect(text).toContain('curl -X POST "https://radar.infopunks.fun/v1/hermes/wallet-safety/check"');
    expect(text).toContain('async function checkBeforeSpend(intent)');
    expect(text).toContain('Spend Intent → Pre-Spend Decision → Policy Check → Policy Receipt → Reconciliation Preview → Wallet Audit Trail → Wallet Risk Score → Final Recommendation');
    expect(text).toContain('The Wallet Safety API is included in the Radar OpenAPI schema.');
    expect(text).toContain('GET /v1/hermes/wallet-safety/example');
    expect(text).toContain('Agent asks: Can I spend?');
    expect(text).toContain('Infopunks answers: yes, test first, review, block, or gather more evidence.');
    expect(container.querySelector('a[href="/openapi.json"]')).toBeTruthy();
    expect(container.querySelector('a[href="/v1/hermes/wallet-safety/example"]')).toBeTruthy();
    expect(container.querySelector('#sdk-snippets')).toBeTruthy();
    expect(container.querySelector('a[href="#sdk-snippets"]')).toBeTruthy();

    root.unmount();
  });

  it('renders claim page with claim loop copy and evidence language', async () => {
    const { root, container } = await render('/claim');
    const text = container.textContent ?? '';
    expect(text).toContain('route decision → receipt → claim → validation → reputation');
    expect(text).toContain('No claim without evidence.');
    expect(text).toContain('Claims are not votes.');
    expect(container.querySelector('a[href="/claims/claim_001"]')).toBeTruthy();
    root.unmount();
  });

  it('renders claim detail page with receipt links', async () => {
    const { root, container } = await render('/claims/claim_001');
    expect(container.textContent).toContain('Receipt-backed claim');
    expect(container.textContent).toContain('Receipt-backed route remains safe for stablecoin quote checks.');
    expect(container.querySelector('a[href="/receipts/receipt_001"]')).toBeTruthy();
    expect(container.querySelector('a[href="/claim"]')).toBeTruthy();
    root.unmount();
  });

  it('renders routes page with detail links', async () => {
    const { root, container } = await render('/routes');
    expect(container.textContent).toContain('Routes');
    expect(container.querySelector('a[href="/routes/route_pay_sh_market_research_01"]')).toBeTruthy();
    root.unmount();
  });

  it('renders providers page with detail links', async () => {
    const { root, container } = await render('/providers');
    expect(container.textContent).toContain('Providers');
    expect(container.querySelector('a[href="/providers/provider_pay_sh_lattice"]')).toBeTruthy();
    root.unmount();
  });

  it('renders services page with detail links', async () => {
    const { root, container } = await render('/services');
    expect(container.textContent).toContain('Services');
    expect(container.querySelector('a[href="/services/service_market_research"]')).toBeTruthy();
    root.unmount();
  });

  it('renders receipts page with detail links', async () => {
    const { root, container } = await render('/receipts');
    expect(container.textContent).toContain('Receipts');
    expect(container.querySelector('a[href="/receipts/receipt_001"]')).toBeTruthy();
    root.unmount();
  });

  it('renders route detail page', async () => {
    const { root, container } = await render('/routes/route_pay_sh_market_research_01');
    expect(container.textContent).toContain('Why this route can or cannot be trusted');
    expect(container.textContent).toContain('route_pay_sh_market_research_01');
    expect(container.querySelector('a[href="/providers/provider_pay_sh_lattice"]')).toBeTruthy();
    root.unmount();
  });

  it('renders provider detail page', async () => {
    const { root, container } = await render('/providers/provider_pay_sh_lattice');
    expect(container.textContent).toContain('Provider trust profile');
    expect(container.textContent).toContain('Lattice Research Relay');
    expect(container.querySelector('a[href="/routes/route_pay_sh_market_research_01"]')).toBeTruthy();
    root.unmount();
  });

  it('renders service detail page', async () => {
    const { root, container } = await render('/services/service_market_research');
    expect(container.textContent).toContain('Best route decision map');
    expect(container.textContent).toContain('service_market_research');
    expect(container.querySelector('a[href="/routes/route_pay_sh_market_research_01"]')).toBeTruthy();
    root.unmount();
  });

  it('renders receipt detail page', async () => {
    const { root, container } = await render('/receipts/receipt_001');
    expect(container.textContent).toContain('Receipt impact');
    expect(container.textContent).toContain('artifact_market_research_run_001');
    expect(container.querySelector('a[href="/routes/route_pay_sh_market_research_01"]')).toBeTruthy();
    root.unmount();
  });

  it('renders not-found states for missing detail pages', async () => {
    const routePage = await render('/routes/missing-route');
    expect(routePage.container.textContent).toContain('Route not found');
    expect(routePage.container.querySelector('a[href="/routes"]')).toBeTruthy();
    routePage.root.unmount();

    const providerPage = await render('/providers/provider_missing');
    expect(providerPage.container.textContent).toContain('Provider not found');
    expect(providerPage.container.querySelector('a[href="/providers"]')).toBeTruthy();
    providerPage.root.unmount();

    const servicePage = await render('/services/missing-service');
    expect(servicePage.container.textContent).toContain('Service not found');
    expect(servicePage.container.querySelector('a[href="/services"]')).toBeTruthy();
    servicePage.root.unmount();

    const receiptPage = await render('/receipts/receipt_missing');
    expect(receiptPage.container.textContent).toContain('Receipt not found');
    expect(receiptPage.container.querySelector('a[href="/receipts"]')).toBeTruthy();
    receiptPage.root.unmount();
  });
});
