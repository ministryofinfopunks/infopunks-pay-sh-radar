import type { RhChainDataFreshness } from '../data/rhChain';
import { calculateFreshness, freshnessSourceMode, type FreshnessState } from '../shared/timestamps';

export type RhChainFreshnessState = FreshnessState | 'source_required';

const IDENTITY_PLACEHOLDERS = new Set([
  'unverified_contract_required', 'source_required', 'contract_required', 'unknown', 'tbd', 'null', 'undefined', ''
]);

/** A contract can establish a dossier identity only when it is not a desk placeholder. */
export function isRhChainIdentityContract(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (IDENTITY_PLACEHOLDERS.has(normalized)) return false;
  if (/^0x(?:manualresearchseed|placeholder|example|unknown|unverified)/.test(normalized)) return false;
  if (/^0x0{40}$/.test(normalized)) return false;
  return true;
}

/** Derives freshness from source mode and a timezone-qualified observed timestamp. */
export function getRhChainFreshnessState(observed_at: string | null | undefined, data_mode: RhChainDataFreshness | null | undefined, now = new Date()): RhChainFreshnessState {
  return calculateFreshness(observed_at, freshnessSourceMode(data_mode), now);
}
