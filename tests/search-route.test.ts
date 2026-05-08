import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('search and route API', () => {
  it('searches providers semantically with deterministic lexical scoring', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'POST', url: '/v1/search', payload: { query: 'image video generation', limit: 3 } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].provider.category).toBe('Media');
    await app.close();
  });

  it('recommends a route with reasoning, evidence, and risk notes', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'POST', url: '/v1/recommend-route', payload: { task: 'transcribe voice audio for an AI agent', category: 'AI/ML', maxPrice: 0.05, trustThreshold: 60, latencySensitivity: 'high', preference: 'highest_signal', preferredProviderId: 'stableenrich' } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.bestProvider).toBeTruthy();
    expect(body.data.reasoning.length).toBeGreaterThan(0);
    expect(body.data.evidence.length).toBeGreaterThan(0);
    expect(body.data.riskNotes.some((note: string) => note.includes('unknown') || note.includes('unavailable'))).toBe(true);
    expect(body.data.scoringInputs).toMatchObject({ preference: 'highest_signal', source: 'LIVE PAY.SH CATALOG', preferredProviderIncluded: true });
    expect(body.data.fallbackProviders).toBeInstanceOf(Array);
    expect(body.data.excludedProviders).toBeInstanceOf(Array);
    expect(body.data.unknownTelemetry).toBeInstanceOf(Array);
    expect(body.data.rationale.length).toBeGreaterThan(0);
    expect(typeof body.data.coordinationScore).toBe('number');
    await app.close();
  });

  it('applies trustThreshold as a route filter', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/recommend-route',
      payload: { task: 'find a high trust AI provider', category: 'AI/ML', trustThreshold: 100, preference: 'balanced' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.scoringInputs.trustThreshold).toBe(100);
    expect(body.bestProvider).toBeNull();
    await app.close();
  });

  it('accepts minTrustScore alias and maps it to trustThreshold', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/recommend-route',
      payload: { task: 'find a high trust AI provider', category: 'AI/ML', minTrustScore: 100, preference: 'balanced' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.scoringInputs.trustThreshold).toBe(100);
    expect(body.bestProvider).toBeNull();
    await app.close();
  });

  it('prefers trustThreshold over minTrustScore when both are provided', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/recommend-route',
      payload: { task: 'find a high trust AI provider', category: 'AI/ML', trustThreshold: 0, minTrustScore: 100, preference: 'balanced' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.scoringInputs.trustThreshold).toBe(0);
    expect(body.bestProvider).toBeTruthy();
    await app.close();
  });

  it('returns health and V1 providers route', async () => {
    const app = await createApp();
    const health = await app.inject({ method: 'GET', url: '/health' });
    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    const events = await app.inject({ method: 'GET', url: '/v1/events/recent' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);
    expect(providers.json().data.length).toBeGreaterThan(0);
    expect(events.json().data.length).toBeGreaterThan(0);
    await app.close();
  });

  it('returns realtime pulse summary derived from event spine', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/pulse/summary' });
    expect(response.statusCode).toBe(200);
    const summary = response.json().data;
    expect(summary.counters.providers).toBeGreaterThan(0);
    expect(summary.counters.events).toBeGreaterThan(0);
    expect(summary.eventGroups.discovery.count).toBeGreaterThan(0);
    expect(summary.eventGroups.trust.count).toBeGreaterThan(0);
    expect(summary.eventGroups.signal.count).toBeGreaterThan(0);
    expect(summary.timeline[0]).toMatchObject({ id: expect.any(String), category: expect.any(String), summary: expect.any(String) });
    expect(summary.providerActivity['24h']).toBeInstanceOf(Array);
    expect(summary.trustDeltas[0]).toMatchObject({ providerId: expect.any(String), direction: expect.any(String) });
    expect(summary.latest_event_at).toEqual(expect.any(String));
    expect(summary.latest_batch_event_count).toEqual(expect.any(Number));
    expect(summary.ingest_interval_ms === null || typeof summary.ingest_interval_ms === 'number').toBe(true);
    expect(summary.latest_ingestion_run).toMatchObject({
      startedAt: expect.any(String),
      status: expect.any(String),
      discoveredCount: expect.any(Number),
      changedCount: expect.any(Number),
      emittedEvents: expect.any(Number),
      usedFixture: expect.any(Boolean),
      source: expect.any(String)
    });
    expect(summary.propagation.supporting_event_ids.length).toBeLessThanOrEqual(10);
    expect(summary.propagation.supporting_event_count).toBeGreaterThanOrEqual(summary.propagation.supporting_event_ids.length);
    expect(summary.propagation.remaining_event_count).toBe(summary.propagation.supporting_event_count - summary.propagation.supporting_event_ids.length);
    expect(summary.propagation.view_full_receipts_url).toBe(`/propagation/${summary.propagation.cluster_id}`);
    if (summary.interpretations.length > 0) {
      const interpretation = summary.interpretations[0];
      expect(interpretation.supporting_event_ids.length).toBeLessThanOrEqual(10);
      expect(interpretation.supporting_event_count).toBeGreaterThanOrEqual(interpretation.supporting_event_ids.length);
      expect(interpretation.remaining_event_count).toBe(interpretation.supporting_event_count - interpretation.supporting_event_ids.length);
      expect(interpretation.view_full_receipts_url).toBe(`/interpretations/${interpretation.interpretation_id}`);
    }
    expect(summary.data_source.mode).toMatch(/^(live_pay_sh_catalog|fixture_fallback)$/);
    await app.close();
  });

  it('returns data source state on pulse and pulse summary routes', async () => {
    const app = await createApp();
    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    const summary = await app.inject({ method: 'GET', url: '/v1/pulse/summary' });

    expect(pulse.statusCode).toBe(200);
    expect(summary.statusCode).toBe(200);
    expect(pulse.json().data.data_source.mode).toMatch(/^(live_pay_sh_catalog|fixture_fallback)$/);
    expect(summary.json().data.data_source.mode).toBe(pulse.json().data.data_source.mode);
    await app.close();
  });

  it('handles CORS preflight for pulse summary with allowed origin', async () => {
    const previous = process.env.FRONTEND_ORIGIN;
    process.env.FRONTEND_ORIGIN = 'https://radar.example.com';
    const app = await createApp();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/pulse/summary',
      headers: {
        origin: 'https://radar.example.com',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type'
      }
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.example.com');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-headers']).toContain('content-type');
    await app.close();
    if (previous === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previous;
  });

  it('allows authorization header on admin POST route preflight', async () => {
    const previousOrigin = process.env.FRONTEND_ORIGIN;
    const previousAdminToken = process.env.INFOPUNKS_ADMIN_TOKEN;
    process.env.FRONTEND_ORIGIN = 'https://radar.example.com';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/monitor/run',
      headers: {
        origin: 'https://radar.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization'
      }
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.example.com');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('authorization');
    await app.close();
    if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previousOrigin;
    if (previousAdminToken === undefined) delete process.env.INFOPUNKS_ADMIN_TOKEN;
    else process.env.INFOPUNKS_ADMIN_TOKEN = previousAdminToken;
  });

  it('protects admin Pay.sh ingestion without token gating public routes', async () => {
    const previous = process.env.INFOPUNKS_ADMIN_TOKEN;
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp();
    const publicResponse = await app.inject({ method: 'GET', url: '/v1/providers' });
    const blocked = await app.inject({ method: 'POST', url: '/v1/ingest/pay-sh', payload: {} });
    const allowed = await app.inject({ method: 'POST', url: '/v1/ingest/pay-sh', headers: { authorization: 'Bearer secret' }, payload: {} });

    expect(publicResponse.statusCode).toBe(200);
    expect(blocked.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data.run.status).toBe('succeeded');
    await app.close();
    if (previous === undefined) delete process.env.INFOPUNKS_ADMIN_TOKEN;
    else process.env.INFOPUNKS_ADMIN_TOKEN = previous;
  });
});
