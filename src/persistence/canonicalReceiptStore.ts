import type { JudgmentIssuerTrust } from '../security/judgmentIssuer';
import type pg from 'pg';
import { receiptSchemas, canonicalSerialize } from '../services/receiptIntegrityService';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptRecord, type ReceiptAppendStore } from '../services/receiptAuthorityService';
import type { ReceiptKind, JudgmentReceipt, EvaluationReceipt, ExecutionReceipt } from '../schemas/receipts';

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
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly threshold = 80, readonly judgmentTrust?: JudgmentIssuerTrust) {
    if (process.env.NODE_ENV === 'production') throw new ReceiptAuthorityError('canonical_receipts_require_postgres');
  }
  async get(kind: ReceiptKind, id: string) { return structuredClone(this.records.get(kind + ':' + id) ?? null); }
  async list(kind: ReceiptKind) { return [...this.records.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([, value]) => structuredClone(value)); }
  append(kind: ReceiptKind, raw: ReceiptRecord): Promise<ReceiptRecord> {
    const candidate = structuredClone(raw);
    const operation = this.queue.then(async () => {
      const receipt = receiptSchemas[kind].parse(candidate);
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
      return structuredClone(receipt);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}

export class PostgresCanonicalReceiptStore implements ReceiptAppendStore {
  constructor(private readonly pool: pg.Pool, private readonly threshold = 80, readonly judgmentTrust?: JudgmentIssuerTrust) {}
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
  async evaluationHistory(subjectType: string, subjectId: string): Promise<ReceiptRecord[]> {
    const result = await this.pool.query(`select ev.receipt as evaluation, ex.receipt as execution, j.receipt as judgment,
      (select jsonb_agg(o.receipt order by link.observation_id) from judgment_observations link
       join observation_receipts o using (observation_id) where link.judgment_id=j.judgment_id) as observations
      from judgment_receipts j join execution_receipts ex using (judgment_id)
      join evaluation_receipts ev using (execution_id) where j.subject_type=$1 and j.subject_id=$2`, [subjectType, subjectId]);
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
      const inserted = await client.query(`insert into ${meta.table} (${columns.join(',')}) values (${values.map((_, index) => '$' + (index + 1)).join(',')}) on conflict (${meta.id}) do nothing returning receipt`, values);
      if (!inserted.rows.length) {
        const existing = await client.query(`select receipt from ${meta.table} where ${meta.id}=$1`, [values[0]]);
        if (!existing.rows[0] || canonicalSerialize(existing.rows[0].receipt) !== canonicalSerialize(receipt)) throw new ReceiptAuthorityError('receipt_id_conflict');
      } else if (kind === 'judgment') {
        const judgment = receipt as JudgmentReceipt;
        for (const id of judgment.cited_observation_ids) await client.query('insert into judgment_observations (judgment_id, observation_id) values ($1,$2)', [judgment.judgment_id, id]);
      }
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
