import type pg from 'pg';
import type { RuntimeConfig } from '../config/env';
import { RH_PULSE_CALL_METHODOLOGY_VERSION } from '../shared/rhPulseCalls';
import { normalizePublicHostname } from '../shared/rhPulseRouting';
import { renderSvgPng } from '../server/narrativeOgPng';

export const RH_PULSE_REQUIRED_MIGRATIONS = [
  '20260723_007',
  '20260723_008',
  '20260723_009'
] as const;

export type RhPulseReadinessCheck = {
  id:
    | 'calls_feature_flag'
    | 'postgres'
    | 'migration_007'
    | 'migration_008'
    | 'migration_009'
    | 'pulse_public_host'
    | 'internal_token'
    | 'rate_limit_secret'
    | 'walletconnect_project'
    | 'receipt_renderer'
    | 'open_window_authority'
    | 'window_methodology'
    | 'source_health'
    | 'physical_wallet_gate';
  state: 'pass' | 'fail' | 'not_required';
  detail: string;
};

export type RhPulseProductionReadiness = {
  generated_at: string;
  status: 'disabled' | 'blocked' | 'ready';
  calls_enabled: boolean;
  launch_allowed: boolean;
  checks: RhPulseReadinessCheck[];
  blockers: string[];
  migrations: {
    required: readonly string[];
    applied: string[];
    missing: string[];
  };
  open_window: {
    count: number | null;
    id: string | null;
    methodology_version: string | null;
    source_health: string | null;
    accepting_by_server_time: boolean | null;
  };
  physical_wallet_gate: {
    operator_attested: boolean;
    automated_test: false;
  };
};

type Queryable = Pick<pg.Pool, 'query'>;

export async function inspectRhPulseProductionReadiness(input: {
  pool: Queryable | null;
  config: RuntimeConfig;
  rendererProbe?: () => boolean;
  now?: () => Date;
}): Promise<RhPulseProductionReadiness> {
  const now = input.now?.() ?? new Date();
  const facts = await databaseFacts(input.pool, now);
  const callsEnabled = input.config.rhPulseCallsEnabled;
  const required = (
    id: RhPulseReadinessCheck['id'],
    passed: boolean,
    detail: string
  ): RhPulseReadinessCheck => ({
    id,
    state: passed ? 'pass' : 'fail',
    detail
  });
  const rendererReady = safeRendererProbe(input.rendererProbe);
  const pulseHostValid = normalizePublicHostname(input.config.pulsePublicHost)
    === input.config.pulsePublicHost;
  const migrationChecks = RH_PULSE_REQUIRED_MIGRATIONS.map((migrationId, index) => required(
    `migration_00${index + 7}` as RhPulseReadinessCheck['id'],
    facts.appliedMigrations.includes(migrationId),
    facts.appliedMigrations.includes(migrationId)
      ? `${migrationId} is recorded in the migration ledger.`
      : `${migrationId} is not recorded in the migration ledger.`
  ));
  const openAuthorityReady = facts.openWindowCount !== null
    && facts.openWindowCount <= 1
    && facts.openWindowAccepting !== false;
  const windowMethodologyReady = !facts.openWindowMethodology
    || facts.openWindowMethodology === RH_PULSE_CALL_METHODOLOGY_VERSION;
  const sourceHealthReady = !facts.openWindowSourceHealth
    || ['live', 'delayed'].includes(facts.openWindowSourceHealth);
  const checks: RhPulseReadinessCheck[] = [
    {
      id: 'calls_feature_flag',
      state: callsEnabled ? 'pass' : 'not_required',
      detail: callsEnabled
        ? 'RH_PULSE_CALLS_ENABLED=true was set explicitly.'
        : 'Calls are disabled; read-only RH Pulse remains available.'
    },
    required(
      'postgres',
      facts.databaseReachable,
      facts.databaseReachable ? 'PostgreSQL is reachable.' : 'PostgreSQL is unavailable or not configured.'
    ),
    ...migrationChecks,
    required(
      'pulse_public_host',
      pulseHostValid,
      pulseHostValid ? 'The trusted Pulse public hostname is valid.' : 'PULSE_PUBLIC_HOST is invalid.'
    ),
    required(
      'internal_token',
      (input.config.rhPulseInternalToken?.length ?? 0) >= 32,
      'Production internal bearer credentials require at least 32 characters.'
    ),
    required(
      'rate_limit_secret',
      (input.config.rhPulseRateLimitSecret?.length ?? 0) >= 32,
      'The HMAC rate-limit secret requires at least 32 characters.'
    ),
    required(
      'walletconnect_project',
      Boolean(input.config.walletConnectProjectId),
      input.config.walletConnectProjectId
        ? 'WalletConnect handoff is configured.'
        : 'VITE_WALLETCONNECT_PROJECT_ID is missing.'
    ),
    required(
      'receipt_renderer',
      rendererReady,
      rendererReady ? 'Server-side receipt rendering is available.' : 'Server-side receipt rendering is unavailable.'
    ),
    required(
      'open_window_authority',
      openAuthorityReady,
      facts.openWindowCount === 0
        ? 'No window is open; a validated manual launch may open one later.'
        : openAuthorityReady
          ? 'At most one server-time-valid window is open.'
          : 'Open-window durable authority is invalid or unavailable.'
    ),
    required(
      'window_methodology',
      windowMethodologyReady,
      windowMethodologyReady
        ? 'The open window uses the supported frozen methodology.'
        : 'The open window methodology is unsupported.'
    ),
    required(
      'source_health',
      sourceHealthReady,
      sourceHealthReady
        ? 'Open-window source health is acceptable.'
        : 'Open-window source health is stale or unavailable.'
    ),
    required(
      'physical_wallet_gate',
      input.config.rhPulsePhysicalWalletGatePassed,
      input.config.rhPulsePhysicalWalletGatePassed
        ? 'An operator attested that the physical-device matrix passed.'
        : 'The physical-device wallet matrix has not been attested.'
    )
  ];
  const blockers = checks
    .filter(({ state }) => state === 'fail')
    .map(({ id }) => id);
  return {
    generated_at: now.toISOString(),
    status: !callsEnabled ? 'disabled' : blockers.length ? 'blocked' : 'ready',
    calls_enabled: callsEnabled,
    launch_allowed: callsEnabled && blockers.length === 0,
    checks,
    blockers,
    migrations: {
      required: RH_PULSE_REQUIRED_MIGRATIONS,
      applied: facts.appliedMigrations,
      missing: RH_PULSE_REQUIRED_MIGRATIONS.filter((id) => !facts.appliedMigrations.includes(id))
    },
    open_window: {
      count: facts.openWindowCount,
      id: facts.openWindowId,
      methodology_version: facts.openWindowMethodology,
      source_health: facts.openWindowSourceHealth,
      accepting_by_server_time: facts.openWindowAccepting
    },
    physical_wallet_gate: {
      operator_attested: input.config.rhPulsePhysicalWalletGatePassed,
      automated_test: false
    }
  };
}

async function databaseFacts(pool: Queryable | null, now: Date) {
  const unavailable = {
    databaseReachable: false,
    appliedMigrations: [] as string[],
    openWindowCount: null as number | null,
    openWindowId: null as string | null,
    openWindowMethodology: null as string | null,
    openWindowSourceHealth: null as string | null,
    openWindowAccepting: null as boolean | null
  };
  if (!pool) return unavailable;
  try {
    const ledgerExists = await pool.query<{ exists: string | null }>(
      "select to_regclass('public.infopunks_schema_migrations')::text as exists"
    );
    const appliedMigrations = ledgerExists.rows[0]?.exists
      ? (await pool.query<{ migration_id: string }>(
        'select migration_id from infopunks_schema_migrations where migration_id=any($1::text[]) order by migration_id',
        [RH_PULSE_REQUIRED_MIGRATIONS]
      )).rows.map(({ migration_id }) => migration_id)
      : [];
    const windowsTable = await pool.query<{ exists: string | null }>(
      "select to_regclass('public.rh_pulse_windows')::text as exists"
    );
    if (!windowsTable.rows[0]?.exists) {
      return { ...unavailable, databaseReachable: true, appliedMigrations, openWindowCount: 0 };
    }
    const windows = await pool.query<{
      id: string;
      methodology_version: string;
      source_health: { state?: unknown } | null;
      opens_at: Date | string;
      call_submission_closes_at: Date | string;
    }>(
      `select id,methodology_version,source_health,opens_at,call_submission_closes_at
       from rh_pulse_windows where status='open' order by sequence_number`
    );
    const open = windows.rows[0] ?? null;
    const sourceState = open?.source_health
      && typeof open.source_health.state === 'string'
      ? open.source_health.state
      : null;
    const accepting = open
      ? now.getTime() >= Date.parse(String(open.opens_at))
        && now.getTime() < Date.parse(String(open.call_submission_closes_at))
      : windows.rows.length === 0
        ? null
        : false;
    return {
      databaseReachable: true,
      appliedMigrations,
      openWindowCount: windows.rows.length,
      openWindowId: open?.id ?? null,
      openWindowMethodology: open?.methodology_version ?? null,
      openWindowSourceHealth: sourceState,
      openWindowAccepting: accepting
    };
  } catch {
    return unavailable;
  }
}

function safeRendererProbe(probe?: () => boolean) {
  try {
    if (probe) return probe();
    const png = renderSvgPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>',
      1
    );
    return png.length > 8 && png.subarray(1, 4).toString('ascii') === 'PNG';
  } catch {
    return false;
  }
}
