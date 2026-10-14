// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/radarApp';
import { UniversalHomepage } from '../src/web/homepage';
import { unicornReadExamples } from '../src/api/publicReadExamples';
import { SolanaRadarDirectory } from '../src/web/radarNetworks';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
async function mount(element: React.ReactNode, run: (host: HTMLDivElement) => Promise<void> | void) {
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try { await act(async () => root.render(element)); await run(host); } finally { act(() => root.unmount()); host.remove(); }
}
describe('R2 public read honesty and navigation', () => {
  it('keeps all24destinations discoverable with truthful proposed/excluded scope, not live admission', async () => {
    await mount(<SolanaRadarDirectory />, host => {
      expect(host.querySelectorAll('[data-route-id]')).toHaveLength(24);
      expect([...host.querySelectorAll('small')].filter(x => x.textContent === 'Outside first public release')).toHaveLength(20);
      expect([...host.querySelectorAll('small')].filter(x => x.textContent === 'Proposed public read · release HOLD')).toHaveLength(4);
    });
  });
  it('returns legacy methodology navigation to the existing protocol target and keyboard focus', async () => {
    window.history.replaceState({}, '', '/#methodology');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    const scroll = vi.fn(); Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try { await mount(<UniversalHomepage />, () => { expect(location.hash).toBe('#proof'); expect(document.activeElement?.id).toBe('proof'); expect(scroll).toHaveBeenCalled(); }); }
    finally { delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView; }
  });
  it('holds contradictory success data as unavailable and recovers via a read-only retry', async () => {
    let invalid = true; const methods: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? 'GET'); const data: any = unicornReadExamples().summary;
      if (invalid) data.counts.total = 0;
      return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
    })); window.history.replaceState({}, '', '/unicorn-radar');
    await mount(<App />, async host => {
      expect(host.textContent).toContain('Market intelligence unavailable');
      expect(host.textContent).not.toContain('No candidates match this view');
      invalid = false; await act(async () => [...host.querySelectorAll('button')].find(x => x.textContent === 'Retry')!.click());
      expect(host.textContent).not.toContain('Market intelligence unavailable');
      expect(host.textContent).toContain('Candidate intake · gated');
      expect(host.textContent).toContain('Outside the first public release');
      expect(methods.every(x => x === 'GET')).toBe(true);
    });
  });
});
