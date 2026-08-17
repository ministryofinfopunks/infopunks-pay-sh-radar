import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import type { IntelligenceRepository } from '../src/persistence/repository';

const repositoryWithStatus = (status: 'ok' | 'degraded' | 'unavailable'): IntelligenceRepository => ({
  loadSnapshot: async () => null,
  saveSnapshot: async () => undefined,
  getDbStatus: () => status
} as IntelligenceRepository);

describe('deployment health endpoints', () => {
  it('returns liveness without requiring persistence or providers', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, status: 'live' });
    await app.close();
  });

  it('reports healthy, degraded and unavailable readiness states', async () => {
    const healthy = await createApp(emptyIntelligenceStore(), repositoryWithStatus('ok'));
    expect((await healthy.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ ok: true, status: 'healthy' });
    await healthy.close();

    const degraded = await createApp(emptyIntelligenceStore(), repositoryWithStatus('degraded'));
    expect((await degraded.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ ok: true, status: 'degraded' });
    await degraded.close();

    const unavailable = await createApp(emptyIntelligenceStore(), repositoryWithStatus('unavailable'));
    const response = await unavailable.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, status: 'degraded' });
    await unavailable.close();
  });
});
