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

  it('two proven mappings mark benchmark and superiority ready and recommend normalized comparison metrics', () => {
    const readiness = buildBenchmarkReadiness(emptyIntelligenceStore());
    const sol = readiness.categories.find((row) => row.benchmark_intent === 'get SOL price');
    expect(sol).toBeTruthy();
    expect(sol?.benchmark_ready).toBe(true);
    expect(sol?.superiority_ready).toBe(true);
    expect(sol?.candidate_mapping_count).toBe(0);
    expect(sol?.proven_execution_count).toBe(2);
    expect(sol?.recommended_next_mapping).toBe('finance/data/get SOL price: record normalized head-to-head benchmark metrics');
    expect(sol?.mapping_ladder).toContain('StableCrypto: verified/proven');
    expect(sol?.mapping_ladder).toContain('CoinGecko Onchain DEX API: verified/proven');
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
    expect(sol?.executable_mapping_count).toBe(2);
    expect(sol?.candidate_mapping_count).toBe(0);
    expect(sol?.proven_execution_count).toBe(2);
    await app.close();
  });

  it('superiority readiness uses registry-backed proven mappings and does not claim a winner', async () => {
    const readiness = buildSuperiorityReadiness(emptyIntelligenceStore());
    expect(readiness.executable_provider_mappings_count).toBe(2);
    expect(readiness.categories_with_at_least_two_executable_mappings).toContain('finance/data');
    expect(readiness.categories_not_ready_for_comparison).not.toContain('finance/data');
    expect(readiness.providers_with_proven_paid_execution).toContain('merit-systems-stablecrypto-market-data');
    expect(readiness.providers_with_proven_paid_execution).toContain('paysponge-coingecko');
    expect(readiness.providers_with_only_catalog_metadata).not.toContain('merit-systems-stablecrypto-market-data');
    expect(readiness.providers_with_only_catalog_metadata).not.toContain('paysponge-coingecko');
    expect(readiness.next_mappings_needed).toContain('finance/data/get SOL price: record normalized head-to-head benchmark metrics');
    expect(readiness.winner_claimed).toBe(false);

    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/superiority-readiness' });
    expect(response.statusCode).toBe(200);
    const payload = response.json().data as ReturnType<typeof buildSuperiorityReadiness>;
    expect(payload.executable_provider_mappings_count).toBe(2);
    expect(payload.categories_with_at_least_two_executable_mappings).toContain('finance/data');
    expect(payload.providers_with_proven_paid_execution).toContain('merit-systems-stablecrypto-market-data');
    expect(payload.providers_with_proven_paid_execution).toContain('paysponge-coingecko');
    expect(payload.winner_claimed).toBe(false);
    await app.close();
  });

  it('benchmark and superiority readiness agree on registry-backed readiness for SOL benchmark intent', () => {
    const benchmark = buildBenchmarkReadiness(emptyIntelligenceStore());
    const superiority = buildSuperiorityReadiness(emptyIntelligenceStore());
    const sol = benchmark.categories.find((row) => row.category === 'finance/data' && row.benchmark_intent === 'get SOL price');
    expect(sol?.benchmark_ready).toBe(true);
    expect(sol?.superiority_ready).toBe(true);
    expect(superiority.categories_with_at_least_two_executable_mappings).toContain('finance/data');
  });

  it('benchmark routes expose recorded SOL benchmark evidence with no winner claim', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    expect(listResponse.statusCode).toBe(200);
    const listPayload = listResponse.json().data;
    const sol = listPayload.benchmarks.find((row: any) => row.benchmark_id === 'finance-data-sol-price');
    expect(sol).toBeTruthy();
    expect(sol.winner_claimed).toBe(false);
    expect(sol.benchmark_recorded).toBe(true);
    expect(sol.winner_status).toBe('insufficient_runs');
    expect(sol.winner_policy).toBeTruthy();
    expect(sol.winner_policy.completed_runs).toBe(1);
    expect(sol.winner_policy.required_runs).toBe(5);
    expect(sol.winner_policy.winner_status).toBe('insufficient_runs');
    expect(sol.winner_policy.winner_claimed).toBe(false);
    expect(sol.routes.map((item: any) => item.provider_id)).toEqual(expect.arrayContaining([
      'merit-systems-stablecrypto-market-data',
      'paysponge-coingecko'
    ]));
    expect(sol.routes.map((item: any) => item.proof_reference)).toEqual(expect.arrayContaining([
      'live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md',
      'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md'
    ]));
    const stable = sol.routes.find((item: any) => item.provider_id === 'merit-systems-stablecrypto-market-data');
    const paysponge = sol.routes.find((item: any) => item.provider_id === 'paysponge-coingecko');
    expect(stable.success).toBe(true);
    expect(paysponge.success).toBe(true);
    expect(stable.latency_ms).toBe(7489);
    expect(paysponge.latency_ms).toBe(8172);
    expect(stable.extracted_price_usd).toBe(89.54);
    expect(paysponge.extracted_price_usd).toBe(89.74079922757187);
    expect(stable.status_code).toBeNull();
    expect(paysponge.status_code).toBeNull();
    expect(stable.status_evidence).toBe('pay_cli exit code 0 and parsed response body');
    expect(paysponge.status_evidence).toBe('pay_cli exit code 0 and parsed response body');
    expect(stable.normalized_output_available).toBe(true);
    expect(paysponge.normalized_output_available).toBe(true);
    expect(stable.extraction_path).toBe('solana.usd');
    expect(paysponge.extraction_path).toBe('data[sol_usdc].attributes.base_token_price_usd');
    expect(stable.output_shape.solana.usd).toBe('<price_usd>');
    expect(paysponge.output_shape.data[0].attributes.base_token_price_usd).toBe('<base_token_price_usd>');
    expect(paysponge.output_shape.data[0].attributes.quote_token_price_usd).toBe('<quote_token_price_usd>');
    expect(stable.output_shape.solana.usd).not.toBe(0);
    expect(paysponge.output_shape.data[0].attributes.base_token_price_usd).not.toBe(0);
    expect(paysponge.output_shape.data[0].attributes.quote_token_price_usd).not.toBe(0);

    const detailResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price' });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data.winner_claimed).toBe(false);
    expect(detailResponse.json().data.benchmark_recorded).toBe(true);
    expect(detailResponse.json().data.winner_status).toBe('insufficient_runs');
    expect(detailResponse.json().data.winner_policy.completed_runs).toBe(1);
    expect(detailResponse.json().data.winner_policy.required_runs).toBe(5);
    await app.close();
  });
});
