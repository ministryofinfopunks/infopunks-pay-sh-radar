import { describe, expect, it } from 'vitest';
import {
  calculateFreshness,
  formatAbsoluteUtc,
  formatRelativeAge,
  formatUtcCompact,
  freshnessSourceMode,
  parseTimestamp
} from '../src/shared/timestamps';

const NOW = new Date('2026-07-15T12:00:00.000Z');

describe('shared timestamp presentation', () => {
  it('applies the documented manual snapshot freshness policy', () => {
    expect(calculateFreshness('2026-07-14T12:00:01.000Z', 'manual', NOW)).toBe('fresh');
    expect(calculateFreshness('2026-07-14T12:00:00.000Z', 'manual', NOW)).toBe('aging');
    expect(calculateFreshness('2026-07-12T12:00:00.000Z', 'manual', NOW)).toBe('aging');
    expect(calculateFreshness('2026-07-12T11:59:59.000Z', 'manual', NOW)).toBe('stale');
  });

  it('distinguishes live cached context without calling manual data live', () => {
    expect(calculateFreshness('2026-07-15T11:58:00.000Z', 'cached', NOW)).toBe('live');
    expect(calculateFreshness('2026-07-15T11:58:00.000Z', 'manual', NOW)).toBe('fresh');
    expect(freshnessSourceMode('live_cached')).toBe('cached');
    expect(freshnessSourceMode('manual')).toBe('manual');
  });

  it('returns explicit states for missing, invalid, unavailable, and future timestamps', () => {
    expect(calculateFreshness(null, 'manual', NOW)).toBe('unknown');
    expect(calculateFreshness('not-a-date', 'manual', NOW)).toBe('unknown');
    expect(calculateFreshness('2026-07-15T12:10:00.000Z', 'manual', NOW)).toBe('unknown');
    expect(calculateFreshness(null, 'unavailable', NOW)).toBe('unavailable');
    expect(parseTimestamp('2026-07-15T12:00:00')).toBeNull();
  });

  it('formats stable UTC and relative labels without throwing on invalid input', () => {
    expect(formatAbsoluteUtc('2026-07-09T03:45:00.000Z')).toBe('Jul 9, 2026, 3:45 AM UTC');
    expect(formatUtcCompact('2026-07-09T03:45:00.000Z')).toBe('2026-07-09 03:45 UTC');
    expect(formatRelativeAge('2026-07-09T03:45:00.000Z', NOW)).toBe('Updated 6 days ago');
    expect(formatAbsoluteUtc('invalid')).toBe('Timestamp unavailable');
    expect(formatRelativeAge('invalid', NOW)).toBe('Age unavailable');
    expect(formatRelativeAge('2026-07-15T12:10:00.000Z', NOW)).toBe('Timestamp is in the future');
  });
});
