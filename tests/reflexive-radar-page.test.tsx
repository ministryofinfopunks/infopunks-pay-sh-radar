// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReflexiveRadarPage } from '../src/web/rhChainReflexiveRadarPage';

describe('Reflexive Radar initial registry state', () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  it('surfaces the canonical refresh gate for the unverified long audit 409', async () => {
    window.history.pushState({}, '', '/4663/reflexive');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/audits/long-ai-nvda')) return new Response(JSON.stringify({ error: 'long_audit_canonical_registry_not_refreshed' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ data: { assets: [], pairs: [], observations: [], events: [], thesis: [], refreshed_at: '2026-10-09T00:00:00.000Z' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => { root!.render(<ReflexiveRadarPage />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.textContent).toContain('AI / NVDA AUDIT UNAVAILABLE');
    expect(container.textContent).toContain('CANONICAL ASSET REFRESH IS REQUIRED');
    expect(container.textContent).toContain('NO MARKET STATE IS INFERRED');
  });
});
