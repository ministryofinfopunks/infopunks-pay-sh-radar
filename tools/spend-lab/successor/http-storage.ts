import { hashCanonical } from '../../../src/services/receiptIntegrityService';
import { MemoryCanonicalReceiptStore } from '../../../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository } from '../../../src/repositories/judgmentRequestRepository';
import { localSimulationDomain } from '../../../src/security/evidenceProvenance';
import type { JudgmentIssuer } from '../../../src/security/judgmentIssuer';
import type { ReceiptKind } from '../../../src/schemas/receipts';
import type { ReceiptRecord } from '../../../src/services/receiptAuthorityService';
import type { DecisionContext } from '../../../src/schemas/decisionContext';
import type {
  JudgmentRequestRecord,
  FreeAssessmentAttempt,
  PaymentAuthorizationBinding,
} from '../../../src/repositories/judgmentRequestRepository';
import { LabDatabase } from '../harness/storage';

/** Append-only disposable SQLite journal. Replay runs the canonical adapters' invariants. */
export async function httpStorage(db: LabDatabase, issuer: JudgmentIssuer) {
  db.db.exec(
    'CREATE TABLE IF NOT EXISTS http_events(seq INTEGER PRIMARY KEY,kind TEXT,body TEXT,previous_hash TEXT,event_hash TEXT)',
  );
  let replay = true,
    previous = 'http-event-genesis-v1';
  const log = (kind: string, body: unknown) => {
    if (!replay) {
      const encoded = JSON.stringify(body);
      const hash = hashCanonical({ kind, body: JSON.parse(encoded), previous });
      db.db
        .prepare('INSERT INTO http_events(kind,body,previous_hash,event_hash) VALUES(?,?,?,?)')
        .run(kind, encoded, previous, hash);
      previous = hash;
    }
  };
  class Store extends MemoryCanonicalReceiptStore {
    readonly evidenceDomain = localSimulationDomain();
    override async append(kind: ReceiptKind, value: ReceiptRecord) {
      const r = await super.append(kind, value);
      log('receipt', { kind, value: r });
      return r;
    }
    override async appendDecisionContext(value: DecisionContext) {
      const r = await super.appendDecisionContext(value);
      log('context', r);
      return r;
    }
  }
  class Journal extends MemoryJudgmentRequestRepository {
    override async quote(key: string, value: JudgmentRequestRecord) {
      const r = await super.quote(key, value);
      log('quote', { key, value: r });
      return r;
    }
    override async claim(key: string, hash: string, binding?: PaymentAuthorizationBinding) {
      const r = await super.claim(key, hash, binding);
      if (r) log('claim', { key, hash, binding });
      return r;
    }
    override async save(key: string, value: JudgmentRequestRecord) {
      await super.save(key, value);
      log('save', { key, value });
    }
    override async recordFreeAttempt(value: Omit<FreeAssessmentAttempt, 'attempt_hash'>) {
      const r = await super.recordFreeAttempt(value);
      log('free', value);
      return r;
    }
  }
  const store = new Store(80, issuer),
    journal = new Journal();
  for (const row of db.db.prepare('SELECT * FROM http_events ORDER BY seq').all()) {
    const body = JSON.parse(String(row.body));
    if (
      row.previous_hash !== previous ||
      hashCanonical({ kind: row.kind, body, previous }) !== row.event_hash
    )
      throw new Error('http_event_corruption');
    previous = String(row.event_hash);
    switch (row.kind) {
      case 'receipt':
        await store.append(body.kind, body.value);
        break;
      case 'context':
        await store.appendDecisionContext(body);
        break;
      case 'quote':
        await journal.quote(body.key, body.value);
        break;
      case 'claim':
        if (!(await journal.claim(body.key, body.hash, body.binding)))
          throw new Error('http_journal_claim_replay_failed');
        break;
      case 'save':
        await journal.save(body.key, body.value);
        break;
      case 'free':
        await journal.recordFreeAttempt(body);
        break;
      default:
        throw new Error('http_journal_corruption');
    }
  }
  replay = false;
  return { store, journal };
}
