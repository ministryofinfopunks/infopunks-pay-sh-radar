import type pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import {
  InMemoryRhChainReviewedClassificationStore,
  PostgresRhChainReviewedClassificationStore,
  RhChainClassificationError,
  RhChainReviewedClassificationService
} from '../src/services/rhChainReviewedClassificationService';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const SECOND_CONTRACT = '0x2222222222222222222222222222222222222222';
const NOW = new Date('2026-07-19T12:00:00.000Z');
const evidence = (id = 'primary-1') => ({ evidence_id: id, kind: 'primary_source' as const, source_name: 'Project documentation', source_url: 'https://example.com/source', summary: 'Primary documentation supports the reviewed layer classification.', observed_at: NOW.toISOString(), content_hash: null });
const proposal = (contract = CONTRACT, overrides: Record<string, unknown> = {}) => ({ chain: 'robinhood', contract, primary_layer: 'infrastructure', secondary_layers: ['agent'], confidence: 'medium', classification_evidence: [evidence()], review_status: 'proposed', source: 'internal_research', manual_override_reason: null, audit_note: 'Created from exact-contract primary-source review.', ...overrides });

function service(store = new InMemoryRhChainReviewedClassificationStore()) {
  let id = 0;
  return new RhChainReviewedClassificationService(store, { now: () => NOW, id: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` });
}

describe('durable RH Chain reviewed classifications', () => {
  it('stores exact-contract proposals and immutable reviewer audit history in memory', async () => {
    const reviewed = service();
    const created = await reviewed.propose(proposal(), 'desk-reviewer');
    expect(created.classification).toMatchObject({ chain: 'robinhood', contract: CONTRACT, review_status: 'proposed', classification_version: 1, reviewer_audit: { last_reviewer_id: 'desk-reviewer', last_action: 'proposed' } });
    const audit = await reviewed.audit({ contract: CONTRACT }, {});
    expect(audit.items).toHaveLength(1);
    expect(audit.items[0]).toMatchObject({ action: 'proposed', from_status: null, to_status: 'proposed', reviewer_id: 'desk-reviewer' });
  });

  it('approves only valid review states with evidence and increments classification version', async () => {
    const reviewed = service();
    await reviewed.propose(proposal(), 'proposer');
    const approved = await reviewed.approve({ contract: CONTRACT }, { expected_version: 1, audit_note: 'Primary evidence verified and approved.', confidence: 'high' }, 'approver');
    expect(approved.classification).toMatchObject({ review_status: 'approved', classification_version: 2, confidence: 'high', effective_at: NOW.toISOString(), superseded_at: null });
    expect((await reviewed.listApproved({})).classifications).toEqual([expect.objectContaining({ contract: CONTRACT, review_status: 'approved' })]);
  });

  it('accepts the reviewed Cross-Layer vocabulary without treating AI narrative as an agent layer', async () => {
    const reviewed = service();
    const created = await reviewed.propose(proposal(CONTRACT, { primary_layer: 'consumer', secondary_layers: ['payments', 'ai-narrative'] }), 'desk-reviewer');
    expect(created.classification).toMatchObject({ primary_layer: 'consumer', secondary_layers: ['payments', 'ai-narrative'], review_status: 'proposed' });
    expect(created.classification.secondary_layers).not.toContain('agent');
  });

  it('rejects invalid transitions and stale optimistic-concurrency writes', async () => {
    const reviewed = service();
    await reviewed.propose(proposal(), 'proposer');
    await reviewed.approve({ contract: CONTRACT }, { expected_version: 1, audit_note: 'Approved.' }, 'approver');
    await expect(reviewed.reject({ contract: CONTRACT }, { expected_version: 2, audit_note: 'Reject.', reason: 'Too late.' }, 'reviewer')).rejects.toMatchObject({ code: 'rh_chain_classification_invalid_transition' });
    await expect(reviewed.supersede({ contract: CONTRACT }, { expected_version: 1, audit_note: 'Supersede.', reason: 'Stale client.' }, 'reviewer')).rejects.toMatchObject({ code: 'rh_chain_classification_conflict', current: expect.objectContaining({ classification_version: 2 }) });
  });

  it('supersedes approved classifications and removes them from the active public view', async () => {
    const reviewed = service();
    await reviewed.propose(proposal(), 'proposer');
    await reviewed.approve({ contract: CONTRACT }, { expected_version: 1, audit_note: 'Approved.' }, 'approver');
    const superseded = await reviewed.supersede({ contract: CONTRACT }, { expected_version: 2, audit_note: 'Superseded after corrected primary evidence.', reason: 'Classification needs a replacement review.' }, 'senior-reviewer');
    expect(superseded.classification).toMatchObject({ review_status: 'superseded', classification_version: 3, superseded_at: NOW.toISOString() });
    expect((await reviewed.listApproved({})).classifications).toEqual([]);
    expect((await reviewed.audit({ contract: CONTRACT }, {})).items.map((event) => event.action)).toEqual(['superseded', 'approved', 'proposed']);
  });

  it('keeps provider observations proposal-only until an authenticated human review action occurs', async () => {
    const reviewed = service();
    const proposed = await reviewed.propose(proposal(CONTRACT, { source: 'provider_observation', review_status: 'source_required', classification_evidence: [] }), 'provider-intake-reviewer');
    expect(proposed.classification).toMatchObject({ source: 'provider_observation', review_status: 'source_required', effective_at: null });
    expect((await reviewed.listApproved({})).classifications).toEqual([]);
  });

  it('validates exact identity and bounds pagination', async () => {
    const reviewed = service();
    await expect(reviewed.propose(proposal('0xnot-an-exact-contract'), 'reviewer')).rejects.toBeDefined();
    await reviewed.propose(proposal(CONTRACT), 'reviewer');
    await reviewed.propose(proposal(SECOND_CONTRACT, { classification_evidence: [evidence('primary-2')] }), 'reviewer');
    const first = await reviewed.list({ page: 1, page_size: 1 });
    expect(first).toMatchObject({ page: 1, page_size: 1, has_more: true });
    expect(first.items).toHaveLength(1);
    await expect(reviewed.list({ page: 1, page_size: 101 })).rejects.toBeDefined();
  });

  it('normalizes exact contract identity instead of ticker or address casing', async () => {
    const reviewed = service();
    const uppercase = `0x${'AB'.repeat(20)}`;
    const lowercase = uppercase.toLowerCase();
    const created = await reviewed.propose(proposal(uppercase), 'reviewer');
    expect(created.classification.contract).toBe(lowercase);
    expect((await reviewed.get({ contract: uppercase })).classification.contract).toBe(lowercase);
    await expect(reviewed.propose(proposal(lowercase), 'reviewer')).rejects.toMatchObject({ code: 'rh_chain_classification_invalid_transition' });
  });

  it('fails closed on malformed Postgres payloads', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ payload: { chain: 'robinhood', contract: CONTRACT, review_status: 'approved' } }], rowCount: 1 }), end: vi.fn() } as unknown as pg.Pool;
    const store = new PostgresRhChainReviewedClassificationStore(pool);
    await expect(store.get(CONTRACT)).rejects.toBeInstanceOf(RhChainClassificationError);
    await expect(store.get(CONTRACT)).rejects.toMatchObject({ code: 'rh_chain_classification_stored_payload_invalid' });
  });

  it('retries Postgres reads on the next request and never runs migration DDL automatically', async () => {
    const failure = Object.assign(new Error('temporary connection failure'), { code: '08006' });
    const query = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const pool = { query, end: vi.fn() } as unknown as pg.Pool;
    const store = new PostgresRhChainReviewedClassificationStore(pool);
    await expect(store.list({ page: 1, page_size: 25 })).rejects.toThrow('temporary connection failure');
    await expect(store.list({ page: 1, page_size: 25 })).resolves.toEqual({ items: [], page: 1, page_size: 25, has_more: false });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.map(([sql]) => String(sql)).join(' ')).not.toMatch(/create table|alter table/i);
  });
});

const savedEnv = {
  classifications: process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED,
  console: process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED,
  token: process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN
};
afterEach(() => {
  for (const [key, value] of Object.entries({ RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: savedEnv.classifications, RH_CHAIN_REVIEW_CONSOLE_ENABLED: savedEnv.console, RH_CHAIN_REVIEW_ADMIN_TOKEN: savedEnv.token })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe('reviewed classification APIs', () => {
  const authorized = { authorization: 'Bearer review-secret', 'x-rh-chain-reviewer-id': 'desk-reviewer' };
  function enable() { process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED = 'true'; process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret'; }

  it('is feature-flagged off by default for internal and public reads', async () => {
    delete process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED;
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: new InMemoryRhChainReviewedClassificationStore() });
    try {
      expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/classifications', headers: authorized })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/v1/rh-chain/classifications' })).statusCode).toBe(404);
    } finally { await app.close(); }
  });

  it('requires Review Console authentication and reviewer identity for authoritative writes', async () => {
    enable(); const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: new InMemoryRhChainReviewedClassificationStore() });
    try {
      expect((await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', payload: proposal() })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', headers: { authorization: 'Bearer wrong' }, payload: proposal() })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', headers: { authorization: 'Bearer review-secret' }, payload: proposal() })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('supports propose, get, approve, list, public approved reads, and audit inspection', async () => {
    enable(); const store = new InMemoryRhChainReviewedClassificationStore(); const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: store });
    try {
      const proposed = await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', headers: authorized, payload: proposal() });
      expect(proposed.statusCode).toBe(200);
      expect(proposed.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ classification: expect.objectContaining({ contract: CONTRACT, review_status: 'proposed', classification_version: 1 }) }), meta: expect.any(Object) }));
      expect((await app.inject({ method: 'GET', url: `/internal/rh-chain/classifications/${CONTRACT}`, headers: authorized })).statusCode).toBe(200);
      const approved = await app.inject({ method: 'POST', url: `/internal/rh-chain/classifications/${CONTRACT}/approve`, headers: authorized, payload: { expected_version: 1, audit_note: 'Primary evidence approved.' } });
      expect(approved.statusCode).toBe(200);
      expect(approved.json().data.classification).toMatchObject({ review_status: 'approved', classification_version: 2 });
      const internalList = await app.inject({ method: 'GET', url: '/internal/rh-chain/classifications?page=1&page_size=1&status=approved', headers: authorized });
      expect(internalList.statusCode).toBe(200); expect(internalList.json().data.items).toHaveLength(1);
      const publicList = await app.inject({ method: 'GET', url: '/v1/rh-chain/classifications?page_size=1' });
      expect(publicList.statusCode).toBe(200); expect(publicList.json().data.classifications).toHaveLength(1);
      expect(publicList.body).not.toContain('desk-reviewer'); expect(publicList.body).not.toContain('manual_override_reason');
      const audit = await app.inject({ method: 'GET', url: `/internal/rh-chain/classifications/${CONTRACT}/audit?page_size=1`, headers: authorized });
      expect(audit.statusCode).toBe(200); expect(audit.json().data).toMatchObject({ page_size: 1, has_more: true });
    } finally { await app.close(); }
  });

  it('returns safe validation, transition, and optimistic-concurrency errors', async () => {
    enable(); const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: new InMemoryRhChainReviewedClassificationStore() });
    try {
      expect((await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', headers: authorized, payload: proposal('ticker-not-contract') })).statusCode).toBe(400);
      await app.inject({ method: 'POST', url: '/internal/rh-chain/classifications', headers: authorized, payload: proposal() });
      const stale = await app.inject({ method: 'POST', url: `/internal/rh-chain/classifications/${CONTRACT}/approve`, headers: authorized, payload: { expected_version: 9, audit_note: 'Stale approval.' } });
      expect(stale.statusCode).toBe(409); expect(stale.json()).toEqual(expect.objectContaining({ error: 'rh_chain_classification_conflict', current: expect.objectContaining({ classification_version: 1 }) }));
      const malformedPaging = await app.inject({ method: 'GET', url: '/internal/rh-chain/classifications?page_size=1000', headers: authorized });
      expect(malformedPaging.statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('leaves public Discovery Queue and Review Pipeline mutations non-authoritative and preserves Market Pulse and Live Snapshot', async () => {
    enable(); const store = new InMemoryRhChainReviewedClassificationStore(); const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: store });
    try {
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/review-pipeline/start-daily-review', payload: {} })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: `/v1/rh-chain/discovery-queue/${CONTRACT}/promote`, payload: { target: 'market_structure' } })).statusCode).toBe(404);
      expect((await store.list({ page: 1, page_size: 25 })).items).toEqual([]);
      expect((await app.inject({ method: 'GET', url: '/v1/rh-chain/market' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/v1/rh-chain/live-snapshot' })).statusCode).toBe(200);
    } finally { await app.close(); }
  });
});
