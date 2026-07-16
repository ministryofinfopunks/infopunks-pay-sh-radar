import { describe, expect, it } from 'vitest';
import { getRhChain4663Index, getRhChainPayload, getRhChainReviewQueue } from '../src/data/rhChain';
import { assembleRhChainMemePulseScreen } from '../src/services/rhChainMemePulseService';
import { assembleRhChainTodayOn4663 } from '../src/services/rhChainTodayOn4663Service';
import {
  selectBriefMemePulse,
  selectChainPulseSummary,
  selectFeaturedMovers,
  selectFeaturedReviewItems,
  selectTodayOn4663
} from '../src/web/rhChainSignalDeskSelectors';

const NOW = new Date('2026-07-16T12:00:00.000Z');

describe('RH Chain Signal Desk 2.0 selectors', () => {
  it('selects Today on 4663 deterministically in the editorial order', () => {
    const payload = assembleRhChainTodayOn4663();
    const first = selectTodayOn4663(payload, NOW);
    const second = selectTodayOn4663(structuredClone(payload), NOW);
    expect(first).toEqual(second);
    expect(first.map((card) => card.id)).toEqual(['top_signal', 'attention_shift', 'risk_alert', 'receipt_update']);
    expect(first[0].verdict).toContain('CASHCAT');
    expect(first.every((card) => card.observedAt && card.sourceCount === 1)).toBe(true);
  });

  it('keeps empty and source-required Today payloads explicit without inventing values', () => {
    const empty = selectTodayOn4663(null, NOW);
    expect(empty).toHaveLength(4);
    expect(empty.every((card) => card.verdict === 'No current evidence-backed update is available.')).toBe(true);
    expect(empty.every((card) => card.classification === 'unavailable' && card.sourceCount === 0)).toBe(true);

    const payload = assembleRhChainTodayOn4663();
    payload.cards[0] = {
      ...payload.cards[0],
      source: { ...payload.cards[0].source, source_name: 'source_required', data_mode: 'unavailable' }
    };
    expect(selectTodayOn4663(payload, NOW)[0].evidenceState).toBe('source_required');
  });

  it('classifies future evidence timestamps as unknown', () => {
    const payload = assembleRhChainTodayOn4663();
    payload.cards[0] = {
      ...payload.cards[0],
      source: { ...payload.cards[0].source, observed_at: '2026-07-18T12:00:00.000Z', updated_at: '2026-07-18T12:00:00.000Z' }
    };
    expect(selectTodayOn4663(payload, NOW)[0].evidenceState).toBe('unknown');
  });

  it('selects the ranked movers by stable rank rather than input order', () => {
    const index = getRhChain4663Index();
    const shuffled = { ...index, assets: [...index.assets].reverse() };
    expect(selectFeaturedMovers(shuffled).map((asset) => asset.rank)).toEqual([1, 2, 3]);
    expect(selectFeaturedMovers(null)).toEqual([]);
  });

  it('orders reviewed Meme Pulse memory before auto-observed context', () => {
    const pulse = assembleRhChainMemePulseScreen();
    const assets = pulse.top_attention_assets.slice(0, 2).map((asset, index) => ({
      ...asset,
      ticker: index === 0 ? 'AUTO' : 'REVIEWED',
      contract: index === 0 ? '0x1111111111111111111111111111111111111111' : '0x2222222222222222222222222222222222222222',
      context_origin: index === 0 ? 'auto_observed' as const : 'reviewed_memory' as const,
      signal_score: 50
    }));
    const selected = selectBriefMemePulse(null, { ...pulse, top_attention_assets: assets }, NOW);
    expect(selected.map((item) => item.ticker)).toEqual(['REVIEWED', 'AUTO']);
    expect(selected.map((item) => item.observedState)).toEqual(['reviewed', 'auto-observed']);
    expect(selectBriefMemePulse(null, null, NOW)).toEqual([]);
  });

  it('selects distinct featured review roles with unchanged API review states', () => {
    const queue = getRhChainReviewQueue();
    const selected = selectFeaturedReviewItems(queue);
    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((selection) => selection.item.review_id)).size).toBe(3);
    expect(selected.map((selection) => selection.role)).toEqual(['newest submission', 'strongest evidence packet', 'highest-risk unresolved']);
    expect(selected.every((selection) => queue.review_states.includes(selection.item.review_state))).toBe(true);
    expect(selectFeaturedReviewItems(null)).toEqual([]);
  });

  it('returns six fixed Chain Pulse slots and leaves missing fees unavailable', () => {
    const summary = selectChainPulseSummary(getRhChainPayload());
    expect(summary.map((metric) => metric.id)).toEqual(['tvl', 'dex_volume', 'stablecoin_context', 'fees', 'stock_token_activity', 'attention_velocity']);
    expect(summary.find((metric) => metric.id === 'fees')).toMatchObject({ value: 'Unavailable', displayState: 'unavailable', metric: null });

    const empty = selectChainPulseSummary(null);
    expect(empty).toHaveLength(6);
    expect(empty.every((metric) => metric.value === 'Unavailable' && metric.displayState === 'unavailable')).toBe(true);
  });
});
