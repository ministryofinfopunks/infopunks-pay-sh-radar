import { hermesDeskGeneratedAt, type HermesDecisionState, type HermesRun } from '../data/hermesDesk';
import { createPreSpendSeedState } from '../repositories/preSpendSeedData';
import { promoteHermesClaimCandidate, type HermesClaimReviewState, type HermesReputationImpact } from './hermesClaimPromotion';
import { listHermesRuns } from './hermesBridge';

export type HermesReputationTargetType = 'provider' | 'route' | 'service' | 'unknown';
export type HermesReputationDirection = 'positive' | 'negative' | 'neutral' | 'watch';
export type HermesReputationState = 'trusted' | 'watchlist' | 'unproven' | 'degraded' | 'disputed';

export type HermesReputationLedgerEvent = {
  id: string;
  at: string;
  source_run_id: string;
  source_receipt_id: string;
  source_claim_id: string;
  decision: HermesDecisionState;
  review_state: HermesClaimReviewState;
  direction: HermesReputationDirection;
  magnitude: number;
  summary: string;
  notes: string[];
};

export type HermesReputationLedgerEntry = {
  target_type: HermesReputationTargetType;
  target_id?: string;
  label: string;
  current_state: HermesReputationState;
  trust_score: number;
  impact_total: number;
  positive_count: number;
  negative_count: number;
  watch_count: number;
  neutral_count: number;
  disputed_count: number;
  latest_event_at?: string;
  decision_history: HermesReputationLedgerEvent[];
  source_claim_ids: string[];
  source_receipt_ids: string[];
  source_run_ids: string[];
};

export type HermesReputationLedgerSummary = {
  generated_at: string;
  entry_count: number;
  provider_count: number;
  route_count: number;
  service_count: number;
  unknown_count: number;
  trusted_count: number;
  watchlist_count: number;
  degraded_count: number;
  disputed_count: number;
  entries: HermesReputationLedgerEntry[];
};

type LedgerBuildOptions = {
  generatedAt?: string;
};

type MutableLedgerEntry = Omit<
  HermesReputationLedgerEntry,
  'current_state' | 'trust_score' | 'impact_total' | 'latest_event_at' | 'decision_history' | 'source_claim_ids' | 'source_receipt_ids' | 'source_run_ids'
> & {
  raw_score: number;
  raw_impact_total: number;
  decision_history: HermesReputationLedgerEvent[];
  source_claim_ids: Set<string>;
  source_receipt_ids: Set<string>;
  source_run_ids: Set<string>;
};

const targetRank: Record<HermesReputationTargetType, number> = {
  provider: 0,
  route: 1,
  service: 2,
  unknown: 3
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundImpact(value: number): number {
  return Number(value.toFixed(2));
}

function signedImpact(impact: HermesReputationImpact): number {
  if (impact.direction === 'positive') return impact.magnitude;
  if (impact.direction === 'negative') return -impact.magnitude;
  if (impact.direction === 'watch') return -impact.magnitude * 0.25;
  return 0;
}

function scoreDelta(impact: HermesReputationImpact): number {
  if (impact.direction === 'positive') return impact.magnitude * 50;
  if (impact.direction === 'negative') return -impact.magnitude * 50;
  if (impact.direction === 'watch') return -impact.magnitude * 15;
  return 0;
}

function normalizeTargetType(value: string): HermesReputationTargetType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'provider' || normalized === 'providers') return 'provider';
  if (normalized === 'route' || normalized === 'routes') return 'route';
  if (normalized === 'service' || normalized === 'services') return 'service';
  if (normalized === 'unknown') return 'unknown';
  return null;
}

function normalizeImpactTarget(impact: HermesReputationImpact): Pick<HermesReputationLedgerEntry, 'target_type' | 'target_id'> {
  const targetType = normalizeTargetType(impact.target_type) ?? 'unknown';
  const targetId = typeof impact.target_id === 'string' && impact.target_id.trim().length > 0
    ? impact.target_id.trim()
    : undefined;
  if (!targetId) return { target_type: 'unknown' };
  return { target_type: targetType, target_id: targetId };
}

function makeEntryKey(targetType: HermesReputationTargetType, targetId?: string): string {
  return `${targetType}:${targetId ?? 'unknown'}`;
}

function titleCaseToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForTarget(targetType: HermesReputationTargetType, targetId?: string): string {
  if (!targetId) return 'Unknown target';

  const seed = createPreSpendSeedState();
  if (targetType === 'provider') {
    const provider = seed.providers.find((item) => item.provider_id === targetId);
    return provider?.name ?? titleCaseToken(targetId);
  }
  if (targetType === 'route') {
    const route = seed.routes.find((item) => item.route_id === targetId);
    if (route) return `${route.endpoint} (${route.provider_id})`;
    return titleCaseToken(targetId);
  }
  if (targetType === 'service') {
    const service = seed.services.find((item) => item.service_id === targetId);
    return service ? titleCaseToken(service.category) : titleCaseToken(targetId);
  }
  return targetId;
}

function currentStateFor(entry: MutableLedgerEntry, score: number): HermesReputationState {
  if (entry.disputed_count > 0) return 'disputed';
  if (score >= 75 && entry.positive_count > entry.negative_count) return 'trusted';
  if (entry.negative_count > entry.positive_count && score < 45) return 'degraded';
  if (entry.watch_count > 0 || (score >= 45 && score <= 74)) return 'watchlist';
  return 'unproven';
}

function latestEventAt(events: HermesReputationLedgerEvent[]): string | undefined {
  return events.reduce<string | undefined>((latest, event) => {
    if (!latest || event.at > latest) return event.at;
    return latest;
  }, undefined);
}

function eventFromRun(run: HermesRun): HermesReputationLedgerEvent {
  const promotion = promoteHermesClaimCandidate(run);
  const claim = promotion.promoted_claim;
  const impact = claim.reputation_impact;
  return {
    id: `ledger_event_${claim.id}`,
    at: claim.reviewed_at,
    source_run_id: claim.source_run_id,
    source_receipt_id: claim.source_receipt_id,
    source_claim_id: claim.id,
    decision: claim.decision,
    review_state: claim.review_state,
    direction: impact.direction,
    magnitude: impact.magnitude,
    summary: impact.summary,
    notes: [...impact.reputation_notes]
  };
}

export function buildHermesReputationLedgerFromRuns(
  runs: HermesRun[],
  options: LedgerBuildOptions = {}
): HermesReputationLedgerSummary {
  const grouped = new Map<string, MutableLedgerEntry>();

  for (const run of runs) {
    const promotion = promoteHermesClaimCandidate(run);
    const impact = promotion.promoted_claim.reputation_impact;
    const target = normalizeImpactTarget(impact);
    const key = makeEntryKey(target.target_type, target.target_id);
    const event = eventFromRun(run);
    const existing = grouped.get(key);
    const entry = existing ?? {
      target_type: target.target_type,
      target_id: target.target_id,
      label: labelForTarget(target.target_type, target.target_id),
      raw_score: 50,
      raw_impact_total: 0,
      positive_count: 0,
      negative_count: 0,
      watch_count: 0,
      neutral_count: 0,
      disputed_count: 0,
      decision_history: [],
      source_claim_ids: new Set<string>(),
      source_receipt_ids: new Set<string>(),
      source_run_ids: new Set<string>()
    };

    entry.raw_score += scoreDelta(impact);
    entry.raw_impact_total += signedImpact(impact);
    if (impact.direction === 'positive') entry.positive_count += 1;
    if (impact.direction === 'negative') entry.negative_count += 1;
    if (impact.direction === 'watch') entry.watch_count += 1;
    if (impact.direction === 'neutral') entry.neutral_count += 1;
    if (event.review_state === 'disputed' || event.decision === 'disputed') entry.disputed_count += 1;
    entry.decision_history.push(event);
    entry.source_claim_ids.add(event.source_claim_id);
    entry.source_receipt_ids.add(event.source_receipt_id);
    entry.source_run_ids.add(event.source_run_id);
    grouped.set(key, entry);
  }

  const entries = [...grouped.values()]
    .map((entry): HermesReputationLedgerEntry => {
      const score = clampScore(entry.raw_score);
      const decisionHistory = [...entry.decision_history].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
      return {
        target_type: entry.target_type,
        target_id: entry.target_id,
        label: entry.label,
        current_state: currentStateFor(entry, score),
        trust_score: score,
        impact_total: roundImpact(entry.raw_impact_total),
        positive_count: entry.positive_count,
        negative_count: entry.negative_count,
        watch_count: entry.watch_count,
        neutral_count: entry.neutral_count,
        disputed_count: entry.disputed_count,
        latest_event_at: latestEventAt(decisionHistory),
        decision_history: decisionHistory,
        source_claim_ids: [...entry.source_claim_ids].sort(),
        source_receipt_ids: [...entry.source_receipt_ids].sort(),
        source_run_ids: [...entry.source_run_ids].sort()
      };
    })
    .sort((a, b) => targetRank[a.target_type] - targetRank[b.target_type] || a.label.localeCompare(b.label) || (a.target_id ?? '').localeCompare(b.target_id ?? ''));

  return {
    generated_at: options.generatedAt ?? hermesDeskGeneratedAt,
    entry_count: entries.length,
    provider_count: entries.filter((entry) => entry.target_type === 'provider').length,
    route_count: entries.filter((entry) => entry.target_type === 'route').length,
    service_count: entries.filter((entry) => entry.target_type === 'service').length,
    unknown_count: entries.filter((entry) => entry.target_type === 'unknown').length,
    trusted_count: entries.filter((entry) => entry.current_state === 'trusted').length,
    watchlist_count: entries.filter((entry) => entry.current_state === 'watchlist').length,
    degraded_count: entries.filter((entry) => entry.current_state === 'degraded').length,
    disputed_count: entries.filter((entry) => entry.current_state === 'disputed').length,
    entries
  };
}

export function buildHermesReputationLedger(): HermesReputationLedgerSummary {
  return buildHermesReputationLedgerFromRuns(listHermesRuns(), { generatedAt: hermesDeskGeneratedAt });
}

export function listHermesReputationEntries(): HermesReputationLedgerEntry[] {
  return buildHermesReputationLedger().entries;
}

export function listHermesProviderReputationEntries(): HermesReputationLedgerEntry[] {
  return listHermesReputationEntries().filter((entry) => entry.target_type === 'provider');
}

export function listHermesRouteReputationEntries(): HermesReputationLedgerEntry[] {
  return listHermesReputationEntries().filter((entry) => entry.target_type === 'route');
}

export function listHermesServiceReputationEntries(): HermesReputationLedgerEntry[] {
  return listHermesReputationEntries().filter((entry) => entry.target_type === 'service');
}

export function getHermesReputationEntry(
  targetType: string,
  targetId?: string
): HermesReputationLedgerEntry | undefined {
  const normalizedType = normalizeTargetType(targetType);
  if (!normalizedType) return undefined;
  const normalizedId = typeof targetId === 'string' && targetId.trim().length > 0 ? targetId.trim() : undefined;
  return listHermesReputationEntries().find((entry) => {
    if (entry.target_type !== normalizedType) return false;
    if (normalizedType === 'unknown') return (entry.target_id ?? 'unknown') === (normalizedId ?? 'unknown');
    return entry.target_id === normalizedId;
  });
}
