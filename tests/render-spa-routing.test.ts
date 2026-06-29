import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

function createClientDistFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'radar-client-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes</title><meta name="description" content="Generic shell description." /><meta property="og:title" content="Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes" /><meta property="og:description" content="Generic shell description." /><meta property="og:type" content="website" /><meta property="og:url" content="https://radar.infopunks.fun/" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes" /><meta name="twitter:description" content="Generic shell description." /><link rel="canonical" href="https://radar.infopunks.fun/" /></head><body><div id="app">Radar SPA shell</div></body></html>');
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

  it('serves JSON content-types for HEAD /openapi.json, /v1/loops, and /v1/checks even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      for (const path of ['/openapi.json', '/v1/loops', '/v1/checks']) {
        const response = await app.inject({ method: 'HEAD', url: path });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body.startsWith('<!doctype html>')).toBe(false);
      }
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

      const graph = await app.inject({ method: 'GET', url: '/graph' });
      expect(graph.statusCode).toBe(200);
      expect(graph.headers['content-type']).toContain('text/html');
      expect(graph.body).toContain('Radar SPA shell');

      const narratives = await app.inject({ method: 'GET', url: '/narratives' });
      expect(narratives.statusCode).toBe(200);
      expect(narratives.headers['content-type']).toContain('text/html');
      expect(narratives.body).toContain('Radar SPA shell');
      expect(narratives.body).toContain('<title>Infopunks Narrative Asset Intelligence</title>');
      expect(narratives.body).toContain('property="og:title" content="Infopunks Narrative Asset Intelligence"');

      const attentionMarkets = await app.inject({ method: 'GET', url: '/narratives/attention-markets' });
      expect(attentionMarkets.statusCode).toBe(200);
      expect(attentionMarkets.headers['content-type']).toContain('text/html');
      expect(attentionMarkets.body).toContain('Radar SPA shell');

      const ansem = await app.inject({ method: 'GET', url: '/signals/ansem' });
      expect(ansem.statusCode).toBe(200);
      expect(ansem.headers['content-type']).toContain('text/html');
      expect(ansem.body).toContain('Radar SPA shell');

      const blackBull = await app.inject({ method: 'GET', url: '/signals/black-bull' });
      expect(blackBull.statusCode).toBe(200);
      expect(blackBull.headers['content-type']).toContain('text/html');
      expect(blackBull.body).toContain('Radar SPA shell');
      expect(blackBull.body).toContain('<title>Infopunks Signal Report: $ANSEM / The Black Bull</title>');
      expect(blackBull.body).toContain('property="og:description" content="A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk."');

      const blackBullUpdate = await app.inject({ method: 'GET', url: '/signals/black-bull/updates/seu_black_bull_005' });
      expect(blackBullUpdate.statusCode).toBe(200);
      expect(blackBullUpdate.headers['content-type']).toContain('text/html');
      expect(blackBullUpdate.body).toContain('Radar SPA shell');
      expect(blackBullUpdate.body).toContain('Infopunks Desk Dispatch: Verdict Change');

      const radarCard = await app.inject({ method: 'GET', url: '/radar/cards/provider/alpha' });
      expect(radarCard.statusCode).toBe(200);
      expect(radarCard.headers['content-type']).toContain('text/html');
      expect(radarCard.body).toContain('Radar SPA shell');

      const radarCardIndex = await app.inject({ method: 'GET', url: '/radar/cards' });
      expect(radarCardIndex.statusCode).toBe(200);
      expect(radarCardIndex.headers['content-type']).toContain('text/html');
      expect(radarCardIndex.body).toContain('Radar SPA shell');

      const machineCard = await app.inject({ method: 'GET', url: '/machine-market/cards/cloud-translation' });
      expect(machineCard.statusCode).toBe(200);
      expect(machineCard.headers['content-type']).toContain('text/html');
      expect(machineCard.body).toContain('Radar SPA shell');

      const unknownFrontend = await app.inject({ method: 'GET', url: '/frontend-route-that-does-not-exist' });
      expect(unknownFrontend.statusCode).toBe(200);
      expect(unknownFrontend.headers['content-type']).toContain('text/html');
      expect(unknownFrontend.body).toContain('Radar SPA shell');
      expect(unknownFrontend.body).toContain('<title>Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes</title>');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves HEAD for public SPA card routes through the HTML shell', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      for (const path of [
        '/narratives',
        '/narratives/attention-markets',
        '/signals/ansem',
        '/signals/black-bull',
        '/signals/black-bull/updates/seu_black_bull_005',
        '/radar/cards',
        '/radar/cards/benchmark/web-search',
        '/machine-market/cards/cloud-translation'
      ]) {
        const response = await app.inject({ method: 'HEAD', url: path });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
      }
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
