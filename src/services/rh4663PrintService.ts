/**
 * PRINT is a published market-state evidence object. It deliberately is not a
 * protocol receipt: CALL and RESOLUTION receipts retain their signed,
 * deterministic meaning. A PRINT can be corrected as sources improve, with
 * the observation window and methodology kept beside every published metric.
 */
export type Rh4663PrintMetric = {
  id: string;
  label: string;
  value: string;
  unit: string;
  qualifier?: string;
  source: { label: string; href: string };
  window_type: 'utc_calendar_day' | 'rolling_24h' | 'historical_reported_range';
  observed_at: string;
  window_start: string;
  window_end: string;
  methodology: string;
  freshness: 'reported' | 'observed' | 'derived';
  confidence: number;
};

export type Rh4663PrintDriver = {
  category: 'MEMES' | 'DEX / LIQUIDITY' | 'INFRA' | 'STABLES' | 'RWA' | 'AGENTS';
  direction: '↑↑↑' | '↑↑' | '↑' | '→';
  detail: string;
};

export type Rh4663PrintLayerRead = {
  layer: 'MEMES' | 'INFRASTRUCTURE' | 'RWA / STOCK TOKENS' | 'AGENTS' | 'STABLECOINS / TVL';
  state: 'VERY HOT' | 'CONSTRUCTIVE' | 'QUIETER THIS WINDOW' | 'BACKGROUND' | 'STRONG';
  direction: '↑↑↑' | '↑' | '→';
  explanation: string;
  evidence_ids: string[];
};

export type Rh4663PrintEvidenceReference = { id: string; label: string; href: string; note: string };

export type Rh4663Print = {
  print_id: 'rh-print-2026-08-30';
  canonical_path: '/4663/print/2026-08-30';
  printed_at: string;
  status: 'published';
  receipt_kind: 'MARKET_STATE_EVIDENCE';
  campaign_snapshot: true;
  data_mode: 'editorial_campaign_snapshot';
  title: 'ROBINHOOD CHAIN IS RUNNING HOT';
  regime: 'SPECULATIVE EXPANSION';
  methodology_notice: string;
  correction_notice: string;
  metrics: Rh4663PrintMetric[];
  drivers: Rh4663PrintDriver[];
  layer_read: Rh4663PrintLayerRead[];
  evidence_references: Rh4663PrintEvidenceReference[];
  campaign_copy: { primary: string; secondary: string; call_to_action: string; receipt_line: string };
  share: { landscape: string; square: string; portrait: string };
  interpretation: string;
  call: { question: string; evidence_path: '/4663/print/2026-08-30'; default_confidence: 74 };
};

const august30Start = '2026-08-30T00:00:00.000Z';
const august31Start = '2026-08-31T00:00:00.000Z';

/** The first canonical 4663 PRINT; values retain the reporting window that produced them. */
export const RH_4663_PRINT_0830: Rh4663Print = {
  print_id: 'rh-print-2026-08-30',
  canonical_path: '/4663/print/2026-08-30',
  printed_at: '2026-08-31T12:00:00.000Z',
  status: 'published',
  receipt_kind: 'MARKET_STATE_EVIDENCE',
  campaign_snapshot: true,
  data_mode: 'editorial_campaign_snapshot',
  title: 'ROBINHOOD CHAIN IS RUNNING HOT',
  regime: 'SPECULATIVE EXPANSION',
  methodology_notice: 'Every figure names its source, observation window, method, freshness, and confidence. Different windows are not interchangeable.',
  correction_notice: 'Transaction ATH is supported. August 30 UTC-day DEX volume is not presented as the calendar-day DEX ATH: reporting places Aug 25 around $920–944M, while a separate rolling 24h snapshot exceeded $1.0B.',
  metrics: [
    {
      id: 'transactions', label: 'TRANSACTION ATH', value: '5.52M', unit: 'transactions', qualifier: 'ATH',
      source: { label: 'Cryptopolitan / Dune attribution', href: 'https://www.cryptopolitan.com/robinhood-chain-record-dex-volume-transactions/' }, window_type: 'utc_calendar_day', observed_at: '2026-08-31T00:00:00.000Z', window_start: august30Start, window_end: august31Start,
      methodology: 'Reported calendar-day on-chain transaction count for Aug 30 UTC.', freshness: 'reported', confidence: 88
    },
    {
      id: 'utc_dex_volume', label: 'AUG 30 UTC DEX VOLUME', value: '$874.8M', unit: 'USD',
      source: { label: 'Cryptopolitan / DefiLlama attribution', href: 'https://www.cryptopolitan.com/robinhood-chain-record-dex-volume-transactions/' }, window_type: 'utc_calendar_day', observed_at: '2026-08-31T00:00:00.000Z', window_start: august30Start, window_end: august31Start,
      methodology: 'Reported DEX volume for the fixed Aug 30 UTC calendar day.', freshness: 'reported', confidence: 82
    },
    {
      id: 'rolling_dex_volume', label: 'ROLLING 24H PEAK', value: '>$1.0B', unit: 'USD', qualifier: 'observed',
      source: { label: 'DefiLlama snapshot, reported contemporaneously', href: 'https://defillama.com/chain/Robinhood' }, window_type: 'rolling_24h', observed_at: '2026-08-30T23:59:00.000Z', window_start: '2026-08-29T23:59:00.000Z', window_end: '2026-08-30T23:59:00.000Z',
      methodology: 'Rolling 24-hour dashboard snapshot; not a UTC calendar-day total.', freshness: 'reported', confidence: 65
    },
    {
      id: 'calendar_day_ath', label: 'CALENDAR-DAY DEX ATH', value: '~$920–944M', unit: 'USD', qualifier: 'AUG 25',
      source: { label: 'Multi-source reporting comparison', href: 'https://defillama.com/chain/Robinhood' }, window_type: 'historical_reported_range', observed_at: '2026-08-31T12:00:00.000Z', window_start: '2026-08-25T00:00:00.000Z', window_end: '2026-08-26T00:00:00.000Z',
      methodology: 'Range retained because published calendar-day reports differ; this is why Aug 30 is not labelled the DEX-volume ATH.', freshness: 'reported', confidence: 60
    },
    {
      id: 'pons_volume', label: 'PONS.FAMILY-ASSOCIATED VOLUME', value: '$445.98M', unit: 'USD', qualifier: '~51% of Aug 30 chain DEX volume',
      source: { label: 'Cryptopolitan / Dune attribution', href: 'https://www.cryptopolitan.com/robinhood-chain-record-dex-volume-transactions/' }, window_type: 'utc_calendar_day', observed_at: '2026-08-31T00:00:00.000Z', window_start: august30Start, window_end: august31Start,
      methodology: 'Reported pons.family-associated trading volume divided by the reported Aug 30 UTC chain DEX total.', freshness: 'derived', confidence: 80
    }
  ],
  drivers: [
    { category: 'MEMES', direction: '↑↑↑', detail: 'Pons + launchpad activity' },
    { category: 'DEX / LIQUIDITY', direction: '↑↑', detail: 'Uniswap remains core execution layer' },
    { category: 'INFRA', direction: '↑', detail: 'Orderly → 130+ perp markets' },
    { category: 'STABLES', direction: '↑', detail: 'Capital base remains strong' },
    { category: 'RWA', direction: '→', detail: 'Growing, but did not own this window' },
    { category: 'AGENTS', direction: '→', detail: 'No breakout event' }
  ],
  layer_read: [
    { layer: 'MEMES', state: 'VERY HOT', direction: '↑↑↑', explanation: 'Launchpad activity dominated the reported Aug 30 tape.', evidence_ids: ['pons_volume', 'transactions'] },
    { layer: 'INFRASTRUCTURE', state: 'CONSTRUCTIVE', direction: '↑', explanation: 'Orderly brought 130+ perpetual markets; it expanded the rails rather than driving this print.', evidence_ids: ['orderly_launch'] },
    { layer: 'RWA / STOCK TOKENS', state: 'QUIETER THIS WINDOW', direction: '→', explanation: 'Structurally important rails were present, but did not own this observation window.', evidence_ids: ['campaign_interpretation'] },
    { layer: 'AGENTS', state: 'BACKGROUND', direction: '→', explanation: 'No breakout agent event is asserted for this campaign snapshot.', evidence_ids: ['campaign_interpretation'] },
    { layer: 'STABLECOINS / TVL', state: 'STRONG', direction: '↑', explanation: 'Capital conditions remained constructive beneath the attention spike.', evidence_ids: ['campaign_interpretation'] }
  ],
  evidence_references: [
    { id: 'orderly_launch', label: 'Orderly Robinhood Chain launch / 130+ markets', href: 'https://cryptobriefing.com/orderly-robinhood-chain-no-code-perp-dex/', note: 'Constructive infrastructure context; not treated as the primary driver of the Aug 30 activity spike.' },
    { id: 'campaign_interpretation', label: 'Campaign interpretation methodology', href: '/4663/print/2026-08-30', note: 'Editorial layer read derived from the cited campaign snapshot. It does not assert unsupported quantitative precision.' }
  ],
  campaign_copy: { primary: 'THE CHAIN WAS BUILT FOR STOCKS.', secondary: 'THE INTERNET STARTED TRADING ATTENTION.', call_to_action: 'WHAT OWNS THE NEXT 24 HOURS?', receipt_line: 'EVERYONE HAS AN OPINION. INFOPUNKS HAS THE RECEIPT.' },
  share: { landscape: '/og/4663/prints/rh-print-2026-08-30.png', square: '/og/4663/prints/rh-print-2026-08-30.png?format=square', portrait: '/og/4663/prints/rh-print-2026-08-30.png?format=portrait' },
  interpretation: 'The chain was built around programmable finance. The current growth engine is permissionless speculation.',
  call: { question: 'Which category wins the next observation window?', evidence_path: '/4663/print/2026-08-30', default_confidence: 74 }
};

export function getRh4663Print(printId: string): Rh4663Print | null {
  return ['0830', '2026-08-30', 'rh-print-2026-08-30'].includes(printId) ? RH_4663_PRINT_0830 : null;
}

export function getLatestRh4663Print(): Rh4663Print { return RH_4663_PRINT_0830; }
