import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { setRouteMappingsForTest } from '../src/services/providerEndpointMap';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { emptyIntelligenceStore, recomputeAssessments } from '../src/services/intelligenceStore';
import { buildRadarExportSnapshot } from '../src/services/radarExportService';
import { buildBenchmarkReadiness, buildSuperiorityReadiness, deriveCostPerformanceFields } from '../src/services/radarRouteIntelligenceService';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';

function store(catalog: PayShCatalogItem[]) {
  const ingested = applyPayShCatalogIngestion(emptyIntelligenceStore(), catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' });
  return recomputeAssessments(ingested.snapshot);
}

describe('phase7 intelligence', () => {
  afterEach(() => {
    setRouteMappingsForTest(null);
  });

  it('pricing unknown normalization remains unknown', () => {
    const s = store([{ name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: 'unknown', status: 'unknown', description: 'x', tags: ['x'] }]);
    const endpoint = buildRadarExportSnapshot(s).endpoints[0];
    const perf = deriveCostPerformanceFields(endpoint);
    expect(perf.pricing_known).toBe(false);
    expect(perf.pricing_confidence).toBe('unknown');
  });

  it('broad pricing range yields low confidence', () => {
    const s = store([{ name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: '$0-$100', status: 'metered', description: 'x', tags: ['x'] }]);
    const endpoint = buildRadarExportSnapshot(s).endpoints[0];
    const perf = deriveCostPerformanceFields(endpoint);
    expect(perf.pricing_known).toBe(true);
    expect(perf.pricing_confidence).toBe('low');
  });

  it('route value score is computed when pricing known and route eligible', () => {
    const s = store([{ name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: '$0.01', status: 'metered', description: 'x', tags: ['x'] }]);
    const endpoint = buildRadarExportSnapshot(s).endpoints[0];
    const perf = deriveCostPerformanceFields({
      ...endpoint,
      route_eligibility: true,
      provider_trust_score: 90,
      provider_signal_score: 80,
      pricing: { min: 0.01, max: 0.01, unit: 'request', raw: '$0.01', clarity: 'clear' }
    } as any);
    expect(typeof perf.route_value_score).toBe('number');
  });

  it('one proven mapping does not mark benchmark ready and recommends one comparable next mapping', () => {
    const readiness = buildBenchmarkReadiness(emptyIntelligenceStore());
    const sol = readiness.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol).toBeTruthy();
    expect(sol?.benchmark_ready).toBe(false);
    expect(sol?.superiority_ready).toBe(false);
    expect(sol?.proven_execution_count).toBe(1);
    expect(sol?.recommended_next_mapping).toBe('finance/data/get SOL price: add 1 comparable executable mapping');
  });

  it('candidate mappings do not count as proven execution', () => {
    setRouteMappingsForTest([
      {
        provider_id: 'merit-systems-stablecrypto-market-data',
        provider_name: 'StableCrypto',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://stablecrypto.dev/api/coingecko/price',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'verified',
        execution_evidence_status: 'proven',
        proof_source: 'pay_cli',
        notes: 'proven'
      },
      {
        provider_id: 'candidate-sol-feed',
        provider_name: 'Candidate SOL Feed',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://candidate.dev/sol/price',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'candidate',
        execution_evidence_status: 'unproven',
        proof_source: 'catalog_review',
        notes: 'candidate'
      }
    ]);
    const readiness = buildBenchmarkReadiness(emptyIntelligenceStore());
    const sol = readiness.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol?.candidate_mapping_count).toBe(1);
    expect(sol?.proven_execution_count).toBe(1);
    expect(sol?.benchmark_ready).toBe(false);
  });

  it('two verified mappings for same intent mark benchmark ready', () => {
    setRouteMappingsForTest([
      {
        provider_id: 'p1',
        provider_name: 'P1',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://p1.dev/sol',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'verified',
        execution_evidence_status: 'proven',
        proof_source: 'pay_cli',
        notes: 'proven'
      },
      {
        provider_id: 'p2',
        provider_name: 'P2',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://p2.dev/sol',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'verified',
        execution_evidence_status: 'unproven',
        proof_source: 'manual',
        notes: 'verified but not proven'
      }
    ]);
    const readiness = buildBenchmarkReadiness(emptyIntelligenceStore());
    const sol = readiness.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol?.benchmark_ready).toBe(true);
    expect(sol?.superiority_ready).toBe(false);
  });

  it('two proven mappings for same intent mark superiority ready', () => {
    setRouteMappingsForTest([
      {
        provider_id: 'p1',
        provider_name: 'P1',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://p1.dev/sol',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'verified',
        execution_evidence_status: 'proven',
        proof_source: 'pay_cli',
        notes: 'proven'
      },
      {
        provider_id: 'p2',
        provider_name: 'P2',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        endpoint_url: 'https://p2.dev/sol',
        method: 'POST',
        request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
        mapping_status: 'verified',
        execution_evidence_status: 'proven',
        proof_source: 'pay_cli',
        notes: 'proven'
      }
    ]);
    const readiness = buildBenchmarkReadiness(emptyIntelligenceStore());
    const sol = readiness.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol?.superiority_ready).toBe(true);
  });

  it('benchmark-readiness API includes StableCrypto mapping intent and counts', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-readiness' });
    expect(response.statusCode).toBe(200);
    const payload = response.json().data as ReturnType<typeof buildBenchmarkReadiness>;
    const sol = payload.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol).toBeTruthy();
    expect(sol?.category).toBe('finance/data');
    expect(sol?.executable_mapping_count).toBe(1);
    expect(sol?.proven_execution_count).toBe(1);
    await app.close();
  });

  it('superiority readiness legacy route remains conservative without injected execution events', () => {
    const legacy = buildSuperiorityReadiness(emptyIntelligenceStore());
    expect(legacy.providers_with_proven_paid_execution).toHaveLength(0);
  });
});
