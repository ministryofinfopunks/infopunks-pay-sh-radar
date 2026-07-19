import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export const RH_CHAIN_CLASSIFICATION_STATES = ['proposed', 'source_required', 'under_review', 'approved', 'rejected', 'superseded', 'archived'] as const;
export const RH_CHAIN_CLASSIFICATION_LAYERS = ['meme', 'rwa', 'agent', 'infrastructure', 'defi', 'unknown'] as const;
export const RH_CHAIN_CLASSIFICATION_SOURCES = ['manual_review', 'internal_research', 'provider_observation', 'community_submission', 'review_pipeline'] as const;
export const RH_CHAIN_CLASSIFICATION_EVIDENCE_KINDS = ['primary_source', 'onchain', 'market_context', 'social', 'receipt', 'manual_note'] as const;

const exactContract = z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, 'exact_rh_chain_contract_required').transform((value) => value.toLowerCase());
const timestamp = z.string().datetime();
const boundedText = z.string().trim().min(1).max(2_000);
const optionalUrl = z.string().trim().url().max(1_000).nullable();

export const RhChainClassificationEvidenceSchema = z.object({
  evidence_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  kind: z.enum(RH_CHAIN_CLASSIFICATION_EVIDENCE_KINDS),
  source_name: z.string().trim().min(1).max(160),
  source_url: optionalUrl,
  summary: boundedText,
  observed_at: timestamp,
  content_hash: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9:_-]+$/).nullable()
}).strict();

const reviewerAction = z.enum(['proposed', 'approved', 'rejected', 'superseded']);
export const RhChainClassificationReviewerAuditSchema = z.object({
  last_reviewer_id: z.string().trim().min(1).max(64),
  last_action: reviewerAction,
  last_action_at: timestamp,
  audit_note: boundedText
}).strict();

const RhChainReviewedClassificationBaseSchema = z.object({
  chain: z.literal('robinhood'),
  contract: exactContract,
  primary_layer: z.enum(RH_CHAIN_CLASSIFICATION_LAYERS),
  secondary_layers: z.array(z.enum(RH_CHAIN_CLASSIFICATION_LAYERS)).max(5),
  confidence: z.enum(['low', 'medium', 'high']),
  classification_evidence: z.array(RhChainClassificationEvidenceSchema).max(50),
  classification_version: z.number().int().positive(),
  review_status: z.enum(RH_CHAIN_CLASSIFICATION_STATES),
  reviewer_audit: RhChainClassificationReviewerAuditSchema,
  effective_at: timestamp.nullable(),
  superseded_at: timestamp.nullable(),
  source: z.enum(RH_CHAIN_CLASSIFICATION_SOURCES),
  manual_override_reason: z.string().trim().min(1).max(2_000).nullable(),
  created_at: timestamp,
  updated_at: timestamp
}).strict();
export const RhChainReviewedClassificationSchema = RhChainReviewedClassificationBaseSchema.superRefine((value, context) => {
  for (const issue of classificationInvariantIssues(value)) context.addIssue({ code: 'custom', ...issue });
});
export const RhChainPublicClassificationSchema = RhChainReviewedClassificationBaseSchema.omit({ reviewer_audit: true, manual_override_reason: true }).superRefine((value, context) => {
  for (const issue of classificationInvariantIssues(value)) context.addIssue({ code: 'custom', ...issue });
});

export const RhChainClassificationAuditEventSchema = z.object({
  event_id: z.string().uuid(),
  chain: z.literal('robinhood'),
  contract: exactContract,
  classification_version: z.number().int().positive(),
  action: reviewerAction,
  from_status: z.enum(RH_CHAIN_CLASSIFICATION_STATES).nullable(),
  to_status: z.enum(RH_CHAIN_CLASSIFICATION_STATES),
  reviewer_id: z.string().trim().min(1).max(64),
  reason: boundedText,
  occurred_at: timestamp,
  record: RhChainReviewedClassificationSchema
}).strict();

const initialState = z.enum(['proposed', 'source_required', 'under_review']);
export const RhChainClassificationProposalSchema = z.object({
  chain: z.literal('robinhood').default('robinhood'),
  contract: exactContract,
  primary_layer: z.enum(RH_CHAIN_CLASSIFICATION_LAYERS),
  secondary_layers: z.array(z.enum(RH_CHAIN_CLASSIFICATION_LAYERS)).max(5).default([]),
  confidence: z.enum(['low', 'medium', 'high']),
  classification_evidence: z.array(RhChainClassificationEvidenceSchema).max(50).default([]),
  review_status: initialState.default('proposed'),
  source: z.enum(RH_CHAIN_CLASSIFICATION_SOURCES),
  manual_override_reason: z.string().trim().min(1).max(2_000).nullable().default(null),
  audit_note: boundedText,
  expected_version: z.number().int().positive().optional()
}).strict().superRefine((value, context) => {
  if (new Set(value.secondary_layers).size !== value.secondary_layers.length) context.addIssue({ code: 'custom', path: ['secondary_layers'], message: 'secondary_layers_must_be_unique' });
  if (value.secondary_layers.includes(value.primary_layer)) context.addIssue({ code: 'custom', path: ['secondary_layers'], message: 'primary_layer_cannot_repeat_as_secondary' });
  if (value.secondary_layers.includes('unknown')) context.addIssue({ code: 'custom', path: ['secondary_layers'], message: 'unknown_cannot_be_a_secondary_layer' });
  if (value.review_status !== 'source_required' && !value.classification_evidence.length) context.addIssue({ code: 'custom', path: ['classification_evidence'], message: 'classification_evidence_required' });
});

export const RhChainClassificationApprovalSchema = z.object({
  expected_version: z.number().int().positive(),
  audit_note: boundedText,
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  classification_evidence: z.array(RhChainClassificationEvidenceSchema).max(50).optional(),
  manual_override_reason: z.string().trim().min(1).max(2_000).nullable().optional()
}).strict();
export const RhChainClassificationRejectionSchema = z.object({ expected_version: z.number().int().positive(), audit_note: boundedText, reason: boundedText }).strict();
export const RhChainClassificationSupersessionSchema = z.object({ expected_version: z.number().int().positive(), audit_note: boundedText, reason: boundedText }).strict();
export const RhChainClassificationContractSchema = z.object({ contract: exactContract }).strict();
export const RhChainClassificationPagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(RH_CHAIN_CLASSIFICATION_STATES).optional()
}).strict();
export const RhChainClassificationAuditPagingSchema = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), page_size: z.coerce.number().int().min(1).max(100).default(25) }).strict();

export type RhChainReviewedClassification = z.infer<typeof RhChainReviewedClassificationSchema>;
export type RhChainClassificationAuditEvent = z.infer<typeof RhChainClassificationAuditEventSchema>;
export type RhChainClassificationProposal = z.infer<typeof RhChainClassificationProposalSchema>;
export type RhChainClassificationApproval = z.infer<typeof RhChainClassificationApprovalSchema>;
export type RhChainClassificationRejection = z.infer<typeof RhChainClassificationRejectionSchema>;
export type RhChainClassificationSupersession = z.infer<typeof RhChainClassificationSupersessionSchema>;
export type RhChainClassificationStatus = typeof RH_CHAIN_CLASSIFICATION_STATES[number];
export type RhChainClassificationPaging = z.infer<typeof RhChainClassificationPagingSchema>;

type Page<T> = { items: T[]; page: number; page_size: number; has_more: boolean };
type ListOptions = RhChainClassificationPaging & { approved_active_only?: boolean };
type StoreConflict = { conflict: true; current: RhChainReviewedClassification };
type StoreMutation = RhChainReviewedClassification | StoreConflict | null;

export interface RhChainReviewedClassificationStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  create(record: RhChainReviewedClassification, event: RhChainClassificationAuditEvent): Promise<RhChainReviewedClassification | StoreConflict>;
  get(contract: string): Promise<RhChainReviewedClassification | null>;
  list(options: ListOptions): Promise<Page<RhChainReviewedClassification>>;
  mutate(contract: string, expectedVersion: number, transition: (current: RhChainReviewedClassification) => { record: RhChainReviewedClassification; event: RhChainClassificationAuditEvent }): Promise<StoreMutation>;
  audit(contract: string, paging: Pick<RhChainClassificationPaging, 'page' | 'page_size'>): Promise<Page<RhChainClassificationAuditEvent>>;
  close?(): Promise<void>;
}

export class InMemoryRhChainReviewedClassificationStore implements RhChainReviewedClassificationStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly records = new Map<string, RhChainReviewedClassification>();
  private readonly events = new Map<string, RhChainClassificationAuditEvent[]>();

  async create(record: RhChainReviewedClassification, event: RhChainClassificationAuditEvent) {
    const parsed = RhChainReviewedClassificationSchema.parse(record);
    const key = parsed.contract;
    const current = this.records.get(key);
    if (current) return { conflict: true as const, current: structuredClone(current) };
    this.records.set(key, structuredClone(parsed));
    this.events.set(key, [structuredClone(RhChainClassificationAuditEventSchema.parse(event))]);
    return structuredClone(parsed);
  }
  async get(contract: string) { const record = this.records.get(normalizeContract(contract)); return record ? structuredClone(RhChainReviewedClassificationSchema.parse(record)) : null; }
  async list(options: ListOptions) {
    const filtered = [...this.records.values()].filter((record) => (!options.status || record.review_status === options.status) && (!options.approved_active_only || isApprovedActive(record))).sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.contract.localeCompare(right.contract));
    return memoryPage(filtered.map((record) => RhChainReviewedClassificationSchema.parse(structuredClone(record))), options.page, options.page_size);
  }
  async mutate(contract: string, expectedVersion: number, transition: (current: RhChainReviewedClassification) => { record: RhChainReviewedClassification; event: RhChainClassificationAuditEvent }): Promise<StoreMutation> {
    const key = normalizeContract(contract); const current = this.records.get(key);
    if (!current) return null;
    if (current.classification_version !== expectedVersion) return { conflict: true, current: structuredClone(current) };
    const changed = transition(structuredClone(RhChainReviewedClassificationSchema.parse(current)));
    const record = RhChainReviewedClassificationSchema.parse(changed.record);
    const event = RhChainClassificationAuditEventSchema.parse(changed.event);
    this.records.set(key, structuredClone(record));
    this.events.set(key, [...(this.events.get(key) ?? []), structuredClone(event)]);
    return structuredClone(record);
  }
  async audit(contract: string, paging: Pick<RhChainClassificationPaging, 'page' | 'page_size'>) {
    const events = [...(this.events.get(normalizeContract(contract)) ?? [])].sort((left, right) => right.occurred_at.localeCompare(left.occurred_at) || right.classification_version - left.classification_version || right.event_id.localeCompare(left.event_id)).map((event) => RhChainClassificationAuditEventSchema.parse(structuredClone(event)));
    return memoryPage(events, paging.page, paging.page_size);
  }
}

export class PostgresRhChainReviewedClassificationStore implements RhChainReviewedClassificationStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }

  async create(record: RhChainReviewedClassification, event: RhChainClassificationAuditEvent) {
    const parsed = RhChainReviewedClassificationSchema.parse(record); const audit = RhChainClassificationAuditEventSchema.parse(event);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`insert into rh_chain_reviewed_classifications (chain, contract, primary_layer, review_status, classification_version, effective_at, superseded_at, created_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, recordParams(parsed));
      await client.query(`insert into rh_chain_reviewed_classification_audit (event_id, chain, contract, classification_version, action, reviewer_id, occurred_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, auditParams(audit));
      await client.query('commit'); return parsed;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (postgresCode(error) === '23505') { const current = await this.get(parsed.contract); if (current) return { conflict: true as const, current }; }
      throw error;
    } finally { client.release(); }
  }
  async get(contract: string) {
    const result = await this.pool.query<{ payload: unknown }>('select payload from rh_chain_reviewed_classifications where chain=$1 and contract=$2', ['robinhood', normalizeContract(contract)]);
    return result.rows[0] ? parseStoredClassification(result.rows[0].payload) : null;
  }
  async list(options: ListOptions) {
    const conditions = ['chain=$1']; const values: unknown[] = ['robinhood'];
    if (options.status) { values.push(options.status); conditions.push(`review_status=$${values.length}`); }
    if (options.approved_active_only) conditions.push("review_status='approved' and effective_at is not null and superseded_at is null");
    values.push(options.page_size + 1, (options.page - 1) * options.page_size);
    const result = await this.pool.query<{ payload: unknown }>(`select payload from rh_chain_reviewed_classifications where ${conditions.join(' and ')} order by updated_at desc, contract asc limit $${values.length - 1} offset $${values.length}`, values);
    const records = result.rows.map((row) => parseStoredClassification(row.payload));
    return { items: records.slice(0, options.page_size), page: options.page, page_size: options.page_size, has_more: records.length > options.page_size };
  }
  async mutate(contract: string, expectedVersion: number, transition: (current: RhChainReviewedClassification) => { record: RhChainReviewedClassification; event: RhChainClassificationAuditEvent }): Promise<StoreMutation> {
    const client = await this.pool.connect(); const normalized = normalizeContract(contract);
    try {
      await client.query('begin');
      const found = await client.query<{ payload: unknown }>('select payload from rh_chain_reviewed_classifications where chain=$1 and contract=$2 for update', ['robinhood', normalized]);
      if (!found.rows[0]) { await client.query('rollback'); return null; }
      const current = parseStoredClassification(found.rows[0].payload);
      if (current.classification_version !== expectedVersion) { await client.query('rollback'); return { conflict: true, current }; }
      const changed = transition(current); const record = RhChainReviewedClassificationSchema.parse(changed.record); const event = RhChainClassificationAuditEventSchema.parse(changed.event);
      const saved = await client.query(`update rh_chain_reviewed_classifications set primary_layer=$3, review_status=$4, classification_version=$5, effective_at=$6, superseded_at=$7, created_at=$8, updated_at=$9, payload=$10::jsonb where chain=$1 and contract=$2 and classification_version=$11`, [...recordParams(record), expectedVersion]);
      if (!saved.rowCount) { await client.query('rollback'); const latest = await this.get(normalized); return latest ? { conflict: true, current: latest } : null; }
      await client.query(`insert into rh_chain_reviewed_classification_audit (event_id, chain, contract, classification_version, action, reviewer_id, occurred_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, auditParams(event));
      await client.query('commit'); return record;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async audit(contract: string, paging: Pick<RhChainClassificationPaging, 'page' | 'page_size'>) {
    const result = await this.pool.query<{ payload: unknown }>('select payload from rh_chain_reviewed_classification_audit where chain=$1 and contract=$2 order by occurred_at desc, classification_version desc, event_id desc limit $3 offset $4', ['robinhood', normalizeContract(contract), paging.page_size + 1, (paging.page - 1) * paging.page_size]);
    const events = result.rows.map((row) => parseStoredAudit(row.payload));
    return { items: events.slice(0, paging.page_size), page: paging.page, page_size: paging.page_size, has_more: events.length > paging.page_size };
  }
  async close() { if (this.ownsPool) await this.pool.end(); }
}

export class RhChainClassificationError extends Error {
  constructor(readonly code: 'rh_chain_classification_not_found' | 'rh_chain_classification_conflict' | 'rh_chain_classification_invalid_transition' | 'rh_chain_classification_version_required' | 'rh_chain_classification_stored_payload_invalid', readonly current?: RhChainReviewedClassification) { super(code); }
}

export class RhChainReviewedClassificationService {
  private readonly now: () => Date;
  private readonly id: () => string;
  constructor(readonly store: RhChainReviewedClassificationStore, options: { now?: () => Date; id?: () => string } = {}) { this.now = options.now ?? (() => new Date()); this.id = options.id ?? randomUUID; }

  async list(input: unknown) { const paging = RhChainClassificationPagingSchema.parse(input); return { ...(await this.store.list(paging)), storage: this.storage(), authoritative: true as const }; }
  async get(input: unknown) { const { contract } = RhChainClassificationContractSchema.parse(input); const record = await this.store.get(contract); if (!record) throw new RhChainClassificationError('rh_chain_classification_not_found'); return { classification: record, storage: this.storage(), authoritative: true as const }; }
  async listApproved(input: unknown) {
    const paging = RhChainClassificationPagingSchema.omit({ status: true }).parse(input);
    const page = await this.store.list({ ...paging, approved_active_only: true });
    const { items, ...pagination } = page;
    return { ...pagination, classifications: items.map(publicClassification), authoritative: true as const, doctrine: 'Exact contract identity and reviewed memory outrank provider context.' };
  }
  async propose(input: unknown, reviewerId: string) {
    const proposal = RhChainClassificationProposalSchema.parse(input); const now = this.now().toISOString(); const existing = await this.store.get(proposal.contract);
    if (existing && !terminal(existing.review_status)) throw new RhChainClassificationError('rh_chain_classification_invalid_transition', existing);
    if (existing && proposal.expected_version === undefined) throw new RhChainClassificationError('rh_chain_classification_version_required', existing);
    const record = makeProposedRecord(proposal, reviewerId, now, existing?.classification_version ? existing.classification_version + 1 : 1, existing?.created_at ?? now);
    const event = this.event(record, existing?.review_status ?? null, reviewerId, proposal.audit_note, 'proposed', now);
    const result = existing
      ? await this.store.mutate(record.contract, proposal.expected_version!, () => ({ record, event }))
      : await this.store.create(record, event);
    return this.result(result);
  }
  async approve(contractInput: unknown, input: unknown, reviewerId: string) {
    const { contract } = RhChainClassificationContractSchema.parse(contractInput); const approval = RhChainClassificationApprovalSchema.parse(input); const now = this.now().toISOString();
    return this.result(await this.store.mutate(contract, approval.expected_version, (current) => {
      requireTransition(current, ['proposed', 'source_required', 'under_review']);
      const evidence = approval.classification_evidence ? mergeEvidence(current.classification_evidence, approval.classification_evidence) : current.classification_evidence;
      if (!evidence.length) throw new RhChainClassificationError('rh_chain_classification_invalid_transition', current);
      const record = RhChainReviewedClassificationSchema.parse({ ...current, confidence: approval.confidence ?? current.confidence, classification_evidence: evidence, classification_version: current.classification_version + 1, review_status: 'approved', reviewer_audit: reviewerAudit(reviewerId, 'approved', now, approval.audit_note), effective_at: now, superseded_at: null, manual_override_reason: approval.manual_override_reason === undefined ? current.manual_override_reason : approval.manual_override_reason, updated_at: now });
      return { record, event: this.event(record, current.review_status, reviewerId, approval.audit_note, 'approved', now) };
    }));
  }
  async reject(contractInput: unknown, input: unknown, reviewerId: string) {
    const { contract } = RhChainClassificationContractSchema.parse(contractInput); const rejection = RhChainClassificationRejectionSchema.parse(input); const now = this.now().toISOString();
    return this.result(await this.store.mutate(contract, rejection.expected_version, (current) => {
      requireTransition(current, ['proposed', 'source_required', 'under_review']);
      const note = `${rejection.audit_note} Reason: ${rejection.reason}`.slice(0, 2_000);
      const record = RhChainReviewedClassificationSchema.parse({ ...current, classification_version: current.classification_version + 1, review_status: 'rejected', reviewer_audit: reviewerAudit(reviewerId, 'rejected', now, note), effective_at: null, superseded_at: null, updated_at: now });
      return { record, event: this.event(record, current.review_status, reviewerId, note, 'rejected', now) };
    }));
  }
  async supersede(contractInput: unknown, input: unknown, reviewerId: string) {
    const { contract } = RhChainClassificationContractSchema.parse(contractInput); const supersession = RhChainClassificationSupersessionSchema.parse(input); const now = this.now().toISOString();
    return this.result(await this.store.mutate(contract, supersession.expected_version, (current) => {
      requireTransition(current, ['approved']);
      const note = `${supersession.audit_note} Reason: ${supersession.reason}`.slice(0, 2_000);
      const record = RhChainReviewedClassificationSchema.parse({ ...current, classification_version: current.classification_version + 1, review_status: 'superseded', reviewer_audit: reviewerAudit(reviewerId, 'superseded', now, note), superseded_at: now, updated_at: now });
      return { record, event: this.event(record, current.review_status, reviewerId, note, 'superseded', now) };
    }));
  }
  async audit(contractInput: unknown, pagingInput: unknown) {
    const { contract } = RhChainClassificationContractSchema.parse(contractInput); const paging = RhChainClassificationAuditPagingSchema.parse(pagingInput);
    if (!await this.store.get(contract)) throw new RhChainClassificationError('rh_chain_classification_not_found');
    return { ...(await this.store.audit(contract, paging)), contract, storage: this.storage(), authoritative: true as const };
  }
  private event(record: RhChainReviewedClassification, from: RhChainClassificationStatus | null, reviewerId: string, reason: string, action: z.infer<typeof reviewerAction>, now: string): RhChainClassificationAuditEvent { return RhChainClassificationAuditEventSchema.parse({ event_id: this.id(), chain: 'robinhood', contract: record.contract, classification_version: record.classification_version, action, from_status: from, to_status: record.review_status, reviewer_id: reviewerId, reason, occurred_at: now, record }); }
  private result(result: StoreMutation | RhChainReviewedClassification | StoreConflict) { if (!result) throw new RhChainClassificationError('rh_chain_classification_not_found'); if ('conflict' in result) throw new RhChainClassificationError('rh_chain_classification_conflict', result.current); return { classification: result, storage: this.storage(), authoritative: true as const }; }
  private storage() { return { adapter: this.store.adapter, durable: this.store.durable, migrations_run_at_startup: false as const }; }
}

function makeProposedRecord(input: RhChainClassificationProposal, reviewerId: string, now: string, version: number, createdAt: string): RhChainReviewedClassification {
  return RhChainReviewedClassificationSchema.parse({ chain: 'robinhood', contract: input.contract, primary_layer: input.primary_layer, secondary_layers: input.secondary_layers, confidence: input.confidence, classification_evidence: input.classification_evidence, classification_version: version, review_status: input.review_status, reviewer_audit: reviewerAudit(reviewerId, 'proposed', now, input.audit_note), effective_at: null, superseded_at: null, source: input.source, manual_override_reason: input.manual_override_reason, created_at: createdAt, updated_at: now });
}
function reviewerAudit(reviewerId: string, action: z.infer<typeof reviewerAction>, now: string, note: string) { return { last_reviewer_id: reviewerId, last_action: action, last_action_at: now, audit_note: note }; }
function requireTransition(current: RhChainReviewedClassification, allowed: RhChainClassificationStatus[]) { if (!allowed.includes(current.review_status)) throw new RhChainClassificationError('rh_chain_classification_invalid_transition', current); }
function terminal(status: RhChainClassificationStatus) { return status === 'rejected' || status === 'superseded' || status === 'archived'; }
function isApprovedActive(record: RhChainReviewedClassification) { return record.review_status === 'approved' && Boolean(record.effective_at) && !record.superseded_at; }
function publicClassification(record: RhChainReviewedClassification) { const { reviewer_audit: _reviewerAudit, manual_override_reason: _manualOverrideReason, ...publicRecord } = record; return RhChainPublicClassificationSchema.parse(publicRecord); }
function mergeEvidence(current: RhChainReviewedClassification['classification_evidence'], additions: RhChainReviewedClassification['classification_evidence']) { const byId = new Map(current.map((item) => [item.evidence_id, item])); for (const item of additions) byId.set(item.evidence_id, item); return [...byId.values()].slice(0, 50); }
function classificationInvariantIssues(value: { secondary_layers: string[]; primary_layer: string; review_status: string; effective_at: string | null; superseded_at: string | null; classification_evidence: unknown[] }) {
  const issues: Array<{ path: string[]; message: string }> = [];
  if (new Set(value.secondary_layers).size !== value.secondary_layers.length) issues.push({ path: ['secondary_layers'], message: 'secondary_layers_must_be_unique' });
  if (value.secondary_layers.includes(value.primary_layer)) issues.push({ path: ['secondary_layers'], message: 'primary_layer_cannot_repeat_as_secondary' });
  if (value.secondary_layers.includes('unknown')) issues.push({ path: ['secondary_layers'], message: 'unknown_cannot_be_a_secondary_layer' });
  if (value.review_status === 'approved' && !value.effective_at) issues.push({ path: ['effective_at'], message: 'approved_classification_requires_effective_at' });
  if (value.review_status === 'approved' && !value.classification_evidence.length) issues.push({ path: ['classification_evidence'], message: 'approved_classification_requires_evidence' });
  if (value.review_status === 'superseded' && !value.superseded_at) issues.push({ path: ['superseded_at'], message: 'superseded_classification_requires_timestamp' });
  return issues;
}
function normalizeContract(contract: string) { return contract.trim().toLowerCase(); }
function memoryPage<T>(items: T[], page: number, pageSize: number): Page<T> { const start = (page - 1) * pageSize; return { items: items.slice(start, start + pageSize), page, page_size: pageSize, has_more: items.length > start + pageSize }; }
function parseStoredClassification(payload: unknown) { const parsed = RhChainReviewedClassificationSchema.safeParse(payload); if (!parsed.success) throw new RhChainClassificationError('rh_chain_classification_stored_payload_invalid'); return parsed.data; }
function parseStoredAudit(payload: unknown) { const parsed = RhChainClassificationAuditEventSchema.safeParse(payload); if (!parsed.success) throw new RhChainClassificationError('rh_chain_classification_stored_payload_invalid'); return parsed.data; }
function recordParams(record: RhChainReviewedClassification) { return [record.chain, record.contract, record.primary_layer, record.review_status, record.classification_version, record.effective_at, record.superseded_at, record.created_at, record.updated_at, JSON.stringify(record)]; }
function auditParams(event: RhChainClassificationAuditEvent) { return [event.event_id, event.chain, event.contract, event.classification_version, event.action, event.reviewer_id, event.occurred_at, JSON.stringify(event)]; }
function postgresCode(error: unknown) { return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : null; }
