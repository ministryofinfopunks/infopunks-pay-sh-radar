import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  RH_PULSE_GATE_DATABASE_URL,
  resetGateDatabase,
  startGateCluster,
  stopGateCluster
} from './lib/rh-pulse-postgres-gate-env.mjs';
import { applyGateMigrations } from './rh-pulse-postgres-migrate.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
let exitCode = 1;

try {
  const environment = startGateCluster();
  resetGateDatabase();
  const migrations = await applyGateMigrations();
  process.stdout.write(`${JSON.stringify({
    event: 'rh_pulse_postgres_gate_ready',
    postgres: environment.version,
    migrations: migrations.map(({ migrationId, state, durationMs }) => ({ migrationId, state, durationMs }))
  })}\n`);
  const result = spawnSync(
    process.execPath,
    [
      join(repositoryRoot, 'node_modules/vitest/vitest.mjs'),
      'run',
      'integration/rh-pulse-postgres-gate.test.ts',
      '--no-file-parallelism',
      '--reporter=verbose'
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        RH_PULSE_POSTGRES_GATE: '1',
        RH_PULSE_TEST_DATABASE_URL: RH_PULSE_GATE_DATABASE_URL,
        RH_PULSE_CALLS_ENABLED: 'false'
      },
      stdio: 'inherit'
    }
  );
  exitCode = result.status ?? 1;
  if (result.error) throw result.error;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : 'rh_pulse_postgres_gate_failed'}\n`);
  exitCode = 1;
} finally {
  try {
    stopGateCluster({ destroy: true });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'rh_pulse_postgres_teardown_failed'}\n`);
    exitCode = 1;
  }
}

process.exitCode = exitCode;

