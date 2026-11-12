import * as databasePool from '../src/persistence/databasePool';
import * as intelligenceStore from '../src/services/intelligenceStore';
import * as endpointMonitor from '../src/services/endpointMonitorService';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig, verifyRuntimeConfiguration } from '../src/config/env';
import { chromium } from 'playwright';

const envNames = ['NODE_ENV', 'PORT', 'RADAR_FRONTDOOR_ONLY', 'DATABASE_URL', 'PAYSH_CATALOG_SOURCE', 'PAY_SH_CATALOG_URL', 'PAYSH_ALLOW_FIXTURE_FALLBACK', 'ADMIN_TOKEN', 'INFOPUNKS_ADMIN_TOKEN', 'JUDGMENT_ISSUER_KEYS_JSON'];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

function configureFrontdoor() {
  for (const name of envNames) delete process.env[name];
  Object.assign(process.env, { NODE_ENV: 'production', PORT: '8787', RADAR_FRONTDOOR_ONLY: 'true' });
}

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[name] : process.env[name] = value;
  vi.restoreAllMocks();
});

describe('RADAR_FRONTDOOR_ONLY qualification', () => {
  it('starts without database or catalog configuration and never creates a pool or hydrates a repository', async () => {
    configureFrontdoor();
    const config = loadRuntimeConfig();
    expect(config.isProduction).toBe(true);
    expect(config.frontdoorOnly).toBe(true);
    expect(config.databaseUrl).toBeNull();
    expect(verifyRuntimeConfiguration().requirements).toContainEqual({ name: 'RADAR_FRONTDOOR_ONLY', state: 'configured' });
    const pool = vi.spyOn(databasePool, 'getDatabasePool');
    const hydrate = vi.spyOn(intelligenceStore, 'createIntelligenceStore');
    const ingest = vi.spyOn(intelligenceStore, 'runPayShIngestion');
    const monitor = vi.spyOn(endpointMonitor, 'runMonitor');
    const interval = vi.spyOn(globalThis, 'setInterval');
    const fetch = vi.spyOn(globalThis, 'fetch');
    const app = await createApp();
    try {
      expect(pool).not.toHaveBeenCalled();
      expect(hydrate).not.toHaveBeenCalled();
      expect(ingest).not.toHaveBeenCalled();
      expect(monitor).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect((await app.inject('/healthz')).statusCode).toBe(200);
      expect((await app.inject('/healthz')).headers).toMatchObject({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'SAMEORIGIN', 'strict-transport-security': 'max-age=31536000; includeSubDomains' });
      expect((await app.inject('/readyz')).statusCode).toBe(503);
      expect((await app.inject('/readyz')).json().reasons).toContainEqual({ code: 'frontdoor_only' });
      expect((await app.inject('/version')).statusCode).toBe(200);
      expect((await app.inject('/status')).json()).toMatchObject({ mode: 'frontdoor_only', dbMode: 'not_initialized', persistence: 'not_initialized', providerCount: null, endpointCount: null, catalog_status: 'not_started' });
      expect((await app.inject('/economic-os/overview/')).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('serves the built homepage and a real frontend asset', async () => {
    configureFrontdoor();
    const app = await createApp();
    try {
      const home = await app.inject('/');
      expect(home.statusCode).toBe(200);
      expect(home.headers['content-type']).toContain('text/html');
      expect(home.body).toContain('id="root"');
      expect(home.body).toContain('name="radar-operating-profile" content="frontdoor-only"');
      const assetPath = home.body.match(/(?:src|href)="(\/assets\/[^\"]+)"/)?.[1];
      expect(assetPath).toBeTruthy();
      const asset = await app.inject(assetPath!);
      expect(asset.statusCode).toBe(200);
      expect(['application/javascript', 'text/javascript', 'text/css']).toContain(asset.headers['content-type']?.split(';')[0]);
      expect(asset.body.length).toBeGreaterThan(0);
      for (const artwork of ['/artwork/signal-punk.webp', '/artwork/economic-signal-punk.webp']) {
        const image = await app.inject(artwork);
        expect(image.statusCode, artwork).toBe(200);
        expect(image.headers['content-type']).toContain('image/webp');
        expect(image.body.length).toBeGreaterThan(0);
      }
      for (const assetPath of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest', '/og-radar.png', '/icon-192.png', '/icon-512.png']) {
        const asset = await app.inject(assetPath);
        expect(asset.statusCode, assetPath).toBe(200);
        expect(asset.body.length, assetPath).toBeGreaterThan(0);
      }
    } finally { await app.close(); }
  });

  it('serves only the reviewed curated archival read projections with explicit stale provenance', async () => {
    configureFrontdoor();
    const app = await createApp();
    try {
      const paths = [
        '/v1/narratives', '/v1/signals', '/v1/signals/ansem', '/v1/signals/black-bull/updates',
        '/v1/attention-market-watch', '/v1/attention-market-watch/intake/requirements',
        '/v1/attention-market-watch/ansem', '/v1/signal-desk', '/v1/signal-desk/candidates',
        '/v1/abundance', '/v1/abundance/claims', '/v1/abundance/receipts'
      ];
      for (const path of paths) {
        const response = await app.inject(path);
        expect(response.statusCode, path).toBe(200);
        expect(response.headers['x-radar-data-class'], path).toBe('curated-archive');
        expect(response.headers['x-radar-data-freshness'], path).toBe('stale');
        expect(Date.parse(response.headers['x-radar-source-updated-at'] as string), path).toBeLessThan(Date.now());
        expect(response.json()).toHaveProperty('data');
      }
      for (const path of ['/v1/pulse', '/v1/providers', '/v1/rh-chain', '/v1/abundance/unreviewed', '/v1/narratives/arbitrary', '/v1/signal-desk/candidates/arbitrary-id']) {
        expect((await app.inject(path)).statusCode, path).toBe(503);
      }
      expect((await app.inject({ method: 'POST', url: '/v1/attention-market-watch/intake', payload: {} })).statusCode).toBe(503);
    } finally { await app.close(); }
  });

  it('renders reviewed archive pages on desktop and mobile without mounting the full-stack bootstrap', async () => {
    configureFrontdoor();
    const app = await createApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_unavailable');
    const browser = await chromium.launch({ headless: true });
    try {
      const paths = ['/narratives', '/narratives/attention-markets', '/narratives/attention-market-watch', '/attention-market-watch/ansem', '/signals/black-bull', '/abundance'];
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport });
        const failedRequests: string[] = [];
        const externalRequests: string[] = [];
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('request', (request) => { if (new URL(request.url()).origin !== `http://127.0.0.1:${address.port}`) externalRequests.push(request.url()); });
        page.on('response', (response) => { if (new URL(response.url()).pathname.startsWith('/v1/') && response.status() >= 500) failedRequests.push(`${response.status()} ${response.url()}`); });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        for (const path of paths) {
          const response = await page.goto(`http://127.0.0.1:${address.port}${path}`, { waitUntil: 'networkidle' });
          expect(response?.status(), `${viewport.width}px ${path}`).toBe(200);
          await page.getByRole('note', { name: 'Data availability' }).waitFor({ state: 'visible' });
          expect(await page.locator('nav[aria-label="Infopunks product navigation"] a[href="/"]').getAttribute('aria-current')).toBe('page');
          expect(await page.locator('.radar-specialized-nav').count()).toBe(0);
          expect(await page.locator('#radar-page-content').innerText()).not.toContain('Surface unavailable');
          if (path === '/narratives') {
            expect(await page.locator('#radar-page-content').innerText()).toContain('Archived Watch');
            expect(await page.locator('#radar-page-content').innerText()).not.toContain('Live Watch');
          }
          if (path === '/narratives') await page.screenshot({ path: `docs/release/radar-frontdoor-release-2026-11-12/archive-narratives-${viewport.width}.png` });
          await page.reload({ waitUntil: 'networkidle' });
          expect(await page.getByRole('note', { name: 'Data availability' }).count()).toBe(1);
        }
        expect(failedRequests).toEqual([]);
        expect(externalRequests).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
        await page.close();
      }
    } finally { await browser.close(); await app.close(); }
  }, 60_000);

  it('renders the approved homepage and all nine Economic OS deep links on desktop and mobile without backend calls', async () => {
    configureFrontdoor();
    const app = await createApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('test_server_address_unavailable');
    const browser = await chromium.launch({ headless: true });
    try {
      const routes = [
        ['overview', 'Overview'], ['launch', 'Launch your agent'], ['constitution', 'Constitution'],
        ['research', 'RWA Evidence Check'], ['radar', 'Radar pre-spend'], ['orders', 'Service orders'],
        ['delivery', 'Delivery & acceptance'], ['receipts', 'Economic receipts'], ['activity', 'Economic activity']
      ] as const;
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport });
        const apiRequests: string[] = [];
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/v1/')) apiRequests.push(request.url()); });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        for (const [route, label] of routes) {
          const url = `http://127.0.0.1:${address.port}/economic-os/${route}`;
          const response = await page.goto(url, { waitUntil: 'networkidle' });
          expect(response?.status(), `${viewport.width}px ${route}`).toBe(200);
          await page.locator('.economic-os').waitFor({ state: 'visible' });
          expect(await page.locator('.economic-mobile-nav summary').textContent(), `${viewport.width}px ${route}`).toContain(label);
          expect(await page.locator('.economic-proof h1').first().textContent()).toBeTruthy();
          await page.reload({ waitUntil: 'networkidle' });
          expect(await page.locator('.economic-os').count(), `${viewport.width}px refresh ${route}`).toBe(1);
          expect(await page.locator('.economic-mobile-nav summary').textContent(), `${viewport.width}px refresh ${route}`).toContain(label);
          if (route === 'overview') await page.screenshot({ path: `/tmp/radar-economic-os-${viewport.width}.png`, fullPage: true });
        }
        const home = await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
        expect(home?.status()).toBe(200);
        expect(await page.locator('.radar-signal-portrait img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        expect(await page.locator('.radar-home-route-form').getAttribute('action')).toBe('/spend-terminal');
        expect(await page.locator('.radar-home-availability').textContent()).toContain('live checks unavailable');
        await page.screenshot({ path: `/tmp/radar-home-${viewport.width}.png` });
        await page.setViewportSize(viewport);
        await page.goto(`http://127.0.0.1:${address.port}/economic-os/overview`, { waitUntil: 'networkidle' });
        expect(apiRequests).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
        await page.close();
      }
    } finally { await browser.close(); await app.close(); }
  }, 60_000);

  it('blocks registered and unknown API routes before their handlers, across methods and path variants', async () => {
    configureFrontdoor();
    const app = await createApp();
    const handler = vi.fn(() => ({ secret: true }));
    app.route({ method: ['GET', 'POST', 'DELETE'], url: '/v1/__frontdoor_probe', handler });
    try {
      const cases: Array<[string, string]> = [
        ['GET', '/v1/pulse'], ['GET', '/v1/pulse?cache=1'], ['GET', '/v1/unknown'],
        ['POST', '/v1/__frontdoor_probe'], ['DELETE', '/v1/__frontdoor_probe'], ['HEAD', '/v1/__frontdoor_probe'], ['OPTIONS', '/v1/__frontdoor_probe'],
        ['GET', '/v1/__frontdoor_probe/'], ['GET', '/v1/%70ulse'], ['GET', '/v1/%2e%2e/admin'],
        ['POST', '/v1/receipts'], ['POST', '/v1/pre-spend/check'], ['POST', '/v1/payments'],
        ['POST', '/v1/execution'], ['POST', '/v1/settlement'], ['GET', '/admin/review-queue'],
        ['GET', '/reviewer/4663'], ['GET', '/internal/4663/frontdoor/metrics'], ['GET', '/proof/judgment/private-id'],
        ['GET', '/v1/proofs/private-id'], ['GET', '/healthz/'], ['DELETE', '/healthz'],
        ['GET', '/assets/../llms.txt'], ['GET', '/assets/%2e%2e/llms.txt']
      ];
      for (const [method, url] of cases) {
        const response = await app.inject({ method: method as 'GET' | 'POST' | 'DELETE' | 'HEAD' | 'OPTIONS', url });
        expect(response.statusCode, `${method} ${url}`).toBe(503);
        expect(response.headers['retry-after']).toBe('300');
        if (method !== 'HEAD') expect(response.json()).toMatchObject({ error: 'frontdoor_only', reason: 'data_services_unavailable' });
        expect(response.body).not.toContain('secret');
      }
      expect(handler).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('does not let malformed flag values activate front-door mode', async () => {
    configureFrontdoor();
    process.env.RADAR_FRONTDOOR_ONLY = 'yes';
    await expect(createApp()).rejects.toThrow('RADAR_FRONTDOOR_ONLY must be "true" or "false"');
  });

  it('keeps normal production database and catalog requirements when front-door mode is explicitly false', () => {
    configureFrontdoor();
    process.env.RADAR_FRONTDOOR_ONLY = 'false';
    expect(() => loadRuntimeConfig()).toThrow(/DATABASE_URL|PAY_SH_CATALOG_URL|PAYSH_CATALOG_SOURCE/);
  });

  it('rejects invalid unrelated production signing configuration in front-door mode', () => {
    configureFrontdoor();
    process.env.JUDGMENT_ISSUER_KEYS_JSON = 'not-json';
    expect(() => loadRuntimeConfig()).toThrow('JUDGMENT_ISSUER_KEYS_JSON');
  });
});
