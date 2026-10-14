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
/** Settlement state may change; its original disclosure binding may not. */
function ownershipBinding(record: JudgmentRequestRecord) {
  return { owner: record.owner ?? null, request_hash: record.request_hash,
    judgment_id: record.response.judgment_id, cited_observations: record.response.cited_observations };
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
    if (!this.records.has(key)) {
      const cited = new Set(record.response.cited_observations);
      if ([...this.records.values()].some(other => other.response.cited_observations.some(id => cited.has(id))
        && hashCanonical(other.owner ?? null) !== hashCanonical(record.owner ?? null))) throw new Error('judgment_observation_ownership_conflict');
      this.records.set(key, structuredClone(record));
    }
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
    const prior = this.records.get(key);
    if (!prior || hashCanonical(ownershipBinding(prior)) !== hashCanonical(ownershipBinding(record))) throw new Error('judgment_ownership_immutable');
    if (record.settlement && [...this.records.entries()].some(([otherKey, other]) => otherKey !== key && other.settlement?.transaction === record.settlement!.transaction)) throw new Error('settlement_reference_reused');
    this.records.set(key, structuredClone(record));
  }
  async listOwned(owner: JudgmentOwner) {
    return { paid: [...this.records.values()].filter(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id).slice(0, 100).map(r => structuredClone(r)),
      free: [...this.freeAttempts.values()].filter(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id).slice(0, 100).map(r => structuredClone(r)) };
  }
  async ownsObservation(owner: JudgmentOwner, id: string) {
    const references = [...this.records.values()].filter(r => r.response.cited_observations.includes(id));
    // Citation is only usable as a scoped read binding when every journal
    // reference agrees. Shared or historical unbound evidence is not private
    // tenant authority; a reviewed publication/admission model is still needed.
    return references.length > 0 && references.every(r => r.owner?.tenant_id === owner.tenant_id && r.owner.agent_id === owner.agent_id);
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
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Serialize citation binding, including concurrent different-tenant quotes.
      // This never assigns original receipt ownership or publication authority.
      await client.query("select pg_advisory_xact_lock(hashtext('judgment_citation_binding.v1'))");
      const prior = await client.query('select record from judgment_requests where request_key=$1', [key]);
      if (!prior.rows.length) {
        const conflict = await client.query(`select 1 from judgment_requests
          where (record->'response'->'cited_observations') ?| $2::text[]
            and coalesce(record->'owner', 'null'::jsonb) is distinct from $1::jsonb limit 1`,
          [JSON.stringify(record.owner ?? null), record.response.cited_observations]);
        if (conflict.rows.length) throw new Error('judgment_observation_ownership_conflict');
        await client.query('insert into judgment_requests(request_key,request_hash,state,record) values($1,$2,$3,$4)', [key, record.request_hash, record.state, record]);
      }
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
    return (await this.get(key))!;
  }
  async claim(key: string, paymentHash: string, binding?: PaymentAuthorizationBinding) {
    try {
      const result = await this.pool.query("update judgment_requests set state='settling',payment_hash=$2,record=record || jsonb_build_object('state','settling','payment_hash',$2::text) || $3::jsonb where request_key=$1 and state='quoted' returning request_key", [key, paymentHash, JSON.stringify(binding ? { payment_authorization: binding } : {})]);
      return result.rowCount === 1;
    } catch (error) { if ((error as {code?: string}).code === '23505') return false; throw error; }
  }
  async save(key: string, record: JudgmentRequestRecord) {
    const result = await this.pool.query(`update judgment_requests set state=$2,record=$3,settlement_ref=$4 where request_key=$1
      and record->'owner' is not distinct from $3::jsonb->'owner'
      and record->>'request_hash' is not distinct from $3::jsonb->>'request_hash'
      and record->'response'->>'judgment_id' is not distinct from $3::jsonb->'response'->>'judgment_id'
      and record->'response'->'cited_observations' is not distinct from $3::jsonb->'response'->'cited_observations'
      returning request_key`, [key, record.state, record, record.settlement?.transaction ?? null]);
    if (result.rowCount !== 1) throw new Error('judgment_ownership_immutable');
  }
  async listOwned(owner: JudgmentOwner) {
    const [paid, free] = await Promise.all([
      this.pool.query("select record from judgment_requests where record->'owner'->>'tenant_id'=$1 and record->'owner'->>'agent_id'=$2 order by request_key limit 100", [owner.tenant_id, owner.agent_id]),
      this.pool.query("select attempt from free_assessment_attempts where attempt->'owner'->>'tenant_id'=$1 and attempt->'owner'->>'agent_id'=$2 order by request_key limit 100", [owner.tenant_id, owner.agent_id])
    ]);
    return { paid: paid.rows.map(r => r.record as JudgmentRequestRecord), free: free.rows.map(r => r.attempt as FreeAssessmentAttempt) };
  }
  async ownsObservation(owner: JudgmentOwner, id: string) {
    const result = await this.pool.query(`select exists (
      select 1 from judgment_requests where (record->'response'->'cited_observations') ? $2
        and record->'owner' = $1::jsonb
    ) and not exists (
      select 1 from judgment_requests where (record->'response'->'cited_observations') ? $2
        and record->'owner' is distinct from $1::jsonb
    ) as owned`, [JSON.stringify(owner), id]);
    return result.rows[0]?.owned === true;
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
