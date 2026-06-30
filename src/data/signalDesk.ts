import { listNarrativeAssets, signalSurfaces } from './narrativeIntel';
import { getLatestSignalUpdate, listSignalUpdates } from './signalUpdates';
import { getCandidateSignalCounts, listCandidateSignals } from './candidateSignals';
import type {
  NarrativeAsset,
  NarrativeSignalSurface,
  SignalRiskFacet,
  SignalDeskActivityItem,
  SignalDeskDispatchCard,
  SignalDeskIndex,
  SignalDeskReportCard,
  SignalDeskStatus,
  SignalEvidenceUpdate,
  SignalEvidenceUpdateType
} from '../schemas/entities';

const RISK_SHIFT_TYPES = new Set<SignalEvidenceUpdateType>(['risk_shift', 'verdict_change', 'holder_shift']);

function byNewest<T extends { timestamp: string }>(left: T, right: T) {
  return right.timestamp.localeCompare(left.timestamp);
}

function activityByNewest(left: SignalDeskActivityItem, right: SignalDeskActivityItem) {
  return right.timestamp.localeCompare(left.timestamp);
}

function surfaceByAssetSlug(slug: string): NarrativeSignalSurface | null {
  return signalSurfaces.find((item) => item.type === 'signal_report' && item.asset_slug === slug) ?? null;
}

function readableUpdateType(value: SignalEvidenceUpdateType): string {
  switch (value) {
    case 'attention_shift':
      return 'Attention Shift';
    case 'holder_shift':
      return 'Holder Shift';
    case 'myth_shift':
      return 'Myth Shift';
    case 'risk_shift':
      return 'Risk Shift';
    case 'verdict_change':
      return 'Verdict Change';
  }
}

function scoreDelta(update: SignalEvidenceUpdate): number | undefined {
  if (typeof update.previous_score !== 'number' || typeof update.new_score !== 'number') return undefined;
  return update.new_score - update.previous_score;
}

function resolveDeskStatus(reportCount: number, dispatchCount: number): SignalDeskStatus {
  if (dispatchCount > 0) return 'live_watch';
  if (reportCount > 0) return 'seeded_report';
  return 'needs_review';
}

function getSignalStrength(surface: NarrativeSignalSurface, asset: NarrativeAsset): number {
  const score = surface.cards.find((card) => card.id === 'signal-strength')?.score;
  return typeof score === 'number' ? score : asset.attention_velocity_score;
}

function uniqueFacets(facets: SignalRiskFacet[]) {
  return Array.from(new Set(facets));
}

function reportRiskFacets(asset: NarrativeAsset): SignalRiskFacet[] {
  const facets: SignalRiskFacet[] = [];
  if (asset.reflexivity_risk_score >= 80) facets.push('high_reflexivity');
  if (asset.kol_dependency_score >= 80) facets.push('kol_dependency');
  if (asset.centralization_risk_score >= 70) facets.push('power_concentration');
  if (asset.sovereignty_score <= 40) facets.push('unproven_sovereignty');
  if (listSignalUpdates(asset.slug).length > 0) facets.push('live_watch');
  return uniqueFacets(facets);
}

function dispatchRiskFacets(update: SignalEvidenceUpdate, asset: NarrativeAsset): SignalRiskFacet[] {
  const facets: SignalRiskFacet[] = [];
  if (update.update_type === 'risk_shift') facets.push('high_reflexivity');
  if (update.update_type === 'holder_shift') facets.push('power_concentration');
  if (update.update_type === 'verdict_change' && asset.sovereignty_score <= 40) facets.push('unproven_sovereignty');
  if (update.update_type === 'attention_shift' && asset.reflexivity_risk_score >= 80) facets.push('live_watch');
  if (asset.kol_dependency_score >= 80 && (update.update_type === 'attention_shift' || update.update_type === 'verdict_change')) facets.push('kol_dependency');
  if (update.update_type === 'verdict_change' || update.update_type === 'risk_shift' || update.update_type === 'holder_shift') facets.push('live_watch');
  return uniqueFacets(facets);
}

function buildDispatchCard(update: SignalEvidenceUpdate, asset: NarrativeAsset): SignalDeskDispatchCard {
  return {
    update_id: update.update_id,
    signal_slug: update.signal_slug,
    signal_name: asset.name,
    ticker: asset.ticker,
    update_type: update.update_type,
    readable_update_type: readableUpdateType(update.update_type),
    timestamp: update.timestamp,
    summary: update.summary,
    analyst_note: update.analyst_note,
    href: `/signals/${update.signal_slug}/updates/${update.update_id}`,
    og_image: `/og/signals/${update.signal_slug}/updates/${update.update_id}.png`,
    risk_facets: dispatchRiskFacets(update, asset),
    previous_score: update.previous_score,
    new_score: update.new_score,
    signal_delta: scoreDelta(update)
  };
}

function buildReportCard(asset: NarrativeAsset): SignalDeskReportCard | null {
  const surface = surfaceByAssetSlug(asset.slug);
  if (!surface) return null;

  const updates = listSignalUpdates(asset.slug);
  const latestUpdate = updates[0];

  return {
    slug: asset.slug,
    ticker: asset.ticker,
    name: asset.name,
    category: asset.category,
    thesis: asset.thesis,
    href: `/signals/${asset.slug}`,
    signal_strength: getSignalStrength(surface, asset),
    myth_coherence: asset.myth_coherence_score,
    reflexivity_risk: asset.reflexivity_risk_score,
    sovereignty_score: asset.sovereignty_score,
    risk_facets: reportRiskFacets(asset),
    desk_status: resolveDeskStatus(1, updates.length),
    latest_update_type: latestUpdate?.update_type,
    latest_update_at: latestUpdate?.timestamp,
    update_count: updates.length
  };
}

export function getSignalReportCards(): SignalDeskReportCard[] {
  return listNarrativeAssets()
    .map(buildReportCard)
    .filter((item): item is SignalDeskReportCard => item !== null)
    .sort((left, right) => {
      const leftTimestamp = left.latest_update_at ?? '';
      const rightTimestamp = right.latest_update_at ?? '';
      return rightTimestamp.localeCompare(leftTimestamp);
    });
}

function getAllDispatchCards(): SignalDeskDispatchCard[] {
  return listNarrativeAssets()
    .flatMap((asset) => listSignalUpdates(asset.slug).map((update) => buildDispatchCard(update, asset)))
    .sort(byNewest);
}

export function getLatestDispatches(limit = 5): SignalDeskDispatchCard[] {
  return getAllDispatchCards().slice(0, limit);
}

export function getRiskShifts(limit = 5): SignalDeskDispatchCard[] {
  return getAllDispatchCards()
    .filter((item) => RISK_SHIFT_TYPES.has(item.update_type))
    .slice(0, limit);
}

export function getLatestDeskActivity(limit = 10): SignalDeskActivityItem[] {
  const reports = getSignalReportCards();
  const updates = getAllDispatchCards();

  const items: SignalDeskActivityItem[] = [
    ...reports.map((report) => ({
      id: `report_published_${report.slug}`,
      type: 'report_published' as const,
      timestamp: surfaceByAssetSlug(report.slug)?.last_updated ?? reports[0]?.latest_update_at ?? new Date(0).toISOString(),
      title: `${report.ticker} / ${report.name} report published`,
      summary: report.thesis,
      href: report.href
    })),
    ...updates.map((update) => ({
      id: `dispatch_published_${update.update_id}`,
      type: 'dispatch_published' as const,
      timestamp: update.timestamp,
      title: `${update.readable_update_type} published for ${update.ticker}`,
      summary: update.summary,
      href: update.href
    })),
    ...updates
      .filter((update) => update.update_type === 'risk_shift')
      .map((update) => ({
        id: `risk_shift_${update.update_id}`,
        type: 'risk_shift' as const,
        timestamp: update.timestamp,
        title: `Risk shift flagged for ${update.ticker}`,
        summary: update.analyst_note,
        href: update.href
      })),
    ...updates
      .filter((update) => update.update_type === 'verdict_change')
      .map((update) => ({
        id: `verdict_change_${update.update_id}`,
        type: 'verdict_change' as const,
        timestamp: update.timestamp,
        title: `Verdict changed for ${update.ticker}`,
        summary: update.summary,
        href: update.href
      })),
    ...reports.map((report) => ({
      id: `metadata_updated_${report.slug}`,
      type: 'metadata_updated' as const,
      timestamp: surfaceByAssetSlug(report.slug)?.last_updated ?? new Date(0).toISOString(),
      title: `${report.ticker} metadata refreshed`,
      summary: 'Narrative desk metadata and route mappings are live for report distribution.',
      href: '/narratives'
    })),
    ...reports.map((report) => ({
      id: `og_card_generated_${report.slug}`,
      type: 'og_card_generated' as const,
      timestamp: report.latest_update_at ?? surfaceByAssetSlug(report.slug)?.last_updated ?? new Date(0).toISOString(),
      title: `${report.ticker} OG cards available`,
      summary: 'Report and dispatch PNG cards are ready for desk distribution.',
      href: `/og/signals/${report.slug}.png`
    }))
  ];

  return items.sort(activityByNewest).slice(0, limit);
}

export function getSignalDeskIndex(): SignalDeskIndex {
  const reports = getSignalReportCards();
  const dispatches = getLatestDispatches();
  const riskShifts = getRiskShifts();
  const latestActivity = getLatestDeskActivity();
  const candidateSignals = listCandidateSignals();
  const candidateCounts = getCandidateSignalCounts();
  const generatedAtCandidates = [
    ...reports.map((report) => report.latest_update_at ?? surfaceByAssetSlug(report.slug)?.last_updated ?? ''),
    ...listNarrativeAssets().map((asset) => asset.last_updated),
    ...dispatches.map((dispatch) => dispatch.timestamp),
    ...riskShifts.map((dispatch) => dispatch.timestamp),
    ...candidateSignals.map((candidate) => candidate.updated_at)
  ].filter(Boolean);
  const generated_at = [...generatedAtCandidates].sort((left, right) => right.localeCompare(left))[0] ?? new Date().toISOString();

  return {
    generated_at,
    desk_status: resolveDeskStatus(reports.length, getAllDispatchCards().length),
    counts: {
      reports: reports.length,
      dispatches: getAllDispatchCards().length,
      risk_shifts: getAllDispatchCards().filter((item) => RISK_SHIFT_TYPES.has(item.update_type)).length,
      watched_signals: listNarrativeAssets().length
    },
    candidate_signals: candidateSignals,
    candidate_counts: candidateCounts,
    featured_report: reports.find((report) => report.slug === 'black-bull') ?? reports[0] ?? null,
    reports,
    latest_dispatches: dispatches,
    risk_shifts: riskShifts,
    desk_activity: latestActivity
  };
}

export function getLatestDeskSignalUpdate(signalSlug: string) {
  return getLatestSignalUpdate(signalSlug);
}
