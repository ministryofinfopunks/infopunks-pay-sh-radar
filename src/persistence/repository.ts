import { Endpoint, InfopunksEvent, IngestionRun, MonitorRun, NarrativeCluster, Provider, SignalAssessment, TrustAssessment } from '../schemas/entities';

export type IntelligenceSnapshot = {
  events: InfopunksEvent[];
  providers: Provider[];
  endpoints: Endpoint[];
  trustAssessments: TrustAssessment[];
  signalAssessments: SignalAssessment[];
  narratives: NarrativeCluster[];
  ingestionRuns: IngestionRun[];
  monitorRuns: MonitorRun[];
};

export interface IntelligenceRepository {
  loadSnapshot(): Promise<IntelligenceSnapshot | null>;
  saveSnapshot(snapshot: IntelligenceSnapshot): Promise<void>;
}

export class MemoryRepository implements IntelligenceRepository {
  private snapshot: IntelligenceSnapshot | null = null;

  async loadSnapshot() {
    return this.snapshot;
  }

  async saveSnapshot(snapshot: IntelligenceSnapshot) {
    this.snapshot = snapshot;
  }
}
