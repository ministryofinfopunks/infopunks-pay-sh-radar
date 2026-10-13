import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';
import { PostgresRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { RhChainMarketMoversService } from '../src/services/rhChainMarketMoversService';
import { RhChainCategoryIntelligenceService } from '../src/services/rhChainCategoryIntelligenceService';
import { PostgresFrontdoorVersionStore, Rh4663FrontdoorService } from '../src/services/rh4663FrontdoorService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('category evidence durable replay', () => {
  it('rehearses the inherited migration ledger, survives pool restart and duplicate replay, and changes frontdoor version on new evidence', async () => {
    const migrations = readdirSync('migrations').filter(s => s.endsWith('.up.sql')).sort().map(s => s.replace('.up.sql', ''));
    const db = await createCanonicalTestDatabase(url!, 'rh_categories', migrations); let restarted: pg.Pool | null = null;
    try {
      const store = new PostgresRhChainMarketSnapshotStore(db.pool); for (const s of moverSamples()) await store.save(s);
      const build = (pool: pg.Pool) => {
        const history = new PostgresRhChainMarketSnapshotStore(pool);
        const movers = new RhChainMarketMoversService(history, { now: () => new Date(moverNow), requireDurable: true });
        const categories = new RhChainCategoryIntelligenceService({ movers: () => movers.read(), snapshots: (contracts, since) => history.listMany(contracts, since),
          identities: async () => [{ contract, category: 'memes', source_id: 'reviewed-fixture', href: '/v1/rh-chain/classifications', observed_at: moverNow }], stockEvidence: async () => null, now: () => new Date(moverNow) });
        return { categories, history, frontdoor: new Rh4663FrontdoorService({ now: () => new Date(moverNow), ttl_ms: 0, require_durable_version: true,
          version_store: new PostgresFrontdoorVersionStore(pool, { allow_ephemeral_fallback: false }), market_categories: () => categories.read(), census: async () => null,
          watch: async () => ({ generated_at: moverNow, cases: [], feed: [], falsification_queue: [] }), preflight: async () => null, signals: async () => [],
          pulse: async () => ({ window: { window_id: 'fixture-window', opens_at: moverNow, closes_at: moverNow }, consensus: { state: 'open', leading_rotation: null, total_calls: 0 } }) }) };
      };
      const a = build(db.pool), initial = await a.categories.read(), frontdoor = await a.frontdoor.read();
      restarted = new pg.Pool({ connectionString: url!, options: `-c search_path=${db.schema}` }); const b = build(restarted);
      expect(await Promise.all(moverSamples().map(s => b.history.save(s)))).toEqual(Array(13).fill(false));
      expect((await b.categories.read()).projection_id).toBe(initial.projection_id); expect((await b.frontdoor.read()).frontdoor_version.version).toBe(frontdoor.frontdoor_version.version);
      expect(initial.categories.find(c => c.category === 'memes')?.findings[0].category_score).toBeNull();
      const freshPaid = { ...moverSamples().at(-1)!, snapshot_id: 'new-paid', captured_at: '2026-10-13T15:00:30Z', paid_attention_available: true, active_boosts: 0 };
      await b.history.save(freshPaid); expect((await b.frontdoor.read()).frontdoor_version.changed).toContain('MARKET_OBSERVATIONS');
      const tables = await db.pool.query("select count(*)::int as count from rh_chain_market_snapshots"); expect(tables.rows[0].count).toBe(14);
    } finally { if (restarted) await restarted.end(); await db.close(); }
  });
});
