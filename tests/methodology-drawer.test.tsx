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

    expect(document.body.textContent).toContain('Machine Economy Methodology');
    expect(document.body.textContent).toContain('What Radar maps');
    expect(document.body.textContent).toContain('robotic.sh listed services');
    expect(document.body.textContent).toContain('machine dossiers based on Radar-observed receipts');
    expect(document.body.textContent).toContain('Phase 2 focuses on Pay.sh and robotic.sh.');
    expect(document.body.textContent).toContain('Agentic.Market/Base entries appear only where they are observed as source metadata in the robotic.sh service list.');
    expect(document.body.textContent).toContain('Machine receipts are decision receipts by default.');
    expect(document.body.textContent).toContain('They record Radar’s preflight decision: allow, deny, or review.');
    expect(document.body.textContent).toContain('They are not payment receipts unless explicitly marked as payment receipts.');
    expect(document.body.textContent).toContain('listed: Service was observed in the robotic.sh market snapshot.');
    expect(document.body.textContent).toContain('benchmark-recorded: A benchmark artifact exists with repeatable run data.');
    expect(document.body.textContent).toContain('no live service execution unless marked execution-tested');
    expect(document.body.textContent).toContain('no winner claim without criteria');
    expect(document.body.textContent).toContain('no live peaqOS identity verification unless integrated');
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
