import { describe, expect, it } from 'vitest';
import {
  buildUnicornRadarCandidateList,
  buildUnicornRadarRevenueReceipts,
  buildUnicornRadarSummary,
  createUnicornRadarSubmission,
  requestUnicornRadarEvaluation,
  resolveUnicornRadarCandidate
} from '../src/services/unicornRadarService';

const expectedSectors = [
  'AI',
  'RWA',
  'DeFi',
  'DePIN',
  'Consumer',
  'Agent Rails',
  'Payment Infrastructure',
  'Social / Attention Markets',
  'Tokenized Apps'
];

describe('unicorn radar service', () => {
  it('returns seeded candidates across all requested sectors', () => {
    const list = buildUnicornRadarCandidateList();

    expect(list.count).toBeGreaterThanOrEqual(9);
    expect(new Set(list.candidates.map((candidate) => candidate.sector))).toEqual(new Set(expectedSectors));
    expect(list.candidates.every((candidate) => candidate.sample_disclosure.includes('Desk-seeded sample'))).toBe(true);
  });

  it('keeps statuses, verdicts, and score ranges production-shaped', () => {
    const summary = buildUnicornRadarSummary();

    expect(Object.keys(summary.counts.by_status)).toEqual(expect.arrayContaining([
      'unseen_signal',
      'watchlist',
      'high_signal_lowcap',
      'consensus_forming',
      'do_not_touch_yet',
      'infopunks_missed_it',
      'paid_evaluation'
    ]));
    expect(Object.keys(summary.counts.by_verdict)).toEqual(expect.arrayContaining([
      'high_signal_early',
      'interesting_needs_receipts',
      'real_product_weak_attention',
      'strong_attention_weak_proof',
      'do_not_touch_yet',
      'consensus_already_forming',
      'missed_by_infopunks'
    ]));

    for (const candidate of summary.candidates) {
      for (const score of Object.values(candidate.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(candidate.receipts.length).toBeGreaterThan(0);
      expect(candidate.hunter_credit.handle.length).toBeGreaterThan(0);
    }
  });

  it('resolves candidate detail and revenue receipts', () => {
    const candidate = resolveUnicornRadarCandidate('ur_agent_escrow_rails');
    expect(candidate).toEqual(expect.objectContaining({
      project: 'Agent Escrow Rails',
      status: 'high_signal_lowcap',
      verdict: 'high_signal_early'
    }));

    expect(resolveUnicornRadarCandidate('missing')).toBeNull();
    expect(buildUnicornRadarRevenueReceipts()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'urr_revenue_attn_001',
        service: 'paid_evaluation',
        disclosure: expect.stringContaining('not conviction')
      })
    ]));
  });

  it('creates submit and paid evaluation request receipts', () => {
    const submission = createUnicornRadarSubmission({
      project: 'Example Lowcap',
      ticker: 'LOW',
      sector: 'AI',
      thesis: 'Ships before consensus.'
    });
    expect(submission).toEqual(expect.objectContaining({
      status: 'staged_for_review',
      candidate_preview: expect.objectContaining({ project: 'Example Lowcap', sector: 'AI' })
    }));

    const evaluation = requestUnicornRadarEvaluation({
      project: 'Example Lowcap',
      contact: 'founder@example.com'
    });
    expect(evaluation).toEqual(expect.objectContaining({
      status: 'evaluation_requested',
      doctrine: 'Projects can buy evaluation, not conviction.'
    }));
  });
});
