import { getRhChain100ReceiptsCampaign } from '../data/rhChain100Receipts';
import { rhChainReviewedLayerClassifications } from '../data/rhChainMarketStructure';
import type { RhChainLayerClassification, RhChainSecondaryLayer } from './rhChainMarketStructureService';
import type { RhChainMarketDataService, RhChainMarketResponse } from './rhChainMarketDataService';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot, RhChainPaidOrder } from '../providers/dexscreenerProvider';
import type { RhChainTokenRegistryService, RhChainObservedToken } from './rhChainTokenRegistryService';
import { normalizeRhChainContract } from './rhChainContractIntelligenceService';

export const RH_CHAIN_DISCOVERY_REVIEW_STATES = ['auto_discovered', 'source_required', 'watch_only', 'promoted_to_market_structure', 'promoted_to_100_receipts_candidate', 'ignored', 'duplicate_pair', 'duplicate_ticker_warning'] as const;
export type RhChainDiscoveryReviewState = typeof RH_CHAIN_DISCOVERY_REVIEW_STATES[number];
export type RhChainDiscoverySource = 'dexscreener_profile' | 'dexscreener_latest_boost' | 'dexscreener_top_boost' | 'dexscreener_paid_order' | 'dexscreener_pair' | 'blockscout' | '100_receipts' | 'market_structure';
export type RhChainDiscoveryItem = {
  contract: string;
  display_name: string;
  symbol: string | null;
  discovered_from: RhChainDiscoverySource[];
  first_seen_at: string;
  last_seen_at: string;
  canonical_pair: { pair_address: string | null; dex_url: string | null; liquidity_usd: number | null; volume_h24: number | null; created_at: string | null } | null;
  secondary_pairs: Array<{ pair_address: string | null; dex_url: string | null; liquidity_usd: number | null; volume_h24: number | null; created_at: string | null }>;
  liquidity_usd: number | null;
  volume_h24: number | null;
  txns_h24: number | null;
  market_cap: number | null;
  fdv: number | null;
  active_boosts: number;
  paid_orders: RhChainPaidOrder[];
  blockscout_status: 'observed_token' | 'unavailable';
  contract_verified: boolean | null;
  suggested_layers: string[];
  suggested_reason: string;
  review_state: RhChainDiscoveryReviewState;
  caveats: string[];
  duplicate_ticker_contracts: string[];
  explorer_url: string | null;
};
export type RhChainDiscoveryQueuePayload = {
  title: 'RH Chain Auto Discovery Queue';
  generated_at: string;
  items: RhChainDiscoveryItem[];
  suppressed_count: number;
  caveats: string[];
};

type StoredState = { first_seen_at: string; last_seen_at: string; review_state: RhChainDiscoveryReviewState; ignored: boolean; watch: boolean; promoted_target: 'market_structure' | '100_receipts' | null };
export type RhChainDiscoveryQueueOptions = { provider: RhChainDexScreenerIngestionSource; marketData: RhChainMarketDataService; tokenRegistry: RhChainTokenRegistryService; now?: () => Date };

/** Auto-discovery is a review inbox, not an index or a recommendation surface. */
export class RhChainDiscoveryQueueService {
  private readonly state = new Map<string, StoredState>();
  private readonly records = new Map<string, RhChainDiscoveryItem>();
  private readonly now: () => Date;
  constructor(private readonly options: RhChainDiscoveryQueueOptions) { this.now = options.now ?? (() => new Date()); }

  async refresh(): Promise<RhChainDiscoveryQueuePayload> {
    const now = this.now().toISOString();
    const sources = new Map<string, Set<RhChainDiscoverySource>>();
    const metadata = new Map<string, { display_name: string | null; symbol: string | null; blockscout: RhChainObservedToken | null }>();
    const add = (contract: string | null | undefined, source: RhChainDiscoverySource, name: string | null = null, symbol: string | null = null, blockscout: RhChainObservedToken | null = null) => {
      const normalized = exact(contract);
      if (!normalized) return;
      sources.set(normalized, new Set([...(sources.get(normalized) ?? []), source]));
      const previous = metadata.get(normalized) ?? { display_name: null, symbol: null, blockscout: null };
      metadata.set(normalized, { display_name: previous.display_name ?? name, symbol: previous.symbol ?? symbol, blockscout: previous.blockscout ?? blockscout });
    };
    const [profiles, latestBoosts, topBoosts, blockscout] = await Promise.all([
      safe(() => this.options.provider.getLatestTokenProfiles(), [] as unknown[]),
      safe(() => this.options.provider.getLatestBoosts(), []),
      safe(() => this.options.provider.getTopBoosts(), []),
      this.options.tokenRegistry.listObservedTokens()
    ]);
    for (const profile of profiles) add(profileContract(profile), 'dexscreener_profile', profileName(profile), profileSymbol(profile));
    for (const boost of latestBoosts) add(boost.tokenAddress, 'dexscreener_latest_boost');
    for (const boost of topBoosts) add(boost.tokenAddress, 'dexscreener_top_boost');
    for (const token of blockscout.tokens) add(token.contract, 'blockscout', token.name, token.symbol, token);
    for (const asset of getRhChain100ReceiptsCampaign().assets) add(asset.contract, '100_receipts', asset.ticker, asset.ticker);
    for (const classification of rhChainReviewedLayerClassifications) add(classification.contract, 'market_structure', classification.display_name, classification.ticker);
    const contracts = [...sources.keys()];
    const market = await this.options.marketData.getTokens(contracts);
    const boostByContract = new Map<string, number>();
    for (const boost of [...latestBoosts, ...topBoosts]) {
      const contract = exact(boost.tokenAddress); if (!contract) continue;
      boostByContract.set(contract, (boostByContract.get(contract) ?? 0) + (boost.amount ?? 0));
    }
    const marketByContract = new Map(market.tokens.map((item) => [normalizeRhChainContract(item.token.contract), item]));
    const queue = await Promise.all(contracts.map(async (contract) => {
      const response = marketByContract.get(contract) ?? null;
      const paid_orders = await safe(() => this.options.provider.getPaidOrders(contract), [] as RhChainPaidOrder[]);
      if (paid_orders.length) sources.get(contract)?.add('dexscreener_paid_order');
      if (response?.market_snapshot) sources.get(contract)?.add('dexscreener_pair');
      return this.build(contract, sources.get(contract) ?? new Set(), metadata.get(contract)!, response, boostByContract.get(contract) ?? 0, paid_orders, now);
    }));
    const bySymbol = new Map<string, RhChainDiscoveryItem[]>();
    for (const item of queue) if (item.symbol) bySymbol.set(item.symbol.toLowerCase(), [...(bySymbol.get(item.symbol.toLowerCase()) ?? []), item]);
    for (const item of queue) {
      const collisions = item.symbol ? (bySymbol.get(item.symbol.toLowerCase()) ?? []).filter((other) => other.contract !== item.contract).map((other) => other.contract) : [];
      item.duplicate_ticker_contracts = collisions;
      if (collisions.length && item.review_state === 'auto_discovered') item.review_state = 'duplicate_ticker_warning';
      if (collisions.length) item.caveats.push('Duplicate ticker warning: matching symbols are separate exact contracts and are not merged.');
      this.records.set(item.contract, item);
    }
    return this.payload();
  }

  list(): RhChainDiscoveryQueuePayload { return this.payload(); }
  watch(contract: string) { return this.transition(contract, 'watch'); }
  ignore(contract: string) { return this.transition(contract, 'ignore'); }
  promote(contract: string, target: 'market_structure' | '100_receipts') { return this.transition(contract, target === 'market_structure' ? 'promote_market' : 'promote_receipts'); }

  /** Dynamic reviewed-intake candidates; never approved signals or receipts. */
  marketStructureCandidates(): RhChainLayerClassification[] {
    return [...this.records.values()].filter((item) => this.state.get(item.contract)?.promoted_target === 'market_structure').map((item) => ({
      contract: item.contract, ticker: item.symbol, display_name: item.display_name, dexscreener_pair: item.canonical_pair?.dex_url ?? null,
      primary_layer: toPrimaryLayer(item.suggested_layers), secondary_layers: [], cross_layer_category: null,
      classification_reason: `Discovery Queue promotion: ${item.suggested_reason} Human review remains required.`, classification_source: 'manual_review', classification_confidence: 'low', evidence_state: 'source_required_for_claims',
      missing_evidence: ['manual classification review', 'primary source evidence', 'contract/deployer review'], caveat: 'Discovery Queue promotion preserves a reviewed-intake candidate only. It does not verify claims, safety, backing, or endorsement.', reviewed_at: null, observed_at: item.last_seen_at, data_mode: 'manual'
    }));
  }
  watchedContracts() { return [...this.state.entries()].filter(([, state]) => state.watch && !state.ignored).map(([contract]) => contract); }

  private build(contract: string, discovered: Set<RhChainDiscoverySource>, meta: { display_name: string | null; symbol: string | null; blockscout: RhChainObservedToken | null }, response: RhChainMarketResponse | null, boosts: number, paid_orders: RhChainPaidOrder[], now: string): RhChainDiscoveryItem {
    const current = this.state.get(contract) ?? { first_seen_at: now, last_seen_at: now, review_state: 'auto_discovered' as const, ignored: false, watch: false, promoted_target: null };
    current.last_seen_at = now; this.state.set(contract, current);
    const pair = response?.market_snapshot ?? null;
    const canonical_pair = pair ? pairView(pair) : null;
    const secondary_pairs = (response?.secondary_pairs ?? []).map(pairView);
    const classification = rhChainReviewedLayerClassifications.find((item) => normalizeRhChainContract(item.contract) === contract) ?? null;
    const suggestion = classification ? { layers: [classification.primary_layer, ...classification.secondary_layers], reason: 'Existing exact-contract reviewed classification outranks discovery suggestions.' } : suggest(`${meta.display_name ?? ''} ${meta.symbol ?? ''}`);
    const display_name = meta.display_name ?? meta.symbol ?? `Observed token ${contract.slice(0, 8)}`;
    const caveats = ['Exact-contract discovery only; ticker similarity never establishes identity.', 'DEX Screener detects market motion and paid-attention context only.', 'Blockscout observations establish onchain visibility only.', 'Provider context cannot create approved_signal, 4663 Index inclusion, a reviewed receipt, endorsement, or a safety finding.'];
    if (paid_orders.length) caveats.push('Paid orders are context only and do not establish organic demand.');
    const reviewedMemory = discovered.has('100_receipts') || discovered.has('market_structure');
    if (reviewedMemory) caveats.push('Existing reviewed memory or manual classification outranks auto-discovery context.');
    return { contract, display_name, symbol: meta.symbol, discovered_from: [...discovered].sort(), first_seen_at: current.first_seen_at, last_seen_at: current.last_seen_at, canonical_pair, secondary_pairs, liquidity_usd: pair?.liquidityUsd ?? null, volume_h24: pair?.volume.h24 ?? null, txns_h24: pair ? (pair.txns.h24.buys ?? 0) + (pair.txns.h24.sells ?? 0) : null, market_cap: pair?.marketCap ?? null, fdv: pair?.fdv ?? null, active_boosts: boosts, paid_orders, blockscout_status: meta.blockscout ? 'observed_token' : 'unavailable', contract_verified: meta.blockscout?.contract_verified ?? null, suggested_layers: suggestion.layers, suggested_reason: suggestion.reason, review_state: current.ignored ? 'ignored' : current.promoted_target === 'market_structure' ? 'promoted_to_market_structure' : current.promoted_target === '100_receipts' ? 'promoted_to_100_receipts_candidate' : current.watch ? 'watch_only' : reviewedMemory ? 'source_required' : current.review_state, caveats, duplicate_ticker_contracts: [], explorer_url: meta.blockscout?.source_url ?? null };
  }
  private transition(contract: string, action: 'watch' | 'ignore' | 'promote_market' | 'promote_receipts') {
    const normalized = exact(contract); if (!normalized) throw new Error('exact_contract_required');
    const record = this.records.get(normalized); if (!record) throw new Error('discovery_contract_not_found');
    const current = this.state.get(normalized) ?? { first_seen_at: record.first_seen_at, last_seen_at: record.last_seen_at, review_state: 'auto_discovered' as const, ignored: false, watch: false, promoted_target: null };
    if (action === 'ignore') { current.ignored = true; current.watch = false; current.review_state = 'ignored'; }
    if (action === 'watch') { current.ignored = false; current.watch = true; current.review_state = 'watch_only'; }
    if (action === 'promote_market') { current.ignored = false; current.promoted_target = 'market_structure'; current.review_state = 'promoted_to_market_structure'; }
    if (action === 'promote_receipts') { current.ignored = false; current.promoted_target = '100_receipts'; current.review_state = 'promoted_to_100_receipts_candidate'; }
    this.state.set(normalized, current); const updated = this.build(normalized, new Set(record.discovered_from), { display_name: record.display_name, symbol: record.symbol, blockscout: null }, null, record.active_boosts, record.paid_orders, this.now().toISOString()); this.records.set(normalized, updated); return updated;
  }
  private payload(): RhChainDiscoveryQueuePayload {
    const items = [...this.records.values()].filter((item) => item.review_state !== 'ignored').sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at) || (b.liquidity_usd ?? -1) - (a.liquidity_usd ?? -1));
    return { title: 'RH Chain Auto Discovery Queue', generated_at: this.now().toISOString(), items, suppressed_count: [...this.records.values()].filter((item) => item.review_state === 'ignored').length, caveats: ['The queue is an exact-contract review inbox. Discovery does not approve, index, endorse, classify, or verify a token.'] };
  }
}

function exact(value: string | null | undefined) { if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value.trim())) return null; return normalizeRhChainContract(value); }
function pairView(pair: RhChainMarketSnapshot) { return { pair_address: pair.pairAddress, dex_url: pair.sourceUrl, liquidity_usd: pair.liquidityUsd, volume_h24: pair.volume.h24, created_at: pair.pairCreatedAt }; }
function profileRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function profileContract(value: unknown) { const row = profileRecord(value); const base = profileRecord(row?.baseToken); return typeof row?.tokenAddress === 'string' ? row.tokenAddress : typeof row?.address === 'string' ? row.address : typeof base?.address === 'string' ? base.address : null; }
function profileName(value: unknown) { const row = profileRecord(value); const base = profileRecord(row?.baseToken); return typeof row?.name === 'string' ? row.name : typeof base?.name === 'string' ? base.name : null; }
function profileSymbol(value: unknown) { const row = profileRecord(value); const base = profileRecord(row?.baseToken); return typeof row?.symbol === 'string' ? row.symbol : typeof base?.symbol === 'string' ? base.symbol : null; }
function suggest(value: string) { const text = value.toLowerCase(); if (/ai|grok|agent/.test(text)) return { layers: ['ai_narrative'], reason: 'AI/Grok/agent wording suggests an AI narrative only; no agent behavior is verified.' }; if (/rwa|stock|dividend|energy/.test(text)) return { layers: ['rwa_narrative'], reason: 'RWA/stock/dividend/energy wording suggests an RWA narrative only; no backing or mechanics are verified.' }; if (/oracle|data/.test(text)) return { layers: ['infrastructure_narrative'], reason: 'Oracle/data wording suggests an infrastructure narrative only; no operational infrastructure is verified.' }; if (/meme|cat|dog|frog|tendies/.test(text)) return { layers: ['meme_candidate'], reason: 'Meme wording suggests a meme candidate only.' }; return { layers: [], reason: 'No non-authoritative layer suggestion is available from exact-contract provider context.' }; }
function toPrimaryLayer(layers: string[]): RhChainLayerClassification['primary_layer'] { return layers.includes('rwa_narrative') ? 'rwa' : layers.includes('infrastructure_narrative') ? 'infrastructure' : layers.includes('meme_candidate') ? 'meme' : 'unclassified'; }
async function safe<T>(work: () => Promise<T>, fallback: T): Promise<T> { try { return await work(); } catch { return fallback; } }
