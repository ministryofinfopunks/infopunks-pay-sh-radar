import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { RadarHeaderIdentity } from './radarNetworks';

type UnicornRadarSector =
  | 'AI'
  | 'AI / Agent Rails'
  | 'RWA'
  | 'DeFi'
  | 'DePIN'
  | 'Consumer'
  | 'Consumer / Social / Attention Markets'
  | 'Gaming / Consumer'
  | 'Agent Rails'
  | 'Payment Infrastructure'
  | 'Social / Attention Markets'
  | 'Tokenized Apps';

type UnicornRadarStatus =
  | 'unseen_signal'
  | 'watchlist'
  | 'high_signal_lowcap'
  | 'consensus_forming'
  | 'do_not_touch_yet'
  | 'infopunks_missed_it'
  | 'paid_evaluation';

type UnicornRadarVerdict =
  | 'high_signal_early'
  | 'interesting_needs_receipts'
  | 'real_product_weak_attention'
  | 'strong_attention_weak_proof'
  | 'do_not_touch_yet'
  | 'consensus_already_forming'
  | 'missed_by_infopunks';

type UnicornRadarScores = {
  shipping_proof: number;
  attention_quality: number;
  token_survivability: number;
  category_timing: number;
  asymmetry_potential: number;
  overall_signal_score: number;
  risk_score: number;
};

type UnicornRadarReceipt = {
  id: string;
  label: string;
  type: 'shipping' | 'attention' | 'token' | 'risk' | 'market' | 'payment' | 'note' | 'LIVE_GAME_ROUTE';
  source: string;
  url?: string;
  note: string;
  observed_at: string;
};

type UnicornRadarCandidate = {
  id: string;
  project: string;
  ticker: string;
  sector: UnicornRadarSector;
  market_cap_range: string;
  thesis: string;
  displayVerdict?: string;
  what_it_actually_does: string;
  proof_of_shipping: string;
  attention_quality_note: string;
  token_survivability_note: string;
  risk_flags: string[];
  tags?: string[];
  why_now: string;
  receipts: UnicornRadarReceipt[];
  linked_narratives: Array<{ label: string; href: string }>;
  linked_graph_node: { id: string; label: string; href: string };
  chainId?: string;
  tokenAddress?: string;
  verificationStatus: 'verified_live_market' | 'pending_manual_review' | 'not_tokenized' | 'rejected';
  tokenAddressSource?: string;
  tokenAddressSourceUrl?: string;
  verifiedAt?: string;
  verificationNotes?: string[];
  productionReady?: boolean;
  pairAddress?: string;
  dexScreenerUrl?: string;
  marketDataSource?: string;
  marketDataUpdatedAt?: string;
  dexScreenerData?: {
    priceUsd?: number | null;
    marketCap?: number | null;
    fdv?: number | null;
    liquidityUsd?: number | null;
    volume24h?: number | null;
    txns24hBuys?: number | null;
    txns24hSells?: number | null;
    priceChange1h?: number | null;
    priceChange6h?: number | null;
    priceChange24h?: number | null;
    pairCreatedAt?: string | null;
    dexId?: string | null;
    boosts?: number | null;
    paidOrders?: number | null;
    rawUrl?: string | null;
  };
  hunter_credit: { handle: string; attribution: string; submitted_at: string; source: string };
  paid_evaluation_disclosure: { is_paid: boolean; label: string; note: string; paid_at?: string | null; receipt_id?: string | null };
  status: UnicornRadarStatus;
  verdict: UnicornRadarVerdict;
  scores: UnicornRadarScores;
  updated_at: string;
  sample_disclosure: string;
};

type UnicornRadarRevenueReceipt = {
  id: string;
  candidate_id: string | null;
  project: string;
  amount_usd: number;
  service: string;
  disclosure: string;
  status: 'paid' | 'comped' | 'pending';
  paid_at: string;
};

type UnicornRadarSummary = {
  generated_at: string;
  title: 'Infopunks Unicorn Radar';
  tagline: 'Finding serious low-cap Solana projects before consensus does.';
  subline: 'Retail doesn’t need less risk. Retail needs better signal before taking risk.';
  trust_line: 'Projects can buy evaluation, not conviction.';
  doctrine_line: 'Influencers sell certainty. Infopunks sells legible uncertainty.';
  counts: {
    total: number;
    by_status: Record<UnicornRadarStatus, number>;
    by_verdict: Record<UnicornRadarVerdict, number>;
    by_sector: Record<UnicornRadarSector, number>;
  };
  candidates: UnicornRadarCandidate[];
  revenue_receipts: UnicornRadarRevenueReceipt[];
};

const API_BASE_URL = getApiBaseUrl();
const SECTORS: Array<'all' | UnicornRadarSector> = ['all', 'AI', 'AI / Agent Rails', 'RWA', 'DeFi', 'DePIN', 'Consumer', 'Consumer / Social / Attention Markets', 'Gaming / Consumer', 'Agent Rails', 'Payment Infrastructure', 'Social / Attention Markets', 'Tokenized Apps'];
const STATUSES: Array<'all' | UnicornRadarStatus> = ['all', 'unseen_signal', 'watchlist', 'high_signal_lowcap', 'consensus_forming', 'do_not_touch_yet', 'infopunks_missed_it', 'paid_evaluation'];
const VERDICTS: Array<'all' | UnicornRadarVerdict> = ['all', 'high_signal_early', 'interesting_needs_receipts', 'real_product_weak_attention', 'strong_attention_weak_proof', 'do_not_touch_yet', 'consensus_already_forming', 'missed_by_infopunks'];

async function api<T>(path: string): Promise<T> {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

function titleCase(value: string) {
  return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function visibleVerifiedSectors(candidates: UnicornRadarCandidate[]) {
  const visible = new Set<UnicornRadarSector>();
  for (const candidate of candidates) {
    if (!candidate.productionReady) continue;
    visible.add(candidate.sector);
  }
  return SECTORS.filter((sector): sector is UnicornRadarSector => sector !== 'all' && visible.has(sector));
}

function statusTone(status: UnicornRadarStatus) {
  if (status === 'high_signal_lowcap') return 'ok';
  if (status === 'do_not_touch_yet') return 'danger';
  if (status === 'consensus_forming' || status === 'infopunks_missed_it') return 'info';
  if (status === 'paid_evaluation') return 'paid';
  if (status === 'watchlist' || status === 'unseen_signal') return 'warn';
  return 'review';
}

function statusLabel(status: UnicornRadarStatus) {
  switch (status) {
    case 'high_signal_lowcap':
      return 'High-Signal Lowcap';
    case 'do_not_touch_yet':
      return 'Do Not Touch Yet';
    case 'consensus_forming':
      return 'Consensus Forming';
    case 'infopunks_missed_it':
      return 'Infopunks Missed It';
    case 'paid_evaluation':
      return 'Paid Evaluation';
    case 'unseen_signal':
      return 'Unseen Signal';
    case 'watchlist':
      return 'Watchlist';
  }
}

function shortText(value: string, maxLength = 168) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function formatRadarTimestamp(value: string | null | undefined) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date);
}

function candidateVerdict(candidate: UnicornRadarCandidate) {
  return candidate.displayVerdict ?? verdictCopy(candidate.verdict);
}

function candidateOgHref(candidate: UnicornRadarCandidate) {
  return `/og/unicorn-radar/${encodeURIComponent(candidate.id)}.png`;
}

function verdictCopy(verdict: UnicornRadarVerdict) {
  switch (verdict) {
    case 'high_signal_early':
      return 'High-Signal, Retention Still Monitored';
    case 'interesting_needs_receipts':
      return 'Interesting, needs receipts';
    case 'real_product_weak_attention':
      return 'Real product, weak attention';
    case 'strong_attention_weak_proof':
      return 'Strong attention, weak proof';
    case 'do_not_touch_yet':
      return 'Do not touch yet';
    case 'consensus_already_forming':
      return 'Consensus already forming';
    case 'missed_by_infopunks':
      return 'Missed by Infopunks';
  }
}

function topScores(candidate: UnicornRadarCandidate) {
  return [
    ['Signal', candidate.scores.overall_signal_score],
    ['Shipping', candidate.scores.shipping_proof],
    ['Asymmetry', candidate.scores.asymmetry_potential],
    ['Risk', candidate.scores.risk_score]
  ] as const;
}

function formatCompactMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: value >= 100 ? 1 : 2
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatPairAge(value: string | null | undefined) {
  if (!value) return 'n/a';
  const ageMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'n/a';
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days >= 365) return `${Math.floor(days / 365)}y`;
  if (days >= 30) return `${Math.floor(days / 30)}mo`;
  return `${days}d`;
}

function buildMarketRiskBadges(candidate: UnicornRadarCandidate) {
  const data = candidate.dexScreenerData;
  if (!data) return [];

  const badges: string[] = [];
  const marketCap = data.marketCap ?? null;
  const liquidityUsd = data.liquidityUsd ?? null;
  const volume24h = data.volume24h ?? null;
  const priceChange24h = data.priceChange24h ?? null;

  if (marketCap && liquidityUsd && marketCap > 0 && liquidityUsd / marketCap < 0.05) {
    badges.push('Liquidity thin vs market cap');
  }
  if (volume24h && liquidityUsd && liquidityUsd < 250_000 && volume24h / liquidityUsd > 3) {
    badges.push('Hot volume, thin liquidity');
  }
  if ((data.paidOrders ?? 0) > 0 || (data.boosts ?? 0) > 0) {
    badges.push('Paid promotion detected');
  }
  if (typeof priceChange24h === 'number' && Math.abs(priceChange24h) >= 20 && candidate.receipts.length < 3) {
    badges.push('Sharp move, receipts still thin');
  }

  return badges;
}

function MarketDataPanel({ candidate, compact = false }: { candidate: UnicornRadarCandidate; compact?: boolean }) {
  if (candidate.verificationStatus !== 'verified_live_market' || !candidate.tokenAddress) return null;

  const data = candidate.dexScreenerData;
  const riskBadges = buildMarketRiskBadges(candidate);

  if (!data) {
    return <section className="panel unicorn-section" aria-label="Market data">
      <div className="proof-section-head">
        <div>
          <p className="eyebrow">Market Data</p>
          <h2>Unavailable</h2>
        </div>
        <p className="panel-caption">Market data via DexScreener. Infopunks verdict is independent.</p>
      </div>
      <p className="panel-caption">No DexScreener market data is attached to this candidate yet.</p>
    </section>;
  }

  return <section className="panel unicorn-section" aria-label="Market data">
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">Market Data</p>
        <h2>{formatCompactMoney(data.marketCap ?? null)}</h2>
      </div>
      <p className="panel-caption">Market data via DexScreener. Infopunks verdict is independent.</p>
    </div>
    <div className="unicorn-score-grid">
      <p><span>Market Cap</span><strong>{formatCompactMoney(data.marketCap ?? null)}</strong></p>
      <p><span>FDV</span><strong>{formatCompactMoney(data.fdv ?? null)}</strong></p>
      <p><span>Liquidity</span><strong>{formatCompactMoney(data.liquidityUsd ?? null)}</strong></p>
      <p><span>24h Volume</span><strong>{formatCompactMoney(data.volume24h ?? null)}</strong></p>
      <p><span>24h Buys/Sells</span><strong>{`${data.txns24hBuys ?? 'n/a'} / ${data.txns24hSells ?? 'n/a'}`}</strong></p>
      <p><span>24h Price Change</span><strong>{formatPercent(data.priceChange24h ?? null)}</strong></p>
      {!compact && <p><span>Pair Age</span><strong>{formatPairAge(data.pairCreatedAt)}</strong></p>}
      {!compact && <p><span>Dex</span><strong>{data.dexId ?? 'n/a'}</strong></p>}
    </div>
    {riskBadges.length > 0 && <div className="proof-flag-list unicorn-risk-list">
      {riskBadges.map((badge) => <span key={badge}>{badge}</span>)}
    </div>}
    <div className="unicorn-card-meta">
      <p><span>Source</span><strong>{candidate.marketDataSource ?? 'DexScreener'}</strong></p>
      <p><span>Updated</span><strong>{candidate.marketDataUpdatedAt ? new Date(candidate.marketDataUpdatedAt).toLocaleString() : 'n/a'}</strong></p>
    </div>
    {(candidate.dexScreenerUrl || data.rawUrl) && <div className="signal-hunt-card-actions">
      <a className="execute compact secondary" href={candidate.dexScreenerUrl ?? data.rawUrl ?? '#'} target="_blank" rel="noreferrer">Open DexScreener</a>
    </div>}
  </section>;
}

function VerificationBadge({ candidate }: { candidate: UnicornRadarCandidate }) {
  if (!candidate.productionReady) return null;
  if (candidate.verificationStatus === 'pending_manual_review') return <span className="status-pill warn">Pending manual review</span>;
  if (candidate.verificationStatus === 'rejected') return <span className="status-pill danger">Rejected</span>;
  if (candidate.verificationStatus === 'not_tokenized') return <span className="status-pill review">Not tokenized</span>;
  return <span className="status-pill ok">Verified live market</span>;
}

function UnicornRadarNav() {
  const pathname = window.location.pathname;
  return <nav className="global-toolbar proof-check-toolbar unicorn-radar-nav" aria-label="Unicorn Radar navigation">
    <RadarHeaderIdentity active="solana" />
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Unicorn Radar routes">
      <a href="/unicorn-radar" aria-current={pathname === '/unicorn-radar' ? 'page' : undefined}>Unicorn Radar</a>
      <a href="/revenue-receipts">Revenue Receipts</a>
      <a href="/narratives">Narrative Intel</a>
      <a href="/signal-hunt">Signal Hunt</a>
      <a href="/graph">Signal Graph</a>
      <a href="/check">Proof Feed</a>
    </div>
  </nav>;
}

function FilterSelect<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: T[]; onChange: (value: T) => void }) {
  return <label className="unicorn-filter">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {values.map((item) => <option key={item} value={item}>{item === 'all' ? 'All' : titleCase(item)}</option>)}
    </select>
  </label>;
}

function RadarSnapshotPanel({ summary }: { summary: UnicornRadarSummary | null }) {
  const counts = summary?.counts;
  const rows = [
    ['Candidates', counts?.total ?? 0],
    ['High-Signal', counts?.by_status.high_signal_lowcap ?? 0],
    ['Watchlist', counts?.by_status.watchlist ?? 0],
    ['Do Not Touch', counts?.by_status.do_not_touch_yet ?? 0],
    ['Consensus', counts?.by_status.consensus_forming ?? 0]
  ] as const;

  return <aside className="radar-snapshot-panel" aria-label="Radar Snapshot Panel">
    <div className="radar-snapshot-head">
      <p className="eyebrow">Radar Snapshot</p>
      <span>Drop #001</span>
    </div>
    <div className="radar-snapshot-counts">
      {rows.map(([label, value]) => <p key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
      </p>)}
    </div>
    <div className="radar-snapshot-meta">
      <p><span>Last Updated</span><strong>{formatRadarTimestamp(summary?.generated_at)}</strong></p>
      <p><span>Drop #001 Summary</span><strong>KINS, Jotchua, and CUPSEY lead signal, MANIFEST stays blocked, TROLL shows consensus.</strong></p>
    </div>
  </aside>;
}

function DropSummaryCard() {
  return <section className="panel unicorn-drop-summary" aria-label="Drop #001 summary">
    <div className="unicorn-drop-copy">
      <p className="eyebrow">Drop #001</p>
      <h2>Drop #001 remains receipt-framed.</h2>
      <p className="panel-caption">A concise public frame for the current batch without pushing full analysis into the list page.</p>
    </div>
    <div className="unicorn-drop-grid">
      <p><span>High-Signal</span><strong>KINS, Jotchua, CUPSEY</strong></p>
      <p><span>Do Not Touch Yet</span><strong>MANIFEST</strong></p>
      <p><span>Consensus</span><strong>TROLL</strong></p>
      <p><span>Recently added</span><strong>CUPSEY: High-Signal Lowcap, real-world meme product, brand execution monitored.</strong></p>
    </div>
  </section>;
}

function featuredMetricSet(candidate: UnicornRadarCandidate) {
  return [
    ['Signal', `${candidate.scores.overall_signal_score}`],
    ['Risk', `${candidate.scores.risk_score}`],
    ['24h Vol', formatCompactMoney(candidate.dexScreenerData?.volume24h ?? null)]
  ] as const;
}

function FeaturedCallCard({ label, candidate }: { label: string; candidate: UnicornRadarCandidate }) {
  return <article className="panel featured-radar-card screenshot-card" aria-label={`${label}: ${candidate.project}`}>
    <div className="featured-radar-head">
      <span className={`status-pill ${statusTone(candidate.status)}`}>{label}</span>
      <strong>{candidate.ticker}</strong>
    </div>
    <div>
      <h3>{candidate.project}</h3>
      <p>{shortText(candidateVerdict(candidate), 96)}</p>
    </div>
    <div className="featured-radar-metrics" aria-label={`${candidate.project} compact metrics`}>
      {featuredMetricSet(candidate).map(([metric, value]) => <span key={metric}><b>{metric}</b>{value}</span>)}
    </div>
    <div className="featured-radar-footer">
      <span>{candidate.receipts.length} receipts</span>
      <a className="execute compact secondary" href={`/unicorn-radar/${encodeURIComponent(candidate.id)}`}>Open Candidate</a>
      <a className="unicorn-og-link" href={candidateOgHref(candidate)}>Open OG Card</a>
    </div>
  </article>;
}

function FeaturedRadarCalls({ candidates }: { candidates: UnicornRadarCandidate[] }) {
  const kins = candidates.find((candidate) => candidate.ticker === 'KINS');
  const watchlist = candidates.find((candidate) => candidate.project === 'SolAngeles') ?? candidates.find((candidate) => candidate.ticker === 'ARC');
  const manifest = candidates.find((candidate) => candidate.ticker === 'MANIFEST');
  const troll = candidates.find((candidate) => candidate.ticker === 'TROLL');
  const calls = [
    kins && ['High-Signal Lowcap', kins],
    watchlist && ['Watchlist', watchlist],
    manifest && ['Do Not Touch Yet', manifest],
    troll && ['Consensus Forming', troll]
  ].filter((call): call is [string, UnicornRadarCandidate] => Boolean(call));

  return <section className="unicorn-featured-section" aria-label="Featured Radar Calls">
    <div className="unicorn-section-head">
      <div>
        <p className="eyebrow">Featured Radar Calls</p>
        <h2>Featured Radar Calls</h2>
      </div>
      <p className="panel-caption">Four live examples of how Radar classifies signal, uncertainty, and risk.</p>
    </div>
    <div className="featured-radar-grid">
      {calls.map(([label, candidate]) => <FeaturedCallCard key={`${label}-${candidate.id}`} label={label} candidate={candidate} />)}
    </div>
  </section>;
}

function CompactMarketStrip({ candidate }: { candidate: UnicornRadarCandidate }) {
  const data = candidate.dexScreenerData;
  const marketCap = data?.marketCap ?? null;
  const fallbackMarketCap = candidate.market_cap_range.startsWith('Live market') ? 'n/a' : candidate.market_cap_range;
  const source = candidate.marketDataSource || (candidate.verificationStatus === 'verified_live_market' ? 'DexScreener' : 'Market pending');

  return <div className="unicorn-market-strip" aria-label={`${candidate.project} compact market data`}>
    <p><span>Market Cap</span><strong>{marketCap ? formatCompactMoney(marketCap) : fallbackMarketCap}</strong></p>
    <p><span>Liquidity</span><strong>{formatCompactMoney(data?.liquidityUsd ?? null)}</strong></p>
    <p><span>24h Volume</span><strong>{formatCompactMoney(data?.volume24h ?? null)}</strong></p>
    <p><span>24h</span><strong>{formatPercent(data?.priceChange24h ?? null)}</strong></p>
    <span className="unicorn-card-source-chip">Market data: {source === 'dexscreener_official_api' ? 'DexScreener' : source}</span>
  </div>;
}

function compactEvidenceChips(candidate: UnicornRadarCandidate) {
  const unique = new Set<string>();
  const source = [
    ...candidate.receipts.map((receipt) => receipt.label),
    ...(candidate.tags ?? []),
    ...candidate.risk_flags
  ];

  for (const item of source) {
    const clean = item.trim();
    if (clean) unique.add(clean);
  }

  const all = [...unique];
  return {
    visible: all.slice(0, 4),
    hiddenCount: Math.max(0, all.length - 4)
  };
}

function CandidateCompactCard({ candidate }: { candidate: UnicornRadarCandidate }) {
  const evidence = compactEvidenceChips(candidate);

  return <article className="panel unicorn-candidate-card unicorn-candidate-compact-card screenshot-card" aria-label={`${candidate.project} Unicorn Radar card`}>
    <div className="unicorn-card-head">
      <div>
        <span className={`status-pill ${statusTone(candidate.status)}`}>{statusLabel(candidate.status)}</span>
        <span className="unicorn-sector-chip">{candidate.sector}</span>
        <VerificationBadge candidate={candidate} />
      </div>
      <strong>{candidate.ticker}</strong>
    </div>
    <div className="unicorn-card-title">
      <h3>{candidate.project}</h3>
      <p className="unicorn-card-verdict">{candidateVerdict(candidate)}</p>
      <p className="unicorn-compact-thesis">{shortText(candidate.thesis, 176)}</p>
    </div>
    <div className="unicorn-compact-metric-band">
      {topScores(candidate).map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}
    </div>
    <div className="proof-flag-list unicorn-risk-list unicorn-evidence-row">
      {evidence.visible.map((flag) => <span key={flag}>{flag}</span>)}
      {evidence.hiddenCount > 0 && <span>+{evidence.hiddenCount} more</span>}
    </div>
    <CompactMarketStrip candidate={candidate} />
    {candidate.paid_evaluation_disclosure.is_paid && <p className="unicorn-paid-note">{candidate.paid_evaluation_disclosure.label}: {candidate.paid_evaluation_disclosure.note}</p>}
    <div className="unicorn-card-footer">
      <div className="unicorn-card-foot-meta">
        <span>{candidate.receipts.length} receipts</span>
        <span>{candidate.hunter_credit.handle}</span>
      </div>
      <div className="signal-hunt-card-actions">
        <a className="execute compact secondary" href={`/unicorn-radar/${encodeURIComponent(candidate.id)}`}>Open Candidate</a>
        <a className="unicorn-og-link" href={candidateOgHref(candidate)}>Open OG Card</a>
      </div>
    </div>
  </article>;
}

function SectionHeaderWithMeta({ title, count, explainer, action }: { title: string; count: number; explainer: string; action?: string }) {
  return <div className="unicorn-section-head">
    <div>
      <p className="eyebrow">{title}</p>
      <h2>{title}</h2>
    </div>
    <div className="unicorn-section-meta">
      <strong>{count}</strong>
      <span>{count === 1 ? 'candidate' : 'candidates'}</span>
    </div>
    <p className="panel-caption">{explainer}</p>
    {action && <span className="unicorn-section-action">{action}</span>}
  </div>;
}

function CandidateSection({ title, subtitle, candidates }: { title: string; subtitle: string; candidates: UnicornRadarCandidate[] }) {
  return <section className="unicorn-section unicorn-candidate-section" aria-label={title}>
    <SectionHeaderWithMeta title={title} count={candidates.length} explainer={subtitle} action="Share-ready section" />
    {candidates.length
      ? <div className="unicorn-card-grid">{candidates.map((candidate) => <CandidateCompactCard key={candidate.id} candidate={candidate} />)}</div>
      : <p className="panel-caption">No verified candidates yet. Submit a candidate with receipts.</p>}
  </section>;
}

function UnicornFilterBar({
  sector,
  setSector,
  status,
  setStatus,
  verdict,
  setVerdict,
  query,
  setQuery,
  shareMode,
  setShareMode,
  sectorOptions,
  filteredCount
}: {
  sector: 'all' | UnicornRadarSector;
  setSector: (value: 'all' | UnicornRadarSector) => void;
  status: 'all' | UnicornRadarStatus;
  setStatus: (value: 'all' | UnicornRadarStatus) => void;
  verdict: 'all' | UnicornRadarVerdict;
  setVerdict: (value: 'all' | UnicornRadarVerdict) => void;
  query: string;
  setQuery: (value: string) => void;
  shareMode: boolean;
  setShareMode: (value: boolean) => void;
  sectorOptions: Array<'all' | UnicornRadarSector>;
  filteredCount: number;
}) {
  return <section className="unicorn-filter-panel" aria-label="Candidate filters">
    <div className="unicorn-status-segments" aria-label="Status filters">
      {STATUSES.map((item) => <button
        key={item}
        type="button"
        className={item === status ? 'active' : undefined}
        aria-pressed={item === status}
        onClick={() => setStatus(item)}
      >
        {item === 'all' ? 'All' : statusLabel(item)}
      </button>)}
    </div>
    <FilterSelect label="Sector" value={sector} values={sectorOptions} onChange={setSector} />
    <FilterSelect label="Verdict" value={verdict} values={VERDICTS} onChange={setVerdict} />
    <label className="unicorn-filter unicorn-search-filter">
      <span>Search</span>
      <input value={query} placeholder="Project, ticker, tag" onChange={(event) => setQuery(event.target.value)} />
    </label>
    <label className="unicorn-share-toggle">
      <input type="checkbox" checked={shareMode} onChange={(event) => setShareMode(event.target.checked)} />
      <span>Share Mode</span>
    </label>
    <p className="unicorn-filter-count">{filteredCount} shown</p>
  </section>;
}

export function UnicornRadarPage() {
  const [summary, setSummary] = useState<UnicornRadarSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState<'all' | UnicornRadarSector>('all');
  const [status, setStatus] = useState<'all' | UnicornRadarStatus>('all');
  const [verdict, setVerdict] = useState<'all' | UnicornRadarVerdict>('all');
  const [query, setQuery] = useState('');
  const [shareMode, setShareMode] = useState(false);

  useEffect(() => {
    api<{ data: UnicornRadarSummary }>('/v1/unicorn-radar')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'unicorn_radar_unavailable'));
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (summary?.candidates ?? []).filter((candidate) => {
      if (sector !== 'all' && candidate.sector !== sector) return false;
      if (status !== 'all' && candidate.status !== status) return false;
      if (verdict !== 'all' && candidate.verdict !== verdict) return false;
      if (normalizedQuery) {
        const haystack = [
          candidate.project,
          candidate.ticker,
          candidate.sector,
          candidateVerdict(candidate),
          candidate.status,
          candidate.verdict,
          ...(candidate.tags ?? []),
          ...candidate.risk_flags
        ].join(' ').toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [query, sector, status, summary?.candidates, verdict]);

  const sectorOptions = useMemo(() => {
    const visibleSectors = visibleVerifiedSectors(summary?.candidates ?? []);
    return ['all', ...visibleSectors] as Array<'all' | UnicornRadarSector>;
  }, [summary?.candidates]);

  const groups = useMemo(() => ({
    highSignal: filtered.filter((candidate) => candidate.status === 'high_signal_lowcap'),
    watchlist: filtered.filter((candidate) => candidate.status === 'watchlist' || candidate.status === 'unseen_signal' || candidate.status === 'paid_evaluation'),
    doNotTouch: filtered.filter((candidate) => candidate.status === 'do_not_touch_yet'),
    consensus: filtered.filter((candidate) => candidate.status === 'consensus_forming' || candidate.status === 'infopunks_missed_it')
  }), [filtered]);

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell">
    <UnicornRadarNav />
    <main className={`builder-page unicorn-radar-page${shareMode ? ' share-mode' : ''}`} aria-label="Infopunks Unicorn Radar">
      <section className="panel hero unicorn-radar-hero">
        <div className="unicorn-hero-copy">
          <p className="eyebrow">COMMERCIAL SIGNAL DESK</p>
          <h1>{summary?.title ?? 'Infopunks Unicorn Radar'}</h1>
          <h2>{summary?.tagline ?? 'Finding serious low-cap Solana projects before consensus does.'}</h2>
          <div className="unicorn-doctrine-lines">
            <p>{summary?.subline ?? 'Retail doesn’t need less risk. Retail needs better signal before taking risk.'}</p>
            <p>{summary?.trust_line ?? 'Projects can buy evaluation, not conviction.'}</p>
          </div>
          <div className="signal-hunt-hero-actions">
            <a className="execute" href="#submit-candidate">Submit Candidate</a>
            <a className="execute compact secondary" href="/evaluation-request">Request Paid Evaluation</a>
          </div>
        </div>
        <RadarSnapshotPanel summary={summary} />
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      <FeaturedRadarCalls candidates={summary?.candidates ?? []} />
      <DropSummaryCard />
      <UnicornFilterBar
        sector={sector}
        setSector={setSector}
        status={status}
        setStatus={setStatus}
        verdict={verdict}
        setVerdict={setVerdict}
        query={query}
        setQuery={setQuery}
        shareMode={shareMode}
        setShareMode={setShareMode}
        sectorOptions={sectorOptions}
        filteredCount={filtered.length}
      />

      <CandidateSection title="High-Signal Lowcaps" subtitle="Serious early candidates where shipping, timing, and asymmetry are already legible." candidates={groups.highSignal} />
      <CandidateSection title="Watchlist" subtitle="Interesting candidates that need more receipts before conviction can rise." candidates={groups.watchlist} />
      <CandidateSection title="Do Not Touch Yet" subtitle="Risk is too high, proof is too thin, or token survivability is not legible." candidates={groups.doNotTouch} />
      <CandidateSection title="Consensus Forming" subtitle="The early edge may already be closing, including explicit missed-it records." candidates={groups.consensus} />

      <section className="unicorn-commercial-grid" aria-label="Commercial radar actions">
        <article className="panel unicorn-commercial-card">
          <p className="eyebrow">Revenue Receipts</p>
          <h2>Revenue Receipts</h2>
          <p className="copy">Public ledger for open slots, templates, internal build receipts, and future paid evaluations. No receipt, no trust.</p>
          <a className="execute compact secondary" href="/revenue-receipts">Open Revenue Receipts</a>
        </article>
        <article id="request-evaluation" className="panel unicorn-commercial-card">
          <p className="eyebrow">Request Paid Evaluation</p>
          <h2>Evaluation Request</h2>
          <p className="copy">Use <code>POST /v1/evaluation-request</code>. If automated intake is not configured, the API returns a manual delivery packet instead of pretending it stored your request.</p>
          <a className="execute compact secondary" href="/evaluation-request">Open Evaluation Request</a>
        </article>
        <article id="submit-candidate" className="panel unicorn-commercial-card">
          <p className="eyebrow">Submit Candidate</p>
          <h2>Low-cap Solana signal intake</h2>
          <p className="copy">Use <code>POST /v1/unicorn-radar/submit</code> with thesis, sector, shipping proof, and evidence links.</p>
          <a className="execute compact secondary" href="/developers">Open Developer Surface</a>
        </article>
      </section>
    </main>
  </div>;
}

function ScorePanel({ scores }: { scores: UnicornRadarScores }) {
  return <div className="unicorn-detail-score-grid">
    {Object.entries(scores).map(([key, value]) => <article className="panel loop-counter-card" key={key}>
      <span>{titleCase(key)}</span>
      <strong>{value}</strong>
    </article>)}
  </div>;
}

export function UnicornRadarDetailPage({ candidateId }: { candidateId: string }) {
  const [candidate, setCandidate] = useState<UnicornRadarCandidate | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: UnicornRadarCandidate }>(`/v1/unicorn-radar/candidates/${encodeURIComponent(candidateId)}`)
      .then((response) => {
        setCandidate(response.data);
        setMissing(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.endsWith(' 404')) setMissing(true);
        else setError(err instanceof Error ? err.message : 'unicorn_radar_candidate_unavailable');
      });
  }, [candidateId]);

  if (missing) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell"><UnicornRadarNav /><main className="builder-page unicorn-radar-page"><section className="panel hero"><h1>Candidate not found.</h1><p className="copy">No Unicorn Radar candidate exists for <code>{candidateId}</code>.</p><a className="execute compact secondary" href="/unicorn-radar">Back to Unicorn Radar</a></section></main></div>;
  if (error) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell"><UnicornRadarNav /><main className="builder-page unicorn-radar-page"><section className="panel hero"><h1>Unicorn Radar unavailable.</h1><p className="copy">{error}</p></section></main></div>;
  if (!candidate) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell"><UnicornRadarNav /><main className="builder-page unicorn-radar-page"><section className="panel hero"><h1>Loading candidate...</h1></section></main></div>;

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell">
    <UnicornRadarNav />
    <main className="builder-page unicorn-radar-detail-page" aria-label={`${candidate.project} Unicorn Radar detail`}>
      <section className="panel hero unicorn-radar-hero unicorn-detail-hero">
        <div>
          <p className="eyebrow">{candidate.sector} / {candidate.market_cap_range}</p>
          <h1>{candidate.project}</h1>
          <h2>{candidate.ticker}</h2>
          <VerificationBadge candidate={candidate} />
          <p className="copy">{candidate.thesis}</p>
          <p className="panel-caption">{candidate.sample_disclosure}</p>
        </div>
        <div className="panel unicorn-verdict-panel">
          <span className={`status-pill ${statusTone(candidate.status)}`}>{titleCase(candidate.status)}</span>
          <h2>{candidate.displayVerdict ?? verdictCopy(candidate.verdict)}</h2>
          <p>{candidate.paid_evaluation_disclosure.note}</p>
        </div>
      </section>

      <ScorePanel scores={candidate.scores} />
      <MarketDataPanel candidate={candidate} />

      <section className="panel unicorn-section">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Verification</p>
            <h2>{titleCase(candidate.verificationStatus)}</h2>
          </div>
          <p className="panel-caption">{candidate.verifiedAt ? `Verified at ${new Date(candidate.verifiedAt).toLocaleString()}` : 'Verification timestamp not recorded.'}</p>
        </div>
        <div className="proof-flag-list unicorn-risk-list">
          {(candidate.verificationNotes ?? []).map((note) => <span key={note}>{note}</span>)}
        </div>
      </section>

      <section className="signal-hunt-detail-grid unicorn-detail-grid">
        <article className="panel">
          <p className="eyebrow">What it actually does</p>
          <h2>Product claim</h2>
          <p>{candidate.what_it_actually_does}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Proof of shipping</p>
          <h2>Receipts before conviction</h2>
          <p>{candidate.proof_of_shipping}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Attention quality</p>
          <h2>Who understands it?</h2>
          <p>{candidate.attention_quality_note}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Token survivability</p>
          <h2>Can the token survive?</h2>
          <p>{candidate.token_survivability_note}</p>
        </article>
      </section>

      <section className="panel unicorn-section">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Risk Flags</p>
            <h2>{candidate.risk_flags.length}</h2>
          </div>
          <p className="panel-caption">{candidate.why_now}</p>
        </div>
        <div className="proof-flag-list unicorn-risk-list">
          {candidate.risk_flags.map((flag) => <span key={flag}>{flag}</span>)}
        </div>
        <div className="signal-hunt-card-actions">
          <a className="execute compact secondary" href="/evaluation-request">Submit receipts for this candidate</a>
        </div>
      </section>

      {(candidate.tags?.length ?? 0) > 0 && <section className="panel unicorn-section" aria-label="Candidate tags">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Tags</p>
            <h2>{candidate.tags?.length ?? 0}</h2>
          </div>
          <p className="panel-caption">Operational labels for current Radar review state.</p>
        </div>
        <div className="proof-flag-list unicorn-risk-list">
          {candidate.tags?.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </section>}

      <section className="panel unicorn-section">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Receipts</p>
            <h2>{candidate.receipts.length}</h2>
          </div>
          <p className="panel-caption">Every conviction increase needs a receipt.</p>
        </div>
        <div className="unicorn-receipt-grid">
          {candidate.receipts.map((receipt) => <article className="panel unicorn-revenue-card" key={receipt.id}>
            <p className="eyebrow">{receipt.type}</p>
            <h3>{receipt.label}</h3>
            <p>{receipt.note}</p>
            <p className="panel-caption">{receipt.source}</p>
          </article>)}
        </div>
      </section>

      <section className="signal-hunt-detail-grid unicorn-detail-grid">
        <article className="panel">
          <p className="eyebrow">Linked narratives</p>
          <h2>Context routes</h2>
          <div className="signal-hunt-chip-row">
            {candidate.linked_narratives.map((link) => <a key={link.href} className="copy-chip" href={link.href}>{link.label}</a>)}
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Linked graph node</p>
          <h2>{candidate.linked_graph_node.label}</h2>
          <a className="execute compact secondary" href={candidate.linked_graph_node.href}>Open graph</a>
        </article>
        <article className="panel">
          <p className="eyebrow">Hunter attribution</p>
          <h2>{candidate.hunter_credit.handle}</h2>
          <p>{candidate.hunter_credit.attribution}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Final Infopunks verdict</p>
          <h2>{candidate.displayVerdict ?? verdictCopy(candidate.verdict)}</h2>
          <p>Influencers sell certainty. Infopunks sells legible uncertainty.</p>
        </article>
      </section>
    </main>
  </div>;
}
