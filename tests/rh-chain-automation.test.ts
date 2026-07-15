import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { InMemoryRhChainAutomationStore, RhChainAutomationService } from '../src/services/rhChainAutomationService';
import { RhChainLiveSnapshotService } from '../src/services/rhChainLiveSnapshotService';
import { InMemoryRhChainSubmissionStore } from '../src/services/rhChainSignalVault';

const automationEnv = [
  'NODE_ENV', 'RH_CHAIN_AUTOMATION_ENABLED', 'RH_CHAIN_REVIEW_CONSOLE_ENABLED', 'RH_CHAIN_REVIEW_ADMIN_TOKEN',
  'RH_CHAIN_CHAIN_PULSE_INTERVAL_MS', 'RH_CHAIN_MEME_PULSE_INTERVAL_MS', 'RH_CHAIN_LAUNCHPAD_INTERVAL_MS'
] as const;
const originalEnv = new Map(automationEnv.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of automationEnv) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function service(options: Partial<ConstructorParameters<typeof RhChainAutomationService>[0]> = {}) {
  return new RhChainAutomationService({
    enabled: true,
    isProduction: false,
    instanceId: 'test-instance',
    lockTtlMs: 60_000,
    store: new InMemoryRhChainAutomationStore(),
    snapshots: new RhChainLiveSnapshotService({ enabled: false, timeoutMs: 10 }),
    submissions: new InMemoryRhChainSubmissionStore(),
    ...options
  });
}

describe('RH Chain automation', () => {
  it('is disabled by default and records a skipped run', async () => {
    const jobs = service({ enabled: false });
    const run = await jobs.run('rh_chain_pulse_refresh');
    expect(run).toMatchObject({ status: 'skipped', error_summary: 'rh_chain_automation_disabled', records_updated: 0 });
    expect(await jobs.listRuns()).toEqual([run]);
  });

  it('requires a durable lock before production work', async () => {
    const jobs = service({ isProduction: true });
    const run = await jobs.run('rh_chain_pulse_refresh');
    expect(run).toMatchObject({ status: 'skipped', error_summary: 'durable_lock_required_in_production' });
  });

  it('does not permit overlapping runs from the same local instance', async () => {
    const store = new InMemoryRhChainAutomationStore();
    expect(await store.tryAcquireLock('rh_chain_pulse_refresh', 'instance-a', 60_000)).toBe(true);
    expect(await store.tryAcquireLock('rh_chain_pulse_refresh', 'instance-a', 60_000)).toBe(false);
  });

  it('logs successful draft-only job runs', async () => {
    const jobs = service();
    const run = await jobs.run('rh_daily_receipt_draft');
    expect(run).toMatchObject({ job_name: 'rh_daily_receipt_draft', status: 'success', finished_at: expect.any(String) });
    expect(run.sources.length).toBeGreaterThan(0);
    expect((await jobs.listRuns())[0]).toEqual(run);
  });

  it('isolates provider failure from other jobs', async () => {
    const snapshots = new RhChainLiveSnapshotService({
      enabled: true,
      timeoutMs: 10,
      providers: {
        chainMetrics: async () => { throw new Error('provider_timeout'); },
        memeCategory: async () => ({ market_cap_usd: 1, volume_24h_usd: 1, top_assets: [], source_timestamp: '2026-07-15T00:00:00.000Z' })
      }
    });
    const jobs = service({ snapshots });
    const pulse = await jobs.run('rh_chain_pulse_refresh');
    const observatory = await jobs.run('rh_launchpad_observatory_refresh');
    expect(pulse.status).toBe('success');
    expect(observatory.status).toBe('success');
  });

  it('fails closed for internal manual triggers without Review Console auth', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RH_CHAIN_AUTOMATION_ENABLED = 'true';
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
    const app = await createApp(undefined, undefined, { rhChainAutomationStore: new InMemoryRhChainAutomationStore() });
    const unauthenticated = await app.inject({ method: 'POST', url: '/internal/rh-chain/jobs/rh_chain_pulse_refresh/run' });
    expect(unauthenticated.statusCode).toBe(401);
    const authenticated = await app.inject({ method: 'POST', url: '/internal/rh-chain/jobs/rh_chain_pulse_refresh/run', headers: { authorization: 'Bearer review-secret' } });
    expect(authenticated.statusCode).toBe(200);
    expect(authenticated.json().data.run.status).toBe('success');
    const runs = await app.inject({ method: 'GET', url: '/internal/rh-chain/jobs', headers: { authorization: 'Bearer review-secret' } });
    expect(runs.statusCode).toBe(200);
    expect(runs.json().data.runs).toHaveLength(1);
    await app.close();
  });
});
