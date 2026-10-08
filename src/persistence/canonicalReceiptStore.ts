import type { JudgmentIssuerTrust } from '../security/judgmentIssuer';
import type pg from 'pg';
import { receiptSchemas, canonicalSerialize } from '../services/receiptIntegrityService';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptRecord, type ReceiptAppendStore } from '../services/receiptAuthorityService';
import type { ReceiptKind, JudgmentReceipt, EvaluationReceipt, ExecutionReceipt } from '../schemas/receipts';
import { DecisionContextSchema, type DecisionContext } from '../schemas/decisionContext';
import { hashCanonical } from '../services/receiptIntegrityService';

const metadata = {
  observation: { table: 'observation_receipts', id: 'observation_id', time: 'observed_at' },
  judgment: { table: 'judgment_receipts', id: 'judgment_id', time: 'issued_at' },
  execution: { table: 'execution_receipts', id: 'execution_id', time: 'executed_at' },
  evaluation: { table: 'evaluation_receipts', id: 'evaluation_id', time: 'evaluated_at' }
} as const;
const receiptId = (kind: ReceiptKind, receipt: ReceiptRecord) => String((receipt as unknown as Record<string, unknown>)[metadata[kind].id]);

/** Memory is an explicit dev/test adapter; clones prevent read/return mutation. */
export class MemoryCanonicalReceiptStore implements ReceiptAppendStore {
  private readonly records = new Map<string, ReceiptRecord>();
  private readonly contexts = new Map<string, DecisionContext>();
  private readonly acceptances = new Map<string, { sequence: number; accepted_at: string }>();
  private nextSequence = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly threshold = 80, readonly judgmentTrust?: JudgmentIssuerTrust) {
    if (process.env.NODE_ENV === 'production') throw new ReceiptAuthorityError('canonical_receipts_require_postgres');
  }
  async get(kind: ReceiptKind, id: string) { return structuredClone(this.records.get(kind + ':' + id) ?? null); }
  async list(kind: ReceiptKind) { return [...this.records.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([, value]) => structuredClone(value)); }
  async getDecisionContext(id: string) { return structuredClone(this.contexts.get(id) ?? null); }
  async getAcceptance(kind: ReceiptKind, id: string) { return structuredClone(this.acceptances.get(kind + ':' + id) ?? null); }
  async acceptanceBoundary() { return { sequence: this.nextSequence, accepted_at: new Date().toISOString() }; }
  async evaluationHistory(subjectType: string, subjectId: string, acceptedThrough?: number) {
    const evaluations = await this.list('evaluation') as EvaluationReceipt[];
    return evaluations.filter(e => acceptedThrough === undefined || (this.acceptances.get('evaluation:' + e.evaluation_id)?.sequence ?? Infinity) <= acceptedThrough);
  }
  async appendDecisionContext(raw: DecisionContext) {
    const context = DecisionContextSchema.parse(raw);
    const { context_hash, ...body } = context;
    if (hashCanonical(body) !== context_hash) throw new ReceiptAuthorityError('decision_context_hash_invalid');
    const existing = this.contexts.get(context.assessment_id);
    if (existing && canonicalSerialize(existing) !== canonicalSerialize(context)) throw new ReceiptAuthorityError('decision_context_conflict');
    if (!existing) this.contexts.set(context.assessment_id, structuredClone(context));
    return structuredClone(existing ?? context);
  }
  append(kind: ReceiptKind, raw: ReceiptRecord): Promise<ReceiptRecord> {
    const candidate = structuredClone(raw);
    const operation = this.queue.then(async () => {
      const receipt = receiptSchemas[kind].parse(candidate);
      if (kind === 'evaluation' && Date.parse((receipt as EvaluationReceipt).evaluated_at) > Date.now()) throw new ReceiptAuthorityError('evaluation_future_timestamp_quarantined');
      if (kind === 'judgment' && (receipt as JudgmentReceipt).proceed_confidence_threshold !== this.threshold) throw new ReceiptAuthorityError('configured_confidence_threshold_required');
      await assertReceiptAuthority(kind, receipt, this, this.threshold);
      if (kind === 'judgment' && this.judgmentTrust?.requireSigned && !this.judgmentTrust.verify(receipt as JudgmentReceipt)) throw new ReceiptAuthorityError('signed_judgment_required');
      if (kind === 'execution' && this.judgmentTrust?.requireSigned) {
        const judgment = await this.get('judgment', (receipt as ExecutionReceipt).judgment_id) as JudgmentReceipt;
        if (!this.judgmentTrust.verify(judgment)) throw new ReceiptAuthorityError('signed_judgment_required');
      }
      const key = kind + ':' + receiptId(kind, receipt);
      const existing = this.records.get(key);
      if (existing) {
        if (canonicalSerialize(existing) !== canonicalSerialize(receipt)) throw new ReceiptAuthorityError('receipt_id_conflict');
        return structuredClone(existing);
      }
      if (kind === 'evaluation' && (await this.list(kind)).some((value) => (value as EvaluationReceipt).execution_id === (receipt as EvaluationReceipt).execution_id)) throw new ReceiptAuthorityError('execution_already_evaluated');
      if (kind === 'execution' && Boolean((receipt as ExecutionReceipt).verification)) {
        const execution = receipt as ExecutionReceipt;
        if ((await this.list('execution')).some(raw => {
          const other = raw as ExecutionReceipt;
          return Boolean(other.verification) && (other.judgment_id === execution.judgment_id || other.settlement_ref === execution.settlement_ref);
        })) throw new ReceiptAuthorityError('execution_authorization_already_used');
      }
      this.records.set(key, structuredClone(receipt));
      this.acceptances.set(key, { sequence: ++this.nextSequence, accepted_at: new Date().toISOString() });
      return structuredClone(receipt);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}

export class PostgresCanonicalReceiptStore implements ReceiptAppendStore {
  constructor(private readonly pool: pg.Pool, private readonly threshold = 80, readonly judgmentTrust?: JudgmentIssuerTrust) {}
  async getAcceptance(kind: ReceiptKind, id: string) {
    const result = await this.pool.query('select acceptance_sequence, accepted_at from canonical_receipt_acceptances where receipt_kind=$1 and receipt_id=$2', [kind, id]);
    return result.rows[0] ? { sequence: Number(result.rows[0].acceptance_sequence), accepted_at: new Date(result.rows[0].accepted_at).toISOString() } : null;
  }
  async acceptanceBoundary() {
    const result = await this.pool.query('select coalesce(max(acceptance_sequence),0) as sequence, now() as accepted_at from canonical_receipt_acceptances');
    return { sequence: Number(result.rows[0].sequence), accepted_at: new Date(result.rows[0].accepted_at).toISOString() };
  }
  async getDecisionContext(id: string): Promise<DecisionContext | null> {
    const result = await this.pool.query('select context from decision_contexts where assessment_id=$1', [id]);
    return result.rows[0] ? DecisionContextSchema.parse(result.rows[0].context) : null;
  }
  async appendDecisionContext(raw: DecisionContext): Promise<DecisionContext> {
    const context = DecisionContextSchema.parse(raw);
    const { context_hash, ...body } = context;
    if (hashCanonical(body) !== context_hash) throw new ReceiptAuthorityError('decision_context_hash_invalid');
    await this.pool.query('insert into decision_contexts(assessment_id,context_hash,context) values($1,$2,$3) on conflict(assessment_id) do nothing',
      [context.assessment_id, context_hash, canonicalSerialize(context)]);
    const existing = await this.getDecisionContext(context.assessment_id);
    if (!existing || canonicalSerialize(existing) !== canonicalSerialize(context)) throw new ReceiptAuthorityError('decision_context_conflict');
    return existing;
  }
  async get(kind: ReceiptKind, id: string): Promise<ReceiptRecord | null> {
    const meta = metadata[kind];
    const result = await this.pool.query(`select receipt from ${meta.table} where ${meta.id} = $1`, [id]);
    return result.rows[0] ? receiptSchemas[kind].parse(result.rows[0].receipt) : null;
  }
  async list(kind: ReceiptKind): Promise<ReceiptRecord[]> {
    const meta = metadata[kind];
    const result = await this.pool.query(`select receipt from ${meta.table} order by ${meta.time}, ${meta.id}`);
    return result.rows.map((row) => receiptSchemas[kind].parse(row.receipt));
  }
  /** Indexed subject join retrieves the full graph in one PostgreSQL snapshot. */
  async evaluationHistory(subjectType: string, subjectId: string, acceptedThrough?: number): Promise<ReceiptRecord[]> {
    const result = await this.pool.query(`select ev.receipt as evaluation, ex.receipt as execution, j.receipt as judgment,
      (select jsonb_agg(o.receipt order by link.observation_id) from judgment_observations link
       join observation_receipts o using (observation_id) where link.judgment_id=j.judgment_id) as observations
      from judgment_receipts j join execution_receipts ex using (judgment_id)
      join evaluation_receipts ev using (execution_id) where j.subject_type=$1 and j.subject_id=$2
      ${acceptedThrough === undefined ? '' : 'and exists (select 1 from canonical_receipt_acceptances a where a.receipt_kind=\'evaluation\' and a.receipt_id=ev.evaluation_id and a.acceptance_sequence <= $3)'}`,
      acceptedThrough === undefined ? [subjectType, subjectId] : [subjectType, subjectId, acceptedThrough]);
    return result.rows.flatMap(row => [receiptSchemas.evaluation.parse(row.evaluation), receiptSchemas.execution.parse(row.execution),
      receiptSchemas.judgment.parse(row.judgment), ...(row.observations ?? []).map((raw: unknown) => receiptSchemas.observation.parse(raw))]);
  }
  async append(kind: ReceiptKind, raw: ReceiptRecord): Promise<ReceiptRecord> {
    const receipt = receiptSchemas[kind].parse(structuredClone(raw));
    if (kind === 'judgment' && (receipt as JudgmentReceipt).proceed_confidence_threshold !== this.threshold) throw new ReceiptAuthorityError('configured_confidence_threshold_required');
    await assertReceiptAuthority(kind, receipt, this, this.threshold);
    if (kind === 'judgment' && this.judgmentTrust?.requireSigned && !this.judgmentTrust.verify(receipt as JudgmentReceipt)) throw new ReceiptAuthorityError('signed_judgment_required');
    if (kind === 'execution' && this.judgmentTrust?.requireSigned) {
      const judgment = await this.get('judgment', (receipt as ExecutionReceipt).judgment_id) as JudgmentReceipt;
      if (!this.judgmentTrust.verify(judgment)) throw new ReceiptAuthorityError('signed_judgment_required');
    }
    const meta = metadata[kind];
    const body = receipt as unknown as Record<string, unknown>;
    const columns = [meta.id, meta.time, 'receipt_hash', 'receipt'];
    const values: unknown[] = [receiptId(kind, receipt), body[meta.time], receipt.receipt_hash, canonicalSerialize(receipt)];
    if (kind === 'observation' || kind === 'judgment') { columns.push('subject_type', 'subject_id'); values.push(body.subject_type, body.subject_id); }
    if (kind === 'execution' || kind === 'evaluation') { const parentId = kind === 'execution' ? 'judgment_id' : 'execution_id'; columns.push(parentId, 'parent_hash'); values.push(body[parentId], body.parent_hash); }
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(4663, 20261008)');
      if (kind === 'evaluation') {
        const clock = await client.query('select now() as accepted_at');
        if (Date.parse((receipt as EvaluationReceipt).evaluated_at) > new Date(clock.rows[0].accepted_at).getTime()) {
          await client.query('insert into canonical_receipt_quarantine(receipt_kind,receipt_id,receipt_hash,reason) values($1,$2,$3,$4) on conflict do nothing',
            [kind, receiptId(kind, receipt), receipt.receipt_hash, 'future_issuer_timestamp']);
          await client.query('commit');
          throw new ReceiptAuthorityError('evaluation_future_timestamp_quarantined');
        }
      }
      const inserted = await client.query(`insert into ${meta.table} (${columns.join(',')}) values (${values.map((_, index) => '$' + (index + 1)).join(',')}) on conflict (${meta.id}) do nothing returning receipt`, values);
      if (!inserted.rows.length) {
        const existing = await client.query(`select receipt from ${meta.table} where ${meta.id}=$1`, [values[0]]);
        if (!existing.rows[0] || canonicalSerialize(existing.rows[0].receipt) !== canonicalSerialize(receipt)) throw new ReceiptAuthorityError('receipt_id_conflict');
      } else if (kind === 'judgment') {
        const judgment = receipt as JudgmentReceipt;
        for (const id of judgment.cited_observation_ids) await client.query('insert into judgment_observations (judgment_id, observation_id) values ($1,$2)', [judgment.judgment_id, id]);
      }
      if (inserted.rows.length) await client.query('insert into canonical_receipt_acceptances(receipt_kind,receipt_id,receipt_hash) values($1,$2,$3)',
        [kind, receiptId(kind, receipt), receipt.receipt_hash]);
      await client.query('commit');
      return structuredClone(receipt);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        const repeatedEvaluation = 'constraint' in error && error.constraint === 'evaluation_receipts_execution_id_key';
        throw new ReceiptAuthorityError(repeatedEvaluation ? 'execution_already_evaluated' : 'receipt_unique_conflict');
      }
      throw error;
    } finally { client.release(); }
  }
}
