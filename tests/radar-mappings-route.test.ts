import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('radar mappings route', () => {
  it('returns StableCrypto and PaySponge mapping rows', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/mappings' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(Array.isArray(body.mappings)).toBe(true);
    expect(body.mappings.some((row: any) => row.provider_name === 'StableCrypto' && row.execution_evidence_status === 'proven')).toBe(true);
    expect(body.mappings.some((row: any) => row.provider_id === 'paysponge-coingecko' && row.execution_evidence_status === 'proven')).toBe(true);

    await app.close();
  });
});
