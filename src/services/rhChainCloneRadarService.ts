import { getRhChainReviewQueue, type RhChainCloneRadarItem, type RhChainCloneRadarPayload, type RhChainRiskPatternCategory, type RhChainRiskPatternItem, type RhChainReviewItem } from '../data/rhChain';
import { findRhChainRiskCorrelations } from './rhChainRiskCorrelationService';
import { isRhChainIdentityContract } from './rhChainTruthGuards';

const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.' as const;
const DISCLAIMER = 'Radar entries are suspected or unverified risk patterns, not definitive misconduct findings, token safety determinations, trading advice, or an official Robinhood partnership.';

function suspicionFor(item: RhChainReviewItem): RhChainCloneRadarItem['suspicion_type'] {
  const text = `${item.evidence_summary} ${item.reviewer_note} ${item.missing_evidence.join(' ')}`.toLowerCase();
  if (/brand-adjacent|copycat|impersonat/.test(text)) return 'impersonator';
  if (/deployer/.test(text)) return 'deployer_cluster';
  if (/liquidity|pool|volume/.test(text)) return 'low_liquidity_clone';
  if (item.launch_context?.launch_source === 'unknown_manual') return 'suspicious_launch_surface';
  return 'unknown';
}

function toRadarItem(item: RhChainReviewItem): RhChainCloneRadarItem {
  const suspicion_type = suspicionFor(item);
  return {
    id: `clone-radar:${item.review_id}`, suspected_ticker: item.ticker, claimed_identity: `${item.ticker} narrative / claimed token identity`, token_contract: item.token_contract, chain: item.chain, suspicion_type,
    evidence_summary: `Suspected ${suspicion_type.replaceAll('_', ' ')} pattern. ${item.evidence_summary}`,
    evidence_links: Object.entries(item.links).filter(([, url]) => Boolean(url)).map(([label, url]) => ({ label, url })), related_tokens: [], launch_context: item.launch_context ?? null,
    review_status: item.review_state, risk_state: item.risk_state, confidence_level: item.source.confidence_level, observed_at: item.source.observed_at, updated_at: item.updated_at, data_mode: item.source.data_mode,
    source_notes: [item.reviewer_note, `Requires review: ${item.missing_evidence.join(', ')}`]
  };
}

function publicSourceLinks(item: RhChainReviewItem): RhChainRiskPatternItem['source_links'] {
  return Object.entries(item.links).filter(([, url]) => Boolean(url)).map(([label, url]) => ({ label, url }));
}

function toRiskPattern(item: RhChainReviewItem, risk_category: RhChainRiskPatternCategory, evidence_summary: string): RhChainRiskPatternItem {
  return {
    risk_pattern_id: `risk-pattern:${risk_category}:${item.review_id}`,
    risk_category,
    suspected_ticker: item.ticker,
    contract: isRhChainIdentityContract(item.token_contract) ? item.token_contract : null,
    related_surface: item.launch_context?.launch_source ?? 'unknown_manual',
    evidence_summary,
    source_links: publicSourceLinks(item),
    confidence_level: item.source.confidence_level,
    review_status: 'requires_review',
    next_review_step: item.next_step,
    data_mode: item.source.data_mode,
    observed_at: item.source.observed_at
  };
}

/** Derives review cues only from public review memory. It never changes review state or writes back to a submission. */
function riskPatternsFor(reviewItems: RhChainReviewItem[]): RhChainRiskPatternItem[] {
  const patterns: RhChainRiskPatternItem[] = [];
  const knownTickerContracts = new Map<string, Set<string>>();
  for (const item of reviewItems.filter((item) => isRhChainIdentityContract(item.token_contract))) knownTickerContracts.set(item.ticker, new Set([...(knownTickerContracts.get(item.ticker) ?? []), item.token_contract]));
  for (const item of reviewItems) {
    const text = `${item.evidence_summary} ${item.reviewer_note} ${item.missing_evidence.join(' ')}`.toLowerCase();
    if (/copycat|brand-adjacent|vampire/.test(text)) patterns.push(toRiskPattern(item, 'vampire_copycat_risk', `Suspected vampire/copycat pattern. ${item.evidence_summary}`));
    if (/relaunch|restart|replacement contract/.test(text)) patterns.push(toRiskPattern(item, 'fake_relaunch_risk', `Reported relaunch pattern requires canonical-origin review. ${item.evidence_summary}`));
    if (item.launch_context?.launch_source === 'unknown_manual') patterns.push(toRiskPattern(item, 'launchpad_displacement_risk', `Unattributed launch-surface context can create origin displacement risk. ${item.evidence_summary}`));
    if ((knownTickerContracts.get(item.ticker)?.size ?? 0) > 1) patterns.push(toRiskPattern(item, 'duplicate_social_claim', `Repeated ticker identity needs canonical social and contract review. ${item.evidence_summary}`));
    if (/liquidity|pool|volume/.test(text) && item.missing_evidence.some((evidence) => /liquidity|pool|reserve/i.test(evidence))) patterns.push(toRiskPattern(item, 'liquidity_claim_unverified', `Liquidity claim remains unverified. ${item.evidence_summary}`));
    if (/creator fee|launch fee|fee terms/.test(text)) patterns.push(toRiskPattern(item, 'creator_fee_claim_uncertain', `Creator-fee claim remains uncertain pending primary terms. ${item.evidence_summary}`));
    if (/fee model|fee-model|fee claim|launch fee|fee terms|transaction revenue/.test(text)) patterns.push(toRiskPattern(item, 'fee_model_claim_unverified', `Fee-model claim remains unverified pending primary terms or on-chain evidence. ${item.evidence_summary}`));
    if (/burn|buyback|buy-back/.test(text)) patterns.push(toRiskPattern(item, 'burn_buyback_claim_unverified', `Burn or buyback claim remains unverified pending transaction-level evidence. ${item.evidence_summary}`));
    if (/creator revenue|transaction revenue|revenue redirect|redirecting transaction revenue/.test(text)) patterns.push(toRiskPattern(item, 'creator_revenue_claim_uncertain', `Creator-revenue claim remains uncertain pending primary terms or on-chain evidence. ${item.evidence_summary}`));
    if (/front-end|front end|interface dependency/.test(text)) patterns.push(toRiskPattern(item, 'front_end_dependency_risk', `Front-end dependency pattern requires a source-stamped availability check. ${item.evidence_summary}`));
    if (item.launch_context?.launch_source === 'uniswap_direct_pool' && /liquidity|pool|reserve/i.test(text)) patterns.push(toRiskPattern(item, 'direct_uniswap_low_liquidity_risk', `Direct Uniswap pool context requires liquidity and origin review. ${item.evidence_summary}`));
  }
  return patterns;
}

/** Produces cautious warnings from existing review records; it does not perform live accusation or auto-adjudication. */
export function assembleRhChainCloneRadar(reviewItems = getRhChainReviewQueue().items): RhChainCloneRadarPayload {
  const items = reviewItems.map(toRadarItem);
  const knownContracts = new Map<string, RhChainCloneRadarItem[]>();
  for (const item of items.filter((item) => isRhChainIdentityContract(item.token_contract))) knownContracts.set(item.suspected_ticker, [...(knownContracts.get(item.suspected_ticker) ?? []), item]);
  const duplicate_ticker_watch = [...knownContracts.values()].filter((items) => new Set(items.map((item) => item.token_contract)).size > 1).flat().map((item) => ({ ...item, suspicion_type: 'duplicate_ticker' as const, evidence_summary: `Suspected duplicate ticker pattern. ${item.evidence_summary}` }));
  const active_warnings = items.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state));
  const liquidity_watch = items.filter((item) => ['low_liquidity_clone', 'deployer_cluster', 'suspicious_launch_surface'].includes(item.suspicion_type) || /liquidity|pool|volume/i.test(item.evidence_summary));
  const vampire_copycat_watch = riskPatternsFor(reviewItems);
  return {
    title: 'Clone & Impersonator Radar', subtitle: 'The market moves fast. The copies move faster.', generated_at: items.map((item) => item.updated_at).sort().at(-1) ?? new Date().toISOString(), doctrine: DOCTRINE, disclaimer: DISCLAIMER,
    active_warnings, duplicate_ticker_watch, liquidity_watch, vampire_copycat_watch, correlations: findRhChainRiskCorrelations(reviewItems),
    risk_categories: [
      { category: 'duplicate_ticker', title: 'Duplicate ticker', explanation: 'Same-name claims require exact-contract review before identity is inferred.' },
      { category: 'impersonator', title: 'Impersonator', explanation: 'Branding and social resemblance are signals to verify, not a misconduct finding.' },
      { category: 'vampire_copycat_risk', title: 'Vampire / copycat risk', explanation: 'Similarity, migration, or brand-adjacent claims remain review cues, not a conclusion about intent.' },
      { category: 'fake_relaunch_risk', title: 'Fake relaunch risk', explanation: 'A relaunch claim needs canonical contracts, source timestamps, and reviewed origin links.' },
      { category: 'launchpad_displacement_risk', title: 'Launchpad displacement risk', explanation: 'When launch surfaces fragment, copies, fake relaunches, and origin confusion can spread across venues. Track the exact launch origin and source timestamp.' },
      { category: 'duplicate_social_claim', title: 'Duplicate social claim', explanation: 'Social resemblance or repeated handles must be matched to a canonical source before identity is inferred.' },
      { category: 'liquidity_claim_unverified', title: 'Liquidity claim unverified', explanation: 'A pool, screenshot, or volume claim does not establish reserves, depth, or exit reliability.' },
      { category: 'creator_fee_claim_uncertain', title: 'Creator-fee claim uncertain', explanation: 'Fee terms require primary terms and a dated receipt before they are promoted.' },
      { category: 'fee_model_claim_unverified', title: 'Fee-model claim unverified', explanation: 'Fee-model changes require primary terms or on-chain evidence before promotion.' },
      { category: 'burn_buyback_claim_unverified', title: 'Burn / buyback claim unverified', explanation: 'Burn and buyback claims require transaction-level evidence before they become desk memory.' },
      { category: 'creator_revenue_claim_uncertain', title: 'Creator-revenue claim uncertain', explanation: 'Creator-revenue routing claims remain uncertain until primary terms or on-chain routing evidence exists.' },
      { category: 'front_end_dependency_risk', title: 'Front-end dependency risk', explanation: 'Interface availability and canonical launch origin can diverge; status alone is not proof.' },
      { category: 'direct_uniswap_low_liquidity_risk', title: 'Direct Uniswap low-liquidity risk', explanation: 'A direct pool does not establish reliable liquidity, identity, or safety.' }
    ],
    flagging_method: [
      { signal: 'Repeated ticker', explanation: 'The same ticker appears against more than one disclosed contract; it remains unresolved until manual review.' },
      { signal: 'Unverifiable launch source', explanation: 'Launch claims without a reviewable contract, pair, or source link remain context, not identity.' },
      { signal: 'Thin liquidity', explanation: 'Limited or unverified pool evidence can make surface activity unreliable.' },
      { signal: 'Suspicious deployer', explanation: 'Deployer history or clustered claims are verification gates, not a definitive finding.' },
      { signal: 'Fake social links', explanation: 'Social links must be source-checked; a link alone does not establish a canonical channel.' },
      { signal: 'Conflicting contract claims', explanation: 'Different contract claims for one identity remain unresolved until receipts align.' }
    ]
  };
}
