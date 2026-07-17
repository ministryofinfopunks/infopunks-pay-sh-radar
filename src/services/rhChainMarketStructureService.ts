import type { RhChainDataFreshness } from '../data/rhChain';
import type { RhChainAttentionState } from './rhChainAttentionService';
import type { RhChainMetricsSnapshot } from './rhChainChainPulseService';
import type { RhChainMarketResponse, RhChainReviewedClassification } from './rhChainMarketDataService';
import { RhChainMarketDataService } from './rhChainMarketDataService';

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
      return { observation, quality: await this.quality(asset, observation) };
    }));
    return { title: 'Paid Attention Watch', observations: assets.map((item) => item.observation), attention_quality: assets.map((item) => item.quality), observed_at: this.now().toISOString(), data_mode: boosts.status.fallback_mode ? 'unavailable' as const : 'live_cached' as const, caveats: ['Paid boosts are not misconduct. Boost rank is not organic conviction. Insufficient before/during/after history returns source_required.'] };
  }

  private async safeSnapshot() {
    try {
      const [market, classifications] = await Promise.all([this.options.marketData.getTokens(), this.classifications()]);
      const byContract = new Map(classifications.map((item) => [item.contract.toLowerCase(), item]));
      const assets: MarketStructureAsset[] = market.tokens.map((asset) => ({ ...asset, classification: byContract.get(asset.token.contract.toLowerCase()) ?? classificationFromLegacy(asset) }));
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

export const RH_CHAIN_CROSS_LAYER_CATEGORIES: RhChainCrossLayerCategory[] = ['meme_x_rwa', 'agent_x_rwa', 'agent_x_meme', 'infrastructure_x_rwa', 'meme_x_infrastructure', 'defi_x_rwa', 'meme_x_ai_narrative'];

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
    provenance: { provider: 'dexscreener', captured_at: null, chain_id: 'robinhood' },
    caveats: ['Reviewed campaign classification is preserved while pair context is unavailable.']
  };
}
