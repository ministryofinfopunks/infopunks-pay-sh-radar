import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import pg from 'pg';
import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';
import { InMemoryRhChainMarketSnapshotStore, PostgresRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { RhChainMarketMoversService } from '../src/services/rhChainMarketMoversService';
import { assembleRhChainTodayOn4663 } from '../src/services/rhChainTodayOn4663Service';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('integrated dynamic market PostgreSQL qualification', () => {
  it('qualifies all migrations, preserves exact rankings across reverse replay, concurrent writes and pool restart', async () => {
    const migrations = readdirSync('migrations').filter((s) => s.endsWith('.up.sql')).sort().map((s) => s.replace('.up.sql', ''));
    const db = await createCanonicalTestDatabase(url!, 'rh_dynamic_integrated', migrations);
    let restarted: pg.Pool | null = null;
    try {
      expect(migrations).toHaveLength(20);
      const memory = new InMemoryRhChainMarketSnapshotStore(), store = new PostgresRhChainMarketSnapshotStore(db.pool);
      const samples = moverSamples();
      for (const sample of samples) await memory.save(sample);
      const inserted = await Promise.all(samples.slice().reverse().flatMap((sample) => [store.save(sample), store.save(sample)]));
      expect(inserted.filter(Boolean)).toHaveLength(samples.length);
      const opts = { now: () => new Date(moverNow) };
      const before = await new RhChainMarketMoversService(store, opts).read();
      const memoryView = await new RhChainMarketMoversService(memory, opts).read();
      expect(before.assets).toEqual(memoryView.assets); expect(before.projection_id).toBe(memoryView.projection_id);
      expect(before.storage).toEqual({ adapter: 'postgres', durable: true }); expect(memoryView.storage).toEqual({ adapter: 'memory', durable: false });
      restarted = new pg.Pool({ connectionString: url!, options: `-c search_path=${db.schema}` });
      const recovered = new PostgresRhChainMarketSnapshotStore(restarted);
      expect(await new RhChainMarketMoversService(recovered, opts).read()).toEqual(before);
      expect(await recovered.save(samples[0])).toBe(false);
      expect(assembleRhChainTodayOn4663({ marketMovers: before }).cards[0]).toMatchObject({ record_scope: 'current_observation', observation_id: samples.at(-1)!.snapshot_id });
      expect((await store.listAggregates(contract, 'day'))[0].sample_count).toBe(13);
    } finally { await restarted?.end(); await db.close(); }
  }, 30000);
  it('keeps recent-read semantics and UTC offset ordering aligned across stores', async () => {
    const db = await createCanonicalTestDatabase(url!, 'rh_dynamic_recent', ['20260719_001_rh_chain_market_snapshot_memory', '20261012_024_rh_market_observation_history']);
    try {
      const memory = new InMemoryRhChainMarketSnapshotStore(), store = new PostgresRhChainMarketSnapshotStore(db.pool);
      const samples = moverSamples().map((s) => ({ ...s, captured_at: s.captured_at.replace('Z', '+00:00') }));
      for (const sample of [...samples].reverse()) { await memory.save(sample); await store.save(sample); }
      const since = '2026-10-13T14:30:00Z';
      expect(await store.listObservedContracts(301)).toEqual(await memory.listObservedContracts(301));
      expect(await store.listMany([contract], since)).toEqual(await memory.listMany([contract], since));
      expect(await store.listMany([contract], '2026-10-14T00:00:00Z')).toEqual(await memory.listMany([contract], '2026-10-14T00:00:00Z'));
    } finally { await db.close(); }
  });
  it('excludes expired raw baselines while retaining durable daily evidence after pruning and replay', async () => {
    const db = await createCanonicalTestDatabase(url!, 'rh_dynamic_retention', ['20260719_001_rh_chain_market_snapshot_memory', '20261012_024_rh_market_observation_history']);
    try {
      const store = new PostgresRhChainMarketSnapshotStore(db.pool); for (const sample of moverSamples()) await store.save(sample);
      const aged = new Date(Date.parse(moverNow) + 49 * 3600000);
      expect((await new RhChainMarketMoversService(store, { now: () => aged }).read()).assets).toEqual([]);
      await store.pruneHistory(aged);
      expect(await store.list(contract)).toEqual([]); expect((await store.listAggregates(contract, 'day'))[0].sample_count).toBe(13);
      expect(await store.save(moverSamples()[0])).toBe(false);
      expect((await new RhChainMarketMoversService(store, { now: () => aged }).read()).assets).toEqual([]);
    } finally { await db.close(); }
  });
});
