import { createApp } from './api/app';
import { deploymentSummary, loadRuntimeConfig, verifyRuntimeConfiguration } from './config/env';

async function main() {
  const config = loadRuntimeConfig();
  const verification = verifyRuntimeConfiguration();
  console.log(JSON.stringify(verification));
  for (const [feature, reason] of Object.entries(config.disabledFeatures)) {
    console.error(JSON.stringify({ event: 'optional_feature_disabled', severity: 'critical', feature, reason }));
  }
  const app = await createApp();
  let shuttingDown = false;
  const shutdown = async (signal: 'SIGTERM' | 'SIGINT') => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: 'shutdown_started', signal }));
    try {
      await app.close();
      console.log(JSON.stringify({ event: 'shutdown_complete', signal }));
      process.exit(0);
    } catch (error) {
      console.error(JSON.stringify({ event: 'shutdown_failed', signal, error: error instanceof Error ? error.message : String(error) }));
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(JSON.stringify({ event: 'startup', ...deploymentSummary(config) }));
}

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ event: 'unhandled_rejection', error: safeRuntimeError(reason) }));
  // Logging must not turn a fatal programmer/runtime error into a live but
  // corrupt process. Let Render replace this process after the log flushes.
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
});
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ event: 'uncaught_exception', error: safeRuntimeError(error), stack: error.stack ? redactRuntimeText(error.stack) : null }));
  process.exit(1);
});

main().catch((error) => {
  console.error(JSON.stringify({ event: 'startup_failed', error: safeRuntimeError(error) }));
  process.exit(1);
});

function safeRuntimeError(error: unknown) {
  return redactRuntimeText(error instanceof Error ? error.message : String(error));
}

function redactRuntimeText(value: string) {
  return value
    .replace(/\b(?:postgres(?:ql)?:\/\/|[a-z][a-z0-9+.-]*:\/\/)[^\s"']+/gi, '[redacted-url]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [redacted]');
}
