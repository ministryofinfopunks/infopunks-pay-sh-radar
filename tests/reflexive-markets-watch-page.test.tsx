// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReflexiveRadarPage } from '../src/web/rhChainReflexiveRadarPage';
import { App } from '../src/web/radarApp';
import { InMemoryReflexiveStore } from '../src/services/rhChainReflexiveRadarService';
import { InMemoryReflexiveWatchStore, ReflexiveMarketsWatchService } from '../src/services/rhChainReflexiveWatchService';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function json(data: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), { status, headers: { 'content-type': 'application/json' } })); }

async function watchPayload() {
  const radar = new InMemoryReflexiveStore();
  return new ReflexiveMarketsWatchService(() => radar.load(), new InMemoryReflexiveWatchStore(), () => new Date('2026-09-03T00:00:00.000Z')).snapshot();
}

async function render(path: string, component: React.ReactElement) {
  window.history.replaceState({}, '', path);
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root;
  await act(async () => { root = createRoot(container); root.render(component); await Promise.resolve(); await Promise.resolve(); });
  return { container, root: root! };
}

describe('Reflexive Markets Watch pages', () => {
  let root: Root | undefined;
  afterEach(() => { root?.unmount(); root = undefined; document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('renders Watch/Radar visual distinction, casebook, falsification queue and thesis board', async () => {
    const payload = await watchPayload();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => new URL(String(input), 'http://localhost').pathname === '/v1/4663/reflexive/watch' ? json(payload) : json('not_found', 404));
    const rendered = await render('/4663/reflexive/watch', <ReflexiveRadarPage />);
    root = rendered.root;
    const text = rendered.container.textContent ?? '';
    expect(text).toContain('REFLEXIVE MARKETS WATCH');
    expect(text).toContain('WATCH / PROVISIONAL');
    expect(text).toContain('RADAR /');
    expect(text).toContain('FALSIFICATION QUEUE');
    expect(text).toContain('RWA ACTIVATION CASEBOOK');
    expect(text).toContain('RA1');
    expect(text).toContain('EARLY SUPPORTING EVIDENCE');
  });

  it('renders case page sections without trading CTA language', async () => {
    const payload = await watchPayload();
    const detail = { case: payload.cases.find((item) => item.case_id === 'AI_NVDA_CAPITAL_VS_FLOW'), claims: payload.claims.filter((claim) => claim.subject_assets.includes('NVDA')), audit_targets: payload.audit_targets, thesis_board: payload.thesis_board, doctrine: payload.doctrine };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => new URL(String(input), 'http://localhost').pathname.includes('/v1/4663/reflexive/watch/cases/') ? json(detail) : json('not_found', 404));
    const rendered = await render('/4663/reflexive/watch/AI_NVDA_CAPITAL_VS_FLOW', <ReflexiveRadarPage />);
    root = rendered.root;
    const text = rendered.container.textContent ?? '';
    for (const label of ['WHAT HAPPENED', 'WATCH INTERPRETATION', 'RADAR EVIDENCE', 'PERSISTENCE', 'WHAT WOULD FALSIFY THIS?', 'OPEN GAPS', 'THESIS IMPACT', 'TIMELINE']) expect(text).toContain(label);
    expect(text).toContain('WATCH_INTERPRETATION');
    expect(text).not.toMatch(/buy now|trade now|execute trade|trading CTA/i);
  });

  it('routes mobile-sized Watch paths through the public App', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const payload = await watchPayload();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => new URL(String(input), 'http://localhost').pathname === '/v1/4663/reflexive/watch' ? json(payload) : json('not_found', 404));
    const rendered = await render('/4663/reflexive/watch', <App />);
    root = rendered.root;
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(rendered.container.textContent).toContain('REFLEXIVE MARKETS WATCH');
    expect(rendered.container.querySelector('.reflexive-watch-feed')).toBeTruthy();
  });
});
