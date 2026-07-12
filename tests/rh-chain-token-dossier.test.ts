import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRhChainSubmissionStore, createRhChainSignalSubmission } from '../src/services/rhChainSignalVault';

describe('RH Chain Token Dossier', () => {
  it('serves exact-contract memory and external context without treating it as approval', async () => {
    const submissions = new InMemoryRhChainSubmissionStore();
    await submissions.save(createRhChainSignalSubmission({ token_contract: '0xdossier', ticker: 'file', disclosure_confirmed: true, launch_source: 'uniswap_direct_pool', pair_address: 'pair-dossier' }, '2026-07-12T00:00:00.000Z', 'community_submission'));
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: submissions, rhChainLiveSnapshotOptions: { enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => ({ market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: '2026-07-12T00:00:00.000Z' }),
      tokenPair: async () => ({ pair_address: 'pair-dossier', dex_url: 'https://dexscreener.example/pair-dossier', liquidity_usd: 21, volume_24h_usd: 8, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: '2026-07-12T00:00:00.000Z' }),
      explorer: async () => ({ explorer_url: 'https://explorer.example/address/0xdossier', contract_verified: null, deployer_address: '0xdeployer', source_timestamp: '2026-07-12T00:00:00.000Z' })
    } } });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/0xdossier/dossier' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({
        contract: '0xdossier', ticker: 'FILE', review_status: 'queued_for_manual_review',
        external_context: expect.objectContaining({ token_pair: expect.objectContaining({ pair_address: 'pair-dossier' }), explorer: expect.objectContaining({ deployer_address: '0xdeployer' }) }),
        launch_context: expect.objectContaining({ launch_source: 'uniswap_direct_pool' }),
        disclaimer: expect.stringContaining('not endorsement')
      }) }));
    } finally { await app.close(); }
  });

  it('does not infer a dossier identity for an unknown contract', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/0xnotfound/dossier' });
      expect(response.json().data).toEqual(expect.objectContaining({ ticker: null, review_status: 'not_found', risk_state: 'source_required' }));
    } finally { await app.close(); }
  });

  it('does not infer ticker, review status, or index identity from provider context', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainLiveSnapshotOptions: { enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => ({ market_cap_usd: 1, volume_24h_usd: 1, top_assets: [{ name: 'Ticker-looking token', symbol: 'CASHCAT', market_cap_usd: 1, volume_24h_usd: 1 }], source_timestamp: '2026-07-12T00:00:00.000Z' }),
      tokenPair: async () => ({ observed_contract: '0xdifferent', pair_address: 'pair-other', dex_url: 'https://dexscreener.example/pair-other', liquidity_usd: 1, volume_24h_usd: 1, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: '2026-07-12T00:00:00.000Z' }),
      explorer: async () => ({ observed_contract: '0xdifferent', explorer_url: 'https://explorer.example/address/0xdifferent', contract_verified: true, deployer_address: '0xdeployer', source_timestamp: '2026-07-12T00:00:00.000Z' })
    } } });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/0xunknown/dossier' });
      expect(response.json().data).toEqual(expect.objectContaining({ ticker: null, review_status: 'not_found', risk_state: 'source_required', memory: expect.objectContaining({ index: null }) }));
      expect(response.json().data.external_context.token_pair).toEqual(expect.objectContaining({ exact_contract_match: false }));
    } finally { await app.close(); }
  });
});
