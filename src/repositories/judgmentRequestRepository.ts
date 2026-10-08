import type pg from 'pg';
import type { PaymentRequired, SettleResponse } from '@x402/core/types';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import type { PreSpendCheckResponse } from '../schemas/entities';
import type { DecisionContext } from '../schemas/decisionContext';
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
}
export class MemoryJudgmentRequestRepository implements JudgmentRequestRepository {
  private records = new Map<string, JudgmentRequestRecord>();
  private payments = new Set<string>();
  constructor() { if (process.env.NODE_ENV === 'production') throw new Error('judgment_journal_requires_postgres'); }
  async get(key: string) { return structuredClone(this.records.get(key) ?? null); }
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
