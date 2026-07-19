// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { App } from '../src/web/main';

const CAPTURED_AT = '2026-07-19T12:00:00.000Z';

function metric(value: number | null, unit: 'usd' | 'count' | 'percent' | 'score', change: number | null = null) {
  return { value, previous_value: change === null || value === null ? null : value - change, absolute_change: change, percentage_change: change === null || value === null || value === change ? null : Number((change / (value - change) * 100).toFixed(2)), unit, provenance: ['dexscreener:robinhood'], captured_at: CAPTURED_AT, freshness: 'partial', confidence: 'medium' };
}

function pulse(overrides: Record<string, unknown> = {}) {
  const layers = [
    ['meme', 'Memes', 60, 600], ['rwa', 'RWAs', 25, 900], ['agent', 'Agents', 10, 200],
    ['infrastructure', 'Infrastructure', 5, 150], ['defi', 'DeFi', 0, 0], ['unknown', 'Unknown', 0, 0]
  ].map(([layer, label, share, liquidity]) => ({ layer, label, volume_24h: metric(Number(share) * 1_000, 'usd', Number(share) * 100), liquidity: metric(Number(liquidity), 'usd', layer === 'rwa' ? 120 : 0), transactions_24h: metric(Number(share), 'count'), active_tokens: metric(Number(share) > 0 ? 1 : 0, 'count'), volume_share: metric(Number(share), 'percent'), liquidity_share: metric(Number(liquidity) / 18.5, 'percent') }));
  return {
    title: 'Robinhood Chain Market Pulse',
    observation_window: { label: 'Rolling 24 hours', current: { started_at: '2026-07-18T12:00:00.000Z', ended_at: CAPTURED_AT }, previous: { started_at: '2026-07-17T12:00:00.000Z', ended_at: '2026-07-18T12:00:00.000Z' } },
    metrics: { tracked_volume_24h: metric(100_000, 'usd', 15_000), tracked_liquidity: metric(1_850, 'usd', 120), tracked_transactions_24h: metric(100, 'count', 12), active_tracked_tokens: metric(4, 'count', 1), newly_discovered_tokens: metric(1, 'count') },
    layer_composition: layers,
    momentum: {
      fastest_growing_layer: { subject: 'Memes', detail: '+$6,000 tracked 24h volume versus the previous observation window.', metric: metric(60_000, 'usd', 6_000) },
      largest_liquidity_increase: { subject: 'RWA asset', detail: 'Tracked liquidity changed +$120 versus the previous observation window.', metric: metric(900, 'usd', 120) },
      largest_volume_acceleration: null,
      strongest_post_boost_retention: { subject: 'Meme asset', detail: 'Retention is measured against the latest paid-attention observation.', metric: metric(91, 'score') },
      most_important_cross_layer_development: null
    },
    concentration: { top_three_volume_share: metric(95, 'percent'), top_three_liquidity_share: metric(92, 'percent'), leading_dex: { dex_id: 'uniswap', volume_share: metric(72, 'percent') }, unknown_volume_share: metric(0, 'percent') },
    interpretation: { headline: 'Meme attention leads, while RWA liquidity is gaining.', conclusion: 'Volume is rising faster than durable liquidity in the tracked set.', supporting: ['Paid promotion is increasing, while post-boost retention remains measurable.'], rules: ['dominant_layer_by_tracked_volume', 'volume_outpaces_liquidity'], method: 'deterministic_rules_v1', generated_at: CAPTURED_AT, freshness: 'partial', confidence: 'medium', provenance: ['dexscreener:robinhood'] },
    provider_provenance: { provider: 'dexscreener', chain_id: 'robinhood', role: 'market_and_attention_sensor', health: { state: 'degraded', healthy: false, degraded: true, activeCacheStatus: 'stale', currentFreshness: 'stale', lastSuccess: CAPTURED_AT, latestLatencyMs: 184 }, fallback_mode: false, caveats: ['Context only.'] },
    captured_at: CAPTURED_AT,
    freshness: 'partial', warnings: ['One tracked token has no current canonical-pair observation.'], confidence: 'medium', data_mode: 'live_cached',
    disclaimer: 'Public market-structure intelligence only. Not a complete chain index, endorsement, or investment recommendation.',
    ...overrides
  };
}

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify(buildRhChainApiResponse(data)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

async function renderPath(container: HTMLDivElement) {
  window.history.pushState({}, '', '/rh-chain-signal-desk/market');
  let root!: Root;
  await act(async () => { root = createRoot(container); root.render(<App />); });
  await act(async () => { await vi.dynamicImportSettled(); await Promise.resolve(); });
  return root;
}

describe('Robinhood Chain Market Pulse page', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(pulse()));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders one editorial conclusion before evidence with accessible data states', async () => {
    root = await renderPath(container);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe('Meme attention leads, while RWA liquidity is gaining.');
    expect(container.textContent).toContain('The tracked market, at a glance');
    expect(container.textContent).toContain('Where attention is accumulating');
    expect(container.textContent).toContain('What changed between windows');
    expect(container.textContent).toContain('How narrow is the tracked market?');
    expect(container.querySelector('[role="status"][aria-label="Market data quality"]')?.textContent).toContain('partial');
    expect(container.querySelector('svg[role="img"] title')?.textContent).toContain('volume composition');
    expect(container.querySelector('details summary')?.textContent).toContain('Source, freshness');
    expect(container.querySelector('[data-social-card="market-pulse"]')).not.toBeNull();
    expect(container.querySelector('a[href="/rh-chain-signal-desk/live-snapshot"]')).not.toBeNull();
    expect(container.querySelector('a[href="/rh-chain-signal-desk/market"][aria-current="page"]')).not.toBeNull();
  });

  it('publishes canonical Open Graph and X metadata and copies a measured insight', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    root = await renderPath(container);
    expect(document.title).toBe('Robinhood Chain Market Pulse | Infopunks Radar');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://radar.infopunks.fun/rh-chain-signal-desk/market');
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content).toBe('https://radar.infopunks.fun/og/rh-chain/market.png');
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content).toBe('summary_large_image');
    await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Copy Market Pulse insight"]')!.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Meme attention leads, while RWA liquidity is gaining.'));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Insight copied');
  });

  it('keeps its primary actions touch-ready at a mobile viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    root = await renderPath(container);
    const actions = container.querySelector('.market-pulse-actions');
    expect(actions?.querySelectorAll('button, a')).toHaveLength(3);
    expect(actions?.querySelector('button[aria-label="Share Market Pulse insight"]')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('renders a refined loading state without fake live values', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise<Response>(() => undefined));
    root = await renderPath(container);
    const loading = container.querySelector('[role="status"][aria-busy="true"]');
    expect(loading?.textContent).toContain('Loading Robinhood Chain Market Pulse');
    expect(container.textContent).not.toContain('$0');
  });

  it('renders a retryable unavailable state without exposing provider internals', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'market_pulse_temporarily_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', 'x-request-id': 'market-pulse-test' } }));
    root = await renderPath(container);
    expect(container.textContent).toContain('Market Pulse is temporarily unavailable');
    expect([...container.querySelectorAll('button')].some((button) => /retry/i.test(button.textContent ?? ''))).toBe(true);
    expect(container.textContent).not.toContain('DEX Screener exception');
  });
});
