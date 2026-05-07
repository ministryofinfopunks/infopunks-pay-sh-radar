import { createHash } from 'node:crypto';
import { applyPayShCatalogIngestion, loadPayShCatalog } from '../ingestion/payShCatalogAdapter';
import { computeSignalAssessment, buildNarrativeClusters } from '../engines/signalEngine';
import { computeTrustAssessment } from '../engines/trustEngine';
import { IntelligenceRepository, IntelligenceSnapshot, MemoryRepository } from '../persistence/repository';
import { PostgresRepository } from '../persistence/postgresRepository';
import { InfopunksEvent, SignalAssessment, TrustAssessment } from '../schemas/entities';

export type IntelligenceStore = IntelligenceSnapshot;

export async function createIntelligenceStore(repository: IntelligenceRepository = defaultRepository()): Promise<IntelligenceStore> {
  const existing = await repository.loadSnapshot();
  if (existing) return normalizeSnapshot(existing);

  const { items, source, dataSource } = await loadPayShCatalog();
  const { snapshot: ingested } = applyPayShCatalogIngestion(emptySnapshot(), items, { source, dataSource });
  const snapshot = recomputeAssessments(ingested);
  await repository.saveSnapshot(snapshot);
  return snapshot;
}

export async function runPayShIngestion(store: IntelligenceStore, repository: IntelligenceRepository, catalogUrl?: string) {
  const { items, source, usedFixture, dataSource } = await loadPayShCatalog(catalogUrl);
  const { snapshot, run, events } = applyPayShCatalogIngestion(store, items, { source, dataSource });
  const recomputed = recomputeAssessments(snapshot);
  replaceStore(store, recomputed);
  await repository.saveSnapshot(store);
  return { run, events, usedFixture };
}

export function recomputeAssessments(snapshot: IntelligenceSnapshot): IntelligenceSnapshot {
  const normalizedEvents = normalizeScoreEventTimestamps(snapshot.events);
  const trustAssessments = snapshot.providers.map((provider) => computeTrustAssessment(provider, snapshot.endpoints.filter((endpoint) => endpoint.providerId === provider.id), normalizedEvents));
  const signalAssessments = snapshot.providers.map((provider) => computeSignalAssessment(provider, snapshot.providers));
  const narratives = buildNarrativeClusters(snapshot.providers, signalAssessments);
  const events = appendScoreAssessmentEvents(normalizedEvents, trustAssessments, signalAssessments);
  return { ...snapshot, events, trustAssessments, signalAssessments, narratives };
}

export function normalizeSnapshot(snapshot: IntelligenceSnapshot): IntelligenceSnapshot {
  const normalized = { ...emptySnapshot(), ...snapshot, ingestionRuns: snapshot.ingestionRuns ?? [], monitorRuns: snapshot.monitorRuns ?? [] };
  const events = normalizeScoreEventTimestamps(normalized.events);
  return { ...normalized, events: appendScoreAssessmentEvents(events, normalized.trustAssessments, normalized.signalAssessments) };
}

function replaceStore(target: IntelligenceStore, source: IntelligenceStore) {
  target.events = source.events;
  target.providers = source.providers;
  target.endpoints = source.endpoints;
  target.trustAssessments = source.trustAssessments;
  target.signalAssessments = source.signalAssessments;
  target.narratives = source.narratives;
  target.ingestionRuns = source.ingestionRuns;
  target.monitorRuns = source.monitorRuns;
  target.dataSource = source.dataSource;
}

function emptySnapshot(): IntelligenceSnapshot {
  return { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
}

function appendScoreAssessmentEvents(events: InfopunksEvent[], trustAssessments: TrustAssessment[], signalAssessments: SignalAssessment[]) {
  const nextEvents = [...events];
  const existingIds = new Set(nextEvents.map((event) => event.id));

  for (const assessment of trustAssessments) {
    const previous = latestScoreEvent(nextEvents, 'trust_assessment', assessment.entityId);
    if (previous && previous.payload.score === assessment.score) continue;
    const event = scoreEvent('trust_assessment', assessment, previous);
    if (!existingIds.has(event.id)) {
      existingIds.add(event.id);
      nextEvents.push(event);
    }
  }

  for (const assessment of signalAssessments) {
    const previous = latestScoreEvent(nextEvents, 'signal_assessment', assessment.entityId);
    if (previous && previous.payload.score === assessment.score) continue;
    const event = scoreEvent('signal_assessment', assessment, previous);
    if (!existingIds.has(event.id)) {
      existingIds.add(event.id);
      nextEvents.push(event);
    }
  }

  return nextEvents;
}

function latestScoreEvent(events: InfopunksEvent[], entityType: 'trust_assessment' | 'signal_assessment', providerId: string) {
  return events
    .filter((event) => event.type === 'score_assessment_created' && event.entityType === entityType && event.payload.entityId === providerId)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;
}

function scoreEvent(entityType: 'trust_assessment' | 'signal_assessment', assessment: TrustAssessment | SignalAssessment, previous: InfopunksEvent | null): InfopunksEvent {
  const previousScore = numericScore(previous?.payload.score);
  const score = assessment.score;
  const evidenceEventIds = Object.values(assessment.evidence).flat().map((item) => item.eventId).sort();
  const observedAt = scoreObservedAt(assessment, previous);
  const payload = stableJson({
    assessmentId: assessment.id,
    entityId: assessment.entityId,
    entityType: assessment.entityType,
    score,
    previousScore,
    delta: score !== null && previousScore !== null ? score - previousScore : null,
    components: assessment.components,
    unknowns: assessment.unknowns,
    evidenceEventIds
  }) as Record<string, unknown>;

  return {
    id: stableId(['score_assessment_created', entityType, assessment.entityId, previous?.id ?? 'initial', score, evidenceEventIds, observedAt]),
    type: 'score_assessment_created',
    source: 'infopunks:deterministic-scoring',
    entityType,
    entityId: assessment.id,
    observedAt,
    payload
  };
}

function scoreObservedAt(assessment: TrustAssessment | SignalAssessment, previous: InfopunksEvent | null) {
  const evidenceTimes = Object.values(assessment.evidence)
    .flat()
    .map((item) => item.observedAt)
    .filter(isValidTimestamp);
  return latestTimestamp(evidenceTimes) ?? previous?.observedAt ?? assessment.assessedAt;
}

function normalizeScoreEventTimestamps(events: InfopunksEvent[]) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return events.map((event) => {
    if (event.type !== 'score_assessment_created') return event;
    const evidenceEventIds = Array.isArray(event.payload.evidenceEventIds) ? event.payload.evidenceEventIds : [];
    const evidenceTimes = evidenceEventIds
      .map((id) => typeof id === 'string' ? byId.get(id)?.observedAt : null)
      .filter((value): value is string => Boolean(value && isValidTimestamp(value)));
    const observedAt = latestTimestamp(evidenceTimes);
    return observedAt && observedAt !== event.observedAt ? { ...event, observedAt } : event;
  });
}

function latestTimestamp(values: string[]) {
  return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function isValidTimestamp(value: string) {
  return Number.isFinite(Date.parse(value));
}

function numericScore(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function stableId(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(stableJson(parts))).digest('hex').slice(0, 24);
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableJson(nested)]));
  }
  return value ?? null;
}

export function defaultRepository(): IntelligenceRepository {
  if (process.env.DATABASE_URL) return new PostgresRepository(process.env.DATABASE_URL);
  return new MemoryRepository();
}
