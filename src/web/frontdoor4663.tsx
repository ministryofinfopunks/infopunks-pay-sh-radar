import React from 'react';
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

export function ProofCard({ proof }: { proof: Rh4663FrontdoorState['proof_summary'] }) { return <article id="proof" className="fd-proof-card"><div><p>PROOF</p><h2>Your record, when you make one.</h2><span>{proof.note}</span></div><div><EvidenceBadge state="UNRESOLVED" /><span className="fd-proof-note">{proof.total_calls} calls in this window</span><ResearchLink href={proof.deep_link}>Receipts</ResearchLink></div></article>; }

export function SectionHeader({ id, title, question, action }: { id: string; title: string; question: string; action?: React.ReactNode }) { return <header className="fd-section-header"><div><p>{title}</p><h2 id={id}>{question}</h2></div>{action}</header>; }

export function FrontdoorShell({ children, freshness }: { children: React.ReactNode; freshness?: string | null }) {
  return <div className="fd-shell"><a className="fd-skip" href="#now">Skip to now</a><header className="fd-topbar"><a href="/4663" className="fd-mark" aria-label="Infopunks 4663 home"><span>INFOPUNKS</span><b>4663</b></a><div className="fd-topbar-status"><span><i aria-hidden="true" /> <FreshnessBadge at={freshness} /></span><a href="#call">Call</a></div></header><nav className="fd-nav" aria-label="Primary navigation"><a href="#now">Now</a><a href="#watch">Watch</a><a href="#call">Call</a><a href="#proof">Proof</a></nav>{children}</div>;
}

export function Frontdoor({ data, status, message }: { data: Rh4663FrontdoorState | null; status: 'loading' | 'ready' | 'degraded'; message?: string }) {
  const unavailable = !data;
  const systemMessage = data?.system_status?.state === 'partial' ? 'Some research sources are temporarily unavailable. Available evidence remains shown.' : null;
  const currentCall = data?.current_call ?? { window_id: 'unavailable', state: 'UNRESOLVED', leading_rotation: null, total_calls: 0, opens_at: '', closes_at: '', deep_link: '/4663/pulse', source_ref: { source_type: 'pulse_window', source_id: 'unavailable', href: '/v1/4663/pulse', observed_at: null } };
  const proof = data?.proof_summary ?? { total_calls: 0, resolved_calls: null, note: 'Personal proof is available after a signed CALL.', deep_link: '/4663/receipts', source_ref: currentCall.source_ref };
  return <FrontdoorShell freshness={data?.freshness?.source_observed_at}><main className="fd-main"><section className="fd-hero" aria-labelledby="fd-title"><p>INFOPUNKS / ROBINHOOD CHAIN</p><h1 id="fd-title">Robinhood Chain,<br />right now.</h1><span>Signal extraction for the agentic economy. Before an agent spends, it checks Infopunks.</span></section>{(status !== 'ready' || systemMessage) && <p className={`fd-data-state ${status === 'degraded' ? 'is-degraded' : ''}`} role="status">{status === 'loading' ? 'Refreshing reviewed intelligence…' : systemMessage ?? `Data degraded. ${message ?? 'No market conclusion is inferred.'}`}</p>}<section id="now" className="fd-section" aria-labelledby="now-title"><SectionHeader id="now-title" title="NOW" question="What matters right now?" action={<FreshnessBadge at={data?.freshness?.source_observed_at} />} /><div className="fd-now-grid">{data?.now_cards?.slice(0, 5).map((card) => <NowCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} delta={card.delta ?? undefined} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} />) ?? null}{unavailable && <p className="fd-empty">No derived market state is available yet.</p>}</div></section><section id="watch" className="fd-section" aria-labelledby="watch-title"><SectionHeader id="watch-title" title="WATCH" question="What is developing?" action={<ResearchLink href="/4663/reflexive/watch">All cases</ResearchLink>} /><div className="fd-watch-grid">{data?.watch_cards?.slice(0, 4).map((card) => <WatchCard key={card.id} topic={card.topic} conclusion={card.headline} metric={card.primary_metric} evidence={card.evidence_state} freshness={card.freshness} href={card.deep_link} />) ?? null}{data && !data.watch_cards?.length && <p className="fd-empty">No developing cases are ready to surface.</p>}</div></section><section className="fd-section" aria-labelledby="loops-title"><SectionHeader id="loops-title" title="OPEN LOOPS" question="What still needs to be proved?" /><div className="fd-loop-grid">{data?.open_loops?.slice(0, 4).map((loop) => <OpenLoopCard key={loop.loop_id} question={loop.question} state={loop.state} href={loop.deep_link} pending={Boolean(loop.expected_resolution_at)} />) ?? null}{data && !data.open_loops?.length && <p className="fd-empty">No unresolved research loops are available.</p>}</div></section><PulseCard pulse={currentCall} /><section className="fd-section fd-proof-section" aria-labelledby="proof-title"><SectionHeader id="proof-title" title="PROOF" question="How good is your record?" /><ProofCard proof={proof} /></section></main><footer className="fd-footer"><p>Research stays deep until you ask for it.</p><details><summary>Open research</summary><div><a href="/4663/reflexive">Reflexive Radar</a><a href="/4663/reflexive/watch">Watch cases</a><a href="/4663/reflexive/census">Category Census</a><a href="/4663/reflexive/preflight/ipx-pltr">PLTR Preflight</a><a href="/4663/receipts">CALL + RESOLUTION receipts</a><a href="/rh-chain-signal-desk">Robinhood Chain desk</a></div></details></footer></FrontdoorShell>;
}

function rotationLabel(value: string) { return value.replaceAll('_', ' '); }
