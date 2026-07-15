// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainLaunchSurfaces, getRhChainPayload, getRhChainReviewQueue } from '../src/data/rhChain';
import { assembleRhChainMemePulseScreen } from '../src/services/rhChainMemePulseService';
import { assembleRhChainTokenDossier } from '../src/services/rhChainTokenDossierService';
import { assembleRhChainCloneRadar } from '../src/services/rhChainCloneRadarService';
import { assembleRhChainLaunchpadObservatory } from '../src/services/rhChainLaunchpadObservatoryService';
import { assembleRhChainScouts } from '../src/services/rhChainScoutsService';
import { assembleRhChainDistributionPack } from '../src/services/rhChainDistributionPackService';
import { assembleRhChainReceiptRelay } from '../src/services/rhChainReceiptRelayService';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { asRhChainPersistedReviewItem, createRhChainSignalSubmission } from '../src/services/rhChainSignalVault';
import { App } from '../src/web/main';

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify(buildRhChainApiResponse(data)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
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
    await vi.dynamicImportSettled();
    await Promise.resolve();
  });
  return root;
}

describe('RH Chain Signal Desk pages', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  let reviewQueue = getRhChainReviewQueue();
  let desk = getRhChainPayload();
  let reviewQueueFails = false;

  beforeEach(() => {
    container = document.createElement('div');
    reviewQueue = getRhChainReviewQueue();
    desk = getRhChainPayload();
    reviewQueueFails = false;
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (pathOf(input) === '/v1/rh-chain') return json(desk);
      if (pathOf(input) === '/v1/rh-chain/review-queue') {
        if (reviewQueueFails) return Promise.resolve(new Response(JSON.stringify({ error: 'review_queue_unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json', 'x-request-id': 'request-rh-review-500' } }));
        return json(reviewQueue);
      }
      if (pathOf(input) === '/v1/rh-chain/4663-index') return json(getRhChain4663Index());
      if (pathOf(input) === '/v1/rh-chain/daily-receipts') return json(getRhChainDailyReceipts());
      if (pathOf(input) === '/v1/rh-chain/launch-surfaces') return json(getRhChainLaunchSurfaces());
      if (pathOf(input) === '/v1/rh-chain/live-snapshot') return json({ title: 'RH Chain Live Snapshot', generated_at: '2026-07-11T00:00:00.000Z', live_snapshots_enabled: false, chain_metrics: { tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null, freshness: 'seeded' }, meme_category: { market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'seeded' }, provider_statuses: ['DefiLlama', 'CoinGecko', 'DexScreener', 'Blockscout'].map((provider_name) => ({ provider_name, status: 'disabled', fetched_at: null, expires_at: null, error_summary: 'Live snapshots are disabled.' })), cache_status: 'disabled', disclaimer: 'Live Snapshot data is external, cached, and informational. It is not an endorsement, listing, partnership, trading signal, or financial recommendation.' });
      if (pathOf(input) === '/v1/rh-chain/meme-pulse') return json(assembleRhChainMemePulseScreen());
      if (pathOf(input) === '/v1/rh-chain/tokens/0xabc/dossier') return json(assembleRhChainTokenDossier('0xabc', [], { contract: '0xabc', token_pair: null, explorer: null, provider_statuses: [], cache_status: 'disabled', generated_at: '2026-07-12T00:00:00.000Z', live_snapshots_enabled: false, judgment_policy: 'External data gives context.', disclaimer: 'context' }, { title: 'RH Chain Live Snapshot', generated_at: '2026-07-12T00:00:00.000Z', live_snapshots_enabled: false, judgment_policy: 'External data gives context.', chain_metrics: { tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null, freshness: 'seeded' }, meme_category: { market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'seeded' }, provider_statuses: [], cache_status: 'disabled', disclaimer: 'context' }));
      if (pathOf(input) === '/v1/rh-chain/clone-radar') return json(assembleRhChainCloneRadar());
      if (pathOf(input) === '/v1/rh-chain/launchpad-observatory') return json(assembleRhChainLaunchpadObservatory());
      if (pathOf(input) === '/v1/rh-chain/scouts') return json(assembleRhChainScouts([]));
      if (pathOf(input) === '/v1/rh-chain/distribution-pack') return json(assembleRhChainDistributionPack());
      if (pathOf(input) === '/v1/rh-chain/receipt-relay') return json(assembleRhChainReceiptRelay());
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.pushState({}, '', '/');
  });

  it('renders the desk with a compact Review Queue preview and CTA', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk');

    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Signal Desk');
    expect(container.querySelector('a[aria-label="Infopunks Radar home"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Robinhood Chain network. Switch Radar network"]')).not.toBeNull();
    expect(container.querySelector('a[href="/rh-chain-signal-desk"][aria-current="page"]')).not.toBeNull();
    expect(text).toContain('Daily RH Chain Receipts');
    expect(text).toContain('The market forgets. Infopunks keeps the memory.');
    expect(text).toContain('RH Chain survives NOXA stress as launchpad competition fragments the meme layer');
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

  it('isolates a review queue 500 behind a compact module notice and opt-in diagnostics', async () => {
    reviewQueueFails = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    root = await renderPath(container, '/rh-chain-signal-desk');

    const standardText = container.textContent ?? '';
    expect(standardText).toContain('RH Chain Signal Desk');
    expect(standardText).toContain('Chain Pulse');
    expect(standardText).toContain('Review queue temporarily unavailable.');
    expect(standardText).toContain('Other Signal Desk intelligence remains accessible.');
    expect(container.querySelector('.rh-chain-module-notice')).not.toBeNull();
    expect(container.querySelector('.rh-chain-state-unavailable')).toBeNull();
    expect(standardText).not.toContain('/v1/rh-chain/review-queue');
    expect(standardText).not.toContain('request-rh-review-500');

    const detailsButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Technical details');
    await act(async () => detailsButton?.click());
    const diagnosticText = container.textContent ?? '';
    expect(diagnosticText).toContain('/v1/rh-chain/review-queue');
    expect(diagnosticText).toContain('HTTP status500');
    expect(diagnosticText).toContain('request-rh-review-500');
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps the Review Queue route hero available when its optional request fails', async () => {
    reviewQueueFails = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    root = await renderPath(container, '/rh-chain-signal-desk/review-queue');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Review Queue');
    expect(text).toContain('Signals enter the desk. Receipts decide what survives.');
    expect(text).toContain('Review queue temporarily unavailable.');
    expect(text).not.toContain('/v1/rh-chain/review-queue');
    expect(text).not.toContain('Queue Board');
  });

  it('shows manual snapshot observation time, relative age, and stale status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    root = await renderPath(container, '/rh-chain-signal-desk');
    const text = container.textContent ?? '';
    expect(text).toContain('Manual snapshot');
    expect(text).toContain('ObservedJul 9, 2026, 3:45 AM UTC');
    expect(text).toContain('Updated 6 days ago');
    expect(text).toContain('StatusStale');
  });

  it('renders the Chain Pulse source timestamp and calm stale banner', async () => {
    const source = desk.chain_pulse.metrics[0].source;
    desk = {
      ...desk,
      chain_pulse: {
        ...desk.chain_pulse,
        observed_at: '2026-07-15T09:58:00.000Z',
        fetched_at: '2026-07-15T10:00:00.000Z',
        freshness_state: 'stale',
        metrics: [{ ...desk.chain_pulse.metrics[0], value: '$1,000,000', source: { ...source, observed_at: '2026-07-15T09:58:00.000Z', updated_at: '2026-07-15T10:00:00.000Z', data_mode: 'cached' } }]
      }
    };
    root = await renderPath(container, '/rh-chain-signal-desk');
    const text = container.textContent ?? '';
    expect(text).toContain('Chain metrics are stale context. Review the timestamp before using them.');
    expect(text).toContain('Updated 2026-07-15 10:00');
    expect(text).toContain('observed_at: 2026-07-15 09:58');
  });

  it('renders cached chain and fee context with compact scoped provenance', async () => {
    const source = { ...desk.chain_pulse.metrics[0].source, source_name: 'DefiLlama chain metrics snapshot', observed_at: '2026-07-15T09:58:00.000Z', updated_at: '2026-07-15T10:00:00.000Z', data_mode: 'cached' as const, confidence_level: 'medium' as const };
    desk = { ...desk, chain_pulse: { ...desk.chain_pulse, observed_at: source.observed_at, fetched_at: source.updated_at, freshness_state: 'fresh', data_mode: 'cached', confidence_level: 'medium', source_notes: ['Provider context is informational.'], metrics: [
      { id: 'tvl', label: 'TVL', value: '$1,000,000', state: 'watching', note: 'DefiLlama TVL context.', metric_scope: 'rh_chain', source },
      { id: 'fees_24h', label: 'Fees (24h)', value: '$1,200', state: 'watching', note: 'DefiLlama fee context.', metric_scope: 'rh_chain', source }
    ], top_protocols: [{ name: 'Global giant', category: 'dex', value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required', display_note: 'Chain-specific protocol TVL not verified.', status: 'source required', note: 'Chain-specific protocol TVL not verified.', source }] } };
    root = await renderPath(container, '/rh-chain-signal-desk');
    const text = container.textContent ?? '';
    expect(text).toContain('$1,000,000');
    expect(text).toContain('$1,200');
    expect(text).toContain('source_required');
    expect(text).not.toContain('Global giant$');
    expect(container.querySelectorAll('[aria-label="Metric provenance footer"]').length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('DefiLlama chain metrics snapshot·observed_at:');
    expect(text).toContain('Provider context is informational and cannot change review, receipt, or index decisions.');
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
    expect(text).toContain('Manual index values require refresh.');
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
    expect(text).toContain('Daily Receipt #003');
    expect(text).toContain('RH Chain survives NOXA stress as launchpad competition fragments the meme layer');
    expect(text).toContain('Chain Pulse');
    expect(text).toContain('Meme Pulse');
    expect(text).toContain('Launch + Access Surface Mutation');
    expect(text).toContain('Launchpad Stress Test');
    expect(text).toContain('Risk Wall');
    expect(text).toContain('Narrative Mutation');
    expect(text).toContain('Infopunks Verdict');
    expect(text).toContain('Copy receipt summary');
    expect(text).toContain('Receipt Timeline');
    expect(text).toContain('Watchlist');
    expect(text).toContain('Do Not Touch Yet');
    expect(text).toContain('Source Notes');
    expect(text).toContain('The launchpad layer is fragmenting. The chain did not break. The memory layer becomes more important.');
    expect(text).toContain('source_required');
    expect(text).toContain('Infopunks manual RH Chain NOXA stress watch');
    expect(text).toContain('Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.');
    expect(Array.from(container.querySelectorAll('a[href="/v1/rh-chain/daily-receipts"]')).some((link) => link.textContent?.includes('Feed JSON'))).toBe(true);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/daily-receipts"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the receipt detail and screenshot-ready share card routes', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/daily-receipts/rh_daily_003');

    let text = container.textContent ?? '';
    expect(text).toContain('Daily RH Chain Receipt #003');
    expect(text).toContain('View share card');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/daily-receipts/rh_daily_003/card"]')).not.toBeNull();

    act(() => root?.unmount());
    root = await renderPath(container, '/rh-chain-signal-desk/daily-receipts/rh_daily_003/card');
    text = container.textContent ?? '';
    expect(text).toContain('RH Chain Receipt Card');
    expect(text).toContain('INFOPUNKS');
    expect(text).toContain('Receipt #003');
    expect(text).toContain('RH Chain meme activity stayed resilient despite NOXA downtime and launch restrictions');
    expect(text).toContain('The launchpad layer is fragmenting. The chain did not break. The memory layer becomes more important.');
    expect(text).toContain('Public intelligence, not endorsement.');
    expect(text).toContain('No receipt, no signal.');
    expect(text).toContain('Copy X post');
  });

  it('keeps Daily Receipt #001 available as prior market memory', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/daily-receipts/rh_daily_001');
    expect(container.textContent).toContain('Daily RH Chain Receipt #001');
    expect(container.textContent).toContain('RH Chain meme volume stays dominant while RWA rails mature underneath');
  });

  it('shows a clean not-found state for an unknown daily receipt route', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/daily-receipts/not-real');
    expect(container.textContent).toContain('Receipt not found');
    expect(container.textContent).toContain('No Daily RH Chain Receipt matches “not-real”.');
  });

  it('renders Launch Surface Watch with known surfaces and evidence doctrine', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/launch-surfaces');
    const text = container.textContent ?? '';
    expect(text).toContain('Launch Surface Watch');
    expect(text).toContain('Infopunks does not launch the token. Infopunks remembers the launch.');
    expect(text).toContain('NOXA Fun');
    expect(text).toContain('Launch surface status:');
    expect(text).toContain('degraded');
    expect(text).toContain('20lab-generated ERC-20');
    expect(text).toContain('Claims are not receipts');
    expect(text).toContain('External data gives context. Infopunks gives judgment. Receipts create memory.');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/launch-surfaces"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the read-only Scout page', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/scout');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Scout Agent');
    expect(text).toContain('Reads the desk. Remembers the receipts. Never trades.');
    expect(text).toContain('What changed in the last 24h?');
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

  it('renders the public Meme Pulse surface and its safety doctrine', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/meme-pulse');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Meme Pulse');
    expect(text).toContain('What’s moving. What’s risky. What the market is trying to say.');
    expect(text).toContain('Top Attention Assets');
    expect(text).toContain('Risk Strip');
    expect(text).toContain('Launchpad Stress');
    expect(text).toContain('Meme → Market Translation');
    expect(text).toContain('External data gives context. Infopunks gives judgment. Receipts create memory.');
    expect(text).toContain('Source policy');
    expect(text).toContain('Source mode');
    expect(text).toContain('Status');
    expect(container.querySelector('.rh-chain-primary-actions .execute')?.textContent).toContain('Read attention assets');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/meme-pulse"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders a clean exact-contract token dossier', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/tokens/0xabc');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain token dossier');
    expect(text).toContain('What the desk remembers');
    expect(text).toContain('Provider context, never a verdict');
    expect(text).toContain('Claims stay claims until receipted');
    expect(text).toContain('Evidence before narrative.');
    expect(text).toContain('Dossier inclusion is public intelligence memory, not endorsement');
  });

  it('renders Clone Radar with cautious risk framing', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/clone-radar');
    const text = container.textContent ?? '';
    expect(text).toContain('Clone & Impersonator Radar');
    expect(text).toContain('The market moves fast. The copies move faster.');
    expect(text).toContain('Active Warnings');
    expect(text).toContain('Duplicate Ticker Watch');
    expect(text).toContain('How Infopunks Flags Risk');
    expect(text).toContain('Launchpad displacement risk');
    expect(text).toContain('Vampire / Rug Pattern Watch');
    expect(text).toContain('Suspicion is a prompt to review, not a verdict.');
    expect(text).toContain('Suspected patterns. Receipts required.');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/clone-radar"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Clone Radar pattern-watch route with amber review framing', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/risk-patterns');
    const text = container.textContent ?? '';
    expect(text).toContain('Vampire / Rug Pattern Watch');
    expect(text).toContain('requires review');
    expect(text).toContain('Submit risk evidence');
    expect(text).not.toMatch(/\b(is a scam|proven fraud|fraudulent)\b/i);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/risk-patterns"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders the post-NOXA Launchpad Observatory without launch or trading calls to action', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/launchpad-observatory');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Launchpad Observatory');
    expect(text).toContain('Where tokens start. Where claims break. Where receipts matter.');
    expect(text).toContain('Surface Health Board');
    expect(text).toContain('Post-NOXA Stress Map');
    expect(text).toContain('Claim Ledger');
    expect(text).toContain('source required');
    expect(text).toContain('Pons');
    expect(text).toContain('flap.sh');
    expect(text).toContain('View Daily Receipt #003');
    expect(text).not.toMatch(/\b(buy|sell|snipe|launch[- ]now)\b/i);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/launchpad-observatory"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders Access Surface Watch as context without trading or bridge CTAs', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/launch-surfaces');
    const text = container.textContent ?? '';
    expect(text).toContain('Access Surface Watch');
    expect(text).toContain('Launch surfaces show where tokens start. Access surfaces show how users arrive.');
    expect(text).toContain('Backpack Wallet');
    expect(text).toContain('source_required');
    expect(text).toContain('Access does not equal legitimacy.');
    expect(Array.from(container.querySelectorAll('a')).some((link) => /trade|bridge/i.test(link.textContent ?? ''))).toBe(false);
  });

  it('renders the consent-aware Signal Scouts board', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/scouts');
    const text = container.textContent ?? '';
    expect(text).toContain('Signal Scouts');
    expect(text).toContain('The market forgets. Scouts bring receipts.');
    expect(text).toContain('Scout Roles');
    expect(text).toContain('Public Scout Board');
    expect(text).toContain('Consented attribution only');
    expect(text).toContain('No rewards. No raids. Just better memory.');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/scouts"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('renders copy-ready Distribution Pack cards with anti-spam guardrails', async () => {
    root = await renderPath(container, '/rh-chain-signal-desk/distribution-pack');
    const text = container.textContent ?? '';
    expect(text).toContain('RH Chain Distribution Pack');
    expect(text).toContain('Daily Receipt post');
    expect(text).toContain('Clone Radar warning post');
    expect(text).toContain('Token Dossier share post');
    expect(text).toContain('Receipt Relay');
    expect(text).toContain('Bot-friendly packets. Caveat attached.');
    expect(text).toContain('Copy x');
    expect(text).toContain('Copy telegram');
    expect(text).toContain('Copy discord');
    expect(text).toContain('Do not spam. Do not coordinate raids.');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/distribution-pack"]')?.getAttribute('aria-current')).toBe('page');
  });
});
