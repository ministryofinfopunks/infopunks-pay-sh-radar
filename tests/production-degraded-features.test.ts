import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const saved = Object.fromEntries(['NODE_ENV', 'PORT', 'INFOPUNKS_ADMIN_TOKEN', 'DATABASE_URL', 'RH_CHAIN_REVIEW_CONSOLE_ENABLED', 'RH_CHAIN_REVIEW_ADMIN_TOKEN', 'RH_CHAIN_PROJECT_CLAIMS_ENABLED', 'RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED'].map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

describe('production optional feature degradation', () => {
  it('keeps public service alive, returns 503 for requested public claims, and hides review routes', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '10000';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'admin';
    delete process.env.DATABASE_URL;
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN;
    process.env.RH_CHAIN_PROJECT_CLAIMS_ENABLED = 'true';
    process.env.RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED = 'true';
    const app = await createApp(emptyIntelligenceStore());

    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    const claims = await app.inject({ method: 'GET', url: '/v1/rh-chain/projects/example' });
    expect(claims.statusCode).toBe(503);
    expect(claims.json()).toMatchObject({ error: 'feature_unavailable' });
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/projects' })).statusCode).toBe(404);
    await app.close();
  });
});
