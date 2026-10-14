import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig } from '../src/config/env';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { configureTestTenant, testTenantKey } from './helpers/judgmentDx';
import { request } from './helpers/judgments';
import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';

function productionEnvironment() {
  for (const [name, value] of Object.entries({ NODE_ENV: 'production', PORT: '10000',
    DATABASE_URL: 'postgresql://radar-ci-synthetic@127.0.0.1:1/radar_ci', PAYSH_CATALOG_SOURCE: 'live',
    PAY_SH_CATALOG_URL: 'https://catalog.invalid/providers', PAYSH_ALLOW_FIXTURE_FALLBACK: 'false',
    PAYSH_BOOTSTRAP_ENABLED: 'false', INGESTION_ENABLED: 'false', JUDGMENT_PAYMENT_ENABLED: 'false',
    MACHINE_EXECUTION_ENABLED: 'false', MONITOR_ENABLED: 'false', MONITOR_MODE: 'disabled',
    RADAR_CONTROLLED_STAGING: 'false', JUDGMENT_SIGNING_PRIVATE_KEY: '', JUDGMENT_ISSUER_KEYS_JSON: '', ADMIN_TOKEN: '', INFOPUNKS_ADMIN_TOKEN: '' })) vi.stubEnv(name, value);
  configureTestTenant();
}
afterEach(() => vi.unstubAllEnvs());

describe('production read-only release authority', () => {
  it.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('keeps disabled payments, absent signing and denied private reads safe in production mode', async () => {
    const db = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'production_readonly', [
      '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261008_018_decision_context',
      '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts', '20261008_022_publication_boundaries']);
    productionEnvironment();
    const databaseUrl = new URL(process.env.CANONICAL_RECEIPT_TEST_URL!);
    databaseUrl.searchParams.set('options', '-c search_path=' + db.schema);
    vi.stubEnv('DATABASE_URL', databaseUrl.href);
    const store = new PostgresCanonicalReceiptStore(db.pool);
    const journal = new PostgresJudgmentRequestRepository(db.pool);
    const app = await createApp(emptyIntelligenceStore(), undefined, { judgmentReceiptStore: store, judgmentRequestJournal: journal }).catch(async error => { await db.close(); throw error; });
    try {
      for (const authorization of [undefined, 'Bearer forged-not-a-credential']) {
        for (const url of ['/v1/judgment/session', '/v1/receipt-spine/judgment/judgment_' + '0'.repeat(64) + '/context']) {
          const denied = await app.inject({ url, headers: authorization ? { authorization } : {} });
          expect(denied.statusCode).toBe(401);
          expect(denied.headers['cache-control']).toContain('no-store');
          expect(denied.json()).not.toHaveProperty('data');
        }
      }
      const keys = await app.inject('/v1/judgment-issuer/keys');
      expect(keys.statusCode).toBe(503);
      expect(keys.json().error).toBe('judgment_issuer_unavailable');
      const free = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request,
        headers: { authorization: 'Bearer ' + testTenantKey, 'idempotency-key': 'production-read-only' } });
      expect(free.statusCode).toBe(200);
      expect(free.headers['payment-required']).toBeUndefined();
      expect(free.json()).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, cost: { amount: '0' }, receipt: null });
      expect(await store.list('judgment')).toHaveLength(0);
      expect(await store.list('execution')).toHaveLength(0);
      const pulse = await app.inject('/v1/pulse');
      expect(pulse.json().data).toMatchObject({ providerCount: 0, live_catalog_state: 'unavailable', data_source: { used_fixture: false } });
      expect(pulse.json().data.data_source.error).toBeTruthy();
      const ready = await app.inject('/readyz');
      expect(ready.statusCode).toBe(503);
      expect(ready.json()).toMatchObject({ ok: false });
      expect(ready.json().reasons.some((reason: { code: string }) => ['live_catalog_unavailable', 'live_catalog_degraded'].includes(reason.code))).toBe(true);
      const origin = await app.listen({ port: 0, host: '127.0.0.1' });
      const smoke = await promisify(execFile)(process.execPath, ['scripts/smoke-radar-read-only.mjs'], { env: { ...process.env,
        RADAR_SMOKE_BASE_URL: origin, RADAR_SMOKE_ALLOW_LOCAL_HTTP: 'true', RADAR_SMOKE_EXPECT_IDENTITY_CONFIGURED: 'true',
        RADAR_SMOKE_EXPECT_DEGRADED_CATALOG: 'true', RADAR_SMOKE_OUTPUT_DIR: 'output/production-boundary-smoke' } });
      expect(JSON.parse(smoke.stdout).result).toBe('PASS');
    } finally { await app.close(); await db.close(); }
  });
  it('rejects an unqualified payment configuration without signing before server creation', () => {
    productionEnvironment();
    expect(() => loadRuntimeConfig({ ...process.env, JUDGMENT_PAYMENT_ENABLED: 'true' })).toThrow('production_judgment_signing_required');
  });
});
