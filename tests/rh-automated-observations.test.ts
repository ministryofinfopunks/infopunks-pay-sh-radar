import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { InMemoryAutomatedObservationStore, PostgresAutomatedObservationStore, RhAutomatedObservationReceiptService, observationCommitment } from '../src/services/rhAutomatedObservationReceiptService';
import { InMemoryRhChainMarketSnapshotStore, PostgresRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryRh4663UtcDayObservationStore } from '../src/services/rh4663UtcDayObservationService';
import { startRhChainMarketScheduler } from '../src/services/rhChainMarketScheduler';
import { loadRuntimeConfig } from '../src/config/env';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from './helpers/canonicalPostgres';
import { moverSamples } from './helpers/rhMoverObservations';

const now = () => new Date('2026-10-14T01:00:00Z'), day = '2026-10-13';
const samples = () => moverSamples().map(s => ({ ...s, provider_timestamp: s.captured_at }));
function fixture(store = new InMemoryAutomatedObservationStore(), market = new InMemoryRhChainMarketSnapshotStore()) {
  return { store, market, service: new RhAutomatedObservationReceiptService({ store, market, days: new InMemoryRh4663UtcDayObservationStore(), now }) };
}
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe('automatic factual editions', () => {
  it('uses completed UTC days and never maps missing evidence to zero or investment returns', async () => {
    const f = fixture(); for (const s of samples()) await f.market.save(s);
    const receipt = await f.service.finalize(day);
    expect(receipt.markets[0].metrics.liquidity_usd.delta).toBe(12000);
    expect(receipt.markets[0].metrics.market_cap.delta).toBeNull();
    expect(receipt.chain_metrics.map(m => m.value)).toEqual([null, null]);
    expect(receipt.markets[0].coverage.missing).toContain('INCOMPLETE_DAY_SAMPLING');
    expect(receipt.historical_coverage.missing).toContain('VERIFIED_STABLE_SUPPLY_UNAVAILABLE');
    expect(receipt.execution_authorized).toBe(false);
    expect(await f.store.published(day)).toEqual([]);
    await expect(f.service.finalize('2026-10-14')).rejects.toThrow('utc_day_not_completed');
    await expect(f.service.finalize('2026-02-30')).rejects.toThrow('invalid_utc_date');
    const { content_hash, commitment_algorithm, ...content } = receipt;
    expect(content_hash).toBe(observationCommitment(content));
    expect(commitment_algorithm).toBe('SHA-256');
  });
  it('replays in reverse order with identical commitments and preserves frozen records on late evidence', async () => {
    const a = fixture(), b = fixture();
    for (const s of samples()) await a.market.save(s);
    for (const s of samples().reverse()) await b.market.save(s);
    const original = await a.service.finalize(day);
    expect((await b.service.finalize(day)).content_hash).toBe(original.content_hash);
    await a.market.save({ ...samples().at(-1)!, snapshot_id: 'late-evidence', captured_at: '2026-10-14T00:30:00Z', provider_timestamp: '2026-10-13T23:55:00Z', liquidity_usd: 60000 });
    expect(await a.service.finalize(day)).toEqual(original);
    const correction = { supersedes: original.edition_id, reason: 'Late source evidence' };
    const revised = await a.service.finalize(day, correction);
    expect(revised.content_hash).not.toBe(original.content_hash);
    expect(await a.service.finalize(day, correction)).toEqual(revised);
    expect(await a.store.history(day)).toHaveLength(2);
    expect((await a.store.history(day)).find(r => !r.correction.supersedes)).toEqual(original);
    mkdirSync('docs/evidence/rh-pipeline-1c', { recursive: true });
    writeFileSync('docs/evidence/rh-pipeline-1c/synthetic-editions.json', JSON.stringify({ synthetic_only: true, original, revised }, null, 2));
  });
  it('excludes testnet, collisions and conflicting duplicates; exact contracts survive duplicate symbols', async () => {
    const f = fixture(), rows = samples();
    for (const s of rows) await f.market.save(s);
    await f.market.save({ ...rows.at(-1)!, snapshot_id: 'conflict', liquidity_usd: 55555 });
    await f.market.save({ ...rows[0], snapshot_id: 'testnet', chain_id: '46630' as never });
    await f.market.save({ ...rows[0], snapshot_id: 'second-symbol', token_address: '0x' + '2'.repeat(40), base_token: { ...rows[0].base_token!, address: '0x' + '2'.repeat(40) }, pair_address: '0x' + 'b'.repeat(40) });
    const result = await f.service.finalize(day);
    expect(result.markets).toHaveLength(2);
    expect(result.markets[0].metrics.liquidity_usd.delta).toBeNull();
    expect(result.historical_coverage.excluded_observation_ids).toEqual(['conflict', rows.at(-1)!.snapshot_id, 'testnet'].sort());
    const collision = fixture(); await collision.market.save(rows[0]);
    await collision.market.save({ ...rows[0], snapshot_id: 'collision', token_address: '0x' + '2'.repeat(40), base_token: { ...rows[0].base_token!, address: '0x' + '2'.repeat(40) } });
    expect((await collision.service.finalize(day)).markets).toEqual([]);
  });
  it('aborts source read failures, records pruned-series gaps and labels collection time proxies', async () => {
    const f = fixture(); await f.market.save({ ...samples()[0], provider_timestamp: null });
    expect((await f.service.finalize(day)).markets[0].evidence[0].time_basis).toBe('COLLECTION_PROXY');
    const pruned = fixture(); await pruned.market.save(samples()[0]); await pruned.market.pruneHistory(new Date('2027-01-01'));
    expect((await pruned.service.finalize(day)).historical_coverage.missing).toContain('RAW_SERIES_UNAVAILABLE_OR_OUTSIDE_OBSERVATION_DAY');
    const failed = fixture(); vi.spyOn(failed.market, 'editionInput').mockRejectedValue(new Error('storage_outage'));
    await expect(failed.service.finalize(day)).rejects.toThrow('storage_outage'); expect(await failed.store.history(day)).toEqual([]);
  });
  it('keeps independent publication and scheduling default off and requires separate authorization', async () => {
    const config = loadRuntimeConfig({ NODE_ENV: 'test' });
    expect(config.rhObservationPublicationEnabled).toBe(false); expect(config.rhObservationSchedulerEnabled).toBe(false);
    const f = fixture();
    const gated = new RhAutomatedObservationReceiptService({ ...f, days: new InMemoryRh4663UtcDayObservationStore(), now, publicationEnabled: true });
    await expect(gated.finalize(day)).rejects.toThrow('automatic_publication_authorization_required');
    expect(await f.store.published(day)).toEqual([]);
  });
  it('scheduler retries after failure, restarts and skips overlapping work', async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(), run = vi.fn().mockRejectedValueOnce(new Error('outage')).mockImplementation(() => f.service.runCompletedDays());
      const failed = vi.fn(), scheduler = startRhChainMarketScheduler(run, 1000, failed);
      await vi.advanceTimersByTimeAsync(0); expect(failed).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1000); await scheduler.stop();
      const restarted = startRhChainMarketScheduler(() => f.service.runCompletedDays(), 1000, failed);
      await vi.advanceTimersByTimeAsync(1000); await restarted.stop();
      expect(await f.store.history(day)).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});
describe.skipIf(!url)('durable daily edition PostgreSQL', () => {
  it('atomic concurrent finalization, restart, correction replay, immutable guards and populated rollback', async () => {
    const db = await createCanonicalTestDatabase(url!, 'daily_receipts', readdirSync('migrations').filter(n => n.endsWith('.up.sql')).sort().map(n => n.replace('.up.sql', '')));
    let restarted: pg.Pool | null = null;
    try {
      const market = new PostgresRhChainMarketSnapshotStore(db.pool); for (const s of samples()) await market.save(s);
      const store = new PostgresAutomatedObservationStore(db.pool), days = new InMemoryRh4663UtcDayObservationStore();
      const make = (s: PostgresAutomatedObservationStore) => new RhAutomatedObservationReceiptService({ store: s, market, days, now });
      const receipt = (await Promise.all(Array.from({ length: 12 }, () => make(store).finalize(day))))[0];
      expect(await store.history(day)).toHaveLength(1);
      restarted = new pg.Pool({ connectionString: url!, options: `-c search_path=${db.schema}` });
      expect(await make(new PostgresAutomatedObservationStore(restarted)).finalize(day)).toEqual(receipt);
      await db.pool.query("create function fail_edition() returns trigger language plpgsql as $$ begin raise exception 'simulated_write_failure'; end $$; create trigger fail_edition before insert on rh_automated_observation_receipts for each row execute function fail_edition()");
      await expect(make(store).finalize('2026-10-12')).rejects.toThrow('simulated_write_failure');
      expect(await store.history('2026-10-12')).toEqual([]); await db.pool.query('drop trigger fail_edition on rh_automated_observation_receipts');
      await make(store).finalize('2026-10-12');
      await market.save({ ...samples().at(-1)!, snapshot_id: 'late', provider_timestamp: '2026-10-13T23:55:00Z', captured_at: '2026-10-14T00:15:00Z', price_usd: 3 });
      const correction = { supersedes: receipt.edition_id, reason: 'Late source evidence' };
      const corrected = await Promise.all(Array.from({ length: 6 }, () => make(store).finalize(day, correction)));
      expect(new Set(corrected.map(r => r.content_hash)).size).toBe(1); expect(await store.history(day)).toHaveLength(2);
      await expect(db.pool.query('update rh_automated_observation_receipts set payload=$1 where edition_id=$2', [{}, receipt.edition_id])).rejects.toThrow('immutable');
      await expect(db.pool.query('delete from rh_automated_observation_receipts')).rejects.toThrow('immutable');
      await expectRollbackMigrationFailure(db.pool, '20261013_025_rh_automated_observation_receipts', 'immutable observation editions exist');
      expect((await store.history(day)).find(r => !r.correction.supersedes)).toEqual(receipt);
      expect((await market.editionInput(day)).observations).toHaveLength(14);
    } finally { await restarted?.end(); await db.close(); }
  }, 30000);
  it('rehearses empty rollback/reapply and rejects tampered commitments', async () => {
    const db = await createCanonicalTestDatabase(url!, 'daily_empty', ['20261013_025_rh_automated_observation_receipts']);
    try {
      await db.pool.query(readFileSync('migrations/20261013_025_rh_automated_observation_receipts.down.sql', 'utf8'));
      await db.pool.query(readFileSync('migrations/20261013_025_rh_automated_observation_receipts.up.sql', 'utf8'));
      const f = fixture(), receipt = await f.service.finalize(day), store = new PostgresAutomatedObservationStore(db.pool);
      await expect(store.finalize({ ...receipt, covered_contracts: ['tampered'] })).rejects.toThrow('commitment_mismatch');
      await expect(store.publish(receipt.edition_id, '')).rejects.toThrow('publication_authorization_required');
      expect(await store.history(day)).toEqual([]);
    } finally { await db.close(); }
  });
});
