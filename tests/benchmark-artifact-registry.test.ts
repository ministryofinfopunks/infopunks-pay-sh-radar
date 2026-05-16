import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { listBenchmarkArtifacts } from '../src/data/benchmarkArtifacts';
import { buildRadarBenchmarks } from '../src/services/radarBenchmarkService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('benchmark artifact registry', () => {
  it('includes five-run SOL benchmark artifact', () => {
    const artifact = listBenchmarkArtifacts().find((row) => row.artifact_id === 'finance-data-sol-price-runs-2026-05-16');
    expect(artifact).toBeTruthy();
    expect(artifact?.benchmark_id).toBe('finance-data-sol-price');
    expect(artifact?.total_runs).toBe(5);
    expect(artifact?.winner_status).toBe('no_clear_winner');
    expect(artifact?.winner_claimed).toBe(false);
  });

  it('benchmark service consumes artifact metrics and preserves prior benchmark values', () => {
    const sol = buildRadarBenchmarks().benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price');
    expect(sol).toBeTruthy();
    const stable = sol?.routes.find((item) => item.provider_id === 'merit-systems-stablecrypto-market-data');
    const paysponge = sol?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(stable?.latency_ms).toBe(5691);
    expect(stable?.average_price_usd).toBe(87.57);
    expect(paysponge?.latency_ms).toBe(7761);
    expect(paysponge?.average_price_usd).toBe(87.50392093173244);
    expect(sol?.winner_status).toBe('no_clear_winner');
    expect(sol?.winner_claimed).toBe(false);
  });

  it('artifact endpoints return safe metadata only and do not expose raw proof contents', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-artifacts' });
    expect(listResponse.statusCode).toBe(200);
    const artifacts = listResponse.json().data.artifacts as Array<Record<string, unknown>>;
    expect(artifacts.length).toBeGreaterThan(0);
    const sol = artifacts.find((row) => row.artifact_id === 'finance-data-sol-price-runs-2026-05-16');
    expect(sol).toBeTruthy();
    expect(sol).toHaveProperty('artifact_path');
    expect(sol).toHaveProperty('routes');
    expect(sol).not.toHaveProperty('proof_markdown');
    expect(JSON.stringify(sol)).not.toContain('# ');
    expect(JSON.stringify(sol)).not.toContain('```');

    const detailResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-artifacts/finance-data-sol-price-runs-2026-05-16' });
    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json().data;
    expect(detail.artifact_id).toBe('finance-data-sol-price-runs-2026-05-16');
    expect(detail.winner_status).toBe('no_clear_winner');
    expect(detail.winner_claimed).toBe(false);
    expect(detail).not.toHaveProperty('raw_proof_contents');

    await app.close();
  });
});
