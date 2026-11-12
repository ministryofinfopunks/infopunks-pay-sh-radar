// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UniversalHomepage } from '../src/web/homepage';

describe('universal homepage performance boundary', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    performance.clearMarks();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the meaningful homepage without waiting on or requesting live data', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
    });

    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.textContent).toContain('Run Spend Check');
    expect(container.textContent).toContain('Front-door preview: live checks unavailable. No check or automatic payment has occurred.');
    expect(container.querySelector('.radar-home-route-form')?.getAttribute('action')).toBe('/spend-terminal');
    expect(fetch).not.toHaveBeenCalled();
    expect(performance.getEntriesByName('radar_homepage_rendered')).toHaveLength(1);
  });

  it('labels the judgment preview as static and exposes the approved route entry form', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
    });

    expect(container.querySelector('#judgment-preview')?.textContent).toContain('NO CHECK RUN');
    expect(container.querySelector('#judgment-preview')?.textContent).toContain('A policy-bound decision appears after a check.');
    expect(container.querySelector('#judgment-preview')?.textContent).toContain('No check or execution has occurred.');
    expect(container.querySelector('form[action="/spend-terminal"] button[type="submit"]')?.textContent).toContain('Run Spend Check');
  });

  it('keeps the homepage visible and makes no live intelligence claims', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.textContent).toContain('NOT CHECKED');
    expect(container.textContent).toContain('NO CHECK RUN');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the homepage entry free of deep route imports', async () => {
    const source = await readFile(join(process.cwd(), 'src/web/main.tsx'), 'utf8');
    expect(source).toContain("lazy(() => import('./radarApp'))");
    expect(source).not.toContain('preSpendBuilderPages');
    expect(source).not.toContain('rhChainUi');
    expect(source).not.toContain('providerRisk');
  });

  it('preserves mobile navigation touch targets without adding homepage overflow behavior', async () => {
    const css = await readFile(join(process.cwd(), 'src/web/homepage.css'), 'utf8');
    expect(css).toMatch(/\.radar-home-actions a \{[^}]*min-height: 44px;/s);
    expect(css).toMatch(/\.radar-home-actions button \{[^}]*flex-basis: 100%;/s);
    expect(css).toMatch(/\.radar-home-hero \{[^}]*grid-template-columns: 1fr;/s);
  });

  it('preserves the two-economy homepage cards and their approved routes', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
    });

    const rhCard = container.querySelector('.radar-home-cards article.rh');
    expect(rhCard?.textContent).toContain('Robinhood Chain');
    expect(rhCard?.querySelector('h2')?.textContent).toBe('Robinhood Chain');
    expect(rhCard?.querySelector('a[href="/4663"]')).not.toBeNull();
    expect(rhCard?.textContent).toContain('Read-only inspection');

    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.querySelector('#proof')).not.toBeNull();
    expect(container.textContent).toContain('ONE RADAR. TWO ECONOMIES.');
    expect(container.querySelector('.radar-home-cards a[href="/solana"]')).not.toBeNull();
  });
});
