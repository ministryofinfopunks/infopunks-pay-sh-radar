import { describe, expect, it } from 'vitest';
import { RhChainCategoryIntelligenceService, type RhCategoryIdentity } from '../src/services/rhChainCategoryIntelligenceService';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';
import type { RhChainMarketSnapshot } from '../src/services/rhChainMarketSnapshotService';

const identity = (category: RhCategoryIdentity['category'], token = contract): RhCategoryIdentity => ({ contract: token, category, source_id: 'fixture-registry', href: '/v1/rh-chain/classifications', observed_at: moverNow });
function service(samples = moverSamples(), identities: RhCategoryIdentity[] = [], now = new Date(moverNow)) {
  return new RhChainCategoryIntelligenceService({ movers: async () => deriveRhChainMarketMovers({ [contract]: samples }, now),
    identities: async () => identities, snapshots: async () => ({ [contract]: samples }), stockEvidence: async () => null, now: () => now });
}
const first = (p: Awaited<ReturnType<RhChainCategoryIntelligenceService['read']>>) => p.categories.flatMap(c => c.findings)[0];
describe('category-specific stored intelligence', () => {
  it('keeps four first-class categories and unclassified discovery without ticker-based financial interpretation', async () => {
    const result = await service().read(); expect(result.categories.map(c => c.category)).toEqual(['stock_tokens', 'rwa_defi', 'memes', 'stables', 'market_discovery']);
    const f = first(result); expect(f.category).toBe('market_discovery'); expect(f.category_score?.version).toBe('rh-market-significance-v1');
    expect(f.observation.observation_id).toBe(moverSamples().at(-1)!.snapshot_id); expect(f.execution_authorized).toBe(false);
  });
  it('requires explicit paid coverage for every meme sample; missing data is not zero promotion', async () => {
    const samples = moverSamples().map(s => ({ ...s, paid_attention_available: false, active_boosts: null }));
    const f = first(await service(samples, [identity('memes')]).read());
    expect(f.category_score).toBeNull(); expect(f.evidence.missing_inputs).toEqual(['paid_attention_window']); expect(f.observation.significance_score).toBeGreaterThan(0);
  });
  it('scores measured meme activity with its own reproducible weights, never promotion size or price returns', async () => {
    const samples = moverSamples().map(s => ({ ...s, paid_attention_available: true, active_boosts: 0, paid_order_types: [], paid_order_statuses: [] }));
    const a = first(await service(samples, [identity('memes')]).read());
    const b = first(await service([...samples].reverse().map(s => ({ ...s, active_boosts: 1000 })), [identity('memes')]).read());
    expect(a.category_score).toEqual(b.category_score); expect(a.category_score?.version).toBe('meme-market-activity-v1'); expect(a.category_score?.components).not.toHaveProperty('price');
    expect(a.category_score?.value).not.toBe(a.observation.significance_score);
    const priceOnlyChanged = samples.map((s, i) => ({ ...s, price_usd: i < 12 ? 2 : 1000 }));
    expect(first(await service(priceOnlyChanged, [identity('memes')]).read()).category_score).toEqual(a.category_score);
  });
  it('does not borrow paid evidence from another pool or hide an unavailable duplicate', async () => {
    const samples = moverSamples().map(s => ({ ...s, paid_attention_available: true, active_boosts: 0 }));
    const duplicate: RhChainMarketSnapshot = { ...samples[6], snapshot_id: 'duplicate-paid-gap', paid_attention_available: false, active_boosts: null };
    expect(first(await service([...samples, duplicate], [identity('memes')]).read()).category_score).toBeNull();
    const wrongPool = samples.map(s => ({ ...s, snapshot_id: 'wrong-' + s.snapshot_id, pair_address: '0x' + 'b'.repeat(64), liquidity_usd: 1 }));
    expect(first(await service([...moverSamples().map(s => ({ ...s, paid_attention_available: false })), ...wrongPool], [identity('memes')]).read()).category_score).toBeNull();
  });
  it.each(['stock_tokens', 'rwa_defi', 'stables'] as const)('withholds %s financial interpretation when its specialized evidence is missing', async category => {
    const f = first(await service(moverSamples(), [identity(category)]).read()); expect(f.category).toBe(category); expect(f.category_score).toBeNull();
    expect(f.evidence.state).toBe('INCOMPLETE'); expect(f.evidence.missing_inputs.length).toBeGreaterThan(2); expect(f.observation.metrics.price_delta_pct).toBe(10);
  });
  it('quarantines contradictory categories rather than choosing a ticker or a preferred product wedge', async () => {
    const f = first(await service(moverSamples(), [identity('memes'), identity('stock_tokens')]).read());
    expect(f.category).toBe('market_discovery'); expect(f.identity_source).toBeNull(); expect(f.category_score).toBeNull(); expect(f.evidence.missing_inputs).toContain('category_identity_unambiguous');
  });
  it('rejects wrong-contract, future and unsafe source identity records and never serializes private fields', async () => {
    const bad = [{ ...identity('stock_tokens', '0x' + '2'.repeat(40)) }, { ...identity('memes'), observed_at: '2030-01-01T00:00:00Z' }, { ...identity('memes'), href: 'https://private.invalid/?key=secret' }];
    expect(first(await service(moverSamples(), bad).read()).category).toBe('market_discovery');
    const withSecret = { ...identity('memes'), wallet: 'private-secret' };
    expect(JSON.stringify(await service(moverSamples(), [withSecret]).read())).not.toContain('private-secret');
  });
  it('changes semantic identity only when observations or evidence change, and excludes stale and testnet samples', async () => {
    const a = await service().read(), b = await service(moverSamples(), [], new Date(Date.parse(moverNow) + 30000)).read();
    expect(a.projection_id).toBe(b.projection_id);
    expect((await service(moverSamples(), [], new Date(Date.parse(moverNow) + 16 * 60000)).read()).categories.every(c => !c.findings.length)).toBe(true);
    expect((await service(moverSamples().map(s => ({ ...s, chain_id: '46630' as 'robinhood' }))).read()).categories.every(c => !c.findings.length)).toBe(true);
  });
  it('isolates failed evidence reads and retains observations without silently permitting category scores', async () => {
    const deps = { movers: async () => deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(moverNow)), identities: async () => { throw new Error('private-provider-url'); },
      snapshots: async () => { throw new Error('private-db-url'); }, stockEvidence: async () => null, now: () => new Date(moverNow) };
    const result = await new RhChainCategoryIntelligenceService(deps).read(); expect(result.state).toBe('partial');
    expect(first(result).category_score).toBeNull(); expect(JSON.stringify(result)).not.toContain('private-');
  });
});
