// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const serviceNames = [
  'QVAC',
  'Generative Language',
  'BigQuery',
  'Document AI',
  'Stableupload',
  'Cloud Translation',
  'Claude',
  'ChatGPT',
  '2Captcha',
  'Firecrawl',
  'Wolfram Alpha',
  'Exa',
  'NAVER Maps'
];

function service(name: string, overrides: Record<string, unknown> = {}) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    name,
    provider: name === 'QVAC' ? 'Tether' : name === 'ChatGPT' ? 'OpenAI' : name === 'Claude' ? 'Anthropic' : name,
    category: 'web',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.001',
    description: `${name} service metadata.`,
    machine_use_case: `${name} machine use case.`,
    evidence_health: 'scaffold',
    evidence_stage: 'policy-mapped',
    policy_risk: `${name} requires spend policy.`,
    caveats: ['Static robotic.sh service mirror for Phase 2 only.'],
    observed_source: 'robotic.sh',
    observed_at: '2026-05-22T00:00:00.000Z',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    ...overrides
  };
}

const services = [
  service('QVAC', { category: 'compute', market_type: 'all-compatible', source_market: 'robotic.sh', chain: 'peaq', status: 'setup', price_display: '$0.01 / sec' }),
  service('Generative Language', { category: 'inference', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('BigQuery', { source_market: 'pay.sh', chain: 'solana', price_display: '$0.001', provider: 'Google' }),
  service('Document AI', { category: 'vision', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Stableupload', { category: 'storage', source_market: 'pay.sh', chain: 'solana', price_display: '$0.02', provider: 'Stableupload' }),
  service('Cloud Translation', { category: 'translation', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Claude', { category: 'inference' }),
  service('ChatGPT', { category: 'inference' }),
  service('2Captcha'),
  service('Firecrawl'),
  service('Wolfram Alpha', { category: 'inference', provider: 'Wolfram Research' }),
  service('Exa'),
  service('NAVER Maps', {
    category: 'navigation',
    market_type: 'physical',
    source_market: 'robotic.sh',
    chain: 'unknown',
    price_display: 'not recorded',
    provider: 'NAVER',
    machine_use_case: 'Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.',
    policy_risk: 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.',
    caveats: ['Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.']
  })
];

const serviceResults = services.map((item) => ({
  service_id: item.id,
  service_name: item.name,
  decision: item.id === 'qvac' || item.id === 'naver-maps' ? 'review' : item.id === '2captcha' ? 'deny' : 'allow',
  receipt_id: `mrx_${item.id}_001`,
  execution_occurred: false,
  payment_occurred: false
}));

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installMachineMarketFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/machine-market/services') return json({ count: 13, services });
    if (path === '/v1/machine-market/summary') return json({
      total_services: 13,
      categories: { compute: 1, inference: 4, web: 4, vision: 1, storage: 1, translation: 1, navigation: 1 },
      source_markets: { 'pay.sh': 5, 'agentic.market': 6, 'robotic.sh': 2 },
      chains: { solana: 5, base: 6, peaq: 1, unknown: 1 },
      ready_count: 12,
      setup_count: 1,
      evidence_stage_counts: { 'policy-mapped': 13 },
      phase_scope: 'phase_2_pay_sh_robotic_sh',
      positioning: {
        module: 'A new Radar module for machine-economy intelligence.',
        terminal: 'Same terminal. New species of spender.',
        market_policy: 'robotic.sh gives machines a market. Infopunks gives machine spending policy, evidence, and receipts.',
        spend_policy: 'Machines should not spend blind.',
        radar_role: 'Radar is the intelligence layer for autonomous spend across agents and machines.'
      }
    });
    if (path === '/v1/machine-preflight/coverage-runs/recent') return json({
      count: 1,
      runs: [{
        run_id: 'mcr_20260522000000000_0001',
        generated_at: '2026-05-22T00:10:00.000Z',
        services_total: 13,
        preflight_evaluated: 13,
        receipts_recorded: 13,
        allow_count: 10,
        review_count: 2,
        deny_count: 1,
        execution_occurred: false,
        payment_occurred: false,
        storage: { adapter: 'memory', mode: 'test', durable: false },
        caveats: [
          'Coverage run records decision receipts only.',
          'No service execution occurred.',
          'No Pay.sh, robotic.sh, or Agentic.Market call was made.',
          'No payment occurred.',
          'This is not a benchmark artifact.'
        ],
        service_results: serviceResults
      }]
    });
    if (path === '/v1/machine-preflight/coverage-run') return json({
      run_id: 'mcr_20260522000000000_0002',
      generated_at: '2026-05-22T00:11:00.000Z',
      services_total: 13,
      preflight_evaluated: 13,
      receipts_recorded: 13,
      allow_count: 7,
      review_count: 3,
      deny_count: 2,
      execution_occurred: false,
      payment_occurred: false,
      storage: { adapter: 'memory', mode: 'test', durable: false },
      caveats: [
        'Coverage run records decision receipts only.',
        'No service execution occurred.',
        'No Pay.sh, robotic.sh, or Agentic.Market call was made.',
        'No payment occurred.',
        'This is not a benchmark artifact.'
      ],
      service_results: []
    });
    if (path === '/v1/machine-preflight/receipts/recent') return json({
      count: 2,
      receipts: [{
        receipt_id: 'mrx_exec_20260522000000000_0002',
        receipt_type: 'machine_execution',
        demo_mode: false,
        execution_occurred: true,
        payment_occurred: false,
        execution_status: 'succeeded',
        execution_service_id: 'alibaba-machine-translation-general',
        execution_provider: 'Alibaba Cloud',
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        execution_request_summary: '{"SourceLanguage":"en","TargetLanguage":"es"}',
        execution_response_summary: '{"translated_text_preview":"Las máquinas no deben gastar a ciegas."}',
        execution_error: null,
        execution_executor_name: 'infopunks-pay-sh-agent-harness',
        execution_executor_version: '1.2.3',
        execution_executor_mode: 'manual',
        payment_evidence: null,
        preflight_receipt_id: 'mrx_20260522000000000_0001',
        execution_run_id: 'mxr_20260522000001000_0002',
        machine_id: 'did:peaq:anytrans-prod-smoke',
        policy_id: 'field-maintenance-bot',
        intent: 'external alibaba machine translation general execution artifact ingest',
        requested_category: 'translation',
        selected_service_id: 'alibaba-machine-translation-general',
        selected_service_name: 'Alibaba Machine Translation General',
        source_market: 'pay.sh',
        chain: 'solana',
        decision: 'allow',
        reason: 'Alibaba Machine Translation General external execution artifact indicates successful execution.',
        policy_checks: [],
        violations: [],
        review_reasons: [],
        caveats: [],
        max_cost_usd: null,
        evidence_stage: 'execution-tested',
        evidence_health: 'scaffold',
        phase_scope: 'phase_2_pay_sh_robotic_sh',
        created_at: '2026-05-22T00:00:01.000Z'
      }, {
        receipt_id: 'mrx_exec_20260522000000000_0001',
        receipt_type: 'machine_execution',
        demo_mode: false,
        execution_occurred: true,
        payment_occurred: false,
        execution_status: 'failed',
        execution_service_id: 'anytrans',
        execution_provider: 'Alibaba Cloud',
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        execution_request_summary: '{"source_language":"en","target_language":"es"}',
        execution_response_summary: '{"translated_text_preview":"Las máquinas"}',
        execution_error: null,
        execution_executor_name: 'infopunks-pay-sh-agent-harness',
        execution_executor_version: '1.2.3',
        execution_executor_mode: 'x402',
        payment_evidence: null,
        preflight_receipt_id: 'mrx_20260522000000000_0001',
        execution_run_id: 'mxr_20260522000001000_0001',
        machine_id: 'did:peaq:anytrans-prod-smoke',
        policy_id: 'field-maintenance-bot',
        intent: 'external anytrans execution artifact ingest',
        requested_category: 'translation',
        selected_service_id: 'anytrans',
        selected_service_name: 'Alibaba Cloud AnyTrans',
        source_market: 'pay.sh',
        chain: 'solana',
        decision: 'allow',
        reason: 'AnyTrans external execution artifact indicates successful execution.',
        policy_checks: [],
        violations: [],
        review_reasons: [],
        caveats: ['Auth.AccessDenied.WorkSpace'],
        max_cost_usd: null,
        evidence_stage: 'policy-mapped',
        evidence_health: 'scaffold',
        phase_scope: 'phase_2_pay_sh_robotic_sh',
        created_at: '2026-05-22T00:00:01.000Z'
      }]
    });
    if (path === '/v1/machine-execution/alibaba-machine-translation-general/repeatability') return json({
      artifact_id: 'mrx_repeatability_alibaba_machine_translation_general_20260522',
      repeatability_status: 'insufficient_runs',
      successful_receipts: 1,
      failed_receipts: 0,
      payment_claimed: false,
      benchmark_claimed: false,
      winner_claimed: false,
      input_summary: ['Machines should not spend blind.'],
      output_summaries: ['Las máquinas no deberían gastar a ciegas.'],
      remaining_successful_runs_needed: 2,
      success_rate: 1,
      latency_ms: { min: 1000, median: 1000, max: 1000 },
      receipt_ids: ['mrx_exec_20260522000000000_0002'],
      provider_request_ids: ['RID-1'],
      caveats: ['This is a repeatability artifact, not a benchmark.']
    });
    if (path === '/v1/machine-execution/alibaba-machine-translation-general/benchmark-readiness') return json({
      route_id: 'solana-foundation/alibaba/machinetranslation',
      route_name: 'Alibaba Machine Translation General',
      service_id: 'alibaba-machine-translation-general',
      fqn: 'solana-foundation/alibaba/machinetranslation',
      source_market: 'pay.sh',
      chain: 'solana',
      generated_at: '2026-05-22T00:00:00.000Z',
      current_evidence_stage: 'execution-tested',
      benchmark_readiness_status: 'criteria-defined',
      benchmark_ready: false,
      criteria: [],
      satisfied_criteria_count: 0,
      total_criteria_count: 0,
      missing_criteria: [],
      benchmark_artifact_schema: { benchmark_id: 'string', route_id: 'solana-foundation/alibaba/machinetranslation', prompt_family: 'machines-should-not-spend-blind.translation.general', run_count: 1, success_rate: 1, latency_ms: { min: 1000, median: 1000, max: 1000 }, payment_evidence_policy: 'payment_claimed=false unless explicit payment evidence exists', comparison_routes: [], winner_claimed: false, winner_criteria: 'Requires comparable routes, explicit scoring rules, and recorded benchmark artifact.', caveats: ['Schema preview only. This is not a recorded benchmark artifact.'], receipt_ids: ['mrx_exec_20260522000000000_0002'] },
      caveats: ['Benchmark-ready criteria define the gate for a future benchmark. No benchmark has been run.'],
      claims: { benchmark_claimed: false, winner_claimed: false, payment_claimed: false, benchmark_recorded: false }
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

describe('machine market page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-market');
    container = document.createElement('div');
    document.body.append(container);
    installMachineMarketFetch();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders /machine-market with all 13 services', async () => {
    root = await renderPage(container);

    const topNav = container.querySelector('[aria-label="Machine Economy navigation"]');
    expect(topNav?.textContent).toContain('Machine Market');
    expect(topNav?.textContent).toContain('Rail Coverage');
    expect(topNav?.textContent).toContain('Route Risk');
    expect(topNav?.textContent).toContain('First Safe Queue');
    expect(topNav?.textContent).toContain('Proof Ladder');
    expect(topNav?.textContent).toContain('Proof Plans');
    expect(topNav?.textContent).toContain('Receipts');
    expect(topNav?.textContent).toContain('Radar Terminal');
    expect(topNav?.querySelector('.machine-control-plane-summary')?.textContent).toContain('More');
    expect(topNav?.querySelector('.machine-control-plane-menu a[href="/machine-readiness-matrix"]')?.textContent).toContain('Readiness Matrix');
    expect(topNav?.querySelector('.machine-control-plane-menu a[href="/machine-market-map"]')?.textContent).toContain('Market Map');
    expect(topNav?.textContent).not.toContain('Benchmarks');
    expect(topNav?.textContent).not.toContain('Machine Preflight');
    expect(topNav?.textContent).not.toContain('Execution Detail');

    expect(container.textContent).toContain('Machine Market Command Center');
    expect(container.textContent).toContain('Radar turns visible machine services into policy, rail, route, proof, and receipt state before machines spend.');
    expect(container.textContent).toContain('13 listed services mapped from robotic.sh for Phase 2 machine-economy intelligence.');
    expect(container.querySelector('[aria-label="Machine Market summary"]')?.textContent).toContain('Market-wide execution claims0');
    expect(container.querySelector('[aria-label="Machine Market summary"]')?.textContent).toContain('Service-specific execution receipts2');
    expect(container.querySelector('[aria-label="Machine Market summary"]')?.textContent).toContain('Payment success claims0');
    expect(container.querySelector('[aria-label="13-Service Market Cohort"]')?.textContent).toContain('13 robotic.sh services mapped');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-market-map"]')?.textContent).toContain('View market map');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-readiness-matrix"]')?.textContent).toContain('View readiness matrix');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-economy-snapshot"]')?.textContent).toContain('View public snapshot');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-rail-coverage"]')?.textContent).toContain('View rail coverage');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-route-risk-matrix"]')?.textContent).toContain('View route risk matrix');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-proof-ladder"]')?.textContent).toContain('View proof ladder');
    expect(container.querySelector('[aria-label="Coverage caveat"] a[href="/machine-execution-shortlist"]')?.textContent).toContain('View execution shortlist');
    expect(container.querySelector('[aria-label="Machine Market Mission Control"]')?.textContent).toContain('Machine Market Mission Control');
    const controlSurfaces = container.querySelector('[aria-label="Machine Economy Control Surfaces"]');
    expect(controlSurfaces?.textContent).toContain('Machine Economy Control Surfaces');
    expect(controlSurfaces?.querySelector('a[href="/machine-market-map"]')?.textContent).toContain('Market Map');
    expect(controlSurfaces?.querySelector('a[href="/machine-readiness-matrix"]')?.textContent).toContain('Readiness Matrix');
    expect(controlSurfaces?.querySelector('a[href="/machine-economy-snapshot"]')?.textContent).toContain('Snapshot');
    expect(controlSurfaces?.querySelector('a[href="/machine-rail-coverage"]')?.textContent).toContain('Rail Coverage');
    expect(controlSurfaces?.querySelector('a[href="/machine-route-risk-matrix"]')?.textContent).toContain('Route Risk Matrix');
    expect(controlSurfaces?.querySelector('a[href="/machine-first-safe-routes"]')?.textContent).toContain('First Safe Route Queue');
    expect(controlSurfaces?.querySelector('a[href="/machine-proof-ladder"]')?.textContent).toContain('Proof Ladder');
    expect(controlSurfaces?.querySelector('a[href="/machine-execution-blockers"]')?.textContent).toContain('Execution Blockers');
    expect(controlSurfaces?.querySelector('a[href="/machine-market-changelog"]')?.textContent).toContain('Changelog');
    expect(controlSurfaces?.querySelector('a[href="/machine-no-claim-ledger"]')?.textContent).toContain('No-Claim Ledger');
    expect(controlSurfaces?.querySelector('a[href="/machine-receipts"]')?.textContent).toContain('Receipts');
    for (const name of serviceNames) expect(container.textContent).toContain(name);
  });

  it('links service rows and cards to service dossiers', async () => {
    root = await renderPage(container);

    expect(container.querySelector('a[href="/machine-service/qvac"]')?.textContent).toBe('View service dossier');
    expect(container.querySelector('a[href="/machine-service/cloud-translation"]')?.textContent).toBe('View service dossier');
  });

  it('filters visible services by source market', async () => {
    root = await renderPage(container);
    const select = container.querySelector('select[aria-label="Source market"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'pay.sh';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('5 visible services');
    expect(container.querySelector('[aria-label="Machine services"]')?.textContent).toContain('BigQuery');
  });

  it('shows evidence ladder and caveat copy', async () => {
    root = await renderPage(container);

    expect(container.querySelector('[aria-label="Evidence ladder"]')?.textContent).toContain('listed');
    expect(container.querySelector('[aria-label="Evidence ladder"]')?.textContent).toContain('preflight-ready');
    expect(container.textContent).toContain('Coverage refers to the 13 services visible in the observed robotic.sh market snapshot. 0 market-wide execution claims. Service-specific execution receipts are scoped to the recorded route.');
    expect(container.textContent).toContain('Preflight Coverage');
    expect(container.textContent).toContain('Run Coverage Preflight');
    expect(container.textContent).toContain('Services evaluated13 / 13');
    expect(container.textContent).toContain('Receipts recorded13');
    expect(container.textContent).toContain('No Pay.sh, robotic.sh, or Agentic.Market call was made.');
    expect(container.querySelector('[aria-label="Preflight Coverage"] .machine-caveat-row .machine-caveat-copy')?.textContent).toContain('Coverage run records decision receipts only.');
    const methodology = container.querySelector('[aria-label="Evidence methodology drawer"]');
    expect(methodology?.textContent).toContain('proof_path');
    expect(methodology?.textContent).toContain('proof_plan_selected');
    expect(methodology?.textContent).toContain('This is not an execution claim.');
  });

  it('renders cohort command center with next controlled action, proof plan, shortlist, and operational chips', async () => {
    root = await renderPage(container);

    const cohort = container.querySelector('[aria-label="13-Service Market Cohort"]');
    expect(cohort?.textContent).toContain('13 services mapped');
    expect(cohort?.textContent).toContain('10 allow');
    expect(cohort?.textContent).toContain('2 review');
    expect(cohort?.textContent).toContain('1 deny');
    expect(cohort?.textContent).toContain('0 robotic.sh market-wide execution claims');
    expect(cohort?.textContent).toContain('QVAC');
    expect(cohort?.textContent).toContain('Cloud Translation');
    expect(cohort?.textContent).toContain('Every visible robotic.sh service now has a policy state, evidence state, readiness rank, and proof path.');
    expect(cohort?.textContent).toContain('policy-mapped');
    expect(cohort?.textContent).toContain('proof-path');
    expect(cohort?.textContent).not.toContain('proof-plan-ready');
    expect(cohort?.textContent).not.toContain('PROOF PLAN READY');
    expect(cohort?.textContent).toContain('not_attempted');
    expect(cohort?.textContent).toContain('Machines should not spend blind');
    expect(cohort?.querySelector('[aria-label="Next Controlled Action strip"]')?.textContent).toContain('Proof plan selected: Cloud Translation');
    expect(cohort?.querySelector('[aria-label="Next Controlled Action strip"]')?.textContent).toContain('planning only · no execution claim');

    const missionControl = container.querySelector('[aria-label="Machine Market Mission Control"]');
    expect(missionControl?.textContent).toContain('Coverage complete / proof planning active');
    expect(missionControl?.textContent).toContain('13 / 13 services evaluated');
    expect(missionControl?.textContent).toContain('allow 10 / review 2 / deny 1');
    expect(missionControl?.textContent).toContain('Next controlled action');
    expect(missionControl?.textContent).toContain('Cloud Translation');
    expect(missionControl?.textContent).toContain('selected controlled action');
    expect(missionControl?.textContent).toContain('planning-only');
    expect(missionControl?.textContent).toContain('not execution-tested');
    expect(missionControl?.textContent).toContain('not a winner claim');
    expect(missionControl?.textContent).toContain('Planning only. 0 robotic.sh market-wide execution claims. 0 payment success claims.');
    expect(missionControl?.textContent).toContain('Pay.sh execution routes are tracked separately from the robotic.sh visible service mirror');
    expect(missionControl?.querySelector('a[href="/machine-execution-plan/cloud-translation"]')?.textContent).toContain('Open controlled proof plan');
    expect(missionControl?.querySelector('a[href="/machine-readiness-matrix"]')?.textContent).toContain('View readiness matrix');
    expect(missionControl?.querySelector('a[href="/machine-execution-shortlist"]')?.textContent).toContain('View execution shortlist');

    const heroChips = container.querySelector('[aria-label="Machine Market principles"]')?.textContent ?? '';
    expect(heroChips).toContain('Listed ≠ callable');
    expect(heroChips).toContain('Callable ≠ executed');
    expect(heroChips).toContain('Credentials ≠ payment proof');
    expect(heroChips).toContain('Route surface ≠ receipt');
  });

  it('opens the NAVER Maps inspector drawer with navigation risk note and proof-path CTA', async () => {
    root = await renderPage(container);

    const card = Array.from(container.querySelectorAll('.machine-cohort-card')).find((item) => item.textContent?.includes('NAVER Maps')) as HTMLButtonElement | undefined;
    expect(card).toBeTruthy();

    await act(async () => {
      card!.click();
    });

    const drawer = container.querySelector('[aria-label="Service inspector drawer"]');
    expect(drawer?.textContent).toContain('NAVER Maps');
    expect(drawer?.textContent).toContain('provider');
    expect(drawer?.textContent).toContain('NAVER');
    expect(drawer?.textContent).toContain('category');
    expect(drawer?.textContent).toContain('navigation');
    expect(drawer?.textContent).toContain('policy decision');
    expect(drawer?.textContent).toContain('review');
    expect(drawer?.textContent).toContain('machine use case');
    expect(drawer?.textContent).toContain('Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.');
    expect(drawer?.textContent).toContain('policy risk note');
    expect(drawer?.textContent).toContain('routing outputs can influence physical-world movement');
    expect(drawer?.textContent).toContain('evidence stage');
    expect(drawer?.textContent).toContain('policy-mapped');
    expect(drawer?.textContent).toContain('evidence health');
    expect(drawer?.textContent).toContain('scaffold');
    expect(drawer?.textContent).toContain('readiness tier');
    expect(drawer?.textContent).toContain('execution status');
    expect(drawer?.textContent).toContain('next safe action');
    expect(drawer?.textContent).toContain('Inspect proof path and define safe routing test before execution.');
    expect(drawer?.textContent).toContain('No robotic.sh market-wide execution claim. No benchmark claim.');
    expect(drawer?.querySelector('a[href="/machine-service/naver-maps"]')?.textContent).toContain('View dossier');
    expect(drawer?.querySelector('a[href="/machine-execution-plan/naver-maps"]')?.textContent).toContain('Inspect proof path');
  });

  it('renders the Market Brief, preserves scoped market-wide execution language, and supports copy feedback', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    root = await renderPage(container);

    const brief = container.querySelector('[aria-label="Machine Market Brief"]');
    expect(brief?.textContent).toContain('13 robotic.sh services mapped. 10 allow / 2 review / 1 deny. Every visible service has policy state, evidence state, readiness rank, and proof path. 0 robotic.sh market-wide execution claims. 1 controlled proof-plan action selected. Machines should not spend blind.');
    expect(brief?.textContent).not.toContain('winner');
    expect(brief?.textContent).not.toContain('benchmark');

    const button = Array.from(brief?.querySelectorAll('button') ?? []).find((item) => item.textContent === 'Copy brief') as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('13 robotic.sh services mapped. 10 allow / 2 review / 1 deny. Every visible service has policy state, evidence state, readiness rank, and proof path. 0 robotic.sh market-wide execution claims. 1 controlled proof-plan action selected. Machines should not spend blind.');
    expect(button?.textContent).toBe('Copied brief');
  });

  it('shows selected service execution planning actions', async () => {
    root = await renderPage(container);

    const card = container.querySelector('[aria-label="Service policy profile"]');
    expect(card?.textContent).toContain('candidate_tier');
    expect(card?.textContent).toContain('recommendation');
    expect(card?.textContent).toContain('execution_status');
    expect(card?.querySelector('a[href="/machine-execution-plan/qvac"]')?.textContent).toContain('Open proof plan');
    expect(card?.querySelector('a[href="/machine-service/qvac"]')?.textContent).toContain('View service dossier');
  });

  it('does not mark service rows as execution-tested or benchmark-recorded by default', async () => {
    root = await renderPage(container);
    const tableText = container.querySelector('[aria-label="Machine services"]')?.textContent ?? '';

    expect(tableText).not.toContain('execution-tested');
    expect(tableText).not.toContain('benchmark-recorded');
  });

  it('guards overclaim terms in service registry when stage is policy-mapped', async () => {
    root = await renderPage(container);
    const tableText = container.querySelector('[aria-label="Machine services"]')?.textContent ?? '';

    expect(tableText).not.toContain('executed');
    expect(tableText).not.toContain('proven');
    expect(tableText).not.toContain('winner');
  });

  it('renders AnyTrans blocked state and Machine Translation General execution candidate state', async () => {
    root = await renderPage(container);
    const pageText = container.textContent ?? '';
    expect(pageText).toContain('Machine Translation Execution Candidates');
    expect(pageText).toContain('attempted-recorded / workspace blocked');
    expect(pageText).toContain('Alibaba Machine Translation General');
    expect(pageText).toContain('POST api/translate/web/general');
    expect(pageText).toContain('Execution-tested applies only to Alibaba Machine Translation General after Radar records the successful execution receipt.');
    expect(pageText).toContain('infopunks-pay-sh-agent-harness');
    expect(pageText).toContain('manual');
    expect(pageText).toContain('repeatabilityinsufficient_runs');
    expect(pageText).toContain('benchmark claims0');
    expect(pageText).toContain('benchmark readinesscriteria-defined');
    expect(pageText).toContain('benchmark recordedfalse');
    expect(pageText).toContain('winner claimedfalse');
    expect(pageText).toContain('winner claims0');
    expect(pageText).toContain('repeatability successful runs1 successful receipts');
    expect(pageText).toContain('recorded success rate100%');
    expect(pageText).toContain('View repeatability artifact');
  });
});
