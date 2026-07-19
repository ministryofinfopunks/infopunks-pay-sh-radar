import { z } from 'zod';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';
import type { RhChainMarketSnapshot } from './rhChainMarketSnapshotService';
import type { RhChainReviewedClassification, RhChainReviewedClassificationService } from './rhChainReviewedClassificationService';

const MAX_CLASSIFICATIONS = 100;
const CACHE_TTL_MS = 60_000;
const EXACT_CONTRACT = /^0x[0-9a-fA-F]{40}$/;

export const RH_CHAIN_INTERSECTION_CATEGORIES = [
  'meme_x_rwa', 'agent_x_rwa', 'agent_x_defi', 'agent_x_meme',
  'infrastructure_x_rwa', 'infrastructure_x_defi', 'meme_x_infrastructure',
  'consumer_x_tokenized_finance', 'rwa_x_lending', 'defi_x_rwa', 'meme_x_ai_narrative'
] as const;

export type RhChainIntersectionCategory = typeof RH_CHAIN_INTERSECTION_CATEGORIES[number];
type DurablePublicClassification = Omit<RhChainReviewedClassification, 'reviewer_audit' | 'manual_override_reason'>;
type ReviewedClassificationReader = Pick<RhChainReviewedClassificationService, 'listApproved'>;
type Freshness = 'fresh' | 'stale' | 'partial' | 'unavailable';
type Confidence = 'high' | 'medium' | 'low';

const PersistedSnapshotSchema = z.object({
  captured_at: z.string().datetime(),
  provider: z.literal('dexscreener'),
  chain_id: z.literal('robinhood'),
  token_address: z.string().regex(EXACT_CONTRACT).transform((value) => value.toLowerCase()),
  ticker: z.string().nullable(),
  pair_address: z.string().nullable(),
  dex_id: z.string().nullable(),
  price_usd: z.number().finite().nullable(),
  liquidity_usd: z.number().finite().nonnegative().nullable(),
  market_cap: z.number().finite().nonnegative().nullable(),
  fdv: z.number().finite().nonnegative().nullable(),
  volume_h24: z.number().finite().nonnegative().nullable(),
  volume_h6: z.number().finite().nonnegative().nullable(),
  volume_h1: z.number().finite().nonnegative().nullable(),
  txns_h24_buys: z.number().finite().nonnegative().nullable(),
  txns_h24_sells: z.number().finite().nonnegative().nullable(),
  txns_h6_buys: z.number().finite().nonnegative().nullable(),
  txns_h6_sells: z.number().finite().nonnegative().nullable(),
  pair_created_at: z.string().datetime().nullable(),
  active_boosts: z.number().finite().nonnegative(),
  paid_order_types: z.array(z.string()).max(50),
  paid_order_statuses: z.array(z.string()).max(50),
  source_url: z.string().url().nullable(),
  provider_timestamp: z.string().datetime().nullable().optional(),
  freshness_state: z.enum(['fresh', 'stale']).optional(),
  raw_data_version: z.string().optional(),
  cache_status: z.string().optional(),
  cache_provenance: z.string().optional(),
  base_token: z.object({ address: z.string(), name: z.string().nullable(), symbol: z.string().nullable() }).passthrough().optional(),
  quote_token: z.object({ address: z.string(), name: z.string().nullable(), symbol: z.string().nullable() }).passthrough().optional(),
  pair_labels: z.array(z.string()).max(20).optional()
}).passthrough();

type PersistedSnapshot = z.infer<typeof PersistedSnapshotSchema>;
type ResolvedClassification = {
  chain: 'robinhood';
  contract: string;
  primary_layer: string;
  secondary_layers: string[];
  confidence: Confidence;
  evidence_summary: string[];
  classification_version: number | null;
  classification_source: 'curated_reviewed_memory' | 'durable_reviewed_classification';
  effective_at: string | null;
  reviewed_at: string | null;
  display_name: string | null;
  ticker: string | null;
  dexscreener_pair: string | null;
  explanation: string;
  evidence_state: string;
  missing_evidence: string[];
  caveat: string | null;
  conflict_state: 'none' | 'curated_durable_disagreement';
  warnings: string[];
};

export type RhChainClassificationConflict = {
  chain: 'robinhood';
  contract: string;
  conflict_state: 'curated_durable_disagreement';
  curated: { primary_layer: string; secondary_layers: string[]; confidence: Confidence; reviewed_at: string | null };
  durable: { primary_layer: string; secondary_layers: string[]; confidence: Confidence; classification_version: number; effective_at: string };
  resolution: 'curated_memory_preserved';
  resolution_route: string;
  warning: string;
};

type SourceRequiredRecord = { chain: 'robinhood'; contract: string; source: string; state: 'source_required'; reasons: string[] };
type IntegrationBase = Awaited<ReturnType<RhChainCrossLayerIntegrationService['compute']>>;

export type RhChainCrossLayerIntegrationOptions = {
  reviewedClassifications: ReviewedClassificationReader;
  curatedClassifications: readonly RhChainLayerClassification[];
  latestSnapshotsForContracts: (contracts: string[]) => Promise<Record<string, RhChainMarketSnapshot | null>>;
  now?: () => Date;
  cacheTtlMs?: number;
};

/**
 * Read-only adapter from authoritative reviewed memory to the existing
 * Cross-Layer surface. It never calls a provider and never mutates review state.
 */
export class RhChainCrossLayerIntegrationService {
  private readonly now: () => Date;
  private readonly cacheTtlMs: number;
  private cached: { expires_at: number; value: IntegrationBase } | null = null;

  constructor(private readonly options: RhChainCrossLayerIntegrationOptions) {
    this.now = options.now ?? (() => new Date());
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
  }

  async build(latestReceipt: { receipt_id: string; timestamp: string; summary: string } | null = null) {
    const base = await this.load();
    const { internal_conflicts: _internalConflicts, internal_source_required: _internalSourceRequired, ...publicBase } = base;
    return {
      ...publicBase,
      entries: base.entries.map((entry) => ({ ...entry, latest_receipt: latestReceipt })),
      latest_related_receipt: latestReceipt
    };
  }

  async inspectConflicts() {
    const base = await this.load();
    return {
      captured_at: base.captured_at,
      conflict_count: base.conflict_count,
      conflicts: base.internal_conflicts,
      source_required_count: base.source_required_count,
      source_required: base.internal_source_required,
      warnings: base.warnings,
      bounded_universe: base.bounded_universe,
      classification_precedence: base.classification_provenance.precedence,
      resolution_policy: 'Resolve disagreements through the existing protected reviewed-classification operations. No mutation is available on this route.'
    };
  }

  private async load() {
    const now = this.now().getTime();
    if (this.cached && this.cached.expires_at > now) return this.cached.value;
    const value = await this.compute();
    this.cached = { value, expires_at: now + this.cacheTtlMs };
    return value;
  }

  private async compute() {
    const capturedAt = this.now().toISOString();
    const warnings: string[] = [];
    let durable: DurablePublicClassification[] = [];
    let durableHasMore = false;
    try {
      const page = await this.options.reviewedClassifications.listApproved({ page: 1, page_size: MAX_CLASSIFICATIONS });
      durable = page.classifications.filter((record) => activeAt(record, this.now()));
      durableHasMore = page.has_more;
      if (durableHasMore) warnings.push(`Durable classifications exceed the bounded ${MAX_CLASSIFICATIONS}-record integration page; coverage is partial.`);
    } catch {
      warnings.push('Durable reviewed classifications are temporarily unavailable; curated reviewed memory remains authoritative.');
    }

    const curated = this.options.curatedClassifications.slice(0, MAX_CLASSIFICATIONS).filter((record) => EXACT_CONTRACT.test(record.contract));
    if (this.options.curatedClassifications.length > MAX_CLASSIFICATIONS) warnings.push(`Curated classifications exceed the bounded ${MAX_CLASSIFICATIONS}-record integration limit; coverage is partial.`);
    const curatedByContract = new Map(curated.map((record) => [normalize(record.contract), record]));
    const durableByContract = new Map(durable.map((record) => [normalize(record.contract), record]));
    const contracts = [...new Set([...curatedByContract.keys(), ...durableByContract.keys()])].sort().slice(0, MAX_CLASSIFICATIONS);
    const conflicts: RhChainClassificationConflict[] = [];
    const sourceRequired: SourceRequiredRecord[] = [];
    const resolved: ResolvedClassification[] = [];

    for (const contract of contracts) {
      const curatedRecord = curatedByContract.get(contract);
      const durableRecord = durableByContract.get(contract);
      const conflict = curatedRecord && durableRecord && classificationDisagrees(curatedRecord, durableRecord)
        ? conflictRecord(contract, curatedRecord, durableRecord)
        : null;
      if (conflict) conflicts.push(conflict);
      const classification = curatedRecord
        ? fromCurated(curatedRecord, conflict)
        : durableRecord ? fromDurable(durableRecord) : null;
      if (!classification) continue;
      resolved.push(classification);
    }

    const eligible = resolved.flatMap((classification) => {
      const reasons = eligibilityGaps(classification);
      const category = categoryFor(classification.primary_layer, classification.secondary_layers);
      if (!category) reasons.push('No supported reviewed layer intersection is present.');
      if (reasons.length || !category) {
        sourceRequired.push({ chain: 'robinhood', contract: classification.contract, source: classification.classification_source, state: 'source_required', reasons: [...new Set(reasons)] });
        return [];
      }
      return [{ classification, category }];
    });

    let snapshotRows: Record<string, RhChainMarketSnapshot | null> = {};
    try {
      snapshotRows = await this.options.latestSnapshotsForContracts(eligible.map((item) => item.classification.contract).slice(0, MAX_CLASSIFICATIONS));
    } catch {
      warnings.push('Persisted market snapshots are temporarily unavailable; reviewed intersections remain visible without market enrichment.');
    }

    const entries = eligible.map(({ classification, category }) => {
      const rawSnapshot = snapshotRows[classification.contract] ?? snapshotRows[normalize(classification.contract)] ?? null;
      const parsed = rawSnapshot ? PersistedSnapshotSchema.safeParse(rawSnapshot) : null;
      const snapshot = parsed?.success && parsed.data.token_address === classification.contract ? parsed.data : null;
      const entryWarnings = [...classification.warnings];
      if (rawSnapshot && !snapshot) entryWarnings.push('Stored market data failed validation or did not exact-match the reviewed contract; enrichment was withheld.');
      if (!snapshot) entryWarnings.push('Persisted market data is unavailable for this reviewed exact contract.');
      const freshness = snapshotFreshness(snapshot, this.now());
      return {
        category,
        chain: 'robinhood' as const,
        contract: classification.contract,
        display_name: classification.display_name ?? snapshot?.ticker ?? null,
        ticker: classification.ticker ?? snapshot?.ticker ?? null,
        dexscreener_pair: classification.dexscreener_pair ?? snapshot?.source_url ?? null,
        primary_layer: classification.primary_layer,
        secondary_layers: classification.secondary_layers,
        explanation: classification.explanation,
        evidence_state: classification.evidence_state,
        classification_confidence: classification.confidence,
        classification_evidence_summary: classification.evidence_summary,
        classification_version: classification.classification_version,
        classification_source: classification.classification_source,
        effective_at: classification.effective_at,
        reviewed_at: classification.reviewed_at,
        market_data_timestamp: snapshot?.captured_at ?? null,
        freshness,
        conflict_state: classification.conflict_state,
        warnings: entryWarnings,
        attention_quality_state: snapshot && (snapshot.active_boosts > 0 || snapshot.paid_order_types.length > 0) ? 'paid_attention_detected' as const : 'source_required' as const,
        missing_evidence: classification.missing_evidence,
        caveat: classification.caveat,
        market_data: marketData(snapshot, freshness, this.now())
      };
    }).sort((left, right) => (right.market_data.liquidity_usd ?? -1) - (left.market_data.liquidity_usd ?? -1) || left.contract.localeCompare(right.contract));

    const aggregates = aggregate(entries);
    const marketDataCount = entries.filter((entry) => entry.market_data.available).length;
    const staleCount = entries.filter((entry) => entry.freshness === 'stale').length;
    const freshness: Freshness = !entries.length || !marketDataCount ? 'unavailable' : marketDataCount < entries.length ? 'partial' : staleCount ? 'stale' : 'fresh';
    const confidence: Confidence = !entries.length ? 'low' : conflicts.length || entries.some((entry) => entry.classification_confidence === 'low') ? 'low' : entries.every((entry) => entry.classification_confidence === 'high') && marketDataCount === entries.length ? 'high' : 'medium';
    const dominant = aggregates.by_intersection[0] ?? null;
    const headline = dominant
      ? `${labelCategory(dominant.category)} is the clearest reviewed intersection in the bounded set.`
      : 'Reviewed intersections are waiting for enough evidence.';
    if (conflicts.length) warnings.push(`${conflicts.length} curated/durable classification disagreement${conflicts.length === 1 ? '' : 's'} require reviewer resolution; curated memory remains in force.`);
    if (sourceRequired.length) warnings.push(`${sourceRequired.length} exact-contract classification${sourceRequired.length === 1 ? '' : 's'} remain outside the public intersections list because evidence or layer support is incomplete.`);
    if (!marketDataCount && entries.length) warnings.push('No eligible intersection has validated persisted market data; market totals were not inferred.');
    else if (marketDataCount < entries.length) warnings.push(`${entries.length - marketDataCount} eligible intersection${entries.length - marketDataCount === 1 ? '' : 's'} have no validated persisted market snapshot.`);

    return {
      title: 'Cross-Layer Assets',
      integration_enabled: true as const,
      headline,
      interpretation: { headline, method: 'cross_layer_intersections_v1' as const, deterministic: true as const },
      observation_window: { label: 'Latest persisted market snapshots', captured_at: capturedAt },
      entries,
      categories: [...RH_CHAIN_INTERSECTION_CATEGORIES],
      intersection_count: aggregates.by_intersection.length,
      reviewed_project_count: entries.length,
      intersection_counts: aggregates.by_intersection.map((item) => ({ category: item.category, project_count: item.project_count })),
      layer_pair_counts: aggregates.by_intersection.map((item) => ({ category: item.category, label: labelCategory(item.category), count: item.project_count })),
      tracked_liquidity_by_intersection: aggregates.by_intersection.map((item) => ({ category: item.category, liquidity_usd: item.liquidity_usd, provenance: ['infopunks:persisted-market-snapshots'] })),
      tracked_volume_by_intersection: aggregates.by_intersection.map((item) => ({ category: item.category, volume_h24_usd: item.volume_h24_usd, provenance: ['infopunks:persisted-market-snapshots'] })),
      concentration: { top_three_liquidity_share: aggregates.top_three_liquidity_share, top_three_volume_share: aggregates.top_three_volume_share, scope: 'eligible reviewed intersections with validated persisted market data' },
      classification_coverage: { reviewed_exact_contracts: resolved.length, cross_layer_eligible_exact_contracts: entries.length, unknown_exact_contracts: resolved.filter((item) => item.primary_layer === 'unknown').length, percentage: percent(entries.length, resolved.length), bounded_limit: MAX_CLASSIFICATIONS, complete: !durableHasMore && this.options.curatedClassifications.length <= MAX_CLASSIFICATIONS },
      market_data_coverage: { eligible_exact_contracts: entries.length, with_persisted_market_data: marketDataCount, percentage: percent(marketDataCount, entries.length), provider_requests_in_path: 0 },
      conflict_count: conflicts.length,
      source_required_count: sourceRequired.length,
      unknown_count: resolved.filter((item) => item.primary_layer === 'unknown').length,
      captured_at: capturedAt,
      observed_at: capturedAt,
      freshness,
      confidence,
      warnings: [...new Set(warnings)],
      provider_provenance: { provider: 'dexscreener' as const, chain_id: 'robinhood' as const, role: 'persisted_market_and_attention_context_only' as const, external_requests_in_path: false as const, snapshot_count: marketDataCount },
      classification_provenance: { precedence: ['curated_reviewed_memory', 'durable_approved_reviewed_classification', 'provider_context', 'unknown'] as const, curated_reviewed_records: curated.length, durable_approved_records: durable.length, exact_contract_only: true as const },
      bounded_universe: `This response covers at most ${MAX_CLASSIFICATIONS} exact-contract reviewed records and their latest persisted snapshots. It is not complete Robinhood Chain accounting.`,
      methodology_version: 'cross_layer_intersections_v1' as const,
      data_mode: marketDataCount ? 'live_cached' as const : 'unavailable' as const,
      caveats: ['Cross-layer entries require exact-contract reviewed evidence. Provider observations cannot create, promote, or approve an entry.', 'Tracked liquidity and volume describe only the bounded reviewed set with validated persisted snapshots.'],
      internal_conflicts: conflicts,
      internal_source_required: sourceRequired
    };
  }
}

function fromCurated(record: RhChainLayerClassification, conflict: RhChainClassificationConflict | null): ResolvedClassification {
  const secondary = normalizeCuratedSecondary(record.secondary_layers);
  return {
    chain: 'robinhood', contract: normalize(record.contract), primary_layer: normalizePrimary(record.primary_layer), secondary_layers: secondary,
    confidence: record.classification_confidence, evidence_summary: record.classification_reason ? [record.classification_reason] : [], classification_version: null,
    classification_source: 'curated_reviewed_memory', effective_at: record.reviewed_at ?? record.observed_at, reviewed_at: record.reviewed_at,
    display_name: record.display_name, ticker: record.ticker, dexscreener_pair: record.dexscreener_pair, explanation: record.classification_reason,
    evidence_state: record.evidence_state, missing_evidence: [...record.missing_evidence], caveat: record.caveat,
    conflict_state: conflict ? 'curated_durable_disagreement' : 'none', warnings: conflict ? [conflict.warning] : []
  };
}

function fromDurable(record: DurablePublicClassification): ResolvedClassification {
  return {
    chain: 'robinhood', contract: normalize(record.contract), primary_layer: record.primary_layer, secondary_layers: [...record.secondary_layers], confidence: record.confidence,
    evidence_summary: record.classification_evidence.map((item) => `${item.source_name}: ${item.summary}`), classification_version: record.classification_version,
    classification_source: 'durable_reviewed_classification', effective_at: record.effective_at, reviewed_at: record.updated_at, display_name: null, ticker: null,
    dexscreener_pair: null, explanation: record.classification_evidence.map((item) => item.summary).join(' '), evidence_state: 'approved', missing_evidence: [], caveat: null,
    conflict_state: 'none', warnings: record.source === 'provider_observation' ? ['Provider-origin context was admitted only after a separate authenticated reviewed approval.'] : []
  };
}

function conflictRecord(contract: string, curated: RhChainLayerClassification, durable: DurablePublicClassification): RhChainClassificationConflict {
  return {
    chain: 'robinhood', contract, conflict_state: 'curated_durable_disagreement',
    curated: { primary_layer: normalizePrimary(curated.primary_layer), secondary_layers: normalizeCuratedSecondary(curated.secondary_layers), confidence: curated.classification_confidence, reviewed_at: curated.reviewed_at },
    durable: { primary_layer: durable.primary_layer, secondary_layers: [...durable.secondary_layers], confidence: durable.confidence, classification_version: durable.classification_version, effective_at: durable.effective_at! },
    resolution: 'curated_memory_preserved', resolution_route: `/internal/rh-chain/classifications/${contract}`,
    warning: 'Curated reviewed memory and the durable approved classification disagree. Curated memory remains authoritative until a reviewer resolves the record.'
  };
}

function classificationDisagrees(curated: RhChainLayerClassification, durable: DurablePublicClassification) {
  const curatedLayers = [normalizePrimary(curated.primary_layer), ...normalizeCuratedSecondary(curated.secondary_layers)].sort();
  const durableLayers = [durable.primary_layer, ...durable.secondary_layers].sort();
  return curatedLayers.join('|') !== durableLayers.join('|');
}

function eligibilityGaps(record: ResolvedClassification) {
  const reasons: string[] = [];
  if (!EXACT_CONTRACT.test(record.contract)) reasons.push('Exact contract identity is not established.');
  const layers = meaningfulLayers(record.primary_layer, record.secondary_layers);
  if (record.primary_layer === 'unknown') reasons.push('Primary layer remains unknown.');
  if (layers.length < 2) reasons.push('At least two meaningful reviewed layers are required.');
  if (!record.evidence_summary.length) reasons.push('Classification evidence is required for every displayed layer.');
  if (record.classification_source === 'curated_reviewed_memory' && ['source_required', 'source_required_for_claims', 'watch_only'].includes(record.evidence_state)) reasons.push('Curated evidence remains source required for the intersection claim.');
  return reasons;
}

function categoryFor(primary: string, secondary: string[]): RhChainIntersectionCategory | null {
  const layers = new Set(meaningfulLayers(primary, secondary));
  if (layers.has('meme') && layers.has('rwa')) return 'meme_x_rwa';
  if (layers.has('agent') && layers.has('rwa')) return 'agent_x_rwa';
  if (layers.has('agent') && layers.has('defi')) return 'agent_x_defi';
  if (layers.has('agent') && layers.has('meme')) return 'agent_x_meme';
  if (layers.has('infrastructure') && layers.has('rwa')) return 'infrastructure_x_rwa';
  if (layers.has('infrastructure') && layers.has('defi')) return 'infrastructure_x_defi';
  if (layers.has('meme') && layers.has('infrastructure')) return 'meme_x_infrastructure';
  if (layers.has('consumer') && [...layers].some((layer) => ['rwa', 'defi', 'lending', 'payments', 'trading'].includes(layer))) return 'consumer_x_tokenized_finance';
  if (layers.has('rwa') && layers.has('lending')) return 'rwa_x_lending';
  if (layers.has('defi') && layers.has('rwa')) return 'defi_x_rwa';
  if (layers.has('meme') && layers.has('ai-narrative')) return 'meme_x_ai_narrative';
  return null;
}

function marketData(snapshot: PersistedSnapshot | null, freshness: Freshness, now: Date) {
  if (!snapshot) return { available: false as const, canonical_pair: null, dex: null, price_usd: null, liquidity_usd: null, market_cap_usd: null, fdv_usd: null, volume: { h24: null, h6: null, h1: null }, transactions: { h24: { buys: null, sells: null }, h6: { buys: null, sells: null } }, pair_age_days: null, active_boosts: null, paid_order_context: { types: [], statuses: [] }, snapshot_timestamp: null, freshness: 'unavailable' as const, provider: 'dexscreener' as const, raw_data_version: null, cache_status: null, source_url: null };
  return {
    available: true as const,
    canonical_pair: { pair_address: snapshot.pair_address, base_token: snapshot.base_token ?? null, quote_token: snapshot.quote_token ?? null, labels: snapshot.pair_labels ?? [] },
    dex: snapshot.dex_id, price_usd: snapshot.price_usd, liquidity_usd: snapshot.liquidity_usd, market_cap_usd: snapshot.market_cap, fdv_usd: snapshot.fdv,
    volume: { h24: snapshot.volume_h24, h6: snapshot.volume_h6, h1: snapshot.volume_h1 },
    transactions: { h24: { buys: snapshot.txns_h24_buys, sells: snapshot.txns_h24_sells }, h6: { buys: snapshot.txns_h6_buys, sells: snapshot.txns_h6_sells } },
    pair_age_days: snapshot.pair_created_at ? Math.max(0, Number(((now.getTime() - Date.parse(snapshot.pair_created_at)) / 86_400_000).toFixed(1))) : null,
    active_boosts: snapshot.active_boosts, paid_order_context: { types: snapshot.paid_order_types, statuses: snapshot.paid_order_statuses },
    snapshot_timestamp: snapshot.captured_at, freshness, provider: 'dexscreener' as const, raw_data_version: snapshot.raw_data_version ?? null,
    cache_status: snapshot.cache_status ?? null, source_url: snapshot.source_url
  };
}

function aggregate(entries: Array<{ category: RhChainIntersectionCategory; market_data: ReturnType<typeof marketData> }>) {
  const byCategory = new Map<RhChainIntersectionCategory, { category: RhChainIntersectionCategory; project_count: number; liquidity_usd: number | null; volume_h24_usd: number | null }>();
  for (const entry of entries) {
    const current = byCategory.get(entry.category) ?? { category: entry.category, project_count: 0, liquidity_usd: null, volume_h24_usd: null };
    current.project_count += 1;
    if (entry.market_data.liquidity_usd !== null) current.liquidity_usd = (current.liquidity_usd ?? 0) + entry.market_data.liquidity_usd;
    if (entry.market_data.volume.h24 !== null) current.volume_h24_usd = (current.volume_h24_usd ?? 0) + entry.market_data.volume.h24;
    byCategory.set(entry.category, current);
  }
  const byIntersection = [...byCategory.values()].sort((left, right) => right.project_count - left.project_count || (right.liquidity_usd ?? -1) - (left.liquidity_usd ?? -1) || left.category.localeCompare(right.category));
  return { by_intersection: byIntersection, top_three_liquidity_share: concentration(entries.map((entry) => entry.market_data.liquidity_usd)), top_three_volume_share: concentration(entries.map((entry) => entry.market_data.volume.h24)) };
}

function snapshotFreshness(snapshot: PersistedSnapshot | null, now: Date): Freshness {
  if (!snapshot) return 'unavailable';
  const age = now.getTime() - Date.parse(snapshot.captured_at);
  return snapshot.freshness_state === 'stale' || age > 6 * 60 * 60 * 1_000 ? 'stale' : 'fresh';
}
function activeAt(record: DurablePublicClassification, now: Date) { return record.review_status === 'approved' && Boolean(record.effective_at) && !record.superseded_at && Date.parse(record.effective_at!) <= now.getTime(); }
function normalize(value: string) { return value.trim().toLowerCase(); }
function normalizePrimary(value: string) { return value === 'unclassified' ? 'unknown' : value; }
function normalizeCuratedSecondary(values: readonly string[]) { return [...new Set(values.map((value) => ({ ai_narrative: 'ai-narrative', trading_culture: 'trading', meme_distribution: 'meme', real_world_asset_narrative: 'rwa' })[value] ?? value).filter((value) => ['meme', 'rwa', 'agent', 'infrastructure', 'defi', 'lending', 'payments', 'data', 'identity', 'launchpad', 'energy', 'trading', 'consumer', 'ai-narrative'].includes(value)))]; }
function meaningfulLayers(primary: string, secondary: string[]) { return [...new Set([primary, ...secondary].filter((value) => value !== 'unknown'))]; }
function percent(part: number, total: number) { return total > 0 ? Number((part / total * 100).toFixed(2)) : null; }
function concentration(values: Array<number | null>) { const available = values.filter((value): value is number => value !== null && value >= 0); const total = available.reduce((sum, value) => sum + value, 0); return total > 0 ? Number((available.sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0) / total * 100).toFixed(2)) : null; }
export function labelCategory(category: RhChainIntersectionCategory) { return ({ meme_x_rwa: 'Meme × RWA', agent_x_rwa: 'Agent × RWA', agent_x_defi: 'Agent × DeFi', agent_x_meme: 'Meme × Agent', infrastructure_x_rwa: 'Infrastructure × RWA', infrastructure_x_defi: 'Infrastructure × DeFi', meme_x_infrastructure: 'Meme × Infrastructure', consumer_x_tokenized_finance: 'Consumer × Tokenized Finance', rwa_x_lending: 'RWA × Lending', defi_x_rwa: 'DeFi × RWA', meme_x_ai_narrative: 'Meme × AI narrative' })[category]; }
