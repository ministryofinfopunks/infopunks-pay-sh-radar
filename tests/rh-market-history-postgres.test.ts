import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from './helpers/canonicalPostgres';
import { InMemoryRhChainMarketSnapshotStore, PostgresRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { PostgresRhChainAutomationStore } from '../src/services/rhChainAutomationService';
import { inspectRhChainMigrationLedger } from '../src/services/rhChainProductionReadiness';
import { marketContract as contract, marketSample } from './helpers/rhMarketObservations';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
const rawMigration = '20260719_001_rh_chain_market_snapshot_memory';
const migration = '20261012_024_rh_market_observation_history';

describe('market observation downsampling', () => {
  it('preserves null coverage, separates pools and rolls UTC midnight without summing rolling volumes', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore();
    await store.save(marketSample('a', '2026-10-11T23:55:00.000Z', { price_usd: null }));
    await store.save(marketSample('b', '2026-10-12T00:00:00.000Z', { price_usd: 2 }));
    await store.save(marketSample('c', '2026-10-12T00:05:00.000Z', { price_usd: 3 }));
    await store.save(marketSample('d', '2026-10-12T00:05:00.000Z', { pair_address: 'secondary' }));
    const days = await store.listAggregates(contract, 'day');
    expect(days).toHaveLength(3);
    expect(days[0].metrics.price_usd).toEqual({ covered_samples: 0, min: null, max: null });
    expect(days[1]).toMatchObject({ sample_count: 2, metrics: { price_usd: { covered_samples: 2, min: { value: 2 }, max: { value: 3 } }, volume_h24: { min: { value: 300 }, max: { value: 300 } } } });
    await store.pruneHistory(new Date('2027-01-12T00:00:00Z'));
    expect(await store.list(contract)).toEqual([]);
    expect(await store.listAggregates(contract, 'hour')).toEqual([]);
    expect(await store.listAggregates(contract, 'day')).toHaveLength(3);
    expect(await store.save(marketSample('b', '2026-10-12T00:00:00.000Z', { price_usd: 2 }))).toBe(false);
    expect((await store.listAggregates(contract, 'day'))[1].sample_count).toBe(2);
  });
  it('produces identical aggregate facts for reverse-order replay', async () => {
    const a = new InMemoryRhChainMarketSnapshotStore(); const b = new InMemoryRhChainMarketSnapshotStore();
    const samples = [marketSample('b', '2026-10-12T00:05:00.000Z', { price_usd: 2 }), marketSample('a', '2026-10-12T00:05:00.000Z', { price_usd: 2 }), marketSample('c', '2026-10-12T00:00:00.000Z', { price_usd: 5 })];
    for (const sample of samples) await a.save(sample);
    for (const sample of [...samples].reverse()) await b.save(sample);
    expect(await a.listAggregates(contract, 'day')).toEqual(await b.listAggregates(contract, 'day'));
  });
});

describe.skipIf(!url)('RH-PIPELINE-1A real PostgreSQL', () => {
  it('rehearses all baseline migrations plus 024, empty rollback/reapply and read-only ledger', async () => {
    const migrations = readdirSync('migrations').filter((name) => name.endsWith('.up.sql')).sort().map((name) => name.replace('.up.sql', ''));
    const database = await createCanonicalTestDatabase(url!, 'rh_market_all', migrations);
    try {
      expect(migrations).toHaveLength(19);
      expect((await inspectRhChainMigrationLedger(database.pool)).pending_migrations).toEqual([]);
      await database.pool.query(readFileSync('migrations/' + migration + '.down.sql', 'utf8'));
      expect((await inspectRhChainMigrationLedger(database.pool)).pending_migrations).toContain('20261012_024');
      await database.pool.query(readFileSync('migrations/' + migration + '.up.sql', 'utf8'));
      expect((await inspectRhChainMigrationLedger(database.pool)).pending_migrations).toEqual([]);
    } finally { await database.close(); }
  }, 30000);

  it('blocks collection until the external migration, then backfills legacy observations exactly once', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_legacy', [rawMigration]);
    try {
      const sample = marketSample('legacy');
      await database.pool.query('insert into rh_chain_market_snapshots(snapshot_id,token_address,captured_at,payload) values($1,$2,$3,$4)', [sample.snapshot_id, contract, sample.captured_at, sample]);
      await expect(new PostgresRhChainMarketSnapshotStore(database.pool).save(marketSample('blocked'))).rejects.toThrow('rh_market_history_migration_required');
      await database.pool.query(readFileSync('migrations/' + migration + '.up.sql', 'utf8'));
      const store = new PostgresRhChainMarketSnapshotStore(database.pool);
      expect((await store.listAggregates(contract, 'day'))[0].sample_count).toBe(1);
      expect(await store.save(sample)).toBe(false);
      await database.pool.query(readFileSync('migrations/' + migration + '.up.sql', 'utf8'));
      expect((await store.listAggregates(contract, 'day'))[0].sample_count).toBe(1);
    } finally { await database.close(); }
  });

  it('deduplicates concurrent workers and replays after a store restart', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_replay', [rawMigration, migration]);
    try {
      const a = new PostgresRhChainMarketSnapshotStore(database.pool); const b = new PostgresRhChainMarketSnapshotStore(database.pool);
      const sample = marketSample('one-observation');
      const inserts = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? a : b).save(sample)));
      expect(inserts.filter(Boolean)).toHaveLength(1);
      const restarted = new PostgresRhChainMarketSnapshotStore(database.pool);
      expect(await restarted.save(sample)).toBe(false);
      expect(await restarted.list(contract)).toHaveLength(1);
      expect((await restarted.listAggregates(contract, 'hour'))[0].sample_count).toBe(1);
      expect((await restarted.listAggregates(contract, 'day'))[0].sample_count).toBe(1);
    } finally { await database.close(); }
  }, 15000);

  it('matches the memory projection for concurrent out-of-order inserts and different pools', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_parity', [rawMigration, migration]);
    try {
      const store = new PostgresRhChainMarketSnapshotStore(database.pool); const memory = new InMemoryRhChainMarketSnapshotStore();
      const samples = [marketSample('b', '2026-10-12T00:05:00.000Z', { price_usd: 2 }), marketSample('a', '2026-10-12T00:05:00.000Z', { price_usd: 2 }), marketSample('c', '2026-10-11T23:55:00.000Z', { price_usd: null }), marketSample('d', '2026-10-12T00:05:00.000Z', { pair_address: 'secondary' })];
      await Promise.all(samples.map((sample) => store.save(sample)));
      for (const sample of samples) await memory.save(sample);
      expect(await store.listAggregates(contract, 'day')).toEqual(await memory.listAggregates(contract, 'day'));
      expect(await store.listAggregates(contract, 'hour')).toEqual(await memory.listAggregates(contract, 'hour'));
    } finally { await database.close(); }
  });

  it('retains more than 300 five-minute samples, compacts safely and preserves replay membership', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_retention', [rawMigration, migration]);
    try {
      const store = new PostgresRhChainMarketSnapshotStore(database.pool);
      const start = Date.parse('2026-10-10T00:00:00Z');
      for (let index = 0; index < 601; index++) await store.save(marketSample('sample_' + index, new Date(start + index * 300000).toISOString()));
      await store.save(marketSample('ancient', '2026-01-01T00:00:00Z'));
      await store.pruneHistory(new Date('2026-10-12T02:00:00Z'));
      expect(await store.list(contract)).toHaveLength(577);
      expect((await store.listAggregates(contract, 'day')).map((day) => day.sample_count)).toEqual([1, 288, 288, 25]);
      expect((await store.listAggregates(contract, 'hour')).some((hour) => hour.bucket_start.startsWith('2026-01'))).toBe(false);
      expect(await new PostgresRhChainMarketSnapshotStore(database.pool).save(marketSample('sample_0', '2026-10-10T00:00:00.000Z'))).toBe(false);
      expect((await store.listAggregates(contract, 'day'))[1].sample_count).toBe(288);
      await expectRollbackMigrationFailure(database.pool, migration, 'market observation history exists');
      expect(await store.list(contract)).toHaveLength(577);
    } finally { await database.close(); }
  }, 30000);

  it('rolls back the raw insert when its aggregate write fails', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_atomic', [rawMigration, migration]);
    try {
      await database.pool.query('alter table rh_chain_market_aggregates add constraint intentional_failure check(false)');
      await expect(new PostgresRhChainMarketSnapshotStore(database.pool).save(marketSample('atomic'))).rejects.toThrow();
      expect((await database.pool.query('select count(*)::int as n from rh_chain_market_snapshots')).rows[0].n).toBe(0);
    } finally { await database.close(); }
  });

  it('reports a disabled rollup trigger as a pending migration and blocks new collection', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_guard', [rawMigration, migration]);
    try {
      await database.pool.query('alter table rh_chain_market_snapshots disable trigger rh_chain_market_snapshot_rollup');
      const ledger = await inspectRhChainMigrationLedger(database.pool);
      expect(ledger.migrations.find((item) => item.id === '20261012_024')).toMatchObject({ state: 'pending', missing_checks: ['rh_chain_market_snapshot_rollup'] });
      await expect(new PostgresRhChainMarketSnapshotStore(database.pool).save(marketSample('guarded'))).rejects.toThrow('rh_market_history_migration_required');
    } finally { await database.close(); }
  });

  it('keeps a collection lock across TTL duration and makes it available after completion', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_lock', [rawMigration, migration]);
    try {
      const a = new PostgresRhChainAutomationStore(database.pool); const b = new PostgresRhChainAutomationStore(database.pool);
      let release!: () => void; let acquired!: () => void;
      const started = new Promise<void>((resolve) => { acquired = resolve; });
      const running = a.withJobLock('rh_market_snapshot_refresh', async () => { acquired(); await new Promise<void>((resolve) => { release = resolve; }); return 'finished'; });
      await started;
      expect(await b.withJobLock('rh_market_snapshot_refresh', async () => 'overlap')).toBeNull();
      release(); expect(await running).toBe('finished');
      expect(await b.withJobLock('rh_market_snapshot_refresh', async () => 'restarted')).toBe('restarted');
    } finally { await database.close(); }
  });
  it('fails closed on a one-connection pool and collects successfully with the two-connection minimum', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_pool', [rawMigration, migration]);
    try {
      database.pool.options.max = 1;
      const jobs = new PostgresRhChainAutomationStore(database.pool);
      const store = new PostgresRhChainMarketSnapshotStore(database.pool);
      await expect(jobs.withJobLock('rh_market_snapshot_refresh', () => store.save(marketSample('single')))).rejects.toThrow('collection_requires_two_database_connections');
      expect(await store.list(contract)).toHaveLength(0);
      database.pool.options.max = 2;
      expect(await jobs.withJobLock('rh_market_snapshot_refresh', () => store.save(marketSample('two')))).toBe(true);
      expect(await store.list(contract)).toHaveLength(1);
    } finally { await database.close(); }
  });

  it('releases session locks on worker connection loss and records the lost run as failed', async () => {
    const database = await createCanonicalTestDatabase(url!, 'rh_market_crash', [rawMigration, migration]);
    try {
      const a = new PostgresRhChainAutomationStore(database.pool); const b = new PostgresRhChainAutomationStore(database.pool);
      let release!: () => void; let acquired!: () => void;
      const started = new Promise<void>((resolve) => { acquired = resolve; });
      const running = a.withJobLock('rh_market_snapshot_refresh', async () => { acquired(); await new Promise<void>((resolve) => { release = resolve; }); return true; });
      const failure = expect(running).rejects.toThrow('collection_lock_connection_lost');
      await started;
      await database.pool.query("select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and pid<>pg_backend_pid() and classid=hashtext(current_database())::oid and objid=hashtext(current_schema() || ':rh_market_snapshot_refresh')::oid");
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await b.withJobLock('rh_market_snapshot_refresh', async () => 'recovered')).toBe('recovered');
      release(); await failure;
    } finally { await database.close(); }
  });
});
