import type {
  RhChain4663Asset,
  RhChain4663IndexPayload,
  RhChainAccessSurface,
  RhChainLaunchSurfaceRecord,
  RhChainMemePulseAsset,
  RhChainMemePulsePayload,
  RhChainMemeToken,
  RhChainPayload,
  RhChainPulseMetric,
  RhChainReviewItem,
  RhChainReviewQueuePayload,
  RhChainRiskState,
  RhChainRiskWallItem,
  RhChainSource
} from '../data/rhChain';
import { getRhChainFreshnessState, type RhChainFreshnessState } from '../services/rhChainTruthGuards';
import type { RhChainTodayOn4663Payload } from '../services/rhChainTodayOn4663Service';

export type TodayOn4663Selection = {
  id: 'top_signal' | 'attention_shift' | 'risk_alert' | 'receipt_update';
  title: string;
  verdict: string;
  href: string;
  observedAt: string | null;
  sourceCount: number;
  evidenceState: RhChainFreshnessState;
  classification: 'reviewed memory' | 'attention context' | 'requires review' | 'unavailable';
};

export type FeaturedRiskKind = 'identity' | 'liquidity' | 'deployer';

export type FeaturedRiskSelection = {
  kind: FeaturedRiskKind;
  title: string;
  activeAlertCount: number;
  featured: RhChainRiskWallItem | null;
  severity: RhChainRiskState | 'unavailable';
  observedAt: string | null;
  evidenceState: RhChainFreshnessState;
};

export type BriefMemeSelection = {
  ticker: string;
  name: string;
  contract: string | null;
  verdict: string;
  riskState: RhChainRiskState;
  observedState: 'reviewed' | 'auto-observed';
  source: RhChainSource;
  sourceAge: RhChainFreshnessState;
  signalScore: number | null;
};

export type FeaturedReviewRole = 'newest submission' | 'strongest evidence packet' | 'highest-risk unresolved';

export type FeaturedReviewSelection = {
  role: FeaturedReviewRole;
  item: RhChainReviewItem;
  evidenceCompleteness: 'complete' | 'partial' | 'source required';
};

export type ChainPulseDisplayState = 'exact sourced value' | 'source required' | 'unavailable' | 'narrative watch' | 'stale' | 'cached';

export type ChainPulseSummaryMetric = {
  id: 'tvl' | 'dex_volume' | 'stablecoin_context' | 'fees' | 'stock_token_activity' | 'attention_velocity';
  label: string;
  value: string;
  displayState: ChainPulseDisplayState;
  metric: RhChainPulseMetric | null;
};

export type LaunchRouteSelection = {
  launchSurface: RhChainLaunchSurfaceRecord | null;
  liquidityRoute: string | null;
  accessSurface: RhChainAccessSurface | null;
  reviewState: string;
  mainRisk: string;
  observedAt: string | null;
  routeComplete: boolean;
};

const riskWeight: Record<RhChainRiskState, number> = {
  do_not_touch_yet: 5,
  high_risk: 4,
  source_required: 3,
  medium_watch: 2,
  low_watch: 1
};

function sourceIsRequired(source: RhChainSource | null | undefined) {
  if (!source) return true;
  const name = (source.source_name || source.source || '').toLowerCase();
  return source.data_mode === 'unavailable' || /source[_ ]?(pending|required)|unavailable/.test(name);
}

function evidenceStateForSource(source: RhChainSource | null | undefined, now: Date) {
  if (sourceIsRequired(source)) return 'source_required' as const;
  return getRhChainFreshnessState(source?.observed_at, source?.data_mode, now);
}

function cardById(payload: RhChainTodayOn4663Payload, id: RhChainTodayOn4663Payload['cards'][number]['id']) {
  return payload.cards.find((card) => card.id === id) ?? null;
}

/** Projects the existing Today payload into the editorial four-card vocabulary. */
export function selectTodayOn4663(payload: RhChainTodayOn4663Payload | null, now = new Date()): TodayOn4663Selection[] {
  const definitions: Array<{
    id: TodayOn4663Selection['id'];
    sourceId: RhChainTodayOn4663Payload['cards'][number]['id'];
    title: string;
    classification: TodayOn4663Selection['classification'];
    fallbackHref: string;
  }> = [
    { id: 'top_signal', sourceId: 'top_signal', title: 'Top Signal', classification: 'reviewed memory', fallbackHref: '/rh-chain-signal-desk/4663-index' },
    { id: 'attention_shift', sourceId: 'highest_attention_move', title: 'Attention Shift', classification: 'attention context', fallbackHref: '/rh-chain-signal-desk/meme-pulse' },
    { id: 'risk_alert', sourceId: 'biggest_risk', title: 'Risk Alert', classification: 'requires review', fallbackHref: '/rh-chain-signal-desk/clone-radar' },
    { id: 'receipt_update', sourceId: 'latest_receipt', title: 'Receipt Update', classification: 'reviewed memory', fallbackHref: '/rh-chain-signal-desk/daily-receipts' }
  ];

  return definitions.map((definition) => {
    const card = payload ? cardById(payload, definition.sourceId) : null;
    return {
      id: definition.id,
      title: definition.title,
      verdict: card?.verdict ?? 'No current evidence-backed update is available.',
      href: card?.href ?? definition.fallbackHref,
      observedAt: card?.source.observed_at ?? null,
      sourceCount: card?.source.source_name ? 1 : 0,
      evidenceState: evidenceStateForSource(card?.source, now),
      classification: card ? definition.classification : 'unavailable'
    };
  });
}

/** The index is already scored; this selector only guarantees a stable three-item projection. */
export function selectFeaturedMovers(index: RhChain4663IndexPayload | null): RhChain4663Asset[] {
  if (!index) return [];
  return [...index.assets]
    .sort((left, right) => left.rank - right.rank || right.signal_score - left.signal_score || left.ticker.localeCompare(right.ticker))
    .slice(0, 3);
}

function riskKind(item: RhChainRiskWallItem): FeaturedRiskKind | null {
  const identity = `${item.id} ${item.title}`.toLowerCase();
  const evidence = `${item.summary} ${item.evidence_needed.join(' ')}`.toLowerCase();
  if (/deployer|creator|ancestry|wallet cluster|linked wallet/.test(identity)) return 'deployer';
  if (/liquid|pool|volume|reserve|exit|route/.test(identity)) return 'liquidity';
  if (/identity|contract|ticker|clone|imperson|verified/.test(identity)) return 'identity';
  if (/deployer|creator|ancestry|wallet cluster|linked wallet/.test(evidence)) return 'deployer';
  if (/liquid|pool|volume|reserve|exit|route/.test(evidence)) return 'liquidity';
  if (/identity|contract|ticker|clone|imperson|verified/.test(evidence)) return 'identity';
  return null;
}

function newestFirst(left: RhChainRiskWallItem, right: RhChainRiskWallItem) {
  return right.source.observed_at.localeCompare(left.source.observed_at) || left.id.localeCompare(right.id);
}

export function selectFeaturedRisks(desk: RhChainPayload | null, now = new Date()): FeaturedRiskSelection[] {
  const definitions: Array<{ kind: FeaturedRiskKind; title: string }> = [
    { kind: 'identity', title: 'Identity Risk' },
    { kind: 'liquidity', title: 'Liquidity Risk' },
    { kind: 'deployer', title: 'Deployer Risk' }
  ];
  return definitions.map(({ kind, title }) => {
    const matches = (desk?.risk_wall ?? []).filter((item) => riskKind(item) === kind);
    const featured = [...matches].sort((left, right) => riskWeight[right.risk_state] - riskWeight[left.risk_state] || newestFirst(left, right))[0] ?? null;
    return {
      kind,
      title,
      activeAlertCount: matches.length,
      featured,
      severity: featured?.risk_state ?? 'unavailable',
      observedAt: featured?.source.observed_at ?? null,
      evidenceState: evidenceStateForSource(featured?.source, now)
    };
  });
}

function memeKey(asset: Pick<RhChainMemePulseAsset, 'contract' | 'ticker'> | Pick<RhChainMemeToken, 'contract' | 'ticker'>) {
  return asset.contract?.trim().toLowerCase() || asset.ticker.trim().toLowerCase();
}

function fromPulseAsset(asset: RhChainMemePulseAsset, now: Date): BriefMemeSelection {
  return {
    ticker: asset.ticker,
    name: asset.name,
    contract: asset.contract?.trim() || null,
    verdict: asset.infopunks_verdict,
    riskState: asset.risk_state,
    observedState: asset.context_origin === 'reviewed_memory' ? 'reviewed' : 'auto-observed',
    source: asset.source,
    sourceAge: evidenceStateForSource(asset.source, now),
    signalScore: asset.signal_score
  };
}

function fromDeskMeme(asset: RhChainMemeToken, now: Date): BriefMemeSelection {
  return {
    ticker: asset.ticker,
    name: asset.name,
    contract: /^0x[a-fA-F0-9]{40}$/.test(asset.contract) ? asset.contract : null,
    verdict: asset.infopunks_verdict,
    riskState: asset.risk_state,
    observedState: 'auto-observed',
    source: asset.source,
    sourceAge: evidenceStateForSource(asset.source, now),
    signalScore: null
  };
}

/** Reviewed memory wins duplicate identities; auto-observed context remains visible but subordinate. */
export function selectBriefMemePulse(desk: RhChainPayload | null, pulse: RhChainMemePulsePayload | null, now = new Date()): BriefMemeSelection[] {
  const selected = new Map<string, BriefMemeSelection>();
  for (const asset of pulse?.top_attention_assets ?? []) {
    const next = fromPulseAsset(asset, now);
    const key = memeKey(asset);
    const current = selected.get(key);
    if (!current || (next.observedState === 'reviewed' && current.observedState !== 'reviewed')) selected.set(key, next);
  }
  for (const asset of desk?.meme_pulse ?? []) {
    const key = memeKey(asset);
    if (!selected.has(key)) selected.set(key, fromDeskMeme(asset, now));
  }
  return [...selected.values()]
    .sort((left, right) => Number(right.observedState === 'reviewed') - Number(left.observedState === 'reviewed')
      || (right.signalScore ?? -1) - (left.signalScore ?? -1)
      || left.ticker.localeCompare(right.ticker))
    .slice(0, 6);
}

function linkCount(item: RhChainReviewItem) {
  return Object.values(item.links).filter(Boolean).length;
}

function isUnresolved(item: RhChainReviewItem) {
  return !['approved_signal', 'rejected_low_receipt_quality'].includes(item.review_state);
}

function evidenceCompleteness(item: RhChainReviewItem): FeaturedReviewSelection['evidenceCompleteness'] {
  if (item.missing_evidence.length === 0) return 'complete';
  return linkCount(item) > 0 ? 'partial' : 'source required';
}

export function selectFeaturedReviewItems(queue: RhChainReviewQueuePayload | null): FeaturedReviewSelection[] {
  if (!queue?.items.length) return [];
  const byNewest = [...queue.items].sort((left, right) => right.submitted_at.localeCompare(left.submitted_at) || left.review_id.localeCompare(right.review_id));
  const byEvidence = [...queue.items].sort((left, right) => left.missing_evidence.length - right.missing_evidence.length || linkCount(right) - linkCount(left) || right.updated_at.localeCompare(left.updated_at) || left.review_id.localeCompare(right.review_id));
  const byRisk = queue.items.filter(isUnresolved).sort((left, right) => riskWeight[right.risk_state] - riskWeight[left.risk_state] || right.updated_at.localeCompare(left.updated_at) || left.review_id.localeCompare(right.review_id));
  const candidates: Array<[FeaturedReviewRole, RhChainReviewItem | undefined]> = [
    ['newest submission', byNewest[0]],
    ['strongest evidence packet', byEvidence[0]],
    ['highest-risk unresolved', byRisk[0]]
  ];
  const used = new Set<string>();
  const selections: FeaturedReviewSelection[] = [];
  for (const [role, candidate] of candidates) {
    const item = candidate && !used.has(candidate.review_id)
      ? candidate
      : (role === 'strongest evidence packet' ? byEvidence : role === 'highest-risk unresolved' ? byRisk : byNewest).find((entry) => !used.has(entry.review_id));
    if (!item) continue;
    used.add(item.review_id);
    selections.push({ role, item, evidenceCompleteness: evidenceCompleteness(item) });
  }
  return selections;
}

function normalizedMetricId(metric: RhChainPulseMetric) {
  return `${metric.id} ${metric.label}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function findMetric(metrics: RhChainPulseMetric[], patterns: RegExp[]) {
  return metrics.find((metric) => patterns.some((pattern) => pattern.test(normalizedMetricId(metric)))) ?? null;
}

function metricDisplayState(metric: RhChainPulseMetric | null, deskFreshness: string | undefined): ChainPulseDisplayState {
  if (!metric || metric.source.data_mode === 'unavailable') return 'unavailable';
  if (sourceIsRequired(metric.source) || metric.state === 'live_required' || metric.state === 'source_pending' || metric.metric_scope === 'source_required') return 'source required';
  if (deskFreshness === 'stale') return 'stale';
  if (metric.source.data_mode === 'cached' || metric.source.data_mode === 'live_cached') return 'cached';
  if (metric.state === 'watching' || /watch|context/i.test(metric.value)) return 'narrative watch';
  return 'exact sourced value';
}

export function selectChainPulseSummary(desk: RhChainPayload | null): ChainPulseSummaryMetric[] {
  const metrics = desk?.chain_pulse.metrics ?? [];
  const definitions: Array<{ id: ChainPulseSummaryMetric['id']; label: string; patterns: RegExp[] }> = [
    { id: 'tvl', label: 'TVL', patterns: [/^tvl(?:_|$)/] },
    { id: 'dex_volume', label: 'DEX volume', patterns: [/dex.*volume/, /volume.*dex/] },
    { id: 'stablecoin_context', label: 'Stablecoin context', patterns: [/stablecoin/, /stable_liquid/] },
    { id: 'fees', label: 'Fees', patterns: [/(?:^|_)fees?(?:_|$)/] },
    { id: 'stock_token_activity', label: 'Stock-token activity', patterns: [/stock.*token/] },
    { id: 'attention_velocity', label: 'Attention velocity', patterns: [/attention.*velocity/] }
  ];
  return definitions.map((definition) => {
    const metric = findMetric(metrics, definition.patterns);
    const displayState = metricDisplayState(metric, desk?.chain_pulse.freshness_state);
    return {
      id: definition.id,
      label: definition.label,
      value: metric && displayState !== 'unavailable' ? metric.value : 'Unavailable',
      displayState,
      metric
    };
  });
}

/** Uses only exact reviewed launch context. The access edge remains incomplete without an exact access-context match. */
export function selectLaunchRoute(queue: RhChainReviewQueuePayload | null, launchSurfaces: RhChainLaunchSurfaceRecord[], accessSurfaces: RhChainAccessSurface[]): LaunchRouteSelection {
  const reviewed = queue?.items
    .filter((item) => item.launch_context?.contract_verified === true)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.review_id.localeCompare(right.review_id))[0] ?? null;
  const launchContext = reviewed?.launch_context ?? null;
  const launchSurface = launchContext ? launchSurfaces.find((surface) => surface.id === launchContext.launch_source) ?? null : null;
  const accessSurface = accessSurfaces.find((surface) => surface.source_status === 'verified_source') ?? null;
  return {
    launchSurface,
    liquidityRoute: launchContext?.liquidity_route ?? null,
    accessSurface,
    reviewState: reviewed?.review_state ?? 'source_required',
    mainRisk: launchSurface?.risk_note ?? accessSurface?.risk_notes ?? 'No exact reviewed launch-to-access route is attached.',
    observedAt: launchContext?.observed_at ?? launchSurface?.source.observed_at ?? null,
    routeComplete: false
  };
}
