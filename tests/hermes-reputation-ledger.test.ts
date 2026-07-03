import { describe, expect, it } from 'vitest';
import type { HermesDecisionState, HermesRun } from '../src/data/hermesDesk';
import {
  buildHermesReputationLedger,
  buildHermesReputationLedgerFromRuns,
  getHermesReputationEntry,
  listHermesProviderReputationEntries,
  listHermesRouteReputationEntries
} from '../src/services/hermesReputationLedger';

function runFixture(decision: HermesDecisionState, confidence: number, extra: Record<string, unknown> = {}): HermesRun {
  return {
    id: `hermes_${decision}_${confidence}_fixture`,
    title: `${decision} fixture`,
    objective: 'Aggregate reputation impact.',
    state: 'completed',
    decision,
    confidence,
    summary: 'Hermes produced reputation-impact metadata.',
    risk_factors: [],
    artifacts: [
      {
        artifact_id: `artifact_${decision}_${confidence}`,
        label: `${decision} artifact`,
        type: 'receipt',
        summary: 'Evidence artifact.',
        uri: '/receipts/receipt_001'
      }
    ],
    linked_receipt_id: null,
    linked_claim_id: null,
    linked_loop_id: null,
    created_at: '2026-07-03T00:00:00.000Z',
    completed_at: '2026-07-03T00:01:00.000Z',
    ...extra
  };
}

describe('Hermes Reputation Ledger', () => {
  it('builds deterministic entries from seeded Hermes runs', () => {
    const first = buildHermesReputationLedger();
    const second = buildHermesReputationLedger();

    expect(first).toEqual(second);
    expect(first.generated_at).toBe('2026-07-03T00:00:00.000Z');
    expect(first.entry_count).toBeGreaterThanOrEqual(3);
    expect(first.entries.map((entry) => entry.target_type)).toEqual(expect.arrayContaining(['provider', 'route', 'service']));
  });

  it('groups provider entries correctly', () => {
    const entries = listHermesProviderReputationEntries();

    expect(entries.map((entry) => entry.target_id)).toContain('provider_pay_sh_lattice');
    expect(entries.find((entry) => entry.target_id === 'provider_pay_sh_lattice')).toEqual(expect.objectContaining({
      target_type: 'provider',
      negative_count: 1
    }));
  });

  it('groups route entries correctly', () => {
    const entries = listHermesRouteReputationEntries();

    expect(entries.map((entry) => entry.target_id)).toContain('route_pay_sh_market_research_01');
    expect(entries.find((entry) => entry.target_id === 'route_pay_sh_market_research_01')).toEqual(expect.objectContaining({
      target_type: 'route',
      watch_count: 1
    }));
  });

  it('clamps trust scores between 0 and 100', () => {
    const ledger = buildHermesReputationLedgerFromRuns([
      runFixture('trust', 100, { provider_id: 'provider_alpha' }),
      runFixture('do_not_use_yet', 100, { provider_id: 'provider_beta' })
    ]);

    expect(ledger.entries.map((entry) => entry.trust_score)).toEqual(expect.arrayContaining([100, 0]));
    expect(ledger.entries.every((entry) => entry.trust_score >= 0 && entry.trust_score <= 100)).toBe(true);
  });

  it('increases score for positive impacts and decreases score for negative impacts', () => {
    const ledger = buildHermesReputationLedgerFromRuns([
      runFixture('trust', 80, { provider_id: 'provider_positive' }),
      runFixture('do_not_use_yet', 80, { provider_id: 'provider_negative' })
    ]);

    expect(ledger.entries.find((entry) => entry.target_id === 'provider_positive')?.trust_score).toBe(90);
    expect(ledger.entries.find((entry) => entry.target_id === 'provider_negative')?.trust_score).toBe(10);
  });

  it('maps watch impacts to watchlist behavior', () => {
    const ledger = buildHermesReputationLedgerFromRuns([
      runFixture('caution', 80, { route_id: 'route_watch' })
    ]);
    const entry = ledger.entries.find((item) => item.target_id === 'route_watch');

    expect(entry).toEqual(expect.objectContaining({
      current_state: 'watchlist',
      watch_count: 1,
      trust_score: 38
    }));
  });

  it('returns matching entries and handles missing targets gracefully', () => {
    expect(getHermesReputationEntry('provider', 'provider_pay_sh_lattice')).toEqual(expect.objectContaining({
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice'
    }));
    expect(getHermesReputationEntry('providers', 'provider_pay_sh_lattice')).toEqual(expect.objectContaining({
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice'
    }));
    expect(getHermesReputationEntry('provider', 'not-real')).toBeUndefined();
    expect(getHermesReputationEntry('not-a-type', 'provider_pay_sh_lattice')).toBeUndefined();
  });
});
