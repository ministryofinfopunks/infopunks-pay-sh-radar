import { getRhChainPayload, type RhChainReviewItem, type RhChainRiskCorrelation, type RhChainRiskCorrelationType } from '../data/rhChain';

type Group = { key: string; items: RhChainReviewItem[] };
const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const visibleRecord = (item: RhChainReviewItem) => ({ review_id: item.review_id, ticker: item.ticker, token_contract: item.token_contract, review_state: item.review_state });

function grouped(items: RhChainReviewItem[], keyFor: (item: RhChainReviewItem) => string): Group[] {
  const groups = new Map<string, RhChainReviewItem[]>();
  for (const item of items) { const key = keyFor(item); if (key) groups.set(key, [...(groups.get(key) ?? []), item]); }
  return [...groups.entries()].map(([key, groupedItems]) => ({ key, items: groupedItems })).filter((group) => group.items.length > 1);
}

function correlation(type: RhChainRiskCorrelationType, key: string, items: RhChainReviewItem[], evidence: string, confidence: RhChainRiskCorrelation['confidence_level'], next: string): RhChainRiskCorrelation {
  return { correlation_id: `rh-correlation:${type}:${key.replace(/[^a-z0-9]+/gi, '-').slice(0, 80)}`, correlation_type: type, suspected_correlation: `Suspected ${type.replaceAll('_', ' ')} across known review records. Requires review.`, related_records: items.map(visibleRecord), evidence_summary: evidence, confidence_level: confidence, review_status: 'requires_review', recommended_next_review_step: next };
}

/**
 * Read-only, non-adjudicative pattern detection. Correlations never mutate a
 * review record and cannot establish misconduct, token identity, or safety.
 */
export function findRhChainRiskCorrelations(reviewItems: RhChainReviewItem[], riskWall = getRhChainPayload().risk_wall): RhChainRiskCorrelation[] {
  const correlations: RhChainRiskCorrelation[] = [];
  for (const group of grouped(reviewItems.filter((item) => item.token_contract !== 'unverified_contract_required'), (item) => normalized(item.ticker))) {
    if (new Set(group.items.map((item) => normalized(item.token_contract))).size > 1) correlations.push(correlation('duplicate_ticker_multiple_contracts', group.key, group.items, `The ticker “${group.items[0].ticker}” appears with multiple disclosed contracts. This is unresolved identity context, not a finding.`, 'medium', 'Compare exact contracts, canonical channels, and source-linked receipts manually.'));
  }
  for (const group of grouped(reviewItems, (item) => normalized(item.launch_context?.deployer_address))) correlations.push(correlation('same_deployer_multiple_submissions', group.key, group.items, 'A disclosed deployer address appears across multiple submissions. The relationship remains unverified without explorer and funding-path receipts.', 'low', 'Verify deployer history, funding paths, ownership controls, and exact contract relationships.'));
  for (const group of grouped(reviewItems.filter((item) => item.missing_evidence.length > 0), (item) => item.launch_context?.launch_source ?? '')) correlations.push(correlation('repeated_launch_surface_low_evidence', group.key, group.items, `Multiple submissions cite ${group.items[0].launch_context?.launch_source ?? 'an unknown surface'} while retaining missing evidence. This is a review queue pattern only.`, 'low', 'Request exact contract, pair, launch-source, and deployer receipts for each record.'));
  for (const group of grouped(reviewItems, (item) => normalized(item.links.liquidity))) correlations.push(correlation('reused_liquidity_link', group.key, group.items, 'The same submitted liquidity link is reused across multiple records. Link reuse can be benign and requires manual source comparison.', 'low', 'Open the link, confirm the exact pair and contract, and record whether it supports each submission.'));
  const missingVerification = reviewItems.filter((item) => item.launch_context && item.launch_context.contract_verified !== true);
  if (missingVerification.length > 1) correlations.push(correlation('missing_contract_verification', 'missing-verification', missingVerification, 'Multiple related submissions lack a verified-contract receipt. Absence of verification is a review gap, not a safety conclusion.', 'medium', 'Obtain an explorer-backed exact-contract verification receipt before upgrading any desk memory.'));
  for (const group of grouped(reviewItems.filter((item) => ['locked_claimed', 'burned_claimed'].includes(item.launch_context?.lp_status ?? '') && item.missing_evidence.length > 0), (item) => item.launch_context?.lp_status ?? '')) correlations.push(correlation('repeated_lp_status_claim_without_evidence', group.key, group.items, `Multiple records repeat an LP status claim (${group.key}) without complete supporting evidence. Claims remain unverified.`, 'low', 'Request pool, LP lock/burn, and transaction receipts tied to each exact contract.'));
  for (const item of reviewItems) {
    const mentions = riskWall.filter((risk) => `${risk.title} ${risk.summary}`.toLowerCase().includes(item.ticker.toLowerCase()));
    if (mentions.length) correlations.push(correlation('risk_wall_review_queue_overlap', item.review_id, [item], `The token label appears in both Risk Wall language and the review queue. This overlap is contextual and requires review, not adjudication.`, 'low', 'Compare the Risk Wall source notes with the exact contract and submission receipts.'));
  }
  return correlations;
}
