import { describe, expect, it } from 'vitest';
import { getRhChainDailyReceipt, getRhChainDailyReceipts, validateRhChainDailyReceipt } from '../src/data/rhChain';
import { createRhChainAgenticMarketStructureReceipt } from '../src/services/rhChainDailyReceiptDraftService';
import { queryRhChainScout } from '../src/services/rhChainScoutService';
import { buildRhChainDailyReceiptShare } from '../src/services/rhChainShareService';

describe('RH Chain Agentic Daily Receipt fixture isolation', () => {
  it('creates a fresh, valid #008 receipt on every call', () => {
    const first = createRhChainAgenticMarketStructureReceipt('2026-07-20T12:00:00.000Z');
    const firstLaunchpad = first.receipt_sections?.find((section) => section.section_id === 'launchpad_stress_test');
    expect(firstLaunchpad).toBeDefined();
    firstLaunchpad!.summary = 'mutated by a caller';
    first.sources[0].note = 'mutated by a caller';

    const second = createRhChainAgenticMarketStructureReceipt('2026-07-20T12:00:00.000Z');
    expect(validateRhChainDailyReceipt(second)).toEqual({ valid: true, errors: [] });
    expect(second.receipt_sections?.find((section) => section.section_id === 'launchpad_stress_test')?.summary).toContain('Launchpads, direct pools, and tooling');
    expect(second.sources[0].note).toContain('Primary product page');
  });

  it('returns detached Daily Receipt snapshots, including nested source and section data', () => {
    const first = getRhChainDailyReceipts();
    first.latest_receipt.headline = 'mutated public snapshot';
    first.latest_receipt.sources[0].note = 'mutated nested source';
    const firstSection = first.latest_receipt.receipt_sections?.[0];
    expect(firstSection).toBeDefined();
    firstSection!.summary = 'mutated nested section';

    const second = getRhChainDailyReceipts();
    expect(second.latest_receipt.headline).not.toBe('mutated public snapshot');
    expect(second.latest_receipt.sources[0].note).not.toBe('mutated nested source');
    expect(second.latest_receipt.receipt_sections?.[0].summary).not.toBe('mutated nested section');
    expect(getRhChainDailyReceipt(second.latest_receipt.receipt_id)?.headline).toBe(second.latest_receipt.headline);
  });

  it('keeps concurrent Scout reads on the canonical published receipt after fixture consumers mutate their own snapshots', async () => {
    const snapshot = getRhChainDailyReceipts();
    snapshot.latest_receipt.receipt_id = 'mutated-receipt-id';
    const results = await Promise.all(Array.from({ length: 32 }, () => Promise.resolve(queryRhChainScout({ query: 'What does Robinhood Agentic Trading change?' }))));
    expect(results.every((result) => result.supporting_receipts[0]?.receipt_id === 'rh_daily_006')).toBe(true);
    expect(results.every((result) => result.answer.includes('not proof of RH Chain agent adoption'))).toBe(true);
  });

  it('does not let a sharing projection mutate the source Daily Receipt', () => {
    const receipt = getRhChainDailyReceipts().latest_receipt;
    const originalHeadline = receipt.headline;
    const share = buildRhChainDailyReceiptShare(receipt);
    share.deterministic_headline = 'mutated share projection';
    expect(receipt.headline).toBe(originalHeadline);
    expect(getRhChainDailyReceipts().latest_receipt.headline).toBe(originalHeadline);
  });
});
