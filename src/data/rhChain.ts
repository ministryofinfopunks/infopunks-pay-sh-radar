export type RhChainSignalLabel =
  | 'fresh_signal'
  | 'attention_spike'
  | 'durable_candidate'
  | 'liquidity_mirage'
  | 'deployer_cluster_risk'
  | 'top_holder_risk'
  | 'stock_token_spillover'
  | 'do_not_touch_yet';

export type RhChainRiskState = 'low_watch' | 'medium_watch' | 'high_risk' | 'source_required' | 'do_not_touch_yet';

export type RhChainSource = {
  source: string;
  observed_at: string;
  url: string | null;
  caveat: string;
};

export type RhChainPulseMetric = {
  id: string;
  label: string;
  value: string;
  state: 'live_required' | 'watching' | 'source_pending' | 'seeded';
  note: string;
  source: RhChainSource;
};

export type RhChainProtocolWatch = {
  name: string;
  category: string;
  status: string;
  note: string;
  source: RhChainSource;
};

export type RhChainMemeToken = {
  rank: number;
  ticker: string;
  name: string;
  contract: string;
  market_cap: string;
  volume_24h: string;
  liquidity: string;
  holder_notes: string;
  risk_state: RhChainRiskState;
  signal_labels: RhChainSignalLabel[];
  infopunks_verdict: string;
  source: RhChainSource;
};

export type RhChainSignalClassifierItem = {
  label: RhChainSignalLabel;
  meaning: string;
  trigger: string;
  desk_action: string;
};

export type RhChainRiskWallItem = {
  id: string;
  title: string;
  risk_state: RhChainRiskState;
  summary: string;
  evidence_needed: string[];
  source: RhChainSource;
};

export type RhChainSpilloverTheme = {
  id: string;
  finance_theme: string;
  meme_mutation: string;
  signal_read: string;
  risk_note: string;
};

export type RhChainSignalIndexAsset = {
  rank: number;
  asset: string;
  ticker: string;
  signal_score: number;
  labels: RhChainSignalLabel[];
  attention_source: string;
  receipt_state: string;
  note: string;
};

export type RhChainReceipt = {
  receipt_id: string;
  timestamp: string;
  source: string;
  summary: string;
  linked_assets: string[];
  caveat: string;
};

export type RhChainSignalSubmissionInput = {
  token_contract: string;
  ticker: string;
  chain?: string;
  x_twitter_link?: string;
  website_link?: string;
  liquidity_link?: string;
  deployer_notes?: string;
  submitter_notes?: string;
  disclosure_confirmed: boolean;
};

export type RhChainSignalReviewPacket = {
  submission_id: string;
  submitted_at: string;
  token_contract: string;
  ticker: string;
  chain: string;
  links: {
    x_twitter: string | null;
    website: string | null;
    liquidity: string | null;
  };
  deployer_notes: string | null;
  submitter_notes: string | null;
  disclosure_confirmed: boolean;
  review_status: 'queued_for_manual_review';
  next_step: 'Infopunks will review the signal manually before adding it to the public desk.';
};

export type RhChainPayload = {
  title: string;
  subtitle: string;
  generated_at: string;
  last_updated: string;
  disclaimer: string;
  source_policy: string;
  chain_pulse: {
    metrics: RhChainPulseMetric[];
    top_protocols: RhChainProtocolWatch[];
    bridge_notes: string[];
  };
  meme_pulse: RhChainMemeToken[];
  signal_classifier: RhChainSignalClassifierItem[];
  risk_wall: RhChainRiskWallItem[];
  stock_token_spillover_map: RhChainSpilloverTheme[];
  signal_index_4663: RhChainSignalIndexAsset[];
  receipts: RhChainReceipt[];
};

const OBSERVED_AT = '2026-07-09T03:45:00.000Z';

const seededDeskSource: RhChainSource = {
  source: 'Infopunks seeded RH Chain watchlist',
  observed_at: OBSERVED_AT,
  url: 'https://radar.infopunks.fun/rh-chain-signal-desk',
  caveat: 'Seeded intelligence scaffold. Volatile market metrics require live source verification before use.'
};

const sourcePending: RhChainSource = {
  source: 'source_pending',
  observed_at: OBSERVED_AT,
  url: null,
  caveat: 'No canonical live source attached yet. Treat this field as a watch slot, not verified market data.'
};

export const rhChainPayload: RhChainPayload = {
  title: 'RH Chain Signal Desk',
  subtitle: 'Wall Street rails. Meme liquidity. Infopunks intelligence.',
  generated_at: OBSERVED_AT,
  last_updated: OBSERVED_AT,
  disclaimer: 'Independent Infopunks intelligence surface. Not affiliated with, endorsed by, or partnered with Robinhood. No buy, sell, or listing recommendation.',
  source_policy: 'Every volatile metric must carry a source and observed_at timestamp. Unknown market data is labeled source_pending instead of guessed.',
  chain_pulse: {
    metrics: [
      {
        id: 'tvl',
        label: 'TVL',
        value: 'source pending',
        state: 'live_required',
        note: 'Desk slot reserved for chain-level TVL once an auditable explorer or DefiLlama-style source is attached.',
        source: sourcePending
      },
      {
        id: 'dex_volume',
        label: 'DEX volume',
        value: 'source pending',
        state: 'live_required',
        note: 'Requires pool-level receipts. Thin launch volume can be wash-heavy until routed through durable venues.',
        source: sourcePending
      },
      {
        id: 'stock_token_activity',
        label: 'Stock Token activity',
        value: 'narrative watch',
        state: 'watching',
        note: 'Tracking finance-token themes as narrative inputs before treating them as liquidity proof.',
        source: seededDeskSource
      },
      {
        id: 'stablecoin_liquidity',
        label: 'Stablecoin liquidity',
        value: 'source pending',
        state: 'live_required',
        note: 'Bridgeable stable liquidity is the first proof line before meme assets become agent-spend relevant.',
        source: sourcePending
      },
      {
        id: 'attention_velocity',
        label: 'Attention velocity',
        value: '4663 watch active',
        state: 'seeded',
        note: 'Seeded index watches tickers, contract disclosures, route chatter, and stock-token spillover language.',
        source: seededDeskSource
      }
    ],
    top_protocols: [
      {
        name: 'Stock-token wrapper lanes',
        category: 'finance primitive',
        status: 'watching',
        note: 'Finance rails can become meme rails when ticker identity turns into trench language.',
        source: seededDeskSource
      },
      {
        name: 'DEX launch venues',
        category: 'liquidity venue',
        status: 'source required',
        note: 'No pool should be promoted without contract, reserve, and holder receipts.',
        source: sourcePending
      },
      {
        name: 'Bridge adapters',
        category: 'migration rail',
        status: 'source required',
        note: 'Bridge claims require proof of route, canonical asset, and failure mode before agent routing.',
        source: sourcePending
      }
    ],
    bridge_notes: [
      'Treat bridge screenshots as claims until routes, contracts, and receipts match.',
      'Stablecoin depth matters more than headline meme volume.',
      'Liquidity migration is signal only when it survives first rotation and holder concentration checks.'
    ]
  },
  meme_pulse: [
    {
      rank: 1,
      ticker: 'HOOD',
      name: 'Hood Rail',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Ticker attention likely to cluster around brand-adjacent language. Verify non-affiliation and distribution before indexing.',
      risk_state: 'source_required',
      signal_labels: ['fresh_signal', 'stock_token_spillover', 'top_holder_risk'],
      infopunks_verdict: 'Watch the receipts. Do not treat ticker familiarity as proof.',
      source: sourcePending
    },
    {
      rank: 2,
      ticker: 'RAILS',
      name: 'Wall Street Rails',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Narrative clarity is high, but contract provenance is unverified.',
      risk_state: 'medium_watch',
      signal_labels: ['attention_spike', 'stock_token_spillover'],
      infopunks_verdict: 'Good meme shape. Needs liquidity and deployer proof.',
      source: sourcePending
    },
    {
      rank: 3,
      ticker: 'SHERW',
      name: 'Sherwood Loop',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Brand-adjacent myth is strong enough to attract copycats. Receipts decide.',
      risk_state: 'high_risk',
      signal_labels: ['deployer_cluster_risk', 'liquidity_mirage', 'do_not_touch_yet'],
      infopunks_verdict: 'Do not touch yet. Verify deployer history first.',
      source: sourcePending
    },
    {
      rank: 4,
      ticker: 'IPO',
      name: 'Meme IPO Desk',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Stock-token language can mutate into launchpad speculation. Holder surface not proven.',
      risk_state: 'source_required',
      signal_labels: ['fresh_signal', 'stock_token_spillover'],
      infopunks_verdict: 'Potential narrative bridge. Needs contract and pool receipts.',
      source: sourcePending
    },
    {
      rank: 5,
      ticker: 'DIVY',
      name: 'Dividend Mirage',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Yield language invites misleading claims. Any dividend framing needs hard proof.',
      risk_state: 'do_not_touch_yet',
      signal_labels: ['top_holder_risk', 'do_not_touch_yet'],
      infopunks_verdict: 'High claim risk. Receipts before memory.',
      source: sourcePending
    },
    {
      rank: 6,
      ticker: 'TICKR',
      name: 'Ticker Memory',
      contract: 'unverified_contract_required',
      market_cap: 'source pending',
      volume_24h: 'source pending',
      liquidity: 'source pending',
      holder_notes: 'Pure ticker abstraction. Useful for tracking attention migration, not enough for conviction.',
      risk_state: 'medium_watch',
      signal_labels: ['fresh_signal', 'attention_spike'],
      infopunks_verdict: 'Signal object, not a verdict object.',
      source: sourcePending
    }
  ],
  signal_classifier: [
    {
      label: 'fresh_signal',
      meaning: 'A new RH Chain narrative asset or contract enters the desk.',
      trigger: 'First credible contract, pool, social burst, or receipt submission.',
      desk_action: 'Stage it. Demand source, timestamp, contract, and non-affiliation language.'
    },
    {
      label: 'attention_spike',
      meaning: 'Attention moves faster than liquidity proof.',
      trigger: 'Mention velocity, search traffic, or DEX watchlist jumps without matching holder quality.',
      desk_action: 'Track for 24-72 hours. Do not upgrade without receipts.'
    },
    {
      label: 'durable_candidate',
      meaning: 'Signal persists beyond the first reflexive rotation.',
      trigger: 'Repeated volume, stable liquidity, wider holder base, and narrative reuse.',
      desk_action: 'Move from watch to candidate only after liquidity and holder checks.'
    },
    {
      label: 'liquidity_mirage',
      meaning: 'Market cap or volume overstates exit depth.',
      trigger: 'Thin pool, suspicious volume, one-sided LP, or vanishing route depth.',
      desk_action: 'Mark high risk. Show pool receipts before allowing attention upgrade.'
    },
    {
      label: 'deployer_cluster_risk',
      meaning: 'A launch appears connected to repeated copycat or extraction deployers.',
      trigger: 'Shared deployer wallet, funding path, contract template, or clustered launches.',
      desk_action: 'Move to Risk Wall until deployer history is explained.'
    },
    {
      label: 'top_holder_risk',
      meaning: 'Supply control can overpower the meme.',
      trigger: 'Top wallets, team wallets, or fresh wallets hold concentrated supply.',
      desk_action: 'Require holder receipts and unlock context.'
    },
    {
      label: 'stock_token_spillover',
      meaning: 'Finance-token language mutates into meme-market language.',
      trigger: 'Equity tickers, dividends, IPO, brokerage, or Wall Street rails become meme primitives.',
      desk_action: 'Map theme mutation. Avoid official partnership implication.'
    },
    {
      label: 'do_not_touch_yet',
      meaning: 'The desk has enough risk to block promotion.',
      trigger: 'Unverified contract plus low liquidity, misleading claims, or deployer concentration.',
      desk_action: 'Keep visible on Risk Wall. No signal upgrade.'
    }
  ],
  risk_wall: [
    {
      id: 'unverified-contracts',
      title: 'Unverified Contracts',
      risk_state: 'do_not_touch_yet',
      summary: 'Any RH Chain meme slot without a verified contract remains a claim, not a market signal.',
      evidence_needed: ['Contract address', 'Explorer link', 'Deployer wallet', 'Pool address', 'Observed_at timestamp'],
      source: sourcePending
    },
    {
      id: 'low-liquidity-traps',
      title: 'Low-Liquidity Traps',
      risk_state: 'high_risk',
      summary: 'Thin pools can make attention look like liquidity while exits remain fragile.',
      evidence_needed: ['Pool reserves', 'LP lock state', '24h volume source', 'Route depth screenshots are not enough'],
      source: sourcePending
    },
    {
      id: 'deployer-warning',
      title: 'Deployer Cluster Watch',
      risk_state: 'high_risk',
      summary: 'Copycat deployers may wrap stock-token language in familiar ticker bait.',
      evidence_needed: ['Funding path', 'Previous launches', 'Contract similarity', 'Ownership controls'],
      source: sourcePending
    }
  ],
  stock_token_spillover_map: [
    {
      id: 'equity-ticker-to-meme',
      finance_theme: 'Equity tickers',
      meme_mutation: 'Ticker-as-tribe assets',
      signal_read: 'The symbol matters before the business logic. Attention compresses around recognizable market language.',
      risk_note: 'Familiar ticker language can mislead users into assuming affiliation.'
    },
    {
      id: 'brokerage-rails-to-culture',
      finance_theme: 'Brokerage rails',
      meme_mutation: 'Rails, route, desk, and settlement memes',
      signal_read: 'Infrastructure vocabulary becomes identity vocabulary once users can repeat it in one line.',
      risk_note: 'Infrastructure claims need source receipts, not screenshots.'
    },
    {
      id: 'dividend-yield-to-claim-risk',
      finance_theme: 'Dividends and yield',
      meme_mutation: 'Cashflow memes and fake payout narratives',
      signal_read: 'Yield language is powerful because it feels familiar to traditional-market users.',
      risk_note: 'Any payout language is high-risk until receipts prove mechanism and legal framing.'
    },
    {
      id: 'ipo-to-launch-meta',
      finance_theme: 'IPO access',
      meme_mutation: 'Launch-window speculation',
      signal_read: 'Primary-market mythology mutates into early-entry meme urgency.',
      risk_note: 'Urgency is not proof. Contract and holder receipts come first.'
    }
  ],
  signal_index_4663: [
    {
      rank: 1,
      asset: 'Hood Rail',
      ticker: 'HOOD',
      signal_score: 66,
      labels: ['fresh_signal', 'stock_token_spillover', 'top_holder_risk'],
      attention_source: 'Ticker familiarity',
      receipt_state: 'contract_required',
      note: 'Most legible ticker. Highest affiliation-confusion risk.'
    },
    {
      rank: 2,
      asset: 'Wall Street Rails',
      ticker: 'RAILS',
      signal_score: 61,
      labels: ['attention_spike', 'stock_token_spillover'],
      attention_source: 'Rail narrative',
      receipt_state: 'pool_required',
      note: 'Strong theme compression, incomplete proof.'
    },
    {
      rank: 3,
      asset: 'Meme IPO Desk',
      ticker: 'IPO',
      signal_score: 54,
      labels: ['fresh_signal', 'stock_token_spillover'],
      attention_source: 'Launch-window language',
      receipt_state: 'contract_required',
      note: 'Useful proxy for IPO/access memes.'
    },
    {
      rank: 4,
      asset: 'Ticker Memory',
      ticker: 'TICKR',
      signal_score: 49,
      labels: ['fresh_signal', 'attention_spike'],
      attention_source: 'Symbol abstraction',
      receipt_state: 'source_required',
      note: 'Pure attention object. Needs market proof.'
    },
    {
      rank: 5,
      asset: 'Sherwood Loop',
      ticker: 'SHERW',
      signal_score: 32,
      labels: ['deployer_cluster_risk', 'liquidity_mirage', 'do_not_touch_yet'],
      attention_source: 'Brand-adjacent myth',
      receipt_state: 'risk_wall',
      note: 'Keep visible as a risk marker, not a promoted signal.'
    }
  ],
  receipts: [
    {
      receipt_id: 'rh-chain-seed-2026-07-09',
      timestamp: OBSERVED_AT,
      source: 'Infopunks desk seed',
      summary: 'Created RH Chain Signal Desk scaffold with source-pending slots for volatile metrics and contract-dependent meme assets.',
      linked_assets: ['HOOD', 'RAILS', 'IPO', 'TICKR', 'SHERW'],
      caveat: 'Seed receipt only. It does not verify market cap, liquidity, volume, contracts, or official affiliation.'
    }
  ]
};

export function getRhChainPayload() {
  return rhChainPayload;
}

export function listRhChainMemes() {
  return rhChainPayload.meme_pulse;
}

export function listRhChainSignals() {
  return {
    classifier: rhChainPayload.signal_classifier,
    index_4663: rhChainPayload.signal_index_4663,
    risk_wall: rhChainPayload.risk_wall
  };
}

export function listRhChainReceipts() {
  return rhChainPayload.receipts;
}

function compactOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function submissionId(ticker: string, submittedAt: string) {
  const safeTicker = ticker.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signal';
  const stamp = submittedAt.replace(/[^0-9]/g, '').slice(0, 14);
  return `rh-chain-${safeTicker}-${stamp}`;
}

export function createRhChainSignalReviewPacket(input: RhChainSignalSubmissionInput, submittedAt = new Date().toISOString()): RhChainSignalReviewPacket {
  const ticker = input.ticker.trim().toUpperCase();
  const chain = input.chain?.trim() || 'Robinhood Chain';
  return {
    submission_id: submissionId(ticker, submittedAt),
    submitted_at: submittedAt,
    token_contract: input.token_contract.trim(),
    ticker,
    chain,
    links: {
      x_twitter: compactOptional(input.x_twitter_link),
      website: compactOptional(input.website_link),
      liquidity: compactOptional(input.liquidity_link)
    },
    deployer_notes: compactOptional(input.deployer_notes),
    submitter_notes: compactOptional(input.submitter_notes),
    disclosure_confirmed: input.disclosure_confirmed,
    review_status: 'queued_for_manual_review',
    next_step: 'Infopunks will review the signal manually before adding it to the public desk.'
  };
}
