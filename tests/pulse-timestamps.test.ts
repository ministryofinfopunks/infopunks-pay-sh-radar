import { describe, expect, it } from 'vitest';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { pulseSummary } from '../src/services/pulseService';
import { InfopunksEvent } from '../src/schemas/entities';

const T1 = '2099-01-01T00:00:00.000Z';
const T2 = '2099-01-01T01:00:00.000Z';
const T3 = '2099-01-01T02:00:00.000Z';
const T4 = '2099-01-01T03:00:00.000Z';

function emptySnapshot(): IntelligenceSnapshot {
  return {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: []
  };
}

function provider(slug: string, name: string): PayShCatalogItem {
  return {
    name,
    namespace: `pay/${slug}`,
    slug,
    category: 'Data',
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description: `${name} provider with enough deterministic metadata for stable trust scoring.`,
    tags: [slug, 'lookup'],
    endpointDetails: [{
      name: 'Lookup',
      path: '/lookup',
      method: 'GET',
      category: 'Data',
      description: 'Lookup endpoint.',
      price: '$0.01',
      status: 'available',
      schema: { response: { type: 'object', properties: { ok: { type: 'boolean' } } } }
    }]
  };
}

describe('pulse event timestamps', () => {
  it('keeps Trust Changes on each score event timestamp after a newer batch arrives', () => {
    const first = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    const secondIngestion = applyPayShCatalogIngestion(first, [provider('alpha', 'Alpha API'), provider('beta', 'Beta API')], { observedAt: T2, source: 'pay.sh:test' });
    const store = recomputeAssessments(secondIngestion.snapshot);
    const summary = pulseSummary(store, T3);

    expect(summary.latest_event_at).toBe(T2);
    expect(summary.trustDeltas.find((delta) => delta.providerId === 'alpha')?.observedAt).toBe(T1);
    expect(summary.trustDeltas.find((delta) => delta.providerId === 'beta')?.observedAt).toBe(T2);
  });

  it('does not mutate historical Trust Changes during UI refreshes or assessment recomputes', () => {
    const first = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    const secondIngestion = applyPayShCatalogIngestion(first, [provider('alpha', 'Alpha API'), provider('beta', 'Beta API')], { observedAt: T2, source: 'pay.sh:test' });
    const store = recomputeAssessments(secondIngestion.snapshot);
    const beforeRefresh = pulseSummary(store, T3);
    const afterRefresh = pulseSummary(store, T4);
    const afterRecompute = pulseSummary(recomputeAssessments(store), T4);

    expect(beforeRefresh.trustDeltas.find((delta) => delta.providerId === 'alpha')?.observedAt).toBe(T1);
    expect(afterRefresh.trustDeltas.find((delta) => delta.providerId === 'alpha')?.observedAt).toBe(T1);
    expect(afterRecompute.trustDeltas.find((delta) => delta.providerId === 'alpha')?.observedAt).toBe(T1);
  });

  it('backfills legacy score event timestamps from their stored evidence events', () => {
    const base = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    const trustEvent = base.events.find((event) => event.type === 'score_assessment_created' && event.entityType === 'trust_assessment' && event.payload.entityId === 'alpha');
    expect(trustEvent).toBeTruthy();

    const legacyEvents = base.events.map((event): InfopunksEvent => event.id === trustEvent!.id ? { ...event, observedAt: T2 } : event);
    const normalized = recomputeAssessments({ ...base, events: legacyEvents });
    const summary = pulseSummary(normalized, T3);

    expect(summary.trustDeltas.find((delta) => delta.providerId === 'alpha')?.observedAt).toBe(T1);
  });

  it('keeps distinct timestamps for events in the same ingestion batch', () => {
    const base = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    const withBatch = {
      ...base,
      events: [
        ...base.events,
        { id: 'evt-batch-1', type: 'provider.updated', source: 'pay.sh:test', entityType: 'provider', entityId: 'alpha', observedAt: T2, observed_at: T2, payload: { providerId: 'alpha' } } as InfopunksEvent,
        { id: 'evt-batch-2', type: 'metadata.changed', source: 'pay.sh:test', entityType: 'provider', entityId: 'alpha', observedAt: T3, observed_at: T3, payload: { providerId: 'alpha' } } as InfopunksEvent
      ]
    };
    const summary = pulseSummary(recomputeAssessments(withBatch), T4);
    const rowOne = summary.timeline.find((event) => event.id === 'evt-batch-1');
    const rowTwo = summary.timeline.find((event) => event.id === 'evt-batch-2');
    expect(rowOne?.observedAt).toBe(T2);
    expect(rowTwo?.observedAt).toBe(T3);
  });

  it('preserves score event observed_at during recompute normalization', () => {
    const base = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    const trustEvent = base.events.find((event) => event.type === 'score_assessment_created' && event.entityType === 'trust_assessment' && event.payload.entityId === 'alpha');
    expect(trustEvent).toBeTruthy();

    const mutated = {
      ...base,
      events: base.events.map((event): InfopunksEvent => event.id === trustEvent!.id
        ? { ...event, observedAt: T4, observed_at: T1 }
        : event)
    };
    const normalized = recomputeAssessments(mutated);
    const normalizedTrustEvent = normalized.events.find((event) => event.id === trustEvent!.id)!;
    expect(normalizedTrustEvent.observedAt).toBe(T1);
    expect(normalizedTrustEvent.observed_at).toBe(T1);
  });

  it('uses provider degradation event timestamp for recent degradations', () => {
    const store = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), [provider('alpha', 'Alpha API')], { observedAt: T1, source: 'pay.sh:test' }).snapshot);
    store.events.push({
      id: 'provider-degraded',
      type: 'provider.degraded',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'alpha',
      observedAt: T3,
      observed_at: T3,
      payload: { providerId: 'alpha', checked_at: T3, success: false, status: 'failed', monitor_mode: 'safe_metadata', check_type: 'service_url_reachability', safe_mode: true }
    } as InfopunksEvent);
    const summary = pulseSummary(store, T4);
    expect(summary.recentDegradations.find((event) => event.id === 'provider-degraded')?.observedAt).toBe(T3);
  });
});
