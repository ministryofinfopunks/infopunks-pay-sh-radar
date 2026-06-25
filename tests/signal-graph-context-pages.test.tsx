// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

const claimDetail = {
  claim_id: 'claim_001',
  created_at: '2026-06-25T09:00:00.000Z',
  submitted_by: 'agent_001',
  claim_type: 'reliability',
  target_type: 'route',
  target_id: 'route_cloud_translation',
  statement: 'Receipts should become reusable route memory.',
  evidence_receipt_ids: ['receipt_001'],
  evidence_artifact_uris: ['https://example.com/claim'],
  status: 'supported',
  confidence_score: 91,
  validation_state: 'human_validated',
  challenge_count: 0,
  support_count: 2,
  human_notes: ['validated by operator'],
  challenges: []
};

const receiptDetail = {
  receipt_id: 'receipt_001',
  timestamp: '2026-06-25T09:00:00.000Z',
  agent_id: 'agent_001',
  route_id: 'route_cloud_translation',
  provider_id: 'provider_alpha',
  service_id: 'service_wallet_router',
  task_type: 'market_research',
  cost: '$0.05',
  payment_method: 'stablecoin',
  latency_ms: 812,
  input_summary: 'route memory query',
  output_summary: 'validated route memory',
  status: 'succeeded',
  failure_reason: null,
  validation_state: 'human_validated',
  human_notes: ['good receipt'],
  confidence_delta: 6,
  evidence_artifact: 'receipt.json',
  route: null,
  provider: null,
  service: null,
  impact: {
    improves_route_confidence: true,
    reduces_route_confidence: false,
    freshness: 'fresh',
    human_validated: true,
    should_affect_future_pre_spend_decisions: true,
    summary: 'Fresh validated receipt should influence later route decisions.'
  }
};

const routeDetail = {
  route: {
    route_id: 'route_cloud_translation',
    provider_id: 'provider_alpha',
    service_id: 'service_wallet_router',
    endpoint: 'POST /translate',
    payment_method: 'stablecoin',
    estimated_cost: '$0.05',
    latency_ms_p50: 400,
    latency_ms_p95: 850,
    success_rate: 0.96,
    last_tested_at: '2026-06-25T09:00:00.000Z',
    last_successful_run: '2026-06-25T09:00:00.000Z',
    last_failed_run: null,
    confidence_score: 88,
    risk_level: 'low',
    known_blockers: [],
    receipt_references: ['receipt_001'],
    recommended_use_case: 'bounded translation',
    avoid_conditions: []
  },
  provider: null,
  service: null,
  receipts: [],
  metrics: {
    verified_pre_spend_decisions: 1,
    routes_indexed: 1,
    providers_scored: 1,
    receipts_generated: 1,
    pre_spend_checks_completed: 1,
    human_validations_submitted: 1,
    failed_routes_avoided: 0,
    claims_challenged: 0,
    repeatable_routes_discovered: 1,
    agent_builders_using_the_api: 1,
    amount_of_spend_protected_or_intelligently_routed: '$1'
  },
  validation_state: 'human_validated',
  decision_implications: ['This route is approved for bounded translation.'],
  trust_summary: {
    receipt_freshness: 'fresh',
    successful_receipt_count: 1,
    failure_patterns: [],
    blocker_severity: 'none',
    provider_reliability: 'stable',
    human_validation: 'validated',
    summary: 'Route has fresh receipt support.'
  }
};

const loopDetail = {
  id: 'loop_pre_spend_route',
  name: 'Pre-spend route memory loop',
  objective: 'Turn route receipts into reusable memory.',
  hypothesis: 'Receipt-backed route memory improves future spend decisions.',
  action_taken: 'Replayed route selection through proof checks.',
  evidence_artifacts: ['artifact://loop'],
  score: 91,
  failure_reason: null,
  proof_state: 'memory_recorded',
  decision_state: 'trust',
  linked_check_id: 'check_001',
  runs: []
};

const proofCheck = {
  check_id: 'check_001',
  created_at: '2026-06-25T09:00:00.000Z',
  submitted_by: 'agent_001',
  source_url: null,
  input: 'Route memory should persist.',
  claim: 'Route memory should persist.',
  claim_type: 'route_performance',
  claim_summary: 'Receipts support the claim.',
  subject_label: 'Route memory',
  receipts_found: ['receipt_001'],
  evidence_artifacts: ['artifact://receipt'],
  evidence_strength: 'strong',
  receipt_strength: 'verified_receipts',
  validation_status: 'human_validated',
  risk_flags: [],
  decision_state: 'trust',
  share_url: '/check/check_001',
  share_text: 'share text',
  evidence_summary: 'Receipts support the claim.',
  validation_summary: 'Human validation supports the claim.',
  decision_summary: 'Trust this proof.',
  headline: 'INFOPUNKS RECEIPT CHECK',
  public_cta: 'Inspect proof'
};

const graphNode = {
  id: 'claim_route_memory',
  label: 'Route memory',
  cluster_id: 'pre_spend_intelligence',
  proof_state: 'validated',
  confidence_score: 90,
  velocity_score: 72
};

describe('signal graph context detail pages', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/claims/claim_001') return json(claimDetail);
      if (path === '/v1/receipts/receipt_001') return json(receiptDetail);
      if (path === '/v1/routes/route_cloud_translation') return json(routeDetail);
      if (path === '/v1/loops/loop_pre_spend_route') return json(loopDetail);
      if (path === '/v1/checks/check_001') return json(proofCheck);
      if (path === '/v1/graph/entities/claim/claim_001') return json({ entity_type: 'claim', entity_id: 'claim_001', nodes: [graphNode] });
      if (path === '/v1/graph/entities/receipt/receipt_001') return json({ entity_type: 'receipt', entity_id: 'receipt_001', nodes: [graphNode] });
      if (path === '/v1/graph/entities/loop/loop_pre_spend_route') return json({ entity_type: 'loop', entity_id: 'loop_pre_spend_route', nodes: [graphNode] });
      if (path === '/v1/graph/entities/route/route_cloud_translation') return json({ entity_type: 'route', entity_id: 'route_cloud_translation', nodes: [] });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('shows signal graph context on the claim detail page with a graph CTA', async () => {
    window.history.pushState({}, '', '/claims/claim_001');

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Signal Graph context');
    expect(container.textContent).toContain('Route memory');
    expect(container.textContent).toContain('Validated');
    expect(container.querySelector('a[href="/graph?node=claim_route_memory"]')?.textContent).toContain('View in Signal Graph');
  });

  it('shows signal graph context on the receipt and loop detail pages', async () => {
    window.history.pushState({}, '', '/receipts/receipt_001');

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Signal Graph context');
    expect(container.querySelector('a[href="/graph?node=claim_route_memory"]')).not.toBeNull();

    await act(async () => root.unmount());
    window.history.pushState({}, '', '/loops/loop_pre_spend_route');
    container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Signal Graph context');
    expect(container.textContent).toContain('Pre-spend route memory loop');
  });

  it('keeps the route detail page usable when no graph context exists', async () => {
    window.history.pushState({}, '', '/routes/route_cloud_translation');

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('route_cloud_translation');
    expect(container.textContent).not.toContain('Signal Graph context');
  });
});
