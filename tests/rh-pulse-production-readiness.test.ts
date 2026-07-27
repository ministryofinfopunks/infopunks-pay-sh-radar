import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig, type RuntimeConfig } from '../src/config/env';
import {
  inspectRhPulseProductionReadiness,
  RH_PULSE_REQUIRED_MIGRATIONS
} from '../src/services/rhPulseProductionReadiness';

describe('RH Pulse production launch readiness', () => {
  it('keeps read-only mode available without launch infrastructure', async () => {
    const readiness = await inspectRhPulseProductionReadiness({
      pool: null,
      config: loadRuntimeConfig({ NODE_ENV: 'test' }),
      rendererProbe: () => true
    });
    expect(readiness).toMatchObject({
      status: 'disabled',
      calls_enabled: false,
      launch_allowed: false,
      physical_wallet_gate: {
        operator_attested: false,
        automated_test: false
      }
    });
    expect(readiness.blockers).toContain('physical_wallet_gate');
    expect(readiness.checks.find(({ id }) => id === 'calls_feature_flag')?.state)
      .toBe('not_required');
  });

  it('reports the full incomplete production matrix without exposing secret values', async () => {
    const readiness = await inspectRhPulseProductionReadiness({
      pool: null,
      config: callsConfig(),
      rendererProbe: () => false
    });
    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'postgres',
      'migration_007',
      'migration_008',
      'migration_009',
      'internal_token',
      'rate_limit_secret',
      'walletconnect_project',
      'receipt_renderer',
      'open_window_authority',
      'physical_wallet_gate'
    ]));
    expect(JSON.stringify(readiness)).not.toContain('secret-that-is');
  });

  it('passes only a complete supported launch configuration', async () => {
    const readiness = await inspectRhPulseProductionReadiness({
      pool: readinessPool(),
      config: callsConfig({
        rhPulseInternalToken: 'internal-token-that-is-at-least-32-characters',
        rhPulseRateLimitSecret: 'rate-limit-secret-that-is-at-least-32-characters',
        walletConnectProjectId: 'walletconnect-project-fixture',
        rhPulsePhysicalWalletGatePassed: true
      }),
      rendererProbe: () => true,
      now: () => new Date('2026-07-23T12:00:00.000Z')
    });
    expect(readiness).toMatchObject({
      status: 'ready',
      calls_enabled: true,
      launch_allowed: true,
      blockers: [],
      migrations: {
        required: RH_PULSE_REQUIRED_MIGRATIONS,
        applied: RH_PULSE_REQUIRED_MIGRATIONS,
        missing: []
      },
      open_window: { count: 0 }
    });
  });

  it.each([
    ['missing migration 007', { appliedMigrations: ['20260723_008', '20260723_009'] }, 'migration_007'],
    ['missing migration 008', { appliedMigrations: ['20260723_007', '20260723_009'] }, 'migration_008'],
    ['missing migration 009', { appliedMigrations: ['20260723_007', '20260723_008'] }, 'migration_009'],
    ['invalid Pulse host', {}, 'pulse_public_host'],
    ['unsupported methodology', { openMethodology: 'rh-pulse-v0.9' }, 'window_methodology'],
    ['stale source health', { openSourceHealth: 'stale' }, 'source_health'],
    ['expired open window', { deadline: '2026-07-23T11:59:59.999Z' }, 'open_window_authority']
  ])('blocks %s', async (_label, poolOptions, blocker) => {
    const config = callsConfig({
      rhPulseInternalToken: 'internal-token-that-is-at-least-32-characters',
      rhPulseRateLimitSecret: 'rate-limit-secret-that-is-at-least-32-characters',
      walletConnectProjectId: 'walletconnect-project-fixture',
      rhPulsePhysicalWalletGatePassed: true,
      ...(blocker === 'pulse_public_host' ? { pulsePublicHost: 'attacker.example/path' } : {})
    });
    const readiness = await inspectRhPulseProductionReadiness({
      pool: readinessPool(poolOptions),
      config,
      rendererProbe: () => true,
      now: () => new Date('2026-07-23T12:00:00.000Z')
    });
    expect(readiness.launch_allowed).toBe(false);
    expect(readiness.blockers).toContain(blocker);
  });

  it('never treats the physical-device attestation as an automated check', async () => {
    const readiness = await inspectRhPulseProductionReadiness({
      pool: readinessPool(),
      config: callsConfig({
        rhPulseInternalToken: 'internal-token-that-is-at-least-32-characters',
        rhPulseRateLimitSecret: 'rate-limit-secret-that-is-at-least-32-characters',
        walletConnectProjectId: 'walletconnect-project-fixture',
        rhPulsePhysicalWalletGatePassed: false
      }),
      rendererProbe: () => true
    });
    expect(readiness.blockers).toContain('physical_wallet_gate');
    expect(readiness.physical_wallet_gate).toEqual({
      operator_attested: false,
      automated_test: false
    });
  });
});

function callsConfig(overrides: Partial<RuntimeConfig> = {}) {
  return {
    ...loadRuntimeConfig({
      NODE_ENV: 'test',
      RH_PULSE_CALLS_ENABLED: 'true'
    }),
    ...overrides
  };
}

function readinessPool(options: {
  appliedMigrations?: string[];
  openMethodology?: string;
  openSourceHealth?: string;
  deadline?: string;
} = {}) {
  const appliedMigrations = options.appliedMigrations ?? [...RH_PULSE_REQUIRED_MIGRATIONS];
  const hasOpen = Boolean(
    options.openMethodology
    || options.openSourceHealth
    || options.deadline
  );
  const query = async (sql: string) => {
    if (sql.includes("to_regclass('public.infopunks_schema_migrations')")) {
      return { rows: [{ exists: 'infopunks_schema_migrations' }], rowCount: 1 };
    }
    if (sql.includes('select migration_id from infopunks_schema_migrations')) {
      return {
        rows: appliedMigrations.map((migration_id) => ({ migration_id })),
        rowCount: appliedMigrations.length
      };
    }
    if (sql.includes("to_regclass('public.rh_pulse_windows')")) {
      return { rows: [{ exists: 'rh_pulse_windows' }], rowCount: 1 };
    }
    if (sql.includes("from rh_pulse_windows where status='open'")) {
      return {
        rows: hasOpen ? [{
          id: 'rhp_window_readiness_fixture',
          methodology_version: options.openMethodology ?? 'rh-pulse-v1.0',
          source_health: {
            state: options.openSourceHealth ?? 'live'
          },
          opens_at: '2026-07-23T11:00:00.000Z',
          call_submission_closes_at: options.deadline ?? '2026-07-23T13:00:00.000Z'
        }] : [],
        rowCount: hasOpen ? 1 : 0
      };
    }
    throw new Error(`unexpected readiness query: ${sql}`);
  };
  return { query } as unknown as Pick<pg.Pool, 'query'>;
}
