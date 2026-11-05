import { afterEach, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { createApp } from '../src/api/app';
import { InMemoryRhChainAutomationStore, PostgresRhChainAutomationStore, RhChainAutomationService, type RhChainAutomationStore } from '../src/services/rhChainAutomationService';
import { RhChainLiveSnapshotService } from '../src/services/rhChainLiveSnapshotService';
import { InMemoryRhChainSubmissionStore } from '../src/services/rhChainSignalVault';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
const name = 'rh_4663_intelligence_refresh' as const;
function coordinator(store: RhChainAutomationStore, work: () => Promise<void>) {
  return new RhChainAutomationService({ enabled: true, isProduction: false, instanceId: 'same-instance', lockTtlMs: 10, store,
    snapshots: new RhChainLiveSnapshotService({ enabled: false, timeoutMs: 10 }), submissions: new InMemoryRhChainSubmissionStore(),
    rh4663IntelligenceRun: async () => { await work(); return { observations: 0, events: 0, candidates: 0, publications: 0, providers: [] }; } });
}
afterEach(() => vi.useRealTimers());

describe('RH automation safety', () => {
  it('blocks a second coordinator beyond the old TTL and recovers after the job finishes or fails', async () => {
    vi.useFakeTimers(); const store = new InMemoryRhChainAutomationStore(); const gate = deferred(); const entered = deferred();
    const a = coordinator(store, async () => { entered.resolve(); await gate.promise; throw new Error('provider failed'); });
    const b = coordinator(store, async () => {}); const first = a.run(name); await entered.promise;
    await vi.advanceTimersByTimeAsync(100);
    expect((await b.run(name)).status).toBe('locked');
    gate.resolve(); expect((await first).status).toBe('failed'); expect((await b.run(name)).status).toBe('success');
  });
  it('fails closed after an ambiguous acquisition or a failed release', async () => {
    class AmbiguousStore extends InMemoryRhChainAutomationStore {
      failAcquire = true; failRelease = false;
      override async tryAcquireLock(...args: Parameters<InMemoryRhChainAutomationStore['tryAcquireLock']>) {
        const acquired = await super.tryAcquireLock(...args);
        if (acquired && this.failAcquire) { this.failAcquire = false; throw new Error('response lost'); }
        return acquired;
      }
      override async releaseLock(...args: Parameters<InMemoryRhChainAutomationStore['releaseLock']>) {
        if (this.failRelease) throw new Error('release failed');
        await super.releaseLock(...args);
      }
    }
    const store = new AmbiguousStore(); const jobs = coordinator(store, async () => {});
    expect((await jobs.run(name)).status).toBe('failed');
    expect((await jobs.run(name)).status).toBe('locked');
    // Recovery is permitted only after the possible owner is known to have stopped.
    const owner = (await store.listRuns()).find(run => run.error_summary === 'response lost')!.job_id;
    await store.releaseLock(name, owner); store.failRelease = true;
    expect((await jobs.run(name)).status).toBe('success');
    expect((await jobs.run(name)).status).toBe('locked');
  });
  it('does not let a stale owner release a successor lock', async () => {
    const store = new InMemoryRhChainAutomationStore();
    expect(await store.tryAcquireLock(name, 'old', 1)).toBe(true);
    await store.releaseLock(name, 'old'); expect(await store.tryAcquireLock(name, 'new', 1)).toBe(true);
    await store.releaseLock(name, 'old'); expect(await store.tryAcquireLock(name, 'third', 1)).toBe(false);
  });
  it('stops admission and drains active work before resource closure, even on repeated close', async () => {
    const gate = deferred(); const entered = deferred(); const events: string[] = []; const store = new InMemoryRhChainAutomationStore();
    const jobs = coordinator(store, async () => { entered.resolve(); await gate.promise; events.push('job finished'); });
    const running = jobs.run(name); await entered.promise;
    const closing = jobs.close().then(() => { events.push('resources closed'); });
    const again = jobs.close(); await expect(jobs.run(name)).rejects.toThrow('rh_chain_automation_stopped');
    await Promise.resolve(); expect(events).toEqual([]);
    gate.resolve(); await running; await Promise.all([closing, again]); expect(events).toEqual(['job finished', 'resources closed']);
  });
  it('drains a scheduled job before the application closes its store', async () => {
    const previous = { ...process.env }; const gate = deferred(); const entered = deferred(); const events: string[] = [];
    class BlockingStore extends InMemoryRhChainAutomationStore {
      override async saveDraft(draft: Parameters<InMemoryRhChainAutomationStore['saveDraft']>[0]) {
        entered.resolve(); await gate.promise; events.push('job write'); await super.saveDraft(draft);
      }
      async close() { events.push('store closed'); }
    }
    process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_AUTOMATION_ENABLED = 'true';
    process.env.RH_CHAIN_CHAIN_PULSE_INTERVAL_MS = '10'; process.env.RH_CHAIN_MEME_PULSE_INTERVAL_MS = '100000'; process.env.RH_CHAIN_LAUNCHPAD_INTERVAL_MS = '100000';
    const app = await createApp(undefined, undefined, { rhChainAutomationStore: new BlockingStore() });
    try {
      await app.ready(); await entered.promise;
      const closing = app.close(); await new Promise(resolve => setTimeout(resolve, 30));
      expect(events).toEqual([]); gate.resolve(); await closing;
      expect(events.indexOf('job write')).toBeGreaterThanOrEqual(0);
      expect(events.indexOf('store closed')).toBeGreaterThan(events.lastIndexOf('job write'));
      await app.close();
    } finally { gate.resolve(); await app.close(); process.env = previous; }
  });

});

const dbUrl = process.env.RH_SAFETY_TEST_DATABASE_URL;
describe.skipIf(!dbUrl)('disposable PostgreSQL RH locks', () => {
  it('blocks expired legacy rows and concurrent owners; releases only the exact owner', async () => {
    const pool = new pg.Pool({ connectionString: dbUrl }); const a = new PostgresRhChainAutomationStore(pool); const b = new PostgresRhChainAutomationStore(pool);
    try {
      await a.tryAcquireLock(name, 'old', 1);
      await pool.query("update rh_chain_automation_locks set locked_until = now() - interval '1 hour' where job_name=$1", [name]);
      expect(await b.tryAcquireLock(name, 'new', 1)).toBe(false);
      await a.releaseLock(name, 'old');
      const results = await Promise.all([a.tryAcquireLock(name, 'one', 1), b.tryAcquireLock(name, 'two', 1)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const owner = results[0] ? 'one' : 'two'; const stale = results[0] ? 'two' : 'one';
      await b.releaseLock(name, stale); expect(await b.tryAcquireLock(name, 'third', 1)).toBe(false);
      await a.releaseLock(name, owner); expect(await b.tryAcquireLock(name, 'third', 1)).toBe(true);
      await b.releaseLock(name, 'third');
    } finally { await pool.end(); }
  });
});
