import { describe, expect, it, vi } from 'vitest';
import { StoreJobCoordinator } from '../src/services/storeJobCoordinator';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
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

  it('finishes the active run but rejects queued and future work at shutdown', async () => {
    const jobs = new StoreJobCoordinator(); const gate = deferred(); const work = vi.fn(async () => { await gate.promise; });
    jobs.schedule('monitor', work, vi.fn()); await flush();
    jobs.schedule('monitor', work, vi.fn());
    const queued = jobs.run(async () => 'queued');
    const closed = jobs.close();
    jobs.schedule('ingestion', async () => { throw new Error('must not run'); }, vi.fn());
    gate.resolve(); await expect(queued).rejects.toThrow('store_jobs_stopped'); await closed; await flush();
    expect(work).toHaveBeenCalledTimes(1);
    await expect(jobs.run(async () => 1)).rejects.toThrow('store_jobs_stopped');
  });
});
