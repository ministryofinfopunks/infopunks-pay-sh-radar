import { localSimulationDomain } from '../../../src/security/evidenceProvenance';
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import {
  assertEngineRecordTransition,
  type EconomicEngineStore,
  type EngineRecordKind,
} from "../../../src/persistence/economicEngineStore";
import { MemoryCanonicalReceiptStore } from "../../../src/persistence/canonicalReceiptStore";
import type { JudgmentIssuerTrust } from "../../../src/security/judgmentIssuer";
import type { ReceiptKind } from "../../../src/schemas/receipts";
import type { ReceiptRecord } from "../../../src/services/receiptAuthorityService";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";

/** Disposable local database only. No connection string, tenant DB or network access. */
export class LabDatabase implements EconomicEngineStore {
  readonly durable = true;
  readonly db: DatabaseSync;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS records(kind TEXT,id TEXT,body TEXT,hash TEXT,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS receipts(sequence INTEGER PRIMARY KEY,kind TEXT,id TEXT,body TEXT,UNIQUE(kind,id));
      CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(id TEXT PRIMARY KEY,body TEXT NOT NULL);`);
  }
  transaction<T>(
    work: Parameters<EconomicEngineStore["transaction"]>[0],
  ): Promise<T> {
    const task = this.tail.then(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const decode = (row: unknown) => {
          if (!row) return null;
          const r = row as { body: string; hash: string },
            value: unknown = JSON.parse(r.body);
          if (hashCanonical(value) !== r.hash)
            throw new Error("lab_record_corruption");
          return value;
        };
        const result = await work({
          get: async <R>(kind: EngineRecordKind, id: string) =>
            decode(
              this.db
                .prepare("SELECT * FROM records WHERE kind=? AND id=?")
                .get(kind, id),
            ) as R | null,
          list: async <R>(kind: EngineRecordKind) =>
            this.db
              .prepare("SELECT * FROM records WHERE kind=? ORDER BY id")
              .all(kind)
              .map(decode) as R[],
          put: async (kind, id, value) => {
            const old = decode(
              this.db
                .prepare("SELECT * FROM records WHERE kind=? AND id=?")
                .get(kind, id),
            );
            assertEngineRecordTransition(kind, old, value);
            this.db
              .prepare("INSERT OR REPLACE INTO records VALUES(?,?,?,?)")
              .run(kind, id, JSON.stringify(value), hashCanonical(value));
          },
        });
        this.db.exec("COMMIT");
        return result as T;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
  close() {
    this.db.close();
  }
}
export async function openReceipts(
  database: LabDatabase,
  trust: JudgmentIssuerTrust,
) {
  class LocalReceiptMemory extends MemoryCanonicalReceiptStore { readonly evidenceDomain = localSimulationDomain(); }
  const memory = new LocalReceiptMemory(80, trust);
  for (const row of database.db
    .prepare("SELECT kind,body FROM receipts ORDER BY sequence")
    .all())
    await memory.append(
      row.kind as ReceiptKind,
      JSON.parse(row.body as string),
    );
  let tail: Promise<unknown> = Promise.resolve(),
    poisoned = false;
  return {
    judgmentTrust: trust,
    evidenceDomain: localSimulationDomain(),
    async get(kind: ReceiptKind, id: string) {
      if (poisoned) throw new Error("lab_storage_restart_required");
      return memory.get(kind, id);
    },
    async list(kind: ReceiptKind) {
      if (poisoned) throw new Error("lab_storage_restart_required");
      return memory.list(kind);
    },
    append(kind: ReceiptKind, receipt: ReceiptRecord): Promise<ReceiptRecord> {
      const task = tail.then(async () => {
        if (poisoned) throw new Error("lab_storage_restart_required");
        const value = await memory.append(kind, receipt);
        const id = String(
          (value as unknown as Record<string, unknown>)[kind + "_id"],
        );
        try {
          // Share the control connection's queue so a receipt cannot accidentally
          // join another caller's transaction and disappear when it rolls back.
          await database.transaction(async () => {
            database.db
              .prepare(
                "INSERT OR IGNORE INTO receipts(kind,id,body) VALUES(?,?,?)",
              )
              .run(kind, id, JSON.stringify(value));
          });
        } catch (error) {
          poisoned = true;
          throw error;
        }
        return value;
      });
      tail = task.catch(() => undefined);
      return task;
    },
  };
}
