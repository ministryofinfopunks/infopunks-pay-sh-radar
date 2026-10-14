// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateReleaseRead, marketObservationLabel } from '../src/web/releaseReadContracts';
import { safeJsonExport } from '../src/services/radarExportService';
import { UniversalHomepage } from '../src/web/homepage';
import { App } from '../src/web/radarApp';
import { listMachineMarketServices, buildMachineMarketSummary } from '../src/services/machineMarketService';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
describe('R1 bounded read-only recovery', () => {
  it.each([{}, { data: {} }, { data: { services: [{}] } }])('rejects invalid successful services payload %j', payload => {
    expect(() => validateReleaseRead('/v1/machine-market/services', payload)).toThrow('Evidence response is invalid');
  });
  it('accepts real service metadata and a genuine empty receipt array', () => {
    expect(() => validateReleaseRead('/v1/machine-market/services', safeJsonExport({ data: { services: listMachineMarketServices() } }))).not.toThrow();
    expect(() => validateReleaseRead('/v1/machine-preflight/receipts/recent?limit=100', { data: { receipts: [] } })).not.toThrow();
    expect(() => validateReleaseRead('/v1/machine-preflight/receipts/recent', { data: { receipts: [{}] } })).toThrow();
  });
  it('keeps unavailable and historical market observations separate from recent cached data', () => {
    const now = Date.parse('2026-10-14T00:00:00Z');
    expect(marketObservationLabel({}, now)).toContain('unavailable');
    expect(marketObservationLabel({ dexScreenerData: {}, marketDataUpdatedAt: '2026-07-06T00:00:00Z' }, now)).toContain('Historical');
    expect(marketObservationLabel({ dexScreenerData: {}, marketDataUpdatedAt: '2026-10-13T23:59:30Z' }, now)).toContain('cached');
  });
  it('aligns and focuses the protocol anchor after homepage mount', async () => {
    window.history.replaceState({}, '', '/#proof');
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    const scroll = vi.fn(); const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      await act(async () => root.render(<UniversalHomepage />));
      expect(scroll).toHaveBeenCalled(); expect(document.activeElement?.id).toBe('proof');
    } finally { act(() => root.unmount()); host.remove(); frame.mockRestore(); delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView; }
  });
  it.each(['/machine-market', '/machine-rail-coverage', '/machine-route-risk-matrix', '/machine-first-safe-routes'])('never turns receipt outage into zero proof on %s, and retries a GET', async path => {
    let unavailable = true; const methods: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
      methods.push(init?.method ?? 'GET');
      let data: unknown = { claims: { benchmark_recorded: false, benchmark_claimed: false, winner_claimed: false, payment_claimed: false }, receipt_ids: [], input_summary: [], output_summaries: [], caveats: [], criteria: [], missing_criteria: [] };
      if (url.pathname === '/v1/machine-market/services') data = { services: listMachineMarketServices() };
      if (url.pathname === '/v1/machine-market/summary') data = buildMachineMarketSummary();
      if (url.pathname.includes('/receipts/recent')) return Promise.resolve(new Response(JSON.stringify({ data: { receipts: [] } }), { status: unavailable ? 503 : 200, headers: { 'content-type': 'application/json' } }));
      if (url.pathname.includes('/coverage-runs/recent')) data = { runs: [] };
      return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }));
    window.history.replaceState({}, '', path);
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      await act(async () => root.render(<App />));
      expect(host.textContent).toContain('Evidence unavailable');
      expect(host.textContent).not.toContain('0 service-specific execution receipts recorded');
      unavailable = false;
      await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === 'Retry')!.click(); });
      expect(host.textContent).not.toContain('Evidence unavailable');
      expect(host.querySelector('[role="table"]')).not.toBeNull();
      expect(methods.length).toBeGreaterThan(2);
      expect(methods.every(method => method === 'GET')).toBe(true);
    } finally { act(() => root.unmount()); host.remove(); }
  });
});
