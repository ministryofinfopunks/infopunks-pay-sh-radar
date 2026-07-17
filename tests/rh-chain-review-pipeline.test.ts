import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot } from '../src/providers/dexscreenerProvider';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const DUPLICATE = '0x2222222222222222222222222222222222222222';
function snapshot(tokenAddress: string): RhChainMarketSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: '2026-07-17T00:00:00.000Z', tokenAddress, pairAddress: `pair-${tokenAddress.slice(2, 6)}`, dexId: 'desk', priceUsd: null, liquidityUsd: 1200, marketCap: null, fdv: null, volume: { h24: 450 }, txns: { h24: { buys: 0, sells: 0 } }, priceChange: { h1: null, h6: null, h24: null }, pairCreatedAt: null, activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: 'https://dexscreener.example/pair' };
}
const provider: RhChainDexScreenerIngestionSource = {
  getLatestTokenProfiles: async () => [{ tokenAddress: CONTRACT, name: 'Evidence token', symbol: 'SAME' }, { tokenAddress: DUPLICATE, name: 'Other exact contract', symbol: 'SAME' }], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [],
  getLatestBoosts: async () => [{ tokenAddress: CONTRACT, chainId: 'robinhood', amount: 2, totalAmount: 2, observed_at: '2026-07-17T00:00:00.000Z', sourceUrl: null }], getTopBoosts: async () => [], getPaidOrders: async () => [],
  getTokenPairs: async (contract) => [snapshot(contract)], getTokenBatch: async (contracts) => Object.fromEntries(contracts.map((contract) => [contract.toLowerCase(), [snapshot(contract)]])), getPair: async () => null
};
async function app() { return createApp(emptyIntelligenceStore(), undefined, { rhChainMarketDataOptions: { provider, enabled: true }, rhChainTokenRegistryOptions: { enabled: false }, rhChainMarketSnapshotOptions: { enabled: false } }); }

describe('RH Chain Review Pipeline', () => {
  it('accepts discovery items as source-required exact-contract review records and preserves duplicate warnings', async () => {
    const server = await app();
    try {
      const response = await server.inject({ method: 'GET', url: '/v1/rh-chain/review-pipeline' });
      const item = response.json().data.items.find((entry: { contract: string }) => entry.contract === CONTRACT.toLowerCase());
      expect(item).toEqual(expect.objectContaining({ review_state: 'source_required', contract: CONTRACT.toLowerCase(), reviewer_attribution: 'Signal Desk', attention_quality_state: 'source_required' }));
      expect(item.duplicate_ticker_contracts).toContain(DUPLICATE.toLowerCase());
      const tickerOnly = await server.inject({ method: 'POST', url: '/v1/rh-chain/review-pipeline/SAME/promote-to-market-structure' });
      expect(tickerOnly.statusCode).toBe(400);
      expect(tickerOnly.json().error).toBe('exact_contract_required');
    } finally { await server.close(); }
  });

  it('creates candidate-only promotions with source caveats and an unpublished Daily Receipt draft', async () => {
    const server = await app();
    try {
      await server.inject({ method: 'GET', url: '/v1/rh-chain/review-pipeline' });
      const promoted = await server.inject({ method: 'POST', url: `/v1/rh-chain/review-pipeline/${CONTRACT}/promote-to-market-structure`, payload: { market_structure_layer: 'infrastructure' } });
      expect(promoted.json().data.item).toEqual(expect.objectContaining({ review_state: 'promoted_to_market_structure', market_structure_layer: 'infrastructure' }));
      expect(promoted.json().data.item.missing_evidence.length).toBeGreaterThan(0);
      expect(promoted.json().data.item.caveats.length).toBeGreaterThan(0);
      expect(promoted.json().data.item.review_state).not.toBe('approved_signal');
      const receiptCandidate = await server.inject({ method: 'POST', url: `/v1/rh-chain/review-pipeline/${CONTRACT}/promote-to-100-receipts` });
      expect(receiptCandidate.json().data.item.review_state).toBe('promoted_to_100_receipts_candidate');
      const draft = await server.inject({ method: 'POST', url: `/v1/rh-chain/review-pipeline/${CONTRACT}/add-to-daily-draft` });
      expect(draft.json().data.daily_receipt_draft).toEqual(expect.objectContaining({ status: 'unpublished', contracts: [CONTRACT.toLowerCase()] }));
      expect(draft.json().data.item.review_state).toBe('added_to_daily_receipt_draft');
    } finally { await server.close(); }
  });

  it('schedules outcomes seven days after review and exposes daily state counts', async () => {
    const server = await app();
    try {
      await server.inject({ method: 'POST', url: '/v1/rh-chain/review-pipeline/start-daily-review', payload: { day: '2026-07-17' } });
      const scheduled = await server.inject({ method: 'POST', url: `/v1/rh-chain/review-pipeline/${CONTRACT}/set-outcome-check` });
      const item = scheduled.json().data.item;
      expect(Date.parse(item.outcome_check_at) - Date.parse(item.reviewed_at)).toBe(7 * 24 * 60 * 60 * 1000);
      await server.inject({ method: 'POST', url: `/v1/rh-chain/review-pipeline/${DUPLICATE}/watch` });
      const summary = await server.inject({ method: 'GET', url: '/v1/rh-chain/review-pipeline/daily-summary?day=2026-07-17' });
      expect(summary.json().data).toEqual(expect.objectContaining({ reviewed_count: 2, watch_only_count: 1, paid_attention_detected: true, duplicate_ticker_warnings: expect.any(Array), suggested_daily_receipt_headline: expect.any(String) }));
    } finally { await server.close(); }
  });
});
