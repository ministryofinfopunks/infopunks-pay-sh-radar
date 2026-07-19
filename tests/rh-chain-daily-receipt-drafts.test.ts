import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { InMemoryRhChainAutomationStore } from '../src/services/rhChainAutomationService';

const keys = ['NODE_ENV', 'RH_CHAIN_AUTOMATION_ENABLED', 'RH_CHAIN_REVIEW_CONSOLE_ENABLED', 'RH_CHAIN_REVIEW_ADMIN_TOKEN'] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));
afterEach(() => { for (const key of keys) { const value = original.get(key); if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

async function setup() {
  process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_AUTOMATION_ENABLED = 'true'; process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
  const app = await createApp(undefined, undefined, { rhChainAutomationStore: new InMemoryRhChainAutomationStore() });
  const headers = { authorization: 'Bearer review-secret', 'x-rh-chain-reviewer-id': 'reviewer-1' };
  for (const job of ['rh_chain_pulse_refresh', 'rh_meme_pulse_refresh', 'rh_launchpad_observatory_refresh', 'rh_daily_receipt_draft']) {
    const response = await app.inject({ method: 'POST', url: `/internal/rh-chain/jobs/${job}/run`, headers });
    expect(response.statusCode).toBe(200);
  }
  const list = await app.inject({ method: 'GET', url: '/internal/rh-chain/daily-receipt-drafts', headers });
  const draft = list.json().data.drafts[0];
  return { app, headers, draft };
}

describe('RH Chain Daily Receipt Draft Engine', () => {
  it('keeps the Review Pipeline #007 receipt internal until a reviewer publishes it', async () => {
    const { app, headers } = await setup();
    try {
      const created = await app.inject({ method: 'POST', url: '/internal/rh-chain/review-cycle-receipt-drafts', headers, payload: { day: '2026-07-19' } });
      expect(created.statusCode).toBe(200);
      expect(created.json().data).toEqual(expect.objectContaining({ publication_status: 'unpublished', public_surface_unchanged: true, draft: expect.objectContaining({ suggested_receipt_id: 'rh_daily_007', status: 'under_review', review_cycle_summary: expect.any(Object), review_cycle_receipt: expect.objectContaining({ headline: '4663 begins converting RH Chain discovery flow into reviewed market memory' }) }) }));
      const feed = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts' });
      const detail = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts/rh_daily_007' });
      const relay = await app.inject({ method: 'GET', url: '/v1/rh-chain/receipt-relay' });
      expect(feed.json().data.latest_receipt.receipt_id).toBe('rh_daily_006');
      expect(detail.statusCode).toBe(404);
      expect(relay.json().data.packets.some((packet: { title: string }) => packet.title === 'Daily Receipt #007')).toBe(false);
    } finally { await app.close(); }
  });

  it('generates an internal draft from latest snapshot sources with visible missing evidence', async () => {
    const { app, headers, draft } = await setup();
    try {
      expect(draft.generated_from_sources).toEqual(expect.arrayContaining(['Chain Pulse', 'Meme Pulse', 'Launchpad Observatory', 'Clone Radar', 'Token Dossiers', 'Review Queue', 'Live Snapshot']));
      expect(draft.status).toBe('draft_generated');
      expect(draft.missing_evidence.length).toBeGreaterThan(0);
      const detail = await app.inject({ method: 'GET', url: `/internal/rh-chain/daily-receipt-drafts/${draft.draft_id}`, headers });
      expect(detail.json().data.draft.missing_evidence).toEqual(draft.missing_evidence);
    } finally { await app.close(); }
  });

  it('cannot publish a draft without Review Console auth', async () => {
    const { app, draft } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: `/internal/rh-chain/daily-receipt-drafts/${draft.draft_id}/publish` });
      expect(response.statusCode).toBe(401);
    } finally { await app.close(); }
  });

  it('does not auto-publish, then makes the reviewer-published receipt the public latest record', async () => {
    const { app, headers, draft } = await setup();
    try {
      const before = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts' });
      expect(before.json().data.latest_receipt.receipt_id).not.toBe(draft.suggested_receipt_id);
      const published = await app.inject({ method: 'POST', url: `/internal/rh-chain/daily-receipt-drafts/${draft.draft_id}/publish`, headers, payload: { reviewer_edits: { suggested_infopunks_verdict: 'Reviewer-published, source-limited receipt memory.' } } });
      expect(published.statusCode).toBe(200);
      expect(published.json().data.detail_route).toContain(draft.suggested_receipt_id);
      expect(published.json().data.share_card_route).toContain('/card');
      const feed = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts' });
      expect(feed.json().data.latest_receipt.receipt_id).toBe(draft.suggested_receipt_id);
      const detail = await app.inject({ method: 'GET', url: `/v1/rh-chain/daily-receipts/${draft.suggested_receipt_id}` });
      expect(detail.statusCode).toBe(200);
      const distribution = await app.inject({ method: 'GET', url: '/v1/rh-chain/distribution-pack' });
      expect(distribution.json().data.packets.find((packet: { id: string }) => packet.id === 'daily-receipt').link).toContain(draft.suggested_receipt_id);
    } finally { await app.close(); }
  });

  it('keeps rejected drafts internal and never exposes them publicly', async () => {
    const { app, headers, draft } = await setup();
    try {
      const rejected = await app.inject({ method: 'POST', url: `/internal/rh-chain/daily-receipt-drafts/${draft.draft_id}/reject`, headers });
      expect(rejected.statusCode).toBe(200);
      expect(rejected.json().data.draft.status).toBe('rejected');
      const publicLookup = await app.inject({ method: 'GET', url: `/v1/rh-chain/daily-receipts/${draft.suggested_receipt_id}` });
      expect(publicLookup.statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
