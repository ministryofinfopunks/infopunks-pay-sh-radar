// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { UniversalHomepage } from '../src/web/homepage';
import { RadarAppShell } from '../src/web/radarAppShell';

describe('canonical terminal entry and truth boundary', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); performance.clearMarks(); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); });
  async function render() { await act(async () => { root = createRoot(container); root.render(<RadarAppShell path="/"><UniversalHomepage /></RadarAppShell>); }); }
  it('renders the approved task without waiting for or inventing live telemetry', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.querySelector('h1')?.textContent).toBe('Before your agent spends, check the evidence.');
    expect(container.textContent).not.toContain('After attention,');
    expect(container.textContent).toContain('AWAITING EVIDENCE');
    expect(container.textContent).toContain('NO CHECK RUN');
    expect(container.textContent).toContain('NOT ISSUED');
    expect(container.querySelector('[data-evidence-state="verified"]')).toBeNull();
    expect(container.querySelector('[aria-label="Confidence not assessed"]')?.textContent).toBe('—');
    expect(fetch).not.toHaveBeenCalled();
    expect(performance.getEntriesByName('radar_homepage_rendered')).toHaveLength(1);
  });
  it('uses one canonical header and footer with actual product destinations', async () => {
    await render();
    expect(container.querySelectorAll('.product-header')).toHaveLength(1);
    expect(container.querySelectorAll('footer')).toHaveLength(1);
    expect([...container.querySelectorAll('.product-wayfinding a')].map(a => a.getAttribute('href'))).toEqual(['/', '/solana', '/rh-chain-signal-desk', '/receipts', '/developers']);
    expect(container.querySelector('.radar-home-route-form')?.getAttribute('action')).toBe('/spend-terminal');
    expect(container.querySelector('#home-route')?.getAttribute('name')).toBe('subject');
    expect(container.querySelectorAll('.radar-lifecycle li')).toHaveLength(4);
  });
  it('keeps workflow code lazy and the sole palette in the existing token architecture', async () => {
    const source = await readFile('src/web/main.tsx', 'utf8');
    expect(source).toContain("lazy(() => import('./radarApp'))");
    expect(source).not.toContain('preSpendBuilderPages');
    const tokens = await readFile('src/web/radarTokens.css', 'utf8');
    expect(tokens).toContain('--signal-action: #00eee4;');
    expect(tokens).toContain('--green: var(--signal-action);');
    expect(tokens).toContain('--ok: #9dffc2;');
  });
});
