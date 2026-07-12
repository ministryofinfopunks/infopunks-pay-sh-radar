import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRhChainSubmissionStore, createRhChainSignalSubmission } from '../src/services/rhChainSignalVault';
import { assembleRhChainScouts } from '../src/services/rhChainScoutsService';

describe('RH Chain Signal Scouts', () => {
  it('only publishes handles with explicit attribution consent', () => {
    const consented = createRhChainSignalSubmission({ token_contract: '0xscout', ticker: 'scout', liquidity_link: 'https://example.com/pair', scout_handle: '@receiptcat', scout_contact: 'private@example.com', public_attribution_consent: true, disclosure_confirmed: true }, '2026-07-12T00:00:00.000Z', 'community_submission');
    const privateSubmission = createRhChainSignalSubmission({ token_contract: '0xprivate', ticker: 'priv', liquidity_link: 'https://example.com/pair', scout_handle: '@privatecat', scout_contact: 'hidden@example.com', public_attribution_consent: false, disclosure_confirmed: true }, '2026-07-12T01:00:00.000Z', 'community_submission');
    const payload = assembleRhChainScouts([consented, privateSubmission]);
    expect(payload.scouts).toHaveLength(1);
    expect(payload.scouts[0]).toEqual(expect.objectContaining({ display_handle: '@receiptcat', reputation_label: 'receipt_hunter' }));
    expect(JSON.stringify(payload)).not.toContain('private@example.com');
    expect(JSON.stringify(payload)).not.toContain('hidden@example.com');
  });

  it('validates attribution consent and redacts submitted contact information', async () => {
    const store = new InMemoryRhChainSubmissionStore();
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: store });
    try {
      const invalid = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { token_contract: '0x1', ticker: 'ONE', liquidity_link: 'https://example.com', public_attribution_consent: true, disclosure_confirmed: true } });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().issues[0].message).toBe('scout_handle_required_for_public_attribution');
      const valid = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { token_contract: '0x2', ticker: 'TWO', liquidity_link: 'https://example.com', scout_handle: '@two', scout_contact: 'two@example.com', public_attribution_consent: true, disclosure_confirmed: true } });
      expect(valid.statusCode).toBe(200);
      expect(JSON.stringify(valid.json())).not.toContain('two@example.com');
    } finally { await app.close(); }
  });

  it('serves a public Scout Board with no private contact fields', async () => {
    const store = new InMemoryRhChainSubmissionStore();
    await store.save(createRhChainSignalSubmission({ token_contract: '0x3', ticker: 'THREE', liquidity_link: 'https://example.com', scout_handle: '@three', scout_contact: 'three@example.com', public_attribution_consent: true, disclosure_confirmed: true }, '2026-07-12T00:00:00.000Z', 'community_submission'));
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: store });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/scouts' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({ title: 'Signal Scouts', scouts: [expect.objectContaining({ display_handle: '@three' })] }));
      expect(JSON.stringify(response.json())).not.toContain('three@example.com');
      const submissions = await app.inject({ method: 'GET', url: '/v1/rh-chain/signals/submissions' });
      expect(JSON.stringify(submissions.json())).not.toContain('three@example.com');
    } finally { await app.close(); }
  });
});
