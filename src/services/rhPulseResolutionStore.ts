import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  RhPulseAuditEventSchema,
  RhPulseCallRecordSchema,
  RhPulseWindowRecordSchema,
  type RhPulseAuditEvent,
  type RhPulseCallRecord,
  type RhPulseWindowRecord
} from '../shared/rhPulseCalls';
import {
  RhPulseResolutionRunRecordSchema,
  RhPulseRotationReceiptRecordSchema,
  type RhPulseResolutionRunRecord,
  type RhPulseRotationReceiptRecord
} from '../shared/rhPulseResolution';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { RhPulseParticipationStore } from './rhPulseParticipationStore';

export type RhPulseResolutionPublicationArtifacts = {
  receipt: RhPulseRotationReceiptRecord;
  auditEvents: RhPulseAuditEvent[];
};

export type RhPulseResolutionFailureStage =
  | 'after_resolution_run_insertion'
  | 'after_resolution_draft_audit_insertion'
  | 'after_resolution_run_lock'
  | 'after_rotation_receipt_insertion'
  | 'after_resolution_run_update'
  | 'after_resolution_window_update'
  | 'after_resolution_audit_insertion';

export type RhPulseResolutionObservation = {
  event: 'rh_pulse_resolution_operation';
  operation: 'draft_create' | 'run_transition' | 'publication' | 'public_read' | 'community_accuracy';
  outcome: 'committed' | 'idempotent' | 'conflict' | 'rolled_back' | 'completed';
  duration_ms: number;
  error_code?: string | null;
  window_id?: string;
  run_id?: string;
  receipt_id?: string;
};

export type RhPulseResolutionPublishResult =
  | {
      published: true;
      idempotent: boolean;
      run: RhPulseResolutionRunRecord;
      window: RhPulseWindowRecord;
      receipt: RhPulseRotationReceiptRecord;
      calls: RhPulseCallRecord[];
    }
  | {
      published: false;
      code: 'run_not_found' | 'run_not_approved' | 'window_not_closed' | 'publication_conflict';
      receipt: RhPulseRotationReceiptRecord | null;
    };

export interface RhPulseResolutionStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  getWindow(windowId: string): Promise<RhPulseWindowRecord | null>;
  appendAudit(event: RhPulseAuditEvent): Promise<void>;
  createRun(
    windowId: string,
    inputManifestHash: string,
    build: (runNumber: number, window: RhPulseWindowRecord) => {
      run: RhPulseResolutionRunRecord;
      audit: RhPulseAuditEvent;
    }
  ): Promise<{ run: RhPulseResolutionRunRecord; idempotent: boolean }>;
  getRun(runId: string): Promise<RhPulseResolutionRunRecord | null>;
  listRuns(windowId: string): Promise<RhPulseResolutionRunRecord[]>;
  approveRun(
    runId: string,
    approvedAt: string,
    approvedBy: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ): Promise<RhPulseResolutionRunRecord | null>;
  cancelRun(
    runId: string,
    cancelledAt: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ): Promise<RhPulseResolutionRunRecord | null>;
  publish(input: {
    runId: string;
    build: (
      run: RhPulseResolutionRunRecord,
      window: RhPulseWindowRecord,
      calls: RhPulseCallRecord[],
      publishedAt: string
    ) => RhPulseResolutionPublicationArtifacts;
  }): Promise<RhPulseResolutionPublishResult>;
  getReceipt(receiptIdOrSlug: string): Promise<RhPulseRotationReceiptRecord | null>;
  getReceiptForWindow(windowId: string): Promise<RhPulseRotationReceiptRecord | null>;
  listReceipts(limit?: number): Promise<RhPulseRotationReceiptRecord[]>;
  close?(): Promise<void>;
}

export class InMemoryRhPulseResolutionStore implements RhPulseResolutionStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly runs = new Map<string, RhPulseResolutionRunRecord>();
  private readonly receipts = new Map<string, RhPulseRotationReceiptRecord>();
  private queue: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(
    private readonly participation: RhPulseParticipationStore,
    options: { now?: () => Date } = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  getWindow(windowId: string) {
    return this.participation.getWindow(windowId);
  }

  appendAudit(event: RhPulseAuditEvent) {
    return this.participation.appendAudit(RhPulseAuditEventSchema.parse(event));
  }

  async createRun(
    windowId: string,
    inputManifestHash: string,
    build: (runNumber: number, window: RhPulseWindowRecord) => {
      run: RhPulseResolutionRunRecord;
      audit: RhPulseAuditEvent;
    }
  ) {
    return this.exclusive(async () => {
      const existing = [...this.runs.values()].find((run) => (
        run.window_id === windowId && run.input_manifest_hash === inputManifestHash
      ));
      if (existing) return { run: clone(existing), idempotent: true };
      const window = await this.participation.getWindow(windowId);
      if (!window) throw storeError('window_not_found');
      if (window.status !== 'closed') throw storeError('window_not_closed');
      const runNumber = 1 + Math.max(0, ...[...this.runs.values()]
        .filter((run) => run.window_id === windowId)
        .map((run) => run.run_number));
      const built = build(runNumber, clone(window));
      const run = RhPulseResolutionRunRecordSchema.parse(built.run);
      const audit = RhPulseAuditEventSchema.parse(built.audit);
      await this.participation.appendAudit(audit);
      this.runs.set(run.id, clone(run));
      return { run: clone(run), idempotent: false };
    });
  }

  async getRun(runId: string) {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  async listRuns(windowId: string) {
    return [...this.runs.values()]
      .filter((run) => run.window_id === windowId)
      .sort((left, right) => right.run_number - left.run_number)
      .map(clone);
  }

  async approveRun(
    runId: string,
    approvedAt: string,
    approvedBy: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ) {
    return this.exclusive(async () => {
      const current = this.runs.get(runId);
      if (!current) return null;
      const idempotent = current.status === 'approved' || current.status === 'published';
      if (!idempotent && current.status !== 'draft') throw storeError('invalid_transition');
      const next = idempotent ? current : RhPulseResolutionRunRecordSchema.parse({
        ...current,
        status: 'approved',
        approved_at: approvedAt,
        approved_by: approvedBy
      });
      await this.participation.appendAudit(RhPulseAuditEventSchema.parse(buildAudit(next, idempotent)));
      this.runs.set(next.id, clone(next));
      return clone(next);
    });
  }

  async cancelRun(
    runId: string,
    cancelledAt: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ) {
    return this.exclusive(async () => {
      const current = this.runs.get(runId);
      if (!current) return null;
      const idempotent = current.status === 'cancelled';
      if (!idempotent && !['draft', 'approved', 'blocked'].includes(current.status)) {
        throw storeError('invalid_transition');
      }
      const next = idempotent ? current : RhPulseResolutionRunRecordSchema.parse({
        ...current,
        status: 'cancelled',
        cancelled_at: cancelledAt
      });
      await this.participation.appendAudit(RhPulseAuditEventSchema.parse(buildAudit(next, idempotent)));
      this.runs.set(next.id, clone(next));
      return clone(next);
    });
  }

  async publish(input: {
    runId: string;
    build: (
      run: RhPulseResolutionRunRecord,
      window: RhPulseWindowRecord,
      calls: RhPulseCallRecord[],
      publishedAt: string
    ) => RhPulseResolutionPublicationArtifacts;
  }): Promise<RhPulseResolutionPublishResult> {
    return this.exclusive(async () => {
      const current = this.runs.get(input.runId);
      if (!current) return { published: false, code: 'run_not_found', receipt: null };
      const existing = [...this.receipts.values()].find((receipt) => receipt.window_id === current.window_id);
      if (existing) {
        if (existing.resolution_run_id === current.id) {
          const window = await this.participation.getWindow(current.window_id);
          return {
            published: true,
            idempotent: true,
            run: clone(current),
            window: clone(window!),
            receipt: clone(existing),
            calls: await this.participation.listVerifiedCalls(current.window_id)
          };
        }
        return { published: false, code: 'publication_conflict', receipt: clone(existing) };
      }
      if (current.status !== 'approved') return { published: false, code: 'run_not_approved', receipt: null };
      const window = await this.participation.getWindow(current.window_id);
      const publishedAt = this.now().toISOString();
      if (
        !window
        || window.status !== 'closed'
        || Date.parse(publishedAt) < Date.parse(window.call_submission_closes_at)
      ) {
        return { published: false, code: 'window_not_closed', receipt: null };
      }
      const calls = await this.participation.listVerifiedCalls(window.id);
      const artifacts = input.build(clone(current), clone(window), calls.map(clone), publishedAt);
      const receipt = RhPulseRotationReceiptRecordSchema.parse(artifacts.receipt);
      const events = artifacts.auditEvents.map((event) => RhPulseAuditEventSchema.parse(event));
      const resolvedWindow = await this.participation.transitionWindow(window.id, (locked) => ({
        window: RhPulseWindowRecordSchema.parse({
          ...locked,
          status: 'resolved',
          resolved_at: publishedAt,
          updated_at: publishedAt
        }),
        audit: events[0]!
      }));
      if (!resolvedWindow) return { published: false, code: 'window_not_closed', receipt: null };
      const publishedRun = RhPulseResolutionRunRecordSchema.parse({ ...current, status: 'published' });
      this.runs.set(current.id, clone(publishedRun));
      this.receipts.set(receipt.id, clone(receipt));
      for (const event of events.slice(1)) await this.participation.appendAudit(event);
      return {
        published: true,
        idempotent: false,
        run: clone(publishedRun),
        window: clone(resolvedWindow),
        receipt: clone(receipt),
        calls: calls.map(clone)
      };
    });
  }

  async getReceipt(receiptIdOrSlug: string) {
    const receipt = [...this.receipts.values()].find((candidate) => (
      candidate.id === receiptIdOrSlug || candidate.public_slug === receiptIdOrSlug
    ));
    return receipt ? clone(receipt) : null;
  }

  async getReceiptForWindow(windowId: string) {
    const receipt = [...this.receipts.values()].find((candidate) => candidate.window_id === windowId);
    return receipt ? clone(receipt) : null;
  }

  async listReceipts(limit = 100) {
    return [...this.receipts.values()]
      .sort((left, right) => right.published_at.localeCompare(left.published_at))
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map(clone);
  }

  private exclusive<T>(action: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(action, action);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }
}

export class PostgresRhPulseResolutionStore implements RhPulseResolutionStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly failureHook?: (stage: RhPulseResolutionFailureStage) => void | Promise<void>;
  private readonly observe: (observation: RhPulseResolutionObservation) => void;

  constructor(source: PostgresPoolSource, options: {
    integrationTestFailureHook?: (stage: RhPulseResolutionFailureStage) => void | Promise<void>;
    observe?: (observation: RhPulseResolutionObservation) => void;
  } = {}) {
    const resolved = resolvePostgresPool(source);
    this.pool = resolved.pool;
    this.ownsPool = resolved.ownsPool;
    if (
      options.integrationTestFailureHook
      && !(process.env.NODE_ENV === 'test' && process.env.RH_PULSE_POSTGRES_GATE === '1')
    ) {
      throw new Error('RH Pulse resolution failure hooks are integration-test-only');
    }
    this.failureHook = options.integrationTestFailureHook;
    this.observe = options.observe ?? ((observation) => console.log(JSON.stringify(observation)));
  }

  async getWindow(windowId: string) {
    const result = await this.pool.query<WindowRow>('select * from rh_pulse_windows where id=$1', [windowId]);
    return result.rows[0] ? parseWindow(result.rows[0]) : null;
  }

  async appendAudit(event: RhPulseAuditEvent) {
    await insertAudit(this.pool, RhPulseAuditEventSchema.parse(event));
  }

  async createRun(
    windowId: string,
    inputManifestHash: string,
    build: (runNumber: number, window: RhPulseWindowRecord) => {
      run: RhPulseResolutionRunRecord;
      audit: RhPulseAuditEvent;
    }
  ) {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const windowResult = await client.query<WindowRow>(
        'select * from rh_pulse_windows where id=$1 for update',
        [windowId]
      );
      if (!windowResult.rows[0]) throw storeError('window_not_found');
      const window = parseWindow(windowResult.rows[0]);
      if (window.status !== 'closed') throw storeError('window_not_closed');
      const existing = await client.query<RunRow>(
        `select * from rh_pulse_resolution_runs
         where window_id=$1 and input_manifest_hash=$2
         limit 1`,
        [windowId, inputManifestHash]
      );
      if (existing.rows[0]) {
        await client.query('commit');
        const run = parseRun(existing.rows[0]);
        this.observe(observation('draft_create', 'idempotent', startedAt, { window_id: windowId, run_id: run.id }));
        return { run, idempotent: true };
      }
      const numberResult = await client.query<{ next_run: number | string }>(
        `select coalesce(max(run_number),0)+1 as next_run
         from rh_pulse_resolution_runs where window_id=$1`,
        [windowId]
      );
      const built = build(Number(numberResult.rows[0]?.next_run ?? 1), window);
      const run = RhPulseResolutionRunRecordSchema.parse(built.run);
      const audit = RhPulseAuditEventSchema.parse(built.audit);
      await client.query(
        `insert into rh_pulse_resolution_runs
          (id,window_id,run_number,status,methodology_version,input_manifest,input_manifest_hash,
           candidate_scores,proposed_outcome,confidence,evidence_summary,limitations,blocked_reason,
           outcome_explanation,created_at,calculated_at,approved_at,approved_by,cancelled_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19)`,
        runParams(run)
      );
      await this.failureHook?.('after_resolution_run_insertion');
      await insertAudit(client, audit);
      await this.failureHook?.('after_resolution_draft_audit_insertion');
      await client.query('commit');
      this.observe(observation('draft_create', 'committed', startedAt, { window_id: windowId, run_id: run.id }));
      return { run, idempotent: false };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      await this.appendRollbackAudit(windowId, {
        operation: 'draft_create',
        input_manifest_hash: inputManifestHash,
        error_code: postgresCode(error)
      });
      this.observe(observation('draft_create', 'rolled_back', startedAt, { window_id: windowId }, error));
      if (postgresCode(error) === '23505') {
        const existing = await this.pool.query<RunRow>(
          `select * from rh_pulse_resolution_runs
           where window_id=$1 and input_manifest_hash=$2 limit 1`,
          [windowId, inputManifestHash]
        );
        if (existing.rows[0]) return { run: parseRun(existing.rows[0]), idempotent: true };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getRun(runId: string) {
    const result = await this.pool.query<RunRow>('select * from rh_pulse_resolution_runs where id=$1', [runId]);
    return result.rows[0] ? parseRun(result.rows[0]) : null;
  }

  async listRuns(windowId: string) {
    const result = await this.pool.query<RunRow>(
      'select * from rh_pulse_resolution_runs where window_id=$1 order by run_number desc',
      [windowId]
    );
    return result.rows.map(parseRun);
  }

  async approveRun(
    runId: string,
    approvedAt: string,
    approvedBy: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ) {
    return this.transitionRun(runId, 'approve', async (client, current) => {
      const idempotent = current.status === 'approved' || current.status === 'published';
      if (!idempotent && current.status !== 'draft') throw storeError('invalid_transition');
      const next = idempotent ? current : RhPulseResolutionRunRecordSchema.parse({
        ...current,
        status: 'approved',
        approved_at: approvedAt,
        approved_by: approvedBy
      });
      if (!idempotent) {
        await client.query(
          `update rh_pulse_resolution_runs
           set status='approved', approved_at=$2, approved_by=$3 where id=$1`,
          [runId, approvedAt, approvedBy]
        );
      }
      await insertAudit(client, RhPulseAuditEventSchema.parse(buildAudit(next, idempotent)));
      return next;
    });
  }

  async cancelRun(
    runId: string,
    cancelledAt: string,
    buildAudit: (run: RhPulseResolutionRunRecord, idempotent: boolean) => RhPulseAuditEvent
  ) {
    return this.transitionRun(runId, 'cancel', async (client, current) => {
      const idempotent = current.status === 'cancelled';
      if (!idempotent && !['draft', 'approved', 'blocked'].includes(current.status)) {
        throw storeError('invalid_transition');
      }
      const next = idempotent ? current : RhPulseResolutionRunRecordSchema.parse({
        ...current,
        status: 'cancelled',
        cancelled_at: cancelledAt
      });
      if (!idempotent) {
        await client.query(
          `update rh_pulse_resolution_runs set status='cancelled', cancelled_at=$2 where id=$1`,
          [runId, cancelledAt]
        );
      }
      await insertAudit(client, RhPulseAuditEventSchema.parse(buildAudit(next, idempotent)));
      return next;
    });
  }

  async publish(input: {
    runId: string;
    build: (
      run: RhPulseResolutionRunRecord,
      window: RhPulseWindowRecord,
      calls: RhPulseCallRecord[],
      publishedAt: string
    ) => RhPulseResolutionPublicationArtifacts;
  }): Promise<RhPulseResolutionPublishResult> {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    let runWindowId: string | undefined;
    try {
      await client.query('begin');
      const runResult = await client.query<RunRow>(
        'select * from rh_pulse_resolution_runs where id=$1 for update',
        [input.runId]
      );
      if (!runResult.rows[0]) {
        await client.query('rollback');
        return { published: false, code: 'run_not_found', receipt: null };
      }
      const run = parseRun(runResult.rows[0]);
      runWindowId = run.window_id;
      await this.failureHook?.('after_resolution_run_lock');
      const priorReceipt = await client.query<ReceiptRow>(
        'select * from rh_pulse_rotation_receipts where window_id=$1 limit 1',
        [run.window_id]
      );
      if (priorReceipt.rows[0]) {
        await client.query('commit');
        const receipt = parseReceipt(priorReceipt.rows[0]);
        if (receipt.resolution_run_id !== run.id) {
          this.observe(observation('publication', 'conflict', startedAt, {
            window_id: run.window_id,
            run_id: run.id,
            receipt_id: receipt.id
          }));
          return { published: false, code: 'publication_conflict', receipt };
        }
        const window = await this.getWindow(run.window_id);
        const calls = await this.listCalls(run.window_id);
        this.observe(observation('publication', 'idempotent', startedAt, {
          window_id: run.window_id,
          run_id: run.id,
          receipt_id: receipt.id
        }));
        return {
          published: true,
          idempotent: true,
          run,
          window: window!,
          receipt,
          calls
        };
      }
      if (run.status !== 'approved') {
        await client.query('rollback');
        return { published: false, code: 'run_not_approved', receipt: null };
      }
      const windowResult = await client.query<WindowRow>(
        'select * from rh_pulse_windows where id=$1 for update',
        [run.window_id]
      );
      if (!windowResult.rows[0]) {
        await client.query('rollback');
        return { published: false, code: 'window_not_closed', receipt: null };
      }
      const window = parseWindow(windowResult.rows[0]);
      const clockResult = await client.query<{ published_at: Date | string }>(
        'select clock_timestamp() as published_at'
      );
      const publishedAt = iso(clockResult.rows[0]!.published_at);
      if (
        window.status !== 'closed'
        || Date.parse(publishedAt) < Date.parse(window.call_submission_closes_at)
      ) {
        await client.query('rollback');
        return { published: false, code: 'window_not_closed', receipt: null };
      }
      const callsResult = await client.query<CallRow>(
        `select * from rh_pulse_calls
         where window_id=$1 and verification_status='verified'
         order by public_call_number asc`,
        [window.id]
      );
      const calls = callsResult.rows.map(parseCall);
      const artifacts = input.build(run, window, calls, publishedAt);
      const receipt = RhPulseRotationReceiptRecordSchema.parse(artifacts.receipt);
      const events = artifacts.auditEvents.map((event) => RhPulseAuditEventSchema.parse(event));
      await client.query(
        `insert into rh_pulse_rotation_receipts
          (id,window_id,resolution_run_id,receipt_version,public_slug,winning_outcome,
           receipt_payload,receipt_hash,supersedes_receipt_id,published_at,created_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
        receiptParams(receipt)
      );
      await this.failureHook?.('after_rotation_receipt_insertion');
      await client.query(
        `update rh_pulse_resolution_runs set status='published' where id=$1`,
        [run.id]
      );
      await this.failureHook?.('after_resolution_run_update');
      await client.query(
        `update rh_pulse_windows
         set status='resolved', resolved_at=$2, updated_at=$2 where id=$1`,
        [window.id, publishedAt]
      );
      await this.failureHook?.('after_resolution_window_update');
      for (const event of events) await insertAudit(client, event);
      await this.failureHook?.('after_resolution_audit_insertion');
      await client.query('commit');
      const publishedRun = RhPulseResolutionRunRecordSchema.parse({ ...run, status: 'published' });
      const resolvedWindow = RhPulseWindowRecordSchema.parse({
        ...window,
        status: 'resolved',
        resolved_at: publishedAt,
        updated_at: publishedAt
      });
      this.observe(observation('publication', 'committed', startedAt, {
        window_id: window.id,
        run_id: run.id,
        receipt_id: receipt.id
      }));
      return {
        published: true,
        idempotent: false,
        run: publishedRun,
        window: resolvedWindow,
        receipt,
        calls
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      await this.appendRollbackAudit(runWindowId ?? null, {
        operation: 'publication',
        run_id: input.runId,
        error_code: postgresCode(error)
      });
      this.observe(observation('publication', 'rolled_back', startedAt, {
        ...(runWindowId ? { window_id: runWindowId } : {}),
        run_id: input.runId
      }, error));
      if (postgresCode(error) === '23505' && runWindowId) {
        const receipt = await this.getReceiptForWindow(runWindowId);
        return { published: false, code: 'publication_conflict', receipt };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getReceipt(receiptIdOrSlug: string) {
    const startedAt = performance.now();
    const result = await this.pool.query<ReceiptRow>(
      'select * from rh_pulse_rotation_receipts where id=$1 or public_slug=$1 limit 1',
      [receiptIdOrSlug]
    );
    this.observe(observation('public_read', 'completed', startedAt));
    return result.rows[0] ? parseReceipt(result.rows[0]) : null;
  }

  async getReceiptForWindow(windowId: string) {
    const startedAt = performance.now();
    const result = await this.pool.query<ReceiptRow>(
      'select * from rh_pulse_rotation_receipts where window_id=$1 limit 1',
      [windowId]
    );
    this.observe(observation('public_read', 'completed', startedAt, { window_id: windowId }));
    return result.rows[0] ? parseReceipt(result.rows[0]) : null;
  }

  async listReceipts(limit = 100) {
    const startedAt = performance.now();
    const result = await this.pool.query<ReceiptRow>(
      'select * from rh_pulse_rotation_receipts order by published_at desc limit $1',
      [Math.max(1, Math.min(limit, 100))]
    );
    this.observe(observation('public_read', 'completed', startedAt));
    return result.rows.map(parseReceipt);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }

  private async transitionRun(
    runId: string,
    operationName: 'approve' | 'cancel',
    transition: (client: pg.PoolClient, current: RhPulseResolutionRunRecord) => Promise<RhPulseResolutionRunRecord>
  ) {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query<RunRow>(
        'select * from rh_pulse_resolution_runs where id=$1 for update',
        [runId]
      );
      if (!result.rows[0]) {
        await client.query('rollback');
        return null;
      }
      const next = await transition(client, parseRun(result.rows[0]));
      await client.query('commit');
      this.observe(observation('run_transition', 'committed', startedAt, {
        run_id: runId,
        window_id: next.window_id
      }));
      return next;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.observe(observation('run_transition', 'rolled_back', startedAt, { run_id: runId }, error));
      throw error;
    } finally {
      client.release();
    }
  }

  private async listCalls(windowId: string) {
    const result = await this.pool.query<CallRow>(
      `select * from rh_pulse_calls
       where window_id=$1 and verification_status='verified'
       order by public_call_number asc`,
      [windowId]
    );
    return result.rows.map(parseCall);
  }

  private async appendRollbackAudit(windowId: string | null, payload: Record<string, unknown>) {
    try {
      await insertAudit(this.pool, RhPulseAuditEventSchema.parse({
        id: `rhp_audit_${randomUUID()}`,
        event_type: 'resolution_transaction_rolled_back',
        window_id: windowId,
        challenge_id: null,
        call_id: null,
        wallet_hash: null,
        request_origin_hash: null,
        payload,
        created_at: new Date().toISOString()
      }));
    } catch {
      // Operational observation still records rollback when the database itself
      // is unavailable; audit insertion must never mask the original failure.
    }
  }
}

type WindowRow = {
  id: string;
  sequence_number: number | string;
  opens_at: Date | string;
  closes_at: Date | string;
  call_submission_closes_at: Date | string;
  status: string;
  methodology_version: string;
  source_health: unknown;
  audit_metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  closed_at: Date | string | null;
  resolved_at: Date | string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
};

type RunRow = {
  id: string;
  window_id: string;
  run_number: number | string;
  status: string;
  methodology_version: string;
  input_manifest: unknown;
  input_manifest_hash: string;
  candidate_scores: unknown;
  proposed_outcome: string | null;
  confidence: string;
  evidence_summary: unknown;
  limitations: unknown;
  blocked_reason: string | null;
  outcome_explanation: string;
  created_at: Date | string;
  calculated_at: Date | string;
  approved_at: Date | string | null;
  approved_by: string | null;
  cancelled_at: Date | string | null;
};

type ReceiptRow = {
  id: string;
  window_id: string;
  resolution_run_id: string;
  receipt_version: string;
  public_slug: string;
  winning_outcome: string;
  receipt_payload: unknown;
  receipt_hash: string;
  supersedes_receipt_id: string | null;
  published_at: Date | string;
  created_at: Date | string;
};

type CallRow = {
  id: string;
  public_call_number: number | string;
  window_id: string;
  wallet_address: string;
  selected_outcome: string;
  signature: string;
  signed_message_hash: string;
  recorded_at: Date | string;
  verification_status: string;
  abuse_status: string;
  genesis_rank: number | string | null;
  public_slug: string;
  methodology_version: string;
  created_at: Date | string;
};

function parseWindow(row: WindowRow) {
  return RhPulseWindowRecordSchema.parse({
    ...row,
    sequence_number: Number(row.sequence_number),
    opens_at: iso(row.opens_at),
    closes_at: iso(row.closes_at),
    call_submission_closes_at: iso(row.call_submission_closes_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    closed_at: nullableIso(row.closed_at),
    resolved_at: nullableIso(row.resolved_at),
    cancelled_at: nullableIso(row.cancelled_at)
  });
}

function parseRun(row: RunRow) {
  return RhPulseResolutionRunRecordSchema.parse({
    ...row,
    run_number: Number(row.run_number),
    created_at: iso(row.created_at),
    calculated_at: iso(row.calculated_at),
    approved_at: nullableIso(row.approved_at),
    cancelled_at: nullableIso(row.cancelled_at)
  });
}

function parseReceipt(row: ReceiptRow) {
  return RhPulseRotationReceiptRecordSchema.parse({
    ...row,
    published_at: iso(row.published_at),
    created_at: iso(row.created_at)
  });
}

function parseCall(row: CallRow) {
  return RhPulseCallRecordSchema.parse({
    ...row,
    public_call_number: Number(row.public_call_number),
    genesis_rank: row.genesis_rank === null ? null : Number(row.genesis_rank),
    recorded_at: iso(row.recorded_at),
    created_at: iso(row.created_at)
  });
}

function runParams(run: RhPulseResolutionRunRecord) {
  return [
    run.id,
    run.window_id,
    run.run_number,
    run.status,
    run.methodology_version,
    JSON.stringify(run.input_manifest),
    run.input_manifest_hash,
    JSON.stringify(run.candidate_scores),
    run.proposed_outcome,
    run.confidence,
    JSON.stringify(run.evidence_summary),
    JSON.stringify(run.limitations),
    run.blocked_reason,
    run.outcome_explanation,
    run.created_at,
    run.calculated_at,
    run.approved_at,
    run.approved_by,
    run.cancelled_at
  ];
}

function receiptParams(receipt: RhPulseRotationReceiptRecord) {
  return [
    receipt.id,
    receipt.window_id,
    receipt.resolution_run_id,
    receipt.receipt_version,
    receipt.public_slug,
    receipt.winning_outcome,
    JSON.stringify(receipt.receipt_payload),
    receipt.receipt_hash,
    receipt.supersedes_receipt_id,
    receipt.published_at,
    receipt.created_at
  ];
}

async function insertAudit(client: Pick<pg.Pool | pg.PoolClient, 'query'>, event: RhPulseAuditEvent) {
  await client.query(
    `insert into rh_pulse_audit_events
      (id,event_type,window_id,challenge_id,call_id,wallet_hash,request_origin_hash,payload,created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      event.id,
      event.event_type,
      event.window_id,
      event.challenge_id,
      event.call_id,
      event.wallet_hash,
      event.request_origin_hash,
      JSON.stringify(event.payload),
      event.created_at
    ]
  );
}

function observation(
  operation: RhPulseResolutionObservation['operation'],
  outcome: RhPulseResolutionObservation['outcome'],
  startedAt: number,
  fields: Partial<Pick<RhPulseResolutionObservation, 'window_id' | 'run_id' | 'receipt_id'>> = {},
  error?: unknown
): RhPulseResolutionObservation {
  return {
    event: 'rh_pulse_resolution_operation',
    operation,
    outcome,
    duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
    ...fields,
    ...(error ? { error_code: postgresCode(error) || null } : {})
  };
}

function postgresCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}

function storeError(code: string) {
  return Object.assign(new Error(code), { code });
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nullableIso(value: Date | string | null) {
  return value === null ? null : iso(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
