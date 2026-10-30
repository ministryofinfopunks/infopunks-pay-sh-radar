import { afterEach, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { createApp } from '../src/api/app';
import { getDatabasePool } from '../src/persistence/databasePool';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const databaseUrl = process.env.RADAR_READ_ONLY_POSTGRES_TEST_URL;
const statements: string[] = [];

describe.skipIf(!databaseUrl)('RADAR_READ_ONLY_MODE PostgreSQL instrumentation', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    statements.length = 0;
  });

  it('keeps representative GET, HEAD, and OPTIONS paths from issuing persistent SQL', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', databaseUrl!);
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'true');

    const originalQuery = pg.Client.prototype.query;
    vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (this: pg.Client, ...args: unknown[]) {
      const query = args[0];
      const sql = typeof query === 'string'
        ? query
        : query && typeof query === 'object' && 'text' in query
          ? String((query as { text: unknown }).text)
          : '';
      if (sql) statements.push(sql);
      return originalQuery.apply(this, args as never);
    } as typeof pg.Client.prototype.query);

    const app = await createApp(emptyIntelligenceStore());
    try {
      const pool = getDatabasePool({ connectionString: databaseUrl!, max: 4, readOnly: true });
      const mode = await pool.query<{ default_read_only: string }>("select current_setting('default_transaction_read_only') as default_read_only");
      expect(mode.rows[0]?.default_read_only).toBe('on');

      const start = statements.length;
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).statusCode).not.toBe(503);
      expect((await app.inject({ method: 'GET', url: '/v1/radar/benchmark-summary' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/v1/radar/endpoints' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/v1/4663/frontdoor' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'HEAD', url: '/v1/4663/frontdoor' })).statusCode).toBe(200);
      expect((await app.inject({
        method: 'OPTIONS',
        url: '/v1/4663/frontdoor',
        headers: { origin: 'https://radar.infopunks.fun', 'access-control-request-method': 'GET' }
      })).statusCode).not.toBe(503);

      const mutations = statements.slice(start).filter((sql) => /^(?:\s|\(|\/\*|--)*(?:insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|comment|refresh|vacuum|call|do)\b/i.test(sql)
        || (/^\s*with\b/i.test(sql) && /\b(?:insert|update|delete|merge)\b/i.test(sql)));
      expect(mutations).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
