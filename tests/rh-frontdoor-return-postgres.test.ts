import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { Rh4663FrontdoorService, PostgresFrontdoorVersionStore, PostgresFrontdoorChangeEventStore, type Rh4663FrontdoorDependencies } from '../src/services/rh4663FrontdoorService';
import { PostgresFrontdoorOpenLoopStore } from '../src/services/rh4663OpenLoopStore';
import { RhChainCategoryIntelligenceService } from '../src/services/rhChainCategoryIntelligenceService';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from './helpers/canonicalPostgres';
import { moverNow, moverContract, moverSamples } from './helpers/rhMoverObservations';
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('durable source-linked public return state', () => {
  it('commits version/events together, retries a failed event insert, survives restart, persists stale loops and avoids countdown versions', async () => {
    const db = await createCanonicalTestDatabase(url!, 'frontdoor_return', readdirSync('migrations').filter(n => n.endsWith('.up.sql')).sort().map(n => n.replace('.up.sql', '')));
    let restarted: pg.Pool | null = null;
    try {
      let now = new Date(moverNow), missing = true, rows = moverSamples();
      const categories = new RhChainCategoryIntelligenceService({ movers: async () => deriveRhChainMarketMovers({ [moverContract]: rows }, now),
        identities: async () => [{ contract: moverContract, category: 'memes', source_id: 'fixture', href: '/v1/rh-chain/classifications', observed_at: moverNow }],
        snapshots: async () => ({ [moverContract]: rows }), stockEvidence: async () => null, now: () => now });
      const deps = (pool: pg.Pool): Rh4663FrontdoorDependencies => ({ now: () => now, ttl_ms: 0, require_durable_version: true, source_timeout_ms: 2000,
        version_store: new PostgresFrontdoorVersionStore(pool, { allow_ephemeral_fallback: false }), change_event_store: new PostgresFrontdoorChangeEventStore(pool), loop_store: new PostgresFrontdoorOpenLoopStore(pool),
        census: async () => null, preflight: async () => null, signals: async () => [], watch: async () => ({ generated_at: moverNow, cases: [], feed: [], falsification_queue: [] }),
        market_categories: async () => { rows = rows.map(r => ({ ...r, paid_attention_available: !missing, active_boosts: missing ? null : 0 })); return categories.read(); },
        pulse: async () => ({ window: { window_id: 'fixture', opens_at: moverNow, closes_at: '2026-10-14T15:00:00Z' }, consensus: { state: 'open', leading_rotation: null, total_calls: 0 } }), ignore_personal_pulse_changes: true });
      const initial = new Rh4663FrontdoorService(deps(db.pool)), first = await initial.read();
      now = new Date(now.getTime() + 30000); const same = await initial.read(); expect(same.frontdoor_version.version).toBe(first.frontdoor_version.version);
      expect(same.open_loops.find(l => l.source_type === 'market_observation')?.opened_at).toBe(first.open_loops.find(l => l.source_type === 'market_observation')?.opened_at);
      const saved = await db.pool.query('select count(*)::int as n from rh4663_frontdoor_change_events');
      await db.pool.query("create function fail_event() returns trigger language plpgsql as $$ begin raise exception 'event_write_failed'; end $$; create trigger fail_event before insert on rh4663_frontdoor_change_events for each row execute function fail_event()");
      missing = false; await expect(initial.read()).rejects.toThrow('frontdoor_version_durability_required');
      expect(Number((await db.pool.query('select version from rh4663_frontdoor_version')).rows[0].version)).toBe(first.frontdoor_version.version);
      expect((await db.pool.query('select count(*)::int as n from rh4663_frontdoor_change_events')).rows[0].n).toBe(saved.rows[0].n);
      await db.pool.query('drop trigger fail_event on rh4663_frontdoor_change_events');
      const recovered = await initial.read(); expect(recovered.frontdoor_version.version).toBe(first.frontdoor_version.version + 1);
      const resolution = recovered.change_events.find(e => e.event_id.includes('loop:market-coverage') && e.change_type === 'RESOLVED');
      expect(resolution?.source_ref.source_id).toBe(rows.at(-1)!.snapshot_id); expect(typeof resolution?.frontdoor_version).toBe('number');
      expect(resolution?.source_observed_at).toBe(moverNow); expect(resolution?.deep_link).toContain('/market/snapshots/');
      restarted = new pg.Pool({ connectionString: url!, options: `-c search_path=${db.schema}` });
      const afterRestart = await new Rh4663FrontdoorService(deps(restarted)).read(); expect(afterRestart.frontdoor_version.version).toBe(recovered.frontdoor_version.version);
      expect(afterRestart.change_events).toEqual(recovered.change_events);
      missing = true; now = new Date(now.getTime() + 1000); await initial.read();
      now = new Date(now.getTime() + 20 * 60000); const stale = await initial.read();
      expect(stale.open_loops.find(l => l.source_type === 'market_observation')?.state).toBe('STALE');
      expect(stale.change_events.some(e => e.change_type === 'STATE_TRANSITION' && e.after.state === 'STALE')).toBe(true);
      await expectRollbackMigrationFailure(db.pool, '20261013_026_rh_frontdoor_return_state', 'durable frontdoor return state exists');
      mkdirSync('docs/evidence/rh-pipeline-1d', { recursive: true }); writeFileSync('docs/evidence/rh-pipeline-1d/synthetic-return-events.json', JSON.stringify({ synthetic_only: true, first, recovered, stale }, null, 2));
    } finally { await restarted?.end(); await db.close(); }
  }, 30000);
  it('empty rollback preserves inherited global version namespace', async () => {
    const db = await createCanonicalTestDatabase(url!, 'frontdoor_empty', ['20261013_026_rh_frontdoor_return_state']);
    try { await db.pool.query(readFileSync('migrations/20261013_026_rh_frontdoor_return_state.down.sql', 'utf8')); expect((await db.pool.query("select to_regclass('rh4663_frontdoor_version') as name")).rows[0].name).toBe('rh4663_frontdoor_version'); }
    finally { await db.close(); }
  });
});
