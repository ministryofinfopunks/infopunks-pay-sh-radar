// Explicit local-only test runtime. No inherited production credentials.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
for (const name of Object.keys(process.env)) if (/TOKEN|PRIVATE_KEY|API_KEY|DATABASE_URL|TEST_URL|JUDGMENT_ISSUER|IPX_LAUNCH/.test(name)) delete process.env[name];
const database = 'postgresql://radar:radar-ui-int2-local-only@localhost:55433/ui_int2_browser';
const identities = [
  ['tenant-a','radar-browser','radar-ci-tenant-a-static-not-secret'],
  ['tenant-b','agent-b','radar-ci-tenant-b-static-not-secret'],
  ['tenant-a','agent-other','radar-ci-tenant-a-wrong-agent-not-secret'],
  ['tenant-expired','agent-expired','radar-ci-tenant-expired-static-not-secret']
];
Object.assign(process.env,{NODE_ENV:'development',DATABASE_URL:database,PAYSH_CATALOG_SOURCE:'fixture',PAYSH_ALLOW_FIXTURE_FALLBACK:'true',PAYSH_BOOTSTRAP_ENABLED:'false',INGESTION_ENABLED:'false',MONITOR_ENABLED:'false',RH_CHAIN_AUTOMATION_ENABLED:'false',JUDGMENT_PAYMENT_ENABLED:'false',MACHINE_EXECUTION_ENABLED:'false',IPX_LAUNCH_ENABLED:'false',FRONTEND_ORIGIN:'http://127.0.0.1:5183',
 JUDGMENT_API_KEYS_JSON:JSON.stringify(identities.map(([tenant_id,agent_id,key],i)=>({tenant_id,agent_id,key_sha256:createHash('sha256').update(key).digest('hex'),...(i===3?{expires_at:'2000-01-01T00:00:00Z'}:{})}))) });
// Signing remains disabled even if an unrelated prior qualification artifact exists.
const require=createRequire(import.meta.url);const {createApp}=require(resolve('dist/server/api/app.js'));
const app=await createApp(undefined,undefined,{clientDistDir:process.env.UI_INT2_TARGET_CLIENT||resolve('dist/client')});
await app.listen({port:8812,host:'127.0.0.1'});
process.on('SIGTERM',async()=>{await app.close();process.exit(0)});
