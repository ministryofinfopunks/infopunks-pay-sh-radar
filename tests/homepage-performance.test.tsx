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

  it('renders the meaningful homepage before a never-resolving live pulse', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
    });

    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.textContent).toContain('Open Solana Radar');
    expect(container.textContent).toContain('Enter //4663');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Live status connecting');
    expect(performance.getEntriesByName('radar_homepage_rendered')).toHaveLength(1);
    expect(performance.getEntriesByName('radar_live_status_started')).toHaveLength(1);
  });

  it('keeps the homepage visible and reports a local degraded status on pulse failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.textContent).toContain('Live status delayed');
    expect(performance.getEntriesByName('radar_live_status_failed')).toHaveLength(1);
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
    expect(css).toMatch(/\.radar-home-header nav a \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
    expect(css).toContain('width: min(100% - 28px, 1180px);');
    expect(css).toContain('grid-template-columns: 1fr;');
  });

  it('connects Robinhood Chain to //4663 without changing the existing homepage navigation', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await act(async () => {
      root = createRoot(container);
      root.render(<UniversalHomepage />);
    });

    const primaryNav = container.querySelector('nav[aria-label="Primary navigation"]');
    expect(primaryNav?.querySelector('a[href="/solana"]')?.textContent).toBe('Solana');
    expect(primaryNav?.querySelector('a[href="/4663"]')?.textContent).toBe('//4663');
    expect(primaryNav?.querySelector('a[href="/radar/cards"]')?.textContent).toBe('Pre-Spend Intelligence');

    const rhCard = container.querySelector('.radar-home-cards article.rh');
    expect(rhCard?.textContent).toContain('Robinhood Chain');
    expect(rhCard?.querySelector('h3')?.textContent).toBe('//4663');
    expect(rhCard?.querySelector('span')?.textContent).toBe('Pulse · Today · Signals · Receipts · Market memory');
    expect(rhCard?.querySelector('a[href="/4663"]')?.textContent).toContain('Enter //4663');

    expect(container.textContent).toContain('After attention,intelligence.');
    expect(container.textContent).toContain('Intelligence before the wallet acts.');
    expect(container.textContent).toContain('Culture → intelligence → infrastructure.');
    expect(container.textContent).toContain('One Radar. Two economies.');
    expect(container.querySelector('.radar-home-cards a[href="/solana"]')?.textContent).toContain('Open Solana Radar');
  });
});
