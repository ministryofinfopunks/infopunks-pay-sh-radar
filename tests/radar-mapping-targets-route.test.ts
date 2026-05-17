import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('radar mapping targets route', () => {
  it('returns read-only mapping target list', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/mapping-targets' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.count).toBe(5);
    expect(body.targets.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token metadata' && row.current_state === 'needs_candidate')).toBe(true);
    expect(body.targets.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token search' && row.current_state === 'verified_mapping_found')).toBe(true);
    expect(body.targets.some((row: any) => row.category === 'ai_ml/data' && row.current_state === 'needs_two_comparable_mappings')).toBe(true);
    expect(JSON.stringify(body.targets)).not.toContain('candidate A');
    expect(JSON.stringify(body.targets)).not.toContain('candidate B');
    expect(body.targets.some((row: any) => row.category === 'finance/data' && Array.isArray(row.suggested_provider_candidates) && row.suggested_provider_candidates.includes('StableCrypto'))).toBe(true);

    await app.close();
  });

  it('does not change benchmark readiness state', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const readinessResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-readiness' });
    expect(readinessResponse.statusCode).toBe(200);
    const readiness = readinessResponse.json().data;
    expect(readiness.categories.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'get SOL price')).toBe(true);
    const tokenSearch = readiness.categories.find((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token search');
    expect(tokenSearch).toBeTruthy();
    expect(tokenSearch.benchmark_ready).toBe(false);
    expect(tokenSearch.superiority_ready).toBe(false);

    await app.close();
  });
});
