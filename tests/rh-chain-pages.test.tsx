// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainPayload, getRhChainReviewQueue } from '../src/data/rhChain';
import { asRhChainPersistedReviewItem, createRhChainSignalSubmission } from '../src/services/rhChainSignalVault';
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

describe('RH Chain Signal Desk pages', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  let reviewQueue = getRhChainReviewQueue();

  beforeEach(() => {
    container = document.createElement('div');
    reviewQueue = getRhChainReviewQueue();
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (pathOf(input) === '/v1/rh-chain') return json(getRhChainPayload());
      if (pathOf(input) === '/v1/rh-chain/review-queue') return json(reviewQueue);
      if (pathOf(input) === '/v1/rh-chain/4663-index') return json(getRhChain4663Index());
      if (pathOf(input) === '/v1/rh-chain/daily-receipts') return json(getRhChainDailyReceipts());
      if (pathOf(input) === '/v1/rh-chain/live-snapshot') return json({ title: 'RH Chain Live Snapshot', generated_at: '2026-07-11T00:00:00.000Z', live_snapshots_enabled: false, chain_metrics: { tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null, freshness: 'seeded' }, meme_category: { market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'seeded' }, provider_statuses: ['DefiLlama', 'CoinGecko', 'DexScreener', 'Blockscout'].map((provider_name) => ({ provider_name, status: 'disabled', fetched_at: null, expires_at: null, error_summary: 'Live snapshots are disabled.' })), cache_status: 'disabled', disclaimer: 'Live Snapshot data is external, cached, and informational. It is not an endorsement, listing, partnership, trading signal, or financial recommendation.' });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the desk with a compact Review Queue preview and CTA', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk');

    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Signal Desk');
    expect(text).toContain('Daily RH Chain Receipts');
    expect(text).toContain('The market forgets. Infopunks keeps the memory.');
    expect(text).toContain('Route language leads the desk, but receipts remain thin.');
    expect(Array.from(container.querySelectorAll('a[href="/rh-chain-signal-desk/daily-receipts"]')).some((link) => link.textContent?.includes('Daily Receipts') || link.textContent?.includes('Open Daily Receipts'))).toBe(true);
    expect(text).toContain('4663 Signal Index');
    expect(text).toContain('A living index of Robinhood Chain attention assets, risk states, and narrative mutations.');
    expect(text).toContain('Active speculation with usable desk memory. External receipts still required.');
    expect(Array.from(container.querySelectorAll('a[href="/rh-chain-signal-desk/4663-index"]')).some((link) => link.textContent?.includes('Open 4663 Index'))).toBe(true);
    expect(text).toContain('Review Queue');
    expect(text).toContain('Signals enter public review before promotion.');
    expect(text).toContain('Queued for manual review. Ticker familiarity is not evidence.');
    expect(Array.from(container.querySelectorAll('a[href="/rh-chain-signal-desk/review-queue"]')).some((link) => link.textContent?.includes('View Review Queue'))).toBe(true);
  });

  it('renders the 4663 Signal Index route with overview, ranking, scores, and disclaimer', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/4663-index');

    const text = container.textContent ?? '';
    expect(text).toContain('4663 Signal Index');
    expect(text).toContain('Wall Street rails. Meme liquidity. Ranked by receipts.');
    expect(text).toContain('Index Overview');
    expect(text).toContain('Ranked Index Table');
    expect(text).toContain('Score Breakdown');
    expect(text).toContain('Narrative Classes');
    expect(text).toContain('Methodology');
    expect(text).toContain('ROUTE');
    expect(text).toContain('active speculation');
    expect(text).toContain('deployer_cluster_risk');
    expect(text).toContain('The 4663 Signal Index is an intelligence index, not a tokenized product, endorsement, listing, or financial recommendation.');
    expect(Array.from(container.querySelectorAll('a[href="/v1/rh-chain/4663-index"]')).some((link) => link.textContent?.includes('Index JSON'))).toBe(true);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/4663-index"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Daily RH Chain Receipts route with latest receipt, timeline, watchlist, and sources', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/daily-receipts');

    const text = container.textContent ?? '';
    expect(text).toContain('Daily RH Chain Receipts');
    expect(text).toContain('The market forgets. Infopunks keeps the memory.');
    expect(text).toContain('Latest Receipt');
    expect(text).toContain('Route language leads the desk, but receipts remain thin.');
    expect(text).toContain('Receipt Timeline');
    expect(text).toContain('Watchlist');
    expect(text).toContain('Do Not Touch Yet');
    expect(text).toContain('Source Notes');
    expect(text).toContain('Public memory is forming. Do not upgrade attention into conviction until receipts survive liquidity, holder, and deployer checks.');
    expect(text).toContain('Infopunks RH Chain Signal Desk seed');
    expect(text).toContain('Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.');
    expect(Array.from(container.querySelectorAll('a[href="/v1/rh-chain/daily-receipts"]')).some((link) => link.textContent?.includes('Feed JSON'))).toBe(true);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/daily-receipts"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the public Review Queue route with grouped states and disclaimer', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/review-queue');

    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Review Queue');
    expect(text).toContain('Signals enter the desk. Receipts decide what survives.');
    expect(text).toContain('Status Overview');
    expect(text).toContain('Queue Board');
    expect(text).toContain('Approved signal for desk indexing only. This does not mean safe to buy.');
    expect(text).toContain('The review queue is public intelligence infrastructure. It is not an endorsement, listing, partnership, or financial recommendation.');
    expect(container.querySelector('a[href="/v1/rh-chain/review-queue"]')?.textContent).toContain('Queue');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/review-queue"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('labels persisted community submissions in the public queue', async () => {
    const submission = createRhChainSignalSubmission({
      token_contract: '0xcommunity', ticker: 'vault', chain: 'Robinhood Chain', website_link: 'https://example.com', disclosure_confirmed: true
    }, '2026-07-11T10:00:00.000Z');
    const item = asRhChainPersistedReviewItem(submission);
    reviewQueue = {
      ...reviewQueue,
      items: [...reviewQueue.items, item],
      grouped: { ...reviewQueue.grouped, queued_for_manual_review: [...reviewQueue.grouped.queued_for_manual_review, item] },
      counts: { ...reviewQueue.counts, queued: reviewQueue.counts.queued + 1 },
      data_mode: 'persisted', persisted_submission_count: 1
    };
    root = await renderPath(container, '/rh-chain-signal-desk/review-queue');
    expect(container.textContent).toContain('Community submission');
    expect(container.textContent).toContain('VAULT');
  });

  it('renders the Live Snapshot provider status route', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/live-snapshot');
    expect(container.textContent).toContain('RH Chain Live Snapshot');
    expect(container.textContent).toContain('Provider Status');
    expect(container.textContent).toContain('DefiLlama');
    expect(container.textContent).toContain('Live Snapshot data is external, cached, and informational.');
  });
});
