import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { type RhChainSignalSubmission, type RhChainSubmissionStore } from './rhChainSignalVault';
import type { RhChainLiveSnapshotService } from './rhChainLiveSnapshotService';
import { assembleRhChainTokenDossier } from './rhChainTokenDossierService';
import { isRhChainIdentityContract } from './rhChainTruthGuards';
import { InMemoryRhChainMetricsSnapshotStore, RhChainChainPulseService } from './rhChainChainPulseService';
import { InMemoryRhChainMemePulseSnapshotStore, RhChainMemePulseSnapshotService } from './rhChainMemePulseSnapshotService';
import { InMemoryRhChainLaunchpadSnapshotStore, RhChainLaunchpadSnapshotService } from './rhChainLaunchpadSnapshotService';
import { InMemoryRhChainDailyReceiptDraftStore, RhChainDailyReceiptDraftService } from './rhChainDailyReceiptDraftService';
import { InMemoryRhChainRiskCorrelationSnapshotStore, RhChainRiskCorrelationSweepService } from './rhChainRiskCorrelationSweepService';

export const RH_CHAIN_AUTOMATION_JOB_NAMES = [
  'rh_chain_pulse_refresh',
  'rh_meme_pulse_refresh',
  'rh_launchpad_observatory_refresh',
  'rh_token_dossier_enrichment',
  'rh_clone_risk_correlation',
  'rh_daily_receipt_draft',
  'rh_freshness_sweep'
] as const;

export type RhChainAutomationJobName = typeof RH_CHAIN_AUTOMATION_JOB_NAMES[number];
export type RhChainAutomationJobStatus = 'success' | 'failed' | 'skipped' | 'locked';
export type RhChainAutomationRun = {
  job_id: string;
  job_name: RhChainAutomationJobName;
  started_at: string;
  finished_at: string | null;
  status: RhChainAutomationJobStatus;
  error_summary: string | null;
  records_observed: number;
  records_updated: number;
  data_mode: string;
  sources: string[];
};

export type RhChainAutomationDraft = {
  draft_id: string;
  job_id: string;
  job_name: RhChainAutomationJobName;
  draft_type: 'context_observation' | 'token_dossier_draft' | 'risk_correlation_draft' | 'daily_receipt_draft' | 'freshness_observation';
  created_at: string;
  data_mode: string;
  sources: string[];
  payload: unknown;
};

export interface RhChainAutomationStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  tryAcquireLock(jobName: RhChainAutomationJobName, instanceId: string, ttlMs: number): Promise<boolean>;
  releaseLock(jobName: RhChainAutomationJobName, instanceId: string): Promise<void>;
  saveRun(run: RhChainAutomationRun): Promise<void>;
  listRuns(): Promise<RhChainAutomationRun[]>;
  saveDraft(draft: RhChainAutomationDraft): Promise<void>;
  close?(): Promise<void>;
}

export class InMemoryRhChainAutomationStore implements RhChainAutomationStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly locks = new Map<string, { instanceId: string; expiresAt: number }>();
  private readonly runs = new Map<string, RhChainAutomationRun>();
  private readonly drafts = new Map<string, RhChainAutomationDraft>();

  async tryAcquireLock(jobName: RhChainAutomationJobName, instanceId: string, ttlMs: number) {
    const existing = this.locks.get(jobName);
    if (existing && existing.expiresAt > Date.now()) return false;
    this.locks.set(jobName, { instanceId, expiresAt: Date.now() + ttlMs });
    return true;
  }
  async releaseLock(jobName: RhChainAutomationJobName, instanceId: string) {
    if (this.locks.get(jobName)?.instanceId === instanceId) this.locks.delete(jobName);
  }
  async saveRun(run: RhChainAutomationRun) { this.runs.set(run.job_id, structuredClone(run)); }
  async listRuns() { return [...this.runs.values()].sort((a, b) => b.started_at.localeCompare(a.started_at)).map((run) => structuredClone(run)); }
  async saveDraft(draft: RhChainAutomationDraft) { this.drafts.set(draft.draft_id, structuredClone(draft)); }
}

/** Durable job locks and immutable run/draft records. No review, index, or receipt tables are writable here. */
export class PostgresRhChainAutomationStore implements RhChainAutomationStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | null = null;
  constructor(connectionString: string) { this.pool = new pg.Pool({ connectionString }); }

  async tryAcquireLock(jobName: RhChainAutomationJobName, instanceId: string, ttlMs: number) {
    await this.ensureSchema();
    const result = await this.pool.query(
      `insert into rh_chain_automation_locks (job_name, locked_by, locked_until)
       values ($1, $2, now() + ($3 * interval '1 millisecond'))
       on conflict (job_name) do update set locked_by = excluded.locked_by, locked_until = excluded.locked_until
       where rh_chain_automation_locks.locked_until <= now()
       returning job_name`,
      [jobName, instanceId, ttlMs]
    );
    return result.rowCount === 1;
  }
  async releaseLock(jobName: RhChainAutomationJobName, instanceId: string) {
    await this.ensureSchema();
    await this.pool.query('delete from rh_chain_automation_locks where job_name = $1 and locked_by = $2', [jobName, instanceId]);
  }
  async saveRun(run: RhChainAutomationRun) {
    await this.ensureSchema();
    await this.pool.query(
      `insert into rh_chain_automation_runs (job_id, job_name, started_at, finished_at, status, error_summary, records_observed, records_updated, data_mode, sources)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       on conflict (job_id) do update set finished_at=excluded.finished_at, status=excluded.status, error_summary=excluded.error_summary, records_observed=excluded.records_observed, records_updated=excluded.records_updated, data_mode=excluded.data_mode, sources=excluded.sources`,
      [run.job_id, run.job_name, run.started_at, run.finished_at, run.status, run.error_summary, run.records_observed, run.records_updated, run.data_mode, JSON.stringify(run.sources)]
    );
  }
  async listRuns() {
    await this.ensureSchema();
    const result = await this.pool.query<RhChainAutomationRun>('select job_id, job_name, started_at, finished_at, status, error_summary, records_observed, records_updated, data_mode, sources from rh_chain_automation_runs order by started_at desc limit 100');
    return result.rows.map((row) => ({ ...row, sources: Array.isArray(row.sources) ? row.sources : [] }));
  }
  async saveDraft(draft: RhChainAutomationDraft) {
    await this.ensureSchema();
    await this.pool.query('insert into rh_chain_automation_drafts (draft_id, job_id, job_name, draft_type, created_at, data_mode, sources, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)', [draft.draft_id, draft.job_id, draft.job_name, draft.draft_type, draft.created_at, draft.data_mode, JSON.stringify(draft.sources), JSON.stringify(draft.payload)]);
  }
  async close() { await this.pool.end(); }
  private ensureSchema() {
    this.schemaReady ??= this.pool.query(`
      create table if not exists rh_chain_automation_locks (job_name text primary key, locked_by text not null, locked_until timestamptz not null);
      create table if not exists rh_chain_automation_runs (job_id text primary key, job_name text not null, started_at timestamptz not null, finished_at timestamptz, status text not null check (status in ('success','failed','skipped','locked')), error_summary text, records_observed integer not null, records_updated integer not null, data_mode text not null, sources jsonb not null);
      create index if not exists rh_chain_automation_runs_started_at_idx on rh_chain_automation_runs (started_at desc);
      create table if not exists rh_chain_automation_drafts (draft_id text primary key, job_id text not null, job_name text not null, draft_type text not null, created_at timestamptz not null, data_mode text not null, sources jsonb not null, payload jsonb not null);
    `).then(() => undefined);
    return this.schemaReady;
  }
}

type JobResult = { recordsObserved: number; recordsUpdated: number; dataMode: string; sources: string[] };
export type RhChainAutomationServiceOptions = {
  enabled: boolean;
  isProduction: boolean;
  instanceId: string;
  lockTtlMs: number;
  store: RhChainAutomationStore;
  snapshots: RhChainLiveSnapshotService;
  chainPulseSnapshots?: RhChainChainPulseService;
  memePulseSnapshots?: RhChainMemePulseSnapshotService;
  launchpadSnapshots?: RhChainLaunchpadSnapshotService;
  dailyReceiptDrafts?: RhChainDailyReceiptDraftService;
  riskCorrelationSweep?: RhChainRiskCorrelationSweepService;
  submissions: Pick<RhChainSubmissionStore, 'list'>;
  now?: () => Date;
};

/**
 * Executes only context refreshes and isolated draft writes. This class intentionally
 * has no reference to review update, receipt publication, or 4663 index mutation APIs.
 */
export class RhChainAutomationService {
  private readonly now: () => Date;
  private readonly chainPulseSnapshots: RhChainChainPulseService;
  private readonly memePulseSnapshots: RhChainMemePulseSnapshotService;
  private readonly launchpadSnapshots: RhChainLaunchpadSnapshotService;
  private readonly dailyReceiptDrafts: RhChainDailyReceiptDraftService;
  private readonly riskCorrelationSweep: RhChainRiskCorrelationSweepService;
  constructor(private readonly options: RhChainAutomationServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.chainPulseSnapshots = options.chainPulseSnapshots ?? new RhChainChainPulseService(new InMemoryRhChainMetricsSnapshotStore(), this.now);
    this.memePulseSnapshots = options.memePulseSnapshots ?? new RhChainMemePulseSnapshotService(new InMemoryRhChainMemePulseSnapshotStore(), options.snapshots, this.now);
    this.launchpadSnapshots = options.launchpadSnapshots ?? new RhChainLaunchpadSnapshotService(new InMemoryRhChainLaunchpadSnapshotStore(), options.submissions, this.now);
    this.dailyReceiptDrafts = options.dailyReceiptDrafts ?? new RhChainDailyReceiptDraftService(new InMemoryRhChainDailyReceiptDraftStore(), this.chainPulseSnapshots, this.memePulseSnapshots, this.launchpadSnapshots, options.snapshots, options.submissions, this.now);
    this.riskCorrelationSweep = options.riskCorrelationSweep ?? new RhChainRiskCorrelationSweepService(new InMemoryRhChainRiskCorrelationSnapshotStore(), options.submissions, this.now);
  }
  get durableLockAvailable() { return this.options.store.durable; }
  get enabled() { return this.options.enabled; }
  async listRuns() { return this.options.store.listRuns(); }

  async run(jobName: RhChainAutomationJobName): Promise<RhChainAutomationRun> {
    const startedAt = this.now().toISOString();
    const jobId = randomUUID();
    if (!this.options.enabled) return this.complete({ job_id: jobId, job_name: jobName, started_at: startedAt, finished_at: null, status: 'skipped', error_summary: 'rh_chain_automation_disabled', records_observed: 0, records_updated: 0, data_mode: 'unavailable', sources: [] });
    if (this.options.isProduction && !this.options.store.durable) return this.complete({ job_id: jobId, job_name: jobName, started_at: startedAt, finished_at: null, status: 'skipped', error_summary: 'durable_lock_required_in_production', records_observed: 0, records_updated: 0, data_mode: 'unavailable', sources: [] });
    let locked = false;
    try {
      locked = await this.options.store.tryAcquireLock(jobName, this.options.instanceId, this.options.lockTtlMs);
      if (!locked) return this.complete({ job_id: jobId, job_name: jobName, started_at: startedAt, finished_at: null, status: 'locked', error_summary: 'job_lock_held', records_observed: 0, records_updated: 0, data_mode: 'unavailable', sources: [] });
      const result = await this.execute(jobName, jobId);
      return this.complete({ job_id: jobId, job_name: jobName, started_at: startedAt, finished_at: null, status: 'success', error_summary: null, records_observed: result.recordsObserved, records_updated: result.recordsUpdated, data_mode: result.dataMode, sources: result.sources });
    } catch (error) {
      return this.complete({ job_id: jobId, job_name: jobName, started_at: startedAt, finished_at: null, status: 'failed', error_summary: errorMessage(error), records_observed: 0, records_updated: 0, data_mode: 'unavailable', sources: [] });
    } finally {
      if (locked) await this.options.store.releaseLock(jobName, this.options.instanceId).catch(() => undefined);
    }
  }

  private async complete(run: RhChainAutomationRun) {
    const completed = { ...run, finished_at: this.now().toISOString() };
    await this.options.store.saveRun(completed);
    return completed;
  }
  private async draft(jobId: string, jobName: RhChainAutomationJobName, draft_type: RhChainAutomationDraft['draft_type'], payload: unknown, dataMode: string, sources: string[]) {
    await this.options.store.saveDraft({ draft_id: randomUUID(), job_id: jobId, job_name: jobName, draft_type, created_at: this.now().toISOString(), data_mode: dataMode, sources, payload });
  }
  private async execute(jobName: RhChainAutomationJobName, jobId: string): Promise<JobResult> {
    if (jobName === 'rh_chain_pulse_refresh') {
      const snapshot = await this.options.snapshots.getLiveSnapshot(); const sources = snapshot.provider_statuses.map((item) => item.provider_name);
      const chainPulse = await this.chainPulseSnapshots.refresh(snapshot);
      await this.draft(jobId, jobName, 'context_observation', chainPulse, chainPulse.data_mode, sources);
      return { recordsObserved: [chainPulse.tvl, chainPulse.dex_volume_24h, chainPulse.stablecoin_market_cap, chainPulse.fees_24h].filter((value) => value !== null).length, recordsUpdated: 1, dataMode: chainPulse.data_mode, sources };
    }
    if (jobName === 'rh_meme_pulse_refresh') {
      const snapshot = await this.memePulseSnapshots.refresh(); const sources = snapshot.provider_status.map((item) => item.provider_name);
      await this.draft(jobId, jobName, 'context_observation', snapshot, snapshot.data_mode, sources);
      return { recordsObserved: snapshot.pulse.top_attention_assets.length, recordsUpdated: 1, dataMode: snapshot.data_mode, sources };
    }
    if (jobName === 'rh_launchpad_observatory_refresh') {
      const snapshot = await this.launchpadSnapshots.refresh(); const sources = snapshot.observatory.surfaces.map((surface) => surface.source.source_name);
      await this.draft(jobId, jobName, 'context_observation', snapshot, snapshot.data_mode, sources);
      return { recordsObserved: snapshot.observatory.surfaces.length, recordsUpdated: 1, dataMode: snapshot.data_mode, sources };
    }
    if (jobName === 'rh_token_dossier_enrichment') {
      const submissions = await this.options.submissions.list(); const contracts = [...new Set(submissions.map((item) => item.token_contract).filter(isRhChainIdentityContract))];
      const live = await this.options.snapshots.getLiveSnapshot();
      const dossiers = await Promise.all(contracts.map(async (contract) => assembleRhChainTokenDossier(contract, submissions, await this.options.snapshots.getTokenSnapshot(contract), live)));
      const sources = ['RH Chain Signal Vault', ...live.provider_statuses.map((item) => item.provider_name)];
      await this.draft(jobId, jobName, 'token_dossier_draft', { dossiers, generated_at: this.now().toISOString(), disclaimer: 'Draft-only enrichment. It does not change review status, safety, or identity decisions.' }, live.cache_status, sources);
      return { recordsObserved: contracts.length, recordsUpdated: dossiers.length ? 1 : 0, dataMode: live.cache_status, sources };
    }
    if (jobName === 'rh_clone_risk_correlation') {
      const snapshot = await this.riskCorrelationSweep.sweep();
      await this.draft(jobId, jobName, 'risk_correlation_draft', snapshot, 'persisted', snapshot.sources);
      return { recordsObserved: snapshot.suspected_correlations.length, recordsUpdated: snapshot.suspected_correlations.length ? 1 : 0, dataMode: 'persisted', sources: snapshot.sources };
    }
    if (jobName === 'rh_daily_receipt_draft') {
      const receiptDraft = await this.dailyReceiptDrafts.generateDraft(); const sources = receiptDraft.generated_from_sources;
      await this.draft(jobId, jobName, 'daily_receipt_draft', receiptDraft, 'manual', sources);
      return { recordsObserved: sources.length, recordsUpdated: 1, dataMode: 'manual', sources };
    }
    const snapshot = await this.options.snapshots.getLiveSnapshot(); const sources = snapshot.provider_statuses.map((item) => item.provider_name);
    await this.draft(jobId, jobName, 'freshness_observation', { generated_at: snapshot.generated_at, cache_status: snapshot.cache_status, providers: snapshot.provider_statuses }, snapshot.cache_status, sources);
    return { recordsObserved: snapshot.provider_statuses.length, recordsUpdated: 1, dataMode: snapshot.cache_status, sources };
  }
}

export function isRhChainAutomationJobName(value: string): value is RhChainAutomationJobName {
  return (RH_CHAIN_AUTOMATION_JOB_NAMES as readonly string[]).includes(value);
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 240) : 'automation_job_failed'; }
