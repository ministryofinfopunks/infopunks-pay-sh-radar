/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MethodologyDrawer, methodologySections } from '../src/web/methodology';

let container: HTMLDivElement;
let root: Root;

function renderDrawer(open: boolean, onClose = vi.fn()) {
  act(() => {
    root.render(<MethodologyDrawer open={open} onClose={onClose} />);
  });
  return onClose;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  document.body.style.overflow = '';
});

describe('MethodologyDrawer', () => {
  it('includes every required methodology section and explanation field', () => {
    renderDrawer(true);

    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    for (const section of methodologySections) {
      expect(document.body.textContent).toContain(section.title);
    }

    for (const label of ['What it means', 'Inputs used', 'Calculation summary', 'Time window', 'Known limitations']) {
      expect(document.body.textContent).toContain(label);
    }

    expect(document.body.textContent).toContain('Machine Economy');
    expect(document.body.textContent).toContain('Coverage: 12 listed robotic.sh services from the observed snapshot.');
    expect(document.body.textContent).toContain('Phase 2 scope: Pay.sh + robotic.sh.');
    expect(document.body.textContent).toContain('Preflight is not execution.');
    expect(document.body.textContent).toContain('Receipts are decision receipts unless explicitly marked as payment receipts.');
    expect(document.body.textContent).toContain('Radar makes no benchmark claims without recorded artifacts.');
  });

  it('closes on Escape', () => {
    const onClose = renderDrawer(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps keyboard focus inside the drawer', () => {
    renderDrawer(true);
    const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="Close methodology drawer"]');
    expect(closeButton).not.toBeNull();
    closeButton?.focus();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    expect(document.activeElement).toBe(closeButton);
  });
});
