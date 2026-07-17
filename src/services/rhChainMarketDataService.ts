import { DEXSCREENER_RH_CHAIN_ID, type RhChainBoostObservation, type RhChainDexScreenerIngestionSource, type RhChainMarketSnapshot } from '../providers/dexscreenerProvider';
import { RhChainAttentionService, type RhChainAttentionContext } from './rhChainAttentionService';
import { isRhChainIdentityContract } from './rhChainTruthGuards';

export type RhChainReviewedClassification = {
  primary_layer: string;
  secondary_layers: string[];
  confidence: string | null;
  source: 'review_required' | 'human_reviewed';
};
export type RhChainMarketProviderStatus = {
  provider: 'dexscreener';
  enabled: boolean;
  chain_id: typeof DEXSCREENER_RH_CHAIN_ID;
  last_successful_capture: string | null;
  latest_boosts_observed: number;
  known_token_refresh_state: 'idle' | 'fresh' | 'partial_failure' | 'fallback' | 'disabled';
  fallback_mode: boolean;
  caveats: string[];
};
export type RhChainMarketResponse = {
  token: { contract: string };
  market_snapshot: RhChainMarketSnapshot | null;
  secondary_pairs: RhChainMarketSnapshot[];
  liquidity_fragmented: boolean;
  attention: RhChainAttentionContext;
  classification: RhChainReviewedClassification;
  raw_provider_observation: { canonical_pair: RhChainMarketSnapshot | null; secondary_pairs: RhChainMarketSnapshot[] };
  infopunks_analysis: { provider_role: 'market_and_attention_context'; liquidity_fragmented: boolean; attention_state: RhChainAttentionContext['attention_state']; judgment: 'review_required' };
  provenance: { provider: 'dexscreener'; captured_at: string | null; chain_id: typeof DEXSCREENER_RH_CHAIN_ID };
  caveats: string[];
};

export type RhChainMarketDataServiceOptions = {
  provider: RhChainDexScreenerIngestionSource;
  enabled: boolean;
  knownTokenAddresses?: () => Promise<string[]> | string[];
  classificationFor?: (contract: string) => Promise<RhChainReviewedClassification> | RhChainReviewedClassification;
  attention?: RhChainAttentionService;
  now?: () => Date;
};

export class RhChainMarketDataService {
  private readonly attention: RhChainAttentionService;
  private readonly now: () => Date;
  private lastSuccessfulCapture: string | null = null;
  private latestBoostsObserved = 0;
  private refreshState: RhChainMarketProviderStatus['known_token_refresh_state'] = 'idle';
  constructor(private readonly options: RhChainMarketDataServiceOptions) {
    this.attention = options.attention ?? new RhChainAttentionService(options.now);
    this.now = options.now ?? (() => new Date());
  }

  async getProviderStatus(): Promise<RhChainMarketProviderStatus> {
    if (!this.options.enabled) return this.status('disabled');
    try {
      const boosts = await this.options.provider.getLatestBoosts();
      this.latestBoostsObserved = boosts.length;
      this.lastSuccessfulCapture = this.now().toISOString();
    } catch { this.refreshState = 'fallback'; }
    return this.status(this.refreshState);
  }

  async refreshKnownTokens() {
    if (!this.options.enabled) return { tokens: [] as RhChainMarketResponse[], status: this.status('disabled') };
    const supplied = await this.options.knownTokenAddresses?.() ?? [];
    const contracts = [...new Set(supplied.filter(isRhChainIdentityContract).map((contract) => contract.toLowerCase()))];
    try {
      const batch = await this.options.provider.getTokenBatch(contracts);
      const tokens = await Promise.all(contracts.map((contract) => this.responseForPairs(contract, batch[contract] ?? [])));
      this.refreshState = 'fresh'; this.lastSuccessfulCapture = this.now().toISOString();
      return { tokens, status: this.status('fresh') };
    } catch {
      this.refreshState = 'fallback';
      return { tokens: [] as RhChainMarketResponse[], status: this.status('fallback') };
    }
  }

  async getTokens(contracts?: string[]) {
    if (contracts?.length) {
      const clean = [...new Set(contracts.filter(isRhChainIdentityContract).map((contract) => contract.toLowerCase()))];
      if (!this.options.enabled) return { tokens: clean.map((contract) => this.fallback(contract)), status: this.status('disabled') };
      const batch = await this.options.provider.getTokenBatch(clean);
      return { tokens: await Promise.all(clean.map((contract) => this.responseForPairs(contract, batch[contract] ?? []))), status: this.status('fresh') };
    }
    return this.refreshKnownTokens();
  }

  async getToken(contract: string): Promise<RhChainMarketResponse> {
    const normalized = contract.toLowerCase();
    if (!isRhChainIdentityContract(contract) || !this.options.enabled) return this.fallback(contract);
    try {
      const [pairs, paidOrders, boosts] = await Promise.all([
        this.options.provider.getTokenPairs(normalized),
        this.options.provider.getPaidOrders(normalized),
        this.options.provider.getLatestBoosts()
      ]);
      this.latestBoostsObserved = boosts.length;
      this.lastSuccessfulCapture = this.now().toISOString();
      const activeBoosts = boosts.filter((boost) => boost.tokenAddress === normalized).reduce((sum, boost) => sum + (boost.amount ?? 1), 0);
      return this.responseForPairs(normalized, pairs, activeBoosts, paidOrders);
    } catch { this.refreshState = 'fallback'; return this.fallback(contract); }
  }

  async getBoosts() {
    if (!this.options.enabled) return { boosts: [] as RhChainBoostObservation[], top_boosts: [] as RhChainBoostObservation[], status: this.status('disabled'), caveats: ['DEX Screener is disabled; reviewed receipts and classifications remain available.'] };
    try {
      const [boosts, top_boosts] = await Promise.all([this.options.provider.getLatestBoosts(), this.options.provider.getTopBoosts()]);
      this.latestBoostsObserved = boosts.length; this.lastSuccessfulCapture = this.now().toISOString();
      return { boosts, top_boosts, status: this.status('fresh'), caveats: ['Paid-attention context only. Boosts are neither misconduct nor organic conviction.'] };
    } catch { this.refreshState = 'fallback'; return { boosts: [] as RhChainBoostObservation[], top_boosts: [] as RhChainBoostObservation[], status: this.status('fallback'), caveats: ['Provider unavailable. This does not affect reviewed receipts or classifications.'] }; }
  }

  async getAttention(contract: string) { return (await this.getToken(contract)).attention; }

  private async responseForPairs(contract: string, pairs: RhChainMarketSnapshot[], activeBoosts = 0, paidOrders: RhChainMarketSnapshot['paidOrders'] = []): Promise<RhChainMarketResponse> {
    const onlyExact = pairs.filter((pair) => pair.chainId === DEXSCREENER_RH_CHAIN_ID && pair.tokenAddress.toLowerCase() === contract.toLowerCase());
    const sorted = [...onlyExact].sort(canonicalPairOrder);
    const canonical = sorted[0] ? { ...sorted[0], activeBoosts, paidOrders } : null;
    const secondary = sorted.slice(1);
    const liquidity_fragmented = isLiquidityFragmented(canonical, secondary);
    const attention = canonical ? this.attention.assess(canonical) : emptyAttention(this.now);
    const classification = await this.classification(contract);
    const caveats = ['DEX Screener is market and attention context only; it cannot create identity, classification, a receipt, or an approved signal.', ...attention.caveats];
    return { token: { contract }, market_snapshot: canonical, secondary_pairs: secondary, liquidity_fragmented, attention, classification,
      raw_provider_observation: { canonical_pair: canonical, secondary_pairs: secondary },
      infopunks_analysis: { provider_role: 'market_and_attention_context', liquidity_fragmented, attention_state: attention.attention_state, judgment: 'review_required' },
      provenance: { provider: 'dexscreener', captured_at: canonical?.capturedAt ?? null, chain_id: DEXSCREENER_RH_CHAIN_ID }, caveats };
  }

  private fallback(contract: string): RhChainMarketResponse {
    const attention = emptyAttention(this.now);
    const classification: RhChainReviewedClassification = { primary_layer: 'unknown', secondary_layers: [], confidence: null, source: 'review_required' };
    return { token: { contract }, market_snapshot: null, secondary_pairs: [], liquidity_fragmented: false, attention, classification,
      raw_provider_observation: { canonical_pair: null, secondary_pairs: [] }, infopunks_analysis: { provider_role: 'market_and_attention_context', liquidity_fragmented: false, attention_state: 'source_required', judgment: 'review_required' },
      provenance: { provider: 'dexscreener', captured_at: null, chain_id: DEXSCREENER_RH_CHAIN_ID }, caveats: ['Provider unavailable or disabled. Reviewed receipts, dossiers, and classifications remain authoritative.'] };
  }

  private async classification(contract: string) {
    return this.options.classificationFor?.(contract) ?? { primary_layer: 'unknown', secondary_layers: [], confidence: null, source: 'review_required' as const };
  }
  private status(state: RhChainMarketProviderStatus['known_token_refresh_state']): RhChainMarketProviderStatus {
    return { provider: 'dexscreener', enabled: this.options.enabled, chain_id: DEXSCREENER_RH_CHAIN_ID, last_successful_capture: this.lastSuccessfulCapture, latest_boosts_observed: this.latestBoostsObserved, known_token_refresh_state: state, fallback_mode: state === 'fallback' || state === 'disabled', caveats: ['Provider observations are context, not endorsement, approved signals, or reviewed classification.'] };
  }
}

export function canonicalPairOrder(left: RhChainMarketSnapshot, right: RhChainMarketSnapshot) {
  const liquidity = (right.liquidityUsd ?? -1) - (left.liquidityUsd ?? -1);
  if (liquidity) return liquidity;
  const volume = (right.volume.h24 ?? -1) - (left.volume.h24 ?? -1);
  if (volume) return volume;
  return (Date.parse(left.pairCreatedAt ?? '') || Number.MAX_SAFE_INTEGER) - (Date.parse(right.pairCreatedAt ?? '') || Number.MAX_SAFE_INTEGER);
}

function isLiquidityFragmented(canonical: RhChainMarketSnapshot | null, secondary: RhChainMarketSnapshot[]) {
  const liquidity = canonical?.liquidityUsd;
  if (!liquidity || liquidity <= 0) return false;
  return secondary.some((pair) => (pair.liquidityUsd ?? 0) >= liquidity * 0.2);
}
function emptyAttention(now: () => Date): RhChainAttentionContext { return { active_boosts: 0, paid_orders: [], attention_state: 'source_required', observed_at: now().toISOString(), caveats: ['Insufficient provider history. Source review is required.'] }; }
