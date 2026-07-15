// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RADAR_NAVIGATION,
  RADAR_NETWORKS,
  RadarNetworkSelector,
  RadarProductNavigation,
  navigationItemIsActive,
  radarNetworkForPath
} from '../src/web/radarNetworks';

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

  function render(node: React.ReactNode) {
    act(() => {
      root = createRoot(container);
      root.render(node);
    });
  }

  it('keeps public deep links while assigning an explicit universal homepage context', () => {
    expect(RADAR_NETWORKS.solana.href).toBe('/#global-pulse');
    expect(RADAR_NETWORKS['robinhood-chain'].href).toBe('/rh-chain-signal-desk');
    expect(radarNetworkForPath('/')).toBe('universal');
    expect(radarNetworkForPath('/providers/provider_alpha')).toBe('solana');
    expect(radarNetworkForPath('/benchmarks/finance-data-token-metadata')).toBe('solana');
    expect(radarNetworkForPath('/rh-chain-signal-desk')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/meme-pulse')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/narratives/robinhood-chain')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/internal/rh-chain/review-console')).toBe('robinhood-chain');
  });

  it('renders the homepage as Infopunks Radar across all networks', () => {
    render(<RadarProductNavigation context="universal" current="/" />);

    expect(container.querySelector('a[aria-label="Infopunks Radar home"]')?.textContent).toBe('InfopunksRadar');
    expect(container.querySelector('button[aria-label="All Networks. Choose Radar network"]')).not.toBeNull();
    expect(container.textContent).toContain('All Networks');
    expect(container.textContent).not.toContain('Infopunks/Solana');
    expect(container.querySelector('nav[aria-label="Infopunks Radar navigation"]')).not.toBeNull();
  });

  it('defines compact primary navigation for Solana and Robinhood Chain', () => {
    expect(RADAR_NAVIGATION.solana.primaryItems.map((item) => item.label)).toEqual([
      'Overview', 'Providers', 'Routes', 'Receipts', 'Benchmarks'
    ]);
    expect(RADAR_NAVIGATION['robinhood-chain'].primaryItems.map((item) => item.label)).toEqual([
      'Signal Desk', 'Meme Pulse', '4663 Index', 'Receipts', 'Submit'
    ]);
    expect(RADAR_NAVIGATION.solana.primaryItems).toHaveLength(5);
    expect(RADAR_NAVIGATION['robinhood-chain'].primaryItems).toHaveLength(5);
  });

  it('keeps all grouped Solana destinations discoverable in More', () => {
    render(<RadarProductNavigation context="solana" current="/signal-hunt" />);

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open Solana more destinations"]')!;
    act(() => trigger.click());
    const menu = container.querySelector<HTMLElement>('[role="menu"][aria-label="Solana more destinations"]')!;
    expect(menu.hidden).toBe(false);
    for (const group of ['Intelligence', 'Agent Tools', 'Hermes', 'Commercial', 'Machine Economy', 'Developers']) {
      expect(menu.querySelector(`[role="group"][aria-label="${group}"]`)).not.toBeNull();
    }
    for (const label of ['Signal Hunt', 'Narratives', 'Unicorn Radar', 'Check', 'Loops', 'Hermes Desk', 'Agent Benchmarks', 'Preflight Cards', 'Evaluation Request', 'Revenue Receipts', 'API', 'Developer Documentation']) {
      expect(menu.textContent).toContain(label);
    }
    expect(menu.querySelector('a[href="/signal-hunt"]')?.getAttribute('aria-current')).toBe('page');
    expect(trigger.closest('.radar-overflow-menu')?.classList.contains('active')).toBe(true);
  });

  it('groups RH Chain routes by their actual purpose and disambiguates Scout labels', () => {
    render(<RadarProductNavigation context="robinhood-chain" current="/rh-chain-signal-desk/scouts" />);

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open Robinhood Chain more destinations"]')!;
    act(() => trigger.click());
    const menu = container.querySelector<HTMLElement>('[role="menu"][aria-label="Robinhood Chain more destinations"]')!;
    for (const group of ['Intelligence', 'Scouting', 'Operations', 'Developers']) {
      expect(menu.querySelector(`[role="group"][aria-label="${group}"]`)).not.toBeNull();
    }
    expect(menu.querySelector('a[href="/rh-chain-signal-desk/scouts"]')?.textContent).toBe('Scout Network');
    expect(menu.querySelector('a[href="/rh-chain-signal-desk/scout"]')?.textContent).toBe('Scout Agent');
    expect(menu.querySelector('a[href="/rh-chain-signal-desk/review-queue"]')?.textContent).toBe('Review Queue');
    expect(menu.querySelector('a[href="/internal/rh-chain/review-console"]')?.textContent).toBe('Review Console');
    expect(menu.textContent).not.toMatch(/>Scouts?<|ScoutsScout/);
  });

  it('opens network selection with arrow focus and restores focus on Escape', () => {
    render(<RadarNetworkSelector active="solana" />);

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

  it('supports arrow navigation in More and closes on Escape with focus restoration', () => {
    render(<RadarProductNavigation context="solana" current="/providers" />);

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open Solana more destinations"]')!;
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    const menu = container.querySelector<HTMLElement>('[role="menu"][aria-label="Solana more destinations"]')!;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.compact-primary-duplicate)'));
    expect(document.activeElement).toBe(items[0]);
    act(() => items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(items[1]);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes menus after selection and outside interaction', () => {
    render(<RadarNetworkSelector active="robinhood-chain" />);

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const solanaLink = container.querySelector<HTMLAnchorElement>('a[href="/#global-pulse"]')!;
    solanaLink.addEventListener('click', (event) => event.preventDefault());
    act(() => solanaLink.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    act(() => trigger.click());
    act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps view settings separate from route navigation without changing behavior', () => {
    const onToggleAgentMode = vi.fn();
    const onToggleDensity = vi.fn();
    render(<RadarProductNavigation
      context="universal"
      current="/"
      onOpenCommandPalette={vi.fn()}
      viewSettings={{ agentMode: false, densityMode: 'comfortable', onToggleAgentMode, onToggleDensity }}
    />);

    const settingsTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open view settings"]')!;
    act(() => settingsTrigger.click());
    const settings = container.querySelector<HTMLElement>('[role="menu"][aria-label="View settings"]')!;
    expect(settings.textContent).toContain('View Settings');
    expect(settings.textContent).toContain('Agent Mode');
    expect(settings.textContent).toContain('Comfortable Density');
    expect(settings.textContent).not.toContain('Overview');
    expect(container.querySelector('button[aria-label="Open command palette (Command K or Control K)"]')?.getAttribute('title')).toContain('⌘K');

    const agentMode = Array.from(settings.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Agent Mode'))!;
    act(() => agentMode.click());
    expect(onToggleAgentMode).toHaveBeenCalledOnce();
    expect(onToggleDensity).not.toHaveBeenCalled();
  });

  it('marks deep routes active and exposes compact/mobile collapse hooks', () => {
    expect(navigationItemIsActive(RADAR_NAVIGATION.solana.primaryItems[1], '/providers/provider_alpha')).toBe(true);
    render(<RadarProductNavigation context="solana" current="/providers/provider_alpha" />);

    expect(container.querySelector('a[href="/providers"]')?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('.radar-primary-collapsible')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Open Solana product navigation"]')).not.toBeNull();
    const mobileMenu = container.querySelector('[role="menu"][aria-label="Solana product navigation"]')!;
    expect(mobileMenu.querySelector('a[href="/providers"]')).not.toBeNull();
    expect(mobileMenu.querySelector('a[href="/rh-chain-signal-desk"]')).toBeNull();
  });
});
