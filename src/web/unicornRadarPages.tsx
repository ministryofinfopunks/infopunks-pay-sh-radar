import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

type UnicornRadarSector =
  | 'AI'
  | 'AI / Agent Rails'
  | 'RWA'
  | 'DeFi'
  | 'DePIN'
  | 'Consumer'
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
  type: 'shipping' | 'attention' | 'token' | 'risk' | 'market' | 'payment' | 'note';
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
  what_it_actually_does: string;
  proof_of_shipping: string;
  attention_quality_note: string;
  token_survivability_note: string;
  risk_flags: string[];
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
const SECTORS: Array<'all' | UnicornRadarSector> = ['all', 'AI', 'AI / Agent Rails', 'RWA', 'DeFi', 'DePIN', 'Consumer', 'Agent Rails', 'Payment Infrastructure', 'Social / Attention Markets', 'Tokenized Apps'];
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

function statusTone(status: UnicornRadarStatus) {
  if (status === 'high_signal_lowcap') return 'ok';
  if (status === 'do_not_touch_yet') return 'danger';
  if (status === 'consensus_forming' || status === 'infopunks_missed_it') return 'warn';
  if (status === 'paid_evaluation') return 'paid';
  return 'review';
}

function verdictCopy(verdict: UnicornRadarVerdict) {
  switch (verdict) {
    case 'high_signal_early':
      return 'High signal early';
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
  return <span className="status-pill ok">Verified live market</span>;
}

function UnicornRadarNav() {
  const pathname = window.location.pathname;
  return <nav className="global-toolbar proof-check-toolbar unicorn-radar-nav" aria-label="Unicorn Radar navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Unicorn Radar</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Unicorn Radar routes">
      <a href="/unicorn-radar" aria-current={pathname === '/unicorn-radar' ? 'page' : undefined}>Unicorn Radar</a>
      <a href="/narratives">Narrative Intel</a>
      <a href="/signal-hunt">Signal Hunt</a>
      <a href="/graph">Signal Graph</a>
      <a href="/check">Proof Feed</a>
    </div>
  </nav>;
}

function CandidateCard({ candidate }: { candidate: UnicornRadarCandidate }) {
  return <article className="panel unicorn-candidate-card screenshot-card" aria-label={`${candidate.project} Unicorn Radar card`}>
    <div className="unicorn-card-head">
      <div>
        <span className={`status-pill ${statusTone(candidate.status)}`}>{titleCase(candidate.status)}</span>
        <span className="unicorn-sector-chip">{candidate.sector}</span>
        <VerificationBadge candidate={candidate} />
      </div>
      <strong>{candidate.ticker}</strong>
    </div>
    <h3>{candidate.project}</h3>
    <p className="unicorn-market-cap">{candidate.market_cap_range}</p>
    <p className="copy">{candidate.thesis}</p>
    <div className="unicorn-score-grid">
      {topScores(candidate).map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}
    </div>
    <div className="proof-flag-list unicorn-risk-list">
      {candidate.risk_flags.slice(0, 4).map((flag) => <span key={flag}>{flag}</span>)}
    </div>
    <div className="unicorn-card-meta">
      <p><span>Receipts</span><strong>{candidate.receipts.length}</strong></p>
      <p><span>Hunter</span><strong>{candidate.hunter_credit.handle}</strong></p>
    </div>
    <MarketDataPanel candidate={candidate} compact />
    {candidate.paid_evaluation_disclosure.is_paid && <p className="unicorn-paid-note">{candidate.paid_evaluation_disclosure.label}: {candidate.paid_evaluation_disclosure.note}</p>}
    <div className="signal-hunt-card-actions">
      <a className="execute compact secondary" href={`/unicorn-radar/${encodeURIComponent(candidate.id)}`}>Open candidate</a>
    </div>
  </article>;
}

function CandidateSection({ title, subtitle, candidates }: { title: string; subtitle: string; candidates: UnicornRadarCandidate[] }) {
  return <section className="panel unicorn-section" aria-label={title}>
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">{title}</p>
        <h2>{candidates.length}</h2>
      </div>
      <p className="panel-caption">{subtitle}</p>
    </div>
    {candidates.length
      ? <div className="unicorn-card-grid">{candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}</div>
      : <p className="panel-caption">No verified candidates yet. Submit a candidate with receipts.</p>}
  </section>;
}

function SectorCoverageSection({ candidates }: { candidates: UnicornRadarCandidate[] }) {
  const sectors = SECTORS.filter((sector): sector is UnicornRadarSector => sector !== 'all');
  return <section className="panel unicorn-section" aria-label="Sector coverage">
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">Sector Coverage</p>
        <h2>{candidates.length}</h2>
      </div>
      <p className="panel-caption">Verified live candidates can be sparse. Empty sectors stay explicit instead of being padded with placeholders.</p>
    </div>
    <div className="unicorn-card-grid">
      {sectors.map((sector) => {
        const count = candidates.filter((candidate) => candidate.sector === sector && candidate.productionReady).length;
        return <article className="panel unicorn-candidate-card screenshot-card" key={sector}>
          <div className="unicorn-card-head">
            <div><span className="unicorn-sector-chip">{sector}</span></div>
            <strong>{count}</strong>
          </div>
          <h3>{sector}</h3>
          <p className="panel-caption">{count ? `${count} verified candidate${count === 1 ? '' : 's'} live.` : 'No verified candidates yet. Submit a candidate with receipts.'}</p>
        </article>;
      })}
    </div>
  </section>;
}

function FilterSelect<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: T[]; onChange: (value: T) => void }) {
  return <label className="unicorn-filter">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {values.map((item) => <option key={item} value={item}>{item === 'all' ? 'All' : titleCase(item)}</option>)}
    </select>
  </label>;
}

export function UnicornRadarPage() {
  const [summary, setSummary] = useState<UnicornRadarSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState<'all' | UnicornRadarSector>('all');
  const [status, setStatus] = useState<'all' | UnicornRadarStatus>('all');
  const [verdict, setVerdict] = useState<'all' | UnicornRadarVerdict>('all');

  useEffect(() => {
    api<{ data: UnicornRadarSummary }>('/v1/unicorn-radar')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'unicorn_radar_unavailable'));
  }, []);

  const filtered = useMemo(() => {
    return (summary?.candidates ?? []).filter((candidate) => {
      if (sector !== 'all' && candidate.sector !== sector) return false;
      if (status !== 'all' && candidate.status !== status) return false;
      if (verdict !== 'all' && candidate.verdict !== verdict) return false;
      return true;
    });
  }, [sector, status, summary?.candidates, verdict]);

  const groups = useMemo(() => ({
    highSignal: filtered.filter((candidate) => candidate.status === 'high_signal_lowcap'),
    watchlist: filtered.filter((candidate) => candidate.status === 'watchlist' || candidate.status === 'unseen_signal' || candidate.status === 'paid_evaluation'),
    doNotTouch: filtered.filter((candidate) => candidate.status === 'do_not_touch_yet'),
    consensus: filtered.filter((candidate) => candidate.status === 'consensus_forming' || candidate.status === 'infopunks_missed_it')
  }), [filtered]);

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell">
    <UnicornRadarNav />
    <main className="builder-page unicorn-radar-page" aria-label="Infopunks Unicorn Radar">
      <section className="panel hero unicorn-radar-hero">
        <div>
          <p className="eyebrow">Commercial signal wedge</p>
          <h1>{summary?.title ?? 'Infopunks Unicorn Radar'}</h1>
          <h2>{summary?.tagline ?? 'Finding serious low-cap Solana projects before consensus does.'}</h2>
          <p className="copy">{summary?.subline ?? 'Retail needs better signal before taking risk.'}</p>
          <p className="copy">{summary?.trust_line ?? 'Projects can buy evaluation, not conviction.'}</p>
          <p className="panel-caption">{summary?.doctrine_line ?? 'Influencers sell certainty. Infopunks sells legible uncertainty.'}</p>
          <div className="signal-hunt-hero-actions">
            <a className="execute" href="#submit-candidate">Submit Candidate</a>
            <a className="execute compact secondary" href="#request-evaluation">Request Paid Evaluation</a>
          </div>
        </div>
        <div className="signal-hunt-counter-grid unicorn-counter-grid" aria-label="Radar status counters">
          <article className="panel loop-counter-card"><span>candidates</span><strong>{summary?.counts.total ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>high signal</span><strong>{summary?.counts.by_status.high_signal_lowcap ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>watchlist</span><strong>{summary?.counts.by_status.watchlist ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>do not touch</span><strong>{summary?.counts.by_status.do_not_touch_yet ?? 0}</strong></article>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      <section className="panel unicorn-filter-panel" aria-label="Candidate filters">
        <FilterSelect label="Sector" value={sector} values={SECTORS} onChange={setSector} />
        <FilterSelect label="Status" value={status} values={STATUSES} onChange={setStatus} />
        <FilterSelect label="Verdict" value={verdict} values={VERDICTS} onChange={setVerdict} />
      </section>

      <SectorCoverageSection candidates={summary?.candidates ?? []} />

      <CandidateSection title="High-Signal Lowcaps" subtitle="Serious early candidates where shipping, timing, and asymmetry are already legible." candidates={groups.highSignal} />
      <CandidateSection title="Watchlist" subtitle="Interesting candidates that need more receipts before conviction can rise." candidates={groups.watchlist} />
      <CandidateSection title="Do Not Touch Yet" subtitle="Risk is too high, proof is too thin, or token survivability is not legible." candidates={groups.doNotTouch} />
      <CandidateSection title="Consensus Forming" subtitle="The early edge may already be closing, including explicit missed-it records." candidates={groups.consensus} />

      <section className="panel unicorn-section" aria-label="Revenue Receipts">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Revenue Receipts</p>
            <h2>{summary?.revenue_receipts.length ?? 0}</h2>
          </div>
          <p className="panel-caption">Projects can buy evaluation, not conviction. Receipts keep the commercial layer visible.</p>
        </div>
        <div className="unicorn-receipt-grid">
          {(summary?.revenue_receipts ?? []).map((receipt) => <article className="panel unicorn-revenue-card" key={receipt.id}>
            <p className="eyebrow">{receipt.status}</p>
            <h3>{receipt.project}</h3>
            <p><strong>${receipt.amount_usd}</strong> {titleCase(receipt.service)}</p>
            <p className="panel-caption">{receipt.disclosure}</p>
          </article>)}
        </div>
      </section>

      <section className="signal-hunt-cta-grid unicorn-cta-grid">
        <article id="submit-candidate" className="panel signal-hunt-cta-card">
          <p className="eyebrow">Submit Candidate</p>
          <h2>Low-cap Solana signal intake.</h2>
          <p className="copy">Use <code>POST /v1/unicorn-radar/submit</code> with thesis, sector, shipping proof, and evidence links.</p>
          <a className="execute compact secondary" href="/developers">Open developer surface</a>
        </article>
        <article id="request-evaluation" className="panel signal-hunt-cta-card">
          <p className="eyebrow">Request Paid Evaluation</p>
          <h2>Buy evaluation, not conviction.</h2>
          <p className="copy">Use <code>POST /v1/unicorn-radar/request-evaluation</code>. Paid status is disclosed if a public candidate enters the Radar.</p>
          <a className="execute compact secondary" href="/openapi.json">Open API schema</a>
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
          <h2>{verdictCopy(candidate.verdict)}</h2>
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
      </section>

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
          <h2>{verdictCopy(candidate.verdict)}</h2>
          <p>Influencers sell certainty. Infopunks sells legible uncertainty.</p>
        </article>
      </section>
    </main>
  </div>;
}
