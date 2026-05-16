// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-05-16T10:00:00.000Z';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetchMock() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/radar/benchmarks') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      benchmarks: [{
        benchmark_id: 'finance-data-sol-price',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        benchmark_recorded: true,
        winner_claimed: false,
        winner_status: 'no_clear_winner',
        winner_policy: {
          policy_id: 'sol-price-v0.1',
          policy_version: '0.1',
          required_successful_runs_per_route: 5,
          minimum_success_rate: 0.8,
          allowed_price_variance_percent: 1,
          latency_metric: 'median',
          required_confidence: ['high', 'medium'],
          scoring_weights: { reliability: 0.4, latency: 0.25, normalization_confidence: 0.15, price_consistency: 0.1, cost_clarity: 0.05, freshness: 0.05 },
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          completed_runs: 5,
          required_runs: 5,
          next_step: 'define scoring thresholds before declaring a route winner'
        },
        next_step: 'define scoring thresholds before declaring a route winner',
        readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
        routes: [
          {
            provider_id: 'merit-systems-stablecrypto-market-data',
            route_id: 'stable',
            execution_status: 'proven',
            latency_ms: 5691,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md',
            normalized_output_available: true,
            extracted_price_usd: 87.57,
            success_rate: 1,
            median_latency_ms: 5691,
            p95_latency_ms: 6469,
            average_price_usd: 87.57,
            min_price_usd: 87.57,
            max_price_usd: 87.57,
            price_variance_percent: 0,
            completed_runs: 5,
            failed_runs: 0,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: observedAt,
            comparison_notes: 'no winner claim'
          },
          {
            provider_id: 'paysponge-coingecko',
            route_id: 'paysponge',
            execution_status: 'proven',
            latency_ms: 7761,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
            normalized_output_available: true,
            extracted_price_usd: 87.5,
            success_rate: 1,
            median_latency_ms: 7761,
            p95_latency_ms: 7946,
            average_price_usd: 87.5039,
            min_price_usd: 87.5,
            max_price_usd: 87.506,
            price_variance_percent: 0.0033,
            completed_runs: 5,
            failed_runs: 0,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: observedAt,
            comparison_notes: 'no winner claim'
          }
        ]
      }]
    });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

describe('public benchmark proof pages', () => {
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

  it('renders benchmark registry page and benchmark proof link', async () => {
    window.history.pushState({}, '', '/benchmarks');
    installFetchMock();

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Public Benchmarks');
    expect(container.textContent).toContain('finance-data-sol-price');
    expect(container.textContent).toContain('winner_claimed: false');
    const link = container.querySelector('a[href="/benchmarks/finance-data-sol-price"]');
    expect(link).not.toBeNull();
  });

  it('renders benchmark proof details and non-crowning language', async () => {
    window.history.pushState({}, '', '/benchmarks/finance-data-sol-price');
    installFetchMock();

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Benchmark Proof: finance-data-sol-price');
    expect(text).toContain('StableCrypto');
    expect(text).toContain('PaySponge CoinGecko');
    expect(text).toContain('winner_claimed: false');
    expect(text).toContain('winner_status: no clear winner');
    expect(text).toContain('No route winner is claimed.');
    expect(text).toContain('success_rate: 1');
    expect(text).toContain('median_latency_ms: 5691');
    expect(text).toContain('p95_latency_ms: 6469');
    expect(text).toContain('average_price_usd: 87.57');
    expect(text).toContain('price_variance_percent: 0.0033');
    expect(text).toContain('completed_runs: 5');
    expect(text).toContain('failed_runs: 0');
    expect(text).toContain('live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md');
    expect(text).toContain('live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md');
    expect(text).toContain('status_evidence: pay_cli exit code 0 and parsed response body');
    expect(text).not.toContain('StableCrypto wins');
    expect(text).not.toContain('PaySponge CoinGecko wins');
    expect(text).not.toContain('StableCrypto beats');
    expect(text).not.toContain('PaySponge CoinGecko beats');
  });
});
