import { describe, expect, it } from 'vitest';
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

  it('benchmark readiness false with one mapping and true with two comparable mappings', () => {
    const one = store([{ name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: '$0.01', status: 'metered', description: 'x', tags: ['x'] }]);
    const oneReadiness = buildBenchmarkReadiness(one);
    expect(oneReadiness.benchmark_ready_categories).toHaveLength(0);

    const two = store([
      { name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: '$0.01', status: 'metered', description: 'x', tags: ['x'], endpointDetails: [{ name: 'quote', method: 'GET', path: '/quote', category: 'Finance', description: 'quote', price: '$0.01', status: 'available', schema: null }] },
      { name: 'B', namespace: 'b/b', slug: 'b', category: 'Finance', endpoints: 1, price: '$0.02', status: 'metered', description: 'x', tags: ['x'], endpointDetails: [{ name: 'quote', method: 'GET', path: '/quote', category: 'Finance', description: 'quote', price: '$0.02', status: 'available', schema: null }] }
    ]);
    two.trustAssessments = two.trustAssessments.map((item) => ({ ...item, score: 90, grade: 'A' }));
    const twoReadiness = buildBenchmarkReadiness(two);
    expect(twoReadiness.benchmark_ready_categories).toContain('finance');
  });

  it('superiority readiness remains false without execution evidence', () => {
    const s = store([
      { name: 'A', namespace: 'a/a', slug: 'a', category: 'Finance', endpoints: 1, price: '$0.01', status: 'metered', description: 'x', tags: ['x'] },
      { name: 'B', namespace: 'b/b', slug: 'b', category: 'Finance', endpoints: 1, price: '$0.02', status: 'metered', description: 'x', tags: ['x'] }
    ]);
    const readiness = buildBenchmarkReadiness(s);
    expect(readiness.superiority_ready_categories).toHaveLength(0);
    const legacy = buildSuperiorityReadiness(s);
    expect(legacy.providers_with_proven_paid_execution).toHaveLength(0);
  });
});
