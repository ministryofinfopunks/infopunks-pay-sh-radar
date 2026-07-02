// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAbundanceDeskPayload } from '../src/data/abundanceDesk';
import { App } from '../src/web/main';

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

async function renderPath(container: HTMLDivElement, path: string) {
  window.history.pushState({}, '', path);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('Abundance Desk page', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (pathOf(input) === '/v1/abundance') return json(getAbundanceDeskPayload());
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the Abundance Desk page, seeded claims, proof states, and nav', async () => {
    root = await renderPath(container, '/abundance');

    const text = container.textContent ?? '';
    expect(text).toContain('Abundance Desk');
    expect(text).toContain('When machines do the work, Infopunks checks the receipts.');
    expect(text).toContain('Machine Labor Watch');
    expect(text).toContain('Proof Gap Index');
    expect(text).toContain('Machine Work Receipts');
    expect(text).toContain('Agent Spend Readiness');
    expect(text).toContain('Human Validator Layer');
    expect(text).toContain('Abundance Claims Feed');
    expect(text).toContain('AI agents can complete paid API work autonomously.');
    expect(text).toContain('Universal high income requires proof of machine-generated surplus.');
    expect(text).toContain('Receipts present');
    expect(text).toContain('Dangerous if automated');
    expect(text).toContain('Ready for agent spend');
    expect(container.querySelector('a[href="/abundance"]')?.textContent).toContain('Abundance Desk');
    expect(container.querySelector('a[href="/v1/abundance/claims"]')).not.toBeNull();
    expect(container.querySelector('a[href="/v1/abundance/receipts"]')).not.toBeNull();
  });

  it('renders the narrative alias route', async () => {
    root = await renderPath(container, '/narratives/abundance-desk');

    expect(container.textContent).toContain('Abundance Desk');
    expect(container.textContent).toContain('Infopunks is the proof, receipt, and judgment layer for the machine-labor economy.');
    expect(container.querySelector('a[href="/abundance"]')?.getAttribute('aria-current')).toBe('page');
  });
});
