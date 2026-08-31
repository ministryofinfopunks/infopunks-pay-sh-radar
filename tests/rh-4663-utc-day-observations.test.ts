import { describe, expect, it } from 'vitest';
import { InMemoryRh4663PrintStore, Rh4663PrintGeneratorService } from '../src/services/rh4663PrintGeneratorService';
import { createRh4663UtcDayProviders, InMemoryRh4663UtcDayObservationStore, isValidRh4663UtcDate, Rh4663UtcDayObservationError, Rh4663UtcDayObservationService, type Rh4663UtcDayProviderResult, type Rh4663UtcDayProviders } from '../src/services/rh4663UtcDayObservationService';
import { RH_4663_PRINT_0830 } from '../src/services/rh4663PrintService';

const date = '2026-08-31';
const now = () => new Date('2026-09-02T12:00:00.000Z');
function result(value: number, overrides: Partial<Rh4663UtcDayProviderResult> = {}): Rh4663UtcDayProviderResult {
  return { value, observed_at: '2026-08-31T00:00:00.000Z', source_url: 'https://example.com/series', source_metadata: { series: 'test' }, provider_tip_at: '2026-09-02T00:30:00.000Z', methodology: 'Timestamped daily series fixture.', ...overrides };
}
function service(providers: Partial<Rh4663UtcDayProviders>, store = new InMemoryRh4663UtcDayObservationStore()) {
  return { store, service: new Rh4663UtcDayObservationService({ store, now, providers: { transactions: async () => result(5_521_213), dexVolume: async () => result(874_800_000), ...providers } }) };
}

describe('4663 completed UTC-day observations', () => {
  it('persists exact completed UTC-day observations with deterministic IDs', async () => {
    const { service: subject } = service({}); const refreshed = await subject.refresh(date);
    expect(refreshed).toMatchObject({ status: 'FINALIZED', transactions: { observation_id: 'rh4663:transactions:2026-08-31:blockscout:rh4663.utc-day-observation.v1', value: 5_521_213, window_type: 'UTC_CALENDAR_DAY', freshness: 'HISTORICAL_FINAL', window_start: '2026-08-31T00:00:00.000Z', window_end: '2026-09-01T00:00:00.000Z' }, dex_volume: { observation_id: 'rh4663:dex_volume_usd:2026-08-31:defillama:rh4663.utc-day-observation.v1', value: 874_800_000, window_type: 'UTC_CALENDAR_DAY', freshness: 'HISTORICAL_FINAL' } });
  });

  it('rejects invalid, future, and partial current UTC days', async () => {
    const { service: subject } = service({});
    expect(isValidRh4663UtcDate('2026-02-30')).toBe(false);
    await expect(subject.refresh('2026-02-30')).rejects.toMatchObject({ code: 'invalid_utc_date' } satisfies Partial<Rh4663UtcDayObservationError>);
    await expect(subject.refresh('2026-09-02')).rejects.toMatchObject({ code: 'utc_day_not_completed' } satisfies Partial<Rh4663UtcDayObservationError>);
  });

  it('keeps a day incomplete when either source has not indexed safely beyond its end', async () => {
    const { service: subject } = service({ transactions: async () => result(1, { provider_tip_at: '2026-09-01T00:05:00.000Z' }) });
    const refreshed = await subject.refresh(date);
    expect(refreshed.status).toBe('INCOMPLETE'); expect(refreshed.transactions).toBeNull(); expect(refreshed.dex_volume?.value).toBe(874_800_000);
    expect(refreshed.warnings.join(' ')).toContain('finality guard');
  });

  it('does not manufacture zero when a provider fails, but accepts an explicit verified zero', async () => {
    const failed = service({ dexVolume: async () => { throw new Error('provider_timeout'); } });
    expect((await failed.service.refresh(date)).dex_volume).toBeNull();
    const zero = service({ transactions: async () => result(0) });
    expect((await zero.service.refresh(date)).transactions?.value).toBe(0);
  });

  it('is idempotent while preserving a visible immutable revision when a source changes', async () => {
    let volume = 100;
    let fetchedAt = '2026-09-02T12:00:00.000Z'; const store = new InMemoryRh4663UtcDayObservationStore();
    const subject = new Rh4663UtcDayObservationService({ store, now: () => new Date(fetchedAt), providers: { transactions: async () => result(5_521_213), dexVolume: async () => result(volume) } });
    const first = await subject.refresh(date); fetchedAt = '2026-09-02T12:01:00.000Z'; const second = await subject.refresh(date);
    expect(second.dex_volume?.revision).toBe(1);
    fetchedAt = '2026-09-02T12:02:00.000Z'; volume = 101; const revised = await subject.refresh(date);
    expect(revised.dex_volume?.revision).toBe(2);
    expect((await store.history(first.dex_volume!.observation_id)).map((item) => item.value)).toEqual([100, 101]);
  });

  it('normalizes Blockscout and DefiLlama timestamped historical rows, never a rolling field', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      const payload = url.includes('blockscout')
        ? { chart_data: [{ date: '2026-08-31T00:00:00Z', tx_count: 42 }, { date: '2026-09-02T00:30:00Z', tx_count: 1 }] }
        : { totalDataChart: [[1788220800, 900], [1788309000, 1]], volume24h: 9_999_999 };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const providers = createRh4663UtcDayProviders({ blockscoutUrl: 'https://blockscout.example', timeoutMs: 500 });
      const [transactions, dex] = await Promise.all([providers.transactions(date), providers.dexVolume('2026-09-01')]);
      expect(transactions.value).toBe(42); expect(dex.value).toBe(900); expect(dex.methodology).toContain('rolling 24-hour fields are ignored');
    } finally { globalThis.fetch = originalFetch; }
  });

  it('feeds final observations into a READY candidate but never mutates the Aug 30 frozen print', async () => {
    const { service: subject } = service({}); await subject.refresh(date);
    const before = structuredClone(RH_4663_PRINT_0830);
    const generator = new Rh4663PrintGeneratorService({ store: new InMemoryRh4663PrintStore(), now, observations: async (requestedDate) => ({ observations: await subject.observations(requestedDate ?? date) }) });
    const candidate = await generator.candidate(date);
    expect(candidate.lifecycle).toBe('READY'); expect(candidate.completeness.missing).toEqual([]);
    expect(RH_4663_PRINT_0830).toEqual(before);
  });
});
