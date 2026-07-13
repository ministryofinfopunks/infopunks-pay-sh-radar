import { describe, expect, it } from 'vitest';
import { InMemoryRhChainSnapshotCache } from '../src/services/rhChainSnapshotCache';
import { RhChainLiveSnapshotService } from '../src/services/rhChainLiveSnapshotService';
import { findRhChainCanonicalIdentity, type RhChainCanonicalIdentity } from '../src/data/rhChainIdentityRegistry';

const pair = (chainId: string | null, observed_contract = '0xabc') => async () => ({ observed_contract, observed_chain_id: chainId, pair_address: 'pair', dex_url: 'https://dexscreener.example/pair', liquidity_usd: 10, volume_24h_usd: 2, fdv_usd: null, market_cap_usd: null, pair_created_at: null, source_timestamp: '2026-07-12T00:00:00.000Z' });

describe('RH Chain durable provider pipeline', () => {
  it('uses the shared cache adapter and reports its entry state', async () => {
    const cache = new InMemoryRhChainSnapshotCache();
    await cache.set('provider:test', { cache_key: 'provider:test', value: { safe: true }, fetched_at: '2026-07-12T00:00:00.000Z', expires_at: '2999-01-01T00:00:00.000Z', provider_name: 'DexScreener', status: 'fresh' }, 1000);
    expect((await cache.get<{ safe: boolean }>('provider:test'))?.value).toEqual({ safe: true });
    expect(await cache.getStatus('provider:test')).toEqual(expect.objectContaining({ status: 'fresh', durable: false }));
    await cache.delete('provider:test');
    expect(await cache.getStatus('provider:test')).toEqual(expect.objectContaining({ status: 'miss' }));
  });

  it('ignores an exact-contract DexScreener pair when the provider explicitly names another chain', async () => {
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { tokenPair: pair('ethereum') } });
    const snapshot = await service.getTokenSnapshot('0xabc');
    expect(snapshot.token_pair).toBeNull();
  });

  it('accepts an exact-contract pair only with a verified RH Chain identifier', async () => {
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { tokenPair: pair('robinhood') } });
    const snapshot = await service.getTokenSnapshot('0xabc');
    expect(snapshot.token_pair).toEqual(expect.objectContaining({ exact_contract_match: true, chain_match_status: 'chain_verified', pair_address: 'pair' }));
  });

  it('keeps missing Dex chain metadata explicitly unverified and does not create launch identity context', async () => {
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { tokenPair: pair(null) } });
    const snapshot = await service.getTokenSnapshot('0xabc');
    expect(snapshot.token_pair).toEqual(expect.objectContaining({ chain_match_status: 'chain_unverified' }));
    expect(snapshot.launch_context?.pair_address).toBeNull();
  });

  it('falls back cleanly when Blockscout is unavailable', async () => {
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { explorer: async () => { throw new Error('provider_timeout'); } } });
    const snapshot = await service.getTokenSnapshot('0xabc');
    expect(snapshot.explorer).toBeNull();
    expect(snapshot.provider_statuses.find((status) => status.provider_name === 'Blockscout')).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });

  it('looks up manual canonical identity records by exact contract only', () => {
    const registry: RhChainCanonicalIdentity[] = [{ contract: '0xAbC', ticker: 'RH', name: 'RH Token', canonical_status: 'reviewed', evidence_links: ['https://evidence.example/rh'], reviewed_at: '2026-07-12T00:00:00.000Z', notes: 'manual record' }];
    expect(findRhChainCanonicalIdentity('0xabc', registry)?.ticker).toBe('RH');
    expect(findRhChainCanonicalIdentity('0xab', registry)).toBeNull();
  });
});
