// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-05-19T00:00:00.000Z';
const bannedLanguage = /best route|top route|winner route|loser route|superiority proof|ranking authority|guaranteed trust|safest provider|recorded bundle|production briefing/i;

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function readinessCard() {
  return {
    provider_id: 'paysponge-coingecko',
    provider_label: 'CoinGecko Onchain DEX API',
    readiness_state: 'recorded_evidence',
    agent_spend_readiness: 'ready_for_inspection',
    evidence_summary: {
      recorded_benchmarks: 3,
      proven_routes: 3,
      controlled_bundle_runs: 2,
      scaffold_lanes: 0,
      caveat_count: 0,
      latest_artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-19',
      latest_observed_at: observedAt
    },
    proof_links: {
      benchmark_history: ['/v1/radar/benchmark-history/finance-data-token-metadata'],
      route_timelines: ['/v1/radar/benchmark-history/finance-data-token-metadata/routes/paysponge-coingecko'],
      bundle_runs: ['/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-084556-pay-cli']
    },
    builder_next_step: 'Inspect latest route timeline and caveats before routing agents.',
    agent_guidance: 'Artifact-backed route evidence exists; inspect latest route timelines and caveats before spend.',
    winner_claimed: false,
    share_copy: 'Radar card: CoinGecko Onchain DEX API is recorded_evidence. Proof exists: 3 recorded benchmarks, 3 proven routes, winner_claimed=false. Agents should inspect caveats before spend.'
  };
}

function installFetchMock(missing = false) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/radar/agent-readiness/paysponge-coingecko') {
      if (missing) return Promise.resolve(new Response(JSON.stringify({ error: 'provider_readiness_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
      return ok(readinessCard());
    }
    return Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }));
  });
}

describe('Agent Spend Readiness provider page', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    vi.restoreAllMocks();
    root = null;
    container = null;
    window.history.replaceState({}, '', '/');
  });

  it('renders the public readiness card for a known provider', async () => {
    window.history.pushState({}, '', '/radar/readiness/paysponge-coingecko');
    installFetchMock(false);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Agent Spend Readiness Card');
    expect(text).toContain('CoinGecko Onchain DEX API');
    expect(text).toContain('provider_id');
    expect(text).toContain('paysponge-coingecko');
    expect(text).toContain('recorded_evidence');
    expect(text).toContain('ready_for_inspection');
    expect(text).toContain('winner_claimed=false');
    expect(text).toContain('/radar/readiness/paysponge-coingecko');
    expect(text).toContain('https://radar.infopunks.fun/radar/readiness/paysponge-coingecko');
    expect(text).toContain('recorded_benchmarks');
    expect(text).toContain('proven_routes');
    expect(text).toContain('controlled_bundle_runs');
    expect(text).toContain('scaffold_lanes');
    expect(text).toContain('caveat_count');
    expect(text).toContain('latest artifact');
    expect(text).toContain('finance-data-token-metadata-benchmark-runs-2026-05-19');
    expect(text).toContain('latest observed');
    expect(text).toContain(observedAt);
    expect(text).toContain('Builder Next Step');
    expect(text).toContain('Inspect latest route timeline and caveats before routing agents.');
    expect(text).toContain('Share text');
    expect(text).toContain('Radar card: CoinGecko Onchain DEX API is recorded_evidence');
    expect(text).toContain('Proof-state diagnostics, not rankings.');
    expect(text).toContain('Builders can now see what agents see before spending.');
    expect(text).toContain('Agents should inspect caveats before spend.');
    expect(document.title).toBe('Agent Spend Readiness Card | Infopunks Radar');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Proof-state diagnostics for Pay.sh providers. Not rankings. winner_claimed=false.');
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Agent Spend Readiness Card | Infopunks Radar');
    expect(document.head.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('Proof-state diagnostics for Pay.sh providers. Not rankings. winner_claimed=false.');
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://radar.infopunks.fun/og-radar.png');
    expect(container.querySelector('button[aria-label="Copy share text"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Evidence counts row"]')).not.toBeNull();
    expect(text).not.toMatch(bannedLanguage);
  });

  it('renders missing readiness card state for an unknown provider', async () => {
    window.history.pushState({}, '', '/radar/readiness/paysponge-coingecko');
    installFetchMock(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Provider readiness card not found.');
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.textContent ?? '').not.toMatch(bannedLanguage);
  });
});
