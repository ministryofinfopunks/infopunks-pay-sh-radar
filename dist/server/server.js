"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./api/app");
const env_1 = require("./config/env");
async function main() {
    const config = (0, env_1.loadRuntimeConfig)();
    const app = await (0, app_1.createApp)();
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(JSON.stringify({ event: 'startup', ...(0, env_1.deploymentSummary)(config) }));
}
main().catch((error) => {
    console.error(JSON.stringify({ event: 'startup_failed', error: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
});
