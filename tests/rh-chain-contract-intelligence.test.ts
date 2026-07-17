import { describe, expect, it } from 'vitest';
import { resolveRhChainContractIntelligence } from '../src/services/rhChainContractIntelligenceService';
import { getRhChain100ReceiptsCampaign } from '../src/data/rhChain100Receipts';

const THE_INDEX = '0x56910D4409F3a0C78C64DD8D0545FF0705389870';

describe('RH Chain contract intelligence resolver', () => {
  it.each([THE_INDEX, THE_INDEX.toLowerCase()])('resolves The Index by exact normalized contract (%s)', (contract) => {
    const result = resolveRhChainContractIntelligence(contract);
    expect(result).toMatchObject({
      contract: THE_INDEX,
      source: 'market_structure',
      display_name: 'The Index',
      review_status: 'under_receipt_check',
      claim_status: 'source_required_for_claims',
      risk_state: 'source_required',
      market_structure: { primary_layer: 'rwa', secondary_layers: ['defi', 'speculative_distribution', 'tokenized_equities'], cross_layer_category: 'defi_x_rwa', evidence_state: 'under_receipt_check' }
    });
    expect(result.review_status).not.toBe('approved_signal');
  });

  it('preserves reviewed 100 Receipts memory ahead of any provider context', () => {
    for (const ticker of ['CASHCAT', 'TENDIES', 'PONS', 'HOODRAT', 'ARROW']) {
      const asset = getRhChain100ReceiptsCampaign().assets.find((item) => item.ticker === ticker)!;
      const result = resolveRhChainContractIntelligence(asset.contract, { dexscreener: { contract: asset.contract, exact_contract_match: true, chain_match_status: 'chain_verified', pair_address: 'provider-pair', dex_url: 'https://dexscreener.example/provider', liquidity_usd: 1, volume_24h_usd: 1, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: null, freshness: 'live_cached' } });
      expect(result).toMatchObject({ source: '100_receipts', ticker, campaign_asset: { ticker } });
      expect(result.source).not.toBe('dexscreener');
    }
  });

  it('keeps DEX-only and Blockscout-only contracts not reviewed and source-required', () => {
    const dex = resolveRhChainContractIntelligence('0x1111111111111111111111111111111111111111', { dexscreener: { contract: '0x1111111111111111111111111111111111111111', exact_contract_match: true, chain_match_status: 'chain_verified', pair_address: 'pair', dex_url: 'https://dexscreener.example/pair', liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: null, freshness: 'live_cached' } });
    const blockscout = resolveRhChainContractIntelligence('0x2222222222222222222222222222222222222222', { blockscoutToken: { contract: '0x2222222222222222222222222222222222222222', name: 'Observed only', symbol: 'OBS', provider: 'blockscout', chain: 'robinhood', captured_at: '2026-07-17T00:00:00.000Z', decimals: null, token_type: null, holders_count: null, transfers_count: null, total_supply: null, contract_verified: null, deployer_address: null, creation_tx_hash: null, source_url: 'https://blockscout.example/token', evidence_state: 'observed_token', review_state: 'source_required', caveats: [] } });
    expect(dex).toMatchObject({ source: 'dexscreener', review_status: 'not_reviewed', claim_status: 'source_required_for_claims', risk_state: 'source_required', market_structure: null, index: null });
    expect(blockscout).toMatchObject({ source: 'blockscout', display_name: 'Observed only', ticker: 'OBS', review_status: 'not_reviewed', claim_status: 'source_required_for_claims', risk_state: 'source_required' });
  });

  it('uses latest exact snapshot history ahead of live provider observations', () => {
    const contract = '0x4444444444444444444444444444444444444444';
    const result = resolveRhChainContractIntelligence(contract, {
      snapshotHistory: [{ snapshot_id: 'snapshot-1', captured_at: '2026-07-17T00:00:00.000Z', provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: 'Snapshot only', pair_address: 'pair', dex_id: 'dex', price_usd: null, liquidity_usd: null, market_cap: null, fdv: null, volume_h24: null, volume_h6: null, volume_h1: null, txns_h24_buys: null, txns_h24_sells: null, txns_h6_buys: null, txns_h6_sells: null, price_change_h24: null, pair_created_at: null, active_boosts: 0, paid_order_types: [], paid_order_statuses: [], data_mode: 'live_cached', source_url: null }],
      dexscreener: { contract, exact_contract_match: true, chain_match_status: 'chain_verified', pair_address: 'live-pair', dex_url: 'https://dexscreener.example/live-pair', liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: null, freshness: 'live_cached' }
    });
    expect(result).toMatchObject({ source: 'snapshot_history', ticker: 'Snapshot only', review_status: 'not_reviewed', claim_status: 'source_required_for_claims' });
  });

  it('does not resolve a ticker collision or a missing-contract label', () => {
    expect(resolveRhChainContractIntelligence('CASHCAT')).toMatchObject({ source: 'unknown', identity_valid: false, review_status: 'not_found' });
    expect(resolveRhChainContractIntelligence('0x3333333333333333333333333333333333333333')).toMatchObject({ source: 'unknown', ticker: null, review_status: 'not_found' });
  });
});
