import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('Abundance Desk API', () => {
  it('returns the seeded Abundance Desk JSON surface', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/abundance' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.title).toBe('Abundance Desk');
    expect(body.data.hero_copy).toBe('When machines do the work, Infopunks checks the receipts.');
    expect(body.data.abundance_claims_feed.length).toBeGreaterThanOrEqual(5);
    expect(body.data.proof_gap_index.map((row: any) => row.label)).toEqual(expect.arrayContaining([
      'Receipts present',
      'Plausible, unproven',
      'Hype without route',
      'Dangerous if automated',
      'Ready for agent spend',
      'Needs human validation'
    ]));

    await app.close();
  });

  it('returns seeded claims and receipts', async () => {
    const app = await createApp();

    const claims = await app.inject({ method: 'GET', url: '/v1/abundance/claims' });
    const receipts = await app.inject({ method: 'GET', url: '/v1/abundance/receipts' });
    const claimsBody = claims.json();
    const receiptsBody = receipts.json();

    expect(claims.statusCode).toBe(200);
    expect(claimsBody.data.count).toBeGreaterThanOrEqual(5);
    expect(claimsBody.data.claims.some((claim: any) => claim.claim_id === 'abd_claim_agent_paid_api_work')).toBe(true);
    expect(receipts.statusCode).toBe(200);
    expect(receiptsBody.data.receipts[0]).toEqual(expect.objectContaining({
      receipt_id: expect.any(String),
      task: expect.any(String),
      performer_type: expect.any(String),
      performer_name: expect.any(String),
      requester: expect.any(String),
      route_used: expect.any(String),
      chain: expect.any(String),
      output_summary: expect.any(String),
      evidence_artifacts: expect.any(Array),
      validation_state: expect.any(String),
      reputation_impact: expect.any(String)
    }));

    await app.close();
  });
});
