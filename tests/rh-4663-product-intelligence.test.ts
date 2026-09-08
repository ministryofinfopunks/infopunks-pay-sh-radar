import { describe, expect, it } from 'vitest';
import { Rh4663ProductIntelligenceService } from '../src/services/rh4663ProductIntelligenceService';

const now = () => new Date('2026-09-07T12:00:00.000Z');
describe('RH_4663_PRODUCT_INTELLIGENCE', () => {
  it('uses valid canonical calls, never drafts, for conversion and leaves unavailable return rates null', () => {
    const service = new Rh4663ProductIntelligenceService(now);
    service.recordTelemetry({ event: 'call_card_viewed', surface: 'home' }); service.recordTelemetry({ event: 'call_sign_started', surface: 'call' });
    service.recordCanonicalCall({ receipt_id: 'call-1', wallet: '0x1111111111111111111111111111111111111111', window_id: 'window-1', created_at: now().toISOString() });
    const result = service.read();
    expect(result).toMatchObject({ valid_call_receipts: 1, call_conversion_rate: { numerator: 1, denominator: 1, rate: 1 }, resolution_return_rate: { rate: null, coverage: 'INSUFFICIENT_DATA' }, second_call_rate: { rate: null } });
    expect(JSON.stringify(result)).not.toContain('0x1111111111111111111111111111111111111111');
  });
  it('deduplicates telemetry and calculates share/landing and campaign aggregates without identifiers', () => {
    const service = new Rh4663ProductIntelligenceService(now); const event = { event: 'campaign_shared' as const, surface: 'campaign' as const, campaign_id: 'c1' };
    expect(service.recordTelemetry(event, { event_id: 'one' })).toBe(true); expect(service.recordTelemetry(event, { event_id: 'one' })).toBe(false);
    service.recordTelemetry({ event: 'social_landing_viewed', surface: 'social_landing', share_source: 'NOW' }); service.recordTelemetry({ event: 'social_landing_source_opened', surface: 'social_landing' });
    expect(service.read()).toMatchObject({ shares: 1, share_landings: 1, landing_evidence_opens: 1, campaign_views: 0, data_quality: 'PARTIAL' });
  });
  it('keeps notification readiness advisory and insufficient until resolution linkage exists', () => {
    const result = new Rh4663ProductIntelligenceService(now).read();
    expect(result.notification_readiness).toMatchObject({ state: 'INSUFFICIENT_EVIDENCE', conclusion: 'INSUFFICIENT_DATA' }); expect(result.valid_call_receipts).toBe(0); expect(result.call_conversion_rate.rate).toBeNull();
  });
  it('calculates resolution return and second-call rates only from linked canonical identities', () => {
    const service = new Rh4663ProductIntelligenceService(now); const wallet = '0x2222222222222222222222222222222222222222';
    service.recordCanonicalCall({ receipt_id: 'call-one', wallet, window_id: 'w1', created_at: '2026-09-01T00:00:00.000Z' });
    service.recordCanonicalResolution({ receipt_id: 'resolution-one', call_receipt_id: 'call-one', wallet, window_id: 'w1', created_at: '2026-09-02T00:00:00.000Z' });
    service.recordResolutionReturn({ wallet, call_receipt_id: 'call-one', resolution_receipt_id: 'resolution-one', occurred_at: '2026-09-03T00:00:00.000Z' });
    service.recordCanonicalCall({ receipt_id: 'call-two', wallet, window_id: 'w2', created_at: '2026-09-04T00:00:00.000Z' });
    const result = service.read({ window_start: '2026-09-01T00:00:00.000Z' });
    expect(result.resolution_return_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(result.second_call_rate).toMatchObject({ numerator: 1, denominator: 1, rate: 1 });
    expect(JSON.stringify(result)).not.toContain(wallet);
  });
});
