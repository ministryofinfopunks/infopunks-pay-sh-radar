import {
  createRhChainSource,
  getRhChain4663Index,
  getRhChainDailyReceipts,
  type RhChain4663IndexPayload,
  type RhChainCloneRadarPayload,
  type RhChainDailyReceipt,
  type RhChainDailyReceiptsPayload,
  type RhChainMemePulsePayload,
  type RhChainRiskState,
  type RhChainSource
} from '../data/rhChain';
import { assembleRhChainCloneRadar } from './rhChainCloneRadarService';
import { assembleRhChainMemePulseScreen } from './rhChainMemePulseService';
import { getRhChainFreshnessState, type RhChainFreshnessState } from './rhChainTruthGuards';
import { getRhChain100ReceiptsCampaign } from '../data/rhChain100Receipts';

export type RhChainTodayOn4663Card = {
  id: 'top_signal' | 'biggest_risk' | 'latest_receipt' | 'highest_attention_move';
  title: string;
  verdict: string;
  href: string;
  source: RhChainSource;
  freshness_state: RhChainFreshnessState;
  judgment_state: 'reviewed_memory' | 'requires_review' | 'attention_context';
};

export type RhChainTodayOn4663Payload = {
  title: 'Today on 4663';
  generated_at: string;
  source_policy: string;
  disclaimer: string;
  doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.';
  data_mode: 'manual' | 'manual_fallback';
  freshness_state: RhChainFreshnessState;
  storage_status: 'available' | 'unavailable';
  caveats: string[];
  latest_receipt: RhChainDailyReceipt;
  cards: RhChainTodayOn4663Card[];
};

type TodayOptions = {
  dailyReceipts?: RhChainDailyReceiptsPayload;
  index?: RhChain4663IndexPayload;
  cloneRadar?: RhChainCloneRadarPayload;
  memePulse?: RhChainMemePulsePayload;
  data_mode?: 'manual' | 'manual_fallback';
  freshness_state?: RhChainFreshnessState;
  storage_status?: 'available' | 'unavailable';
};

const riskPriority: Record<RhChainRiskState, number> = {
  do_not_touch_yet: 0,
  high_risk: 1,
  source_required: 2,
  medium_watch: 3,
  low_watch: 4
};

/** A compact, read-only conversion surface built only from existing desk memory. */
export function assembleRhChainTodayOn4663(options: TodayOptions = {}): RhChainTodayOn4663Payload {
  const dailyReceipts = options.dailyReceipts ?? getRhChainDailyReceipts();
  const index = options.index ?? getRhChain4663Index();
  const cloneRadar = options.cloneRadar ?? assembleRhChainCloneRadar();
  const memePulse = options.memePulse ?? assembleRhChainMemePulseScreen();
  const campaign = getRhChain100ReceiptsCampaign();
  const campaignTopSignal = campaign.assets.find((asset) => asset.ticker === 'CASHCAT') ?? campaign.assets[0];
  const latest = dailyReceipts.latest_receipt;
  const topSignal = index.assets[0];
  const risk = [...cloneRadar.active_warnings].sort((left, right) => riskPriority[left.risk_state] - riskPriority[right.risk_state])[0];
  const indexRisk = index.assets.find((asset) => asset.ticker === index.overview.highest_risk.ticker) ?? topSignal;
  const attention = memePulse.top_attention_assets[0] ?? null;
  const fallbackSource = createRhChainSource({
    source_name: 'Infopunks manual 4663 fallback',
    source_url: '/rh-chain-signal-desk/daily-receipts/rh_daily_004',
    observed_at: latest.observed_at ?? latest.generated_at,
    updated_at: latest.generated_at,
    data_mode: 'manual',
    confidence_level: 'low',
    note: 'Static desk-memory fallback. Review the linked receipt before repeating any claim.'
  });
  const receiptSource = latest.sources[0] ?? fallbackSource;
  const latestFreshness = options.freshness_state ?? latest.freshness_state ?? getRhChainFreshnessState(latest.observed_at ?? latest.generated_at, latest.data_mode);
  const indexFreshness = getRhChainFreshnessState(index.last_updated, topSignal?.source.data_mode ?? 'manual');
  const riskFreshness = risk ? getRhChainFreshnessState(risk.updated_at, risk.data_mode) : indexFreshness;
  const attentionFreshness = attention ? getRhChainFreshnessState(attention.source.updated_at, attention.source.data_mode) : indexFreshness;
  const campaignSource = createRhChainSource({
    source_name: '100 Receipts · Day 1 reviewed campaign memory',
    source_url: '/rh-chain-signal-desk/100-receipts',
    observed_at: campaign.generated_at,
    updated_at: campaign.generated_at,
    data_mode: 'manual',
    confidence_level: 'medium',
    note: campaign.source_policy
  });

  return {
    title: 'Today on 4663',
    generated_at: latest.generated_at,
    source_policy: 'Today on 4663 compresses existing reviewed receipts, manual 4663 index memory, and risk cues. Provider context may describe attention but cannot become a reviewed judgment.',
    disclaimer: 'Today on 4663 is public intelligence context, not financial advice, endorsement, a safety determination, listing, or an official Robinhood partnership.',
    doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
    data_mode: options.data_mode ?? 'manual',
    freshness_state: options.freshness_state ?? latestFreshness,
    storage_status: options.storage_status ?? 'available',
    caveats: [
      'Daily Receipt is the reviewed editorial record; attention context does not override it.',
      'Risk alerts are review cues, not definitive misconduct findings or safety determinations.',
      'Provider-only data remains context and is never promoted to reviewed judgment.'
    ],
    latest_receipt: latest,
    cards: [
      {
        id: 'top_signal', title: 'Top Signal',
        verdict: campaignTopSignal ? `${campaignTopSignal.ticker} · ${campaignTopSignal.classification_note}` : topSignal ? `${topSignal.ticker} · ${topSignal.infopunks_verdict}` : 'No reviewed 4663 index item is available.',
        href: campaignTopSignal?.dossier_route ?? '/rh-chain-signal-desk/4663-index', source: campaignTopSignal ? campaignSource : topSignal?.source ?? fallbackSource,
        freshness_state: campaignTopSignal ? getRhChainFreshnessState(campaign.generated_at, 'manual') : indexFreshness, judgment_state: 'reviewed_memory'
      },
      {
        id: 'biggest_risk', title: 'Biggest Risk',
        verdict: risk ? risk.evidence_summary : indexRisk ? `${indexRisk.ticker} · ${indexRisk.infopunks_verdict}` : 'No risk alert is currently represented in public desk memory.',
        href: '/rh-chain-signal-desk/clone-radar', source: risk ? {
          source_name: 'Clone & Impersonator Radar', source_url: '/rh-chain-signal-desk/clone-radar', observed_at: risk.observed_at, updated_at: risk.updated_at,
          data_mode: risk.data_mode, confidence_level: risk.confidence_level, note: risk.source_notes.join(' ')
        } : indexRisk?.source ?? fallbackSource,
        freshness_state: riskFreshness, judgment_state: 'requires_review'
      },
      {
        id: 'latest_receipt', title: 'Latest Receipt', verdict: latest.headline,
        href: `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(latest.receipt_id)}`,
        source: receiptSource, freshness_state: latestFreshness, judgment_state: 'reviewed_memory'
      },
      {
        id: 'highest_attention_move', title: 'Highest Attention Move',
        verdict: attention ? `${attention.ticker} · ${attention.infopunks_verdict}` : 'Attention context is unavailable; use the latest receipt.',
        href: '/rh-chain-signal-desk/meme-pulse', source: attention?.source ?? fallbackSource,
        freshness_state: attentionFreshness, judgment_state: 'attention_context'
      }
    ]
  };
}
