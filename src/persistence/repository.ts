import { Endpoint, InfopunksEvent, IngestionRun, MonitorRun, NarrativeCluster, Provider, SignalAssessment, TrustAssessment } from '../schemas/entities';

export type DataSourceState = {
  mode: 'live_pay_sh_catalog' | 'fixture_fallback';
  url: string | null;
  generated_at: string | null;
  provider_count: number | null;
  last_ingested_at: string | null;
  used_fixture: boolean;
  error?: string | null;
};

export type IntelligenceSnapshot = {
  events: InfopunksEvent[];
  providers: Provider[];
  endpoints: Endpoint[];
  trustAssessments: TrustAssessment[];
  signalAssessments: SignalAssessment[];
  narratives: NarrativeCluster[];
  ingestionRuns: IngestionRun[];
  monitorRuns: MonitorRun[];
  dataSource?: DataSourceState;
};

export type MonitorStateDelta = {
  providerEvidence: Array<{ providerId: string; evidence: Provider['evidence'] }>;
  endpointUpdates: Array<Pick<Endpoint, 'id' | 'status' | 'latencyMsP50'> & { evidence: Endpoint['evidence'] }>;
};

export type MonitorDelta = {
  run: MonitorRun;
  events: InfopunksEvent[];
  state: MonitorStateDelta;
};

export type LoadedSnapshotState = {
  snapshot: IntelligenceSnapshot | null;
  monitorDeltas: MonitorDelta[];
};

export function mergeMonitorDeltas(snapshot: IntelligenceSnapshot, deltas: MonitorDelta[]): IntelligenceSnapshot {
  const restored: IntelligenceSnapshot = {
    ...snapshot,
    events: [...snapshot.events],
    providers: [...snapshot.providers],
    endpoints: [...snapshot.endpoints],
    monitorRuns: [...(snapshot.monitorRuns ?? [])]
  };
  const eventIds = new Set(restored.events.map((event) => event.id));
  const runIds = new Set(restored.monitorRuns.map((run) => run.id));
  const providers = new Map(restored.providers.map((provider, index) => [provider.id, index]));
  const endpoints = new Map(restored.endpoints.map((endpoint, index) => [endpoint.id, index]));
  for (const delta of deltas) {
    for (const event of delta.events) {
      if (!eventIds.has(event.id)) {
        restored.events.push(event);
        eventIds.add(event.id);
      }
    }
    if (!runIds.has(delta.run.id)) {
      restored.monitorRuns.push(delta.run);
      runIds.add(delta.run.id);
    }
    for (const update of delta.state.providerEvidence) {
      const index = providers.get(update.providerId);
      if (index === undefined) continue;
      const provider = restored.providers[index]!;
      const evidence = new Map(provider.evidence.map((item) => [item.eventId, item]));
      for (const item of update.evidence) evidence.set(item.eventId, item);
      restored.providers[index] = { ...provider, evidence: [...evidence.values()] };
    }
    for (const update of delta.state.endpointUpdates) {
      const index = endpoints.get(update.id);
      if (index === undefined) continue;
      const endpoint = restored.endpoints[index]!;
      const evidence = new Map(endpoint.evidence.map((item) => [item.eventId, item]));
      for (const item of update.evidence) evidence.set(item.eventId, item);
      restored.endpoints[index] = { ...endpoint, evidence: [...evidence.values()], status: update.status, latencyMsP50: update.latencyMsP50 };
    }
  }
  restored.monitorRuns = restored.monitorRuns
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.id.localeCompare(a.id))
    .slice(0, 100);
  return restored;
}

export interface IntelligenceRepository {
  loadSnapshot(): Promise<IntelligenceSnapshot | null>;
  loadSnapshotState?(): Promise<LoadedSnapshotState>;
  saveSnapshot(snapshot: IntelligenceSnapshot): Promise<void>;
  saveMonitorDelta?(delta: MonitorDelta): Promise<void>;
  loadIngestionRuns(): Promise<IngestionRun[]>;
  saveIngestionRun(run: IngestionRun): Promise<void>;
}

export class MemoryRepository implements IntelligenceRepository {
  private snapshot: IntelligenceSnapshot | null = null;
  private ingestionRuns: IngestionRun[] = [];

  async loadSnapshot() {
    return this.snapshot;
  }

  async loadIngestionRuns() {
    return this.ingestionRuns;
  }

  async saveIngestionRun(run: IngestionRun) {
    this.ingestionRuns = [run, ...this.ingestionRuns.filter((existing) => existing.id !== run.id)]
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, 100);
  }

  async saveSnapshot(snapshot: IntelligenceSnapshot) {
    this.snapshot = snapshot;
    this.ingestionRuns = [...snapshot.ingestionRuns, ...this.ingestionRuns]
      .filter((run, index, runs) => runs.findIndex((candidate) => candidate.id === run.id) === index)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, 100);
  }

}
