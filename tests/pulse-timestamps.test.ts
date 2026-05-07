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
});
