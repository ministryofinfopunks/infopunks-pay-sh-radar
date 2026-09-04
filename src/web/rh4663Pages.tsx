import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { Rh4663CallReceipt, Rh4663RotationOption, Rh4663Signal, Rh4663SignalCategory, Rh4663TodayEdition } from '../services/rh4663Service';
import type { Rh4663MerkleProof, Rh4663ProofProfile, Rh4663ResolutionReceipt } from '../services/rh4663ResolutionService';
import type { Published4663Signal } from '../services/rh4663IntelligenceService';
import { Frontdoor } from './frontdoor4663';
import type { Rh4663FrontdoorState } from '../services/rh4663FrontdoorService';
import type { Rh4663ShareObject } from '../services/rh4663ShareObjectService';
import './rh4663.css';

const API_BASE_URL = getApiBaseUrl();
const ROTATIONS: Array<{ value: Rh4663RotationOption; label: string }> = [
  { value: 'MEMES', label: 'Memes' }, { value: 'STOCK_TOKENS', label: 'Stock Tokens' }, { value: 'RWA_DEFI', label: 'RWA / DeFi' }, { value: 'STABLES', label: 'Stables' }, { value: 'NO_QUALIFIED_ROTATION', label: 'No Qualified Rotation' }
];
const SIGNAL_CATEGORIES: Rh4663SignalCategory[] = ['meme', 'nft_culture', 'utility', 'agent', 'stock_token', 'defi', 'wallet', 'liquidity', 'risk', 'integration', 'other'];

type PulseData = { window: { window_id: string; opens_at: string; closes_at: string }; consensus: { total_calls: number; leading_rotation: Rh4663RotationOption | null; confidence_average: number | null; state: string; counts?: Record<Rh4663RotationOption, number>; percentages?: Record<Rh4663RotationOption, number> }; options: Rh4663RotationOption[] };
type GenesisData = { limit: number; recorded: number; remaining: number; progress: number; policy: string };
type ReputationEvidence = { window_id: string; call_receipt_id: string; resolution_receipt_id: string | null; called_category: Rh4663RotationOption; resolved_category: Rh4663RotationOption | null; outcome: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED'; confidence: number; genesis_ordinal: number | null };
type Reputation = { wallet: string; calls: number; resolved_calls: number; correct_calls: number; accuracy: number | null; current_streak: number; genesis_position: number | null; evidence: ReputationEvidence[] };
type TodayPulse = { current: PulseData['consensus']; prior: { consensus: PulseData['consensus']; resolution: { window_id: string; resolved_category: Rh4663RotationOption; consensus_correct: boolean; resolution_path: string } | null }; precision_notice: string | null };
type PrintMetric = { id: string; label: string; value: string; unit: string; qualifier?: string; source: { label: string; href: string }; window_type: string; observed_at: string; window_start: string; window_end: string; methodology: string; freshness: string; confidence: number };
type PrintData = { print_id: string; canonical_path: string; printed_at: string; status: string; receipt_kind: string; campaign_snapshot: boolean; data_mode: string; title: string; regime: string; methodology_notice: string; correction_notice: string; metrics: PrintMetric[]; drivers: Array<{ category: string; direction: string; detail: string }>; layer_read: Array<{ layer: string; state: string; direction: string; explanation: string; evidence_ids: string[] }>; evidence_references: Array<{ id: string; label: string; href: string; note: string }>; campaign_copy: { primary: string; secondary: string; call_to_action: string; receipt_line: string }; share: { landscape: string; square: string; portrait: string }; interpretation: string; call: { question: string; evidence_path: string; default_confidence: number } };
type WindowView = { window: PulseData['window']; state: string; consensus: PulseData['consensus']; resolution: { resolved_category: Rh4663RotationOption; consensus: PulseData['consensus']; observations: unknown[] } | null };

type CampaignEvent = '4663_print_viewed' | '4663_print_provenance_opened' | '4663_make_call_clicked' | '4663_call_started' | '4663_call_signed' | '4663_call_accepted' | '4663_call_share_clicked' | '4663_call_share_completed' | '4663_consensus_viewed' | '4663_resolution_viewed' | '4663_resolution_shared' | '4663_returning_caller' | 'share_clicked' | 'share_link_copied' | 'share_text_copied' | 'share_native_completed' | 'share_card_viewed' | 'social_landing_viewed' | 'social_landing_source_opened' | 'social_landing_call_started' | 'social_landing_follow_created' | 'social_landing_proof_opened';
type CampaignData = { surface: 'print' | 'pulse' | 'call' | 'consensus' | 'resolution' | 'home' | 'now' | 'watch' | 'open_loop' | 'proof' | 'census' | 'radar' | 'shadow' | 'social_landing'; print_id?: string; window_id?: string; share_object_id?: string; share_source?: 'NOW' | 'WATCH' | 'OPEN_LOOP' | 'CALL' | 'PROOF' | 'CENSUS' | 'RADAR' | 'SHADOW' };
function trackCampaign(event: CampaignEvent, data: CampaignData) {
  const payload = JSON.stringify({ event, ...data }); const endpoint = toApiUrl(API_BASE_URL, '/v1/4663/campaign/events');
  if (navigator.sendBeacon) { navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' })); return; }
  void fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => undefined);
}

function useApi<T>(path: string, refresh = 0) {
  const [state, setState] = useState<{ data: T | null; status: 'loading' | 'ready' | 'degraded'; message?: string }>({ data: null, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 4_000);
    fetch(toApiUrl(API_BASE_URL, path), { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<{ data: T }>; })
      .then((body) => setState({ data: body.data, status: 'ready' }))
      .catch(() => setState({ data: null, status: 'degraded', message: 'Persisted intelligence is temporarily unavailable.' }))
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [path, refresh]);
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
  const shareId = path.match(/^\/4663\/share\/([^/]+)$/)?.[1];
  const proofId = path.match(/^\/4663\/proof\/([^/]+)$/)?.[1];
  const proofWallet = path.match(/^\/4663\/proof\/(0x[0-9a-fA-F]{40})$/)?.[1];
  const callId = path.match(/^\/4663\/call\/([^/]+)$/)?.[1];
  const resolutionId = path.match(/^\/4663\/resolution\/([^/]+)$/)?.[1];
  const consensusWindowId = path.match(/^\/4663\/consensus\/([^/]+)$/)?.[1];
  const signalId = path.match(/^\/4663\/signals\/([^/]+)$/)?.[1];
  const printId = path.match(/^\/4663\/print\/([^/]+)$/)?.[1];
  const view = proofWallet ? 'proof_profile' : proofId || callId || resolutionId ? 'proof' : consensusWindowId ? 'consensus' : signalId ? 'signal_detail' : printId ? 'print' : path === '/4663/pulse' ? 'pulse' : path === '/4663/today' ? 'today' : path === '/4663/signals' ? 'signals' : path === '/4663/receipts' ? 'receipts' : 'home';
  if (shareId) return <SocialLanding shareObjectId={decodeURIComponent(shareId)} />;
  if (view === 'home') return <Home />;
  return <div className="i4663-app">
    <header className="i4663-header">
      <a className="i4663-wordmark" href="/4663" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>//4663</b></a>
      <a className="i4663-radar-link" href="/rh-chain-signal-desk">RH DESK ↗</a>
    </header>
    <nav className="i4663-nav" aria-label="4663 navigation"><a href="/4663#now">Now</a><a href="/4663#watch">Watch</a><a href="/4663#call">Call</a><a href="/4663#proof">Proof</a></nav>
    {view === 'print' && printId ? <Print printId={decodeURIComponent(printId)} /> : view === 'pulse' ? <Pulse /> : view === 'consensus' && consensusWindowId ? <ConsensusPage windowId={decodeURIComponent(consensusWindowId)} /> : view === 'today' ? <Today /> : view === 'signals' ? <Signals /> : view === 'signal_detail' && signalId ? <SignalProofPage signalId={decodeURIComponent(signalId)} /> : view === 'proof_profile' && proofWallet ? <ProofProfilePage wallet={proofWallet} /> : view === 'proof' && (proofId || callId || resolutionId) ? <ProofPage receiptId={decodeURIComponent(proofId ?? callId ?? resolutionId ?? '')} campaignRoute={callId ? 'call' : resolutionId ? 'resolution' : 'proof'} /> : <Receipts />}
    <footer className="i4663-footer"><span>AFTER ATTENTION, INTELLIGENCE.</span><span>UTC / RH CHAIN / PUBLIC MEMORY</span></footer>
  </div>;
}

function Home() {
  const { data, status, message } = useApi<Rh4663FrontdoorState>('/v1/4663/frontdoor');
  return <Frontdoor data={data} status={status} message={message} />;
}

function SocialLanding({ shareObjectId }: { shareObjectId: string }) {
  const api = useApi<Rh4663ShareObject>(`/v1/4663/share/${encodeURIComponent(shareObjectId)}`); const object = api.data;
  useEffect(() => { if (object) trackCampaign('social_landing_viewed', { surface: 'social_landing', share_object_id: object.share_object_id, share_source: shareSource(object.share_type) }); }, [object]);
  if (!object) return <main className="i4663-social-shell"><a className="i4663-wordmark" href="/4663"><span>INFOPUNKS</span><b>//4663</b></a><DataState status={api.status} message={api.message} /></main>;
  const action = socialAction(object);
  return <main className="i4663-social-shell" aria-labelledby="social-object-title">
    <header><a className="i4663-wordmark" href="/4663" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>//4663</b></a><ShareControl object={object} /></header>
    <article className="i4663-social-object">
      <p className="i4663-micro">//4663 · {object.share_type.replaceAll('_', ' ')}</p>
      <section className="i4663-social-answer"><p className="i4663-social-question">WHAT HAPPENED?</p><h1 id="social-object-title">{object.primary_statement}</h1>{object.primary_metric && <strong className="i4663-social-metric">{object.primary_metric}</strong>}</section>
      <section className="i4663-social-answer"><p className="i4663-social-question">WHY DOES IT MATTER?</p><p className="i4663-social-summary">{object.secondary_statement ?? 'The public source record remains inspectable.'}</p></section>
      <dl className="i4663-social-facts"><div><dt>HOW CERTAIN ARE WE?</dt><dd>{object.evidence_state}</dd><small>{object.source_freshness ?? 'SOURCE FRESHNESS UNAVAILABLE'}</small></div><div><dt>{object.share_type.includes('RESOLUTION') ? 'RESOLVED' : 'OBSERVED'}</dt><dd>{object.observed_at ? machineTime(object.observed_at) : 'SOURCE TIME UNAVAILABLE'}</dd></div><div><dt>WHERE IS THE PROOF?</dt><dd><a href={object.source_ref.href} target={object.source_ref.href.startsWith('/') ? undefined : '_blank'} rel={object.source_ref.href.startsWith('/') ? undefined : 'noreferrer'} onClick={() => trackCampaign('social_landing_source_opened', { surface: 'social_landing', share_object_id: object.share_object_id, share_source: shareSource(object.share_type) })}>{object.source_ref.source_type.replaceAll('_', ' ')}</a></dd></div></dl>
      <a className="i4663-primary-action" href={action.href} onClick={() => trackCampaign(action.event, { surface: 'social_landing', share_object_id: object.share_object_id, share_source: shareSource(object.share_type) })}>{action.label} <span>↗</span></a>
    </article>
    <section className="i4663-social-deeper"><p className="i4663-micro">WHY IT MATTERS</p><p>Infopunks separates what is being watched from what Radar has verified. The source record remains inspectable.</p><a href={object.deep_link}>OPEN THE FULL EVIDENCE →</a></section>
  </main>;
}

function ShareControl({ object }: { object: Rh4663ShareObject }) {
  const [open, setOpen] = useState(false); const [notice, setNotice] = useState('');
  const telemetry = (event: Extract<CampaignEvent, 'share_clicked' | 'share_link_copied' | 'share_text_copied' | 'share_native_completed' | 'share_card_viewed'>) => trackCampaign(event, { surface: 'social_landing', share_object_id: object.share_object_id, share_source: shareSource(object.share_type) });
  async function nativeShare() { telemetry('share_clicked'); if (navigator.share) { try { await navigator.share({ title: object.title, text: object.share_text, url: object.canonical_url }); telemetry('share_native_completed'); setNotice('Share sheet closed.'); } catch { /* cancellation is not an error */ } return; } setOpen((value) => !value); }
  async function copy(value: string, event: 'share_link_copied' | 'share_text_copied', label: string) { try { await navigator.clipboard.writeText(value); telemetry(event); setNotice(label); } catch { setNotice('Copy is unavailable in this browser.'); } }
  return <div className="i4663-share-control"><button type="button" onClick={nativeShare} aria-expanded={open} aria-controls="share-menu">SHARE</button>{open && <div className="i4663-share-menu" id="share-menu" role="menu"><button type="button" role="menuitem" onClick={() => void copy(object.canonical_url, 'share_link_copied', 'Link copied.')}>COPY LINK</button><button type="button" role="menuitem" onClick={() => void copy(object.share_text, 'share_text_copied', 'Summary copied.')}>COPY SUMMARY</button><a role="menuitem" href={object.og_image_url} target="_blank" rel="noreferrer" onClick={() => telemetry('share_card_viewed')}>VIEW CARD</a></div>}<span className="sr-only" role="status" aria-live="polite">{notice}</span></div>;
}

function shareSource(type: Rh4663ShareObject['share_type']): CampaignData['share_source'] { if (type === 'NOW_FINDING' || type === 'FRONTDOOR_CHANGE_EVENT') return 'NOW'; if (type === 'WATCH_CASE') return 'WATCH'; if (type === 'OPEN_LOOP' || type === 'AI_NVDA_CHECKPOINT' || type === 'RADAR_FALSIFICATION') return 'OPEN_LOOP'; if (type === 'CALL_RECEIPT' || type === 'RESOLUTION_RECEIPT') return 'CALL'; if (type === 'PROOF_PROFILE') return 'PROOF'; if (type === 'RMM_CENSUS_OBSERVATION') return 'CENSUS'; if (type === 'PLTR_SHADOW_OBSERVATION') return 'SHADOW'; return 'RADAR'; }
function socialAction(object: Rh4663ShareObject) { if (object.share_type === 'CALL_RECEIPT' || object.share_type === 'RESOLUTION_RECEIPT') return { label: 'MAKE YOUR OWN CALL', href: '/4663/pulse', event: 'social_landing_call_started' as const }; if (object.share_type === 'WATCH_CASE') return { label: 'FOLLOW CASE', href: object.deep_link, event: 'social_landing_follow_created' as const }; if (object.share_type === 'OPEN_LOOP' || object.share_type === 'AI_NVDA_CHECKPOINT') return { label: 'FOLLOW QUESTION', href: object.deep_link, event: 'social_landing_follow_created' as const }; if (object.share_type === 'PROOF_PROFILE') return { label: 'VIEW PROOF', href: object.deep_link, event: 'social_landing_proof_opened' as const }; if (object.share_type === 'RMM_CENSUS_OBSERVATION') return { label: 'VIEW CATEGORY', href: object.deep_link, event: 'social_landing_source_opened' as const }; return { label: 'VIEW EVIDENCE', href: object.deep_link, event: 'social_landing_source_opened' as const }; }

function Print({ printId }: { printId: string }) {
  const api = useApi<PrintData>(`/v1/4663/prints/${encodeURIComponent(printId)}`);
  const print = api.data;
  useEffect(() => { if (print) trackCampaign('4663_print_viewed', { surface: 'print', print_id: print.print_id }); }, [print]);
  const heroMetrics = print?.metrics.filter((metric) => ['transactions', 'utc_dex_volume', 'rolling_dex_volume', 'pons_volume'].includes(metric.id)) ?? [];
  const pons = print?.metrics.find((metric) => metric.id === 'pons_volume'); const dex = print?.metrics.find((metric) => metric.id === 'utc_dex_volume');
  const campaignCopy = print?.campaign_copy ?? { primary: 'THE CHAIN WAS BUILT FOR STOCKS.', secondary: 'THE INTERNET STARTED TRADING ATTENTION.', call_to_action: 'WHAT OWNS THE NEXT 24 HOURS?', receipt_line: 'EVERYONE HAS AN OPINION. INFOPUNKS HAS THE RECEIPT.' };
  async function sharePrint() {
    if (!print) return;
    const url = new URL(print.canonical_path, window.location.origin).toString(); const text = `${campaignCopy.primary}\n${campaignCopy.secondary}\n${pons?.value ?? '$445.98M'} / ${dex?.value ?? '$874.8M'}\n${url}`;
    try { if (navigator.share) await navigator.share({ title: '//4663 PRINT', text, url }); else await navigator.clipboard.writeText(text); } catch { /* A cancelled native sheet is not an error state. */ }
  }
  return <main className="i4663-main i4663-subpage i4663-print">
    <PageHead index="PRINT" title="//4663 PRINT 0830" lede={print?.campaign_snapshot ? 'CAMPAIGN SNAPSHOT / MARKET-STATE EVIDENCE' : print?.receipt_kind.replaceAll('_', ' ') ?? 'MARKET-STATE EVIDENCE'} />
    <DataState status={api.status} message={api.message} />
    {print ? <>
      <section className="i4663-print-head"><p className="i4663-micro">//4663 PRINT · AUG 30 / REGIME <b>{print.regime}</b></p><h2>{print.title}</h2><p>5.52M transactions. ~$875M UTC-day DEX volume. Launchpad activity dominated the tape while financial infrastructure kept expanding underneath it.</p><small>{print.correction_notice}</small></section>
      <section className="i4663-print-metrics" aria-label="Market-state evidence">{heroMetrics.map((metric) => <MetricEvidence key={metric.id} metric={metric} featured />)}</section>
      {pons && dex && <section className="i4663-pons-share"><p className="i4663-micro">THE SHAREABLE FACT</p><h2>ONE LAUNCHPAD TOUCHED ROUGHLY HALF THE DAY'S DEX FLOW.</h2><div><span><small>PONS.FAMILY</small><strong>{pons.value}</strong></span><i>÷</i><span><small>ROBINHOOD CHAIN</small><strong>{dex.value}</strong></span><b>≈51%</b></div><p>Based on the selected Aug 30 UTC source/window. <button type="button" onClick={() => { const node = document.getElementById('pons-volume-provenance'); node?.querySelector('details')?.setAttribute('open', ''); node?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>TAP FOR PROVENANCE</button></p><button className="i4663-secondary-action" type="button" onClick={sharePrint}>SHARE THE FACT ↗</button></section>}
      <section className="i4663-print-delta" aria-labelledby="calendar-ath-title"><h2 id="calendar-ath-title">WINDOW DISCIPLINE</h2>{print.metrics.filter((metric) => metric.id === 'calendar_day_ath').map((metric) => <MetricEvidence key={metric.id} metric={metric} />)}<p>{print.methodology_notice}</p></section>
      <section className="i4663-layer-read"><p className="i4663-micro">MARKET LAYER READ</p>{(print.layer_read ?? []).map((layer) => <article key={layer.layer}><div><strong>{layer.layer}</strong><b>{layer.state}</b></div><i>{layer.direction}</i><p>{layer.explanation}</p>{layer.evidence_ids?.length ? <footer>{layer.evidence_ids.map((id) => { const reference = print.evidence_references?.find((item) => item.id === id); return reference ? <a key={id} href={reference.href} onClick={() => trackCampaign('4663_print_provenance_opened', { surface: 'print', print_id: print.print_id })}>{reference.label} ↗</a> : <span key={id}>{id}</span>; })}</footer> : null}</article>)}</section>
      <section className="i4663-print-thesis"><p className="i4663-micro">RADAR INTELLIGENCE</p><h2>{print.interpretation}</h2><p>The interesting question is not whether RWAs disappear. It is which economic layer absorbs the next marginal dollar, transaction and unit of attention.</p></section>
      <section className="i4663-print-call"><p className="i4663-micro">NEXT 24H // MAKE THE CALL</p><h2>{campaignCopy.call_to_action}</h2><p>{print.call.question} Sign your view before the window closes. Infopunks remembers the call and resolves it against the published methodology.</p><a className="i4663-primary-action" href={`/4663/pulse?evidence=${encodeURIComponent(print.canonical_path)}&confidence=${print.call.default_confidence}`} onClick={() => trackCampaign('4663_make_call_clicked', { surface: 'print', print_id: print.print_id })}>MAKE THE CALL <span>↗</span></a></section>
    </> : <Empty text="This PRINT is not available. No market state is inferred." />}
  </main>;
}

function MetricEvidence({ metric, featured = false }: { metric: PrintMetric; featured?: boolean }) {
  return <article id={metric.id === 'pons_volume' ? 'pons-volume-provenance' : undefined} className={`i4663-metric-evidence${featured ? ' is-featured' : ''}`}>
    <p>{metric.label}{metric.qualifier && <b>{metric.qualifier}</b>}</p><strong>{metric.value}</strong><span>{metric.unit}</span>
    <details><summary>PROVENANCE · {(metric.window_type ?? 'reported_observation').replaceAll('_', ' ').toUpperCase()}</summary><a href={metric.source.href} target="_blank" rel="noreferrer" onClick={() => trackCampaign('4663_print_provenance_opened', { surface: 'print', print_id: 'rh-print-2026-08-30' })}>{metric.source.label} ↗</a><dl><div><dt>OBSERVED</dt><dd>{machineTime(metric.observed_at)}</dd></div><div><dt>WINDOW</dt><dd>{(metric.window_type ?? 'reported_observation').replaceAll('_', ' ').toUpperCase()} · {machineTime(metric.window_start)} → {machineTime(metric.window_end)}</dd></div><div><dt>METHOD</dt><dd>{metric.methodology}</dd></div><div><dt>STATE</dt><dd>{metric.freshness.toUpperCase()} / {metric.confidence}% CONF.</dd></div></dl></details>
  </article>;
}

function Pulse() {
  const [pulseRefresh, setPulseRefresh] = useState(0);
  const api = useApi<PulseData>('/v1/4663/pulse', pulseRefresh);
  const [wallet, setWallet] = useState<string | null>(null); const [reputationRefresh, setReputationRefresh] = useState(0);
  const reputation = useOptionalApi<Reputation>(wallet ? `/v1/4663/pulse/reputation/${encodeURIComponent(wallet)}` : null, reputationRefresh);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [rotation, setRotation] = useState<Rh4663RotationOption>('MEMES'); const [confidence, setConfidence] = useState(() => Math.min(100, Math.max(1, Number(params.get('confidence')) || 70))); const [digest, setDigest] = useState('');
  const [result, setResult] = useState<{ state: 'idle' | 'working' | 'success' | 'error'; message?: string; receipt?: Rh4663CallReceipt }>({ state: 'idle' });
  useEffect(() => { const ethereum = (window as Window & { ethereum?: { request(args: { method: string }): Promise<unknown> } }).ethereum; if (!ethereum) return; void ethereum.request({ method: 'eth_accounts' }).then((accounts) => { const walletAddress = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null; setWallet(walletAddress); }).catch(() => undefined); }, []);
  async function makeCall() {
    setResult({ state: 'working', message: 'Requesting wallet signature…' });
    trackCampaign('4663_call_started', { surface: 'pulse', window_id: api.data?.window.window_id });
    try {
      const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error('No EVM wallet found. Open 4663 in a wallet-enabled browser.');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[]; const connectedWallet = accounts[0]; if (!connectedWallet) throw new Error('Wallet access was not granted.'); setWallet(connectedWallet);
      const payloadResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/payload'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id }) });
      const payloadBody = await payloadResponse.json() as { data?: { canonical_serialization: string }; error?: string }; if (!payloadResponse.ok || !payloadBody.data) throw new Error(readableError(payloadBody.error));
      const signature = await ethereum.request({ method: 'personal_sign', params: [payloadBody.data.canonical_serialization, connectedWallet] });
      trackCampaign('4663_call_signed', { surface: 'pulse', window_id: api.data?.window.window_id });
      const callResponse = await fetch(toApiUrl(API_BASE_URL, '/v1/4663/pulse/calls'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: connectedWallet, rotation, confidence, evidence_digest: digest || null, window_id: api.data?.window.window_id, signature }) });
      const callBody = await callResponse.json() as { data?: Rh4663CallReceipt; error?: string }; if (!callResponse.ok || !callBody.data) throw new Error(readableError(callBody.error));
      setResult({ state: 'success', message: 'Call recorded. The receipt will not change.', receipt: callBody.data }); setReputationRefresh((value) => value + 1); setPulseRefresh((value) => value + 1); trackCampaign('4663_call_accepted', { surface: 'call', window_id: callBody.data.window_id });
    } catch (error) { setResult({ state: 'error', message: error instanceof Error ? error.message : 'Call could not be recorded.' }); }
  }
  return <main className="i4663-main i4663-subpage">
    <PageHead index="01" title="RH PULSE" lede="CALL THE ROTATION." />
    <DataState status={api.status} message={api.message} />
    {reputation.data && <PulseMemory reputation={reputation.data} currentWindowId={api.data?.window.window_id} />}
    <div className="i4663-window"><span>WINDOW</span><strong>{api.data?.window.window_id ?? 'UTC DAILY'}</strong><time>{api.data ? `${machineTime(api.data.window.opens_at)} → ${machineTime(api.data.window.closes_at)}` : 'FIXED UTC BOUNDARY'}</time></div>
    <section className="i4663-pulse-grid" aria-label="Rotation options">{ROTATIONS.map((item) => <button type="button" key={item.value} aria-pressed={rotation === item.value} onClick={() => setRotation(item.value)}><i />{item.label}</button>)}</section>
    <label className="i4663-range"><span>CONFIDENCE <b>{confidence}</b></span><input aria-label="Confidence" type="range" min="1" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
    {params.get('evidence') && <p className="i4663-evidence-link">EVIDENCE ATTACHED <a href={params.get('evidence') ?? '/4663/print/0830'}>{params.get('evidence')}</a></p>}
    <label className="i4663-field"><span>EVIDENCE DIGEST <i>OPTIONAL / 32-BYTE HEX</i></span><input value={digest} onChange={(event) => setDigest(event.target.value)} placeholder="0x…" pattern="0x[0-9a-fA-F]{64}" /></label>
    <button className="i4663-primary-action i4663-button" type="button" onClick={makeCall} disabled={result.state === 'working'}>{result.state === 'working' ? 'SIGNING…' : 'SIGN + RECORD CALL'} <span>↗</span></button>
    {result.message && <CallIssued result={result} />}
    {result.state === 'success' && <Consensus consensus={api.data?.consensus} />}
    {result.state !== 'success' && <section className="i4663-consensus is-gated"><p className="i4663-micro">INFOPUNKS CONSENSUS</p><strong>LOCKED UNTIL YOU CALL</strong><p>Make an independent signed call first. Then see where the crowd stands.</p></section>}
    <p className="i4663-protocol-note">Signed Call Mechanics v1. Calls are unique per eligible wallet per fixed UTC window. Existing CALL RECEIPTS are immutable. <a href="/openapi.json">Protocol contract ↗</a></p>
  </main>;
}

function CallIssued({ result }: { result: { state: 'idle' | 'working' | 'success' | 'error'; message?: string; receipt?: Rh4663CallReceipt } }) {
  const [shared, setShared] = useState(false); const receipt = result.receipt;
  async function share() {
    if (!receipt) return;
    const url = new URL(`/4663/proof/${encodeURIComponent(receipt.receipt_id)}`, window.location.origin).toString(); const text = `I called ${labelRotation(receipt.rotation)} at ${receipt.confidence}% on Infopunks //4663.\nEvidence: //4663 PRINT 0830.`;
    try { trackCampaign('4663_call_share_clicked', { surface: 'call', window_id: receipt.window_id }); if (navigator.share) await navigator.share({ title: 'My //4663 Call', text, url }); else await navigator.clipboard.writeText(`${text}\n${url}`); setShared(true); trackCampaign('4663_call_share_completed', { surface: 'call', window_id: receipt.window_id }); } catch { /* Cancelling the native sheet does not change state. */ }
  }
  if (!receipt) return <div className={`i4663-result is-${result.state}`} role="status"><strong>{result.message}</strong></div>;
  return <section className="i4663-call-issued" role="status"><p className="i4663-micro">CALL RECEIPT</p><h2>I'M CALLING <b>{labelRotation(receipt.rotation)}</b></h2><div><span>PROFILE <b>{shortWallet(receipt.wallet)}</b></span><span>CONFIDENCE <b>{receipt.confidence}%</b></span><span>WINDOW <b>{receipt.window_id.replace('rh4663:', 'UTC / ')}</b></span><span>SUBMITTED <b>{machineTime(receipt.created_at)}</b></span></div><code>{receipt.receipt_id}</code><p>Your call is permanently linked to this observation window.</p><button type="button" className="i4663-primary-action" onClick={share}>{shared ? 'LINK COPIED' : 'SHARE YOUR CALL ↗'} <span>↗</span></button><a className="i4663-secondary-action" href={`/4663/call/${encodeURIComponent(receipt.receipt_id)}`}>VIEW RECEIPT</a><small>EVERYONE HAS AN OPINION. INFOPUNKS HAS THE RECEIPT.</small></section>;
}

function Consensus({ consensus }: { consensus?: PulseData['consensus'] }) {
  useEffect(() => { if (consensus) trackCampaign('4663_consensus_viewed', { surface: 'consensus' }); }, [consensus]);
  const total = consensus?.total_calls ?? 0;
  const rows = ROTATIONS.map((option) => ({ ...option, count: consensus?.counts?.[option.value] ?? 0 })).map((row) => ({ ...row, percentage: total ? Math.round((row.count / total) * 100) : 0 }));
  const leading = rows.reduce((prior, row) => row.percentage > prior.percentage ? row : prior, rows[0]); const contrarian = [...rows].sort((left, right) => right.percentage - left.percentage)[1];
  return <section className="i4663-consensus is-revealed"><p className="i4663-micro">INFOPUNKS CONSENSUS // NEXT 24H</p>{rows.map((row) => <div className="i4663-consensus-row" key={row.value}><span>{row.label}</span><i><b style={{ width: `${row.percentage}%` }} /></i><strong>{row.percentage}%</strong></div>)}<p><b>{total.toLocaleString()} VALID CALL{total === 1 ? '' : 'S'}</b> · {total ? <>Consensus is most positioned toward <strong>{leading.label.toUpperCase()}</strong>{contrarian?.percentage ? `; ${contrarian.label.toUpperCase()} is the largest contrarian cluster.` : '.'}</> : 'Consensus will form from accepted calls only.'}</p></section>;
}

function ConsensusPage({ windowId }: { windowId: string }) {
  const api = useApi<WindowView>(`/v1/4663/pulse/windows/${encodeURIComponent(windowId)}`); const view = api.data;
  useEffect(() => { if (view?.resolution) trackCampaign('4663_resolution_viewed', { surface: 'resolution', window_id: windowId }); else if (view) trackCampaign('4663_consensus_viewed', { surface: 'consensus', window_id: windowId }); }, [view, windowId]);
  const resolved = view?.resolution;
  const consensusCorrect = resolved && view?.consensus.leading_rotation ? view.consensus.leading_rotation === resolved.resolved_category : null;
  async function share() {
    if (!view) return; const url = new URL(`/4663/consensus/${encodeURIComponent(windowId)}`, window.location.origin).toString(); const text = resolved ? `${consensusCorrect ? 'THE CROWD WAS RIGHT' : 'THE CROWD MISSED'}\nOutcome: ${labelRotation(resolved.resolved_category)}\n${url}` : `Infopunks consensus is forming for ${windowId}.\n${url}`;
    try { if (resolved) trackCampaign('4663_resolution_shared', { surface: 'resolution', window_id: windowId }); if (navigator.share) await navigator.share({ title: resolved ? '//4663 RESOLUTION' : 'Infopunks Consensus', text, url }); else await navigator.clipboard.writeText(text); } catch { /* A cancelled native share has no side effect. */ }
  }
  return <main className="i4663-main i4663-subpage"><PageHead index={resolved ? 'RESOLUTION' : 'CONSENSUS'} title={resolved ? '//4663 RESOLUTION' : 'INFOPUNKS CONSENSUS'} lede={view?.state.toUpperCase() ?? 'LOADING WINDOW'} /><DataState status={api.status} message={api.message} />{view && <section className="i4663-resolution-page">{resolved ? <><p className="i4663-micro">{consensusCorrect ? 'THE CROWD WAS RIGHT' : 'THE CROWD MISSED'}</p><h2>{labelRotation(resolved.resolved_category)}</h2><div className="i4663-resolution-stats"><span><small>WINNING ROTATION</small><b>{labelRotation(resolved.resolved_category)}</b></span><span><small>NETWORK CONSENSUS</small><b>{labelRotation(view.consensus.leading_rotation) || 'NO CALLS'}</b></span><span><small>VALID CALLS</small><b>{view.consensus.total_calls.toLocaleString()}</b></span></div><p>Outcome is derived from the published deterministic methodology. Consensus describes accepted calls; it does not determine the result.</p></> : <><p className="i4663-micro">NEXT 24H</p><h2>THE NETWORK IS CALLING.</h2><Consensus consensus={view.consensus} /></>}<button type="button" className="i4663-primary-action" onClick={share}>{resolved ? 'SHARE RESOLUTION' : 'SHARE CONSENSUS'} <span>↗</span></button>{resolved && <a className="i4663-secondary-action" href={`/v1/4663/pulse/windows/${encodeURIComponent(windowId)}/resolution`}>VIEW DETERMINISTIC METHODOLOGY</a>}</section>}</main>;
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
  async function share() { const url = new URL(`/4663/resolution/${encodeURIComponent(result.resolution_receipt_id ?? result.call_receipt_id)}`, window.location.origin).toString(); const text = result.outcome === 'CORRECT' ? `YOU CALLED IT. ${labelRotation(result.called_category)} on Pulse //4663.` : `My Pulse //4663 call resolved: ${labelRotation(result.called_category)} → ${labelRotation(result.resolved_category)}.`; try { trackCampaign('4663_resolution_shared', { surface: 'resolution', window_id: result.window_id }); if (navigator.share) await navigator.share({ title: 'Pulse //4663', text, url }); else await navigator.clipboard.writeText(`${text} ${url}`); setShared(true); } catch { /* A cancelled native share leaves the result unchanged. */ } }
  return <article className={`i4663-resolved is-${result.outcome.toLowerCase()}`}><p className="i4663-micro">RESOLVED</p><div className="i4663-call-actual"><span><small>YOUR CALL</small><b>{labelRotation(result.called_category)}</b></span><i>→</i><span><small>ACTUAL</small><b>{labelRotation(result.resolved_category)}</b></span></div><h2>{result.outcome === 'CORRECT' ? 'YOU CALLED IT.' : 'RESOLVED'}</h2><section className="i4663-record"><div><small>YOUR RECORD</small><strong>{reputation.correct_calls} / {reputation.resolved_calls}</strong><span>{reputation.accuracy === null ? '—' : `${(reputation.accuracy * 100).toFixed(1)}%`}</span></div><div><small>CURRENT STREAK</small><strong>{reputation.current_streak}</strong></div>{reputation.genesis_position && <div><small>GENESIS</small><strong>#{String(reputation.genesis_position).padStart(4, '0')}</strong></div>}</section><button className="i4663-primary-action" type="button" onClick={share}>{shared ? 'LINK COPIED' : 'SHARE RESULT'} <span>↗</span></button><a className="i4663-secondary-action" href={`/4663/resolution/${encodeURIComponent(result.resolution_receipt_id ?? result.call_receipt_id)}`}>VIEW RECEIPT</a><a className="i4663-next-call" href="/4663/pulse">CALL TODAY <span>→</span></a></article>;
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

function ProofPage({ receiptId, campaignRoute = 'proof' }: { receiptId: string; campaignRoute?: 'call' | 'resolution' | 'proof' }) {
  const call = useApi<Rh4663CallReceipt | Rh4663ResolutionReceipt>(`/v1/4663/receipts/${encodeURIComponent(receiptId)}`); const proof = useOptionalApi<Rh4663MerkleProof>(`/v1/4663/pulse/receipts/${encodeURIComponent(receiptId)}/proof`);
  useEffect(() => { if (call.data?.protocol_receipt_type === 'RESOLUTION') trackCampaign('4663_resolution_viewed', { surface: 'resolution', window_id: call.data.window_id }); }, [call.data]);
  return <main className="i4663-main i4663-subpage"><PageHead index={campaignRoute === 'call' ? 'CALL' : campaignRoute === 'resolution' ? 'RESOLUTION' : 'PROOF'} title={campaignRoute === 'call' ? 'CALL RECEIPT' : campaignRoute === 'resolution' ? 'RESOLUTION RECEIPT' : 'PROOF'} lede="CANONICAL PUBLIC MEMORY." /><DataState status={call.status} message={call.message} />{call.data && <section className="i4663-proof"><p className="i4663-micro">{call.data.protocol_receipt_type} RECEIPT</p><h2>{call.data.receipt_id}</h2><dl><div><dt>IMMUTABLE</dt><dd>TRUE</dd></div><div><dt>WINDOW</dt><dd>{call.data.window_id}</dd></div><div><dt>PAYLOAD HASH</dt><dd>{call.data.payload_hash}</dd></div>{call.data.protocol_receipt_type === 'CALL' && <><div><dt>CALLED</dt><dd>{labelRotation(call.data.rotation)}</dd></div><div><dt>CONFIDENCE</dt><dd>{call.data.confidence}%</dd></div><div><dt>SIGNATURE</dt><dd>VERIFIED</dd></div></>}{call.data.protocol_receipt_type === 'RESOLUTION' && <><div><dt>ACTUAL</dt><dd>{labelRotation(call.data.resolved_category)}</dd></div><div><dt>RESULT</dt><dd>{call.data.outcome}</dd></div><div><dt>CALL RECEIPT</dt><dd><a href={`/4663/call/${encodeURIComponent(call.data.call_receipt_id)}`}>{call.data.call_receipt_id}</a></dd></div></>}</dl>{proof.data && <div className="i4663-merkle"><span>WINDOW ACCEPTANCE</span><strong>{proof.data.verified ? 'INCLUSION VERIFIED ✓' : 'PROOF INVALID'}</strong><code>{proof.data.acceptance_root}</code><small>ANCHOR / {proof.data.anchor.state.toUpperCase()}</small></div>}<a className="i4663-next-call" href="/4663/pulse">CALL TODAY <span>→</span></a></section>}</main>;
}

function ProofProfilePage({ wallet }: { wallet: string }) {
  const api = useApi<Rh4663ProofProfile>(`/v1/4663/proof/${encodeURIComponent(wallet)}`); const profile = api.data;
  async function share() {
    if (!profile) return;
    const url = new URL(`/4663/proof/${encodeURIComponent(wallet)}`, window.location.origin).toString(); const text = `${profile.resolved} RESOLVED CALLS\n${profile.correct} CORRECT\n${profile.high_confidence_accuracy === null ? '—' : `${Math.round(profile.high_confidence_accuracy * 100)}%`} HIGH-CONFIDENCE ACCURACY\nNO RECEIPT, NO TRUST.`;
    try { if (navigator.share) await navigator.share({ title: 'Infopunks //4663 Proof', text, url }); else await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* A cancelled share does not alter the record. */ }
  }
  return <main className="i4663-main i4663-subpage i4663-proof-profile"><PageHead index="PROOF" title="PROOF PROFILE" lede="RECEIPT-BACKED JUDGMENT RECORD." /><DataState status={api.status} message={api.message} />{profile && <article className="i4663-proof-profile-card"><header><div><p className="i4663-micro">IDENTITY / {profile.display_name}</p><h2>THE RECORD IS THE REPUTATION.</h2><p>Canonical CALL and published RESOLUTION receipts only. This page is not a portfolio, balance, or trading history.</p></div><button className="i4663-primary-action" type="button" onClick={share}>SHARE PROOF <span>↗</span></button></header><section className="i4663-proof-summary" aria-label="Proof summary"><div><small>CALLS</small><strong>{profile.calls}</strong></div><div><small>RESOLVED</small><strong>{profile.resolved}</strong></div><div><small>CORRECT</small><strong>{profile.correct}</strong></div><div><small>INCORRECT</small><strong>{profile.incorrect}</strong></div><div><small>UNRESOLVED</small><strong>{profile.unresolved}</strong></div><div><small>ACCURACY</small><strong>{profile.accuracy === null ? '—' : `${Math.round(profile.accuracy * 100)}%`}</strong><span>resolved calls only</span></div><div><small>HIGH-CONFIDENCE</small><strong>{profile.high_confidence_accuracy === null ? '—' : `${Math.round(profile.high_confidence_accuracy * 100)}%`}</strong><span>confidence ≥ {profile.high_confidence.threshold}</span></div></section><section className="i4663-proof-methodology"><p className="i4663-micro">METHOD / {profile.methodology.version}</p><p>Accuracy is correct / resolved. Unresolved calls are not misses. Category performance requires at least {profile.methodology.category_min_resolved} resolved calls.</p><div>{profile.receipt_links.map((link) => <a key={link.receipt_id} href={link.receipt_url}>CALL {link.receipt_id} ↗</a>)}</div></section><section className="i4663-proof-categories"><h2>CATEGORY RECORD</h2>{ROTATIONS.map((option) => { const item = profile.category_breakdown[option.value]; return <article key={option.value}><div><strong>{option.label.toUpperCase()}</strong><span>{item.sample_status === 'MEANINGFUL' ? `${item.correct} / ${item.resolved} correct · ${item.accuracy === null ? '—' : `${Math.round(item.accuracy * 100)}%`}` : 'INSUFFICIENT SAMPLE'}</span></div><small>{item.calls} calls · {item.unresolved} unresolved</small><footer>{item.receipt_links.map((link) => <a key={link.receipt_id} href={link.receipt_url}>{link.receipt_id} ↗</a>)}</footer></article>; })}</section>{profile.best_supported_category.category ? <section className="i4663-proof-highlight"><span>BEST-SUPPORTED CATEGORY / {profile.best_supported_category.resolved} RESOLVED CALLS</span><strong>{labelRotation(profile.best_supported_category.category)}</strong><small>{Math.round(profile.best_supported_category.accuracy * 100)}% accuracy · inspect the linked receipts above</small></section> : <section className="i4663-proof-highlight"><span>CATEGORY READ</span><strong>INSUFFICIENT SAMPLE</strong><small>No category has {profile.methodology.category_min_resolved} resolved calls yet.</small></section>}{profile.genesis && <section className="i4663-proof-genesis"><span>GENESIS RECEIPT</span><strong>#{String(profile.genesis.ordinal).padStart(4, '0')}</strong><a href={profile.genesis.receipt_url}>VIEW {profile.genesis.call_receipt_id} ↗</a></section>}<section className="i4663-proof-recent"><h2>RECENT CALLS</h2>{profile.recent_calls.map((call) => <article key={call.call_receipt_id}><div><span>{call.outcome}</span><time>{machineTime(call.submitted_at)}</time></div><strong>{labelRotation(call.called_category)} · {call.confidence}%</strong><footer><a href={call.call_receipt_url}>CALL RECEIPT ↗</a>{call.resolution_receipt_url && <a href={call.resolution_receipt_url}>RESOLUTION RECEIPT ↗</a>}</footer></article>)}</section><footer className="i4663-proof-profile-footer"><span>NO RECEIPT, NO TRUST.</span><a href="/4663/pulse">MAKE YOUR OWN CALL →</a></footer></article>}</main>;
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
