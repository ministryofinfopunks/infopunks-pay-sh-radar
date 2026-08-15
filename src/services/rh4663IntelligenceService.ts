import { createHash } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import {
  Rh4663EventTypeSchema,
  Rh4663IntelligenceCategorySchema,
  Rh4663NormalizedEventSchema,
  Rh4663ServiceError,
  type Rh4663EvidenceReference,
  type Rh4663EventType,
  type Rh4663IntelligenceCategory,
  type Rh4663NormalizedEvent,
  type Rh4663Signal,
  type Rh4663SignalCategory,
  type Rh4663Store
} from './rh4663Service';

export const RH_4663_INTELLIGENCE_VERSION = 'infopunks.rh4663.intelligence.v1' as const;
export const RH_4663_HEURISTIC_VERSION = 'infopunks.rh4663.heuristics.v1' as const;

const scalar = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const subjectSchema = z.object({
  subject_type: z.string().trim().min(1).max(80),
  subject_id: z.string().trim().min(1).max(240),
  label: z.string().trim().min(1).max(120).optional()
}).strict();

export const Rh4663RawObservationInputSchema = z.object({
  observation_id: z.string().trim().min(1).max(160).optional(),
  provider: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,80}$/),
  provider_observation_id: z.string().trim().min(1).max(300),
  source_type: z.enum(['dex_market', 'chain_explorer', 'defi_metrics', 'price_index', 'internal_snapshot', 'community', 'reviewed_evidence']),
  observed_at: z.string().datetime(),
  category: Rh4663IntelligenceCategorySchema,
  subject: subjectSchema,
  metric: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,100}$/),
  current_value: scalar,
  previous_value: scalar.optional(),
  units: z.string().trim().max(40).optional().nullable(),
  provider_reference: z.string().trim().min(1).max(500),
  source_url: z.string().trim().max(1_000).refine(safeReference, 'safe_source_reference_required'),
  confidence: z.number().int().min(0).max(100),
  freshness: z.enum(['fresh', 'stale', 'expired']).default('fresh'),
  event_type: Rh4663EventTypeSchema.optional(),
  baseline: z.object({ mean: z.number().finite(), standard_deviation: z.number().finite().min(0), sample_size: z.number().int().min(0), window: z.string().trim().min(1).max(60) }).strict().optional(),
  dimensions: z.record(z.string(), scalar).default({}),
  attribution: z.object({
    submitted_by: z.string().trim().min(1).max(120), submitted_at: z.string().datetime(), first_seen_at: z.string().datetime(),
    evidence_added_at: z.string().datetime().optional().nullable(), confirmed_at: z.string().datetime().optional().nullable()
  }).strict().optional()
}).strict();
export type Rh4663RawObservationInput = z.input<typeof Rh4663RawObservationInputSchema>;
export type Rh4663RawObservation = z.output<typeof Rh4663RawObservationInputSchema> & {
  observation_id: string;
  ingested_at: string;
  payload_hash: `sha256:${string}`;
  schema_version: typeof RH_4663_INTELLIGENCE_VERSION;
  validation_state: 'accepted';
};

export type Rh4663ScoreComponents = {
  magnitude: number; velocity: number; persistence: number; market_impact: number; attention_impact: number;
  cross_provider_confirmation: number; historical_rarity: number; subject_importance: number; source_quality: number;
};

export type Rh4663HeuristicConfiguration = {
  version: string;
  event_bucket_ms: number;
  candidate_min_significance: number;
  candidate_min_anomaly: number;
  auto_publish_min_significance: number;
  auto_publish_min_sources: number;
  auto_publish_min_confidence: number;
  high_risk_min_sources: number;
  stale_after_ms: number;
  expire_after_ms: number;
};

export const DEFAULT_RH_4663_HEURISTICS: Rh4663HeuristicConfiguration = Object.freeze({
  version: RH_4663_HEURISTIC_VERSION,
  event_bucket_ms: 60 * 60_000,
  candidate_min_significance: 55,
  candidate_min_anomaly: 70,
  auto_publish_min_significance: 70,
  auto_publish_min_sources: 2,
  auto_publish_min_confidence: 70,
  high_risk_min_sources: 3,
  stale_after_ms: 30 * 60_000,
  expire_after_ms: 6 * 60 * 60_000
});

export type Rh4663CandidateOutcome = 'published' | 'held' | 'rejected' | 'review_required' | 'false_positive' | 'duplicate' | 'insufficient_evidence';
export type Rh4663CandidatePublicationState = 'candidate' | 'auto_publishable' | 'review_required' | 'held' | 'published' | 'rejected';
export type Rh4663RiskClass = 'low' | 'medium' | 'high';

export type Rh4663SignalCandidate = {
  candidate_id: string;
  event_ids: string[];
  event_fingerprint: string;
  category: Rh4663IntelligenceCategory;
  signal_type: Rh4663EventType;
  subjects: Rh4663NormalizedEvent['subjects'];
  headline: string;
  summary: string;
  significance_score: number;
  significance_components: Rh4663ScoreComponents;
  anomaly_score: number;
  anomaly_basis: string;
  evidence: Rh4663EvidenceReference[];
  heuristic_version: string;
  generated_at: string;
  updated_at: string;
  risk_class: Rh4663RiskClass;
  publication_state: Rh4663CandidatePublicationState;
  policy_reasons: string[];
  outcome: Rh4663CandidateOutcome | null;
  finder_attribution: Rh4663RawObservation['attribution'] | null;
};

export type Rh4663DistributionState = 'not_queued' | 'queued' | 'sent' | 'failed';
export type Published4663Signal = {
  signal_id: string;
  candidate_id: string;
  representation_kind: 'SIGNAL_CARD';
  immutable: true;
  event_ids: string[];
  category: Rh4663IntelligenceCategory;
  signal_type: Rh4663EventType;
  subjects: Rh4663NormalizedEvent['subjects'];
  headline: string;
  summary: string;
  significance_score: number;
  significance_components: Rh4663ScoreComponents;
  anomaly_score: number;
  anomaly_basis: string;
  evidence: Rh4663EvidenceReference[];
  source_count: number;
  heuristic_version: string;
  detected_at: string;
  published_at: string;
  publication_hash: `sha256:${string}`;
  proof_url: string;
  share: { landscape: string; square: string; portrait: string };
  distribution_state: Rh4663DistributionState;
  finder_attribution: Rh4663RawObservation['attribution'] | null;
  semantics: 'Signal Card is a presentation object, not an Evidence Receipt or Protocol Receipt.';
};

export type Rh4663SignalCorrection = {
  correction_id: string;
  signal_id: string;
  correction_type: 'CORRECTION' | 'SUPERSEDED' | 'UPDATED_EVIDENCE';
  note: string;
  evidence: Rh4663EvidenceReference[];
  created_at: string;
  original_publication_hash: `sha256:${string}`;
};

export type Rh4663ProviderHealth = {
  provider: string;
  state: 'healthy' | 'degraded' | 'disabled';
  last_attempt_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  cached: boolean;
  error_code: string | null;
};

export type Rh4663PublicationFilters = Partial<{
  category: Rh4663IntelligenceCategory;
  subject: string;
  signal_type: Rh4663EventType;
  since: string;
  limit: number;
}>;

export interface Rh4663IntelligenceStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  saveObservation(observation: Rh4663RawObservation): Promise<{ observation: Rh4663RawObservation; created: boolean }>;
  listObservations(filters?: Partial<{ since: string; until: string; subject: string; metric: string; limit: number }>): Promise<Rh4663RawObservation[]>;
  saveCandidate(candidate: Rh4663SignalCandidate): Promise<{ candidate: Rh4663SignalCandidate; created: boolean }>;
  updateCandidate(candidate: Rh4663SignalCandidate): Promise<Rh4663SignalCandidate>;
  getCandidate(candidateId: string): Promise<Rh4663SignalCandidate | null>;
  listCandidates(limit?: number): Promise<Rh4663SignalCandidate[]>;
  publish(signal: Published4663Signal, reviewerId: string | null): Promise<{ signal: Published4663Signal; created: boolean }>;
  getPublication(signalId: string): Promise<Published4663Signal | null>;
  listPublications(filters?: Rh4663PublicationFilters): Promise<Published4663Signal[]>;
  setDistributionState(signalId: string, state: Rh4663DistributionState, errorCode?: string | null): Promise<Rh4663DistributionState>;
  appendCorrection(correction: Rh4663SignalCorrection, reviewerId: string): Promise<Rh4663SignalCorrection>;
  listCorrections(signalId: string): Promise<Rh4663SignalCorrection[]>;
  saveProviderHealth(health: Rh4663ProviderHealth): Promise<void>;
  listProviderHealth(): Promise<Rh4663ProviderHealth[]>;
  close?(): Promise<void>;
}

export class InMemoryRh4663IntelligenceStore implements Rh4663IntelligenceStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private observations = new Map<string, Rh4663RawObservation>();
  private observationKeys = new Map<string, string>();
  private candidates = new Map<string, Rh4663SignalCandidate>();
  private publications = new Map<string, Published4663Signal>();
  private publicationCandidates = new Map<string, string>();
  private distribution = new Map<string, Rh4663DistributionState>();
  private corrections = new Map<string, Rh4663SignalCorrection[]>();
  private health = new Map<string, Rh4663ProviderHealth>();

  async saveObservation(observation: Rh4663RawObservation) {
    const key = `${observation.provider}:${observation.provider_observation_id}`;
    const priorId = this.observationKeys.get(key); const prior = priorId ? this.observations.get(priorId) : this.observations.get(observation.observation_id);
    if (prior) {
      if (prior.payload_hash !== observation.payload_hash) throw new Rh4663ServiceError('observation_identity_conflict', 409);
      return { observation: clone(prior), created: false };
    }
    this.observationKeys.set(key, observation.observation_id); this.observations.set(observation.observation_id, clone(observation));
    return { observation: clone(observation), created: true };
  }
  async listObservations(filters: Partial<{ since: string; until: string; subject: string; metric: string; limit: number }> = {}) {
    return [...this.observations.values()].filter((item) => (!filters.since || item.observed_at >= filters.since) && (!filters.until || item.observed_at <= filters.until) && (!filters.subject || item.subject.subject_id.toLowerCase() === filters.subject.toLowerCase()) && (!filters.metric || item.metric === filters.metric)).sort((a, b) => a.observed_at.localeCompare(b.observed_at) || a.observation_id.localeCompare(b.observation_id)).slice(-(filters.limit ?? 5_000)).map(clone);
  }
  async saveCandidate(candidate: Rh4663SignalCandidate) { const prior = this.candidates.get(candidate.candidate_id); if (prior) return { candidate: clone(prior), created: false }; this.candidates.set(candidate.candidate_id, clone(candidate)); return { candidate: clone(candidate), created: true }; }
  async updateCandidate(candidate: Rh4663SignalCandidate) { if (!this.candidates.has(candidate.candidate_id)) throw new Rh4663ServiceError('candidate_not_found', 404); this.candidates.set(candidate.candidate_id, clone(candidate)); return clone(candidate); }
  async getCandidate(id: string) { return clone(this.candidates.get(id) ?? null); }
  async listCandidates(limit = 1_000) { return [...this.candidates.values()].sort((a, b) => b.generated_at.localeCompare(a.generated_at)).slice(0, limit).map(clone); }
  async publish(signal: Published4663Signal, _reviewerId: string | null) {
    const priorSignal = this.publications.get(signal.signal_id); const priorId = this.publicationCandidates.get(signal.candidate_id); const prior = priorSignal ?? (priorId ? this.publications.get(priorId) : undefined);
    if (prior) { if (prior.publication_hash !== signal.publication_hash) throw new Rh4663ServiceError('publication_identity_conflict', 409); return { signal: clone(prior), created: false }; }
    this.publications.set(signal.signal_id, clone(signal)); this.publicationCandidates.set(signal.candidate_id, signal.signal_id); this.distribution.set(signal.signal_id, 'not_queued'); return { signal: clone(signal), created: true };
  }
  async getPublication(id: string) { const value=this.publications.get(id);return value?clone({...value,distribution_state:this.distribution.get(id)??value.distribution_state}):null; }
  async listPublications(filters: Rh4663PublicationFilters = {}) { return filterPublications([...this.publications.values()].map((value)=>({...value,distribution_state:this.distribution.get(value.signal_id)??value.distribution_state})), filters).map(clone); }
  async setDistributionState(id:string,state:Rh4663DistributionState){if(!this.publications.has(id))throw new Rh4663ServiceError('published_signal_not_found',404);this.distribution.set(id,state);return state;}
  async appendCorrection(correction: Rh4663SignalCorrection, _reviewerId: string) { const existing = (this.corrections.get(correction.signal_id) ?? []).find((item) => item.correction_id === correction.correction_id); if (existing) return clone(existing); this.corrections.set(correction.signal_id, [...(this.corrections.get(correction.signal_id) ?? []), clone(correction)]); return clone(correction); }
  async listCorrections(id: string) { return clone(this.corrections.get(id) ?? []); }
  async saveProviderHealth(health: Rh4663ProviderHealth) { this.health.set(health.provider, clone(health)); }
  async listProviderHealth() { return [...this.health.values()].sort((a, b) => a.provider.localeCompare(b.provider)).map(clone); }
}

export class PostgresRh4663IntelligenceStore implements Rh4663IntelligenceStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool; private readonly ownsPool: boolean;
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  private async ready() { const result = await this.pool.query<{ missing: string | null }>(`select string_agg(name, ',') as missing from unnest(array['rh_4663_observations','rh_4663_signal_candidates','rh_4663_signal_publications','rh_4663_signal_distribution','rh_4663_signal_corrections','rh_4663_provider_health']) name where to_regclass(name) is null`); if (result.rows[0]?.missing) throw new Rh4663ServiceError('phase3_migration_not_applied', 503); }
  async saveObservation(observation: Rh4663RawObservation) {
    await this.ready(); const client = await this.pool.connect();
    try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-observation:' || $1 || ':' || $2))", [observation.provider, observation.provider_observation_id]);
      const result = await client.query<{ payload: Rh4663RawObservation }>(`insert into rh_4663_observations (observation_id, provider, provider_observation_id, subject_id, metric, observed_at, ingested_at, submitted_by, payload_hash, payload)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) on conflict (provider, provider_observation_id) do nothing returning payload`,
      [observation.observation_id, observation.provider, observation.provider_observation_id, observation.subject.subject_id.toLowerCase(), observation.metric, observation.observed_at, observation.ingested_at, observation.attribution?.submitted_by ?? null, observation.payload_hash, JSON.stringify(observation)]);
      const stored = result.rows[0]?.payload ?? (await client.query<{ payload: Rh4663RawObservation }>('select payload from rh_4663_observations where provider=$1 and provider_observation_id=$2', [observation.provider, observation.provider_observation_id])).rows[0]?.payload;
      if (!stored || stored.payload_hash !== observation.payload_hash) throw new Rh4663ServiceError('observation_identity_conflict', 409);
      await client.query('commit'); return { observation: stored, created: Boolean(result.rowCount) };
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async listObservations(filters: Partial<{ since: string; until: string; subject: string; metric: string; limit: number }> = {}) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663RawObservation }>(`select payload from rh_4663_observations where ($1::timestamptz is null or observed_at >= $1) and ($2::timestamptz is null or observed_at <= $2) and ($3::text is null or subject_id=lower($3)) and ($4::text is null or metric=$4) order by observed_at asc, observation_id asc limit $5`, [filters.since ?? null, filters.until ?? null, filters.subject ?? null, filters.metric ?? null, Math.min(filters.limit ?? 5_000, 20_000)]); return result.rows.map((row) => row.payload); }
  async saveCandidate(candidate: Rh4663SignalCandidate) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663SignalCandidate }>('insert into rh_4663_signal_candidates (candidate_id,event_fingerprint,publication_state,risk_class,generated_at,updated_at,outcome,payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (candidate_id) do nothing returning payload', [candidate.candidate_id,candidate.event_fingerprint,candidate.publication_state,candidate.risk_class,candidate.generated_at,candidate.updated_at,candidate.outcome,JSON.stringify(candidate)]); const stored = result.rows[0]?.payload ?? (await this.getCandidate(candidate.candidate_id)); if (!stored) throw new Rh4663ServiceError('candidate_persistence_failed', 503); return { candidate: stored, created: Boolean(result.rowCount) }; }
  async updateCandidate(candidate: Rh4663SignalCandidate) { await this.ready(); const result = await this.pool.query('update rh_4663_signal_candidates set publication_state=$2, updated_at=$3, outcome=$4, payload=$5::jsonb where candidate_id=$1', [candidate.candidate_id,candidate.publication_state,candidate.updated_at,candidate.outcome,JSON.stringify(candidate)]); if (!result.rowCount) throw new Rh4663ServiceError('candidate_not_found', 404); return candidate; }
  async getCandidate(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663SignalCandidate }>('select payload from rh_4663_signal_candidates where candidate_id=$1',[id]); return result.rows[0]?.payload ?? null; }
  async listCandidates(limit=1_000) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663SignalCandidate }>('select payload from rh_4663_signal_candidates order by generated_at desc limit $1',[Math.min(limit,5_000)]); return result.rows.map((row)=>row.payload); }
  async publish(signal: Published4663Signal, reviewerId: string | null) { await this.ready(); const client=await this.pool.connect(); try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-publication:' || $1))",[signal.candidate_id]); const result=await client.query<{payload:Published4663Signal}>('insert into rh_4663_signal_publications (signal_id,candidate_id,category,signal_type,published_at,publication_hash,distribution_state,reviewer_id,payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) on conflict (candidate_id) do nothing returning payload',[signal.signal_id,signal.candidate_id,signal.category,signal.signal_type,signal.published_at,signal.publication_hash,signal.distribution_state,reviewerId,JSON.stringify(signal)]); const stored=result.rows[0]?.payload ?? (await client.query<{payload:Published4663Signal}>('select payload from rh_4663_signal_publications where candidate_id=$1',[signal.candidate_id])).rows[0]?.payload; if(!stored||stored.publication_hash!==signal.publication_hash) throw new Rh4663ServiceError('publication_identity_conflict',409); await client.query('insert into rh_4663_signal_distribution (signal_id,state,updated_at) values ($1,$2,$3) on conflict (signal_id) do nothing',[stored.signal_id,'not_queued',stored.published_at]); await client.query('commit'); return {signal:stored,created:Boolean(result.rowCount)}; } catch(error){await client.query('rollback').catch(()=>undefined);throw error;} finally{client.release();} }
  async getPublication(id:string){await this.ready();const result=await this.pool.query<{payload:Published4663Signal;state:Rh4663DistributionState|null}>('select p.payload,d.state from rh_4663_signal_publications p left join rh_4663_signal_distribution d using (signal_id) where p.signal_id=$1',[id]);const row=result.rows[0];return row?{...row.payload,distribution_state:row.state??row.payload.distribution_state}:null;}
  async listPublications(filters:Rh4663PublicationFilters={}){await this.ready();const result=await this.pool.query<{payload:Published4663Signal;state:Rh4663DistributionState|null}>('select p.payload,d.state from rh_4663_signal_publications p left join rh_4663_signal_distribution d using (signal_id) order by p.published_at desc limit $1',[Math.min(filters.limit??1_000,5_000)]);return filterPublications(result.rows.map((row)=>({...row.payload,distribution_state:row.state??row.payload.distribution_state})),filters);}
  async setDistributionState(id:string,state:Rh4663DistributionState,errorCode:string|null=null){await this.ready();const result=await this.pool.query('update rh_4663_signal_distribution set state=$2,updated_at=now(),attempt_count=attempt_count+case when $2 in (\'queued\',\'failed\') then 1 else 0 end,error_code=$3 where signal_id=$1',[id,state,errorCode]);if(!result.rowCount)throw new Rh4663ServiceError('published_signal_not_found',404);return state;}
  async appendCorrection(correction:Rh4663SignalCorrection,reviewerId:string){await this.ready();const result=await this.pool.query<{payload:Rh4663SignalCorrection}>('insert into rh_4663_signal_corrections (correction_id,signal_id,correction_type,created_at,reviewer_id,payload) values ($1,$2,$3,$4,$5,$6::jsonb) on conflict (correction_id) do nothing returning payload',[correction.correction_id,correction.signal_id,correction.correction_type,correction.created_at,reviewerId,JSON.stringify(correction)]);return result.rows[0]?.payload??correction;}
  async listCorrections(id:string){await this.ready();const result=await this.pool.query<{payload:Rh4663SignalCorrection}>('select payload from rh_4663_signal_corrections where signal_id=$1 order by created_at asc',[id]);return result.rows.map((row)=>row.payload);}
  async saveProviderHealth(health:Rh4663ProviderHealth){await this.ready();await this.pool.query('insert into rh_4663_provider_health (provider,state,updated_at,payload) values ($1,$2,$3,$4::jsonb) on conflict (provider) do update set state=excluded.state,updated_at=excluded.updated_at,payload=excluded.payload',[health.provider,health.state,health.last_attempt_at,JSON.stringify(health)]);}
  async listProviderHealth(){await this.ready();const result=await this.pool.query<{payload:Rh4663ProviderHealth}>('select payload from rh_4663_provider_health order by provider');return result.rows.map((row)=>row.payload);}
  async close(){if(this.ownsPool)await this.pool.end();}
}

export type Rh4663ProviderAdapter = {
  name: string;
  enabled: boolean;
  timeout_ms: number;
  max_retries: number;
  collect(): Promise<Rh4663RawObservationInput[]>;
};

export type Rh4663IntelligenceOptions = {
  enabled: boolean;
  ingestion_enabled: boolean;
  candidate_generation_enabled: boolean;
  publication_enabled: boolean;
  auto_publication_enabled: boolean;
  external_distribution_enabled: boolean;
  shadow_mode: boolean;
  is_production: boolean;
  phase2_production_proof_verified: boolean;
  heuristics?: Partial<Rh4663HeuristicConfiguration>;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
};

export type Rh4663ProcessingResult = {
  observation: Rh4663RawObservation;
  observation_created: boolean;
  event: Rh4663NormalizedEvent | null;
  event_deduplicated: boolean;
  candidate: Rh4663SignalCandidate | null;
  publication: Published4663Signal | null;
  state: 'disabled' | 'observed' | 'normalized' | 'suppressed' | 'candidate' | 'published';
  reasons: string[];
};

export class Rh4663IntelligenceService {
  readonly heuristics: Rh4663HeuristicConfiguration;
  private readonly now: () => Date; private readonly log: (entry: Record<string, unknown>) => void;
  private readonly counters = new Map<string, number>();
  constructor(readonly eventStore: Rh4663Store, readonly store: Rh4663IntelligenceStore, readonly options: Rh4663IntelligenceOptions) {
    this.heuristics = { ...DEFAULT_RH_4663_HEURISTICS, ...options.heuristics };
    this.now = options.now ?? (() => new Date()); this.log = options.log ?? (() => undefined);
  }

  activation() {
    const productionProofGate = !this.options.is_production || this.options.phase2_production_proof_verified;
    return {
      code_enabled: this.options.enabled,
      ingestion_enabled: this.options.enabled && this.options.ingestion_enabled,
      candidate_generation_enabled: this.options.enabled && this.options.candidate_generation_enabled,
      publication_enabled: this.options.enabled && this.options.publication_enabled && productionProofGate,
      auto_publication_enabled: this.options.enabled && this.options.auto_publication_enabled && this.options.publication_enabled && productionProofGate,
      external_distribution_enabled: this.options.enabled && this.options.external_distribution_enabled && productionProofGate,
      shadow_mode: this.options.shadow_mode,
      phase2_production_proof_verified: this.options.phase2_production_proof_verified,
      fail_closed: this.options.is_production && !this.options.phase2_production_proof_verified,
      heuristic_version: this.heuristics.version
    };
  }

  async ingest(input: Rh4663RawObservationInput): Promise<Rh4663ProcessingResult> {
    if (!this.options.enabled || !this.options.ingestion_enabled) throw new Rh4663ServiceError('phase3_ingestion_disabled', 503);
    return this.process(input, true);
  }

  async runProviders(providers: Rh4663ProviderAdapter[]) {
    if (!this.options.enabled || !this.options.ingestion_enabled) return { state: 'disabled' as const, providers: [], observations: 0, events: 0, candidates: 0, publications: 0 };
    const summaries: Array<{ provider: string; state: string; observations: number; error_code: string | null }> = [];
    let observationCount=0,eventCount=0,candidateCount=0,publicationCount=0;
    for (const provider of providers) {
      if (!provider.enabled) { await this.recordProviderHealth(provider.name,'disabled',null); summaries.push({provider:provider.name,state:'disabled',observations:0,error_code:null}); continue; }
      try {
        const inputs=await retryBounded(()=>withTimeout(provider.collect(),provider.timeout_ms,'provider_timeout'),provider.max_retries);
        let accepted=0; for(const input of inputs.slice(0,2_000)){const result=await this.process(input,true);accepted+=Number(result.observation_created);eventCount+=Number(Boolean(result.event));candidateCount+=Number(Boolean(result.candidate));publicationCount+=Number(Boolean(result.publication));}
        observationCount+=accepted;await this.recordProviderHealth(provider.name,'healthy',null);summaries.push({provider:provider.name,state:'healthy',observations:accepted,error_code:null});
      } catch(error){const code=boundedErrorCode(error);await this.recordProviderHealth(provider.name,'degraded',code);this.emit('4663_observation_failed',{provider:provider.name,error_code:code});summaries.push({provider:provider.name,state:'degraded',observations:0,error_code:code});}
    }
    return {state:'complete' as const,providers:summaries,observations:observationCount,events:eventCount,candidates:candidateCount,publications:publicationCount};
  }

  async ingestCommunitySignal(signal: Rh4663Signal) {
    const historyTime=(state:Rh4663Signal['lifecycle_state'])=>signal.lifecycle_history.find((item)=>item.to===state)?.changed_at??null;
    const attribution={submitted_by:signal.original_submitter,submitted_at:signal.submitted_at,first_seen_at:signal.submitted_at,evidence_added_at:historyTime('evidence_added'),confirmed_at:historyTime('confirmed')};
    const inputs=signal.evidence.map((evidence,index):Rh4663RawObservationInput=>({provider:'community_signal_hunt',provider_observation_id:`${signal.signal_id}:${evidence.reference_id}`,source_type:'community',observed_at:evidence.observed_at,category:intelligenceCategory(signal.category),subject:{subject_type:'community_signal',subject_id:signal.signal_id,label:signal.title},metric:'community_signal',current_value:true,units:null,provider_reference:evidence.reference_id,source_url:evidence.href,confidence:signal.lifecycle_state==='confirmed'?80:45,freshness:evidence.source_status==='fresh'?'fresh':'stale',event_type:'COMMUNITY_SIGNAL',dimensions:{title:signal.title,thesis:signal.thesis,community_state:signal.lifecycle_state,evidence_count:signal.evidence.length,index},attribution}));
    const results=[];for(const input of inputs)results.push(await this.process(input,true));
    if(signal.lifecycle_state==='rejected'){for(const result of results){if(result.candidate){await this.store.updateCandidate({...result.candidate,publication_state:'rejected',outcome:'rejected',updated_at:this.now().toISOString(),policy_reasons:[...result.candidate.policy_reasons,'community_submission_rejected']});this.emit('4663_candidate_rejected',{candidate_id:result.candidate.candidate_id,outcome:'rejected',source:'community_signal_hunt'});}}}
    return results;
  }

  async publish(candidateId:string,reviewerId:string|null=null){
    const activation=this.activation();if(!activation.publication_enabled)throw new Rh4663ServiceError(activation.fail_closed?'phase2_production_proof_required':'phase3_publication_disabled',503);
    const candidate=await this.store.getCandidate(candidateId);if(!candidate)throw new Rh4663ServiceError('candidate_not_found',404);
    if(['rejected','published'].includes(candidate.publication_state)){if(candidate.publication_state==='published'){const prior=(await this.store.listPublications({limit:5_000})).find((item)=>item.candidate_id===candidateId);if(prior)return prior;}throw new Rh4663ServiceError('candidate_not_publishable',409);}
    const sources=uniqueSources(candidate.evidence);const evidenceComplete=evidenceSufficient(candidate.evidence);
    if(!evidenceComplete)throw new Rh4663ServiceError('candidate_evidence_insufficient',409);
    if(candidate.risk_class==='high'&&(!reviewerId||sources.length<this.heuristics.high_risk_min_sources))throw new Rh4663ServiceError(!reviewerId?'reviewer_authorization_required':'high_risk_evidence_insufficient',403);
    if(candidate.risk_class==='medium'&&!reviewerId)throw new Rh4663ServiceError('reviewer_authorization_required',403);
    const detected=(await Promise.all(candidate.event_ids.map((id)=>this.eventStore.getEvent(id)))).filter((item):item is Rh4663NormalizedEvent=>Boolean(item)).sort((a,b)=>a.detected_at.localeCompare(b.detected_at))[0]?.detected_at??candidate.generated_at;
    const publishedAt=this.now().toISOString();const signalId=`SIGNAL-4663-${hash(candidate.candidate_id).slice(0,8).toUpperCase()}`;
    const material={signal_id:signalId,candidate_id:candidate.candidate_id,representation_kind:'SIGNAL_CARD' as const,immutable:true as const,event_ids:candidate.event_ids,category:candidate.category,signal_type:candidate.signal_type,subjects:candidate.subjects,headline:candidate.headline,summary:candidate.summary,significance_score:candidate.significance_score,significance_components:candidate.significance_components,anomaly_score:candidate.anomaly_score,anomaly_basis:candidate.anomaly_basis,evidence:candidate.evidence,source_count:sources.length,heuristic_version:candidate.heuristic_version,detected_at:detected,published_at:publishedAt,proof_url:`/4663/signals/${signalId}`,share:{landscape:`/og/4663/signals/${signalId}.png?format=landscape`,square:`/og/4663/signals/${signalId}.png?format=square`,portrait:`/og/4663/signals/${signalId}.png?format=portrait`},distribution_state:'not_queued' as const,finder_attribution:candidate.finder_attribution,semantics:'Signal Card is a presentation object, not an Evidence Receipt or Protocol Receipt.' as const};
    const signal:Published4663Signal={...material,publication_hash:`sha256:${hash(stable(material))}`};const saved=await this.store.publish(signal,reviewerId);
    if(saved.created){await this.store.updateCandidate({...candidate,publication_state:'published',outcome:'published',updated_at:publishedAt});for(const id of candidate.event_ids){const event=await this.eventStore.getEvent(id);if(event)await this.eventStore.upsertEvent({...event,lifecycle_state:'published',publication_state:'public',updated_at:publishedAt});}this.emit('4663_signal_published',{signal_id:signal.signal_id,candidate_id:candidateId,risk_class:candidate.risk_class});}
    return saved.signal;
  }

  async correct(signalId:string,input:{correction_type:'CORRECTION'|'SUPERSEDED'|'UPDATED_EVIDENCE';note:string;evidence?:Rh4663EvidenceReference[]},reviewerId:string){
    const signal=await this.store.getPublication(signalId);if(!signal)throw new Rh4663ServiceError('published_signal_not_found',404);const note=sanitize(input.note,1_000);if(note.length<3)throw new Rh4663ServiceError('correction_note_required',400);const createdAt=this.now().toISOString();const correction:Rh4663SignalCorrection={correction_id:`corr4663_${hash(`${signalId}|${input.correction_type}|${createdAt}|${note}`).slice(0,24)}`,signal_id:signalId,correction_type:input.correction_type,note,evidence:(input.evidence??[]).map((item)=>({...item,label:sanitize(item.label,180)})),created_at:createdAt,original_publication_hash:signal.publication_hash};const saved=await this.store.appendCorrection(correction,reviewerId);this.emit('4663_signal_corrected',{signal_id:signalId,correction_id:saved.correction_id,correction_type:saved.correction_type});return saved;
  }

  async queueDistribution(signalId:string){if(!this.activation().external_distribution_enabled)throw new Rh4663ServiceError('external_distribution_disabled',503);if(!(await this.store.getPublication(signalId)))throw new Rh4663ServiceError('published_signal_not_found',404);await this.store.setDistributionState(signalId,'queued');return{signal_id:signalId,distribution_state:'queued' as const,automatic_send:false,notice:'Queued for a future explicitly configured distributor. This service does not post externally.'};}
  recordToday(state:'generated'|'degraded',context:Record<string,unknown>){this.emit(state==='generated'?'4663_today_generated':'4663_today_degraded',context);}
  recordShareRenderFailed(signalId:string,errorCode:string){this.emit('4663_share_render_failed',{signal_id:signalId,error_code:errorCode});}
  recordCandidateAction(candidateId:string,state:'held'|'rejected',outcome:Rh4663CandidateOutcome,reviewerId:string){this.emit(state==='held'?'4663_candidate_held':'4663_candidate_rejected',{candidate_id:candidateId,outcome,reviewer_id:reviewerId});}

  async publicSignal(signalId:string){const signal=await this.store.getPublication(signalId);if(!signal)return null;const corrections=await this.store.listCorrections(signalId);return {...signal,correction_state:corrections.at(-1)?.correction_type??'ORIGINAL',corrections};}
  async publicSignals(filters:Rh4663PublicationFilters={}){return this.store.listPublications(filters);}
  async evidence(signalId:string){const detail=await this.publicSignal(signalId);if(!detail)return null;return {signal_id:signalId,publication_hash:detail.publication_hash,evidence:detail.evidence,corrections:detail.corrections.map((item)=>({correction_id:item.correction_id,correction_type:item.correction_type,evidence:item.evidence,created_at:item.created_at})),traceability:'Every public numeric fact is derived from persisted evidence.'};}

  async lens(category:Rh4663IntelligenceCategory,filters:Omit<Rh4663PublicationFilters,'category'>={}){const signals=await this.store.listPublications({...filters,category});return {lens:category,source:'shared_normalized_4663_event_system',signals,signal_count:signals.length,provider_requests_in_path:0};}
  async rotation(since?:string){const categories:Rh4663IntelligenceCategory[]=['MEMES','STOCK_TOKENS','RWA_DEFI','STABLES'];const signals=await this.store.listPublications({since,limit:500});const flows=categories.map((category)=>{const matching=signals.filter((item)=>item.category===category);const changes=matching.flatMap((item)=>item.evidence.map((evidence)=>evidence.change).filter((value):value is number=>typeof value==='number'));const value=changes.length?changes.reduce((sum,item)=>sum+item,0)/changes.length:0;return {category,direction:value>10?'up_strong':value>0?'up':value<-10?'down_strong':value<0?'down':'flat',score:Math.round(Math.min(100,Math.abs(value))),evidence_count:matching.reduce((sum,item)=>sum+item.evidence.length,0)};});const leader=[...flows].sort((a,b)=>b.score-a.score||a.category.localeCompare(b.category))[0];return {object_type:'LIVE_ROTATION_SIGNAL',protocol_resolution:false,semantics:'Live heuristic rotation intelligence cannot overwrite or determine RH Pulse resolution.',heuristic_version:this.heuristics.version,flows,leader:leader?.evidence_count?leader.category:null};}

  async backtest(input:Partial<{since:string;until:string;heuristic_version:string}>={}){
    const observations=await this.store.listObservations({since:input.since,until:input.until,limit:20_000});const events=new Map<string,Rh4663NormalizedEvent>();const results:Array<{observation_id:string;event_id:string|null;category:Rh4663IntelligenceCategory;signal_type:Rh4663EventType|null;significance_score:number;anomaly_score:number;decision:string;reasons:string[];heuristic_version:string}>=[];
    for(const observation of observations){const built=materializeEvent(observation,events.get(eventIdentity(observation,this.heuristics)),this.heuristics,this.now());if(!built){results.push({observation_id:observation.observation_id,event_id:null,category:observation.category,signal_type:null,significance_score:0,anomaly_score:0,decision:'suppressed',reasons:['classifier_no_match'],heuristic_version:input.heuristic_version??this.heuristics.version});continue;}events.set(built.event.event_id,built.event);const policy=evaluatePolicy(built.event,observation,this.heuristics);results.push({observation_id:observation.observation_id,event_id:built.event.event_id,category:observation.category,signal_type:built.event.event_type??null,significance_score:built.event.significance_score,anomaly_score:built.event.anomaly_score,decision:policy.create?policy.state:'suppressed',reasons:policy.reasons,heuristic_version:input.heuristic_version??this.heuristics.version});}
    return {mode:'backtest',public_writes:0,observation_count:observations.length,event_count:events.size,heuristic_version:input.heuristic_version??this.heuristics.version,results};
  }

  async metrics(){const[candidates,publications,providers,observations]=await Promise.all([this.store.listCandidates(5_000),this.store.listPublications({limit:5_000}),this.store.listProviderHealth(),this.store.listObservations({limit:20_000})]);const events=await this.eventStore.listEvents(5_000);const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map((value)=>[value,values.filter((item)=>item===value).length]));return {counters:Object.fromEntries(this.counters),events_by_category:count(events.map((item)=>item.intelligence_category??intelligenceCategory(item.category))),candidates_by_state:count(candidates.map((item)=>item.publication_state)),publish_rate:ratio(publications.length,candidates.length),hold_rate:ratio(candidates.filter((item)=>item.publication_state==='held').length,candidates.length),review_rate:ratio(candidates.filter((item)=>item.publication_state==='review_required').length,candidates.length),duplicate_rate:ratio(this.counters.get('4663_event_deduplicated')??0,observations.length),average_significance:average(events.map((item)=>item.significance_score)),average_anomaly:average(events.map((item)=>item.anomaly_score)),today_generation_state:{generated:this.counters.get('4663_today_generated')??0,degraded:this.counters.get('4663_today_degraded')??0},share_render_failures:this.counters.get('4663_share_render_failed')??0,provider_health:providers,activation:this.activation(),storage:{adapter:this.store.adapter,durable:this.store.durable}};}

  private async process(input:Rh4663RawObservationInput,persist:boolean):Promise<Rh4663ProcessingResult>{
    const parsed=Rh4663RawObservationInputSchema.parse(input);const ingestedAt=this.now().toISOString();const identity=parsed.observation_id??`obs4663_${hash(`${parsed.provider}|${parsed.provider_observation_id}`).slice(0,32)}`;const payload=stable({...parsed,observation_id:identity});const observation:Rh4663RawObservation={...parsed,observation_id:identity,ingested_at:ingestedAt,payload_hash:`sha256:${hash(payload)}`,schema_version:RH_4663_INTELLIGENCE_VERSION,validation_state:'accepted'};
    const saved=persist?await this.store.saveObservation(observation):{observation,created:true};if(saved.created)this.emit('4663_observation_ingested',{observation_id:identity,provider:observation.provider,metric:observation.metric});
    const historical=await this.store.listObservations({subject:observation.subject.subject_id,metric:observation.metric,limit:10});
    if(isOneTimeEvent(observation)&&historical.some((item)=>item.observation_id!==observation.observation_id)){return {observation:saved.observation,observation_created:saved.created,event:null,event_deduplicated:true,candidate:null,publication:null,state:'suppressed',reasons:['one_time_event_already_observed']};}
    const eventId=eventIdentity(observation,this.heuristics);const prior=await this.eventStore.getEvent(eventId);const built=materializeEvent(observation,prior,this.heuristics,this.now());if(!built)return {observation:saved.observation,observation_created:saved.created,event:null,event_deduplicated:false,candidate:null,publication:null,state:'suppressed',reasons:['classifier_no_match']};
    const event=persist?await this.eventStore.upsertEvent(built.event):built.event;this.emit(prior?'4663_event_deduplicated':'4663_event_created',{event_id:event.event_id,provider:observation.provider,evidence_count:event.evidence.length});if(prior)this.emit('4663_event_updated',{event_id:event.event_id,evidence_count:event.evidence.length});
    if(!this.options.candidate_generation_enabled)return {observation:saved.observation,observation_created:saved.created,event,event_deduplicated:Boolean(prior),candidate:null,publication:null,state:'normalized',reasons:[this.options.shadow_mode?'shadow_mode_candidate_generation_disabled':'candidate_generation_disabled']};
    const policy=evaluatePolicy(event,observation,this.heuristics);if(!policy.create)return {observation:saved.observation,observation_created:saved.created,event,event_deduplicated:Boolean(prior),candidate:null,publication:null,state:'suppressed',reasons:policy.reasons};
    const candidate=buildCandidate(event,observation,policy,this.heuristics,this.now());const savedCandidate=persist?await this.store.saveCandidate(candidate):{candidate,created:true};
    const effectiveCandidate=persist&&!savedCandidate.created&&!['published','rejected'].includes(savedCandidate.candidate.publication_state)
      ? await this.store.updateCandidate({...candidate,generated_at:savedCandidate.candidate.generated_at,updated_at:this.now().toISOString()})
      : savedCandidate.candidate;
    if(savedCandidate.created)this.emit('4663_candidate_created',{candidate_id:candidate.candidate_id,event_id:event.event_id,publication_state:candidate.publication_state});else this.counters.set('4663_candidate_duplicate',(this.counters.get('4663_candidate_duplicate')??0)+1);this.emit(candidateEvent(effectiveCandidate.publication_state),{candidate_id:candidate.candidate_id,reasons:effectiveCandidate.policy_reasons});
    if(persist)await this.eventStore.upsertEvent({...event,lifecycle_state:effectiveCandidate.publication_state==='review_required'?'review_required':effectiveCandidate.publication_state==='held'?'held':'candidate',updated_at:this.now().toISOString()});
    let publication:Published4663Signal|null=null;if(effectiveCandidate.publication_state==='auto_publishable'&&this.activation().auto_publication_enabled&&!this.options.shadow_mode)publication=await this.publish(effectiveCandidate.candidate_id,null);
    return {observation:saved.observation,observation_created:saved.created,event,event_deduplicated:Boolean(prior),candidate:effectiveCandidate,publication,state:publication?'published':'candidate',reasons:policy.reasons};
  }
  private async recordProviderHealth(provider:string,state:Rh4663ProviderHealth['state'],errorCode:string|null){const now=this.now().toISOString();const prior=(await this.store.listProviderHealth()).find((item)=>item.provider===provider);const health:Rh4663ProviderHealth={provider,state,last_attempt_at:now,last_success_at:state==='healthy'?now:prior?.last_success_at??null,last_failure_at:state==='degraded'?now:prior?.last_failure_at??null,consecutive_failures:state==='degraded'?(prior?.consecutive_failures??0)+1:0,cached:false,error_code:errorCode};await this.store.saveProviderHealth(health);if(prior?.state!=='degraded'&&state==='degraded')this.emit('4663_provider_degraded',{provider,error_code:errorCode});if(prior?.state==='degraded'&&state==='healthy')this.emit('4663_provider_recovered',{provider});}
  private emit(event:string,details:Record<string,unknown>){this.counters.set(event,(this.counters.get(event)??0)+1);this.log({event,...details});}
}

function materializeEvent(observation:Rh4663RawObservation,prior:Rh4663NormalizedEvent|undefined|null,heuristics:Rh4663HeuristicConfiguration,now:Date){
  const eventType=observation.event_type??classifyEvent(observation);if(!eventType)return null;const eventId=eventIdentity(observation,heuristics);const evidence=evidenceFrom(observation);const mergedEvidence=dedupe([...(prior?.evidence??[]),evidence],(item)=>item.reference_id);const sourceIds=[...new Set([...(prior?.source_ids??[]),observation.provider])].sort();const significance=scoreSignificance(observation,sourceIds.length);const anomaly=scoreAnomaly(observation);const created=prior?.created_at??now.toISOString();const sourceConfidence=Math.round(mergedEvidence.reduce((sum,item)=>sum+(item.confidence??observation.confidence),0)/Math.max(1,mergedEvidence.length));const freshness=worstFreshness(mergedEvidence.map((item)=>item.freshness??observation.freshness));const change=numericChange(observation.previous_value,observation.current_value);
  const event:Rh4663NormalizedEvent=Rh4663NormalizedEventSchema.parse({event_id:eventId,detected_at:prior?.detected_at??now.toISOString(),observed_at:[prior?.observed_at,observation.observed_at].filter((value):value is string=>Boolean(value)).sort()[0]??observation.observed_at,type:`rh_4663.${eventType.toLowerCase()}`,event_type:eventType,subjects:dedupe([...(prior?.subjects??[]),observation.subject],(item)=>`${item.subject_type}:${item.subject_id.toLowerCase()}`),category:legacyCategory(observation.category),intelligence_category:observation.category,metrics:{metric:observation.metric,current_value:scalarMetric(observation.current_value),previous_value:scalarMetric(observation.previous_value??null),change:change.delta,change_percent:change.percent,evidence_count:mergedEvidence.length,source_count:sourceIds.length},evidence:mergedEvidence,source_ids:sourceIds,source_confidence:sourceConfidence,anomaly_score:Math.max(prior?.anomaly_score??0,anomaly.score),significance_score:Math.max(prior?.significance_score??0,significance.total),score_components:significance.components,anomaly_basis:anomaly.basis,heuristic_version:heuristics.version,event_fingerprint:eventFingerprint(observation,heuristics),freshness_state:freshness,lifecycle_state:prior?.lifecycle_state??'normalized',publication_state:prior?.publication_state??'private',source_status:freshness==='fresh'?'fresh':'stale',created_at:created,updated_at:now.toISOString()});return {event};
}

function scoreSignificance(observation:Rh4663RawObservation,sourceCount:number){const change=numericChange(observation.previous_value,observation.current_value);const relative=Math.abs(change.percent??numeric(observation.dimensions.change_percent)??0);const current=Math.abs(numeric(observation.current_value)??0);const communityConfirmed=observation.source_type==='community'&&observation.dimensions.community_state==='confirmed';const oneTime=isOneTimeEvent(observation);const magnitude=clamp(communityConfirmed?80:oneTime?90:relative*1.5+(current>1_000_000?20:current>100_000?10:0));const velocity=clamp(communityConfirmed?40:oneTime?60:Math.abs(numeric(observation.dimensions.velocity_percent)??relative*.7));const persistence=clamp(communityConfirmed?80:oneTime?60:(numeric(observation.dimensions.persistence_windows)??1)*20);const marketImpact=clamp(communityConfirmed?50:oneTime?70:(/liquidity|volume|tvl|bridge|supply/.test(observation.metric)?50:20)+Math.min(30,Math.log10(Math.max(1,current))*4));const attentionImpact=clamp(communityConfirmed?80:oneTime?60:/volume|mint|holder|attention|wallet/.test(observation.metric)?Math.max(35,magnitude):15);const confirmation=clamp(sourceCount*35);const anomaly=scoreAnomaly(observation).score;const importance=clamp(numeric(observation.dimensions.subject_importance)??50);const quality=clamp(observation.confidence*(observation.freshness==='fresh'?1:observation.freshness==='stale'?.55:.15));const components:Rh4663ScoreComponents={magnitude:round(magnitude),velocity:round(velocity),persistence:round(persistence),market_impact:round(marketImpact),attention_impact:round(attentionImpact),cross_provider_confirmation:round(confirmation),historical_rarity:round(anomaly),subject_importance:round(importance),source_quality:round(quality)};const total=round(components.magnitude*.18+components.velocity*.10+components.persistence*.08+components.market_impact*.12+components.attention_impact*.10+components.cross_provider_confirmation*.16+components.historical_rarity*.10+components.subject_importance*.07+components.source_quality*.09);return{components,total};}
function scoreAnomaly(observation:Rh4663RawObservation){const value=numeric(observation.current_value);const baseline=observation.baseline;if(value===null||!baseline||baseline.sample_size<5||baseline.standard_deviation<=0)return{score:0,basis:'insufficient_history_no_anomaly_inference'};const zScore=Math.abs((value-baseline.mean)/baseline.standard_deviation);return{score:round(clamp((zScore-1)*25)),basis:`z_score_${zScore.toFixed(2)}_over_${baseline.sample_size}_samples_${sanitize(baseline.window,60)}`};}
function evaluatePolicy(event:Rh4663NormalizedEvent,observation:Rh4663RawObservation,heuristics:Rh4663HeuristicConfiguration){const reasons:string[]=[];if(event.significance_score<heuristics.candidate_min_significance&&event.anomaly_score<heuristics.candidate_min_anomaly)return{create:false,state:'held' as const,risk:riskClass(event,observation),reasons:['below_candidate_threshold']};if(observation.source_type==='community'&&observation.dimensions.community_state!=='confirmed')return{create:false,state:'held' as const,risk:'medium' as const,reasons:['community_signal_not_confirmed']};const risk=riskClass(event,observation);if(!evidenceSufficient(event.evidence)){reasons.push('insufficient_evidence');return{create:true,state:'held' as const,risk,reasons};}if(event.freshness_state!=='fresh'){reasons.push('evidence_not_fresh');return{create:true,state:'held' as const,risk,reasons};}if(risk==='high'){reasons.push('high_risk_reviewer_required');return{create:true,state:'review_required' as const,risk,reasons};}if(risk==='medium'){reasons.push('interpretive_claim_reviewer_required');return{create:true,state:'review_required' as const,risk,reasons};}const sources=uniqueSources(event.evidence);if(event.significance_score>=heuristics.auto_publish_min_significance&&sources.length>=heuristics.auto_publish_min_sources&&event.source_confidence>=heuristics.auto_publish_min_confidence){reasons.push('low_risk_evidence_threshold_met');return{create:true,state:'auto_publishable' as const,risk,reasons};}reasons.push(sources.length<heuristics.auto_publish_min_sources?'cross_provider_confirmation_required':'auto_publication_threshold_not_met');return{create:true,state:'held' as const,risk,reasons};}
function buildCandidate(event:Rh4663NormalizedEvent,observation:Rh4663RawObservation,policy:ReturnType<typeof evaluatePolicy>,heuristics:Rh4663HeuristicConfiguration,now:Date):Rh4663SignalCandidate{const copy=narrative(event,observation,policy.risk);const generatedAt=now.toISOString();return{candidate_id:`cand4663_${hash(event.event_id).slice(0,28)}`,event_ids:[event.event_id],event_fingerprint:event.event_fingerprint??event.event_id,category:event.intelligence_category??observation.category,signal_type:event.event_type??'COMMUNITY_SIGNAL',subjects:event.subjects,headline:copy.headline,summary:copy.summary,significance_score:event.significance_score,significance_components:scoreComponents(event.score_components),anomaly_score:event.anomaly_score,anomaly_basis:event.anomaly_basis??'insufficient_history_no_anomaly_inference',evidence:event.evidence,heuristic_version:heuristics.version,generated_at:generatedAt,updated_at:generatedAt,risk_class:policy.risk,publication_state:policy.state,policy_reasons:policy.reasons,outcome:policy.state==='held'?(policy.reasons.includes('insufficient_evidence')?'insufficient_evidence':'held'):policy.state==='review_required'?'review_required':null,finder_attribution:observation.attribution??null};}

const classifiers:Array<{type:Rh4663EventType;matches:(observation:Rh4663RawObservation)=>boolean}>=[
  {type:'VOLUME_SPIKE',matches:(o)=>/volume/.test(o.metric)}, {type:'LIQUIDITY_CHANGE',matches:(o)=>/liquidity|tvl/.test(o.metric)}, {type:'PRICE_MOVE',matches:(o)=>/price/.test(o.metric)},
  {type:'HOLDER_CHANGE',matches:(o)=>/holder/.test(o.metric)}, {type:'WALLET_CONCENTRATION_CHANGE',matches:(o)=>/concentration/.test(o.metric)}, {type:'BRIDGE_FLOW',matches:(o)=>/bridge/.test(o.metric)},
  {type:'MINT_ACTIVITY',matches:(o)=>/mint/.test(o.metric)}, {type:'NFT_ACTIVITY_SPIKE',matches:(o)=>/nft|secondary_volume/.test(o.metric)}, {type:'NEW_PAIR',matches:(o)=>o.metric==='new_pair'},
  {type:'NEW_CONTRACT',matches:(o)=>o.metric==='new_contract'}, {type:'NEW_LISTING',matches:(o)=>o.metric==='new_listing'}, {type:'ROUTE_CHANGE',matches:(o)=>/route/.test(o.metric)},
  {type:'PROVIDER_CHANGE',matches:(o)=>/provider/.test(o.metric)}, {type:'ANOMALOUS_FLOW',matches:(o)=>/flow/.test(o.metric)}, {type:'COMMUNITY_SIGNAL',matches:(o)=>o.source_type==='community'}
];
function classifyEvent(observation:Rh4663RawObservation){return classifiers.find((classifier)=>classifier.matches(observation))?.type??null;}
function eventFingerprint(observation:Rh4663RawObservation,heuristics:Rh4663HeuristicConfiguration){const type=observation.event_type??classifyEvent(observation)??'UNCLASSIFIED';const bucket=isOneTimeEvent(observation)?'identity':Math.floor(Date.parse(observation.observed_at)/heuristics.event_bucket_ms);return hash([observation.subject.subject_type,observation.subject.subject_id.toLowerCase(),type,observation.metric,bucket].join('|'));}
function eventIdentity(observation:Rh4663RawObservation,heuristics:Rh4663HeuristicConfiguration){return`rh4663_evt_${eventFingerprint(observation,heuristics).slice(0,32)}`;}
function isOneTimeEvent(observation:Rh4663RawObservation){return ['NEW_PAIR','NEW_CONTRACT','NEW_LISTING','NEW_PROJECT','NEW_INTEGRATION','NEW_AGENT'].includes(observation.event_type??'');}
function evidenceFrom(observation:Rh4663RawObservation):Rh4663EvidenceReference{const change=numericChange(observation.previous_value,observation.current_value);return{reference_id:observation.observation_id,reference_type:'provider_observation',label:`${sanitize(observation.provider,80)} / ${sanitize(observation.metric,100)}`,href:observation.source_url,observed_at:observation.observed_at,source_status:observation.freshness==='fresh'?'fresh':'stale',source:observation.provider,source_type:observation.source_type,subject:observation.subject.subject_id,metric:observation.metric,previous_value:observation.previous_value??null,current_value:observation.current_value,change:change.percent??change.delta,units:observation.units??null,provider_reference:observation.provider_reference,confidence:observation.confidence,freshness:observation.freshness};}
function riskClass(event:Rh4663NormalizedEvent,observation:Rh4663RawObservation):Rh4663RiskClass{if(['EXPLOIT_INDICATOR','CONTRACT_RISK'].includes(event.event_type??'')||hasSevereLanguage(Object.values(observation.dimensions).filter((item):item is string=>typeof item==='string').join(' ')))return'high';if(['ANOMALOUS_FLOW','WALLET_CONCENTRATION_CHANGE','PROVIDER_CHANGE','ROUTE_CHANGE','COMMUNITY_SIGNAL'].includes(event.event_type??''))return'medium';return'low';}
function narrative(event:Rh4663NormalizedEvent,observation:Rh4663RawObservation,risk:Rh4663RiskClass){const subject=sanitize(observation.subject.label??observation.subject.subject_id,80).toUpperCase();if(risk==='high')return{headline:'CONTRACT BEHAVIOR REQUIRES REVIEW',summary:`Structured ${sanitize(observation.metric,80)} evidence for ${subject} triggered a high-risk review gate. No malicious cause is asserted.`};const change=numericChange(observation.previous_value,observation.current_value);const value=formatValue(observation.current_value,observation.units);const delta=change.percent===null?'':` ${signed(change.percent)}%`;const templates:Partial<Record<Rh4663EventType,{headline:string;summary:string}>>={PRICE_MOVE:{headline:`${subject} PRICE MOVE${delta}`,summary:`Persisted onchain price evidence is now ${value}.${priorPhrase(observation)}`},VOLUME_SPIKE:{headline:`${subject} VOLUME${delta}`,summary:`Persisted onchain volume is now ${value}.${priorPhrase(observation)}`},LIQUIDITY_CHANGE:{headline:`${subject} LIQUIDITY${delta}`,summary:`Persisted liquidity evidence is now ${value}.${priorPhrase(observation)}`},HOLDER_CHANGE:{headline:`${subject} HOLDER CHANGE${delta}`,summary:`Persisted holder evidence is now ${value}.${priorPhrase(observation)}`},WALLET_CONCENTRATION_CHANGE:{headline:'UNUSUAL WALLET CONCENTRATION',summary:`Wallet concentration evidence for ${subject} changed${delta || ` to ${value}`}. No cause is inferred.`},ANOMALOUS_FLOW:{headline:'ANOMALOUS FLOW DETECTED',summary:`The ${sanitize(observation.metric,80)} observation for ${subject} is behaviorally unusual. Anomaly does not imply malicious activity.`},NEW_PAIR:{headline:`NEW PAIR DETECTED / ${subject}`,summary:'A new pair identity was observed and persisted. Listing quality, safety, and endorsement are not inferred.'},NEW_CONTRACT:{headline:`NEW CONTRACT DETECTED / ${subject}`,summary:'A new exact-contract identity was observed and persisted. Project claims and safety remain unverified.'},MINT_ACTIVITY:{headline:`${subject} MINT ACTIVITY`,summary:`Persisted mint activity is now ${value}.${priorPhrase(observation)}`},NFT_ACTIVITY_SPIKE:{headline:`${subject} NFT ACTIVITY${delta}`,summary:`Persisted cultural / NFT activity is now ${value}.${priorPhrase(observation)}`},BRIDGE_FLOW:{headline:`${subject} BRIDGE FLOW${delta}`,summary:`Persisted bridge-flow evidence is now ${value}. Direction is described without bullish or bearish interpretation.`},COMMUNITY_SIGNAL:{headline:sanitize(String(observation.dimensions.title??'COMMUNITY SIGNAL'),120).toUpperCase(),summary:`Community evidence submitted by ${sanitize(observation.attribution?.submitted_by??'an attributed finder',120)} reached confirmation and requires editorial review.`}};return templates[event.event_type??'COMMUNITY_SIGNAL']??{headline:`${subject} ${String(event.event_type??'SIGNAL').replaceAll('_',' ')}`,summary:`Persisted ${sanitize(observation.metric,80)} evidence is now ${value}.`};}

export function rankPublishedSignalsForToday(signals:Published4663Signal[],limit=5){const ordered=[...signals].sort((a,b)=>todayScore(b)-todayScore(a)||b.published_at.localeCompare(a.published_at));const selected:Published4663Signal[]=[];const categories=new Set<string>();for(const signal of ordered){if(!categories.has(signal.category)){selected.push(signal);categories.add(signal.category);}if(selected.length>=limit)break;}for(const signal of ordered){if(selected.length>=limit)break;if(!selected.some((item)=>item.signal_id===signal.signal_id))selected.push(signal);}return selected;}
function todayScore(signal:Published4663Signal){const ageHours=Math.max(0,(Date.now()-Date.parse(signal.published_at))/3_600_000);const freshness=Math.max(0,30-ageHours);return signal.significance_score*.55+signal.anomaly_score*.2+signal.source_count*5+freshness;}

function legacyCategory(category:Rh4663IntelligenceCategory):Rh4663SignalCategory{return({MEMES:'meme',STOCK_TOKENS:'stock_token',RWA_DEFI:'defi',STABLES:'liquidity',CULTURE_NFT:'nft_culture',UTILITY:'utility',AGENT:'agent',WALLET:'wallet',LIQUIDITY:'liquidity',INTEGRATION:'integration',SECURITY:'risk',OTHER:'other'}as const)[category];}
export function intelligenceCategory(category:Rh4663SignalCategory):Rh4663IntelligenceCategory{return({meme:'MEMES',stock_token:'STOCK_TOKENS',defi:'RWA_DEFI',liquidity:'LIQUIDITY',nft_culture:'CULTURE_NFT',utility:'UTILITY',agent:'AGENT',wallet:'WALLET',integration:'INTEGRATION',risk:'SECURITY',other:'OTHER'}as const)[category];}
function uniqueSources(evidence:Rh4663EvidenceReference[]){return[...new Set(evidence.map((item)=>item.source??item.reference_id))];}
function evidenceSufficient(evidence:Rh4663EvidenceReference[]){return evidence.length>0&&evidence.every((item)=>item.observed_at&&item.source&&item.metric&&item.current_value!==undefined&&item.confidence!==undefined&&item.provider_reference);}
function scoreComponents(value:Rh4663NormalizedEvent['score_components']):Rh4663ScoreComponents{return{magnitude:value?.magnitude??0,velocity:value?.velocity??0,persistence:value?.persistence??0,market_impact:value?.market_impact??0,attention_impact:value?.attention_impact??0,cross_provider_confirmation:value?.cross_provider_confirmation??0,historical_rarity:value?.historical_rarity??0,subject_importance:value?.subject_importance??0,source_quality:value?.source_quality??0};}
function candidateEvent(state:Rh4663CandidatePublicationState){return state==='held'?'4663_candidate_held':state==='review_required'?'4663_candidate_review_required':state==='rejected'?'4663_candidate_rejected':'4663_candidate_created';}
function filterPublications(values:Published4663Signal[],filters:Rh4663PublicationFilters){return values.filter((item)=>(!filters.category||item.category===filters.category)&&(!filters.signal_type||item.signal_type===filters.signal_type)&&(!filters.since||item.published_at>=filters.since)&&(!filters.subject||item.subjects.some((subject)=>subject.subject_id.toLowerCase()===filters.subject!.toLowerCase()))).sort((a,b)=>b.published_at.localeCompare(a.published_at)||a.signal_id.localeCompare(b.signal_id)).slice(0,filters.limit??1_000);}
function numericChange(previous:unknown,current:unknown){const p=numeric(previous),c=numeric(current);if(p===null||c===null)return{delta:null,percent:null};const delta=c-p;return{delta:round(delta,6),percent:p===0?null:round(delta/Math.abs(p)*100,2)};}
function numeric(value:unknown){return typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))?Number(value):null;}
function scalarMetric(value:unknown):string|number|boolean|null{return typeof value==='number'||typeof value==='string'||typeof value==='boolean'||value===null?value:null;}
function priorPhrase(observation:Rh4663RawObservation){return observation.previous_value===undefined?'':` Previous persisted value: ${formatValue(observation.previous_value,observation.units)}`;}
function formatValue(value:unknown,units?:string|null){if(typeof value==='number')return`${Number.isInteger(value)?value.toLocaleString('en-US'):round(value,4).toLocaleString('en-US')}${units?` ${sanitize(units,20)}`:''}`;return`${sanitize(String(value),80)}${units?` ${sanitize(units,20)}`:''}`;}
function signed(value:number){return`${value>=0?'+':''}${round(value,2)}`;}
function worstFreshness(values:Array<'fresh'|'stale'|'expired'>){return values.includes('expired')?'expired' as const:values.includes('stale')?'stale' as const:'fresh' as const;}
function hasSevereLanguage(value:string){return/\b(rug|scam|exploit|manipulation|insider|fraud|malicious|stolen funds)\b/i.test(value);}
function sanitize(value:string,max:number){return value.replace(/[<>\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function safeReference(value:string){return value.startsWith('/')||(()=>{try{return new URL(value).protocol==='https:';}catch{return false;}})();}
function clamp(value:number){return Math.max(0,Math.min(100,value));}
function round(value:number,digits=0){const factor=10**digits;return Math.round(value*factor)/factor;}
function average(values:number[]){return values.length?round(values.reduce((sum,value)=>sum+value,0)/values.length,2):0;}
function ratio(value:number,total:number){return total?round(value/total,4):0;}
function dedupe<T>(values:T[],key:(value:T)=>string){const map=new Map<string,T>();for(const value of values)map.set(key(value),value);return[...map.values()];}
function stable(value:unknown):string{if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;return JSON.stringify(value);}
function hash(value:string){return createHash('sha256').update(value).digest('hex');}
function clone<T>(value:T):T{return value===undefined?value:structuredClone(value);}
async function withTimeout<T>(promise:Promise<T>,timeoutMs:number,code:string){let timer:NodeJS.Timeout|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(code)),Math.max(1,timeoutMs));})]);}finally{if(timer)clearTimeout(timer);}}
async function retryBounded<T>(operation:()=>Promise<T>,maxRetries:number){let last:unknown;for(let attempt=0;attempt<=Math.min(5,Math.max(0,maxRetries));attempt++){try{return await operation();}catch(error){last=error;if(attempt<maxRetries)await new Promise((resolve)=>setTimeout(resolve,Math.min(250,25*2**attempt)));}}throw last;}
function boundedErrorCode(error:unknown){const value=error instanceof Error?error.message:'provider_failed';return sanitize(value,80).replace(/[^A-Za-z0-9._:-]/g,'_')||'provider_failed';}
