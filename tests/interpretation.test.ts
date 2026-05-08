import { describe, expect, it } from 'vitest';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { pulseSummary } from '../src/services/pulseService';
import { createInterpretationId } from '../src/services/interpretationService';

const emptySnapshot = (): IntelligenceSnapshot => ({
  events: [],
  providers: [],
  endpoints: [],
  trustAssessments: [],
  signalAssessments: [],
  narratives: [],
  ingestionRuns: [],
  monitorRuns: []
});

function catalogItem(slug: string, category: string, tags: string[], description: string): PayShCatalogItem {
  return {
    name: `${slug} API`,
    namespace: `pay/${slug}`,
    slug,
    category,
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description,
    tags,
    service_url: `https://${slug}.test`,
    endpointDetails: [{
      name: 'Run',
      path: '/run',
      method: 'POST',
      category,
      description: `${slug} endpoint`,
      price: '$0.01',
      status: 'available',
      schema: { response: { type: 'object', properties: { ok: { type: 'boolean' } } } }
    }]
  };
}

function storeFrom(catalog: PayShCatalogItem[]) {
  return recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot(), catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot);
}

function degradation(providerId: string, observedAt: string): InfopunksEvent {
  return {
    id: `degraded-${providerId}-${observedAt}`,
    type: 'provider.degraded',
    source: 'infopunks:safe-metadata-monitor',
    entityType: 'provider',
    entityId: providerId,
    observedAt,
    payload: {
      providerId,
      checked_at: observedAt,
      monitor_mode: 'safe_metadata',
      check_type: 'service_url_reachability',
      safe_mode: true,
      success: false,
      status_code: 503,
      response_time_ms: 2400
    }
  };
}

function unknownMovement(providerId: string, observedAt: string): InfopunksEvent {
  return {
    id: `unknown-${providerId}-${observedAt}`,
    type: 'score_assessment_created',
    source: 'infopunks:deterministic-scoring',
    entityType: 'trust_assessment',
    entityId: `trust-${providerId}`,
    observedAt,
    payload: {
      assessmentId: `trust-${providerId}`,
      entityId: providerId,
      entityType: 'provider',
      providerId,
      score: 64,
      previousScore: 76,
      delta: -12,
      unknowns: ['receiptReliability', 'latency'],
      evidenceEventIds: []
    }
  };
}

describe('ecosystem interpretation layer', () => {
  it('generates deterministic interpretation IDs independent of input ordering', () => {
    const first = createInterpretationId({
      interpretation_title: 'Test interpretation',
      supporting_event_ids: ['e3', 'e1', 'e2'],
      affected_providers: ['b', 'a'],
      affected_categories: ['Media', 'Data'],
      severity: 'watch',
      observed_window: { started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-01-01T01:00:00.000Z', event_count: 3 }
    });
    const second = createInterpretationId({
      interpretation_title: 'Test interpretation',
      supporting_event_ids: ['e2', 'e1', 'e3'],
      affected_providers: ['a', 'b'],
      affected_categories: ['Data', 'Media'],
      severity: 'watch',
      observed_window: { started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-01-01T01:00:00.000Z', event_count: 3 }
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^interpretation-[a-f0-9]{24}$/);
  });

  it('generates media instability interpretation for a degraded image/OCR/video cluster', () => {
    const store = storeFrom([
      catalogItem('imageforge', 'Media', ['image', 'generation'], 'Image generation provider.'),
      catalogItem('ocrlens', 'Media', ['ocr', 'vision'], 'OCR media provider.'),
      catalogItem('videomix', 'Media', ['video', 'multimodal'], 'Video generation provider.')
    ]);
    store.events.push(
      degradation('imageforge', '2026-01-02T00:00:00.000Z'),
      degradation('ocrlens', '2026-01-02T00:01:00.000Z'),
      degradation('videomix', '2026-01-02T00:02:00.000Z')
    );

    const summary = pulseSummary(store, '2026-01-02T00:03:00.000Z');
    expect(summary.interpretations[0].interpretation_title).toBe('Operational instability increasing across media inference providers.');
    expect(summary.interpretations[0].affected_providers).toEqual(['imageforge', 'ocrlens', 'videomix']);
  });

  it('generates metadata reliability interpretation for rising unknown telemetry', () => {
    const store = storeFrom([
      catalogItem('discover-a', 'Discovery', ['metadata'], 'Discovery metadata provider.'),
      catalogItem('discover-b', 'Discovery', ['search'], 'Discovery search provider.')
    ]);
    store.events.push(
      unknownMovement('discover-a', '2026-01-02T00:00:00.000Z'),
      unknownMovement('discover-b', '2026-01-02T00:01:00.000Z')
    );

    const summary = pulseSummary(store, '2026-01-02T00:02:00.000Z');
    expect(summary.interpretations[0].interpretation_title).toBe('Metadata reliability degrading across discovery surfaces.');
    expect(summary.interpretations[0].supporting_event_ids).toEqual(expect.arrayContaining(['unknown-discover-a-2026-01-02T00:00:00.000Z', 'unknown-discover-b-2026-01-02T00:01:00.000Z']));
  });

  it('does not claim ecosystem-wide instability for an isolated provider issue', () => {
    const store = storeFrom([
      catalogItem('imageforge', 'Media', ['image'], 'Image generation provider.'),
      catalogItem('stabledata', 'Data', ['lookup'], 'Stable lookup provider.')
    ]);
    store.events.push(degradation('imageforge', '2026-01-02T00:00:00.000Z'));

    const summary = pulseSummary(store, '2026-01-02T00:01:00.000Z');
    expect(summary.interpretations[0].interpretation_title).toBe('Trust movement is isolated to a single provider.');
    expect(summary.interpretations.map((item) => item.interpretation_title)).not.toContain('Operational instability increasing across media inference providers.');
  });

  it('generates stable-state interpretation when events contain no meaningful change', () => {
    const summary = pulseSummary(emptySnapshot(), '2026-01-02T00:00:00.000Z');
    expect(summary.interpretations[0]).toMatchObject({
      interpretation_title: 'Ecosystem state is stable.',
      severity: 'stable',
      affected_providers: []
    });
    expect(summary.interpretations[0].interpretation_id).toMatch(/^interpretation-[a-f0-9]{24}$/);
  });
});
