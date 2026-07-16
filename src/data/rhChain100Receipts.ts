export const RH_CHAIN_100_RECEIPTS_ROUTE = '/rh-chain-signal-desk/100-receipts';

export type RhChain100ReceiptsEvidenceState =
  | 'approved_signal'
  | 'watch_only'
  | 'under_receipt_check'
  | 'source_required';

export type RhChain100ReceiptsClassification =
  | 'durable_signal'
  | 'attention_spike'
  | 'launchpad_rotation_signal'
  | 'narrative_candidate'
  | 'defi_gateway_candidate';

export type RhChain100ReceiptsRiskState =
  | 'profit_taking_pressure'
  | 'volatility_after_strong_move'
  | 'fee_claim_source_required'
  | 'lower_liquidity_plus_quick_intel_flag'
  | 'utility_claim_source_required';

export type RhChain100ReceiptsAttribution = 'Signal Desk public visibility' | 'User-provided intake';

export const RH_CHAIN_100_RECEIPTS_OUTCOME_QUESTIONS = [
  'Did liquidity remain?',
  'Did volume collapse or normalize?',
  'Did evidence improve?',
  'Did deployer/creator context become clearer?',
  'Did clone risk rise?',
  'Did classification need downgrade or upgrade?'
] as const;

export type RhChain100ReceiptsAsset = {
  ticker: string;
  contract: string;
  dexscreener_pair: string;
  explorer: string;
  launch_surface: string;
  website_or_x: string | null;
  evidence_state: RhChain100ReceiptsEvidenceState;
  classification: RhChain100ReceiptsClassification;
  risk_state: RhChain100ReceiptsRiskState;
  classification_note: string;
  missing_evidence: string[];
  reviewed_at: string;
  outcome_check_due_at: string;
  seven_day_outcome: 'pending';
  outcome_check_questions: readonly string[];
  attribution: RhChain100ReceiptsAttribution;
  visibility_context: 'Signal Desk public visibility';
  dossier_route: string;
  index_context: 'reviewed_campaign_memory';
  source_links: Array<{ label: string; url: string }>;
};

export type RhChain100ReceiptsTopRole =
  | 'Top Signal'
  | 'Biggest Rotation'
  | 'Strongest Meme Culture Fit'
  | 'Narrative Watch'
  | 'Utility Claim Under Review';

export type RhChain100ReceiptsCampaign = {
  campaign_id: 'rh_chain_100_tokens_100_receipts';
  title: '100 Tokens. 100 Receipts. One Public Memory.';
  generated_at: string;
  data_mode: 'manual';
  source_policy: string;
  disclaimer: string;
  batch: {
    batch_id: 'rh_100_receipts_day_001';
    day_number: 1;
    theme: 'Flagship attention, post-NOXA rotation, and first utility claims';
    reviewed_count: 5;
    total_reviewed_count: 5;
  };
  assets: RhChain100ReceiptsAsset[];
  daily_top_5: Array<{ role: RhChain100ReceiptsTopRole; ticker: string; contract: string; dossier_route: string }>;
};

const GENERATED_AT = '2026-07-16T00:00:00.000Z';
const OUTCOME_CHECK_DUE_AT = '2026-07-23T00:00:00.000Z';

function dossierRoute(contract: string) {
  return `/rh-chain-signal-desk/tokens/${encodeURIComponent(contract)}`;
}

function asset(input: Omit<RhChain100ReceiptsAsset, 'reviewed_at' | 'outcome_check_due_at' | 'outcome_check_questions' | 'dossier_route' | 'index_context' | 'source_links' | 'visibility_context'>): RhChain100ReceiptsAsset {
  return {
    ...input,
    reviewed_at: GENERATED_AT,
    outcome_check_due_at: OUTCOME_CHECK_DUE_AT,
    outcome_check_questions: RH_CHAIN_100_RECEIPTS_OUTCOME_QUESTIONS,
    visibility_context: 'Signal Desk public visibility',
    dossier_route: dossierRoute(input.contract),
    index_context: 'reviewed_campaign_memory',
    source_links: [
      { label: 'DexScreener pair', url: input.dexscreener_pair },
      { label: 'Blockscout explorer', url: input.explorer }
    ]
  };
}

const assets: RhChain100ReceiptsAsset[] = [
  asset({
    ticker: 'CASHCAT',
    contract: '0x020bfC650A365f8BB26819deAAbF3E21291018b4',
    dexscreener_pair: 'https://dexscreener.com/robinhood/0xa70fc67c9f69da90b63a0e4c05d229954574e313',
    explorer: 'https://robinhoodchain.blockscout.com/token/0x020bfC650A365f8BB26819deAAbF3E21291018b4',
    launch_surface: 'NOXA',
    website_or_x: '@cashcat_token',
    evidence_state: 'approved_signal',
    classification: 'durable_signal',
    risk_state: 'profit_taking_pressure',
    classification_note: 'Flagship RH Chain attention asset with strong public visibility, liquidity context, and receipt trail. Approved signal means market-memory inclusion, not endorsement or safety.',
    missing_evidence: ['creator/deployer trace', 'updated liquidity snapshots', 'official source links if available'],
    seven_day_outcome: 'pending',
    attribution: 'Signal Desk public visibility'
  }),
  asset({
    ticker: 'TENDIES',
    contract: '0x45242320DBB855EeA8Fd36804C6487E10E97FCF9',
    dexscreener_pair: 'https://dexscreener.com/robinhood/0x237609918f330add285b8bc5f8f2922283d1c4c5',
    explorer: 'https://robinhoodchain.blockscout.com/token/0x45242320DBB855EeA8Fd36804C6487E10E97FCF9',
    launch_surface: 'Direct Uniswap V3',
    website_or_x: null,
    evidence_state: 'watch_only',
    classification: 'attention_spike',
    risk_state: 'volatility_after_strong_move',
    classification_note: 'Strong RH Chain trading-culture meme with notable liquidity and volume context, but recent sharp price action increases rotation/profit-taking risk.',
    missing_evidence: ['verified project accounts', 'creator wallet trace', 'updated holder/liquidity behavior'],
    seven_day_outcome: 'pending',
    attribution: 'User-provided intake'
  }),
  asset({
    ticker: 'PONS',
    contract: '0x39dBED3a2bd333467115dE45665cC57F813C4571',
    dexscreener_pair: 'https://dexscreener.com/robinhood/0x10cc6bd38112cac182db90b6a71d8bb5939526ba',
    explorer: 'https://robinhoodchain.blockscout.com/token/0x39dBED3a2bd333467115dE45665cC57F813C4571',
    launch_surface: 'Direct Uniswap V3 / self-described launchpad-related token',
    website_or_x: null,
    evidence_state: 'under_receipt_check',
    classification: 'launchpad_rotation_signal',
    risk_state: 'fee_claim_source_required',
    classification_note: 'Important post-NOXA launchpad-rotation signal. Fee-routing, buyback, burn, and launchpad dominance claims require primary/on-chain receipts before stronger classification.',
    missing_evidence: ['primary Pons source', 'fee routing evidence', 'buyback/burn tx evidence', 'creator wallet trace', 'updated launchpad share evidence'],
    seven_day_outcome: 'pending',
    attribution: 'User-provided intake'
  }),
  asset({
    ticker: 'HOODRAT',
    contract: '0x8e62F281f282686fCa6dCB39288069a93fC23F1c',
    dexscreener_pair: 'https://dexscreener.com/robinhood/0x451c0da3b774045a822a129eedcc5c667dcbfdd8',
    explorer: 'https://robinhoodchain.blockscout.com/token/0x8e62F281f282686fCa6dCB39288069a93fC23F1c',
    launch_surface: 'Direct Uniswap',
    website_or_x: null,
    evidence_state: 'watch_only',
    classification: 'narrative_candidate',
    risk_state: 'lower_liquidity_plus_quick_intel_flag',
    classification_note: 'Matt Furie / Robinhood mascot narrative candidate with active attention, but lower liquidity and Quick Intel issue keep it watch-only.',
    missing_evidence: ['verified project accounts', 'creator wallet trace', 'clearer narrative source trail', 'updated liquidity behavior'],
    seven_day_outcome: 'pending',
    attribution: 'User-provided intake'
  }),
  asset({
    ticker: 'ARROW',
    contract: '0xf2915d1e3C1B0c769d0c756Ec43F1c1f6c99cD03',
    dexscreener_pair: 'https://dexscreener.com/robinhood/0xe40d98d88038e0b844f844dce6ae3c79ec01ec53',
    explorer: 'https://robinhoodchain.blockscout.com/token/0xf2915d1e3C1B0c769d0c756Ec43F1c1f6c99cD03',
    launch_surface: 'Direct Uniswap',
    website_or_x: null,
    evidence_state: 'source_required',
    classification: 'defi_gateway_candidate',
    risk_state: 'utility_claim_source_required',
    classification_note: 'DeFi/utility narrative candidate. “Gateway for Robinhood DeFi” claims require project/source verification before stronger classification.',
    missing_evidence: ['verified project accounts', 'utility/product proof', 'audit/source links', 'creator wallet trace', 'updated liquidity behavior'],
    seven_day_outcome: 'pending',
    attribution: 'User-provided intake'
  })
];

const topRoles: Array<[RhChain100ReceiptsTopRole, string]> = [
  ['Top Signal', 'CASHCAT'],
  ['Biggest Rotation', 'PONS'],
  ['Strongest Meme Culture Fit', 'TENDIES'],
  ['Narrative Watch', 'HOODRAT'],
  ['Utility Claim Under Review', 'ARROW']
];

export const rhChain100ReceiptsCampaign: RhChain100ReceiptsCampaign = {
  campaign_id: 'rh_chain_100_tokens_100_receipts',
  title: '100 Tokens. 100 Receipts. One Public Memory.',
  generated_at: GENERATED_AT,
  data_mode: 'manual',
  source_policy: 'Day 1 is manually reviewed campaign memory. Provider context may add timestamps or market context but cannot replace evidence, classification, risk, or outcome fields.',
  disclaimer: 'Campaign inclusion is public intelligence memory, not endorsement, a safety determination, listing, financial advice, or an official Robinhood partnership.',
  batch: {
    batch_id: 'rh_100_receipts_day_001',
    day_number: 1,
    theme: 'Flagship attention, post-NOXA rotation, and first utility claims',
    reviewed_count: 5,
    total_reviewed_count: 5
  },
  assets,
  daily_top_5: topRoles.map(([role, ticker]) => {
    const match = assets.find((item) => item.ticker === ticker)!;
    return { role, ticker, contract: match.contract, dossier_route: match.dossier_route };
  })
};

export function getRhChain100ReceiptsCampaign(): RhChain100ReceiptsCampaign {
  return structuredClone(rhChain100ReceiptsCampaign);
}

export function findRhChain100ReceiptsAsset(contract: string): RhChain100ReceiptsAsset | null {
  const normalized = contract.trim().toLowerCase();
  return rhChain100ReceiptsCampaign.assets.find((item) => item.contract.toLowerCase() === normalized) ?? null;
}
