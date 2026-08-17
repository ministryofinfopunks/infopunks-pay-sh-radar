import pg from 'pg';
import { getDatabasePool, parseDatabasePoolMax } from './databasePool';
import { classifyPostgresFailure, postgresErrorCode, safeOperationalErrorMessage, type PostgresFailureKind } from './postgresErrors';

export type PostgresSchemaReadiness = 'idle' | 'checking' | 'ready' | 'degraded';

export type PostgresSchemaDiagnostics = {
  service: string;
  operation: 'ensure_schema';
  readiness: PostgresSchemaReadiness;
  failure_kind: PostgresFailureKind | null;
  error_code: string | null;
};

export type RhChainStorageDiagnostics = {
  adapter: 'postgres' | 'unconfigured';
  durable: boolean;
  readiness: 'not_configured' | PostgresSchemaReadiness;
  failure_kind: PostgresFailureKind | null;
  error_code: string | null;
  missing_tables: string[];
};

export type PostgresPoolSource = string | pg.Pool;

export function resolvePostgresPool(source: PostgresPoolSource) {
  return typeof source === 'string'
    ? { pool: getDatabasePool({ connectionString: source, max: parseDatabasePoolMax(process.env.DATABASE_POOL_MAX, 10) }), ownsPool: false }
    : { pool: source, ownsPool: false };
}

/**
 * Memoizes successful schema initialization while allowing a later request to
 * retry after a transient connection or DDL failure. A rejected promise must
 * never poison a long-lived service instance.
 */
export class RetryablePostgresSchema {
  private inFlight: Promise<void> | null = null;
  private readiness: PostgresSchemaReadiness = 'idle';
  private failureKind: PostgresFailureKind | null = null;
  private errorCode: string | null = null;

  constructor(private readonly service: string) {}

  ensure(pool: Pick<pg.Pool, 'query'>, sql: string): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const wasDegraded = this.readiness === 'degraded';
    this.readiness = 'checking';
    this.inFlight = pool.query(sql)
      .then(() => {
        this.readiness = 'ready';
        this.failureKind = null;
        this.errorCode = null;
        if (wasDegraded) {
          console.log(JSON.stringify({
            event: 'rh_chain_storage_recovered',
            service: this.service,
            operation: 'ensure_schema'
          }));
        }
      })
      .catch((error: unknown) => {
        this.readiness = 'degraded';
        this.failureKind = classifyPostgresFailure(error, 'schema');
        this.errorCode = postgresErrorCode(error);
        // Clear only the failed attempt. The next request may recover without a
        // process restart once Postgres or the schema is available again.
        this.inFlight = null;
        console.log(JSON.stringify({
          event: 'rh_chain_storage_failure',
          service: this.service,
          operation: 'ensure_schema',
          failure_kind: this.failureKind,
          error_code: this.errorCode
        }));
        throw error;
      });
    return this.inFlight;
  }

  diagnostics(): PostgresSchemaDiagnostics {
    return {
      service: this.service,
      operation: 'ensure_schema',
      readiness: this.readiness,
      failure_kind: this.failureKind,
      error_code: this.errorCode
    };
  }
}

export class RhChainPostgresReadiness {
  private current: RhChainStorageDiagnostics = {
    adapter: 'postgres',
    durable: true,
    readiness: 'idle',
    failure_kind: null,
    error_code: null,
    missing_tables: []
  };
  private inFlight: Promise<void> | null = null;

  check(pool: Pick<pg.Pool, 'query'>, expectedTables: readonly string[]): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.current = { ...this.current, readiness: 'checking' };
    this.inFlight = pool.query<{ table_name: string }>(
      'select table_name from unnest($1::text[]) as expected(table_name) where to_regclass(table_name) is null order by table_name',
      [expectedTables]
    ).then((result) => {
      const missingTables = result.rows.map((row) => row.table_name);
      this.current = {
        adapter: 'postgres',
        durable: true,
        readiness: missingTables.length ? 'degraded' : 'ready',
        failure_kind: missingTables.length ? 'schema' : null,
        error_code: null,
        missing_tables: missingTables
      };
      if (missingTables.length) {
        console.log(JSON.stringify({
          event: 'rh_chain_storage_readiness',
          readiness: 'degraded',
          failure_kind: 'schema',
          missing_tables: missingTables
        }));
      }
    }).catch((error: unknown) => {
      this.current = {
        adapter: 'postgres',
        durable: true,
        readiness: 'degraded',
        failure_kind: classifyPostgresFailure(error, 'query'),
        error_code: postgresErrorCode(error),
        missing_tables: []
      };
      console.log(JSON.stringify({
        event: 'rh_chain_storage_readiness',
        readiness: 'degraded',
        failure_kind: this.current.failure_kind,
        error_code: this.current.error_code
      }));
    }).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  diagnostics(): RhChainStorageDiagnostics {
    return { ...this.current, missing_tables: [...this.current.missing_tables] };
  }
}

export { classifyPostgresFailure, postgresErrorCode, safeOperationalErrorMessage };
