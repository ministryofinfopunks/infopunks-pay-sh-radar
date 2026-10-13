// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DailyObservationCard, OpenLoopCard, PulseCard, FreshnessBadge } from '../src/web/frontdoor4663';
import type { OpenLoop } from '../src/services/rh4663FrontdoorService';
let root: Root | null = null, container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(element: React.ReactNode) { container = document.createElement('div'); document.body.append(container); await act(async () => { root = createRoot(container!); root.render(element); }); return container; }
it('counts a loop view only with visible viewport evidence, never from mounting', async () => {
  let callback: IntersectionObserverCallback | null = null;
  class Observer { constructor(cb: IntersectionObserverCallback) { callback = cb; } observe() {} disconnect() {} }
  vi.stubGlobal('IntersectionObserver', Observer);
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  const at = new Date().toISOString(), loop: OpenLoop = { loop_id: 'market-coverage:0x1111111111111111111111111111111111111111', question: 'Which input is missing?', short_context: 'Category coverage', source_type: 'market_observation', source_ref: { source_type: 'market_observation', source_id: 'snapshot', href: '/v1/rh-chain/market/snapshots/contract', observed_at: at }, state: 'BLOCKED_BY_DATA', opened_at: at, last_changed_at: at, expected_checkpoint_at: null, expected_resolution_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: 'Market observations', next_evidence_needed: 'Issuer terms', resolution_condition: 'Inputs present', falsification_condition: 'Identity disagreement', deep_link: '/4663#market-categories', priority_reason: 'Coverage gap' };
  await render(<OpenLoopCard loop={loop} />); expect(fetch).not.toHaveBeenCalled();
  callback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver); expect(fetch).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  callback!([{ isIntersecting: true, intersectionRatio: .5 } as IntersectionObserverEntry], {} as IntersectionObserver); expect(fetch).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
  expect(fetch).toHaveBeenCalledOnce(); expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).event).toBe('open_loop_viewed');
  callback!([{ isIntersecting: true, intersectionRatio: .6 } as IntersectionObserverEntry], {} as IntersectionObserver); expect(fetch).toHaveBeenCalledOnce();
});
it('presents published daily sample changes, nulls, UTC windows and source links without judgment', async () => {
  const el = await render(<DailyObservationCard edition={{ utc_day: '2026-10-12', edition_id: 'edition', content_hash: 'a'.repeat(64), window: { start: '2026-10-12T00:00:00Z', end: '2026-10-13T00:00:00Z', interval: '[start,end)', timezone: 'UTC' }, covered_contract_count: 1, market_count: 1, coverage_gaps: ['INCOMPLETE_DAY_SAMPLING'], findings: [{ contract: '0x' + '1'.repeat(40), pair: '0x' + '2'.repeat(40), observed_start: '2026-10-12T02:00:00Z', observed_end: '2026-10-12T14:00:00Z', liquidity_delta: 125, rolling_volume_delta: null, source_url: 'https://dexscreener.com/robinhood/pair', evidence_href: '/v1/4663/daily-observations/2026-10-12' }], evidence_href: '/v1/4663/daily-observations/2026-10-12', supersedes: null }} />);
  expect(el.textContent).toContain('unavailable'); expect(el.textContent).toContain('recorded sample endpoints'); expect(el.textContent).toContain('2026-10-12 UTC');
  expect(el.querySelector('a')?.href).toContain('dexscreener'); const summary = el.querySelector('summary')!; summary.focus(); expect(document.activeElement).toBe(summary);
});
it('labels actual observation age and qualified CALL significance', async () => {
  const at = new Date().toISOString();
  const el = await render(<><FreshnessBadge at={at} /><PulseCard pulse={{ window_id: 'w', state: 'open', leading_rotation: null, total_calls: 0, opens_at: at, closes_at: at, deep_link: '/4663/pulse', source_ref: { source_type: 'pulse', source_id: 'w', href: '/v1/4663/pulse', observed_at: at } }} /></>);
  expect(el.querySelector('time')?.title).toBe(at); expect(el.textContent).toContain('Qualified event significance'); expect(el.textContent).not.toContain('LIVE');
});
