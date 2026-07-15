import React, { useEffect, useMemo, useState } from 'react';
import type {
  RhChain4663Asset,
  RhChain4663IndexPayload,
  RhChain4663NarrativeClass,
  RhChainDailyReceipt,
  RhChainDailyReceiptsPayload,
  RhChainAccessSurface,
  RhChainLaunchSurfaceRecord,
  RhChainLaunchContext,
  RhChainMemeToken,
  RhChainMemePulsePayload,
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
import { createRhChainDailyReceiptXPost } from '../data/rhChain';
import { formatUtcCompact } from '../shared/timestamps';
import { NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { RhChainSignalSubmission } from '../services/rhChainSignalVault';
import type { RhChainLiveSnapshot } from '../services/rhChainLiveSnapshotService';
import {
  fetchRhChain,
  RhChainApiError,
  RhChainDisclaimer,
  RhChainModuleDegradedNotice,
  RhChainProvenance,
  RhChainRouteState,
  RhChainSuiteNav,
  type RhChainEnvelope,
  type RhChainRequestFailure
} from './rhChainUi';

const API_BASE_URL = getApiBaseUrl();

const api = fetchRhChain;

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

function requestFailure(error: unknown, endpoint: string, service: string): RhChainRequestFailure {
  if (error instanceof RhChainApiError) return error.failure;
  const failure: RhChainRequestFailure = {
    service,
    status: 'temporarily_unavailable',
    attemptedAt: new Date().toISOString(),
    endpoint,
    httpStatus: null,
    requestId: null,
    message: error instanceof Error ? error.message : 'unknown_request_failure'
  };
  console.error('[rh-chain-api] untyped request failure', failure);
  return failure;
}

export function RhChainSignalDeskPage({ narrativeRoute = false, submitRoute = false, reviewQueueRoute = false, indexRoute = false, launchSurfacesRoute = false, scoutRoute = false, dailyReceiptsRoute = false, dailyReceiptId, receiptCardRoute = false, liveSnapshotRoute = false }: { narrativeRoute?: boolean; submitRoute?: boolean; reviewQueueRoute?: boolean; indexRoute?: boolean; launchSurfacesRoute?: boolean; scoutRoute?: boolean; dailyReceiptsRoute?: boolean; dailyReceiptId?: string; receiptCardRoute?: boolean; liveSnapshotRoute?: boolean }) {
  const [desk, setDesk] = useState<RhChainPayload | null>(null);
  const [reviewQueue, setReviewQueue] = useState<RhChainReviewQueuePayload | null>(null);
  const [signalIndex, setSignalIndex] = useState<RhChain4663IndexPayload | null>(null);
  const [dailyReceipts, setDailyReceipts] = useState<RhChainDailyReceiptsPayload | null>(null);
  const [memePulse, setMemePulse] = useState<RhChainMemePulsePayload | null>(null);
  const [launchSurfaces, setLaunchSurfaces] = useState<{ title: string; subtitle: string; doctrine: string; disclaimer: string; launch_surfaces: RhChainLaunchSurfaceRecord[]; access_surfaces: RhChainAccessSurface[] } | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<RhChainLiveSnapshot | null>(null);
  const [routeEnvelope, setRouteEnvelope] = useState<RhChainEnvelope<unknown> | null>(null);
  const [deskFailure, setDeskFailure] = useState<RhChainRequestFailure | null>(null);
  const [reviewQueueFailure, setReviewQueueFailure] = useState<RhChainRequestFailure | null>(null);
  const [signalIndexFailure, setSignalIndexFailure] = useState<RhChainRequestFailure | null>(null);
  const [dailyReceiptsFailure, setDailyReceiptsFailure] = useState<RhChainRequestFailure | null>(null);
  const [launchSurfacesFailure, setLaunchSurfacesFailure] = useState<RhChainRequestFailure | null>(null);
  const [liveSnapshotFailure, setLiveSnapshotFailure] = useState<RhChainRequestFailure | null>(null);
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<RhChainRiskState | 'all'>('all');
  const dailyReceiptDetailRoute = Boolean(dailyReceiptId) && !receiptCardRoute;
  const isDailyReceiptRoute = dailyReceiptsRoute || dailyReceiptDetailRoute || receiptCardRoute;
  const useDeskEnvelope = !reviewQueueRoute && !indexRoute && !isDailyReceiptRoute && !launchSurfacesRoute && !liveSnapshotRoute;
  const selectedDailyReceipt = dailyReceipts?.receipts.find((receipt) => receipt.receipt_id === dailyReceiptId) ?? null;
  const currentPath = scoutRoute ? '/rh-chain-signal-desk/scout' : liveSnapshotRoute ? '/rh-chain-signal-desk/live-snapshot' : isDailyReceiptRoute ? '/rh-chain-signal-desk/daily-receipts' : launchSurfacesRoute ? '/rh-chain-signal-desk/launch-surfaces' : indexRoute ? '/rh-chain-signal-desk/4663-index' : reviewQueueRoute ? '/rh-chain-signal-desk/review-queue' : submitRoute ? '/rh-chain-signal-desk/submit' : narrativeRoute ? '/narratives/robinhood-chain' : '/rh-chain-signal-desk';

  useEffect(() => {
    syncPageMetadata(currentPath);
  }, [currentPath]);

  useEffect(() => {
    api<RhChainPayload>('/v1/rh-chain')
      .then((response) => { setDesk(response.data); if (useDeskEnvelope) setRouteEnvelope(response); })
      .catch((error) => setDeskFailure(requestFailure(error, '/v1/rh-chain', 'signal desk')));
    api<RhChainReviewQueuePayload>('/v1/rh-chain/review-queue')
      .then((response) => { setReviewQueue(response.data); if (reviewQueueRoute) setRouteEnvelope(response); })
      .catch((error) => setReviewQueueFailure(requestFailure(error, '/v1/rh-chain/review-queue', 'review queue')));
    api<RhChain4663IndexPayload>('/v1/rh-chain/4663-index')
      .then((response) => { setSignalIndex(response.data); if (indexRoute) setRouteEnvelope(response); })
      .catch((error) => setSignalIndexFailure(requestFailure(error, '/v1/rh-chain/4663-index', '4663 signal index')));
    api<RhChainDailyReceiptsPayload>('/v1/rh-chain/daily-receipts')
      .then((response) => { setDailyReceipts(response.data); if (isDailyReceiptRoute) setRouteEnvelope(response); })
      .catch((error) => setDailyReceiptsFailure(requestFailure(error, '/v1/rh-chain/daily-receipts', 'daily receipts')));
    api<RhChainMemePulsePayload>('/v1/rh-chain/meme-pulse').then((response) => setMemePulse(response.data)).catch(() => undefined);
    api<{ title: string; subtitle: string; doctrine: string; disclaimer: string; launch_surfaces: RhChainLaunchSurfaceRecord[]; access_surfaces: RhChainAccessSurface[] }>('/v1/rh-chain/launch-surfaces')
      .then((response) => { setLaunchSurfaces(response.data); if (launchSurfacesRoute) setRouteEnvelope(response); })
      .catch((error) => setLaunchSurfacesFailure(requestFailure(error, '/v1/rh-chain/launch-surfaces', 'launch surfaces')));
    api<RhChainLiveSnapshot>('/v1/rh-chain/live-snapshot')
      .then((response) => { setLiveSnapshot(response.data); if (liveSnapshotRoute) setRouteEnvelope(response); })
      .catch((error) => setLiveSnapshotFailure(requestFailure(error, '/v1/rh-chain/live-snapshot', 'live snapshot')));
  }, []);

  // The server refreshes Chain Pulse on its automation interval. Keep the desk
  // aligned with that snapshot without polling review, receipt, or index state.
  useEffect(() => {
    const refreshPulse = () => api<RhChainPayload>('/v1/rh-chain')
      .then((response) => { setDesk(response.data); if (useDeskEnvelope) setRouteEnvelope(response); })
      .catch(() => undefined);
    const refreshMemePulse = () => api<RhChainMemePulsePayload>('/v1/rh-chain/meme-pulse').then((response) => setMemePulse(response.data)).catch(() => undefined);
    const timer = window.setInterval(() => { refreshPulse(); refreshMemePulse(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [useDeskEnvelope]);

  const visibleMemes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (desk?.meme_pulse ?? []).filter((token) => {
      const matchesRisk = risk === 'all' || token.risk_state === risk;
      const matchesQuery = !needle || [token.ticker, token.name, token.contract, token.infopunks_verdict].join(' ').toLowerCase().includes(needle);
      return matchesRisk && matchesQuery;
    });
  }, [desk?.meme_pulse, query, risk]);

  const degraded = (failure: RhChainRequestFailure, moduleName: string, unaffectedCopy = 'Other Signal Desk intelligence remains accessible.') => (
    <RhChainModuleDegradedNotice failure={failure} moduleName={moduleName} unaffectedCopy={unaffectedCopy} />
  );
  const loading = (title: string) => <RhChainRouteState state="loading" title={title} />;
  let routeContent: React.ReactNode = null;
  if (desk) {
    if (scoutRoute) routeContent = <ScoutPage />;
    else if (liveSnapshotRoute) routeContent = liveSnapshot ? <LiveSnapshotPage snapshot={liveSnapshot} /> : liveSnapshotFailure ? degraded(liveSnapshotFailure, 'Live snapshot', 'Reviewed Signal Desk memory remains accessible.') : loading('Opening live snapshot…');
    else if (launchSurfacesRoute) routeContent = launchSurfaces ? <LaunchSurfacesPage surfaceWatch={launchSurfaces} /> : launchSurfacesFailure ? degraded(launchSurfacesFailure, 'Launch surfaces') : loading('Opening launch surfaces…');
    else if (receiptCardRoute || dailyReceiptDetailRoute) routeContent = selectedDailyReceipt
      ? receiptCardRoute ? <ReceiptCardPage receipt={selectedDailyReceipt} /> : <ReceiptDetailPage receipt={selectedDailyReceipt} feed={dailyReceipts!} />
      : dailyReceipts ? <DailyReceiptNotFound receiptId={dailyReceiptId ?? ''} /> : dailyReceiptsFailure ? degraded(dailyReceiptsFailure, 'Daily receipts') : loading('Opening daily receipts…');
    else if (dailyReceiptsRoute) routeContent = dailyReceipts ? <RhChainDailyReceiptsPage feed={dailyReceipts} /> : dailyReceiptsFailure ? degraded(dailyReceiptsFailure, 'Daily receipts') : loading('Opening daily receipts…');
    else if (indexRoute) routeContent = signalIndex ? <RhChain4663IndexPage index={signalIndex} /> : signalIndexFailure ? degraded(signalIndexFailure, '4663 Signal Index') : loading('Opening 4663 Signal Index…');
    else if (reviewQueueRoute) routeContent = reviewQueue ? <RhChainReviewQueuePage queue={reviewQueue} /> : reviewQueueFailure ? degraded(reviewQueueFailure, 'Review queue') : loading('Opening review queue…');
    else if (submitRoute) routeContent = <SubmitSignalSection />;
    else routeContent = <>
      <RhChainPulseSection desk={desk} />
      {dailyReceipts ? <DailyReceiptsPreview feed={dailyReceipts} /> : dailyReceiptsFailure ? degraded(dailyReceiptsFailure, 'Daily receipts') : null}
      {launchSurfaces ? <LaunchSurfacesPreview surfaceWatch={launchSurfaces} /> : launchSurfacesFailure ? degraded(launchSurfacesFailure, 'Launch surfaces') : null}
      {signalIndex ? <SignalIndexPreview index={signalIndex} /> : signalIndexFailure ? degraded(signalIndexFailure, '4663 Signal Index') : null}
      {reviewQueue ? <ReviewQueuePreview queue={reviewQueue} /> : reviewQueueFailure ? degraded(reviewQueueFailure, 'Review queue') : null}
      {liveSnapshot ? <LiveSnapshotPreview snapshot={liveSnapshot} /> : liveSnapshotFailure ? degraded(liveSnapshotFailure, 'Live snapshot', 'Reviewed Signal Desk memory remains accessible.') : null}
      <MemePulseSection memes={visibleMemes} allMemes={desk.meme_pulse} memePulse={memePulse} freshnessState={memePulse?.freshness_state} query={query} risk={risk} onQuery={setQuery} onRisk={setRisk} />
      <SignalClassifierSection desk={desk} />
      <RiskWallSection desk={desk} />
      <StockTokenSpilloverSection desk={desk} />
      <SubmitSignalSection />
      <ReceiptsSection receipts={desk.receipts} />
    </>;
  }

  return <div className="shell narrative-shell rh-chain-shell">
    <a className="skip-link" href="#rh-chain-content">Skip to content</a>
    <header className="site-header">
      <RhChainSuiteNav current={currentPath === '/narratives/robinhood-chain' ? '/rh-chain-signal-desk' : currentPath} />
    </header>
    <main id="rh-chain-content" className="narrative-page rh-chain-page">
      {deskFailure && <RhChainRouteState state="unavailable" title="Signal Desk temporarily unavailable" detail="The primary desk record could not be loaded. No fallback intelligence has been substituted." />}
      {!desk && !deskFailure && <RhChainRouteState state="loading" />}
      {desk && <>
        <section className="panel hero rh-chain-hero">
          <div>
            <p className="eyebrow">{launchSurfacesRoute ? 'Launch Source Intelligence' : isDailyReceiptRoute ? 'Daily Market Memory' : indexRoute ? 'Public Market Memory' : reviewQueueRoute ? 'Public Review Pipeline' : 'Public Intelligence Desk'}</p>
            <h1>{scoutRoute ? 'RH Chain Scout Agent' : liveSnapshotRoute ? 'RH Chain Live Snapshot' : launchSurfacesRoute ? 'Launch Surface Watch' : receiptCardRoute ? 'RH Chain Receipt Card' : dailyReceiptDetailRoute ? `Daily RH Chain Receipt ${dailyReceiptNumber(dailyReceiptId) ?? `· ${dailyReceiptId}`}` : isDailyReceiptRoute ? 'Daily RH Chain Receipts' : indexRoute ? '4663 Signal Index' : reviewQueueRoute ? 'RH Chain Review Queue' : desk.title}</h1>
            <p className="copy">{liveSnapshotRoute ? 'External market context, cached with receipts.' : receiptCardRoute ? 'A public-memory card made to travel without losing its caveats.' : dailyReceiptDetailRoute ? 'One human-reviewed market-memory object, preserved for reference.' : isDailyReceiptRoute ? 'The market forgets. Infopunks keeps the memory.' : indexRoute ? 'Wall Street rails. Meme liquidity. Ranked by receipts.' : reviewQueueRoute ? 'Signals enter the desk. Receipts decide what survives.' : desk.subtitle}</p>
            <p className="copy narrative-rally-line">{isDailyReceiptRoute ? 'Receipts before narrative drift.' : indexRoute ? 'Intelligence index, not a token.' : reviewQueueRoute ? 'Public memory, not endorsement.' : 'Intelligence desk, not casino.'}</p>
            <div className="panel-actions">
              <a className="execute" href={reviewQueueRoute && reviewQueueFailure ? '/rh-chain-signal-desk' : isDailyReceiptRoute ? '#latest-receipt' : indexRoute ? '#ranked-index' : reviewQueueRoute ? '#queue-board' : '#meme-pulse'}>{reviewQueueRoute && reviewQueueFailure ? 'Open Signal Desk' : isDailyReceiptRoute ? 'Open Latest Receipt' : indexRoute ? 'Open Ranked Index' : reviewQueueRoute ? 'Open Queue Board' : 'Open Meme Pulse'}</a>
              <a className="execute compact secondary" href={submitRoute ? '/rh-chain-signal-desk/review-queue' : '/rh-chain-signal-desk/submit'}>{submitRoute ? 'View Review Queue' : 'Submit source evidence'}</a>
            </div>
          </div>
          <aside className="rh-chain-hero-rail" aria-label="Desk policy">
            {routeEnvelope && <RhChainProvenance envelope={routeEnvelope} doctrine={isDailyReceiptRoute ? dailyReceipts?.doctrine : launchSurfacesRoute ? launchSurfaces?.doctrine : undefined} />}
            <RhChainDisclaimer independent />
          </aside>
        </section>

        {routeContent}
      </>}
    </main>
  </div>;
}

function RhChainPulseSection({ desk }: { desk: RhChainPayload }) {
  const pulse = desk.chain_pulse;
  const timestamp = pulse.fetched_at ?? pulse.observed_at ?? desk.last_updated;
  const isFresh = pulse.freshness_state === 'fresh';
  const hasRhChainProtocols = pulse.top_protocols.some((protocol) => protocol.metric_scope === 'rh_chain');
  const sourceCaveat = pulse.source_notes?.filter((note) => !note.startsWith('Provider context is informational')).join(' ') || 'Provider values are timestamped context and require source review.';
  return <section className="panel rh-chain-section rh-chain-section--primary" aria-label="Chain Pulse">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Chain Pulse</p>
        <h2>Chain Pulse</h2>
        <p>TVL, DEX volume, stock-token activity, stable liquidity, protocols, and bridge notes.</p>
      </div>
      <span className="source-badge">Updated {formatTimestamp(timestamp)}</span>
    </div>
    {!isFresh && <p className="rh-chain-disclaimer">{pulse.freshness_state === 'stale' ? 'Chain metrics are stale context. Review the timestamp before using them.' : 'Chain metrics are source-required or unavailable. No unsupported exact values are shown.'} Observed {formatTimestamp(pulse.observed_at ?? timestamp)}.</p>}
    <div className="rh-chain-metric-grid">
      {pulse.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
    </div>
    <div className="rh-chain-two-column">
      <div className={`rh-chain-subpanel rh-chain-protocol-panel${hasRhChainProtocols ? '' : ' is-scope-softened'}`}>
        <p className="section-kicker">Top protocols</p>
        {!hasRhChainProtocols && <p className="rh-chain-scope-note">Chain-specific protocol TVL not verified. Protocol names are retained only as softened provider context.</p>}
        <div className="rh-chain-list">
          {pulse.top_protocols.map((protocol) => <article key={protocol.name} className={`rh-chain-list-item${protocol.metric_scope === 'rh_chain' ? '' : ' is-scope-softened'}`}>
            <div>
              <h3>{protocol.name}</h3>
              <p className="rh-chain-protocol-value">{protocol.value}</p>
              <p>{protocol.display_note}</p>
            </div>
            <div className="rh-chain-label-row"><span className="rh-chain-chip">{protocol.category}</span><MetricScopeBadge scope={protocol.metric_scope} /></div>
            <ProvenanceFooter source={protocol.source} scope={protocol.metric_scope} />
          </article>)}
        </div>
      </div>
      <div className="rh-chain-subpanel">
        <p className="section-kicker">Bridge notes</p>
        <div className="rh-chain-list">
          {pulse.bridge_notes.map((note) => <p key={note} className="rh-chain-note">{note}</p>)}
        </div>
      </div>
    </div>
    <details className="rh-chain-source-details">
      <summary>Source caveat</summary>
      <p>{sourceCaveat} Provider context is informational and cannot change review, receipt, or index decisions.</p>
    </details>
  </section>;
}

function MetricCard({ metric }: { metric: RhChainPulseMetric }) {
  return <article className={`rh-chain-metric state-${metric.state}`}>
    <div>
      <div className="rh-chain-metric-heading"><p className="section-kicker">{metric.label}</p><MetricScopeBadge scope={metric.metric_scope} /></div>
      <strong>{metric.value}</strong>
      <p>{metric.note}</p>
    </div>
    <ProvenanceFooter source={metric.source} scope={metric.metric_scope} />
  </article>;
}

function MetricScopeBadge({ scope }: { scope: RhChainPulseMetric['metric_scope'] }) {
  return <span className={`rh-chain-scope-badge scope-${scope}`}>{scope.replaceAll('_', ' ')}</span>;
}

function ProvenanceFooter({ source, scope }: { source: RhChainSource; scope: RhChainPulseMetric['metric_scope'] }) {
  const sourceName = source.source_name ?? source.source ?? 'source_pending';
  const sourceUrl = source.source_url ?? source.url ?? null;
  return <footer className="rh-chain-provenance-footer" aria-label="Metric provenance footer">
    <span>{sourceUrl ? <a href={sourceUrl}>{sourceName}</a> : sourceName}</span><i>·</i>
    <span>observed_at: {formatTimestamp(source.observed_at)}</span><i>·</i>
    <span>{source.data_mode}</span><i>·</i>
    <span>{source.confidence_level}</span><i>·</i>
    <span>{scope}</span>
  </footer>;
}

function DailyReceiptsPreview({ feed }: { feed: RhChainDailyReceiptsPayload }) {
  const receipt = feed.latest_receipt;
  return <section className="panel rh-chain-section rh-chain-section--report rh-chain-daily-preview" aria-label="Daily RH Chain Receipts Preview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Daily RH Chain Receipts</p>
        <h2>Daily RH Chain Receipts</h2>
        <p>{feed.subtitle}</p>
      </div>
      <a className="execute compact secondary" href="/rh-chain-signal-desk/daily-receipts">Open Daily Receipts</a>
    </div>
    {feed.freshness_state !== 'fresh' && <p className="rh-chain-disclaimer">{feed.freshness_state === 'aging' ? 'Manual receipt is aging.' : 'Manual receipt is stale. Refresh required before treating it as current context.'}</p>}
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

function LaunchSurfacesPreview({ surfaceWatch }: { surfaceWatch: { launch_surfaces: RhChainLaunchSurfaceRecord[]; access_surfaces: RhChainAccessSurface[] } }) {
  return <section className="panel rh-chain-section rh-chain-section--utility" aria-label="Launch Surface Watch Preview"><div className="rh-chain-section-head"><div><p className="section-kicker">Launch + Access Surface Watch</p><h2>Remember the route</h2><p>Launch surfaces show where tokens start. Access surfaces show how users arrive.</p></div><a className="execute compact secondary" href="/rh-chain-signal-desk/launch-surfaces">Open Surface Watch</a></div><div className="rh-chain-daily-mini-grid">{surfaceWatch.launch_surfaces.slice(0, 2).map((surface) => <p key={surface.id}><span>{surface.source_type}</span><strong>{surface.name}</strong></p>)}{surfaceWatch.access_surfaces.slice(0, 1).map((surface) => <p key={surface.access_surface_name}><span>{surface.access_surface_type}</span><strong>{surface.access_surface_name}</strong></p>)}</div></section>;
}

function LaunchSurfacesPage({ surfaceWatch }: { surfaceWatch: { title: string; subtitle: string; doctrine: string; disclaimer: string; launch_surfaces: RhChainLaunchSurfaceRecord[]; access_surfaces: RhChainAccessSurface[] } }) {
  return <>
    <section className="panel rh-chain-section" aria-label="Launch Surface Watch"><div className="rh-chain-section-head"><div><p className="section-kicker">Launch Surface Watch</p><h2>{surfaceWatch.title}</h2><p>{surfaceWatch.subtitle}</p></div></div><p className="rh-chain-disclaimer">No launch source is a safety signal or an approval shortcut.</p></section>
    <section className="panel rh-chain-section" aria-label="Known Launch Surfaces"><div className="rh-chain-section-head"><div><p className="section-kicker">Known Launch Surfaces</p><h2>Evidence routes, not endorsements</h2></div></div><div className="rh-chain-daily-section-grid">{surfaceWatch.launch_surfaces.map((surface) => <article className="rh-chain-daily-section-card" key={surface.id}><p className="section-kicker">{surface.source_type} · {surface.launch_surface_status ?? 'source_required'}</p><h3>{surface.name}</h3><p>{surface.description}</p><p className="panel-caption"><b>Launch surface status:</b> {surface.launch_surface_status ?? 'source_required'}</p><p className="panel-caption"><b>Surface risk:</b> {(surface.surface_risk ?? 'unknown').replaceAll('_', ' ')}</p><p className="panel-caption"><b>Risk note:</b> {surface.risk_note}</p></article>)}</div></section>
    <section className="panel rh-chain-section" aria-label="Access Surface Watch"><div className="rh-chain-section-head"><div><p className="section-kicker">Access Surface Watch</p><h2>How users arrive</h2><p>Launch surfaces show where tokens start. Access surfaces show how users arrive.</p></div></div><div className="rh-chain-daily-section-grid">{surfaceWatch.access_surfaces.map((surface) => <article className="rh-chain-daily-section-card" key={surface.access_surface_name}><p className="section-kicker">{surface.access_surface_type} · {surface.source_status}</p><h3>{surface.access_surface_name}</h3><p>{surface.integration_notes}</p><p className="panel-caption"><b>Risk note:</b> {surface.risk_notes}</p><p className="panel-caption">Observed {surface.observed_at} · {surface.data_mode} · {surface.confidence_level} confidence</p></article>)}</div><p className="rh-chain-disclaimer">Access does not equal legitimacy. This page does not provide trading or bridging flows.</p></section>
    <section className="panel rh-chain-section" aria-label="Launch Context Fields"><div className="rh-chain-section-head"><div><p className="section-kicker">Launch Context Fields</p><h2>What Infopunks tracks</h2><p>Source, route, pair, LP claim, deployer, contract-verification status, evidence links, confidence, and observed timestamps—always reviewable, never assumed.</p></div></div></section>
    <section className="panel rh-chain-section rh-chain-daily-warning" aria-label="Launch Surface Risk Notes"><div className="rh-chain-section-head"><div><p className="section-kicker">Risk Notes</p><h2>Claims are not receipts</h2><p>Clones, fake launch claims, unlocked LP, and unverifiable deployers stay risk inputs until human-reviewed evidence changes the record.</p></div></div></section>
    <section className="panel rh-chain-section rh-chain-review-disclaimer" aria-label="Launch Surface Doctrine"><p>{surfaceWatch.doctrine}</p><p>{surfaceWatch.disclaimer}</p></section>
  </>;
}

function ScoutPage() {
  const [query, setQuery] = useState('What changed in the last 24h on RH Chain?');
  const [answer, setAnswer] = useState<{ answer: string; answer_type: string; supporting_receipts: Array<{ receipt_id: string; headline: string }>; limitations: string[]; disclaimer: string } | null>(null);
  async function ask(next = query) { setQuery(next); const response = await postApi<typeof answer>('/v1/rh-chain/scout/query', { query: next }); setAnswer(response.data as NonNullable<typeof answer>); }
  return <section className="panel rh-chain-section" aria-label="RH Chain Scout Agent"><div className="rh-chain-section-head"><div><p className="section-kicker">Read-only intelligence assistant</p><h2>RH Chain Scout Agent</h2><p>Reads the desk. Remembers the receipts. Never trades.</p></div></div><div className="rh-chain-scout-prompts">{['What changed in the last 24h?','What are the biggest risks right now?','What is the strongest RH Chain narrative?','What happened with NOXA?','What does launchpad fragmentation mean?','Which launch surfaces are being watched?','Check a token contract','Show launch surface context','Show access surface context'].map((prompt) => <button key={prompt} className="rh-chain-chip" onClick={() => ask(prompt)}>{prompt}</button>)}</div><form className="rh-chain-submit-form" onSubmit={(event) => { event.preventDefault(); void ask(); }}><label className="wide"><span>Ask the Scout</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Ask the RH Chain Scout" /></label><div className="panel-actions wide"><button className="execute" type="submit">Read desk memory</button></div></form>{answer && <article className="rh-chain-daily-latest-card"><p className="section-kicker">{answer.answer_type.replace(/_/g, ' ')}</p><h3>{answer.answer}</h3><div className="rh-chain-evidence-list">{answer.supporting_receipts.map((receipt) => <span key={receipt.receipt_id}>{receipt.receipt_id}: {receipt.headline}</span>)}</div><p className="panel-caption">{answer.limitations.join(' ')}</p><p className="rh-chain-disclaimer">{answer.disclaimer}</p></article>}</section>;
}

function RhChainDailyReceiptsPage({ feed }: { feed: RhChainDailyReceiptsPayload }) {
  return <>
    {feed.freshness_state !== 'fresh' && <section className="panel rh-chain-section rh-chain-daily-warning" aria-label="Receipt freshness"><p>{feed.freshness_state === 'aging' ? 'Manual receipt is aging.' : 'Manual receipt is stale. Freshness is part of truth.'}</p></section>}
    <LatestDailyReceiptSection receipt={feed.latest_receipt} />
    <DailyReceiptSections receipt={feed.latest_receipt} />
    <DailyReceiptTimeline receipts={feed.receipts} />
    <DailyWatchlistSection receipt={feed.latest_receipt} />
    <DailyDoNotTouchSection receipt={feed.latest_receipt} />
    <DailySourceNotesSection feed={feed} />
    <section className="panel rh-chain-section rh-chain-review-disclaimer" aria-label="Daily RH Chain Receipts Disclaimer">
      <p>{feed.disclaimer}</p>
      <p>{feed.doctrine}</p>
      <p className="panel-caption">{feed.source_policy}</p>
    </section>
  </>;
}

function dailyReceiptNumber(receiptId: string | undefined): string | null {
  const match = receiptId?.match(/^rh_daily_(\d{3})$/);
  return match ? `#${match[1]}` : null;
}

function LatestDailyReceiptSection({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section id="latest-receipt" className="panel rh-chain-section" aria-label="Latest Daily RH Chain Receipt">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Latest Receipt / {receipt.receipt_id}</p>
        <h2>{dailyReceiptNumber(receipt.receipt_id) ? `Daily Receipt ${dailyReceiptNumber(receipt.receipt_id)}` : `Daily Receipt · ${receipt.receipt_id}`}</h2>
        <p>{receipt.period ?? 'One daily memory object for signal, risk, narrative, liquidity, and verdict.'}</p>
      </div>
      <div className="rh-chain-daily-actions">
        <a className="execute compact secondary" href={`/rh-chain-signal-desk/daily-receipts/${receipt.receipt_id}/card`}>View share card</a>
        <CopyXPost receipt={receipt} />
        <CopyReceiptSummary receipt={receipt} />
        <span className={`rh-chain-daily-confidence confidence-${receipt.confidence_level}`}>{receipt.confidence_level}</span>
      </div>
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

function receiptXPost(receipt: RhChainDailyReceipt) { return createRhChainDailyReceiptXPost(receipt); }

function CopyXPost({ receipt }: { receipt: RhChainDailyReceipt }) {
  const [copied, setCopied] = useState(false);
  async function copyPost() {
    try {
      await navigator.clipboard.writeText(receiptXPost(receipt));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="execute compact secondary" onClick={copyPost}>{copied ? 'Copied X post' : 'Copy X post'}</button>;
}

function CopyReceiptSummary({ receipt }: { receipt: RhChainDailyReceipt }) {
  const [copied, setCopied] = useState(false);
  const summary = [
    `Daily RH Chain Receipt · ${receipt.receipt_id} — ${receipt.period ?? receipt.date}`,
    receipt.headline,
    `Top signal: ${receipt.top_signal}`,
    `Risk: ${receipt.biggest_risk}`,
    `Narrative: ${receipt.strongest_narrative}`,
    `Infopunks verdict: ${receipt.infopunks_verdict}`,
    'External data gives context. Infopunks gives judgment. Receipts create memory.',
    'Manual, source-dependent intelligence. Not financial advice or an official Robinhood partnership.'
  ].join('\n');

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <button type="button" className="execute compact secondary" onClick={copySummary}>{copied ? 'Copied receipt summary' : 'Copy receipt summary'}</button>;
}

function DailyReceiptSections({ receipt }: { receipt: RhChainDailyReceipt }) {
  if (!receipt.receipt_sections?.length) return null;
  return <section className="panel rh-chain-section" aria-label="Daily Receipt Intelligence Memo">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Structured Intelligence Memo</p>
        <h2>Signal, structure, and judgment</h2>
        <p>{receipt.manual_context ?? 'Human-reviewed memory stays separate from external context.'}</p>
      </div>
    </div>
    <div className="rh-chain-daily-section-grid">
      {receipt.receipt_sections.map((section) => <article key={section.section_id} className={`rh-chain-daily-section-card section-${section.section_id}`}>
        <div>
          <p className="section-kicker">{section.section_id.replace(/_/g, ' ')}</p>
          <h3>{section.title}</h3>
        </div>
        <p>{section.summary}</p>
        <dl>
          {section.fields.map((field) => <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>)}
        </dl>
      </article>)}
    </div>
  </section>;
}

function ReceiptDetailPage({ receipt, feed }: { receipt: RhChainDailyReceipt; feed: RhChainDailyReceiptsPayload }) {
  return <>
    <LatestDailyReceiptSection receipt={receipt} />
    <ReceiptShareCard receipt={receipt} />
    <DailyReceiptSections receipt={receipt} />
    <DailySourceNotesSection feed={feed} />
  </>;
}

function DailyReceiptNotFound({ receiptId }: { receiptId: string }) {
  return <section className="panel rh-chain-section" aria-label="Daily receipt not found"><p className="section-kicker">Receipt not found</p><h2>No Daily RH Chain Receipt matches “{receiptId}”.</h2><p>This route does not infer or fabricate market memory. Return to the receipt timeline to use a known receipt id.</p><a className="execute compact secondary" href="/rh-chain-signal-desk/daily-receipts">Open receipt timeline</a></section>;
}

function ReceiptCardPage({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section id="latest-receipt" className="rh-chain-receipt-card-page" aria-label={`RH Chain Receipt ${receipt.receipt_id} share card`}>
    <ReceiptShareCard receipt={receipt} standalone />
    <XPostBlock receipt={receipt} />
    <div className="rh-chain-card-page-actions">
      <a className="execute compact secondary" href={`/rh-chain-signal-desk/daily-receipts/${receipt.receipt_id}`}>View full receipt</a>
      <CopyXPost receipt={receipt} />
    </div>
  </section>;
}

function XPostBlock({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section className="rh-chain-x-post-block" aria-label="Copy X post">
    <div>
      <p className="section-kicker">X-native copy</p>
      <h2>Copy X post</h2>
    </div>
    <textarea readOnly aria-label="X post copy" value={receiptXPost(receipt)} />
    <CopyXPost receipt={receipt} />
  </section>;
}

function ReceiptShareCard({ receipt, standalone = false }: { receipt: RhChainDailyReceipt; standalone?: boolean }) {
  const isReceipt001 = receipt.receipt_id === 'rh_daily_001';
  return <article className={`rh-chain-share-card${standalone ? ' standalone' : ''}`}>
    <header>
      <div>
        <p className="rh-chain-share-card-brand">INFOPUNKS</p>
        <p className="section-kicker">RH Chain Signal Desk</p>
      </div>
      <p className="rh-chain-share-card-number">{dailyReceiptNumber(receipt.receipt_id) ? `Receipt ${dailyReceiptNumber(receipt.receipt_id)}` : `Receipt · ${receipt.receipt_id}`}</p>
    </header>
    <div className="rh-chain-share-card-period">{receipt.period ?? receipt.date}</div>
    <h2>{receipt.headline}</h2>
    <div className="rh-chain-share-card-signals">
      <p><span>Top Signal</span><strong>{isReceipt001 ? 'CASHCAT remains the flagship attention asset' : receipt.top_signal}</strong></p>
      <p><span>Biggest Risk</span><strong>{receipt.biggest_risk}</strong></p>
      <p><span>Strongest Narrative</span><strong>{receipt.strongest_narrative}</strong></p>
    </div>
    <div className="rh-chain-share-card-verdict">
      <p className="section-kicker">Infopunks Verdict</p>
      <p>{isReceipt001 ? 'Meme season is onboarding attention. The test is whether attention converts into persistent RWA/DeFi usage.' : receipt.infopunks_verdict}</p>
    </div>
    <footer><span>Public intelligence, not endorsement.</span><strong>No receipt, no signal.</strong></footer>
  </article>;
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
            <h3><a href={`/rh-chain-signal-desk/daily-receipts/${receipt.receipt_id}`}>{receipt.headline}</a></h3>
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
  return <section className="panel rh-chain-section rh-chain-section--utility rh-chain-4663-preview" aria-label="4663 Signal Index Preview">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">4663 Signal Index</p>
        <h2>4663 Signal Index</h2>
        <p>{index.subtitle}</p>
      </div>
      <a className="execute compact secondary" href="/rh-chain-signal-desk/4663-index">Open 4663 Index</a>
    </div>
    {index.freshness_state !== 'fresh' && <p className="rh-chain-disclaimer">Manual index values require refresh.</p>}
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
    {index.freshness_state !== 'fresh' && <section className="panel rh-chain-section rh-chain-daily-warning" aria-label="Index freshness"><p>Manual index values require refresh.</p></section>}
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
  return <section className="panel rh-chain-section rh-chain-section--utility rh-chain-review-preview" aria-label="Review Queue Preview">
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
  token_pair: { exact_contract_match: boolean; chain_match_status: 'chain_verified' | 'chain_unverified' | 'chain_mismatch'; dex_url: string | null; pair_address: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; fdv_usd: number | null; market_cap_usd: number | null; pair_created_at: string | null; source_timestamp: string | null; freshness: string } | null;
  explorer: { exact_contract_match: boolean; explorer_url: string | null; contract_exists: boolean | null; contract_verified: boolean | null; deployer_address: string | null; contract_type: string | null; availability: 'available' | 'unavailable' } | null;
  launch_context?: RhChainLaunchContext;
  disclaimer: string;
  judgment_policy?: string;
};

function LiveSnapshotPreview({ snapshot }: { snapshot: RhChainLiveSnapshot }) {
  return <section className="panel rh-chain-section rh-chain-section--metadata" aria-label="Live Snapshot Preview">
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
      <div className="rh-chain-review-stat-grid">{snapshot.provider_statuses.map((provider) => <article className="rh-chain-review-stat" key={provider.provider_name}><span>{provider.provider_name}</span><strong>{provider.status}</strong><small>{provider.fetched_at ? `fetched ${formatTimestamp(provider.fetched_at)}${provider.status === 'stale' ? ' · stale fallback' : ''}` : provider.error ? `${provider.error.code}: ${provider.error.message}` : provider.error_summary ?? 'No external request.'}</small></article>)}</div>
    </section>
    <section className="panel rh-chain-section" aria-label="Chain Metrics Snapshot"><div className="rh-chain-section-head"><div><p className="section-kicker">Chain metrics snapshot</p><h2>Chain Metrics Snapshot</h2><p>Source timestamp {metrics.source_timestamp ? formatTimestamp(metrics.source_timestamp) : 'unavailable'} / {metrics.freshness}</p></div></div><div className="rh-chain-metric-grid"><SnapshotMetric label="TVL" value={formatUsd(metrics.tvl_usd)} /><SnapshotMetric label="DEX volume" value={formatUsd(metrics.dex_volume_24h_usd)} /><SnapshotMetric label="Stablecoin market cap" value={formatUsd(metrics.stablecoin_market_cap_usd)} /><SnapshotMetric label="Protocol count" value={metrics.protocol_count?.toLocaleString() ?? 'unavailable'} /></div></section>
    <section className="panel rh-chain-section" aria-label="Meme Category Snapshot"><div className="rh-chain-section-head"><div><p className="section-kicker">Meme category snapshot</p><h2>Meme Category Snapshot</h2><p>Source timestamp {category.source_timestamp ? formatTimestamp(category.source_timestamp) : 'unavailable'} / {category.freshness}</p></div></div><div className="rh-chain-metric-grid"><SnapshotMetric label="Category market cap" value={formatUsd(category.market_cap_usd)} /><SnapshotMetric label="24h volume" value={formatUsd(category.volume_24h_usd)} /></div><div className="rh-chain-list">{category.top_assets.map((asset) => <article className="rh-chain-list-item" key={asset.symbol}><div><h3>{asset.symbol}</h3><p>{asset.name}</p></div><span className="rh-chain-chip">{formatUsd(asset.market_cap_usd)}</span></article>) || <p className="panel-caption">No cached category assets available.</p>}</div></section>
    <section className="panel rh-chain-section" aria-label="Token Lookup Tool"><div className="rh-chain-section-head"><div><p className="section-kicker">Token lookup</p><h2>Token Lookup Tool</h2><p>Fetches a cached, risk-neutral external snapshot. It does not approve a submission or establish identity without an exact contract and verified chain match.</p></div></div><form className="rh-chain-submit-form" onSubmit={lookup}><label><span>Contract address</span><input value={contract} onChange={(event) => setContract(event.target.value)} placeholder="0x..." aria-label="Live snapshot contract address" /></label><div className="panel-actions"><button type="submit" className="execute">Fetch cached snapshot</button></div></form>{error && <p className="route-state error">{error}</p>}{result && <div className="rh-chain-packet-grid"><p><span>Top pair</span><strong>{result.token_pair?.pair_address ?? 'unavailable'}</strong></p><p><span>Provider contract match</span><strong>{result.token_pair?.exact_contract_match ? 'exact contract context' : 'context only — identity unverified'}</strong></p><p><span>RH Chain match</span><strong>{result.token_pair?.chain_match_status?.replaceAll('_', ' ') ?? 'unavailable'}</strong></p><p><span>Liquidity</span><strong>{formatUsd(result.token_pair?.liquidity_usd ?? null)}</strong></p><p><span>24h volume</span><strong>{formatUsd(result.token_pair?.volume_24h_usd ?? null)}</strong></p><p><span>Blockscout verification</span><strong>{result.explorer?.availability === 'unavailable' ? 'verification unavailable' : result.explorer?.contract_verified ? 'verified source' : 'unverified'}</strong></p><p><span>Deployer</span><strong>{result.explorer?.deployer_address ?? 'unavailable'}</strong></p>{result.launch_context && <p><span>Launch surface</span><strong>{result.launch_context.launch_source.replace(/_/g, ' ')} / {result.launch_context.confidence_level} confidence</strong></p>}{result.token_pair?.dex_url && <p><a href={result.token_pair.dex_url}>DexScreener pair</a></p>}{result.explorer?.explorer_url && <p><a href={result.explorer.explorer_url}>Blockscout explorer</a></p>}</div>}</section>
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
        {item.launch_context && <span className={`rh-chain-daily-confidence confidence-${item.launch_context.confidence_level}`}>{item.launch_context.confidence_level} launch context</span>}
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
    {item.launch_context && <div className="rh-chain-review-field"><span>Launch context · {item.launch_context.confidence_level} confidence</span><div className="rh-chain-evidence-list"><span>{item.launch_context.launch_source.replace(/_/g, ' ')}</span><span>LP: {item.launch_context.lp_status.replace(/_/g, ' ')}</span><span>Contract: {String(item.launch_context.contract_verified)}</span>{item.launch_context.deployer_address && <span>Deployer: {item.launch_context.deployer_address.slice(0, 8)}…{item.launch_context.deployer_address.slice(-4)}</span>}</div></div>}
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
  memePulse,
  freshnessState,
  query,
  risk,
  onQuery,
  onRisk
}: {
  memes: RhChainMemeToken[];
  allMemes: RhChainMemeToken[];
  memePulse: RhChainMemePulsePayload | null;
  freshnessState?: RhChainMemePulsePayload['freshness_state'];
  query: string;
  risk: RhChainRiskState | 'all';
  onQuery: (value: string) => void;
  onRisk: (value: RhChainRiskState | 'all') => void;
}) {
  const riskStates = Array.from(new Set(allMemes.map((token) => token.risk_state)));
  return <section id="meme-pulse" className="panel rh-chain-section rh-chain-section--primary" aria-label="Meme Pulse">
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
    {memePulse?.refreshed_at && <p className="panel-caption">Last refreshed {formatTimestamp(memePulse.refreshed_at)} · provider context and reviewed memory are kept distinct.</p>}
    {freshnessState && freshnessState !== 'fresh' && <p className="rh-chain-disclaimer">Provider meme context is {freshnessState}. Source timestamps require review before treating attention context as current.</p>}
    {memePulse && <div className="rh-chain-list" aria-label="Meme Pulse context priority">
      {memePulse.top_attention_assets.map((asset, index) => <article className="rh-chain-list-item" key={`${asset.context_origin ?? 'memory'}-${asset.contract ?? asset.ticker}-${index}`}>
        <div><p className="section-kicker">{asset.context_origin === 'auto_observed' ? 'auto-observed' : 'reviewed memory'}</p><h3>{asset.ticker} · {asset.name}</h3><p>{asset.infopunks_verdict}</p><p className="panel-caption">{asset.contract ? `Exact contract context: ${asset.contract}` : 'No exact contract supplied; source-required.'}</p></div>
        <span className="rh-chain-chip">{asset.context_origin === 'auto_observed' ? 'auto-observed' : 'reviewed memory'}</span>
        <SourceLine source={asset.source} />
      </article>)}
    </div>}
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
  return <section className="panel rh-chain-section rh-chain-section--editorial" aria-label="Signal Classifier">
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
  return <section className="panel rh-chain-section rh-chain-section--primary" aria-label="Risk Wall">
    <div className="rh-chain-section-head">
      <div>
        <p className="section-kicker">Risk Wall</p>
        <h2>Risk Wall</h2>
        <p>Suspicious launches, low-liquidity traps, unverified contracts, and deployer warnings.</p>
      </div>
    </div>
    <p className="rh-chain-disclaimer">Manual risk wall entries remain source-stamped context. Freshness requires review before treating them as current conditions.</p>
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
  return <section className="panel rh-chain-section rh-chain-section--editorial" aria-label="Stock Token Spillover Map">
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
  launch_source: string;
  launch_surface_url: string;
  pair_address: string;
  deployer_address: string;
  lp_status_claim: string;
  scout_handle: string;
  scout_contact: string;
  public_attribution_consent: boolean;
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
  launch_source: '', launch_surface_url: '', pair_address: '', deployer_address: '', lp_status_claim: '',
  scout_handle: '', scout_contact: '', public_attribution_consent: false,
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
    const links = [next.x_twitter_link, next.website_link, next.liquidity_link, next.launch_surface_url].filter((value) => value.trim());
    if (links.some((value) => value.trim().length > 500 || !/^https:\/\/[^\s]+$/i.test(value.trim()))) nextErrors.push('Links must be HTTPS URLs and are recorded as external, untrusted context.');
    if (next.ticker.trim().length > 24) nextErrors.push('Ticker must be 24 characters or fewer.');
    if (next.token_contract.trim().length > 128 || next.pair_address.trim().length > 128 || next.deployer_address.trim().length > 128) nextErrors.push('Contract and address fields must be 128 characters or fewer.');
    if (next.deployer_notes.length > 2000 || next.submitter_notes.length > 2000) nextErrors.push('Notes must be 2,000 characters or fewer.');
    if (next.scout_handle.trim().length > 64 || next.scout_contact.trim().length > 256) nextErrors.push('Scout handle/contact exceeds the permitted length.');
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
        launch_source: form.launch_source || undefined,
        launch_surface_url: form.launch_surface_url.trim() || undefined,
        pair_address: form.pair_address.trim() || undefined,
        deployer_address: form.deployer_address.trim() || undefined,
        lp_status_claim: form.lp_status_claim || undefined,
        scout_handle: form.scout_handle.trim() || undefined,
        scout_contact: form.scout_contact.trim() || undefined,
        public_attribution_consent: form.public_attribution_consent,
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

  return <section id="submit-signal" className="panel rh-chain-section rh-chain-section--utility" aria-label="Submit Signal">
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
      <label><span>X / Twitter link · external, untrusted</span><input name="x_twitter_link" aria-label="X or Twitter link" maxLength={500} value={form.x_twitter_link} onChange={(event) => setField('x_twitter_link', event.target.value)} placeholder="https://x.com/..." /></label>
      <label><span>Website link · external, untrusted</span><input name="website_link" aria-label="Website link" maxLength={500} value={form.website_link} onChange={(event) => setField('website_link', event.target.value)} placeholder="https://..." /></label>
      <label><span>Liquidity link · external, untrusted</span><input name="liquidity_link" aria-label="Liquidity link" maxLength={500} value={form.liquidity_link} onChange={(event) => setField('liquidity_link', event.target.value)} placeholder="DEX pool, explorer, or liquidity receipt" /></label>
      <label className="wide"><span>Deployer notes</span><textarea name="deployer_notes" aria-label="Deployer notes" maxLength={2000} rows={4} value={form.deployer_notes} onChange={(event) => setField('deployer_notes', event.target.value)} placeholder="Deployer wallet, funding path, ownership controls, warnings" /></label>
      <label className="wide"><span>Submitter notes</span><textarea name="submitter_notes" aria-label="Submitter notes" maxLength={2000} rows={4} value={form.submitter_notes} onChange={(event) => setField('submitter_notes', event.target.value)} placeholder="Why this belongs on the intelligence desk" /></label>
      <details className="rh-chain-launch-context wide"><summary>Signal Scout attribution, optional</summary><p>Public attribution is opt-in. Contact information is private and never appears on the public Scout Board.</p><div className="rh-chain-daily-note-grid"><label><span>Scout handle</span><input aria-label="Scout handle" value={form.scout_handle} onChange={(event) => setField('scout_handle', event.target.value)} placeholder="@receipt-hunter" /></label><label><span>Scout contact, private</span><input aria-label="Scout contact" value={form.scout_contact} onChange={(event) => setField('scout_contact', event.target.value)} placeholder="Optional email or contact handle" /></label></div><label className="rh-chain-checkbox"><input type="checkbox" checked={form.public_attribution_consent} onChange={(event) => setField('public_attribution_consent', event.target.checked)} /><span>I consent to show my Scout handle publicly for this evidence contribution. My contact information stays private.</span></label></details>
      <details className="rh-chain-launch-context wide"><summary>Launch context, optional</summary><p>Submitter claims remain unverified until manual receipt review.</p><div className="rh-chain-daily-note-grid"><label><span>Launch source</span><select aria-label="Launch source" value={form.launch_source} onChange={(event) => setField('launch_source', event.target.value)}><option value="">Unknown / not supplied</option><option value="noxa_fun">NOXA Fun</option><option value="flap_sh">flap.sh</option><option value="trensh_today">trensh.today</option><option value="bankr">bankr</option><option value="tokeny_fun">tokeny.fun</option><option value="vlad_fun">vlad.fun</option><option value="robindotmarket">robindotmarket</option><option value="20lab_erc20">20lab-generated ERC-20</option><option value="pump_fun_routed_rh_chain">Pump.fun-routed RH Chain token</option><option value="uniswap_direct_pool">Uniswap direct pool launch</option><option value="hardhat_foundry_custom">Hardhat/Foundry custom deployment</option><option value="unknown_manual">Unknown/manual deployment</option></select></label><label><span>LP status claim</span><select aria-label="LP status claim" value={form.lp_status_claim} onChange={(event) => setField('lp_status_claim', event.target.value)}><option value="">Not supplied</option><option value="locked_claimed">Locked (claimed)</option><option value="burned_claimed">Burned (claimed)</option><option value="unlocked">Unlocked</option><option value="unknown">Unknown</option><option value="unavailable">Unavailable</option></select></label><label><span>Launch surface URL · external, untrusted</span><input aria-label="Launch surface URL" maxLength={500} value={form.launch_surface_url} onChange={(event) => setField('launch_surface_url', event.target.value)} /></label><label><span>Pair address</span><input aria-label="Pair address" maxLength={128} value={form.pair_address} onChange={(event) => setField('pair_address', event.target.value)} /></label><label><span>Deployer address</span><input aria-label="Deployer address" maxLength={128} value={form.deployer_address} onChange={(event) => setField('deployer_address', event.target.value)} /></label></div></details>
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
  return <section className="panel rh-chain-section rh-chain-section--report" aria-label="Receipts">
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
  return formatUtcCompact(value);
}
