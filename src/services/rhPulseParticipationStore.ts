import pg from 'pg';
import {
  RhPulseAuditEventSchema,
  RhPulseCallChallengeRecordSchema,
  RhPulseCallReceiptRecordSchema,
  RhPulseCallRecordSchema,
  RhPulseWindowRecordSchema,
  type RhPulseAuditEvent,
  type RhPulseCallChallengeRecord,
  type RhPulseCallReceiptRecord,
  type RhPulseCallRecord,
  type RhPulseWindowRecord
} from '../shared/rhPulseCalls';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export type RhPulseAcceptedArtifacts = {
  call: RhPulseCallRecord;
  receipt: RhPulseCallReceiptRecord;
  auditEvents: RhPulseAuditEvent[];
};

export type RhPulsePostgresFailureStage =
  | 'after_challenge_lock'
  | 'after_window_lock'
  | 'after_duplicate_check'
  | 'after_counter_allocation'
  | 'after_call_insertion'
  | 'after_receipt_insertion'
  | 'after_challenge_used_update'
  | 'after_audit_event_insertion';

export type RhPulsePostgresObservation = {
  event: 'rh_pulse_postgres_operation';
  operation: 'window_create' | 'window_transition' | 'challenge_create' | 'call_accept' | 'community_query';
  outcome: 'committed' | 'rejected' | 'rolled_back' | 'completed';
  duration_ms: number;
  error_code?: string | null;
  rejection_code?: RhPulseAcceptanceFailureCode;
  public_call_number?: number;
};

export type RhPulseAcceptanceFailureCode =
  | 'challenge_not_found'
  | 'challenge_expired'
  | 'challenge_used'
  | 'challenge_mismatch'
  | 'window_not_found'
  | 'window_not_open'
  | 'window_closed'
  | 'duplicate_call';

export type RhPulseAcceptResult =
  | {
      accepted: true;
      call: RhPulseCallRecord;
      receipt: RhPulseCallReceiptRecord;
      calls: RhPulseCallRecord[];
    }
  | {
      accepted: false;
      code: RhPulseAcceptanceFailureCode;
      existingCall: RhPulseCallRecord | null;
    };

export interface RhPulseParticipationStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  createWindow(
    makeWindow: (sequenceNumber: number) => RhPulseWindowRecord,
    makeAudit: (window: RhPulseWindowRecord) => RhPulseAuditEvent
  ): Promise<RhPulseWindowRecord>;
  transitionWindow(
    windowId: string,
    transition: (current: RhPulseWindowRecord) => { window: RhPulseWindowRecord; audit: RhPulseAuditEvent }
  ): Promise<RhPulseWindowRecord | null>;
  getWindow(windowId: string): Promise<RhPulseWindowRecord | null>;
  getCurrentWindow(): Promise<RhPulseWindowRecord | null>;
  listWindows(): Promise<RhPulseWindowRecord[]>;
  createChallenge(record: RhPulseCallChallengeRecord, audit: RhPulseAuditEvent): Promise<RhPulseCallChallengeRecord>;
  getChallenge(challengeId: string): Promise<RhPulseCallChallengeRecord | null>;
  appendAudit(event: RhPulseAuditEvent): Promise<void>;
  acceptCall(input: {
    challengeId: string;
    acceptedAt: string;
    expectedChallenge: Pick<RhPulseCallChallengeRecord, 'window_id' | 'wallet_address' | 'selected_outcome' | 'signed_message' | 'domain' | 'uri' | 'chain_id' | 'methodology_version'>;
    buildArtifacts: (
      publicCallNumber: number,
      challenge: RhPulseCallChallengeRecord,
      window: RhPulseWindowRecord,
      recordedAt: string
    ) => RhPulseAcceptedArtifacts;
  }): Promise<RhPulseAcceptResult>;
  getCall(callIdOrSlug: string): Promise<RhPulseCallRecord | null>;
  getReceipt(receiptIdOrSlug: string): Promise<RhPulseCallReceiptRecord | null>;
  getReceiptForCall(callId: string): Promise<RhPulseCallReceiptRecord | null>;
  listVerifiedCalls(windowId: string): Promise<RhPulseCallRecord[]>;
  listAuditEvents(): Promise<RhPulseAuditEvent[]>;
  close?(): Promise<void>;
}

type MemoryState = {
  windows: Map<string, RhPulseWindowRecord>;
  challenges: Map<string, RhPulseCallChallengeRecord>;
  calls: Map<string, RhPulseCallRecord>;
  receipts: Map<string, RhPulseCallReceiptRecord>;
  audit: RhPulseAuditEvent[];
  publicCallCounter: number;
  windowSequenceCounter: number;
};

export class InMemoryRhPulseParticipationStore implements RhPulseParticipationStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private state: MemoryState;
  private queue: Promise<void> = Promise.resolve();
  private readonly beforeCommit?: (artifacts: RhPulseAcceptedArtifacts) => void | Promise<void>;

  constructor(options: {
    initialPublicCallNumber?: number;
    initialWindowSequence?: number;
    beforeCommit?: (artifacts: RhPulseAcceptedArtifacts) => void | Promise<void>;
  } = {}) {
    this.state = {
      windows: new Map(),
      challenges: new Map(),
      calls: new Map(),
      receipts: new Map(),
      audit: [],
      publicCallCounter: options.initialPublicCallNumber ?? 0,
      windowSequenceCounter: options.initialWindowSequence ?? 0
    };
    this.beforeCommit = options.beforeCommit;
  }

  async createWindow(
    makeWindow: (sequenceNumber: number) => RhPulseWindowRecord,
    makeAudit: (window: RhPulseWindowRecord) => RhPulseAuditEvent
  ) {
    return this.exclusive(async () => {
      const next = this.state.windowSequenceCounter + 1;
      const window = RhPulseWindowRecordSchema.parse(makeWindow(next));
      if (this.state.windows.has(window.id)) throw storeConflict('window_conflict');
      const audit = RhPulseAuditEventSchema.parse(makeAudit(window));
      this.state.windowSequenceCounter = next;
      this.state.windows.set(window.id, clone(window));
      this.state.audit.push(clone(audit));
      return clone(window);
    });
  }

  async transitionWindow(
    windowId: string,
    transition: (current: RhPulseWindowRecord) => { window: RhPulseWindowRecord; audit: RhPulseAuditEvent }
  ) {
    return this.exclusive(async () => {
      const current = this.state.windows.get(windowId);
      if (!current) return null;
      const changed = transition(clone(current));
      const window = RhPulseWindowRecordSchema.parse(changed.window);
      const audit = RhPulseAuditEventSchema.parse(changed.audit);
      if (window.status === 'open') {
        const anotherOpen = [...this.state.windows.values()].find((candidate) => (
          candidate.id !== window.id && candidate.status === 'open'
        ));
        if (anotherOpen) throw storeConflict('open_window_exists');
      }
      this.state.windows.set(window.id, clone(window));
      this.state.audit.push(clone(audit));
      return clone(window);
    });
  }

  async getWindow(windowId: string) {
    const window = this.state.windows.get(windowId);
    return window ? clone(window) : null;
  }

  async getCurrentWindow() {
    const windows = [...this.state.windows.values()].sort(windowOrder);
    return windows[0] ? clone(windows[0]) : null;
  }

  async listWindows() {
    return [...this.state.windows.values()].sort(windowOrder).map(clone);
  }

  async createChallenge(record: RhPulseCallChallengeRecord, audit: RhPulseAuditEvent) {
    return this.exclusive(async () => {
      const challenge = RhPulseCallChallengeRecordSchema.parse(record);
      if (this.state.challenges.has(challenge.id)) throw storeConflict('challenge_conflict');
      this.state.challenges.set(challenge.id, clone(challenge));
      this.state.audit.push(clone(RhPulseAuditEventSchema.parse(audit)));
      return clone(challenge);
    });
  }

  async getChallenge(challengeId: string) {
    const challenge = this.state.challenges.get(challengeId);
    return challenge ? clone(challenge) : null;
  }

  async appendAudit(event: RhPulseAuditEvent) {
    await this.exclusive(async () => {
      this.state.audit.push(clone(RhPulseAuditEventSchema.parse(event)));
    });
  }

  async acceptCall(input: {
    challengeId: string;
    acceptedAt: string;
    expectedChallenge: Pick<RhPulseCallChallengeRecord, 'window_id' | 'wallet_address' | 'selected_outcome' | 'signed_message' | 'domain' | 'uri' | 'chain_id' | 'methodology_version'>;
    buildArtifacts: (
      publicCallNumber: number,
      challenge: RhPulseCallChallengeRecord,
      window: RhPulseWindowRecord,
      recordedAt: string
    ) => RhPulseAcceptedArtifacts;
  }): Promise<RhPulseAcceptResult> {
    return this.exclusive(async () => {
      const challenge = this.state.challenges.get(input.challengeId);
      if (!challenge) return rejected('challenge_not_found');
      if (challenge.used_at) return rejected('challenge_used');
      if (Date.parse(challenge.expires_at) <= Date.parse(input.acceptedAt)) return rejected('challenge_expired');
      if (!challengeAuthorityMatches(challenge, input.expectedChallenge)) return rejected('challenge_mismatch');
      const window = this.state.windows.get(challenge.window_id);
      if (!window) return rejected('window_not_found');
      if (window.status !== 'open') return rejected('window_not_open');
      const acceptedAt = Date.parse(input.acceptedAt);
      if (acceptedAt < Date.parse(window.opens_at) || acceptedAt >= Date.parse(window.call_submission_closes_at)) {
        return rejected('window_closed');
      }
      const duplicate = [...this.state.calls.values()].find((call) => (
        call.window_id === window.id && call.wallet_address === challenge.wallet_address
      ));
      if (duplicate) return { accepted: false, code: 'duplicate_call', existingCall: clone(duplicate) };

      const publicCallNumber = this.state.publicCallCounter + 1;
      const built = input.buildArtifacts(publicCallNumber, clone(challenge), clone(window), input.acceptedAt);
      const artifacts = {
        call: RhPulseCallRecordSchema.parse(built.call),
        receipt: RhPulseCallReceiptRecordSchema.parse(built.receipt),
        auditEvents: built.auditEvents.map((event) => RhPulseAuditEventSchema.parse(event))
      };
      if (artifacts.receipt.call_id !== artifacts.call.id) throw new Error('receipt_call_mismatch');
      await this.beforeCommit?.(clone(artifacts));

      this.state.publicCallCounter = publicCallNumber;
      this.state.calls.set(artifacts.call.id, clone(artifacts.call));
      this.state.receipts.set(artifacts.receipt.id, clone(artifacts.receipt));
      this.state.challenges.set(challenge.id, { ...clone(challenge), used_at: input.acceptedAt });
      this.state.audit.push(...artifacts.auditEvents.map(clone));
      return {
        accepted: true,
        call: clone(artifacts.call),
        receipt: clone(artifacts.receipt),
        calls: [...this.state.calls.values()]
          .filter((call) => call.window_id === window.id && call.verification_status === 'verified')
          .map(clone)
      };
    });
  }

  async getCall(callIdOrSlug: string) {
    const call = this.state.calls.get(callIdOrSlug)
      ?? [...this.state.calls.values()].find((candidate) => candidate.public_slug === callIdOrSlug);
    return call ? clone(call) : null;
  }

  async getReceiptForCall(callId: string) {
    const receipt = [...this.state.receipts.values()]
      .filter((candidate) => candidate.call_id === callId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
    return receipt ? clone(receipt) : null;
  }

  async getReceipt(receiptIdOrSlug: string) {
    const receipt = this.state.receipts.get(receiptIdOrSlug)
      ?? [...this.state.receipts.values()].find((candidate) => candidate.public_slug === receiptIdOrSlug);
    return receipt ? clone(receipt) : null;
  }

  async listVerifiedCalls(windowId: string) {
    return [...this.state.calls.values()]
      .filter((call) => call.window_id === windowId && call.verification_status === 'verified')
      .sort((left, right) => left.public_call_number - right.public_call_number)
      .map(clone);
  }

  async listAuditEvents() {
    return this.state.audit.map(clone);
  }

  private exclusive<T>(action: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(action, action);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }
}

export class PostgresRhPulseParticipationStore implements RhPulseParticipationStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly integrationTestFailureHook?: (stage: RhPulsePostgresFailureStage) => void | Promise<void>;
  private readonly observe: (observation: RhPulsePostgresObservation) => void;

  constructor(source: PostgresPoolSource, options: {
    integrationTestFailureHook?: (stage: RhPulsePostgresFailureStage) => void | Promise<void>;
    observe?: (observation: RhPulsePostgresObservation) => void;
  } = {}) {
    const resolved = resolvePostgresPool(source);
    this.pool = resolved.pool;
    this.ownsPool = resolved.ownsPool;
    if (
      options.integrationTestFailureHook
      && !(process.env.NODE_ENV === 'test' && process.env.RH_PULSE_POSTGRES_GATE === '1')
    ) {
      throw new Error('RH Pulse Postgres failure hooks are integration-test-only');
    }
    this.integrationTestFailureHook = options.integrationTestFailureHook;
    this.observe = options.observe ?? ((observation) => console.log(JSON.stringify(observation)));
  }

  async createWindow(
    makeWindow: (sequenceNumber: number) => RhPulseWindowRecord,
    makeAudit: (window: RhPulseWindowRecord) => RhPulseAuditEvent
  ) {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const sequence = await nextCounter(client, 'rh_pulse_window_sequence');
      const window = RhPulseWindowRecordSchema.parse(makeWindow(sequence));
      const audit = RhPulseAuditEventSchema.parse(makeAudit(window));
      await client.query(
        `insert into rh_pulse_windows
          (id, sequence_number, opens_at, closes_at, call_submission_closes_at, status,
           methodology_version, source_health, audit_metadata, created_at, updated_at,
           closed_at, resolved_at, cancelled_at, cancellation_reason)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15)`,
        windowParams(window)
      );
      await insertAudit(client, audit);
      await client.query('commit');
      this.observe(operationObservation('window_create', 'committed', startedAt));
      return window;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.observe(operationObservation('window_create', 'rolled_back', startedAt, error));
      if (postgresCode(error) === '23505') throw storeConflict('window_conflict');
      throw error;
    } finally {
      client.release();
    }
  }

  async transitionWindow(
    windowId: string,
    transition: (current: RhPulseWindowRecord) => { window: RhPulseWindowRecord; audit: RhPulseAuditEvent }
  ) {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const found = await client.query<WindowRow>('select * from rh_pulse_windows where id=$1 for update', [windowId]);
      if (!found.rows[0]) {
        await client.query('rollback');
        return null;
      }
      const changed = transition(parseWindowRow(found.rows[0]));
      const window = RhPulseWindowRecordSchema.parse(changed.window);
      const audit = RhPulseAuditEventSchema.parse(changed.audit);
      await client.query(
        `update rh_pulse_windows set
          opens_at=$2, closes_at=$3, call_submission_closes_at=$4, status=$5,
          methodology_version=$6, source_health=$7::jsonb, audit_metadata=$8::jsonb,
          created_at=$9, updated_at=$10, closed_at=$11, resolved_at=$12,
          cancelled_at=$13, cancellation_reason=$14
         where id=$1`,
        [
          window.id, window.opens_at, window.closes_at, window.call_submission_closes_at,
          window.status, window.methodology_version, JSON.stringify(window.source_health),
          JSON.stringify(window.audit_metadata), window.created_at, window.updated_at,
          window.closed_at, window.resolved_at, window.cancelled_at, window.cancellation_reason
        ]
      );
      await insertAudit(client, audit);
      await client.query('commit');
      this.observe(operationObservation('window_transition', 'committed', startedAt));
      return window;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.observe(operationObservation('window_transition', 'rolled_back', startedAt, error));
      if (postgresCode(error) === '23505') throw storeConflict('open_window_exists');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWindow(windowId: string) {
    const result = await this.pool.query<WindowRow>('select * from rh_pulse_windows where id=$1', [windowId]);
    return result.rows[0] ? parseWindowRow(result.rows[0]) : null;
  }

  async getCurrentWindow() {
    const result = await this.pool.query<WindowRow>(
      `select * from rh_pulse_windows
       order by case status when 'open' then 0 when 'not_open' then 1 else 2 end,
                sequence_number desc
       limit 1`
    );
    return result.rows[0] ? parseWindowRow(result.rows[0]) : null;
  }

  async listWindows() {
    const result = await this.pool.query<WindowRow>(
      `select * from rh_pulse_windows
       order by case status when 'open' then 0 when 'not_open' then 1 else 2 end,
                sequence_number desc`
    );
    return result.rows.map(parseWindowRow);
  }

  async createChallenge(record: RhPulseCallChallengeRecord, audit: RhPulseAuditEvent) {
    const challenge = RhPulseCallChallengeRecordSchema.parse(record);
    const event = RhPulseAuditEventSchema.parse(audit);
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into rh_pulse_call_challenges
          (id, window_id, wallet_address, selected_outcome, nonce_hash, signed_message,
           domain, uri, chain_id, methodology_version, issued_at, expires_at, used_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          challenge.id, challenge.window_id, challenge.wallet_address, challenge.selected_outcome,
          challenge.nonce_hash, challenge.signed_message, challenge.domain, challenge.uri,
          challenge.chain_id, challenge.methodology_version, challenge.issued_at,
          challenge.expires_at, challenge.used_at, challenge.created_at
        ]
      );
      await insertAudit(client, event);
      await client.query('commit');
      this.observe(operationObservation('challenge_create', 'committed', startedAt));
      return challenge;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.observe(operationObservation('challenge_create', 'rolled_back', startedAt, error));
      throw error;
    } finally {
      client.release();
    }
  }

  async getChallenge(challengeId: string) {
    const result = await this.pool.query<ChallengeRow>('select * from rh_pulse_call_challenges where id=$1', [challengeId]);
    return result.rows[0] ? parseChallengeRow(result.rows[0]) : null;
  }

  async appendAudit(event: RhPulseAuditEvent) {
    await insertAudit(this.pool, RhPulseAuditEventSchema.parse(event));
  }

  async acceptCall(input: {
    challengeId: string;
    acceptedAt: string;
    expectedChallenge: Pick<RhPulseCallChallengeRecord, 'window_id' | 'wallet_address' | 'selected_outcome' | 'signed_message' | 'domain' | 'uri' | 'chain_id' | 'methodology_version'>;
    buildArtifacts: (
      publicCallNumber: number,
      challenge: RhPulseCallChallengeRecord,
      window: RhPulseWindowRecord,
      recordedAt: string
    ) => RhPulseAcceptedArtifacts;
  }): Promise<RhPulseAcceptResult> {
    const startedAt = performance.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const reject = async (
        code: Exclude<RhPulseAcceptanceFailureCode, 'duplicate_call'>
      ) => {
        const result = await rollbackRejected(client, code);
        this.observe({
          ...operationObservation('call_accept', 'rejected', startedAt),
          rejection_code: code
        });
        return result;
      };
      const challengeResult = await client.query<ChallengeRow>(
        'select * from rh_pulse_call_challenges where id=$1 for update',
        [input.challengeId]
      );
      if (!challengeResult.rows[0]) return await reject('challenge_not_found');
      const challenge = parseChallengeRow(challengeResult.rows[0]);
      await this.runIntegrationFailureHook('after_challenge_lock');
      const databaseAcceptedAt = await databaseClock(client);
      if (challenge.used_at) return await reject('challenge_used');
      if (Date.parse(challenge.expires_at) <= Date.parse(databaseAcceptedAt)) {
        return await reject('challenge_expired');
      }
      if (!challengeAuthorityMatches(challenge, input.expectedChallenge)) {
        return await reject('challenge_mismatch');
      }

      const windowResult = await client.query<WindowRow>('select * from rh_pulse_windows where id=$1 for update', [challenge.window_id]);
      if (!windowResult.rows[0]) return await reject('window_not_found');
      const window = parseWindowRow(windowResult.rows[0]);
      await this.runIntegrationFailureHook('after_window_lock');
      if (window.status !== 'open') return await reject('window_not_open');
      const acceptedAt = Date.parse(databaseAcceptedAt);
      if (acceptedAt < Date.parse(window.opens_at) || acceptedAt >= Date.parse(window.call_submission_closes_at)) {
        return await reject('window_closed');
      }

      const duplicateResult = await client.query<CallRow>(
        'select * from rh_pulse_calls where window_id=$1 and wallet_address=$2 for update',
        [window.id, challenge.wallet_address]
      );
      if (duplicateResult.rows[0]) {
        await client.query('rollback');
        this.observe({
          ...operationObservation('call_accept', 'rejected', startedAt),
          rejection_code: 'duplicate_call'
        });
        return {
          accepted: false,
          code: 'duplicate_call',
          existingCall: parseCallRow(duplicateResult.rows[0])
        };
      }
      await this.runIntegrationFailureHook('after_duplicate_check');

      const publicCallNumber = await nextCounter(client, 'rh_pulse_public_call_number');
      await this.runIntegrationFailureHook('after_counter_allocation');
      const built = input.buildArtifacts(publicCallNumber, challenge, window, databaseAcceptedAt);
      const call = RhPulseCallRecordSchema.parse(built.call);
      const receipt = RhPulseCallReceiptRecordSchema.parse(built.receipt);
      const events = built.auditEvents.map((event) => RhPulseAuditEventSchema.parse(event));
      await client.query(
        `insert into rh_pulse_calls
          (id, public_call_number, window_id, wallet_address, selected_outcome, signature,
           signed_message_hash, recorded_at, verification_status, abuse_status, genesis_rank,
           public_slug, methodology_version, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        callParams(call)
      );
      await this.runIntegrationFailureHook('after_call_insertion');
      await client.query(
        `insert into rh_pulse_call_receipts
          (id, call_id, receipt_version, public_slug, receipt_payload, receipt_hash,
           supersedes_receipt_id, created_at)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
        [
          receipt.id, receipt.call_id, receipt.receipt_version, receipt.public_slug,
          JSON.stringify(receipt.receipt_payload), receipt.receipt_hash,
          receipt.supersedes_receipt_id, receipt.created_at
        ]
      );
      await this.runIntegrationFailureHook('after_receipt_insertion');
      await client.query('update rh_pulse_call_challenges set used_at=$2 where id=$1', [challenge.id, databaseAcceptedAt]);
      await this.runIntegrationFailureHook('after_challenge_used_update');
      for (const event of events) await insertAudit(client, event);
      await this.runIntegrationFailureHook('after_audit_event_insertion');
      const communityStartedAt = performance.now();
      const callsResult = await client.query<CallRow>(
        `select * from rh_pulse_calls
         where window_id=$1 and verification_status='verified'
         order by public_call_number asc`,
        [window.id]
      );
      this.observe(operationObservation('community_query', 'completed', communityStartedAt));
      await client.query('commit');
      this.observe({
        ...operationObservation('call_accept', 'committed', startedAt),
        public_call_number: publicCallNumber
      });
      return {
        accepted: true,
        call,
        receipt,
        calls: callsResult.rows.map(parseCallRow)
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.observe(operationObservation('call_accept', 'rolled_back', startedAt, error));
      if (postgresCode(error) === '23505') {
        const challenge = await this.getChallenge(input.challengeId);
        if (challenge) {
          const existing = await this.pool.query<CallRow>(
            'select * from rh_pulse_calls where window_id=$1 and wallet_address=$2 limit 1',
            [challenge.window_id, challenge.wallet_address]
          );
          if (existing.rows[0]) {
            return { accepted: false, code: 'duplicate_call', existingCall: parseCallRow(existing.rows[0]) };
          }
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getCall(callIdOrSlug: string) {
    const result = await this.pool.query<CallRow>(
      'select * from rh_pulse_calls where id=$1 or public_slug=$1 limit 1',
      [callIdOrSlug]
    );
    return result.rows[0] ? parseCallRow(result.rows[0]) : null;
  }

  async getReceipt(receiptIdOrSlug: string) {
    const result = await this.pool.query<ReceiptRow>(
      'select * from rh_pulse_call_receipts where id=$1 or public_slug=$1 limit 1',
      [receiptIdOrSlug]
    );
    return result.rows[0] ? parseReceiptRow(result.rows[0]) : null;
  }

  async getReceiptForCall(callId: string) {
    const result = await this.pool.query<ReceiptRow>(
      'select * from rh_pulse_call_receipts where call_id=$1 order by created_at desc limit 1',
      [callId]
    );
    return result.rows[0] ? parseReceiptRow(result.rows[0]) : null;
  }

  async listVerifiedCalls(windowId: string) {
    const startedAt = performance.now();
    const result = await this.pool.query<CallRow>(
      `select * from rh_pulse_calls
       where window_id=$1 and verification_status='verified'
       order by public_call_number asc`,
      [windowId]
    );
    this.observe(operationObservation('community_query', 'completed', startedAt));
    return result.rows.map(parseCallRow);
  }

  async listAuditEvents() {
    const result = await this.pool.query<AuditRow>('select * from rh_pulse_audit_events order by created_at asc, id asc');
    return result.rows.map(parseAuditRow);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }

  private async runIntegrationFailureHook(stage: RhPulsePostgresFailureStage) {
    await this.integrationTestFailureHook?.(stage);
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

type ChallengeRow = {
  id: string;
  window_id: string;
  wallet_address: string;
  selected_outcome: string;
  nonce_hash: string;
  signed_message: string;
  domain: string;
  uri: string;
  chain_id: number | string;
  methodology_version: string;
  issued_at: Date | string;
  expires_at: Date | string;
  used_at: Date | string | null;
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

type ReceiptRow = {
  id: string;
  call_id: string;
  receipt_version: string;
  public_slug: string;
  receipt_payload: unknown;
  receipt_hash: string;
  supersedes_receipt_id: string | null;
  created_at: Date | string;
};

type AuditRow = {
  id: string;
  event_type: string;
  window_id: string | null;
  challenge_id: string | null;
  call_id: string | null;
  wallet_hash: string | null;
  request_origin_hash: string | null;
  payload: unknown;
  created_at: Date | string;
};

function parseWindowRow(row: WindowRow) {
  return RhPulseWindowRecordSchema.parse({
    ...row,
    sequence_number: Number(row.sequence_number),
    opens_at: iso(row.opens_at),
    closes_at: iso(row.closes_at),
    call_submission_closes_at: iso(row.call_submission_closes_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    closed_at: isoNullable(row.closed_at),
    resolved_at: isoNullable(row.resolved_at),
    cancelled_at: isoNullable(row.cancelled_at)
  });
}

function parseChallengeRow(row: ChallengeRow) {
  return RhPulseCallChallengeRecordSchema.parse({
    ...row,
    chain_id: Number(row.chain_id),
    issued_at: iso(row.issued_at),
    expires_at: iso(row.expires_at),
    used_at: isoNullable(row.used_at),
    created_at: iso(row.created_at)
  });
}

function parseCallRow(row: CallRow) {
  return RhPulseCallRecordSchema.parse({
    ...row,
    public_call_number: Number(row.public_call_number),
    genesis_rank: row.genesis_rank === null ? null : Number(row.genesis_rank),
    recorded_at: iso(row.recorded_at),
    created_at: iso(row.created_at)
  });
}

function parseReceiptRow(row: ReceiptRow) {
  return RhPulseCallReceiptRecordSchema.parse({
    ...row,
    created_at: iso(row.created_at)
  });
}

function parseAuditRow(row: AuditRow) {
  return RhPulseAuditEventSchema.parse({
    ...row,
    created_at: iso(row.created_at)
  });
}

function windowParams(window: RhPulseWindowRecord) {
  return [
    window.id, window.sequence_number, window.opens_at, window.closes_at,
    window.call_submission_closes_at, window.status, window.methodology_version,
    JSON.stringify(window.source_health), JSON.stringify(window.audit_metadata),
    window.created_at, window.updated_at, window.closed_at, window.resolved_at,
    window.cancelled_at, window.cancellation_reason
  ];
}

function callParams(call: RhPulseCallRecord) {
  return [
    call.id, call.public_call_number, call.window_id, call.wallet_address,
    call.selected_outcome, call.signature, call.signed_message_hash,
    call.recorded_at, call.verification_status, call.abuse_status,
    call.genesis_rank, call.public_slug, call.methodology_version, call.created_at
  ];
}

async function nextCounter(client: pg.PoolClient, counterName: string) {
  await client.query(
    `insert into rh_pulse_counters (counter_name, current_value, updated_at)
     values ($1, 0, now())
     on conflict (counter_name) do nothing`,
    [counterName]
  );
  const result = await client.query<{ current_value: number | string }>(
    'select current_value from rh_pulse_counters where counter_name=$1 for update',
    [counterName]
  );
  const next = Number(result.rows[0]?.current_value ?? 0) + 1;
  await client.query(
    'update rh_pulse_counters set current_value=$2, updated_at=now() where counter_name=$1',
    [counterName, next]
  );
  return next;
}

async function databaseClock(client: pg.PoolClient) {
  const result = await client.query<{ accepted_at: Date | string }>(
    'select clock_timestamp() as accepted_at'
  );
  const value = result.rows[0]?.accepted_at;
  if (!value) throw new Error('rh_pulse_database_clock_unavailable');
  return iso(value);
}

async function insertAudit(client: Pick<pg.Pool | pg.PoolClient, 'query'>, event: RhPulseAuditEvent) {
  await client.query(
    `insert into rh_pulse_audit_events
      (id, event_type, window_id, challenge_id, call_id, wallet_hash,
       request_origin_hash, payload, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      event.id, event.event_type, event.window_id, event.challenge_id, event.call_id,
      event.wallet_hash, event.request_origin_hash, JSON.stringify(event.payload),
      event.created_at
    ]
  );
}

async function rollbackRejected(
  client: pg.PoolClient,
  code: Exclude<RhPulseAcceptanceFailureCode, 'duplicate_call'>
): Promise<RhPulseAcceptResult> {
  await client.query('rollback');
  return { accepted: false, code, existingCall: null };
}

function rejected(code: Exclude<RhPulseAcceptanceFailureCode, 'duplicate_call'>): RhPulseAcceptResult {
  return { accepted: false, code, existingCall: null };
}

function challengeAuthorityMatches(
  challenge: RhPulseCallChallengeRecord,
  expected: Pick<RhPulseCallChallengeRecord, 'window_id' | 'wallet_address' | 'selected_outcome' | 'signed_message' | 'domain' | 'uri' | 'chain_id' | 'methodology_version'>
) {
  return challenge.window_id === expected.window_id
    && challenge.wallet_address === expected.wallet_address
    && challenge.selected_outcome === expected.selected_outcome
    && challenge.signed_message === expected.signed_message
    && challenge.domain === expected.domain
    && challenge.uri === expected.uri
    && challenge.chain_id === expected.chain_id
    && challenge.methodology_version === expected.methodology_version;
}

function windowOrder(left: RhPulseWindowRecord, right: RhPulseWindowRecord) {
  const priority = (status: RhPulseWindowRecord['status']) => status === 'open' ? 0 : status === 'not_open' ? 1 : 2;
  return priority(left.status) - priority(right.status) || right.sequence_number - left.sequence_number;
}

function storeConflict(code: 'window_conflict' | 'open_window_exists' | 'challenge_conflict') {
  return Object.assign(new Error(code), { code });
}

function postgresCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}

function operationObservation(
  operation: RhPulsePostgresObservation['operation'],
  outcome: RhPulsePostgresObservation['outcome'],
  startedAt: number,
  error?: unknown
): RhPulsePostgresObservation {
  return {
    event: 'rh_pulse_postgres_operation',
    operation,
    outcome,
    duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
    ...(error ? { error_code: postgresCode(error) || null } : {})
  };
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoNullable(value: Date | string | null) {
  return value === null ? null : iso(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
