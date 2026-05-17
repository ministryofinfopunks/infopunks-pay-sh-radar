import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('radar mappings route', () => {
  it('returns StableCrypto proven mapping and PaySponge verified/proven token-search mapping', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/mappings' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(Array.isArray(body.mappings)).toBe(true);
    expect(body.mappings.some((row: any) => row.provider_name === 'StableCrypto' && row.execution_evidence_status === 'proven')).toBe(true);
    expect(body.mappings.some((row: any) =>
      row.provider_id === 'paysponge-coingecko'
      && row.benchmark_intent === 'token search'
      && row.mapping_status === 'verified'
      && row.execution_evidence_status === 'proven'
      && row.proof_reference === 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md'
    )).toBe(true);

    await app.close();
  });
});
