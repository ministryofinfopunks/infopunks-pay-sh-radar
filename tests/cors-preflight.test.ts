import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('CORS preflight', () => {
  it('includes CORS headers on GET /v1/pulse for radar frontend origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/pulse',
      headers: {
        origin: 'https://radar.infopunks.fun'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
    await app.close();
  });

  it('includes CORS headers on GET /v1/pulse/summary for radar frontend origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/pulse/summary',
      headers: {
        origin: 'https://radar.infopunks.fun'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
    await app.close();
  });

  it('includes CORS headers on GET /v1/providers for radar frontend origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/providers',
      headers: {
        origin: 'https://radar.infopunks.fun'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
    await app.close();
  });

  it('handles OPTIONS /v1/pulse from radar frontend origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/pulse',
      headers: {
        origin: 'https://radar.infopunks.fun',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type'
      }
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
    expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type, Authorization, X-Requested-With');
    expect(response.headers['access-control-max-age']).toBe('86400');
    await app.close();
  });

  it('handles OPTIONS /v1/pulse/summary from radar frontend origin', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/pulse/summary',
      headers: {
        origin: 'https://radar.infopunks.fun',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type'
      }
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
    expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type, Authorization, X-Requested-With');
    expect(response.headers['access-control-max-age']).toBe('86400');
    await app.close();
  });
});
