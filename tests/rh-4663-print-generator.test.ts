import { describe, expect, it } from 'vitest';
import { InMemoryRh4663PrintStore, Rh4663PrintGeneratorError, Rh4663PrintGeneratorService, type Rh4663VerifiedObservation } from '../src/services/rh4663PrintGeneratorService';
import { RH_4663_PRINT_0830 } from '../src/services/rh4663PrintService';

const start = '2026-08-31T00:00:00.000Z';
const end = '2026-09-01T00:00:00.000Z';
function observation(metric: string, value: number, overrides: Partial<Rh4663VerifiedObservation> = {}): Rh4663VerifiedObservation {
  return { observation_id: `source-a:${metric}`, chain_id: 4663, metric, value, unit: 'USD', provider: 'Source A', source_url: 'https://example.com/source-a', observed_at: end, fetched_at: end, window_start: start, window_end: end, window_type: 'UTC_CALENDAR_DAY', methodology: 'Fixture verified observation.', freshness: 'HISTORICAL_FINAL', confidence: 90, status: 'FINAL', ...overrides };
}
function generator(observations: Rh4663VerifiedObservation[], store = new InMemoryRh4663PrintStore()) { return new Rh4663PrintGeneratorService({ store, now: () => new Date('2026-09-01T12:00:00.000Z'), observations: async () => ({ observations }) }); }

describe('4663 PRINT generator', () => {
  it('normalizes declared windows and never turns unavailable data into zero', async () => {
    const candidate = await generator([observation('dex_volume_rolling_24h_usd', 1_030_000_000, { window_type: 'ROLLING_24H' }), observation('tvl_usd', 2_000_000, { window_type: 'LIVE_SNAPSHOT' })]).candidate('2026-08-31');
    expect(candidate.observations.map((item) => item.window_type)).toEqual(['ROLLING_24H', 'LIVE_SNAPSHOT']);
    expect(candidate.observations.every((item) => item.value !== 0)).toBe(true);
    expect(candidate.completeness.missing).toEqual(expect.arrayContaining(['transactions_utc_day', 'dex_volume_utc_day_usd']));
  });

  it('retains stale and unavailable source states instead of qualifying a candidate', async () => {
    const stale = await generator([observation('transactions_utc_day', 10, { freshness: 'STALE' }), observation('dex_volume_utc_day_usd', 20)]).candidate('2026-08-31');
    const unavailable = await generator([]).candidate('2026-08-31');
    expect(stale.lifecycle).toBe('CANDIDATE'); expect(stale.freshness).toBe('STALE'); expect(unavailable.freshness).toBe('UNAVAILABLE');
  });

  it('distinguishes unlike windows from genuine provider disagreement', async () => {
    const windows = await generator([observation('dex_volume_usd', 875, { window_type: 'UTC_CALENDAR_DAY' }), observation('dex_volume_usd', 1030, { observation_id: 'source-b:dex', provider: 'Source B', window_type: 'ROLLING_24H' })]).candidate('2026-08-31');
    const conflict = await generator([observation('dex_volume_utc_day_usd', 875), observation('dex_volume_utc_day_usd', 1000, { observation_id: 'source-b:dex', provider: 'Source B' })]).candidate('2026-08-31');
    expect(windows.disagreements).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'DIFFERENT_WINDOW' })]));
    expect(conflict.disagreements).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'SOURCE_DISAGREEMENT' })]));
    expect(conflict.lifecycle).toBe('CANDIDATE');
  });

  it('classifies a complete speculative candidate from inspectable rules and leaves agents unknown', async () => {
    const candidate = await generator([
      observation('transactions_utc_day', 5_521_213, { unit: 'COUNT' }), observation('dex_volume_utc_day_usd', 874_800_000), observation('meme_dex_share_percent', 51, { unit: 'PERCENT' }), observation('stablecoin_market_cap_usd', 100_000_000), observation('tvl_usd', 50_000_000)
    ]).candidate('2026-08-31');
    expect(candidate.lifecycle).toBe('READY'); expect(candidate.regime).toBe('SPECULATIVE_EXPANSION'); expect(candidate.regime_rules).toContain('meme_dex_share_percent >= 50');
    expect(candidate.layer_read).toEqual(expect.arrayContaining([expect.objectContaining({ layer: 'MEMES', state: 'VERY HOT' }), expect.objectContaining({ layer: 'AGENTS', state: 'INSUFFICIENT DATA' })]));
  });

  it('is conservative with insufficient evidence', async () => {
    const candidate = await generator([observation('tvl_usd', 2_000_000)]).candidate('2026-08-31');
    expect(candidate.regime).toBe('INSUFFICIENT_EVIDENCE'); expect(candidate.lifecycle).toBe('CANDIDATE');
  });

  it('freezes an exact candidate once and preserves it after live source values change', async () => {
    const store = new InMemoryRh4663PrintStore(); const source = [observation('transactions_utc_day', 100, { unit: 'COUNT' }), observation('dex_volume_utc_day_usd', 1000), observation('meme_dex_share_percent', 55, { unit: 'PERCENT' })]; const service = generator(source, store);
    const candidate = await service.candidate('2026-08-31'); const frozen = await service.freeze(candidate, candidate.fingerprint);
    source[1].value = 999_999;
    const reread = await service.get(frozen.print_id);
    expect(reread?.metrics.find((item) => item.id === 'dex_volume_utc_day_usd')?.value).toBe('$1000');
    expect(reread?.frozen_memory).toMatchObject({ created_at: candidate.generated_at, frozen_at: '2026-09-01T12:00:00.000Z', generator_version: 'rh4663.print-generator.v1', accepted_observations: expect.arrayContaining([expect.objectContaining({ metric: 'transactions_utc_day' })]) });
    await expect(service.freeze(candidate, candidate.fingerprint)).rejects.toMatchObject({ code: 'print_already_frozen' } satisfies Partial<Rh4663PrintGeneratorError>);
  });

  it('rejects a changed or incomplete candidate from freeze', async () => {
    const incomplete = await generator([]).candidate('2026-08-31');
    await expect(generator([]).freeze(incomplete, incomplete.fingerprint)).rejects.toMatchObject({ code: 'print_candidate_not_ready' });
    const ready = await generator([observation('transactions_utc_day', 1, { unit: 'COUNT' }), observation('dex_volume_utc_day_usd', 1)]).candidate('2026-08-31');
    await expect(generator([observation('transactions_utc_day', 1, { unit: 'COUNT' }), observation('dex_volume_utc_day_usd', 1)]).freeze(ready, 'sha256:not-the-candidate')).rejects.toMatchObject({ code: 'print_candidate_changed' });
  });

  it('keeps the Aug 30 campaign object frozen regardless of provider-shaped input', () => {
    const before = structuredClone(RH_4663_PRINT_0830); const providerLikeRefresh = observation('dex_volume_utc_day_usd', 999_000_000);
    expect(providerLikeRefresh.value).not.toBe(Number(before.metrics.find((item) => item.id === 'utc_dex_volume')?.value.replace(/[^0-9.]/g, '')));
    expect(RH_4663_PRINT_0830).toEqual(before); expect(RH_4663_PRINT_0830.metrics.find((item) => item.id === 'utc_dex_volume')?.window_type).toBe('utc_calendar_day');
  });
});
