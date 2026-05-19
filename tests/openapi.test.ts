import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('openapi discovery', () => {
  it('serves valid OpenAPI JSON from /openapi.json', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const spec = response.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toContain('Infopunks Pay.sh Radar');
    expect(spec.components.schemas.ErrorEnvelope).toBeTruthy();

    await app.close();
  });

  it('documents agent preflight, batch preflight, CSV, risk, history, and readiness routes', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();

    expect(spec.paths['/v1/radar/preflight']?.post).toBeTruthy();
    expect(spec.paths['/v1/radar/preflight/batch']?.post).toBeTruthy();
    expect(spec.paths['/v1/radar/export/providers.csv']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/export/endpoints.csv']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/export/route-candidates.csv']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/export/degradations.csv']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/risk/providers/{provider_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/risk/endpoints/{endpoint_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/risk/ecosystem']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/history/providers/{provider_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/history/endpoints/{endpoint_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/history/ecosystem']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/mappings']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/mapping-targets']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-readiness']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-summary']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/superiority-readiness']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/finance-data-token-search']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/finance-data-token-metadata']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/communications-email-delivery']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/solana-infra-account-balance']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/social-data-reddit-post-search']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmarks/finance-data-sol-price/history']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-history']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-history/{benchmark_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-history/{benchmark_id}/routes']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-history/{benchmark_id}/routes/{route_id}']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-artifacts']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-artifacts/{artifact_id}']?.get).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.status_code).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.status_evidence).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.execution_transport).toBeTruthy();
    expect(spec.components.schemas.BenchmarkSummaryResponse).toBeTruthy();
    expect(spec.components.schemas.BenchmarkHistoryV2AggregateResponse).toBeTruthy();
    expect(spec.components.schemas.BenchmarkHistoryV2DetailResponse).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteHistoryAggregateResponse).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteHistoryDetailResponse).toBeTruthy();
    expect(spec.components.schemas.EvidenceHealth).toEqual({ type: 'string', enum: ['recorded', 'caveated', 'stale', 'degraded', 'unverified', 'scaffold'] });
    expect(spec.components.schemas.BenchmarkRouteHistorySummary.properties.evidence_health.$ref).toBe('#/components/schemas/EvidenceHealth');
    expect(spec.components.schemas.BenchmarkRouteHistoryTimelineEntry.properties.evidence_health.$ref).toBe('#/components/schemas/EvidenceHealth');
    expect(spec.components.schemas.BenchmarkRouteHistoryDetailResponse.properties.evidence_health.$ref).toBe('#/components/schemas/EvidenceHealth');
    expect(spec.components.schemas.BenchmarkSummaryResponse.properties.benchmarks.items.$ref).toBe('#/components/schemas/BenchmarkSummaryRow');
    expect(spec.components.schemas.BenchmarkSummaryResponse.properties.total_artifacts).toBeTruthy();
    expect(spec.components.schemas.BenchmarkSummaryResponse.properties.latest_recorded_at).toBeTruthy();
    expect(spec.components.schemas.BenchmarkSummaryRow.properties.description).toBeTruthy();
    expect(JSON.stringify(spec.paths['/v1/radar/benchmark-summary'])).toContain('compact agent benchmark summary');
    expect(JSON.stringify(spec.paths['/v1/radar/benchmark-summary'])).toContain('Use full benchmark endpoints for route-level metrics.');
    expect(JSON.stringify(spec.paths['/v1/radar/benchmark-summary'])).toContain('"label":"Web Search Results"');
    expect(JSON.stringify(spec.paths['/v1/radar/benchmark-summary'])).toContain('"recorded_runs":10');
    expect(JSON.stringify(spec.paths['/v1/radar/benchmark-summary'])).toContain('Search the web for the same query and return normalized search results.');
    expect(JSON.stringify(spec.paths['/v1/radar/superiority-readiness'])).toContain('Get comparison readiness');
    expect(JSON.stringify(spec.paths['/v1/radar/superiority-readiness'])).not.toContain('Superiority Proof');
    expect(JSON.stringify(spec)).not.toContain('Get superiority proof readiness');

    await app.close();
  });
});
