// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const summary = {
  generated_at: '2026-07-06T10:00:00.000Z',
  title: 'Infopunks Revenue Receipts',
  tagline: 'No receipt, no trust.',
  subline: 'Public ledger for paid evaluations, bounties, reports, listings, studio work, and API access.',
  trust_line: 'Projects can buy evaluation, not conviction.',
  warning_line: 'Template receipts are examples only. They are not real revenue.',
  use_of_funds_policy: [
    { bucket: 'product_treasury', percentage: 40 },
    { bucket: 'hunter_rewards', percentage: 30 },
    { bucket: 'community_ops', percentage: 20 },
    { bucket: 'content_design_bounties', percentage: 10 }
  ],
  receipts: [
    {
      id: 'rr_open_evaluation_slot',
      receiptNumber: 'Open Slot',
      title: 'Open Unicorn Radar Evaluation Slot',
      source: 'sponsored_radar_evaluation',
      clientName: 'Open',
      clientType: 'project',
      amount: 100,
      currency: 'USD',
      status: 'open_slot',
      publishedAt: '2026-07-06T10:00:00.000Z',
      completedAt: null,
      relatedProduct: 'Unicorn Radar',
      relatedCandidateId: null,
      relatedCandidateUrl: null,
      disclosure: 'Projects can buy evaluation, not conviction.',
      verdictIndependenceStatement: 'Payment does not guarantee a positive verdict.',
      useOfFunds: [
        { bucket: 'product_treasury', percentage: 40, amount_usd: 40 },
        { bucket: 'hunter_rewards', percentage: 30, amount_usd: 30 },
        { bucket: 'community_ops', percentage: 20, amount_usd: 20 },
        { bucket: 'content_design_bounties', percentage: 10, amount_usd: 10 }
      ],
      hunterReward: 30,
      txHash: null,
      paymentMethod: null,
      notes: ['Completed work will receive a public receipt.'],
      ogImageUrl: '/og/revenue-receipts/rr_open_evaluation_slot.png'
    },
    {
      id: 'rr_template_001',
      receiptNumber: 'Template',
      title: 'Revenue Receipt Template',
      source: 'sponsored_radar_evaluation',
      clientName: 'Example',
      clientType: 'example',
      amount: 0,
      currency: 'USD',
      status: 'pending',
      publishedAt: '2026-07-06T10:00:00.000Z',
      completedAt: null,
      relatedProduct: 'Unicorn Radar',
      relatedCandidateId: null,
      relatedCandidateUrl: null,
      disclosure: 'This is a template showing how completed revenue receipts will be published.',
      verdictIndependenceStatement: 'Projects can buy evaluation, not conviction.',
      useOfFunds: [
        { bucket: 'product_treasury', percentage: 40, amount_usd: 0 },
        { bucket: 'hunter_rewards', percentage: 30, amount_usd: 0 },
        { bucket: 'community_ops', percentage: 20, amount_usd: 0 },
        { bucket: 'content_design_bounties', percentage: 10, amount_usd: 0 }
      ],
      hunterReward: null,
      txHash: null,
      paymentMethod: null,
      notes: ['Template only.', 'Not real revenue.', 'Not Revenue Receipt #001.'],
      ogImageUrl: '/og/revenue-receipts/rr_template_001.png'
    }
  ]
};

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = pathOf(input);
    if (path === '/v1/revenue-receipts') return Promise.resolve(new Response(JSON.stringify({ data: summary }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path === '/v1/revenue-receipts/rr_open_evaluation_slot') return Promise.resolve(new Response(JSON.stringify({ data: summary.receipts[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
  }));
}

describe('revenue receipt pages', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockFetch();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders /revenue-receipts with grouped receipt cards and warning copy', async () => {
    window.history.pushState({}, '', '/revenue-receipts');

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Revenue Receipts');
    expect(container.textContent).toContain('No receipt, no trust.');
    expect(container.textContent).toContain('Open Unicorn Radar Evaluation Slot');
    expect(container.textContent).toContain('Revenue Receipt Template');
    expect(container.textContent).toContain('Not real revenue.');
  });

  it('renders /revenue-receipts/:receiptId detail pages', async () => {
    window.history.pushState({}, '', '/revenue-receipts/rr_open_evaluation_slot');

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Open Unicorn Radar Evaluation Slot');
    expect(container.textContent).toContain('Payment does not guarantee a positive verdict.');
    expect(container.textContent).toContain('Hunter reward');
    expect(container.textContent).toContain('No public candidate is linked to this receipt yet.');
  });
});
