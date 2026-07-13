import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { createRhChainSignalSubmission, InMemoryRhChainSubmissionStore, redactRhChainSubmissionForReview, updateRhChainSubmissionReviewRecord } from '../src/services/rhChainSignalVault';

const savedEnv = { enabled: process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED, token: process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN };
afterEach(() => {
  if (savedEnv.enabled === undefined) delete process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED; else process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = savedEnv.enabled;
  if (savedEnv.token === undefined) delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN; else process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = savedEnv.token;
});

function submission() {
  return createRhChainSignalSubmission({ token_contract: '0xprivate', ticker: 'PRIVATE', liquidity_link: 'https://example.com/pair', scout_handle: '@scout', scout_contact: 'private@example.com', disclosure_confirmed: true }, '2026-07-12T00:00:00.000Z', 'community_submission');
}

describe('RH Chain Review Console', () => {
  it('is disabled by default', async () => {
    delete process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED;
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: new InMemoryRhChainSubmissionStore() });
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/review-console/submissions' })).statusCode).toBe(404);
    await app.close();
  });

  it('updates review state and appends a reviewer audit event', async () => {
    const store = new InMemoryRhChainSubmissionStore();
    const record = submission();
    await store.save(record);
    const updated = await updateRhChainSubmissionReviewRecord(store, record.submission_id, {
      review_status: 'under_receipt_check', reviewer_note: 'Explorer receipt is being checked.', evidence_summary: 'Pair link recorded.', missing_evidence: ['deployer provenance'], risk_state: 'medium_watch', signal_state: 'attention_spike', infopunks_verdict: 'Eligible for desk memory only; not safe or endorsed.', audit_note: 'Moved to receipt review after source-link inspection.'
    });
    expect(updated).toEqual(expect.objectContaining({ review_status: 'under_receipt_check', reviewer_note: 'Explorer receipt is being checked.', risk_state: 'medium_watch' }));
    expect(updated?.audit_events.at(-1)).toEqual(expect.objectContaining({ action: 'review_updated', from_status: 'queued_for_manual_review', to_status: 'under_receipt_check', note: 'Moved to receipt review after source-link inspection.' }));
  });

  it('redacts private Scout contact data', () => {
    const safe = redactRhChainSubmissionForReview(submission());
    expect(safe).not.toHaveProperty('scout_contact');
    expect(JSON.stringify(safe)).not.toContain('private@example.com');
  });

  it('requires the configured reviewer token and redacts console API responses', async () => {
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
    const store = new InMemoryRhChainSubmissionStore();
    await store.save(submission());
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: store });
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/review-console/submissions' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/internal/rh-chain/review-console/submissions', headers: { authorization: 'Bearer review-secret' } });
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).not.toContain('private@example.com');
    await app.close();
  });

  it('fails closed when enabled without a dedicated token, and rejects a wrong token', async () => {
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN;
    let app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: new InMemoryRhChainSubmissionStore() });
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/review-console/submissions' })).statusCode).toBe(404);
    await app.close();

    process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
    app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: new InMemoryRhChainSubmissionStore() });
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/review-console/submissions', headers: { authorization: 'Bearer wrong-token' } })).statusCode).toBe(401);
    await app.close();
  });

  it('records reviewer identity and rejects stale review writes', async () => {
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
    const store = new InMemoryRhChainSubmissionStore();
    const record = submission(); await store.save(record);
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: store });
    const headers = { authorization: 'Bearer review-secret', 'x-rh-chain-reviewer-id': 'desk-operator' };
    const first = await app.inject({ method: 'PATCH', url: `/internal/rh-chain/review-console/submissions/${record.submission_id}`, headers, payload: { review_status: 'under_receipt_check', audit_note: 'Started receipt inspection.', last_seen_updated_at: record.updated_at } });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.submission.audit_events.at(-1)).toEqual(expect.objectContaining({ reviewer_id: 'desk-operator' }));
    const stale = await app.inject({ method: 'PATCH', url: `/internal/rh-chain/review-console/submissions/${record.submission_id}`, headers, payload: { review_status: 'watch_only', audit_note: 'Stale overwrite.', last_seen_updated_at: record.updated_at } });
    expect(stale.statusCode).toBe(409);
    await app.close();
  });
});
