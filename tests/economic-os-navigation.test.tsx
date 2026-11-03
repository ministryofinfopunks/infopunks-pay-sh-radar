// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/web/main';
import { ProductHeader } from '../src/web/productPrimitives';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Economic OS route and product navigation', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  let previousPath: string;

  beforeEach(() => {
    previousPath = window.location.pathname;
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    container.remove();
    window.history.replaceState({}, '', previousPath);
  });

  it('dispatches /economic-os/overview to the Economic OS page inside the shared shell', async () => {
    window.history.replaceState({}, '', '/economic-os/overview');
    await import('../src/web/economicOsOverviewPage');
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.querySelector('.radar-app-shell')).not.toBeNull();
    expect(container.querySelector('.economic-os-overview h1')?.textContent).toBe('One Standard of Proof.');
    expect(container.querySelector('.radar-specialized-nav')).toBeNull();
    expect(container.textContent).toContain('This request does not execute or pay.');
  });

  it('keeps existing product destinations and exposes Economic OS in desktop and opened mobile navigation', () => {
    const expected = [
      ['/', 'Radar'],
      ['/solana', 'Solana'],
      ['/rh-chain-signal-desk', 'Robinhood Chain'],
      ['/economic-os/overview', 'Economic OS'],
      ['/receipts', 'Proof'],
      ['/developers', 'Developers']
    ] as const;
    const renderHeader = () => {
      root = createRoot(container);
      root.render(<ProductHeader current="/economic-os/overview" />);
    };

    act(renderHeader);
    const nav = container.querySelector<HTMLElement>('nav[aria-label="Infopunks product navigation"]')!;
    for (const [href, label] of expected) {
      expect(nav.querySelector(`a[href="${href}"]`)?.textContent).toBe(label);
    }
    expect(nav.querySelector('a[href="/economic-os/overview"]')?.getAttribute('aria-current')).toBe('page');

    act(() => container.querySelector<HTMLButtonElement>('.product-menu-toggle')!.click());
    expect(container.querySelector('.product-header')?.classList.contains('is-open')).toBe(true);
    for (const [href] of expected) expect(nav.querySelector(`a[href="${href}"]`)).not.toBeNull();
  });
});
