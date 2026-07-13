import { getRhChainReviewQueue, type RhChainCloneRadarItem, type RhChainCloneRadarPayload, type RhChainReviewItem } from '../data/rhChain';
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

/** Produces cautious warnings from existing review records; it does not perform live accusation or auto-adjudication. */
export function assembleRhChainCloneRadar(reviewItems = getRhChainReviewQueue().items): RhChainCloneRadarPayload {
  const items = reviewItems.map(toRadarItem);
  const knownContracts = new Map<string, RhChainCloneRadarItem[]>();
  for (const item of items.filter((item) => isRhChainIdentityContract(item.token_contract))) knownContracts.set(item.suspected_ticker, [...(knownContracts.get(item.suspected_ticker) ?? []), item]);
  const duplicate_ticker_watch = [...knownContracts.values()].filter((items) => new Set(items.map((item) => item.token_contract)).size > 1).flat().map((item) => ({ ...item, suspicion_type: 'duplicate_ticker' as const, evidence_summary: `Suspected duplicate ticker pattern. ${item.evidence_summary}` }));
  const active_warnings = items.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state));
  const liquidity_watch = items.filter((item) => ['low_liquidity_clone', 'deployer_cluster', 'suspicious_launch_surface'].includes(item.suspicion_type) || /liquidity|pool|volume/i.test(item.evidence_summary));
  return {
    title: 'Clone & Impersonator Radar', subtitle: 'The market moves fast. The copies move faster.', generated_at: items.map((item) => item.updated_at).sort().at(-1) ?? new Date().toISOString(), doctrine: DOCTRINE, disclaimer: DISCLAIMER,
    active_warnings, duplicate_ticker_watch, liquidity_watch, correlations: findRhChainRiskCorrelations(reviewItems),
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
