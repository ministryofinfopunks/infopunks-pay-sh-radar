// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rh4663Page } from '../src/web/rh4663Pages';

function response(data: unknown) { return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })); }
function overview() {
  const at = new Date(Date.now() - 4 * 60_000).toISOString();
  return {
    object_type: 'RH_4663_FRONTDOOR_STATE', generated_at: at, freshness: { state: 'VERIFIED', source_observed_at: at },
    now_cards: Array.from({ length: 6 }, (_, index) => ({ id: `now-${index}`, topic: 'RMM SPREADING', headline: `Market conclusion ${index}`, summary: 'Server ranked.', primary_metric: `${index + 1}`, delta: null, evidence_state: 'VERIFIED', freshness: at, source_type: 'rmm_census', source_ref: { source_type: 'rmm_census', source_id: `census-${index}`, href: '/v1/4663/reflexive/census', observed_at: at }, deep_link: '/4663/reflexive/census', priority_reason: 'Deterministic source priority.' })),
    watch_cards: Array.from({ length: 5 }, (_, index) => ({ id: `watch-${index}`, topic: 'DEVELOPING', headline: `Developing story ${index}`, summary: 'Server ranked.', primary_metric: 'PARTIAL', delta: null, evidence_state: 'MIXED', freshness: at, source_type: 'reflexive_watch', source_ref: { source_type: 'reflexive_watch', source_id: `case-${index}`, href: `/v1/4663/reflexive/watch/cases/case-${index}`, observed_at: at }, deep_link: `/4663/reflexive/watch/case-${index}`, priority_reason: 'Developing evidence.' })),
    open_loops: [{ loop_id: 'loop-1', question: 'Does breadth persist?', state: 'AWAITING_EVIDENCE', progress: 'PARTIAL', opened_at: at, expected_resolution_at: null, current_evidence: 'Breadth is verified.', next_evidence_needed: 'D7 observation.', deep_link: '/4663/reflexive/census' }],
    current_call: { window_id: 'rh4663:today', state: 'available', leading_rotation: 'STOCK_TOKENS', total_calls: 12, opens_at: at, closes_at: at, deep_link: '/4663/pulse', source_ref: { source_type: 'pulse_window', source_id: 'rh4663:today', href: '/v1/4663/pulse', observed_at: at } },
    proof_summary: { total_calls: 12, resolved_calls: null, note: 'Personal proof is available after a signed CALL.', deep_link: '/4663/receipts', source_ref: { source_type: 'pulse_window', source_id: 'rh4663:today', href: '/v1/4663/pulse', observed_at: at } },
    system_status: { state: 'available', source_health: { census: { status: 'available', observed_at: at }, watch: { status: 'available', observed_at: at }, preflight: { status: 'available', observed_at: at }, pulse: { status: 'available', observed_at: at }, signals: { status: 'available', observed_at: at } } }, source_refs: []
  };
}

describe('4663 front door', () => {
  let root: Root; let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); window.history.replaceState({}, '', '/4663'); vi.spyOn(globalThis, 'fetch').mockImplementation(() => response(overview())); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
  async function render() { await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); }); }

  it('uses a desktop semantic hierarchy and caps the NOW and WATCH collections', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 }); await render();
    expect(container.querySelectorAll('main').length).toBe(1);
    expect(Array.from(container.querySelectorAll('h2')).map((node) => node.textContent)).toEqual(expect.arrayContaining(['What matters right now?', 'What is developing?', 'What still needs to be proved?', 'How good is your record?']));
    expect(container.querySelectorAll('.fd-now-card').length).toBeLessThanOrEqual(5);
    expect(container.querySelectorAll('.fd-watch-card').length).toBeLessThanOrEqual(4);
    expect(container.querySelector('.fd-now-card')?.textContent).toContain('VERIFIED');
    expect(container.querySelector('.fd-now-card time')?.textContent).toBe('4m');
  });

  it('keeps all primary destinations keyboard reachable and exposes text evidence states', async () => {
    await render();
    const links = Array.from(container.querySelectorAll('.fd-nav a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#now', '#watch', '#call', '#proof']);
    links[0].focus(); expect(document.activeElement).toBe(links[0]);
    expect(Array.from(container.querySelectorAll('[data-evidence-state]')).map((node) => node.getAttribute('data-evidence-state'))).toContain('UNRESOLVED');
    expect(container.querySelector('.fd-call-action')?.getAttribute('href')).toContain('/4663/pulse');
    expect(container.querySelector('a[href="/4663/receipts"]')).not.toBeNull();
  });

  it('keeps follows toggleable and accessible when local storage is unavailable', async () => {
    await render();
    const control = container.querySelector('.fd-now-card .fd-follow') as HTMLButtonElement;
    expect(control).not.toBeNull(); expect(control.getAttribute('aria-pressed')).toBe('false');
    await act(async () => { control.click(); await Promise.resolve(); });
    expect(control.getAttribute('aria-pressed')).toBe('true');
    await act(async () => { control.click(); await Promise.resolve(); });
    expect(control.getAttribute('aria-pressed')).toBe('false');
  });

  it('ships reduced-motion handling without changing the deep Pulse and receipt routes', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/web/rh4663.css'), 'utf8');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.fd-shell *');
    const routeSource = readFileSync(resolve(process.cwd(), 'src/web/radarApp.tsx'), 'utf8');
    expect(routeSource).toContain('pulse|today|signals|receipts');
    expect(routeSource).toContain('LazyRh4663Page');
    expect(routeSource).toContain('LazyReflexiveRadarPage');
  });
});
