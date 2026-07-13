import { describe, expect, it } from 'vitest';
import { getRhChain4663Index, getRhChainDailyReceipts } from '../src/data/rhChain';
import { getRhChainFreshnessState, isRhChainIdentityContract } from '../src/services/rhChainTruthGuards';

describe('RH Chain truth guards', () => {
  it('recognizes only non-placeholder contracts as identity values', () => {
    for (const marker of ['unverified_contract_required', 'source_required', 'contract_required', 'unknown', 'TBD', '', ' undefined ', '0xmanualresearchseed000000000000000000000000', '0xexample', '0x0000000000000000000000000000000000000000']) expect(isRhChainIdentityContract(marker)).toBe(false);
    expect(isRhChainIdentityContract('0xAbC123')).toBe(true);
  });

  it('classifies manual receipt freshness against the published SLA', () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    expect(getRhChainFreshnessState('2026-07-13T01:00:00.000Z', 'manual', now)).toBe('fresh');
    expect(getRhChainFreshnessState('2026-07-11T12:00:00.000Z', 'manual', now)).toBe('aging');
    expect(getRhChainFreshnessState('2026-07-09T00:00:00.000Z', 'manual', now)).toBe('stale');
  });

  it('exposes freshness state on manual receipt and index payloads', () => {
    expect(getRhChainDailyReceipts().latest_receipt.freshness_state).toBeDefined();
    expect(getRhChain4663Index().freshness_state).toBeDefined();
  });
});
