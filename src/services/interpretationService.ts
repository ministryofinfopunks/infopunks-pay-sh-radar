import { createHash } from 'node:crypto';
import type { IntelligenceStore } from './intelligenceStore';
import type { AuditReceipt, PulseEvent, ScoreDelta } from './pulseService';

export type InterpretationSeverity = 'stable' | 'info' | 'watch' | 'warning' | 'critical';

export type EcosystemInterpretation = {
  interpretation_id: string;
  interpretation_title: string;
  interpretation_summary: string;
  interpretation_reason: string;
  affected_categories: string[];
  affected_providers: string[];
  supporting_event_ids: string[];
  confidence: number;
  severity: InterpretationSeverity;
  observed_window: {
    started_at: string | null;
    ended_at: string | null;
    event_count: number;
  };
  evidence: AuditReceipt;
};

type InterpretationInput = {
  store: IntelligenceStore;
  events: PulseEvent[];
  trustDeltas: ScoreDelta[];
  signalDeltas: ScoreDelta[];
  recentDegradations: PulseEvent[];
  generatedAt: string;
};

type Candidate = Omit<EcosystemInterpretation, 'interpretation_id' | 'evidence'> & { rank: number };

const mediaTerms = ['media', 'image', 'video', 'ocr', 'vision', 'multimodal'];
const metadataEventTypes = new Set(['metadata.changed', 'schema.changed', 'endpoint.updated', 'manifest.updated']);

export function interpretEcosystem(input: InterpretationInput): EcosystemInterpretation[] {
  const providerById = new Map(input.store.providers.map((provider) => [provider.id, provider]));
  const candidates: Candidate[] = [];

  const mediaDegradations = input.recentDegradations.filter((event) => {
    const provider = event.providerId ? providerById.get(event.providerId) : null;
    return provider ? providerMatchesTerms(provider, mediaTerms) : eventMatchesTerms(event, mediaTerms);
  });
  const degradedMediaProviders = unique(mediaDegradations.map((event) => event.providerId).filter(isString));
  if (degradedMediaProviders.length >= 2) {
    candidates.push({
      rank: 100,
      interpretation_title: 'Operational instability increasing across media inference providers.',
      interpretation_summary: 'Multiple media, image, OCR, or video providers have recent degradation evidence in the event spine.',
      interpretation_reason: `Detected ${mediaDegradations.length} recent monitoring degradation events across ${degradedMediaProviders.length} media-related providers.`,
      affected_categories: affectedCategories(degradedMediaProviders, providerById),
      affected_providers: degradedMediaProviders,
      supporting_event_ids: mediaDegradations.map((event) => event.id),
      confidence: confidenceFromEvents(mediaDegradations, 0.9),
      severity: 'warning',
      observed_window: observedWindow(mediaDegradations)
    });
  }

  const trustDrops = input.trustDeltas.filter((delta) => delta.direction === 'down' && (delta.delta ?? 0) <= -5);
  const dropsByCategory = groupBy(trustDrops, (delta) => providerById.get(delta.providerId)?.category ?? 'unknown');
  for (const [category, deltas] of dropsByCategory) {
    const providers = unique(deltas.map((delta) => delta.providerId));
    if (providers.length < 2) continue;
    candidates.push({
      rank: 90,
      interpretation_title: `Trust reliability weakening inside ${category}.`,
      interpretation_summary: 'Repeated trust drops are concentrated in one provider category.',
      interpretation_reason: `Detected ${deltas.length} trust score drops across ${providers.length} ${category} providers.`,
      affected_categories: [category],
      affected_providers: providers,
      supporting_event_ids: deltas.map((delta) => delta.eventId),
      confidence: confidenceFromDeltas(deltas, 0.86),
      severity: 'watch',
      observed_window: observedWindowFromDeltas(deltas)
    });
  }

  const unknownMovementEvents = input.events.filter((event) => {
    const unknowns = Array.isArray(event.payload.unknowns) ? event.payload.unknowns : [];
    return metadataEventTypes.has(event.type) || (event.type === 'score_assessment_created' && unknowns.length > 0 && event.payload.previousScore !== null);
  });
  const affectedUnknownProviders = unique(unknownMovementEvents.map((event) => event.providerId).filter(isString));
  if (unknownMovementEvents.length >= 2 || affectedUnknownProviders.length >= 2) {
    candidates.push({
      rank: 95,
      interpretation_title: 'Metadata reliability degrading across discovery surfaces.',
      interpretation_summary: 'Unknown telemetry and metadata/schema movement are visible in recent evidence.',
      interpretation_reason: `Detected ${unknownMovementEvents.length} metadata or unknown-telemetry movement events across ${Math.max(affectedUnknownProviders.length, 1)} providers.`,
      affected_categories: affectedCategories(affectedUnknownProviders, providerById),
      affected_providers: affectedUnknownProviders,
      supporting_event_ids: unknownMovementEvents.map((event) => event.id),
      confidence: confidenceFromEvents(unknownMovementEvents, 0.78),
      severity: 'watch',
      observed_window: observedWindow(unknownMovementEvents)
    });
  }

  const signalSpikes = input.signalDeltas.filter((delta) => delta.direction === 'up' && (delta.delta ?? 0) > 0);
  const spikesByCategory = groupBy(signalSpikes, (delta) => providerById.get(delta.providerId)?.category ?? 'unknown');
  for (const [category, deltas] of spikesByCategory) {
    const providers = unique(deltas.map((delta) => delta.providerId));
    const signalShare = input.signalDeltas.length ? deltas.length / input.signalDeltas.length : 0;
    if (providers.length < 2 || signalShare < 0.5) continue;
    candidates.push({
      rank: 70,
      interpretation_title: `${category} signal remains the dominant ecosystem narrative.`,
      interpretation_summary: 'Positive signal movement is concentrated around one provider category.',
      interpretation_reason: `${deltas.length} of ${input.signalDeltas.length} signal movements are positive changes in ${category}.`,
      affected_categories: [category],
      affected_providers: providers,
      supporting_event_ids: deltas.map((delta) => delta.eventId),
      confidence: confidenceFromDeltas(deltas, 0.76),
      severity: 'info',
      observed_window: observedWindowFromDeltas(deltas)
    });
  }

  if (input.recentDegradations.length === 1 && degradedMediaProviders.length < 2) {
    const event = input.recentDegradations[0];
    const providerId = event.providerId ? [event.providerId] : [];
    candidates.push({
      rank: 60,
      interpretation_title: 'Trust movement is isolated to a single provider.',
      interpretation_summary: 'Current degradation evidence points to one provider rather than an ecosystem-wide pattern.',
      interpretation_reason: `Only one recent degradation event is present: ${event.type} for ${event.providerName ?? event.entityId}.`,
      affected_categories: affectedCategories(providerId, providerById),
      affected_providers: providerId,
      supporting_event_ids: [event.id],
      confidence: confidenceFromEvents([event], 0.84),
      severity: 'watch',
      observed_window: observedWindow([event])
    });
  }

  const sorted = candidates
    .sort((a, b) => b.rank - a.rank || b.supporting_event_ids.length - a.supporting_event_ids.length || a.interpretation_title.localeCompare(b.interpretation_title))
    .slice(0, 5)
    .map((candidate) => finalize(candidate, input));

  if (sorted.length > 0) return sorted;
  return [stableInterpretation(input)];
}

function stableInterpretation(input: InterpretationInput): EcosystemInterpretation {
  const eventIds = input.events.slice(0, 5).map((event) => event.id);
  return finalize({
    rank: 0,
    interpretation_title: 'Ecosystem state is stable.',
    interpretation_summary: 'No meaningful cross-provider degradation, trust-drop, unknown-telemetry, or signal-concentration pattern is present in current evidence.',
    interpretation_reason: 'The interpretation layer found no multi-provider pattern above deterministic thresholds.',
    affected_categories: [],
    affected_providers: [],
    supporting_event_ids: eventIds,
    confidence: input.events.length ? 0.72 : 0.6,
    severity: 'stable',
    observed_window: observedWindow(input.events)
  }, input);
}

function finalize(candidate: Candidate, input: InterpretationInput): EcosystemInterpretation {
  const evidenceEvent = input.events.find((event) => candidate.supporting_event_ids.includes(event.id)) ?? input.events[0] ?? null;
  const evidence: AuditReceipt = evidenceEvent?.evidence ?? {
    event_id: candidate.supporting_event_ids[0] ?? null,
    provider_id: candidate.affected_providers[0] ?? null,
    endpoint_id: null,
    observed_at: candidate.observed_window.ended_at ?? input.generatedAt,
    catalog_generated_at: input.store.dataSource?.generated_at ?? null,
    ingested_at: input.store.dataSource?.last_ingested_at ?? input.generatedAt,
    source: 'infopunks:interpretation-layer',
    derivation_reason: candidate.interpretation_reason,
    confidence: candidate.confidence
  };
  const id = createInterpretationId(candidate);
  return {
    interpretation_id: id,
    interpretation_title: candidate.interpretation_title,
    interpretation_summary: candidate.interpretation_summary,
    interpretation_reason: candidate.interpretation_reason,
    affected_categories: candidate.affected_categories.sort(),
    affected_providers: candidate.affected_providers.sort(),
    supporting_event_ids: unique(candidate.supporting_event_ids).sort(),
    confidence: roundConfidence(candidate.confidence),
    severity: candidate.severity,
    observed_window: candidate.observed_window,
    evidence: { ...evidence, derivation_reason: candidate.interpretation_reason, confidence: roundConfidence(candidate.confidence) }
  };
}

export function createInterpretationId(input: Pick<EcosystemInterpretation, 'interpretation_title' | 'supporting_event_ids' | 'affected_providers' | 'affected_categories' | 'severity' | 'observed_window'>) {
  const canonical = {
    interpretation_title: input.interpretation_title,
    supporting_event_ids: unique(input.supporting_event_ids).sort(),
    affected_providers: unique(input.affected_providers).sort(),
    affected_categories: unique(input.affected_categories).sort(),
    severity: input.severity,
    observed_window: input.observed_window
  };
  return `interpretation-${createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 24)}`;
}

function providerMatchesTerms(provider: { category: string; name: string; description: string | null; tags: string[] }, terms: string[]) {
  return terms.some((term) => `${provider.category} ${provider.name} ${provider.description ?? ''} ${provider.tags.join(' ')}`.toLowerCase().includes(term));
}

function eventMatchesTerms(event: PulseEvent, terms: string[]) {
  return terms.some((term) => `${event.providerName ?? ''} ${event.entityId} ${event.summary}`.toLowerCase().includes(term));
}

function affectedCategories(providerIds: string[], providerById: Map<string, { category: string }>) {
  return unique(providerIds.map((id) => providerById.get(id)?.category).filter(isString));
}

function observedWindow(events: PulseEvent[]) {
  const times = events.map((event) => event.observedAt).filter(Boolean).sort();
  return {
    started_at: times[0] ?? null,
    ended_at: times[times.length - 1] ?? null,
    event_count: events.length
  };
}

function observedWindowFromDeltas(deltas: ScoreDelta[]) {
  const times = deltas.map((delta) => delta.observedAt).filter(Boolean).sort();
  return {
    started_at: times[0] ?? null,
    ended_at: times[times.length - 1] ?? null,
    event_count: deltas.length
  };
}

function confidenceFromEvents(events: PulseEvent[], cap: number) {
  if (!events.length) return 0.5;
  return Math.min(cap, events.reduce((sum, event) => sum + event.confidence, 0) / events.length);
}

function confidenceFromDeltas(deltas: ScoreDelta[], cap: number) {
  if (!deltas.length) return 0.5;
  return Math.min(cap, deltas.reduce((sum, delta) => sum + delta.confidence, 0) / deltas.length);
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function roundConfidence(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}
