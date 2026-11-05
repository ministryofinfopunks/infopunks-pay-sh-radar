import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import type { IntelligenceSnapshot, MonitorDelta } from '../src/persistence/repository';
import { emptyIntelligenceStore, createIntelligenceStore, recomputeAssessments } from '../src/services/intelligenceStore';
import { runMonitor } from '../src/services/endpointMonitorService';

const databaseUrl = process.env.RADAR_TEST_DATABASE_URL;
const describeWithLocalPostgres18 = databaseUrl && isLoopbackDatabase(databaseUrl) ? describe : describe.skip;
let integrationPool: pg.Pool;

describeWithLocalPostgres18('isolated PostgreSQL 18 monitor delta persistence', () => {
  const adminPool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const schema = `monitor_delta_${process.pid}_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let repository: PostgresRepository;

  beforeAll(async () => {
    await adminPool.query(`create schema "${schema}"`);
    pool = new pg.Pool({ connectionString: databaseUrl, max: 4, options: `-c search_path=${schema}` });
    integrationPool = pool;
    repository = new PostgresRepository(pool);
    const version = await pool.query<{ version: string; version_num: string }>(`select current_setting('server_version') as version, current_setting('server_version_num') as version_num`);
    expect(Number(version.rows[0]?.version_num)).toBeGreaterThanOrEqual(180000);
    console.log(`RADAR_ISOLATED_POSTGRES_VERSION=${version.rows[0]?.version}`);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool.query(`drop schema if exists "${schema}" cascade`);
    await adminPool.end();
  });

  it('persists monitor deltas only and restores the accepted intelligence state', async () => {
    const accepted = makeAcceptedSnapshot();
    await repository.saveSnapshot(accepted);
    const beforeSnapshotCount = await countRows('intelligence_snapshots');
    const beforeEventCount = await countRows('infopunks_events');
    const store = await createIntelligenceStore(repository);
    const result = await runMonitor(store, repository, {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response('', { status: 200 })
    });
    const endpointResult = await runMonitor(store, repository, {
      mode: 'endpoint_health',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    });

    expect(result.run.status).toBe('succeeded');
    expect(endpointResult.run.status).toBe('succeeded');
    expect(store.endpoints[0]?.status).toBe('available');
    expect(store.endpoints[0]?.latencyMsP50).toBeTypeOf('number');
    expect(await countRows('intelligence_snapshots')).toBe(beforeSnapshotCount);
    expect(await countRows('infopunks_events')).toBeGreaterThan(beforeEventCount);
    expect(await countWhere('monitor_runs', 'snapshot_id = (select max(id) from intelligence_snapshots)')).toBe(2);

    const restored = await createIntelligenceStore(repository);
    expect(restored.providers).toEqual(store.providers);
    expect(restored.endpoints).toEqual(store.endpoints);
    expect(restored.events.map(projectEvent)).toEqual(store.events.map(projectEvent));
    expect(restored.monitorRuns.map(projectRun)).toEqual(store.monitorRuns.map(projectRun));
    expect(restored.trustAssessments).toEqual(store.trustAssessments);
    expect(restored.signalAssessments).toEqual(store.signalAssessments);
    expect(restored.narratives).toEqual(store.narratives);
    expect(restored.dataSource).toEqual(store.dataSource);
  });

  it('rolls event writes back and reports a monitor-run persistence failure', async () => {
    const delta = sampleDelta();
    const beforeEvents = await countRows('infopunks_events');
    const beforeRuns = await countRows('monitor_runs');
    await pool.query(`create function fail_monitor_delta() returns trigger language plpgsql as $$ begin raise exception 'injected monitor run failure'; end $$`);
    await pool.query(`create trigger fail_monitor_delta before insert on monitor_runs for each row execute function fail_monitor_delta()`);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(repository.saveMonitorDelta(delta)).rejects.toThrow('injected monitor run failure');
      expect(await countRows('infopunks_events')).toBe(beforeEvents);
      expect(await countRows('monitor_runs')).toBe(beforeRuns);
      expect(log.mock.calls.some(([value]) => String(value).includes('"event":"monitor_delta_persistence"') && String(value).includes('"outcome":"failure"'))).toBe(true);
    } finally {
      log.mockRestore();
      await pool.query('drop trigger fail_monitor_delta on monitor_runs');
      await pool.query('drop function fail_monitor_delta()');
    }
  });

  it('serializes concurrent full-snapshot and monitor-delta writes around one checkpoint', async () => {
    const baseline = makeAcceptedSnapshot();
    await repository.saveSnapshot(baseline);
    const delta = sampleDelta(baseline.providers[0]!.id);
    await Promise.all([repository.saveMonitorDelta(delta), repository.saveSnapshot(baseline)]);

    const restored = await createIntelligenceStore(repository);
    expect(restored.events.filter((event) => event.id === delta.events[0]?.id)).toHaveLength(1);
    expect(restored.monitorRuns.filter((run) => run.id === delta.run.id)).toHaveLength(1);
    expect(restored.providers[0]?.evidence.filter((item) => item.eventId === delta.events[0]?.id)).toHaveLength(1);
  });

  it('keeps a representative monitor payload bounded relative to the full snapshot', async () => {
    let snapshot = makeAcceptedSnapshot();
    const beforeSnapshots = await countRows('intelligence_snapshots');
    const syntheticHistory = Array.from({ length: 500 }, (_, index) => ({
      id: `synthetic-history-${index}`,
      type: 'provider.checked' as const,
      source: 'synthetic:history',
      entityType: 'provider' as const,
      entityId: snapshot.providers[0]!.id,
      observedAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
      payload: { providerId: snapshot.providers[0]!.id, note: 'x'.repeat(900) }
    }));
    snapshot.events.push(...syntheticHistory);
    snapshot = recomputeAssessments(snapshot);
    await repository.saveSnapshot(snapshot);
    const persistedBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    const store = await createIntelligenceStore(repository);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let jsonbTextBytes = 0;
    let deltaBytes = 0;
    try {
      await runMonitor(store, repository, { mode: 'safe_metadata', fetchImpl: async () => new Response('', { status: 200 }) });
      const deltaLog = log.mock.calls.map(([value]) => String(value)).map(parseJson).find((value) => value?.event === 'monitor_delta_persistence');
      deltaBytes = Number(deltaLog?.parameter_bytes ?? 0);
      const row = await pool.query<{ bytes: number }>('select octet_length(snapshot::text) as bytes from intelligence_snapshots order by id desc limit 1');
      jsonbTextBytes = Number(row.rows[0]?.bytes);
      expect(jsonbTextBytes).toBeGreaterThan(400_000);
      expect(deltaBytes).toBeGreaterThan(0);
      expect(deltaBytes).toBeLessThan(persistedBytes / 10);
      expect(await countRows('intelligence_snapshots')).toBe(beforeSnapshots + 1);
    } finally {
      log.mockRestore();
    }
    console.log(JSON.stringify({ event: 'synthetic_monitor_payload_size', full_snapshot_json_bytes: persistedBytes, full_snapshot_jsonb_text_bytes: jsonbTextBytes, monitor_delta_json_bytes: deltaBytes }));
  });
});

function makeAcceptedSnapshot(): IntelligenceSnapshot {
  const accepted = applyPayShCatalogIngestion(emptyIntelligenceStore(), [{
    name: 'Synthetic monitor provider', namespace: 'pay/monitor', slug: 'monitor', category: 'Data', endpoints: 1,
    price: '$0.01', status: 'metered', description: 'Synthetic integration provider.', tags: ['synthetic'],
    endpointDetails: [{ name: 'Health', path: '/health', method: 'GET', category: 'Data', description: 'Synthetic endpoint.', status: 'available', schema: { monitorUrl: 'https://health.synthetic.test/health' } }]
  }], {
    source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
    observedAt: '2026-01-01T00:05:00.000Z',
    dataSource: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: '2026-01-01T00:00:00.000Z', provider_count: 1, last_ingested_at: '2026-01-01T00:05:00.000Z', used_fixture: false, error: null }
  }).snapshot;
  accepted.providers[0]!.serviceUrl = 'https://status.synthetic.test';
  return recomputeAssessments(accepted);
}

function sampleDelta(providerId = 'synthetic-provider'): MonitorDelta {
  const observedAt = '2026-01-02T00:00:00.000Z';
  const eventId = `monitor-event-${randomUUID()}`;
  return {
    run: { id: `monitor-run-${randomUUID()}`, startedAt: observedAt, finishedAt: observedAt, source: 'synthetic:monitor', status: 'succeeded', checkedCount: 1, successCount: 1, failedCount: 0, skippedCount: 0, errorCount: 0, error: null, mode: 'safe_metadata', reachableCount: 1, degradedCount: 0, skippedReasons: [] },
    events: [{ id: eventId, type: 'provider.checked', source: 'synthetic:monitor', entityType: 'provider', entityId: providerId, observedAt, payload: { providerId, success: true, checked_at: observedAt } }],
    state: { providerEvidence: [{ providerId, evidence: [{ eventId, event_id: eventId, eventType: 'provider.checked', event_type: 'provider.checked', providerId, provider_id: providerId, endpointId: null, endpoint_id: null, source: 'synthetic:monitor', observedAt, observed_at: observedAt, summary: 'synthetic', value: { success: true } }] }], endpointUpdates: [] }
  };
}

function isLoopbackDatabase(value: string) {
  try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(value).hostname); } catch { return false; }
}

function parseJson(value: string): Record<string, unknown> | null {
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
}

function projectEvent(event: import('../src/schemas/entities').InfopunksEvent) {
  return { id: event.id, type: event.type, source: event.source, entityType: event.entityType, entityId: event.entityId, observedAt: event.observedAt, payload: event.payload, severity: event.severity, severity_reason: event.severity_reason, severity_score: event.severity_score };
}

function projectRun(run: import('../src/schemas/entities').MonitorRun) {
  return { id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, source: run.source, status: run.status, checkedCount: run.checkedCount, successCount: run.successCount, failedCount: run.failedCount, skippedCount: run.skippedCount, errorCount: run.errorCount, error: run.error, mode: run.mode ?? null, reachableCount: run.reachableCount ?? null, degradedCount: run.degradedCount ?? null, skippedReasons: run.skippedReasons ?? [] };
}

async function countRows(table: string) {
  const result = await integrationPool.query<{ count: string }>(`select count(*)::text as count from ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function countWhere(table: string, where: string) {
  const result = await integrationPool.query<{ count: string }>(`select count(*)::text as count from ${table} where ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}
