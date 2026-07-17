import {
  getRhChain4663Index,
  getRhChainReviewQueue,
  type RhChain4663Asset,
  type RhChainReviewItem,
  type RhChainReviewState
} from '../data/rhChain';
import { findRhChain100ReceiptsAsset, type RhChain100ReceiptsAsset } from '../data/rhChain100Receipts';
import { findRhChainCanonicalIdentity, type RhChainCanonicalIdentity } from '../data/rhChainIdentityRegistry';
import { rhChainReviewedLayerClassifications } from '../data/rhChainMarketStructure';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';
import type { RhChainExplorerSnapshot, RhChainTokenPairSnapshot } from './rhChainLiveSnapshotService';
import type { RhChainMarketSnapshot } from './rhChainMarketSnapshotService';
import type { RhChainObservedToken } from './rhChainTokenRegistryService';
import { isRhChainIdentityContract } from './rhChainTruthGuards';

export type RhChainContractResolutionSource = '100_receipts' | 'reviewed_dossier' | '4663_index' | 'market_structure' | 'snapshot_history' | 'dexscreener' | 'blockscout' | 'unknown';
export type RhChainContractReviewStatus = RhChainReviewState | 'source_required_for_claims' | 'not_reviewed' | 'not_found';
export type RhChainContractProviderContext = {
  latest_snapshot: RhChainMarketSnapshot | null;
  dexscreener: RhChainTokenPairSnapshot | null;
  blockscout: RhChainExplorerSnapshot | null;
  blockscout_token: RhChainObservedToken | null;
};
export type RhChainContractIntelligenceInput = {
  reviewItems?: readonly RhChainReviewItem[];
  snapshotHistory?: readonly RhChainMarketSnapshot[];
  dexscreener?: RhChainTokenPairSnapshot | null;
  blockscout?: RhChainExplorerSnapshot | null;
  blockscoutToken?: RhChainObservedToken | null;
};

export type RhChainContractIntelligence = {
  requested_contract: string;
  normalized_contract: string | null;
  contract: string;
  source: RhChainContractResolutionSource;
  identity_valid: boolean;
  ticker: string | null;
  display_name: string | null;
  name: string | null;
  review_status: RhChainContractReviewStatus;
  claim_status: 'source_required_for_claims' | 'reviewed';
  risk_state: 'source_required' | 'low_watch' | 'medium_watch' | 'high_risk' | 'do_not_touch_yet';
  canonical_identity: RhChainCanonicalIdentity | null;
  campaign_asset: RhChain100ReceiptsAsset | null;
  index: RhChain4663Asset | null;
  review_items: RhChainReviewItem[];
  market_structure: RhChainLayerClassification | null;
  provider_context: RhChainContractProviderContext;
};

export const normalizeRhChainContract = (value: string) => value.trim().toLowerCase();

/**
 * One exact-contract join boundary for the Signal Desk. Display names and
 * tickers only leave this function; they never enter it as lookup keys.
 * Provider observations are deliberately last and never change reviewed state.
 */
export class RhChainContractIntelligenceService {
  resolve(contract: string, input: RhChainContractIntelligenceInput = {}): RhChainContractIntelligence {
    const requested_contract = contract.trim();
    // Legacy fixtures use short 0x identifiers. Non-contract labels, including
    // tickers, are rejected even when they are otherwise non-placeholder text.
    const identity_valid = /^0x/i.test(requested_contract) && isRhChainIdentityContract(requested_contract);
    const normalized_contract = identity_valid ? normalizeRhChainContract(requested_contract) : null;
    const provider_context = providerContext(requested_contract, normalized_contract, input);
    const empty = {
      requested_contract,
      normalized_contract,
      contract: requested_contract,
      source: 'unknown' as const,
      identity_valid,
      ticker: null,
      display_name: null,
      name: null,
      review_status: 'not_found' as const,
      claim_status: 'source_required_for_claims' as const,
      risk_state: 'source_required' as const,
      canonical_identity: null,
      campaign_asset: null,
      index: null,
      review_items: [],
      market_structure: null,
      provider_context
    };
    if (!normalized_contract) return empty;

    const exact = (value: string) => normalizeRhChainContract(value) === normalized_contract;
    const reviewItems = input.reviewItems ?? getRhChainReviewQueue().items;
    const canonical_identity = findRhChainCanonicalIdentity(requested_contract);
    const campaign_asset = findRhChain100ReceiptsAsset(requested_contract);
    const review_items = reviewItems.filter((item) => exact(item.token_contract));
    const index = getRhChain4663Index().assets.find((asset) => exact(asset.token_contract)) ?? null;
    const market_structure = rhChainReviewedLayerClassifications.find((classification) => exact(classification.contract)) ?? null;
    const contractForDisplay = campaign_asset?.contract ?? canonical_identity?.contract ?? review_items[0]?.token_contract ?? index?.token_contract ?? market_structure?.contract ?? provider_context.blockscout_token?.contract ?? requested_contract;

    if (campaign_asset) return reviewed({ ...empty, contract: contractForDisplay, source: '100_receipts', ticker: campaign_asset.ticker, campaign_asset, canonical_identity, review_items, index, market_structure }, campaign_asset.evidence_state === 'source_required' ? 'needs_more_evidence' : campaign_asset.evidence_state);
    if (canonical_identity || review_items.length) return reviewed({ ...empty, contract: contractForDisplay, source: 'reviewed_dossier', ticker: canonical_identity?.ticker ?? review_items[0]?.ticker ?? null, display_name: canonical_identity?.name ?? null, name: canonical_identity?.name ?? null, canonical_identity, review_items, index, market_structure }, review_items[0]?.review_state ?? 'not_found', review_items[0]?.risk_state ?? 'source_required');
    if (index) return reviewed({ ...empty, contract: contractForDisplay, source: '4663_index', ticker: index.ticker, display_name: index.name, name: index.name, index, market_structure }, index.classification === 'durable_signal' ? 'approved_signal' : index.classification === 'strong_watch' ? 'watch_only' : index.classification === 'do_not_touch_yet' ? 'do_not_touch_yet' : 'under_receipt_check', index.risk_state);
    if (market_structure) return {
      ...empty,
      contract: contractForDisplay,
      source: 'market_structure',
      ticker: market_structure.ticker,
      display_name: market_structure.display_name,
      name: market_structure.display_name,
      review_status: market_structure.evidence_state === 'source_required_for_claims' ? 'source_required_for_claims' : market_structure.evidence_state === 'source_required' ? 'not_reviewed' : market_structure.evidence_state === 'reviewed' ? 'under_receipt_check' : market_structure.evidence_state,
      claim_status: 'source_required_for_claims',
      risk_state: 'source_required',
      canonical_identity,
      review_items,
      index,
      market_structure
    };
    if (provider_context.latest_snapshot) return provider({ ...empty, contract: contractForDisplay, source: 'snapshot_history', ticker: provider_context.latest_snapshot.ticker });
    if (provider_context.dexscreener) return provider({ ...empty, contract: contractForDisplay, source: 'dexscreener' });
    if (provider_context.blockscout_token || provider_context.blockscout) return provider({ ...empty, contract: contractForDisplay, source: 'blockscout', ticker: provider_context.blockscout_token?.symbol ?? null, display_name: provider_context.blockscout_token?.name ?? null, name: provider_context.blockscout_token?.name ?? null });
    return empty;
  }
}

function reviewed<T extends Omit<RhChainContractIntelligence, 'review_status' | 'claim_status' | 'risk_state'>>(base: T, review_status: RhChainContractReviewStatus, risk_state: RhChainContractIntelligence['risk_state'] = 'source_required'): RhChainContractIntelligence {
  return { ...base, review_status, claim_status: 'reviewed', risk_state };
}
function provider<T extends Omit<RhChainContractIntelligence, 'review_status' | 'claim_status' | 'risk_state'>>(base: T): RhChainContractIntelligence {
  return { ...base, review_status: 'not_reviewed', claim_status: 'source_required_for_claims', risk_state: 'source_required' };
}
function providerContext(contract: string, normalized: string | null, input: RhChainContractIntelligenceInput): RhChainContractProviderContext {
  const exact = (value: string | null | undefined) => Boolean(normalized && value && normalizeRhChainContract(value) === normalized);
  const snapshots = (input.snapshotHistory ?? []).filter((snapshot) => exact(snapshot.token_address));
  const latest_snapshot = [...snapshots].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0] ?? null;
  const dexscreener = input.dexscreener?.exact_contract_match ? input.dexscreener : null;
  const blockscout = input.blockscout?.exact_contract_match ? input.blockscout : null;
  const blockscout_token = input.blockscoutToken && exact(input.blockscoutToken.contract) ? input.blockscoutToken : null;
  return { latest_snapshot, dexscreener, blockscout, blockscout_token };
}

export const rhChainContractIntelligence = new RhChainContractIntelligenceService();
export function resolveRhChainContractIntelligence(contract: string, input?: RhChainContractIntelligenceInput) {
  return rhChainContractIntelligence.resolve(contract, input);
}
