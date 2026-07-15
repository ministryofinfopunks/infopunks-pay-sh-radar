export type FreshnessState = 'live' | 'fresh' | 'aging' | 'stale' | 'unavailable' | 'unknown';

export type FreshnessSourceMode = 'live' | 'cached' | 'manual' | 'unavailable' | 'unknown';

export type FreshnessThresholds = {
  liveMs?: number;
  freshMs: number;
  agingMs: number;
  futureToleranceMs: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Central evidence-freshness policy.
 *
 * Manual and seeded memory must be observed within 24 hours to be fresh and is
 * stale after 72 hours. Cached provider context has a much shorter live window;
 * it remains usable as aging context for at most 24 hours. A five-minute clock
 * skew is tolerated, while timestamps further in the future are unknown.
 */
export const FRESHNESS_POLICIES: Readonly<Record<'manual' | 'cached' | 'live', FreshnessThresholds>> = Object.freeze({
  manual: Object.freeze({ freshMs: 24 * HOUR_MS, agingMs: 72 * HOUR_MS, futureToleranceMs: 5 * MINUTE_MS }),
  cached: Object.freeze({ liveMs: 5 * MINUTE_MS, freshMs: HOUR_MS, agingMs: 24 * HOUR_MS, futureToleranceMs: 5 * MINUTE_MS }),
  live: Object.freeze({ liveMs: 5 * MINUTE_MS, freshMs: HOUR_MS, agingMs: 6 * HOUR_MS, futureToleranceMs: 5 * MINUTE_MS })
});

const ISO_TIMESTAMP_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_WITH_ZONE.test(value.trim())) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function freshnessSourceMode(value: string | null | undefined): FreshnessSourceMode {
  if (value === 'unavailable') return 'unavailable';
  if (value === 'live') return 'live';
  if (value === 'cached' || value === 'live_cached') return 'cached';
  if (value === 'manual' || value === 'seeded' || value === 'community_submission' || value === 'persisted') return 'manual';
  return 'unknown';
}

export function calculateFreshness(
  value: string | null | undefined,
  sourceMode: FreshnessSourceMode,
  now: Date | number = Date.now()
): FreshnessState {
  if (sourceMode === 'unavailable') return 'unavailable';
  if (sourceMode === 'unknown') return 'unknown';
  const observedAt = parseTimestamp(value);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  if (observedAt === null || !Number.isFinite(nowMs)) return 'unknown';
  const policy = FRESHNESS_POLICIES[sourceMode];
  const rawAgeMs = nowMs - observedAt;
  if (rawAgeMs < -policy.futureToleranceMs) return 'unknown';
  const ageMs = Math.max(0, rawAgeMs);
  if (policy.liveMs !== undefined && ageMs < policy.liveMs) return 'live';
  if (ageMs < policy.freshMs) return 'fresh';
  if (ageMs <= policy.agingMs) return 'aging';
  return 'stale';
}

export function formatAbsoluteUtc(value: string | null | undefined): string {
  const parsed = parseTimestamp(value);
  if (parsed === null) return 'Timestamp unavailable';
  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).format(parsed)} UTC`;
}

export function formatUtcCompact(value: string | null | undefined): string {
  const parsed = parseTimestamp(value);
  if (parsed === null) return 'timestamp unavailable';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC'
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} UTC`;
}

export function formatUserLocal(
  value: string | null | undefined,
  options: { locale?: string; timeZone?: string } = {}
): string {
  const parsed = parseTimestamp(value);
  if (parsed === null) return 'Timestamp unavailable';
  return new Intl.DateTimeFormat(options.locale ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timeZone
  }).format(parsed);
}

export function formatRelativeAge(value: string | null | undefined, now: Date | number = Date.now()): string {
  const parsed = parseTimestamp(value);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  if (parsed === null || !Number.isFinite(nowMs)) return 'Age unavailable';
  const deltaMs = nowMs - parsed;
  if (deltaMs < -FRESHNESS_POLICIES.manual.futureToleranceMs) return 'Timestamp is in the future';
  const ageMs = Math.max(0, deltaMs);
  if (ageMs < MINUTE_MS) return 'Updated just now';
  const minutes = Math.floor(ageMs / MINUTE_MS);
  if (minutes < 60) return `Updated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(ageMs / HOUR_MS);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(ageMs / (24 * HOUR_MS));
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function freshnessLabel(state: FreshnessState): string {
  return state[0].toUpperCase() + state.slice(1);
}
