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
    expect(spec.paths['/v1/radar/benchmarks/finance-data-sol-price/history']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-artifacts']?.get).toBeTruthy();
    expect(spec.paths['/v1/radar/benchmark-artifacts/{artifact_id}']?.get).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.status_code).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.status_evidence).toBeTruthy();
    expect(spec.components.schemas.BenchmarkRouteMetric.properties.execution_transport).toBeTruthy();

    await app.close();
  });
});
