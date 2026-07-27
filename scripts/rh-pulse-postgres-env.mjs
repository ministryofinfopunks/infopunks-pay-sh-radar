import {
  RH_PULSE_GATE_DATABASE_URL,
  assertPinnedPostgres,
  gateClusterStatus,
  resetGateDatabase,
  startGateCluster,
  stopGateCluster
} from './lib/rh-pulse-postgres-gate-env.mjs';

const command = process.argv[2];

try {
  if (command === 'up') {
    const result = startGateCluster();
    process.stdout.write(`${JSON.stringify({ state: 'running', ...result })}\n`);
  } else if (command === 'reset') {
    resetGateDatabase();
    process.stdout.write(`${JSON.stringify({ state: 'reset', databaseUrl: RH_PULSE_GATE_DATABASE_URL })}\n`);
  } else if (command === 'stop') {
    stopGateCluster();
    process.stdout.write(`${JSON.stringify({ state: 'stopped' })}\n`);
  } else if (command === 'down') {
    stopGateCluster({ destroy: true });
    process.stdout.write(`${JSON.stringify({ state: 'destroyed' })}\n`);
  } else if (command === 'status') {
    process.stdout.write(`${JSON.stringify({
      state: gateClusterStatus(),
      postgres: assertPinnedPostgres(),
      databaseUrl: RH_PULSE_GATE_DATABASE_URL
    })}\n`);
  } else if (command === 'url') {
    process.stdout.write(`${RH_PULSE_GATE_DATABASE_URL}\n`);
  } else {
    throw new Error('Usage: rh-pulse-postgres-env.mjs <up|reset|stop|down|status|url>');
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'rh_pulse_postgres_env_failed'}\n`);
  process.exitCode = 1;
}

