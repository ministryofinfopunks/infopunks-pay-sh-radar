import { describe, expect, it, vi } from 'vitest';
import { StoreJobCoordinator } from '../src/services/storeJobCoordinator';

function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe('shared store job coordination', () => {
  it('waits for startup store loading before starting scheduled work', async () => {
    const jobs = new StoreJobCoordinator(); const gate = deferred(); const order: string[] = [];
    const startup = jobs.run(async () => { order.push('startup'); await gate.promise; order.push('loaded'); });
    jobs.schedule('monitor', async () => { order.push('monitor'); }, vi.fn());
    jobs.schedule('ingestion', async () => { order.push('ingestion'); }, vi.fn());
    await flush(); expect(order).toEqual(['startup']);
    gate.resolve(); await startup; await flush();
    expect(order).toEqual(['startup', 'loaded', 'monitor', 'ingestion']);
    await jobs.close();
  });

  it('coalesces ticks to one follow-up and serializes different jobs', async () => {
    const jobs = new StoreJobCoordinator();
    const gate = deferred();
    const order: string[] = [];
    let count = 0;
    const ingestion = async () => { order.push(`ingest-${++count}`); if (count === 1) await gate.promise; };
    const monitor = async () => { order.push('monitor'); };
    jobs.schedule('ingestion', ingestion, vi.fn());
    await flush();
    jobs.schedule('ingestion', ingestion, vi.fn());
    jobs.schedule('ingestion', ingestion, vi.fn());
    jobs.schedule('monitor', monitor, vi.fn());
    await flush();
    expect(order).toEqual(['ingest-1']);
    gate.resolve(); await flush();
    expect(order).toEqual(['ingest-1', 'monitor', 'ingest-2']);
    await jobs.close();
  });

  it('releases after failure and runs the pending and later ticks', async () => {
    const jobs = new StoreJobCoordinator();
    const gate = deferred(); const errors = vi.fn(); let count = 0;
    const work = async () => { count++; if (count === 1) { await gate.promise; throw new Error('synthetic'); } };
    jobs.schedule('monitor', work, errors); await flush();
    jobs.schedule('monitor', work, errors); gate.resolve(); await flush();
    expect(count).toBe(2); expect(errors).toHaveBeenCalledTimes(1);
    jobs.schedule('monitor', work, errors); await flush();
    expect(count).toBe(3); await jobs.close();
  });

  it('keeps close pending for active work and prevents queued and future jobs from starting', async () => {
    const jobs = new StoreJobCoordinator(); const gate = deferred(); const started: string[] = [];
    const active = jobs.run(async () => { started.push('active'); await gate.promise; });
    await flush();
    const queuedWork = vi.fn(async () => { started.push('queued'); });
    const queued = jobs.run(queuedWork);
    const close = jobs.close(); let closeResolved = false;
    void close.then(() => { closeResolved = true; });

    const queuedFailure = expect(queued).rejects.toThrow('store_jobs_stopped');
    await expect(jobs.run(async () => { started.push('future'); })).rejects.toThrow('store_jobs_stopped');
    jobs.schedule('monitor', async () => { started.push('scheduled'); }, vi.fn());
    await flush();
    expect(closeResolved).toBe(false);
    expect(started).toEqual(['active']);
    expect(queuedWork).not.toHaveBeenCalled();

    gate.resolve();
    await active;
    await queuedFailure;
    await close;
    expect(closeResolved).toBe(true);
    expect(started).toEqual(['active']);
  });

  it('resolves repeated close calls after an active job fails without swallowing its caller error', async () => {
    const jobs = new StoreJobCoordinator(); const gate = deferred();
    const active = jobs.run(async () => { await gate.promise; });
    await flush();
    const callerFailure = expect(active).rejects.toThrow('active_job_failed');
    const firstClose = jobs.close(); let closeResolved = false;
    void firstClose.then(() => { closeResolved = true; });
    const secondClose = jobs.close();
    expect(secondClose).toBe(firstClose);
    await flush();
    expect(closeResolved).toBe(false);

    gate.reject(new Error('active_job_failed'));
    await callerFailure;
    await Promise.all([firstClose, secondClose, jobs.close()]);
    expect(closeResolved).toBe(true);
  });
});
