import { describe, expect, it } from 'vitest';
import { classifyEventSeverity, classifyScoreChangeSeverity } from '../src/engines/severityEngine';
import { InfopunksEvent } from '../src/schemas/entities';

function event(type: InfopunksEvent['type'], payload: Record<string, unknown> = {}, observedAt = '2026-01-02T00:00:00.000Z'): InfopunksEvent {
  return {
    id: `${type}-${observedAt}`,
    type,
    source: 'test',
    entityType: type.startsWith('provider.') ? 'provider' : 'catalog',
    entityId: type.startsWith('provider.') ? 'monitor' : 'pay-sh-catalog',
    observedAt,
    payload: { providerId: 'monitor', ...payload }
  };
}

describe('severity engine', () => {
  it('classifies unreachable provider as critical', () => {
    expect(classifyEventSeverity(event('provider.failed', { success: false, error_message: 'timeout' })).severity).toBe('critical');
  });

  it('classifies HTTP 404 degraded root health as warning', () => {
    const severity = classifyEventSeverity(event('provider.degraded', { success: true, status_code: 404, response_time_ms: 24 }));
    expect(severity).toMatchObject({ severity: 'warning', severity_reason: 'Provider root health returned HTTP 404.' });
  });

  it('escalates repeated degradation within the severity window', () => {
    const related = [0, 1, 2, 3].map((minute) => event('provider.degraded', { success: true, status_code: 429 }, `2026-01-02T00:0${minute}:00.000Z`));
    expect(classifyEventSeverity(related[1], related).severity).toBe('warning');
    expect(classifyEventSeverity(related[3], related).severity).toBe('critical');
  });

  it('classifies trust drop above threshold as critical', () => {
    expect(classifyScoreChangeSeverity('trust_assessment', -30).severity).toBe('critical');
  });

  it('classifies catalog refresh as informational', () => {
    expect(classifyEventSeverity(event('catalog.ingested', { mode: 'live_pay_sh_catalog' })).severity).toBe('informational');
  });

  it('classifies incomplete endpoint metadata as warning', () => {
    const severity = classifyEventSeverity({
      ...event('pay_sh_catalog_endpoint_seen', { path: null, method: null }),
      entityType: 'endpoint',
      entityId: 'monitor-endpoint-1'
    });
    expect(severity.severity).toBe('warning');
  });
});
