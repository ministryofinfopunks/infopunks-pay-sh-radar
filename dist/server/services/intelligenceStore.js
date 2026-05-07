"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntelligenceStore = createIntelligenceStore;
exports.runPayShIngestion = runPayShIngestion;
exports.recomputeAssessments = recomputeAssessments;
exports.normalizeSnapshot = normalizeSnapshot;
exports.defaultRepository = defaultRepository;
const payShCatalogAdapter_1 = require("../ingestion/payShCatalogAdapter");
const signalEngine_1 = require("../engines/signalEngine");
const trustEngine_1 = require("../engines/trustEngine");
const repository_1 = require("../persistence/repository");
const postgresRepository_1 = require("../persistence/postgresRepository");
async function createIntelligenceStore(repository = defaultRepository()) {
    const existing = await repository.loadSnapshot();
    if (existing)
        return normalizeSnapshot(existing);
    const { items, source } = await (0, payShCatalogAdapter_1.loadPayShCatalog)();
    const { snapshot: ingested } = (0, payShCatalogAdapter_1.applyPayShCatalogIngestion)(emptySnapshot(), items, { source });
    const snapshot = recomputeAssessments(ingested);
    await repository.saveSnapshot(snapshot);
    return snapshot;
}
async function runPayShIngestion(store, repository, catalogUrl) {
    const { items, source, usedFixture } = await (0, payShCatalogAdapter_1.loadPayShCatalog)(catalogUrl);
    const { snapshot, run, events } = (0, payShCatalogAdapter_1.applyPayShCatalogIngestion)(store, items, { source });
    const recomputed = recomputeAssessments(snapshot);
    replaceStore(store, recomputed);
    await repository.saveSnapshot(store);
    return { run, events, usedFixture };
}
function recomputeAssessments(snapshot) {
    const trustAssessments = snapshot.providers.map((provider) => (0, trustEngine_1.computeTrustAssessment)(provider, snapshot.endpoints.filter((endpoint) => endpoint.providerId === provider.id), snapshot.events));
    const signalAssessments = snapshot.providers.map((provider) => (0, signalEngine_1.computeSignalAssessment)(provider, snapshot.providers));
    const narratives = (0, signalEngine_1.buildNarrativeClusters)(snapshot.providers, signalAssessments);
    return { ...snapshot, trustAssessments, signalAssessments, narratives };
}
function normalizeSnapshot(snapshot) {
    return { ...emptySnapshot(), ...snapshot, ingestionRuns: snapshot.ingestionRuns ?? [], monitorRuns: snapshot.monitorRuns ?? [] };
}
function replaceStore(target, source) {
    target.events = source.events;
    target.providers = source.providers;
    target.endpoints = source.endpoints;
    target.trustAssessments = source.trustAssessments;
    target.signalAssessments = source.signalAssessments;
    target.narratives = source.narratives;
    target.ingestionRuns = source.ingestionRuns;
    target.monitorRuns = source.monitorRuns;
}
function emptySnapshot() {
    return { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
}
function defaultRepository() {
    if (process.env.DATABASE_URL)
        return new postgresRepository_1.PostgresRepository(process.env.DATABASE_URL);
    return new repository_1.MemoryRepository();
}
