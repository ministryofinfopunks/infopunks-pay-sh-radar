export type RhChainSignalLabel =
  | 'fresh_signal'
  | 'attention_spike'
  | 'durable_candidate'
  | 'liquidity_mirage'
  | 'deployer_cluster_risk'
  | 'top_holder_risk'
  | 'stock_token_spillover'
  | 'do_not_touch_yet';

export type RhChainRiskState = 'low_watch' | 'medium_watch' | 'high_risk' | 'source_required' | 'do_not_touch_yet';

export type RhChainDataFreshness = 'seeded' | 'manual' | 'community_submission' | 'persisted' | 'live_cached' | 'unavailable' | 'cached' | 'live_future';

export type RhChainConfidenceLevel = 'low' | 'medium' | 'high';

export type RhChainMetricScope = 'rh_chain' | 'global_context' | 'unknown' | 'source_required';

export type RhChainSource = {
  source_name: string;
  source_url?: string | null;
  observed_at: string;
  updated_at: string;
  data_mode: RhChainDataFreshness;
  confidence_level: RhChainConfidenceLevel;
  note?: string;
  caveat?: string;
  source?: string;
  url?: string | null;
};

export type RhChainPulseMetric = {
  id: string;
  label: string;
  value: string;
  state: 'live_required' | 'watching' | 'source_pending' | 'seeded';
  note: string;
  metric_scope: RhChainMetricScope;
  source: RhChainSource;
};

export type RhChainMetric = RhChainPulseMetric;

export type RhChainProtocolWatch = {
  name: string;
  category: string;
  value: string;
  scope: 'rh_chain' | 'global_or_unknown';
  metric_scope: RhChainMetricScope;
  display_note: string;
  status: string;
  note: string;
  source: RhChainSource;
};

export type RhChainMemeToken = {
  rank: number;
  ticker: string;
  name: string;
  contract: string;
  market_cap: string;
  volume_24h: string;
  liquidity: string;
  holder_notes: string;
  risk_state: RhChainRiskState;
  signal_labels: RhChainSignalLabel[];
  infopunks_verdict: string;
  source: RhChainSource;
};

export type RhChainMemeAsset = RhChainMemeToken;

export type RhChainSignalClassifierItem = {
  label: RhChainSignalLabel;
  meaning: string;
  trigger: string;
  desk_action: string;
  source: RhChainSource;
};

export type RhChainSignal = RhChainSignalClassifierItem;

export type RhChainRiskWallItem = {
  id: string;
  title: string;
  risk_state: RhChainRiskState;
  summary: string;
  evidence_needed: string[];
  source: RhChainSource;
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export type RhChainSpilloverTheme = {
  id: string;
  finance_theme: string;
  meme_mutation: string;
  signal_read: string;
  risk_note: string;
  source: RhChainSource;
};

export type RhChainSignalIndexAsset = {
  rank: number;
  asset: string;
  ticker: string;
  signal_score: number;
  labels: RhChainSignalLabel[];
  attention_source: string;
  receipt_state: string;
  note: string;
  source: RhChainSource;
};

export type RhChainReceipt = {
  receipt_id: string;
  timestamp: string;
  source: string;
  source_metadata: RhChainSource;
  summary: string;
  linked_assets: string[];
  caveat: string;
};

export type RhChainSignalSubmissionInput = {
  token_contract: string;
  ticker: string;
  chain?: string;
  x_twitter_link?: string;
  website_link?: string;
  liquidity_link?: string;
  evidence_links?: string[];
  deployer_notes?: string;
  submitter_notes?: string;
  launch_source?: RhChainLaunchSurface;
  launch_surface_url?: string;
  pair_address?: string;
  deployer_address?: string;
  lp_status_claim?: RhChainLpStatus;
  scout_handle?: string;
  scout_contact?: string;
  public_attribution_consent?: boolean;
  disclosure_confirmed: boolean;
};

export type RhChainScoutReputationLabel = 'new_scout' | 'receipt_hunter' | 'risk_spotter' | 'narrative_mapper' | 'signal_archivist';
export type RhChainSignalScout = {
  scout_id: string;
  display_handle: string;
  submissions_count: number;
  accepted_evidence_count: number;
  approved_signal_mentions: number;
  risk_warning_mentions: number;
  latest_submission_at: string;
  reputation_label: RhChainScoutReputationLabel;
  public_notes: string[];
  data_mode: RhChainDataFreshness;
};

export type RhChainScoutsPayload = {
  title: 'Signal Scouts';
  subtitle: 'The market forgets. Scouts bring receipts.';
  generated_at: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  scouts: RhChainSignalScout[];
  roles: Array<{ title: string; description: string }>;
};

export type RhChainDistributionSurface = 'x' | 'telegram' | 'discord' | 'generic';
export type RhChainDistributionPacket = {
  id: string;
  title: string;
  intended_surface: RhChainDistributionSurface;
  copy_text: string;
  link: string;
  risk_disclaimer: string;
  last_updated: string;
  source_artifact: string;
};
export type RhChainDistributionPackPayload = {
  title: 'RH Chain Distribution Pack';
  subtitle: 'Copy the receipt. Keep the caveat.';
  generated_at: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  packets: RhChainDistributionPacket[];
};

export type RhChainReceiptRelaySurface = 'x' | 'telegram' | 'discord';
/** Bot-friendly public-memory export. It intentionally has no audience, scheduling, or execution fields. */
export type RhChainReceiptRelayPacket = {
  packet_id: string;
  surface: RhChainReceiptRelaySurface;
  title: string;
  short_copy: string;
  long_copy: string;
  source_url: string;
  artifact_url: string;
  risk_disclaimer: string;
  no_raid_notice: string;
  generated_at: string;
  data_mode: RhChainDataFreshness;
};
export type RhChainReceiptRelayPayload = {
  title: 'RH Chain Receipt Relay';
  subtitle: 'Bot-friendly receipt memory. Caveat attached.';
  generated_at: string;
  data_mode: 'manual';
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  packets: RhChainReceiptRelayPacket[];
};

export type RhChainLaunchSurface = 'noxa_fun' | 'flap_sh' | 'trensh_today' | 'bankr' | 'tokeny_fun' | 'vlad_fun' | 'robindotmarket' | '20lab_erc20' | 'pump_fun_routed_rh_chain' | 'uniswap_direct_pool' | 'hardhat_foundry_custom' | 'unknown_manual';
export type RhChainLaunchSourceType = 'launchpad' | 'token_generator' | 'routed_launchpad' | 'direct_dex_pool' | 'custom_deployment' | 'unknown_manual';
export type RhChainLaunchSurfaceStatus = 'active' | 'degraded' | 'paused' | 'offline' | 'migrating' | 'source_required';
export type RhChainSurfaceRisk = 'front_end_dependency' | 'clone_flood' | 'creator_fee_claim_uncertainty' | 'launch_quality_filtering' | 'rival_surface_rotation' | 'unknown';
export type RhChainLpStatus = 'unknown' | 'locked_claimed' | 'burned_claimed' | 'unlocked' | 'unavailable';
export type RhChainLaunchConfidence = RhChainConfidenceLevel;
export type RhChainLaunchEvidence = { label: string; url: string | null; note: string; observed_at: string | null };
export type RhChainLaunchContext = {
  launch_source: RhChainLaunchSurface;
  launch_source_type: RhChainLaunchSourceType;
  launch_surface_url?: string | null;
  contract_verified: true | false | 'unknown';
  liquidity_route: string | null;
  pair_address?: string | null;
  lp_status: RhChainLpStatus;
  deployer_address?: string | null;
  creator_address?: string | null;
  deployer_observed_at?: string | null;
  source_notes: string;
  evidence_links: RhChainLaunchEvidence[];
  confidence_level: RhChainLaunchConfidence;
  data_mode: RhChainDataFreshness;
  observed_at: string;
  updated_at: string;
};

export type RhChainLaunchSurfaceRecord = {
  id: RhChainLaunchSurface;
  name: string;
  source_type: RhChainLaunchSourceType;
  description: string;
  risk_note: string;
  launch_surface_status?: RhChainLaunchSurfaceStatus;
  surface_risk?: RhChainSurfaceRisk;
  source: RhChainSource;
};

export type RhChainAccessSurfaceType = 'wallet' | 'bridge' | 'swap_router' | 'dex_app' | 'launch_app' | 'unknown';
export type RhChainAccessSurfaceSourceStatus = 'verified_source' | 'source_required' | 'community_claim' | 'unavailable';
export type RhChainAccessSurface = {
  access_surface_name: string;
  access_surface_type: RhChainAccessSurfaceType;
  source_url?: string | null;
  source_status: RhChainAccessSurfaceSourceStatus;
  observed_at: string;
  updated_at: string;
  data_mode: RhChainDataFreshness;
  confidence_level: RhChainConfidenceLevel;
  risk_notes: string;
  integration_notes: string;
};
/** Access context is descriptive only and attaches to a dossier only on exact reviewed evidence. */
export type RhChainAccessContext = {
  exact_contract_or_pair_match: boolean;
  access_surfaces: RhChainAccessSurface[];
  note: string;
};

export type RhChainSignalReviewPacket = {
  submission_id: string;
  submitted_at: string;
  token_contract: string;
  ticker: string;
  chain: string;
  links: {
    x_twitter: string | null;
    website: string | null;
    liquidity: string | null;
  };
  deployer_notes: string | null;
  submitter_notes: string | null;
  disclosure_confirmed: boolean;
  review_status: 'queued_for_manual_review';
  next_step: 'Infopunks will review the signal manually before adding it to the public desk.';
};

export const RH_CHAIN_REVIEW_STATES = [
  'queued_for_manual_review',
  'under_receipt_check',
  'needs_more_evidence',
  'watch_only',
  'approved_signal',
  'do_not_touch_yet',
  'rejected_low_receipt_quality'
] as const;

export type RhChainReviewState = typeof RH_CHAIN_REVIEW_STATES[number];

export type RhChainReviewSourceType = 'seeded' | 'manual' | 'manual_research' | 'community_submission' | 'persisted';

export type RhChainReviewLinks = {
  x: string | null;
  website: string | null;
  liquidity: string | null;
  explorer: string | null;
};

export type RhChainReviewItem = {
  review_id: string;
  review_state: RhChainReviewState;
  submitted_at: string;
  updated_at: string;
  ticker: string;
  token_contract: string;
  chain: string;
  source_type: RhChainReviewSourceType;
  links: RhChainReviewLinks;
  evidence_summary: string;
  missing_evidence: string[];
  risk_state: RhChainRiskState;
  signal_state: RhChainSignalLabel;
  infopunks_verdict: string;
  reviewer_note: string;
  next_step: string;
  source: RhChainSource;
  launch_context?: RhChainLaunchContext;
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export type RhChainReviewQueueSummary = {
  queued: number;
  under_receipt_check: number;
  approved_signals: number;
  do_not_touch_yet: number;
  rejected_low_receipt_quality: number;
};

export type RhChainReviewQueuePayload = {
  generated_at: string;
  source_policy: string;
  disclaimer: string;
  review_states: readonly RhChainReviewState[];
  counts: RhChainReviewQueueSummary;
  items: RhChainReviewItem[];
  grouped: Record<RhChainReviewState, RhChainReviewItem[]>;
  data_mode?: RhChainDataFreshness;
  persisted_submission_count?: number;
};

export const RH_CHAIN_4663_NARRATIVE_CLASSES = [
  'mascot_meta',
  'stock_token_spillover',
  'robinhood_brand_mutation',
  'solana_rotation',
  'ai_native_finance',
  'liquidity_mirage',
  'deployer_cluster_risk'
] as const;

export type RhChain4663NarrativeClass = typeof RH_CHAIN_4663_NARRATIVE_CLASSES[number];

export type RhChain4663Classification =
  | 'durable_signal'
  | 'strong_watch'
  | 'active_speculation'
  | 'high_risk_attention'
  | 'do_not_touch_yet';

export type RhChain4663ScoreComponents = {
  attention_score: number;
  volume_score: number;
  holder_score: number;
  durability_score: number;
  deployer_trust_score: number;
};

export type RhChain4663Asset = RhChain4663ScoreComponents & {
  rank: number;
  ticker: string;
  name: string;
  token_contract: string;
  pair: string;
  chain: string;
  category: string;
  market_cap: string;
  volume_24h: string;
  liquidity: string;
  holder_count: string;
  pool_age: string;
  signal_score: number;
  classification: RhChain4663Classification;
  risk_state: RhChainRiskState;
  narrative_class: RhChain4663NarrativeClass[];
  infopunks_verdict: string;
  last_updated: string;
  source_notes: string[];
  source: RhChainSource;
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export type RhChainIndexAsset = RhChain4663Asset;

type RhChain4663SeedAsset = Omit<RhChain4663Asset, 'rank' | 'signal_score' | 'classification' | 'source'> & {
  source?: RhChainSource;
};

export type RhChain4663IndexOverview = {
  top_signal: Pick<RhChain4663Asset, 'ticker' | 'name' | 'signal_score' | 'classification'>;
  highest_volume: Pick<RhChain4663Asset, 'ticker' | 'name' | 'volume_score' | 'volume_24h'>;
  highest_risk: Pick<RhChain4663Asset, 'ticker' | 'name' | 'risk_state' | 'infopunks_verdict'>;
  strongest_durability: Pick<RhChain4663Asset, 'ticker' | 'name' | 'durability_score' | 'pool_age'>;
  last_updated: string;
};

export type RhChain4663IndexPayload = {
  name: '4663 Signal Index';
  subtitle: 'A living index of Robinhood Chain attention assets, risk states, and narrative mutations.';
  generated_at: string;
  last_updated: string;
  source_policy: string;
  disclaimer: 'The 4663 Signal Index is an intelligence index, not a tokenized product, endorsement, listing, or financial recommendation.';
  scoring_model: {
    total_score: 100;
    attention_score: 25;
    volume_score: 25;
    holder_score: 20;
    durability_score: 20;
    deployer_trust_score: 10;
  };
  classification_thresholds: Record<RhChain4663Classification, string>;
  narrative_classes: readonly RhChain4663NarrativeClass[];
  overview: RhChain4663IndexOverview;
  assets: RhChain4663Asset[];
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export type RhChainDailyReceiptConfidence = RhChainConfidenceLevel;

export type RhChainDailyReceiptStatus = RhChainDataFreshness;

export type RhChainDailyReceiptSource = RhChainSource & {
  name: string;
  url: string | null;
  note: string;
};

export type RhChainDailyReceiptWatchItem = {
  item: string;
  reason: string;
  risk_state: RhChainRiskState;
  next_thing_to_verify: string;
};

export type RhChainDailyReceiptSectionId = 'chain_pulse' | 'meme_pulse' | 'launchpad_stress_test' | 'access_wallet_pulse' | 'rwa_pulse' | 'risk_wall' | 'narrative_mutation' | 'infopunks_verdict';

export type RhChainDailyReceiptSection = {
  section_id: RhChainDailyReceiptSectionId;
  title: string;
  summary: string;
  fields: Array<{ label: string; value: string }>;
};

export type RhChainDailyReceipt = {
  receipt_id: string;
  receipt_type?: 'daily_market_memory';
  date: string;
  period?: string;
  generated_at: string;
  observed_at?: string;
  chain: string;
  headline: string;
  summary: string;
  top_signal: string;
  biggest_risk: string;
  strongest_narrative: string;
  liquidity_note: string;
  stock_token_spillover_note: string;
  solana_base_migration_note: string;
  deployer_watch_note: string;
  infopunks_verdict: string;
  watchlist: RhChainDailyReceiptWatchItem[];
  do_not_touch_yet: RhChainDailyReceiptWatchItem[];
  sources: RhChainDailyReceiptSource[];
  confidence_level: RhChainDailyReceiptConfidence;
  status: RhChainDailyReceiptStatus;
  data_mode: RhChainDataFreshness;
  source_notes?: string;
  manual_context?: string;
  receipt_sections?: RhChainDailyReceiptSection[];
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export type RhChainDailyReceiptsPayload = {
  title: 'Daily RH Chain Receipts';
  subtitle: 'The market forgets. Infopunks keeps the memory.';
  generated_at: string;
  source_policy: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  latest_receipt: RhChainDailyReceipt;
  receipts: RhChainDailyReceipt[];
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
};

export const RH_CHAIN_DAILY_RECEIPT_SECTION_IDS = ['chain_pulse', 'meme_pulse', 'launchpad_stress_test', 'risk_wall', 'narrative_mutation', 'infopunks_verdict'] as const;
export type RhChainDailyReceiptAuthoringInput = RhChainDailyReceipt & {
  period: string;
  observed_at: string;
  source_notes: string;
  receipt_sections: RhChainDailyReceiptSection[];
};
export type RhChainDailyReceiptValidation = { valid: boolean; errors: string[] };

export type RhChainMemePulseAsset = {
  ticker: string;
  name: string;
  narrative_class: RhChain4663NarrativeClass[];
  signal_score: number | null;
  risk_state: RhChainRiskState;
  launch_surface: string | null;
  infopunks_verdict: string;
  receipt_state: string;
  source: RhChainSource;
  contract?: string | null;
  context_origin?: 'auto_observed' | 'reviewed_memory';
};

export type RhChainMemePulsePayload = {
  title: 'RH Meme Pulse';
  subtitle: 'What’s moving. What’s risky. What the market is trying to say.';
  generated_at: string;
  last_updated: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  snapshot: {
    flagship_signal: string;
    top_volume_rotation: string;
    highest_risk_attention: string;
    strongest_narrative_mutation: string;
    latest_receipt: string;
    last_updated: string;
  };
  top_attention_assets: RhChainMemePulseAsset[];
  launchpad_stress: Array<{ id: string; title: string; summary: string; risk_state: RhChainRiskState }>;
  risk_strip: Array<{ id: string; title: string; summary: string; risk_state: RhChainRiskState }>;
  market_translation: Array<{ id: string; trend: string; translation: string; caveat: string }>;
  freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
  refreshed_at?: string;
};

export type RhChainTokenDossier = {
  contract: string;
  ticker: string | null;
  name: string | null;
  chain: string;
  review_status: RhChainReviewState | 'not_found';
  risk_state: RhChainRiskState | 'source_required';
  data_mode: RhChainDataFreshness;
  identity_status: 'valid' | 'source_required';
  generated_at: string;
  disclaimer: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  memory: {
    index: RhChain4663Asset | null;
    review_items: RhChainReviewItem[];
    submissions: Array<{ submission_id: string; submitted_at: string; evidence_summary: string; audit_events: Array<{ event_id: string; occurred_at: string; action: string; to_status: string; note?: string }> }>;
    daily_receipts: Array<{ receipt_id: string; headline: string; date: string }>;
    scout_summary: string;
  };
  external_context: {
    token_pair: { pair_address: string | null; dex_url: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; exact_contract_match: boolean; chain_match_status: 'chain_verified' | 'chain_unverified' | 'chain_mismatch'; freshness: string; source_timestamp: string | null } | null;
    explorer: { explorer_url: string | null; deployer_address: string | null; contract_exists: boolean | null; contract_verified: boolean | null; contract_type: string | null; availability: 'available' | 'unavailable'; exact_contract_match: boolean; freshness: string; source_timestamp: string | null } | null;
    category_relevance: { label: string; freshness: string; source_timestamp: string | null };
  };
  launch_context: RhChainLaunchContext | null;
  access_context: RhChainAccessContext | null;
  risk_notes: string[];
  receipt_trail: Array<{ id: string; label: string; timestamp: string; href: string | null }>;
  related_suspected_correlations?: Array<{ correlation_id: string; correlation_type: string; evidence_summary: string; confidence_level: RhChainConfidenceLevel; review_status: 'requires_review'; observed_at: string }>;
};

export const RH_CHAIN_CLONE_SUSPICION_TYPES = ['duplicate_ticker', 'impersonator', 'fake_volume_trap', 'low_liquidity_clone', 'suspicious_launch_surface', 'launchpad_displacement_risk', 'deployer_cluster', 'unknown'] as const;
export type RhChainCloneSuspicionType = typeof RH_CHAIN_CLONE_SUSPICION_TYPES[number];
export type RhChainCloneRadarItem = {
  id: string;
  suspected_ticker: string;
  claimed_identity: string;
  token_contract: string;
  chain: string;
  suspicion_type: RhChainCloneSuspicionType;
  evidence_summary: string;
  evidence_links: Array<{ label: string; url: string | null }>;
  related_tokens: string[];
  launch_context: RhChainLaunchContext | null;
  review_status: RhChainReviewState;
  risk_state: RhChainRiskState;
  confidence_level: RhChainConfidenceLevel;
  observed_at: string;
  updated_at: string;
  data_mode: RhChainDataFreshness;
  source_notes: string[];
};

export const RH_CHAIN_RISK_PATTERN_CATEGORIES = ['vampire_copycat_risk', 'fake_relaunch_risk', 'launchpad_displacement_risk', 'duplicate_social_claim', 'liquidity_claim_unverified', 'creator_fee_claim_uncertain', 'front_end_dependency_risk', 'direct_uniswap_low_liquidity_risk'] as const;
export type RhChainRiskPatternCategory = typeof RH_CHAIN_RISK_PATTERN_CATEGORIES[number];
/** Read-only review cue. It does not alter a submission, token, or public review decision. */
export type RhChainRiskPatternItem = {
  risk_pattern_id: string;
  risk_category: RhChainRiskPatternCategory;
  suspected_ticker: string;
  contract?: string | null;
  related_surface: RhChainLaunchSurface;
  evidence_summary: string;
  source_links: Array<{ label: string; url: string | null }>;
  confidence_level: RhChainConfidenceLevel;
  review_status: 'requires_review';
  next_review_step: string;
  data_mode: RhChainDataFreshness;
  observed_at: string;
};

export type RhChainCloneRadarPayload = {
  title: 'Clone & Impersonator Radar';
  subtitle: 'The market moves fast. The copies move faster.';
  generated_at: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  disclaimer: string;
  active_warnings: RhChainCloneRadarItem[];
  duplicate_ticker_watch: RhChainCloneRadarItem[];
  liquidity_watch: RhChainCloneRadarItem[];
  vampire_copycat_watch: RhChainRiskPatternItem[];
  risk_categories: Array<{ category: RhChainCloneSuspicionType | RhChainRiskPatternCategory; title: string; explanation: string }>;
  correlations?: RhChainRiskCorrelation[];
  flagging_method: Array<{ signal: string; explanation: string }>;
  correlation_sweep?: { observed_at: string; freshness_state: 'fresh' | 'aging' | 'stale'; correlation_count: number };
};

export type RhChainLaunchpadSurfaceStatus = 'active' | 'degraded' | 'paused' | 'offline' | 'migrating' | 'source_required' | 'unknown';
export type RhChainLaunchpadSurfaceRisk = 'front_end_dependency' | 'clone_flood' | 'vampire_copycat_risk' | 'creator_fee_claim_uncertainty' | 'launch_quality_filtering' | 'rival_surface_rotation' | 'source_required';
export type RhChainLaunchpadClaimType = 'launch_count' | 'fee_claim' | 'outage_claim' | 'rival_share_claim' | 'notable_token_claim';

/** Read-only surface-memory record. It intentionally holds no launch, routing, or execution fields. */
export type RhChainLaunchpadSurface = {
  surface_id: 'noxa_fun' | 'pons' | 'flap_sh' | 'trensh_today' | 'bankr' | 'tokeny_fun' | 'vlad_fun' | 'robindotmarket' | 'uniswap_direct_launches' | 'pump_fun_routed_rh_chain' | 'unknown_manual';
  name: string;
  surface_url?: string | null;
  status: RhChainLaunchpadSurfaceStatus;
  status_confidence: RhChainConfidenceLevel;
  last_observed_at: string;
  data_mode: RhChainDataFreshness;
  source_notes: string[];
  known_tokens: string[];
  notable_claims: string[];
  fee_claims: string[];
  launch_count_claims: string[];
  risk_notes: string[];
  surface_risks: RhChainLaunchpadSurfaceRisk[];
  infopunks_note: string;
  source: RhChainSource;
  related_receipts?: string[];
  related_submissions?: string[];
  source_required?: boolean;
};

export type RhChainLaunchpadClaim = {
  claim_id: string;
  claim_type: RhChainLaunchpadClaimType;
  surface_id: RhChainLaunchpadSurface['surface_id'];
  claim: string;
  status: 'source_required' | 'observed' | 'unverified';
  source_notes: string;
  last_observed_at: string;
};

export type RhChainLaunchpadObservatoryPayload = {
  title: 'RH Chain Launchpad Observatory';
  subtitle: 'Where tokens start. Where claims break. Where receipts matter.';
  generated_at: string;
  data_mode: 'manual';
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory. Infopunks does not launch the token. Infopunks remembers the launch.';
  source_policy: string;
  disclaimer: string;
  surfaces: RhChainLaunchpadSurface[];
  claim_ledger: RhChainLaunchpadClaim[];
  post_noxa_stress_map: Array<{ title: string; explanation: string }>;
  risk_notes: Array<{ title: string; explanation: string }>;
};

export type RhChainRiskCorrelationType = 'duplicate_ticker_multiple_contracts' | 'same_deployer_multiple_submissions' | 'repeated_launch_surface_low_evidence' | 'reused_liquidity_link' | 'missing_contract_verification' | 'repeated_lp_status_claim_without_evidence' | 'risk_wall_review_queue_overlap';
export type RhChainRiskCorrelation = {
  correlation_id: string;
  correlation_type: RhChainRiskCorrelationType;
  suspected_correlation: string;
  related_records: Array<{ review_id: string; ticker: string; token_contract: string; review_state: RhChainReviewState }>;
  evidence_summary: string;
  confidence_level: RhChainConfidenceLevel;
  review_status: 'requires_review';
  recommended_next_review_step: string;
};

export type RhChainPayload = {
  title: string;
  subtitle: string;
  generated_at: string;
  last_updated: string;
  disclaimer: string;
  source_policy: string;
  chain_pulse: {
    metrics: RhChainPulseMetric[];
    top_protocols: RhChainProtocolWatch[];
    bridge_notes: string[];
    observed_at?: string;
    fetched_at?: string;
    freshness_state?: import('../services/rhChainTruthGuards').RhChainFreshnessState;
    confidence_level?: RhChainConfidenceLevel;
    data_mode?: RhChainDataFreshness;
    source_notes?: string[];
  };
  meme_pulse: RhChainMemeToken[];
  signal_classifier: RhChainSignalClassifierItem[];
  risk_wall: RhChainRiskWallItem[];
  stock_token_spillover_map: RhChainSpilloverTheme[];
  signal_index_4663: RhChainSignalIndexAsset[];
  receipts: RhChainReceipt[];
};

const OBSERVED_AT = '2026-07-09T03:45:00.000Z';

export function createRhChainSource({
  source_name,
  source_url = null,
  observed_at,
  updated_at = observed_at,
  data_mode,
  confidence_level,
  note,
  caveat = note
}: {
  source_name: string;
  source_url?: string | null;
  observed_at: string;
  updated_at?: string;
  data_mode: RhChainDataFreshness;
  confidence_level: RhChainConfidenceLevel;
  note?: string;
  caveat?: string;
}): RhChainSource {
  return {
    source_name,
    source_url,
    observed_at,
    updated_at,
    data_mode,
    confidence_level,
    note,
    caveat,
    source: source_name,
    url: source_url
  };
}

const seededDeskSource: RhChainSource = {
  ...createRhChainSource({
    source_name: 'Infopunks seeded RH Chain watchlist',
    source_url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
    observed_at: OBSERVED_AT,
    data_mode: 'seeded',
    confidence_level: 'low',
    note: 'Seeded intelligence scaffold. Volatile market metrics require live source verification before use.'
  })
};

const sourcePending: RhChainSource = {
  ...createRhChainSource({
    source_name: 'source_pending',
    observed_at: OBSERVED_AT,
    data_mode: 'seeded',
    confidence_level: 'low',
    note: 'No canonical live source attached yet. Treat this field as a watch slot, not verified market data.'
  })
};

const manualDeskSource = createRhChainSource({
  source_name: 'Infopunks RH Chain Signal Desk manual research',
  source_url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
  observed_at: OBSERVED_AT,
  updated_at: OBSERVED_AT,
  data_mode: 'manual',
  confidence_level: 'medium',
  note: 'Manual desk research. Not live market indexing.'
});

function createRhChainDailyReceiptSource({
  name,
  observed_at,
  url = null,
  note,
  data_mode = 'seeded',
  confidence_level = 'low',
  updated_at = observed_at
}: {
  name: string;
  observed_at: string;
  url?: string | null;
  note: string;
  data_mode?: RhChainDataFreshness;
  confidence_level?: RhChainConfidenceLevel;
  updated_at?: string;
}): RhChainDailyReceiptSource {
  return {
    ...createRhChainSource({
      source_name: name,
      source_url: url,
      observed_at,
      updated_at,
      data_mode,
      confidence_level,
      note
    }),
    name,
    url,
    note
  };
}

export const rhChain4663SeedAssets: RhChain4663SeedAsset[] = [
  {
    ticker: 'HOOD',
    name: 'Hood Rail',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'ticker_memory',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 19,
    volume_score: 10,
    holder_score: 8,
    durability_score: 12,
    deployer_trust_score: 2,
    risk_state: 'source_required',
    narrative_class: ['stock_token_spillover', 'robinhood_brand_mutation'],
    infopunks_verdict: 'Active speculation. Familiar ticker language is attention, not proof.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual score from RH Chain desk memory.',
      'No verified contract, pair, live market cap, holder count, or official affiliation receipt is attached.'
    ]
  },
  {
    ticker: 'RAILS',
    name: 'Wall Street Rails',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'rail_meme',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 18,
    volume_score: 12,
    holder_score: 9,
    durability_score: 13,
    deployer_trust_score: 3,
    risk_state: 'medium_watch',
    narrative_class: ['stock_token_spillover', 'solana_rotation'],
    infopunks_verdict: 'Strong watch shape, but still receipt-gated. Liquidity and deployer proof decide.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual rail-language candidate.',
      'Volume, holders, and liquidity remain source pending until public receipts attach.'
    ]
  },
  {
    ticker: 'IPO',
    name: 'Meme IPO Desk',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'finance_mutation',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 16,
    volume_score: 9,
    holder_score: 8,
    durability_score: 11,
    deployer_trust_score: 2,
    risk_state: 'source_required',
    narrative_class: ['stock_token_spillover', 'liquidity_mirage'],
    infopunks_verdict: 'High-risk attention until contract, pool, and non-affiliation receipts exist.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual stock-token spillover marker.',
      'Launch-window language can create urgency before receipts exist.'
    ]
  },
  {
    ticker: 'TICKR',
    name: 'Ticker Memory',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'symbol_abstraction',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 15,
    volume_score: 8,
    holder_score: 7,
    durability_score: 12,
    deployer_trust_score: 2,
    risk_state: 'medium_watch',
    narrative_class: ['mascot_meta', 'solana_rotation'],
    infopunks_verdict: 'Watch-only memory object. Useful for signal tracking, not conviction.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual abstraction for ticker-memory behavior.',
      'No live market claim is made.'
    ]
  },
  {
    ticker: 'SHERW',
    name: 'Sherwood Loop',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'brand_adjacent_myth',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 12,
    volume_score: 6,
    holder_score: 5,
    durability_score: 6,
    deployer_trust_score: 1,
    risk_state: 'high_risk',
    narrative_class: ['robinhood_brand_mutation', 'deployer_cluster_risk', 'liquidity_mirage'],
    infopunks_verdict: 'Do not touch yet. Risk evidence outruns signal evidence.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual caution marker.',
      'Requires deployer history, ownership controls, and contract similarity receipts.'
    ]
  },
  {
    ticker: 'ROUTE',
    name: 'Route Memory',
    token_contract: '0xmanualresearchseed000000000000000000000000',
    pair: 'manual_seed_pair_pending_external_receipt',
    chain: 'Robinhood Chain',
    category: 'route_language',
    market_cap: 'manual research: external market source pending',
    volume_24h: 'manual research: external market source pending',
    liquidity: 'manual research: internal seed receipt only',
    holder_count: 'manual research: source pending',
    pool_age: 'manual research: source pending',
    attention_score: 17,
    volume_score: 13,
    holder_score: 11,
    durability_score: 15,
    deployer_trust_score: 4,
    risk_state: 'low_watch',
    narrative_class: ['ai_native_finance', 'stock_token_spillover'],
    infopunks_verdict: 'Active speculation with usable desk memory. External receipts still required.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Manual research seed from public desk memory.',
      'Approved for intelligence tracking only, not safety, listing, or buy interpretation.'
    ]
  },
  {
    ticker: 'DIVY',
    name: 'Dividend Mirage',
    token_contract: 'unverified_contract_required',
    pair: 'source_pending',
    chain: 'Robinhood Chain',
    category: 'yield_claim_risk',
    market_cap: 'seeded/manual: source pending',
    volume_24h: 'seeded/manual: source pending',
    liquidity: 'seeded/manual: source pending',
    holder_count: 'seeded/manual: source pending',
    pool_age: 'seeded/manual: source pending',
    attention_score: 10,
    volume_score: 4,
    holder_score: 4,
    durability_score: 5,
    deployer_trust_score: 1,
    risk_state: 'do_not_touch_yet',
    narrative_class: ['liquidity_mirage', 'deployer_cluster_risk'],
    infopunks_verdict: 'Do not touch yet. Yield language needs hard receipts before memory.',
    last_updated: OBSERVED_AT,
    source_notes: [
      'Seeded/manual risk object.',
      'No payout mechanism, legal framing, contract, or liquidity receipt exists.'
    ]
  }
];

export const rhChainDailyReceipts: RhChainDailyReceipt[] = [
  {
    receipt_id: 'rh_daily_003',
    receipt_type: 'daily_market_memory',
    date: '2026-07-15',
    period: 'July 13 → July 15, 2026 UTC',
    generated_at: '2026-07-15T00:00:00.000Z',
    observed_at: '2026-07-15T00:00:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'RH Chain survives NOXA stress as launchpad competition fragments the meme layer',
    summary: 'A manually authored market-memory receipt for the NOXA stress window: RH Chain meme activity stayed resilient despite reported NOXA downtime and launch restrictions, while direct Uniswap pools and competing launch surfaces increased the need for launch-origin memory.',
    top_signal: 'RH Chain meme activity stayed resilient despite NOXA downtime and launch restrictions',
    biggest_risk: 'launchpad dependency, clone floods, vampire/copycat launches, and platform-front-end fragility',
    strongest_narrative: 'the chain is shifting from single-launchpad meme season to launch-surface competition',
    liquidity_note: 'Direct Uniswap launches and liquidity migration are important context, but exact DEX volume, TVL, pool-depth, and competitor-share figures remain source- and timestamp-dependent.',
    stock_token_spillover_note: 'The launch-surface shift changes distribution conditions, not the need for source-backed RWA, Stock Token, or DeFi usage evidence.',
    solana_base_migration_note: 'Direct-pool and rival-surface rotation are tracked as RH Chain launch context only; no cross-chain migration or route claim is asserted without primary evidence.',
    deployer_watch_note: 'Fragmented launch surfaces expand the need to track exact launch origin, pair, deployer, LP status, canonical channels, and source timestamp before a token record is upgraded.',
    infopunks_verdict: 'The launchpad layer is fragmenting. The chain did not break. The memory layer becomes more important.',
    manual_context: 'Human-reviewed memory for July 13 → July 15, 2026 UTC. Reported NOXA disruption and competitor claims remain cautious, source-required context unless primary, timestamped evidence is attached.',
    source_notes: 'Manual market memory with medium confidence. Exact DEX volume, TVL, liquidity, and competitor-share figures are source/timestamp dependent unless primary links are present. Reported NOXA downtime, token-creation continuity, and rival launch-surface claims are source_required unless independently verified; this receipt makes no misconduct, rug, or intent claim.',
    receipt_sections: [
      {
        section_id: 'chain_pulse',
        title: 'Chain Pulse',
        summary: 'RH Chain remains active after launch, even as a major launch surface was reportedly under stress.',
        fields: [
          { label: 'Activity read', value: 'RH Chain remains active after launch.' },
          { label: 'Metrics rule', value: 'Treat exact DEX volume and TVL figures as source/timestamp dependent.' },
          { label: 'No invented figures', value: 'No exact chain-level market numbers are asserted in this receipt.' }
        ]
      },
      {
        section_id: 'meme_pulse',
        title: 'Meme Pulse',
        summary: 'Meme activity remains the visible driver while launch origin becomes a more material part of risk context.',
        fields: [
          { label: 'Flagship attention asset', value: 'CASHCAT remains the flagship attention asset.' },
          { label: 'Attention shift', value: 'Direct Uniswap launches and rival launch surfaces are gaining attention.' },
          { label: 'Watchlist rule', value: 'Watchlist names remain context only unless reviewed.' }
        ]
      },
      {
        section_id: 'launchpad_stress_test',
        title: 'Launchpad Stress Test',
        summary: 'Reported NOXA stress is a launch-surface fragmentation signal, not a misconduct finding.',
        fields: [
          { label: 'NOXA report', value: 'NOXA reportedly went offline/down for roughly two days; source_required unless verified live.' },
          { label: 'Creation report', value: 'New token creation reportedly continued at high levels; source_required unless primary evidence is attached.' },
          { label: 'Rival surfaces', value: 'flap.sh, trensh.today, bankr, tokeny.fun, vlad.fun, and robindotmarket are context/source-required unless verified.' },
          { label: 'Signal', value: 'This is a launch-surface fragmentation signal.' }
        ]
      },
      {
        section_id: 'access_wallet_pulse',
        title: 'Launch + Access Surface Mutation',
        summary: 'Launch surfaces show where tokens start. Access surfaces show how users arrive.',
        fields: [
          { label: 'Launch surfaces', value: 'Track launch origin, pair, deployer, LP status, and source timestamp.' },
          { label: 'Access surfaces', value: 'Track how users discover, reach, and route to a token without treating access as legitimacy.' },
          { label: 'Why it changed', value: 'Disruption increases the importance of source-stamped launch and access memory.' }
        ]
      },
      {
        section_id: 'risk_wall',
        title: 'Risk Wall',
        summary: 'Fragmentation raises the cost of weak provenance and multiplies the pathways for copycat attention.',
        fields: [
          { label: 'Identity risk', value: 'clone floods, impersonators, fake relaunches, and vampire/copycat tokens.' },
          { label: 'Platform risk', value: 'launchpad-front-end dependency and creator-fee claim uncertainty.' },
          { label: 'Liquidity risk', value: 'low-liquidity direct launches.' },
          { label: 'Evidence rule', value: 'Competitor claims remain source_required unless primary evidence is attached.' }
        ]
      },
      {
        section_id: 'narrative_mutation',
        title: 'Narrative Mutation',
        summary: 'RH Chain is moving from “NOXA-led meme season” into “multi-surface launch competition.”',
        fields: [
          { label: 'What this validates', value: 'Infopunks’ Launch Surface Watch, Clone Radar, Token Dossiers, and Signal Vault.' },
          { label: 'Memory rule', value: 'The memory layer matters more when launch surfaces fragment.' }
        ]
      },
      {
        section_id: 'infopunks_verdict',
        title: 'Infopunks Verdict',
        summary: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
        fields: [{ label: 'Verdict', value: 'The launchpad layer is fragmenting. The chain did not break. The memory layer becomes more important.' }]
      }
    ],
    watchlist: [
      { item: 'CASHCAT', reason: 'Flagship RH Chain attention asset while the meme layer remains resilient in manual desk memory.', risk_state: 'medium_watch', next_thing_to_verify: 'Exact contract, pair, pool depth, holder concentration, and sustained activity.' },
      { item: 'Direct Uniswap pool launches', reason: 'Direct pools are gaining attention as an alternative launch route, but liquidity quality is not assumed.', risk_state: 'source_required', next_thing_to_verify: 'Exact pair, reserves, LP status, deployer, and source timestamp.' },
      { item: 'Rival launch surfaces', reason: 'flap.sh, trensh.today, bankr, tokeny.fun, vlad.fun, and robindotmarket are tracked only as unverified context.', risk_state: 'source_required', next_thing_to_verify: 'Primary surface links, timestamped availability, and exact launch-to-pair evidence.' }
    ],
    do_not_touch_yet: [
      { item: 'Clone floods and fake relaunches', reason: 'Fragmented launch surfaces can multiply ticker, branding, and canonical-channel confusion.', risk_state: 'do_not_touch_yet', next_thing_to_verify: 'Exact contract, canonical channels, deployer history, and launch origin.' },
      { item: 'Vampire/copycat and low-liquidity direct launches', reason: 'Attention can move before pool depth, LP state, or launch quality is independently receipted.', risk_state: 'high_risk', next_thing_to_verify: 'Pair reserves, LP status, transaction quality, and deployer links.' },
      { item: 'Unverified NOXA and competitor claims', reason: 'Reported downtime, continuity, and competitor-share claims are context, not established facts.', risk_state: 'source_required', next_thing_to_verify: 'Primary, timestamped source evidence.' }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks manual RH Chain NOXA stress watch',
        observed_at: '2026-07-15T00:00:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk/daily-receipts',
        note: 'Human-reviewed, manually authored market memory for July 13 → July 15, 2026 UTC. NOXA disruption and competitor claims remain source_required absent primary links; no misconduct or intent is inferred.',
        data_mode: 'manual',
        confidence_level: 'medium'
      })
    ],
    confidence_level: 'medium',
    status: 'manual',
    data_mode: 'manual'
  },
  {
    receipt_id: 'rh_daily_002',
    receipt_type: 'daily_market_memory',
    date: '2026-07-13',
    period: 'July 12 → July 13, 2026 UTC',
    generated_at: '2026-07-13T00:00:00.000Z',
    observed_at: '2026-07-13T00:00:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'RH Chain meme bids rotate while access rails become the hidden story',
    summary: 'CASHCAT remains the flagship RH Chain attention asset, while the deeper manually reviewed signal is distribution: wallet, bridge, and swap surfaces can turn meme attention into usable network access. Metrics remain source- and timestamp-dependent.',
    top_signal: 'CASHCAT remains the flagship RH Chain attention asset',
    biggest_risk: 'Fresh-launch exhaustion, clone tokens, impersonators, fake-volume traps, and source-required wallet/access claims',
    strongest_narrative: 'Wallet access + meme liquidity + Stock Token future',
    liquidity_note: 'Meme trading and DEX activity remain meaningful in the manual observation, but no exact liquidity, volume, or stablecoin figures are asserted without a timestamped source.',
    stock_token_spillover_note: 'Stock Tokens/RWAs remain the long-term thesis; public meme conversation is still larger than demonstrated RWA usage.',
    solana_base_migration_note: 'Wallet, bridge, and swap integrations are access context only. They do not establish a token, wallet, or bridge endorsement.',
    deployer_watch_note: 'Fresh launches require contract, deployer, pool-depth, ticker, and transaction-quality verification before any signal is upgraded.',
    infopunks_verdict: 'Memes are the spark. Wallets are the pipe. Stock Tokens are the thesis. Infopunks is the memory.',
    manual_context: 'Manually authored from the supplied 24-hour RH Chain market memory for July 12 → July 13, 2026 UTC. This is a human-reviewed receipt, not a live index or endorsement.',
    source_notes: 'Manual, source-dependent market memory. Meme names are public watchlist/context only and are not approved signals. Unverified wallet and access claims, including Backpack Wallet native support, remain source_required until primary sources are attached.',
    receipt_sections: [
      {
        section_id: 'chain_pulse',
        title: 'Chain Pulse',
        summary: 'No major new official Robinhood announcement was confirmed in this period; activity remains meaningful across stablecoins, DEX volume, and meme trading without invented numerical claims.',
        fields: [
          { label: 'Official announcement', value: 'No major new official Robinhood announcement was confirmed in this period.' },
          { label: 'Activity context', value: 'Meaningful stablecoin, DEX-volume, and meme-trading activity was manually observed.' },
          { label: 'Metrics rule', value: 'All metrics remain source- and timestamp-dependent; no exact figures are asserted here.' }
        ]
      },
      {
        section_id: 'meme_pulse',
        title: 'Meme Pulse',
        summary: 'Cat meta remains dominant and the Hood/Robinhood-native narrative stays active, with rotation and exhaustion risk increasing in fresh launches.',
        fields: [
          { label: 'Flagship attention asset', value: 'CASHCAT remains the flagship attention asset.' },
          { label: 'Watchlist context only', value: '4663, HOODRAT, JUGGERNAUT, HOODIE, SPINOR, Elves, HOODMARKET, FIDEL, TROLL, GREENWHALE, and other names are public watchlist/context only unless reviewed.' },
          { label: 'Dominant meta', value: 'Cat meta remains dominant; Hood/Robinhood-native narrative remains active.' },
          { label: 'Rotation risk', value: 'Fresh launches show rotation and exhaustion risk.' }
        ]
      },
      {
        section_id: 'access_wallet_pulse',
        title: 'Access / Wallet Pulse',
        summary: 'Access surfaces matter because they can convert meme attention into usable distribution; they are context, not endorsement.',
        fields: [
          { label: 'Swap and bridge access', value: 'LI.FI-powered Robinhood Chain swaps and bridge access are an important access-layer signal.' },
          { label: 'Backpack Wallet', value: 'Native support claim is source_required until a primary Backpack source is added.' },
          { label: 'Why access matters', value: 'Wallet and bridge integrations can convert meme attention into usable distribution.' },
          { label: 'Interpretation rule', value: 'Access surfaces are context, not endorsement.' }
        ]
      },
      {
        section_id: 'rwa_pulse',
        title: 'RWA Pulse',
        summary: 'Stock Tokens/RWAs remain the long-term thesis, but meme attention still exceeds RWA usage in public conversation.',
        fields: [
          { label: 'Long-term thesis', value: 'Stock Tokens/RWAs remain the long-term thesis.' },
          { label: 'Current tension', value: 'Can meme-led users convert into Stock Token, lending, and DeFi usage?' },
          { label: 'Conversation vs usage', value: 'Meme attention remains larger in public conversation than demonstrated RWA usage.' }
        ]
      },
      {
        section_id: 'risk_wall',
        title: 'Risk Wall',
        summary: 'Attention is not verification. Fresh launches and access claims remain review gates.',
        fields: [
          { label: 'Token and launch risks', value: 'Clone tokens, impersonators, fake-volume traps, fresh-launch exhaustion, ticker confusion, and low-liquidity launches.' },
          { label: 'Access-claim risk', value: 'Unverified wallet/access claims are source_required.' },
          { label: 'Verification reminder', value: 'Verify exact contract, canonical source, deployer, pool depth, and transaction quality.' }
        ]
      },
      {
        section_id: 'narrative_mutation',
        title: 'Narrative Mutation',
        summary: 'RH Chain is shifting from pure new-chain meme season into distribution-layer competition.',
        fields: [
          { label: 'Memes', value: 'Memes create attention.' },
          { label: 'Wallets and bridges', value: 'Wallets and bridges create access.' },
          { label: 'Stock Tokens', value: 'Stock Tokens create the serious thesis.' },
          { label: 'Infopunks', value: 'Infopunks preserves the memory layer.' }
        ]
      },
      {
        section_id: 'infopunks_verdict',
        title: 'Infopunks Verdict',
        summary: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
        fields: [
          { label: 'Verdict', value: 'Memes are the spark. Wallets are the pipe. Stock Tokens are the thesis. Infopunks is the memory.' }
        ]
      }
    ],
    watchlist: [
      { item: 'CASHCAT', reason: 'Flagship RH Chain attention asset in the manually authored receipt.', risk_state: 'medium_watch', next_thing_to_verify: 'Exact contract, pool depth, holder concentration, and sustained activity.' },
      { item: 'Public meme watchlist names', reason: '4663, HOODRAT, JUGGERNAUT, HOODIE, SPINOR, Elves, HOODMARKET, FIDEL, TROLL, GREENWHALE, and other names are context only unless reviewed.', risk_state: 'source_required', next_thing_to_verify: 'Primary source, exact contract, liquidity context, and manual receipt review.' },
      { item: 'Wallet and bridge access', reason: 'Distribution-layer context can matter, but integrations do not imply endorsement.', risk_state: 'source_required', next_thing_to_verify: 'Primary wallet or bridge source and timestamped integration evidence.' }
    ],
    do_not_touch_yet: [
      { item: 'Fresh clone and impersonator launches', reason: 'Ticker, branding, and launch claims are not identity or liquidity proof.', risk_state: 'do_not_touch_yet', next_thing_to_verify: 'Verified contract, canonical channels, and deployer history.' },
      { item: 'Fake-volume and low-liquidity traps', reason: 'Displayed activity can be unreliable where pools are shallow or trade quality is unreviewed.', risk_state: 'high_risk', next_thing_to_verify: 'Pool depth, trade distribution, and independent transaction review.' },
      { item: 'Backpack Wallet native support claim', reason: 'The claim remains unverified without a primary Backpack source.', risk_state: 'source_required', next_thing_to_verify: 'Primary Backpack source confirming the claimed support.' }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks manual 24-hour RH Chain rundown',
        observed_at: '2026-07-13T00:00:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk/daily-receipts',
        note: 'Human-reviewed, manually authored intelligence for July 12 → July 13, 2026 UTC. Meme names are watchlist/context only; unverified wallet/access claims remain source_required.',
        data_mode: 'manual',
        confidence_level: 'medium'
      })
    ],
    confidence_level: 'medium',
    status: 'manual',
    data_mode: 'manual'
  },
  {
    receipt_id: 'rh_daily_001',
    receipt_type: 'daily_market_memory',
    date: '2026-07-12',
    period: 'July 11 → July 12, 2026 UTC',
    generated_at: '2026-07-12T00:00:00.000Z',
    observed_at: '2026-07-12T00:00:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'RH Chain meme volume stays dominant while RWA rails mature underneath',
    summary: 'A manually seeded 24-hour market memory: CASHCAT remains the attention anchor while the durable question shifts to whether Robinhood distribution, meme liquidity, and Stock Token rails convert into persistent RWA and DeFi use.',
    top_signal: 'CASHCAT remains the flagship RH Chain attention asset',
    biggest_risk: 'Clone tokens, impersonators, fake-volume traps, and low-liquidity launch churn',
    strongest_narrative: 'Robinhood distribution + meme liquidity + Stock Token future',
    liquidity_note: 'Meme-led volume was manually observed, but no numerical pool-depth or liquidity snapshot is asserted in this receipt.',
    stock_token_spillover_note: 'Stock Token is treated as a future-usage narrative, not proof of official partnership, listing, or adoption.',
    solana_base_migration_note: 'Solana/Base rotation may be mentioned as attention context only; no migration, bridge, or liquidity claim is verified here.',
    deployer_watch_note: 'Treat repeat deployer patterns, contract lookalikes, and coordinated launch clusters as verification gates.',
    infopunks_verdict: 'Meme season is still the user-acquisition layer; the real question is whether attention converts into persistent RWA, DeFi, and Stock Token usage.',
    manual_context: 'Manually seeded from the supplied 24-hour RH Chain market rundown for July 11 → July 12, 2026 UTC. It is a human-reviewed market-memory receipt, not a live index.',
    source_notes: 'All observations are manual, timestamped, and source-dependent. Metrics without a supplied numerical source remain intentionally unquantified.',
    receipt_sections: [
      {
        section_id: 'chain_pulse',
        title: 'Chain Pulse',
        summary: 'Market structure is tracked as a manual snapshot; no real-time certainty is claimed.',
        fields: [
          { label: 'TVL range / snapshot', value: 'Not supplied in the manual rundown; source-dependent.' },
          { label: 'Stablecoin market cap', value: 'Not supplied in the manual rundown; source-dependent.' },
          { label: 'DEX volume', value: 'Meme-led activity observed; no numerical volume asserted.' },
          { label: 'Fees / revenue', value: 'Not available in the manual rundown.' },
          { label: 'Top protocol notes', value: 'RWA and DeFi rails are maturing underneath attention; protocol rankings not asserted.' },
          { label: 'Source / timestamp', value: 'Manual observation · 2026-07-12T00:00:00.000Z UTC.' }
        ]
      },
      {
        section_id: 'meme_pulse',
        title: 'Meme Pulse',
        summary: 'Attention remains concentrated in meme liquidity, with CASHCAT as the flagship observation.',
        fields: [
          { label: 'Top meme', value: 'CASHCAT' },
          { label: 'Top volume mover', value: 'CASHCAT attention flow; numerical rank not asserted.' },
          { label: 'Flagship meme', value: 'CASHCAT' },
          { label: 'Highest-risk rotation', value: 'Fresh clone and impersonator launches.' },
          { label: 'Meme volume summary', value: 'Meme volume stays dominant in the manually observed period.' }
        ]
      },
      {
        section_id: 'rwa_pulse',
        title: 'RWA Pulse',
        summary: 'The durable thesis is usage beneath the attention layer, not the attention layer itself.',
        fields: [
          { label: 'Stock Token usage', value: 'Future-usage narrative under observation; no adoption metric asserted.' },
          { label: 'Lending / collateral', value: 'Watch for verified collateral and lending integrations before upgrading conviction.' },
          { label: 'DeFi composability', value: 'Potential is narrative-level until routes, liquidity, and usage receipts persist.' },
          { label: 'Infrastructure maturity', value: 'Rails appear to be maturing beneath meme activity; source-dependent.' }
        ]
      },
      {
        section_id: 'risk_wall',
        title: 'Risk Wall',
        summary: 'Verification is the filter between attention and memory.',
        fields: [
          { label: 'Clone / impersonator warning', value: 'Verify the exact contract and official channels; names and tickers are not proof.' },
          { label: 'Fake-volume concern', value: 'Do not treat displayed volume as durable without pool-depth and transaction-quality checks.' },
          { label: 'Deployer cluster risk', value: 'Review deployer history, funding paths, ownership controls, and contract similarity.' },
          { label: 'Low-liquidity trap risk', value: 'Small pools and launch churn can make exits unreliable.' },
          { label: 'Verification reminder', value: 'Verify contract, explorer, liquidity, deployer, and non-affiliation context.' }
        ]
      },
      {
        section_id: 'narrative_mutation',
        title: 'Narrative Mutation',
        summary: 'Market language is moving from pure meme attention toward a question of durable financial rails.',
        fields: [
          { label: 'What changed', value: 'The language now links meme liquidity to Robinhood distribution and Stock Token future.' },
          { label: 'Meme activity vs RWA thesis', value: 'Memes acquire users; RWA and DeFi retention remain unproven.' },
          { label: 'Solana / Base rotation', value: 'Context only if mentioned; no verified rotation claim is made.' },
          { label: 'Hood / cat / stock-token / AI-agent', value: 'HOOD and cat attention persist alongside Stock Token and AI-agent usage narratives; none imply affiliation.' }
        ]
      },
      {
        section_id: 'infopunks_verdict',
        title: 'Infopunks Verdict',
        summary: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
        fields: [
          { label: 'Verdict', value: 'Meme season is still the user-acquisition layer; the real question is whether attention converts into persistent RWA, DeFi, and Stock Token usage.' }
        ]
      }
    ],
    watchlist: [
      { item: 'CASHCAT', reason: 'Flagship RH Chain attention asset in the manual 24-hour rundown.', risk_state: 'medium_watch', next_thing_to_verify: 'Exact contract, pool depth, holder concentration, and sustained activity.' },
      { item: 'Stock Token usage', reason: 'The strongest durability question beneath the meme layer.', risk_state: 'source_required', next_thing_to_verify: 'Persistent, source-backed usage and composability receipts.' }
    ],
    do_not_touch_yet: [
      { item: 'Clone and impersonator launches', reason: 'Ticker and branding similarity are not identity or liquidity proof.', risk_state: 'do_not_touch_yet', next_thing_to_verify: 'Verified contract, deployer history, and canonical channels.' },
      { item: 'Low-liquidity volume spikes', reason: 'Fake volume and shallow liquidity can create unreliable price discovery and exits.', risk_state: 'high_risk', next_thing_to_verify: 'Pool depth, trade distribution, and independent transaction review.' }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks manual 24-hour RH Chain rundown',
        observed_at: '2026-07-12T00:00:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk/daily-receipts',
        note: 'Human-reviewed, manually seeded intelligence for July 11 → July 12, 2026 UTC. Source-dependent; not a real-time market feed.',
        data_mode: 'manual',
        confidence_level: 'medium'
      })
    ],
    confidence_level: 'medium',
    status: 'manual',
    data_mode: 'manual'
  },
  {
    receipt_id: 'rh_daily_2026_07_09',
    date: '2026-07-09',
    generated_at: '2026-07-09T04:45:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'Route language leads the desk, but receipts remain thin.',
    summary: 'RH Chain attention is clustering around rails, routes, ticker memory, and stock-token spillover. The desk sees useful market-memory formation, but live liquidity, holders, and deployer receipts remain mostly source pending.',
    top_signal: 'ROUTE',
    biggest_risk: 'DIVY yield language without mechanism receipts',
    strongest_narrative: 'Wall Street rails mutating into route and settlement memes',
    liquidity_note: 'Liquidity is still seeded/manual. No public pool-depth receipt is strong enough to treat volume as durable.',
    stock_token_spillover_note: 'Equity-ticker familiarity is driving attention faster than evidence. Non-affiliation context remains mandatory.',
    solana_base_migration_note: 'Rotation language is present as a narrative input only. No verified migration route or bridge receipt is attached.',
    deployer_watch_note: 'SHERW and DIVY remain blocked until deployer history, ownership controls, and contract similarity receipts appear.',
    infopunks_verdict: 'Public memory is forming. Do not upgrade attention into conviction until receipts survive liquidity, holder, and deployer checks.',
    watchlist: [
      {
        item: 'ROUTE',
        reason: 'Highest 4663 score and clearest route-language memory.',
        risk_state: 'low_watch',
        next_thing_to_verify: 'External explorer, pool, and holder receipts.'
      },
      {
        item: 'RAILS',
        reason: 'Strong rail-language compression with incomplete proof.',
        risk_state: 'medium_watch',
        next_thing_to_verify: 'Pool reserves and deployer wallet history.'
      },
      {
        item: 'HOOD',
        reason: 'Ticker familiarity can pull attention into the desk quickly.',
        risk_state: 'source_required',
        next_thing_to_verify: 'Verified non-affiliation note and contract receipt.'
      }
    ],
    do_not_touch_yet: [
      {
        item: 'DIVY',
        reason: 'Yield and dividend framing without mechanism receipts.',
        risk_state: 'do_not_touch_yet',
        next_thing_to_verify: 'Legal framing, payout mechanism, contract, and liquidity receipts.'
      },
      {
        item: 'SHERW',
        reason: 'Brand-adjacent myth plus deployer-cluster uncertainty.',
        risk_state: 'high_risk',
        next_thing_to_verify: 'Deployer history, funding path, and ownership controls.'
      }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks RH Chain Signal Desk seed',
        observed_at: OBSERVED_AT,
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
        note: 'Seeded/manual desk memory. Not live market indexing.',
        data_mode: 'manual',
        confidence_level: 'medium'
      }),
      createRhChainDailyReceiptSource({
        name: '4663 Signal Index seeded model',
        observed_at: '2026-07-09T04:30:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk/4663-index',
        note: 'Computed from seeded/manual score components until receipts attach.',
        data_mode: 'seeded',
        confidence_level: 'low'
      }),
      createRhChainDailyReceiptSource({
        name: 'RH Chain Review Queue',
        observed_at: '2026-07-09T04:34:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk/review-queue',
        note: 'Public review states are manual intelligence states, not endorsement.',
        data_mode: 'manual',
        confidence_level: 'medium'
      })
    ],
    confidence_level: 'medium',
    status: 'manual',
    data_mode: 'manual'
  },
  {
    receipt_id: 'rh_daily_2026_07_08',
    date: '2026-07-08',
    generated_at: '2026-07-08T22:00:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'Ticker memory appears before trustworthy pool memory.',
    summary: 'Early RH Chain watch slots show attention around HOOD, RAILS, IPO, and TICKR. The strongest signal is narrative legibility; the weakest layer is source-backed liquidity.',
    top_signal: 'HOOD',
    biggest_risk: 'Affiliation confusion around familiar ticker language',
    strongest_narrative: 'Stock-token spillover into meme tickers',
    liquidity_note: 'No verified liquidity source attached. Treat all market values as source pending.',
    stock_token_spillover_note: 'Equity and brokerage language is acting as the main attention primitive.',
    solana_base_migration_note: 'Migration chatter is unverified and should stay narrative-only until route receipts exist.',
    deployer_watch_note: 'No clean deployer history is attached to seeded watch slots.',
    infopunks_verdict: 'Track the vocabulary, not the trade. Receipts decide whether any signal survives first rotation.',
    watchlist: [
      {
        item: 'HOOD',
        reason: 'Most legible ticker-memory object.',
        risk_state: 'source_required',
        next_thing_to_verify: 'Contract, explorer, and non-affiliation receipt.'
      },
      {
        item: 'TICKR',
        reason: 'Useful abstraction for attention migration.',
        risk_state: 'medium_watch',
        next_thing_to_verify: 'Whether a real market surface appears.'
      }
    ],
    do_not_touch_yet: [
      {
        item: 'SHERW',
        reason: 'Brand-adjacent myth without deployer receipts.',
        risk_state: 'high_risk',
        next_thing_to_verify: 'Funding path and contract similarity review.'
      }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks seeded RH Chain watchlist',
        observed_at: '2026-07-08T22:00:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
        note: 'Manual seed receipt for market-memory setup.'
      })
    ],
    confidence_level: 'low',
    status: 'seeded',
    data_mode: 'seeded'
  },
  {
    receipt_id: 'rh_daily_2026_07_07',
    date: '2026-07-07',
    generated_at: '2026-07-07T22:00:00.000Z',
    chain: 'Robinhood Chain',
    headline: 'The desk opens with receipts-first constraints.',
    summary: 'Initial RH Chain memory emphasizes source policy, non-affiliation language, and manual review before any public promotion.',
    top_signal: 'RH Chain Signal Desk scaffold',
    biggest_risk: 'Screenshots or ticker familiarity being mistaken for proof',
    strongest_narrative: 'Receipts before attention',
    liquidity_note: 'No live liquidity is indexed. Pool data must be source-linked before use.',
    stock_token_spillover_note: 'Stock-token language is tracked as narrative, not market proof.',
    solana_base_migration_note: 'No migration claim is accepted without route, bridge, and failure-mode receipts.',
    deployer_watch_note: 'Deployer checks are required before any signal leaves watch state.',
    infopunks_verdict: 'The first receipt is the rule: no source, no signal.',
    watchlist: [
      {
        item: 'Chain pulse source policy',
        reason: 'Volatile metrics need observed_at and source notes.',
        risk_state: 'source_required',
        next_thing_to_verify: 'Auditable explorer or pool source.'
      }
    ],
    do_not_touch_yet: [
      {
        item: 'Unverified contracts',
        reason: 'A contract-free token slot is a claim, not a market signal.',
        risk_state: 'do_not_touch_yet',
        next_thing_to_verify: 'Contract, explorer, deployer wallet, and pool address.'
      }
    ],
    sources: [
      createRhChainDailyReceiptSource({
        name: 'Infopunks desk seed',
        observed_at: '2026-07-07T22:00:00.000Z',
        url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
        note: 'Seeded source policy receipt.'
      })
    ],
    confidence_level: 'low',
    status: 'seeded',
    data_mode: 'seeded'
  }
];

export const rhChainReviewQueueItems: RhChainReviewItem[] = [
  {
    review_id: 'rhq_hood_seed_manual_001',
    review_state: 'queued_for_manual_review',
    submitted_at: '2026-07-09T03:50:00.000Z',
    updated_at: '2026-07-09T04:10:00.000Z',
    ticker: 'HOOD',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'seeded',
    source: seededDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Seeded watch slot created from ticker-attention risk. No contract, pool, or explorer receipt is attached.',
    missing_evidence: ['verified contract', 'explorer link', 'liquidity pool receipt', 'non-affiliation context'],
    risk_state: 'source_required',
    signal_state: 'fresh_signal',
    infopunks_verdict: 'Queued for manual review. Ticker familiarity is not evidence.',
    reviewer_note: 'Keep visible as an intake object only; do not imply Robinhood affiliation or market readiness.',
    next_step: 'Attach contract and explorer receipts before any receipt check can begin.'
  },
  {
    review_id: 'rhq_rails_manual_002',
    review_state: 'under_receipt_check',
    submitted_at: '2026-07-09T03:54:00.000Z',
    updated_at: '2026-07-09T04:18:00.000Z',
    ticker: 'RAILS',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'manual_research',
    source: manualDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Manual research notes show strong rail-language compression, but the desk has no canonical pool or contract receipt.',
    missing_evidence: ['pool reserves', 'contract provenance', 'deployer wallet', 'holder distribution'],
    risk_state: 'medium_watch',
    signal_state: 'attention_spike',
    infopunks_verdict: 'Under receipt check. Narrative shape is legible; proof layer is incomplete.',
    reviewer_note: 'Receipt check should separate actual liquidity depth from screenshots and route chatter.',
    next_step: 'Map pool and deployer receipts, then reclassify as watch-only or needs-more-evidence.'
  },
  {
    review_id: 'rhq_ipo_seed_003',
    review_state: 'needs_more_evidence',
    submitted_at: '2026-07-09T03:58:00.000Z',
    updated_at: '2026-07-09T04:20:00.000Z',
    ticker: 'IPO',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'seeded',
    source: seededDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Seeded stock-token spillover candidate. Useful as a narrative marker, not a verified token signal.',
    missing_evidence: ['contract receipt', 'website provenance', 'liquidity receipt', 'official non-affiliation note'],
    risk_state: 'source_required',
    signal_state: 'stock_token_spillover',
    infopunks_verdict: 'Needs more evidence before the desk can remember it as anything beyond a theme.',
    reviewer_note: 'IPO language can create early-entry pressure. Keep the proof threshold high.',
    next_step: 'Wait for public contract and liquidity receipts with timestamps.'
  },
  {
    review_id: 'rhq_tickr_seed_004',
    review_state: 'watch_only',
    submitted_at: '2026-07-09T04:02:00.000Z',
    updated_at: '2026-07-09T04:22:00.000Z',
    ticker: 'TICKR',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'seeded',
    source: seededDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Seeded abstraction for ticker-memory behavior. No live market claim is made.',
    missing_evidence: ['market surface', 'contract', 'pool', 'independent holder receipts'],
    risk_state: 'medium_watch',
    signal_state: 'fresh_signal',
    infopunks_verdict: 'Watch only. The object is useful for attention mapping, not conviction.',
    reviewer_note: 'Keep as a memory primitive for how symbols propagate across finance memes.',
    next_step: 'Track whether a real contract appears and whether receipts outlast first-rotation attention.'
  },
  {
    review_id: 'rhq_sherw_manual_005',
    review_state: 'do_not_touch_yet',
    submitted_at: '2026-07-09T04:04:00.000Z',
    updated_at: '2026-07-09T04:26:00.000Z',
    ticker: 'SHERW',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'manual_research',
    source: manualDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Manual research flagged brand-adjacent myth risk and likely copycat gravity. No deployer receipts attached.',
    missing_evidence: ['deployer history', 'funding path', 'ownership controls', 'contract similarity review'],
    risk_state: 'high_risk',
    signal_state: 'deployer_cluster_risk',
    infopunks_verdict: 'Do not touch yet. Risk evidence is stronger than signal evidence.',
    reviewer_note: 'Public visibility here is a caution marker, not promotion.',
    next_step: 'Require deployer and ownership receipts before any upgrade.'
  },
  {
    review_id: 'rhq_route_manual_006',
    review_state: 'approved_signal',
    submitted_at: '2026-07-09T04:06:00.000Z',
    updated_at: '2026-07-09T04:30:00.000Z',
    ticker: 'ROUTE',
    token_contract: '0xmanualresearchseed000000000000000000000000',
    chain: 'Robinhood Chain',
    source_type: 'manual_research',
    source: manualDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: 'https://radar.infopunks.fun/rh-chain-signal-desk',
      explorer: 'https://radar.infopunks.fun/rh-chain-signal-desk'
    },
    evidence_summary: 'Manual research packet has internally linked seed receipts for route-language monitoring, but no external market verification.',
    missing_evidence: ['external explorer receipt', 'independent liquidity source', 'holder concentration review'],
    risk_state: 'low_watch',
    signal_state: 'durable_candidate',
    infopunks_verdict: 'Approved signal for desk indexing only. This does not mean safe to buy.',
    reviewer_note: 'Approved means the signal can be remembered and watched; it is not a listing or recommendation.',
    next_step: 'Keep receipt freshness visible and downgrade if external proof does not arrive.'
  },
  {
    review_id: 'rhq_divy_seed_007',
    review_state: 'rejected_low_receipt_quality',
    submitted_at: '2026-07-09T04:08:00.000Z',
    updated_at: '2026-07-09T04:34:00.000Z',
    ticker: 'DIVY',
    token_contract: 'unverified_contract_required',
    chain: 'Robinhood Chain',
    source_type: 'seeded',
    source: seededDeskSource,
    links: {
      x: null,
      website: null,
      liquidity: null,
      explorer: null
    },
    evidence_summary: 'Seeded dividend/yield risk marker. Claim language is high-risk and no payout mechanism receipt exists.',
    missing_evidence: ['contract', 'legal framing', 'payout mechanism receipt', 'liquidity source'],
    risk_state: 'do_not_touch_yet',
    signal_state: 'do_not_touch_yet',
    infopunks_verdict: 'Rejected for low receipt quality until evidence materially changes.',
    reviewer_note: 'Yield language without receipts should stay blocked from promotion.',
    next_step: 'Do not upgrade without hard mechanism proof and source-linked risk notes.'
  }
];

export const rhChainPayload: RhChainPayload = {
  title: 'RH Chain Signal Desk',
  subtitle: 'Wall Street rails. Meme liquidity. Infopunks intelligence.',
  generated_at: OBSERVED_AT,
  last_updated: OBSERVED_AT,
  disclaimer: 'Independent Infopunks intelligence surface. Not affiliated with, endorsed by, or partnered with Robinhood. No buy, sell, or listing recommendation.',
  source_policy: 'Every volatile metric must carry a source and observed_at timestamp. Unknown market data is labeled source_pending instead of guessed.',
  chain_pulse: {
    metrics: [
      {
        id: 'tvl',
        label: 'TVL',
        value: 'source pending',
        state: 'live_required',
        metric_scope: 'source_required',
        note: 'Desk slot reserved for chain-level TVL once an auditable explorer or DefiLlama-style source is attached.',
        source: sourcePending
      },
      {
        id: 'dex_volume',
        label: 'DEX volume',
        value: 'source pending',
        state: 'live_required',
        metric_scope: 'source_required',
        note: 'Requires pool-level receipts. Thin launch volume can be wash-heavy until routed through durable venues.',
        source: sourcePending
      },
      {
        id: 'stock_token_activity',
        label: 'Stock Token activity',
        value: 'narrative watch',
        state: 'watching',
        metric_scope: 'global_context',
        note: 'Tracking finance-token themes as narrative inputs before treating them as liquidity proof.',
        source: seededDeskSource
      },
      {
        id: 'stablecoin_liquidity',
        label: 'Stablecoin liquidity',
        value: 'source pending',
        state: 'live_required',
        metric_scope: 'source_required',
        note: 'Bridgeable stable liquidity is the first proof line before meme assets become agent-spend relevant.',
        source: sourcePending
      },
      {
        id: 'attention_velocity',
        label: 'Attention velocity',
        value: '4663 watch active',
        state: 'seeded',
        metric_scope: 'rh_chain',
        note: 'Seeded index watches tickers, contract disclosures, route chatter, and stock-token spillover language.',
        source: seededDeskSource
      }
    ],
    top_protocols: [
      {
        name: 'Stock-token wrapper lanes',
        category: 'finance primitive',
        value: 'source_required',
        scope: 'global_or_unknown',
        metric_scope: 'global_context',
        display_note: 'Chain-specific protocol TVL not verified.',
        status: 'watching',
        note: 'Finance rails can become meme rails when ticker identity turns into trench language.',
        source: seededDeskSource
      },
      {
        name: 'DEX launch venues',
        category: 'liquidity venue',
        value: 'source_required',
        scope: 'global_or_unknown',
        metric_scope: 'source_required',
        display_note: 'Chain-specific protocol TVL not verified.',
        status: 'source required',
        note: 'No pool should be promoted without contract, reserve, and holder receipts.',
        source: sourcePending
      },
      {
        name: 'Bridge adapters',
        category: 'migration rail',
        value: 'source_required',
        scope: 'global_or_unknown',
        metric_scope: 'source_required',
        display_note: 'Chain-specific protocol TVL not verified.',
        status: 'source required',
        note: 'Bridge claims require proof of route, canonical asset, and failure mode before agent routing.',
        source: sourcePending
      }
    ],
    bridge_notes: [
      'Treat bridge screenshots as claims until routes, contracts, and receipts match.',
      'Stablecoin depth matters more than headline meme volume.',
      'Liquidity migration is signal only when it survives first rotation and holder concentration checks.'
    ]
  },
  meme_pulse: [
    {
      rank: 1,
      ticker: 'HOOD',
      name: 'Hood Rail',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Ticker attention likely to cluster around brand-adjacent language. Verify non-affiliation and distribution before indexing.',
      risk_state: 'source_required',
      signal_labels: ['fresh_signal', 'stock_token_spillover', 'top_holder_risk'],
      infopunks_verdict: 'Watch the receipts. Do not treat ticker familiarity as proof.',
      source: sourcePending
    },
    {
      rank: 2,
      ticker: 'RAILS',
      name: 'Wall Street Rails',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Narrative clarity is high, but contract provenance is unverified.',
      risk_state: 'medium_watch',
      signal_labels: ['attention_spike', 'stock_token_spillover'],
      infopunks_verdict: 'Good meme shape. Needs liquidity and deployer proof.',
      source: sourcePending
    },
    {
      rank: 3,
      ticker: 'SHERW',
      name: 'Sherwood Loop',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Brand-adjacent myth is strong enough to attract copycats. Receipts decide.',
      risk_state: 'high_risk',
      signal_labels: ['deployer_cluster_risk', 'liquidity_mirage', 'do_not_touch_yet'],
      infopunks_verdict: 'Do not touch yet. Verify deployer history first.',
      source: sourcePending
    },
    {
      rank: 4,
      ticker: 'IPO',
      name: 'Meme IPO Desk',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Stock-token language can mutate into launchpad speculation. Holder surface not proven.',
      risk_state: 'source_required',
      signal_labels: ['fresh_signal', 'stock_token_spillover'],
      infopunks_verdict: 'Potential narrative bridge. Needs contract and pool receipts.',
      source: sourcePending
    },
    {
      rank: 5,
      ticker: 'DIVY',
      name: 'Dividend Mirage',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Yield language invites misleading claims. Any dividend framing needs hard proof.',
      risk_state: 'do_not_touch_yet',
      signal_labels: ['top_holder_risk', 'do_not_touch_yet'],
      infopunks_verdict: 'High claim risk. Receipts before memory.',
      source: sourcePending
    },
    {
      rank: 6,
      ticker: 'TICKR',
      name: 'Ticker Memory',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Pure ticker abstraction. Useful for tracking attention migration, not enough for conviction.',
      risk_state: 'medium_watch',
      signal_labels: ['fresh_signal', 'attention_spike'],
      infopunks_verdict: 'Signal object, not a verdict object.',
      source: sourcePending
    }
  ],
  signal_classifier: [
    {
      label: 'fresh_signal',
      meaning: 'A new RH Chain narrative asset or contract enters the desk.',
      trigger: 'First credible contract, pool, social burst, or receipt submission.',
      desk_action: 'Stage it. Demand source, timestamp, contract, and non-affiliation language.',
      source: seededDeskSource
    },
    {
      label: 'attention_spike',
      meaning: 'Attention moves faster than liquidity proof.',
      trigger: 'Mention velocity, search traffic, or DEX watchlist jumps without matching holder quality.',
      desk_action: 'Track for 24-72 hours. Do not upgrade without receipts.',
      source: seededDeskSource
    },
    {
      label: 'durable_candidate',
      meaning: 'Signal persists beyond the first reflexive rotation.',
      trigger: 'Repeated volume, stable liquidity, wider holder base, and narrative reuse.',
      desk_action: 'Move from watch to candidate only after liquidity and holder checks.',
      source: seededDeskSource
    },
    {
      label: 'liquidity_mirage',
      meaning: 'Market cap or volume overstates exit depth.',
      trigger: 'Thin pool, suspicious volume, one-sided LP, or vanishing route depth.',
      desk_action: 'Mark high risk. Show pool receipts before allowing attention upgrade.',
      source: seededDeskSource
    },
    {
      label: 'deployer_cluster_risk',
      meaning: 'A launch appears connected to repeated copycat or extraction deployers.',
      trigger: 'Shared deployer wallet, funding path, contract template, or clustered launches.',
      desk_action: 'Move to Risk Wall until deployer history is explained.',
      source: seededDeskSource
    },
    {
      label: 'top_holder_risk',
      meaning: 'Supply control can overpower the meme.',
      trigger: 'Top wallets, team wallets, or fresh wallets hold concentrated supply.',
      desk_action: 'Require holder receipts and unlock context.',
      source: seededDeskSource
    },
    {
      label: 'stock_token_spillover',
      meaning: 'Finance-token language mutates into meme-market language.',
      trigger: 'Equity tickers, dividends, IPO, brokerage, or Wall Street rails become meme primitives.',
      desk_action: 'Map theme mutation. Avoid official partnership implication.',
      source: seededDeskSource
    },
    {
      label: 'do_not_touch_yet',
      meaning: 'The desk has enough risk to block promotion.',
      trigger: 'Unverified contract plus low liquidity, misleading claims, or deployer concentration.',
      desk_action: 'Keep visible on Risk Wall. No signal upgrade.',
      source: seededDeskSource
    }
  ],
  risk_wall: [
    {
      id: 'unverified-contracts',
      title: 'Unverified Contracts',
      risk_state: 'do_not_touch_yet',
      summary: 'Any RH Chain meme slot without a verified contract remains a claim, not a market signal.',
      evidence_needed: ['Contract address', 'Explorer link', 'Deployer wallet', 'Pool address', 'Observed_at timestamp'],
      source: sourcePending
    },
    {
      id: 'low-liquidity-traps',
      title: 'Low-Liquidity Traps',
      risk_state: 'high_risk',
      summary: 'Thin pools can make attention look like liquidity while exits remain fragile.',
      evidence_needed: ['Pool reserves', 'LP lock state', '24h volume source', 'Route depth screenshots are not enough'],
      source: sourcePending
    },
    {
      id: 'deployer-warning',
      title: 'Deployer Cluster Watch',
      risk_state: 'high_risk',
      summary: 'Copycat deployers may wrap stock-token language in familiar ticker bait.',
      evidence_needed: ['Funding path', 'Previous launches', 'Contract similarity', 'Ownership controls'],
      source: sourcePending
    }
  ],
  stock_token_spillover_map: [
    {
      id: 'equity-ticker-to-meme',
      finance_theme: 'Equity tickers',
      meme_mutation: 'Ticker-as-tribe assets',
      signal_read: 'The symbol matters before the business logic. Attention compresses around recognizable market language.',
      risk_note: 'Familiar ticker language can mislead users into assuming affiliation.',
      source: seededDeskSource
    },
    {
      id: 'brokerage-rails-to-culture',
      finance_theme: 'Brokerage rails',
      meme_mutation: 'Rails, route, desk, and settlement memes',
      signal_read: 'Infrastructure vocabulary becomes identity vocabulary once users can repeat it in one line.',
      risk_note: 'Infrastructure claims need source receipts, not screenshots.',
      source: seededDeskSource
    },
    {
      id: 'dividend-yield-to-claim-risk',
      finance_theme: 'Dividends and yield',
      meme_mutation: 'Cashflow memes and fake payout narratives',
      signal_read: 'Yield language is powerful because it feels familiar to traditional-market users.',
      risk_note: 'Any payout language is high-risk until receipts prove mechanism and legal framing.',
      source: seededDeskSource
    },
    {
      id: 'ipo-to-launch-meta',
      finance_theme: 'IPO access',
      meme_mutation: 'Launch-window speculation',
      signal_read: 'Primary-market mythology mutates into early-entry meme urgency.',
      risk_note: 'Urgency is not proof. Contract and holder receipts come first.',
      source: seededDeskSource
    }
  ],
  signal_index_4663: [
    {
      rank: 1,
      asset: 'Hood Rail',
      ticker: 'HOOD',
      signal_score: 66,
      labels: ['fresh_signal', 'stock_token_spillover', 'top_holder_risk'],
      attention_source: 'Ticker familiarity',
      receipt_state: 'contract_required',
      note: 'Most legible ticker. Highest affiliation-confusion risk.',
      source: seededDeskSource
    },
    {
      rank: 2,
      asset: 'Wall Street Rails',
      ticker: 'RAILS',
      signal_score: 61,
      labels: ['attention_spike', 'stock_token_spillover'],
      attention_source: 'Rail narrative',
      receipt_state: 'pool_required',
      note: 'Strong theme compression, incomplete proof.',
      source: seededDeskSource
    },
    {
      rank: 3,
      asset: 'Meme IPO Desk',
      ticker: 'IPO',
      signal_score: 54,
      labels: ['fresh_signal', 'stock_token_spillover'],
      attention_source: 'Launch-window language',
      receipt_state: 'contract_required',
      note: 'Useful proxy for IPO/access memes.',
      source: seededDeskSource
    },
    {
      rank: 4,
      asset: 'Ticker Memory',
      ticker: 'TICKR',
      signal_score: 49,
      labels: ['fresh_signal', 'attention_spike'],
      attention_source: 'Symbol abstraction',
      receipt_state: 'source_required',
      note: 'Pure attention object. Needs market proof.',
      source: seededDeskSource
    },
    {
      rank: 5,
      asset: 'Sherwood Loop',
      ticker: 'SHERW',
      signal_score: 32,
      labels: ['deployer_cluster_risk', 'liquidity_mirage', 'do_not_touch_yet'],
      attention_source: 'Brand-adjacent myth',
      receipt_state: 'risk_wall',
      note: 'Keep visible as a risk marker, not a promoted signal.',
      source: seededDeskSource
    }
  ],
  receipts: [
    {
      receipt_id: 'rh-chain-seed-2026-07-09',
      timestamp: OBSERVED_AT,
      source: 'Infopunks desk seed',
      source_metadata: seededDeskSource,
      summary: 'Created RH Chain Signal Desk scaffold with source-pending slots for volatile metrics and contract-dependent meme assets.',
      linked_assets: ['HOOD', 'RAILS', 'IPO', 'TICKR', 'SHERW'],
      caveat: 'Seed receipt only. It does not verify market cap, liquidity, volume, contracts, or official affiliation.'
    }
  ]
};

export function getRhChainPayload() {
  return rhChainPayload;
}

export function listRhChainMemes() {
  return rhChainPayload.meme_pulse;
}

export function listRhChainSignals() {
  return {
    classifier: rhChainPayload.signal_classifier,
    index_4663: rhChainPayload.signal_index_4663,
    risk_wall: rhChainPayload.risk_wall.map((item) => ({ ...item, freshness_state: getRhChainFreshnessState(item.source.observed_at, item.source.data_mode) }))
  };
}

export function listRhChainReceipts() {
  return rhChainPayload.receipts;
}

export function groupRhChainReviewItemsByState(items: RhChainReviewItem[] = rhChainReviewQueueItems): Record<RhChainReviewState, RhChainReviewItem[]> {
  const grouped = RH_CHAIN_REVIEW_STATES.reduce((acc, state) => {
    acc[state] = [];
    return acc;
  }, {} as Record<RhChainReviewState, RhChainReviewItem[]>);
  for (const item of items) grouped[item.review_state].push(item);
  return grouped;
}

export function getRhChainReviewStateCounts(items: RhChainReviewItem[] = rhChainReviewQueueItems): RhChainReviewQueueSummary {
  const grouped = groupRhChainReviewItemsByState(items);
  return {
    queued: grouped.queued_for_manual_review.length,
    under_receipt_check: grouped.under_receipt_check.length,
    approved_signals: grouped.approved_signal.length,
    do_not_touch_yet: grouped.do_not_touch_yet.length,
    rejected_low_receipt_quality: grouped.rejected_low_receipt_quality.length
  };
}

export function getRhChainReviewQueue(): RhChainReviewQueuePayload {
  const items = rhChainReviewQueueItems.map((item) => ({ ...item, freshness_state: getRhChainFreshnessState(item.updated_at || item.submitted_at, item.source.data_mode) }));
  return {
    generated_at: OBSERVED_AT,
    source_policy: 'Public review queue contains seeded and manual intelligence objects. Submitted packets are manually reviewed before public promotion.',
    disclaimer: 'The review queue is public intelligence infrastructure. It is not an endorsement, listing, partnership, or financial recommendation.',
    review_states: RH_CHAIN_REVIEW_STATES,
    counts: getRhChainReviewStateCounts(),
    items,
    grouped: groupRhChainReviewItemsByState(items)
  };
}

function clampScore(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function calculateRhChain4663SignalScore(components: RhChain4663ScoreComponents) {
  return clampScore(components.attention_score, 25)
    + clampScore(components.volume_score, 25)
    + clampScore(components.holder_score, 20)
    + clampScore(components.durability_score, 20)
    + clampScore(components.deployer_trust_score, 10);
}

export function classifyRhChain4663SignalScore(score: number): RhChain4663Classification {
  const normalized = clampScore(score, 100);
  if (normalized >= 80) return 'durable_signal';
  if (normalized >= 65) return 'strong_watch';
  if (normalized >= 50) return 'active_speculation';
  if (normalized >= 35) return 'high_risk_attention';
  return 'do_not_touch_yet';
}

export function buildRhChain4663Assets(seedAssets: RhChain4663SeedAsset[] = rhChain4663SeedAssets): RhChain4663Asset[] {
  return seedAssets
    .map((asset) => {
      const signalScore = calculateRhChain4663SignalScore(asset);
      const source = asset.source ?? (asset.ticker === 'ROUTE' ? manualDeskSource : seededDeskSource);
      return {
        ...asset,
        signal_score: signalScore,
        classification: classifyRhChain4663SignalScore(signalScore),
        source,
        freshness_state: getRhChainFreshnessState(asset.last_updated, source.data_mode)
      };
    })
    .sort((left, right) => right.signal_score - left.signal_score || left.ticker.localeCompare(right.ticker))
    .map((asset, index) => ({ ...asset, rank: index + 1 }));
}

function riskRank(state: RhChainRiskState) {
  const weights: Record<RhChainRiskState, number> = {
    do_not_touch_yet: 5,
    high_risk: 4,
    source_required: 3,
    medium_watch: 2,
    low_watch: 1
  };
  return weights[state];
}

export function getRhChain4663Overview(assets: RhChain4663Asset[]): RhChain4663IndexOverview {
  const topSignal = assets[0];
  const highestVolume = [...assets].sort((left, right) => right.volume_score - left.volume_score || right.signal_score - left.signal_score)[0];
  const highestRisk = [...assets].sort((left, right) => riskRank(right.risk_state) - riskRank(left.risk_state) || left.signal_score - right.signal_score)[0];
  const strongestDurability = [...assets].sort((left, right) => right.durability_score - left.durability_score || right.signal_score - left.signal_score)[0];
  const lastUpdated = assets.map((asset) => asset.last_updated).sort().at(-1) ?? OBSERVED_AT;
  return {
    top_signal: {
      ticker: topSignal.ticker,
      name: topSignal.name,
      signal_score: topSignal.signal_score,
      classification: topSignal.classification
    },
    highest_volume: {
      ticker: highestVolume.ticker,
      name: highestVolume.name,
      volume_score: highestVolume.volume_score,
      volume_24h: highestVolume.volume_24h
    },
    highest_risk: {
      ticker: highestRisk.ticker,
      name: highestRisk.name,
      risk_state: highestRisk.risk_state,
      infopunks_verdict: highestRisk.infopunks_verdict
    },
    strongest_durability: {
      ticker: strongestDurability.ticker,
      name: strongestDurability.name,
      durability_score: strongestDurability.durability_score,
      pool_age: strongestDurability.pool_age
    },
    last_updated: lastUpdated
  };
}

export function getRhChain4663Index(): RhChain4663IndexPayload {
  const assets = buildRhChain4663Assets();
  const last_updated = getRhChain4663Overview(assets).last_updated;
  return {
    name: '4663 Signal Index',
    subtitle: 'A living index of Robinhood Chain attention assets, risk states, and narrative mutations.',
    generated_at: OBSERVED_AT,
    last_updated,
    source_policy: '4663 values are seeded/manual intelligence until live receipts attach. Inclusion means public market memory, not safety.',
    disclaimer: 'The 4663 Signal Index is an intelligence index, not a tokenized product, endorsement, listing, or financial recommendation.',
    scoring_model: {
      total_score: 100,
      attention_score: 25,
      volume_score: 25,
      holder_score: 20,
      durability_score: 20,
      deployer_trust_score: 10
    },
    classification_thresholds: {
      durable_signal: '80-100',
      strong_watch: '65-79',
      active_speculation: '50-64',
      high_risk_attention: '35-49',
      do_not_touch_yet: '0-34'
    },
    narrative_classes: RH_CHAIN_4663_NARRATIVE_CLASSES,
    overview: getRhChain4663Overview(assets),
    assets,
    freshness_state: getRhChainFreshnessState(last_updated, assets[0]?.source.data_mode ?? 'unavailable')
  };
}

export function sortRhChainDailyReceiptsByDate(receipts: RhChainDailyReceipt[] = rhChainDailyReceipts): RhChainDailyReceipt[] {
  return [...receipts].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    if (byDate !== 0) return byDate;
    return right.generated_at.localeCompare(left.generated_at);
  });
}

/** Validates the minimum manual-provenance contract before a daily receipt enters desk memory. */
export function validateRhChainDailyReceipt(receipt: Partial<RhChainDailyReceipt>): RhChainDailyReceiptValidation {
  const required: Array<keyof RhChainDailyReceipt> = ['receipt_id', 'period', 'headline', 'top_signal', 'biggest_risk', 'strongest_narrative', 'infopunks_verdict', 'source_notes', 'observed_at', 'data_mode', 'confidence_level'];
  const errors = required.filter((field) => {
    const value = receipt[field];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  }).map((field) => `missing_${field}`);
  const sectionIds = new Set(receipt.receipt_sections?.map((section) => section.section_id) ?? []);
  for (const sectionId of RH_CHAIN_DAILY_RECEIPT_SECTION_IDS) if (!sectionIds.has(sectionId)) errors.push(`missing_section_${sectionId}`);
  return { valid: errors.length === 0, errors };
}

/** Authoring helper: rejects incomplete receipts before they can be added to public memory. */
export function createRhChainDailyReceipt(input: RhChainDailyReceiptAuthoringInput): RhChainDailyReceipt {
  const validation = validateRhChainDailyReceipt(input);
  if (!validation.valid) throw new Error(`invalid_rh_chain_daily_receipt:${validation.errors.join(',')}`);
  return structuredClone(input);
}

export function selectLatestRhChainDailyReceipt(receipts: RhChainDailyReceipt[] = rhChainDailyReceipts): RhChainDailyReceipt | null {
  return sortRhChainDailyReceiptsByDate(receipts)[0] ?? null;
}

export function getRhChainDailyReceipt(receiptId: string, receipts: RhChainDailyReceipt[] = rhChainDailyReceipts): RhChainDailyReceipt | null {
  return receipts.find((receipt) => receipt.receipt_id === receiptId) ?? null;
}

export function rhChainDailyReceiptRoute(receiptId: string, receipts: RhChainDailyReceipt[] = rhChainDailyReceipts): string | null {
  return getRhChainDailyReceipt(receiptId, receipts) ? `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receiptId)}` : null;
}

export function rhChainDailyReceiptShareCardRoute(receiptId: string): string {
  return `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receiptId)}/card`;
}

export function createRhChainDailyReceiptXPost(receipt: RhChainDailyReceipt): string {
  return [
    `Infopunks RH Chain Daily Receipt · ${receipt.period ?? receipt.date}`,
    '', receipt.headline, '', `Top signal: ${receipt.top_signal}`, `Biggest risk: ${receipt.biggest_risk}`,
    `Strongest narrative: ${receipt.strongest_narrative}`, `Infopunks verdict: ${receipt.infopunks_verdict}`,
    '', 'No receipt, no signal.', '', 'Public intelligence, not endorsement or financial advice.'
  ].join('\n');
}

export function getRhChainDailyReceipts(): RhChainDailyReceiptsPayload {
  const receipts = sortRhChainDailyReceiptsByDate().map((receipt) => ({ ...receipt, freshness_state: getRhChainFreshnessState(receipt.observed_at ?? receipt.generated_at, receipt.data_mode) }));
  const latest = selectLatestRhChainDailyReceipt(receipts)!;
  return {
    title: 'Daily RH Chain Receipts',
    subtitle: 'The market forgets. Infopunks keeps the memory.',
    generated_at: latest.generated_at,
    source_policy: 'Daily receipts are human-reviewed market memory. External data gives context; Infopunks gives judgment; receipts create memory. Do not let live data outrank human-reviewed receipts. Sources must include observed_at timestamps.',
    doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
    disclaimer: 'Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.',
    latest_receipt: latest,
    receipts,
    freshness_state: latest.freshness_state
  };
}

export function getRhChainLaunchSurfaces() {
  const source = createRhChainSource({ source_name: 'Infopunks Launch Surface Watch manual registry', source_url: 'https://radar.infopunks.fun/rh-chain-signal-desk/launch-surfaces', observed_at: '2026-07-15T00:00:00.000Z', data_mode: 'manual', confidence_level: 'medium', note: 'Manual launch-surface taxonomy for evidence review. NOXA disruption and competitor claims are source-dependent unless primary, timestamped evidence is attached. Inclusion does not verify a token, platform claim, or imply safety.' });
  const records: RhChainLaunchSurfaceRecord[] = [
    { id: 'noxa_fun', name: 'NOXA Fun', source_type: 'launchpad', description: 'Reported launchpad disruption is tracked as manual, source-dependent context; verify contract, creator, route, and current availability independently.', risk_note: 'Front-end dependency and launchpad labels can create fragile or spoofable access assumptions. No misconduct claim is made.', launch_surface_status: 'degraded', surface_risk: 'front_end_dependency' },
    { id: 'flap_sh', name: 'flap.sh', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Potential rival-surface rotation is not market-share proof.', launch_surface_status: 'source_required', surface_risk: 'rival_surface_rotation' },
    { id: 'trensh_today', name: 'trensh.today', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Potential rival-surface rotation is not market-share proof.', launch_surface_status: 'source_required', surface_risk: 'rival_surface_rotation' },
    { id: 'bankr', name: 'bankr', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Creator-fee and launch-quality claims require independent receipts.', launch_surface_status: 'source_required', surface_risk: 'creator_fee_claim_uncertainty' },
    { id: 'tokeny_fun', name: 'tokeny.fun', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Potential rival-surface rotation is not market-share proof.', launch_surface_status: 'source_required', surface_risk: 'rival_surface_rotation' },
    { id: 'vlad_fun', name: 'vlad.fun', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Clone and copycat launch patterns require contract-level review.', launch_surface_status: 'source_required', surface_risk: 'clone_flood' },
    { id: 'robindotmarket', name: 'robindotmarket', source_type: 'launchpad', description: 'Rival launch-surface claim tracked as context only until a primary source and exact launch evidence are attached.', risk_note: 'Potential rival-surface rotation is not market-share proof.', launch_surface_status: 'source_required', surface_risk: 'rival_surface_rotation' },
    { id: '20lab_erc20', name: '20lab-generated ERC-20', source_type: 'token_generator', description: 'Generator-origin claim; inspect bytecode, ownership, and deployer history.', risk_note: 'Template similarity is not proof of intent or safety.', launch_surface_status: 'source_required', surface_risk: 'launch_quality_filtering' },
    { id: 'pump_fun_routed_rh_chain', name: 'Pump.fun-routed RH Chain token', source_type: 'routed_launchpad', description: 'Routed-launch claim; verify the actual route and destination pair.', risk_note: 'Cross-surface branding and route screenshots can be misleading.', launch_surface_status: 'source_required', surface_risk: 'rival_surface_rotation' },
    { id: 'uniswap_direct_pool', name: 'Uniswap direct pool launch', source_type: 'direct_dex_pool', description: 'Direct pool claim; verify pair, reserves, and LP state.', risk_note: 'A pool does not establish trustworthy liquidity or exit depth.', launch_surface_status: 'active', surface_risk: 'launch_quality_filtering' },
    { id: 'hardhat_foundry_custom', name: 'Hardhat/Foundry custom deployment', source_type: 'custom_deployment', description: 'Custom-deployment claim; verify deployer, bytecode, and ownership controls.', risk_note: 'Custom code increases the need for independent review.', launch_surface_status: 'source_required', surface_risk: 'unknown' },
    { id: 'unknown_manual', name: 'Unknown/manual deployment', source_type: 'unknown_manual', description: 'No reliable launch surface is attached yet.', risk_note: 'Unknown origin is a review state, not a neutral safety signal.', launch_surface_status: 'source_required', surface_risk: 'unknown' }
  ].map((record) => ({ ...record, source } as RhChainLaunchSurfaceRecord));
  const access_surfaces: RhChainAccessSurface[] = [
    ['Robinhood Wallet', 'wallet', 'https://robinhood.com/wallet', 'verified_source', 'Official wallet surface is access context only; wallet availability does not verify any token, route, or integration.', 'Wallet surface tracked as a distribution-layer observation.'],
    ['LI.FI-powered swaps/bridges', 'swap_router', 'https://li.fi', 'verified_source', 'Router and bridge availability are not a safety, route-quality, or asset-legitimacy determination.', 'Swap and bridge access is tracked as an access-layer signal, not a trading flow.'],
    ['Uniswap app', 'dex_app', 'https://app.uniswap.org', 'verified_source', 'A DEX app surface does not verify a token, pool, liquidity depth, or exit reliability.', 'App availability is context only; exact pair evidence is required for a dossier link.'],
    ['Pump.fun routed RH Chain trading', 'launch_app', 'https://pump.fun', 'community_claim', 'Routed-trading claims require exact route, destination pair, and timestamp verification.', 'Tracked as a community-described launch/access surface; no routing flow is offered here.'],
    ['Backpack Wallet', 'wallet', null, 'source_required', 'Native RH Chain support claim is source_required until a primary Backpack source is attached.', 'Unverified wallet-access claim retained as context only.'],
    ['Unknown/manual access claim', 'unknown', null, 'unavailable', 'Unknown access claims are not neutral. Do not infer support, legitimacy, or safety.', 'Manual review state for claims without a primary source.']
  ].map(([access_surface_name, access_surface_type, source_url, source_status, risk_notes, integration_notes]) => ({ access_surface_name: String(access_surface_name), access_surface_type: access_surface_type as RhChainAccessSurfaceType, source_url, source_status: source_status as RhChainAccessSurfaceSourceStatus, observed_at: source.observed_at, updated_at: source.updated_at, data_mode: 'manual' as const, confidence_level: source_status === 'verified_source' ? 'medium' as const : 'low' as const, risk_notes: String(risk_notes), integration_notes: String(integration_notes) }));
  return { title: 'Launch Surface Watch', subtitle: 'Infopunks does not launch the token. Infopunks remembers the launch.', generated_at: source.observed_at, data_mode: 'manual' as const, source_policy: 'Launch and access context are evidence-led and source-dependent. Submitter claims remain unverified until human review. Access does not equal legitimacy.', disclaimer: 'Launch Surface Watch and Access Surface Watch are public intelligence, not endorsement, safety verification, financial advice, or an official Robinhood partnership.', doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.', launch_surfaces: records, access_surfaces, surfaces: records };
}

function compactOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function submissionId(ticker: string, submittedAt: string) {
  const safeTicker = ticker.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signal';
  const stamp = submittedAt.replace(/[^0-9]/g, '').slice(0, 14);
  return `rh-chain-${safeTicker}-${stamp}`;
}

export function createRhChainSignalReviewPacket(input: RhChainSignalSubmissionInput, submittedAt = new Date().toISOString()): RhChainSignalReviewPacket {
  const ticker = input.ticker.trim().toUpperCase();
  const chain = input.chain?.trim() || 'Robinhood Chain';
  return {
    submission_id: submissionId(ticker, submittedAt),
    submitted_at: submittedAt,
    token_contract: input.token_contract.trim(),
    ticker,
    chain,
    links: {
      x_twitter: compactOptional(input.x_twitter_link),
      website: compactOptional(input.website_link),
      liquidity: compactOptional(input.liquidity_link)
    },
    deployer_notes: compactOptional(input.deployer_notes),
    submitter_notes: compactOptional(input.submitter_notes),
    disclosure_confirmed: input.disclosure_confirmed,
    review_status: 'queued_for_manual_review',
    next_step: 'Infopunks will review the signal manually before adding it to the public desk.'
  };
}
import { getRhChainFreshnessState } from '../services/rhChainTruthGuards';
