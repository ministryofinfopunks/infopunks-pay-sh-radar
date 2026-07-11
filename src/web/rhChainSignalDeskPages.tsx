import React, { useEffect, useMemo, useState } from 'react';
import type {
  RhChain4663Asset,
  RhChain4663IndexPayload,
  RhChain4663NarrativeClass,
  RhChainDailyReceipt,
  RhChainDailyReceiptsPayload,
  RhChainMemeToken,
  RhChainPayload,
  RhChainPulseMetric,
  RhChainReceipt,
  RhChainReviewItem,
  RhChainReviewQueuePayload,
  RhChainReviewState,
  RhChainRiskState,
  RhChainSignalLabel,
  RhChainSource
} from '../data/rhChain';
import { NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { RhChainSignalSubmission } from '../services/rhChainSignalVault';
import type { RhChainLiveSnapshot } from '../services/rhChainLiveSnapshotService';

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

async function postApi<T>(path: string, body: unknown) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null) as { error?: string; issues?: Array<{ message?: string }>; data?: T } | null;
  if (!response.ok) {
    const issue = payload?.issues?.[0]?.message;
    throw new Error(issue || payload?.error || `${path} ${response.status}`);
  }
  if (!payload || !('data' in payload)) throw new Error('invalid_api_response');
  return payload as { data: T };
}

function syncPageMetadata(path: string) {
  const title = path === '/rh-chain-signal-desk/live-snapshot'
    ? 'RH Chain Live Snapshot'
    : path === '/rh-chain-signal-desk/daily-receipts'
    ? 'Daily RH Chain Receipts'
    : path === '/rh-chain-signal-desk/4663-index'
    ? '4663 Signal Index'
    : path === '/rh-chain-signal-desk/review-queue'
    ? 'RH Chain Review Queue'
    : path === '/rh-chain-signal-desk/submit'
      ? 'Submit Signal | RH Chain Signal Desk'
      : 'RH Chain Signal Desk';
  const description = path === '/rh-chain-signal-desk/live-snapshot'
    ? 'Cached external market context for the RH Chain intelligence desk.'
    : path === '/rh-chain-signal-desk/daily-receipts'
    ? 'The market forgets. Infopunks keeps the memory.'
    : path === '/rh-chain-signal-desk/4663-index'
    ? 'A living index of Robinhood Chain attention assets, risk states, and narrative mutations.'
    : path === '/rh-chain-signal-desk/review-queue'
    ? 'Public RH Chain intelligence queue where receipts decide what survives.'
    : path === '/rh-chain-signal-desk/submit'
      ? 'Submit a Robinhood Chain token or signal for Infopunks public intelligence review.'
      : 'Wall Street rails. Meme liquidity. Infopunks intelligence.';
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

export function RhChainSignalDeskPage({ narrativeRoute = false, submitRoute = false, reviewQueueRoute = false, indexRoute = false, dailyReceiptsRoute = false, liveSnapshotRoute = false }: { narrativeRoute?: boolean; submitRoute?: boolean; reviewQueueRoute?: boolean; indexRoute?: boolean; dailyReceiptsRoute?: boolean; liveSnapshotRoute?: boolean }) {
  const [desk, setDesk] = useState<RhChainPayload | null>(null);
  const [reviewQueue, setReviewQueue] = useState<RhChainReviewQueuePayload | null>(null);
  const [signalIndex, setSignalIndex] = useState<RhChain4663IndexPayload | null>(null);
  const [dailyReceipts, setDailyReceipts] = useState<RhChainDailyReceiptsPayload | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<RhChainLiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<RhChainRiskState | 'all'>('all');
  const currentPath = liveSnapshotRoute ? '/rh-chain-signal-desk/live-snapshot' : dailyReceiptsRoute ? '/rh-chain-signal-desk/daily-receipts' : indexRoute ? '/rh-chain-signal-desk/4663-index' : reviewQueueRoute ? '/rh-chain-signal-desk/review-queue' : submitRoute ? '/rh-chain-signal-desk/submit' : narrativeRoute ? '/narratives/robinhood-chain' : '/rh-chain-signal-desk';

  useEffect(() => {
    syncPageMetadata(currentPath);
  }, [currentPath]);

  useEffect(() => {
    api<RhChainPayload>('/v1/rh-chain')
      .then((response) => setDesk(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'rh_chain_desk_unavailable'));
    api<RhChainReviewQueuePayload>('/v1/rh-chain/review-queue')
      .then((response) => setReviewQueue(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'rh_chain_review_queue_unavailable'));
    api<RhChain4663IndexPayload>('/v1/rh-chain/4663-index')
      .then((response) => setSignalIndex(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'rh_chain_4663_index_unavailable'));
    api<RhChainDailyReceiptsPayload>('/v1/rh-chain/daily-receipts')
      .then((response) => setDailyReceipts(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'rh_chain_daily_receipts_unavailable'));
    api<RhChainLiveSnapshot>('/v1/rh-chain/live-snapshot')
      .then((response) => setLiveSnapshot(response.data))
      .catch(() => undefined);
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
            <p className="eyebrow">{dailyReceiptsRoute ? 'Daily Market Memory' : indexRoute ? 'Public Market Memory' : reviewQueueRoute ? 'Public Review Pipeline' : 'Public Intelligence Desk'}</p>
            <h1>{liveSnapshotRoute ? 'RH Chain Live Snapshot' : dailyReceiptsRoute ? 'Daily RH Chain Receipts' : indexRoute ? '4663 Signal Index' : reviewQueueRoute ? 'RH Chain Review Queue' : desk.title}</h1>
            <p className="copy">{liveSnapshotRoute ? 'External market context, cached with receipts.' : dailyReceiptsRoute ? 'The market forgets. Infopunks keeps the memory.' : indexRoute ? 'Wall Street rails. Meme liquidity. Ranked by receipts.' : reviewQueueRoute ? 'Signals enter the desk. Receipts decide what survives.' : desk.subtitle}</p>
            <p className="copy narrative-rally-line">{dailyReceiptsRoute ? 'Receipts before narrative drift.' : indexRoute ? 'Intelligence index, not a token.' : reviewQueueRoute ? 'Public memory, not endorsement.' : 'Intelligence desk, not casino.'}</p>
            <div className="panel-actions">
              <a className="execute" href={dailyReceiptsRoute ? '#latest-receipt' : indexRoute ? '#ranked-index' : reviewQueueRoute ? '#queue-board' : '#meme-pulse'}>{dailyReceiptsRoute ? 'Open Latest Receipt' : indexRoute ? 'Open Ranked Index' : reviewQueueRoute ? 'Open Queue Board' : 'Open Meme Pulse'}</a>
              <a className="execute compact secondary" href={submitRoute ? '#submit-signal' : '/rh-chain-signal-desk/submit'}>Submit Signal</a>
              <a className="execute compact secondary" href="/rh-chain-signal-desk/daily-receipts">Daily Receipts</a>
              <a className="execute compact secondary" href="/rh-chain-signal-desk/4663-index">Open 4663 Index</a>
              <a className="execute compact secondary" href="/rh-chain-signal-desk/review-queue">View Review Queue</a>
              <a className="execute compact secondary" href="/rh-chain-signal-desk/live-snapshot">Live Snapshot</a>
            </div>
          </div>
          <aside className="rh-chain-hero-rail" aria-label="Desk policy">
            <p className="section-kicker">Source policy</p>
            <p>{desk.source_policy}</p>
            <p className="rh-chain-disclaimer">{desk.disclaimer}</p>
            <p className="panel-caption">Last updated {formatTimestamp(desk.last_updated)}</p>
          </aside>
        </section>

        {liveSnapshotRoute && liveSnapshot ? <LiveSnapshotPage snapshot={liveSnapshot} /> : dailyReceiptsRoute && dailyReceipts ? <RhChainDailyReceiptsPage feed={dailyReceipts} /> : indexRoute && signalIndex ? <RhChain4663IndexPage index={signalIndex} /> : reviewQueueRoute && reviewQueue ? <RhChainReviewQueuePage queue={reviewQueue} /> : submitRoute ? <SubmitSignalSection /> : <>
          <RhChainPulseSection desk={desk} />
          {dailyReceipts && <DailyReceiptsPreview feed={dailyReceipts} />}
          {signalIndex && <SignalIndexPreview index={signalIndex} />}
          {reviewQueue && <ReviewQueuePreview queue={reviewQueue} />}
          {liveSnapshot && <LiveSnapshotPreview snapshot={liveSnapshot} />}
          <MemePulseSection memes={visibleMemes} allMemes={desk.meme_pulse} query={query} risk={risk} onQuery={setQuery} onRisk={setRisk} />
          <SignalClassifierSection desk={desk} />
          <RiskWallSection desk={desk} />
          <StockTokenSpilloverSection desk={desk} />
          <SubmitSignalSection />
          <ReceiptsSection receipts={desk.receipts} />
        </>}
      </>}
    </main>
  </div>;
}

function RhChainNav({ current }: { current: string }) {
  const activePath = current === '/narratives/robinhood-chain' ? '/rh-chain-signal-desk' : current;
  const links = [
    { href: '/rh-chain-signal-desk', label: 'Signal Desk' },
    { href: '/rh-chain-signal-desk/submit', label: 'Submit Signal' },
    { href: '/rh-chain-signal-desk/review-queue', label: 'Review Queue' },
    { href: '/rh-chain-signal-desk/4663-index', label: '4663 Index' },
    { href: '/rh-chain-signal-desk/daily-receipts', label: 'Daily Receipts' }
    , { href: '/rh-chain-signal-desk/live-snapshot', label: 'Live Snapshot' }
  ];
  return <nav className="global-toolbar narrative-toolbar" aria-label="RH Chain Signal Desk navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Radar home">
      <span>Infopunks</span>
      <strong>RH Chain</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="RH Chain routes">
      {links.map((link) => <a key={link.href} href={link.href} className={activePath === link.href ? 'active' : ''} aria-current={activePath === link.href ? 'page' : undefined}>{link.label}</a>)}
    </div>
    <div className="terminal-actions" aria-label="API links">
      <span className="terminal-action-cluster">
        <a className="methodology-trigger" href="/v1/rh-chain/memes">Memes API</a>
        <a className="methodology-trigger" href="/v1/rh-chain/signals">Signals API</a>
        <a className="methodology-trigger" href="/v1/rh-chain/daily-receipts">Receipts Feed</a>
        <a className="methodology-trigger" href="/v1/rh-chain/4663-index">4663 API</a>
        <a className="methodology-trigger" href="/v1/rh-chain/review-queue">Queue API</a>
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

function DailyReceiptsPreview({ feed }: { feed: RhChainDailyReceiptsPayload }) {
  const receipt = feed.latest_receipt;
  return <section className="panel rh-chain-section rh-chain-daily-preview" aria-label="Daily RH Chain Receipts Preview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Daily RH Chain Receipts</p>
        <h2>Daily RH Chain Receipts</h2>
        <p>{feed.subtitle}</p>
      </div>
      <a className="execute compact secondary" href="/rh-chain-signal-desk/daily-receipts">Open Daily Receipts</a>
    </div>
    <article className="rh-chain-daily-preview-card">
      <div className="rh-chain-card-head">
        <div>
          <p className="section-kicker">{receipt.date} / {receipt.status}</p>
          <h3>{receipt.headline}</h3>
        </div>
        <span className={`rh-chain-daily-confidence confidence-${receipt.confidence_level}`}>{receipt.confidence_level}</span>
      </div>
      <p>{receipt.summary}</p>
      <div className="rh-chain-daily-mini-grid">
        <p><span>Top signal</span><strong>{receipt.top_signal}</strong></p>
        <p><span>Biggest risk</span><strong>{receipt.biggest_risk}</strong></p>
        <p><span>Verdict</span><strong>{receipt.infopunks_verdict}</strong></p>
      </div>
    </article>
  </section>;
}

function RhChainDailyReceiptsPage({ feed }: { feed: RhChainDailyReceiptsPayload }) {
  return <>
    <LatestDailyReceiptSection receipt={feed.latest_receipt} />
    <DailyReceiptTimeline receipts={feed.receipts} />
    <DailyWatchlistSection receipt={feed.latest_receipt} />
    <DailyDoNotTouchSection receipt={feed.latest_receipt} />
    <DailySourceNotesSection feed={feed} />
    <section className="panel rh-chain-section rh-chain-review-disclaimer" aria-label="Daily RH Chain Receipts Disclaimer">
      <p>{feed.disclaimer}</p>
      <p className="panel-caption">{feed.source_policy}</p>
    </section>
  </>;
}

function LatestDailyReceiptSection({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section id="latest-receipt" className="panel rh-chain-section" aria-label="Latest Daily RH Chain Receipt">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Latest Receipt</p>
        <h2>Latest Receipt</h2>
        <p>One daily memory object for signal, risk, narrative, liquidity, and verdict.</p>
      </div>
      <span className={`rh-chain-daily-confidence confidence-${receipt.confidence_level}`}>{receipt.confidence_level}</span>
    </div>
    <article className="rh-chain-daily-latest-card">
      <div>
        <p className="section-kicker">{receipt.date} / {receipt.status}</p>
        <h3>{receipt.headline}</h3>
        <p>{receipt.summary}</p>
      </div>
      <div className="rh-chain-daily-fact-grid">
        <p><span>Top signal</span><strong>{receipt.top_signal}</strong></p>
        <p><span>Biggest risk</span><strong>{receipt.biggest_risk}</strong></p>
        <p><span>Strongest narrative</span><strong>{receipt.strongest_narrative}</strong></p>
        <p><span>Infopunks verdict</span><strong>{receipt.infopunks_verdict}</strong></p>
      </div>
      <div className="rh-chain-daily-note-grid">
        <p><b>Liquidity</b>{receipt.liquidity_note}</p>
        <p><b>Stock-token spillover</b>{receipt.stock_token_spillover_note}</p>
        <p><b>Solana base migration</b>{receipt.solana_base_migration_note}</p>
        <p><b>Deployer watch</b>{receipt.deployer_watch_note}</p>
      </div>
    </article>
  </section>;
}

function DailyReceiptTimeline({ receipts }: { receipts: RhChainDailyReceipt[] }) {
  return <section className="panel rh-chain-section" aria-label="Daily Receipt Timeline">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Receipt Timeline</p>
        <h2>Receipt Timeline</h2>
        <p>Chronological market memory. Calm by design, source-bound by rule.</p>
      </div>
      <a className="execute compact secondary" href="/v1/rh-chain/daily-receipts">Feed JSON</a>
    </div>
    <div className="rh-chain-daily-timeline">
      {receipts.map((receipt) => <article key={receipt.receipt_id} className="rh-chain-daily-timeline-card">
        <div className="rh-chain-card-head">
          <div>
            <p className="section-kicker">{receipt.date} / {receipt.status}</p>
            <h3>{receipt.headline}</h3>
          </div>
          <span className={`rh-chain-daily-confidence confidence-${receipt.confidence_level}`}>{receipt.confidence_level}</span>
        </div>
        <p>{receipt.summary}</p>
        <div className="rh-chain-daily-card-foot">
          <span>{receipt.receipt_id}</span>
          <span>generated {formatTimestamp(receipt.generated_at)}</span>
        </div>
      </article>)}
    </div>
  </section>;
}

function DailyWatchlistSection({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section className="panel rh-chain-section" aria-label="Daily Receipt Watchlist">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Watchlist</p>
        <h2>Watchlist</h2>
        <p>Assets and narratives to monitor next. Watch does not mean endorsement.</p>
      </div>
    </div>
    <div className="rh-chain-daily-watch-grid">
      {receipt.watchlist.map((item) => <DailyWatchItemCard key={item.item} item={item} />)}
    </div>
  </section>;
}

function DailyDoNotTouchSection({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section className="panel rh-chain-section rh-chain-daily-warning" aria-label="Daily Receipt Do Not Touch Yet">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Do Not Touch Yet</p>
        <h2>Do Not Touch Yet</h2>
        <p>Low-evidence or high-risk objects stay visible as warnings, not promotions.</p>
      </div>
    </div>
    <div className="rh-chain-daily-watch-grid">
      {receipt.do_not_touch_yet.map((item) => <DailyWatchItemCard key={item.item} item={item} warning />)}
    </div>
  </section>;
}

function DailyWatchItemCard({ item, warning = false }: { item: RhChainDailyReceipt['watchlist'][number]; warning?: boolean }) {
  return <article className={`rh-chain-daily-watch-card${warning ? ' warning' : ''}`}>
    <div className="rh-chain-card-head">
      <h3>{item.item}</h3>
      <RiskBadge state={item.risk_state} />
    </div>
    <p>{item.reason}</p>
    <p className="panel-caption"><b>Next verify:</b> {item.next_thing_to_verify}</p>
  </article>;
}

function DailySourceNotesSection({ feed }: { feed: RhChainDailyReceiptsPayload }) {
  return <section className="panel rh-chain-section" aria-label="Daily Receipt Source Notes">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Source Notes</p>
        <h2>Source Notes</h2>
        <p>Every daily receipt source carries an observed timestamp. Seeded/manual labels are explicit.</p>
      </div>
    </div>
    <div className="rh-chain-daily-source-grid">
      {feed.latest_receipt.sources.map((source) => <article key={`${source.name}-${source.observed_at}`} className="rh-chain-daily-source-card">
        <p className="section-kicker">{source.data_mode} / {source.confidence_level} / {formatTimestamp(source.observed_at)}</p>
        <h3>{source.source_url ? <a href={source.source_url}>{source.source_name}</a> : source.source_name}</h3>
        <p>{source.note}</p>
      </article>)}
    </div>
  </section>;
}

function SignalIndexPreview({ index }: { index: RhChain4663IndexPayload }) {
  const topAssets = index.assets.slice(0, 3);
  return <section className="panel rh-chain-section rh-chain-4663-preview" aria-label="4663 Signal Index Preview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">4663 Signal Index</p>
        <h2>4663 Signal Index</h2>
        <p>{index.subtitle}</p>
      </div>
      <a className="execute compact secondary" href="/rh-chain-signal-desk/4663-index">Open 4663 Index</a>
    </div>
    <div className="rh-chain-4663-preview-grid">
      {topAssets.map((asset) => <article key={asset.ticker} className="rh-chain-4663-preview-card">
        <div className="rh-chain-card-head">
          <div>
            <p className="section-kicker">Rank {asset.rank}</p>
            <h3>{asset.ticker}</h3>
          </div>
          <strong>{asset.signal_score}</strong>
        </div>
        <p>{asset.name}</p>
        <span className={`rh-chain-4663-class class-${asset.classification}`}>{formatLabel(asset.classification)}</span>
        <p className="panel-caption">{asset.infopunks_verdict}</p>
      </article>)}
    </div>
  </section>;
}

function RhChain4663IndexPage({ index }: { index: RhChain4663IndexPayload }) {
  return <>
    <IndexOverviewSection index={index} />
    <RankedIndexSection assets={index.assets} />
    <ScoreBreakdownSection assets={index.assets} />
    <NarrativeClassesSection classes={index.narrative_classes} />
    <IndexMethodologySection index={index} />
    <section className="panel rh-chain-section rh-chain-review-disclaimer" aria-label="4663 Signal Index Disclaimer">
      <p>{index.disclaimer}</p>
      <p>Index inclusion means an asset is visible to public intelligence memory. It does not mean safe to buy.</p>
      <p className="panel-caption">{index.source_policy}</p>
    </section>
  </>;
}

function IndexOverviewSection({ index }: { index: RhChain4663IndexPayload }) {
  const cards = [
    {
      label: 'Top signal',
      value: index.overview.top_signal.ticker,
      note: `${index.overview.top_signal.signal_score}/100 - ${formatLabel(index.overview.top_signal.classification)}`
    },
    {
      label: 'Highest volume',
      value: index.overview.highest_volume.ticker,
      note: `${index.overview.highest_volume.volume_score}/25 - ${index.overview.highest_volume.volume_24h}`
    },
    {
      label: 'Highest risk',
      value: index.overview.highest_risk.ticker,
      note: formatLabel(index.overview.highest_risk.risk_state)
    },
    {
      label: 'Strongest durability',
      value: index.overview.strongest_durability.ticker,
      note: `${index.overview.strongest_durability.durability_score}/20 - ${index.overview.strongest_durability.pool_age}`
    },
    {
      label: 'Last updated',
      value: formatTimestamp(index.overview.last_updated),
      note: 'seeded/manual intelligence'
    }
  ];
  return <section className="panel rh-chain-section" aria-label="4663 Index Overview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Index Overview</p>
        <h2>Index Overview</h2>
        <p>Public market-memory snapshot for RH Chain attention assets. Metrics stay seeded/manual until receipts attach.</p>
      </div>
      <a className="execute compact secondary" href="/v1/rh-chain/4663-index">Index JSON</a>
    </div>
    <div className="rh-chain-4663-overview-grid">
      {cards.map((card) => <article key={card.label} className="rh-chain-4663-overview-card">
        <span>{card.label}</span>
        <strong>{card.value}</strong>
        <p>{card.note}</p>
      </article>)}
    </div>
  </section>;
}

function RankedIndexSection({ assets }: { assets: RhChain4663Asset[] }) {
  return <section id="ranked-index" className="panel rh-chain-section" aria-label="Ranked 4663 Signal Index">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Ranked Index Table</p>
        <h2>Ranked Index Table</h2>
        <p>Ranked by computed signal score across attention, volume, holders, durability, and deployer trust.</p>
      </div>
    </div>
    <div className="rh-chain-4663-table" role="table" aria-label="4663 Signal Index ranked assets">
      <div className="rh-chain-4663-table-row head" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Ticker</span>
        <span role="columnheader">Score</span>
        <span role="columnheader">Classification</span>
        <span role="columnheader">Volume</span>
        <span role="columnheader">Liquidity</span>
        <span role="columnheader">Holders</span>
        <span role="columnheader">Risk</span>
        <span role="columnheader">Verdict</span>
      </div>
      {assets.map((asset) => <article key={asset.ticker} className="rh-chain-4663-table-row" role="row">
        <span role="cell" data-label="Rank">{asset.rank}</span>
        <span role="cell" data-label="Ticker"><b>{asset.ticker}</b><small>{asset.name}</small></span>
        <span role="cell" data-label="Score"><strong>{asset.signal_score}</strong><small>/100</small></span>
        <span role="cell" data-label="Classification"><span className={`rh-chain-4663-class class-${asset.classification}`}>{formatLabel(asset.classification)}</span></span>
        <span role="cell" data-label="Volume">{asset.volume_24h}</span>
        <span role="cell" data-label="Liquidity">{asset.liquidity}</span>
        <span role="cell" data-label="Holders">{asset.holder_count}</span>
        <span role="cell" data-label="Risk"><RiskBadge state={asset.risk_state} /></span>
        <span role="cell" data-label="Verdict"><small>{asset.infopunks_verdict}</small></span>
      </article>)}
    </div>
  </section>;
}

function ScoreBreakdownSection({ assets }: { assets: RhChain4663Asset[] }) {
  return <section className="panel rh-chain-section" aria-label="4663 Score Breakdown">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Score Breakdown</p>
        <h2>Score Breakdown</h2>
        <p>Each score is explainable at a glance. Components sum to 100.</p>
      </div>
    </div>
    <div className="rh-chain-4663-score-grid">
      {assets.map((asset) => <article key={`${asset.ticker}-score`} className="rh-chain-4663-score-card">
        <div className="rh-chain-card-head">
          <div>
            <p className="section-kicker">Rank {asset.rank}</p>
            <h3>{asset.ticker} / {asset.signal_score}</h3>
          </div>
          <span className={`rh-chain-4663-class class-${asset.classification}`}>{formatLabel(asset.classification)}</span>
        </div>
        <ScoreBar label="attention" value={asset.attention_score} max={25} />
        <ScoreBar label="volume" value={asset.volume_score} max={25} />
        <ScoreBar label="holders" value={asset.holder_score} max={20} />
        <ScoreBar label="durability" value={asset.durability_score} max={20} />
        <ScoreBar label="deployer trust" value={asset.deployer_trust_score} max={10} />
        <div className="rh-chain-label-row">
          {asset.narrative_class.map((label) => <NarrativeClassPill key={`${asset.ticker}-${label}`} label={label} />)}
        </div>
      </article>)}
    </div>
  </section>;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  return <div className="rh-chain-4663-score-line">
    <div>
      <span>{label}</span>
      <strong>{value}/{max}</strong>
    </div>
    <i aria-hidden="true"><b style={{ width }} /></i>
  </div>;
}

function NarrativeClassesSection({ classes }: { classes: readonly RhChain4663NarrativeClass[] }) {
  return <section className="panel rh-chain-section" aria-label="4663 Narrative Classes">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Narrative Classes</p>
        <h2>Narrative Classes</h2>
        <p>Mutations the desk is watching across RH Chain attention, liquidity, and risk memory.</p>
      </div>
    </div>
    <div className="rh-chain-4663-class-cloud">
      {classes.map((label) => <NarrativeClassPill key={label} label={label} />)}
    </div>
  </section>;
}

function NarrativeClassPill({ label }: { label: RhChain4663NarrativeClass }) {
  return <span className={`rh-chain-4663-narrative narrative-${label}`}>{label}</span>;
}

function IndexMethodologySection({ index }: { index: RhChain4663IndexPayload }) {
  const rows = [
    ['Attention', `${index.scoring_model.attention_score}`, 'X mentions, KOL mentions, DexScreener trending, search and social velocity.'],
    ['Volume', `${index.scoring_model.volume_score}`, '5m, 1h, 24h flow, volume/liquidity ratio, buy/sell distribution, repeat trading.'],
    ['Holders', `${index.scoring_model.holder_score}`, 'Holder growth, top 10 concentration, dev wallet balance, unique buyer growth.'],
    ['Durability', `${index.scoring_model.durability_score}`, 'Survives 24h and 72h, liquidity remains, community keeps posting, volume does not vanish.'],
    ['Deployer trust', `${index.scoring_model.deployer_trust_score}`, 'Verified contract, clean deployer history, no serial-rug or clone trail.']
  ];
  return <section className="panel rh-chain-section" aria-label="4663 Methodology">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Methodology</p>
        <h2>Methodology</h2>
        <p>Scores are public intelligence weights. They are not price targets, recommendations, or listing criteria.</p>
      </div>
    </div>
    <div className="rh-chain-4663-method-grid">
      {rows.map(([label, score, note]) => <article key={label} className="rh-chain-4663-method-card">
        <span>{label}</span>
        <strong>{score}</strong>
        <p>{note}</p>
      </article>)}
    </div>
    <div className="rh-chain-4663-thresholds">
      {Object.entries(index.classification_thresholds).map(([classification, range]) => <p key={classification}>
        <b>{range}</b>
        <span>{formatLabel(classification)}</span>
      </p>)}
    </div>
  </section>;
}

function ReviewQueuePreview({ queue }: { queue: RhChainReviewQueuePayload }) {
  const previewItems = queue.items.slice(0, 3);
  return <section className="panel rh-chain-section rh-chain-review-preview" aria-label="Review Queue Preview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Review Queue</p>
        <h2>Review Queue</h2>
        <p>Signals enter public review before promotion. Receipts, risk, and missing evidence decide the next step.</p>
      </div>
      <a className="execute compact secondary" href="/rh-chain-signal-desk/review-queue">View Review Queue</a>
    </div>
    <div className="rh-chain-review-preview-grid">
      {previewItems.map((item) => <ReviewItemCard key={item.review_id} item={item} compact />)}
    </div>
  </section>;
}

type RhChainTokenSnapshotResponse = {
  contract: string;
  token_pair: { dex_url: string | null; pair_address: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; fdv_usd: number | null; market_cap_usd: number | null; pair_created_at: string | null; source_timestamp: string | null } | null;
  explorer: { explorer_url: string | null; contract_verified: boolean | null } | null;
  disclaimer: string;
  judgment_policy?: string;
};

function LiveSnapshotPreview({ snapshot }: { snapshot: RhChainLiveSnapshot }) {
  return <section className="panel rh-chain-section" aria-label="Live Snapshot Preview">
    <div className="rh-chain-section-head"><div><p className="section-kicker">Live Snapshot Layer</p><h2>External context, cached</h2><p>Provider data is read-only and timestamped. It does not change review decisions.</p></div><a className="execute compact secondary" href="/rh-chain-signal-desk/live-snapshot">Open Live Snapshot</a></div>
    <div className="rh-chain-review-stat-grid">
      {snapshot.provider_statuses.map((provider) => <article key={provider.provider_name} className="rh-chain-review-stat"><span>{provider.provider_name}</span><strong>{provider.status}</strong></article>)}
    </div>
  </section>;
}

function LiveSnapshotPage({ snapshot }: { snapshot: RhChainLiveSnapshot }) {
  const [contract, setContract] = useState('');
  const [result, setResult] = useState<RhChainTokenSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!contract.trim()) return;
    setError(null);
    try { setResult((await api<RhChainTokenSnapshotResponse>(`/v1/rh-chain/live-snapshot/token/${encodeURIComponent(contract.trim())}`)).data); }
    catch (lookupError) { setError(lookupError instanceof Error ? lookupError.message : 'token_snapshot_unavailable'); }
  }
  const metrics = snapshot.chain_metrics;
  const category = snapshot.meme_category;
  return <>
    <section className="panel rh-chain-section" aria-label="Provider Status">
      <div className="rh-chain-section-head"><div><p className="section-kicker">Provider status</p><h2>Provider Status</h2><p>Freshness describes a cached external read, not live certainty.</p></div><span className="source-badge">{snapshot.live_snapshots_enabled ? 'live reads enabled' : 'live reads disabled'}</span></div>
      <div className="rh-chain-review-stat-grid">{snapshot.provider_statuses.map((provider) => <article className="rh-chain-review-stat" key={provider.provider_name}><span>{provider.provider_name}</span><strong>{provider.status}</strong><small>{provider.fetched_at ? `fetched ${formatTimestamp(provider.fetched_at)}` : provider.error_summary ?? 'No external request.'}</small></article>)}</div>
    </section>
    <section className="panel rh-chain-section" aria-label="Chain Metrics Snapshot"><div className="rh-chain-section-head"><div><p className="section-kicker">Chain metrics snapshot</p><h2>Chain Metrics Snapshot</h2><p>Source timestamp {metrics.source_timestamp ? formatTimestamp(metrics.source_timestamp) : 'unavailable'} / {metrics.freshness}</p></div></div><div className="rh-chain-metric-grid"><SnapshotMetric label="TVL" value={formatUsd(metrics.tvl_usd)} /><SnapshotMetric label="DEX volume" value={formatUsd(metrics.dex_volume_24h_usd)} /><SnapshotMetric label="Stablecoin market cap" value={formatUsd(metrics.stablecoin_market_cap_usd)} /><SnapshotMetric label="Protocol count" value={metrics.protocol_count?.toLocaleString() ?? 'unavailable'} /></div></section>
    <section className="panel rh-chain-section" aria-label="Meme Category Snapshot"><div className="rh-chain-section-head"><div><p className="section-kicker">Meme category snapshot</p><h2>Meme Category Snapshot</h2><p>Source timestamp {category.source_timestamp ? formatTimestamp(category.source_timestamp) : 'unavailable'} / {category.freshness}</p></div></div><div className="rh-chain-metric-grid"><SnapshotMetric label="Category market cap" value={formatUsd(category.market_cap_usd)} /><SnapshotMetric label="24h volume" value={formatUsd(category.volume_24h_usd)} /></div><div className="rh-chain-list">{category.top_assets.map((asset) => <article className="rh-chain-list-item" key={asset.symbol}><div><h3>{asset.symbol}</h3><p>{asset.name}</p></div><span className="rh-chain-chip">{formatUsd(asset.market_cap_usd)}</span></article>) || <p className="panel-caption">No cached category assets available.</p>}</div></section>
    <section className="panel rh-chain-section" aria-label="Token Lookup Tool"><div className="rh-chain-section-head"><div><p className="section-kicker">Token lookup</p><h2>Token Lookup Tool</h2><p>Fetches a cached, risk-neutral external snapshot. It does not approve a submission.</p></div></div><form className="rh-chain-submit-form" onSubmit={lookup}><label><span>Contract address</span><input value={contract} onChange={(event) => setContract(event.target.value)} placeholder="0x..." aria-label="Live snapshot contract address" /></label><div className="panel-actions"><button type="submit" className="execute">Fetch cached snapshot</button></div></form>{error && <p className="route-state error">{error}</p>}{result && <div className="rh-chain-packet-grid"><p><span>Top pair</span><strong>{result.token_pair?.pair_address ?? 'unavailable'}</strong></p><p><span>Liquidity</span><strong>{formatUsd(result.token_pair?.liquidity_usd ?? null)}</strong></p><p><span>24h volume</span><strong>{formatUsd(result.token_pair?.volume_24h_usd ?? null)}</strong></p><p><span>FDV / market cap</span><strong>{formatUsd(result.token_pair?.fdv_usd ?? result.token_pair?.market_cap_usd ?? null)}</strong></p>{result.token_pair?.dex_url && <p><a href={result.token_pair.dex_url}>DexScreener pair</a></p>}{result.explorer?.explorer_url && <p><a href={result.explorer.explorer_url}>Blockscout explorer</a></p>}</div>}</section>
    <section className="panel rh-chain-section rh-chain-review-disclaimer"><p>{snapshot.judgment_policy}</p><p>{snapshot.disclaimer}</p></section>
  </>;
}

function SnapshotMetric({ label, value }: { label: string; value: string }) { return <article className="rh-chain-metric"><p className="section-kicker">{label}</p><strong>{value}</strong></article>; }
function formatUsd(value: number | null) { return value === null ? 'unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value); }

function RhChainReviewQueuePage({ queue }: { queue: RhChainReviewQueuePayload }) {
  return <>
    <ReviewStatusOverview queue={queue} />
    <ReviewQueueBoard queue={queue} />
    <section className="panel rh-chain-section rh-chain-review-disclaimer" aria-label="Review Queue Disclaimer">
      <p>{queue.disclaimer}</p>
      <p>Approved signal means eligible for desk indexing and continued monitoring. It does not mean safe to buy.</p>
      <p className="panel-caption">{queue.source_policy}</p>
    </section>
  </>;
}

function ReviewStatusOverview({ queue }: { queue: RhChainReviewQueuePayload }) {
  const stats = [
    { label: 'Queued', value: queue.counts.queued },
    { label: 'Under receipt check', value: queue.counts.under_receipt_check },
    { label: 'Approved signals', value: queue.counts.approved_signals },
    { label: 'Do not touch yet', value: queue.counts.do_not_touch_yet },
    { label: 'Rejected / low receipt quality', value: queue.counts.rejected_low_receipt_quality }
  ];
  return <section className="panel rh-chain-section" aria-label="Review Status Overview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Status Overview</p>
        <h2>Status Overview</h2>
        <p>Seeded/manual research and persisted community submissions are separated. Public visibility is not endorsement.</p>
      </div>
      <span className="source-badge">{formatTimestamp(queue.generated_at)}</span>
    </div>
    <div className="rh-chain-review-stat-grid">
      {stats.map((stat) => <article key={stat.label} className="rh-chain-review-stat">
        <span>{stat.label}</span>
        <strong>{stat.value}</strong>
      </article>)}
    </div>
  </section>;
}

function ReviewQueueBoard({ queue }: { queue: RhChainReviewQueuePayload }) {
  return <section id="queue-board" className="panel rh-chain-section" aria-label="Queue Board">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Queue Board</p>
        <h2>Queue Board</h2>
        <p>Grouped by review state. Empty states stay visible so the pipeline remains auditable.</p>
      </div>
      <a className="execute compact secondary" href="/v1/rh-chain/review-queue">Queue JSON</a>
    </div>
    <div className="rh-chain-review-board">
      {queue.review_states.map((state) => <section key={state} className="rh-chain-review-lane" aria-label={formatLabel(state)}>
        <div className="rh-chain-review-lane-head">
          <h3>{reviewStateLabel(state)}</h3>
          <span>{queue.grouped[state].length}</span>
        </div>
        <div className="rh-chain-review-lane-items">
          {queue.grouped[state].length
            ? queue.grouped[state].map((item) => <ReviewItemCard key={item.review_id} item={item} />)
            : <p className="panel-caption">No public items in this state.</p>}
        </div>
      </section>)}
    </div>
  </section>;
}

function ReviewItemCard({ item, compact = false }: { item: RhChainReviewItem; compact?: boolean }) {
  return <article className={`rh-chain-review-card state-${item.review_state}${compact ? ' compact' : ''}`}>
    <div className="rh-chain-card-head">
      <div>
        <p className="section-kicker">{item.source_type === 'community_submission' ? 'Community submission' : item.source_type}</p>
        <h3>{item.ticker}</h3>
        <p className="rh-chain-contract">{shortContract(item.token_contract)}</p>
      </div>
      <div className="rh-chain-review-pill-stack">
        {item.source_type === 'community_submission' && <span className="rh-chain-chip">Community submission</span>}
        <ReviewStatePill state={item.review_state} />
        <RiskBadge state={item.risk_state} />
      </div>
    </div>
    <p>{item.evidence_summary}</p>
    {!compact && <div className="rh-chain-review-field">
      <span>Missing evidence</span>
      <div className="rh-chain-evidence-list">
        {item.missing_evidence.map((evidence) => <span key={`${item.review_id}-${evidence}`}>{evidence}</span>)}
      </div>
    </div>}
    <div className="rh-chain-review-verdict">
      <span>Infopunks verdict</span>
      <strong>{item.infopunks_verdict}</strong>
    </div>
    {!compact && <p className="panel-caption">{item.reviewer_note}</p>}
    <ReviewLinks links={item.links} />
    <div className="rh-chain-review-card-foot">
      <span>{item.chain}</span>
      <span>updated {formatTimestamp(item.updated_at)}</span>
    </div>
  </article>;
}

function ReviewLinks({ links }: { links: RhChainReviewItem['links'] }) {
  const rows = [
    { label: 'X', href: links.x },
    { label: 'Website', href: links.website },
    { label: 'Liquidity', href: links.liquidity },
    { label: 'Explorer', href: links.explorer }
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
  if (!rows.length) return <p className="panel-caption">No public links attached.</p>;
  return <div className="rh-chain-review-links" aria-label="Review item links">
    {rows.map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
  </div>;
}

function ReviewStatePill({ state }: { state: RhChainReviewState }) {
  return <span className={`rh-chain-review-state state-${state}`}>{reviewStateLabel(state)}</span>;
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
    <span role="cell" data-label="Rank">{token.rank}</span>
    <span role="cell" data-label="Ticker"><b>{token.ticker}</b><small>{token.name}</small></span>
    <span role="cell" data-label="Contract" className="rh-chain-contract">{token.contract}</span>
    <span role="cell" data-label="Market Cap">{token.market_cap}</span>
    <span role="cell" data-label="Volume">{token.volume_24h}</span>
    <span role="cell" data-label="Liquidity">{token.liquidity}</span>
    <span role="cell" data-label="Risk"><RiskBadge state={token.risk_state} /></span>
    <span role="cell" data-label="Verdict">
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
        <SourceLine source={theme.source} />
      </article>)}
    </div>
  </section>;
}

type RhChainSubmitForm = {
  token_contract: string;
  ticker: string;
  chain: string;
  x_twitter_link: string;
  website_link: string;
  liquidity_link: string;
  deployer_notes: string;
  submitter_notes: string;
  disclosure_confirmed: boolean;
};

const RH_CHAIN_DISCLOSURE = 'I understand this is not an endorsement, listing, partnership, or financial recommendation. I am submitting this token for public intelligence review only.';

const emptySubmitForm: RhChainSubmitForm = {
  token_contract: '',
  ticker: '',
  chain: 'Robinhood Chain',
  x_twitter_link: '',
  website_link: '',
  liquidity_link: '',
  deployer_notes: '',
  submitter_notes: '',
  disclosure_confirmed: false
};

function SubmitSignalSection() {
  const [form, setForm] = useState<RhChainSubmitForm>(emptySubmitForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [packet, setPacket] = useState<RhChainSignalSubmission | null>(null);
  const [copied, setCopied] = useState(false);

  function setField<K extends keyof RhChainSubmitForm>(field: K, value: RhChainSubmitForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors([]);
    setCopied(false);
  }

  function validate(next: RhChainSubmitForm) {
    const nextErrors: string[] = [];
    if (!next.token_contract.trim()) nextErrors.push('Token contract address is required.');
    if (!next.ticker.trim()) nextErrors.push('Ticker is required.');
    if (!next.chain.trim()) nextErrors.push('Chain is required.');
    if (!next.disclosure_confirmed) nextErrors.push('Disclosure must be confirmed.');
    if (!next.x_twitter_link.trim() && !next.website_link.trim() && !next.liquidity_link.trim() && !next.deployer_notes.trim()) {
      nextErrors.push('No receipt, no signal. Add an X link, website link, liquidity link, or deployer notes.');
    }
    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopied(false);
    const nextErrors = validate(form);
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const response = await postApi<{ submission: RhChainSignalSubmission }>('/v1/rh-chain/signals/submit', {
        token_contract: form.token_contract.trim(),
        ticker: form.ticker.trim(),
        chain: form.chain.trim() || 'Robinhood Chain',
        x_twitter_link: form.x_twitter_link.trim() || undefined,
        website_link: form.website_link.trim() || undefined,
        liquidity_link: form.liquidity_link.trim() || undefined,
        deployer_notes: form.deployer_notes.trim() || undefined,
        submitter_notes: form.submitter_notes.trim() || undefined,
        disclosure_confirmed: form.disclosure_confirmed
      });
      setPacket(response.data.submission);
    } catch (error) {
      setErrors([error instanceof Error ? humanizeSubmitError(error.message) : 'submit_signal_unavailable']);
    } finally {
      setSubmitting(false);
    }
  }

  const packetText = packet ? JSON.stringify(packet, null, 2) : '';

  async function copyPacket() {
    if (!packetText) return;
    await navigator.clipboard?.writeText(packetText);
    setCopied(true);
  }

  return <section id="submit-signal" className="panel rh-chain-section" aria-label="Submit Signal">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Submit a signal</p>
        <h2>Submit Signal</h2>
        <p>Receipts before attention. Manual review required. Public intelligence, not endorsement.</p>
      </div>
      <span className="rh-chain-risk-badge risk-source_required">No receipt, no signal</span>
    </div>
    <p className="rh-chain-disclaimer">Submission does not mean the token is safe, ranked, endorsed, listed, partnered, or recommended. Infopunks will not auto-add submissions to the public desk.</p>
    <form className="rh-chain-submit-form" onSubmit={handleSubmit}>
      <label><span>Token contract address</span><input name="token_contract" aria-label="Token contract address" value={form.token_contract} onChange={(event) => setField('token_contract', event.target.value)} placeholder="0x... or explorer contract" required /></label>
      <label><span>Ticker</span><input name="ticker" aria-label="Ticker" value={form.ticker} onChange={(event) => setField('ticker', event.target.value)} placeholder="TICKR" required /></label>
      <label><span>Chain</span><input name="chain" aria-label="Chain" value={form.chain} onChange={(event) => setField('chain', event.target.value)} required /></label>
      <label><span>X / Twitter link</span><input name="x_twitter_link" aria-label="X or Twitter link" value={form.x_twitter_link} onChange={(event) => setField('x_twitter_link', event.target.value)} placeholder="https://x.com/..." /></label>
      <label><span>Website link</span><input name="website_link" aria-label="Website link" value={form.website_link} onChange={(event) => setField('website_link', event.target.value)} placeholder="https://..." /></label>
      <label><span>Liquidity link</span><input name="liquidity_link" aria-label="Liquidity link" value={form.liquidity_link} onChange={(event) => setField('liquidity_link', event.target.value)} placeholder="DEX pool, explorer, or liquidity receipt" /></label>
      <label className="wide"><span>Deployer notes</span><textarea name="deployer_notes" aria-label="Deployer notes" rows={4} value={form.deployer_notes} onChange={(event) => setField('deployer_notes', event.target.value)} placeholder="Deployer wallet, funding path, ownership controls, warnings" /></label>
      <label className="wide"><span>Submitter notes</span><textarea name="submitter_notes" aria-label="Submitter notes" rows={4} value={form.submitter_notes} onChange={(event) => setField('submitter_notes', event.target.value)} placeholder="Why this belongs on the intelligence desk" /></label>
      <label className="rh-chain-checkbox wide">
        <input type="checkbox" checked={form.disclosure_confirmed} onChange={(event) => setField('disclosure_confirmed', event.target.checked)} />
        <span>{RH_CHAIN_DISCLOSURE}</span>
      </label>
      <div className="panel-actions wide">
        <button className="execute" type="submit" disabled={submitting}>{submitting ? 'Queueing review...' : 'Submit a signal'}</button>
      </div>
    </form>
    {errors.length > 0 && <div className="route-state error rh-chain-submit-errors">
      {errors.map((error) => <p key={error}>{error}</p>)}
    </div>}
    {packet && <div className="rh-chain-review-packet" aria-live="polite">
      <div className="rh-chain-section-head">
        <div>
          <p className="section-kicker">Review packet</p>
          <h3>Signal received and saved to the review ledger.</h3>
          <p>Queued for public intelligence review only. This packet is not a safety claim.</p>
        </div>
        <button className="execute compact secondary" type="button" onClick={copyPacket}>{copied ? 'Copied' : 'Copy packet'}</button>
      </div>
      <div className="rh-chain-packet-grid">
        <p><span>submission_id</span><strong>{packet.submission_id}</strong></p>
        <p><span>submitted_at</span><strong>{formatTimestamp(packet.submitted_at)}</strong></p>
        <p><span>review_status</span><strong>{packet.review_status}</strong></p>
        <p><span>ticker</span><strong>{packet.ticker}</strong></p>
        <p><span>chain</span><strong>{packet.chain}</strong></p>
      </div>
      <div className="panel-actions"><a className="execute compact secondary" href="/rh-chain-signal-desk/review-queue">Open Review Queue</a></div>
      <pre className="rh-chain-packet-pre">{packetText}</pre>
    </div>}
  </section>;
}

function humanizeSubmitError(value: string) {
  if (value === 'at_least_one_receipt_or_deployer_note_required') return 'No receipt, no signal. Add an X link, website link, liquidity link, or deployer notes.';
  if (value === 'invalid_request') return 'Submission failed validation.';
  return value;
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
  const sourceName = source.source_name ?? source.source ?? 'source_pending';
  const sourceUrl = source.source_url ?? source.url ?? null;
  const sourceNote = source.caveat ?? source.note ?? 'Source metadata pending.';
  return <p className="rh-chain-source">
    <span>source: {sourceUrl ? <a href={sourceUrl}>{sourceName}</a> : sourceName}</span>
    <span>observed_at: {formatTimestamp(source.observed_at)}</span>
    <span>mode: {source.data_mode} / confidence: {source.confidence_level}</span>
    <span>{sourceNote}</span>
  </p>;
}

function SignalLabelChip({ label }: { label: RhChainSignalLabel }) {
  return <span className={`rh-chain-label label-${label}`}>{label}</span>;
}

function RiskBadge({ state }: { state: RhChainRiskState }) {
  return <span className={`rh-chain-risk-badge risk-${state}`}>{formatLabel(state)}</span>;
}

function reviewStateLabel(state: RhChainReviewState) {
  const labels: Record<RhChainReviewState, string> = {
    queued_for_manual_review: 'Queued',
    under_receipt_check: 'Receipt check',
    needs_more_evidence: 'Needs evidence',
    watch_only: 'Watch only',
    approved_signal: 'Approved signal',
    do_not_touch_yet: 'Do not touch',
    rejected_low_receipt_quality: 'Rejected'
  };
  return labels[state];
}

function shortContract(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatTimestamp(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}
