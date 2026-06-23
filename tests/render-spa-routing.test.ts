import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

function createClientDistFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'radar-client-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body><div id="app">Radar SPA shell</div></body></html>');
  return dir;
}

describe('render-style SPA routing boundaries', () => {
  it('serves JSON for /v1/routes even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/routes' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().data.routes.length).toBeGreaterThan(0);
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves JSON for /openapi.json even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().openapi).toBe('3.1.0');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves JSON for /v1/pulse even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/pulse' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().data).toEqual(expect.objectContaining({
        providerCount: expect.any(Number),
        endpointCount: expect.any(Number),
        data_source: expect.any(Object)
      }));
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves frontend routes and unknown frontend paths through the HTML shell', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const developers = await app.inject({ method: 'GET', url: '/developers' });
      expect(developers.statusCode).toBe(200);
      expect(developers.headers['content-type']).toContain('text/html');
      expect(developers.body).toContain('Radar SPA shell');

      const check = await app.inject({ method: 'GET', url: '/check' });
      expect(check.statusCode).toBe(200);
      expect(check.headers['content-type']).toContain('text/html');
      expect(check.body).toContain('Radar SPA shell');

      const loops = await app.inject({ method: 'GET', url: '/loops' });
      expect(loops.statusCode).toBe(200);
      expect(loops.headers['content-type']).toContain('text/html');
      expect(loops.body).toContain('Radar SPA shell');

      const unknownFrontend = await app.inject({ method: 'GET', url: '/frontend-route-that-does-not-exist' });
      expect(unknownFrontend.statusCode).toBe(200);
      expect(unknownFrontend.headers['content-type']).toContain('text/html');
      expect(unknownFrontend.body).toContain('Radar SPA shell');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('does not let the SPA fallback swallow unknown API routes', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/not-a-real-route' });
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });
});
