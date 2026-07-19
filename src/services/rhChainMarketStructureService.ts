import type { RhChainDataFreshness } from '../data/rhChain';
import type { RhChainAttentionState } from './rhChainAttentionService';
import type { RhChainMetricsSnapshot } from './rhChainChainPulseService';
import type { RhChainMarketResponse, RhChainReviewedClassification } from './rhChainMarketDataService';
import { RhChainMarketDataService } from './rhChainMarketDataService';
import { resolveRhChainContractIntelligence } from './rhChainContractIntelligenceService';
import type { RhChainMarketSnapshot as StoredMarketSnapshot } from './rhChainMarketSnapshotService';

export const RH_CHAIN_MARKET_LAYERS = ['meme', 'rwa', 'agent', 'infrastructure', 'defi', 'unclassified'] as const;
export type RhChainMarketLayer = typeof RH_CHAIN_MARKET_LAYERS[number];
export type RhChainSecondaryLayer = RhChainMarketLayer | 'distribution' | 'trading_culture' | 'launchpad' | 'meme_distribution' | 'narrative_candidate' | 'utility_claim_under_review' | 'speculative_distribution' | 'tokenized_equities' | 'energy' | 'real_world_asset_narrative' | 'data' | 'tokenized_attention' | 'ai_narrative';
export type RhChainClassificationConfidence = 'low' | 'medium' | 'high';
export type RhChainCrossLayerCategory = 'meme_x_rwa' | 'agent_x_rwa' | 'agent_x_meme' | 'infrastructure_x_rwa' | 'meme_x_infrastructure' | 'defi_x_rwa' | 'meme_x_ai_narrative';

export type RhChainLayerClassification = {
  contract: string;
  ticker: string | null;
  display_name: string | null;
  dexscreener_pair: string | null;
  primary_layer: RhChainMarketLayer;
  secondary_layers: RhChainSecondaryLayer[];
  cross_layer_category: RhChainCrossLayerCategory | null;
  classification_reason: string;
  classification_source: 'manual_review' | 'source_required';
  classification_confidence: RhChainClassificationConfidence;
  evidence_state: 'approved_signal' | 'watch_only' | 'under_receipt_check' | 'reviewed' | 'source_required' | 'source_required_for_claims';
  missing_evidence: string[];
  caveat: string | null;
  reviewed_at: string | null;
  observed_at: string;
  data_mode: RhChainDataFreshness;
};

export type RhChainAttentionQuality = {
  contract: string;
  state: RhChainAttentionState;
  score: number | null;
  components: {
    organic_trader_retention: number | null;
    liquidity_retention: number | null;
    post_boost_volume_retention: number | null;
    narrative_persistence: number | null;
    evidence_quality: number | null;
    contract_deployer_clarity: number | null;
  };
  observed_at: string;
  caveats: string[];
};

export type RhChainMarketStructureOptions = {
  marketData: RhChainMarketDataService;
  metrics?: () => Promise<RhChainMetricsSnapshot | null>;
  classifications?: (() => Promise<readonly RhChainLayerClassification[]> | readonly RhChainLayerClassification[]) | readonly RhChainLayerClassification[];
  attentionEvidence?: (contract: string) => Promise<Partial<Pick<RhChainAttentionQuality['components'], 'narrative_persistence' | 'evidence_quality' | 'contract_deployer_clarity'>> | null> | Partial<Pick<RhChainAttentionQuality['components'], 'narrative_persistence' | 'evidence_quality' | 'contract_deployer_clarity'>> | null;
  latestReceipt?: () => Promise<{ receipt_id: string; timestamp: string; summary: string } | null> | { receipt_id: string; timestamp: string; summary: string } | null;
  snapshotHistoryForContracts?: (contracts: string[]) => Promise<Record<string, StoredMarketSnapshot[]>>;
  now?: () => Date;
};

type AttentionObservation = {
  contract: string;
  boost_amount: number | null;
  total_boost_amount: number | null;
  paid_order_types: string[];
  observed_at: string;
  pair_metrics: RhChainMarketResponse['market_snapshot'];
};
type MarketStructureAsset = Omit<RhChainMarketResponse, 'classification'> & { classification: RhChainLayerClassification };

export type RhChainMarketPulseFreshness = 'fresh' | 'stale' | 'partial' | 'unavailable';
export type RhChainMarketPulseConfidence = 'high' | 'medium' | 'low';
export type RhChainMarketPulseMetric = {
  value: number | null;
  previous_value: number | null;
  absolute_change: number | null;
  percentage_change: number | null;
  unit: 'usd' | 'count' | 'percent' | 'score';
  provenance: string[];
  captured_at: string;
  freshness: RhChainMarketPulseFreshness;
  confidence: RhChainMarketPulseConfidence;
};
export type RhChainMarketPulseFinding = {
  subject: string;
  detail: string;
  metric: RhChainMarketPulseMetric;
} | null;

/**
 * A read-only market map. It intentionally joins provider observations only to
 * exact-contract, reviewed classifications; no provider response can write or
 * promote the reviewed record.
 */
export class RhChainMarketStructureService {
  private readonly observations = new Map<string, AttentionObservation[]>();
  private readonly now: () => Date;
  constructor(private readonly options: RhChainMarketStructureOptions) { this.now = options.now ?? (() => new Date()); }

  async marketStructure() {
    const snapshot = await this.safeSnapshot();
    const classified = snapshot.assets.filter((asset) => asset.classification.classification_source === 'manual_review' && asset.classification.primary_layer !== 'unclassified');
    const totalVolume = sum(snapshot.assets.map((asset) => asset.market_snapshot?.volume.h24 ?? 0));
    const classifiedVolume = sum(classified.map((asset) => asset.market_snapshot?.volume.h24 ?? 0));
    const trackedDexes = [...new Set(snapshot.assets.map((asset) => asset.market_snapshot?.dexId).filter((value): value is string => Boolean(value)))].sort();
    const layers = RH_CHAIN_MARKET_LAYERS.map((layer) => {
      const volume = sum(classified.filter((asset) => asset.classification.primary_layer === layer || asset.classification.secondary_layers.includes(layer)).map((asset) => asset.market_snapshot?.volume.h24 ?? 0));
      return { layer, volume_24h: volume || null, percentage: totalVolume > 0 ? Number((volume / totalVolume * 100).toFixed(2)) : null, label: 'classifier_estimate', caveat: 'not complete chain accounting' };
    });
    const metrics = await this.metrics();
    const observedAt = latest(snapshot.assets.map((asset) => asset.market_snapshot?.capturedAt).filter(Boolean) as string[]) ?? this.now().toISOString();
    return {
      title: '4663 Market Structure',
      statement: 'DEX Screener shows what Robinhood Chain is trading. Infopunks shows what Robinhood Chain is becoming.',
      market_pulse: {
        chain_volume_24h: metrics?.dex_volume_24h ?? null,
        observed_transaction_count: sum(snapshot.assets.map((asset) => (asset.market_snapshot?.txns.h24.buys ?? 0) + (asset.market_snapshot?.txns.h24.sells ?? 0))) || null,
        tracked_dexes: trackedDexes,
        new_pair_velocity: null,
        tracked_pair_count: snapshot.assets.filter((asset) => asset.market_snapshot).length,
        classified_market_coverage: coverage(classifiedVolume, totalVolume),
        unclassified_market_coverage: coverage(Math.max(0, totalVolume - classifiedVolume), totalVolume),
        layer_volume_estimates: layers,
        observed_at: observedAt,
        source_notes: [
          'Chain-wide volume is taken from existing trusted chain context when available; pair context is DEX Screener official API data.',
          'Layer percentages are classifier estimates, not complete chain accounting.',
          'Only the trusted-liquidity canonical pair is counted for each exact contract.'
        ],
        freshness: metrics?.freshness_state ?? (snapshot.fallback ? 'source_required' : 'live_cached'),
        methodology_caveat: 'DEX Screener rank, boosts, and paid orders are attention context. They do not establish organic demand, identity, classification, a receipt, an approved signal, or 4663 Index inclusion.'
      },
      market_composition: layers,
      layer_leaders: RH_CHAIN_MARKET_LAYERS.map((layer) => ({ layer, assets: classified.filter((asset) => asset.classification.primary_layer === layer).sort((a, b) => (b.market_snapshot?.volume.h24 ?? -1) - (a.market_snapshot?.volume.h24 ?? -1)).slice(0, 5).map(publicAsset) })),
      observed_coverage: { tracked_exact_contracts: snapshot.assets.length, classified_exact_contracts: classified.length, canonical_pair_only: true },
      latest_related_receipts: await this.receipts(),
      data_mode: snapshot.fallback ? 'unavailable' as const : 'live_cached' as const,
      doctrine: 'Exact contract only. Provider data is context only. Reviewed classifications outrank auto-observed market context.',
      disclaimer: 'Public intelligence only. Not endorsement or financial advice. No buy or sell recommendation.'
    };
  }

  async marketPulse() {
    const observedAt = this.now().toISOString();
    const currentStart = new Date(this.now().getTime() - 24 * 60 * 60 * 1_000).toISOString();
    const previousStart = new Date(this.now().getTime() - 48 * 60 * 60 * 1_000).toISOString();
    const [snapshot, providerStatus, boosts] = await Promise.all([
      this.safeSnapshot(),
      this.options.marketData.getProviderStatus(),
      this.options.marketData.getBoosts()
    ]);
    const tracked = snapshot.assets.filter((asset) => asset.market_snapshot);
    const contracts = tracked.map((asset) => asset.token.contract.toLowerCase()).slice(0, 300);
    const histories = await this.safeHistories(contracts);
    const previous = new Map<string, StoredMarketSnapshot>();
    for (const contract of contracts) {
      const candidate = (histories[contract] ?? []).filter((item) => item.captured_at >= previousStart && item.captured_at < currentStart).at(-1);
      if (candidate) previous.set(contract, candidate);
    }
    const capturedAt = latest(tracked.map((asset) => asset.market_snapshot?.capturedAt).filter(Boolean) as string[]) ?? observedAt;
    const staleCount = tracked.filter((asset) => asset.market_snapshot?.freshness === 'stale').length;
    const overallFreshness: RhChainMarketPulseFreshness = !tracked.length ? 'unavailable' : snapshot.fallback || tracked.length < snapshot.assets.length ? 'partial' : staleCount ? 'stale' : 'fresh';
    const historyCoverage = tracked.length ? previous.size / tracked.length : 0;
    const confidence: RhChainMarketPulseConfidence = providerStatus.health.healthy && tracked.length >= 3 && historyCoverage >= 0.8 ? 'high' : tracked.length && !providerStatus.fallback_mode ? 'medium' : 'low';
    const provenance = ['dexscreener:robinhood', 'infopunks:reviewed-layer-classifications', 'infopunks:market-snapshot-memory'];
    const totals = aggregateCurrent(tracked);
    const previousTotals = aggregatePrevious(previous.values());
    const hasCurrentMarketData = tracked.length > 0;
    const metrics = {
      tracked_volume_24h: pulseMetric(hasCurrentMarketData ? totals.volume : null, previous.size ? previousTotals.volume : null, 'usd', provenance, capturedAt, overallFreshness, confidence),
      tracked_liquidity: pulseMetric(hasCurrentMarketData ? totals.liquidity : null, previous.size ? previousTotals.liquidity : null, 'usd', provenance, capturedAt, overallFreshness, confidence),
      tracked_transactions_24h: pulseMetric(hasCurrentMarketData ? totals.transactions : null, previous.size ? previousTotals.transactions : null, 'count', provenance, capturedAt, overallFreshness, confidence),
      active_tracked_tokens: pulseMetric(tracked.length, previous.size, 'count', provenance, capturedAt, overallFreshness, confidence),
      newly_discovered_tokens: pulseMetric(tracked.filter((asset) => Date.parse(asset.market_snapshot?.pairCreatedAt ?? '') >= Date.parse(currentStart)).length, null, 'count', ['dexscreener:pair-created-at'], capturedAt, overallFreshness, confidence)
    };
    const layerComposition = RH_CHAIN_MARKET_LAYERS.map((layer) => {
      const assets = tracked.filter((asset) => normalizedPulseLayer(asset.classification.primary_layer) === layer);
      const current = aggregateCurrent(assets);
      const priorRows = assets.map((asset) => previous.get(asset.token.contract.toLowerCase())).filter((item): item is StoredMarketSnapshot => Boolean(item));
      const prior = aggregatePrevious(priorRows);
      return {
        layer: layer === 'unclassified' ? 'unknown' as const : layer,
        label: pulseLayerLabel(layer),
        volume_24h: pulseMetric(hasCurrentMarketData ? current.volume : null, priorRows.length ? prior.volume : null, 'usd', provenance, capturedAt, overallFreshness, confidence),
        liquidity: pulseMetric(hasCurrentMarketData ? current.liquidity : null, priorRows.length ? prior.liquidity : null, 'usd', provenance, capturedAt, overallFreshness, confidence),
        transactions_24h: pulseMetric(hasCurrentMarketData ? current.transactions : null, priorRows.length ? prior.transactions : null, 'count', provenance, capturedAt, overallFreshness, confidence),
        active_tokens: pulseMetric(assets.length, priorRows.length, 'count', provenance, capturedAt, overallFreshness, confidence),
        volume_share: pulseMetric(totals.volume > 0 ? round(current.volume / totals.volume * 100) : null, null, 'percent', provenance, capturedAt, overallFreshness, confidence),
        liquidity_share: pulseMetric(totals.liquidity > 0 ? round(current.liquidity / totals.liquidity * 100) : null, null, 'percent', provenance, capturedAt, overallFreshness, confidence)
      };
    });
    const volumeConcentration = concentration(tracked.map((asset) => asset.market_snapshot?.volume.h24 ?? 0), 3);
    const liquidityConcentration = concentration(tracked.map((asset) => asset.market_snapshot?.liquidityUsd ?? 0), 3);
    const dexVolumes = new Map<string, number>();
    for (const asset of tracked) {
      const dex = asset.market_snapshot?.dexId ?? 'unknown';
      dexVolumes.set(dex, (dexVolumes.get(dex) ?? 0) + (asset.market_snapshot?.volume.h24 ?? 0));
    }
    const leadingDex = [...dexVolumes.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const unknownLayer = layerComposition.find((layer) => layer.layer === 'unknown')!;
    const fastestLayer = [...layerComposition].filter((layer) => layer.volume_24h.absolute_change !== null).sort((a, b) => (b.volume_24h.absolute_change ?? -Infinity) - (a.volume_24h.absolute_change ?? -Infinity))[0] ?? null;
    const liquidityLeader = tokenChangeLeader(tracked, previous, 'liquidity', provenance, capturedAt, overallFreshness, confidence);
    const volumeLeader = tokenChangeLeader(tracked, previous, 'volume', provenance, capturedAt, overallFreshness, confidence);
    const retention = postBoostRetentionLeader(tracked, histories, provenance, capturedAt, overallFreshness, confidence);
    const crossLayer = crossLayerDevelopment(tracked, provenance, capturedAt, overallFreshness, confidence);
    const currentBoosts = sum(boosts.boosts.map((boost) => boost.amount ?? 0));
    const previousBoosts = sum([...previous.values()].map((item) => item.active_boosts));
    const warnings = pulseWarnings({ tracked: tracked.length, total: snapshot.assets.length, historyCoverage, staleCount, unknownShare: unknownLayer.volume_share.value, providerFallback: providerStatus.fallback_mode });
    const interpretation = interpretMarketPulse({ metrics, layers: layerComposition, fastestLayer, retention, currentBoosts, previousBoosts, capturedAt, freshness: overallFreshness, confidence, provenance });
    return {
      title: 'Robinhood Chain Market Pulse',
      observation_window: { label: 'Rolling 24 hours', current: { started_at: currentStart, ended_at: observedAt }, previous: { started_at: previousStart, ended_at: currentStart } },
      metrics,
      layer_composition: layerComposition,
      momentum: {
        fastest_growing_layer: fastestLayer ? finding(fastestLayer.label, `${signed(fastestLayer.volume_24h.absolute_change)} tracked 24h volume versus the previous observation window.`, fastestLayer.volume_24h) : null,
        largest_liquidity_increase: liquidityLeader,
        largest_volume_acceleration: volumeLeader,
        strongest_post_boost_retention: retention,
        most_important_cross_layer_development: crossLayer
      },
      concentration: {
        top_three_volume_share: pulseMetric(volumeConcentration, null, 'percent', provenance, capturedAt, overallFreshness, confidence),
        top_three_liquidity_share: pulseMetric(liquidityConcentration, null, 'percent', provenance, capturedAt, overallFreshness, confidence),
        leading_dex: leadingDex ? { dex_id: leadingDex[0], volume_share: pulseMetric(totals.volume > 0 ? round(leadingDex[1] / totals.volume * 100) : null, null, 'percent', provenance, capturedAt, overallFreshness, confidence) } : null,
        unknown_volume_share: unknownLayer.volume_share
      },
      interpretation,
      provider_provenance: { provider: 'dexscreener', chain_id: 'robinhood', role: 'market_and_attention_sensor', health: providerStatus.health, fallback_mode: providerStatus.fallback_mode, caveats: providerStatus.caveats },
      captured_at: capturedAt,
      freshness: overallFreshness,
      warnings,
      confidence,
      data_mode: tracked.length ? 'live_cached' as const : 'unavailable' as const,
      disclaimer: 'Public market-structure intelligence only. Not a complete chain index, endorsement, or investment recommendation.'
    };
  }

  async crossLayer() {
    const snapshot = await this.safeSnapshot();
    const receipt = await this.receipts();
    const entries = snapshot.assets.flatMap((asset) => {
      const category = categoryFor(asset.classification);
      if (!category) return [];
      return [{ category, contract: asset.token.contract, display_name: asset.classification.display_name, dexscreener_pair: asset.classification.dexscreener_pair, primary_layer: asset.classification.primary_layer, secondary_layers: asset.classification.secondary_layers, explanation: asset.classification.classification_reason, evidence_state: asset.classification.evidence_state, latest_receipt: receipt[0] ?? null, attention_quality_state: asset.attention.attention_state, missing_evidence: asset.classification.missing_evidence, caveat: asset.classification.caveat }];
    });
    return { title: 'Cross-Layer Assets', entries, categories: RH_CHAIN_CROSS_LAYER_CATEGORIES, observed_at: this.now().toISOString(), data_mode: snapshot.fallback ? 'unavailable' as const : 'live_cached' as const, caveats: ['Cross-layer entries require an exact-contract reviewed classification. Provider observations cannot add an entry.'] };
  }

  async attentionQuality() {
    const snapshot = await this.safeSnapshot();
    const boosts = await this.options.marketData.getBoosts();
    const boostedContracts = new Map<string, { amount: number | null; total: number | null }>();
    for (const boost of [...boosts.boosts, ...boosts.top_boosts]) boostedContracts.set(boost.tokenAddress.toLowerCase(), { amount: boost.amount, total: boost.totalAmount });
    const assets = await Promise.all([...boostedContracts.entries()].map(async ([contract, boost]) => {
      const asset = snapshot.assets.find((item) => item.token.contract.toLowerCase() === contract) ?? await this.options.marketData.getToken(contract);
      const observation: AttentionObservation = { contract, boost_amount: boost.amount, total_boost_amount: boost.total, paid_order_types: asset.attention.paid_orders.map((order) => order.type).filter((value): value is string => Boolean(value)), observed_at: asset.market_snapshot?.capturedAt ?? this.now().toISOString(), pair_metrics: asset.market_snapshot };
      this.record(observation);
      return { observation, quality: await this.quality(asset, observation), contract_intelligence: resolveRhChainContractIntelligence(contract) };
    }));
    return { title: 'Paid Attention Watch', observations: assets.map((item) => item.observation), attention_quality: assets.map((item) => item.quality), contract_intelligence: assets.map((item) => ({ contract: item.observation.contract, source: item.contract_intelligence.source, display_name: item.contract_intelligence.display_name, review_status: item.contract_intelligence.review_status, claim_status: item.contract_intelligence.claim_status })), observed_at: this.now().toISOString(), data_mode: boosts.status.fallback_mode ? 'unavailable' as const : 'live_cached' as const, caveats: ['Paid boosts are not misconduct. Boost rank is not organic conviction. Insufficient before/during/after history returns source_required.'] };
  }

  private async safeSnapshot() {
    try {
      const [market, classifications] = await Promise.all([this.options.marketData.getTokens(), this.classifications()]);
      const byContract = new Map(classifications.map((item) => [item.contract.toLowerCase(), item]));
      const assets: MarketStructureAsset[] = market.tokens.map((asset) => {
        const intelligence = resolveRhChainContractIntelligence(asset.token.contract);
        return { ...asset, classification: byContract.get(asset.token.contract.toLowerCase()) ?? intelligence.market_structure ?? classificationFromLegacy(asset) };
      });
      for (const classification of classifications) if (!assets.some((asset) => asset.token.contract.toLowerCase() === classification.contract.toLowerCase())) assets.push(classificationOnlyAsset(classification));
      return { assets, fallback: market.status.fallback_mode };
    } catch { return { assets: [] as MarketStructureAsset[], fallback: true }; }
  }

  private async classifications() {
    const configured = this.options.classifications;
    if (typeof configured !== 'function') return configured ?? [];
    return await configured();
  }
  private async metrics() { return await this.options.metrics?.() ?? null; }
  private async safeHistories(contracts: string[]) { try { return await this.options.snapshotHistoryForContracts?.(contracts) ?? {}; } catch { return {}; } }
  private async receipts() { const receipt = await this.options.latestReceipt?.() ?? null; return receipt ? [receipt] : []; }
  private record(observation: AttentionObservation) { const current = this.observations.get(observation.contract) ?? []; this.observations.set(observation.contract, [...current, observation].slice(-24)); }
  private async quality(asset: Pick<RhChainMarketResponse, 'attention'>, observation: AttentionObservation): Promise<RhChainAttentionQuality> {
    const history = this.observations.get(observation.contract) ?? [];
    const base = { organic_trader_retention: null, liquidity_retention: null, post_boost_volume_retention: null, narrative_persistence: null, evidence_quality: null, contract_deployer_clarity: null };
    if (history.length < 3) return { contract: observation.contract, state: 'source_required', score: null, components: base, observed_at: observation.observed_at, caveats: ['Before/during/after paid-attention observations are insufficient; no score is inferred.'] };
    const [before, during, after] = history.slice(-3);
    const beforeTraders = traders(before.pair_metrics);
    const afterTraders = traders(after.pair_metrics);
    const provided = await this.options.attentionEvidence?.(observation.contract) ?? {};
    const components = {
      organic_trader_retention: retained(afterTraders, beforeTraders, 0.7) ? 25 : 0,
      liquidity_retention: retained(after.pair_metrics?.liquidityUsd ?? null, before.pair_metrics?.liquidityUsd ?? null, 0.65) ? 25 : 0,
      post_boost_volume_retention: retained(after.pair_metrics?.volume.h24 ?? null, during.pair_metrics?.volume.h24 ?? null, 0.5) ? 20 : 0,
      narrative_persistence: validWeight(provided.narrative_persistence, 15),
      evidence_quality: validWeight(provided.evidence_quality, 10),
      contract_deployer_clarity: validWeight(provided.contract_deployer_clarity, 5)
    };
    if (Object.values(components).some((value) => value === null)) return { contract: observation.contract, state: 'source_required', score: null, components, observed_at: observation.observed_at, caveats: ['Narrative persistence and contract/deployer clarity require reviewed evidence; attention quality remains source_required until every weighted component is supported.'] };
    return { contract: observation.contract, state: asset.attention.attention_state, score: Object.values(components).reduce<number>((total, value) => total + (value ?? 0), 0), components, observed_at: observation.observed_at, caveats: ['Score is descriptive attention context only; it does not create a reviewed classification, approved signal, or endorsement.'] };
  }
}

export type RhChainMarketPulse = Awaited<ReturnType<RhChainMarketStructureService['marketPulse']>>;

export const RH_CHAIN_CROSS_LAYER_CATEGORIES: RhChainCrossLayerCategory[] = ['meme_x_rwa', 'agent_x_rwa', 'agent_x_meme', 'infrastructure_x_rwa', 'meme_x_infrastructure', 'defi_x_rwa', 'meme_x_ai_narrative'];

function aggregateCurrent(assets: MarketStructureAsset[]) {
  return assets.reduce((total, asset) => ({
    volume: total.volume + (asset.market_snapshot?.volume.h24 ?? 0),
    liquidity: total.liquidity + (asset.market_snapshot?.liquidityUsd ?? 0),
    transactions: total.transactions + (asset.market_snapshot?.txns.h24.buys ?? 0) + (asset.market_snapshot?.txns.h24.sells ?? 0)
  }), { volume: 0, liquidity: 0, transactions: 0 });
}
function aggregatePrevious(snapshots: Iterable<StoredMarketSnapshot>) {
  let volume = 0; let liquidity = 0; let transactions = 0;
  for (const item of snapshots) { volume += item.volume_h24 ?? 0; liquidity += item.liquidity_usd ?? 0; transactions += (item.txns_h24_buys ?? 0) + (item.txns_h24_sells ?? 0); }
  return { volume, liquidity, transactions };
}
function pulseMetric(value: number | null, previous: number | null, unit: RhChainMarketPulseMetric['unit'], provenance: string[], capturedAt: string, freshness: RhChainMarketPulseFreshness, confidence: RhChainMarketPulseConfidence): RhChainMarketPulseMetric {
  const absolute = value !== null && previous !== null ? round(value - previous) : null;
  return { value: value === null ? null : round(value), previous_value: previous === null ? null : round(previous), absolute_change: absolute, percentage_change: absolute !== null && previous !== null && previous > 0 ? round(absolute / previous * 100) : null, unit, provenance, captured_at: capturedAt, freshness, confidence };
}
function normalizedPulseLayer(layer: RhChainMarketLayer) { return RH_CHAIN_MARKET_LAYERS.includes(layer) ? layer : 'unclassified'; }
function pulseLayerLabel(layer: RhChainMarketLayer) { return layer === 'rwa' ? 'RWAs' : layer === 'defi' ? 'DeFi' : layer === 'unclassified' ? 'Unknown' : `${layer[0].toUpperCase()}${layer.slice(1)}${layer === 'infrastructure' ? '' : 's'}`; }
function concentration(values: number[], count: number) { const total = sum(values); return total > 0 ? round([...values].sort((a, b) => b - a).slice(0, count).reduce((value, item) => value + item, 0) / total * 100) : null; }
function finding(subject: string, detail: string, metric: RhChainMarketPulseMetric): NonNullable<RhChainMarketPulseFinding> { return { subject, detail, metric }; }
function tokenChangeLeader(assets: MarketStructureAsset[], previous: Map<string, StoredMarketSnapshot>, kind: 'volume' | 'liquidity', provenance: string[], capturedAt: string, freshness: RhChainMarketPulseFreshness, confidence: RhChainMarketPulseConfidence): RhChainMarketPulseFinding {
  const candidates = assets.flatMap((asset) => {
    const prior = previous.get(asset.token.contract.toLowerCase());
    if (!prior || !asset.market_snapshot) return [];
    const currentValue = kind === 'volume' ? asset.market_snapshot.volume.h24 : asset.market_snapshot.liquidityUsd;
    const previousValue = kind === 'volume' ? prior.volume_h24 : prior.liquidity_usd;
    if (currentValue === null || previousValue === null) return [];
    return [{ asset, metric: pulseMetric(currentValue, previousValue, 'usd', provenance, capturedAt, freshness, confidence) }];
  }).sort((a, b) => (b.metric.absolute_change ?? -Infinity) - (a.metric.absolute_change ?? -Infinity));
  const leader = candidates[0];
  if (!leader) return null;
  const name = leader.asset.classification.display_name ?? leader.asset.classification.ticker ?? leader.asset.token.contract;
  return finding(name, `${kind === 'volume' ? 'Tracked 24h volume' : 'Tracked liquidity'} changed ${signed(leader.metric.absolute_change)} versus the previous observation window.`, leader.metric);
}
function postBoostRetentionLeader(assets: MarketStructureAsset[], histories: Record<string, StoredMarketSnapshot[]>, provenance: string[], capturedAt: string, freshness: RhChainMarketPulseFreshness, confidence: RhChainMarketPulseConfidence): RhChainMarketPulseFinding {
  const candidates = assets.flatMap((asset) => {
    const current = asset.market_snapshot;
    if (!current) return [];
    const boosted = [...(histories[asset.token.contract.toLowerCase()] ?? [])].reverse().find((item) => item.active_boosts > 0 || item.paid_order_types.length > 0);
    if (!boosted || !boosted.liquidity_usd || !boosted.volume_h24 || current.liquidityUsd === null || current.volume.h24 === null) return [];
    const score = round(Math.min(1, current.liquidityUsd / boosted.liquidity_usd) * 50 + Math.min(1, current.volume.h24 / boosted.volume_h24) * 50);
    return [{ asset, boosted, score }];
  }).sort((a, b) => b.score - a.score);
  const leader = candidates[0];
  if (!leader) return null;
  const name = leader.asset.classification.display_name ?? leader.asset.classification.ticker ?? leader.asset.token.contract;
  return finding(name, `Liquidity and volume retention are measured against the latest stored paid-attention observation from ${leader.boosted.captured_at}.`, pulseMetric(leader.score, null, 'score', [...provenance, 'dexscreener:paid-attention'], capturedAt, freshness, confidence));
}
function crossLayerDevelopment(assets: MarketStructureAsset[], provenance: string[], capturedAt: string, freshness: RhChainMarketPulseFreshness, confidence: RhChainMarketPulseConfidence): RhChainMarketPulseFinding {
  const candidates = assets.filter((asset) => Boolean(categoryFor(asset.classification))).sort((a, b) => (b.market_snapshot?.volume.h24 ?? 0) - (a.market_snapshot?.volume.h24 ?? 0));
  const asset = candidates[0];
  if (!asset?.market_snapshot) return null;
  const category = categoryFor(asset.classification)!;
  const name = asset.classification.display_name ?? asset.classification.ticker ?? asset.token.contract;
  return finding(name, `${crossLayerText(category)} is the highest-volume reviewed cross-layer development in the tracked set.`, pulseMetric(asset.market_snapshot.volume.h24, null, 'usd', provenance, capturedAt, freshness, confidence));
}
function interpretMarketPulse(input: {
  metrics: { tracked_volume_24h: RhChainMarketPulseMetric; tracked_liquidity: RhChainMarketPulseMetric; active_tracked_tokens: RhChainMarketPulseMetric };
  layers: Array<{ layer: string; label: string; volume_24h: RhChainMarketPulseMetric; liquidity: RhChainMarketPulseMetric; volume_share: RhChainMarketPulseMetric }>;
  fastestLayer: { label: string; volume_24h: RhChainMarketPulseMetric } | null;
  retention: RhChainMarketPulseFinding;
  currentBoosts: number;
  previousBoosts: number;
  capturedAt: string;
  freshness: RhChainMarketPulseFreshness;
  confidence: RhChainMarketPulseConfidence;
  provenance: string[];
}) {
  const dominant = [...input.layers].filter((layer) => layer.volume_share.value !== null).sort((a, b) => (b.volume_share.value ?? 0) - (a.volume_share.value ?? 0))[0] ?? null;
  const liquidityGainer = [...input.layers].filter((layer) => (layer.liquidity.absolute_change ?? 0) > 0).sort((a, b) => (b.liquidity.absolute_change ?? 0) - (a.liquidity.absolute_change ?? 0))[0] ?? null;
  let headline = 'Market structure is waiting for fresh pair evidence.';
  const rules: string[] = [];
  if ((input.metrics.active_tracked_tokens.value ?? 0) > 0 && dominant) {
    headline = liquidityGainer && liquidityGainer.layer !== dominant.layer
      ? `${dominant.label} attention leads, while ${liquidityGainer.label} liquidity is gaining.`
      : `${dominant.label} lead tracked attention across ${input.metrics.active_tracked_tokens.value} active tokens.`;
    rules.push('dominant_layer_by_tracked_volume');
  }
  const supporting: string[] = [];
  const volumeChange = input.metrics.tracked_volume_24h.percentage_change;
  const liquidityChange = input.metrics.tracked_liquidity.percentage_change;
  if (volumeChange !== null && liquidityChange !== null && volumeChange > liquidityChange + 5) {
    supporting.push('Volume is rising faster than durable liquidity in the tracked set.'); rules.push('volume_outpaces_liquidity');
  } else if (volumeChange !== null && liquidityChange !== null && liquidityChange > volumeChange + 5) {
    supporting.push('Tracked liquidity is building faster than 24-hour volume.'); rules.push('liquidity_outpaces_volume');
  }
  if (input.currentBoosts > input.previousBoosts && (!input.retention || (input.retention.metric.value ?? 0) < 65)) {
    supporting.push('Paid promotion is increasing, while measured post-boost retention remains weak or incomplete.'); rules.push('paid_attention_without_retention');
  }
  if (!input.fastestLayer) { supporting.push('Previous-window coverage is incomplete, so momentum claims remain limited.'); rules.push('insufficient_comparison_history'); }
  if (!supporting.length) supporting.push('Tracked volume and liquidity are moving without a strong divergence signal.');
  return { headline, conclusion: supporting[0], supporting, rules, method: 'deterministic_rules_v1' as const, generated_at: input.capturedAt, freshness: input.freshness, confidence: input.confidence, provenance: input.provenance };
}
function pulseWarnings(input: { tracked: number; total: number; historyCoverage: number; staleCount: number; unknownShare: number | null; providerFallback: boolean }) {
  const warnings: string[] = [];
  if (!input.tracked) warnings.push('No current exact-contract pair observations are available; no market totals were inferred.');
  if (input.tracked < input.total) warnings.push(`${input.total - input.tracked} reviewed or watched token records do not currently have pair observations.`);
  if (input.historyCoverage < 0.5) warnings.push('Fewer than half of tracked tokens have a comparable previous-window snapshot.');
  if (input.staleCount) warnings.push(`${input.staleCount} tracked token observations are stale.`);
  if ((input.unknownShare ?? 0) >= 25) warnings.push('At least one quarter of tracked volume is unknown or unclassified.');
  if (input.providerFallback) warnings.push('The market provider is in fallback mode; cached or reviewed memory may be carrying the response.');
  return warnings;
}
function crossLayerText(category: RhChainCrossLayerCategory) { return category === 'defi_x_rwa' ? 'DeFi × RWA' : category === 'meme_x_ai_narrative' ? 'Meme × AI narrative' : category.split('_x_').map((part) => part === 'rwa' ? 'RWA' : `${part[0].toUpperCase()}${part.slice(1)}`).join(' × '); }
function signed(value: number | null) { if (value === null) return 'is unavailable'; const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(value)); return `${value >= 0 ? '+' : '−'}${formatted}`; }
function round(value: number) { return Number(value.toFixed(2)); }

function classificationFromLegacy(asset: RhChainMarketResponse): RhChainLayerClassification {
  const legacy = asset.classification as RhChainReviewedClassification;
  const primary = RH_CHAIN_MARKET_LAYERS.includes(legacy.primary_layer as RhChainMarketLayer) ? legacy.primary_layer as RhChainMarketLayer : 'unclassified';
  return { contract: asset.token.contract, ticker: null, display_name: null, dexscreener_pair: null, primary_layer: primary, secondary_layers: [], cross_layer_category: null, classification_reason: 'No exact-contract reviewed market-layer classification is available.', classification_source: 'source_required', classification_confidence: 'low', evidence_state: 'source_required', missing_evidence: ['Exact contract and source-linked evidence require review.'], caveat: null, reviewed_at: null, observed_at: asset.provenance.captured_at ?? new Date().toISOString(), data_mode: asset.market_snapshot?.dataMode === 'live_cached' ? 'live_cached' : 'unavailable' };
}
function categoryFor(classification: RhChainLayerClassification): RhChainCrossLayerCategory | null {
  if (classification.cross_layer_category) return classification.cross_layer_category;
  const layers = new Set([classification.primary_layer, ...classification.secondary_layers]);
  if (layers.has('meme') && layers.has('rwa')) return 'meme_x_rwa';
  if (layers.has('agent') && layers.has('rwa')) return 'agent_x_rwa';
  if (layers.has('agent') && layers.has('meme')) return 'agent_x_meme';
  if (layers.has('infrastructure') && layers.has('rwa')) return 'infrastructure_x_rwa';
  if (layers.has('meme') && layers.has('infrastructure')) return 'meme_x_infrastructure';
  if (layers.has('defi') && layers.has('rwa')) return 'defi_x_rwa';
  return null;
}
function publicAsset(asset: MarketStructureAsset) { return { ...asset.classification, canonical_pair: asset.market_snapshot ? { pair_address: asset.market_snapshot.pairAddress, quote_token: asset.market_snapshot.quoteTokenSymbol ?? asset.market_snapshot.quoteTokenAddress ?? null, dex: asset.market_snapshot.dexId, volume_24h: asset.market_snapshot.volume.h24, liquidity_usd: asset.market_snapshot.liquidityUsd } : null, secondary_pairs: asset.secondary_pairs.map((pair) => ({ pair_address: pair.pairAddress, dex: pair.dexId, quote_token: pair.quoteTokenSymbol ?? pair.quoteTokenAddress ?? null })) }; }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function coverage(part: number, total: number) { return total > 0 ? Number((part / total * 100).toFixed(2)) : null; }
function latest(values: string[]) { return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null; }
function traders(pair: RhChainMarketResponse['market_snapshot']) { return pair ? (pair.txns.h24.buys ?? 0) + (pair.txns.h24.sells ?? 0) : null; }
function retained(after: number | null, before: number | null, threshold: number) { return after !== null && before !== null && before > 0 ? after >= before * threshold : false; }
function validWeight(value: number | null | undefined, maximum: number) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null; }
function classificationOnlyAsset(classification: RhChainLayerClassification): MarketStructureAsset {
  return {
    token: { contract: classification.contract }, market_snapshot: null, secondary_pairs: [], liquidity_fragmented: false,
    attention: { active_boosts: 0, paid_orders: [], attention_state: 'source_required', observed_at: classification.observed_at, caveats: ['No provider pair observation is available.'] },
    classification, raw_provider_observation: { canonical_pair: null, secondary_pairs: [] },
    infopunks_analysis: { provider_role: 'market_and_attention_context', liquidity_fragmented: false, attention_state: 'source_required', judgment: 'review_required' },
    provenance: { provider: 'dexscreener', captured_at: null, provider_timestamp: null, chain_id: 'robinhood', freshness: 'unavailable', confidence: 'low', raw_data_version: null, cache_status: 'unavailable' },
    caveats: ['Reviewed campaign classification is preserved while pair context is unavailable.']
  };
}
