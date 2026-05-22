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
  'Exa'
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
  service('Exa')
];

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
    if (path === '/v1/machine-market/services') return json({ count: 12, services });
    if (path === '/v1/machine-market/summary') return json({
      total_services: 12,
      categories: { compute: 1, inference: 4, web: 4, vision: 1, storage: 1, translation: 1 },
      source_markets: { 'pay.sh': 5, 'agentic.market': 6, 'robotic.sh': 1 },
      chains: { solana: 5, base: 6, peaq: 1 },
      ready_count: 11,
      setup_count: 1,
      evidence_stage_counts: { 'policy-mapped': 12 },
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
        services_total: 12,
        preflight_evaluated: 12,
        receipts_recorded: 12,
        allow_count: 6,
        review_count: 4,
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
      }]
    });
    if (path === '/v1/machine-preflight/coverage-run') return json({
      run_id: 'mcr_20260522000000000_0002',
      generated_at: '2026-05-22T00:11:00.000Z',
      services_total: 12,
      preflight_evaluated: 12,
      receipts_recorded: 12,
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

  it('renders /machine-market with all 12 services', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Market');
    expect(container.textContent).toContain('12 listed services mapped from robotic.sh for Phase 2 machine-economy intelligence.');
    expect(container.querySelector('.machine-market-caveat a[href="/machine-execution-shortlist"]')?.textContent).toContain('View execution shortlist');
    expect(container.querySelector('[aria-label="Machine Market Mission Control"]')?.textContent).toContain('Machine Market Mission Control');
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
    expect(container.textContent).toContain('Coverage refers to the 12 services visible in the observed robotic.sh market snapshot. Execution evidence is tracked separately.');
    expect(container.textContent).toContain('Preflight Coverage');
    expect(container.textContent).toContain('Run Coverage Preflight');
    expect(container.textContent).toContain('Services evaluated12 / 12');
    expect(container.textContent).toContain('Receipts recorded12');
    expect(container.textContent).toContain('No Pay.sh, robotic.sh, or Agentic.Market call was made.');
    expect(container.querySelector('[aria-label="Preflight Coverage"] .machine-caveat-row .machine-caveat-copy')?.textContent).toContain('Coverage run records decision receipts only.');
    expect(container.querySelector('a[href="/#methodology"]')?.textContent).toBe('Methodology: Machine Economy evidence ladder');
  });

  it('renders mission control with top candidate, proof plan, shortlist, and operational chips', async () => {
    root = await renderPage(container);

    const missionControl = container.querySelector('[aria-label="Machine Market Mission Control"]');
    expect(missionControl?.textContent).toContain('Coverage complete / proof planning active');
    expect(missionControl?.textContent).toContain('12 / 12 services evaluated');
    expect(missionControl?.textContent).toContain('allow 6 / review 4 / deny 2');
    expect(missionControl?.textContent).toContain('Cloud Translation');
    expect(missionControl?.textContent).toContain('Plan execution, do not claim execution.');
    expect(missionControl?.textContent).toContain('no robotic.sh-listed service has execution success claimed unless Radar holds a service-specific execution receipt');
    expect(missionControl?.textContent).toContain('Pay.sh execution candidates remain separate from the robotic.sh visible service mirror');
    expect(missionControl?.querySelector('a[href="/machine-execution-plan/cloud-translation"]')?.textContent).toContain('Open top candidate proof plan');
    expect(missionControl?.querySelector('a[href="/machine-execution-shortlist"]')?.textContent).toContain('View execution shortlist');

    const heroChips = container.querySelector('[aria-label="Machine Market principles"]')?.textContent ?? '';
    expect(heroChips).toContain('Coverage complete');
    expect(heroChips).toContain('12 / 12 evaluated');
    expect(heroChips).toContain('Planning only');
    expect(heroChips).toContain('Next: Cloud Translation');
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
    expect(pageText).toContain('benchmark claimfalse');
    expect(pageText).toContain('benchmark readinesscriteria-defined');
    expect(pageText).toContain('benchmark recordedfalse');
    expect(pageText).toContain('winner claimedfalse');
    expect(pageText).toContain('repeatability successful runs1 successful receipts');
    expect(pageText).toContain('recorded success rate100%');
    expect(pageText).toContain('View repeatability artifact');
  });
});
