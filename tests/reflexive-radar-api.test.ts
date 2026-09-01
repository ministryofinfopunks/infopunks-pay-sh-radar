import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('Reflexive Radar API', () => {
  const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
  it('exposes observation endpoints without exposing them as protocol receipts', async () => {
    const app = await createApp(); apps.push(app);
    const home = await app.inject('/v1/4663/reflexive'); expect(home.statusCode).toBe(200);
    expect(home.json().data).toMatchObject({ assets: [], pairs: [], thesis: expect.any(Array) });
    expect((await app.inject('/v1/4663/reflexive/pairs/nope')).statusCode).toBe(404);
    expect((await app.inject('/v1/4663/reflexive/stocks/NVDA')).statusCode).toBe(404);
    const openapi = await app.inject('/openapi.json'); expect(openapi.json().paths['/v1/4663/reflexive']).toBeDefined();
  });
});
