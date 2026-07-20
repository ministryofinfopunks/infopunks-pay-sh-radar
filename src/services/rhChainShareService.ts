import type { RhChainDailyReceipt } from '../data/rhChain';
import type { RhChainAttentionAssessment } from './rhChainAttentionQualityService';
import type { RhChainMarketPulse } from './rhChainMarketStructureService';
import type { RhChainIntelligenceReceipt } from './rhChainProjectClaimsService';
import { createRhChainShareObject, type RhChainShareObject } from '../shared/rhChainSharing';

const SOURCE_SUMMARIES = {
  market: 'Persisted Robinhood Chain market snapshot memory; reviewed exact-contract classifications; provider context is non-authoritative.',
  attention: 'Persisted market snapshot memory and reviewed exact-contract classification; no provider request occurs in this read path.',
  project: 'Published Infopunks project intelligence receipt, with linked public evidence and observation inventory.',
  daily: 'Reviewer-published Daily Receipt public market memory.',
  index: '4663 Signal Index methodology and public exact-contract desk memory.'
} as const;

function freshness(value: string): RhChainShareObject['freshness'] {
  if (value === 'fresh' || value === 'partial' || value === 'stale' || value === 'unavailable' || value === 'source_required' || value === 'baseline_forming' || value === 'insufficient_history') return value;
  return 'unavailable';
}

function confidence(value: string | null | undefined): RhChainShareObject['confidence'] {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'unavailable';
}

export function buildRhChainMarketPulseShare(pulse: RhChainMarketPulse): RhChainShareObject {
  return createRhChainShareObject({
    object_type: 'market_pulse', canonical_url: '/rh-chain-signal-desk/market', public_title: 'Robinhood Chain Market Pulse | Infopunks Radar',
    deterministic_headline: pulse.interpretation.headline, principal_finding: pulse.interpretation.conclusion,
    material_caveat: pulse.warnings[0] ?? pulse.disclaimer, observation_window: pulse.observation_window.label,
    captured_at: pulse.captured_at, freshness: freshness(pulse.freshness), confidence: confidence(pulse.confidence),
    methodology_version: 'rh_chain_market_pulse.v1', source_summary: SOURCE_SUMMARIES.market, receipt_id: null, integrity_hash: null,
    publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: null, project_name: null, asset_name: null, exact_contract: null },
    evidence_state: pulse.freshness === 'unavailable' ? 'unavailable' : pulse.freshness === 'partial' ? 'provisional' : 'measurable', project_says: null,
    not_financial_advice: true
  });
}

export function buildRhChainAttentionQualityShare(assessment: RhChainAttentionAssessment): RhChainShareObject {
  const score = assessment.attention_quality_score === null ? 'No numeric score is published for this assessment state.' : `Attention Quality score: ${assessment.attention_quality_score}.`;
  return createRhChainShareObject({
    object_type: 'attention_quality', canonical_url: '/rh-chain-signal-desk/market-structure/attention-quality', public_title: 'Robinhood Chain Attention Quality | Infopunks Radar',
    deterministic_headline: assessment.verdict, principal_finding: `${score} Paid attention, organic retention, and history coverage remain distinct.`,
    material_caveat: assessment.warnings[0] ?? 'Attention context is not a legitimacy, safety, or financial-performance claim.',
    observation_window: assessment.observation_window.label, captured_at: assessment.captured_at, freshness: freshness(assessment.freshness), confidence: confidence(assessment.evidence_confidence),
    methodology_version: assessment.methodology_version, source_summary: SOURCE_SUMMARIES.attention, receipt_id: assessment.receipt_id, integrity_hash: null,
    publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: assessment.reviewed_project_identity, project_name: assessment.reviewed_project_identity, asset_name: null, exact_contract: assessment.contract },
    evidence_state: assessment.assessment_state === 'measurable' ? 'measurable' : assessment.assessment_state === 'baseline_forming' ? 'baseline_forming' : assessment.assessment_state === 'insufficient_data' ? 'insufficient_history' : assessment.freshness === 'stale' ? 'stale' : 'unavailable',
    project_says: null, not_financial_advice: true
  });
}

export function buildRhChainCrossLayerShare(input: { headline: string; finding: string; caveat: string; observation_window: string; captured_at: string | null; freshness: string; confidence: 'low' | 'medium' | 'high'; methodology_version: string; source_summary?: string }): RhChainShareObject {
  return createRhChainShareObject({
    object_type: 'cross_layer_insight', canonical_url: '/rh-chain-signal-desk/market-structure/cross-layer', public_title: 'Cross-Layer Intersections | Infopunks Radar',
    deterministic_headline: input.headline, principal_finding: input.finding, material_caveat: input.caveat, observation_window: input.observation_window,
    captured_at: input.captured_at, freshness: freshness(input.freshness), confidence: input.confidence, methodology_version: input.methodology_version,
    source_summary: input.source_summary ?? 'Reviewed exact-contract classifications and persisted market snapshots; provider metadata is non-authoritative.', receipt_id: null, integrity_hash: null,
    publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: null, project_name: null, asset_name: null, exact_contract: null }, evidence_state: input.freshness === 'stale' ? 'stale' : input.freshness === 'unavailable' ? 'unavailable' : 'measurable', project_says: null, not_financial_advice: true
  });
}

export function buildRhChainProjectReceiptShare(receipt: RhChainIntelligenceReceipt & { canonical_url?: string }): RhChainShareObject {
  const superseded = receipt.reviewer_publication_state === 'superseded';
  const correction = receipt.correction_history.at(-1);
  const replacement = receipt.replacement_receipt_id ?? correction?.replacement_receipt_id ?? null;
  return createRhChainShareObject({
    object_type: 'project_intelligence_receipt', canonical_url: receipt.canonical_url ?? `/rh-chain-signal-desk/intelligence-receipts/${encodeURIComponent(receipt.receipt_id)}`,
    public_title: `${receipt.canonical_project_name} Intelligence Receipt | Infopunks Radar`, deterministic_headline: receipt.verdict,
    principal_finding: `${receipt.inclusion_totals} included and ${receipt.exclusion_totals} excluded reviewed record(s).`,
    material_caveat: receipt.disputes[0] ?? receipt.unknowns[0] ?? receipt.stale_sources[0] ?? 'Read the linked public receipt and evidence inventory before repeating this finding.',
    observation_window: `${receipt.observation_window.start ?? 'Start unavailable'} to ${receipt.observation_window.end ?? 'End unavailable'}`,
    captured_at: receipt.publication_timestamp ?? receipt.updated_at, freshness: receipt.stale_sources.length ? 'stale' : 'fresh', confidence: confidence(receipt.verdict_confidence),
    methodology_version: receipt.methodology_version, source_summary: SOURCE_SUMMARIES.project, receipt_id: receipt.receipt_id, integrity_hash: receipt.integrity_hash,
    publication_state: superseded ? 'superseded' : 'published', supersession_state: superseded ? 'superseded' : 'current',
    correction_link: superseded ? (receipt.canonical_url ?? `/rh-chain-signal-desk/intelligence-receipts/${encodeURIComponent(receipt.receipt_id)}`) : null,
    replacement_receipt_link: replacement ? `/rh-chain-signal-desk/intelligence-receipts/${encodeURIComponent(replacement)}` : null,
    identity: { project_id: receipt.project_id, project_name: receipt.canonical_project_name, asset_name: null, exact_contract: receipt.exact_contract_identity },
    evidence_state: receipt.disputes.length ? 'disputed' : receipt.unknowns.length ? 'partially_supported' : 'supported', project_says: null, not_financial_advice: true
  });
}

export function buildRhChainProjectClaimShare(claim: { claim_id: string; claim_text: string; claim_status: string; confidence: 'low' | 'medium' | 'high' | null; effective_period: { start: string | null; end: string | null }; exact_contract_context: string; project_id: string; project_name: string; canonical_url: string; verdict: string; caveat: string; methodology_version?: string }): RhChainShareObject | null {
  if (!['supported', 'partially_supported', 'contradicted', 'disputed'].includes(claim.claim_status)) return null;
  return createRhChainShareObject({
    object_type: 'project_claim_verdict', canonical_url: claim.canonical_url, public_title: `${claim.project_name} Project Claim Verdict | Infopunks Radar`,
    deterministic_headline: claim.verdict, principal_finding: `Claim status: ${claim.claim_status.replaceAll('_', ' ')}.`, material_caveat: claim.caveat,
    observation_window: `${claim.effective_period.start ?? 'Start unavailable'} to ${claim.effective_period.end ?? 'End unavailable'}`,
    captured_at: null, freshness: 'fresh', confidence: confidence(claim.confidence), methodology_version: claim.methodology_version ?? 'rh_chain_project_claims.v1',
    source_summary: SOURCE_SUMMARIES.project, receipt_id: null, integrity_hash: null, publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: claim.project_id, project_name: claim.project_name, asset_name: null, exact_contract: claim.exact_contract_context },
    evidence_state: claim.claim_status as Extract<RhChainShareObject['evidence_state'], 'supported' | 'partially_supported' | 'contradicted' | 'disputed'>, project_says: claim.claim_text, not_financial_advice: true
  });
}

export function buildRhChainDailyReceiptShare(receipt: RhChainDailyReceipt): RhChainShareObject {
  return createRhChainShareObject({
    object_type: 'daily_receipt', canonical_url: `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receipt.receipt_id)}`,
    public_title: `Daily Receipt ${receipt.receipt_id} | Infopunks Radar`, deterministic_headline: receipt.headline, principal_finding: receipt.infopunks_verdict,
    material_caveat: receipt.source_notes ?? 'Public market memory can be incomplete or stale; read the linked receipt before repeating a claim.', observation_window: receipt.period ?? receipt.date, captured_at: receipt.generated_at, freshness: freshness(receipt.status), confidence: confidence(receipt.confidence_level),
    methodology_version: 'rh_chain_daily_receipts.v1', source_summary: SOURCE_SUMMARIES.daily, receipt_id: receipt.receipt_id, integrity_hash: null,
    publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: null, project_name: null, asset_name: null, exact_contract: null }, evidence_state: 'measurable', project_says: null, not_financial_advice: true
  });
}

export function buildRhChain4663Share(input: { headline: string; finding: string; caveat: string; captured_at: string; observation_window: string; confidence: 'low' | 'medium' | 'high'; methodology_version: string; asset_name?: string | null; exact_contract?: string | null }): RhChainShareObject {
  return createRhChainShareObject({ object_type: 'signal_4663', canonical_url: '/rh-chain-signal-desk/4663-index', public_title: '4663 Signal Index | Infopunks Radar', deterministic_headline: input.headline, principal_finding: input.finding, material_caveat: input.caveat, observation_window: input.observation_window, captured_at: input.captured_at, freshness: 'fresh', confidence: input.confidence, methodology_version: input.methodology_version, source_summary: SOURCE_SUMMARIES.index, receipt_id: null, integrity_hash: null, publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null, identity: { project_id: null, project_name: null, asset_name: input.asset_name ?? null, exact_contract: input.exact_contract ?? null }, evidence_state: 'measurable', project_says: null, not_financial_advice: true });
}
