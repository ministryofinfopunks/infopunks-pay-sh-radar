import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import type { MachinePreflightReceipt, MachinePreflightReceiptFilters } from './machinePreflightService';

const { Pool } = pg;

export type MachineReceiptStorageMetadata = {
  mode: 'durable' | 'memory' | 'test';
  adapter: 'jsonl' | 'postgres' | 'memory';
  durable: boolean;
  limitation?: string;
  demo_seed_enabled: boolean;
};

export type MachinePreflightReceiptStorageAdapter = {
  appendMachinePreflightReceipt(receipt: MachinePreflightReceipt): Promise<void>;
  listMachinePreflightReceipts(filters: MachinePreflightReceiptFilters): Promise<MachinePreflightReceipt[]>;
  getMachinePreflightReceipt(receiptId: string): Promise<MachinePreflightReceipt | null>;
  listMachineReceiptsByMachine(machineId: string): Promise<MachinePreflightReceipt[]>;
  seedMachineDemoReceiptsIfEnabled(receipts: MachinePreflightReceipt[]): Promise<void>;
  getDiagnostics?(): Promise<{ receipt_count?: number; warning?: string | null }>;
  clearForTests?(): Promise<void>;
  close?(): Promise<void>;
};

type BaseRecord = { receipt: MachinePreflightReceipt };

type JsonlOptions = { filePath: string };

export class MemoryMachinePreflightReceiptStorageAdapter implements MachinePreflightReceiptStorageAdapter {
  private readonly receipts: MachinePreflightReceipt[] = [];

  async appendMachinePreflightReceipt(receipt: MachinePreflightReceipt) {
    this.receipts.push(copyReceipt(receipt));
  }

  async listMachinePreflightReceipts(filters: MachinePreflightReceiptFilters) {
    return filterAndSort(this.receipts, filters).map(copyReceipt);
  }

  async getMachinePreflightReceipt(receiptId: string) {
    const found = this.receipts.find((item) => item.receipt_id === receiptId);
    return found ? copyReceipt(found) : null;
  }

  async listMachineReceiptsByMachine(machineId: string) {
    return this.receipts.filter((item) => item.machine_id === machineId).map(copyReceipt);
  }

  async seedMachineDemoReceiptsIfEnabled(receipts: MachinePreflightReceipt[]) {
    const existing = new Set(this.receipts.map((item) => item.receipt_id));
    for (const receipt of receipts) {
      if (existing.has(receipt.receipt_id)) continue;
      this.receipts.push(copyReceipt(receipt));
      existing.add(receipt.receipt_id);
    }
  }

  async clearForTests() {
    this.receipts.splice(0, this.receipts.length);
  }

  async getDiagnostics() {
    return { receipt_count: this.receipts.length, warning: null };
  }
}

export class JsonlMachinePreflightReceiptStorageAdapter implements MachinePreflightReceiptStorageAdapter {
  private malformedLineCount = 0;

  constructor(private readonly options: JsonlOptions) {}

  async appendMachinePreflightReceipt(receipt: MachinePreflightReceipt) {
    ensureParentDir(this.options.filePath);
    const row: BaseRecord = { receipt };
    appendFileSync(this.options.filePath, `${JSON.stringify(row)}\n`, 'utf8');
  }

  async listMachinePreflightReceipts(filters: MachinePreflightReceiptFilters) {
    return filterAndSort(this.readAll(), filters);
  }

  async getMachinePreflightReceipt(receiptId: string) {
    const found = this.readAll().find((item) => item.receipt_id === receiptId);
    return found ? copyReceipt(found) : null;
  }

  async listMachineReceiptsByMachine(machineId: string) {
    return this.readAll().filter((item) => item.machine_id === machineId).map(copyReceipt);
  }

  async seedMachineDemoReceiptsIfEnabled(receipts: MachinePreflightReceipt[]) {
    const existing = new Set(this.readAll().map((item) => item.receipt_id));
    const toAppend = receipts.filter((item) => !existing.has(item.receipt_id));
    if (!toAppend.length) return;
    ensureParentDir(this.options.filePath);
    appendFileSync(this.options.filePath, toAppend.map((receipt) => JSON.stringify({ receipt })).join('\n') + '\n', 'utf8');
  }

  async clearForTests() {
    ensureParentDir(this.options.filePath);
    writeFileSync(this.options.filePath, '', 'utf8');
  }

  async getDiagnostics() {
    const rows = this.readAll();
    return {
      receipt_count: rows.length,
      warning: this.malformedLineCount > 0 ? `Skipped ${this.malformedLineCount} malformed JSONL machine receipt line(s).` : null
    };
  }

  private readAll(): MachinePreflightReceipt[] {
    if (!existsSync(this.options.filePath)) return [];
    const lines = readFileSync(this.options.filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const byId = new Map<string, MachinePreflightReceipt>();
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as BaseRecord;
        if (!parsed?.receipt?.receipt_id) continue;
        byId.set(parsed.receipt.receipt_id, copyReceipt(parsed.receipt));
      } catch {
        this.malformedLineCount += 1;
        continue;
      }
    }
    return [...byId.values()];
  }
}

export class PostgresMachinePreflightReceiptStorageAdapter implements MachinePreflightReceiptStorageAdapter {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async appendMachinePreflightReceipt(receipt: MachinePreflightReceipt) {
    await this.ensureSchema();
    await this.pool.query(
      `insert into machine_preflight_receipts (receipt_id, machine_id, decision, source_market, chain, selected_service_id, created_at, payload)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb)
       on conflict (receipt_id) do update set payload = excluded.payload, created_at = excluded.created_at`,
      [receipt.receipt_id, receipt.machine_id, receipt.decision, receipt.source_market, receipt.chain, receipt.selected_service_id, receipt.created_at, JSON.stringify(receipt)]
    );
  }

  async listMachinePreflightReceipts(filters: MachinePreflightReceiptFilters) {
    await this.ensureSchema();
    const result = await this.pool.query('select payload from machine_preflight_receipts');
    const receipts = result.rows.map((row) => row.payload as MachinePreflightReceipt);
    return filterAndSort(receipts, filters);
  }

  async getMachinePreflightReceipt(receiptId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('select payload from machine_preflight_receipts where receipt_id = $1', [receiptId]);
    const payload = result.rows[0]?.payload as MachinePreflightReceipt | undefined;
    return payload ? copyReceipt(payload) : null;
  }

  async listMachineReceiptsByMachine(machineId: string) {
    await this.ensureSchema();
    const result = await this.pool.query('select payload from machine_preflight_receipts where machine_id = $1', [machineId]);
    return result.rows.map((row) => copyReceipt(row.payload as MachinePreflightReceipt));
  }

  async seedMachineDemoReceiptsIfEnabled(receipts: MachinePreflightReceipt[]) {
    for (const receipt of receipts) {
      await this.appendMachinePreflightReceipt(receipt);
    }
  }

  async close() {
    await this.pool.end();
  }

  async getDiagnostics() {
    try {
      await this.ensureSchema();
      const result = await this.pool.query('select count(*)::int as count from machine_preflight_receipts');
      return { receipt_count: result.rows[0]?.count ?? 0, warning: null };
    } catch (error) {
      return { receipt_count: undefined, warning: `Postgres machine receipt diagnostics unavailable: ${errorMessage(error)}` };
    }
  }

  private async ensureSchema() {
    // Stable durable schema for machine preflight decision receipts.
    await this.pool.query(`
      create table if not exists machine_preflight_receipts (
        receipt_id text primary key,
        machine_id text not null,
        decision text not null,
        source_market text,
        chain text,
        selected_service_id text,
        created_at timestamptz not null,
        payload jsonb not null
      );
      create index if not exists machine_preflight_receipts_machine_idx on machine_preflight_receipts(machine_id, created_at desc);
      create index if not exists machine_preflight_receipts_decision_idx on machine_preflight_receipts(decision, created_at desc);
    `);
  }
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return String(error ?? 'unknown_error');
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(message ?? 'unknown_error');
}

export function createMachineReceiptStorageMetadata(input: {
  env: string;
  adapter: 'jsonl' | 'postgres' | 'memory';
  durable: boolean;
  demoSeedEnabled: boolean;
  limitation?: string;
}): MachineReceiptStorageMetadata {
  return {
    mode: input.env === 'test' ? 'test' : input.durable ? 'durable' : 'memory',
    adapter: input.adapter,
    durable: input.durable,
    limitation: input.limitation,
    demo_seed_enabled: input.demoSeedEnabled
  };
}

function ensureParentDir(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function copyReceipt(receipt: MachinePreflightReceipt): MachinePreflightReceipt {
  return {
    ...receipt,
    policy_checks: receipt.policy_checks.map((check) => ({ ...check })),
    violations: [...receipt.violations],
    review_reasons: [...receipt.review_reasons],
    caveats: [...receipt.caveats]
  };
}

function filterAndSort(receipts: MachinePreflightReceipt[], filters: MachinePreflightReceiptFilters): MachinePreflightReceipt[] {
  const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));
  return receipts
    .filter((receipt) => !filters.decision || receipt.decision === filters.decision)
    .filter((receipt) => !filters.machine_id || receipt.machine_id === filters.machine_id)
    .filter((receipt) => !filters.service_id || receipt.selected_service_id === filters.service_id || receipt.execution_service_id === filters.service_id)
    .filter((receipt) => !filters.source_market || receipt.source_market === filters.source_market)
    .filter((receipt) => !filters.chain || receipt.chain === filters.chain)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at) || right.receipt_id.localeCompare(left.receipt_id))
    .slice(0, limit)
    .map(copyReceipt);
}
