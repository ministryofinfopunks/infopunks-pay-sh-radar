import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { Rh4663CallReceipt, Rh4663RotationOption, Rh4663Signal, Rh4663SignalCategory, Rh4663TodayEdition } from '../services/rh4663Service';
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
  genesis: GenesisData;
};
type PulseData = { window: { window_id: string; opens_at: string; closes_at: string }; consensus: { total_calls: number; leading_rotation: Rh4663RotationOption | null; confidence_average: number | null; state: string }; options: Rh4663RotationOption[] };
type GenesisData = { limit: number; recorded: number; remaining: number; progress: number; policy: string };

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

export function Rh4663Page() {
  const path = window.location.pathname.replace(/\/$/, '') || '/4663';
  const view = path === '/4663/pulse' ? 'pulse' : path === '/4663/today' ? 'today' : path === '/4663/signals' ? 'signals' : path === '/4663/receipts' ? 'receipts' : 'home';
  return <div className="i4663-app">
    <header className="i4663-header">
      <a className="i4663-wordmark" href="/4663" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>//4663</b></a>
      <a className="i4663-radar-link" href="/rh-chain-signal-desk">RH DESK ↗</a>
    </header>
    <nav className="i4663-nav" aria-label="4663 navigation">{NAV.map((item) => <a key={item.href} href={item.href} aria-current={(path || '/4663') === item.href ? 'page' : undefined}>{item.label}</a>)}</nav>
    {view === 'home' ? <Home /> : view === 'pulse' ? <Pulse /> : view === 'today' ? <Today /> : view === 'signals' ? <Signals /> : <Receipts />}
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
    <section className="i4663-genesis">
      <SectionNumber n="05" label="Genesis provenance" />
      <div className="i4663-progress-copy"><strong>{data?.genesis.recorded ?? 0}<small> / 4,663</small></strong><span>{data?.genesis.remaining ?? 4663} IDENTITIES REMAIN</span></div>
      <div className="i4663-progress" role="progressbar" aria-valuemin={0} aria-valuemax={4663} aria-valuenow={data?.genesis.recorded ?? 0}><i style={{ width: `${Math.min(100, (data?.genesis.progress ?? 0) * 100)}%` }} /></div>
      <p>Provenance, not a reward promise. Genesis records early verified participation.</p>
    </section>
  </main>;
}

function Pulse() {
  const api = useApi<PulseData>('/v1/4663/pulse');
  const [rotation, setRotation] = useState<Rh4663RotationOption>('MEMES'); const [confidence, setConfidence] = useState(70); const [digest, setDigest] = useState('');
  const [result, setResult] = useState<{ state: 'idle' | 'working' | 'success' | 'error'; message?: string; receipt?: Rh4663CallReceipt }>({ state: 'idle' });
  async function makeCall() {
    setResult({ state: 'working', message: 'Requesting wallet signature…' });
    try {
      const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error('No EVM wallet found. Open 4663 in a wallet-enabled browser.');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]; const wallet = accounts[0]; if (!wallet) throw new Error('Wallet access was not granted.');
      const payloadResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/payload'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id }) });
      const payloadBody = await payloadResponse.json() as { data?: { canonical_serialization: string }; error?: string }; if (!payloadResponse.ok || !payloadBody.data) throw new Error(readableError(payloadBody.error));
      const signature = await ethereum.request({ method: 'personal_sign', params: [payloadBody.data.canonical_serialization, wallet] });
      const callResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/calls'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id, signature }) });
      const callBody = await callResponse.json() as { data?: Rh4663CallReceipt; error?: string }; if (!callResponse.ok || !callBody.data) throw new Error(readableError(callBody.error));
      setResult({ state: 'success', message: 'Call recorded. The receipt will not change.', receipt: callBody.data });
    } catch (error) { setResult({ state: 'error', message: error instanceof Error ? error.message : 'Call could not be recorded.' }); }
  }
  return <main className="i4663-main i4663-subpage">
    <PageHead index="01" title="RH PULSE" lede="CALL THE ROTATION." />
    <DataState status={api.status} message={api.message} />
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

function Today() {
  const api = useApi<Rh4663TodayEdition>('/v1/4663/today'); const edition = api.data;
  return <main className="i4663-main i4663-subpage">
    <PageHead index="02" title="TODAY ON 4663" lede={edition?.date ?? 'DAILY INTELLIGENCE'} />
    <DataState status={api.status} message={api.message} />
    {edition && <>
      <div className={`i4663-provider-state is-${edition.provider_state}`}><span>SOURCE STATE</span><strong>{edition.provider_state.toUpperCase()}</strong><time>{machineTime(edition.generated_at)}</time></div>
      <section className="i4663-key-signal"><p className="i4663-micro">KEY SIGNAL / CONFIDENCE {edition.confidence}</p><h2>{edition.key_signal}</h2><p>{edition.data_notice}</p></section>
      <section className="i4663-flow-list"><h2>CATEGORY FLOW</h2>{edition.category_flows.length ? edition.category_flows.map((flow) => <article key={`${flow.category}:${flow.summary}`}><span>{flow.category.replaceAll('_', ' ').toUpperCase()}</span><strong>{flow.summary}</strong><b>{flow.confidence}</b></article>) : <Empty text="Category flow unavailable. No live data has been inferred." />}</section>
      <section className="i4663-event-list"><h2>TOP EVENTS</h2>{edition.top_events.length ? edition.top_events.map((event) => <article key={event.event_id}><div><span>{event.category.toUpperCase()}</span><time>{machineTime(event.detected_at)}</time></div><strong>{event.title}</strong><p>{event.source_status.toUpperCase()} / SIGNIFICANCE {event.significance_score}</p></article>) : <Empty text="No normalized public events were recorded for this edition." />}</section>
      <section className="i4663-evidence"><h2>EVIDENCE REFERENCES</h2>{edition.evidence_references.map((reference) => <a key={reference.reference_id} href={reference.href}><span>{reference.reference_type.replaceAll('_', ' ').toUpperCase()}</span><strong>{reference.label}</strong><code>{reference.source_status.toUpperCase()} · {machineTime(reference.observed_at)}</code></a>)}</section>
      <a className="i4663-text-link" href="/v1/4663/today/archive">OPEN EDITION ARCHIVE →</a>
    </>}
  </main>;
}

function Signals() {
  const api = useApi<{ signals: Rh4663Signal[] }>('/v1/4663/signals'); const [open, setOpen] = useState(false); const [submitted, setSubmitted] = useState<Rh4663Signal | null>(null); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries()); if (!payload.evidence_note) delete payload.evidence_note;
    try { const response = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/signals'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json() as { data?: Rh4663Signal; error?: string }; if (!response.ok || !body.data) throw new Error(readableError(body.error)); setSubmitted(body.data); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Signal could not be submitted.'); }
  }
  const signals = useMemo(() => submitted ? [submitted, ...(api.data?.signals ?? []).filter((item) => item.signal_id !== submitted.signal_id)] : api.data?.signals ?? [], [api.data, submitted]);
  return <main className="i4663-main i4663-subpage">
    <PageHead index="03" title="SIGNAL HUNT" lede="SEE THE MOVE EARLY." />
    <p className="i4663-intro">Submit the source. Preserve the attribution. Let evidence decide what survives.</p>
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
    <section className="i4663-signal-list">{signals.length ? signals.map((signal) => <article key={signal.signal_id}>
      <div><span>{signal.category.replaceAll('_', ' ').toUpperCase()}</span><b>{signal.lifecycle_state.replaceAll('_', ' ').toUpperCase()}</b></div><h2>{signal.title}</h2><p>{signal.thesis}</p><footer><span>BY / {signal.original_submitter}</span><time>{machineTime(signal.submitted_at)}</time></footer><small>SIGNAL CARD / EDITORIAL INTELLIGENCE</small>
    </article>) : api.status === 'ready' ? <Empty text="No 4663 signals have been submitted." /> : null}</section>
  </main>;
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
