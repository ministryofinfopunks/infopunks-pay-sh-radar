import { describe, expect, it } from 'vitest';
import { rh4663CacheClassForPath, RH4663_ROUTE_CACHE_MATRIX } from '../src/services/rh4663CachePolicy';
import { Rh4663FrontdoorService } from '../src/services/rh4663FrontdoorService';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('4663 production hardening contracts', () => {
  it('makes public/private/admin cache ownership explicit', () => {
    expect(RH4663_ROUTE_CACHE_MATRIX.length).toBeGreaterThan(6);
    expect(rh4663CacheClassForPath('/v1/4663/me/call')).toBe('PRIVATE_NO_STORE');
    expect(rh4663CacheClassForPath('/internal/4663/frontdoor/metrics')).toBe('ADMIN_NO_STORE');
    expect(rh4663CacheClassForPath('/v1/4663/receipts/IP-CALL-1')).toBe('PUBLIC_IMMUTABLE');
    expect(rh4663CacheClassForPath('/og/4663/proof/0xabc.png')).toBe('PUBLIC_CACHEABLE');
  });

  it('bounds a hung optional source and returns honest partial state', async () => {
    const at = '2026-09-08T00:00:00.000Z';
    const service = new Rh4663FrontdoorService({
      census: async () => new Promise<any>(() => {}),
      watch: async () => ({ generated_at: at, cases: [], feed: [], falsification_queue: [] }),
      preflight: async () => null,
      pulse: async () => ({ window: { window_id: 'w', opens_at: at, closes_at: at }, consensus: { state: 'available', leading_rotation: null, total_calls: 0 } }),
      signals: async () => [], source_timeout_ms: 5, now: () => new Date(at)
    });
    const state = await service.read();
    expect(state.system_status.state).toBe('partial');
    expect(state.system_status.source_health.census).toMatchObject({ health_state: 'UNAVAILABLE', failure_class: 'TIMEOUT' });
    expect(service.metrics().last_source_reads.census).toMatchObject({ failure_class: 'TIMEOUT' });
  });

  it('keeps a changing wallet proof URL short-cacheable rather than immutable', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/og/4663/proof/0x1111111111111111111111111111111111111111.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toContain('max-age=60');
      expect(response.headers['cache-control']).not.toContain('immutable');
      expect(response.headers.etag).toMatch(/^"proof-/);
      const revalidated = await app.inject({ method: 'GET', url: '/og/4663/proof/0x1111111111111111111111111111111111111111.png', headers: { 'if-none-match': response.headers.etag! } });
      expect(revalidated.statusCode).toBe(304);
    } finally { await app.close(); }
  });

  it('marks internal operations as no-store even when authentication fails', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/internal/4663/frontdoor/metrics' });
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    } finally { await app.close(); }
  });
});
