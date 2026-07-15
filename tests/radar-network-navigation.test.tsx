// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RADAR_NETWORKS, RadarNetworkSelector, radarNetworkForPath } from '../src/web/radarNetworks';

describe('Radar network architecture', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps current public routes while mapping them to a chain context', () => {
    expect(RADAR_NETWORKS.solana.href).toBe('/#global-pulse');
    expect(RADAR_NETWORKS['robinhood-chain'].href).toBe('/rh-chain-signal-desk');
    expect(radarNetworkForPath('/')).toBe('solana');
    expect(radarNetworkForPath('/providers/provider_alpha')).toBe('solana');
    expect(radarNetworkForPath('/benchmarks/finance-data-token-metadata')).toBe('solana');
    expect(radarNetworkForPath('/rh-chain-signal-desk')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/meme-pulse')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/narratives/robinhood-chain')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/internal/rh-chain/review-console')).toBe('robinhood-chain');
  });

  it('opens, announces state, supports arrow focus, and closes with Escape', () => {
    act(() => {
      root = createRoot(container);
      root.render(<RadarNetworkSelector active="solana" />);
    });

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);

    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('[role="menuitem"]'));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes after network selection and outside interaction', () => {
    act(() => {
      root = createRoot(container);
      root.render(<RadarNetworkSelector active="robinhood-chain" />);
    });

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const solanaLink = container.querySelector<HTMLAnchorElement>('a[href="/#global-pulse"]')!;
    solanaLink.addEventListener('click', (event) => event.preventDefault());
    act(() => solanaLink.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
