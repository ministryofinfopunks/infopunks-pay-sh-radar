// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHermesDeskSummary } from '../src/services/hermesBridge';
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

describe('Hermes Desk page', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (pathOf(input) === '/v1/hermes') return json(getHermesDeskSummary({}));
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the Hermes Desk run surface and skill pack', async () => {
    root = await renderPath(container, '/hermes');

    const text = container.textContent ?? '';
    expect(text).toContain('Hermes Desk');
    expect(text).toContain('Agentic investigations before money moves.');
    expect(text).toContain('Hermes runs the loop. Infopunks keeps the receipts.');
    expect(text).toContain('Pay.sh Route Pre-Spend Check');
    expect(text).toContain('Agentic Market Provider Risk Review');
    expect(text).toContain('Signal Hunt Narrative Scan');
    expect(text).toContain('receipt: receipt_001');
    expect(text).toContain('claim: claim_001');
    expect(text).toContain('loop: loop_pre_spend_route');
    expect(text).toContain('pre-spend route check');
    expect(text).toContain('provider risk check');
    expect(text).toContain('receipt validator');
    expect(text).toContain('claim dispute review');
    expect(text).toContain('signal hunt analyst');
    expect(container.querySelector('a[href="/hermes"]')?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('a[href="/v1/hermes/skills"]')).not.toBeNull();
  });

  it('renders the Hermes Desk narrative page', async () => {
    root = await renderPath(container, '/narratives/hermes-desk');

    const text = container.textContent ?? '';
    expect(text).toContain('Hermes as the execution brain');
    expect(text).toContain('Infopunks as the evidence and judgment layer');
    expect(text).toContain('Every agent run can become a receipt');
    expect(text).toContain('Every receipt can become a claim');
    expect(text).toContain('Every claim can update provider or route reputation');
    expect(container.querySelector('a[href="/narratives/hermes-desk"]')?.getAttribute('aria-current')).toBe('page');
  });
});
