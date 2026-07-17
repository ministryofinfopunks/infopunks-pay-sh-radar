import {
  getRhChainDailyReceipts,
  getRhChainReviewQueue,
  rhChainDailyReceiptRoute,
  type RhChainReviewItem,
  type RhChainTokenDossier
} from '../data/rhChain';
import { queryRhChainScout } from './rhChainScoutService';
import type { RhChainLiveSnapshot } from './rhChainLiveSnapshotService';
import type { RhChainSignalSubmission } from './rhChainSignalVault';
import { isRhChainIdentityContract } from './rhChainTruthGuards';
import { resolveRhChainContractIntelligence, type RhChainContractIntelligence } from './rhChainContractIntelligenceService';

const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.' as const;
const DISCLAIMER = 'Dossier inclusion is public intelligence memory, not endorsement, safety verification, listing, financial advice, or an official Robinhood partnership.';
const normalize = (value: string) => value.trim().toLowerCase();

/** Assembles known records by exact contract only; ticker similarity never establishes identity. */
export function assembleRhChainTokenDossier(contract: string, submissions: RhChainSignalSubmission[], tokenSnapshot: Awaited<ReturnType<import('./rhChainLiveSnapshotService').RhChainLiveSnapshotService['getTokenSnapshot']>>, liveSnapshot: RhChainLiveSnapshot, resolution?: RhChainContractIntelligence): RhChainTokenDossier {
  const normalized = normalize(contract);
  const identityValid = /^0x/i.test(contract.trim()) && isRhChainIdentityContract(contract);
  if (!identityValid) return {
    contract, ticker: null, name: null, chain: 'Robinhood Chain', review_status: 'not_found', risk_state: 'source_required', data_mode: 'unavailable', identity_status: 'source_required', generated_at: tokenSnapshot.generated_at, disclaimer: DISCLAIMER, doctrine: DOCTRINE, contract_intelligence: { source: 'unknown', claim_status: 'source_required_for_claims', display_name: null },
    memory: { index: null, campaign_asset: null, market_structure: null, review_items: [], submissions: [], daily_receipts: [], scout_summary: 'Source required before identity-specific context. Placeholder contracts are not token identities.' },
    external_context: { token_pair: null, explorer: null, category_relevance: { label: 'Source required before identity-specific context.', freshness: 'unavailable', source_timestamp: null } }, launch_context: null, access_context: null,
    risk_notes: ['Source required before identity-specific context.', 'Placeholder contract values cannot be used to join review records, receipts, or index memory.'], receipt_trail: []
  };
  const persistedReview = submissions.map((submission) => ({
    review_id: submission.submission_id, review_state: submission.review_status, submitted_at: submission.submitted_at, updated_at: submission.updated_at, ticker: submission.ticker, token_contract: submission.token_contract, chain: submission.chain, source_type: submission.source_type, links: submission.links, evidence_summary: submission.evidence_summary ?? 'Community submission awaiting receipt review.', missing_evidence: submission.missing_evidence ?? ['manual receipt review'], risk_state: submission.risk_state ?? 'source_required', signal_state: submission.signal_state ?? 'fresh_signal', infopunks_verdict: submission.infopunks_verdict ?? 'Submission is not endorsement.', reviewer_note: submission.reviewer_note ?? 'No reviewer note yet.', next_step: 'Manual review only.', source: { source_name: 'RH Chain Signal Vault', observed_at: submission.submitted_at, updated_at: submission.updated_at, data_mode: submission.data_mode, confidence_level: 'low' as const }, launch_context: submission.launch_context
  })) as RhChainReviewItem[];
  const resolved = resolution ?? resolveRhChainContractIntelligence(contract, { reviewItems: [...getRhChainReviewQueue().items, ...persistedReview], dexscreener: tokenSnapshot.token_pair, blockscout: tokenSnapshot.explorer });
  const review_items = resolved.review_items;
  const matchedSubmission = submissions.filter((item) => normalize(item.token_contract) === normalized);
  const { index, campaign_asset, market_structure: marketStructure, canonical_identity: canonical, ticker } = resolved;
  const receipts = getRhChainDailyReceipts().receipts.filter((receipt) => ticker ? `${receipt.summary} ${receipt.top_signal} ${receipt.watchlist.map((item) => item.item).join(' ')}`.toLowerCase().includes(ticker.toLowerCase()) : false).map(({ receipt_id, headline, date }) => ({ receipt_id, headline, date }));
  const launch_context = review_items.find((item) => item.launch_context)?.launch_context ?? null;
  const risk_notes = [...new Set([
    ...review_items.flatMap((item) => [item.infopunks_verdict, ...item.missing_evidence]),
    ...(campaign_asset ? [
      campaign_asset.classification_note,
      `Campaign risk state: ${campaign_asset.risk_state}.`,
      ...campaign_asset.missing_evidence
    ] : []),
    ...(index ? [index.infopunks_verdict, ...index.source_notes] : []),
    ...(marketStructure ? [marketStructure.classification_reason, marketStructure.caveat, ...marketStructure.missing_evidence].filter((item): item is string => Boolean(item)) : []),
    ...(launch_context ? [launch_context.source_notes] : []),
    ...(['snapshot_history', 'dexscreener', 'blockscout'].includes(resolved.source) ? ['Provider context is external observation only. It remains not_reviewed and source_required; it does not create an approved signal, index inclusion, endorsement, or safety finding.'] : []),
    ...(tokenSnapshot.explorer ? ['Explorer visibility does not verify RWA, agent, infrastructure, dividend, backing, safety, or authenticity claims.'] : []),
    ...(!review_items.length && !index && !campaign_asset && !marketStructure ? ['No exact Infopunks memory match. Do not infer identity from a ticker alone; verify the contract and source receipts.'] : [])
  ])];
  const scout = queryRhChainScout({ query: contract, mode: 'token_context' }, review_items);
  const firstReview = review_items[0];
  const receipt_trail = [
    ...receipts.map((receipt) => ({ id: receipt.receipt_id, label: receipt.headline, timestamp: receipt.date, href: rhChainDailyReceiptRoute(receipt.receipt_id) })),
    ...(campaign_asset ? [{ id: 'rh_100_receipts_day_001', label: '100 Receipts · Day 1 / Batch 001', timestamp: '2026-07-16T00:00:00.000Z', href: '/rh-chain-signal-desk/100-receipts' }] : []),
    ...review_items.map((item) => ({ id: item.review_id, label: `Review queue · ${item.review_state.replaceAll('_', ' ')}`, timestamp: item.updated_at, href: '/rh-chain-signal-desk/review-queue' })),
    ...matchedSubmission.flatMap((item) => item.audit_events.map((event) => ({ id: event.event_id, label: `Vault audit · ${event.action.replaceAll('_', ' ')}`, timestamp: event.occurred_at, href: null })))
  ];
  return {
    contract: resolved.contract, ticker, name: canonical?.name ?? index?.name ?? marketStructure?.display_name ?? resolved.display_name, chain: firstReview?.chain ?? index?.chain ?? 'Robinhood Chain', review_status: resolved.review_status, risk_state: resolved.risk_state, data_mode: firstReview?.source.data_mode ?? index?.source.data_mode ?? (campaign_asset || marketStructure ? 'manual' : resolved.source === 'unknown' ? 'unavailable' : 'live_cached'), identity_status: 'valid', generated_at: tokenSnapshot.generated_at, disclaimer: DISCLAIMER, doctrine: DOCTRINE, contract_intelligence: { source: resolved.source, claim_status: resolved.claim_status, display_name: resolved.display_name },
    memory: { index, campaign_asset, market_structure: marketStructure, review_items, submissions: matchedSubmission.map((item) => ({ submission_id: item.submission_id, submitted_at: item.submitted_at, evidence_summary: item.evidence_summary ?? 'Community submission awaiting receipt review.', audit_events: item.audit_events.map(({ reviewer_id: _reviewerId, ...event }) => event) })), daily_receipts: receipts, scout_summary: scout.answer },
    external_context: { token_pair: tokenSnapshot.token_pair ?? (marketStructure?.dexscreener_pair ? { pair_address: null, dex_url: marketStructure.dexscreener_pair, liquidity_usd: null, volume_24h_usd: null, exact_contract_match: true, chain_match_status: 'chain_unverified' as const, freshness: 'manual', source_timestamp: marketStructure.observed_at } : null), explorer: tokenSnapshot.explorer ?? { explorer_url: `https://robinhoodchain.blockscout.com/token/${encodeURIComponent(resolved.contract)}`, deployer_address: null, contract_exists: null, contract_verified: null, contract_type: null, availability: 'unavailable' as const, exact_contract_match: true, freshness: 'manual', source_timestamp: null }, category_relevance: { label: liveSnapshot.meme_category.top_assets.length ? 'Meme category context available; it does not establish token identity or relevance.' : 'CoinGecko category context unavailable.', freshness: liveSnapshot.meme_category.freshness, source_timestamp: liveSnapshot.meme_category.source_timestamp } },
    launch_context,
    // Generic access surfaces never establish dossier relevance. Attach only a future exact contract/pair evidence match.
    access_context: null,
    risk_notes,
    receipt_trail
  };
}
