import React, { useEffect, useMemo, useState } from 'react';
import type {
  RhChainMemeToken,
  RhChainPayload,
  RhChainPulseMetric,
  RhChainReceipt,
  RhChainRiskState,
  RhChainSignalIndexAsset,
  RhChainSignalLabel,
  RhChainSource
} from '../data/rhChain';
import { NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

function syncPageMetadata(path: string) {
  const title = 'RH Chain Signal Desk';
  const description = 'Wall Street rails. Meme liquidity. Infopunks intelligence.';
  const canonical = `${NARRATIVE_PUBLIC_HOST}${path}`;
  document.title = title;
  setMeta('description', description);
  setMeta('og:title', title, 'property');
  setMeta('og:description', description, 'property');
  setMeta('og:url', canonical, 'property');
  setCanonical(canonical);
}

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function RhChainSignalDeskPage({ narrativeRoute = false }: { narrativeRoute?: boolean }) {
  const [desk, setDesk] = useState<RhChainPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<RhChainRiskState | 'all'>('all');
  const currentPath = narrativeRoute ? '/narratives/robinhood-chain' : '/rh-chain-signal-desk';

  useEffect(() => {
    syncPageMetadata(currentPath);
  }, [currentPath]);

  useEffect(() => {
    api<RhChainPayload>('/v1/rh-chain')
      .then((response) => setDesk(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'rh_chain_desk_unavailable'));
  }, []);

  const visibleMemes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (desk?.meme_pulse ?? []).filter((token) => {
      const matchesRisk = risk === 'all' || token.risk_state === risk;
      const matchesQuery = !needle || [token.ticker, token.name, token.contract, token.infopunks_verdict].join(' ').toLowerCase().includes(needle);
      return matchesRisk && matchesQuery;
    });
  }, [desk?.meme_pulse, query, risk]);

  return <div className="shell narrative-shell rh-chain-shell">
    <a className="skip-link" href="#rh-chain-content">Skip to content</a>
    <header className="site-header">
      <RhChainNav current={currentPath} />
    </header>
    <main id="rh-chain-content" className="narrative-page rh-chain-page">
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {desk && <>
        <section className="panel hero rh-chain-hero">
          <div>
            <p className="eyebrow">Public Intelligence Desk</p>
            <h1>{desk.title}</h1>
            <p className="copy">{desk.subtitle}</p>
            <p className="copy narrative-rally-line">Intelligence desk, not casino.</p>
            <div className="panel-actions">
              <a className="execute" href="#meme-pulse">Open Meme Pulse</a>
              <a className="execute compact secondary" href="/v1/rh-chain">JSON</a>
              <a className="execute compact secondary" href="/v1/rh-chain/receipts">Receipts</a>
            </div>
          </div>
          <aside className="rh-chain-hero-rail" aria-label="Desk policy">
            <p className="section-kicker">Source policy</p>
            <p>{desk.source_policy}</p>
            <p className="rh-chain-disclaimer">{desk.disclaimer}</p>
            <p className="panel-caption">Last updated {formatTimestamp(desk.last_updated)}</p>
          </aside>
        </section>

        <RhChainPulseSection desk={desk} />
        <MemePulseSection memes={visibleMemes} allMemes={desk.meme_pulse} query={query} risk={risk} onQuery={setQuery} onRisk={setRisk} />
        <SignalClassifierSection desk={desk} />
        <RiskWallSection desk={desk} />
        <StockTokenSpilloverSection desk={desk} />
        <SubmitSignalSection />
        <SignalIndexSection assets={desk.signal_index_4663} />
        <ReceiptsSection receipts={desk.receipts} />
      </>}
    </main>
  </div>;
}

function RhChainNav({ current }: { current: string }) {
  const links = [
    { href: '/rh-chain-signal-desk', label: 'RH Chain Desk' },
    { href: '/narratives/robinhood-chain', label: 'Narrative Alias' },
    { href: '/narratives', label: 'Narrative Intel' },
    { href: '/narratives/attention-market-watch', label: 'Attention Market Watch' },
    { href: '/graph', label: 'Signal Graph' }
  ];
  return <nav className="global-toolbar narrative-toolbar" aria-label="RH Chain Signal Desk navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Radar home">
      <span>Infopunks</span>
      <strong>RH Chain</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="RH Chain routes">
      {links.map((link) => <a key={link.href} href={link.href} className={current === link.href ? 'active' : ''} aria-current={current === link.href ? 'page' : undefined}>{link.label}</a>)}
    </div>
    <div className="terminal-actions" aria-label="API links">
      <span className="terminal-action-cluster">
        <a className="methodology-trigger" href="/v1/rh-chain/memes">Memes API</a>
        <a className="methodology-trigger" href="/v1/rh-chain/signals">Signals API</a>
      </span>
    </div>
  </nav>;
}

function RhChainPulseSection({ desk }: { desk: RhChainPayload }) {
  return <section className="panel rh-chain-section" aria-label="Chain Pulse">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Chain Pulse</p>
        <h2>Chain Pulse</h2>
        <p>TVL, DEX volume, stock-token activity, stable liquidity, protocols, and bridge notes.</p>
      </div>
      <span className="source-badge">{formatTimestamp(desk.last_updated)}</span>
    </div>
    <div className="rh-chain-metric-grid">
      {desk.chain_pulse.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
    </div>
    <div className="rh-chain-two-column">
      <div className="rh-chain-subpanel">
        <p className="section-kicker">Top protocols</p>
        <div className="rh-chain-list">
          {desk.chain_pulse.top_protocols.map((protocol) => <article key={protocol.name} className="rh-chain-list-item">
            <div>
              <h3>{protocol.name}</h3>
              <p>{protocol.note}</p>
            </div>
            <span className="rh-chain-chip">{protocol.category}</span>
            <SourceLine source={protocol.source} />
          </article>)}
        </div>
      </div>
      <div className="rh-chain-subpanel">
        <p className="section-kicker">Bridge notes</p>
        <div className="rh-chain-list">
          {desk.chain_pulse.bridge_notes.map((note) => <p key={note} className="rh-chain-note">{note}</p>)}
        </div>
      </div>
    </div>
  </section>;
}

function MetricCard({ metric }: { metric: RhChainPulseMetric }) {
  return <article className={`rh-chain-metric state-${metric.state}`}>
    <div>
      <p className="section-kicker">{metric.label}</p>
      <strong>{metric.value}</strong>
      <p>{metric.note}</p>
    </div>
    <SourceLine source={metric.source} />
  </article>;
}

function MemePulseSection({
  memes,
  allMemes,
  query,
  risk,
  onQuery,
  onRisk
}: {
  memes: RhChainMemeToken[];
  allMemes: RhChainMemeToken[];
  query: string;
  risk: RhChainRiskState | 'all';
  onQuery: (value: string) => void;
  onRisk: (value: RhChainRiskState | 'all') => void;
}) {
  const riskStates = Array.from(new Set(allMemes.map((token) => token.risk_state)));
  return <section id="meme-pulse" className="panel rh-chain-section" aria-label="Meme Pulse">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Meme Pulse</p>
        <h2>Meme Pulse</h2>
        <p>Ranked Robinhood Chain meme watchlist with contracts, liquidity proof slots, risk state, and Infopunks verdict.</p>
      </div>
      <div className="rh-chain-controls">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => onQuery(event.target.value)} aria-label="Search meme pulse" />
        </label>
        <label>
          <span>Risk</span>
          <select value={risk} onChange={(event) => onRisk(event.target.value as RhChainRiskState | 'all')} aria-label="Filter risk state">
            <option value="all">all</option>
            {riskStates.map((state) => <option key={state} value={state}>{formatLabel(state)}</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="rh-chain-table" role="table" aria-label="Robinhood Chain meme token watchlist">
      <div className="rh-chain-table-row head" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Ticker</span>
        <span role="columnheader">Contract</span>
        <span role="columnheader">Market Cap</span>
        <span role="columnheader">Volume</span>
        <span role="columnheader">Liquidity</span>
        <span role="columnheader">Risk</span>
        <span role="columnheader">Verdict</span>
      </div>
      {memes.map((token) => <MemeTokenRow key={`${token.rank}-${token.ticker}`} token={token} />)}
    </div>
  </section>;
}

function MemeTokenRow({ token }: { token: RhChainMemeToken }) {
  return <article className="rh-chain-table-row" role="row">
    <span role="cell">{token.rank}</span>
    <span role="cell"><b>{token.ticker}</b><small>{token.name}</small></span>
    <span role="cell" className="rh-chain-contract">{token.contract}</span>
    <span role="cell">{token.market_cap}</span>
    <span role="cell">{token.volume_24h}</span>
    <span role="cell">{token.liquidity}</span>
    <span role="cell"><RiskBadge state={token.risk_state} /></span>
    <span role="cell">
      <small>{token.infopunks_verdict}</small>
      <div className="rh-chain-label-row">
        {token.signal_labels.map((label) => <SignalLabelChip key={`${token.ticker}-${label}`} label={label} />)}
      </div>
      <SourceLine source={token.source} />
    </span>
  </article>;
}

function SignalClassifierSection({ desk }: { desk: RhChainPayload }) {
  return <section className="panel rh-chain-section" aria-label="Signal Classifier">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Signal Classifier</p>
        <h2>Signal Classifier</h2>
        <p>Labels determine desk action. Attention without receipts stays under review.</p>
      </div>
    </div>
    <div className="rh-chain-classifier-grid">
      {desk.signal_classifier.map((item) => <article key={item.label} className="rh-chain-classifier-card">
        <SignalLabelChip label={item.label} />
        <h3>{formatLabel(item.label)}</h3>
        <p>{item.meaning}</p>
        <p><b>Trigger:</b> {item.trigger}</p>
        <p><b>Desk action:</b> {item.desk_action}</p>
      </article>)}
    </div>
  </section>;
}

function RiskWallSection({ desk }: { desk: RhChainPayload }) {
  return <section className="panel rh-chain-section" aria-label="Risk Wall">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Risk Wall</p>
        <h2>Risk Wall</h2>
        <p>Suspicious launches, low-liquidity traps, unverified contracts, and deployer warnings.</p>
      </div>
    </div>
    <div className="rh-chain-risk-grid">
      {desk.risk_wall.map((item) => <article key={item.id} className={`rh-chain-risk-card risk-${item.risk_state}`}>
        <div className="rh-chain-card-head">
          <h3>{item.title}</h3>
          <RiskBadge state={item.risk_state} />
        </div>
        <p>{item.summary}</p>
        <div className="rh-chain-evidence-list">
          {item.evidence_needed.map((evidence) => <span key={evidence}>{evidence}</span>)}
        </div>
        <SourceLine source={item.source} />
      </article>)}
    </div>
  </section>;
}

function StockTokenSpilloverSection({ desk }: { desk: RhChainPayload }) {
  return <section className="panel rh-chain-section" aria-label="Stock Token Spillover Map">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Stock Token Spillover Map</p>
        <h2>Stock Token Spillover Map</h2>
        <p>How Robinhood Chain finance themes mutate into meme narratives.</p>
      </div>
    </div>
    <div className="rh-chain-spillover-grid">
      {desk.stock_token_spillover_map.map((theme) => <article key={theme.id} className="rh-chain-spillover-card">
        <p className="section-kicker">{theme.finance_theme}</p>
        <h3>{theme.meme_mutation}</h3>
        <p>{theme.signal_read}</p>
        <small>{theme.risk_note}</small>
      </article>)}
    </div>
  </section>;
}

function SubmitSignalSection() {
  const [submitted, setSubmitted] = useState(false);
  const [disclosed, setDisclosed] = useState(false);
  return <section className="panel rh-chain-section" aria-label="Submit Signal">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Submit Signal</p>
        <h2>Submit Signal</h2>
        <p>Stage a token for review. Promotion requires receipts, source timestamps, and risk disclosure.</p>
      </div>
    </div>
    <form className="rh-chain-submit-form" onSubmit={(event) => {
      event.preventDefault();
      setSubmitted(true);
    }}>
      <label><span>Token contract</span><input name="contract" aria-label="Token contract" placeholder="0x... or explorer URL" /></label>
      <label><span>Ticker</span><input name="ticker" aria-label="Ticker" placeholder="TICKR" /></label>
      <label className="wide"><span>Links</span><textarea name="links" aria-label="Links" rows={4} placeholder="One source per line" /></label>
      <label className="wide"><span>Notes</span><textarea name="notes" aria-label="Notes" rows={4} placeholder="Receipts, holder notes, deployer warnings, route context" /></label>
      <label className="rh-chain-checkbox wide">
        <input type="checkbox" checked={disclosed} onChange={(event) => setDisclosed(event.target.checked)} />
        <span>I disclose affiliation, holdings, paid promotion, and any deployer or market-maker connection.</span>
      </label>
      <div className="panel-actions wide">
        <button className="execute" type="submit" disabled={!disclosed}>Stage Signal</button>
      </div>
    </form>
    {submitted && <p className="route-state ok">Signal staged locally. Backend intake is not enabled for this desk yet.</p>}
  </section>;
}

function SignalIndexSection({ assets }: { assets: RhChainSignalIndexAsset[] }) {
  return <section className="panel rh-chain-section" aria-label="4663 Signal Index">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">4663 Signal Index</p>
        <h2>4663 Signal Index</h2>
        <p>Seeded index of top Robinhood Chain attention assets.</p>
      </div>
    </div>
    <div className="rh-chain-index-grid">
      {assets.map((asset) => <article key={`${asset.rank}-${asset.ticker}`} className="rh-chain-index-card">
        <div className="rh-chain-card-head">
          <p className="section-kicker">Rank {asset.rank}</p>
          <strong>{asset.signal_score}/100</strong>
        </div>
        <h3>{asset.ticker} / {asset.asset}</h3>
        <p>{asset.note}</p>
        <p><b>Attention:</b> {asset.attention_source}</p>
        <p><b>Receipts:</b> {asset.receipt_state}</p>
        <div className="rh-chain-label-row">
          {asset.labels.map((label) => <SignalLabelChip key={`${asset.ticker}-${label}`} label={label} />)}
        </div>
      </article>)}
    </div>
  </section>;
}

function ReceiptsSection({ receipts }: { receipts: RhChainReceipt[] }) {
  return <section className="panel rh-chain-section" aria-label="Receipts">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Receipts</p>
        <h2>Receipts</h2>
        <p>Proof memory for desk changes. Claims without receipts stay unpromoted.</p>
      </div>
    </div>
    <div className="rh-chain-receipt-grid">
      {receipts.map((receipt) => <article key={receipt.receipt_id} className="rh-chain-receipt-card">
        <p className="section-kicker">{receipt.receipt_id}</p>
        <h3>{formatTimestamp(receipt.timestamp)}</h3>
        <p>{receipt.summary}</p>
        <small>{receipt.caveat}</small>
        <div className="rh-chain-label-row">
          {receipt.linked_assets.map((asset) => <span key={asset} className="rh-chain-chip">{asset}</span>)}
        </div>
      </article>)}
    </div>
  </section>;
}

function SourceLine({ source }: { source: RhChainSource }) {
  return <p className="rh-chain-source">
    <span>source: {source.url ? <a href={source.url}>{source.source}</a> : source.source}</span>
    <span>observed_at: {formatTimestamp(source.observed_at)}</span>
    <span>{source.caveat}</span>
  </p>;
}

function SignalLabelChip({ label }: { label: RhChainSignalLabel }) {
  return <span className={`rh-chain-label label-${label}`}>{label}</span>;
}

function RiskBadge({ state }: { state: RhChainRiskState }) {
  return <span className={`rh-chain-risk-badge risk-${state}`}>{formatLabel(state)}</span>;
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatTimestamp(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}
