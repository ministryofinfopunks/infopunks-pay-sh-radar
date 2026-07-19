import { describe, expect, it } from 'vitest';
import { InMemoryRhChainAttentionReceiptStore, RhChainAttentionQualityService } from '../src/services/rhChainAttentionQualityService';
import type { RhChainMarketSnapshot } from '../src/services/rhChainMarketSnapshotService';
import type { RhChainLayerClassification } from '../src/services/rhChainMarketStructureService';

const contract = '0x1111111111111111111111111111111111111111';
const reviewed: RhChainLayerClassification = { contract, ticker: 'QUALITY', display_name: 'Quality', dexscreener_pair: null, primary_layer: 'meme', secondary_layers: ['distribution'], cross_layer_category: null, classification_reason: 'Reviewed exact-contract test evidence.', classification_source: 'manual_review', classification_confidence: 'high', evidence_state: 'reviewed', missing_evidence: [], caveat: null, reviewed_at: '2026-07-01T00:00:00.000Z', observed_at: '2026-07-01T00:00:00.000Z', data_mode: 'manual' };
function snapshot(day: number, id: string, paid = false, overrides: Partial<RhChainMarketSnapshot> = {}): RhChainMarketSnapshot { return { snapshot_id: id, captured_at: `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z`, provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: 'QUALITY', pair_address: 'pair', dex_id: 'dex', price_usd: 1, liquidity_usd: 100, market_cap: 1_000, fdv: 1_000, volume_h24: 100, volume_h6: 20, volume_h1: 4, txns_h24_buys: 7, txns_h24_sells: 3, txns_h6_buys: 2, txns_h6_sells: 1, price_change_h24: 0, pair_created_at: null, active_boosts: paid ? 4 : 0, paid_order_types: paid ? ['tokenProfile'] : [], paid_order_statuses: paid ? ['approved'] : [], data_mode: 'live_cached', source_url: null, ...overrides }; }
function subject(rows: RhChainMarketSnapshot[], curated: RhChainLayerClassification | null = reviewed) { return new RhChainAttentionQualityService({ snapshots: async () => rows, curated: () => curated, durable: async () => null, receipts: new InMemoryRhChainAttentionReceiptStore(), now: () => new Date('2026-07-19T12:00:00.000Z') }); }

describe('RH Chain Attention Quality v2', () => {
  it('does not manufacture a numeric score without a paid-attention event', async () => {
    const result = await subject([snapshot(10, 'a'), snapshot(12, 'b'), snapshot(19, 'c')]).assess(contract, '30d');
    expect(result).toMatchObject({ assessment_state: 'baseline_forming', attention_quality_score: null, provider_requests_in_path: 0 });
  });
  it('does not infer paid attention from volume alone', async () => {
    const result = await subject([snapshot(10, 'a', false, { volume_h24: 10 }), snapshot(12, 'b', false, { volume_h24: 100_000 }), snapshot(14, 'c', false, { volume_h24: 10 })]).assess(contract, '30d');
    expect(result.paid_attention.detected).toBe(false);
    expect(result.attention_quality_score).toBeNull();
  });
  it('makes a deterministic score only after baseline, promotion, post-promotion, and coverage gates pass', async () => {
    const rows = [snapshot(1, 'a'), snapshot(3, 'b'), snapshot(5, 'c'), snapshot(7, 'd', true), snapshot(10, 'e'), snapshot(13, 'f'), snapshot(16, 'g'), snapshot(19, 'h')];
    const first = await subject(rows).assess(contract, '30d'); const second = await subject(rows).assess(contract, '30d');
    expect(first).toMatchObject({ assessment_state: 'measurable', attention_quality_score: expect.any(Number), data_completeness: 100 });
    expect(first.attention_quality_score).toBe(second.attention_quality_score);
    expect(first.components.find((item) => item.key === 'transaction_persistence')?.caveat).toMatch(/not wallet/i);
  });
  it('withholds a score for curated/durable disagreement while preserving curated precedence', async () => {
    const rows = [snapshot(1, 'a'), snapshot(3, 'b'), snapshot(5, 'c'), snapshot(7, 'd', true), snapshot(10, 'e'), snapshot(13, 'f'), snapshot(16, 'g'), snapshot(19, 'h')];
    const service = new RhChainAttentionQualityService({ snapshots: async () => rows, curated: () => reviewed, durable: async () => ({ primary_layer: 'defi', secondary_layers: [], review_status: 'approved', effective_at: '2026-07-01T00:00:00.000Z', superseded_at: null, classification_version: 3 } as any), receipts: new InMemoryRhChainAttentionReceiptStore(), now: () => new Date('2026-07-19T12:00:00.000Z') });
    const result = await service.assess(contract, '30d');
    expect(result).toMatchObject({ assessment_state: 'disputed', attention_quality_score: null, classification_provenance: 'curated_reviewed_memory' });
  });
  it('creates idempotent draft receipts and only exposes a receipt after reviewer publication', async () => {
    const rows = [snapshot(1, 'a'), snapshot(3, 'b'), snapshot(5, 'c'), snapshot(7, 'd', true), snapshot(10, 'e'), snapshot(13, 'f'), snapshot(16, 'g'), snapshot(19, 'h')]; const receipts = new InMemoryRhChainAttentionReceiptStore();
    const service = new RhChainAttentionQualityService({ snapshots: async () => rows, curated: () => reviewed, durable: async () => null, receipts, now: () => new Date('2026-07-19T12:00:00.000Z') });
    const draft = await service.createReceipt(contract, '30d', 'reviewer');
    expect((await service.createReceipt(contract, '30d', 'reviewer')).receipt_id).toBe(draft.receipt_id);
    expect(await service.publicReceipt(draft.receipt_id)).toBeNull();
    await service.publishReceipt(draft.receipt_id, 'reviewer');
    expect(await service.publicReceipt(draft.receipt_id)).toMatchObject({ status: 'published' });
  });
});
