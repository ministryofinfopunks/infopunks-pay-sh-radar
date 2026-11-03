/** Serializes jobs which mutate the shared intelligence store. Timer ticks are
 * coalesced per job into at most one follow-up while that job is outstanding. */
export class StoreJobCoordinator {
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  private closePromise: Promise<void> | null = null;
  private scheduled = new Map<string, { pending: boolean }>();

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error('store_jobs_stopped'));
    const next = this.tail.then(() => {
      if (this.closed) throw new Error('store_jobs_stopped');
      return work();
    });
    this.tail = next.catch(() => undefined);
    return next;
  }

  schedule(name: string, work: () => Promise<void>, onError: (error: unknown) => void): void {
    if (this.closed) return;
    const existing = this.scheduled.get(name);
    if (existing) { existing.pending = true; return; }
    const state = { pending: false };
    this.scheduled.set(name, state);
    const drain = async () => {
      try {
        do {
          state.pending = false;
          try { await this.run(work); } catch (error) {
            if (!this.closed) {
              try { onError(error); } catch { /* A logging failure must not strand the guard. */ }
            }
          }
        } while (!this.closed && state.pending);
      } finally {
        this.scheduled.delete(name);
      }
    };
    void drain();
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.closed = true;
    for (const state of this.scheduled.values()) state.pending = false;
    // `tail` absorbs job failures for queue progress. The caller's `run()`
    // promise still reports its own failure, while shutdown only waits for the
    // queue to settle and never inherits that failure.
    this.closePromise = this.tail.then(() => undefined);
    return this.closePromise;
  }
}
