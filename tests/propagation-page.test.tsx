// @vitest-environment jsdom
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function response(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) } as Response);
}

function installFetchMock(clusterId: string, state: 'isolated' | 'spreading' | 'systemic') {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(`/v1/propagation/${clusterId}`)) {
      return response({
        cluster_id: clusterId,
        propagation_state: state,
        severity: state === 'systemic' ? 'critical' : state === 'spreading' ? 'high' : 'low',
        affected_cluster: state === 'isolated' ? 'Image Cluster' : 'Vision Cluster',
        affected_categories: state === 'isolated' ? ['Image'] : ['Image', 'Video'],
        affected_providers: [{ provider_id: 'p1', provider_name: 'Provider One' }],
        first_observed_at: '2026-01-01T00:00:00.000Z',
        latest_observed_at: '2026-01-01T01:00:00.000Z',
        propagation_reason: 'Synthetic propagation incident for UI testing.',
        confidence: 0.78,
        supporting_event_ids: ['evt-1'],
        supporting_receipt_links: [{ event_id: 'evt-1', href: '/v1/events/evt-1' }],
        related_interpretation_links: [{ interpretation_id: 'int-1', title: 'Synthetic Interpretation', href: '/v1/pulse/summary#interpretation-int-1' }],
        related_provider_links: [{ provider_id: 'p1', provider_name: 'Provider One', href: '/v1/providers/p1' }],
        current_status: 'active',
        timeline: [{ event_id: 'evt-1', type: 'provider.degraded', category: 'monitoring', provider_id: 'p1', provider_name: 'Provider One', observed_at: '2026-01-01T00:00:00.000Z', summary: 'Provider degraded.', severity: 'warning' }]
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not_found' }) } as Response);
  }));
}

describe('public propagation page', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
    root = null;
    container = null;
  });

  async function renderAt(path: string) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.history.pushState({}, '', path);
    await act(async () => {
      root!.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return container;
  }

  it('renders isolated propagation incident page', async () => {
    installFetchMock('prop-iso', 'isolated');
    const node = await renderAt('/propagation/prop-iso');
    expect(node.textContent).toContain('Propagation Incident prop-iso');
    expect(node.textContent).toContain('isolated');
  });

  it('renders spreading propagation incident page with receipt and provider links', async () => {
    installFetchMock('prop-spread', 'spreading');
    const node = await renderAt('/propagation/prop-spread');
    expect(node.textContent).toContain('spreading');
    expect(node.querySelector('a[href="/v1/events/evt-1"]')).toBeTruthy();
    expect(node.querySelector('a[href="/v1/providers/p1"]')).toBeTruthy();
  });

  it('renders systemic propagation incident page', async () => {
    installFetchMock('prop-sys', 'systemic');
    const node = await renderAt('/propagation/prop-sys');
    expect(node.textContent).toContain('systemic');
  });

  it('renders not found state for missing cluster', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'propagation_cluster_not_found' }) } as Response)));
    const node = await renderAt('/propagation/prop-missing');
    expect(node.textContent).toContain('Propagation Cluster Not Found');
  });
});
