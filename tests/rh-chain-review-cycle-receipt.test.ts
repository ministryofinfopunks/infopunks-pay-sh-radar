import { describe, expect, it } from 'vitest';
import { createRhChainAgenticMarketStructureReceipt, createRhChainMarketStructureReceipt, createRhChainReviewCycleReceipt } from '../src/services/rhChainDailyReceiptDraftService';
import type { RhChainDailyReviewSummary } from '../src/services/rhChainReviewPipelineService';

function summary(overrides: Partial<RhChainDailyReviewSummary> = {}): RhChainDailyReviewSummary {
  return {
    day: '2026-07-19', reviewed_count: 0, promoted_to_market_structure_count: 0, promoted_to_100_receipts_count: 0, source_required_count: 0, watch_only_count: 0, ignored_count: 0,
    top_attention_tokens: [], attention_quality_context: [], cross_layer_candidates: [], promoted_market_structure_candidates: [], outcome_checks: [], paid_attention_detected: false, duplicate_ticker_warnings: [], suggested_daily_receipt_headline: 'source-limited',
    ...overrides
  };
}

describe('RH Chain Review Cycle Receipt #007', () => {
  it('renders an empty daily summary as a system-readiness receipt without market promotions', () => {
    const receipt = createRhChainReviewCycleReceipt(summary(), '2026-07-19T12:00:00.000Z');
    expect(receipt).toEqual(expect.objectContaining({ receipt_id: 'rh_review_cycle_template', period: 'Review cycle · 2026-07-19 UTC' }));
    expect(receipt.summary).toContain('System-readiness receipt');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Market Structure Pulse')?.summary).toBe('No new reviewed candidates were promoted in this cycle.');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Attention Quality Pulse')?.summary).toBe('Attention quality remains history-gated.');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Outcome Checks')?.summary).toBe('No outcome checks scheduled yet.');
  });

  it('renders exact daily-summary counts, warnings, history, promotions, and outcome checks', () => {
    const receipt = createRhChainReviewCycleReceipt(summary({
      reviewed_count: 4, promoted_to_market_structure_count: 1, promoted_to_100_receipts_count: 2, source_required_count: 3, watch_only_count: 1, ignored_count: 1, paid_attention_detected: true,
      duplicate_ticker_warnings: [{ contract: '0x1111111111111111111111111111111111111111', duplicate_ticker_contracts: ['0x2222222222222222222222222222222222222222'] }],
      cross_layer_candidates: [{ contract: '0x1111111111111111111111111111111111111111', token_name: 'Layered', market_structure_layer: 'infrastructure', secondary_tags: ['data'] }],
      promoted_market_structure_candidates: [{ contract: '0x1111111111111111111111111111111111111111', token_name: 'Layered', symbol: 'LAYR', market_structure_layer: 'infrastructure' }],
      attention_quality_context: [{ contract: '0x1111111111111111111111111111111111111111', token_name: 'Layered', snapshot_count: 3, attention_quality_state: 'sustained_attention' }],
      outcome_checks: [{ contract: '0x1111111111111111111111111111111111111111', token_name: 'Layered', symbol: 'LAYR', outcome_check_at: '2026-07-26T12:00:00.000Z' }]
    }), '2026-07-19T12:00:00.000Z');
    const review = receipt.receipt_sections?.find((section) => section.title === 'Review Cycle Summary');
    expect(review?.fields).toEqual(expect.arrayContaining([{ label: 'reviewed_count', value: '4' }, { label: 'duplicate_ticker_warnings', value: '1' }, { label: 'paid_attention_detected', value: 'true' }, { label: 'cross_layer_candidates', value: '1' }]));
    expect(review?.fields.find((field) => field.label === 'duplicate_ticker_warning_detail')?.value).toContain('0x2222222222222222222222222222222222222222');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Market Structure Pulse')?.summary).toContain('Layered (LAYR) · infrastructure');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Attention Quality Pulse')?.summary).toContain('3 snapshot(s) · sustained_attention');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Outcome Checks')?.summary).toContain('Layered (LAYR)');
    expect(JSON.stringify(receipt).toLowerCase()).not.toMatch(/\b(buy|sell|ape|100x|raid)\b/);
  });

  it('builds #007 as a market-structure receipt with all five layer rankings and source boundaries', () => {
    const receipt = createRhChainMarketStructureReceipt('2026-07-19T12:00:00.000Z');
    const ranking = receipt.receipt_sections?.find((section) => section.title === 'Layer Power Ranking');
    expect(receipt).toEqual(expect.objectContaining({ receipt_id: 'rh_daily_007', receipt_type: 'market_structure_memory', headline: 'RH Chain shifts from meme monopoly to multi-layer market structure' }));
    expect(ranking?.fields.map((field) => field.label)).toEqual(['Memes', 'RWAs', 'Agents', 'Infrastructure', 'Cross-Layer Flows']);
    expect(ranking?.summary).toContain('reviewed market-structure estimate, not complete chain accounting');
    expect(receipt.receipt_sections?.find((section) => section.title === 'RWA Layer')?.fields.map((field) => field.value).join(' ')).toContain('source_required');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Agent Layer')?.fields.map((field) => field.value).join(' ')).toContain('does not equal verified agent activity');
    expect(receipt.receipt_sections?.find((section) => section.title === 'Cross-Layer Flows')?.fields.map((field) => field.value).join(' ')).toContain('GROKIUS');
    expect(JSON.stringify(receipt).toLowerCase()).not.toMatch(/\b(buy|sell|ape|100x|raid|alpha|pump)\b/);
  });

  it('builds #008 as source-bound agentic market-structure memory without claiming RH Chain adoption', () => {
    const receipt = createRhChainAgenticMarketStructureReceipt('2026-07-20T12:00:00.000Z');
    const pulse = receipt.receipt_sections?.find((section) => section.title === 'Agentic Trading Pulse');
    const layers = receipt.receipt_sections?.find((section) => section.title === 'Layer Power Update');
    const flows = receipt.receipt_sections?.find((section) => section.title === 'Cross-Layer Flow Watch');
    expect(receipt).toEqual(expect.objectContaining({ receipt_id: 'rh_daily_008', receipt_type: 'agentic_market_structure_memory', period: 'July 19 → July 20, 2026 UTC', headline: 'Robinhood opens the agent rail as RH Chain’s agent layer gains structural power' }));
    expect(pulse?.fields.map((field) => field.value).join(' ')).toContain('long equities and options orders');
    expect(pulse?.fields.map((field) => field.value).join(' ')).toContain('source_required unless exact current primary documentation verifies support');
    expect(layers?.fields.map((field) => field.label)).toEqual(['Memes', 'RWAs', 'Agents', 'Infrastructure', 'Cross-Layer Flows']);
    expect(layers?.fields.find((field) => field.label === 'Agents')?.value).toContain('low for RH Chain-specific adoption');
    expect(flows?.fields.every((field) => field.value === 'source_required')).toBe(true);
    expect(receipt.manual_context).toContain('Human approval is required');
    expect(receipt.sources.map((source) => source.source_url)).toEqual(expect.arrayContaining(['https://robinhood.com/us/en/agentic-trading/', 'https://robinhood.com/us/en/support/articles/trading-with-your-agent/']));
    expect(JSON.stringify(receipt).toLowerCase()).not.toMatch(/\b(buy|sell|ape|100x|raid|alpha|pump|front-run)\b/);
  });
});
