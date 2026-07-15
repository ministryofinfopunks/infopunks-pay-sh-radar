import { describe, expect, it } from 'vitest';
import { getRhChainReviewQueue } from '../src/data/rhChain';
import { InMemoryRhChainRiskCorrelationSnapshotStore, RhChainRiskCorrelationSweepService } from '../src/services/rhChainRiskCorrelationSweepService';
import { createRhChainSignalSubmission, InMemoryRhChainSubmissionStore } from '../src/services/rhChainSignalVault';

describe('RH Chain Risk Correlation Sweep', () => {
  it('creates suspected requires-review correlations without mutating review state', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    await vault.save(createRhChainSignalSubmission({ token_contract: '0xaaa', ticker: 'DUP', disclosure_confirmed: true }, '2026-07-15T10:00:00.000Z'));
    await vault.save(createRhChainSignalSubmission({ token_contract: '0xbbb', ticker: 'DUP', disclosure_confirmed: true }, '2026-07-15T10:01:00.000Z'));
    const before = getRhChainReviewQueue();
    const snapshot = await new RhChainRiskCorrelationSweepService(new InMemoryRhChainRiskCorrelationSnapshotStore(), vault, () => new Date('2026-07-15T10:02:00.000Z')).sweep();
    expect(snapshot.suspected_correlations.length).toBeGreaterThan(0);
    expect(snapshot.suspected_correlations.every((item) => item.review_status === 'requires_review')).toBe(true);
    expect(getRhChainReviewQueue()).toEqual(before);
  });

  it('keeps correlation records public-safe and free of trading language', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    const submission = createRhChainSignalSubmission({ token_contract: '0xabc', ticker: 'SAFE', disclosure_confirmed: true, scout_contact: 'private@example.com' }, '2026-07-15T10:00:00.000Z');
    await vault.save(submission);
    const snapshot = await new RhChainRiskCorrelationSweepService(new InMemoryRhChainRiskCorrelationSnapshotStore(), vault).sweep();
    const text = JSON.stringify(snapshot.suspected_correlations);
    expect(text).not.toContain('private@example.com');
    expect(text).not.toMatch(/\b(buy|sell)\b/i);
    expect(snapshot.suspected_correlations.every((item) => item.related_records.every((record) => Object.keys(record).every((key) => ['review_id', 'ticker', 'token_contract', 'review_state'].includes(key))))).toBe(true);
  });

  it('marks an older sweep as aging for the UI banner', async () => {
    const store = new InMemoryRhChainRiskCorrelationSnapshotStore();
    const vault = new InMemoryRhChainSubmissionStore();
    await new RhChainRiskCorrelationSweepService(store, vault, () => new Date('2026-07-15T00:00:00.000Z')).sweep();
    const aged = await new RhChainRiskCorrelationSweepService(store, vault, () => new Date('2026-07-17T00:00:00.000Z')).getLatest();
    expect(aged?.freshness_state).toBe('aging');
  });
});
