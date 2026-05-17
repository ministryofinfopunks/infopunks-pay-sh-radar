import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { listBenchmarkArtifacts } from '../src/data/benchmarkArtifacts';
import { buildRadarBenchmarks, buildRadarBenchmarkSummary } from '../src/services/radarBenchmarkService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('benchmark artifact registry', () => {
  const CANONICAL_ID = 'finance-data-sol-price-benchmark-runs-2026-05-16';
  const LEGACY_ID = 'finance-data-sol-price-runs-2026-05-16';
  const TOKEN_SEARCH_CANONICAL_ID = 'finance-data-token-search-benchmark-runs-2026-05-17';
  const PAYSPONGE_ROUTE_ID = 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL';

  it('includes five-run SOL benchmark artifact', () => {
    const artifact = listBenchmarkArtifacts().find((row) => row.artifact_id === CANONICAL_ID);
    expect(artifact).toBeTruthy();
    expect(artifact?.benchmark_id).toBe('finance-data-sol-price');
    expect(artifact?.total_runs).toBe(5);
    expect(artifact?.winner_status).toBe('no_clear_winner');
    expect(artifact?.winner_claimed).toBe(false);
    expect(artifact?.source_repo).toBe('https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness');
    const paysponge = artifact?.routes.find((route) => route.provider_id === 'paysponge-coingecko');
    expect(paysponge?.route_id).toBe(PAYSPONGE_ROUTE_ID);
    expect(paysponge?.median_latency_ms).toBe(7761);
    expect(paysponge?.p95_latency_ms).toBe(7946);
    expect(paysponge?.average_price_usd).toBe(87.50392093173244);
    expect(paysponge?.min_price_usd).toBe(87.50332626375734);
    expect(paysponge?.max_price_usd).toBe(87.50629960363277);
    expect(paysponge?.price_variance_percent).toBe(0.0033979504504081403);
  });

  it('benchmark service consumes artifact metrics and preserves prior benchmark values', () => {
    const benchmarks = buildRadarBenchmarks().benchmarks;
    const sol = benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price');
    const tokenSearch = benchmarks.find((row) => row.benchmark_id === 'finance-data-token-search');
    expect(benchmarks.map((row) => row.benchmark_id)).toEqual(['finance-data-sol-price', 'finance-data-token-search']);
    expect(sol).toBeTruthy();
    const stable = sol?.routes.find((item) => item.provider_id === 'merit-systems-stablecrypto-market-data');
    const paysponge = sol?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(stable?.route_id).toBe('merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/price');
    expect(paysponge?.route_id).toBe(PAYSPONGE_ROUTE_ID);
    expect(stable?.latency_ms).toBe(5691);
    expect(stable?.average_price_usd).toBe(87.57);
    expect(paysponge?.latency_ms).toBe(7761);
    expect(paysponge?.average_price_usd).toBe(87.50392093173244);
    expect(sol?.winner_status).toBe('no_clear_winner');
    expect(sol?.winner_claimed).toBe(false);
    expect(sol?.benchmark_recorded).toBe(true);
    expect(tokenSearch).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      category: 'finance/data',
      benchmark_intent: 'token search',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
      next_step: 'define scoring thresholds before declaring a route winner'
    });
    expect(tokenSearch?.routes.length).toBe(2);
    const tokenSearchPaysponge = tokenSearch?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(tokenSearchPaysponge?.median_latency_ms).toBe(8533);
    expect(tokenSearchPaysponge?.p95_latency_ms).toBe(10545);
  });

  it('builds compact agent benchmark summary from existing benchmark records', () => {
    const summary = buildRadarBenchmarkSummary();
    expect(summary.recorded_benchmarks).toBe(2);
    expect(summary.total_benchmarks).toBe(2);
    expect(summary.winner_claimed).toBe(false);
    expect(summary.agent_guidance).toEqual([
      'winner_claimed=false means no route winner should be inferred.',
      'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
      'Use full benchmark endpoints for route-level metrics.'
    ]);

    const sol = summary.benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price');
    const tokenSearch = summary.benchmarks.find((row) => row.benchmark_id === 'finance-data-token-search');
    expect(sol).toMatchObject({
      category: 'finance/data',
      benchmark_intent: 'get SOL price',
      status: 'recorded',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      artifact_id: CANONICAL_ID
    });
    expect(tokenSearch).toMatchObject({
      category: 'finance/data',
      benchmark_intent: 'token search',
      status: 'recorded',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      artifact_id: TOKEN_SEARCH_CANONICAL_ID
    });
  });

  it('artifact endpoints return safe metadata only and do not expose raw proof contents', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-artifacts' });
    expect(listResponse.statusCode).toBe(200);
    const artifacts = listResponse.json().data.artifacts as Array<Record<string, unknown>>;
    expect(artifacts.length).toBeGreaterThan(0);
    const sol = artifacts.find((row) => row.artifact_id === CANONICAL_ID);
    expect(sol).toBeTruthy();
    expect(sol).toHaveProperty('artifact_path');
    expect(sol).toHaveProperty('routes');
    expect(sol).not.toHaveProperty('proof_markdown');
    expect(JSON.stringify(sol)).not.toContain('# ');
    expect(JSON.stringify(sol)).not.toContain('```');

    const detailResponse = await app.inject({ method: 'GET', url: `/v1/radar/benchmark-artifacts/${CANONICAL_ID}` });
    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json().data;
    expect(detail.artifact_id).toBe(CANONICAL_ID);
    expect(detail.winner_status).toBe('no_clear_winner');
    expect(detail.winner_claimed).toBe(false);
    expect(detail).not.toHaveProperty('raw_proof_contents');
    const paysponge = detail.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(paysponge.route_id).toBe(PAYSPONGE_ROUTE_ID);

    const legacyResponse = await app.inject({ method: 'GET', url: `/v1/radar/benchmark-artifacts/${LEGACY_ID}` });
    expect(legacyResponse.statusCode).toBe(200);
    expect(legacyResponse.json().data.artifact_id).toBe(CANONICAL_ID);

    const benchmarkListResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    expect(benchmarkListResponse.statusCode).toBe(200);
    expect(benchmarkListResponse.json().data.benchmarks.map((row: { benchmark_id: string }) => row.benchmark_id)).toContain('finance-data-token-search');
    expect(benchmarkListResponse.json().data.benchmarks[0]).toHaveProperty('routes');
    expect(benchmarkListResponse.json().data.benchmarks[0].routes[0]).toHaveProperty('median_latency_ms');

    const summaryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-summary' });
    expect(summaryResponse.statusCode).toBe(200);
    const summary = summaryResponse.json().data;
    expect(summary.recorded_benchmarks).toBe(2);
    expect(summary.total_benchmarks).toBe(2);
    expect(summary.winner_claimed).toBe(false);
    expect(summary.benchmarks.map((row: { benchmark_id: string }) => row.benchmark_id)).toEqual(['finance-data-sol-price', 'finance-data-token-search']);
    expect(summary.benchmarks.every((row: { routes_count: number }) => row.routes_count === 2)).toBe(true);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-sol-price').artifact_id).toBe(CANONICAL_ID);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-search').artifact_id).toBe(TOKEN_SEARCH_CANONICAL_ID);
    expect(summary.benchmarks[0]).not.toHaveProperty('routes');
    expect(summary.benchmarks[0]).not.toHaveProperty('median_latency_ms');
    expect(summary.benchmarks[0]).not.toHaveProperty('success_rate');

    const benchmarkResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price' });
    expect(benchmarkResponse.statusCode).toBe(200);
    const benchmark = benchmarkResponse.json().data;
    const benchmarkPaysponge = benchmark.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(benchmarkPaysponge.route_id).toBe(PAYSPONGE_ROUTE_ID);

    const tokenSearchResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-search' });
    expect(tokenSearchResponse.statusCode).toBe(200);
    expect(tokenSearchResponse.json().data).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect((tokenSearchResponse.json().data.routes as unknown[]).length).toBe(2);

    const solHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price/history' });
    expect(solHistoryResponse.statusCode).toBe(200);
    const solHistory = solHistoryResponse.json().data;
    expect(solHistory.benchmark_id).toBe('finance-data-sol-price');
    expect(solHistory.entries.length).toBe(1);
    expect(solHistory.entries[0].run_count).toBe(5);
    expect(solHistory.entries[0].proof_reference).toBe('live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md');
    expect(solHistory.entries.some((entry: { run_count: number }) => entry.run_count === 1)).toBe(false);
    expect(solHistory.winner_claimed).toBe(false);
    expect(solHistory.latest_artifact_id).toBe(CANONICAL_ID);
    expect(solHistory.routes_count).toBe(2);
    expect(solHistory.route_summaries.length).toBe(2);

    const tokenSearchHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-search/history' });
    expect(tokenSearchHistoryResponse.statusCode).toBe(200);
    const tokenSearchHistory = tokenSearchHistoryResponse.json().data;
    expect(tokenSearchHistory.benchmark_id).toBe('finance-data-token-search');
    expect(tokenSearchHistory.entries.length).toBe(1);
    expect(tokenSearchHistory.entries[0].run_count).toBe(5);
    expect(tokenSearchHistory.entries[0].proof_reference).toBe('live-proofs/finance-data-token-search-benchmark-runs-2026-05-17.md');
    expect(tokenSearchHistory.winner_claimed).toBe(false);
    expect(tokenSearchHistory.latest_artifact_id).toBe(TOKEN_SEARCH_CANONICAL_ID);
    expect(tokenSearchHistory.routes_count).toBe(2);
    expect(tokenSearchHistory.route_summaries.length).toBe(2);

    const aggregateHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history' });
    expect(aggregateHistoryResponse.statusCode).toBe(200);
    const aggregateHistory = aggregateHistoryResponse.json().data;
    expect(aggregateHistory.benchmarks.length).toBe(2);
    expect(aggregateHistory.benchmarks.every((row: { winner_claimed: boolean }) => row.winner_claimed === false)).toBe(true);

    await app.close();
  });

  it('registers the token-search benchmark artifact', () => {
    const artifacts = listBenchmarkArtifacts();
    const tokenSearch = artifacts.find((row) => row.artifact_id === TOKEN_SEARCH_CANONICAL_ID);
    expect(tokenSearch).toBeTruthy();
    expect(tokenSearch?.benchmark_id).toBe('finance-data-token-search');
    expect(tokenSearch?.artifact_path).toBe('live-proofs/finance-data-token-search-benchmark-runs-2026-05-17.md');
    expect(tokenSearch?.source_repo).toBe('https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness');
    expect(tokenSearch?.total_runs).toBe(5);
    expect(tokenSearch?.winner_status).toBe('no_clear_winner');
    expect(tokenSearch?.winner_claimed).toBe(false);
  });
});
