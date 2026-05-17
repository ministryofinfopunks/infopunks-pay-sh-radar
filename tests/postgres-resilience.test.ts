import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import { IntelligenceRepository, IntelligenceSnapshot } from '../src/persistence/repository';

function emptySnapshot(): IntelligenceSnapshot {
  return {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: []
  };
}

class FailingRepository implements IntelligenceRepository {
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432') as Error & { code?: string };
    error.code = 'ECONNREFUSED';
    throw error;
  }

  async saveSnapshot(): Promise<void> {
    const error = new Error('Connection terminated unexpectedly');
    throw error;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.DATABASE_URL;
  delete process.env.INGESTION_ENABLED;
  delete process.env.PAY_SH_INGEST_INTERVAL_MS;
  delete process.env.PAYSH_BOOTSTRAP_ENABLED;
});

describe('postgres resilience', () => {
  it('handles pool error events without throwing', () => {
    const repo = new PostgresRepository('postgres://example:test@localhost:5432/test');
    const pool = (repo as unknown as { pool: { emit: (event: string, error: Error) => boolean } }).pool;
    const emitted = pool.emit('error', new Error('Connection terminated unexpectedly'));
    expect(emitted).toBe(true);
    expect(repo.getDbStatus()).toBe('unavailable');
  });

  it('does not crash startup and keeps /health and /v1/pulse available when db is unavailable', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'true';
    const app = await createApp(undefined, new FailingRepository());

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);

    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    expect(pulse.statusCode).toBe(200);
    expect(pulse.json().data).toBeTruthy();

    await app.close();
  });

  it('keeps ingestion scheduler alive when repository writes fail', async () => {
    vi.useFakeTimers();
    process.env.INGESTION_ENABLED = 'true';
    process.env.PAY_SH_INGEST_INTERVAL_MS = '5';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';

    const app = await createApp(emptySnapshot(), new FailingRepository());
    vi.advanceTimersByTime(20);
    await Promise.resolve();

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);

    await app.close();
  });
});
