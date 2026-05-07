import { applyPayShCatalogIngestion, loadPayShCatalog } from '../ingestion/payShCatalogAdapter';
import { computeSignalAssessment, buildNarrativeClusters } from '../engines/signalEngine';
import { computeTrustAssessment } from '../engines/trustEngine';
import { IntelligenceRepository, IntelligenceSnapshot, MemoryRepository } from '../persistence/repository';
import { PostgresRepository } from '../persistence/postgresRepository';

export type IntelligenceStore = IntelligenceSnapshot;

export async function createIntelligenceStore(repository: IntelligenceRepository = defaultRepository()): Promise<IntelligenceStore> {
  const existing = await repository.loadSnapshot();
  if (existing) return normalizeSnapshot(existing);

  const { items, source } = await loadPayShCatalog();
  const { snapshot: ingested } = applyPayShCatalogIngestion(emptySnapshot(), items, { source });
  const snapshot = recomputeAssessments(ingested);
  await repository.saveSnapshot(snapshot);
  return snapshot;
}

export async function runPayShIngestion(store: IntelligenceStore, repository: IntelligenceRepository, catalogUrl?: string) {
  const { items, source, usedFixture } = await loadPayShCatalog(catalogUrl);
  const { snapshot, run, events } = applyPayShCatalogIngestion(store, items, { source });
  const recomputed = recomputeAssessments(snapshot);
  replaceStore(store, recomputed);
  await repository.saveSnapshot(store);
  return { run, events, usedFixture };
}

export function recomputeAssessments(snapshot: IntelligenceSnapshot): IntelligenceSnapshot {
  const trustAssessments = snapshot.providers.map((provider) => computeTrustAssessment(provider, snapshot.endpoints.filter((endpoint) => endpoint.providerId === provider.id), snapshot.events));
  const signalAssessments = snapshot.providers.map((provider) => computeSignalAssessment(provider, snapshot.providers));
  const narratives = buildNarrativeClusters(snapshot.providers, signalAssessments);
  return { ...snapshot, trustAssessments, signalAssessments, narratives };
}

export function normalizeSnapshot(snapshot: IntelligenceSnapshot): IntelligenceSnapshot {
  return { ...emptySnapshot(), ...snapshot, ingestionRuns: snapshot.ingestionRuns ?? [], monitorRuns: snapshot.monitorRuns ?? [] };
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
}

function emptySnapshot(): IntelligenceSnapshot {
  return { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
}

export function defaultRepository(): IntelligenceRepository {
  if (process.env.DATABASE_URL) return new PostgresRepository(process.env.DATABASE_URL);
  return new MemoryRepository();
}
