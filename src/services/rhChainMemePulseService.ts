import {
  getRhChain4663Index,
  getRhChainDailyReceipts,
  getRhChainPayload,
  getRhChainReviewQueue,
  type RhChainMemePulseAsset,
  type RhChainMemePulsePayload
} from '../data/rhChain';
import type { RhChainLiveSnapshot } from './rhChainLiveSnapshotService';
import { getRhChainFreshnessState } from './rhChainTruthGuards';

const DISCLAIMER = 'RH Meme Pulse is public market memory for attention assets, not a trading dashboard, endorsement, safety claim, listing, or Robinhood partnership.';
const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.' as const;

/** Combines existing, reviewable desk records; live context never upgrades a verdict. */
export function assembleRhChainMemePulseScreen(liveSnapshot?: RhChainLiveSnapshot): RhChainMemePulsePayload {
  const index = getRhChain4663Index();
  const receipts = getRhChainDailyReceipts();
  const queue = getRhChainReviewQueue();
  const desk = getRhChainPayload();
  const launchByTicker = new Map(queue.items.map((item) => [item.ticker.toUpperCase(), item.launch_context?.launch_source ?? null]));
  const receiptState = new Map(queue.items.map((item) => [item.ticker.toUpperCase(), item.review_state]));
  const top_attention_assets: RhChainMemePulseAsset[] = index.assets.slice(0, 6).map((asset) => ({
    ticker: asset.ticker,
    name: asset.name,
    narrative_class: asset.narrative_class,
    signal_score: asset.signal_score,
    risk_state: asset.risk_state,
    launch_surface: launchByTicker.get(asset.ticker) ?? null,
    infopunks_verdict: asset.infopunks_verdict,
    receipt_state: receiptState.get(asset.ticker) ?? 'index_memory',
    source: asset.source
  }));
  const highestRisk = index.overview.highest_risk;
  const topVolume = index.overview.highest_volume;
  const strongestNarrative = receipts.latest_receipt.strongest_narrative;
  const context = liveSnapshot?.live_snapshots_enabled && liveSnapshot.cache_status === 'fresh'
    ? 'Cached external context attached; human review still governs.'
    : 'External snapshot unavailable or disabled; receipt memory governs.';

  return {
    title: 'RH Meme Pulse',
    subtitle: 'What’s moving. What’s risky. What the market is trying to say.',
    generated_at: receipts.generated_at,
    last_updated: index.last_updated,
    doctrine: DOCTRINE,
    disclaimer: DISCLAIMER,
    freshness_state: getRhChainFreshnessState(index.last_updated, index.assets[0]?.source.data_mode ?? 'unavailable'),
    snapshot: {
      flagship_signal: `${index.overview.top_signal.ticker} · ${index.overview.top_signal.classification}`,
      top_volume_rotation: `${topVolume.ticker} · volume score ${topVolume.volume_score}/25`,
      highest_risk_attention: `${highestRisk.ticker} · ${highestRisk.risk_state}`,
      strongest_narrative_mutation: strongestNarrative,
      latest_receipt: `${receipts.latest_receipt.receipt_id} · ${receipts.latest_receipt.headline}`,
      last_updated: `${index.last_updated} · ${context}`
    },
    top_attention_assets,
    launchpad_stress: [
      { id: 'launchpad-economics', title: 'Launchpad Economics', summary: 'NOXA creator-fee shift, rival surface rotation, direct Uniswap migration, and source-required fee/burn claims are tracked as context until primary evidence exists.', risk_state: 'source_required' },
      { id: 'noxa-disruption', title: 'NOXA disruption', summary: 'Reported degradation is manual, source-dependent context only; it does not establish misconduct or intent.', risk_state: 'source_required' },
      { id: 'rival-surface-rotation', title: 'Rival surface rotation', summary: 'flap.sh, trensh.today, bankr, tokeny.fun, vlad.fun, and robindotmarket are watched as source-required context unless primary evidence is attached.', risk_state: 'source_required' },
      { id: 'direct-uniswap-liquidity', title: 'Direct Uniswap liquidity migration', summary: 'Direct-pool attention can move before reserves, LP status, and exit depth are independently receipted.', risk_state: 'medium_watch' },
      { id: 'competitor-claims', title: 'Competitor claims', summary: 'Competitor activity and share claims remain source_required; no exact figures are inferred from desk memory.', risk_state: 'source_required' }
    ],
    risk_strip: [
      ...desk.risk_wall.map((item) => ({ id: item.id, title: item.title, summary: item.summary, risk_state: item.risk_state })),
      ...receipts.latest_receipt.do_not_touch_yet.map((item) => ({ id: `receipt-${item.item}`, title: item.item, summary: item.reason, risk_state: item.risk_state }))
    ].slice(0, 6),
    market_translation: [
      { id: 'hood', trend: 'Hood meta', translation: 'Brand-adjacent attention is competing for a familiar retail shorthand.', caveat: 'Familiarity is not affiliation, verification, or safety.' },
      { id: 'cat', trend: 'Cat meta', translation: 'Mascot repetition is concentrating attention into easily copied symbols.', caveat: 'Clone risk rises faster than identity certainty.' },
      { id: 'stock-token', trend: 'Stock-token spillover', translation: 'Markets are testing whether meme attention can point toward tokenized-equity narratives.', caveat: 'Narrative interest is not proof of product usage or partnership.' },
      { id: 'solana', trend: 'Solana rotation', translation: 'Cross-chain attention may be looking for the next familiar liquidity pattern.', caveat: 'Rotation is context only; routes and liquidity require receipts.' },
      { id: 'ai-agent', trend: 'AI-agent angle', translation: 'Agentic finance framing is entering meme language as a distribution story.', caveat: 'No agent claim upgrades a token or market-memory record.' },
      { id: 'retail', trend: 'Robinhood retail onboarding', translation: 'Retail onboarding is the durable question under the attention layer.', caveat: 'Infopunks is independent and does not imply a Robinhood relationship.' }
    ]
  };
}
