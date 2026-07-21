import type { RhChain100ReceiptsAsset } from '../data/rhChain100Receipts';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';
import { BLOCKSCOUT_RH_CHAIN, BlockscoutProvider, normalizeBlockscoutAddress, type BlockscoutListParams, type BlockscoutPage, type BlockscoutRequestContext } from '../providers/blockscoutProvider';

export type RhChainWatchlistSource = 'campaign' | 'market_structure' | 'dexscreener' | 'blockscout' | 'manual_intake';
export type RhChainWatchlistEntry = { contract: string; source: RhChainWatchlistSource; observed_at: string; provenance: string; review_state: 'source_required' | 'reviewed'; };
export type RhChainObservedToken = {
  provider: 'blockscout'; chain: typeof BLOCKSCOUT_RH_CHAIN; captured_at: string; contract: string; name: string | null; symbol: string | null;
  decimals: number | null; token_type: string | null; holders_count: number | null; transfers_count: number | null; total_supply: string | null;
  contract_verified: boolean | null; deployer_address: string | null; creation_tx_hash: string | null; source_url: string;
  evidence_state: 'observed_token'; review_state: 'source_required'; caveats: string[];
};
export type RhChainOnchainProviderStatus = { provider: 'blockscout'; enabled: boolean; last_successful_capture: string | null; observed_token_count: number; enriched_token_count: number; unresolved_deployer_count: number; fallback_state: 'normal' | 'fallback' | 'disabled'; caveats: string[] };

export type RhChainTokenRegistryOptions = {
  provider: BlockscoutProvider;
  enabled: boolean;
  receipts: () => readonly RhChain100ReceiptsAsset[] | Promise<readonly RhChain100ReceiptsAsset[]>;
  marketStructure: () => readonly RhChainLayerClassification[] | Promise<readonly RhChainLayerClassification[]>;
  dexScreenerContracts?: () => Promise<string[]> | string[];
  manualIntakeContracts?: () => Promise<string[]> | string[];
  now?: () => Date;
};

const CAVEAT = 'Explorer visibility does not verify project claims, backing, safety, or authenticity.';

/** Exact-contract Blockscout evidence registry. It deliberately has no classification mutation API. */
export class RhChainTokenRegistryService {
  private readonly now: () => Date;
  private lastSuccessfulCapture: string | null = null;
  private observedTokenCount = 0;
  private enrichedTokenCount = 0;
  private unresolvedDeployerCount = 0;
  private fallback = false;
  constructor(private readonly options: RhChainTokenRegistryOptions) { this.now = options.now ?? (() => new Date()); }

  async getProviderStatus(): Promise<RhChainOnchainProviderStatus> {
    return { provider: 'blockscout', enabled: this.options.enabled, last_successful_capture: this.lastSuccessfulCapture, observed_token_count: this.observedTokenCount, enriched_token_count: this.enrichedTokenCount, unresolved_deployer_count: this.unresolvedDeployerCount, fallback_state: !this.options.enabled ? 'disabled' : this.fallback ? 'fallback' : 'normal', caveats: [CAVEAT, 'Provider observations cannot override reviewed receipts, classifications, or approved-signal status.'] };
  }

  async listObservedTokens(params: BlockscoutListParams = {}) {
    if (!this.options.enabled) return { tokens: [] as RhChainObservedToken[], next_page_params: null, status: await this.getProviderStatus(), caveats: ['Blockscout is disabled. Reviewed records remain available.'] };
    try {
      const response = await this.options.provider.listTokens({ ...params, type: params.type ?? 'ERC-20' });
      const tokens = response.items.map((token) => this.observed(token.address, token));
      this.observedTokenCount = tokens.length; this.lastSuccessfulCapture = this.now().toISOString(); this.fallback = false;
      return { tokens, next_page_params: response.nextPageParams, status: await this.getProviderStatus(), caveats: [CAVEAT] };
    } catch { this.fallback = true; return { tokens: [] as RhChainObservedToken[], next_page_params: null, status: await this.getProviderStatus(), caveats: ['Blockscout registry is temporarily unavailable; this does not affect reviewed records.'] }; }
  }

  async enrichToken(contract: string, context?: BlockscoutRequestContext) {
    const normalized = exact(contract);
    if (!normalized || !this.options.enabled) return this.fallbackToken(contract);
    try {
      const [token, address, contractMetadata] = await Promise.all([this.options.provider.getToken(normalized, context), this.options.provider.getAddress(normalized, context), this.options.provider.getContract(normalized, context)]);
      if (!token) return this.fallbackToken(normalized);
      const observed = this.observed(normalized, token, address?.isVerified ?? contractMetadata?.isVerified ?? null, address?.creatorAddress ?? null, address?.creationTransactionHash ?? null);
      this.enrichedTokenCount += 1;
      if (!observed.deployer_address || !observed.creation_tx_hash) this.unresolvedDeployerCount += 1;
      this.lastSuccessfulCapture = this.now().toISOString(); this.fallback = false;
      return { token: observed, contract: contractMetadata, address, fallback: false, caveats: [CAVEAT, ...(!observed.deployer_address || !observed.creation_tx_hash ? ['Creation context is source_required until both deployer and creation transaction are resolvable.'] : [])] };
    } catch (error) {
      if (context?.signal?.aborted) throw context.signal.reason ?? error;
      this.fallback = true;
      return this.fallbackToken(normalized);
    }
  }

  async getTokenTransfers(contract: string, params: BlockscoutListParams = {}) { return this.optionalPage(contract, params, 'transfers'); }
  async getTokenHolders(contract: string, params: BlockscoutListParams = {}) { return this.optionalPage(contract, params, 'holders'); }

  async seedWatchlistFromBlockscout() {
    const [campaign, structure, dex, manual, registry] = await Promise.all([this.options.receipts(), this.options.marketStructure(), this.options.dexScreenerContracts?.() ?? [], this.options.manualIntakeContracts?.() ?? [], this.listObservedTokens()]);
    const now = this.now().toISOString();
    const entries: RhChainWatchlistEntry[] = [
      ...campaign.map((asset) => entry(asset.contract, 'campaign', asset.reviewed_at, '100 Receipts reviewed campaign memory', 'reviewed')),
      ...structure.map((asset) => entry(asset.contract, 'market_structure', asset.reviewed_at ?? asset.observed_at, '4663 reviewed exact-contract registry', 'reviewed')),
      ...dex.map((contract) => entry(contract, 'dexscreener', now, 'DEX Screener market/attention observation', 'source_required')),
      ...manual.map((contract) => entry(contract, 'manual_intake', now, 'Manual intake', 'source_required')),
      ...registry.tokens.map((token) => entry(token.contract, 'blockscout', token.captured_at, 'Blockscout token registry', 'source_required'))
    ].filter((item): item is RhChainWatchlistEntry => Boolean(item));
    const deduped = new Map<string, RhChainWatchlistEntry[]>();
    for (const item of entries) deduped.set(item.contract, [...(deduped.get(item.contract) ?? []), item]);
    return [...deduped.values()].flat(); // provenance is intentionally not collapsed by contract.
  }

  async compareWithDexScreenerWatchlist() { return this.compare('dexscreener'); }
  async compareWithMarketStructureRegistry() { return this.compare('market_structure'); }

  private async compare(source: RhChainWatchlistSource) {
    const watchlist = await this.seedWatchlistFromBlockscout();
    const blockscout = new Set(watchlist.filter((item) => item.source === 'blockscout').map((item) => item.contract));
    const other = new Set(watchlist.filter((item) => item.source === source).map((item) => item.contract));
    return { compared_with: source, exact_contracts_in_both: [...blockscout].filter((contract) => other.has(contract)), blockscout_only: [...blockscout].filter((contract) => !other.has(contract)), compared_source_only: [...other].filter((contract) => !blockscout.has(contract)), caveats: ['Comparison is exact-contract only. Symbols and names are never used to merge assets.', CAVEAT] };
  }
  private async optionalPage(contract: string, params: BlockscoutListParams, kind: 'transfers' | 'holders') {
    const normalized = exact(contract);
    if (!normalized || !this.options.enabled) return { items: [], next_page_params: null, fallback: true, caveats: [`Blockscout ${kind} are unavailable; reviewed records remain authoritative.`] };
    try {
      const response: BlockscoutPage<Record<string, unknown>> = kind === 'transfers' ? await this.options.provider.getTokenTransfers(normalized, params) : await this.options.provider.getTokenHolders(normalized, params);
      return { items: response.items, next_page_params: response.nextPageParams, fallback: false, caveats: [CAVEAT] };
    } catch { this.fallback = true; return { items: [], next_page_params: null, fallback: true, caveats: [`Blockscout ${kind} endpoint is unavailable; no inference is made.`] }; }
  }
  private observed(contract: string, token: { name: string | null; symbol: string | null; decimals: number | null; tokenType: string | null; holdersCount: number | null; totalSupply: string | null }, contractVerified: boolean | null = null, deployerAddress: string | null = null, creationTxHash: string | null = null): RhChainObservedToken {
    const address = normalizeBlockscoutAddress(contract);
    return { provider: 'blockscout', chain: BLOCKSCOUT_RH_CHAIN, captured_at: this.now().toISOString(), contract: address, name: token.name, symbol: token.symbol, decimals: token.decimals, token_type: token.tokenType, holders_count: token.holdersCount, transfers_count: null, total_supply: token.totalSupply, contract_verified: contractVerified, deployer_address: deployerAddress, creation_tx_hash: creationTxHash, source_url: `${this.options.provider.baseUrl}/token/${encodeURIComponent(address)}`, evidence_state: 'observed_token', review_state: 'source_required', caveats: [CAVEAT] };
  }
  private fallbackToken(contract: string) { return { token: null as RhChainObservedToken | null, contract: null, address: null, fallback: true, caveats: ['Blockscout evidence is unavailable or the exact contract was not found. No verification or classification is inferred.'] }; }
}

function exact(value: string) { const address = normalizeBlockscoutAddress(value); return /^0x[a-f0-9]{40}$/.test(address) ? address : null; }
function entry(contract: string, source: RhChainWatchlistSource, observed_at: string, provenance: string, review_state: RhChainWatchlistEntry['review_state']): RhChainWatchlistEntry | null { const normalized = exact(contract); return normalized ? { contract: normalized, source, observed_at, provenance, review_state } : null; }
