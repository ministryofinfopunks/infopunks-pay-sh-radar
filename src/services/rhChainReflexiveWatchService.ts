import { createHash } from 'node:crypto';
import { REFLEXIVE_METHOD_VERSION, stableId, type ReflexiveSnapshot } from './rhChainReflexiveRadarService';

export const REFLEXIVE_WATCH_METHOD_VERSION = 'reflexive-markets-watch-v0.1';
export const RWA_ACTIVATION_MODEL_VERSION = 'RWA_ACTIVATION_MODEL_VERSION_PREPARED_NOT_ACTIVE_V0';

export const SOURCE_TYPES = ['PROTOCOL_REPORTED', 'MEDIA_REPORTED', 'THIRD_PARTY_RESEARCH', 'MARKET_INDEXER', 'SOCIAL_CLAIM', 'RADAR_DISCOVERY', 'OTHER'] as const;
export const WATCH_VERDICTS = ['CONFIRMS', 'FALSIFIES', 'MIXED', 'INSUFFICIENT_DATA'] as const;
export const CASE_STATES = ['DISCOVERED', 'TRIAGED', 'RADAR_CANDIDATE', 'VERIFYING', 'PARTIALLY_VERIFIED', 'VERIFIED', 'MIXED', 'FALSIFIED', 'NOT_REPRODUCIBLE', 'INSUFFICIENT_DATA', 'ARCHIVED'] as const;
export const DIMENSION_STATES = ['CONFIRMED', 'SUPPORTING_EVIDENCE', 'MIXED', 'FALSIFYING_EVIDENCE', 'UNVERIFIED', 'UNAVAILABLE'] as const;
export const ACTIVATION_DIMENSIONS = ['ATTENTION', 'STOCK_TOKEN_INVENTORY', 'CAPITAL_PERSISTENCE', 'FLOW_PERSISTENCE', 'QUOTE_PERSISTENCE', 'SUPPLY_RESPONSE_SEQUENCE', 'BASIS_BEHAVIOR', 'FEE_ACTIVITY', 'TREASURY_OR_VAULT_ACCUMULATION', 'ROUTE_EXPANSION', 'SURVIVAL'] as const;

export type ReflexiveWatchSourceType = typeof SOURCE_TYPES[number];
export type ReflexiveWatchVerdict = typeof WATCH_VERDICTS[number];
export type RwaActivationCaseState = typeof CASE_STATES[number];
export type ActivationDimension = typeof ACTIVATION_DIMENSIONS[number];
export type ActivationDimensionState = typeof DIMENSION_STATES[number];
export type AuditPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type EvidenceStatus = 'WATCH_ONLY' | 'RADAR_AUDIT_TARGET' | 'RADAR_VERIFIED' | 'RADAR_PARTIAL' | 'RADAR_UNVERIFIED' | 'CONTRADICTED' | 'NOT_COMPARABLE' | 'HISTORICAL_STATE_UNAVAILABLE';
export type ClaimCategory = 'MATERIAL_STOCK_TOKEN_SHARE' | 'FLOAT_STRESS' | 'QUOTE_PERSISTENCE' | 'STOCK_AS_MONEY' | 'DERIVATIVE_EQUITY_TOKEN' | 'SUPPLY_RESPONSE' | 'ATTENTION_EVENT' | 'OTHER';
export type AuditTargetResult = 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'CONTRADICTED' | 'NOT_COMPARABLE' | 'HISTORICAL_STATE_UNAVAILABLE' | 'UNRESOLVED';
export type ActivityClassification = 'SPECULATIVE_ACTIVITY' | 'RWA_ACTIVATION_EVIDENCE' | 'STRONGER_ACTIVATION_EVIDENCE' | 'FALSIFYING_PERSISTENCE_EVIDENCE';
export type ThesisBoardState = 'SUPPORTING' | 'OBSERVING' | 'MIXED' | 'INSUFFICIENT' | 'OBSERVATIONAL' | 'EARLY_SUPPORTING_EVIDENCE' | 'CONFIRMED';

export type ReflexiveWatchClaimInput = {
  captured_at: string;
  source_type: ReflexiveWatchSourceType;
  source_url?: string | null;
  source_reference?: string | null;
  source_name: string;
  claim_text: string;
  subject_assets: string[];
  mission_token: string | null;
  stock_token_or_rwa: string | null;
  venue: string | null;
  pool_identifiers: string[];
  observation_window: string | null;
  claimed_metrics: Record<string, string>;
  claimed_timestamp: string | null;
  claim_category: ClaimCategory;
  provisional_interpretation: string;
  watch_verdict: ReflexiveWatchVerdict;
  evidence_status: EvidenceStatus;
  methodology_version?: string;
};

export type ReflexiveWatchClaim = ReflexiveWatchClaimInput & {
  object_type: 'REFLEXIVE_WATCH_CLAIM';
  claim_id: string;
  watch_verdict_type: 'WATCH_INTERPRETATION';
  immutable: true;
};

export type RadarAuditTarget = {
  object_type: 'RADAR_AUDIT_TARGET';
  target_id: string;
  claim_id: string;
  case_id: string;
  exact_claim: string;
  confirm_criteria: string[];
  falsify_criteria: string[];
  required_onchain_objects: string[];
  time_alignment_required: string[];
  missing_data: string[];
  potential_results: AuditTargetResult[];
  current_result: AuditTargetResult;
  created_at: string;
  methodology_version: string;
  immutable: true;
};

export type WatchResearchRecord = {
  object_type: 'WATCH_RESEARCH_RECORD' | 'RADAR_AUDIT_TARGET_RECORD';
  record_id: string;
  case_id: string;
  claim_id?: string;
  summary: string;
  created_at: string;
  methodology_version: string;
  not_protocol_receipt: true;
  immutable: true;
};

export type RadarEvidenceLink = {
  evidence_id: string;
  label: string;
  href: string;
  status: EvidenceStatus;
  radar_state: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';
  note: string;
};

export type PersistenceObservation = {
  checkpoint: 'T0' | 'D1' | 'D3' | 'D7' | 'D30';
  state: 'OBSERVED' | 'PENDING' | 'MISSED' | 'UNAVAILABLE';
  observed_at: string | null;
  stock_token_footprint_delta: string | null;
  capital_share_delta: string | null;
  flow_share_delta: string | null;
  supply_delta: string | null;
  basis_context: string | null;
  survival_state: string;
};

export type RwaActivationCase = {
  object_type: 'RWA_ACTIVATION_CASE';
  case_id: string;
  title: string;
  mission_assets: string[];
  rwa_or_stock_token: string[];
  venues: string[];
  opening_hypothesis: string;
  opened_at: string;
  watch_claims: string[];
  radar_evidence: RadarEvidenceLink[];
  persistence_observations: PersistenceObservation[];
  activation_dimensions: Record<ActivationDimension, ActivationDimensionState>;
  current_evidence_state: RwaActivationCaseState;
  open_evidence_gaps: string[];
  candidate_next_audit: string;
  audit_priority: AuditPriority;
  priority_rationale: string[];
  activity_classification: ActivityClassification;
  state_transitions: Array<{ from: RwaActivationCaseState | null; to: RwaActivationCaseState; transitioned_at: string; reason: string }>;
  thesis_mapping: Array<'H2A' | 'H2B' | 'H2C' | 'H2D' | 'H7' | 'RA1'>;
  falsification_notes: string[];
  updated_at: string;
  methodology_version: string;
  immutable: true;
};

export type ReflexiveWatchFeedItem = {
  case_id: string;
  case_title: string;
  watch_interpretation: ReflexiveWatchVerdict;
  evidence_status: EvidenceStatus;
  radar_state: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';
  key_claim: string;
  why_it_matters: string;
  last_updated: string;
  next_proof_needed: string;
};

export type ThesisBoardEntry = {
  hypothesis_id: 'H2A' | 'H2B' | 'H2C' | 'H2D' | 'H7' | 'RA1';
  state: ThesisBoardState;
  rationale: string;
  case_ids: string[];
  watch_claims_can_upgrade: false;
};

export type ReflexiveMarketsWatchSnapshot = {
  object_type: 'REFLEXIVE_MARKETS_WATCH';
  doctrine: string[];
  model_version: string;
  source_types: readonly ReflexiveWatchSourceType[];
  watch_verdicts: readonly ReflexiveWatchVerdict[];
  cases: RwaActivationCase[];
  claims: ReflexiveWatchClaim[];
  audit_targets: RadarAuditTarget[];
  research_records: WatchResearchRecord[];
  feed: ReflexiveWatchFeedItem[];
  falsification_queue: RwaActivationCase[];
  thesis_board: ThesisBoardEntry[];
  casebook: {
    confirming_cases: RwaActivationCase[];
    mixed_cases: RwaActivationCase[];
    falsification_cases: RwaActivationCase[];
    unverified_cases: RwaActivationCase[];
  };
  generated_at: string;
  methodology_version: string;
};

export class ReflexiveWatchError extends Error {
  constructor(readonly code: 'duplicate_watch_claim' | 'watch_claim_not_found' | 'watch_case_not_found' | 'invalid_transition') { super(code); }
}

export class InMemoryReflexiveWatchStore {
  private claims: ReflexiveWatchClaim[] = seedWatchClaims();
  private targets: RadarAuditTarget[] = seedAuditTargets(this.claims);
  async listClaims() { return structuredClone(this.claims); }
  async appendClaim(claim: ReflexiveWatchClaim) { if (this.claims.some((item) => item.claim_id === claim.claim_id)) throw new ReflexiveWatchError('duplicate_watch_claim'); this.claims = [...this.claims, claim]; return structuredClone(claim); }
  async listTargets() { return structuredClone(this.targets); }
  async appendTarget(target: RadarAuditTarget) { if (!this.targets.some((item) => item.target_id === target.target_id)) this.targets = [...this.targets, target]; return structuredClone(target); }
}

export class ReflexiveMarketsWatchService {
  constructor(private readonly snapshotReader: () => Promise<ReflexiveSnapshot>, private readonly store = new InMemoryReflexiveWatchStore(), private readonly now = () => new Date()) {}
  async snapshot(): Promise<ReflexiveMarketsWatchSnapshot> {
    const [radar, claims, auditTargets] = await Promise.all([this.snapshotReader(), this.store.listClaims(), this.store.listTargets()]);
    const cases = buildSeedCases(radar, claims);
    const feed = cases.map((rwaCase) => feedItem(rwaCase, claims));
    return deepFreeze({
      object_type: 'REFLEXIVE_MARKETS_WATCH',
      doctrine: ['WATCH_DISCOVERS', 'RADAR_VERIFIES', 'MEMORY_DECIDES_WHETHER_IT_LASTED', 'PREFLIGHT_DECIDES_WHETHER_WE_SHOULD_TRY_IT', 'A_CLAIM_IS_CHEAP', 'EVIDENCE_IS_THE_PRODUCT'],
      model_version: RWA_ACTIVATION_MODEL_VERSION,
      source_types: SOURCE_TYPES,
      watch_verdicts: WATCH_VERDICTS,
      cases,
      claims,
      audit_targets: auditTargets,
      research_records: auditTargets.map((target) => auditTargetRecord(target)),
      feed,
      falsification_queue: cases.filter((item) => item.falsification_notes.length || Object.values(item.activation_dimensions).includes('FALSIFYING_EVIDENCE')),
      thesis_board: thesisBoard(cases),
      casebook: {
        confirming_cases: cases.filter((item) => item.current_evidence_state === 'VERIFIED' || item.current_evidence_state === 'PARTIALLY_VERIFIED'),
        mixed_cases: cases.filter((item) => item.current_evidence_state === 'MIXED'),
        falsification_cases: cases.filter((item) => item.falsification_notes.length || item.current_evidence_state === 'FALSIFIED'),
        unverified_cases: cases.filter((item) => ['DISCOVERED', 'TRIAGED', 'RADAR_CANDIDATE', 'VERIFYING', 'UNVERIFIED', 'INSUFFICIENT_DATA', 'NOT_REPRODUCIBLE'].includes(item.current_evidence_state))
      },
      generated_at: this.now().toISOString(),
      methodology_version: REFLEXIVE_WATCH_METHOD_VERSION
    });
  }
  async case(caseId: string) { return (await this.snapshot()).cases.find((item) => item.case_id === caseId) ?? null; }
  async claims() { return (await this.snapshot()).claims; }
  async createClaim(input: ReflexiveWatchClaimInput) {
    const current = await this.store.listClaims();
    const claim = createWatchClaim(input);
    if (current.some((item) => claimFingerprint(item) === claimFingerprint(claim))) throw new ReflexiveWatchError('duplicate_watch_claim');
    return this.store.appendClaim(claim);
  }
  async promoteClaim(input: { claim_id: string; case_id: string; confirm_criteria: string[]; falsify_criteria: string[]; required_onchain_objects: string[]; time_alignment_required: string[]; missing_data: string[] }) {
    const claims = await this.store.listClaims();
    const claim = claims.find((item) => item.claim_id === input.claim_id);
    if (!claim) throw new ReflexiveWatchError('watch_claim_not_found');
    const target = createAuditTarget({ ...input, claim_text: claim.claim_text, now: this.now().toISOString() });
    return this.store.appendTarget(target);
  }
}

export function createWatchClaim(input: ReflexiveWatchClaimInput): ReflexiveWatchClaim {
  const methodology = input.methodology_version ?? REFLEXIVE_WATCH_METHOD_VERSION;
  const normalized: ReflexiveWatchClaimInput = { ...input, methodology_version: methodology, source_url: input.source_url ?? null, source_reference: input.source_reference ?? null };
  return deepFreeze({ object_type: 'REFLEXIVE_WATCH_CLAIM', claim_id: stableId('watch-claim', claimFingerprint(normalized)), watch_verdict_type: 'WATCH_INTERPRETATION', immutable: true, ...normalized });
}

export function createAuditTarget(input: { claim_id: string; case_id: string; claim_text: string; confirm_criteria: string[]; falsify_criteria: string[]; required_onchain_objects: string[]; time_alignment_required: string[]; missing_data: string[]; now: string }): RadarAuditTarget {
  return deepFreeze({
    object_type: 'RADAR_AUDIT_TARGET',
    target_id: stableId('radar-audit-target', input.case_id, input.claim_id, input.confirm_criteria.join('|'), input.falsify_criteria.join('|')),
    claim_id: input.claim_id,
    case_id: input.case_id,
    exact_claim: input.claim_text,
    confirm_criteria: input.confirm_criteria,
    falsify_criteria: input.falsify_criteria,
    required_onchain_objects: input.required_onchain_objects,
    time_alignment_required: input.time_alignment_required,
    missing_data: input.missing_data,
    potential_results: ['CONFIRMED', 'PARTIALLY_CONFIRMED', 'CONTRADICTED', 'NOT_COMPARABLE', 'HISTORICAL_STATE_UNAVAILABLE'],
    current_result: 'UNRESOLVED',
    created_at: input.now,
    methodology_version: REFLEXIVE_WATCH_METHOD_VERSION,
    immutable: true
  });
}

export function transitionCaseState(current: RwaActivationCase, to: RwaActivationCaseState, at: string, reason: string): RwaActivationCase {
  if (current.current_evidence_state === 'ARCHIVED' && to !== 'ARCHIVED') throw new ReflexiveWatchError('invalid_transition');
  return deepFreeze({ ...current, current_evidence_state: to, updated_at: at, state_transitions: [...current.state_transitions, { from: current.current_evidence_state, to, transitioned_at: at, reason }] });
}

export function compareHistoricalClaimToRadarWindow(claim: ReflexiveWatchClaim, radarObservedAt: string | null, historicalStateAvailable: boolean): AuditTargetResult {
  if (!claim.claimed_timestamp || !radarObservedAt) return 'NOT_COMPARABLE';
  if (Date.parse(claim.claimed_timestamp) !== Date.parse(radarObservedAt) && !historicalStateAvailable) return 'HISTORICAL_STATE_UNAVAILABLE';
  if (Math.abs(Date.parse(claim.claimed_timestamp) - Date.parse(radarObservedAt)) > 120_000) return 'NOT_COMPARABLE';
  return 'UNRESOLVED';
}

export function classifyActivationEvidence(dimensions: Record<ActivationDimension, ActivationDimensionState>): ActivityClassification {
  if (dimensions.SURVIVAL === 'FALSIFYING_EVIDENCE' || dimensions.STOCK_TOKEN_INVENTORY === 'FALSIFYING_EVIDENCE') return 'FALSIFYING_PERSISTENCE_EVIDENCE';
  if (dimensions.STOCK_TOKEN_INVENTORY === 'CONFIRMED' && dimensions.FEE_ACTIVITY === 'SUPPORTING_EVIDENCE' && dimensions.SUPPLY_RESPONSE_SEQUENCE === 'SUPPORTING_EVIDENCE') return 'STRONGER_ACTIVATION_EVIDENCE';
  if (dimensions.STOCK_TOKEN_INVENTORY === 'CONFIRMED' && ['SUPPORTING_EVIDENCE', 'CONFIRMED'].includes(dimensions.CAPITAL_PERSISTENCE)) return 'RWA_ACTIVATION_EVIDENCE';
  return 'SPECULATIVE_ACTIVITY';
}

export function deterministicAuditPriority(input: { material_stock_share_claim: boolean; new_architecture: boolean; strong_falsification_potential: boolean; cross_market_significance: boolean; historical_data_urgency: boolean; existing_radar_adapter: boolean }): AuditPriority {
  const score = Object.values(input).filter(Boolean).length;
  return score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';
}

function buildSeedCases(radar: ReflexiveSnapshot, claims: ReflexiveWatchClaim[]): RwaActivationCase[] {
  const byCategory = (category: ClaimCategory) => claims.filter((item) => item.claim_category === category).map((item) => item.claim_id);
  const aiClaimIds = claims.filter((item) => item.mission_token === 'AI' || item.subject_assets.includes('NVDA')).map((item) => item.claim_id);
  const aiEvidence = aiRadarEvidence(radar);
  const aiDimensions = dimensions({ ATTENTION: 'SUPPORTING_EVIDENCE', STOCK_TOKEN_INVENTORY: aiEvidence.some((item) => item.radar_state === 'VERIFIED') ? 'CONFIRMED' : 'SUPPORTING_EVIDENCE', CAPITAL_PERSISTENCE: 'SUPPORTING_EVIDENCE', FLOW_PERSISTENCE: 'MIXED', QUOTE_PERSISTENCE: 'MIXED', SUPPLY_RESPONSE_SEQUENCE: radar.supply_events.some((item) => item.asset_id === radar.assets.find((asset) => asset.ticker === 'NVDA')?.asset_id) ? 'SUPPORTING_EVIDENCE' : 'UNVERIFIED', BASIS_BEHAVIOR: 'UNAVAILABLE', FEE_ACTIVITY: 'UNVERIFIED', TREASURY_OR_VAULT_ACCUMULATION: 'UNAVAILABLE', ROUTE_EXPANSION: 'SUPPORTING_EVIDENCE', SURVIVAL: 'SUPPORTING_EVIDENCE' });
  return [
    rwaCase({ case_id: 'AI_NVDA_CAPITAL_VS_FLOW', title: 'AI / NVDA Capital vs Flow', mission_assets: ['AI'], rwa_or_stock_token: ['NVDA'], venues: ['LONG', 'Doppler', 'PAIR', 'Uniswap v4'], opening_hypothesis: 'Crypto-native AI market activity coincided with material canonical NVDA Stock Token usage, but capital, flow and attribution must remain separate.', opened_at: '2026-09-01T00:00:00.000Z', watch_claims: aiClaimIds, radar_evidence: aiEvidence, persistence_observations: persistenceFromRadar(radar), activation_dimensions: aiDimensions, current_evidence_state: 'MIXED', open_evidence_gaps: ['Community vault identity unavailable.', 'External liquidity is possible but not included in verified footprint.', 'Synchronized underlying/NVDA basis remains unavailable.', 'D7-D14 minimum READY shadow evidence window is separate and still controls v0.5.2.'], candidate_next_audit: 'Re-run AI/NVDA at D7 with same-block launch-position inventory, totalSupply and quote topology.', priority: deterministicAuditPriority({ material_stock_share_claim: true, new_architecture: false, strong_falsification_potential: true, cross_market_significance: true, historical_data_urgency: false, existing_radar_adapter: true }), activity_classification: classifyActivationEvidence(aiDimensions), thesis_mapping: ['H2A', 'H2B', 'H2C', 'H2D', 'H7', 'RA1'], falsification_notes: ['Stock quote flow persistence is mixed and can challenge stock quote execution dominance.'] }),
    rwaCase({ case_id: 'BONER_HIMS_FLOAT_STRESS', title: 'BONER / HIMS Float Stress', mission_assets: ['BONER'], rwa_or_stock_token: ['HIMS'], venues: ['PAIR', 'Uniswap v4'], opening_hypothesis: 'Historical reporting of an 81% HIMS Stock Token share is an audit target, not reproducible present evidence.', opened_at: '2026-09-01T00:00:00.000Z', watch_claims: byCategory('FLOAT_STRESS'), radar_evidence: [], persistence_observations: unavailablePersistence(), activation_dimensions: dimensions({ ATTENTION: 'SUPPORTING_EVIDENCE', STOCK_TOKEN_INVENTORY: 'UNVERIFIED', CAPITAL_PERSISTENCE: 'UNVERIFIED', FLOW_PERSISTENCE: 'UNVERIFIED', QUOTE_PERSISTENCE: 'UNVERIFIED', SUPPLY_RESPONSE_SEQUENCE: 'UNAVAILABLE', BASIS_BEHAVIOR: 'UNAVAILABLE', FEE_ACTIVITY: 'UNVERIFIED', TREASURY_OR_VAULT_ACCUMULATION: 'UNAVAILABLE', ROUTE_EXPANSION: 'UNVERIFIED', SURVIVAL: 'UNVERIFIED' }), current_evidence_state: 'NOT_REPRODUCIBLE', open_evidence_gaps: ['Historical pool state and exact same-timestamp HIMS totalSupply are unavailable.', 'Do not compare historical 81% reporting to current HIMS supply.'], candidate_next_audit: 'Attempt archive-capability proof for exact HIMS pool and historical totalSupply block.', priority: 'HIGH', activity_classification: 'SPECULATIVE_ACTIVITY', thesis_mapping: ['H2A', 'H2B', 'H7', 'RA1'], falsification_notes: ['Historical-data mismatch can falsify any current-state comparison.'] }),
    shellCase('MOO_MU_QUOTE_PERSISTENCE', 'MOO / MU Quote Persistence', ['MOO'], ['MU'], 'PAIR', 'Quote persistence requires exact pool and lifecycle observations.', byCategory('QUOTE_PERSISTENCE')),
    shellCase('SPACEHOOD_SPCX', 'SPACEHOOD / SPCX', ['SPACEHOOD'], ['SPCX'], 'PAIR', 'SPCX activation is discovery context until canonical Stock Token inventory is reconstructed.', []),
    shellCase('PLTR_AS_MONEY', 'PLTR Stock-as-Money', ['PLTR'], ['PLTR'], 'Uniswap v4', 'PLTR has a separate Observation Mode and preflight evidence stream; Watch must not alter it.', byCategory('STOCK_AS_MONEY')),
    rwaCase({ case_id: 'LONGX_NVDA3L', title: 'LONGX NVDAx3L', mission_assets: ['LONGX'], rwa_or_stock_token: ['NVDAx3L'], venues: ['LONG', 'Doppler'], opening_hypothesis: 'Derivative equity tokens need a new Radar accounting adapter before NAV, mint/redeem or fee routing claims can be verified.', opened_at: '2026-09-01T00:00:00.000Z', watch_claims: byCategory('DERIVATIVE_EQUITY_TOKEN'), radar_evidence: [], persistence_observations: unavailablePersistence(), activation_dimensions: dimensions({ ATTENTION: 'SUPPORTING_EVIDENCE', STOCK_TOKEN_INVENTORY: 'UNAVAILABLE', CAPITAL_PERSISTENCE: 'UNVERIFIED', FLOW_PERSISTENCE: 'UNVERIFIED', QUOTE_PERSISTENCE: 'UNVERIFIED', SUPPLY_RESPONSE_SEQUENCE: 'UNAVAILABLE', BASIS_BEHAVIOR: 'UNAVAILABLE', FEE_ACTIVITY: 'UNVERIFIED', TREASURY_OR_VAULT_ACCUMULATION: 'UNAVAILABLE', ROUTE_EXPANSION: 'SUPPORTING_EVIDENCE', SURVIVAL: 'UNVERIFIED' }), current_evidence_state: 'RADAR_CANDIDATE', open_evidence_gaps: ['No LongX accounting adapter.', 'NAV mint/redeem mechanics unverified.', 'Fee routing unverified.'], candidate_next_audit: 'Build derivative-equity-token adapter requirements; do not implement accounting in v0.1.', priority: 'MEDIUM', activity_classification: 'SPECULATIVE_ACTIVITY', thesis_mapping: ['RA1'], falsification_notes: [] })
  ];
}

function aiRadarEvidence(radar: ReflexiveSnapshot): RadarEvidenceLink[] {
  const hasInventory = radar.long_inventory_history.some((item) => item.inventory_status === 'AVAILABLE');
  const hasFootprint = radar.mission_stock_footprints.some((item) => item.status === 'AVAILABLE' || item.status === 'PARTIAL');
  const hasQuote = radar.quote_persistence.length > 0;
  return [
    { evidence_id: 'radar:long-ai-nvda', label: 'LONG / Doppler AI-NVDA audit', href: '/v1/4663/reflexive/audits/long-ai-nvda', status: hasInventory ? 'RADAR_VERIFIED' : 'RADAR_PARTIAL', radar_state: hasInventory ? 'VERIFIED' : 'PARTIAL', note: 'Canonical launch-position accounting only; claim figures are not imported.' },
    { evidence_id: 'radar:ai-nvda-footprint', label: 'AI NVDA mission Stock Token footprint', href: '/v1/4663/reflexive/audits/long-ai-nvda', status: hasFootprint ? 'RADAR_PARTIAL' : 'RADAR_UNVERIFIED', radar_state: hasFootprint ? 'PARTIAL' : 'UNVERIFIED', note: 'External liquidity and community vault remain separate or unavailable.' },
    { evidence_id: 'radar:ai-capital-flow', label: 'Capital vs Flow / Quote Persistence', href: '/v1/4663/reflexive/audits/long-ai-nvda', status: hasQuote ? 'RADAR_PARTIAL' : 'RADAR_UNVERIFIED', radar_state: hasQuote ? 'PARTIAL' : 'UNVERIFIED', note: 'Liquidity and flow are not collapsed into one dominance claim.' }
  ];
}

function persistenceFromRadar(radar: ReflexiveSnapshot): PersistenceObservation[] {
  const checkpoints: PersistenceObservation['checkpoint'][] = ['T0', 'D1', 'D3', 'D7', 'D30'];
  return checkpoints.map((checkpoint) => {
    const radarCheckpoint = radar.quote_lifecycle.find((item) => item.checkpoint === checkpoint);
    return { checkpoint, state: radarCheckpoint?.state === 'OBSERVED' ? 'OBSERVED' : radarCheckpoint?.state === 'PENDING' ? 'PENDING' : radarCheckpoint ? 'MISSED' : 'UNAVAILABLE', observed_at: null, stock_token_footprint_delta: null, capital_share_delta: null, flow_share_delta: null, supply_delta: null, basis_context: null, survival_state: radarCheckpoint?.state ?? 'UNAVAILABLE' };
  });
}

function unavailablePersistence(): PersistenceObservation[] { return ['T0', 'D1', 'D3', 'D7', 'D30'].map((checkpoint) => ({ checkpoint: checkpoint as PersistenceObservation['checkpoint'], state: 'UNAVAILABLE', observed_at: null, stock_token_footprint_delta: null, capital_share_delta: null, flow_share_delta: null, supply_delta: null, basis_context: null, survival_state: 'UNVERIFIED' })); }
function dimensions(overrides: Partial<Record<ActivationDimension, ActivationDimensionState>>) { return Object.fromEntries(ACTIVATION_DIMENSIONS.map((item) => [item, overrides[item] ?? 'UNVERIFIED'])) as Record<ActivationDimension, ActivationDimensionState>; }
function shellCase(case_id: string, title: string, mission_assets: string[], rwa_or_stock_token: string[], venue: string, opening_hypothesis: string, watch_claims: string[]) {
  return rwaCase({ case_id, title, mission_assets, rwa_or_stock_token, venues: [venue], opening_hypothesis, opened_at: '2026-09-01T00:00:00.000Z', watch_claims, radar_evidence: [], persistence_observations: unavailablePersistence(), activation_dimensions: dimensions({ ATTENTION: watch_claims.length ? 'SUPPORTING_EVIDENCE' : 'UNVERIFIED' }), current_evidence_state: 'RADAR_CANDIDATE', open_evidence_gaps: ['Exact pool identity and same-block Stock Token accounting required.'], candidate_next_audit: 'Promote one source claim into a Radar audit target when exact pool identifiers are available.', priority: 'LOW', activity_classification: 'SPECULATIVE_ACTIVITY', thesis_mapping: ['RA1'], falsification_notes: [] });
}
function rwaCase(input: Omit<RwaActivationCase, 'object_type' | 'audit_priority' | 'priority_rationale' | 'state_transitions' | 'updated_at' | 'methodology_version' | 'immutable'> & { priority: AuditPriority }): RwaActivationCase {
  return deepFreeze({ ...input, object_type: 'RWA_ACTIVATION_CASE', audit_priority: input.priority, priority_rationale: ['Deterministic research priority excludes token price upside and market-cap potential.'], state_transitions: [{ from: null, to: input.current_evidence_state, transitioned_at: input.opened_at, reason: input.opening_hypothesis }], updated_at: input.opened_at, methodology_version: REFLEXIVE_WATCH_METHOD_VERSION, immutable: true });
}
function feedItem(rwaCase: RwaActivationCase, claims: ReflexiveWatchClaim[]): ReflexiveWatchFeedItem {
  const claim = claims.find((item) => rwaCase.watch_claims.includes(item.claim_id));
  const radar = rwaCase.radar_evidence.some((item) => item.radar_state === 'VERIFIED') ? 'VERIFIED' : rwaCase.radar_evidence.some((item) => item.radar_state === 'PARTIAL') ? 'PARTIAL' : 'UNVERIFIED';
  return { case_id: rwaCase.case_id, case_title: rwaCase.title, watch_interpretation: claim?.watch_verdict ?? 'INSUFFICIENT_DATA', evidence_status: claim?.evidence_status ?? 'WATCH_ONLY', radar_state: radar, key_claim: claim?.claim_text ?? rwaCase.opening_hypothesis, why_it_matters: rwaCase.opening_hypothesis, last_updated: rwaCase.updated_at, next_proof_needed: rwaCase.candidate_next_audit };
}
function thesisBoard(cases: RwaActivationCase[]): ThesisBoardEntry[] {
  const ids = (id: ThesisBoardEntry['hypothesis_id']) => cases.filter((item) => item.thesis_mapping.includes(id)).map((item) => item.case_id);
  return [
    { hypothesis_id: 'H2A', state: 'SUPPORTING', rationale: 'Mission markets can hold material Stock Token inventory; only Radar evidence can support this.', case_ids: ids('H2A'), watch_claims_can_upgrade: false },
    { hypothesis_id: 'H2B', state: 'OBSERVING', rationale: 'Persistence is under observation across lifecycle checkpoints.', case_ids: ids('H2B'), watch_claims_can_upgrade: false },
    { hypothesis_id: 'H2C', state: 'MIXED', rationale: 'AI/NVDA separates capital persistence from weaker flow persistence and quote execution dominance.', case_ids: ids('H2C'), watch_claims_can_upgrade: false },
    { hypothesis_id: 'H2D', state: 'INSUFFICIENT', rationale: 'Community vault or treasury accumulation remains unavailable until independently verified.', case_ids: ids('H2D'), watch_claims_can_upgrade: false },
    { hypothesis_id: 'H7', state: 'OBSERVATIONAL', rationale: 'Supply response observations require aligned sequential cases before thesis upgrade.', case_ids: ids('H7'), watch_claims_can_upgrade: false },
    { hypothesis_id: 'RA1', state: cases.filter((item) => item.current_evidence_state === 'VERIFIED').length >= 2 ? 'CONFIRMED' : 'EARLY_SUPPORTING_EVIDENCE', rationale: 'RA1 is broader than RMM and cannot be confirmed from one case or from Watch claims alone.', case_ids: ids('RA1'), watch_claims_can_upgrade: false }
  ];
}
function seedWatchClaims(): ReflexiveWatchClaim[] {
  const base = { captured_at: '2026-09-01T00:00:00.000Z', source_url: null, source_reference: null, pool_identifiers: [], observation_window: null, methodology_version: REFLEXIVE_WATCH_METHOD_VERSION };
  return [
    createWatchClaim({ ...base, source_type: 'THIRD_PARTY_RESEARCH', source_name: 'External AI/NVDA market reporting', claim_text: 'AI/NVDA controls 20%+ of canonical NVDA Stock Token supply.', subject_assets: ['AI', 'NVDA'], mission_token: 'AI', stock_token_or_rwa: 'NVDA', venue: 'LONG/Doppler', claimed_metrics: { canonical_nvda_share: '20%+' }, claimed_timestamp: '2026-09-01T00:00:00.000Z', claim_category: 'MATERIAL_STOCK_TOKEN_SHARE', provisional_interpretation: 'Potential material mission-market Stock Token inventory; Radar must verify exact canonical contract, position ownership, principal and same-block totalSupply.', watch_verdict: 'CONFIRMS', evidence_status: 'RADAR_AUDIT_TARGET' }),
    createWatchClaim({ ...base, source_type: 'MEDIA_REPORTED', source_name: 'Historical BONER/HIMS float-squeeze reporting', claim_text: 'BONER/HIMS was reported as controlling roughly 81% of HIMS Stock Token float at the historical observation time.', subject_assets: ['BONER', 'HIMS'], mission_token: 'BONER', stock_token_or_rwa: 'HIMS', venue: 'PAIR', claimed_metrics: { reported_hims_float_share: '81%' }, claimed_timestamp: '2026-08-31T00:00:00.000Z', claim_category: 'FLOAT_STRESS', provisional_interpretation: 'Historical claim cannot be compared to current HIMS supply without exact archived pool and totalSupply state.', watch_verdict: 'INSUFFICIENT_DATA', evidence_status: 'HISTORICAL_STATE_UNAVAILABLE' }),
    createWatchClaim({ ...base, source_type: 'PROTOCOL_REPORTED', source_name: 'LongX protocol materials', claim_text: 'NVDAx3L claims 3x NVDA exposure with NAV mint/redeem mechanics, mission pairing and fee routing.', subject_assets: ['LONGX', 'NVDAx3L', 'NVDA'], mission_token: 'LONGX', stock_token_or_rwa: 'NVDAx3L', venue: 'LONG', claimed_metrics: { exposure_multiple: '3x', nav_mint_redeem: 'claimed' }, claimed_timestamp: '2026-09-01T00:00:00.000Z', claim_category: 'DERIVATIVE_EQUITY_TOKEN', provisional_interpretation: 'Discovery category for a derivative equity token. Radar lacks the accounting adapter in v0.1.', watch_verdict: 'INSUFFICIENT_DATA', evidence_status: 'RADAR_UNVERIFIED' })
  ];
}
function seedAuditTargets(claims: ReflexiveWatchClaim[]): RadarAuditTarget[] {
  const ai = claims.find((item) => item.claim_category === 'MATERIAL_STOCK_TOKEN_SHARE');
  if (!ai) return [];
  return [createAuditTarget({ claim_id: ai.claim_id, case_id: 'AI_NVDA_CAPITAL_VS_FLOW', claim_text: ai.claim_text, confirm_criteria: ['Canonical NVDA contract verified.', 'Exact pool and LONG/Doppler provenance verified.', 'Position ownership and principal reconstructed.', 'Canonical totalSupply read at the same block.'], falsify_criteria: ['Quote contract is noncanonical.', 'Pool identity or launch provenance fails.', 'Position principal is unavailable or materially below claim.', 'TotalSupply timestamp is not comparable.'], required_onchain_objects: ['canonical NVDA ERC-20', 'LONG/Doppler pool', 'Uniswap v4 PoolKey and PoolId', 'PositionManager NFT/core position', 'same-block totalSupply'], time_alignment_required: ['Position principal and totalSupply must share the same block.', 'Provider liquidity context must not be mixed with launch-position accounting.'], missing_data: ['Community vault identity.', 'External liquidity reconciliation.', 'Synchronized underlying basis reference.'], now: '2026-09-01T00:00:00.000Z' })];
}
function auditTargetRecord(target: RadarAuditTarget): WatchResearchRecord { return deepFreeze({ object_type: 'RADAR_AUDIT_TARGET_RECORD', record_id: stableId('radar-audit-target-record', target.target_id), case_id: target.case_id, claim_id: target.claim_id, summary: `Audit target for ${target.exact_claim}`, created_at: target.created_at, methodology_version: REFLEXIVE_WATCH_METHOD_VERSION, not_protocol_receipt: true, immutable: true }); }
function claimFingerprint(input: ReflexiveWatchClaimInput | ReflexiveWatchClaim) { return createHash('sha256').update(JSON.stringify({ source_type: input.source_type, source_url: input.source_url ?? null, source_reference: input.source_reference ?? null, source_name: input.source_name, claim_text: input.claim_text, subject_assets: [...input.subject_assets].sort(), mission_token: input.mission_token, stock_token_or_rwa: input.stock_token_or_rwa, venue: input.venue, pool_identifiers: [...input.pool_identifiers].sort(), observation_window: input.observation_window, claimed_metrics: input.claimed_metrics, claimed_timestamp: input.claimed_timestamp, claim_category: input.claim_category })).digest('hex'); }
function deepFreeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const nested of Object.values(value as Record<string, unknown>)) if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested); } return value; }
