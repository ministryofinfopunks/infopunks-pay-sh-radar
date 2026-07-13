import type { RhChainDataFreshness } from '../data/rhChain';

export type RhChainFreshnessState = 'fresh' | 'aging' | 'stale' | 'source_required' | 'unavailable';

const IDENTITY_PLACEHOLDERS = new Set([
  'unverified_contract_required', 'source_required', 'contract_required', 'unknown', 'tbd', 'null', 'undefined', ''
]);

/** A contract can establish a dossier identity only when it is not a desk placeholder. */
export function isRhChainIdentityContract(value: string | null | undefined): boolean {
  return typeof value === 'string' && !IDENTITY_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Manual memory ages visibly: fresh ≤36h, aging ≤72h, stale thereafter. */
export function getRhChainFreshnessState(observed_at: string | null | undefined, data_mode: RhChainDataFreshness | null | undefined, now = new Date()): RhChainFreshnessState {
  if (data_mode === 'unavailable' || !data_mode) return 'unavailable';
  if (data_mode === 'live_future') return 'source_required';
  if (!observed_at) return 'source_required';
  const observed = Date.parse(observed_at);
  if (!Number.isFinite(observed)) return 'source_required';
  const ageMs = Math.max(0, now.getTime() - observed);
  if (ageMs <= 36 * 60 * 60 * 1000) return 'fresh';
  if (ageMs <= 72 * 60 * 60 * 1000) return 'aging';
  return 'stale';
}
