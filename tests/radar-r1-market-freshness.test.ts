import { afterEach, describe, expect, it, vi } from 'vitest';
import { listUnicornRadarCandidates } from '../src/data/unicornRadar';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('R1 provider observation provenance', () => {
  it('preserves original observation time on cache hit and retains unknown orders data', async () => {
    vi.resetModules(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
    const candidate = listUnicornRadarCandidates().find(item => item.verificationStatus === 'verified_live_market')!;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return Promise.resolve(new Response(JSON.stringify(url.includes('/orders/') ? {} : [{ chainId: candidate.chainId, pairAddress: 'provider-pair', baseToken: { address: candidate.tokenAddress }, priceUsd: '1' }]), { status: url.includes('/orders/') ? 503 : 200, headers: { 'content-type': 'application/json' } }));
    }); vi.stubGlobal('fetch', fetch);
    const { enrichUnicornCandidate } = await import('../src/services/dexScreenerService');
    const first = await enrichUnicornCandidate(candidate);
    vi.setSystemTime(new Date('2026-10-14T00:01:00Z'));
    const second = await enrichUnicornCandidate(candidate);
    expect(first.marketDataUpdatedAt).toBe('2026-10-14T00:00:00.000Z');
    expect(second.marketDataUpdatedAt).toBe(first.marketDataUpdatedAt);
    expect(second.dexScreenerData).toMatchObject({ boosts: null, paidOrders: null });
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/token-pairs/'))).toHaveLength(1);
  });
  it('does not refresh historical timestamps when the provider fails', async () => {
    vi.resetModules(); const candidate = listUnicornRadarCandidates().find(item => item.verificationStatus === 'verified_live_market')!;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));
    const { enrichUnicornCandidate } = await import('../src/services/dexScreenerService');
    expect(await enrichUnicornCandidate(candidate)).toEqual(candidate);
  });
});
