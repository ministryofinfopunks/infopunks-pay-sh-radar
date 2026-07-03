import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HermesReputationLedgerEntry, HermesReputationLedgerSummary, HermesReputationState } from '../src/services/hermesReputationLedger';
import * as reputationLedger from '../src/services/hermesReputationLedger';
import { createHermesPreSpendDecision } from '../src/services/hermesPreSpendDecision';

function entryFixture(
  targetType: HermesReputationLedgerEntry['target_type'],
  targetId: string,
  currentState: HermesReputationState,
  trustScore: number,
  extra: Partial<HermesReputationLedgerEntry> = {}
): HermesReputationLedgerEntry {
  return {
    target_type: targetType,
    target_id: targetId,
    label: `${targetType}:${targetId}`,
    current_state: currentState,
    trust_score: trustScore,
    impact_total: 0,
    positive_count: currentState === 'trusted' ? 1 : 0,
    negative_count: currentState === 'degraded' ? 1 : 0,
    watch_count: currentState === 'watchlist' ? 1 : 0,
    neutral_count: currentState === 'unproven' ? 1 : 0,
    disputed_count: currentState === 'disputed' ? 1 : 0,
    latest_event_at: '2026-07-03T00:00:00.000Z',
    decision_history: [],
    source_claim_ids: [],
    source_receipt_ids: [],
    source_run_ids: [],
    ...extra
  };
}

function summaryFixture(entries: HermesReputationLedgerEntry[]): HermesReputationLedgerSummary {
  return {
    generated_at: '2026-07-03T00:00:00.000Z',
    entry_count: entries.length,
    provider_count: entries.filter((entry) => entry.target_type === 'provider').length,
    route_count: entries.filter((entry) => entry.target_type === 'route').length,
    service_count: entries.filter((entry) => entry.target_type === 'service').length,
    unknown_count: entries.filter((entry) => entry.target_type === 'unknown').length,
    trusted_count: entries.filter((entry) => entry.current_state === 'trusted').length,
    watchlist_count: entries.filter((entry) => entry.current_state === 'watchlist').length,
    degraded_count: entries.filter((entry) => entry.current_state === 'degraded').length,
    disputed_count: entries.filter((entry) => entry.current_state === 'disputed').length,
    entries
  };
}

function withEntries(entries: HermesReputationLedgerEntry[]) {
  const summary = summaryFixture(entries);
  vi.spyOn(reputationLedger, 'buildHermesReputationLedger').mockReturnValue(summary);
  vi.spyOn(reputationLedger, 'getHermesReputationEntry').mockImplementation((targetType: string, targetId?: string) => {
    return entries.find((entry) => entry.target_type === targetType && entry.target_id === targetId);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hermes pre-spend decision engine', () => {
  it('returns insufficient evidence when no matching reputation entries exist', () => {
    withEntries([]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_unknown',
      route_id: 'route_unknown',
      service_id: 'service_unknown'
    });

    expect(decision.decision).toBe('insufficient_evidence');
    expect(decision.required_action).toBe('request_more_evidence');
    expect(decision.confidence).toBe(0.35);
  });

  it('returns proceed for trusted provider and route coverage', () => {
    withEntries([
      entryFixture('provider', 'provider_trusted', 'trusted', 92),
      entryFixture('route', 'route_trusted', 'trusted', 89)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_trusted',
      route_id: 'route_trusted',
      amount_usd: 20
    });

    expect(decision.decision).toBe('proceed');
    expect(decision.required_action).toBe('none');
  });

  it('returns cautionary behavior for watchlist provider coverage', () => {
    withEntries([
      entryFixture('provider', 'provider_watch', 'watchlist', 61),
      entryFixture('route', 'route_trusted', 'trusted', 85)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_watch',
      route_id: 'route_trusted',
      amount_usd: 50
    });

    expect(['proceed_with_caution', 'test_spend_first']).toContain(decision.decision);
    expect(decision.required_action).toBe('run_small_test_spend');
  });

  it('returns do_not_spend for degraded provider coverage', () => {
    withEntries([
      entryFixture('provider', 'provider_bad', 'degraded', 18),
      entryFixture('route', 'route_ok', 'trusted', 90)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_bad',
      route_id: 'route_ok'
    });

    expect(decision.decision).toBe('do_not_spend');
    expect(decision.required_action).toBe('do_not_use_provider');
  });

  it('forces manual review for disputed targets', () => {
    withEntries([
      entryFixture('provider', 'provider_disputed', 'disputed', 40)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_disputed'
    });

    expect(decision.required_action).toBe('manual_review_required');
    expect(['do_not_spend', 'test_spend_first']).toContain(decision.decision);
  });

  it('increases caution for higher spend amounts', () => {
    withEntries([
      entryFixture('provider', 'provider_trusted', 'trusted', 80)
    ]);

    const lowAmount = createHermesPreSpendDecision({
      provider_id: 'provider_trusted',
      amount_usd: 20
    });
    const highAmount = createHermesPreSpendDecision({
      provider_id: 'provider_trusted',
      amount_usd: 150
    });

    expect(lowAmount.decision).toBe('proceed_with_caution');
    expect(highAmount.decision).toBe('test_spend_first');
  });

  it('prefers test_spend_first for small watchlist spends', () => {
    withEntries([
      entryFixture('provider', 'provider_watch', 'watchlist', 60),
      entryFixture('route', 'route_watch', 'watchlist', 58)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_watch',
      route_id: 'route_watch',
      amount_usd: 25
    });

    expect(decision.decision).toBe('test_spend_first');
    expect(decision.required_action).toBe('run_small_test_spend');
  });

  it('keeps confidence between 0 and 1', () => {
    withEntries([
      entryFixture('provider', 'provider_high', 'trusted', 100),
      entryFixture('route', 'route_high', 'trusted', 100),
      entryFixture('service', 'service_high', 'trusted', 100)
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_high',
      route_id: 'route_high',
      service_id: 'service_high'
    });

    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  it('includes source receipts, claims, and runs from matching ledger entries', () => {
    withEntries([
      entryFixture('provider', 'provider_refs', 'trusted', 88, {
        source_receipt_ids: ['receipt_123'],
        source_claim_ids: ['claim_123'],
        source_run_ids: ['run_123']
      })
    ]);

    const decision = createHermesPreSpendDecision({
      provider_id: 'provider_refs'
    });

    expect(decision.receipt_inputs.map((item) => item.id)).toContain('receipt_123');
    expect(decision.claim_inputs.map((item) => item.id)).toContain('claim_123');
    expect(decision.run_inputs.map((item) => item.id)).toContain('run_123');
  });
});
