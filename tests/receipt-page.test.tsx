// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

const baseReceipt = {
  event_id: 'evt-receipt-1',
  event_type: 'provider.degraded',
  provider_id: 'provider-1',
  endpoint_id: null,
  severity: 'warning',
  severity_reason: 'latency increased',
  observed_at: '2026-05-08T00:00:00.000Z',
  catalog_generated_at: '2026-05-08T00:00:00.000Z',
  ingested_at: '2026-05-08T00:01:00.000Z',
  source: 'infopunks:test',
  derivation_reason: 'Synthetic event for receipt page tests.',
  confidence: 0.92,
  summary: { entity_type: 'provider', entity_id: 'provider-1', payload: { status: 'degraded' } },
  raw_summary: '{"status":"degraded"}',
  links: {
    provider: { provider_id: 'provider-1', provider_name: 'Provider One', url: '/?provider_id=provider-1' },
    provider_dossier: '/?provider_id=provider-1',
    interpretations: [{ interpretation_id: 'interp-1', title: 'Provider instability', url: '/#interp-1' }],
    propagation_cluster: { cluster: 'media-latency', state: 'clustered', severity: 'medium', url: '/#propagation-watch' }
  }
};

describe('public receipt page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders valid receipt page fields', async () => {
    window.history.pushState({}, '', '/receipts/evt-receipt-1');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/receipts/evt-receipt-1') return json(baseReceipt);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Public Event Receipt');
    expect(container.textContent).toContain('evt-receipt-1');
    expect(container.textContent).toContain('provider.degraded');
    expect(container.textContent).toContain('Copy Receipt URL');
  });

  it('renders missing receipt state', async () => {
    window.history.pushState({}, '', '/receipts/missing-id');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 404 })));

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Receipt Not Found');
    expect(container.textContent).toContain('missing-id');
  });

  it('renders partial evidence fields safely', async () => {
    window.history.pushState({}, '', '/receipts/evt-partial');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/receipts/evt-partial') return json({
        ...baseReceipt,
        event_id: 'evt-partial',
        provider_id: null,
        endpoint_id: null,
        catalog_generated_at: null,
        ingested_at: null,
        confidence: null,
        links: { ...baseReceipt.links, provider: null, provider_dossier: null, interpretations: [], propagation_cluster: null }
      });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('provider_id');
    expect(container.textContent).toContain('unknown');
    expect(container.textContent).toContain('none');
  });

  it('renders provider dossier link', async () => {
    window.history.pushState({}, '', '/receipts/evt-receipt-1');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/receipts/evt-receipt-1') return json(baseReceipt);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const providerLink = container.querySelector('a[href="/?provider_id=provider-1"]');
    expect(providerLink).not.toBeNull();
    expect(providerLink?.textContent?.toLowerCase()).toContain('provider');
  });
});
