import { createHmac } from 'node:crypto';
import type pg from 'pg';

export type RhPulseRateLimitBucketType =
  | 'challenge_wallet'
  | 'challenge_origin'
  | 'call_challenge'
  | 'invalid_signature'
  | 'internal_mutation';

export type RhPulseRateLimitPolicy = {
  maximum: number;
  windowMs: number;
};

export type RhPulseRateLimitDecision = {
  allowed: boolean;
  requestCount: number;
  retryAfterSeconds: number;
  bucketType: RhPulseRateLimitBucketType;
  bucketKey: string;
};

export type RhPulseRateLimitStore = {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  consume(input: {
    bucketKey: string;
    bucketType: RhPulseRateLimitBucketType;
    maximum: number;
    windowMs: number;
  }): Promise<RhPulseRateLimitDecision>;
  cleanup(limit?: number): Promise<number>;
};

export class RhPulseRateLimitUnavailableError extends Error {
  readonly code = 'rate_limit_storage_unavailable';
}

export class RhPulseDistributedRateLimiter {
  private cleanupCounter = 0;

  constructor(
    readonly store: RhPulseRateLimitStore,
    private readonly secret: string,
    readonly secretVersion = 'v1',
    private readonly observe?: (entry: {
      bucketType: RhPulseRateLimitBucketType;
      allowed: boolean;
      requestCount: number;
      retryAfterSeconds: number;
      adapter: RhPulseRateLimitStore['adapter'];
    }) => void
  ) {
    if (!/^v[0-9]+$/.test(secretVersion)) {
      throw new Error('RH Pulse rate-limit secret version must match v<number>');
    }
  }

  digest(scope: string, identifier: string) {
    return createHmac('sha256', this.secret)
      .update(`${scope}\u0000${identifier}`, 'utf8')
      .digest('hex');
  }

  async consume(
    bucketType: RhPulseRateLimitBucketType,
    identifier: string,
    policy: RhPulseRateLimitPolicy
  ) {
    const bucketKey = `${this.secretVersion}:${this.digest(bucketType, identifier)}`;
    try {
      const result = await this.store.consume({
        bucketKey,
        bucketType,
        maximum: policy.maximum,
        windowMs: policy.windowMs
      });
      this.cleanupCounter += 1;
      if (this.cleanupCounter % 250 === 0) {
        void this.store.cleanup(250).catch(() => undefined);
      }
      this.observe?.({
        bucketType,
        allowed: result.allowed,
        requestCount: result.requestCount,
        retryAfterSeconds: result.retryAfterSeconds,
        adapter: this.store.adapter
      });
      return result;
    } catch (error) {
      throw new RhPulseRateLimitUnavailableError(
        error instanceof Error ? error.message : 'rate_limit_storage_unavailable'
      );
    }
  }

  cleanup(limit = 500) {
    return this.store.cleanup(Math.max(1, Math.min(limit, 1_000)));
  }
}

export class InMemoryRhPulseRateLimitStore implements RhPulseRateLimitStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly buckets = new Map<string, {
    bucketType: RhPulseRateLimitBucketType;
    windowStartedAt: number;
    requestCount: number;
    blockedUntil: number | null;
    expiresAt: number;
  }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async consume(input: {
    bucketKey: string;
    bucketType: RhPulseRateLimitBucketType;
    maximum: number;
    windowMs: number;
  }): Promise<RhPulseRateLimitDecision> {
    const now = this.now();
    const prior = this.buckets.get(input.bucketKey);
    const current = !prior || prior.expiresAt <= now
      ? {
        bucketType: input.bucketType,
        windowStartedAt: now,
        requestCount: 1,
        blockedUntil: null,
        expiresAt: now + input.windowMs
      }
      : {
        ...prior,
        requestCount: prior.requestCount + 1,
        blockedUntil: prior.requestCount + 1 > input.maximum ? prior.expiresAt : prior.blockedUntil
      };
    this.buckets.set(input.bucketKey, current);
    return {
      allowed: current.requestCount <= input.maximum && current.blockedUntil === null,
      requestCount: current.requestCount,
      retryAfterSeconds: current.blockedUntil
        ? Math.max(1, Math.ceil((current.blockedUntil - now) / 1_000))
        : 0,
      bucketType: input.bucketType,
      bucketKey: input.bucketKey
    };
  }

  async cleanup(limit = 500) {
    const now = this.now();
    let deleted = 0;
    for (const [key, bucket] of this.buckets) {
      if (deleted >= limit) break;
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }
}

export class PostgresRhPulseRateLimitStore implements RhPulseRateLimitStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;

  constructor(private readonly pool: Pick<pg.Pool, 'query'>) {}

  async consume(input: {
    bucketKey: string;
    bucketType: RhPulseRateLimitBucketType;
    maximum: number;
    windowMs: number;
  }): Promise<RhPulseRateLimitDecision> {
    const result = await this.pool.query<{
      request_count: number;
      allowed: boolean;
      retry_after_seconds: number | string;
    }>(
      `with consumed as (
         insert into rh_pulse_rate_limit_buckets
           (bucket_key,bucket_type,window_started_at,request_count,blocked_until,updated_at,expires_at)
         values (
           $1,$2,clock_timestamp(),1,null,clock_timestamp(),
           clock_timestamp()+($4::bigint * interval '1 millisecond')
         )
         on conflict (bucket_key) do update set
           bucket_type=excluded.bucket_type,
           window_started_at=case
             when rh_pulse_rate_limit_buckets.expires_at <= clock_timestamp()
             then clock_timestamp()
             else rh_pulse_rate_limit_buckets.window_started_at
           end,
           request_count=case
             when rh_pulse_rate_limit_buckets.expires_at <= clock_timestamp()
             then 1
             else rh_pulse_rate_limit_buckets.request_count+1
           end,
           blocked_until=case
             when rh_pulse_rate_limit_buckets.expires_at <= clock_timestamp()
             then null
             when rh_pulse_rate_limit_buckets.request_count+1 > $3
             then rh_pulse_rate_limit_buckets.expires_at
             else rh_pulse_rate_limit_buckets.blocked_until
           end,
           updated_at=clock_timestamp(),
           expires_at=case
             when rh_pulse_rate_limit_buckets.expires_at <= clock_timestamp()
             then clock_timestamp()+($4::bigint * interval '1 millisecond')
             else rh_pulse_rate_limit_buckets.expires_at
           end
         returning request_count,blocked_until,expires_at
       )
       select
         request_count,
         request_count <= $3 and blocked_until is null as allowed,
         case
           when blocked_until is null then 0
           else greatest(1,ceil(extract(epoch from (blocked_until-clock_timestamp()))))
         end as retry_after_seconds
       from consumed`,
      [input.bucketKey, input.bucketType, input.maximum, input.windowMs]
    );
    const row = result.rows[0];
    if (!row) throw new Error('rate_limit_consume_failed');
    return {
      allowed: row.allowed,
      requestCount: Number(row.request_count),
      retryAfterSeconds: Number(row.retry_after_seconds),
      bucketType: input.bucketType,
      bucketKey: input.bucketKey
    };
  }

  async cleanup(limit = 500) {
    const result = await this.pool.query(
      `delete from rh_pulse_rate_limit_buckets
       where ctid in (
         select ctid from rh_pulse_rate_limit_buckets
         where expires_at <= clock_timestamp()
         order by expires_at
         limit $1
       )`,
      [Math.max(1, Math.min(limit, 1_000))]
    );
    return result.rowCount ?? 0;
  }
}
