import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig } from '../src/config/env';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { dxFixture, dxKey, otherKey } from './helpers/judgmentDx';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function profile() {
  vi.stubEnv('RADAR_PUBLIC_READ_RELEASE', 'true'); vi.stubEnv('PAYSH_BOOTSTRAP_ENABLED', 'false');
  vi.stubEnv('INGESTION_ENABLED', 'false'); vi.stubEnv('MONITOR_ENABLED', 'false');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
}
describe('approved opt-in public read availability boundary', () => {
  it('defaults off, validates its flag, and preserves the existing API response by default', async () => {
    vi.stubEnv('RADAR_PUBLIC_READ_RELEASE', undefined as never); delete process.env.RADAR_PUBLIC_READ_RELEASE;
    expect(loadRuntimeConfig().publicReadRelease).toBe(false);
    const app = await createApp(emptyIntelligenceStore());
    try { const r = await app.inject('/openapi.json'); expect(r.statusCode).toBe(200); expect(r.json()['x-radar-public-release']).toBeUndefined(); }
    finally { await app.close(); }
    vi.stubEnv('RADAR_PUBLIC_READ_RELEASE', 'typo'); expect(() => loadRuntimeConfig()).toThrow();
  });
  it('allows only reviewed public reads and fixed UI/assets; blocks direct excluded navigation and mutations before effects', async () => {
    profile();
    const dir = await mkdtemp(join(tmpdir(), 'radar-r2-boundary-')); await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Fixed shell</title>'); await writeFile(join(dir, 'assets/read-123.js'), 'void 0');
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir: dir });
    try {
      for (const url of ['/unicorn-radar', '/unicorn-radar/ur_manifest_ambiguity', '/developers', '/', '/assets/read-123.js', '/openapi.json', '/healthz', '/version', '/v1/unicorn-radar', '/v1/unicorn-radar/candidates', '/v1/unicorn-radar/candidates/ur_manifest_ambiguity']) {
        const r = await app.inject(url); expect(r.statusCode, url + r.body).toBe(200);
        expect((await app.inject({ method: 'HEAD', url })).statusCode, url).toBe(200);
      }
      for (const url of ['/solana', '/signal-hunt', '/hermes', '/check', '/loops', '/machine-market', '/revenue-receipts', '/evaluation-request', '/4663', '/v1/hermes', '/v1/loops', '/v1/signal-hunt', '/v1/unicorn-radar/revenue-receipts', '/og/unicorn-radar.png', '/assets/../signal-hunt', '/%75nicorn-radar', '/assets/read%2F123.js', '/v1/unicorn-radar/', '/v1/unicorn-radar?status=watchlist']) {
        const r = await app.inject(url); expect(r.statusCode, url + r.body).toBe(403); expect(r.headers['cache-control']).toBe('private, no-store');
        expect(r.json().error).toMatch(/^public_release_/); expect(r.body).not.toContain(url);
      }
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) for (const url of ['/v1/pre-spend/check', '/v1/decide', '/v1/unicorn-radar', '/v1/unicorn-radar/submit', '/v1/hermes/run', '/v1/loops/run', '/v1/claims', '/v1/receipts']) {
        const r = await app.inject({ method, url, headers: { 'content-type': 'application/json' }, payload: '{invalid' });
        expect(r.statusCode, method + url + r.body).toBe(403); // onRequest, before body parsing or handler.
      }
      const p = await app.inject({ url: '/v1/unicorn-radar', headers: { 'payment-signature': 'untrusted' } }); expect(p.statusCode).toBe(403);
      for (const id of ['missing', 'revenue-receipts']) { const missing = await app.inject('/v1/unicorn-radar/candidates/' + id); expect(missing.statusCode).toBe(404); expect(missing.json()).toEqual({ error: 'unicorn_radar_candidate_not_found' }); }
      const malformed = await app.inject({ url: '/4663/share/%FF', headers: { accept: 'text/html' } }); expect(malformed.statusCode).toBe(400); expect(malformed.headers['content-type']).toContain('application/json');
      expect(malformed.body).not.toContain('%FF');
      const spec = (await app.inject('/openapi.json')).json(); expect(spec['x-radar-public-release'].anonymous_api_routes).toHaveLength(4);
      expect(spec.paths['/v1/unicorn-radar'].get.responses['403'].content['application/json'].examples.public_release_query_unsupported.value).toEqual({ error: 'public_release_query_unsupported' });
      expect(spec.paths['/v1/unicorn-radar'].get['x-radar-anonymous-public-read']).toBe(true);
      expect(spec.paths['/v1/pre-spend/check'].post['x-radar-anonymous-public-read']).toBe(false);
    } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
  });
  it('keeps existing CORS controls; permitted preflight cannot authorize excluded execution', async () => {
    profile(); const app = await createApp(emptyIntelligenceStore());
    try {
      for (const url of ['/v1/unicorn-radar', '/v1/unicorn-radar/candidates/ur_manifest_ambiguity']) {
        const r = await app.inject({ method: 'OPTIONS', url, headers: { origin: 'https://radar.infopunks.fun', 'access-control-request-method': 'GET' } });
        expect(r.statusCode, r.body).toBe(204); expect(r.headers['access-control-allow-origin']).toBe('https://radar.infopunks.fun');
      }
      const bad = await app.inject({ method: 'OPTIONS', url: '/v1/hermes/run', headers: { origin: 'https://radar.infopunks.fun', 'access-control-request-method': 'POST' } }); expect(bad.statusCode).toBe(403);
      const evil = await app.inject({ method: 'OPTIONS', url: '/v1/unicorn-radar', headers: { origin: 'https://untrusted.invalid', 'access-control-request-method': 'GET' } }); expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    } finally { await app.close(); }
  });
  it('preserves original tenant ownership and operator checks without turning tenant keys into global access', async () => {
    profile(); const f = await dxFixture();
    try {
      expect((await f.app.inject('/v1/judgment/session')).statusCode).toBe(401);
      const session = await f.app.inject({ url: '/v1/judgment/session', headers: { authorization: 'Bearer ' + dxKey } }); expect(session.json().data.tenant_id).toBe('tenant-a');
      const history = await f.app.inject({ url: '/v1/judgments/history', headers: { authorization: 'Bearer ' + otherKey } }); expect(history.json().data).toMatchObject({ paid: [], free: [] });
      const denied = await f.app.inject({ url: '/v1/signal-hunt', headers: { authorization: 'Bearer ' + dxKey } }); expect(denied.statusCode).toBe(403);
      expect((await f.app.inject('/v1/receipt-spine/judgment/guess')).statusCode).toBe(401);
      expect((await f.app.inject({ url: '/v1/receipt-spine/judgment/guess', headers: { authorization: 'Bearer ' + otherKey } })).statusCode).toBe(404);
      expect((await f.app.inject({ url: '/v1/receipt-spine/tape', headers: { authorization: 'Bearer ' + dxKey } })).statusCode).toBe(401);
      expect((await f.app.inject({ url: '/v1/signal-hunt', headers: { authorization: 'Bearer reviewer' } })).statusCode).toBe(200);
      expect((await f.app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', payload: {}, headers: { authorization: 'Bearer reviewer' } })).statusCode).toBe(400); // Original schema, not a bypass.
      const result = await f.client().judge({ ...(await import('./helpers/judgmentDx')).dxInput }, { idempotencyKey: 'r2-owner' });
      const url = '/v1/receipt-spine/judgment/' + result.judgment_id;
      expect((await f.app.inject({ url, headers: { authorization: 'Bearer ' + dxKey } })).statusCode).toBe(200);
      expect((await f.app.inject({ url, headers: { authorization: 'Bearer ' + otherKey } })).statusCode).toBe(404);
    } finally { await f.close(); }
  });
});
