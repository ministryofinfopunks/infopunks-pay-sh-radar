import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { Rh4663CallReceipt, Rh4663RotationOption } from '../services/rh4663Service';
import type { Rh4663ProofProfile } from '../services/rh4663ResolutionService';
import type { FrontdoorChangeEvent, OpenLoop, Rh4663FrontdoorState } from '../services/rh4663FrontdoorService';
import type { My4663FollowInput, My4663SubjectType } from '../services/rh4663My4663Service';

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

type FollowSubject = Pick<My4663FollowInput, 'subject_type' | 'subject_id'>;
type FollowProps = { follow?: FollowSubject | null; following?: boolean; onToggleFollow?: (subject: FollowSubject) => void };
function FollowControl({ follow, following = false, onToggleFollow }: FollowProps) { if (!follow || !onToggleFollow) return null; return <button type="button" className="fd-follow" aria-pressed={following} onClick={() => onToggleFollow(follow)}>{following ? 'FOLLOWING' : 'FOLLOW'}</button>; }
type CardProps = { topic: string; conclusion: string; metric: string; delta?: string; evidence?: string; freshness?: string | null; href: string } & FollowProps;
export function NowCard(props: CardProps) { return <article className="fd-card fd-now-card"><p>{props.topic}</p><h3>{props.conclusion}</h3><MetricDelta metric={props.metric} delta={props.delta} /><footer><EvidenceBadge state={props.evidence} /><FreshnessBadge at={props.freshness} /><FollowControl follow={props.follow} following={props.following} onToggleFollow={props.onToggleFollow} /><ResearchLink href={props.href}>Dossier</ResearchLink></footer></article>; }
export function WatchCard(props: CardProps) { return <article className="fd-card fd-watch-card"><p>{props.topic}</p><h3>{props.conclusion}</h3><footer><EvidenceBadge state={props.evidence ?? 'WATCH'} /><FreshnessBadge at={props.freshness} /><FollowControl follow={props.follow} following={props.following} onToggleFollow={props.onToggleFollow} /><ResearchLink href={props.href}>Case</ResearchLink></footer></article>; }
function frontdoorEvent(event: 'open_loop_viewed' | 'open_loop_opened' | 'open_loop_source_opened' | 'return_change_summary_viewed' | 'return_change_opened' | 'pending_call_changes_viewed' | 'resolved_call_return_viewed' | 'frontdoor_return_visit' | 'follow_created' | 'follow_removed' | 'my4663_viewed' | 'followed_change_viewed' | 'followed_open_loop_viewed' | 'followed_subject_return', loopId?: string) {
  void fetch(toApiUrl(getApiBaseUrl(), '/v1/4663/campaign/events'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, surface: 'home', window_id: loopId }) }).catch(() => undefined);
}
function loopCheckpoint(loop: OpenLoop) { if (!loop.expected_checkpoint_at) return 'AWAITING EVIDENCE'; const at = new Date(loop.expected_checkpoint_at); return Number.isNaN(at.getTime()) ? 'AWAITING EVIDENCE' : at.toLocaleDateString(undefined, { month: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase(); }
function loopProgress(loop: OpenLoop) { return typeof loop.progress === 'string' ? loop.progress : loop.progress.label; }
export function OpenLoopCard({ loop, question, state, href, pending, following, onToggleFollow }: { loop?: OpenLoop; question?: string; state?: string; href?: string; pending?: boolean } & Omit<FollowProps, 'follow'>) {
  const item = loop; const title = item?.question ?? question ?? 'Open research loop'; const target = item?.deep_link ?? href ?? '/4663/reflexive'; const loopState = item?.state ?? state ?? 'OPEN';
  useEffect(() => { frontdoorEvent('open_loop_viewed', item?.loop_id); if (following) frontdoorEvent('followed_open_loop_viewed', item?.loop_id); }, [item?.loop_id, following]);
  const follow = item ? { subject_type: 'OPEN_LOOP' as const, subject_id: item.loop_id } : null;
  return <article className="fd-loop" data-loop-state={loopState}><details onToggle={(event) => { if (event.currentTarget.open) frontdoorEvent('open_loop_opened', item?.loop_id); }}><summary><span className="fd-loop-state">{loopState.replaceAll('_', ' ')}</span><h3>{title}</h3><span className="fd-loop-checkpoint">{item ? loopCheckpoint(item) : pending ? 'CHECKPOINT' : 'AWAITING EVIDENCE'}</span></summary>{item?.source_ref && <div className="fd-loop-detail"><p><b>WHY IT MATTERS</b>{item.short_context}</p><p><b>CURRENT EVIDENCE</b>{item.current_evidence}</p><p><b>WHAT WOULD CONFIRM IT?</b>{item.resolution_condition}</p>{item.falsification_condition && <p><b>WHAT WOULD FALSIFY IT?</b>{item.falsification_condition}</p>}<p><b>NEXT EVIDENCE</b>{item.next_evidence_needed}</p><p><b>PROGRESS</b>{loopProgress(item)}</p><p><b>SOURCE</b><a href={item.source_ref.href} onClick={() => frontdoorEvent('open_loop_source_opened', item.loop_id)}>{item.source_type} ↗</a></p></div>}</details><footer><EvidenceBadge state={loopState} />{item && <span className="fd-loop-progress">{loopProgress(item)}</span>}<FreshnessBadge at={item?.last_changed_at} /><FollowControl follow={follow} following={following} onToggleFollow={onToggleFollow} /><ResearchLink href={target}>Research</ResearchLink></footer></article>;
}

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

export function CallLoop({ data, hideResolvedReturn = false }: { data: Rh4663FrontdoorState | null; hideResolvedReturn?: boolean }) {
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
  const pendingChanges = personal?.submitted_at && data ? (data.change_events ?? []).filter((event) => Date.parse(event.occurred_at) > Date.parse(personal.submitted_at!)).slice(0, 3) : [];
  useEffect(() => { if (resolutionPending && pendingChanges.length) frontdoorEvent('pending_call_changes_viewed', pulse?.window_id); }, [resolutionPending, pendingChanges.length, pulse?.window_id]);

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
    {personal?.has_called && !receipt && resolutionPending && <section className="fd-call-changed"><p>WHAT CHANGED SINCE YOUR CALL?</p>{pendingChanges.length ? pendingChanges.map((event) => <span key={event.event_id}><b>{event.source_type.replaceAll('_', ' ')}</b>{event.headline}</span>) : <span>No global changes have been recorded since this call.</span>}<small>Context only. These changes do not determine the canonical Pulse resolution.</small></section>}
    {!hideResolvedReturn && (effectiveLifecycle === 'RESOLVED_CORRECT' || effectiveLifecycle === 'RESOLVED_INCORRECT' || effectiveLifecycle === 'RESOLVED_OTHER') && personal?.resolution_receipt && <section className="fd-call-resolved" aria-live="polite"><p>YOUR CALL RESOLVED</p><h3>{labelForCall(personal.selection)} {effectiveLifecycle === 'RESOLVED_CORRECT' ? '✓' : ''}</h3><dl><div><dt>OUTCOME</dt><dd>{labelForCall(personal.resolution_receipt.resolved_category)}</dd></div><div><dt>RESULT</dt><dd>{personal.resolution_receipt.outcome}</dd></div><div><dt>CONFIDENCE</dt><dd>{personal.confidence}%</dd></div></dl><p>WHY? The canonical resolution follows the published deterministic observation methodology.</p><a href={`/4663/resolution/${encodeURIComponent(personal.resolution_receipt.receipt_id)}`} onClick={() => callEvent('call_resolution_viewed', personal.window_id)}>View resolution receipt →</a><a href="/4663/pulse" onClick={() => callEvent('call_again_started', personal.window_id)}>Today’s call →</a></section>}
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

const FRONTDOOR_CURSOR_VERSION_KEY = 'infopunks:4663:last_seen_frontdoor_version';
const FRONTDOOR_CURSOR_SEEN_AT_KEY = 'infopunks:4663:last_seen_at';
export type FrontdoorCursor = { version: number; seen_at: string };
export function readFrontdoorCursor(): FrontdoorCursor | null { try { if (typeof window === 'undefined') return null; const version = Number(window.localStorage.getItem(FRONTDOOR_CURSOR_VERSION_KEY)); const seenAt = window.localStorage.getItem(FRONTDOOR_CURSOR_SEEN_AT_KEY); return Number.isSafeInteger(version) && version > 0 && seenAt ? { version, seen_at: seenAt } : null; } catch { return null; } }
export function writeFrontdoorCursor(version: number, seenAt = new Date().toISOString()) { try { if (typeof window === 'undefined' || !Number.isSafeInteger(version) || version < 1) return false; window.localStorage.setItem(FRONTDOOR_CURSOR_VERSION_KEY, String(version)); window.localStorage.setItem(FRONTDOOR_CURSOR_SEEN_AT_KEY, seenAt); return true; } catch { return false; } }

type ResolvedReturn = { call_receipt_id: string; resolution_receipt_id: string; window_id: string; called_category: Rh4663RotationOption; resolved_category: Rh4663RotationOption; outcome: 'CORRECT' | 'INCORRECT'; confidence: number; submitted_at: string; resolved_at: string; deep_link: string };
type MeChangesState = { authenticated: boolean; resolved_call: ResolvedReturn | null; personal_events: Array<{ event_id: string; event_type: string; occurred_at: string; headline: string; deep_link: string }>; pending_call: { call_receipt_id: string; submitted_at: string; changes: FrontdoorChangeEvent[]; context_only: true } | null };

type ReturnHabitContext = ReturnType<typeof useReturnHabit>;
function useReturnHabit(data: Rh4663FrontdoorState | null) {
  const [cursor, setCursor] = useState<FrontdoorCursor | null | undefined>(undefined);
  const [globalChanges, setGlobalChanges] = useState<FrontdoorChangeEvent[]>([]);
  const [personal, setPersonal] = useState<MeChangesState | null>(null);
  useEffect(() => {
    if (!data?.frontdoor_version?.version) return;
    const prior = readFrontdoorCursor(); setCursor(prior);
    const changed = prior && data.frontdoor_version.version > prior.version ? (data.change_events ?? []).filter((event) => event.frontdoor_version > prior.version) : [];
    setGlobalChanges(changed);
    if (prior && data.frontdoor_version.version > prior.version) frontdoorEvent('frontdoor_return_visit');
    writeFrontdoorCursor(data.frontdoor_version.version);
  }, [data?.frontdoor_version?.version]);
  useEffect(() => {
    let cancelled = false;
    const load = async (address?: string) => { try { const path = address ? `/v1/4663/me/changes?wallet=${encodeURIComponent(address)}` : '/v1/4663/me/changes'; const response = await fetch(toApiUrl(getApiBaseUrl(), path), { headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(); const body = await response.json() as { data: MeChangesState }; if (!cancelled) setPersonal(body.data); } catch { if (!cancelled) setPersonal(null); } };
    const ethereum = (window as Window & { ethereum?: { request(args: { method: string }): Promise<unknown> } }).ethereum;
    if (!ethereum) { void load(); return () => { cancelled = true; }; }
    void ethereum.request({ method: 'eth_accounts' }).then((accounts) => load(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined)).catch(() => load());
    return () => { cancelled = true; };
  }, []);
  return { cursor, globalChanges, personal };
}

function ReturnHabitView({ data, context, my }: { data: Rh4663FrontdoorState | null; context: ReturnHabitContext; my?: ReturnType<typeof useMy4663> }) {
  const { cursor, globalChanges, personal } = context;
  useEffect(() => { if (personal?.resolved_call) frontdoorEvent('resolved_call_return_viewed', personal.resolved_call.window_id); }, [personal?.resolved_call?.resolution_receipt_id]);
  useEffect(() => { if (globalChanges.length) frontdoorEvent('return_change_summary_viewed'); }, [globalChanges.length]);
  const resolved = personal?.resolved_call;
  if (!resolved && !globalChanges.length && !my) return cursor === null ? <p className="fd-live-intelligence" role="status">LIVE INTELLIGENCE</p> : null;
  return <section className={`fd-return-summary ${resolved ? 'has-resolved-call' : ''}`} aria-live="polite" aria-labelledby="return-summary-title">
    {resolved && <div className="fd-resolved-return"><p>YOUR CALL RESOLVED</p><h2 id="return-summary-title">{labelForCall(resolved.called_category)} <span>{resolved.outcome === 'CORRECT' ? '✓' : '·'}</span></h2><span>Resolved as {labelForCall(resolved.resolved_category)} · {resolved.confidence}% confidence</span><div><a href={resolved.deep_link} onClick={() => frontdoorEvent('return_change_opened', resolved.window_id)}>View resolution receipt ↗</a><a href="/4663/pulse">Make today’s call →</a></div></div>}
    {my && <My4663Module data={data} my={my} />}
    {globalChanges.length > 0 && <div className="fd-global-return"><p>{resolved ? `${globalChanges.length} OTHER THINGS CHANGED` : `${globalChanges.length} THINGS CHANGED`}</p><h2>{resolved ? 'The research moved while you were away.' : 'Since your last visit.'}</h2><div className="fd-change-list">{globalChanges.slice(0, 3).map((event) => <a key={event.event_id} href={event.deep_link} onClick={() => frontdoorEvent('return_change_opened', event.source_type)}><span><b>{event.source_type.replaceAll('_', ' ')}</b><time>{relativeChanged(event.occurred_at)}</time></span><strong>{event.headline}</strong><small>Source observed {relativeChanged(event.source_observed_at)}</small></a>)}</div></div>}
  </section>;
}

function ReturnHabitWithOwnedData({ data }: { data: Rh4663FrontdoorState | null }) { return <ReturnHabitView data={data} context={useReturnHabit(data)} />; }
export function ReturnHabit({ data, context }: { data: Rh4663FrontdoorState | null; context?: ReturnHabitContext }) { return context ? <ReturnHabitView data={data} context={context} /> : <ReturnHabitWithOwnedData data={data} />; }

function relativeChanged(value: string | null) { if (!value) return 'unknown'; const age = Math.max(0, Date.now() - Date.parse(value)); if (!Number.isFinite(age)) return 'unknown'; const minutes = Math.floor(age / 60_000); return minutes < 2 ? 'now' : minutes < 60 ? `${minutes}m ago` : minutes < 1_440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1_440)}d ago`; }

const MY_4663_FOLLOWS_KEY = 'infopunks:4663:follows';
const MY_4663_CURSOR_KEY = 'infopunks:4663:last_seen_my4663_event_id';
const FOLLOW_CAP = 50;
type My4663State = { object_type: 'MY_4663_STATE'; follows: Array<My4663FollowInput & { follow_id: string; display_label: string; source_ref: { href: string } | null }>; changed_followed_subjects: Array<{ follow_id: string; display_label: string; event: FrontdoorChangeEvent }>; followed_open_loops: OpenLoop[]; followed_now_items: Rh4663FrontdoorState['now_cards']; last_seen_my4663_event_id: string | null };
function followKey(subject: FollowSubject) { return `${subject.subject_type}:${subject.subject_id.toUpperCase()}`; }
function readLocalFollows(): My4663FollowInput[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MY_4663_FOLLOWS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((item): item is My4663FollowInput => Boolean(item && typeof item === 'object' && ['STOCK_TOKEN', 'MISSION_TOKEN', 'RMM_CASE', 'WATCH_CASE', 'OPEN_LOOP', 'RESEARCH_TOPIC'].includes((item as My4663FollowInput).subject_type) && typeof (item as My4663FollowInput).subject_id === 'string' && typeof (item as My4663FollowInput).created_at === 'string')).slice(0, FOLLOW_CAP);
    // Self-heal stale/corrupt storage without ever putting canonical data here.
    if (valid.length !== parsed.length) window.localStorage.setItem(MY_4663_FOLLOWS_KEY, JSON.stringify(valid));
    return [...new Map(valid.map((item) => [followKey(item), { ...item, subject_id: item.subject_id.toUpperCase() }])).values()].slice(0, FOLLOW_CAP);
  } catch { return []; }
}
function writeLocalFollows(follows: My4663FollowInput[]) { try { window.localStorage.setItem(MY_4663_FOLLOWS_KEY, JSON.stringify(follows.slice(0, FOLLOW_CAP))); return true; } catch { return false; } }
function useMy4663(data: Rh4663FrontdoorState | null) {
  const [follows, setFollows] = useState<My4663FollowInput[]>(readLocalFollows);
  const [state, setState] = useState<My4663State | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const cursor = (() => { try { return window.localStorage.getItem(MY_4663_CURSOR_KEY); } catch { return null; } })();
    const query = new URLSearchParams({ follows: JSON.stringify(follows) }); if (cursor) query.set('last_seen_my4663_event_id', cursor);
    void fetch(toApiUrl(getApiBaseUrl(), `/v1/4663/me?${query.toString()}`), { headers: { accept: 'application/json' } })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ data: My4663State }>; })
      .then((body) => { if (!cancelled && body.data?.object_type === 'MY_4663_STATE') { setState(body.data); try { if (body.data.last_seen_my4663_event_id) window.localStorage.setItem(MY_4663_CURSOR_KEY, body.data.last_seen_my4663_event_id); } catch { /* cursor is an enhancement */ } } })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
  }, [data?.frontdoor_version?.version, refresh]);
  useEffect(() => { if (state) { frontdoorEvent('my4663_viewed'); if (state.changed_followed_subjects.length) frontdoorEvent('followed_subject_return'); } }, [state?.last_seen_my4663_event_id]);
  const toggle = (subject: FollowSubject) => {
    const key = followKey(subject); const existing = follows.some((item) => followKey(item) === key);
    if (existing) {
      const next = follows.filter((item) => followKey(item) !== key); setFollows(next); writeLocalFollows(next); setAnnouncement('Unfollowed.'); frontdoorEvent('follow_removed');
    } else if (follows.length >= FOLLOW_CAP) setAnnouncement('Follow limit reached.');
    else {
      const next = [...follows, { ...subject, subject_id: subject.subject_id.toUpperCase(), created_at: new Date().toISOString() }]; setFollows(next); writeLocalFollows(next); setAnnouncement('Following.'); frontdoorEvent('follow_created');
    }
    setRefresh((value) => value + 1);
  };
  return { follows, state, toggle, announcement };
}
function subjectForCard(card: Rh4663FrontdoorState['now_cards'][number] | Rh4663FrontdoorState['watch_cards'][number]): FollowSubject | null {
  if (card.id === 'pltr-preflight' || card.source_type === 'pltr_preflight') return { subject_type: 'STOCK_TOKEN', subject_id: 'PLTR' };
  if (card.id === 'rmm-census' || card.source_type === 'rmm_census') return { subject_type: 'MISSION_TOKEN', subject_id: 'RMM' };
  if (card.source_ref.source_id === 'AI_NVDA_CAPITAL_VS_FLOW') return { subject_type: 'WATCH_CASE', subject_id: 'AI_NVDA_CAPITAL_VS_FLOW' };
  if (card.source_ref.source_id === 'BONER_HIMS_FLOAT_STRESS') return { subject_type: 'WATCH_CASE', subject_id: 'BONER_HIMS_FLOAT_STRESS' };
  return null;
}
function My4663Module({ data, my }: { data: Rh4663FrontdoorState | null; my: ReturnType<typeof useMy4663> }) {
  const changed = my.state?.changed_followed_subjects ?? [];
  const following = (subject: FollowSubject | null) => Boolean(subject && my.follows.some((item) => followKey(item) === followKey(subject)));
  const suggestions: Array<{ label: string; subject: FollowSubject }> = [
    { label: 'PLTR', subject: { subject_type: 'STOCK_TOKEN' as const, subject_id: 'PLTR' } },
    { label: 'AI/NVDA', subject: { subject_type: 'WATCH_CASE' as const, subject_id: 'AI_NVDA_CAPITAL_VS_FLOW' } },
    { label: 'RMM', subject: { subject_type: 'MISSION_TOKEN' as const, subject_id: 'RMM' } }
  ].filter((item) => item.label !== 'PLTR' || Boolean(data?.now_cards.some((card) => subjectForCard(card)?.subject_id === 'PLTR'))).filter((item) => item.label !== 'AI/NVDA' || Boolean(data?.watch_cards.some((card) => subjectForCard(card)?.subject_id === 'AI_NVDA_CAPITAL_VS_FLOW') || data?.open_loops.some((loop) => loop.source_type === 'AI_NVDA_CAPITAL_VS_FLOW'))).filter((item) => item.label !== 'RMM' || Boolean(data?.now_cards.some((card) => subjectForCard(card)?.subject_id === 'RMM'))).slice(0, 3);
  if (!my.follows.length) return <section className="fd-my4663 fd-my4663-empty" aria-labelledby="my4663-title"><div><p>MY 4663</p><h2 id="my4663-title">Follow what matters.</h2><span>Follow the markets and research questions you care about.</span></div><div className="fd-my4663-suggestions">{suggestions.map((item) => <button key={item.label} type="button" onClick={() => my.toggle(item.subject)}>{item.label}<span>FOLLOW</span></button>)}</div><span className="fd-follow-status" role="status" aria-live="polite">{my.announcement}</span></section>;
  if (!changed.length) return <section className="fd-my4663" aria-labelledby="my4663-title"><div><p>MY 4663</p><h2 id="my4663-title">Following {my.follows.length} {my.follows.length === 1 ? 'subject' : 'subjects'}.</h2><span>Return when the research changes.</span></div><span className="fd-follow-status" role="status" aria-live="polite">{my.announcement}</span></section>;
  const resolved = changed.find((item) => item.event.change_type === 'RESOLVED');
  return <section className="fd-my4663 is-changed" aria-labelledby="my4663-title"><div><p>{resolved ? `${resolved.display_label} RESOLVED` : `${changed.length} ${changed.length === 1 ? 'THING YOU FOLLOW CHANGED' : 'THINGS YOU FOLLOW CHANGED'}`}</p><h2 id="my4663-title">{resolved ? resolved.event.headline : 'This changed.'}</h2></div><div className="fd-my4663-list">{changed.slice(0, 4).map((item) => <a key={`${item.follow_id}:${item.event.event_id}`} href={item.event.deep_link} onClick={() => frontdoorEvent('followed_change_viewed')}><b>{item.display_label}</b><strong>{item.event.headline}</strong><small>{item.event.change_type.replaceAll('_', ' ')}</small></a>)}</div><span className="fd-follow-status" role="status" aria-live="polite">{my.announcement}</span></section>;
}

export function FrontdoorShell({ children, freshness }: { children: React.ReactNode; freshness?: string | null }) {
  return <div className="fd-shell"><a className="fd-skip" href="#now">Skip to now</a><header className="fd-topbar"><a href="/4663" className="fd-mark" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>4663</b></a><div className="fd-topbar-status"><span><i aria-hidden="true" /> <FreshnessBadge at={freshness} /></span><a href="#call">Call</a></div></header><nav className="fd-nav" aria-label="Primary navigation"><a href="#now">Now</a><a href="#watch">Watch</a><a href="#call">Call</a><a href="#proof">Proof</a></nav>{children}</div>;
}

export function Frontdoor({ data, status, message }: { data: Rh4663FrontdoorState | null; status: 'loading' | 'ready' | 'degraded'; message?: string }) {
  const unavailable = !data;
  const systemMessage = data?.system_status?.state === 'partial' ? 'Some research sources are temporarily unavailable. Available evidence remains shown.' : null;
  const currentCall = data?.current_call ?? { window_id: 'unavailable', state: 'UNRESOLVED', leading_rotation: null, total_calls: 0, opens_at: '', closes_at: '', deep_link: '/4663/pulse', source_ref: { source_type: 'pulse_window', source_id: 'unavailable', href: '/v1/4663/pulse', observed_at: null } };
  const proof = data?.proof_summary ?? { total_calls: 0, resolved_calls: null, note: 'Personal proof is available after a signed CALL.', deep_link: '/4663/receipts', source_ref: currentCall.source_ref };
  const returnContext = useReturnHabit(data);
  const my = useMy4663(data);
  const follows = (subject: FollowSubject | null) => Boolean(subject && my.follows.some((item) => followKey(item) === followKey(subject)));
  return <FrontdoorShell freshness={data?.freshness?.source_observed_at}><main className="fd-main"><section className="fd-hero" aria-labelledby="fd-title"><p>INFOPUNKS / ROBINHOOD CHAIN</p><h1 id="fd-title">Robinhood Chain,<br />right now.</h1><span>Signal extraction for the agentic economy. Before an agent spends, it checks Infopunks.</span></section>{(status !== 'ready' || systemMessage) && <p className={`fd-data-state ${status === 'degraded' ? 'is-degraded' : ''}`} role="status">{status === 'loading' ? 'Refreshing reviewed intelligence…' : systemMessage ?? `Data degraded. ${message ?? 'No market conclusion is inferred.'}`}</p>}<ReturnHabitView data={data} context={returnContext} my={my} /><section id="now" className="fd-section" aria-labelledby="now-title"><SectionHeader id="now-title" title="NOW" question="What matters right now?" action={<FreshnessBadge at={data?.freshness?.source_observed_at} />} /><div className="fd-now-grid">{data?.now_cards?.slice(0, 5).map((card) => { const subject = subjectForCard(card); return <NowCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} delta={card.delta ?? undefined} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} follow={subject} following={follows(subject)} onToggleFollow={my.toggle} />; }) ?? null}{unavailable && <p className="fd-empty">No derived market state is available yet.</p>}</div></section><section id="watch" className="fd-section" aria-labelledby="watch-title"><SectionHeader id="watch-title" title="WATCH" question="What is developing?" action={<ResearchLink href="/4663/reflexive/watch">All cases</ResearchLink>} /><div className="fd-watch-grid">{data?.watch_cards?.slice(0, 4).map((card) => { const subject = subjectForCard(card); return <WatchCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} follow={subject} following={follows(subject)} onToggleFollow={my.toggle} />; }) ?? null}{data && !data.watch_cards?.length && <p className="fd-empty">No developing cases are ready to surface.</p>}</div></section><section className="fd-section" aria-labelledby="loops-title"><SectionHeader id="loops-title" title="OPEN LOOPS" question="What still needs to be proved?" /><div className="fd-loop-grid">{data?.open_loops?.slice(0, 4).map((loop) => <OpenLoopCard key={loop.loop_id} loop={loop} following={follows({ subject_type: 'OPEN_LOOP', subject_id: loop.loop_id })} onToggleFollow={my.toggle} />) ?? null}{data && !data.open_loops?.length && <p className="fd-empty">No unresolved research loops are available.</p>}</div></section><CallLoop data={data} hideResolvedReturn={Boolean(returnContext.personal?.resolved_call)} /><section className="fd-section fd-proof-section" aria-labelledby="proof-title"><SectionHeader id="proof-title" title="PROOF" question="How good is your record?" /><ProofCard proof={proof} /></section></main><footer className="fd-footer"><p>Research stays deep until you ask for it.</p><details><summary>Open research</summary><div><a href="/4663/reflexive">Reflexive Radar</a><a href="/4663/reflexive/watch">Watch cases</a><a href="/4663/reflexive/census">Category Census</a><a href="/4663/reflexive/preflight/ipx-pltr">PLTR Preflight</a><a href="/4663/receipts">CALL + RESOLUTION receipts</a><a href="/rh-chain-signal-desk">Robinhood Chain desk</a></div></details></footer></FrontdoorShell>;
}

function rotationLabel(value: string) { return value.replaceAll('_', ' '); }
