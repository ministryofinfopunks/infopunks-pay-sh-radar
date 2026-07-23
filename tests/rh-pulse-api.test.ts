import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { RhPulseService } from '../src/services/rhPulseService';
import {
  RhPulseConnectionsResponseSchema,
  RhPulseCurrentWindowResponseSchema,
  RhPulseMethodologyResponseSchema,
  RhPulseResponseSchema,
  RhPulseSourceHealthResponseSchema
} from '../src/shared/rhPulse';

const NOW = new Date('2026-07-23T06:00:00.000Z');

function pulseService() {
  return new RhPulseService({
    crossLayer: async () => ({
      entries: [],
      captured_at: '2026-07-23T05:45:00.000Z',
      freshness: 'partial',
      confidence: 'low',
      warnings: ['No qualifying reviewed overlap.']
    }),
    callsEnabled: false,
    now: () => NOW,
    cacheTtlMs: 60_000
  });
}

describe('RH Pulse read API', () => {
  it('serves all five validated read-only endpoints with explicit cache policy and UTC timestamps', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhPulseService: pulseService()
    });

    try {
      const cases = [
        ['/v1/rh-pulse', RhPulseResponseSchema],
        ['/v1/rh-pulse/connections', RhPulseConnectionsResponseSchema],
        ['/v1/rh-pulse/current-window', RhPulseCurrentWindowResponseSchema],
        ['/v1/rh-pulse/methodology', RhPulseMethodologyResponseSchema],
        ['/v1/rh-pulse/source-health', RhPulseSourceHealthResponseSchema]
      ] as const;

      for (const [url, schema] of cases) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['cache-control']).toContain('public');
        const payload = response.json();
        expect(() => schema.parse(payload)).not.toThrow();
        expect(payload.generated_at).toBe(NOW.toISOString());
      }
    } finally {
      await app.close();
    }
  });

  it('returns a disabled preview rather than a fake active public call window', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhPulseService: pulseService()
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-pulse/current-window' });
      expect(response.json().data).toMatchObject({
        id: 'rh_pulse_preview_24h',
        state: 'preview',
        opens_at: null,
        closes_at: null,
        calls_enabled: false,
        generated_at: NOW.toISOString()
      });
    } finally {
      await app.close();
    }
  });

  it('keeps stable connection IDs, under-watch separation, and no dollar-flow field', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhPulseService: pulseService()
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-pulse' });
      const data = response.json().data;
      expect(data.connections.map((item: { id: string }) => item.id)).toEqual([
        'memes_to_agents',
        'memes_to_rwas',
        'agents_to_rwas'
      ]);
      expect(data.connection_under_watch).toBe('agents_to_rwas');
      expect(data.connections.find((item: { id: string }) => item.id === 'agents_to_rwas')).toMatchObject({
        under_watch: true,
        is_strongest_current_signal: false
      });
      expect(JSON.stringify(data)).not.toMatch(/dollar_flow|flow_usd|community_percentage/i);
    } finally {
      await app.close();
    }
  });
});
