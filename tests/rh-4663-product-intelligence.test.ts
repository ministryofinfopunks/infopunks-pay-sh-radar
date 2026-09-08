import { describe, expect, it } from 'vitest';
import { PostgresRh4663ProductIntelligenceStore, RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS, Rh4663ProductIntelligenceService } from '../src/services/rh4663ProductIntelligenceService';

const now = () => new Date('2026-09-07T12:00:00.000Z');
describe('RH_4663_PRODUCT_INTELLIGENCE', () => {
  it('uses valid canonical calls, never drafts, for conversion and leaves unavailable return rates null', async () => {
    const service = new Rh4663ProductIntelligenceService(now);
    service.recordTelemetry({ event: 'call_card_viewed', surface: 'home' }); service.recordTelemetry({ event: 'call_sign_started', surface: 'call' });
    service.recordCanonicalCall({ receipt_id: 'call-1', wallet: '0x1111111111111111111111111111111111111111', window_id: 'window-1', created_at: now().toISOString() });
    const result = await service.read();
    expect(result).toMatchObject({ valid_call_receipts: 1, call_conversion_rate: { numerator: 1, denominator: 1, rate: 1 }, resolution_return_rate: { rate: null, coverage: 'INSUFFICIENT_DATA' }, second_call_rate: { rate: null } });
    expect(JSON.stringify(result)).not.toContain('0x1111111111111111111111111111111111111111');
  });
  it('deduplicates telemetry and calculates share/landing and campaign aggregates without identifiers', async () => {
    const service = new Rh4663ProductIntelligenceService(now); const event = { event: 'campaign_shared' as const, surface: 'campaign' as const, campaign_id: 'c1' };
    expect(await service.recordTelemetry(event, { event_id: 'one' })).toBe(true); expect(await service.recordTelemetry(event, { event_id: 'one' })).toBe(false);
    service.recordTelemetry({ event: 'social_landing_viewed', surface: 'social_landing', share_source: 'NOW' }); service.recordTelemetry({ event: 'social_landing_source_opened', surface: 'social_landing' });
    expect(await service.read()).toMatchObject({ shares: 1, share_landings: 1, landing_evidence_opens: 1, campaign_views: 0, data_quality: 'PARTIAL' });
  });
  it('keeps notification readiness advisory and insufficient until resolution linkage exists', async () => {
    const result = await new Rh4663ProductIntelligenceService(now).read();
    expect(result.notification_readiness).toMatchObject({ state: 'INSUFFICIENT_EVIDENCE', conclusion: 'INSUFFICIENT_DATA' }); expect(result.valid_call_receipts).toBe(0); expect(result.call_conversion_rate.rate).toBeNull();
  });
  it('calculates resolution return and second-call rates only from linked canonical identities', async () => {
    const service = new Rh4663ProductIntelligenceService(now); const wallet = '0x2222222222222222222222222222222222222222';
    service.recordCanonicalCall({ receipt_id: 'call-one', wallet, window_id: 'w1', created_at: '2026-09-01T00:00:00.000Z' });
    service.recordCanonicalResolution({ receipt_id: 'resolution-one', call_receipt_id: 'call-one', wallet, window_id: 'w1', created_at: '2026-09-02T00:00:00.000Z' });
    service.recordResolutionReturn({ wallet, call_receipt_id: 'call-one', resolution_receipt_id: 'resolution-one', occurred_at: '2026-09-03T00:00:00.000Z' });
    service.recordCanonicalCall({ receipt_id: 'call-two', wallet, window_id: 'w2', created_at: '2026-09-04T00:00:00.000Z' });
    const result = await service.read({ window_start: '2026-09-01T00:00:00.000Z' });
    expect(result.resolution_return_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(result.second_call_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(JSON.stringify(result)).not.toContain(wallet);
  });
  it('links a bounded anonymous session to followed changes and attributable share landings', async () => {
    const service = new Rh4663ProductIntelligenceService(now); const anonymous_session_id = 'local-session-1'; const subject_id = 'ai-nvda-loop';
    await service.recordTelemetry({ event: 'follow_created', anonymous_session_id, subject_id }, { occurred_at: '2026-09-01T00:00:00.000Z' });
    await service.recordTelemetry({ event: 'followed_open_loop_viewed', anonymous_session_id, subject_id }, { occurred_at: '2026-09-02T00:00:00.000Z' });
    await service.recordTelemetry({ event: 'followed_change_viewed', anonymous_session_id, subject_id }, { occurred_at: '2026-09-03T00:00:00.000Z' });
    await service.recordTelemetry({ event: 'campaign_shared', share_object_id: 'open_loop:ai-nvda-loop' }, { occurred_at: '2026-09-03T00:00:00.000Z' });
    await service.recordTelemetry({ event: 'social_landing_viewed', share_object_id: 'open_loop:ai-nvda-loop' }, { occurred_at: '2026-09-04T00:00:00.000Z' });
    const result = await service.read({ window_start: '2026-09-01T00:00:00.000Z' });
    expect(result.open_loop_follow_return_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(result.followed_subject_return_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(result.share_landing_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(JSON.stringify(result)).not.toContain(anonymous_session_id);
  });
  it('persists only bounded pseudonymous loop primitives across service instances', async () => {
    const rows = new Map<string, any>(); const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const pool = { query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.startsWith('insert into rh4663_product_intelligence_events')) {
        const [event_id, occurred_at, event_name, identity_key, entry_source, campaign_id, window_id, subject_id, share_object_id, receipt_id, call_receipt_id, methodology_version] = values!;
        if (rows.has(event_id as string)) return { rowCount: 0, rows: [] };
        rows.set(event_id as string, { event_id, occurred_at, event: event_name, identity_key, entry_source, campaign_id, window_id, subject_id, share_object_id, receipt_id, call_receipt_id, methodology_version }); return { rowCount: 1, rows: [{ event_id }] };
      }
      if (sql.startsWith('select event_id')) { const [start, end, campaign] = values!; return { rowCount: rows.size, rows: [...rows.values()].filter((row) => row.occurred_at >= String(start) && row.occurred_at <= String(end) && (!campaign || row.campaign_id === campaign)) }; }
      return { rowCount: 0, rows: [] };
    } };
    const store = new PostgresRh4663ProductIntelligenceStore(pool as any); const wallet = '0x3333333333333333333333333333333333333333';
    const writer = new Rh4663ProductIntelligenceService(store, now);
    await writer.recordCanonicalCall({ receipt_id: 'call-durable', wallet, window_id: 'w1', created_at: '2026-09-01T00:00:00.000Z' });
    await writer.recordCanonicalResolution({ receipt_id: 'resolution-durable', call_receipt_id: 'call-durable', wallet, window_id: 'w1', created_at: '2026-09-02T00:00:00.000Z' });
    await writer.recordResolutionReturn({ wallet, call_receipt_id: 'call-durable', resolution_receipt_id: 'resolution-durable', occurred_at: '2026-09-03T00:00:00.000Z' });
    const result = await new Rh4663ProductIntelligenceService(store, now).read({ window_start: '2026-09-01T00:00:00.000Z' });
    expect(result).toMatchObject({ storage: { adapter: 'postgres', durable: true, event_retention_days: RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS }, resolution_return_rate: { numerator: 1, denominator: 1, rate: 1 } });
    expect(JSON.stringify([...rows.values()])).not.toContain(wallet);
    expect(queries.some((query) => query.sql.includes(`interval '${RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS} days'`))).toBe(true);
    expect(queries.some((query) => query.sql.includes('payload') || query.sql.includes('wallet'))).toBe(false);
  });
});
