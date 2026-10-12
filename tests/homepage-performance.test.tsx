// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { UniversalHomepage } from '../src/web/homepage';
describe('unified terminal homepage performance and honest capability boundary', () => {
  let root: Root; let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); performance.clearMarks(); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); });
  async function mount() { await act(async () => { root = createRoot(container); root.render(<UniversalHomepage />); }); }
  it('offers a subject-preserving check journey without fetching data or inventing a decision', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await mount();
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('h1')?.textContent).toBe('Before your agent spends, check the evidence.');
    const form = container.querySelector<HTMLFormElement>('.radar-home-route-form')!;
    expect(form.getAttribute('action')).toBe('/spend-terminal');
    expect(form.getAttribute('method')).toBe('get');
    const subject = form.querySelector<HTMLInputElement>('input[name="subject"]')!;
    subject.value = 'solana:mainnet:service_route:route/a?b=c&d=1';
    expect(new FormData(form).get('subject')).toBe(subject.value);
    expect(container.querySelector('.rh a')?.getAttribute('aria-label')).toBe('Inspect a Market');
    expect(container.querySelector('.rh a')?.getAttribute('href')).toBe('/rh-chain-signal-desk/market');
    expect(container.querySelectorAll('.radar-home-proof-grid li')).toHaveLength(4);
    expect(container.textContent).toContain('No wallet required');
    expect(performance.getEntriesByName('radar_homepage_rendered')).toHaveLength(1);
  });
  it('keeps preview evidence unassessed and receipts unissued', async () => {
    await mount();
    const panel = container.querySelector('#judgment-preview')!;
    expect(panel.textContent).toContain('NO CHECK RUN');
    expect(panel.textContent).toContain('AWAITING EVIDENCE');
    expect(panel.textContent).toContain('NOT ISSUED');
    expect(panel.textContent).not.toMatch(/72%|VERIFIED|PROCEED WITH CAUTION|MAINNET/);
    expect(container.querySelector('[aria-label="Confidence not assessed"]')?.textContent).toBe('—');
    expect(container.querySelectorAll('.radar-evidence-list details')).toHaveLength(4);
    expect(container.textContent).toContain('Execution requires separate authorization');
    expect(container.textContent).toContain('Read-only inspection');
    expect(container.textContent).toContain('Insufficient evidence is free');
  });
  it('keeps the homepage and check route separated from heavy Radar imports', async () => {
    const source = await readFile('src/web/main.tsx', 'utf8');
    expect(source).toContain("lazy(() => import('./radarApp'))");
    expect(source).toContain("lazy(() => import('./spendTerminalPage')");
    expect(source).not.toContain('preSpendBuilderPages'); expect(source).not.toContain('rhChainUi');
  });
  it('provides all five destinations and an Escape-dismissible mobile navigation', async () => {
    await mount();
    expect([...container.querySelectorAll('nav a')].map(a => a.textContent)).toEqual(['Radar', 'Solana', 'Robinhood Chain', 'Proof', 'Developers']);
    const toggle = container.querySelector<HTMLButtonElement>('.product-menu-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.tagName).toBe('NAV');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await act(async () => container.querySelector('nav a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});
