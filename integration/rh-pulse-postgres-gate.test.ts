import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  type RhPulseCallOutcome,
  type RhPulseCallReceiptPayload
} from '../src/shared/rhPulseCalls';
import {
  canonicalJson,
  receiptHash,
  RhPulseParticipationError,
  RhPulseParticipationService
} from '../src/services/rhPulseParticipationService';
import {
  InMemoryRhPulseParticipationStore,
  PostgresRhPulseParticipationStore,
  type RhPulseParticipationStore,
  type RhPulsePostgresFailureStage,
  type RhPulsePostgresObservation
} from '../src/services/rhPulseParticipationStore';
import { RhPulseService } from '../src/services/rhPulseService';

const GATE_URL = 'postgresql://postgres@127.0.0.1:55463/rh_pulse_gate';
const ADMIN_URL = 'postgresql://postgres@127.0.0.1:55463/postgres';
const GATE_ENABLED = process.env.RH_PULSE_POSTGRES_GATE === '1';
const describeGate = GATE_ENABLED ? describe.sequential : describe.skip;
const repositoryRoot = process.cwd();
const outcomes = [
  'agents_to_rwas',
  'memes_to_agents',
  'memes_to_rwas',
  'no_qualified_rotation'
] as const;
const failureStages: RhPulsePostgresFailureStage[] = [
  'after_challenge_lock',
  'after_window_lock',
  'after_duplicate_check',
  'after_counter_allocation',
  'after_call_insertion',
  'after_receipt_insertion',
  'after_challenge_used_update',
  'after_audit_event_insertion'
];

type Signed = {
  account: PrivateKeyAccount;
  challenge: Awaited<ReturnType<RhPulseParticipationService['createChallenge']>>;
  signature: `0x${string}`;
};

type GateReport = {
  postgres_version?: string;
  migration_007_ms?: number;
  migrations_tracked?: number;
  unique_batches: Array<{ attempted: number; accepted: number; range: string }>;
  duplicate_races: Array<{ clients: number; accepted: number; rejected: number }>;
  forced_rollbacks: number;
  multi_process?: { processes: number; attempted: number; accepted: number; stale_read_cache_ms: number };
  query_timings_ms: Record<string, number>;
  database_recovery?: string;
};

const report: GateReport = {
  unique_batches: [],
  duplicate_races: [],
  forced_rollbacks: 0,
  query_timings_ms: {}
};

let pool: pg.Pool;
let readModel: Awaited<ReturnType<RhPulseService['getReadModel']>>;

if (GATE_ENABLED && process.env.RH_PULSE_TEST_DATABASE_URL !== GATE_URL) {
  throw new Error(`RH Pulse Postgres gate requires exactly ${GATE_URL}`);
}

describeGate('RH Pulse Phase 2.5 real PostgreSQL production gate', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: GATE_URL, max: 60, connectionTimeoutMillis: 2_000 });
    pool.on('error', () => {
      // Database-loss recovery is an explicit gate drill. Individual operations
      // still reject; idle-client termination must not become an unhandled error.
    });
    const version = await pool.query<{ version: string }>('select version()');
    report.postgres_version = version.rows[0]?.version;
    const ledger = await pool.query<{ count: string }>('select count(*) from infopunks_schema_migrations');
    report.migrations_tracked = Number(ledger.rows[0]?.count ?? 0);
    expect(report.migrations_tracked).toBe(7);
    readModel = await new RhPulseService({
      crossLayer: async () => ({ entries: [] }),
      cacheTtlMs: 0
    }).getReadModel();
    await pool.query(
      `insert into rh_chain_market_snapshots
        (snapshot_id, token_address, captured_at, payload)
       values ('rhp_gate_existing_snapshot', '0x1111111111111111111111111111111111111111', now(), '{"gate":"preserve"}'::jsonb)
       on conflict (snapshot_id) do nothing`
    );
  }, 30_000);

  beforeEach(async () => {
    await pool.query(
      `update rh_pulse_windows
       set status='closed', closed_at=coalesce(closed_at,clock_timestamp()), updated_at=clock_timestamp()
       where status='open'`
    );
  });

  afterAll(async () => {
    process.stdout.write(`${JSON.stringify({ event: 'rh_pulse_postgres_gate_summary', ...report })}\n`);
    await pool?.end();
  });

  it('applies the complete migration sequence, preserves existing RH data, and exercises empty down/reapply', async () => {
    const trackedRerun = spawnSync(
      process.execPath,
      ['scripts/rh-pulse-postgres-migrate.mjs'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          RH_PULSE_TEST_DATABASE_URL: GATE_URL
        }
      }
    );
    expect(trackedRerun.status).toBe(0);
    const tracked = JSON.parse(trackedRerun.stdout) as {
      migrations: Array<{ state: string }>;
    };
    expect(tracked.migrations).toHaveLength(7);
    expect(tracked.migrations.every(({ state }) => state === 'already_applied')).toBe(true);

    await withTemporaryDatabase('rh_pulse_gate_migration', async (migrationPool) => {
      await applyMigrationFiles(migrationPool, 6);
      await migrationPool.query(
        `create table infopunks_schema_migrations (
          migration_id text primary key
        )`
      );
      await migrationPool.query(
        "insert into infopunks_schema_migrations (migration_id) values ('20260723_007')"
      );
      await migrationPool.query(
        `insert into rh_chain_market_snapshots
          (snapshot_id, token_address, captured_at, payload)
         values ('existing_before_007', '0x2222222222222222222222222222222222222222', now(), '{"preserve":true}'::jsonb)`
      );
      const migration007 = await migrationSql('20260723_007_rh_pulse_signed_calls.up.sql');
      const startedAt = performance.now();
      await migrationPool.query(migration007);
      report.migration_007_ms = Math.round(performance.now() - startedAt);

      const tables = await migrationPool.query<{ tablename: string }>(
        `select tablename from pg_tables
         where schemaname='public' and tablename like 'rh_pulse_%'
         order by tablename`
      );
      expect(tables.rows.map(({ tablename }) => tablename)).toEqual([
        'rh_pulse_audit_events',
        'rh_pulse_call_challenges',
        'rh_pulse_call_receipts',
        'rh_pulse_calls',
        'rh_pulse_counters',
        'rh_pulse_windows'
      ]);
      const objects = await migrationPool.query<{ kind: string; name: string }>(
        `select 'index' as kind, indexname as name from pg_indexes
           where schemaname='public' and indexname like 'rh_pulse_%'
         union all
         select 'constraint', conname from pg_constraint
           where connamespace='public'::regnamespace and conname like 'rh_pulse_%'
         order by kind, name`
      );
      expect(objects.rows.some(({ name }) => name === 'rh_pulse_windows_one_open_idx')).toBe(true);
      expect(objects.rows.some(({ name }) => name === 'rh_pulse_calls_genesis_rank_check')).toBe(true);
      expect(objects.rows.some(({ name }) => name === 'rh_pulse_windows_time_order_check')).toBe(true);
      expect(await scalar(migrationPool, "select count(*) from rh_chain_market_snapshots where snapshot_id='existing_before_007'")).toBe(1);

      await insertWindowSql(migrationPool, 'migration_open_a', 1, 'open');
      await expect(insertWindowSql(migrationPool, 'migration_open_b', 2, 'open')).rejects.toMatchObject({ code: '23505' });
      await expect(migrationPool.query(
        `insert into rh_pulse_windows
          (id, sequence_number, opens_at, closes_at, call_submission_closes_at, status,
           methodology_version, source_health, audit_metadata, created_at, updated_at)
         values ('bad_time',3,now(),now()-interval '1 second',now(),'not_open',
          'rh-pulse-v1.0','{}','{}',now(),now())`
      )).rejects.toMatchObject({ code: '23514' });
      await expect(migrationPool.query(
        `insert into rh_pulse_call_challenges
          (id,window_id,wallet_address,selected_outcome,nonce_hash,signed_message,domain,uri,
           chain_id,methodology_version,issued_at,expires_at,created_at)
         values ('bad_fk','missing','0x1111111111111111111111111111111111111111',
           'agents_to_rwas',repeat('a',64),'message','pulse.infopunks.fun',
           'https://pulse.infopunks.fun/',4663,'rh-pulse-v1.0',now(),now()+interval '5 minutes',now())`
      )).rejects.toMatchObject({ code: '23503' });
      await expect(insertCallSql(migrationPool, {
        id: 'bad_genesis',
        number: 1,
        windowId: 'migration_open_a',
        wallet: '0x3333333333333333333333333333333333333333',
        genesisRank: null
      })).rejects.toMatchObject({ code: '23514' });

      await migrationPool.query("update rh_pulse_windows set status='closed', closed_at=now() where id='migration_open_a'");
      const down = await migrationSql('20260723_007_rh_pulse_signed_calls.down.sql');
      await migrationPool.query(down);
      expect(await scalar(migrationPool, "select count(*) from pg_tables where schemaname='public' and tablename like 'rh_pulse_%'")).toBe(0);
      expect(await scalar(migrationPool, "select count(*) from infopunks_schema_migrations where migration_id='20260723_007'")).toBe(0);
      expect(await scalar(migrationPool, "select count(*) from rh_chain_market_snapshots where snapshot_id='existing_before_007'")).toBe(1);
      await migrationPool.query(migration007);
      expect(await scalar(migrationPool, "select count(*) from pg_tables where schemaname='public' and tablename='rh_pulse_calls'")).toBe(1);
    });
  }, 60_000);

  it('keeps the in-memory and PostgreSQL adapters behaviorally aligned', async () => {
    const memory = await adapterContract(new InMemoryRhPulseParticipationStore());
    const postgres = await adapterContract(postgresStore());
    expect(postgres).toEqual(memory);
  }, 30_000);

  it('allocates contiguous public numbers for repeated 100/50/50-wallet concurrent batches', async () => {
    for (const batchSize of [100, 50, 50]) {
      const service = serviceFor(postgresStore());
      const window = await createOpenWindow(service, `unique-${batchSize}`);
      const before = await counterValue();
      const signedCalls = await Promise.all(Array.from({ length: batchSize }, async (_, index) => (
        signed(service, privateKeyToAccount(generatePrivateKey()), outcomes[index % outcomes.length], `unique-${batchSize}-${index}`)
      )));
      let submissionsComplete = false;
      const submissionPromise = Promise.all(signedCalls.map(({ challenge, signature }, index) => (
        service.submitCall(
          { challenge_id: challenge.challenge_id, signature },
          `submit-unique-${batchSize}-${index}`
        )
      ))).finally(() => {
        submissionsComplete = true;
      });
      const coherentReads: number[] = [];
      while (!submissionsComplete) {
        coherentReads.push(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [window.id]));
        await delay(5);
      }
      const accepted = await submissionPromise;
      const after = await counterValue();
      const numbers = accepted.map(({ call }) => call.public_call_number).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: batchSize }, (_, index) => before + index + 1));
      expect(after).toBe(before + batchSize);
      expect(new Set(numbers).size).toBe(batchSize);
      expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [window.id])).toBe(batchSize);
      expect(await scalar(pool, `select count(*) from rh_pulse_call_receipts r join rh_pulse_calls c on c.id=r.call_id where c.window_id=$1`, [window.id])).toBe(batchSize);
      expect(await scalar(pool, `select count(*) from rh_pulse_call_challenges where window_id=$1 and used_at is not null`, [window.id])).toBe(batchSize);
      expect(await scalar(pool, `select count(*) from rh_pulse_audit_events where window_id=$1 and event_type='call_accepted'`, [window.id])).toBe(batchSize);
      expect(coherentReads.every((count) => count >= 0 && count <= batchSize)).toBe(true);
      const largestDistribution = accepted
        .map(({ community_distribution }) => community_distribution.total_verified_calls)
        .sort((a, b) => b - a)[0];
      expect(largestDistribution).toBe(batchSize);
      report.unique_batches.push({
        attempted: batchSize,
        accepted: accepted.length,
        range: `${numbers[0]}-${numbers.at(-1)}`
      });
      await service.closeWindow(window.id, { audit_note: 'Close completed unique batch.' });
    }
  }, 180_000);

  it('accepts exactly one submission in 2, 10, and 25-client replay races', async () => {
    for (const clients of [2, 10, 25]) {
      const services = Array.from({ length: clients }, () => serviceFor(postgresStore()));
      const window = await createOpenWindow(services[0], `replay-${clients}`);
      const prepared = await signed(services[0], privateKeyToAccount(generatePrivateKey()), 'agents_to_rwas', `replay-${clients}`);
      const before = await counterValue();
      const settled = await Promise.allSettled(services.map((service, index) => (
        service.submitCall(
          { challenge_id: prepared.challenge.challenge_id, signature: prepared.signature },
          `replay-client-${clients}-${index}`
        )
      )));
      const accepted = settled.filter(({ status }) => status === 'fulfilled');
      const rejected = settled.filter(({ status }) => status === 'rejected');
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(clients - 1);
      expect(rejected.every((result) => (
        result.status === 'rejected' && result.reason instanceof RhPulseParticipationError
        && result.reason.code === 'challenge_used'
      ))).toBe(true);
      expect(await counterValue()).toBe(before + 1);
      expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [window.id])).toBe(1);
      expect(await scalar(pool, `select count(*) from rh_pulse_call_receipts r join rh_pulse_calls c on c.id=r.call_id where c.window_id=$1`, [window.id])).toBe(1);
      expect(await scalar(pool, 'select count(*) from rh_pulse_call_challenges where id=$1 and used_at is not null', [prepared.challenge.challenge_id])).toBe(1);
      report.duplicate_races.push({ clients, accepted: 1, rejected: clients - 1 });
      await services[0].closeWindow(window.id, { audit_note: 'Close replay race.' });
    }

    const service = serviceFor(postgresStore());
    const window = await createOpenWindow(service, 'different-challenges');
    const account = privateKeyToAccount(generatePrivateKey());
    const prepared = await Promise.all(Array.from({ length: 25 }, (_, index) => (
      signed(service, account, outcomes[index % outcomes.length], `different-challenge-${index}`)
    )));
    const before = await counterValue();
    const settled = await Promise.allSettled(prepared.map(({ challenge, signature }, index) => (
      service.submitCall(
        { challenge_id: challenge.challenge_id, signature },
        `different-challenge-submit-${index}`
      )
    )));
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter(({ status }) => status === 'rejected').every((result) => (
      result.status === 'rejected' && result.reason instanceof RhPulseParticipationError
      && result.reason.code === 'duplicate_call'
    ))).toBe(true);
    expect(await counterValue()).toBe(before + 1);
    expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [window.id])).toBe(1);
    await service.closeWindow(window.id, { audit_note: 'Close different-challenge race.' });
  }, 120_000);

  it('rolls back cleanly at all eight controlled transaction failure stages', async () => {
    const normalService = serviceFor(postgresStore());
    const window = await createOpenWindow(normalService, 'forced-rollback');
    for (const [index, failureStage] of failureStages.entries()) {
      const prepared = await signed(
        normalService,
        privateKeyToAccount(generatePrivateKey()),
        outcomes[index % outcomes.length],
        `forced-${failureStage}`
      );
      const before = await counterValue();
      let failed = false;
      const failingStore = postgresStore({
        integrationTestFailureHook: (stage) => {
          if (!failed && stage === failureStage) {
            failed = true;
            throw new Error(`forced_${failureStage}`);
          }
        }
      });
      const failingService = serviceFor(failingStore);
      await expect(failingService.submitCall({
        challenge_id: prepared.challenge.challenge_id,
        signature: prepared.signature
      }, `forced-submit-${failureStage}`)).rejects.toThrow(`forced_${failureStage}`);
      expect(await counterValue()).toBe(before);
      expect(await scalar(pool, 'select count(*) from rh_pulse_calls where wallet_address=$1 and window_id=$2', [prepared.account.address, window.id])).toBe(0);
      expect(await scalar(pool, 'select count(*) from rh_pulse_call_receipts r join rh_pulse_calls c on c.id=r.call_id where c.wallet_address=$1 and c.window_id=$2', [prepared.account.address, window.id])).toBe(0);
      expect(await scalar(pool, 'select count(*) from rh_pulse_call_challenges where id=$1 and used_at is null', [prepared.challenge.challenge_id])).toBe(1);
      expect(await scalar(pool, `select count(*) from rh_pulse_audit_events where challenge_id=$1 and event_type in ('signature_verified','call_accepted','receipt_created')`, [prepared.challenge.challenge_id])).toBe(0);
      const retry = await normalService.submitCall({
        challenge_id: prepared.challenge.challenge_id,
        signature: prepared.signature
      }, `forced-retry-${failureStage}`);
      expect(retry.call.public_call_number).toBe(before + 1);
      report.forced_rollbacks += 1;
    }
    await normalService.closeWindow(window.id, { audit_note: 'Close forced rollback window.' });
  }, 120_000);

  it('enforces the Genesis boundary at 4663 and 4664 in PostgreSQL', async () => {
    await withTemporaryDatabase('rh_pulse_gate_genesis', async (genesisPool) => {
      await applyMigrationFiles(genesisPool, 7);
      await genesisPool.query(
        `update rh_pulse_counters set current_value=4662 where counter_name='rh_pulse_public_call_number'`
      );
      const service = serviceFor(postgresStore({ pool: genesisPool }));
      const window = await createOpenWindow(service, 'genesis-boundary');
      const first = await signed(service, privateKeyToAccount(generatePrivateKey()), 'agents_to_rwas', 'genesis-4663');
      const second = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_agents', 'genesis-4664');
      const atBoundary = await service.submitCall({
        challenge_id: first.challenge.challenge_id,
        signature: first.signature
      }, 'genesis-4663-submit');
      const afterBoundary = await service.submitCall({
        challenge_id: second.challenge.challenge_id,
        signature: second.signature
      }, 'genesis-4664-submit');
      expect(atBoundary.call).toMatchObject({
        public_call_number: 4663,
        genesis: { is_genesis: true, rank: 4663 }
      });
      expect(afterBoundary.call).toMatchObject({
        public_call_number: 4664,
        genesis: { is_genesis: false, rank: null }
      });
    });
  }, 60_000);

  it('rejects receipt mutation and preserves original plus superseding provenance', async () => {
    const service = serviceFor(postgresStore());
    const window = await createOpenWindow(service, 'receipt-immutability');
    const prepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_rwas', 'receipt');
    const accepted = await service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, 'receipt-submit');
    const store = postgresStore();
    const original = await store.getReceiptForCall(accepted.call.call_id);
    expect(original).not.toBeNull();
    await expect(pool.query(
      `update rh_pulse_call_receipts set receipt_hash=receipt_hash where id=$1`,
      [original!.id]
    )).rejects.toMatchObject({ code: 'P0001' });
    await expect(pool.query(
      `delete from rh_pulse_call_receipts where id=$1`,
      [original!.id]
    )).rejects.toMatchObject({ code: 'P0001' });
    expect('updateReceipt' in store).toBe(false);
    expect('deleteReceipt' in store).toBe(false);
    await expect(pool.query(
      `insert into rh_pulse_call_receipts
        (id,call_id,receipt_version,public_slug,receipt_payload,receipt_hash,supersedes_receipt_id,created_at)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [
        original!.id, original!.call_id, original!.receipt_version, `${original!.public_slug}-duplicate`,
        JSON.stringify(original!.receipt_payload), `sha256:${'b'.repeat(64)}`, original!.id,
        new Date(Date.parse(original!.created_at) + 1).toISOString()
      ]
    )).rejects.toSatisfy((error: unknown) => (
      error instanceof Error
      && 'code' in error
      && ['23505', '23514'].includes(String((error as { code?: unknown }).code))
    ));

    const supersedingPayload: RhPulseCallReceiptPayload = {
      ...original!.receipt_payload,
      structural_snapshot: {
        ...original!.receipt_payload.structural_snapshot,
        generated_at: new Date(Date.parse(original!.receipt_payload.structural_snapshot.generated_at) + 1).toISOString()
      }
    };
    const superseding = {
      id: `rhp_receipt_superseding_${randomUUID()}`,
      slug: `receipt-${String(accepted.call.public_call_number).padStart(6, '0')}-${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 16)}`,
      hash: receiptHash(supersedingPayload),
      createdAt: new Date(Date.parse(original!.created_at) + 1_000).toISOString()
    };
    await pool.query(
      `insert into rh_pulse_call_receipts
        (id,call_id,receipt_version,public_slug,receipt_payload,receipt_hash,supersedes_receipt_id,created_at)
       values ($1,$2,'1.0',$3,$4::jsonb,$5,$6,$7)`,
      [
        superseding.id, original!.call_id, superseding.slug, JSON.stringify(supersedingPayload),
        superseding.hash, original!.id, superseding.createdAt
      ]
    );
    expect((await store.getReceipt(original!.id))?.receipt_hash).toBe(original!.receipt_hash);
    expect((await store.getReceipt(superseding.id))?.supersedes_receipt_id).toBe(original!.id);
    expect((await store.getReceiptForCall(original!.call_id))?.id).toBe(superseding.id);
    expect(receiptHash(original!.receipt_payload)).toBe(original!.receipt_hash);
    expect(receiptHash(supersedingPayload)).toBe(superseding.hash);
    expect((await service.getPublicReceipt(original!.call_id)).receipt.supersedes_receipt_id).toBe(original!.id);
    await service.closeWindow(window.id, { audit_note: 'Close receipt immutability window.' });
  }, 30_000);

  it('reproduces canonical hashes across insertion order, adapters, and Node processes', async () => {
    const left = { z: [{ y: 2, x: 1 }, 3], a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, z: [{ x: 1, y: 2 }, 3] };
    const changed = { a: { c: 3, d: 5 }, z: [{ x: 1, y: 2 }, 3] };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(canonicalJson(left)).not.toBe(canonicalJson(changed));
    const processHashes = [left, right].map((payload) => hashInFreshProcess(payload));
    expect(processHashes[0]).toBe(processHashes[1]);
    expect(processHashes[0]).toBe(createHash('sha256').update(canonicalJson(left)).digest('hex'));

    const memoryResult = await adapterContract(new InMemoryRhPulseParticipationStore());
    const postgresResult = await adapterContract(postgresStore());
    expect(memoryResult.receipt_hash_valid).toBe(true);
    expect(postgresResult.receipt_hash_valid).toBe(true);
  }, 30_000);

  it('uses an exclusive deadline and closes correctly across window lock races', async () => {
    const service = serviceFor(postgresStore());
    const beforeDeadline = await createOpenWindow(service, 'before-deadline', 1_000);
    const beforePrepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'agents_to_rwas', 'before-deadline');
    const beforeAccepted = await service.submitCall({
      challenge_id: beforePrepared.challenge.challenge_id,
      signature: beforePrepared.signature
    }, 'before-deadline-submit');
    expect(beforeAccepted.call.window.id).toBe(beforeDeadline.id);
    await service.closeWindow(beforeDeadline.id, { audit_note: 'Close before deadline.' });

    for (const offsetMs of [0, -1]) {
      const boundaryWindow = await createOpenWindow(service, `deadline-${offsetMs}`, 300_000);
      const prepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_agents', `deadline-${offsetMs}`);
      await pool.query(
        `update rh_pulse_windows
         set call_submission_closes_at=clock_timestamp()+($2::text || ' milliseconds')::interval
         where id=$1`,
        [boundaryWindow.id, offsetMs]
      );
      const challengeRow = await pool.query<{ issued_at: Date }>(
        'select issued_at from rh_pulse_call_challenges where id=$1',
        [prepared.challenge.challenge_id]
      );
      const pastNow = new Date(challengeRow.rows[0]!.issued_at);
      const boundaryService = serviceFor(postgresStore(), { now: () => pastNow });
      const before = await counterValue();
      await expect(boundaryService.submitCall({
        challenge_id: prepared.challenge.challenge_id,
        signature: prepared.signature
      }, `deadline-${offsetMs}-submit`)).rejects.toMatchObject({ code: 'window_closed' });
      expect(await counterValue()).toBe(before);
      expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [boundaryWindow.id])).toBe(0);
      await service.closeWindow(boundaryWindow.id, { audit_note: 'Close boundary test.' });
    }

    const callWins = await createOpenWindow(service, 'race-call-wins');
    const callWinsPrepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_rwas', 'race-call-wins');
    let releaseLock!: () => void;
    let markLocked!: () => void;
    const releasePromise = new Promise<void>((resolve) => { releaseLock = resolve; });
    const lockedPromise = new Promise<void>((resolve) => { markLocked = resolve; });
    const blockingStore = postgresStore({
      integrationTestFailureHook: async (stage) => {
        if (stage === 'after_window_lock') {
          markLocked();
          await releasePromise;
        }
      }
    });
    const callPromise = serviceFor(blockingStore).submitCall({
      challenge_id: callWinsPrepared.challenge.challenge_id,
      signature: callWinsPrepared.signature
    }, 'race-call-wins-submit');
    await lockedPromise;
    const closePromise = service.closeWindow(callWins.id, { audit_note: 'Close races accepted call.' });
    releaseLock();
    await expect(callPromise).resolves.toMatchObject({ call: { window: { id: callWins.id } } });
    await expect(closePromise).resolves.toMatchObject({ status: 'closed' });

    const closeWins = await createOpenWindow(service, 'race-close-wins');
    const closeWinsPrepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'no_qualified_rotation', 'race-close-wins');
    const lockClient = await pool.connect();
    await lockClient.query('begin');
    await lockClient.query('select id from rh_pulse_windows where id=$1 for update', [closeWins.id]);
    await lockClient.query(
      `update rh_pulse_windows set status='closed',closed_at=clock_timestamp(),updated_at=clock_timestamp() where id=$1`,
      [closeWins.id]
    );
    const before = await counterValue();
    const rejectedPromise = service.submitCall({
      challenge_id: closeWinsPrepared.challenge.challenge_id,
      signature: closeWinsPrepared.signature
    }, 'race-close-wins-submit');
    await delay(20);
    await lockClient.query('commit');
    lockClient.release();
    await expect(rejectedPromise).rejects.toMatchObject({ code: 'window_not_open' });
    expect(await counterValue()).toBe(before);
    expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [closeWins.id])).toBe(0);
  }, 60_000);

  it('keeps two real server processes correct against one database and one close authority', async () => {
    const tokenA = `gate-token-a-${randomUUID()}`;
    const tokenB = `gate-token-b-${randomUUID()}`;
    const first = await startServer(18_881, tokenA);
    const second = await startServer(18_882, tokenA);
    try {
      const service = serviceFor(postgresStore());
      const window = await createOpenWindow(service, 'multi-process');
      const prepared = await Promise.all(Array.from({ length: 40 }, (_, index) => (
        signed(service, privateKeyToAccount(generatePrivateKey()), outcomes[index % outcomes.length], `multi-${index}`)
      )));
      const before = await counterValue();
      const responses = await Promise.all(prepared.map(({ challenge, signature }, index) => (
        postJson(
          index % 2 ? 18_881 : 18_882,
          '/v1/rh-pulse/calls',
          { challenge_id: challenge.challenge_id, signature }
        )
      )));
      expect(responses.every(({ status }) => status === 200)).toBe(true);
      const numbers = responses.map(({ json }) => Number(json.data.call.public_call_number)).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: 40 }, (_, index) => before + index + 1));

      const duplicateAccount = privateKeyToAccount(generatePrivateKey());
      const duplicates = await Promise.all([
        signed(service, duplicateAccount, 'agents_to_rwas', 'multi-duplicate-a'),
        signed(service, duplicateAccount, 'memes_to_agents', 'multi-duplicate-b')
      ]);
      const duplicateResponses = await Promise.all(duplicates.map(({ challenge, signature }, index) => (
        postJson(
          index ? 18_881 : 18_882,
          '/v1/rh-pulse/calls',
          { challenge_id: challenge.challenge_id, signature }
        )
      )));
      expect(duplicateResponses.filter(({ status }) => status === 200)).toHaveLength(1);
      expect(duplicateResponses.filter(({ json }) => json.error === 'duplicate_call')).toHaveLength(1);

      const pending = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_rwas', 'multi-close');
      await fetch(`http://127.0.0.1:18882/v1/rh-pulse/current-window`);
      const closeStartedAt = performance.now();
      const close = await postJson(
        18_881,
        `/internal/rh-pulse/windows/${window.id}/close`,
        { audit_note: 'Close through process A.' },
        tokenA
      );
      expect(close.status).toBe(200);
      const staleRead = await fetch(`http://127.0.0.1:18882/v1/rh-pulse/current-window`).then((response) => response.json());
      report.multi_process = {
        processes: 2,
        attempted: 42,
        accepted: 41,
        stale_read_cache_ms: staleRead.data.state === 'open'
          ? Math.round(performance.now() - closeStartedAt)
          : 0
      };
      const closedSubmission = await postJson(
        18_882,
        '/v1/rh-pulse/calls',
        { challenge_id: pending.challenge.challenge_id, signature: pending.signature }
      );
      expect(closedSubmission).toMatchObject({ status: 409, json: { error: 'window_not_open' } });

      const pendingA = await service.createWindow(windowRequest('multi-open-a'));
      const pendingB = await service.createWindow(windowRequest('multi-open-b'));
      const openResults = await Promise.all([
        postJson(18_881, `/internal/rh-pulse/windows/${pendingA.id}/open`, { audit_note: 'Open A.' }, tokenA),
        postJson(18_882, `/internal/rh-pulse/windows/${pendingB.id}/open`, { audit_note: 'Open B.' }, tokenA)
      ]);
      expect(openResults.filter(({ status }) => status === 200)).toHaveLength(1);
      expect(openResults.filter(({ json }) => json.error === 'open_window_exists')).toHaveLength(1);
      const openedId = openResults.find(({ status }) => status === 200)!.json.data.window.id as string;
      await service.closeWindow(openedId, { audit_note: 'Close one-open authority test.' });

      await stopServer(second);
      const rotated = await startServer(18_882, tokenB);
      const oldToken = await fetch('http://127.0.0.1:18882/internal/rh-pulse/windows', {
        headers: { authorization: `Bearer ${tokenA}` }
      });
      const newToken = await fetch('http://127.0.0.1:18882/internal/rh-pulse/windows', {
        headers: { authorization: `Bearer ${tokenB}` }
      });
      const publicHealth = await fetch('http://127.0.0.1:18882/health');
      expect(oldToken.status).toBe(401);
      expect(newToken.status).toBe(200);
      expect(publicHealth.status).toBe(200);
      second.process = rotated.process;
      second.logs = rotated.logs;
      second.stopped = false;
    } finally {
      await Promise.all([stopServer(first), stopServer(second)]);
    }
  }, 180_000);

  it('keeps challenge failures generic and operator audit records secret-safe in PostgreSQL', async () => {
    const service = serviceFor(postgresStore());
    const window = await createOpenWindow(service, 'security');
    const account = privateKeyToAccount(generatePrivateKey());
    const prepared = await signed(service, account, 'agents_to_rwas', 'security');
    const wrongSignature = await privateKeyToAccount(generatePrivateKey()).signMessage({ message: prepared.challenge.message });
    await expect(service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: wrongSignature
    }, '198.51.100.19')).rejects.toMatchObject({ code: 'signature_invalid' });
    await expect(service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: '0x1234'
    }, '198.51.100.19')).rejects.toMatchObject({ code: 'signature_invalid' });
    await expect(service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: `0x${'11'.repeat(1_025)}`
    }, '198.51.100.19')).rejects.toThrow();
    await expect(service.submitCall({
      challenge_id: 'rhp_challenge_missing_gate',
      signature: prepared.signature
    }, '198.51.100.19')).rejects.toMatchObject({ code: 'challenge_not_found' });

    const tamperCases = [
      ['domain', 'attacker.example'],
      ['uri', 'https://attacker.example/'],
      ['selected_outcome', 'memes_to_agents'],
      ['signed_message', `${prepared.challenge.message}\nModified`]
    ] as const;
    for (const [column, value] of tamperCases) {
      const fresh = await signed(service, privateKeyToAccount(generatePrivateKey()), 'memes_to_rwas', `tamper-${column}`);
      await pool.query(`update rh_pulse_call_challenges set ${column}=$2 where id=$1`, [fresh.challenge.challenge_id, value]);
      await expect(service.submitCall({
        challenge_id: fresh.challenge.challenge_id,
        signature: fresh.signature
      }, `tamper-${column}`)).rejects.toMatchObject({ code: 'challenge_tampered' });
    }
    await expect(pool.query(
      `update rh_pulse_call_challenges set methodology_version='rh-pulse-v0.9' where id=$1`,
      [prepared.challenge.challenge_id]
    )).rejects.toMatchObject({ code: '23514' });

    const audit = await pool.query<{ wallet_hash: string | null; request_origin_hash: string | null; payload: unknown }>(
      'select wallet_hash, request_origin_hash, payload from rh_pulse_audit_events where window_id=$1',
      [window.id]
    );
    const serializedAudit = JSON.stringify(audit.rows);
    expect(serializedAudit).not.toContain(prepared.signature);
    expect(serializedAudit).not.toContain(prepared.challenge.message);
    expect(serializedAudit).not.toContain('198.51.100.19');
    expect(serializedAudit).not.toContain('Nonce:');
    expect(audit.rows.every(({ wallet_hash, request_origin_hash }) => (
      (wallet_hash === null || /^[a-f0-9]{64}$/.test(wallet_hash))
      && (request_origin_hash === null || /^[a-f0-9]{64}$/.test(request_origin_hash))
    ))).toBe(true);
    await service.closeWindow(window.id, { audit_note: 'Close security test.' });
  }, 60_000);

  it('measures coherent community aggregation and critical index-backed query plans through 10,000 calls', async () => {
    await withTemporaryDatabase('rh_pulse_gate_perf', async (perfPool) => {
      await applyMigrationFiles(perfPool, 7);
      const sizes = [100, 1_000, 10_000];
      for (const [index, size] of sizes.entries()) {
        const windowId = `perf_window_${size}`;
        await insertWindowSql(perfPool, windowId, index + 1, index === 0 ? 'open' : 'closed');
        const base = (index + 1) * 100_000;
        await perfPool.query(
          `insert into rh_pulse_calls
            (id,public_call_number,window_id,wallet_address,selected_outcome,signature,
             signed_message_hash,recorded_at,verification_status,abuse_status,genesis_rank,
             public_slug,methodology_version,created_at)
           select
             'perf_call_' || $1 || '_' || gs,
             $2 + gs,
             $1,
             '0x' || lpad(to_hex($2 + gs),40,'0'),
             (array['agents_to_rwas','memes_to_agents','memes_to_rwas','no_qualified_rotation'])[(gs % 4)+1],
             '0x' || repeat('11',65),
             repeat('a',64),
             clock_timestamp(),
             'verified',
             'clear',
             null,
             'perf-slug-' || $1 || '-' || gs,
             'rh-pulse-v1.0',
             clock_timestamp()
           from generate_series(1,$3) gs`,
          [windowId, base, size]
        );
        const measured = await timedQuery(perfPool,
          `select selected_outcome,count(*)::int as count
           from rh_pulse_calls where window_id=$1 and verification_status='verified'
           group by selected_outcome order by selected_outcome`,
          [windowId]
        );
        report.query_timings_ms[`community_${size}`] = measured.durationMs;
        expect(measured.rows.reduce((sum, row) => sum + Number(row.count), 0)).toBe(size);
      }
      await perfPool.query(
        `insert into rh_pulse_call_receipts
          (id,call_id,receipt_version,public_slug,receipt_payload,receipt_hash,created_at)
         values ('perf_receipt','perf_call_perf_window_100_1','1.0','perf-receipt',
          '{"receipt_type":"perf"}','sha256:${'c'.repeat(64)}',now())`
      );
      const plans = {
        duplicate_wallet: await explain(perfPool, `select * from rh_pulse_calls where window_id=$1 and wallet_address=$2`, ['perf_window_10000', '0x000000000000000000000000000000000004a121']),
        active_window: await explain(perfPool, `select * from rh_pulse_windows where status='open' limit 1`, []),
        counter_lock: await explain(perfPool, `select current_value from rh_pulse_counters where counter_name='rh_pulse_public_call_number' for update`, []),
        public_call: await explain(perfPool, `select * from rh_pulse_calls where id=$1 or public_slug=$1 limit 1`, ['perf_call_perf_window_10000_9999']),
        receipt: await explain(perfPool, `select * from rh_pulse_call_receipts where call_id=$1 order by created_at desc limit 1`, ['perf_call_perf_window_100_1']),
        community: await explain(perfPool, `select selected_outcome,count(*) from rh_pulse_calls where window_id=$1 and verification_status='verified' group by selected_outcome`, ['perf_window_10000']),
        window_count: await explain(perfPool, `select count(*) from rh_pulse_calls where window_id=$1`, ['perf_window_10000']),
        genesis: await explain(perfPool, `select * from rh_pulse_calls where genesis_rank=$1`, [4663])
      };
      for (const [name, plan] of Object.entries(plans)) {
        report.query_timings_ms[`plan_${name}`] = plan.executionTime;
      }
      expect(plans.duplicate_wallet.indexes.some((name) => name.includes('window_id_wallet_address'))).toBe(true);
      expect(plans.counter_lock.indexes.some((name) => name.includes('rh_pulse_counters_pkey'))).toBe(true);
      expect(plans.receipt.indexes.some((name) => name.includes('rh_pulse_call_receipts_call_created_idx'))).toBe(true);
      expect(plans.community.indexes.some((name) => name.includes('rh_pulse_calls_window_outcome_idx'))).toBe(true);
      expect(plans.genesis.indexes.some((name) => name.includes('genesis_rank'))).toBe(true);
    });
  }, 120_000);

  it('refuses down migration after a signed call and leaves signed and unrelated records intact', async () => {
    const service = serviceFor(postgresStore());
    const window = await createOpenWindow(service, 'refused-down');
    const prepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'no_qualified_rotation', 'refused-down');
    const accepted = await service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, 'refused-down-submit');
    const down = await migrationSql('20260723_007_rh_pulse_signed_calls.down.sql');
    const client = await pool.connect();
    try {
      await expect(client.query(down)).rejects.toMatchObject({
        code: 'P0001',
        message: 'unsafe rollback: signed RH Pulse calls exist'
      });
      await client.query('rollback');
    } finally {
      client.release();
    }
    expect(await scalar(pool, 'select count(*) from rh_pulse_calls where id=$1', [accepted.call.call_id])).toBe(1);
    expect(await scalar(pool, 'select count(*) from rh_pulse_call_receipts where call_id=$1', [accepted.call.call_id])).toBe(1);
    expect(await scalar(pool, "select count(*) from rh_chain_market_snapshots where snapshot_id='rhp_gate_existing_snapshot'")).toBe(1);
    await service.closeWindow(window.id, { audit_note: 'Close refused-down test.' });
  }, 30_000);

  it('recovers safely from database loss and enforces the disabled flag over an open window', async () => {
    const observations: RhPulsePostgresObservation[] = [];
    const store = postgresStore({ observe: (entry) => observations.push(entry) });
    const service = serviceFor(store);
    const window = await createOpenWindow(service, 'database-recovery');
    const prepared = await signed(service, privateKeyToAccount(generatePrivateKey()), 'agents_to_rwas', 'database-recovery');
    const challengesBefore = await scalar(pool, 'select count(*) from rh_pulse_call_challenges');
    await runEnvironmentCommand('stop');
    await expect(service.createChallenge({
      wallet_address: privateKeyToAccount(generatePrivateKey()).address,
      selected_outcome: 'memes_to_agents'
    }, 'database-down-challenge')).rejects.toThrow();
    await expect(service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, 'database-down-submit')).rejects.toThrow();
    await runEnvironmentCommand('up');
    await waitForDatabase();
    expect(await scalar(pool, 'select count(*) from rh_pulse_call_challenges')).toBe(challengesBefore);
    expect(await scalar(pool, 'select count(*) from rh_pulse_calls where window_id=$1', [window.id])).toBe(0);
    expect(await counterValue()).toBe(await scalar(pool, `select coalesce(max(public_call_number),0) from rh_pulse_calls`));
    const recovered = await service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, 'database-restored-submit');
    expect(recovered.call.window.id).toBe(window.id);

    const disabled = serviceFor(postgresStore(), { callsEnabled: false });
    await expect(disabled.createChallenge({
      wallet_address: privateKeyToAccount(generatePrivateKey()).address,
      selected_outcome: 'agents_to_rwas'
    }, 'disabled-open-window')).rejects.toMatchObject({ code: 'calls_disabled' });
    await expect(disabled.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, 'disabled-open-window')).rejects.toMatchObject({ code: 'calls_disabled' });
    await expect(disabled.getPublicReceipt(recovered.call.call_id)).resolves.toMatchObject({ immutable: true });
    expect(observations.some(({ operation, outcome }) => operation === 'call_accept' && outcome === 'committed')).toBe(true);
    report.database_recovery = 'challenge_not_issued;submission_rolled_back;retry_succeeded';
    await service.closeWindow(window.id, { audit_note: 'Close database recovery test.' });
  }, 90_000);
});

function postgresStore(options: {
  pool?: pg.Pool;
  integrationTestFailureHook?: (stage: RhPulsePostgresFailureStage) => void | Promise<void>;
  observe?: (observation: RhPulsePostgresObservation) => void;
} = {}) {
  return new PostgresRhPulseParticipationStore(options.pool ?? pool, {
    integrationTestFailureHook: options.integrationTestFailureHook,
    observe: options.observe ?? (() => undefined)
  });
}

function serviceFor(store: RhPulseParticipationStore, options: {
  now?: () => Date;
  callsEnabled?: boolean;
} = {}) {
  return new RhPulseParticipationService({
    store,
    callsEnabled: options.callsEnabled ?? true,
    now: options.now,
    readModel: async () => readModel,
    challengeRateLimit: {
      walletMax: 100,
      originMax: 20_000,
      windowMs: 60_000,
      maxEntries: 30_000
    }
  });
}

async function createOpenWindow(service: RhPulseParticipationService, label: string, deadlineMs = 300_000) {
  const window = await service.createWindow(windowRequest(label, deadlineMs));
  return service.openWindow(window.id, { audit_note: `Open ${label}.` });
}

function windowRequest(label: string, deadlineMs = 300_000) {
  const now = Date.now();
  return {
    opens_at: new Date(now - 60_000).toISOString(),
    closes_at: new Date(now + Math.max(deadlineMs, 1_000) + 60_000).toISOString(),
    call_submission_closes_at: new Date(now + deadlineMs).toISOString(),
    methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION,
    source_health: {
      state: 'delayed' as const,
      observed_at: new Date(now).toISOString(),
      detail: `Real PostgreSQL gate: ${label}.`
    },
    audit_note: `Create ${label}.`
  };
}

async function signed(
  service: RhPulseParticipationService,
  account: PrivateKeyAccount,
  selectedOutcome: RhPulseCallOutcome,
  origin: string
): Promise<Signed> {
  const challenge = await service.createChallenge({
    wallet_address: account.address,
    selected_outcome: selectedOutcome
  }, origin);
  const signature = await account.signMessage({ message: challenge.message });
  return { account, challenge, signature };
}

async function adapterContract(store: RhPulseParticipationStore) {
  const service = serviceFor(store);
  const window = await createOpenWindow(service, `adapter-${store.adapter}`);
  const prepared = await signed(
    service,
    privateKeyToAccount(generatePrivateKey()),
    'agents_to_rwas',
    `adapter-${store.adapter}`
  );
  const accepted = await service.submitCall({
    challenge_id: prepared.challenge.challenge_id,
    signature: prepared.signature
  }, `adapter-${store.adapter}-submit`);
  let replayCode = '';
  try {
    await service.submitCall({
      challenge_id: prepared.challenge.challenge_id,
      signature: prepared.signature
    }, `adapter-${store.adapter}-replay`);
  } catch (error) {
    replayCode = error instanceof RhPulseParticipationError ? error.code : 'unexpected';
  }
  const publicCall = await service.getPublicCall(accepted.call.call_id);
  const publicReceipt = await service.getPublicReceipt(accepted.call.call_id);
  await service.closeWindow(window.id, { audit_note: `Close adapter ${store.adapter}.` });
  const cancelled = await service.createWindow(windowRequest(`cancel-${store.adapter}`));
  await service.cancelWindow(cancelled.id, {
    cancellation_reason: 'Adapter parity cancellation.',
    audit_note: `Cancel adapter ${store.adapter}.`
  });
  const events = (await store.listAuditEvents()).map(({ event_type }) => event_type);
  return {
    window_status: 'open',
    accepted_outcome: accepted.call.selected_outcome,
    accepted_number_positive: accepted.call.public_call_number > 0,
    genesis: accepted.call.genesis.is_genesis,
    replay_code: replayCode,
    public_call_id_matches: publicCall.call.call_id === accepted.call.call_id,
    receipt_call_matches: publicReceipt.receipt.call_id === accepted.call.call_id,
    receipt_hash_valid: receiptHash(publicReceipt.receipt.receipt_payload) === publicReceipt.receipt.receipt_hash,
    distribution_total: accepted.community_distribution.total_verified_calls,
    cancelled_status: (await store.getWindow(cancelled.id))?.status,
    event_types: [...new Set(events)].sort()
  };
}

async function withTemporaryDatabase(name: string, action: (databasePool: pg.Pool) => Promise<void>) {
  if (!/^rh_pulse_gate_[a-z_]+$/.test(name)) throw new Error(`unsafe gate database name: ${name}`);
  const admin = new pg.Pool({ connectionString: ADMIN_URL, max: 2 });
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid <> pg_backend_pid()`,
    [name]
  );
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  const databasePool = new pg.Pool({
    connectionString: `postgresql://postgres@127.0.0.1:55463/${name}`,
    max: 40
  });
  try {
    await action(databasePool);
  } finally {
    await databasePool.end();
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid <> pg_backend_pid()`,
      [name]
    );
    await admin.query(`drop database if exists ${name}`);
    await admin.end();
  }
}

async function applyMigrationFiles(databasePool: pg.Pool, count: number) {
  const files = [
    '20260719_001_rh_chain_market_snapshot_memory.up.sql',
    '20260719_002_rh_chain_reviewed_classifications.up.sql',
    '20260719_003_rh_chain_classification_layer_vocabulary.up.sql',
    '20260719_004_rh_chain_attention_quality_receipts.up.sql',
    '20260719_005_rh_chain_project_claims.up.sql',
    '20260720_006_rh_chain_reviewer_workflow.up.sql',
    '20260723_007_rh_pulse_signed_calls.up.sql'
  ];
  for (const filename of files.slice(0, count)) {
    await databasePool.query(await migrationSql(filename));
  }
}

function migrationSql(filename: string) {
  return readFile(join(repositoryRoot, 'migrations', filename), 'utf8');
}

async function insertWindowSql(
  databasePool: pg.Pool,
  id: string,
  sequence: number,
  status: 'not_open' | 'open' | 'closed'
) {
  return databasePool.query(
    `insert into rh_pulse_windows
      (id,sequence_number,opens_at,closes_at,call_submission_closes_at,status,
       methodology_version,source_health,audit_metadata,created_at,updated_at,closed_at)
     values ($1,$2,now()-interval '1 minute',now()+interval '1 hour',now()+interval '30 minutes',
       $3,'rh-pulse-v1.0','{"state":"delayed","observed_at":null,"detail":"gate"}'::jsonb,
       '{}'::jsonb,now(),now(),case when $3='closed' then now() else null end)`,
    [id, sequence, status]
  );
}

function insertCallSql(databasePool: pg.Pool, input: {
  id: string;
  number: number;
  windowId: string;
  wallet: string;
  genesisRank: number | null;
}) {
  return databasePool.query(
    `insert into rh_pulse_calls
      (id,public_call_number,window_id,wallet_address,selected_outcome,signature,
       signed_message_hash,recorded_at,verification_status,abuse_status,genesis_rank,
       public_slug,methodology_version,created_at)
     values ($1,$2,$3,$4,'agents_to_rwas','0x11',repeat('a',64),now(),'verified','clear',$5,
       $6,'rh-pulse-v1.0',now())`,
    [input.id, input.number, input.windowId, input.wallet, input.genesisRank, `slug-${input.id}`]
  );
}

async function scalar(databasePool: Pick<pg.Pool, 'query'>, sql: string, params: unknown[] = []) {
  const result = await databasePool.query(sql, params);
  return Number(Object.values(result.rows[0] ?? {})[0] ?? 0);
}

async function counterValue() {
  return scalar(pool, `select current_value from rh_pulse_counters where counter_name='rh_pulse_public_call_number'`);
}

function hashInFreshProcess(payload: unknown) {
  const result = spawnSync(
    process.execPath,
    [
      '--import', 'tsx',
      '--input-type=module',
      '-e',
      `import {createHash} from 'node:crypto';
       import * as participationModule from './src/services/rhPulseParticipationService.ts';
       const canonical = participationModule.canonicalJson ?? participationModule.default?.canonicalJson;
       if (typeof canonical !== 'function') throw new Error('canonical_json_export_missing');
       process.stdout.write(createHash('sha256').update(canonical(JSON.parse(process.argv[1]))).digest('hex'));`,
      JSON.stringify(payload)
    ],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stderr || 'fresh hash process failed');
  return result.stdout.trim();
}

type ServerHandle = {
  process: ChildProcessWithoutNullStreams;
  logs: string[];
  stopped: boolean;
};

async function startServer(port: number, internalToken: string): Promise<ServerHandle> {
  const child = spawn(
    join(repositoryRoot, 'node_modules/.bin/tsx'),
    ['src/server.ts'],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(port),
        DATABASE_URL: GATE_URL,
        DATABASE_POOL_MAX: '20',
        RH_PULSE_CALLS_ENABLED: 'true',
        RH_PULSE_INTERNAL_TOKEN: internalToken,
        PAYSH_CATALOG_SOURCE: 'fixture',
        PAYSH_ALLOW_FIXTURE_FALLBACK: 'true',
        INGESTION_ENABLED: 'false',
        MONITOR_ENABLED: 'false',
        MACHINE_DEMO_SEED: 'false'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  const handle: ServerHandle = { process: child, logs: [], stopped: false };
  const collect = (chunk: Buffer) => {
    handle.logs.push(chunk.toString());
    if (handle.logs.length > 500) handle.logs.shift();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`gate server ${port} exited: ${handle.logs.join('')}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return handle;
    } catch {
      // Retry until the bounded startup deadline.
    }
    await delay(50);
  }
  throw new Error(`gate server ${port} did not become healthy`);
}

async function stopServer(handle: ServerHandle) {
  if (handle.stopped || handle.process.exitCode !== null) {
    handle.stopped = true;
    return;
  }
  handle.process.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => handle.process.once('exit', () => resolve())),
    delay(5_000).then(() => {
      if (handle.process.exitCode === null) handle.process.kill('SIGKILL');
    })
  ]);
  handle.stopped = true;
  const logs = handle.logs.join('');
  expect(logs).not.toMatch(/0x[0-9a-fA-F]{130}/);
  expect(logs).not.toContain('RH Pulse: Call the Rotation');
  expect(logs).not.toContain('Nonce:');
}

async function postJson(port: number, path: string, body: unknown, token?: string) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

async function timedQuery(databasePool: pg.Pool, sql: string, params: unknown[]) {
  const startedAt = performance.now();
  const result = await databasePool.query(sql, params);
  return { rows: result.rows, durationMs: Number((performance.now() - startedAt).toFixed(3)) };
}

async function explain(databasePool: pg.Pool, sql: string, params: unknown[]) {
  const result = await databasePool.query(`explain (analyze,buffers,format json) ${sql}`, params);
  const plan = result.rows[0]['QUERY PLAN'][0];
  const indexes = new Set<string>();
  walkPlan(plan.Plan, (node) => {
    if (typeof node['Index Name'] === 'string') indexes.add(node['Index Name']);
  });
  return {
    executionTime: Number(plan['Execution Time']),
    indexes: [...indexes]
  };
}

function walkPlan(node: Record<string, unknown>, visit: (node: Record<string, unknown>) => void) {
  visit(node);
  const children = node.Plans;
  if (Array.isArray(children)) {
    for (const child of children) walkPlan(child as Record<string, unknown>, visit);
  }
}

async function runEnvironmentCommand(command: 'up' | 'stop') {
  const result = spawnSync(
    process.execPath,
    ['scripts/rh-pulse-postgres-env.mjs', command],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stderr || `Postgres environment ${command} failed`);
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await pool.query('select 1');
      return;
    } catch {
      await delay(50);
    }
  }
  throw new Error('Postgres did not recover before the gate deadline');
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
