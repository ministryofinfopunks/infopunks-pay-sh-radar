import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { InMemoryAutomatedObservationStore, RhAutomatedObservationReceiptService } from '../src/services/rhAutomatedObservationReceiptService';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryRh4663UtcDayObservationStore } from '../src/services/rh4663UtcDayObservationService';
afterEach(() => vi.restoreAllMocks());
it('keeps finalized private editions off public requests and protects operational finalization', async () => {
  const store = new InMemoryAutomatedObservationStore();
  const service = new RhAutomatedObservationReceiptService({ store, market: new InMemoryRhChainMarketSnapshotStore(), days: new InMemoryRh4663UtcDayObservationStore(), now: () => new Date('2026-10-14') });
  await service.finalize('2026-10-12');
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('remote_not_authorized'));
  const app = await createApp(undefined, undefined, { rhAutomatedObservationStore: store });
  try {
    const a = await app.inject('/v1/4663/daily-observations/2026-10-12'); expect(a.statusCode).toBe(200);
    expect(a.json().data.editions).toEqual([]); expect(a.headers['cache-control']).toContain('s-maxage=15');
    const b = await app.inject({ url: '/v1/4663/daily-observations/2026-10-12', headers: { 'if-none-match': a.headers.etag!, cookie: 'private=secret' } }); expect(b.statusCode).toBe(304);
    const denied = await app.inject({ method: 'POST', url: '/internal/4663/daily-observations/2026-10-12/finalize', payload: {} });
    expect([401, 403, 404]).toContain(denied.statusCode); expect(denied.headers['cache-control']).toBe('private, no-store');
    expect(network).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
