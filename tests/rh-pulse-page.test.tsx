// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { RhPulseService } from '../src/services/rhPulseService';
import { RhPulsePage } from '../src/web/rhPulse/RhPulsePage';

const NOW = new Date('2026-07-23T06:00:00.000Z');

async function readModel() {
  return new RhPulseService({
    crossLayer: async () => ({
      entries: [],
      captured_at: '2026-07-23T05:45:00.000Z',
      freshness: 'partial',
      confidence: 'low',
      warnings: ['No qualifying reviewed overlap.']
    }),
    now: () => NOW
  }).getReadModel();
}

describe('RH Pulse mobile page', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    window.history.pushState({}, '', '/rh-pulse');
    window.sessionStorage.clear();
    const model = await readModel();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(buildRhChainApiResponse(model)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
    window.sessionStorage.clear();
    document.body.classList.remove('rh-pulse-document');
  });

  async function renderPulse() {
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulsePage route={{ kind: 'home', id: null, canonicalPath: '/' }} />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders the mobile-first hero, accessible map, freshness, and honest evidence summary', async () => {
    await renderPulse();

    const text = container.textContent ?? '';
    expect(text).toContain('INFOPUNKS / RH PULSE');
    expect(text).toContain('The agent economy is live. What does it become next?');
    expect(text).toContain('STRONGEST CURRENT SIGNAL');
    expect(text).toContain('Insufficient evidence');
    expect(text).toContain('CONNECTION UNDER WATCH');
    expect(text).toContain('Agents ↔ RWAs');
    expect(container.querySelector('svg[role="img"] title')?.textContent).toBe('RH Pulse layer connection map');
    expect(container.querySelector('[aria-label="RWAs: structural destination"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Memes: liquidity and coordination"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Agents: coordination and market formation"]')).not.toBeNull();
    expect(container.querySelector('.rh-pulse-freshness-delayed')).not.toBeNull();
  });

  it('renders four equal unselected call options and preserves local selection in the sticky preview', async () => {
    await renderPulse();

    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>('.rh-pulse-call-card'));
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'false']);
    expect(new Set(cards.map((card) => card.className))).toEqual(new Set(['rh-pulse-call-card']));
    expect(container.querySelector('.rh-pulse-call-preview')).toBeNull();

    await act(async () => cards[2].click());
    expect(cards[2].getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('.rh-pulse-call-preview strong')?.textContent).toBe('Memes → RWAs');
    expect(container.querySelector<HTMLButtonElement>('.rh-pulse-call-preview button')).toMatchObject({
      disabled: true,
      textContent: 'Call window opening soon'
    });
    expect(window.sessionStorage.getItem('rh-pulse:selected-outcome:v1')).toBe('memes_to_rwas');
    expect(new URL(window.location.href).searchParams.get('call')).toBe('memes_to_rwas');
  });

  it('contains no wallet workflow, community percentages, fake countdown, or participation totals', async () => {
    await renderPulse();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('connect wallet');
    expect(text).not.toContain('community %');
    expect(text).not.toContain('votes');
    expect(text).not.toContain('countdown');
    expect(text).not.toContain('participants');
  });

  it('namespaces styles and disables all Pulse motion when reduced motion is requested', async () => {
    const css = await readFile(join(process.cwd(), 'src/web/rhPulse/rhPulse.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*animation:\s*none\s*!important/);
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('overflow-x: hidden');
    expect(Array.from(css.matchAll(/^\.([a-z0-9_-]+)/gmi)).every((match) => (
      match[1].startsWith('rh-pulse-')
    ))).toBe(true);
  });

  it('keeps the Pulse route and wallet providers behind separate lazy boundaries', async () => {
    const [main, sheet, wallet] = await Promise.all([
      readFile(join(process.cwd(), 'src/web/main.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src/web/rhPulse/RhPulseSigningSheet.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src/web/rhPulse/rhPulseWallet.ts'), 'utf8')
    ]);
    expect(main).toContain("lazy(() => import('./rhPulse/RhPulsePage')");
    expect(main).not.toContain("import { RhPulsePage } from './rhPulse/RhPulsePage'");
    expect(sheet).toContain("import('./rhPulseWallet')");
    expect(wallet).toContain("import('@walletconnect/ethereum-provider')");
    expect(wallet).toContain("method: 'personal_sign'");
    expect(wallet).not.toContain('eth_sendTransaction');
    expect(wallet).not.toContain('wallet_switchEthereumChain');
  });
});
