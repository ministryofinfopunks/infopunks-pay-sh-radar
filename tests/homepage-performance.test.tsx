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
    expect(container.textContent).toContain('Enter RH Chain Desk');
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
});
