import { describe, expect, it } from 'vitest';
import { BlockscoutProvider } from '../src/providers/blockscoutProvider';
import { RhChainTokenRegistryService } from '../src/services/rhChainTokenRegistryService';
import { getRhChain100ReceiptsCampaign } from '../src/data/rhChain100Receipts';
import { rhChainReviewedLayerClassifications } from '../src/data/rhChainMarketStructure';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const OTHER = '0x3333333333333333333333333333333333333333';
const DEPLOYER = '0x2222222222222222222222222222222222222222';

function registry(fetchImpl: typeof fetch, enabled = true) {
  return new RhChainTokenRegistryService({
    enabled,
    provider: new BlockscoutProvider({ enabled, fetchImpl }),
    receipts: () => getRhChain100ReceiptsCampaign().assets,
    marketStructure: () => rhChainReviewedLayerClassifications,
    dexScreenerContracts: () => [CONTRACT],
    manualIntakeContracts: () => [OTHER],
    now: () => new Date('2026-07-17T00:00:00.000Z')
  });
}

describe('RH Chain token registry', () => {
  it('returns a fail-soft fallback when Blockscout cannot be reached', async () => {
    const service = registry(async () => new Response('unavailable', { status: 503 }));
    const result = await service.enrichToken(CONTRACT);
    expect(result).toMatchObject({ token: null, fallback: true });
    expect((await service.getProviderStatus()).fallback_state).toBe('fallback');
  });

  it('keeps explorer-visible tokens observed and source-required, never approved', async () => {
    const service = registry(async (url) => {
      if (String(url).includes('/smart-contracts/')) return new Response(JSON.stringify({ creation_status: 'success' }));
      if (String(url).includes('/addresses/')) return new Response(JSON.stringify({ hash: CONTRACT, is_verified: true, creator_address_hash: DEPLOYER, creation_transaction_hash: '0xabc' }));
      return new Response(JSON.stringify({ address_hash: CONTRACT, name: 'RWA Agent Infrastructure', symbol: 'RWA', decimals: '18', type: 'ERC-20', holders_count: '7', total_supply: '10' }));
    });
    const result = await service.enrichToken(CONTRACT);
    expect(result.token).toMatchObject({ contract: CONTRACT, evidence_state: 'observed_token', review_state: 'source_required', contract_verified: true });
    expect(JSON.stringify(result)).not.toContain('approved_signal');
    expect(result.caveats.join(' ')).toMatch(/does not verify/i);
  });

  it('preserves source provenance and allows Blockscout contracts to seed the DEX snapshot watchlist', async () => {
    const service = registry(async () => new Response(JSON.stringify({ items: [{ address_hash: CONTRACT, name: 'First', symbol: 'DUP', type: 'ERC-20' }, { address_hash: OTHER, name: 'Second', symbol: 'DUP', type: 'ERC-20' }] })));
    const watchlist = await service.seedWatchlistFromBlockscout();
    expect(watchlist.filter((item) => item.contract === CONTRACT).map((item) => item.source)).toEqual(expect.arrayContaining(['blockscout', 'dexscreener']));
    expect(watchlist.some((item) => item.source === 'campaign' && item.review_state === 'reviewed')).toBe(true);
    expect(new Set(watchlist.filter((item) => item.source === 'blockscout').map((item) => item.contract))).toEqual(new Set([CONTRACT, OTHER]));
  });

  it('keeps reviewed 100 Receipts entries authoritative over raw provider observations', async () => {
    const service = registry(async () => new Response(JSON.stringify({ items: [] })));
    const watchlist = await service.seedWatchlistFromBlockscout();
    const campaign = getRhChain100ReceiptsCampaign().assets[0];
    const entry = watchlist.find((item) => item.contract === campaign.contract.toLowerCase() && item.source === 'campaign');
    expect(entry).toMatchObject({ review_state: 'reviewed', provenance: '100 Receipts reviewed campaign memory' });
  });
});
