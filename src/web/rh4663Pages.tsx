import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { Rh4663CallReceipt, Rh4663RotationOption, Rh4663Signal, Rh4663SignalCategory, Rh4663TodayEdition } from '../services/rh4663Service';
import type { Rh4663MerkleProof, Rh4663ResolutionReceipt } from '../services/rh4663ResolutionService';
import type { Published4663Signal } from '../services/rh4663IntelligenceService';
import './rh4663.css';

const API_BASE_URL = getApiBaseUrl();
const NAV = [
  { href: '/4663', label: '4663' },
  { href: '/4663/pulse', label: 'Pulse' },
  { href: '/4663/today', label: 'Today' },
  { href: '/4663/signals', label: 'Signals' },
  { href: '/4663/receipts', label: 'Receipts' }
] as const;
const ROTATIONS: Array<{ value: Rh4663RotationOption; label: string }> = [
  { value: 'MEMES', label: 'Memes' }, { value: 'STOCK_TOKENS', label: 'Stock Tokens' }, { value: 'RWA_DEFI', label: 'RWA / DeFi' }, { value: 'STABLES', label: 'Stables' }, { value: 'NO_QUALIFIED_ROTATION', label: 'No Qualified Rotation' }
];
const SIGNAL_CATEGORIES: Rh4663SignalCategory[] = ['meme', 'nft_culture', 'utility', 'agent', 'stock_token', 'defi', 'wallet', 'liquidity', 'risk', 'integration', 'other'];

type Overview = {
  identity: string;
  thesis: string;
  rotation_snapshot: { top_signal: { ticker: string; name: string; signal_score: number }; highest_volume: { ticker: string }; highest_risk: { ticker: string }; last_updated: string; source_status: string };
  pulse: PulseData;
  today: Rh4663TodayEdition;
  signal_hunt: { count: number; signals: Rh4663Signal[] };
  live_signals?: { count: number; signals: Published4663Signal[] };
  genesis: GenesisData;
};
type PulseData = { window: { window_id: string; opens_at: string; closes_at: string }; consensus: { total_calls: number; leading_rotation: Rh4663RotationOption | null; confidence_average: number | null; state: string; counts?: Record<Rh4663RotationOption, number>; percentages?: Record<Rh4663RotationOption, number> }; options: Rh4663RotationOption[] };
type GenesisData = { limit: number; recorded: number; remaining: number; progress: number; policy: string };
type ReputationEvidence = { window_id: string; call_receipt_id: string; resolution_receipt_id: string | null; called_category: Rh4663RotationOption; resolved_category: Rh4663RotationOption | null; outcome: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED'; confidence: number; genesis_ordinal: number | null };
type Reputation = { wallet: string; calls: number; resolved_calls: number; correct_calls: number; accuracy: number | null; current_streak: number; genesis_position: number | null; evidence: ReputationEvidence[] };
type TodayPulse = { current: PulseData['consensus']; prior: { consensus: PulseData['consensus']; resolution: { window_id: string; resolved_category: Rh4663RotationOption; consensus_correct: boolean; resolution_path: string } | null }; precision_notice: string | null };

function useApi<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; status: 'loading' | 'ready' | 'degraded'; message?: string }>({ data: null, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 4_000);
    fetch(toApiUrl(API_BASE_URL, path), { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<{ data: T }>; })
      .then((body) => setState({ data: body.data, status: 'ready' }))
      .catch(() => setState({ data: null, status: 'degraded', message: 'Persisted intelligence is temporarily unavailable.' }))
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [path]);
  return state;
}

function useOptionalApi<T>(path: string | null, refresh = 0) {
  const [state, setState] = useState<{ data: T | null; status: 'idle' | 'loading' | 'ready' | 'degraded' }>({ data: null, status: 'idle' });
  useEffect(() => {
    if (!path) { setState({ data: null, status: 'idle' }); return; }
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 4_000); setState((prior) => ({ ...prior, status: 'loading' }));
    fetch(toApiUrl(API_BASE_URL, path), { signal: controller.signal, headers: { accept: 'application/json' } }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: T }>; }).then((body) => setState({ data: body.data, status: 'ready' })).catch(() => setState({ data: null, status: 'degraded' })).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [path, refresh]); return state;
}

export function Rh4663Page() {
  const path = window.location.pathname.replace(/\/$/, '') || '/4663';
  const proofId = path.match(/^\/4663\/proof\/([^/]+)$/)?.[1];
  const signalId = path.match(/^\/4663\/signals\/([^/]+)$/)?.[1];
  const view = proofId ? 'proof' : signalId ? 'signal_detail' : path === '/4663/pulse' ? 'pulse' : path === '/4663/today' ? 'today' : path === '/4663/signals' ? 'signals' : path === '/4663/receipts' ? 'receipts' : 'home';
  return <div className="i4663-app">
    <header className="i4663-header">
      <a className="i4663-wordmark" href="/4663" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>//4663</b></a>
      <a className="i4663-radar-link" href="/rh-chain-signal-desk">RH DESK ↗</a>
    </header>
    <nav className="i4663-nav" aria-label="4663 navigation">{NAV.map((item) => <a key={item.href} href={item.href} aria-current={(path || '/4663') === item.href ? 'page' : undefined}>{item.label}</a>)}</nav>
    {view === 'home' ? <Home /> : view === 'pulse' ? <Pulse /> : view === 'today' ? <Today /> : view === 'signals' ? <Signals /> : view === 'signal_detail' && signalId ? <SignalProofPage signalId={decodeURIComponent(signalId)} /> : view === 'proof' && proofId ? <ProofPage receiptId={decodeURIComponent(proofId)} /> : <Receipts />}
    <footer className="i4663-footer"><span>AFTER ATTENTION, INTELLIGENCE.</span><span>UTC / RH CHAIN / PUBLIC MEMORY</span></footer>
  </div>;
}

function Home() {
  const { data, status, message } = useApi<Overview>('/v1/4663');
  return <main className="i4663-main i4663-home">
    <section className="i4663-hero" aria-labelledby="i4663-title">
      <p className="i4663-kicker">INFOPUNKS // 4663</p>
      <h1 id="i4663-title">WE WATCH<br />THE FLOW.</h1>
      <p>Signal extraction for the Robinhood Chain economy.</p>
    </section>
    <DataState status={status} message={message} />
    <section className="i4663-rotation" aria-labelledby="rotation-title">
      <SectionNumber n="01" label="Current chain rotation" />
      <div className="i4663-rotation-line">
        <div><p className="i4663-micro">LEADING SIGNAL</p><h2 id="rotation-title">{data?.rotation_snapshot.top_signal.ticker ?? 'AWAITING MEMORY'}</h2></div>
        <strong>{data ? pad(data.rotation_snapshot.top_signal.signal_score) : '--'}<small>/100</small></strong>
      </div>
      <div className="i4663-tape"><span>VOLUME / {data?.rotation_snapshot.highest_volume.ticker ?? '—'}</span><span>RISK / {data?.rotation_snapshot.highest_risk.ticker ?? '—'}</span><span>{data?.rotation_snapshot.source_status.toUpperCase() ?? 'CONNECTING'}</span></div>
    </section>
    <section className="i4663-call-block">
      <SectionNumber n="02" label="RH Pulse" />
      <p>One wallet. One UTC window. One immutable call.</p>
      <a className="i4663-primary-action" href="/4663/pulse">CALL THE ROTATION <span>↗</span></a>
      <p className="i4663-machine">WINDOW / {data?.pulse.window.window_id ?? 'UTC DAILY'} · {data?.pulse.consensus.total_calls ?? 0} CALLS</p>
    </section>
    <section className="i4663-split">
      <a href="/4663/today" className="i4663-home-link"><SectionNumber n="03" label="Today on 4663" /><strong>{compactSignal(data?.today.key_signal) ?? 'Open the daily intelligence edition.'}</strong><span>READ EDITION →</span></a>
      <a href="/4663/signals" className="i4663-home-link"><SectionNumber n="04" label="Signal Hunt" /><strong>See the move before it becomes consensus.</strong><span>{data?.signal_hunt.count ?? 0} ACTIVE / SUBMIT →</span></a>
    </section>
    <section className="i4663-live-signals" aria-labelledby="live-signals-title">
      <SectionNumber n="05" label="Live signals" />
      <div className="i4663-live-signals-head"><h2 id="live-signals-title">THE CHAIN, STRUCTURED.</h2><a href="/4663/signals">VIEW ALL SIGNALS →</a></div>
      {data?.live_signals?.signals.length ? data.live_signals.signals.map((signal) => <PublishedSignalCard key={signal.signal_id} signal={signal} compact />) : <Empty text="Automated publication is gated. No Signal has been inferred." />}
    </section>
    <section className="i4663-genesis">
      <SectionNumber n="06" label="Genesis provenance" />
      <div className="i4663-progress-copy"><strong>{data?.genesis.recorded ?? 0}<small> / 4,663</small></strong><span>{data?.genesis.remaining ?? 4663} IDENTITIES REMAIN</span></div>
      <div className="i4663-progress" role="progressbar" aria-valuemin={0} aria-valuemax={4663} aria-valuenow={data?.genesis.recorded ?? 0}><i style={{ width: `${Math.min(100, (data?.genesis.progress ?? 0) * 100)}%` }} /></div>
      <p>Provenance, not a reward promise. Genesis records early verified participation.</p>
    </section>
  </main>;
}

function Pulse() {
  const api = useApi<PulseData>('/v1/4663/pulse');
  const [wallet, setWallet] = useState<string | null>(null); const [reputationRefresh, setReputationRefresh] = useState(0);
  const reputation = useOptionalApi<Reputation>(wallet ? `/v1/4663/pulse/reputation/${encodeURIComponent(wallet)}` : null, reputationRefresh);
  const [rotation, setRotation] = useState<Rh4663RotationOption>('MEMES'); const [confidence, setConfidence] = useState(70); const [digest, setDigest] = useState('');
  const [result, setResult] = useState<{ state: 'idle' | 'working' | 'success' | 'error'; message?: string; receipt?: Rh4663CallReceipt }>({ state: 'idle' });
  useEffect(() => { const ethereum = (window as Window & { ethereum?: { request(args: { method: string }): Promise<unknown> } }).ethereum; if (!ethereum) return; void ethereum.request({ method: 'eth_accounts' }).then((accounts) => { const walletAddress = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null; setWallet(walletAddress); }).catch(() => undefined); }, []);
  async function makeCall() {
    setResult({ state: 'working', message: 'Requesting wallet signature…' });
    try {
      const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error('No EVM wallet found. Open 4663 in a wallet-enabled browser.');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]; const connectedWallet = accounts[0]; if (!connectedWallet) throw new Error('Wallet access was not granted.'); setWallet(connectedWallet);
      const payloadResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/payload'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id }) });
      const payloadBody = await payloadResponse.json() as { data?: { canonical_serialization: string }; error?: string }; if (!payloadResponse.ok || !payloadBody.data) throw new Error(readableError(payloadBody.error));
      const signature = await ethereum.request({ method: 'personal_sign', params: [payloadBody.data.canonical_serialization, connectedWallet] });
      const callResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/calls'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id, signature }) });
      const callBody = await callResponse.json() as { data?: Rh4663CallReceipt; error?: string }; if (!callResponse.ok || !callBody.data) throw new Error(readableError(callBody.error));
      setResult({ state: 'success', message: 'Call recorded. The receipt will not change.', receipt: callBody.data }); setReputationRefresh((value) => value + 1);
    } catch (error) { setResult({ state: 'error', message: error instanceof Error ? error.message : 'Call could not be recorded.' }); }
  }
  return <main className="i4663-main i4663-subpage">
    <PageHead index="01" title="RH PULSE" lede="CALL THE ROTATION." />
    <DataState status={api.status} message={api.message} />
    {reputation.data && <PulseMemory reputation={reputation.data} currentWindowId={api.data?.window.window_id} />}
    <div className="i4663-window"><span>WINDOW</span><strong>{api.data?.window.window_id ?? 'UTC DAILY'}</strong><time>{api.data ? `${machineTime(api.data.window.opens_at)} → ${machineTime(api.data.window.closes_at)}` : 'FIXED UTC BOUNDARY'}</time></div>
    <section className="i4663-pulse-grid" aria-label="Rotation options">{ROTATIONS.map((item) => <button type="button" key={item.value} aria-pressed={rotation === item.value} onClick={() => setRotation(item.value)}><i />{item.label}</button>)}</section>
    <label className="i4663-range"><span>CONFIDENCE <b>{confidence}</b></span><input aria-label="Confidence" type="range" min="1" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
    <label className="i4663-field"><span>EVIDENCE DIGEST <i>OPTIONAL / 32-BYTE HEX</i></span><input value={digest} onChange={(event) => setDigest(event.target.value)} placeholder="0x…" pattern="0x[0-9a-fA-F]{64}" /></label>
    <button className="i4663-primary-action i4663-button" type="button" onClick={makeCall} disabled={result.state === 'working'}>{result.state === 'working' ? 'SIGNING…' : 'SIGN + RECORD CALL'} <span>↗</span></button>
    {result.message && <div className={`i4663-result is-${result.state}`} role="status"><strong>{result.message}</strong>{result.receipt && <><code>{result.receipt.receipt_id}</code><code>{shortHash(result.receipt.payload_hash)}</code><a href={`/v1/4663/receipts/${result.receipt.receipt_id}`}>OPEN PROTOCOL RECEIPT →</a></>}</div>}
    <section className="i4663-consensus"><p className="i4663-micro">CURRENT CONSENSUS</p><strong>{labelRotation(api.data?.consensus.leading_rotation) || 'NO CALLS YET'}</strong><div><span>{api.data?.consensus.total_calls ?? 0} CALLS</span><span>{api.data?.consensus.confidence_average ?? '—'} AVG CONFIDENCE</span></div></section>
    <p className="i4663-protocol-note">Signed Call Mechanics v1. Calls are unique per eligible wallet per fixed UTC window. Existing CALL RECEIPTS are immutable. <a href="/openapi.json">Protocol contract ↗</a></p>
  </main>;
}

function PulseMemory({ reputation, currentWindowId }: { reputation: Reputation; currentWindowId?: string }) {
  const current = reputation.evidence.find((item) => item.window_id === currentWindowId); const latestResolved = reputation.evidence.find((item) => item.outcome !== 'UNRESOLVED');
  return <section className="i4663-memory" aria-label="Your Pulse history">
    {current?.outcome === 'UNRESOLVED' && <article className="i4663-current-call"><p className="i4663-micro">YOUR CALL</p><h2>{labelRotation(current.called_category)}</h2><strong>{current.confidence}%</strong><div><span>STATUS</span><b>OBSERVATION WINDOW</b></div><code>{current.call_receipt_id}</code><a href={`/4663/proof/${encodeURIComponent(current.call_receipt_id)}`}>VIEW RECEIPT →</a></article>}
    {latestResolved && <ResolvedResult result={latestResolved} reputation={reputation} />}
  </section>;
}

function ResolvedResult({ result, reputation }: { result: ReputationEvidence; reputation: Reputation }) {
  const [shared, setShared] = useState(false); const proofPath = `/4663/proof/${encodeURIComponent(result.call_receipt_id)}`;
  async function share() { const url = new URL(proofPath, window.location.origin).toString(); const text = result.outcome === 'CORRECT' ? `Called it: ${labelRotation(result.called_category)} on Pulse //4663.` : `My Pulse //4663 call resolved: ${labelRotation(result.called_category)} → ${labelRotation(result.resolved_category)}.`; try { if (navigator.share) await navigator.share({ title: 'Pulse //4663', text, url }); else await navigator.clipboard.writeText(`${text} ${url}`); setShared(true); } catch { /* A cancelled native share leaves the result unchanged. */ } }
  return <article className={`i4663-resolved is-${result.outcome.toLowerCase()}`}><p className="i4663-micro">RESOLVED</p><div className="i4663-call-actual"><span><small>YOUR CALL</small><b>{labelRotation(result.called_category)}</b></span><i>→</i><span><small>ACTUAL</small><b>{labelRotation(result.resolved_category)}</b></span></div><h2>{result.outcome === 'CORRECT' ? 'CORRECT ✓' : 'MISSED'}</h2><section className="i4663-record"><div><small>YOUR RECORD</small><strong>{reputation.correct_calls} / {reputation.resolved_calls}</strong><span>{reputation.accuracy === null ? '—' : `${(reputation.accuracy * 100).toFixed(1)}%`}</span></div><div><small>CURRENT STREAK</small><strong>{reputation.current_streak}</strong></div>{reputation.genesis_position && <div><small>GENESIS</small><strong>#{String(reputation.genesis_position).padStart(4, '0')}</strong></div>}</section><button className="i4663-primary-action" type="button" onClick={share}>{shared ? 'LINK COPIED' : 'SHARE RESULT'} <span>↗</span></button><a className="i4663-secondary-action" href={proofPath}>INSPECT PROOF</a><a className="i4663-next-call" href="/4663/pulse">CALL TODAY <span>→</span></a></article>;
}

function Today() {
  const api = useApi<Rh4663TodayEdition & { rh_pulse?: TodayPulse | null }>('/v1/4663/today'); const edition = api.data;
  return <main className="i4663-main i4663-subpage">
    <PageHead index="02" title="TODAY ON 4663" lede={edition?.date ?? 'DAILY INTELLIGENCE'} />
    <DataState status={api.status} message={api.message} />
    {edition && <>
      <div className={`i4663-provider-state is-${edition.provider_state}`}><span>SOURCE STATE</span><strong>{edition.provider_state.toUpperCase()}</strong><time>{machineTime(edition.generated_at)}</time></div>
      <section className="i4663-key-signal"><p className="i4663-micro">KEY SIGNAL / CONFIDENCE {edition.confidence}</p><h2>{edition.key_signal}</h2><p>{edition.data_notice}</p></section>
      <section className="i4663-flow-list"><h2>CATEGORY FLOW</h2>{edition.category_flows.length ? edition.category_flows.map((flow) => <article key={`${flow.category}:${flow.summary}`}><span>{flow.category.replaceAll('_', ' ').toUpperCase()}</span><strong>{flow.summary}</strong><b>{flow.confidence}</b></article>) : <Empty text="Category flow unavailable. No live data has been inferred." />}</section>
      <section className="i4663-event-list"><h2>TOP EVENTS</h2>{edition.top_events.length ? edition.top_events.map((event) => <article key={event.event_id}><div><span>{event.category.toUpperCase()}</span><time>{machineTime(event.detected_at)}</time></div><strong>{event.title}</strong><p>{event.source_status.toUpperCase()} / SIGNIFICANCE {event.significance_score}</p></article>) : <Empty text="No normalized public events were recorded for this edition." />}</section>
      {edition.rh_pulse && <TodayPulseBlock pulse={edition.rh_pulse} />}
      <section className="i4663-evidence"><h2>EVIDENCE REFERENCES</h2>{edition.evidence_references.map((reference) => <a key={reference.reference_id} href={reference.href}><span>{reference.reference_type.replaceAll('_', ' ').toUpperCase()}</span><strong>{reference.label}</strong><code>{reference.source_status.toUpperCase()} · {machineTime(reference.observed_at)}</code></a>)}</section>
      <a className="i4663-text-link" href="/v1/4663/today/archive">OPEN EDITION ARCHIVE →</a>
    </>}
  </main>;
}

function TodayPulseBlock({ pulse }: { pulse: TodayPulse }) { const options = ROTATIONS.map((item) => item.value); return <section className="i4663-today-pulse"><p className="i4663-micro">RH PULSE</p><h2>{pulse.current.total_calls.toLocaleString()} CALLS</h2><div>{options.map((option) => <p key={option}><span>{labelRotation(option)}</span><b>{pulse.current.counts?.[option] ?? 0}</b><strong>{pulse.current.percentages?.[option] ?? 0}%</strong></p>)}</div><small>{pulse.precision_notice}</small><article><span>CONSENSUS</span><strong>{labelRotation(pulse.current.leading_rotation) || 'NO CALLS YET'}</strong></article>{pulse.prior.resolution && <article><span>YESTERDAY / PULSE CALLED</span><strong>{labelRotation(pulse.prior.consensus.leading_rotation) || 'NO CONSENSUS'}</strong><span>ACTUAL</span><strong>{labelRotation(pulse.prior.resolution.resolved_category)} {pulse.prior.resolution.consensus_correct ? '✓' : ''}</strong><a href={pulse.prior.resolution.resolution_path}>OPEN RESOLUTION →</a></article>}</section>; }

function ProofPage({ receiptId }: { receiptId: string }) {
  const call = useApi<Rh4663CallReceipt | Rh4663ResolutionReceipt>(`/v1/4663/receipts/${encodeURIComponent(receiptId)}`); const proof = useOptionalApi<Rh4663MerkleProof>(`/v1/4663/pulse/receipts/${encodeURIComponent(receiptId)}/proof`);
  return <main className="i4663-main i4663-subpage"><PageHead index="05" title="PROOF" lede="CANONICAL PUBLIC MEMORY." /><DataState status={call.status} message={call.message} />{call.data && <section className="i4663-proof"><p className="i4663-micro">{call.data.protocol_receipt_type} RECEIPT</p><h2>{call.data.receipt_id}</h2><dl><div><dt>IMMUTABLE</dt><dd>TRUE</dd></div><div><dt>WINDOW</dt><dd>{call.data.window_id}</dd></div><div><dt>PAYLOAD HASH</dt><dd>{call.data.payload_hash}</dd></div>{call.data.protocol_receipt_type === 'CALL' && <><div><dt>CALLED</dt><dd>{labelRotation(call.data.rotation)}</dd></div><div><dt>SIGNATURE</dt><dd>VERIFIED</dd></div></>}{call.data.protocol_receipt_type === 'RESOLUTION' && <><div><dt>ACTUAL</dt><dd>{labelRotation(call.data.resolved_category)}</dd></div><div><dt>RESULT</dt><dd>{call.data.outcome}</dd></div><div><dt>CALL RECEIPT</dt><dd><a href={`/4663/proof/${encodeURIComponent(call.data.call_receipt_id)}`}>{call.data.call_receipt_id}</a></dd></div></>}</dl>{proof.data && <div className="i4663-merkle"><span>WINDOW ACCEPTANCE</span><strong>{proof.data.verified ? 'INCLUSION VERIFIED ✓' : 'PROOF INVALID'}</strong><code>{proof.data.acceptance_root}</code><small>ANCHOR / {proof.data.anchor.state.toUpperCase()}</small></div>}<a className="i4663-next-call" href="/4663/pulse">CALL TODAY <span>→</span></a></section>}</main>;
}

function Signals() {
  const api = useApi<{ signals: Array<Published4663Signal | Rh4663Signal>; watching?: Rh4663Signal[]; signal_hunt?: Rh4663Signal[] }>('/v1/4663/signals'); const [open, setOpen] = useState(false); const [submitted, setSubmitted] = useState<Rh4663Signal | null>(null); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries()); if (!payload.evidence_note) delete payload.evidence_note;
    try { const response = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/signals'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json() as { data?: Rh4663Signal; error?: string }; if (!response.ok || !body.data) throw new Error(readableError(body.error)); setSubmitted(body.data); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Signal could not be submitted.'); }
  }
  const published = useMemo(() => (api.data?.signals ?? []).filter(isPublishedSignal), [api.data]);
  const legacyCommunity = useMemo(() => (api.data?.signals ?? []).filter((signal): signal is Rh4663Signal => !isPublishedSignal(signal)), [api.data]);
  const watching = useMemo(() => submitted ? [submitted, ...(api.data?.watching ?? api.data?.signal_hunt ?? legacyCommunity).filter((item) => item.signal_id !== submitted.signal_id)] : api.data?.watching ?? api.data?.signal_hunt ?? legacyCommunity, [api.data, legacyCommunity, submitted]);
  return <main className="i4663-main i4663-subpage">
    <PageHead index="03" title="SIGNALS // 4663" lede="EVIDENCE, THEN CLAIM." />
    <section className="i4663-signal-surface"><div className="i4663-surface-title"><span>LIVE</span><p>{published.length} PUBLISHED</p></div>{published.length ? published.slice(0, 6).map((signal) => <PublishedSignalCard key={signal.signal_id} signal={signal} />) : <Empty text="Automated publication remains gated. Persisted watches continue below." />}</section>
    <section className="i4663-signal-surface"><div className="i4663-surface-title"><span>WATCHING</span><p>PUBLIC-SAFE / UNPUBLISHED</p></div><section className="i4663-signal-list">{watching.length ? watching.map((signal) => <CommunitySignalCard key={signal.signal_id} signal={signal} />) : <Empty text="No public watch items are active." />}</section></section>
    <section className="i4663-signal-surface"><div className="i4663-surface-title"><span>ARCHIVE</span><p>IMMUTABLE PUBLIC MEMORY</p></div>{published.length > 6 ? published.slice(6).map((signal) => <PublishedSignalCard key={signal.signal_id} signal={signal} compact />) : <Empty text="Published Signals will remain here permanently." />}</section>
    <p className="i4663-intro">SIGNAL HUNT / Submit the source. Preserve the attribution. Let evidence decide what survives.</p>
    <button className="i4663-primary-action i4663-button" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'CLOSE SUBMISSION' : 'SUBMIT A SIGNAL'} <span>{open ? '×' : '↗'}</span></button>
    {open && <form className="i4663-signal-form" onSubmit={submit}>
      <label className="i4663-field"><span>TITLE</span><input name="title" required minLength={3} maxLength={180} placeholder="What changed?" /></label>
      <label className="i4663-field"><span>CATEGORY</span><select name="category" defaultValue="meme">{SIGNAL_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="i4663-field"><span>WHY IT MATTERS</span><textarea name="thesis" required minLength={8} maxLength={2000} placeholder="State the signal, not the hype." /></label>
      <label className="i4663-field"><span>SOURCE URL</span><input name="source_url" required type="url" placeholder="https://" /></label>
      <label className="i4663-field"><span>SUBMITTER</span><input name="submitter" required maxLength={120} placeholder="Handle or wallet label" /></label>
      <label className="i4663-field"><span>EVIDENCE NOTE <i>OPTIONAL</i></span><input name="evidence_note" maxLength={1000} placeholder="What should reviewers inspect?" /></label>
      {error && <p className="i4663-error" role="alert">{error}</p>}
      <button className="i4663-primary-action i4663-button" type="submit">ENTER THE HUNT <span>↗</span></button>
      <p className="i4663-protocol-note">Your original attribution is retained permanently. Submission does not imply confirmation.</p>
    </form>}
    <DataState status={api.status} message={api.message} />
  </main>;
}

function PublishedSignalCard({ signal, compact = false }: { signal: Published4663Signal; compact?: boolean }) { return <a className={`i4663-published-signal${compact ? ' is-compact' : ''}`} href={`/4663/signals/${encodeURIComponent(signal.signal_id)}`}><header><span>SIGNAL // {signal.signal_id.replace('SIGNAL-4663-', '')}</span><time>{machineTime(signal.published_at)}</time></header><p>{signal.category.replaceAll('_', ' ')}</p><h2>{signal.headline}</h2>{!compact && <p className="i4663-signal-summary">{signal.summary}</p>}<footer><span>SIGNIFICANCE <b>{signal.significance_score}</b></span><span>ANOMALY <b>{signal.anomaly_score}</b></span><span>{signal.source_count} SOURCE{signal.source_count === 1 ? '' : 'S'}</span></footer></a>; }
function CommunitySignalCard({ signal }: { signal: Rh4663Signal }) { return <article><div><span>{signal.category.replaceAll('_', ' ').toUpperCase()}</span><b>{signal.lifecycle_state.replaceAll('_', ' ').toUpperCase()}</b></div><h2>{signal.title}</h2><p>{signal.thesis}</p><footer><span>FIRST SUBMITTED BY / {signal.original_submitter}</span><time>{machineTime(signal.submitted_at)}</time></footer><small>SIGNAL CARD / EDITORIAL INTELLIGENCE</small></article>; }

function SignalProofPage({ signalId }: { signalId: string }) {
  const api = useApi<Published4663Signal & { correction_state?: string; corrections?: Array<{ correction_id: string; correction_type: string; note: string; created_at: string }> }>(`/v1/4663/signals/${encodeURIComponent(signalId)}`); const signal = api.data;
  return <main className="i4663-main i4663-subpage"><PageHead index="03" title="SIGNAL PROOF" lede="EVIDENCE BEFORE CLAIM." /><DataState status={api.status} message={api.message} />{signal && <article className="i4663-signal-proof"><header><span>SIGNAL // 4663</span><code>{signal.signal_id}</code></header><p className="i4663-micro">{signal.category.replaceAll('_', ' ')} / {signal.signal_type.replaceAll('_', ' ')}</p><h1>{signal.headline}</h1><p>{signal.summary}</p><dl><div><dt>SIGNIFICANCE</dt><dd>{signal.significance_score}</dd></div><div><dt>ANOMALY</dt><dd>{signal.anomaly_score}</dd></div><div><dt>SOURCES</dt><dd>{signal.source_count}</dd></div><div><dt>HEURISTIC</dt><dd>{signal.heuristic_version}</dd></div><div><dt>DETECTED</dt><dd>{machineTime(signal.detected_at)}</dd></div><div><dt>PUBLISHED</dt><dd>{machineTime(signal.published_at)}</dd></div></dl>{signal.finder_attribution && <div className="i4663-finder"><span>FIRST SUBMITTED BY</span><strong>{signal.finder_attribution.submitted_by}</strong><time>{machineTime(signal.finder_attribution.submitted_at)}</time></div>}<section className="i4663-evidence"><h2>EVIDENCE</h2>{signal.evidence.map((reference) => <a key={reference.reference_id} href={reference.href}><span>{reference.source?.toUpperCase() ?? reference.reference_type.toUpperCase()}</span><strong>{reference.metric ?? reference.label}</strong><code>{formatEvidenceValue(reference.previous_value)} → {formatEvidenceValue(reference.current_value)} · {reference.confidence ?? '—'} CONF</code></a>)}</section>{signal.corrections?.length ? <section className="i4663-corrections"><h2>ADDITIVE RECORD</h2>{signal.corrections.map((correction) => <article key={correction.correction_id}><span>{correction.correction_type}</span><p>{correction.note}</p><time>{machineTime(correction.created_at)}</time></article>)}</section> : null}<footer><span>ORIGINAL PUBLICATION / IMMUTABLE</span><code>{signal.publication_hash}</code></footer><div className="i4663-share-links"><a href={signal.share.landscape}>LANDSCAPE</a><a href={signal.share.square}>SQUARE</a><a href={signal.share.portrait}>PORTRAIT</a></div></article>}</main>;
}

function Receipts() {
  const api = useApi<{ receipts: Rh4663CallReceipt[] }>('/v1/4663/receipts');
  return <main className="i4663-main i4663-subpage">
    <PageHead index="04" title="RECEIPTS" lede="MEMORY WITH BOUNDARIES." />
    <section className="i4663-semantics"><article><b>01</b><h2>SIGNAL CARD</h2><p>Public editorial intelligence. It can evolve with review.</p></article><article><b>02</b><h2>EVIDENCE RECEIPT</h2><p>A machine-verifiable observation with source and time.</p></article><article><b>03</b><h2>PROTOCOL RECEIPT</h2><p>A canonical CALL, RESOLUTION, or GENESIS FINALIZATION object.</p></article></section>
    <DataState status={api.status} message={api.message} />
    <section className="i4663-receipt-list"><h2>CALL RECEIPTS</h2>{api.data?.receipts.length ? api.data.receipts.map((receipt) => <a key={receipt.receipt_id} href={`/v1/4663/receipts/${receipt.receipt_id}`}><div><span>PROTOCOL RECEIPT / CALL</span><time>{machineTime(receipt.created_at)}</time></div><strong>{labelRotation(receipt.rotation)}</strong><code>{shortWallet(receipt.wallet)} · CONF {receipt.confidence} · {shortHash(receipt.payload_hash)}</code><small>IMMUTABLE / SIGNATURE VERIFIED{receipt.genesis_eligible ? ` / GENESIS ${pad(receipt.genesis_ordinal ?? 0)}` : ''}</small></a>) : api.status === 'ready' ? <Empty text="No Call Receipts exist in the current store." /> : null}</section>
  </main>;
}

function PageHead({ index, title, lede }: { index: string; title: string; lede: string }) { return <header className="i4663-page-head"><span>//4663 / {index}</span><h1>{title}</h1><p>{lede}</p></header>; }
function SectionNumber({ n, label }: { n: string; label: string }) { return <div className="i4663-section-number"><span>{n}</span><p>{label}</p></div>; }
function DataState({ status, message }: { status: string; message?: string }) { return status === 'loading' ? <p className="i4663-data-state" role="status">SYNCING PERSISTED MEMORY…</p> : status === 'degraded' ? <p className="i4663-data-state is-degraded" role="status">DEGRADED / {message}</p> : null; }
function Empty({ text }: { text: string }) { return <p className="i4663-empty">{text}</p>; }
function machineTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'TIMESTAMP UNAVAILABLE' : parsed.toISOString().replace('T', ' / ').replace('.000Z', 'Z'); }
function pad(value: number) { return String(value).padStart(2, '0'); }
function shortHash(value: string) { return `${value.slice(0, 10)}…${value.slice(-8)}`; }
function shortWallet(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function labelRotation(value: Rh4663RotationOption | null | undefined) { return ROTATIONS.find((item) => item.value === value)?.label.toUpperCase() ?? ''; }
function readableError(value?: string) { return value ? value.replaceAll('_', ' ') : 'The operation could not be completed.'; }
function compactSignal(value?: string) { if (!value) return null; const sentence = value.split(/(?<=[.!?])\s/)[0] ?? value; return sentence.length > 120 ? `${sentence.slice(0, 117).trim()}…` : sentence; }
function isPublishedSignal(signal: Published4663Signal | Rh4663Signal): signal is Published4663Signal { return 'immutable' in signal && signal.immutable === true && 'headline' in signal; }
function formatEvidenceValue(value: unknown) { if (value === undefined || value === null) return '—'; if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2); return String(value); }
