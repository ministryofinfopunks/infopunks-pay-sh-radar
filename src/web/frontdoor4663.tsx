import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { Rh4663CallReceipt, Rh4663RotationOption } from '../services/rh4663Service';
import type { Rh4663ProofProfile } from '../services/rh4663ResolutionService';
import type { Rh4663FrontdoorState } from '../services/rh4663FrontdoorService';

type Pulse = Rh4663FrontdoorState['current_call'];

type EvidenceState = 'VERIFIED' | 'MIXED' | 'WATCH' | 'UNRESOLVED' | 'BLOCK' | 'DEGRADE' | 'INSUFFICIENT DATA';

function evidenceState(value?: string | null): EvidenceState {
  const state = (value ?? '').toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (state.includes('VERIFY') || state.includes('VERIFIED') || state === 'FRESH' || state === 'PUBLISHED' || state === 'AVAILABLE') return 'VERIFIED';
  if (state.includes('MIX')) return 'MIXED';
  if (state.includes('WATCH')) return 'WATCH';
  if (state.includes('BLOCK')) return 'BLOCK';
  if (state.includes('DEGRAD') || state.includes('STALE') || state.includes('UNAVAILABLE')) return 'DEGRADE';
  if (state.includes('UNRESOLVED') || state.includes('PENDING')) return 'UNRESOLVED';
  return 'INSUFFICIENT DATA';
}

export function FreshnessBadge({ at, pending }: { at?: string | null; pending?: boolean }) {
  if (pending) return <span className="fd-freshness" aria-label="Freshness: D7 pending">D7 pending</span>;
  const timestamp = at ? new Date(at).getTime() : NaN;
  if (Number.isNaN(timestamp)) return <span className="fd-freshness" aria-label="Freshness: insufficient data">—</span>;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  const label = minutes < 2 ? 'LIVE' : minutes < 60 ? `${minutes}m` : minutes < 1_440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1_440)}d`;
  return <time className="fd-freshness" dateTime={at ?? undefined} aria-label={`Freshness: ${label}`}>{label}</time>;
}

export function EvidenceBadge({ state }: { state?: string | null }) {
  const label = evidenceState(state);
  return <span className={`fd-evidence fd-evidence-${label.toLowerCase().replaceAll(' ', '-')}`} data-evidence-state={label}>{label}</span>;
}

export function MetricDelta({ metric, delta }: { metric: string; delta?: string }) {
  return <div className="fd-metric"><strong>{metric}</strong>{delta && <span>{delta}</span>}</div>;
}

export function ResearchLink({ href, children = 'Open research' }: { href: string; children?: React.ReactNode }) {
  return <a className="fd-research-link" href={href}>{children}<span aria-hidden="true">↗</span></a>;
}

type CardProps = { topic: string; conclusion: string; metric: string; delta?: string; evidence?: string; freshness?: string | null; href: string };
export function NowCard(props: CardProps) { return <article className="fd-card fd-now-card"><p>{props.topic}</p><h3>{props.conclusion}</h3><MetricDelta metric={props.metric} delta={props.delta} /><footer><EvidenceBadge state={props.evidence} /><FreshnessBadge at={props.freshness} /><ResearchLink href={props.href}>Dossier</ResearchLink></footer></article>; }
export function WatchCard(props: CardProps) { return <article className="fd-card fd-watch-card"><p>{props.topic}</p><h3>{props.conclusion}</h3><footer><EvidenceBadge state={props.evidence ?? 'WATCH'} /><FreshnessBadge at={props.freshness} /><ResearchLink href={props.href}>Case</ResearchLink></footer></article>; }
export function OpenLoopCard({ question, state, href, pending }: { question: string; state: string; href: string; pending?: boolean }) { return <article className="fd-loop"><h3>{question}</h3><footer><EvidenceBadge state={state} /><FreshnessBadge pending={pending} /><ResearchLink href={href}>Follow</ResearchLink></footer></article>; }

export function PulseCard({ pulse }: { pulse: Pulse }) {
  return <article id="call" className="fd-pulse-card"><div><p>CALL</p><h2>What happens next?</h2><span>Make one signed view. Resolution follows the published methodology.</span></div><div className="fd-pulse-meta"><MetricDelta metric={pulse.leading_rotation ? rotationLabel(pulse.leading_rotation) : 'OPEN'} delta={`${pulse.total_calls} calls`} /><EvidenceBadge state={pulse.state} /><FreshnessBadge at={pulse.opens_at} /></div><a className="fd-call-action" href="/4663/pulse">Make the call <span aria-hidden="true">→</span></a></article>;
}

type MeCallState = {
  authenticated: boolean;
  window_id: string;
  window?: { opens_at: string; closes_at: string; state: string };
  has_called: boolean;
  call_receipt_reference: string | null;
  selection: Rh4663RotationOption | null;
  confidence: number | null;
  submitted_at: string | null;
  resolution_state: string | null;
  resolution_receipt: { receipt_id: string; resolved_category: Rh4663RotationOption; outcome: 'CORRECT' | 'INCORRECT' } | null;
  my_4663_version: string;
};

const CALL_OPTIONS: Array<{ value: Rh4663RotationOption; label: string }> = [
  { value: 'MEMES', label: 'Memes' },
  { value: 'STOCK_TOKENS', label: 'Stock Tokens' },
  { value: 'RWA_DEFI', label: 'RWA / DeFi' },
  { value: 'STABLES', label: 'Stables' },
  { value: 'NO_QUALIFIED_ROTATION', label: 'No Qualified Rotation' }
];

type CallLifecycle = 'WINDOW_NOT_OPEN' | 'OPEN_NOT_CALLED' | 'DRAFTING' | 'READY_TO_SIGN' | 'SIGNING' | 'SIGNED' | 'WINDOW_CLOSED_PENDING_RESOLUTION' | 'RESOLVED_CORRECT' | 'RESOLVED_INCORRECT' | 'RESOLVED_OTHER' | 'ERROR';

function callEvent(event: 'call_card_viewed' | 'call_option_selected' | 'call_confidence_changed' | 'call_review_opened' | 'call_sign_started' | 'call_sign_succeeded' | 'call_sign_failed' | 'call_receipt_opened' | 'call_shared' | 'call_resolution_viewed' | 'call_again_started', windowId?: string) {
  const payload = JSON.stringify({ event, surface: 'home', window_id: windowId });
  void fetch(toApiUrl(getApiBaseUrl(), '/v1/4663/campaign/events'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => undefined);
}

function callWindowState(pulse: { opens_at: string; closes_at: string } | null, personal: MeCallState | null, now: number): CallLifecycle {
  if (!pulse) return 'ERROR';
  const opensAt = Date.parse(pulse.opens_at); const closesAt = Date.parse(pulse.closes_at);
  if (Number.isFinite(opensAt) && now < opensAt) return 'WINDOW_NOT_OPEN';
  if (personal?.has_called) {
    if (personal.resolution_state === 'CORRECT') return 'RESOLVED_CORRECT';
    if (personal.resolution_state === 'INCORRECT') return 'RESOLVED_INCORRECT';
    if (personal.resolution_state && !['RESOLUTION_PENDING', 'UNRESOLVED', 'PENDING'].includes(personal.resolution_state)) return 'RESOLVED_OTHER';
    if (Number.isFinite(closesAt) && now >= closesAt) return 'WINDOW_CLOSED_PENDING_RESOLUTION';
    return 'SIGNED';
  }
  if (Number.isFinite(closesAt) && now >= closesAt) return 'WINDOW_CLOSED_PENDING_RESOLUTION';
  return 'OPEN_NOT_CALLED';
}

function shortUtc(value?: string | null) {
  if (!value) return 'CANONICAL CHECKPOINT';
  const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'CANONICAL CHECKPOINT' : parsed.toISOString().replace('.000Z', ' UTC').replace('T', ' ');
}

function timeRemaining(closesAt?: string, now = Date.now()) {
  const remaining = closesAt ? Math.max(0, Date.parse(closesAt) - now) : 0;
  const hours = Math.floor(remaining / 3_600_000); const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return remaining ? `${hours}h ${String(minutes).padStart(2, '0')}m` : 'CLOSED';
}

function labelForCall(value: Rh4663RotationOption | null | undefined) { return CALL_OPTIONS.find((item) => item.value === value)?.label ?? 'No selection'; }

export function CallLoop({ data }: { data: Rh4663FrontdoorState | null }) {
  const apiBase = getApiBaseUrl();
  const pulse = data?.current_call ? { window_id: data.current_call.window_id, opens_at: data.current_call.opens_at, closes_at: data.current_call.closes_at } : null;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [personal, setPersonal] = useState<MeCallState | null>(null);
  const [personalStatus, setPersonalStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [selection, setSelection] = useState<Rh4663RotationOption | null>(null);
  const [confidence, setConfidence] = useState(() => Math.min(100, Math.max(1, Number(params.get('confidence')) || 50)));
  const [evidenceDigest, setEvidenceDigest] = useState('');
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState<Rh4663CallReceipt | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shared, setShared] = useState(false);

  useEffect(() => { callEvent('call_card_viewed', pulse?.window_id); }, [pulse?.window_id]);
  useEffect(() => {
    let cancelled = false;
    const load = async (address?: string) => {
      try {
        const path = address ? `/v1/4663/me/call?wallet=${encodeURIComponent(address)}` : '/v1/4663/me/call';
        const response = await fetch(toApiUrl(apiBase, path), { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error();
        const body = await response.json() as { data: MeCallState };
        if (!cancelled) { setPersonal(body.data); setPersonalStatus('ready'); }
      } catch { if (!cancelled) setPersonalStatus('unavailable'); }
    };
    const ethereum = (window as Window & { ethereum?: { request(args: { method: string }): Promise<unknown> } }).ethereum;
    if (!ethereum) { void load(); return () => { cancelled = true; }; }
    void ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined;
      return load(address);
    }).catch(() => load());
    return () => { cancelled = true; };
  }, [apiBase, pulse?.window_id]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const lifecycle = receipt ? 'SIGNED' : signing ? 'SIGNING' : (personalStatus === 'unavailable' && !personal ? 'ERROR' : callWindowState(pulse, personal, now));
  const canEdit = lifecycle === 'OPEN_NOT_CALLED' || lifecycle === 'DRAFTING' || lifecycle === 'READY_TO_SIGN';
  const showEditor = !receipt && (canEdit || signing);
  const effectiveLifecycle = error ? 'ERROR' : review && canEdit ? 'READY_TO_SIGN' : selection && canEdit ? 'DRAFTING' : lifecycle;
  const resolutionPending = personal?.has_called && ['RESOLUTION_PENDING', 'UNRESOLVED', 'PENDING'].includes(personal.resolution_state ?? '');

  function choose(value: Rh4663RotationOption) { setSelection(value); setReview(false); setError(null); callEvent('call_option_selected', pulse?.window_id); }
  function changeConfidence(value: number) { const next = Math.min(100, Math.max(1, value)); setConfidence(next); setReview(false); callEvent('call_confidence_changed', pulse?.window_id); }
  function openReview() { if (!selection || !canEdit) return; setReview(true); setError(null); callEvent('call_review_opened', pulse?.window_id); }
  async function signCall() {
    setError(null); setShared(false); setSigning(true); callEvent('call_sign_started', pulse?.window_id);
    const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
    if (!ethereum) { setError('Wallet unavailable. Open 4663 in a wallet-enabled browser.'); setSigning(false); callEvent('call_sign_failed', pulse?.window_id); return; }
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]; const connectedWallet = accounts[0];
      if (!connectedWallet || !selection) throw new Error('Wallet access and a category selection are required.');
      const payloadResponse = await fetch(toApiUrl(apiBase, '/v1/4663/pulse/payload'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation: selection, confidence, evidence_digest: evidenceDigest || null, window_id: pulse?.window_id }) });
      const payloadBody = await payloadResponse.json() as { data?: { canonical_serialization: string }; error?: string };
      if (!payloadResponse.ok || !payloadBody.data) throw new Error(payloadBody.error?.replaceAll('_', ' ') ?? 'The CALL payload is no longer valid.');
      const signature = await ethereum.request({ method: 'personal_sign', params: [payloadBody.data.canonical_serialization, connectedWallet] });
      const callResponse = await fetch(toApiUrl(apiBase, '/v1/4663/pulse/calls'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation: selection, confidence, evidence_digest: evidenceDigest || null, window_id: pulse?.window_id, signature }) });
      const callBody = await callResponse.json() as { data?: Rh4663CallReceipt; error?: string };
      if (!callResponse.ok || !callBody.data) throw new Error(callBody.error?.replaceAll('_', ' ') ?? 'The CALL could not be accepted.');
      setReceipt(callBody.data); setPersonal({ authenticated: true, window_id: callBody.data.window_id, has_called: true, call_receipt_reference: callBody.data.receipt_id, selection: callBody.data.rotation, confidence: callBody.data.confidence, submitted_at: callBody.data.created_at, resolution_state: 'RESOLUTION_PENDING', resolution_receipt: null, my_4663_version: callBody.data.receipt_id });
      callEvent('call_sign_succeeded', callBody.data.window_id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The signature could not be accepted.';
      setError(/reject|denied|cancel/i.test(message) ? 'Signature rejected. Your call was not submitted.' : /already_called|duplicate/i.test(message) ? 'A CALL already exists for this window.' : /expired|not_open|closed/i.test(message) ? 'This window closed while you were signing. Recheck the Pulse window.' : message);
      callEvent('call_sign_failed', pulse?.window_id);
    } finally { setSigning(false); }
  }
  async function shareCall() {
    const current = receipt ?? (personal?.call_receipt_reference ? { receipt_id: personal.call_receipt_reference, rotation: personal.selection, confidence: personal.confidence, window_id: personal.window_id } : null);
    if (!current || !current.rotation || current.confidence === null) return;
    const url = new URL(`/4663/call/${encodeURIComponent(current.receipt_id)}`, window.location.origin).toString(); const text = `//4663 CALL\n\n${labelForCall(current.rotation).toUpperCase()}\n\n${current.confidence}% CONFIDENCE\n\nEVERYONE HAS AN OPINION.\nINFOPUNKS HAS THE RECEIPT.`;
    try { if (navigator.share) await navigator.share({ title: '//4663 CALL', text, url }); else await navigator.clipboard.writeText(`${text}\n${url}`); setShared(true); callEvent('call_shared', current.window_id); } catch { /* A cancelled native share leaves the receipt unchanged. */ }
  }

  const isUnavailable = !data || personalStatus === 'unavailable';
  return <article id="call" className={`fd-call-loop fd-call-${String(effectiveLifecycle).toLowerCase()}`} data-call-state={effectiveLifecycle} aria-labelledby="call-title">
    <div className="fd-call-head"><div><p>CALL</p><h2 id="call-title">What happens next?</h2><span>Next 24h rotation</span><span className="fd-call-state" role="status" aria-live="polite">{effectiveLifecycle.replaceAll('_', ' ')}</span></div><div className="fd-call-window" aria-live="polite"><strong>{pulse ? timeRemaining(pulse.closes_at, now) : 'UNAVAILABLE'}</strong><span>{pulse ? `Closes ${shortUtc(pulse.closes_at)}` : 'Pulse unavailable'}</span></div></div>
    {isUnavailable && !data && <p className="fd-call-alert" role="status">PULSE UNAVAILABLE. NOW, WATCH, and OPEN LOOPS remain available.</p>}
    {isUnavailable && data && personalStatus === 'unavailable' && <p className="fd-call-alert" role="status">CALL STATUS TEMPORARILY UNAVAILABLE</p>}
    {personal?.has_called && !receipt && <section className="fd-call-return" aria-live="polite"><p>YOUR CALL</p><h3>{labelForCall(personal.selection)}</h3><strong>{personal.confidence}% confidence</strong><span>{resolutionPending ? 'RESOLUTION PENDING' : `RESOLVED ${personal.resolution_state}`}</span>{resolutionPending && <small>Canonical checkpoint: {shortUtc(pulse?.closes_at)}</small>}</section>}
    {showEditor && <>
      <div className="fd-call-context"><p>RADAR CONTEXT</p>{(data?.now_cards ?? []).slice(0, 3).map((card) => <span key={card.id}><b>{card.topic}</b>{card.headline}</span>)}</div>
      <fieldset className="fd-call-options"><legend>WHAT HAPPENS NEXT?</legend>{CALL_OPTIONS.map((option) => <button type="button" key={option.value} aria-pressed={selection === option.value} onClick={() => choose(option.value)}>{option.label}</button>)}</fieldset>
      <div className="fd-confidence"><div><span>CONFIDENCE</span><strong>{confidence}</strong><small>Conviction recorded on the receipt. It does not change financial reward.</small></div><div className="fd-confidence-controls"><button type="button" aria-label="Decrease confidence" onClick={() => changeConfidence(confidence - 1)} disabled={confidence <= 1}>−</button><input aria-label="Confidence, 1 to 100" type="range" min="1" max="100" value={confidence} onChange={(event) => changeConfidence(Number(event.target.value))} /><button type="button" aria-label="Increase confidence" onClick={() => changeConfidence(confidence + 1)} disabled={confidence >= 100}>+</button></div><div className="fd-confidence-presets">{[25, 50, 75, 90].map((value) => <button type="button" key={value} aria-pressed={confidence === value} onClick={() => changeConfidence(value)}>{value}</button>)}</div></div>
      <label className="fd-evidence-input"><span>OPTIONAL EVIDENCE DIGEST</span><input value={evidenceDigest} onChange={(event) => setEvidenceDigest(event.target.value)} placeholder="0x…" pattern="0x[0-9a-fA-F]{64}" /></label>
      {!review ? <button className="fd-primary-action" type="button" onClick={openReview} disabled={!selection}>Review your call <span aria-hidden="true">→</span></button> : <section className="fd-call-review" aria-live="polite"><p>YOUR CALL</p><h3>{labelForCall(selection)}</h3><dl><div><dt>CONFIDENCE</dt><dd>{confidence}%</dd></div><div><dt>WINDOW</dt><dd>{shortUtc(pulse?.opens_at)}<br />→ {shortUtc(pulse?.closes_at)}</dd></div><div><dt>RESOLVES AGAINST</dt><dd>Subsequent canonical observation window</dd></div></dl><p className="fd-permanence">This becomes permanent after signing.</p><button className="fd-primary-action" type="button" onClick={signCall} disabled={signing}>{signing ? 'Waiting for signature…' : 'Sign call'} <span aria-hidden="true">→</span></button></section>}
    </>}
    {effectiveLifecycle === 'WINDOW_NOT_OPEN' && <p className="fd-call-alert" role="status">WINDOW NOT OPEN. Opens {shortUtc(pulse?.opens_at)}.</p>}
    {effectiveLifecycle === 'WINDOW_CLOSED_PENDING_RESOLUTION' && !personal?.has_called && <p className="fd-call-alert" role="status">WINDOW CLOSED. RESOLUTION PENDING.</p>}
    {error && <p className="fd-call-alert" role="alert">{error}</p>}
    {receipt && <section className="fd-call-receipt" aria-live="polite"><p>YOUR CALL IS ON THE RECORD</p><h3>{labelForCall(receipt.rotation)}</h3><strong>{receipt.confidence}% confidence</strong><code>{receipt.receipt_id}</code><span>Resolves: {shortUtc(pulse?.closes_at)}</span><div><a href={`/4663/call/${encodeURIComponent(receipt.receipt_id)}`} onClick={() => callEvent('call_receipt_opened', receipt.window_id)}>View receipt</a><button type="button" onClick={shareCall}>{shared ? 'Link copied' : 'Share'}</button><a href="#now">Explore what Radar sees</a></div><small>EVERYONE HAS AN OPINION. INFOPUNKS HAS THE RECEIPT.</small></section>}
    {personal?.has_called && !receipt && resolutionPending && <section className="fd-call-changed"><p>WHAT CHANGED SINCE YOUR CALL?</p>{(data?.now_cards ?? []).slice(0, 2).map((card) => <span key={card.id}><b>{card.topic}</b>{card.headline}</span>)}</section>}
    {(effectiveLifecycle === 'RESOLVED_CORRECT' || effectiveLifecycle === 'RESOLVED_INCORRECT' || effectiveLifecycle === 'RESOLVED_OTHER') && personal?.resolution_receipt && <section className="fd-call-resolved" aria-live="polite"><p>YOUR CALL RESOLVED</p><h3>{labelForCall(personal.selection)} {effectiveLifecycle === 'RESOLVED_CORRECT' ? '✓' : ''}</h3><dl><div><dt>OUTCOME</dt><dd>{labelForCall(personal.resolution_receipt.resolved_category)}</dd></div><div><dt>RESULT</dt><dd>{personal.resolution_receipt.outcome}</dd></div><div><dt>CONFIDENCE</dt><dd>{personal.confidence}%</dd></div></dl><p>WHY? The canonical resolution follows the published deterministic observation methodology.</p><a href={`/4663/resolution/${encodeURIComponent(personal.resolution_receipt.receipt_id)}`} onClick={() => callEvent('call_resolution_viewed', personal.window_id)}>View resolution receipt →</a><a href="/4663/pulse" onClick={() => callEvent('call_again_started', personal.window_id)}>Today’s call →</a></section>}
    <a className="fd-call-action" href="/4663/pulse">Make the call <span aria-hidden="true">→</span></a>
  </article>;
}

type MeProofState = { authenticated: boolean; profile: Rh4663ProofProfile | null; my_4663_version: string };

function proofPercent(value: number | null) { return value === null ? '—' : `${Math.round(value * 100)}%`; }

export function ProofProfileCard({ proof }: { proof: Rh4663FrontdoorState['proof_summary'] }) {
  const [wallet, setWallet] = useState<string | null>(null); const [profile, setProfile] = useState<Rh4663ProofProfile | null>(null); const [status, setStatus] = useState<'loading' | 'ready' | 'anonymous' | 'unavailable'>('loading');
  useEffect(() => {
    let cancelled = false;
    const load = async (address?: string) => {
      if (!address) { if (!cancelled) setStatus('anonymous'); return; }
      try { const response = await fetch(toApiUrl(getApiBaseUrl(), `/v1/4663/me/proof?wallet=${encodeURIComponent(address)}`), { headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(); const body = await response.json() as { data: MeProofState }; if (!cancelled) { setWallet(address); setProfile(body.data.profile); setStatus('ready'); } }
      catch { if (!cancelled) setStatus('unavailable'); }
    };
    const ethereum = (window as Window & { ethereum?: { request(args: { method: string }): Promise<unknown> } }).ethereum;
    if (!ethereum) { void load(); return () => { cancelled = true; }; }
    void ethereum.request({ method: 'eth_accounts' }).then((accounts) => load(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined)).catch(() => load());
    return () => { cancelled = true; };
  }, []);
  const profileHref = profile && wallet ? `/4663/proof/${encodeURIComponent(wallet)}` : '/4663/receipts';
  return <article id="proof" className="fd-proof-card fd-proof-profile-card" data-proof-state={status}>
    <div><p>PROOF</p><h2>{profile ? profile.display_name : 'Your record, when you make one.'}</h2><span>{profile ? 'A receipt-backed history of judgment. Not a portfolio, balance, or trading record.' : proof.note}</span></div>
    {profile ? <div className="fd-proof-stats"><div><small>CALLS</small><strong>{profile.calls}</strong></div><div><small>RESOLVED</small><strong>{profile.resolved}</strong></div><div><small>CORRECT</small><strong>{profile.correct}</strong></div><div><small>ACCURACY</small><strong>{proofPercent(profile.accuracy)}</strong></div><div><small>HIGH-CONFIDENCE</small><strong>{proofPercent(profile.high_confidence_accuracy)}</strong></div>{profile.best_supported_category.category && <div><small>SUPPORTED CATEGORY</small><strong>{rotationLabel(profile.best_supported_category.category)}</strong></div>}{profile.genesis && <div><small>GENESIS</small><strong>#{String(profile.genesis.ordinal).padStart(4, '0')}</strong></div>}<ResearchLink href={profileHref}>View proof</ResearchLink></div> : <div className="fd-proof-card-actions"><EvidenceBadge state={status === 'unavailable' ? 'DEGRADE' : 'UNRESOLVED'} /><span className="fd-proof-note">{status === 'unavailable' ? 'Proof profile temporarily unavailable.' : status === 'loading' ? 'Checking for a connected identity…' : `${proof.total_calls} calls in this window`}</span><ResearchLink href={profileHref}>{status === 'anonymous' ? 'Receipts' : 'View proof'}</ResearchLink></div>}
  </article>;
}

export function ProofCard({ proof }: { proof: Rh4663FrontdoorState['proof_summary'] }) { return <ProofProfileCard proof={proof} />; }

export function SectionHeader({ id, title, question, action }: { id: string; title: string; question: string; action?: React.ReactNode }) { return <header className="fd-section-header"><div><p>{title}</p><h2 id={id}>{question}</h2></div>{action}</header>; }

export function FrontdoorShell({ children, freshness }: { children: React.ReactNode; freshness?: string | null }) {
  return <div className="fd-shell"><a className="fd-skip" href="#now">Skip to now</a><header className="fd-topbar"><a href="/4663" className="fd-mark" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>4663</b></a><div className="fd-topbar-status"><span><i aria-hidden="true" /> <FreshnessBadge at={freshness} /></span><a href="#call">Call</a></div></header><nav className="fd-nav" aria-label="Primary navigation"><a href="#now">Now</a><a href="#watch">Watch</a><a href="#call">Call</a><a href="#proof">Proof</a></nav>{children}</div>;
}

export function Frontdoor({ data, status, message }: { data: Rh4663FrontdoorState | null; status: 'loading' | 'ready' | 'degraded'; message?: string }) {
  const unavailable = !data;
  const systemMessage = data?.system_status?.state === 'partial' ? 'Some research sources are temporarily unavailable. Available evidence remains shown.' : null;
  const currentCall = data?.current_call ?? { window_id: 'unavailable', state: 'UNRESOLVED', leading_rotation: null, total_calls: 0, opens_at: '', closes_at: '', deep_link: '/4663/pulse', source_ref: { source_type: 'pulse_window', source_id: 'unavailable', href: '/v1/4663/pulse', observed_at: null } };
  const proof = data?.proof_summary ?? { total_calls: 0, resolved_calls: null, note: 'Personal proof is available after a signed CALL.', deep_link: '/4663/receipts', source_ref: currentCall.source_ref };
  return <FrontdoorShell freshness={data?.freshness?.source_observed_at}><main className="fd-main"><section className="fd-hero" aria-labelledby="fd-title"><p>INFOPUNKS / ROBINHOOD CHAIN</p><h1 id="fd-title">Robinhood Chain,<br />right now.</h1><span>Signal extraction for the agentic economy. Before an agent spends, it checks Infopunks.</span></section>{(status !== 'ready' || systemMessage) && <p className={`fd-data-state ${status === 'degraded' ? 'is-degraded' : ''}`} role="status">{status === 'loading' ? 'Refreshing reviewed intelligence…' : systemMessage ?? `Data degraded. ${message ?? 'No market conclusion is inferred.'}`}</p>}<section id="now" className="fd-section" aria-labelledby="now-title"><SectionHeader id="now-title" title="NOW" question="What matters right now?" action={<FreshnessBadge at={data?.freshness?.source_observed_at} />} /><div className="fd-now-grid">{data?.now_cards?.slice(0, 5).map((card) => <NowCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} delta={card.delta ?? undefined} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} />) ?? null}{unavailable && <p className="fd-empty">No derived market state is available yet.</p>}</div></section><section id="watch" className="fd-section" aria-labelledby="watch-title"><SectionHeader id="watch-title" title="WATCH" question="What is developing?" action={<ResearchLink href="/4663/reflexive/watch">All cases</ResearchLink>} /><div className="fd-watch-grid">{data?.watch_cards?.slice(0, 4).map((card) => <WatchCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} />) ?? null}{data && !data.watch_cards?.length && <p className="fd-empty">No developing cases are ready to surface.</p>}</div></section><section className="fd-section" aria-labelledby="loops-title"><SectionHeader id="loops-title" title="OPEN LOOPS" question="What still needs to be proved?" /><div className="fd-loop-grid">{data?.open_loops?.slice(0, 4).map((loop) => <OpenLoopCard key={loop.loop_id} question={loop.question} state={loop.state} href={loop.deep_link} pending={Boolean(loop.expected_resolution_at)} />) ?? null}{data && !data.open_loops?.length && <p className="fd-empty">No unresolved research loops are available.</p>}</div></section><CallLoop data={data} /><section className="fd-section fd-proof-section" aria-labelledby="proof-title"><SectionHeader id="proof-title" title="PROOF" question="How good is your record?" /><ProofCard proof={proof} /></section></main><footer className="fd-footer"><p>Research stays deep until you ask for it.</p><details><summary>Open research</summary><div><a href="/4663/reflexive">Reflexive Radar</a><a href="/4663/reflexive/watch">Watch cases</a><a href="/4663/reflexive/census">Category Census</a><a href="/4663/reflexive/preflight/ipx-pltr">PLTR Preflight</a><a href="/4663/receipts">CALL + RESOLUTION receipts</a><a href="/rh-chain-signal-desk">Robinhood Chain desk</a></div></details></footer></FrontdoorShell>;
}

function rotationLabel(value: string) { return value.replaceAll('_', ' '); }
