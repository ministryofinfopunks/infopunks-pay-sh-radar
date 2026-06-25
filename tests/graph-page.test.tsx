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

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const graphPayload = {
  tagline: 'Stop scrolling the feed. Read the graph.',
  clusters: [
    { id: 'agentic_payments', label: 'Agentic Payments', summary: 'Wallet-aware routes and payment rails.', proof_state: 'validated', ripple_summary: 'Wallet-linked rails are consolidating.', node_count: 2, edge_count: 2, updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'machine_markets', label: 'Machine Markets', summary: 'Machines are moving toward bounded route plans.', proof_state: 'compounding', ripple_summary: 'Translation routes remain the safest proofs.', node_count: 1, edge_count: 1, updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'pre_spend_intelligence', label: 'Pre-Spend Intelligence', summary: 'Proof-aware route memory before spend.', proof_state: 'validated', ripple_summary: 'Receipt doctrine is hardening.', node_count: 1, edge_count: 2, updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'carbon_finance_2_0', label: 'Carbon Finance 2.0', summary: 'Carbon claims need proof discipline.', proof_state: 'disputed', ripple_summary: 'Integrity threads are challenging green alpha.', node_count: 1, edge_count: 1, updated_at: '2026-06-24T12:00:00.000Z' },
    { id: 'ct_subcultures', label: 'CT Subcultures', summary: 'Memes and claims spread faster than proof.', proof_state: 'compounding', ripple_summary: 'Graph-reading slogans are accelerating.', node_count: 1, edge_count: 1, updated_at: '2026-06-25T09:00:00.000Z' }
  ],
  nodes: [
    { id: 'project_pay_sh', type: 'project', label: 'Pay.sh', summary: 'Settlement rail and provider surface for machine spend.', cluster_id: 'agentic_payments', proof_state: 'validated', confidence_score: 93, velocity_score: 82, source_urls: ['https://pay.sh'], linked_receipt_ids: ['receipt_005'], linked_claim_ids: ['claim_route_memory'], linked_loop_ids: ['loop_pre_spend_route'], linked_route_ids: ['route_cloud_translation'], linked_provider_ids: ['provider_alpha'], linked_service_ids: ['service_wallet_router'], created_at: '2026-06-12T09:00:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'project_x402', type: 'project', label: 'x402', summary: 'Payment handshake narrative for agent-native API commerce.', cluster_id: 'agentic_payments', proof_state: 'compounding', confidence_score: 71, velocity_score: 88, created_at: '2026-06-15T10:10:00.000Z', updated_at: '2026-06-24T20:45:00.000Z' },
    { id: 'route_cloud_translation', type: 'route', label: 'Cloud Translation first-safe route', summary: 'A bounded translation route used as a proof plan.', cluster_id: 'machine_markets', proof_state: 'validated', confidence_score: 84, velocity_score: 68, linked_loop_ids: ['loop_machine_service_route'], created_at: '2026-06-18T08:15:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'claim_route_memory', type: 'claim', label: 'Route memory', summary: 'Receipts should become reusable memory before autonomous spend.', cluster_id: 'pre_spend_intelligence', proof_state: 'validated', confidence_score: 90, velocity_score: 72, linked_receipt_ids: ['receipt_001'], linked_claim_ids: ['claim_001'], linked_loop_ids: ['loop_pre_spend_route'], created_at: '2026-06-13T07:50:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' },
    { id: 'claim_carbon_credits_sensitive', type: 'claim', label: 'Carbon credits are claims-sensitive instruments', summary: 'Tokenized carbon assets inherit integrity risk.', cluster_id: 'carbon_finance_2_0', proof_state: 'disputed', confidence_score: 69, velocity_score: 78, created_at: '2026-06-16T07:30:00.000Z', updated_at: '2026-06-24T11:30:00.000Z' },
    { id: 'meme_stop_scrolling', type: 'meme', label: 'Stop scrolling the feed. Read the graph.', summary: 'The Signal Graph slogan reframing feeds as noise and graphs as memory.', cluster_id: 'ct_subcultures', proof_state: 'compounding', confidence_score: 85, velocity_score: 94, created_at: '2026-06-20T08:40:00.000Z', updated_at: '2026-06-25T09:00:00.000Z' }
  ],
  edges: [
    { id: 'edge_pay_sh_x402', source_node_id: 'project_pay_sh', target_node_id: 'project_x402', type: 'semantic_similarity', strength: 72, explanation: 'Both map agent-native payment flows.' },
    { id: 'edge_pay_sh_route_memory', source_node_id: 'project_pay_sh', target_node_id: 'claim_route_memory', type: 'proof_link', strength: 90, explanation: 'Pre-Spend Intelligence evaluates Pay.sh routes before spend.' },
    { id: 'edge_route_machine', source_node_id: 'route_cloud_translation', target_node_id: 'claim_route_memory', type: 'proof_link', strength: 66, explanation: 'First-safe machine routes borrow pre-spend proof discipline.' },
    { id: 'edge_claim_carbon_meme', source_node_id: 'claim_carbon_credits_sensitive', target_node_id: 'meme_stop_scrolling', type: 'citation', strength: 57, explanation: 'The graph-reading slogan is cited as an antidote to feed noise.' }
  ],
  ripples: [
    { id: 'ripple_pre_spend_24h', cluster_id: 'pre_spend_intelligence', title: 'Receipt doctrine is hardening into product memory', summary: 'Routes, receipts, Proof Feed, and LoopLab are converging on one message: route memory should outlive the feed.', proof_state: 'validated', impact_score: 91, changed_at: '2026-06-25T09:00:00.000Z', linked_node_ids: ['project_pay_sh', 'claim_route_memory'] },
    { id: 'ripple_carbon_24h', cluster_id: 'carbon_finance_2_0', title: 'Carbon narratives are being challenged as proof-sensitive claims', summary: 'Integrity threads are pressuring tokenized carbon stories to surface receipts.', proof_state: 'disputed', impact_score: 74, changed_at: '2026-06-24T20:45:00.000Z', linked_node_ids: ['claim_carbon_credits_sensitive'] }
  ],
  stats: {
    node_count: 6,
    edge_count: 4,
    cluster_count: 5,
    validated_count: 3,
    disputed_count: 1,
    compounding_count: 2,
    last_updated_at: '2026-06-25T09:00:00.000Z'
  }
};

const graphCheckPayload = {
  generated_node_preview: {
    id: 'preview_signal_001',
    type: 'claim',
    label: 'Agent wallets need route memory before autonomous spend.',
    summary: 'Preview node for deterministic v0 graph placement.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 91,
    velocity_score: 61,
    source_urls: ['https://example.com/thread'],
    created_at: '2026-06-25T09:00:00.000Z',
    updated_at: '2026-06-25T09:00:00.000Z'
  },
  suggested_proof_state: 'validated',
  confidence_score: 91,
  suggested_edges: [
    {
      target_node_id: 'claim_route_memory',
      type: 'proof_link',
      strength: 88,
      explanation: 'Route memory is the closest seeded proof anchor for this claim.'
    }
  ],
  explanation: 'This signal clusters with Pre-Spend Intelligence because it argues that receipts and route memory should govern spend before execution.'
};

describe('signal graph page', () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    window.history.pushState({}, '', '/graph');
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/graph') return json(graphPayload);
      if (path === '/v1/graph/ripples') return json({ ripples: graphPayload.ripples });
      if (path === '/v1/graph/check') return json(graphCheckPayload);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the graph route, tagline, cluster names, proof states, and ripples', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Signal Graph');
    expect(container.textContent).toContain('Stop scrolling the feed. Read the graph.');
    expect(container.textContent).toContain('Agentic Payments');
    expect(container.textContent).toContain('Machine Markets');
    expect(container.textContent).toContain('Pre-Spend Intelligence');
    expect(container.textContent).toContain('Carbon Finance 2.0');
    expect(container.textContent).toContain('CT Subcultures');
    for (const label of ['Unproven', 'Validated', 'Disputed', 'Corrupted', 'Compounding']) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toContain('24h Ripples');
    expect(container.textContent).toContain('Receipt doctrine is hardening into product memory');
    expect(container.querySelector('a[href="/graph"]')?.textContent).toContain('Signal Graph');
    expect(container.querySelector('button[aria-label="Copy node signal"]')).not.toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((item) => item.textContent?.includes('Copy signal'))).toBe(true);
    expect(container.querySelector('a[href="/claims/claim_route_memory"]')?.textContent).toContain('claim_route_memory');
    expect(container.querySelector('a[href="/receipts/receipt_005"]')?.textContent).toContain('receipt_005');
    expect(container.querySelector('a[href="/loops/loop_pre_spend_route"]')?.textContent).toContain('loop_pre_spend_route');
    expect(container.querySelector('a[href="/routes/route_cloud_translation"]')?.textContent).toContain('route_cloud_translation');
    expect(container.querySelector('a[href="/providers/provider_alpha"]')?.textContent).toContain('provider_alpha');
    expect(container.querySelector('a[href="/services/service_wallet_router"]')?.textContent).toContain('service_wallet_router');
  });

  it('renders the signal check form with the graph clusters', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Check a signal');
    expect(container.textContent).toContain('Paste a claim, post, token, project, or narrative fragment.');
    expect(container.textContent).toContain('v0 preview. Full live ingestion comes later.');
    expect(container.querySelector('input[name="label"]')).not.toBeNull();
    expect(container.querySelector('textarea[name="summary"]')).not.toBeNull();
    expect(container.querySelector('input[name="source_url"]')).not.toBeNull();
    const clusterSelect = container.querySelector('select[name="cluster_id"]') as HTMLSelectElement | null;
    expect(clusterSelect).not.toBeNull();
    expect(Array.from(clusterSelect?.options ?? []).some((option) => option.textContent === 'Agentic Payments')).toBe(true);
    expect(Array.from(clusterSelect?.options ?? []).some((option) => option.textContent === 'Pre-Spend Intelligence')).toBe(true);
  });

  it('shows inline validation when signal label is empty', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const form = container.querySelector('.signal-graph-check-form') as HTMLFormElement | null;
    expect(form).not.toBeNull();

    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Signal label is required.');
  });

  it('submits the signal check, renders the preview, and exposes the copy action', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const labelInput = container.querySelector('input[name="label"]') as HTMLInputElement | null;
    const summaryInput = container.querySelector('textarea[name="summary"]') as HTMLTextAreaElement | null;
    const sourceUrlInput = container.querySelector('input[name="source_url"]') as HTMLInputElement | null;
    const clusterSelect = container.querySelector('select[name="cluster_id"]') as HTMLSelectElement | null;
    const form = container.querySelector('.signal-graph-check-form') as HTMLFormElement | null;
    expect(labelInput).not.toBeNull();
    expect(summaryInput).not.toBeNull();
    expect(sourceUrlInput).not.toBeNull();
    expect(clusterSelect).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(labelInput!, 'Agent wallets need route memory before autonomous spend.');
      setInputValue(summaryInput!, 'Receipt-backed route memory should govern spend.');
      setInputValue(sourceUrlInput!, 'https://example.com/thread');
      setSelectValue(clusterSelect!, 'pre_spend_intelligence');
    });

    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const submitCall = fetchMock.mock.calls.find((call) => pathOf(call[0] as RequestInfo | URL) === '/v1/graph/check');
    expect(submitCall).toBeTruthy();
    expect(submitCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(submitCall?.[1]?.body))).toEqual({
      label: 'Agent wallets need route memory before autonomous spend.',
      summary: 'Receipt-backed route memory should govern spend.',
      source_url: 'https://example.com/thread',
      cluster_id: 'pre_spend_intelligence'
    });

    expect(container.textContent).toContain('Signal placement preview');
    expect(container.textContent).toContain('Suggested proof state');
    expect(container.textContent).toContain('Validated');
    expect(container.textContent).toContain('Confidence score');
    expect(container.textContent).toContain('91/100');
    expect(container.textContent).toContain('This signal clusters with Pre-Spend Intelligence');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('Copy check'))).toBe(true);
  });

  it('updates the detail panel when a node is selected from the SVG graph', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Pay.sh');
    const carbonNode = container.querySelector('[data-node-id="claim_carbon_credits_sensitive"]');
    expect(carbonNode).not.toBeNull();

    await act(async () => {
      carbonNode!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Carbon credits are claims-sensitive instruments');
    expect(container.textContent).toContain('Tokenized carbon assets inherit integrity risk.');
    expect(container.textContent).toContain('Connected edges');
  });

  it('preselects the node from /graph?node=<node_id>', async () => {
    window.history.pushState({}, '', '/graph?node=claim_carbon_credits_sensitive');

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const selectedPanel = container.querySelector('[aria-label="Selected node details"]');
    expect(selectedPanel?.textContent).toContain('Carbon credits are claims-sensitive instruments');
    expect(selectedPanel?.textContent).toContain('Disputed');
  });

  it('falls back to the default selection for an unknown node query', async () => {
    window.history.pushState({}, '', '/graph?node=missing_node');

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const selectedPanel = container.querySelector('[aria-label="Selected node details"]');
    expect(selectedPanel?.textContent).toContain('Pay.sh');
    expect(container.textContent).toContain('Infopunks Signal Graph');
  });
});
