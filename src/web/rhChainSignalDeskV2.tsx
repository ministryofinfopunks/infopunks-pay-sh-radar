import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  RhChain4663Asset,
  RhChain4663IndexPayload,
  RhChainAccessSurface,
  RhChainDailyReceipt,
  RhChainDailyReceiptsPayload,
  RhChainLaunchSurfaceRecord,
  RhChainMemePulsePayload,
  RhChainPayload,
  RhChainReceiptRelayPacket,
  RhChainReceiptRelayPayload,
  RhChainReviewItem,
  RhChainReviewQueuePayload,
  RhChainRiskState,
  RhChainSource
} from '../data/rhChain';
import { createRhChainDailyReceiptXPost } from '../data/rhChain';
import type { RhChainLiveSnapshot } from '../services/rhChainLiveSnapshotService';
import type { RhChainTodayOn4663Payload } from '../services/rhChainTodayOn4663Service';
import { formatUtcCompact } from '../shared/timestamps';
import { isRhChainContractAddress, rhChainTokenDossierRoute } from './rhChainContract';
import {
  fetchRhChain,
  RhChainModuleDegradedNotice,
  RhChainRouteState,
  type RhChainEnvelope,
  type RhChainRequestFailure
} from './rhChainUi';
import {
  selectBriefMemePulse,
  selectChainPulseSummary,
  selectFeaturedMovers,
  selectFeaturedReviewItems,
  selectFeaturedRisks,
  selectLaunchRoute,
  selectTodayOn4663,
  type BriefMemeSelection,
  type FeaturedRiskSelection
} from './rhChainSignalDeskSelectors';

type RhChainDeskMode = 'brief' | 'analyst';

export type RhChainLaunchSurfacesPayload = {
  title: string;
  subtitle: string;
  doctrine: string;
  disclaimer: string;
  launch_surfaces: RhChainLaunchSurfaceRecord[];
  access_surfaces: RhChainAccessSurface[];
};

type RhChainSignalDeskV2Failures = {
  reviewQueue: RhChainRequestFailure | null;
  signalIndex: RhChainRequestFailure | null;
  dailyReceipts: RhChainRequestFailure | null;
  launchSurfaces: RhChainRequestFailure | null;
};

export type RhChainSignalDeskV2Props = {
  desk: RhChainPayload;
  envelope: RhChainEnvelope<unknown> | null;
  reviewQueue: RhChainReviewQueuePayload | null;
  signalIndex: RhChain4663IndexPayload | null;
  dailyReceipts: RhChainDailyReceiptsPayload | null;
  memePulse: RhChainMemePulsePayload | null;
  todayOn4663: RhChainTodayOn4663Payload | null;
  launchSurfaces: RhChainLaunchSurfacesPayload | null;
  liveSnapshot: RhChainLiveSnapshot | null;
  failures: RhChainSignalDeskV2Failures;
};

type RhChainTokenSnapshotResponse = {
  contract: string;
  resolved_context?: {
    contract: string;
    source: 'reviewed_dossier' | '100_receipts' | '4663_index' | 'market_structure' | 'snapshot_history' | 'dexscreener' | 'blockscout' | 'unknown';
    ticker: string | null;
    name: string | null;
    review_status: string;
    risk_state: string;
  };
  token_pair: {
    exact_contract_match: boolean;
    chain_match_status: 'chain_verified' | 'chain_unverified' | 'chain_mismatch';
    dex_url: string | null;
    pair_address: string | null;
    liquidity_usd: number | null;
    volume_24h_usd: number | null;
    source_timestamp: string | null;
    freshness: string;
  } | null;
  explorer: {
    exact_contract_match: boolean;
    explorer_url: string | null;
    contract_exists: boolean | null;
    contract_verified: boolean | null;
    deployer_address: string | null;
    contract_type: string | null;
    availability: 'available' | 'unavailable';
  } | null;
  disclaimer: string;
  judgment_policy?: string;
};

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatTimestamp(value: string | null | undefined) {
  return value ? formatUtcCompact(value) : 'timestamp unavailable';
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function dailyReceiptNumber(receiptId: string) {
  const match = receiptId.match(/^rh_daily_(\d{3})$/);
  return match ? `#${match[1]}` : receiptId;
}

function riskPriority(state: RhChainRiskState | 'unavailable') {
  const labels: Record<RhChainRiskState | 'unavailable', string> = {
    do_not_touch_yet: 'critical review',
    high_risk: 'high',
    source_required: 'source required',
    medium_watch: 'medium',
    low_watch: 'low watch',
    unavailable: 'unavailable'
  };
  return labels[state];
}

export function RhChainSignalDeskV2(props: RhChainSignalDeskV2Props) {
  const [mode, setMode] = useState<RhChainDeskMode>('brief');
  const [now] = useState(() => new Date());
  const today = useMemo(() => selectTodayOn4663(props.todayOn4663, now), [props.todayOn4663, now]);
  const movers = useMemo(() => selectFeaturedMovers(props.signalIndex), [props.signalIndex]);
  const risks = useMemo(() => selectFeaturedRisks(props.desk, now), [props.desk, now]);
  const memes = useMemo(() => selectBriefMemePulse(props.desk, props.memePulse, now), [props.desk, props.memePulse, now]);
  const reviewItems = useMemo(() => selectFeaturedReviewItems(props.reviewQueue), [props.reviewQueue]);
  const chainPulse = useMemo(() => selectChainPulseSummary(props.desk), [props.desk]);
  const launchRoute = useMemo(() => selectLaunchRoute(props.reviewQueue, props.launchSurfaces?.launch_surfaces ?? [], props.launchSurfaces?.access_surfaces ?? []), [props.reviewQueue, props.launchSurfaces]);

  return <div className={`rh-v2-desk mode-${mode}`}>
    <RhChainHero
      desk={props.desk}
      envelope={props.envelope}
      today={today}
      latestReceipt={props.dailyReceipts?.latest_receipt ?? null}
      signalIndex={props.signalIndex}
      reviewQueue={props.reviewQueue}
      mode={mode}
      onModeChange={setMode}
    />

    <TodayOn4663 cards={today} />

    {props.dailyReceipts
      ? <DailyReceiptFeature receipt={props.dailyReceipts.latest_receipt} />
      : props.failures.dailyReceipts
        ? <RhChainModuleDegradedNotice failure={props.failures.dailyReceipts} moduleName="Daily receipt" unaffectedCopy="Today, movers, and risk memory remain accessible." />
        : <RhChainRouteState state="loading" title="Opening the Daily Receipt…" />}

    {props.signalIndex
      ? <MoversSection movers={movers} />
      : props.failures.signalIndex
        ? <RhChainModuleDegradedNotice failure={props.failures.signalIndex} moduleName="4663 movers" unaffectedCopy="Reviewed receipt and risk memory remain accessible." />
        : <RhChainRouteState state="loading" title="Opening 4663 movers…" />}

    <RiskRadar risks={risks} />
    <MemePulseBrief items={memes} allItems={props.desk.meme_pulse} mode={mode} />

    {props.launchSurfaces
      ? <LaunchRouteFlow route={launchRoute} />
      : props.failures.launchSurfaces
        ? <RhChainModuleDegradedNotice failure={props.failures.launchSurfaces} moduleName="Launch and access routes" unaffectedCopy="No route has been inferred from the unavailable module." />
        : <RhChainRouteState state="loading" title="Opening route memory…" />}

    {props.reviewQueue
      ? <ReviewQueueBrief selections={reviewItems} />
      : props.failures.reviewQueue
        ? <RhChainModuleDegradedNotice failure={props.failures.reviewQueue} moduleName="Review queue" unaffectedCopy="Other Signal Desk intelligence remains accessible." />
        : <RhChainRouteState state="loading" title="Opening the Review Queue…" />}

    <ChainPulseBrief metrics={chainPulse} desk={props.desk} />

    {mode === 'analyst' && <RhChainAnalystPanel
      desk={props.desk}
      index={props.signalIndex}
      queue={props.reviewQueue}
      receipts={props.dailyReceipts}
      memePulse={props.memePulse}
      liveSnapshot={props.liveSnapshot}
    />}

    <RhChainMethodologyFooter envelope={props.envelope} analyst={mode === 'analyst'} />
  </div>;
}

function RhChainViewModeControl({ mode, onChange }: { mode: RhChainDeskMode; onChange: (mode: RhChainDeskMode) => void }) {
  return <div className="rh-v2-mode-control" role="group" aria-label="Signal Desk view mode">
    {(['brief', 'analyst'] as const).map((value) => <button
      key={value}
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
    >{value}</button>)}
  </div>;
}

function RhChainHero({ desk, envelope, today, latestReceipt, signalIndex, reviewQueue, mode, onModeChange }: {
  desk: RhChainPayload;
  envelope: RhChainEnvelope<unknown> | null;
  today: ReturnType<typeof selectTodayOn4663>;
  latestReceipt: RhChainDailyReceipt | null;
  signalIndex: RhChain4663IndexPayload | null;
  reviewQueue: RhChainReviewQueuePayload | null;
  mode: RhChainDeskMode;
  onModeChange: (mode: RhChainDeskMode) => void;
}) {
  const topSignal = today.find((item) => item.id === 'top_signal');
  const topRisk = today.find((item) => item.id === 'risk_alert');
  const observedAt = today.map((item) => item.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? desk.last_updated;
  const sourceCount = envelope?.sources.length ?? today.reduce((count, item) => count + item.sourceCount, 0);
  const unresolved = reviewQueue?.items.filter((item) => !['approved_signal', 'rejected_low_receipt_quality'].includes(item.review_state)).length;
  return <section className="rh-v2-hero" aria-labelledby="rh-v2-title">
    <div className="rh-v2-hero-main">
      <div className="rh-v2-hero-topline">
        <p className="eyebrow">Public intelligence for Chain 4663</p>
        <RhChainViewModeControl mode={mode} onChange={onModeChange} />
      </div>
      <h1 id="rh-v2-title">Know what is moving.<br /><span>Know what is real.</span></h1>
      <p className="rh-v2-hero-copy">Independent intelligence, risk memory and market signals for Robinhood Chain.</p>
      <p className="rh-v2-doctrine">External data gives context. Infopunks gives judgment.</p>
      <RhChainContractCheck signalIndex={signalIndex} reviewQueue={reviewQueue} latestReceipt={latestReceipt} />
    </div>
    <aside className="rh-v2-intelligence-rail" aria-label="Today on 4663 summary">
      <div className="rh-v2-rail-heading"><span>Today on 4663</span><i aria-hidden="true" /></div>
      <dl>
        <div><dt>Market state</dt><dd>{latestReceipt?.freshness_state ? formatLabel(latestReceipt.freshness_state) : 'source required'}</dd></div>
        <div><dt>Top signal</dt><dd>{topSignal?.verdict ?? 'Unavailable'}</dd></div>
        <div><dt>Biggest risk</dt><dd>{topRisk?.verdict ?? 'Unavailable'}</dd></div>
        <div><dt>Latest receipt</dt><dd>{latestReceipt ? `Receipt ${dailyReceiptNumber(latestReceipt.receipt_id)}` : 'Unavailable'}</dd></div>
        <div><dt>Open reviews</dt><dd>{unresolved ?? 'Unavailable'}</dd></div>
        <div><dt>Observed</dt><dd>{formatTimestamp(observedAt)}</dd></div>
        <div><dt>Sources</dt><dd>{sourceCount || 'Source required'}</dd></div>
      </dl>
      <details className="rh-v2-source-policy">
        <summary>View source policy</summary>
        <p>{envelope?.meta.source_policy ?? desk.source_policy}</p>
      </details>
      <p className="rh-v2-independent">Independent Infopunks intelligence. Not affiliated with or endorsed by Robinhood. No buy, sell, or listing recommendation.</p>
    </aside>
  </section>;
}

function localRiskForContract(contract: string, index: RhChain4663IndexPayload | null, queue: RhChainReviewQueuePayload | null) {
  const normalized = contract.toLowerCase();
  const review = queue?.items.find((item) => item.token_contract.toLowerCase() === normalized);
  const asset = index?.assets.find((item) => item.token_contract.toLowerCase() === normalized);
  return review?.risk_state ?? asset?.risk_state ?? 'source_required';
}

function RhChainContractCheck({ signalIndex, reviewQueue, latestReceipt }: {
  signalIndex: RhChain4663IndexPayload | null;
  reviewQueue: RhChainReviewQueuePayload | null;
  latestReceipt: RhChainDailyReceipt | null;
}) {
  const [contract, setContract] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RhChainTokenSnapshotResponse | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = contract.trim();
    if (!isRhChainContractAddress(normalized)) {
      setError('Paste a valid RH Chain contract address.');
      setStatus('error');
      setResult(null);
      return;
    }
    setError(null);
    setResult(null);
    setStatus('loading');
    try {
      const response = await fetchRhChain<RhChainTokenSnapshotResponse>(`/v1/rh-chain/live-snapshot/token/${encodeURIComponent(normalized)}`);
      setResult(response.data);
      setStatus('success');
    } catch {
      setError('Contract context is temporarily unavailable. Reviewed desk memory has not been changed.');
      setStatus('error');
    }
  }

  const risk = result?.resolved_context?.risk_state ?? (result ? localRiskForContract(result.contract, signalIndex, reviewQueue) : 'source_required');
  const exactStatus = result?.token_pair?.exact_contract_match || result?.explorer?.exact_contract_match ? 'Exact contract context found' : 'Exact market pair unavailable';
  const chainStatus = result?.token_pair?.chain_match_status ? formatLabel(result.token_pair.chain_match_status) : 'Chain verification unavailable';
  return <div className="rh-v2-contract-shell">
    <form className="rh-v2-contract-checker rh-chain-contract-checker" onSubmit={submit} noValidate>
      <label htmlFor="rh-chain-contract-checker">Paste an RH Chain contract</label>
      <div>
        <input
          id="rh-chain-contract-checker"
          value={contract}
          onChange={(event) => { setContract(event.target.value); if (status === 'error') { setError(null); setStatus('idle'); } }}
          placeholder="0x........................................"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={error ? 'rh-v2-contract-error' : 'rh-v2-contract-help'}
          aria-invalid={Boolean(error)}
        />
        <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Checking…' : 'Check 4663'}</button>
      </div>
      <p id="rh-v2-contract-help">Exact-contract context only. This check is not an approval or recommendation.</p>
      {error && <p id="rh-v2-contract-error" className="rh-v2-contract-error" role="alert">{error}</p>}
    </form>
    <div className="sr-only" aria-live="polite">{status === 'loading' ? 'Checking contract context.' : status === 'success' ? 'Contract context loaded.' : error ?? ''}</div>
    {result && <section className="rh-v2-contract-result" aria-label="Contract check result">
      <header><div><span>Contract status</span><strong>{exactStatus}</strong></div><EvidenceStateBadge state={risk} /></header>
      <dl>
        <div><dt>Chain verification</dt><dd>{chainStatus}</dd></div>
        <div><dt>Source timestamp</dt><dd>{formatTimestamp(result.token_pair?.source_timestamp)}</dd></div>
        <div><dt>Liquidity context</dt><dd>{formatUsd(result.token_pair?.liquidity_usd)}</dd></div>
        <div><dt>Deployer context</dt><dd>{result.explorer?.deployer_address ?? 'Unavailable'}</dd></div>
        <div><dt>Contract verification</dt><dd>{result.explorer?.availability === 'unavailable' ? 'Provider unavailable' : result.explorer?.contract_verified === true ? 'Verified source' : result.explorer?.contract_verified === false ? 'Unverified' : 'Unavailable'}</dd></div>
        <div><dt>Risk classification</dt><dd>{formatLabel(risk)}</dd></div>
      </dl>
      <div className="rh-v2-result-actions">
        {rhChainTokenDossierRoute(result.resolved_context?.contract ?? result.contract) && <a href={rhChainTokenDossierRoute(result.resolved_context?.contract ?? result.contract)!}>Open evidence dossier</a>}
        {latestReceipt && <a href={`/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(latestReceipt.receipt_id)}`}>Latest receipt</a>}
        {result.token_pair?.dex_url && <a href={result.token_pair.dex_url}>Open pair source</a>}
        {result.explorer?.explorer_url && <a href={result.explorer.explorer_url}>Open explorer source</a>}
      </div>
      <p>{result.judgment_policy ?? result.disclaimer}</p>
    </section>}
  </div>;
}

function SectionHeading({ kicker, title, copy, action, titleId }: { kicker: string; title: string; copy: string; action?: React.ReactNode; titleId?: string }) {
  return <div className="rh-v2-section-heading"><div><p>{kicker}</p><h2 id={titleId}>{title}</h2><span>{copy}</span></div>{action}</div>;
}

function EvidenceStateBadge({ state }: { state: string }) {
  return <span className={`rh-v2-evidence-state state-${state.replaceAll(' ', '_')}`}>{formatLabel(state)}</span>;
}

function TodayOn4663({ cards }: { cards: ReturnType<typeof selectTodayOn4663> }) {
  return <section className="rh-v2-section rh-v2-today" aria-labelledby="rh-v2-today-title">
    <SectionHeading titleId="rh-v2-today-title" kicker="Daily pulse" title="Today on 4663" copy="Four decisions. One minute. Every claim keeps its evidence state." />
    <div className="rh-v2-today-grid">
      {cards.map((card) => <article key={card.id} className={`rh-v2-today-card card-${card.id}`}>
        <div><p>{card.title}</p><EvidenceStateBadge state={card.evidenceState} /></div>
        <h3>{card.verdict}</h3>
        <footer><span>{card.classification}</span><span>{formatTimestamp(card.observedAt)}</span><span>{card.sourceCount ? `${card.sourceCount} source` : 'Source required'}</span></footer>
        <a href={card.href}>Open {card.title}<span aria-hidden="true"> ↗</span></a>
      </article>)}
    </div>
  </section>;
}

function DailyReceiptFeature({ receipt }: { receipt: RhChainDailyReceipt }) {
  return <section id="latest-receipt" className="rh-v2-section rh-v2-receipt" aria-labelledby="rh-v2-receipt-title">
    <header className="rh-v2-receipt-head">
      <div><p>Daily Receipt {dailyReceiptNumber(receipt.receipt_id)}</p><span>{receipt.date} · {formatLabel(receipt.status)}</span></div>
      <RhChainShareMenu receipt={receipt} />
    </header>
    <div className="rh-v2-receipt-lede">
      <div><h2 id="rh-v2-receipt-title">{receipt.headline}</h2><p>The market forgets. 4663 remembers.</p></div>
      <EvidenceStateBadge state={receipt.freshness_state ?? receipt.data_mode} />
    </div>
    <div className="rh-v2-receipt-intelligence">
      {[
        ['Top signal', receipt.top_signal],
        ['Biggest risk', receipt.biggest_risk],
        ['Strongest narrative', receipt.strongest_narrative],
        ['Infopunks verdict', receipt.infopunks_verdict]
      ].map(([label, value]) => <article key={label}><span>{label}</span><p>{value}</p></article>)}
    </div>
    <div className="rh-v2-receipt-secondary">
      <p><span>Liquidity</span>{receipt.liquidity_note}</p>
      <p><span>Deployer watch</span>{receipt.deployer_watch_note}</p>
      <p><span>Stock-token spillover</span>{receipt.stock_token_spillover_note}</p>
      <p><span>Launch-surface context</span>{receipt.solana_base_migration_note}</p>
    </div>
    <footer className="rh-v2-receipt-foot">
      <span>Observed {formatTimestamp(receipt.observed_at ?? receipt.generated_at)}</span>
      <span>{receipt.sources.length} {receipt.sources.length === 1 ? 'source' : 'sources'}</span>
      <a href={`/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receipt.receipt_id)}`}>Read full receipt</a>
    </footer>
  </section>;
}

function RhChainShareMenu({ receipt }: { receipt: RhChainDailyReceipt }) {
  const [open, setOpen] = useState(false);
  const [relay, setRelay] = useState<RhChainReceiptRelayPayload | null>(null);
  const [relayLoading, setRelayLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `receipt-share-${receipt.receipt_id}`;

  useEffect(() => {
    if (!open) return;
    function closeOnPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || relay || relayLoading) return;
    setRelayLoading(true);
    fetchRhChain<RhChainReceiptRelayPayload>('/v1/rh-chain/receipt-relay')
      .then((response) => setRelay(response.data))
      .catch(() => setRelay(null))
      .finally(() => setRelayLoading(false));
  }, [open, relay, relayLoading]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  const permanentPath = `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receipt.receipt_id)}`;
  const permanentUrl = typeof window === 'undefined' ? permanentPath : new URL(permanentPath, window.location.origin).toString();
  const relayPackets = relay?.packets.filter((packet) => packet.title.toLowerCase().includes('daily receipt')) ?? [];
  const packet = (surface: RhChainReceiptRelayPacket['surface']) => relayPackets.find((item) => item.surface === surface) ?? null;
  const relayCopy = (item: RhChainReceiptRelayPacket) => `${item.long_copy}\n\n${item.risk_disclaimer}\n${new URL(item.artifact_url, window.location.origin)}`;
  return <div className="rh-v2-share" ref={rootRef}>
    <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}>Share Receipt <span aria-hidden="true">⌄</span></button>
    {open && <div id={menuId} className="rh-v2-share-popover" aria-label="Receipt sharing options">
      <button type="button" onClick={() => void copy(createRhChainDailyReceiptXPost(receipt), 'x')}>{copied === 'x' ? 'X post copied' : 'Copy X post'}</button>
      <a href={`${permanentPath}/card`}>Save or open share card</a>
      <button type="button" onClick={() => void copy(permanentUrl, 'url')}>{copied === 'url' ? 'Permanent URL copied' : 'Copy permanent URL'}</button>
      <a href="/rh-chain-signal-desk/distribution-pack">Open distribution pack</a>
      {(['telegram', 'discord'] as const).map((surface) => {
        const relayPacket = packet(surface);
        return <button key={surface} type="button" disabled={!relayPacket} onClick={() => relayPacket && void copy(relayCopy(relayPacket), surface)}>
          {copied === surface ? `${formatLabel(surface)} copy copied` : relayLoading ? `Loading ${formatLabel(surface)} copy…` : relayPacket ? `${formatLabel(surface)} copy` : `${formatLabel(surface)} copy unavailable`}
        </button>;
      })}
      <p aria-live="polite">{copied ? `${formatLabel(copied)} copied to clipboard.` : 'Sharing requires an explicit action.'}</p>
    </div>}
  </div>;
}

function MoversSection({ movers }: { movers: RhChain4663Asset[] }) {
  return <section className="rh-v2-section rh-v2-movers" aria-labelledby="rh-v2-movers-title">
    <SectionHeading titleId="rh-v2-movers-title" kicker="4663 movers" title="What is moving" copy="Ranked attention with the caveat still attached." action={<a href="/rh-chain-signal-desk/4663-index">View Full 4663 Index</a>} />
    <div className="rh-v2-mover-grid">
      {movers.length ? movers.map((asset) => <MoverCard key={`${asset.rank}-${asset.ticker}-${asset.token_contract}`} asset={asset} />) : <p className="rh-v2-empty">No ranked mover is available. Nothing has been inferred.</p>}
    </div>
  </section>;
}

function MoverCard({ asset }: { asset: RhChain4663Asset }) {
  const [copied, setCopied] = useState(false);
  const exactContract = isRhChainContractAddress(asset.token_contract);
  const href = exactContract ? `/rh-chain-signal-desk/tokens/${encodeURIComponent(asset.token_contract)}` : '/rh-chain-signal-desk/4663-index';
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }
  return <article className="rh-v2-mover-card">
    <header><span>{String(asset.rank).padStart(2, '0')}</span><EvidenceStateBadge state={asset.freshness_state ?? asset.source.data_mode} /></header>
    <div className="rh-v2-mover-identity"><div><h3>{asset.ticker}</h3><p>{asset.name}</p></div><div className="rh-v2-score" style={{ '--score': `${asset.signal_score}%` } as React.CSSProperties}><strong>{asset.signal_score}</strong><span>/ 100</span></div></div>
    <div className="rh-v2-score-line" aria-label={`Signal score ${asset.signal_score} out of 100`}><i style={{ width: `${asset.signal_score}%` }} /></div>
    <p className="rh-v2-classification">{formatLabel(asset.classification)}</p>
    <p className="rh-v2-mover-verdict">{asset.infopunks_verdict}</p>
    <p className="rh-v2-mover-risk"><span>Primary risk</span>{formatLabel(asset.risk_state)}</p>
    <footer><a href={href}>{exactContract ? 'Open dossier' : 'Open index record'}</a><button type="button" onClick={copyLink}>{copied ? 'Link copied' : 'Share'}</button></footer>
  </article>;
}

function RiskRadar({ risks }: { risks: FeaturedRiskSelection[] }) {
  return <section className="rh-v2-section rh-v2-risk-radar" aria-labelledby="rh-v2-risk-title">
    <SectionHeading titleId="rh-v2-risk-title" kicker="Risk radar" title="Where the story can break" copy="Identity, liquidity, and deployer evidence are reviewed as separate instruments." />
    <div className="rh-v2-risk-grid">
      {risks.map((risk) => <RiskInstrument key={risk.kind} risk={risk} />)}
    </div>
  </section>;
}

function RiskInstrument({ risk }: { risk: FeaturedRiskSelection }) {
  return <article className={`rh-v2-risk-instrument risk-${risk.kind} severity-${risk.severity}`}>
    <header><div><span>{risk.kind}</span><h3>{risk.title}</h3></div><strong>{riskPriority(risk.severity)}</strong></header>
    <div className="rh-v2-risk-count"><span>Active alerts</span><b>{risk.activeAlertCount}</b></div>
    <p>{risk.featured?.summary ?? 'No matching public warning is currently represented. Absence is not a safety signal.'}</p>
    <footer><span>{formatTimestamp(risk.observedAt)}</span><EvidenceStateBadge state={risk.evidenceState} /><a href="/rh-chain-signal-desk/clone-radar">Open Risk Radar</a></footer>
  </article>;
}

function MemePulseBrief({ items, allItems, mode }: { items: BriefMemeSelection[]; allItems: RhChainPayload['meme_pulse']; mode: RhChainDeskMode }) {
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'auto-observed' | 'risk'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const needle = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    const stateMatch = filter === 'all' || filter === item.observedState || (filter === 'risk' && ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.riskState));
    return stateMatch && (!needle || `${item.ticker} ${item.name} ${item.contract ?? ''} ${item.verdict}`.toLowerCase().includes(needle));
  });
  const tableMode = mode === 'analyst' || view === 'table';
  return <section className="rh-v2-section rh-v2-memes" aria-labelledby="rh-v2-meme-title">
    <SectionHeading titleId="rh-v2-meme-title" kicker="Meme pulse" title="Attention, with identity attached" copy="Compact dossiers first. Raw fields remain one deliberate step away." action={<a href="/rh-chain-signal-desk/meme-pulse">Open Meme Pulse</a>} />
    <div className="rh-v2-meme-controls">
      <div className="rh-v2-filter-group" role="group" aria-label="Filter Meme Pulse">
        {(['all', 'reviewed', 'auto-observed', 'risk'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{formatLabel(value)}</button>)}
      </div>
      <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker or contract" /></label>
      <div className="rh-v2-filter-group" role="group" aria-label="Meme Pulse presentation">
        <button type="button" aria-pressed={!tableMode} onClick={() => setView('cards')}>Cards</button>
        <button type="button" aria-pressed={tableMode} onClick={() => setView('table')}>Analyst Table</button>
      </div>
    </div>
    {tableMode ? <MemePulseAnalystTable items={mode === 'analyst' ? allItems.map((item) => ({
      ticker: item.ticker, name: item.name, contract: isRhChainContractAddress(item.contract) ? item.contract : null,
      verdict: item.infopunks_verdict, riskState: item.risk_state, observedState: 'auto-observed' as const,
      source: item.source, sourceAge: 'unknown' as const, signalScore: null
    })) : visible} /> : <div className="rh-v2-meme-grid">
      {visible.map((item) => <MemeDossierCard key={`${item.contract ?? item.ticker}-${item.observedState}`} item={item} />)}
      {!visible.length && <p className="rh-v2-empty">No dossier matches this view. No fallback token has been substituted.</p>}
    </div>}
  </section>;
}

function MemeDossierCard({ item }: { item: BriefMemeSelection }) {
  const [copied, setCopied] = useState(false);
  async function copyContract() {
    if (!item.contract) return;
    try { await navigator.clipboard.writeText(item.contract); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }
  const dossier = item.contract ? rhChainTokenDossierRoute(item.contract) : null;
  return <article className="rh-v2-meme-card">
    <header><div><span>{item.observedState}</span><h3>{item.ticker}</h3><p>{item.name}</p></div><EvidenceStateBadge state={item.riskState} /></header>
    <p className="rh-v2-meme-verdict">{item.verdict}</p>
    <div className="rh-v2-evidence-summary"><span>{item.sourceAge === 'source_required' ? 'Source required' : formatLabel(item.sourceAge)}</span><p>{item.sourceAge === 'source_required' ? 'No canonical market source attached.' : `Observed ${formatTimestamp(item.source.observed_at)}.`}</p></div>
    <footer>
      <button type="button" disabled={!item.contract} onClick={copyContract}>{copied ? 'Contract copied' : item.contract ? 'Copy contract' : 'Contract unavailable'}</button>
      {dossier ? <a href={dossier}>Open dossier</a> : <a href="/rh-chain-signal-desk/submit">Submit evidence</a>}
    </footer>
  </article>;
}

function MemePulseAnalystTable({ items }: { items: BriefMemeSelection[] }) {
  return <div className="rh-v2-table-wrap"><table className="rh-v2-table">
    <caption>RH Chain Meme Pulse analyst fields</caption>
    <thead><tr><th>Ticker</th><th>State</th><th>Contract</th><th>Risk</th><th>Signal</th><th>Source / observed</th><th>Verdict</th></tr></thead>
    <tbody>{items.map((item, index) => <tr key={`${item.contract ?? item.ticker}-${index}`}><th scope="row">{item.ticker}<small>{item.name}</small></th><td>{item.observedState}</td><td>{item.contract ?? 'source required'}</td><td>{formatLabel(item.riskState)}</td><td>{item.signalScore ?? 'unavailable'}</td><td>{item.source.source_name}<small>{formatTimestamp(item.source.observed_at)}</small></td><td>{item.verdict}</td></tr>)}</tbody>
  </table></div>;
}

function LaunchRouteFlow({ route }: { route: ReturnType<typeof selectLaunchRoute> }) {
  return <section className="rh-v2-section rh-v2-routes" aria-labelledby="rh-v2-routes-title">
    <SectionHeading titleId="rh-v2-routes-title" kicker="Launch and access routes" title="Remember the route" copy="Edges appear only where exact reviewed evidence supports them." action={<a href="/rh-chain-signal-desk/launch-surfaces">Open Launch Surface Watch</a>} />
    <div className="rh-v2-route-flow">
      <article><span>Launch surface</span><strong>{route.launchSurface?.name ?? 'Source required'}</strong><p>{route.launchSurface?.source_type ? formatLabel(route.launchSurface.source_type) : 'No exact reviewed origin attached.'}</p></article>
      <i aria-hidden="true">↓</i>
      <article><span>Liquidity route</span><strong>{route.liquidityRoute ?? 'Route incomplete'}</strong><p>{route.liquidityRoute ? 'Exact reviewed route context.' : 'No route edge has been inferred.'}</p></article>
      <i aria-hidden="true">↓</i>
      <article><span>Access surface</span><strong>{route.accessSurface?.access_surface_name ?? 'Source required'}</strong><p>{route.routeComplete ? 'Exact access edge reviewed.' : 'Access surface is known, but its edge to this route is source required.'}</p></article>
      <i aria-hidden="true">↓</i>
      <article className="rh-v2-route-state"><span>Review state</span><strong>{formatLabel(route.reviewState)}</strong><p>{route.routeComplete ? 'Route complete' : 'Route incomplete'}</p></article>
    </div>
    <footer className="rh-v2-route-foot"><span>Main risk</span><p>{route.mainRisk}</p><time>{formatTimestamp(route.observedAt)}</time></footer>
  </section>;
}

function ReviewQueueBrief({ selections }: { selections: ReturnType<typeof selectFeaturedReviewItems> }) {
  return <section className="rh-v2-section rh-v2-review" aria-labelledby="rh-v2-review-title">
    <SectionHeading titleId="rh-v2-review-title" kicker="Review queue" title="What still needs a receipt" copy="Three public review moments; long reviewer notes stay in the evidence layer." action={<a href="/rh-chain-signal-desk/review-queue">View Review Queue</a>} />
    <div className="rh-v2-review-grid">
      {selections.map(({ role, item, evidenceCompleteness }) => <article key={item.review_id}>
        <header><span>{role}</span><EvidenceStateBadge state={item.review_state} /></header>
        <h3>{item.ticker}</h3>
        <dl><div><dt>Evidence</dt><dd>{evidenceCompleteness}</dd></div><div><dt>Missing</dt><dd>{item.missing_evidence.length}</dd></div><div><dt>Risk</dt><dd>{formatLabel(item.risk_state)}</dd></div></dl>
        <p>{item.next_step}</p>
        <footer><span>{formatTimestamp(item.updated_at)}</span><a href="/rh-chain-signal-desk/review-queue">Open review</a></footer>
      </article>)}
      {!selections.length && <p className="rh-v2-empty">No public review item is available.</p>}
    </div>
  </section>;
}

function ChainPulseBrief({ metrics, desk }: { metrics: ReturnType<typeof selectChainPulseSummary>; desk: RhChainPayload }) {
  const protocol = desk.chain_pulse.top_protocols[0] ?? null;
  const bridge = desk.chain_pulse.bridge_notes[0] ?? 'Bridge context is unavailable.';
  return <section className="rh-v2-section rh-v2-chain-pulse" aria-labelledby="rh-v2-chain-title">
    <SectionHeading titleId="rh-v2-chain-title" kicker="Chain pulse" title="Market context, after judgment" copy="Provider context can describe the weather. It cannot rewrite the receipt." action={<a href="/rh-chain-signal-desk/live-snapshot">Open Live Snapshot</a>} />
    <div className="rh-v2-chain-grid">
      {metrics.map((metric) => <article key={metric.id} className={`state-${metric.displayState.replaceAll(' ', '_')}`}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.displayState}</p></article>)}
    </div>
    <div className="rh-v2-protocol-strip"><div><span>Protocol context</span><strong>{protocol?.name ?? 'Unavailable'}</strong><p>{protocol?.display_note ?? 'No protocol context attached.'}</p></div><div><span>Bridge-risk insight</span><p>{bridge}</p></div><time>Observed {formatTimestamp(desk.chain_pulse.observed_at ?? desk.last_updated)}</time></div>
  </section>;
}

function RhChainAnalystPanel({ desk, index, queue, receipts, memePulse, liveSnapshot }: {
  desk: RhChainPayload;
  index: RhChain4663IndexPayload | null;
  queue: RhChainReviewQueuePayload | null;
  receipts: RhChainDailyReceiptsPayload | null;
  memePulse: RhChainMemePulsePayload | null;
  liveSnapshot: RhChainLiveSnapshot | null;
}) {
  return <section className="rh-v2-section rh-v2-analyst" aria-labelledby="rh-v2-analyst-title">
    <SectionHeading titleId="rh-v2-analyst-title" kicker="Analyst mode" title="Evidence machinery" copy="Scoring, provenance, review notes and technical caveats remain fully reachable." />
    <div className="rh-v2-analyst-stack">
      {index && <details open><summary>Full ranked 4663 index</summary><AnalystIndexTable assets={index.assets} /><div className="rh-v2-scoring-model">{Object.entries(index.scoring_model).map(([key, value]) => <p key={key}><span>{formatLabel(key)}</span><strong>{value}</strong></p>)}</div><p>{index.source_policy}</p></details>}
      <details><summary>Complete Meme Pulse provenance</summary><p>{memePulse?.disclaimer ?? 'Provider Meme Pulse context is unavailable.'}</p><div className="rh-v2-source-list">{(memePulse?.top_attention_assets ?? []).map((asset, indexValue) => <SourceDisclosure key={`${asset.contract ?? asset.ticker}-${indexValue}`} label={`${asset.ticker} · ${asset.context_origin ?? 'context'}`} source={asset.source} />)}</div></details>
      <details><summary>Full review notes</summary><div className="rh-v2-analyst-review">{(queue?.items ?? []).map((item) => <AnalystReviewItem key={item.review_id} item={item} />)}{!queue?.items.length && <p>No public review notes are available.</p>}</div></details>
      <details><summary>Protocol and provider context</summary><div className="rh-v2-analyst-protocols">{desk.chain_pulse.top_protocols.map((protocol) => <article key={protocol.name}><h3>{protocol.name}</h3><p>{protocol.display_note}</p><p>{protocol.note}</p><SourceDisclosure label={protocol.category} source={protocol.source} /></article>)}</div><p>Live snapshot providers: {liveSnapshot?.provider_statuses.map((provider) => `${provider.provider_name} · ${provider.status}`).join(' / ') ?? 'unavailable'}.</p></details>
      <details><summary>Receipt sources and caveats</summary><div className="rh-v2-source-list">{(receipts?.latest_receipt.sources ?? []).map((source) => <SourceDisclosure key={`${source.source_name}-${source.observed_at}`} label={source.source_name} source={source} />)}</div><p>{receipts?.source_policy ?? 'Daily receipt source policy unavailable.'}</p></details>
      <details><summary>Desk classifier and raw risk evidence</summary><div className="rh-v2-analyst-protocols">{desk.signal_classifier.map((item) => <article key={item.label}><h3>{formatLabel(item.label)}</h3><p>{item.meaning}</p><p><b>Trigger:</b> {item.trigger}</p><p><b>Desk action:</b> {item.desk_action}</p><SourceDisclosure label={item.label} source={item.source} /></article>)}</div></details>
    </div>
  </section>;
}

function AnalystIndexTable({ assets }: { assets: RhChain4663Asset[] }) {
  return <div className="rh-v2-table-wrap"><table className="rh-v2-table"><caption>Full 4663 ranked index and scoring fields</caption><thead><tr><th>Rank</th><th>Asset</th><th>Score</th><th>Attention</th><th>Volume</th><th>Holders</th><th>Durability</th><th>Deployer</th><th>Risk</th><th>Updated</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.token_contract}><td>{asset.rank}</td><th scope="row">{asset.ticker}<small>{asset.name}</small></th><td>{asset.signal_score}</td><td>{asset.attention_score}/25</td><td>{asset.volume_score}/25</td><td>{asset.holder_score}/20</td><td>{asset.durability_score}/20</td><td>{asset.deployer_trust_score}/10</td><td>{formatLabel(asset.risk_state)}</td><td>{formatTimestamp(asset.last_updated)}</td></tr>)}</tbody></table></div>;
}

function AnalystReviewItem({ item }: { item: RhChainReviewItem }) {
  return <article><header><h3>{item.ticker}</h3><EvidenceStateBadge state={item.review_state} /></header><p>{item.evidence_summary}</p><p><b>Reviewer note:</b> {item.reviewer_note}</p><p><b>Missing evidence:</b> {item.missing_evidence.join(' · ') || 'None represented'}</p><p><b>Next step:</b> {item.next_step}</p><SourceDisclosure label={item.review_id} source={item.source} /></article>;
}

function SourceDisclosure({ label, source }: { label: string; source: RhChainSource }) {
  return <details className="rh-v2-source-disclosure"><summary>{label} · {formatLabel(source.data_mode)}</summary><dl><div><dt>Source</dt><dd>{source.source_url ? <a href={source.source_url}>{source.source_name}</a> : source.source_name}</dd></div><div><dt>Observed</dt><dd>{formatTimestamp(source.observed_at)}</dd></div><div><dt>Updated</dt><dd>{formatTimestamp(source.updated_at)}</dd></div><div><dt>Confidence</dt><dd>{source.confidence_level}</dd></div></dl><p>{source.caveat ?? source.note ?? 'No additional source note.'}</p></details>;
}

function RhChainMethodologyFooter({ envelope, analyst }: { envelope: RhChainEnvelope<unknown> | null; analyst: boolean }) {
  return <section className="rh-v2-methodology" aria-labelledby="rh-v2-method-title">
    <div><p>Methodology</p><h2 id="rh-v2-method-title">How to use this desk</h2><span>Check a contract. Read the receipt. Review the sources. Submit missing evidence.</span></div>
    <div className="rh-v2-principles">
      <p><span>01</span>External data gives context</p>
      <p><span>02</span>Exact contracts establish identity</p>
      <p><span>03</span>Receipts preserve reviewed judgment</p>
      <p><span>04</span>Unknown data remains unknown</p>
    </div>
    <nav aria-label="RH Chain methodology links"><a href="/methodology">Methodology</a><a href="/rh-chain-signal-desk/daily-receipts">Source policy</a><a href="/rh-chain-signal-desk/distribution-pack">Distribution pack</a><a href="/v1/rh-chain">API</a></nav>
    {analyst && envelope && <details><summary>Technical source policy</summary><p>{envelope.meta.source_policy}</p><p>Data mode: {formatLabel(envelope.data_mode)} · {envelope.sources.length} sources · generated {formatTimestamp(envelope.generated_at)}.</p></details>}
    <footer><span>The market forgets. 4663 remembers.</span><p>Independent public intelligence. Not affiliated with Robinhood. No buy or sell recommendation.</p></footer>
  </section>;
}
