// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { UniversalHomepage } from '../src/web/homepage';
describe('unified homepage performance and honest capability boundary', () => {
  let root: Root; let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); performance.clearMarks(); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); });
  it('renders useful entry points without requesting live data or claiming operational readiness', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await act(async () => { root = createRoot(container); root.render(<UniversalHomepage />); });
    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain('One Radar.Two Economies.One Standard of Proof.');
    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.querySelector('.radar-home-actions a')?.getAttribute('href')).toBe('/spend-terminal');
    expect(container.querySelector('.rh a')?.textContent).toContain('Inspect a Market');
    expect(container.querySelector('.rh a')?.getAttribute('href')).toBe('/rh-chain-signal-desk/market');
    expect(container.textContent).toContain('Read-only market inspection');
    expect(container.querySelectorAll('.radar-home-proof-grid li')).toHaveLength(4);
    expect(container.textContent).not.toContain('Live intelligence available');
    expect(performance.getEntriesByName('radar_homepage_rendered')).toHaveLength(1);
  });
  it('keeps the homepage and check route separated from heavy Radar imports', async () => {
    const source = await readFile('src/web/main.tsx', 'utf8');
    expect(source).toContain("lazy(() => import('./radarApp'))");
    expect(source).toContain("lazy(() => import('./spendTerminalPage')");
    expect(source).not.toContain('preSpendBuilderPages'); expect(source).not.toContain('rhChainUi');
  });
  it('keeps all five product destinations visible in the landing navigation', async () => {
    await act(async () => { root = createRoot(container); root.render(<UniversalHomepage />); });
    expect([...container.querySelectorAll('nav a')].map(a => a.textContent)).toEqual(['Radar', 'Solana', 'Robinhood Chain', 'Proof', 'Developers']);
  });
});
