import type pg from 'pg';
import { hashCanonical } from '../services/receiptIntegrityService';

export type EngineRecordKind = 'attempt' | 'reservation' | 'authorization' | 'execution' | 'trace' | 'cost' | 'evaluation' | 'revocation';
export interface EngineTransaction {
  get<T>(kind: EngineRecordKind, id: string): Promise<T | null>;
  list<T>(kind: EngineRecordKind): Promise<T[]>;
  put<T>(kind: EngineRecordKind, id: string, value: T): Promise<void>;
}
export interface EconomicEngineStore {
  readonly durable: boolean;
  transaction<T>(work: (tx: EngineTransaction) => Promise<T>): Promise<T>;
}
const mutable = new Set<EngineRecordKind>(['attempt', 'reservation', 'execution']);
/** Same transition rules for memory fixtures and the durable store. */
export function assertEngineRecordTransition(kind: EngineRecordKind, before: unknown, after: unknown) {
  if (!before || hashCanonical(before) === hashCanonical(after)) return;
  if (!mutable.has(kind)) throw new Error('engine_record_conflict');
  const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
  const editable = kind === 'attempt' ? ['status', 'witness', 'result', 'judgment', 'authorization', 'reservation_id', 'assessed_at', 'valid_until']
    : kind === 'reservation' ? ['state', 'actual_amount_atomic'] : ['state', 'outcome', 'receipt', 'latency_ms'];
  const fixed = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([k]) => !editable.includes(k)));
  if (hashCanonical(fixed(old)) !== hashCanonical(fixed(next))) throw new Error('engine_record_identity_immutable');
  const field = kind === 'attempt' ? 'status' : 'state';
  const transitions: Record<string, string[]> = kind === 'attempt' ? { evaluating: ['assessed'], assessed: ['complete'], complete: [] }
    : kind === 'reservation' ? { reserved: ['authorized', 'released'], authorized: ['submitted', 'released'], submitted: ['finalized'], finalized: [], released: [] }
    : { submitted: ['submitted', 'verified'], verified: ['finalized'], finalized: [] };
  if (!transitions[String(old[field])]?.includes(String(next[field]))) throw new Error('engine_record_transition_invalid');
  if (kind === 'execution' && old.state === next.state && (hashCanonical(old.outcome) !== hashCanonical(next.outcome)
    || hashCanonical(old.receipt) !== hashCanonical(next.receipt))) throw new Error('engine_record_transition_invalid');
}
export class MemoryEconomicEngineStore implements EconomicEngineStore {
  readonly durable = false;
  private records = new Map<string, unknown>();
  private tail: Promise<unknown> = Promise.resolve();
  async transaction<T>(work: (tx: EngineTransaction) => Promise<T>): Promise<T> {
    const task = this.tail.then(async () => {
      const snapshot = structuredClone(this.records);
      const result = await work({
        get: async <R>(kind: EngineRecordKind, id: string) => structuredClone(snapshot.get(kind + ':' + id) as R ?? null),
        list: async <R>(kind: EngineRecordKind) => [...snapshot.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([, value]) => structuredClone(value) as R),
        put: async (kind, id, value) => {
          const key = kind + ':' + id, prior = snapshot.get(key);
          assertEngineRecordTransition(kind, prior, value);
          snapshot.set(key, structuredClone(value));
        }
      });
      this.records = snapshot;
      return result;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
}
/** One advisory transaction lock serializes economic state changes across processes.
 * Network side effects must occur outside these transactions. Correctness first;
 * shard by budget scope only once cross-scope constraints are formally covered.
 */
export class PostgresEconomicEngineStore implements EconomicEngineStore {
  readonly durable = true;
  constructor(private readonly pool: pg.Pool) {}
  async transaction<T>(work: (tx: EngineTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(734912608)");
      const result = await work({
        get: async <R>(kind: EngineRecordKind, id: string) => {
          const row = (await client.query('select record, record_hash from economic_engine_records where kind=$1 and id=$2', [kind, id])).rows[0];
          if (row && row.record_hash !== hashCanonical(row.record)) throw new Error('engine_record_integrity_invalid');
          return row?.record as R ?? null;
        },
        list: async <R>(kind: EngineRecordKind) => {
          const rows = (await client.query('select record,record_hash from economic_engine_records where kind=$1 order by id', [kind])).rows;
          if (rows.some(row => row.record_hash !== hashCanonical(row.record))) throw new Error('engine_record_integrity_invalid');
          return rows.map(row => row.record as R);
        },
        put: async (kind, id, record) => {
          const prior = (await client.query('select record,record_hash from economic_engine_records where kind=$1 and id=$2', [kind, id])).rows[0];
          const digest = hashCanonical(record);
          if (prior && prior.record_hash !== hashCanonical(prior.record)) throw new Error('engine_record_integrity_invalid');
          assertEngineRecordTransition(kind, prior?.record, record);
          await client.query('insert into economic_engine_records(kind,id,record,record_hash) values($1,$2,$3,$4) on conflict(kind,id) do update set record=excluded.record,record_hash=excluded.record_hash', [kind, id, record, digest]);
        }
      });
      await client.query('commit');
      return result;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
    finally { client.release(); }
  }
}
