// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rh4663MarketCategories } from '../src/web/marketIntelligence/rh4663MarketCategories';
import { RhChainCategoryIntelligenceService } from '../src/services/rhChainCategoryIntelligenceService';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';
import { useRh4663FrontdoorRead } from '../src/web/marketIntelligence/rh4663FrontdoorRead';

let cleanup = () => {};
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
function render(element: React.ReactElement) { const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); act(() => root.render(element)); cleanup = () => { act(() => root.unmount()); host.remove(); }; return host; }
async function projection() { return new RhChainCategoryIntelligenceService({ movers: async () => deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(moverNow)), identities: async () => [], snapshots: async () => ({ [contract]: moverSamples() }), stockEvidence: async () => null, now: () => new Date(moverNow) }).read(); }
describe('category evidence interaction states', () => {
  it('renders all category lanes, source links, observation time and empty specialized coverage without implying review', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(moverNow)); const host = render(<Rh4663MarketCategories market={await projection()} />);
    expect(host.querySelectorAll('summary')).toHaveLength(5); expect(host.textContent).toContain('Stock Tokens'); expect(host.textContent).toContain('Stables');
    expect(host.textContent).toContain('No eligible stored observations'); expect(host.textContent).not.toContain('VERIFIED');
    expect(host.querySelector('time')?.dateTime).toBe(moverNow); expect(host.querySelector('a[href^="https://dexscreener.com"]')).not.toBeNull();
  });
  it('removes expired observations from current lanes and keeps a truthful stale explanation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(Date.parse(moverNow) + 16 * 60000));
    const host = render(<Rh4663MarketCategories market={await projection()} />); expect(host.querySelector('time')).toBeNull(); expect(host.textContent).toContain('Last-known observations have expired');
  });
  it('shows accessible loading and unavailable states with an investigation route', () => {
    const host = render(<Rh4663MarketCategories unavailable />); expect(host.querySelector('[role="status"]')?.textContent).toContain('unavailable');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/rh-chain-signal-desk');
  });
  it('revalidates with ETag, retains last-known evidence on failure and pauses requests in hidden tabs', async () => {
    vi.useFakeTimers(); let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ data: { generated_at: moverNow } }), { headers: { etag: '"frontdoor-8"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 })).mockRejectedValueOnce(new Error('offline'));
    function Probe() { const s = useRh4663FrontdoorRead(); return <p>{s.status} {s.data?.generated_at}</p>; }
    const host = render(<Probe />); await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(host.textContent).toContain('ready'); await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'omit', cache: 'no-cache', headers: { 'if-none-match': '"frontdoor-8"' } });
    hidden = true; await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); expect(fetcher).toHaveBeenCalledTimes(2);
    hidden = false; await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(1); });
    expect(host.textContent).toContain('degraded'); expect(host.textContent).toContain(moverNow);
  });
});
