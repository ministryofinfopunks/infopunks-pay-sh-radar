import { createHash } from 'node:crypto';
import type pg from 'pg';
import { RetryablePostgresSchema } from '../persistence/retryablePostgresSchema';

export type RhChainSpendReceipt = {
  receipt_id: string; integrity_hash: string; created_at: string;
  record_type: 'RH_ASSET_IDENTITY' | 'RH_SPEND_PREFLIGHT';
  methodology_version: 'rh-spend-v1'; immutable: true; durable: boolean;
  result: Record<string, unknown>; evidence_inventory: Record<string, unknown>;
};

// Recursively sorted object keys, original array order; the exact hash input is the
// receipt without receipt_id and integrity_hash. Matches the existing SHA-256 receipt model.
export function canonicalSpendJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalSpendJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalSpendJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sealSpendReceipt(content: Omit<RhChainSpendReceipt, 'receipt_id' | 'integrity_hash'>): RhChainSpendReceipt {
  // Hash exactly the JSON representation that both PostgreSQL and HTTP retain.
  const serializable = JSON.parse(JSON.stringify(content)) as typeof content;
  const digest = createHash('sha256').update(canonicalSpendJson(serializable)).digest('hex');
  return { ...serializable, receipt_id: `rhsp_${digest}`, integrity_hash: `sha256:${digest}` };
}
export interface RhChainSpendReceiptStore {
  readonly durable: boolean;
  create(receipt: RhChainSpendReceipt): Promise<RhChainSpendReceipt>;
  get(id: string): Promise<RhChainSpendReceipt | null>;
}
export class InMemoryRhChainSpendReceiptStore implements RhChainSpendReceiptStore {
  readonly durable = false;
  private readonly records = new Map<string, RhChainSpendReceipt>();
  async create(receipt: RhChainSpendReceipt) {
    const current = this.records.get(receipt.receipt_id);
    if (!current) this.records.set(receipt.receipt_id, structuredClone(receipt));
    return structuredClone(current ?? receipt);
  }
  async get(id: string) { return structuredClone(this.records.get(id) ?? null); }
}
export class PostgresRhChainSpendReceiptStore implements RhChainSpendReceiptStore {
  readonly durable = true;
  private readonly schema = new RetryablePostgresSchema('rh_chain_spend_receipts');
  constructor(private readonly pool: pg.Pool) {}
  private ready() {
    return this.schema.ensure(this.pool, `create table if not exists rh_chain_spend_receipts (
      receipt_id text primary key, created_at timestamptz not null, payload jsonb not null
    )`);
  }
  async create(receipt: RhChainSpendReceipt) {
    await this.ready();
    await this.pool.query('insert into rh_chain_spend_receipts(receipt_id,created_at,payload) values($1,$2,$3::jsonb) on conflict(receipt_id) do nothing', [receipt.receipt_id, receipt.created_at, JSON.stringify(receipt)]);
    const stored = await this.get(receipt.receipt_id);
    if (!stored) throw new Error('spend_receipt_not_persisted');
    return stored;
  }
  async get(id: string) {
    await this.ready();
    const result = await this.pool.query<{ payload: RhChainSpendReceipt }>('select payload from rh_chain_spend_receipts where receipt_id=$1', [id]);
    return result.rows[0]?.payload ?? null;
  }
}
