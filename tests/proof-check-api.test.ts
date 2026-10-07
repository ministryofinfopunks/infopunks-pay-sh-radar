import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('proof check API', () => {
  it('creates a structured proof check', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: {
        input: 'Autonomous agent can route and settle everything now.'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.check_id).toMatch(/^check_/);
    expect(response.json().data.decision_state).toBe('do_not_use_yet');
    await app.close();
  });

  it('lists seeded and created proof checks and returns detail', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const create = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: {
        input: 'Provider reliability validated and verified across receipt parsing runs.'
      }
    });
    const createdId = create.json().data.check_id;

    const list = await app.inject({ method: 'GET', url: '/v1/checks' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.checks.some((check: any) => check.check_id === 'check_provider_reliability_seed')).toBe(true);
    expect(list.json().data.checks.some((check: any) => check.check_id === createdId)).toBe(true);

    const detail = await app.inject({ method: 'GET', url: `/v1/checks/${createdId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.check_id).toBe(createdId);

    const missing = await app.inject({ method: 'GET', url: '/v1/checks/check_missing' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('creates and retrieves the seeded MONITOR proof check from the structured contract', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: {
        claim: '$MONITOR is a live global-situation intelligence product paired with tokenized PLTR',
        claim_type: 'market_narrative',
        subject: {
          ticker: 'MONITOR',
          name: 'The Situation',
          chain: 'robinhood',
          contract: '0x1a911bb954dAA9CB38513423075bE74450351e18',
          pair: '0xcfa7bb34e23a7022c3de3e1618e1ff29cde8f16a76c341eca19d16f928968a3d',
          site: 'https://www.monitorsituation.xyz/',
          x: 'https://x.com/monitoringmeme'
        },
        receipts: [
          { type: 'onchain_pair', url: 'https://dexscreener.com/robinhood/0xcfa7bb34e23a7022c3de3e1618e1ff29cde8f16a76c341eca19d16f928968a3d' },
          { type: 'public_site', url: 'https://www.monitorsituation.xyz/' },
          { type: 'social', url: 'https://x.com/monitoringmeme' }
        ],
        missing_receipts: ['audit', 'team_dox', 'utility_commitment', 'paid_route_benchmark']
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.check_id).toBe('check_monitor');
    expect(response.json().data.decision_state).toBe('caution');
    expect(response.json().data.subject_id).toBe('subject_monitor');
    expect(response.json().data.missing_receipts).toContain('audit');

    const detail = await app.inject({ method: 'GET', url: '/v1/checks/check_monitor' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.share_url).toBe('/check/monitor');
    expect(detail.json().data.claim_type).toBe('market_narrative');
    await app.close();
  });
});
