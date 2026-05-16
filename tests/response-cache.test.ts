import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { createResponseCache } from '../src/services/responseCache';

describe('response cache utility', () => {
  it('computes on first call and serves cached value on second call', async () => {
    const cache = createResponseCache();
    const compute = vi.fn(async () => ({ value: 1 }));

    const first = await cache.getOrSet('k', 60_000, compute);
    const second = await cache.getOrSet('k', 60_000, compute);

    expect(first.value.value).toBe(1);
    expect(first.metadata.hit).toBe(false);
    expect(second.value.value).toBe(1);
    expect(second.metadata.hit).toBe(true);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('returns stale cached value when recompute fails', async () => {
    const cache = createResponseCache();
    const first = await cache.getOrSet('k', 1, async () => ({ value: 42 }));
    expect(first.metadata.hit).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await cache.getOrSet('k', 1, async (): Promise<{ value: number }> => {
      throw new Error('boom');
    });

    expect(second.value.value).toBe(42);
    expect(second.metadata.hit).toBe(true);
    expect(second.metadata.stale).toBe(true);
  });
});

describe('radar secondary route caching safety', () => {
  it('keeps benchmark response values stable and returns quickly', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const startedAt = Date.now();
    const response = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    const durationMs = Date.now() - startedAt;

    expect(response.statusCode).toBe(200);
    const sol = response.json().data.benchmarks.find((row: any) => row.benchmark_id === 'finance-data-sol-price');
    expect(sol).toBeTruthy();
    expect(sol.winner_claimed).toBe(false);
    expect(sol.benchmark_recorded).toBe(true);
    const stable = sol.routes.find((item: any) => item.provider_id === 'merit-systems-stablecrypto-market-data');
    const paysponge = sol.routes.find((item: any) => item.provider_id === 'paysponge-coingecko');
    expect(stable.latency_ms).toBe(7489);
    expect(stable.extracted_price_usd).toBe(89.54);
    expect(paysponge.latency_ms).toBe(8172);
    expect(paysponge.extracted_price_usd).toBe(89.74079922757187);
    expect(durationMs).toBeLessThan(300);

    await app.close();
  });

  it('keeps risk and ecosystem history response shapes intact across repeated calls', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const history1 = await app.inject({ method: 'GET', url: '/v1/radar/history/ecosystem?window=24h' });
    const history2 = await app.inject({ method: 'GET', url: '/v1/radar/history/ecosystem?window=24h' });
    expect(history1.statusCode).toBe(200);
    expect(history2.statusCode).toBe(200);
    expect(history1.json().data).toMatchObject({
      generated_at: expect.any(String),
      window: '24h',
      sample_count: expect.any(Number),
      history_available: expect.any(Boolean),
      series: expect.any(Object),
      deltas: expect.any(Object),
      warnings: expect.any(Array)
    });
    expect(history2.json().data).toMatchObject({
      generated_at: expect.any(String),
      window: '24h',
      sample_count: expect.any(Number),
      history_available: expect.any(Boolean),
      series: expect.any(Object),
      deltas: expect.any(Object),
      warnings: expect.any(Array)
    });

    const risk1 = await app.inject({ method: 'GET', url: '/v1/radar/risk/ecosystem' });
    const risk2 = await app.inject({ method: 'GET', url: '/v1/radar/risk/ecosystem' });
    expect(risk1.statusCode).toBe(200);
    expect(risk2.statusCode).toBe(200);
    expect(risk1.json().data).toMatchObject({
      generated_at: expect.any(String),
      subject_type: 'ecosystem',
      subject_id: 'ecosystem',
      risk_score: expect.any(Number),
      risk_level: expect.any(String),
      summary: expect.any(Object)
    });
    expect(risk2.json().data).toMatchObject({
      generated_at: expect.any(String),
      subject_type: 'ecosystem',
      subject_id: 'ecosystem',
      risk_score: expect.any(Number),
      risk_level: expect.any(String),
      summary: expect.any(Object)
    });

    await app.close();
  });
});
