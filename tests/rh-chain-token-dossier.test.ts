import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRhChainSubmissionStore, createRhChainSignalSubmission } from '../src/services/rhChainSignalVault';

describe('RH Chain Token Dossier', () => {
  const THE_INDEX = '0x56910D4409F3a0C78C64DD8D0545FF0705389870';

  it.each([THE_INDEX, THE_INDEX.toLowerCase()])('resolves The Index reviewed-intake dossier by exact contract (%s)', async (contract) => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: `/v1/rh-chain/tokens/${contract}/dossier` });
      const dossier = response.json().data;
      expect(dossier).toEqual(expect.objectContaining({
        contract: THE_INDEX,
        ticker: 'INDEX',
        name: 'The Index',
        review_status: 'under_receipt_check',
        risk_state: 'source_required',
        contract_intelligence: expect.objectContaining({ source: 'market_structure', claim_status: 'source_required_for_claims', display_name: 'The Index' }),
        memory: expect.objectContaining({ market_structure: expect.objectContaining({ primary_layer: 'rwa', secondary_layers: ['defi', 'speculative_distribution', 'tokenized_equities'], cross_layer_category: 'defi_x_rwa', evidence_state: 'under_receipt_check' }) })
      }));
      expect(dossier.review_status).not.toBe('approved_signal');
      expect(dossier.external_context.token_pair?.dex_url).toBe('https://dexscreener.com/robinhood/0x00dd2df2f17d431cf3a0938f06c9cf9abc5e9643b6cc466ca3f71f3af246edf3');
      expect(dossier.external_context.explorer?.explorer_url).toContain(THE_INDEX);
      expect(dossier.risk_notes.join(' ')).toMatch(/does not verify dividend mechanics, RWA backing, safety, or endorsement/i);
    } finally { await app.close(); }
  });

  it('keeps 100 Receipts memory exact-contract-only and leaves Benjamin’s Bread unknown', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      for (const ticker of ['CASHCAT', 'TENDIES', 'PONS', 'HOODRAT', 'ARROW']) {
        const receipt = (await import('../src/data/rhChain100Receipts')).getRhChain100ReceiptsCampaign().assets.find((item) => item.ticker === ticker)!;
        const response = await app.inject({ method: 'GET', url: `/v1/rh-chain/tokens/${receipt.contract}/dossier` });
        expect(response.json().data.memory.campaign_asset).toEqual(expect.objectContaining({ ticker }));
      }
      const benjamin = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/Benjamin%27s%20Bread/dossier' });
      expect(benjamin.json().data).toEqual(expect.objectContaining({ identity_status: 'source_required', ticker: null, review_status: 'not_found', risk_state: 'source_required' }));
    } finally { await app.close(); }
  });

  it('keeps provider-only and ticker-collision context out of reviewed memory', async () => {
    const contract = '0x1111111111111111111111111111111111111111';
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainLiveSnapshotOptions: { enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => ({ market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null }),
      tokenPair: async () => ({ observed_contract: contract, pair_address: 'provider-pair', dex_url: 'https://dexscreener.example/provider-pair', liquidity_usd: 1, volume_24h_usd: 1, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: '2026-07-17T00:00:00.000Z' }),
      explorer: async () => ({ observed_contract: contract, explorer_url: `https://explorer.example/token/${contract}`, contract_verified: null, deployer_address: null, source_timestamp: '2026-07-17T00:00:00.000Z' })
    } } });
    try {
      const dossier = (await app.inject({ method: 'GET', url: `/v1/rh-chain/tokens/${contract}/dossier` })).json().data;
      expect(dossier).toEqual(expect.objectContaining({ ticker: null, review_status: 'not_reviewed', risk_state: 'source_required', contract_intelligence: expect.objectContaining({ source: 'dexscreener', claim_status: 'source_required_for_claims' }), memory: expect.objectContaining({ index: null, campaign_asset: null, market_structure: null }) }));
      expect(dossier.external_context.token_pair).toEqual(expect.objectContaining({ pair_address: 'provider-pair', exact_contract_match: true }));
      expect(dossier.external_context.explorer).toEqual(expect.objectContaining({ exact_contract_match: true }));
    } finally { await app.close(); }
  });
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

  it('does not aggregate unrelated placeholder-contract records', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/unverified_contract_required/dossier' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({ identity_status: 'source_required', ticker: null, risk_state: 'source_required', memory: expect.objectContaining({ index: null, review_items: [] }) }));
      expect(response.json().data.risk_notes.join(' ')).toContain('Placeholder contract values cannot be used');
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
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/tokens/0xnotindexed/dossier' });
      expect(response.json().data).toEqual(expect.objectContaining({ ticker: null, review_status: 'not_found', risk_state: 'source_required', memory: expect.objectContaining({ index: null }) }));
      expect(response.json().data.external_context.token_pair).toEqual(expect.objectContaining({ exact_contract_match: false }));
    } finally { await app.close(); }
  });
});
