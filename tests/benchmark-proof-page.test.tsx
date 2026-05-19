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

function benchmarkSummary() {
  return {
    generated_at: observedAt,
    source: 'infopunks-pay-sh-radar',
    recorded_benchmarks: 4,
    total_benchmarks: 7,
    total_artifacts: 5,
    winner_claimed: false,
    total_recorded_runs: 30,
    proven_routes: 8,
    benchmarks: [
      {
        benchmark_id: 'finance-data-sol-price',
        label: 'SOL Price',
        status: 'recorded',
        winner_status: 'no_clear_winner',
        winner_claimed: false,
        routes_count: 2,
        recorded_runs: 5
      },
      {
        benchmark_id: 'finance-data-token-search',
        label: 'Token Search',
        status: 'recorded',
        winner_status: 'no_clear_winner',
        winner_claimed: false,
        routes_count: 2,
        recorded_runs: 5
      },
      {
        benchmark_id: 'finance-data-token-metadata',
        label: 'Token Metadata',
        status: 'recorded',
        winner_status: 'no_clear_winner',
        winner_claimed: false,
        routes_count: 2,
        recorded_runs: 5
      },
      {
        benchmark_id: 'data-web-search-results',
        label: 'Web Search Results',
        status: 'recorded',
        winner_status: 'no_clear_winner',
        winner_claimed: false,
        routes_count: 2,
        recorded_runs: 10
      }
    ],
    agent_guidance: [
      'winner_claimed=false means no route winner should be inferred.',
      'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
      'Use full benchmark endpoints for route-level metrics.'
    ]
  };
}

function installFetchMock(options: { benchmarkSummaryFails?: boolean } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/radar/benchmark-summary') {
      if (options.benchmarkSummaryFails) return Promise.resolve(new Response(JSON.stringify({ error: 'summary delayed' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      return json(benchmarkSummary());
    }
    if (path === '/v1/radar/benchmark-history') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      history_count: 4,
      total_artifacts: 5,
      total_recorded_runs: 30,
      winner_claimed: false,
      benchmarks: [
        { benchmark_id: 'finance-data-sol-price', label: 'SOL price', status: 'recorded', artifact_count: 1, total_recorded_runs: 5, routes_count: 2, winner_status: 'no_clear_winner', winner_claimed: false },
        { benchmark_id: 'finance-data-token-search', label: 'Token search', status: 'recorded', artifact_count: 1, total_recorded_runs: 5, routes_count: 2, winner_status: 'no_clear_winner', winner_claimed: false },
        { benchmark_id: 'finance-data-token-metadata', label: 'Token metadata', status: 'recorded', artifact_count: 2, total_recorded_runs: 10, routes_count: 2, winner_status: 'no_clear_winner', winner_claimed: false },
        { benchmark_id: 'data-web-search-results', label: 'Web search results', status: 'recorded', artifact_count: 1, total_recorded_runs: 10, routes_count: 2, winner_status: 'no_clear_winner', winner_claimed: false }
      ]
    });
    if (path === '/v1/radar/benchmarks') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      benchmarks: [
        {
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
        },
        {
          benchmark_id: 'finance-data-token-search',
          category: 'finance/data',
          benchmark_intent: 'token search',
          benchmark_recorded: true,
          winner_claimed: false,
          winner_status: 'no_clear_winner',
          winner_policy: {
            policy_id: 'token-search-v0.1',
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
              route_id: 'stable-token-search',
              execution_status: 'proven',
              latency_ms: 7048,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 7048,
              p95_latency_ms: 9946,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
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
              route_id: 'paysponge-token-search',
              execution_status: 'proven',
              latency_ms: 8533,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 8533,
              p95_latency_ms: 10545,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
              completed_runs: 5,
              failed_runs: 0,
              status_evidence: 'pay_cli exit code 0 and parsed response body',
              output_shape: null,
              normalization_confidence: 'high',
              freshness_timestamp: observedAt,
              comparison_notes: 'no winner claim'
            }
          ]
        },
        {
          benchmark_id: 'finance-data-token-metadata',
          category: 'finance/data',
          benchmark_intent: 'token metadata',
          benchmark_recorded: true,
          winner_claimed: false,
          winner_status: 'no_clear_winner',
          next_step: 'define scoring thresholds before declaring a route winner',
          readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
          routes: [
            {
              provider_id: 'paysponge-coingecko',
              route_id: 'paysponge-token-metadata',
              execution_status: 'proven',
              latency_ms: 5827,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 5827,
              p95_latency_ms: 10307,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
              completed_runs: 5,
              failed_runs: 0,
              status_evidence: 'pay_cli exit code 0 and parsed response body',
              output_shape: null,
              normalization_confidence: 'high',
              freshness_timestamp: observedAt,
              comparison_notes: 'no winner claim'
            },
            {
              provider_id: 'merit-systems-stablecrypto-market-data',
              route_id: 'stable-token-metadata',
              execution_status: 'proven',
              latency_ms: 4982,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 4982,
              p95_latency_ms: 5107,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
              completed_runs: 5,
              failed_runs: 0,
              status_evidence: 'pay_cli exit code 0 and parsed response body',
              output_shape: null,
              normalization_confidence: 'high',
              freshness_timestamp: observedAt,
              comparison_notes: 'no winner claim'
            }
          ]
        },
        {
          benchmark_id: 'data-web-search-results',
          category: 'web-search',
          benchmark_intent: 'search the web for the same query and return normalized search results',
          benchmark_recorded: true,
          winner_claimed: false,
          winner_status: 'no_clear_winner',
          next_step: 'define scoring thresholds before declaring a route winner',
          readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
          routes: [
            {
              provider_id: 'stableenrich-exa-search',
              route_id: 'stableenrich-exa-search:POST:/api/exa/search',
              execution_status: 'proven',
              latency_ms: 4962,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/data-web-search-results-paid-routes-2026-05-19.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 4962,
              p95_latency_ms: 5411,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
              completed_runs: 5,
              failed_runs: 0,
              status_evidence: 'pay_cli exit code 0 and parsed response body',
              output_shape: null,
              normalization_confidence: 'high',
              freshness_timestamp: observedAt,
              comparison_notes: 'no winner claim'
            },
            {
              provider_id: 'perplexity-search',
              route_id: 'perplexity-search:POST:/api/search',
              execution_status: 'proven',
              latency_ms: 5229,
              paid_execution_proven: true,
              proof_reference: 'live-proofs/data-web-search-results-paid-routes-2026-05-19.md',
              normalized_output_available: true,
              extracted_price_usd: null,
              success_rate: 1,
              median_latency_ms: 5229,
              p95_latency_ms: 5988,
              average_price_usd: null,
              min_price_usd: null,
              max_price_usd: null,
              price_variance_percent: null,
              completed_runs: 5,
              failed_runs: 0,
              status_evidence: 'pay_cli exit code 0 and parsed response body',
              output_shape: null,
              normalization_confidence: 'high',
              freshness_timestamp: observedAt,
              comparison_notes: 'no winner claim'
            }
          ]
        },
        {
          benchmark_id: 'communications-email-delivery',
          category: 'communications',
          benchmark_intent: 'email delivery',
          benchmark_recorded: false,
          winner_claimed: false,
          winner_status: 'not_evaluated',
          next_step: 'resolve AgentMail blockage and record comparable artifact',
          readiness_note: 'StableEmail paid-executed, verified/proven but caveated. AgentMail blocked / no second comparable route. No benchmark artifact.',
          routes: [
            { provider_id: 'stableemail', route_id: 'stableemail:POST:/send', execution_status: 'proven', paid_execution_proven: true },
            { provider_id: 'agentmail', route_id: 'agentmail:POST:/send', execution_status: 'blocked', paid_execution_proven: false }
          ]
        },
        {
          benchmark_id: 'solana-infra-account-balance',
          category: 'solana/infra',
          benchmark_intent: 'account balance',
          benchmark_recorded: false,
          winner_claimed: false,
          winner_status: 'not_evaluated',
          next_step: 'complete paid run and find a second comparable route',
          readiness_note: 'QuickNode unpaid 402 confirmed. Paid run failed. No second comparable route. No benchmark artifact.',
          routes: [
            { provider_id: 'quicknode', route_id: 'quicknode:POST:/solana/balance', execution_status: 'blocked', paid_execution_proven: false }
          ]
        },
        {
          benchmark_id: 'social-data-reddit-post-search',
          category: 'social/data',
          benchmark_intent: 'reddit post search',
          benchmark_recorded: false,
          winner_claimed: false,
          winner_status: 'not_evaluated',
          next_step: 'prove a second comparable semantic route and record artifact',
          readiness_note: 'StableEnrich paid-proven but caveated. StableSocial paid-compatible but semantic proof failed. No second paid-proven comparable route. No benchmark artifact.',
          routes: [
            { provider_id: 'stableenrich', route_id: 'stableenrich:POST:/reddit/search', execution_status: 'proven', paid_execution_proven: true },
            { provider_id: 'stablesocial', route_id: 'stablesocial:POST:/reddit/search', execution_status: 'blocked', paid_execution_proven: false }
          ]
        }
      ]
    });
    if (path === '/v1/radar/benchmarks/finance-data-sol-price/history') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      benchmark_id: 'finance-data-sol-price',
      entries: [
        {
          benchmark_id: 'finance-data-sol-price',
          recorded_at: '2026-05-15T00:00:00.000Z',
          run_count: 1,
          benchmark_recorded: true,
          winner_claimed: false,
          note: 'first live normalized single-run benchmark',
          proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
          routes: []
        },
        {
          benchmark_id: 'finance-data-sol-price',
          recorded_at: '2026-05-16T07:42:42.271Z',
          run_count: 5,
          benchmark_recorded: true,
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          note: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.',
          proof_reference: 'live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md',
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
        }
      ]
    });
    if (path === '/v1/radar/benchmark-history/finance-data-sol-price/routes') return json({
      benchmark_id: 'finance-data-sol-price',
      label: 'SOL Price',
      route_count: 2,
      artifact_count: 1,
      winner_claimed: false,
      routes: [
        {
          route_id: 'stable',
          provider_id: 'merit-systems-stablecrypto-market-data',
          label: 'merit systems stablecrypto market data',
          artifact_count: 1,
          first_recorded_at: '2026-05-16T07:42:42.271Z',
          latest_recorded_at: '2026-05-16T07:42:42.271Z',
          latest_artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16',
          latest_success_count: 5,
          latest_failure_count: 0,
          latest_median_latency_ms: 5691,
          latest_p95_latency_ms: 6469,
          latest_detection_rate: 1,
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          caveats: []
        },
        {
          route_id: 'paysponge',
          provider_id: 'paysponge-coingecko',
          label: 'paysponge coingecko',
          artifact_count: 1,
          first_recorded_at: '2026-05-16T07:42:42.271Z',
          latest_recorded_at: '2026-05-16T07:42:42.271Z',
          latest_artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16',
          latest_success_count: 5,
          latest_failure_count: 0,
          latest_median_latency_ms: 7761,
          latest_p95_latency_ms: 7946,
          latest_detection_rate: 1,
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          caveats: []
        }
      ]
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

    const text = container.textContent ?? '';
    expect(text).toContain('Radar Evidence Ledger');
    expect(text).toContain('Radar records benchmark evidence for Pay.sh routes before agents spend.');
    expect(text).toContain('Agent Evidence Demo');
    expect(text).toContain('4 recorded benchmarks');
    expect(text).toContain('5 artifacts');
    expect(text).toContain('30 recorded route-runs');
    expect(text).toContain('8 proven paid routes');
    expect(text).toContain('0 winner claims');
    expect(text.indexOf('Recorded Benchmark Lanes')).toBeLessThan(text.indexOf('Agent Evidence Demo'));
    expect(text.indexOf('Explored, Not Promoted')).toBeLessThan(text.indexOf('Agent Evidence Demo'));
    expect(text).toContain('Recorded means paid route evidence exists. It does not mean a winner was crowned.');
    expect(text).toContain('Scaffold means the lane was explored but did not meet the hard bar.');
    expect(text).toContain('Radar does not rewrite uncertainty. It records it, fixes it, and shows the delta.');
    expect(text).toContain('route timeline: available');
    expect(text).toContain('GET /v1/radar/benchmark-summary');
    expect(text).toContain('GET /v1/radar/benchmark-history');
    expect(text).toContain('"recorded_benchmarks": 4');
    expect(text).toContain('"total_artifacts": 5');
    expect(text).toContain('"routes_count": 2');
    expect(text).toContain('"recorded_runs": 5');
    expect(text).toContain('winner_claimed=false and winner_status=no_clear_winner mean Radar shows evidence without route winner claims.');
    expect(text).toContain('routes_countshows comparable proven routes per benchmark.');
    expect(text).toContain('recorded_runsshows recorded route-run evidence.');
    expect(text).toContain('Agent Route Timeline API');
    expect(text).toContain('GET /v1/radar/benchmark-history/finance-data-token-metadata/routes');
    expect(text).toContain('GET /v1/radar/benchmark-history/finance-data-token-metadata/routes/{route_id}');
    expect(text).toContain('evidence_healthrecorded | caveated | stale | degraded | unverified | scaffold');
    expect(text).toContain('caveat_objectsMachine-readable caveats');
    expect(text).toContain('winner_claimedfalse means agents should not infer a winner.');
    expect(text).toContain('route_id may contain slashes or colons. URL-encode route_id before calling the detail endpoint.');
    expect(text).toContain('canonical_network_mismatch');
    expect(text).not.toMatch(/fastest route|safest route|recommended route/i);
    expect(text).toContain('SOL Price');
    expect(text).toContain('Token Search');
    expect(text).toContain('Token Metadata');
    expect(text).toContain('Web Search Results');
    expect(text).toContain('data-web-search-results');
    expect(text).toContain('Explored, Not Promoted');
    expect(text).toContain('Communications Email Delivery');
    expect(text).toContain('Solana Account Balance');
    expect(text).toContain('Reddit Post Search');
    expect(text).toContain('StableEmail paid-executed, verified/proven but caveated');
    expect(text).toContain('AgentMail blocked / no second comparable route');
    expect(text).toContain('QuickNode unpaid 402 confirmed');
    expect(text).toContain('paid run failed');
    expect(text).toContain('StableEnrich paid-proven but caveated');
    expect(text).toContain('StableSocial paid-compatible but semantic proof failed');
    expect(text).toContain('no second paid-proven comparable route');
    expect(text).toContain('winner_status: no_clear_winner');
    expect(text).toContain('winner_claimed=false');
    expect(text).toContain('10 recorded route-runs');
    expect(text).toContain('5 runs / route');
    expect(text.match(/state: recorded/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(text.match(/winner_claimed=false/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(text).toContain('Radar does not infer a route winner.');
    expect(text).not.toMatch(/winning/i);
    expect(text).not.toMatch(/best route|top route/i);
    const link = container.querySelector('a[href="/benchmarks/finance-data-sol-price"]');
    expect(link).not.toBeNull();
    const scaffoldLink = container.querySelector('a[href="/benchmarks/finance-data-token-search"]');
    expect(scaffoldLink).not.toBeNull();
    const metadataLink = container.querySelector('a[href="/benchmarks/finance-data-token-metadata"]');
    expect(metadataLink).not.toBeNull();
  });

  it('keeps benchmark proof links visible when live benchmark summary is degraded', async () => {
    window.history.pushState({}, '', '/benchmarks');
    installFetchMock({ benchmarkSummaryFails: true });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Benchmark summary unavailable. Static benchmark proof pages remain available.');
    expect(text).toContain('SOL Price');
    expect(text).toContain('Token Search');
    expect(container.querySelector('a[href="/benchmarks/finance-data-sol-price"]')).not.toBeNull();
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
    expect(text).toContain('Route Evidence Timeline');
    expect(text).toContain('route_count: 2');
    expect(text).toContain('latest_artifact_id: finance-data-sol-price-benchmark-runs-2026-05-16');
    expect(text).toContain('latest_detection_rate: 1');
    expect(text).toContain('Benchmark History');
    expect(text).toContain('2026-05-15');
    expect(text).toContain('1 run');
    expect(text).toContain('first live normalized single-run benchmark');
    expect(text).toContain('2026-05-16');
    expect(text).toContain('5 runs');
    expect(text).toContain('winner_status: no clear winner');
    expect(text).not.toContain('StableCrypto wins');
    expect(text).not.toContain('PaySponge CoinGecko wins');
    expect(text).not.toContain('StableCrypto beats');
    expect(text).not.toContain('PaySponge CoinGecko beats');
  });

  it('renders token-search recorded proof without route claim language', async () => {
    window.history.pushState({}, '', '/benchmarks/finance-data-token-search');
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
    expect(text).toContain('Benchmark Proof: finance-data-token-search');
    expect(text).not.toContain('Benchmark Scaffold: finance-data-token-search');
    expect(text).toContain('benchmark_recorded: true');
    expect(text).toContain('winner_status: no clear winner');
    expect(text).toContain('No route winner is claimed.');
    expect(text).toContain('StableCrypto');
    expect(text).toContain('PaySponge CoinGecko');
    expect(text).toContain('success_rate: 1');
    expect(text).toContain('median_latency_ms: 7048');
    expect(text).toContain('live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md');
    expect(text).toContain('live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md');
    expect(text).not.toContain('StableCrypto wins');
    expect(text).not.toContain('PaySponge CoinGecko wins');
    expect(text).not.toMatch(/best route|superior|superiority|winning/i);
  });
});
