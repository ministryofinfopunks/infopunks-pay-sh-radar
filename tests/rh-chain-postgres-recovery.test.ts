import type pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type CreateAppOptions } from '../src/api/app';
import { RetryablePostgresSchema } from '../src/persistence/retryablePostgresSchema';
import { MemoryRepository } from '../src/persistence/repository';
import { InMemoryRhChainAutomationStore } from '../src/services/rhChainAutomationService';
import { InMemoryRhChainMetricsSnapshotStore, type RhChainMetricsSnapshotStore } from '../src/services/rhChainChainPulseService';
import { InMemoryRhChainDailyReceiptDraftStore } from '../src/services/rhChainDailyReceiptDraftService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRhChainLaunchpadSnapshotStore } from '../src/services/rhChainLaunchpadSnapshotService';
import { InMemoryRhChainMemePulseSnapshotStore } from '../src/services/rhChainMemePulseSnapshotService';
import { InMemoryRhChainRiskCorrelationSnapshotStore } from '../src/services/rhChainRiskCorrelationSweepService';
import { InMemoryRhChainSubmissionStore, PostgresRhChainSubmissionStore } from '../src/services/rhChainSignalVault';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DATABASE_URL;
});

function isolatedStores(overrides: Partial<CreateAppOptions> = {}): CreateAppOptions {
  return {
    rhChainSubmissionStore: new InMemoryRhChainSubmissionStore(),
    rhChainAutomationStore: new InMemoryRhChainAutomationStore(),
    rhChainMetricsSnapshotStore: new InMemoryRhChainMetricsSnapshotStore(),
    rhChainMemePulseSnapshotStore: new InMemoryRhChainMemePulseSnapshotStore(),
    rhChainLaunchpadSnapshotStore: new InMemoryRhChainLaunchpadSnapshotStore(),
    rhChainDailyReceiptDraftStore: new InMemoryRhChainDailyReceiptDraftStore(),
    rhChainRiskCorrelationSnapshotStore: new InMemoryRhChainRiskCorrelationSnapshotStore(),
    ...overrides
  };
}

describe('RH Chain Postgres recovery', () => {
  it('retries a rejected schema initialization instead of caching the failure', async () => {
    const failure = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    const query = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ rows: [], rowCount: 0 });
    const schema = new RetryablePostgresSchema('rh_chain_test_store');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(schema.ensure({ query } as unknown as Pick<pg.Pool, 'query'>, 'select 1')).rejects.toThrow('ECONNREFUSED');
    expect(schema.diagnostics()).toMatchObject({ readiness: 'degraded', failure_kind: 'connectivity', error_code: 'ECONNREFUSED' });
    await expect(schema.ensure({ query } as unknown as Pick<pg.Pool, 'query'>, 'select 1')).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledTimes(2);
    expect(schema.diagnostics()).toMatchObject({ readiness: 'ready', failure_kind: null, error_code: null });
    expect(log.mock.calls.some(([entry]) => String(entry).includes('rh_chain_storage_recovered'))).toBe(true);
  });

  it('allows a Postgres store to recover in the same process after its first schema query fails', async () => {
    const failure = Object.assign(new Error('temporary database connection failure'), { code: '08006' });
    const query = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const end = vi.fn();
    const store = new PostgresRhChainSubmissionStore({ query, end } as unknown as pg.Pool);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(store.list()).rejects.toThrow('temporary database connection failure');
    await expect(store.list()).resolves.toEqual([]);
    expect(store).toMatchObject({ adapter: 'postgres', durable: true });
    expect(query).toHaveBeenCalledTimes(3);
    await store.close();
    expect(end).not.toHaveBeenCalled();
  });

  it('isolates a metrics-store failure from review, scout, receipt, and distribution routes', async () => {
    const unavailableMetrics: RhChainMetricsSnapshotStore = {
      adapter: 'postgres',
      durable: true,
      async save() { throw new Error('not used'); },
      async latest() { throw Object.assign(new Error('database unavailable'), { code: '08006' }); }
    };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), isolatedStores({ rhChainMetricsSnapshotStore: unavailableMetrics }));
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/rh-chain' })).statusCode).toBe(500);
      for (const url of ['/v1/rh-chain/review-queue', '/v1/rh-chain/scouts', '/v1/rh-chain/daily-receipts', '/v1/rh-chain/distribution-pack']) {
        expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
      }
    } finally { await app.close(); }
  });

  it('does not expose database URLs, credentials, or connection details in RH 500 responses', async () => {
    const secretMessage = 'connect failed postgres://operator:super-secret@private-db:5432/radar password=super-secret';
    const unavailableMetrics: RhChainMetricsSnapshotStore = {
      adapter: 'postgres',
      durable: true,
      async save() { throw new Error('not used'); },
      async latest() { throw Object.assign(new Error(secretMessage), { code: '08006' }); }
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), isolatedStores({ rhChainMetricsSnapshotStore: unavailableMetrics }));
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain?token=do-not-log' });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Internal Server Error' });
      expect(response.body).not.toContain('private-db');
      expect(response.body).not.toContain('super-secret');
      const operationalLog = log.mock.calls.map(([entry]) => String(entry)).find((entry) => entry.includes('"event":"request_errored"')) ?? '';
      expect(operationalLog).toContain('"route":"/v1/rh-chain"');
      expect(operationalLog).toContain('"service":"rh_chain_signal_desk"');
      expect(operationalLog).toContain('"operation":"read_signal_desk"');
      expect(operationalLog).toContain('[REDACTED_DATABASE_URL]');
      expect(operationalLog).not.toContain('super-secret');
      expect(operationalLog).not.toContain('do-not-log');
    } finally { await app.close(); }
  });

  it('keeps successful public route contracts unchanged with durable dependencies available', async () => {
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), isolatedStores());
    try {
      for (const url of ['/v1/rh-chain', '/v1/rh-chain/daily-receipts', '/v1/rh-chain/review-queue', '/v1/rh-chain/clone-radar', '/v1/rh-chain/scouts', '/v1/rh-chain/distribution-pack']) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(expect.objectContaining({ data: expect.any(Object), meta: expect.any(Object), generated_at: expect.any(String) }));
      }
    } finally { await app.close(); }
  });
});
