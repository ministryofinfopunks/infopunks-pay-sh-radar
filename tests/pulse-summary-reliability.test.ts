import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as severityEngine from '../src/engines/severityEngine';
import { InfopunksEvent } from '../src/schemas/entities';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { invalidatePulseSummaryCache, pulseSummary } from '../src/services/pulseService';

function event(id: string, type: InfopunksEvent['type'], observedAt: string, entityId = 'provider-1'): InfopunksEvent {
  return {
    id, type, source: 'synthetic', entityType: 'provider', entityId, observedAt,
    payload: { providerId: entityId, response_time_ms: 1200 }
  };
}

function store(events: InfopunksEvent[] = []): IntelligenceSnapshot {
  return {
    events,
    providers: [{ id: 'provider-1', name: 'Provider One', endpointCount: 2 } as IntelligenceSnapshot['providers'][number]],
    endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [],
    dataSource: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: '2026-11-03T00:00:00.000Z', provider_count: 1, last_ingested_at: '2026-11-03T00:00:00.000Z', used_fixture: false }
  };
}

describe('pulse summary reliability', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preserves the prior repeated-degradation severity and summary output', () => {
    const events = [
      event('old', 'provider.degraded', '2026-11-02T22:00:00.000Z'),
      ...[0, 1, 2, 3].map((minute) => event(`d${minute}`, 'provider.degraded', `2026-11-03T00:0${minute}:00.000Z`)),
      event('other', 'endpoint.degraded', '2026-11-03T00:03:00.000Z', 'endpoint-1')
    ];
    const indexed = severityEngine.classifyEventSeverities(events);
    for (const candidate of events) {
      expect(indexed.get(candidate)).toEqual(severityEngine.classifyEventSeverity(candidate, events));
    }

    const result = pulseSummary(store(events), '2026-11-03T00:04:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false });
    expect(result.latest_event_at).toBe('2026-11-03T00:03:00.000Z');
    expect(result.latest_batch_event_count).toBe(2);
    expect(result.counters).toMatchObject({ providers: 1, endpoints: 2, events: 6, unknownTelemetry: 0 });
    expect(result.eventGroups.monitoring.count).toBe(6);
    expect(result.timeline[0]).toMatchObject({ id: 'd3', severity: 'critical', severity_reason: '4 repeated degradations detected in the severity window.' });
  });

  it('reuses event analytics across reads while recalculating freshness windows', () => {
    const classify = vi.spyOn(severityEngine, 'classifyEventSeverities');
    const snapshot = store([event('recent', 'provider.degraded', '2026-11-03T00:00:00.000Z')]);
    const beforeExpiry = pulseSummary(snapshot, '2026-11-03T00:30:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false });
    const afterExpiry = pulseSummary(snapshot, '2026-11-03T01:00:00.001Z', 450_000, { includePropagation: false, includeInterpretations: false });

    expect(classify).toHaveBeenCalledTimes(1);
    expect(beforeExpiry.providerActivity['1h']).toHaveLength(1);
    expect(afterExpiry.providerActivity['1h']).toHaveLength(0);
    expect(afterExpiry.generatedAt).toBe('2026-11-03T01:00:00.001Z');
  });

  it('invalidates after an event source replacement and returns independent response objects', () => {
    const snapshot = store([event('first', 'provider.degraded', '2026-11-03T00:00:00.000Z')]);
    const first = pulseSummary(snapshot, '2026-11-03T00:01:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false });
    first.timeline[0].payload.providerId = 'mutated by caller';
    snapshot.events = [...snapshot.events, event('second', 'provider.failed', '2026-11-03T00:02:00.000Z')];
    invalidatePulseSummaryCache(snapshot);

    const updated = pulseSummary(snapshot, '2026-11-03T00:03:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false });
    expect(updated.counters.events).toBe(2);
    expect(updated.timeline.map((item) => item.id)).toEqual(['second', 'first']);
    expect(updated.timeline[1].payload.providerId).toBe('provider-1');
  });

  it('handles concurrent reads and retries analytics after a failed build', async () => {
    const snapshot = store([event('event', 'provider.degraded', '2026-11-03T00:00:00.000Z')]);
    const concurrent = await Promise.all([1, 2, 3].map(() => Promise.resolve(pulseSummary(snapshot, '2026-11-03T00:01:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false }))));
    expect(concurrent.map((summary) => summary.counters.events)).toEqual([1, 1, 1]);

    snapshot.events = new Proxy([], { get() { throw new Error('synthetic analytics build failure'); } }) as unknown as InfopunksEvent[];
    invalidatePulseSummaryCache(snapshot);
    expect(() => pulseSummary(snapshot, '2026-11-03T00:02:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false })).toThrow('synthetic analytics build failure');

    snapshot.events = [event('recovered', 'provider.failed', '2026-11-03T00:03:00.000Z')];
    expect(pulseSummary(snapshot, '2026-11-03T00:04:00.000Z', 450_000, { includePropagation: false, includeInterpretations: false }).timeline[0].id).toBe('recovered');
  });
});
