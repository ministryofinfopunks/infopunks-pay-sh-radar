import { createApp } from './api/app';
import { deploymentSummary, loadRuntimeConfig } from './config/env';

async function main() {
  const config = loadRuntimeConfig();
  const app = await createApp();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(JSON.stringify({ event: 'startup', ...deploymentSummary(config) }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'startup_failed', error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
