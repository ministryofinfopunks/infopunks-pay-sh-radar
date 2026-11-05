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

export interface IntelligenceRepository {
  loadSnapshot(): Promise<IntelligenceSnapshot | null>;
  saveSnapshot(snapshot: IntelligenceSnapshot): Promise<void>;
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
