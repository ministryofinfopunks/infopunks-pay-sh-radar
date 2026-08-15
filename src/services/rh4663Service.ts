import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export const RH_4663_PROTOCOL_VERSION = 'infopunks.rh-pulse.call.v1' as const;
export const RH_4663_GENESIS_LIMIT = 4_663;
export const RH_4663_PULSE_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const RH_4663_GENESIS_POLICY = {
  version: 'infopunks.rh-pulse.genesis-eligibility.v1',
  scope: 'global_distinct_wallet',
  qualifying_receipt: 'verified_signed_call_receipt',
  ordinal_order: 'first_committed_wallet',
  maximum_positions: RH_4663_GENESIS_LIMIT,
  repeat_wallet_positions: 0,
  economic_entitlement: false
} as const;
export type Hex = `0x${string}`;

export const Rh4663RotationOptionSchema = z.enum([
  'MEMES',
  'STOCK_TOKENS',
  'RWA_DEFI',
  'STABLES',
  'NO_QUALIFIED_ROTATION'
]);
export type Rh4663RotationOption = z.infer<typeof Rh4663RotationOptionSchema>;

export const Rh4663SignalCategorySchema = z.enum([
  'meme', 'nft_culture', 'utility', 'agent', 'stock_token', 'defi', 'wallet', 'liquidity', 'risk', 'integration', 'other'
]);
export type Rh4663SignalCategory = z.infer<typeof Rh4663SignalCategorySchema>;

/** Phase 3 intelligence vocabulary. Pulse prediction options above remain frozen. */
export const Rh4663IntelligenceCategorySchema = z.enum([
  'MEMES', 'STOCK_TOKENS', 'RWA_DEFI', 'STABLES', 'CULTURE_NFT', 'UTILITY', 'AGENT', 'WALLET', 'LIQUIDITY', 'INTEGRATION', 'SECURITY', 'OTHER'
]);
export type Rh4663IntelligenceCategory = z.infer<typeof Rh4663IntelligenceCategorySchema>;

export const Rh4663EventTypeSchema = z.enum([
  'PRICE_MOVE', 'VOLUME_SPIKE', 'LIQUIDITY_CHANGE', 'BRIDGE_FLOW', 'HOLDER_CHANGE', 'WALLET_CONCENTRATION_CHANGE',
  'NEW_PAIR', 'NEW_CONTRACT', 'NEW_LISTING', 'NEW_PROJECT', 'NEW_INTEGRATION', 'NEW_AGENT', 'NFT_ACTIVITY_SPIKE',
  'MINT_ACTIVITY', 'MARKET_ROTATION', 'PROVIDER_CHANGE', 'ROUTE_CHANGE', 'ANOMALOUS_FLOW', 'EXPLOIT_INDICATOR',
  'CONTRACT_RISK', 'COMMUNITY_SIGNAL'
]);
export type Rh4663EventType = z.infer<typeof Rh4663EventTypeSchema>;

export const Rh4663SignalLifecycleSchema = z.enum([
  'submitted', 'watching', 'evidence_added', 'confirmed', 'rejected', 'unresolved'
]);
export type Rh4663SignalLifecycle = z.infer<typeof Rh4663SignalLifecycleSchema>;

export const Rh4663EvidenceReferenceSchema = z.object({
  reference_id: z.string().min(1),
  reference_type: z.enum(['url', 'provider_observation', 'evidence_receipt', 'protocol_receipt', 'reviewed_receipt', 'signal']),
  label: z.string().min(1),
  href: z.string().min(1),
  observed_at: z.string().datetime(),
  source_status: z.enum(['fresh', 'stale', 'degraded', 'unavailable']),
  source: z.string().min(1).optional(),
  source_type: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  metric: z.string().min(1).optional(),
  previous_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  current_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  change: z.number().finite().optional().nullable(),
  units: z.string().max(40).optional().nullable(),
  provider_reference: z.string().max(500).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  freshness: z.enum(['fresh', 'stale', 'expired']).optional()
});
export type Rh4663EvidenceReference = z.infer<typeof Rh4663EvidenceReferenceSchema>;

export const Rh4663NormalizedEventSchema = z.object({
  event_id: z.string().min(1),
  detected_at: z.string().datetime(),
  observed_at: z.string().datetime().optional(),
  type: z.string().min(1),
  event_type: Rh4663EventTypeSchema.optional(),
  subjects: z.array(z.object({ subject_type: z.string().min(1), subject_id: z.string().min(1), label: z.string().min(1).optional() })).min(1),
  category: Rh4663SignalCategorySchema,
  intelligence_category: Rh4663IntelligenceCategorySchema.optional(),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  evidence: z.array(Rh4663EvidenceReferenceSchema),
  source_ids: z.array(z.string().min(1)).optional(),
  source_confidence: z.number().int().min(0).max(100),
  anomaly_score: z.number().int().min(0).max(100),
  significance_score: z.number().int().min(0).max(100),
  score_components: z.record(z.string(), z.number().min(0).max(100)).optional(),
  anomaly_basis: z.string().max(300).optional(),
  heuristic_version: z.string().min(1).optional(),
  event_fingerprint: z.string().min(1).optional(),
  freshness_state: z.enum(['fresh', 'stale', 'expired']).optional(),
  lifecycle_state: z.enum(['detected', 'normalized', 'candidate', 'held', 'review_required', 'published', 'reviewing', 'confirmed', 'rejected', 'unresolved']),
  publication_state: z.enum(['private', 'public']),
  source_status: z.enum(['fresh', 'stale', 'degraded', 'unavailable']),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});
export type Rh4663NormalizedEvent = z.infer<typeof Rh4663NormalizedEventSchema>;

export type Rh4663PulseWindow = {
  window_id: string;
  opens_at: string;
  closes_at: string;
  closes_at_exclusive: true;
  semantics: 'fixed_utc_day';
};

export const Rh4663PulsePayloadInputSchema = z.object({
  wallet: z.string().trim().refine(isEvmAddress, 'valid_evm_wallet_required'),
  rotation: Rh4663RotationOptionSchema,
  confidence: z.number().int().min(1).max(100),
  evidence_digest: z.string().trim().regex(/^0x[0-9a-fA-F]{64}$/, 'evidence_digest_must_be_32_byte_hex').optional().nullable(),
  window_id: z.string().min(1).optional()
}).strict();

export const Rh4663PulseCallInputSchema = Rh4663PulsePayloadInputSchema.extend({
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'wallet_signature_required')
}).strict();
export type Rh4663PulseCallInput = z.infer<typeof Rh4663PulseCallInputSchema>;

export type Rh4663CanonicalCallPayload = {
  version: typeof RH_4663_PROTOCOL_VERSION;
  wallet: `0x${string}`;
  window_id: string;
  window_opens_at: string;
  window_closes_at: string;
  rotation: Rh4663RotationOption;
  confidence: number;
  evidence_digest: string | null;
};

export type Rh4663CallReceipt = {
  receipt_id: string;
  receipt_kind: 'PROTOCOL_RECEIPT';
  protocol_receipt_type: 'CALL';
  immutable: true;
  created_at: string;
  wallet: `0x${string}`;
  window_id: string;
  rotation: Rh4663RotationOption;
  confidence: number;
  evidence_digest: string | null;
  canonical_payload: Rh4663CanonicalCallPayload;
  canonical_serialization: string;
  payload_hash: Hex;
  signature: Hex;
  signature_verified: true;
  genesis_eligible: boolean;
  genesis_ordinal: number | null;
  resolution_compatibility: 'deterministic_v1';
};

export const Rh4663SignalSubmissionSchema = z.object({
  title: z.string().trim().min(3).max(180),
  category: Rh4663SignalCategorySchema,
  thesis: z.string().trim().min(8).max(2_000),
  submitter: z.string().trim().min(1).max(120),
  source_url: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'https_source_required'),
  evidence_note: z.string().trim().min(3).max(1_000).optional()
}).strict();
export type Rh4663SignalSubmission = z.infer<typeof Rh4663SignalSubmissionSchema>;

export type Rh4663Signal = {
  signal_id: string;
  representation_kind: 'SIGNAL_CARD';
  title: string;
  category: Rh4663SignalCategory;
  thesis: string;
  lifecycle_state: Rh4663SignalLifecycle;
  original_submitter: string;
  submitted_at: string;
  updated_at: string;
  evidence: Rh4663EvidenceReference[];
  attribution_immutable: true;
  guarantee_notice: 'Signal Card is editorial intelligence, not an Evidence Receipt or Protocol Receipt.';
  lifecycle_history: Array<{ from: Rh4663SignalLifecycle | null; to: Rh4663SignalLifecycle; changed_at: string; actor: string; note: string }>;
};

export const Rh4663SignalEvidenceInputSchema = z.object({
  url: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'https_source_required'),
  label: z.string().trim().min(1).max(180),
  observed_at: z.string().datetime().optional()
}).strict();

export const Rh4663SignalTransitionInputSchema = z.object({
  state: Rh4663SignalLifecycleSchema,
  note: z.string().trim().min(3).max(1_000)
}).strict();

export type Rh4663PulseConsensus = {
  window_id: string;
  total_calls: number;
  leading_rotation: Rh4663RotationOption | null;
  confidence_average: number | null;
  counts: Record<Rh4663RotationOption, number>;
  state: 'available' | 'unavailable';
  deterministic_tie_break: 'option_order_v1';
};

export type Rh4663TodayEdition = {
  edition_id: string;
  date: string;
  generated_at: string;
  top_events: Array<{ event_id: string; title: string; category: Rh4663SignalCategory; significance_score: number; detected_at: string; source_status: Rh4663NormalizedEvent['source_status'] }>;
  category_flows: Array<{ category: Rh4663SignalCategory; direction: 'leading' | 'building' | 'watch' | 'unavailable'; summary: string; confidence: number }>;
  key_signal: string;
  rh_pulse_consensus: Rh4663PulseConsensus | null;
  evidence_references: Rh4663EvidenceReference[];
  confidence: number;
  source_timestamps: string[];
  provider_state: 'available' | 'stale' | 'degraded' | 'unavailable';
  storage_status: 'durable' | 'memory' | 'unavailable';
  archive_path: string;
  data_notice: string;
  edition_state?: 'draft' | 'ready' | 'published' | 'degraded';
  intelligence_signal_ids?: string[];
  rh_pulse?: unknown;
};

type Rh4663CallReceiptDraft = Omit<Rh4663CallReceipt, 'genesis_eligible' | 'genesis_ordinal'>;

export interface Rh4663Store {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  createCall(receipt: Rh4663CallReceiptDraft): Promise<Rh4663CallReceipt>;
  getCall(receiptId: string): Promise<Rh4663CallReceipt | null>;
  listCalls(windowId?: string, limit?: number): Promise<Rh4663CallReceipt[]>;
  listCallsByWallet(wallet: string, limit?: number): Promise<Rh4663CallReceipt[]>;
  genesisCount(): Promise<number>;
  appendEvent(event: Rh4663NormalizedEvent): Promise<void>;
  getEvent(eventId: string): Promise<Rh4663NormalizedEvent | null>;
  upsertEvent(event: Rh4663NormalizedEvent): Promise<Rh4663NormalizedEvent>;
  listEvents(limit?: number, date?: string): Promise<Rh4663NormalizedEvent[]>;
  createSignal(signal: Rh4663Signal): Promise<Rh4663Signal>;
  getSignal(signalId: string): Promise<Rh4663Signal | null>;
  listSignals(limit?: number): Promise<Rh4663Signal[]>;
  saveSignal(signal: Rh4663Signal): Promise<Rh4663Signal>;
  getToday(date: string): Promise<Rh4663TodayEdition | null>;
  saveToday(edition: Rh4663TodayEdition): Promise<Rh4663TodayEdition>;
  listToday(limit?: number): Promise<Rh4663TodayEdition[]>;
  close?(): Promise<void>;
}

export class Rh4663ServiceError extends Error {
  constructor(readonly code: string, readonly statusCode: number) { super(code); }
}

export function getRh4663PulseWindow(now: Date = new Date()): Rh4663PulseWindow {
  const opens = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const closes = new Date(opens.getTime() + RH_4663_PULSE_WINDOW_MS);
  return {
    window_id: `rh4663:${opens.toISOString().slice(0, 10)}`,
    opens_at: opens.toISOString(),
    closes_at: closes.toISOString(),
    closes_at_exclusive: true,
    semantics: 'fixed_utc_day'
  };
}

export function serializeRh4663CallPayload(payload: Rh4663CanonicalCallPayload): string {
  return serializeRh4663Canonical({
    version: payload.version,
    wallet: payload.wallet.toLowerCase(),
    window_id: payload.window_id,
    window_opens_at: payload.window_opens_at,
    window_closes_at: payload.window_closes_at,
    rotation: payload.rotation,
    confidence: payload.confidence,
    evidence_digest: payload.evidence_digest?.toLowerCase() ?? null
  });
}

/** The single deterministic JSON/hash primitive shared by all 4663 protocol receipts. */
export function serializeRh4663Canonical(value: unknown): string { return JSON.stringify(value); }
export function hashRh4663Canonical(serialization: string): Hex { return `0x${createHash('sha256').update(serialization).digest('hex')}`; }
export const RH_4663_GENESIS_POLICY_HASH = hashRh4663Canonical(serializeRh4663Canonical(RH_4663_GENESIS_POLICY));

export function buildRh4663CallPayload(input: z.infer<typeof Rh4663PulsePayloadInputSchema>, now: Date = new Date()): { payload: Rh4663CanonicalCallPayload; canonical_serialization: string; payload_hash: Hex } {
  const parsed = Rh4663PulsePayloadInputSchema.parse(input);
  const window = getRh4663PulseWindow(now);
  if (parsed.window_id && parsed.window_id !== window.window_id) throw new Rh4663ServiceError('pulse_window_not_open', 409);
  const payload: Rh4663CanonicalCallPayload = {
    version: RH_4663_PROTOCOL_VERSION,
    wallet: parsed.wallet.toLowerCase() as `0x${string}`,
    window_id: window.window_id,
    window_opens_at: window.opens_at,
    window_closes_at: window.closes_at,
    rotation: parsed.rotation,
    confidence: parsed.confidence,
    evidence_digest: parsed.evidence_digest?.toLowerCase() ?? null
  };
  const canonical_serialization = serializeRh4663CallPayload(payload);
  return { payload, canonical_serialization, payload_hash: hashRh4663Canonical(canonical_serialization) };
}

const pulseOptionOrder = Rh4663RotationOptionSchema.options;

export function resolveRh4663Consensus(receipts: Rh4663CallReceipt[], windowId: string): Rh4663PulseConsensus {
  const counts = Object.fromEntries(pulseOptionOrder.map((option) => [option, 0])) as Record<Rh4663RotationOption, number>;
  for (const receipt of receipts.filter((item) => item.window_id === windowId)) counts[receipt.rotation] += 1;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const leading = total === 0 ? null : pulseOptionOrder.reduce((best, option) => counts[option] > counts[best] ? option : best, pulseOptionOrder[0]);
  const confidence = receipts.filter((item) => item.window_id === windowId).reduce((sum, item) => sum + item.confidence, 0);
  return { window_id: windowId, total_calls: total, leading_rotation: leading, confidence_average: total ? Math.round(confidence / total) : null, counts, state: total ? 'available' : 'unavailable', deterministic_tie_break: 'option_order_v1' };
}

export class InMemoryRh4663Store implements Rh4663Store {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private calls = new Map<string, Rh4663CallReceipt>();
  private callWindows = new Set<string>();
  private genesis = new Map<string, number>();
  private events = new Map<string, Rh4663NormalizedEvent>();
  private signals = new Map<string, Rh4663Signal>();
  private editions = new Map<string, Rh4663TodayEdition>();

  async createCall(draft: Rh4663CallReceiptDraft) {
    const uniqueness = `${draft.window_id}:${draft.wallet.toLowerCase()}`;
    if (this.callWindows.has(uniqueness)) throw new Rh4663ServiceError('wallet_already_called_in_window', 409);
    let ordinal = this.genesis.get(draft.wallet.toLowerCase()) ?? null;
    if (ordinal === null && this.genesis.size < RH_4663_GENESIS_LIMIT) {
      ordinal = this.genesis.size + 1;
      this.genesis.set(draft.wallet.toLowerCase(), ordinal);
    }
    const receipt: Rh4663CallReceipt = { ...structuredClone(draft), genesis_eligible: ordinal !== null, genesis_ordinal: ordinal };
    this.callWindows.add(uniqueness);
    this.calls.set(receipt.receipt_id, structuredClone(receipt));
    return structuredClone(receipt);
  }
  async getCall(id: string) { const value = this.calls.get(id); return value ? structuredClone(value) : null; }
  async listCalls(windowId?: string, limit = 100) { return [...this.calls.values()].filter((item) => !windowId || item.window_id === windowId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((item) => structuredClone(item)); }
  async listCallsByWallet(wallet: string, limit = 1_000) { return [...this.calls.values()].filter((item) => item.wallet.toLowerCase() === wallet.toLowerCase()).sort((a, b) => b.canonical_payload.window_opens_at.localeCompare(a.canonical_payload.window_opens_at)).slice(0, limit).map((item) => structuredClone(item)); }
  async genesisCount() { return this.genesis.size; }
  async appendEvent(event: Rh4663NormalizedEvent) { if (!this.events.has(event.event_id)) this.events.set(event.event_id, structuredClone(event)); }
  async getEvent(id: string) { const value = this.events.get(id); return value ? structuredClone(value) : null; }
  async upsertEvent(event: Rh4663NormalizedEvent) { this.events.set(event.event_id, structuredClone(event)); return structuredClone(event); }
  async listEvents(limit = 100, date?: string) { return [...this.events.values()].filter((item) => !date || item.detected_at.slice(0, 10) === date).sort((a, b) => b.detected_at.localeCompare(a.detected_at)).slice(0, limit).map((item) => structuredClone(item)); }
  async createSignal(signal: Rh4663Signal) { if (this.signals.has(signal.signal_id)) throw new Rh4663ServiceError('signal_already_exists', 409); this.signals.set(signal.signal_id, structuredClone(signal)); return structuredClone(signal); }
  async getSignal(id: string) { const value = this.signals.get(id); return value ? structuredClone(value) : null; }
  async listSignals(limit = 100) { return [...this.signals.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit).map((item) => structuredClone(item)); }
  async saveSignal(signal: Rh4663Signal) { const prior = this.signals.get(signal.signal_id); if (!prior) throw new Rh4663ServiceError('signal_not_found', 404); if (prior.original_submitter !== signal.original_submitter || prior.submitted_at !== signal.submitted_at) throw new Rh4663ServiceError('signal_attribution_immutable', 409); this.signals.set(signal.signal_id, structuredClone(signal)); return structuredClone(signal); }
  async getToday(date: string) { const value = this.editions.get(date); return value ? structuredClone(value) : null; }
  async saveToday(edition: Rh4663TodayEdition) { const prior = this.editions.get(edition.date); if (prior) return structuredClone(prior); this.editions.set(edition.date, structuredClone(edition)); return structuredClone(edition); }
  async listToday(limit = 30) { return [...this.editions.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map((item) => structuredClone(item)); }
}

export class PostgresRh4663Store implements Rh4663Store {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  private async ready() { const result = await this.pool.query<{ missing: string | null }>(`select string_agg(name, ',') as missing from unnest(array['rh_4663_genesis_wallets','rh_4663_pulse_calls','rh_4663_events','rh_4663_today_editions','rh_4663_signals']) name where to_regclass(name) is null`); if (result.rows[0]?.missing) throw new Rh4663ServiceError('phase1_migration_not_applied', 503); }
  async createCall(draft: Rh4663CallReceiptDraft) {
    await this.ready(); const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('rh_4663_genesis_v1'))");
      const priorGenesis = await client.query<{ ordinal: number }>('select ordinal from rh_4663_genesis_wallets where wallet=$1', [draft.wallet]);
      let ordinal = priorGenesis.rows[0]?.ordinal ?? null;
      if (ordinal === null) {
        const count = await client.query<{ count: string }>('select count(*)::text as count from rh_4663_genesis_wallets');
        const next = Number(count.rows[0]?.count ?? 0) + 1;
        if (next <= RH_4663_GENESIS_LIMIT) { ordinal = next; await client.query('insert into rh_4663_genesis_wallets (wallet, ordinal, created_at) values ($1,$2,$3)', [draft.wallet, ordinal, draft.created_at]); }
      }
      const receipt: Rh4663CallReceipt = { ...draft, genesis_eligible: ordinal !== null, genesis_ordinal: ordinal };
      await client.query('insert into rh_4663_pulse_calls (receipt_id, wallet, window_id, created_at, payload) values ($1,$2,$3,$4,$5::jsonb)', [receipt.receipt_id, receipt.wallet, receipt.window_id, receipt.created_at, JSON.stringify(receipt)]);
      await client.query('commit'); return receipt;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (postgresCode(error) === '23505') throw new Rh4663ServiceError('wallet_already_called_in_window', 409);
      throw error;
    } finally { client.release(); }
  }
  async getCall(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663CallReceipt }>('select payload from rh_4663_pulse_calls where receipt_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async listCalls(windowId?: string, limit = 100) { await this.ready(); const result = windowId ? await this.pool.query<{ payload: Rh4663CallReceipt }>('select payload from rh_4663_pulse_calls where window_id=$1 order by created_at desc limit $2', [windowId, limit]) : await this.pool.query<{ payload: Rh4663CallReceipt }>('select payload from rh_4663_pulse_calls order by created_at desc limit $1', [limit]); return result.rows.map((row) => row.payload); }
  async listCallsByWallet(wallet: string, limit = 1_000) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663CallReceipt }>('select payload from rh_4663_pulse_calls where lower(wallet)=lower($1) order by window_id desc limit $2', [wallet, limit]); return result.rows.map((row) => row.payload); }
  async genesisCount() { await this.ready(); const result = await this.pool.query<{ count: string }>('select count(*)::text as count from rh_4663_genesis_wallets'); return Number(result.rows[0]?.count ?? 0); }
  async appendEvent(event: Rh4663NormalizedEvent) { await this.ready(); await this.pool.query('insert into rh_4663_events (event_id, detected_at, category, publication_state, payload) values ($1,$2,$3,$4,$5::jsonb) on conflict (event_id) do nothing', [event.event_id, event.detected_at, event.category, event.publication_state, JSON.stringify(event)]); }
  async getEvent(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663NormalizedEvent }>('select payload from rh_4663_events where event_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async upsertEvent(event: Rh4663NormalizedEvent) {
    await this.ready(); const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('rh4663-event:' || $1))", [event.event_id]);
      await client.query(`insert into rh_4663_events (event_id, detected_at, category, publication_state, payload)
        values ($1,$2,$3,$4,$5::jsonb)
        on conflict (event_id) do update set detected_at=excluded.detected_at, category=excluded.category, publication_state=excluded.publication_state, payload=excluded.payload`,
      [event.event_id, event.detected_at, event.category, event.publication_state, JSON.stringify(event)]);
      await client.query('commit'); return event;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async listEvents(limit = 100, date?: string) { await this.ready(); const result = date ? await this.pool.query<{ payload: Rh4663NormalizedEvent }>("select payload from rh_4663_events where detected_at >= $1::date and detected_at < ($1::date + interval '1 day') order by detected_at desc limit $2", [date, limit]) : await this.pool.query<{ payload: Rh4663NormalizedEvent }>('select payload from rh_4663_events order by detected_at desc limit $1', [limit]); return result.rows.map((row) => row.payload); }
  async createSignal(signal: Rh4663Signal) { await this.ready(); try { await this.pool.query('insert into rh_4663_signals (signal_id, lifecycle_state, original_submitter, submitted_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6::jsonb)', [signal.signal_id, signal.lifecycle_state, signal.original_submitter, signal.submitted_at, signal.updated_at, JSON.stringify(signal)]); return signal; } catch (error) { if (postgresCode(error) === '23505') throw new Rh4663ServiceError('signal_already_exists', 409); throw error; } }
  async getSignal(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663Signal }>('select payload from rh_4663_signals where signal_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async listSignals(limit = 100) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663Signal }>('select payload from rh_4663_signals order by updated_at desc limit $1', [limit]); return result.rows.map((row) => row.payload); }
  async saveSignal(signal: Rh4663Signal) { await this.ready(); const result = await this.pool.query<{ original_submitter: string; submitted_at: string }>('update rh_4663_signals set lifecycle_state=$2, updated_at=$3, payload=$4::jsonb where signal_id=$1 and original_submitter=$5 and submitted_at=$6 returning original_submitter, submitted_at', [signal.signal_id, signal.lifecycle_state, signal.updated_at, JSON.stringify(signal), signal.original_submitter, signal.submitted_at]); if (!result.rowCount) throw new Rh4663ServiceError('signal_attribution_immutable', 409); return signal; }
  async getToday(date: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663TodayEdition }>('select payload from rh_4663_today_editions where edition_date=$1', [date]); return result.rows[0]?.payload ?? null; }
  async saveToday(edition: Rh4663TodayEdition) { await this.ready(); await this.pool.query('insert into rh_4663_today_editions (edition_id, edition_date, generated_at, payload) values ($1,$2,$3,$4::jsonb) on conflict (edition_date) do nothing', [edition.edition_id, edition.date, edition.generated_at, JSON.stringify(edition)]); return (await this.getToday(edition.date)) ?? edition; }
  async listToday(limit = 30) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663TodayEdition }>('select payload from rh_4663_today_editions order by edition_date desc limit $1', [limit]); return result.rows.map((row) => row.payload); }
  async close() { if (this.ownsPool) await this.pool.end(); }
}

export class Rh4663Service {
  constructor(readonly store: Rh4663Store, private readonly now: () => Date = () => new Date()) {}

  pulseWindow() { return getRh4663PulseWindow(this.now()); }
  pulsePayload(input: z.input<typeof Rh4663PulsePayloadInputSchema>) { return buildRh4663CallPayload(Rh4663PulsePayloadInputSchema.parse(input), this.now()); }

  async call(input: unknown) {
    const parsed = Rh4663PulseCallInputSchema.parse(input);
    const { signature, ...payloadInput } = parsed;
    const built = buildRh4663CallPayload(payloadInput, this.now());
    let recovered: string;
    try { const { recoverMessageAddress } = await import('viem'); recovered = await recoverMessageAddress({ message: built.canonical_serialization, signature: signature as Hex }); }
    catch { throw new Rh4663ServiceError('invalid_wallet_signature', 400); }
    if (recovered.toLowerCase() !== built.payload.wallet.toLowerCase()) throw new Rh4663ServiceError('invalid_wallet_signature', 400);
    const created_at = this.now().toISOString();
    const draft: Rh4663CallReceiptDraft = {
      receipt_id: `call_${built.payload_hash.slice(2, 18)}_${built.payload.window_id.slice(-10).replaceAll('-', '')}`,
      receipt_kind: 'PROTOCOL_RECEIPT', protocol_receipt_type: 'CALL', immutable: true, created_at,
      wallet: built.payload.wallet, window_id: built.payload.window_id, rotation: built.payload.rotation, confidence: built.payload.confidence,
      evidence_digest: built.payload.evidence_digest, canonical_payload: built.payload, canonical_serialization: built.canonical_serialization,
      payload_hash: built.payload_hash, signature: signature as Hex, signature_verified: true, resolution_compatibility: 'deterministic_v1'
    };
    const receipt = await this.store.createCall(draft);
    await this.safeEvent({
      event_id: `event_${receipt.receipt_id}`, detected_at: receipt.created_at, type: 'rh_pulse.call_created',
      subjects: [{ subject_type: 'wallet', subject_id: receipt.wallet }, { subject_type: 'protocol_receipt', subject_id: receipt.receipt_id }],
      category: rotationCategory(receipt.rotation), metrics: { confidence: receipt.confidence, genesis_eligible: receipt.genesis_eligible },
      evidence: [{ reference_id: receipt.receipt_id, reference_type: 'protocol_receipt', label: 'Immutable CALL RECEIPT', href: `/v1/4663/receipts/${receipt.receipt_id}`, observed_at: receipt.created_at, source_status: 'fresh' }],
      source_confidence: 100, anomaly_score: 0, significance_score: receipt.confidence, lifecycle_state: 'confirmed', publication_state: 'public', source_status: 'fresh'
    });
    return receipt;
  }

  async pulse() { const window = this.pulseWindow(); const calls = await this.store.listCalls(window.window_id, 10_000); return { window, consensus: resolveRh4663Consensus(calls, window.window_id), options: pulseOptionOrder, mechanics: { version: RH_4663_PROTOCOL_VERSION, one_call_per_wallet_per_window: true, signature_required: true, immutable_call_receipts: true, genesis_limit: RH_4663_GENESIS_LIMIT, genesis_policy_version: RH_4663_GENESIS_POLICY.version, genesis_policy_hash: RH_4663_GENESIS_POLICY_HASH, genesis_scope: RH_4663_GENESIS_POLICY.scope, genesis_economic_entitlement: false } }; }
  async genesis() { const count = await this.store.genesisCount(); return { limit: RH_4663_GENESIS_LIMIT, recorded: Math.min(count, RH_4663_GENESIS_LIMIT), remaining: Math.max(0, RH_4663_GENESIS_LIMIT - count), progress: Number((Math.min(count, RH_4663_GENESIS_LIMIT) / RH_4663_GENESIS_LIMIT).toFixed(4)), policy: 'The first 4,663 distinct wallets with a verified signed Call Receipt receive a permanent Genesis ordinal. No token, reward, or financial entitlement is implied.' }; }

  async submitSignal(input: unknown) {
    const parsed = Rh4663SignalSubmissionSchema.parse(input); const now = this.now().toISOString();
    const evidence: Rh4663EvidenceReference[] = [{ reference_id: `source_${randomUUID()}`, reference_type: 'url', label: parsed.evidence_note ?? 'Submitter source', href: parsed.source_url, observed_at: now, source_status: 'fresh' }];
    const signal: Rh4663Signal = {
      signal_id: `sig4663_${randomUUID()}`, representation_kind: 'SIGNAL_CARD', title: parsed.title, category: parsed.category, thesis: parsed.thesis,
      lifecycle_state: 'submitted', original_submitter: parsed.submitter, submitted_at: now, updated_at: now, evidence, attribution_immutable: true,
      guarantee_notice: 'Signal Card is editorial intelligence, not an Evidence Receipt or Protocol Receipt.',
      lifecycle_history: [{ from: null, to: 'submitted', changed_at: now, actor: parsed.submitter, note: 'Signal submitted with original attribution preserved.' }]
    };
    const created = await this.store.createSignal(signal);
    await this.safeEvent(signalEvent(created, 'rh_4663.signal_submitted', 'detected'));
    return created;
  }

  async addSignalEvidence(signalId: string, input: unknown, actor: string) {
    const parsed = Rh4663SignalEvidenceInputSchema.parse(input); const signal = await this.requireSignal(signalId);
    if (signal.lifecycle_state === 'confirmed' || signal.lifecycle_state === 'rejected') throw new Rh4663ServiceError('signal_terminal_state', 409);
    const now = this.now().toISOString(); const next: Rh4663Signal = { ...signal, lifecycle_state: 'evidence_added', updated_at: now,
      evidence: [...signal.evidence, { reference_id: `source_${randomUUID()}`, reference_type: 'url', label: parsed.label, href: parsed.url, observed_at: parsed.observed_at ?? now, source_status: 'fresh' }],
      lifecycle_history: [...signal.lifecycle_history, { from: signal.lifecycle_state, to: 'evidence_added', changed_at: now, actor, note: `Evidence added: ${parsed.label}` }]
    };
    const saved = await this.store.saveSignal(next); await this.safeEvent(signalEvent(saved, 'rh_4663.signal_evidence_added', 'reviewing')); return saved;
  }

  async transitionSignal(signalId: string, input: unknown, actor: string) {
    const parsed = Rh4663SignalTransitionInputSchema.parse(input); const signal = await this.requireSignal(signalId);
    if (!allowedTransitions[signal.lifecycle_state].includes(parsed.state)) throw new Rh4663ServiceError('invalid_signal_lifecycle_transition', 409);
    const now = this.now().toISOString(); const next: Rh4663Signal = { ...signal, lifecycle_state: parsed.state, updated_at: now,
      lifecycle_history: [...signal.lifecycle_history, { from: signal.lifecycle_state, to: parsed.state, changed_at: now, actor, note: parsed.note }]
    };
    const saved = await this.store.saveSignal(next); await this.safeEvent(signalEvent(saved, 'rh_4663.signal_transitioned', parsed.state === 'confirmed' ? 'confirmed' : parsed.state === 'rejected' ? 'rejected' : parsed.state === 'unresolved' ? 'unresolved' : 'reviewing')); return saved;
  }

  async today(input: { date?: string; keySignal: string; categoryFlows: Rh4663TodayEdition['category_flows']; evidence: Rh4663EvidenceReference[]; providerState: Rh4663TodayEdition['provider_state']; confidence: number; intelligenceSignals?: Array<{ signal_id: string; event_id: string; headline: string; category: Rh4663SignalCategory; significance_score: number; detected_at: string; evidence: Rh4663EvidenceReference[] }> }) {
    const date = input.date ?? this.now().toISOString().slice(0, 10); const stored = await this.store.getToday(date); if (stored) return stored;
    const events = await this.store.listEvents(20, date); const windowId = `rh4663:${date}`; const calls = await this.store.listCalls(windowId, 10_000); const consensus = resolveRh4663Consensus(calls, windowId);
    const intelligenceSignals = input.intelligenceSignals ?? [];
    const evidence = dedupeEvidence([...input.evidence, ...intelligenceSignals.flatMap((signal) => signal.evidence), ...events.flatMap((event) => event.evidence)]);
    const sourceTimestamps = [...new Set(evidence.map((item) => item.observed_at))].sort();
    const generated_at = this.now().toISOString();
    const edition: Rh4663TodayEdition = {
      edition_id: `today_4663_${date.replaceAll('-', '')}_v1`, date, generated_at,
      top_events: [...intelligenceSignals.map((signal) => ({ event_id: signal.event_id, title: signal.headline, category: signal.category, significance_score: signal.significance_score, detected_at: signal.detected_at, source_status: 'fresh' as const })), ...events.filter((event) => !intelligenceSignals.some((signal) => signal.event_id === event.event_id)).map((event) => ({ event_id: event.event_id, title: eventTitle(event), category: event.category, significance_score: event.significance_score, detected_at: event.detected_at, source_status: event.source_status }))].slice(0, 5),
      category_flows: input.categoryFlows, key_signal: intelligenceSignals[0]?.headline ?? input.keySignal, rh_pulse_consensus: consensus.state === 'available' ? consensus : null,
      evidence_references: evidence, confidence: Math.max(0, Math.min(100, Math.round(input.confidence))), source_timestamps: sourceTimestamps,
      provider_state: input.providerState, storage_status: this.store.durable ? 'durable' : 'memory', archive_path: `/v1/4663/today/${date}`,
      data_notice: input.providerState === 'available' ? 'Built from persisted Infopunks memory and cited observations.' : `Provider state: ${input.providerState}. No missing live observation has been fabricated.`,
      edition_state: input.providerState === 'available' && evidence.length ? 'published' : 'degraded',
      intelligence_signal_ids: intelligenceSignals.map((signal) => signal.signal_id)
    };
    return this.store.saveToday(edition);
  }

  private async requireSignal(id: string) { const signal = await this.store.getSignal(id); if (!signal) throw new Rh4663ServiceError('signal_not_found', 404); return signal; }
  private async safeEvent(event: Rh4663NormalizedEvent) { try { await this.store.appendEvent(Rh4663NormalizedEventSchema.parse(event)); } catch { /* The originating durable object remains authoritative if event projection is degraded. */ } }
}

const allowedTransitions: Record<Rh4663SignalLifecycle, Rh4663SignalLifecycle[]> = {
  submitted: ['watching', 'rejected', 'unresolved'], watching: ['evidence_added', 'confirmed', 'rejected', 'unresolved'],
  evidence_added: ['watching', 'confirmed', 'rejected', 'unresolved'], unresolved: ['watching', 'evidence_added', 'confirmed', 'rejected'],
  confirmed: [], rejected: []
};

function signalEvent(signal: Rh4663Signal, type: string, state: Rh4663NormalizedEvent['lifecycle_state']): Rh4663NormalizedEvent {
  return { event_id: `event_${signal.signal_id}_${signal.lifecycle_history.length}`, detected_at: signal.updated_at, type,
    subjects: [{ subject_type: 'signal', subject_id: signal.signal_id, label: signal.title }], category: signal.category,
    metrics: { evidence_count: signal.evidence.length }, evidence: signal.evidence, source_confidence: state === 'confirmed' ? 80 : 50,
    anomaly_score: 0, significance_score: state === 'confirmed' ? 80 : 50, lifecycle_state: state, publication_state: 'public', source_status: 'fresh' };
}

function rotationCategory(rotation: Rh4663RotationOption): Rh4663SignalCategory {
  if (rotation === 'MEMES') return 'meme'; if (rotation === 'STOCK_TOKENS') return 'stock_token'; if (rotation === 'RWA_DEFI') return 'defi'; if (rotation === 'STABLES') return 'liquidity'; return 'other';
}
function eventTitle(event: Rh4663NormalizedEvent) { return event.subjects[0]?.label ?? event.type.replaceAll('_', ' ').replaceAll('.', ' / '); }
function dedupeEvidence(evidence: Rh4663EvidenceReference[]) { const seen = new Set<string>(); return evidence.filter((item) => { const key = `${item.reference_type}:${item.reference_id}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 40); }
function postgresCode(error: unknown) { return error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''; }
function isEvmAddress(value: string) { return /^0x[0-9a-fA-F]{40}$/.test(value.trim()); }
