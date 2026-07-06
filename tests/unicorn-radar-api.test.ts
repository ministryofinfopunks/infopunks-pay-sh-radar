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

describe('unicorn radar api', () => {
  it('returns summary, candidate list, detail, and revenue receipts', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const summary = await app.inject({ method: 'GET', url: '/v1/unicorn-radar' });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().data).toEqual(expect.objectContaining({
        title: 'Infopunks Unicorn Radar',
        tagline: 'Finding serious low-cap Solana projects before consensus does.',
        trust_line: 'Projects can buy evaluation, not conviction.',
        counts: expect.objectContaining({
          total: expect.any(Number),
          by_status: expect.objectContaining({ high_signal_lowcap: expect.any(Number) })
        }),
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: 'ur_agent_escrow_rails',
            sector: 'Agent Rails',
            status: 'high_signal_lowcap',
            scores: expect.objectContaining({ overall_signal_score: expect.any(Number) })
          })
        ]),
        revenue_receipts: expect.arrayContaining([
          expect.objectContaining({ id: 'urr_revenue_attn_001', service: 'paid_evaluation' })
        ])
      }));

      const list = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data.count).toBeGreaterThanOrEqual(9);
      expect(list.json().data.candidates[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        project: expect.any(String),
        receipts: expect.any(Array),
        paid_evaluation_disclosure: expect.any(Object)
      }));

      const detail = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/ur_attention_clearinghouse' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        id: 'ur_attention_clearinghouse',
        status: 'paid_evaluation',
        paid_evaluation_disclosure: expect.objectContaining({ is_paid: true })
      }));

      const receipts = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/revenue-receipts' });
      expect(receipts.statusCode).toBe(200);
      expect(receipts.json().data).toEqual(expect.objectContaining({
        count: expect.any(Number),
        receipts: expect.arrayContaining([
          expect.objectContaining({ disclosure: expect.stringContaining('not conviction') })
        ])
      }));
    } finally {
      await app.close();
    }
  });

  it('creates submissions and paid evaluation requests', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const submit = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/submit',
        payload: {
          project: 'Example Lowcap',
          ticker: 'LOW',
          sector: 'AI',
          market_cap_range: '$1M-$3M',
          thesis: 'Shipping before consensus.',
          proof_links: ['https://example.com/demo'],
          submitter_handle: '@hunter'
        }
      });
      expect(submit.statusCode).toBe(200);
      expect(submit.json().data).toEqual(expect.objectContaining({
        status: 'staged_for_review',
        candidate_preview: expect.objectContaining({ project: 'Example Lowcap', ticker: 'LOW' })
      }));

      const evaluation = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/request-evaluation',
        payload: {
          project: 'Example Lowcap',
          ticker: 'LOW',
          sector: 'AI',
          contact: 'founder@example.com'
        }
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json().data).toEqual(expect.objectContaining({
        status: 'evaluation_requested',
        doctrine: 'Projects can buy evaluation, not conviction.',
        disclosure: expect.stringContaining('Payment buys evaluation time')
      }));
    } finally {
      await app.close();
    }
  });

  it('validates payloads and returns not found for unknown candidates', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const missing = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/not-real' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'unicorn_radar_candidate_not_found' });

      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/submit',
        payload: { project: '', sector: 'not-real', thesis: '' }
      });
      expect(invalid.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('serves Unicorn Radar candidate OG image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/unicorn-radar/ur_agent_escrow_rails.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['cache-control']).toContain('public');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('returns 404 for unknown Unicorn Radar OG image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/unicorn-radar/not-real.png' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'og_image_not_found' });
    } finally {
      await app.close();
    }
  });
});
