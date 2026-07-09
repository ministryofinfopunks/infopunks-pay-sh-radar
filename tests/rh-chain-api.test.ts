import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('RH Chain Signal Desk API', () => {
  it('queues RH Chain signal submissions for manual review', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/rh-chain/signals/submit',
        payload: {
          token_contract: '0xabc123',
          ticker: 'hood',
          chain: 'Robinhood Chain',
          x_twitter_link: 'https://x.com/example/status/1',
          website_link: '',
          liquidity_link: '',
          deployer_notes: '',
          submitter_notes: 'Receipts before attention.',
          disclosure_confirmed: true
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.review_packet).toEqual(expect.objectContaining({
        token_contract: '0xabc123',
        ticker: 'HOOD',
        chain: 'Robinhood Chain',
        disclosure_confirmed: true,
        review_status: 'queued_for_manual_review',
        next_step: 'Infopunks will review the signal manually before adding it to the public desk.'
      }));
      expect(response.json().data.review_packet.links).toEqual({
        x_twitter: 'https://x.com/example/status/1',
        website: null,
        liquidity: null
      });
      expect(response.json().data.review_packet.submission_id).toMatch(/^rh-chain-hood-\d{14}$/);
    } finally {
      await app.close();
    }
  });

  it('rejects submissions without receipt fields and disclosure', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/rh-chain/signals/submit',
        payload: {
          token_contract: '0xabc123',
          ticker: 'HOOD',
          chain: 'Robinhood Chain',
          disclosure_confirmed: false
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('invalid_request');
      expect(response.json().issues.map((issue: { message: string }) => issue.message)).toEqual(expect.arrayContaining([
        'disclosure_must_be_confirmed',
        'at_least_one_receipt_or_deployer_note_required'
      ]));
    } finally {
      await app.close();
    }
  });
});
