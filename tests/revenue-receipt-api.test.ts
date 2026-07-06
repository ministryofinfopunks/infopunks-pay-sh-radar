import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectPng(payload: Buffer) {
  expect(payload.length).toBeGreaterThan(24);
  expect(payload.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(payload.readUInt32BE(16)).toBe(1200);
  expect(payload.readUInt32BE(20)).toBe(630);
}

describe('revenue receipt api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the public receipt ledger and detail routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/revenue-receipts' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.objectContaining({
        title: 'Infopunks Revenue Receipts',
        receipts: expect.arrayContaining([
          expect.objectContaining({ id: 'rr_open_evaluation_slot', status: 'open_slot' }),
          expect.objectContaining({ id: 'rr_template_001', status: 'pending' }),
          expect.objectContaining({ id: 'rr_unicorn_radar_build', status: 'completed' })
        ])
      }));

      const detail = await app.inject({ method: 'GET', url: '/v1/revenue-receipts/rr_open_evaluation_slot' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        id: 'rr_open_evaluation_slot',
        amount: 100,
        hunterReward: 30,
        disclosure: 'Projects can buy evaluation, not conviction.'
      }));
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown receipt detail', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/revenue-receipts/not-real' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'revenue_receipt_not_found' });
    } finally {
      await app.close();
    }
  });

  it('serves receipt OG images and 404s invalid ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/revenue-receipts/rr_open_evaluation_slot.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);

      const missing = await app.inject({ method: 'GET', url: '/og/revenue-receipts/not-real.png' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'og_image_not_found' });
    } finally {
      await app.close();
    }
  }, 20000);
});

