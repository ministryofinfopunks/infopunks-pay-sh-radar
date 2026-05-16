import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { listBenchmarkArtifacts } from '../src/data/benchmarkArtifacts';
import { buildRadarBenchmarks } from '../src/services/radarBenchmarkService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('benchmark artifact registry', () => {
  const CANONICAL_ID = 'finance-data-sol-price-benchmark-runs-2026-05-16';
  const LEGACY_ID = 'finance-data-sol-price-runs-2026-05-16';
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
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false,
      readiness_note: 'Benchmark scaffold exists. Comparable proven routes are not yet recorded.',
      next_step: 'verify comparable token-search route mappings before benchmarking',
      routes: []
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

    const benchmarkResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price' });
    expect(benchmarkResponse.statusCode).toBe(200);
    const benchmark = benchmarkResponse.json().data;
    const benchmarkPaysponge = benchmark.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(benchmarkPaysponge.route_id).toBe(PAYSPONGE_ROUTE_ID);

    const tokenSearchResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-search' });
    expect(tokenSearchResponse.statusCode).toBe(200);
    expect(tokenSearchResponse.json().data).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false,
      routes: []
    });

    await app.close();
  });

  it('does not create a fake token-search benchmark artifact', () => {
    const artifacts = listBenchmarkArtifacts();
    expect(artifacts.some((row) => row.benchmark_id === 'finance-data-token-search')).toBe(false);
    expect(JSON.stringify(artifacts)).not.toContain('finance-data-token-search');
  });
});
