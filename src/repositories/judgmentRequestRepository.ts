import type pg from 'pg';
import type { PaymentRequired, SettleResponse } from '@x402/core/types';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import type { PreSpendCheckResponse } from '../schemas/entities';
import type { DecisionContext } from '../schemas/decisionContext';
import { hashCanonical } from '../services/receiptIntegrityService';
export type FreeAssessmentAttempt = { request_key: string; request_hash: string; assessed_at: string;
  response: CanonicalJudgmentResponse; legacy: PreSpendCheckResponse; attempt_hash: string };
export type PublishedFreeAssessmentAttempt = FreeAssessmentAttempt & { publication_sequence: number };
export type JudgmentRequestRecord = {
  request_hash: string; state: 'quoted' | 'settling' | 'settled' | 'complete';
  response: CanonicalJudgmentResponse; legacy: PreSpendCheckResponse;
  subject_type: string; subject_id: string; intent_hash: string;
  challenge: PaymentRequired; settlement?: SettleResponse; payment_hash?: string;
  decision_context?: DecisionContext;
};
export interface JudgmentRequestRepository {
  get(key: string): Promise<JudgmentRequestRecord | null>;
  quote(key: string, record: JudgmentRequestRecord): Promise<JudgmentRequestRecord>;
  claim(key: string, paymentHash: string): Promise<boolean>;
  save(key: string, record: JudgmentRequestRecord): Promise<void>;
  getFreeAttempt?(key: string): Promise<FreeAssessmentAttempt | null>;
  recordFreeAttempt?(attempt: Omit<FreeAssessmentAttempt, 'attempt_hash'>): Promise<FreeAssessmentAttempt>;
  listFreeAttempts?(): Promise<PublishedFreeAssessmentAttempt[]>;
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
  async claim(key: string, paymentHash: string) {
    const record = this.records.get(key);
    if (!record || record.state !== 'quoted' || this.payments.has(paymentHash)) return false;
    record.state = 'settling'; record.payment_hash = paymentHash; this.payments.add(paymentHash); return true;
  }
  async save(key: string, record: JudgmentRequestRecord) {
    if (record.settlement && [...this.records.entries()].some(([otherKey, other]) => otherKey !== key && other.settlement?.transaction === record.settlement!.transaction)) throw new Error('settlement_reference_reused');
    this.records.set(key, structuredClone(record));
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
  async claim(key: string, paymentHash: string) {
    try {
      const result = await this.pool.query("update judgment_requests set state='settling',payment_hash=$2,record=record || jsonb_build_object('state','settling','payment_hash',$2::text) where request_key=$1 and state='quoted' returning request_key", [key, paymentHash]);
      return result.rowCount === 1;
    } catch (error) { if ((error as {code?: string}).code === '23505') return false; throw error; }
  }
  async save(key: string, record: JudgmentRequestRecord) {
    await this.pool.query('update judgment_requests set state=$2,record=$3,settlement_ref=$4 where request_key=$1', [key, record.state, record, record.settlement?.transaction ?? null]);
  }
}
