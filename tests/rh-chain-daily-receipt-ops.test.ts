import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { createRhChainDailyReceipt, createRhChainDailyReceiptXPost, getRhChainDailyReceipts, rhChainDailyReceiptRoute, rhChainDailyReceiptShareCardRoute, selectLatestRhChainDailyReceipt, validateRhChainDailyReceipt } from '../src/data/rhChain';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('RH Chain Daily Receipt Ops Kit', () => {
  it('validates authoring requirements, including the leadership narrative structured section', () => {
    const receipt = structuredClone(getRhChainDailyReceipts().latest_receipt);
    expect(validateRhChainDailyReceipt(receipt)).toEqual({ valid: true, errors: [] });
    const invalid = { ...receipt, source_notes: '', receipt_sections: receipt.receipt_sections?.filter((section) => section.section_id !== 'risk_wall') };
    expect(validateRhChainDailyReceipt(invalid)).toEqual(expect.objectContaining({ valid: false, errors: expect.arrayContaining(['missing_source_notes', 'missing_section_risk_wall']) }));
    expect(() => createRhChainDailyReceipt(invalid as never)).toThrow('invalid_rh_chain_daily_receipt');
  });

  it('selects the latest receipt and generates known detail and share-card routes', () => {
    const feed = getRhChainDailyReceipts();
    const latest = selectLatestRhChainDailyReceipt(feed.receipts);
    expect(latest?.receipt_id).toBe('rh_daily_006');
    expect(feed.latest_receipt.receipt_id).toBe('rh_daily_006');
    expect(feed.receipts.map((receipt) => receipt.receipt_id)).toEqual(expect.arrayContaining(['rh_daily_001', 'rh_daily_002', 'rh_daily_003', 'rh_daily_004', 'rh_daily_005']));
    expect(rhChainDailyReceiptRoute(feed.receipts[1].receipt_id, feed.receipts)).toBe(`/rh-chain-signal-desk/daily-receipts/${feed.receipts[1].receipt_id}`);
    expect(rhChainDailyReceiptRoute('unknown', feed.receipts)).toBeNull();
    expect(rhChainDailyReceiptShareCardRoute(feed.receipts[1].receipt_id)).toBe(`/rh-chain-signal-desk/daily-receipts/${feed.receipts[1].receipt_id}/card`);
  });

  it('builds field-driven X copy for any receipt', () => {
    const receipt = getRhChainDailyReceipts().latest_receipt;
    const post = createRhChainDailyReceiptXPost(receipt);
    expect(post).toContain(receipt.headline);
    expect(post).toContain(receipt.top_signal);
    expect(post).toContain(receipt.infopunks_verdict);
  });

  it('serves known receipt detail and returns a clean API not-found response', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const known = await Promise.all(['001', '002', '003', '004', '005'].map((number) => app.inject({ method: 'GET', url: `/v1/rh-chain/daily-receipts/rh_daily_${number}` })));
    const missing = await app.inject({ method: 'GET', url: '/v1/rh-chain/daily-receipts/not-real' });
    expect(known.every((response) => response.statusCode === 200)).toBe(true);
    expect(known.map((response) => response.json().data.receipt_id)).toEqual(['rh_daily_001', 'rh_daily_002', 'rh_daily_003', 'rh_daily_004', 'rh_daily_005']);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual(expect.objectContaining({ data: null, error: 'rh_chain_daily_receipt_not_found', meta: expect.any(Object), sources: expect.any(Array), generated_at: expect.any(String), data_mode: expect.any(String), disclaimer: expect.any(String) }));
    await app.close();
  });

  it('keeps layer claims source-required and renders the required structure in #006', () => {
    const receipt = getRhChainDailyReceipts().latest_receipt;
    expect(receipt.receipt_id).toBe('rh_daily_006');
    expect(receipt.receipt_sections?.map((section) => section.section_id)).toEqual(expect.arrayContaining([
      'chain_pulse', 'meme_pulse', 'leadership_narrative_pulse', 'launchpad_stress_test', 'rwa_pulse', 'agent_pulse', 'infrastructure_pulse', 'risk_wall', 'market_structure_note', 'narrative_mutation', 'infopunks_verdict'
    ]));
    expect(receipt.source_notes).toContain('source_required');
    expect(receipt.source_notes).toContain('primary or on-chain evidence');
    expect(receipt.receipt_sections?.find((section) => section.section_id === 'launchpad_stress_test')?.fields.map((field) => field.value).join(' ')).toContain('source_required');
    expect(receipt.receipt_sections?.find((section) => section.section_id === 'rwa_pulse')?.fields.map((field) => field.value).join(' ')).toContain('RWA claims are source_required');
    expect(receipt.receipt_sections?.find((section) => section.section_id === 'agent_pulse')?.fields.map((field) => field.value).join(' ')).toContain('Agent claims remain source_required');
    expect(receipt.receipt_sections?.find((section) => section.section_id === 'market_structure_note')?.summary).toBe('The chain is not cooling. It is sorting.');
    expect(JSON.stringify(receipt).toLowerCase()).not.toMatch(/\b(buy|sell|ape|100x|raid)\b/);
  });
});
