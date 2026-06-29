import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectPng(payload: Buffer) {
  expect(payload.length).toBeGreaterThan(24);
  expect(payload.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(payload.readUInt32BE(16)).toBe(1200);
  expect(payload.readUInt32BE(20)).toBe(630);
}

describe('narrative intel api', () => {
  it('returns seeded narrative asset data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/narratives' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slug: 'black-bull',
          ticker: 'ANSEM',
          name: 'The Black Bull',
          chain: 'Solana',
          signal_source: 'Ansem'
        })
      ]));

      const detail = await app.inject({ method: 'GET', url: '/v1/narratives/black-bull' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        ticker: 'ANSEM',
        thesis: '$ANSEM is a live experiment in financialized attention, where persona, meme, wallet flows, and community belief become a tradable signal object.'
      }));
    } finally {
      await app.close();
    }
  });

  it('returns seeded signal source and report data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/signals' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({ slug: 'ansem', type: 'signal_source' }),
        expect.objectContaining({ slug: 'black-bull', type: 'signal_report' })
      ]));

      const source = await app.inject({ method: 'GET', url: '/v1/signals/ansem' });
      expect(source.statusCode).toBe(200);
      expect(source.json().data).toEqual(expect.objectContaining({
        slug: 'ansem',
        type: 'signal_source',
        signal_source: 'Ansem'
      }));

      const report = await app.inject({ method: 'GET', url: '/v1/signals/black-bull' });
      expect(report.statusCode).toBe(200);
      expect(report.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        type: 'signal_report',
        signal_source: 'Ansem'
      }));
      expect(report.json().data.cards.length).toBeGreaterThanOrEqual(9);
    } finally {
      await app.close();
    }
  });

  it('returns seeded signal evidence updates newest first', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates' });
      expect(response.statusCode).toBe(200);

      const payload = response.json().data;
      expect(payload.signal_slug).toBe('black-bull');
      expect(payload.count).toBeGreaterThanOrEqual(5);
      expect(payload.summary).toContain('Evidence update summary');
      expect(payload.latest_update).toEqual(expect.objectContaining({
        update_id: 'seu_black_bull_005',
        update_type: 'verdict_change'
      }));
      expect(payload.updates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          update_id: expect.any(String),
          signal_slug: 'black-bull',
          timestamp: expect.any(String),
          update_type: expect.stringMatching(/attention_shift|holder_shift|myth_shift|risk_shift|verdict_change/),
          summary: expect.any(String),
          evidence_links: expect.arrayContaining([expect.any(String)]),
          analyst_note: expect.any(String)
        })
      ]));

      const timestamps = payload.updates.map((update: { timestamp: string }) => update.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)));
      expect(payload.updates[0]).toEqual(expect.objectContaining({
        update_id: 'seu_black_bull_005',
        update_type: 'verdict_change',
        previous_score: 74,
        new_score: 80
      }));
    } finally {
      await app.close();
    }
  });

  it('returns one seeded signal evidence update by id', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates/seu_black_bull_005' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        signal_slug: 'black-bull',
        update: expect.objectContaining({
          update_id: 'seu_black_bull_005',
          signal_slug: 'black-bull',
          update_type: 'verdict_change',
          summary: expect.any(String)
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('serves the narrative OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/narratives.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['cache-control']).toContain('public');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  });

  it('serves the seeded signal report OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  });

  it('serves the seeded dispatch permalink OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull/updates/seu_black_bull_005.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown OG update image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull/updates/missing-update.png' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'og_image_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown signal update requests', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/unknown-signal/updates' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'signal_surface_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown signal update ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates/missing-update' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'signal_update_not_found' });
    } finally {
      await app.close();
    }
  });
});
