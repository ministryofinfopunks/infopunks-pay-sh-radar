import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { createRhChainDailyReceipt, createRhChainDailyReceiptXPost, getRhChainDailyReceipts, rhChainDailyReceiptRoute, rhChainDailyReceiptShareCardRoute, selectLatestRhChainDailyReceipt, validateRhChainDailyReceipt } from '../src/data/rhChain';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('RH Chain Daily Receipt Ops Kit', () => {
  it('validates authoring requirements, including all six structured sections', () => {
    const receipt = structuredClone(getRhChainDailyReceipts().latest_receipt);
    expect(validateRhChainDailyReceipt(receipt)).toEqual({ valid: true, errors: [] });
    const invalid = { ...receipt, source_notes: '', receipt_sections: receipt.receipt_sections?.filter((section) => section.section_id !== 'risk_wall') };
    expect(validateRhChainDailyReceipt(invalid)).toEqual(expect.objectContaining({ valid: false, errors: expect.arrayContaining(['missing_source_notes', 'missing_section_risk_wall']) }));
    expect(() => createRhChainDailyReceipt(invalid as never)).toThrow('invalid_rh_chain_daily_receipt');
  });

  it('selects the latest receipt and generates known detail and share-card routes', () => {
    const feed = getRhChainDailyReceipts();
    const latest = selectLatestRhChainDailyReceipt(feed.receipts);
    expect(latest?.receipt_id).toBe(feed.latest_receipt.receipt_id);
    expect(rhChainDailyReceiptRoute(feed.receipts[1].receipt_id, feed.receipts)).toBe(`/rh-chain-signal-desk/daily-receipts/${feed.receipts[1].receipt_id}`);
    expect(rhChainDailyReceiptRoute('unknown', feed.receipts)).toBeNull();
    expect(rhChainDailyReceiptShareCardRoute(feed.receipts[1].receipt_id)).toBe(`/rh-chain-signal-desk/daily-receipts/${feed.receipts[1].receipt_id}/card`);
  });

  it('builds field-driven X copy for any receipt', () => {
    const receipt = getRhChainDailyReceipts().receipts[1];
    const post = createRhChainDailyReceiptXPost(receipt);
    expect(post).toContain(receipt.headline);
    expect(post).toContain(receipt.top_signal);
    expect(post).toContain(receipt.infopunks_verdict);
  });

  it('serves known receipt detail and returns a clean API not-found response', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const known = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts/rh_daily_001' });
    const missing = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts/not-real' });
    expect(known.statusCode).toBe(200);
    expect(known.json()).toEqual(expect.objectContaining({ disclaimer: expect.any(String), data: expect.objectContaining({ receipt_id: 'rh_daily_001' }) }));
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'rh_chain_daily_receipt_not_found' });
    await app.close();
  });
});
