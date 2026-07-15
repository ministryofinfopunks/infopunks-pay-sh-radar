import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEvaluationRequest,
  EVALUATION_REVENUE_RECEIPT_POLICY,
  EvaluationRequestValidationError
} from '../src/services/evaluationRequestService';

const validPayload = {
  projectName: 'Kintara',
  ticker: 'KINS',
  chain: 'solana',
  contact: 'founder@kintara.com',
  upsideThesis: 'Playable MMO economy with visible receipts.',
  riskFlags: 'Retention risk, GameFi volatility.',
  disclosureAcknowledged: true
} as const;

describe('evaluation request service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates required fields', async () => {
    await expect(createEvaluationRequest({
      ...validPayload,
      projectName: '',
      ticker: ''
    })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'projectName' }),
        expect.objectContaining({ path: 'ticker' })
      ])
    });
  });

  it('rejects missing disclosure', async () => {
    await expect(createEvaluationRequest({
      ...validPayload,
      disclosureAcknowledged: false
    })).rejects.toMatchObject({
      code: 'DISCLOSURE_REQUIRED',
      message: 'You must acknowledge that payment buys evaluation, not conviction.'
    });
  });

  it('generates request id', async () => {
    const response = await createEvaluationRequest(validPayload, {
      now: new Date('2026-07-06T10:30:00.000Z'),
      randomSuffix: 'abc123'
    });

    expect(response.request_id).toBe('er_20260706103000_abc123');
  });

  it('returns manual_delivery_required when webhook env is absent', async () => {
    const response = await createEvaluationRequest(validPayload, {
      now: new Date('2026-07-06T10:30:00.000Z'),
      randomSuffix: 'abc123',
      webhookUrl: null
    });

    expect(response.status).toBe('manual_delivery_required');
    expect(response.next_steps.join(' ')).toContain('Copy the request packet below.');
    const packet = JSON.parse(response.request_packet) as Record<string, unknown>;
    expect(packet.request_id).toBe('er_20260706103000_abc123');
    expect(packet.generated_at).toBe('2026-07-06T10:30:00.000Z');
    expect(packet.submitted_at).toBe('2026-07-06T10:30:00.000Z');
    expect(packet.revenue_receipt_policy).toBe(EVALUATION_REVENUE_RECEIPT_POLICY);
    expect(packet.policy_note).toContain('Payment buys evaluation, not conviction.');
    expect(packet.disclosure_acknowledged).toBe(true);
    expect(packet.evaluation_request).toEqual(expect.objectContaining({
      projectName: 'Kintara',
      ticker: 'KINS',
      chain: 'solana',
      contact: 'founder@kintara.com',
      upsideThesis: 'Playable MMO economy with visible receipts.',
      riskFlags: 'Retention risk, GameFi volatility.',
      disclosureAcknowledged: true
    }));
    expect(packet.evaluation_request).not.toHaveProperty('tokenAddress');
  });

  it('returns accepted when webhook is mocked and configured', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const response = await createEvaluationRequest(validPayload, {
      webhookUrl: 'https://example.com/intake',
      fetchImpl,
      now: new Date('2026-07-06T10:30:00.000Z'),
      randomSuffix: 'abc123'
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.status).toBe('accepted');
  });

  it('includes revenue receipt policy', async () => {
    const response = await createEvaluationRequest(validPayload, {
      webhookUrl: null
    });

    expect(response.revenue_receipt_policy).toBe(EVALUATION_REVENUE_RECEIPT_POLICY);
  });

  it('includes copyable request packet', async () => {
    const response = await createEvaluationRequest(validPayload, {
      now: new Date('2026-07-06T10:30:00.000Z'),
      randomSuffix: 'abc123',
      webhookUrl: null
    });

    expect(() => JSON.parse(response.request_packet)).not.toThrow();
  });
});
