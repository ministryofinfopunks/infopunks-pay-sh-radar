import { describe, expect, it } from 'vitest';
import {
  InMemoryRhPulseRateLimitStore,
  RhPulseDistributedRateLimiter,
  RhPulseRateLimitUnavailableError,
  type RhPulseRateLimitStore
} from '../src/services/rhPulseRateLimitService';

describe('RH Pulse distributed rate-limit boundary', () => {
  it('stores only versioned HMAC identifiers and resets after the bounded window', async () => {
    let now = Date.parse('2026-07-23T12:00:00.000Z');
    const store = new InMemoryRhPulseRateLimitStore(() => now);
    const limiter = new RhPulseDistributedRateLimiter(
      store,
      'rate-limit-secret-that-is-at-least-32-characters',
      'v7'
    );
    const identifier = '0x1111111111111111111111111111111111111111';
    const first = await limiter.consume('challenge_wallet', identifier, {
      maximum: 2,
      windowMs: 60_000
    });
    const second = await limiter.consume('challenge_wallet', identifier, {
      maximum: 2,
      windowMs: 60_000
    });
    const blocked = await limiter.consume('challenge_wallet', identifier, {
      maximum: 2,
      windowMs: 60_000
    });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(blocked).toMatchObject({
      allowed: false,
      requestCount: 3,
      bucketType: 'challenge_wallet'
    });
    expect(blocked.bucketKey).toMatch(/^v7:[a-f0-9]{64}$/);
    expect(blocked.bucketKey).not.toContain(identifier);

    now += 60_001;
    await expect(limiter.consume('challenge_wallet', identifier, {
      maximum: 2,
      windowMs: 60_000
    })).resolves.toMatchObject({ allowed: true, requestCount: 1 });
    await expect(limiter.cleanup()).resolves.toBe(0);
  });

  it('separates wallet, origin, challenge, invalid-signature and internal buckets', async () => {
    const limiter = new RhPulseDistributedRateLimiter(
      new InMemoryRhPulseRateLimitStore(),
      'rate-limit-secret-that-is-at-least-32-characters'
    );
    const keys = await Promise.all([
      'challenge_wallet',
      'challenge_origin',
      'call_challenge',
      'invalid_signature',
      'internal_mutation'
    ].map(async (bucketType) => (
      limiter.consume(
        bucketType as Parameters<RhPulseDistributedRateLimiter['consume']>[0],
        'same-private-identifier',
        { maximum: 1, windowMs: 60_000 }
      )
    )));
    expect(new Set(keys.map(({ bucketKey }) => bucketKey)).size).toBe(5);
  });

  it('fails closed when durable storage is unavailable', async () => {
    const unavailableStore: RhPulseRateLimitStore = {
      adapter: 'postgres',
      durable: true,
      consume: async () => {
        throw new Error('database_unavailable');
      },
      cleanup: async () => {
        throw new Error('database_unavailable');
      }
    };
    const limiter = new RhPulseDistributedRateLimiter(
      unavailableStore,
      'rate-limit-secret-that-is-at-least-32-characters'
    );
    await expect(limiter.consume('challenge_origin', '198.51.100.1', {
      maximum: 1,
      windowMs: 60_000
    })).rejects.toBeInstanceOf(RhPulseRateLimitUnavailableError);
  });

  it('rejects ambiguous HMAC version labels', () => {
    expect(() => new RhPulseDistributedRateLimiter(
      new InMemoryRhPulseRateLimitStore(),
      'rate-limit-secret-that-is-at-least-32-characters',
      'current'
    )).toThrow('v<number>');
  });
});
