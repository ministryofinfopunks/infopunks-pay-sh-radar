import { normalizeRhChainContract } from './rhChainContractIntelligenceService';
import type { RhChainDiscoveryItem, RhChainDiscoveryQueueService } from './rhChainDiscoveryQueueService';
import type { RhChainMarketSnapshotService } from './rhChainMarketSnapshotService';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';

export const RH_CHAIN_REVIEW_PIPELINE_STATES = [
  'needs_review', 'source_required', 'watch_only', 'promoted_to_market_structure',
  'promoted_to_100_receipts_candidate', 'added_to_daily_receipt_draft', 'outcome_check_scheduled',
  'rejected', 'ignored_duplicate'
] as const;
export type RhChainReviewPipelineState = typeof RH_CHAIN_REVIEW_PIPELINE_STATES[number];
export const RH_CHAIN_REVIEW_CLASSIFICATIONS = ['meme', 'rwa', 'agent', 'infrastructure', 'defi', 'unknown'] as const;
export type RhChainReviewClassification = typeof RH_CHAIN_REVIEW_CLASSIFICATIONS[number];
export const RH_CHAIN_REVIEW_SECONDARY_TAGS = ['distribution', 'trading_culture', 'tokenized_equities', 'energy', 'data', 'ai_narrative', 'launchpad', 'speculative_distribution', 'meme_distribution', 'utility_claim_under_review', 'source_required_for_claims'] as const;
export type RhChainReviewSecondaryTag = typeof RH_CHAIN_REVIEW_SECONDARY_TAGS[number];

export type RhChainReviewRecord = {
  contract: string;
  token_name: string;
  symbol: string | null;
  canonical_pair: RhChainDiscoveryItem['canonical_pair'];
  secondary_pairs: RhChainDiscoveryItem['secondary_pairs'];
  dexscreener_context: { liquidity_usd: number | null; volume_h24: number | null; active_boosts: number; paid_orders: RhChainDiscoveryItem['paid_orders']; discovered_from: RhChainDiscoveryItem['discovered_from'] };
  blockscout_context: { status: RhChainDiscoveryItem['blockscout_status']; contract_verified: boolean | null; explorer_url: string | null };
  snapshot_count: number;
  attention_quality_state: string;
  market_structure_layer: RhChainReviewClassification;
  secondary_tags: RhChainReviewSecondaryTag[];
  reviewer_note: string | null;
  missing_evidence: string[];
  caveats: string[];
  review_state: RhChainReviewPipelineState;
  reviewed_at: string | null;
  reviewer_attribution: 'Signal Desk';
  outcome_check_at: string | null;
  daily_receipt_day: string | null;
  promotion_targets: Array<'market_structure' | '100_receipts'>;
  duplicate_ticker_contracts: string[];
};

export type RhChainDailyReviewDraft = { day: string; status: 'unpublished'; contracts: string[]; context: RhChainReviewRecord[]; updated_at: string };
export type RhChainReviewPipelinePayload = {
  title: 'RH Chain Signal Desk Review Pipeline';
  generated_at: string;
  items: RhChainReviewRecord[];
  daily_drafts: RhChainDailyReviewDraft[];
  caveats: string[];
};
export type RhChainDailyReviewSummary = {
  day: string;
  reviewed_count: number;
  promoted_to_market_structure_count: number;
  promoted_to_100_receipts_count: number;
  source_required_count: number;
  watch_only_count: number;
  ignored_count: number;
  top_attention_tokens: Array<Pick<RhChainReviewRecord, 'contract' | 'token_name' | 'symbol' | 'attention_quality_state'>>;
  attention_quality_context: Array<Pick<RhChainReviewRecord, 'contract' | 'token_name' | 'snapshot_count' | 'attention_quality_state'>>;
  cross_layer_candidates: Array<Pick<RhChainReviewRecord, 'contract' | 'token_name' | 'market_structure_layer' | 'secondary_tags'>>;
  promoted_market_structure_candidates: Array<Pick<RhChainReviewRecord, 'contract' | 'token_name' | 'symbol' | 'market_structure_layer'>>;
  outcome_checks: Array<Pick<RhChainReviewRecord, 'contract' | 'token_name' | 'symbol' | 'outcome_check_at'>>;
  paid_attention_detected: boolean;
  duplicate_ticker_warnings: Array<{ contract: string; duplicate_ticker_contracts: string[] }>;
  suggested_daily_receipt_headline: string;
};

type ReviewInput = Partial<Pick<RhChainReviewRecord, 'reviewer_note' | 'missing_evidence' | 'caveats' | 'market_structure_layer' | 'secondary_tags'>>;
type Options = { discoveryQueue: RhChainDiscoveryQueueService; snapshots: RhChainMarketSnapshotService; classifications?: () => RhChainLayerClassification[]; now?: () => Date };

/** Human-controlled memory over the exact-contract discovery inbox. It never writes approval, index, or publication state. */
export class RhChainReviewPipelineService {
  private readonly records = new Map<string, RhChainReviewRecord>();
  private readonly drafts = new Map<string, RhChainDailyReviewDraft>();
  private readonly now: () => Date;
  constructor(private readonly options: Options) { this.now = options.now ?? (() => new Date()); }

  async startDailyReview(day = utcDay(this.now())) {
    await this.sync();
    const existing = this.drafts.get(day) ?? { day, status: 'unpublished' as const, contracts: [], context: [], updated_at: this.now().toISOString() };
    this.drafts.set(day, existing);
    return { day, status: existing.status, discoveries_loaded: this.records.size, caveats: ['A daily review starts with source-required provider context. No token is approved or published by this action.'] };
  }

  async pipeline(day?: string): Promise<RhChainReviewPipelinePayload> {
    await this.sync();
    const drafts = day ? [this.draftFor(day)].filter((draft): draft is RhChainDailyReviewDraft => Boolean(draft)) : [...this.drafts.values()];
    return { title: 'RH Chain Signal Desk Review Pipeline', generated_at: this.now().toISOString(), items: [...this.records.values()].sort((a, b) => b.dexscreener_context.volume_h24! - a.dexscreener_context.volume_h24!), daily_drafts: drafts, caveats: ['Exact contract only. Reviewed memory outranks provider observations. Provider context can enter review but cannot create approved_signal, a completed receipt, or a published Daily Receipt.'] };
  }

  async classify(contract: string, input: ReviewInput) {
    const record = await this.require(contract);
    const layer = validLayer(input.market_structure_layer) ? input.market_structure_layer : record.market_structure_layer;
    const tags = unique((input.secondary_tags ?? record.secondary_tags).filter(validTag));
    return this.save({ ...record, market_structure_layer: layer, secondary_tags: tags, reviewer_note: input.reviewer_note?.trim() || record.reviewer_note, missing_evidence: clean(input.missing_evidence ?? record.missing_evidence), caveats: clean(input.caveats ?? record.caveats), review_state: record.review_state === 'needs_review' ? 'source_required' : record.review_state, reviewed_at: record.reviewed_at ?? this.now().toISOString() });
  }

  async watch(contract: string, input: ReviewInput = {}) { return this.transition(contract, 'watch_only', input); }
  async sourceRequired(contract: string, input: ReviewInput = {}) { return this.transition(contract, 'source_required', input); }
  async ignoreDuplicate(contract: string, input: ReviewInput = {}) { return this.transition(contract, 'ignored_duplicate', input); }
  async promoteToMarketStructure(contract: string, input: ReviewInput = {}) { return this.transition(contract, 'promoted_to_market_structure', input); }
  async promoteTo100Receipts(contract: string, input: ReviewInput = {}) { return this.transition(contract, 'promoted_to_100_receipts_candidate', input); }
  async addToDailyDraft(contract: string, input: ReviewInput & { day?: string } = {}) {
    const transitioned = await this.transition(contract, 'added_to_daily_receipt_draft', input);
    const day = validDay(input.day) ? input.day : utcDay(this.now());
    const updated = this.save({ ...transitioned, daily_receipt_day: day });
    const draft = this.drafts.get(day) ?? { day, status: 'unpublished' as const, contracts: [], context: [], updated_at: this.now().toISOString() };
    const contracts = unique([...draft.contracts, updated.contract]);
    const context = contracts.map((address) => this.records.get(address)).filter((entry): entry is RhChainReviewRecord => Boolean(entry));
    this.drafts.set(day, { ...draft, contracts, context, updated_at: this.now().toISOString() });
    return { item: updated, daily_receipt_draft: this.drafts.get(day)! };
  }
  async setOutcomeCheck(contract: string, input: ReviewInput & { outcome_check_at?: string } = {}) {
    const updated = await this.transition(contract, 'outcome_check_scheduled', input);
    const outcome_check_at = validDate(input.outcome_check_at) ? input.outcome_check_at! : plusDays(updated.reviewed_at ?? this.now().toISOString(), 7);
    return this.save({ ...updated, outcome_check_at });
  }

  async dailySummary(day = utcDay(this.now())): Promise<RhChainDailyReviewSummary> {
    await this.sync();
    const items = [...this.records.values()].filter((item) => item.reviewed_at?.slice(0, 10) === day || item.daily_receipt_day === day);
    const all = items.length ? items : [...this.records.values()];
    const count = (state: RhChainReviewPipelineState) => all.filter((item) => item.review_state === state).length;
    const paid = all.filter((item) => item.dexscreener_context.active_boosts > 0 || item.dexscreener_context.paid_orders.length > 0);
    return {
      day, reviewed_count: all.filter((item) => item.reviewed_at).length,
      promoted_to_market_structure_count: count('promoted_to_market_structure'), promoted_to_100_receipts_count: count('promoted_to_100_receipts_candidate'),
      source_required_count: count('source_required'), watch_only_count: count('watch_only'), ignored_count: count('ignored_duplicate'),
      top_attention_tokens: [...all].sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 5).map(({ contract, token_name, symbol, attention_quality_state }) => ({ contract, token_name, symbol, attention_quality_state })),
      attention_quality_context: all.map(({ contract, token_name, snapshot_count, attention_quality_state }) => ({ contract, token_name, snapshot_count, attention_quality_state })),
      cross_layer_candidates: all.filter((item) => item.secondary_tags.length > 0 && item.market_structure_layer !== 'unknown').map(({ contract, token_name, market_structure_layer, secondary_tags }) => ({ contract, token_name, market_structure_layer, secondary_tags })),
      promoted_market_structure_candidates: all.filter((item) => item.promotion_targets.includes('market_structure')).map(({ contract, token_name, symbol, market_structure_layer }) => ({ contract, token_name, symbol, market_structure_layer })),
      outcome_checks: all.filter((item) => item.outcome_check_at).map(({ contract, token_name, symbol, outcome_check_at }) => ({ contract, token_name, symbol, outcome_check_at })),
      paid_attention_detected: paid.length > 0,
      duplicate_ticker_warnings: all.filter((item) => item.duplicate_ticker_contracts.length).map(({ contract, duplicate_ticker_contracts }) => ({ contract, duplicate_ticker_contracts })),
      suggested_daily_receipt_headline: paid.length ? 'Signal Desk review: attention context and source gaps remain under review.' : 'Signal Desk review: exact-contract evidence remains under review.'
    };
  }

  /** Dynamic reviewed-intake records for Market Structure; deliberately never approved signals. */
  marketStructureCandidates(): RhChainLayerClassification[] {
    return [...this.records.values()].filter((record) => record.promotion_targets.includes('market_structure')).map((record) => ({
      contract: record.contract, ticker: record.symbol, display_name: record.token_name, dexscreener_pair: record.canonical_pair?.dex_url ?? null,
      primary_layer: record.market_structure_layer === 'unknown' ? 'unclassified' : record.market_structure_layer,
      secondary_layers: [], cross_layer_category: null,
      classification_reason: record.reviewer_note ?? 'Signal Desk reviewed-intake candidate; primary-source review remains required.',
      classification_source: 'manual_review', classification_confidence: 'low', evidence_state: 'source_required_for_claims',
      missing_evidence: record.missing_evidence.length ? record.missing_evidence : ['Primary source evidence remains required.'],
      caveat: record.caveats.join(' ') || 'Reviewed-intake candidate only; not an approved signal.', reviewed_at: record.reviewed_at, observed_at: this.now().toISOString(), data_mode: 'manual'
    }));
  }

  private async transition(contract: string, state: RhChainReviewPipelineState, input: ReviewInput) {
    const record = await this.require(contract);
    const reviewed_at = record.reviewed_at ?? this.now().toISOString();
    const promoted = state === 'promoted_to_market_structure' || state === 'promoted_to_100_receipts_candidate';
    const missing_evidence = clean(input.missing_evidence ?? record.missing_evidence);
    const caveats = clean(input.caveats ?? record.caveats);
    const promotion_targets = unique([...record.promotion_targets, ...(state === 'promoted_to_market_structure' ? ['market_structure' as const] : []), ...(state === 'promoted_to_100_receipts_candidate' ? ['100_receipts' as const] : [])]);
    const promotionCaveat = 'Promotion creates a human-reviewed intake candidate only; it is not an approved signal, completed receipt, endorsement, or publication.';
    return this.save({ ...record, review_state: state, market_structure_layer: validLayer(input.market_structure_layer) ? input.market_structure_layer : record.market_structure_layer, secondary_tags: unique((input.secondary_tags ?? record.secondary_tags).filter(validTag)), reviewer_note: input.reviewer_note?.trim() || record.reviewer_note, missing_evidence: promoted && !missing_evidence.length ? ['Primary source evidence remains required before any claim can be treated as reviewed.'] : missing_evidence, caveats: promoted ? clean([...caveats, promotionCaveat]) : caveats, reviewed_at, daily_receipt_day: state === 'added_to_daily_receipt_draft' ? utcDay(this.now()) : record.daily_receipt_day, promotion_targets });
  }
  private async require(contract: string) { await this.sync(); const normalized = exact(contract); if (!normalized) throw new Error('exact_contract_required'); const record = this.records.get(normalized); if (!record) throw new Error('review_contract_not_found'); return record; }
  private save(record: RhChainReviewRecord) { this.records.set(record.contract, structuredClone(record)); return structuredClone(record); }
  private draftFor(day: string) { return this.drafts.get(day) ? structuredClone(this.drafts.get(day)!) : null; }

  private async sync() {
    const queue = await this.options.discoveryQueue.refresh();
    await Promise.all(queue.items.map(async (item) => {
      const existing = this.records.get(item.contract);
      const attention = await this.options.snapshots.summarizeAttentionHistory(item.contract);
      const reviewed = this.options.classifications?.().find((entry) => normalizeRhChainContract(entry.contract) === item.contract) ?? null;
      const providerOnly = !item.discovered_from.includes('market_structure') && !item.discovered_from.includes('100_receipts') && !reviewed;
      const base: RhChainReviewRecord = {
        contract: item.contract, token_name: item.display_name, symbol: item.symbol, canonical_pair: item.canonical_pair, secondary_pairs: item.secondary_pairs,
        dexscreener_context: { liquidity_usd: item.liquidity_usd, volume_h24: item.volume_h24, active_boosts: item.active_boosts, paid_orders: item.paid_orders, discovered_from: item.discovered_from },
        blockscout_context: { status: item.blockscout_status, contract_verified: item.contract_verified, explorer_url: item.explorer_url }, snapshot_count: attention.snapshot_count, attention_quality_state: attention.state,
        market_structure_layer: reviewed ? layerFromReviewed(reviewed.primary_layer) : 'unknown', secondary_tags: [], reviewer_note: null,
        missing_evidence: providerOnly ? ['Primary source evidence is required; provider observations alone do not establish identity or claims.'] : [],
        caveats: [...item.caveats, 'Review Pipeline preserves exact-contract evidence and human-reviewed memory.'], review_state: providerOnly ? 'source_required' : 'needs_review', reviewed_at: null, reviewer_attribution: 'Signal Desk', outcome_check_at: null, daily_receipt_day: null, promotion_targets: [], duplicate_ticker_contracts: item.duplicate_ticker_contracts
      };
      if (!existing) this.save(base);
      else this.save({ ...base, ...existing, token_name: existing.token_name || base.token_name, canonical_pair: base.canonical_pair, secondary_pairs: base.secondary_pairs, dexscreener_context: base.dexscreener_context, blockscout_context: base.blockscout_context, snapshot_count: base.snapshot_count, attention_quality_state: base.attention_quality_state, duplicate_ticker_contracts: base.duplicate_ticker_contracts });
    }));
  }
}

function exact(value: string) { return /^0x[a-fA-F0-9]{40}$/.test(value.trim()) ? normalizeRhChainContract(value) : null; }
function clean(values: string[]) { return unique(values.map((value) => value.trim()).filter(Boolean)); }
function unique<T>(values: T[]) { return [...new Set(values)]; }
function validLayer(value: unknown): value is RhChainReviewClassification { return typeof value === 'string' && (RH_CHAIN_REVIEW_CLASSIFICATIONS as readonly string[]).includes(value); }
function validTag(value: unknown): value is RhChainReviewSecondaryTag { return typeof value === 'string' && (RH_CHAIN_REVIEW_SECONDARY_TAGS as readonly string[]).includes(value); }
function layerFromReviewed(value: string): RhChainReviewClassification { return validLayer(value) ? value : 'unknown'; }
function utcDay(date: Date) { return date.toISOString().slice(0, 10); }
function validDay(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }
function validDate(value: unknown): value is string { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
function plusDays(value: string, days: number) { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); }
function attentionScore(item: RhChainReviewRecord) { return item.dexscreener_context.active_boosts + item.dexscreener_context.paid_orders.length * 10; }
