/** Explicit-origin, GET-only release smoke. Never issues Judgment, settles or mutates receipts. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target = process.env.RADAR_SMOKE_BASE_URL;
if (!target) throw Error('explicit_smoke_origin_required');
const origin = new URL(target);
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('smoke_requires_origin_without_credentials');
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local && process.env.RADAR_SMOKE_ALLOW_LOCAL_HTTP === 'true')) throw Error('smoke_requires_https_or_explicit_local_http');
const checks = [];
async function get(path, validate, headers = {}) {
  const response = await fetch(new URL(path, origin), { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
  const body = await response.json();
  validate(response, body);
  checks.push({ path, status: response.status, result: 'PASS' });
}
const assert = (condition, code) => { if (!condition) throw Error(code); };
try {
  await get('/healthz', (response, body) => assert(response.status === 200 && body.ok === true, 'liveness_failed'));
  for (const authorization of [undefined, 'Bearer radar-smoke-invalid-not-a-credential']) {
    for (const path of ['/v1/judgment/session', '/v1/receipt-spine/judgment/judgment_' + '0'.repeat(64) + '/context']) {
      await get(path, (response, body) => {
        assert(process.env.RADAR_SMOKE_EXPECT_IDENTITY_CONFIGURED === 'true' ? response.status === 401 : [401, 503].includes(response.status), 'private_identity_not_denied');
        assert(response.headers.get('cache-control')?.includes('no-store'), 'private_response_cacheable');
        assert(!body.data && typeof body.error === 'string', 'private_data_disclosure');
      }, authorization ? { authorization } : {});
    }
  }
  await get('/v1/judgment-issuer/keys', (response, body) => assert(response.status === 503 && body.error === 'judgment_issuer_unavailable', 'unexpected_signing_capability'));
  await get('/v1/pulse', (response, body) => {
    assert(response.status === 200 && body.data?.data_source?.used_fixture === false, 'production_fixture_fallback');
    if (process.env.RADAR_SMOKE_EXPECT_DEGRADED_CATALOG === 'true') {
      assert(body.data.providerCount === 0 && body.data.live_catalog_state === 'unavailable' && body.data.data_source.error, 'catalog_failure_not_truthful');
    }
  });
  await get('/readyz', (response, body) => {
    if (process.env.RADAR_SMOKE_EXPECT_DEGRADED_CATALOG === 'true') assert(response.status === 503 && body.ok === false && body.reasons?.some(reason => ['live_catalog_unavailable', 'live_catalog_degraded'].includes(reason.code)), 'degraded_service_reported_ready');
    else assert([200, 503].includes(response.status) && typeof body.ok === 'boolean', 'readiness_response_invalid');
  });
} catch (error) {
  checks.push({ result: 'FAIL', error: error instanceof Error ? error.message : 'smoke_failed' });
  process.exitCode = 1;
}
const output = resolve(process.env.RADAR_SMOKE_OUTPUT_DIR ?? 'output/ci-production');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'read-only-smoke.json'), JSON.stringify({ source_sha: process.env.RADAR_CANDIDATE_SHA ?? null,
  origin: origin.origin, scope: 'GET only; no settlement or execution; synthetic invalid authorization only', checks }, null, 2) + '\n');
console.log(JSON.stringify({ checks, result: process.exitCode ? 'FAIL' : 'PASS' }));
