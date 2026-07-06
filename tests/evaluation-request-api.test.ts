import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const validPayload = {
  projectName: 'Kintara',
  ticker: 'KINS',
  chain: 'solana',
  contact: 'founder@kintara.com',
  upsideThesis: 'Playable MMO economy with visible receipts.',
  riskFlags: 'Retention risk, GameFi volatility.',
  disclosureAcknowledged: true
};

describe('evaluation request api', () => {
  const originalWebhookUrl = process.env.EVALUATION_REQUEST_WEBHOOK_URL;

  beforeEach(() => {
    delete process.env.EVALUATION_REQUEST_WEBHOOK_URL;
  });

  afterEach(() => {
    if (originalWebhookUrl) process.env.EVALUATION_REQUEST_WEBHOOK_URL = originalWebhookUrl;
    else delete process.env.EVALUATION_REQUEST_WEBHOOK_URL;
    vi.unstubAllGlobals();
  });

  it('POST valid payload returns status manual_delivery_required without webhook', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/evaluation-request',
        payload: validPayload
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        status: 'manual_delivery_required',
        disclosure_acknowledged: true,
        revenue_receipt_policy: 'Paid evaluations may receive public Revenue Receipts. Payment buys evaluation, not conviction.'
      }));
      const packet = JSON.parse(response.json().data.request_packet as string) as Record<string, unknown>;
      expect(packet).toEqual(expect.objectContaining({
        request_id: expect.any(String),
        generated_at: expect.any(String),
        submitted_at: expect.any(String),
        disclosure_acknowledged: true,
        revenue_receipt_policy: 'Paid evaluations may receive public Revenue Receipts. Payment buys evaluation, not conviction.',
        policy_note: expect.stringContaining('Payment buys evaluation, not conviction.'),
        evaluation_request: expect.objectContaining({
          projectName: 'Kintara',
          ticker: 'KINS',
          chain: 'solana',
          contact: 'founder@kintara.com',
          upsideThesis: 'Playable MMO economy with visible receipts.',
          riskFlags: 'Retention risk, GameFi volatility.',
          disclosureAcknowledged: true
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('POST missing disclosure returns 400 DISCLOSURE_REQUIRED', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/evaluation-request',
        payload: {
          ...validPayload,
          disclosureAcknowledged: false
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: 'DISCLOSURE_REQUIRED',
        message: 'You must acknowledge that payment buys evaluation, not conviction.'
      });
    } finally {
      await app.close();
    }
  });

  it('POST missing required fields returns 400', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/evaluation-request',
        payload: {
          disclosureAcknowledged: true
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('invalid_request');
    } finally {
      await app.close();
    }
  });

  it('webhook path can be mocked', async () => {
    process.env.EVALUATION_REQUEST_WEBHOOK_URL = 'https://example.com/intake';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/evaluation-request',
        payload: validPayload
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().data.status).toBe('accepted');
      expect(response.json().data.request_packet).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});
