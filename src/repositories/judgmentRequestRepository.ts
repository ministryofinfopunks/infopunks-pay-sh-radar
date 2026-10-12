import type pg from 'pg';
import type { PaymentRequired, SettleResponse } from '@x402/core/types';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import type { PreSpendCheckResponse } from '../schemas/entities';
import type { DecisionContext } from '../schemas/decisionContext';
import { hashCanonical } from '../services/receiptIntegrityService';
import type { JudgmentOwner } from '../security/judgmentIdentity';
export type PaymentAuthorizationBinding = {
  network: string; token: string; payer: string; pay_to: string; amount_atomic: string;
  nonce: string; valid_after: string; valid_before: string;
};
export type PaymentReconciliationEvidence = { version: 'judgment-reconciliation.v1'; payment_hash: string;
  transaction_hash: string; block_hash: string; block_number: string; settled_at: string; verified_at: string;
  verification: 'rpc_finalized_eip3009_transfer'; };
export type FreeAssessmentAttempt = { request_key: string; request_hash: string; assessed_at: string;
  response: CanonicalJudgmentResponse; legacy: PreSpendCheckResponse; attempt_hash: string; owner?: JudgmentOwner };
export type PublishedFreeAssessmentAttempt = FreeAssessmentAttempt & { publication_sequence: number };
export type JudgmentRequestRecord = {
  request_hash: string; state: 'quoted' | 'settling' | 'settled' | 'complete';
  response: CanonicalJudgmentResponse; legacy: PreSpendCheckResponse;
  subject_type: string; subject_id: string; intent_hash: string;
  challenge: PaymentRequired; settlement?: SettleResponse; payment_hash?: string;
  decision_context?: DecisionContext;
  owner?: JudgmentOwner; payment_authorization?: PaymentAuthorizationBinding; reconciliation?: PaymentReconciliationEvidence;
};
export function judgmentRequestKey(agent: string, key: string, owner?: JudgmentOwner) {
  return hashCanonical({ agent, key, ...(owner ? { tenant: owner.tenant_id } : {}) });
}
export interface JudgmentRequestRepository {
  get(key: string): Promise<JudgmentRequestRecord | null>;
  quote(key: string, record: JudgmentRequestRecord): Promise<JudgmentRequestRecord>;
  claim(key: string, paymentHash: string, binding?: PaymentAuthorizationBinding): Promise<boolean>;
  save(key: string, record: JudgmentRequestRecord): Promise<void>;
  getFreeAttempt?(key: string): Promise<FreeAssessmentAttempt | null>;
  recordFreeAttempt?(attempt: Omit<FreeAssessmentAttempt, 'attempt_hash'>): Promise<FreeAssessmentAttempt>;
  listFreeAttempts?(): Promise<PublishedFreeAssessmentAttempt[]>;
  listOwned?(owner: JudgmentOwner): Promise<{ paid: JudgmentRequestRecord[]; free: FreeAssessmentAttempt[] }>;
  ownsObservation?(owner: JudgmentOwner, id: string): Promise<boolean>;
  confirmSettlement?(key: string, hash: string, settlement: SettleResponse, evidence: PaymentReconciliationEvidence): Promise<boolean>;
}
export class MemoryJudgmentRequestRepository implements JudgmentRequestRepository {
  private records = new Map<string, JudgmentRequestRecord>();
  private payments = new Set<string>();
  private freeAttempts = new Map<string, FreeAssessmentAttempt>();
  private freeSequence = 0;
  private freePositions = new Map<string, number>();
  constructor() { if (process.env.NODE_ENV === 'production') throw new Error('judgment_journal_requires_postgres'); }
  async get(key: string) { return structuredClone(this.records.get(key) ?? null); }
  async getFreeAttempt(key: string) { return structuredClone(this.freeAttempts.get(key) ?? null); }
  async listFreeAttempts() { return [...this.freeAttempts.values()].map(value => ({ ...structuredClone(value),
    publication_sequence: this.freePositions.get(value.request_key)! })); }
  async recordFreeAttempt(input: Omit<FreeAssessmentAttempt, 'attempt_hash'>) {
    const prior = this.freeAttempts.get(input.request_key);
    if (prior) { if (prior.request_hash !== input.request_hash) throw new Error('idempotency_conflict'); return structuredClone(prior); }
    const attempt = { ...input, attempt_hash: hashCanonical(input) };
    this.freeAttempts.set(input.request_key, structuredClone(attempt));
    this.freePositions.set(input.request_key, ++this.freeSequence);
    return attempt;
  }
  async quote(key: string, record: JudgmentRequestRecord) {
    if (!this.records.has(key)) this.records.set(key, structuredClone(record));
    return (await this.get(key))!;
  }
  async claim(key: string, paymentHash: string, binding?: PaymentAuthorizationBinding) {
    const record = this.records.get(key);
    if (!record || record.state !== 'quoted' || this.payments.has(paymentHash)) return false;
    record.state = 'settling'; record.payment_hash = paymentHash;
    if (binding) record.payment_authorization = structuredClone(binding);
    this.payments.add(paymentHash); return true;
  }
  async save(key: string, record: JudgmentRequestRecord) {
    if (record.settlement && [...this.records.entries()].some(([otherKey, other]) => otherKey !== key && other.settlement?.transaction.toLowerCase() === record.settlement!.transaction.toLowerCase())) throw new Error('settlement_reference_reused');
    this.records.set(key, structuredClone(record));
  }
  async listOwned(owner: JudgmentOwner) {
    return { paid: [...this.records.values()].filter(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id).slice(0, 100).map(r => structuredClone(r)),
      free: [...this.freeAttempts.values()].filter(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id).slice(0, 100).map(r => structuredClone(r)) };
  }
  async ownsObservation(owner: JudgmentOwner, id: string) {
    return [...this.records.values()].some(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id && r.response.cited_observations.includes(id));
  }
  async confirmSettlement(key: string, hash: string, settlement: SettleResponse, evidence: PaymentReconciliationEvidence) {
    const record = this.records.get(key);
    if (!record || record.state !== 'settling' || record.payment_hash !== hash) return false;
    if ([...this.records.entries()].some(([otherKey, r]) => otherKey !== key && r.settlement?.transaction.toLowerCase() === settlement.transaction.toLowerCase())) throw new Error('settlement_reference_reused');
    record.settlement = structuredClone(settlement); record.reconciliation = structuredClone(evidence); record.state = 'settled';
    return true;
  }
}
export class PostgresJudgmentRequestRepository implements JudgmentRequestRepository {
  constructor(private pool: pg.Pool) {}
  async get(key: string): Promise<JudgmentRequestRecord | null> {
    return (await this.pool.query('select record from judgment_requests where request_key=$1', [key])).rows[0]?.record ?? null;
  }
  async getFreeAttempt(key: string): Promise<FreeAssessmentAttempt | null> {
    return (await this.pool.query('select attempt from free_assessment_attempts where request_key=$1', [key])).rows[0]?.attempt ?? null;
  }
  async listFreeAttempts(): Promise<PublishedFreeAssessmentAttempt[]> {
    return (await this.pool.query('select attempt,publication_sequence from free_assessment_attempts order by publication_sequence')).rows
      .map(row => ({ ...row.attempt, publication_sequence: Number(row.publication_sequence) }));
  }
  async recordFreeAttempt(input: Omit<FreeAssessmentAttempt, 'attempt_hash'>): Promise<FreeAssessmentAttempt> {
    const attempt = { ...input, attempt_hash: hashCanonical(input) };
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Serializing insertion also serializes commit order for public positions.
      await client.query('select pg_advisory_xact_lock(4663, 20261009)');
      await client.query('insert into free_assessment_attempts(request_key,request_hash,attempt_hash,attempt) values($1,$2,$3,$4) on conflict(request_key) do nothing',
        [input.request_key, input.request_hash, attempt.attempt_hash, attempt]);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
    const existing = await this.getFreeAttempt(input.request_key);
    if (!existing || existing.request_hash !== input.request_hash) throw new Error('idempotency_conflict');
    return existing;
  }
  async quote(key: string, record: JudgmentRequestRecord) {
    await this.pool.query('insert into judgment_requests(request_key,request_hash,state,record) values($1,$2,$3,$4) on conflict(request_key) do nothing', [key, record.request_hash, record.state, record]);
    return (await this.get(key))!;
  }
  async claim(key: string, paymentHash: string, binding?: PaymentAuthorizationBinding) {
    try {
      const result = await this.pool.query("update judgment_requests set state='settling',payment_hash=$2,record=record || jsonb_build_object('state','settling','payment_hash',$2::text) || $3::jsonb where request_key=$1 and state='quoted' returning request_key", [key, paymentHash, JSON.stringify(binding ? { payment_authorization: binding } : {})]);
      return result.rowCount === 1;
    } catch (error) { if ((error as {code?: string}).code === '23505') return false; throw error; }
  }
  async save(key: string, record: JudgmentRequestRecord) {
    await this.withSettlementLock(key, record.settlement?.transaction, client => client.query('update judgment_requests set state=$2,record=$3,settlement_ref=$4 where request_key=$1', [key, record.state, record, record.settlement?.transaction ?? null]));
  }
  async listOwned(owner: JudgmentOwner) {
    const [paid, free] = await Promise.all([
      this.pool.query("select record from judgment_requests where record->'owner'->>'tenant_id'=$1 and record->'owner'->>'agent_id'=$2 order by request_key limit 100", [owner.tenant_id, owner.agent_id]),
      this.pool.query("select attempt from free_assessment_attempts where attempt->'owner'->>'tenant_id'=$1 and attempt->'owner'->>'agent_id'=$2 order by request_key limit 100", [owner.tenant_id, owner.agent_id])
    ]);
    return { paid: paid.rows.map(r => r.record as JudgmentRequestRecord), free: free.rows.map(r => r.attempt as FreeAssessmentAttempt) };
  }
  async ownsObservation(owner: JudgmentOwner, id: string) {
    return (await this.pool.query("select 1 from judgment_requests where record->'owner'->>'tenant_id'=$1 and record->'owner'->>'agent_id'=$2 and (record->'response'->'cited_observations') ? $3 limit 1", [owner.tenant_id, owner.agent_id, id])).rows.length > 0;
  }
  async confirmSettlement(key: string, hash: string, settlement: SettleResponse, evidence: PaymentReconciliationEvidence) {
    const result = await this.withSettlementLock(key, settlement.transaction, client => client.query("update judgment_requests set state='settled',settlement_ref=$3,record=record || $4::jsonb where request_key=$1 and payment_hash=$2 and state='settling' returning request_key", [key, hash, settlement.transaction, JSON.stringify({ state: 'settled', settlement, reconciliation: evidence })]));
    return result.rowCount === 1;
  }
  private async withSettlementLock<T>(key: string, transaction: string | undefined, run: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (transaction) {
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [transaction.toLowerCase()]);
        if ((await client.query('select 1 from judgment_requests where request_key<>$1 and lower(settlement_ref)=lower($2) limit 1', [key, transaction])).rows.length) throw new Error('settlement_reference_reused');
      }
      const result = await run(client); await client.query('commit'); return result;
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  }
}
