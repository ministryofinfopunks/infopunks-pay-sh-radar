// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { App } from '../src/web/main';

const CAPTURED_AT = '2026-07-19T12:00:00.000Z';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    category: 'agent_x_defi', chain: 'robinhood', contract: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Exact Agent', ticker: 'AGENT', dexscreener_pair: null,
    primary_layer: 'agent', secondary_layers: ['defi'], explanation: 'Primary documentation ties the exact contract to agent execution and DeFi settlement.', evidence_state: 'approved', attention_quality_state: 'source_required', missing_evidence: [], caveat: null,
    classification_confidence: 'high', classification_evidence_summary: ['Project documentation: Exact-contract documentation supports both reviewed layers.'], classification_version: 2, classification_source: 'durable_reviewed_classification', effective_at: CAPTURED_AT, reviewed_at: CAPTURED_AT, market_data_timestamp: CAPTURED_AT, freshness: 'fresh', conflict_state: 'none', warnings: [],
    market_data: { available: true, canonical_pair: { pair_address: '0xpair' }, dex: 'uniswap', price_usd: 1.25, liquidity_usd: 2500, market_cap_usd: 25000, volume: { h24: 9000, h6: 3000, h1: 500 }, transactions: { h24: { buys: 18, sells: 11 } }, pair_age_days: 18, active_boosts: 0, paid_order_context: { types: [], statuses: [] }, snapshot_timestamp: CAPTURED_AT, freshness: 'fresh', provider: 'dexscreener', source_url: null },
    ...overrides
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Cross-Layer Assets', integration_enabled: true, headline: 'Agent × DeFi is the clearest reviewed intersection in the bounded set.', interpretation: { method: 'cross_layer_intersections_v1', deterministic: true }, observation_window: { label: 'Latest persisted market snapshots', captured_at: CAPTURED_AT }, entries: [entry(), entry({ contract: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', category: 'meme_x_rwa', display_name: 'Evidence Pending Market', primary_layer: 'meme', secondary_layers: ['rwa'], classification_confidence: 'medium', freshness: 'unavailable', market_data_timestamp: null, market_data: { available: false, canonical_pair: null, dex: null, price_usd: null, liquidity_usd: null, market_cap_usd: null, volume: { h24: null, h6: null, h1: null }, transactions: { h24: { buys: null, sells: null } }, pair_age_days: null, active_boosts: null, paid_order_context: { types: [], statuses: [] }, snapshot_timestamp: null, freshness: 'unavailable', provider: 'dexscreener', source_url: null }, warnings: ['Persisted market data is unavailable for this reviewed exact contract.'] })],
    categories: ['agent_x_defi', 'meme_x_rwa'], intersection_count: 2, reviewed_project_count: 2, intersection_counts: [{ category: 'agent_x_defi', project_count: 1 }, { category: 'meme_x_rwa', project_count: 1 }], layer_pair_counts: [], tracked_liquidity_by_intersection: [], tracked_volume_by_intersection: [], concentration: { top_three_liquidity_share: 100, top_three_volume_share: 100, scope: 'bounded' }, classification_coverage: { reviewed_exact_contracts: 3, cross_layer_eligible_exact_contracts: 2, unknown_exact_contracts: 1, percentage: 66.67, bounded_limit: 100, complete: true }, market_data_coverage: { eligible_exact_contracts: 2, with_persisted_market_data: 1, percentage: 50, provider_requests_in_path: 0 }, conflict_count: 0, source_required_count: 1, unknown_count: 1, captured_at: CAPTURED_AT, observed_at: CAPTURED_AT, freshness: 'partial', confidence: 'medium', warnings: ['One eligible intersection has no validated persisted market snapshot.'], provider_provenance: { provider: 'dexscreener', chain_id: 'robinhood', role: 'persisted_market_and_attention_context_only', external_requests_in_path: false, snapshot_count: 1 }, classification_provenance: { precedence: ['curated_reviewed_memory', 'durable_approved_reviewed_classification', 'provider_context', 'unknown'], curated_reviewed_records: 1, durable_approved_records: 2, exact_contract_only: true }, bounded_universe: 'This response covers at most 100 exact-contract reviewed records and their latest persisted snapshots. It is not complete Robinhood Chain accounting.', methodology_version: 'cross_layer_intersections_v1', caveats: ['Provider observations cannot create, promote, or approve an entry.'],
    ...overrides
  };
}

function json(data: unknown) { return Promise.resolve(new Response(JSON.stringify(buildRhChainApiResponse(data)), { status: 200, headers: { 'Content-Type': 'application/json' } })); }
async function renderPath(container: HTMLDivElement) { window.history.pushState({}, '', '/rh-chain-signal-desk/market-structure/cross-layer'); let root!: Root; await act(async () => { root = createRoot(container); root.render(<App />); }); await act(async () => { await vi.dynamicImportSettled(); await Promise.resolve(); }); return root; }

describe('Robinhood Chain Cross-Layer Intersections page', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(payload())); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });

  it('leads with one deterministic conclusion and evidence-first accessible states', async () => {
    root = await renderPath(container);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toContain('Agent × DeFi');
    expect(container.textContent).toContain('Proof before pattern');
    expect(container.textContent).toContain('Reviewed intersections with the clearest evidence');
    expect(container.textContent).toContain('Reviewed overlap with visible limits');
    expect(container.textContent).toContain('Market data unavailable');
    expect(container.querySelector('[role="status"][aria-label="Cross-Layer data quality"]')?.textContent).toContain('Some reviewed intersections lack current market context');
    expect(container.querySelector('nav[aria-label="Intersection categories"] a[href^="#intersection-agent_x_defi-"]')).not.toBeNull();
    expect(container.querySelector('details summary')?.textContent).toContain('data warning');
    expect(container.querySelector('[data-social-card="cross-layer"]')).not.toBeNull();
  });

  it('publishes canonical social metadata and copies measured insight', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    root = await renderPath(container);
    expect(document.title).toBe('Cross-Layer Intersections | Infopunks Radar');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://radar.infopunks.fun/rh-chain-signal-desk/market-structure/cross-layer');
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content).toBe('https://radar.infopunks.fun/og/rh-chain/cross-layer.png');
    await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Copy Cross-Layer insight"]')!.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('2 eligible exact-contract projects'));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Insight copied');
  });

  it('keeps share actions touch-ready at a mobile viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    root = await renderPath(container);
    expect(container.querySelector('.cross-layer-actions')?.querySelectorAll('button, a')).toHaveLength(3);
    expect(container.querySelector('button[aria-label="Share Cross-Layer insight"]')).not.toBeNull();
  });

  it('renders a restrained loading state with no fabricated market totals', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise<Response>(() => undefined));
    root = await renderPath(container);
    expect(container.querySelector('[role="status"][aria-busy="true"]')?.textContent).toContain('Loading Robinhood Chain Cross-Layer Intersections');
    expect(container.textContent).not.toContain('$0');
  });

  it('preserves the established Cross-Layer UI when the integration flag is absent', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => json({ title: 'Cross-Layer Assets', entries: [entry({ classification_confidence: undefined, market_data: undefined })], categories: ['agent_x_defi'], observed_at: CAPTURED_AT }));
    root = await renderPath(container);
    expect(container.querySelector('h1')?.textContent).toBe('Cross-Layer Assets');
    expect(container.textContent).toContain('Structural overlap is review-gated and exact-contract only.');
    expect(container.querySelector('.cross-layer-hero')).toBeNull();
  });
});
