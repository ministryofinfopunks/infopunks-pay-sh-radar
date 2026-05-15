import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { type PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { type IntelligenceSnapshot } from '../src/persistence/repository';
import { type RadarComparisonResponse } from '../src/schemas/entities';
import { recomputeAssessments } from '../src/services/intelligenceStore';

const emptySnapshot: IntelligenceSnapshot = {
  events: [],
  providers: [],
  endpoints: [],
  trustAssessments: [],
  signalAssessments: [],
  narratives: [],
  ingestionRuns: [],
  monitorRuns: []
};

function rowById(response: RadarComparisonResponse, id: string) {
  const row = response.rows.find((item) => item.id === id);
  if (!row) throw new Error(`missing comparison row for ${id}`);
  return row;
}

function storeFromCatalog(catalog: PayShCatalogItem[]) {
  const ingested = applyPayShCatalogIngestion(emptySnapshot, catalog, {
    observedAt: '2026-05-12T00:00:00.000Z',
    source: 'pay.sh:test'
  }).snapshot;
  return recomputeAssessments(ingested);
}

describe('radar comparison verified mapping behavior', () => {
  it('maps StableCrypto by canonical providerId and does not collapse all rows to fallback state', async () => {
    const store = storeFromCatalog([
      {
        name: 'StableCrypto',
        namespace: 'merit-systems/stablecrypto/market-data',
        slug: 'merit-systems-stablecrypto-market-data',
        category: 'Crypto/Finance',
        endpoints: 105,
        price: '$0.01',
        status: 'metered',
        description: 'StableCrypto market data',
        tags: ['crypto'],
        endpointMetadataPartial: true
      },
      {
        name: 'Catalog Only Provider',
        namespace: 'vendor/catalog-only',
        slug: 'vendor-catalog-only',
        category: 'Data',
        endpoints: 5,
        price: '$0.02',
        status: 'metered',
        description: 'No verified mapping',
        tags: ['data'],
        endpointMetadataPartial: true
      }
    ]);
    const app = await createApp(store);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/compare',
      payload: {
        mode: 'provider',
        ids: ['merit-systems-stablecrypto-market-data', 'vendor-catalog-only']
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data as RadarComparisonResponse;
    const stable = rowById(body, 'merit-systems-stablecrypto-market-data');
    const catalogOnly = rowById(body, 'vendor-catalog-only');
    expect(stable.mapped_endpoint_count).toBeGreaterThan(0);
    expect(stable.route_eligible_endpoint_count).toBeGreaterThan(0);
    expect(stable.route_recommendation).toBe('route_eligible');
    expect(stable.mapping_source).toBe('verified');
    expect(catalogOnly.mapped_endpoint_count).toBe(0);
    expect(catalogOnly.route_eligible_endpoint_count).toBe(0);
    expect(catalogOnly.route_recommendation).toBe('not_recommended');
    expect(catalogOnly.mapping_source).toBe('none');
    await app.close();
  });

  it('maps StableCrypto by display-name alias when provider id differs from mapping providerId', async () => {
    const store = storeFromCatalog([
      {
        name: 'StableCrypto',
        namespace: 'finance/stablecrypto',
        slug: 'stablecrypto',
        category: 'Crypto/Finance',
        endpoints: 2,
        price: '$0.001',
        status: 'metered',
        description: 'Legacy StableCrypto alias provider id',
        tags: ['crypto'],
        endpointMetadataPartial: true
      },
      {
        name: 'Other Provider',
        namespace: 'vendor/other',
        slug: 'other-provider',
        category: 'Data',
        endpoints: 1,
        price: '$0.05',
        status: 'metered',
        description: 'other',
        tags: ['data'],
        endpointMetadataPartial: true
      }
    ]);
    const app = await createApp(store);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/compare',
      payload: { mode: 'provider', ids: ['stablecrypto', 'other-provider'] }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data as RadarComparisonResponse;
    const stable = rowById(body, 'stablecrypto');
    expect(stable.mapped_endpoint_count).toBeGreaterThan(0);
    expect(stable.route_eligible_endpoint_count).toBeGreaterThan(0);
    expect(stable.mapping_source).toBe('verified');
    await app.close();
  });

  it('provider ids selected from frontend provider list match backend comparison expectations', async () => {
    const store = storeFromCatalog([
      {
        name: 'StableCrypto',
        namespace: 'merit-systems/stablecrypto/market-data',
        slug: 'merit-systems-stablecrypto-market-data',
        category: 'Crypto/Finance',
        endpoints: 3,
        price: '$0.01',
        status: 'metered',
        description: 'StableCrypto market data',
        tags: ['crypto'],
        endpointMetadataPartial: true
      },
      {
        name: 'Catalog Only Provider',
        namespace: 'vendor/catalog-only',
        slug: 'vendor-catalog-only',
        category: 'Data',
        endpoints: 5,
        price: '$0.02',
        status: 'metered',
        description: 'No verified mapping',
        tags: ['data'],
        endpointMetadataPartial: true
      }
    ]);
    const app = await createApp(store);
    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    expect(providers.statusCode).toBe(200);
    const providerRows = providers.json().data as Array<{ id: string }>;
    const selectedIds = providerRows.slice(0, 2).map((item) => item.id);
    const compare = await app.inject({
      method: 'POST',
      url: '/v1/radar/compare',
      payload: { mode: 'provider', ids: selectedIds }
    });
    expect(compare.statusCode).toBe(200);
    const body = compare.json().data as RadarComparisonResponse;
    expect(body.rows).toHaveLength(2);
    expect(new Set(body.rows.map((row) => row.id))).toEqual(new Set(selectedIds));
    await app.close();
  });
});
