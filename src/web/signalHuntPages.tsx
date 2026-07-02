import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { SignalGraphContextPanel, type SignalGraphContextNode } from './signalGraphContextPanel';

type SignalHuntProofState = 'unproven' | 'receipts_attached' | 'validated' | 'challenged' | 'rejected';
type SignalHuntHuntState = 'fresh_signal' | 'under_review' | 'verified_signal' | 'noise' | 'disputed';
type SignalHuntDecisionState = 'signal' | 'noise' | 'review';

export type SignalHuntCandidate = {
  id: string;
  title: string;
  handle_or_source: string;
  category: string;
  thesis: string;
  why_it_matters: string;
  evidence: string[];
  evidence_count: number;
  signal_score: number;
  velocity_score: number;
  risk_score: number;
  proof_state: SignalHuntProofState;
  hunt_state: SignalHuntHuntState;
  decision_state: SignalHuntDecisionState;
  submitted_by: string;
  submitted_at: string;
  updated_at: string;
  linked_check_ids: string[];
  linked_loop_ids: string[];
  linked_signal_ids: string[];
  linked_route_ids: string[];
  tags: string[];
};

type SignalHuntSummary = {
  generated_at: string;
  counts: Record<SignalHuntHuntState | 'total', number>;
  candidates: SignalHuntCandidate[];
};

type SignalGraphEntityLookupResponse = {
  entity_type: 'claim' | 'loop' | 'provider' | 'route' | 'service' | 'narrative';
  entity_id: string;
  nodes: SignalGraphContextNode[];
};

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message.endsWith(' 404');
}

function titleCase(value: string) {
  return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function signalHref(signalId: string) {
  return `/signal-hunt/${encodeURIComponent(signalId)}`;
}

function proofHref(checkId: string) {
  return `/check/${encodeURIComponent(checkId)}`;
}

function loopHref(loopId: string) {
  return `/loops/${encodeURIComponent(loopId)}`;
}

function routeHref(routeId: string) {
  return `/routes/${encodeURIComponent(routeId)}`;
}

function narrativeHref(signalId: string) {
  return `/signals/${encodeURIComponent(signalId)}`;
}

function stateTone(state: SignalHuntHuntState | SignalHuntProofState) {
  if (state === 'verified_signal' || state === 'validated') return 'ok';
  if (state === 'noise' || state === 'rejected') return 'muted';
  if (state === 'disputed' || state === 'challenged') return 'warn';
  return 'review';
}

function decisionCopy(signal: SignalHuntCandidate) {
  if (signal.decision_state === 'signal') return 'The hunt is treating this as real signal. Proof and linked memory are strong enough to promote it beyond intake chatter.';
  if (signal.decision_state === 'noise') return 'The current read is noise. The story may still travel, but the evidence does not justify promotion.';
  return 'This signal is still under review. The hunt has enough surface area to watch, but not enough proof to graduate the claim.';
}

function decisionPanelTitle(signal: SignalHuntCandidate) {
  if (signal.hunt_state === 'verified_signal') return 'Signal: receipts attached';
  if (signal.hunt_state === 'noise') return 'Noise: rejected or weak evidence';
  if (signal.hunt_state === 'disputed') return 'Disputed: conflicting receipts';
  return 'Under review: more evidence needed';
}

function decisionPanelKicker(signal: SignalHuntCandidate) {
  if (signal.hunt_state === 'verified_signal') return 'A signal is not real until it has receipts.';
  if (signal.hunt_state === 'noise') return 'Most timelines see noise. Infopunks hunt signal.';
  if (signal.hunt_state === 'disputed') return 'Conflicting receipts slow the hunt down on purpose.';
  return 'The crowd finds it. Proof Feed records it. LoopLab remembers it. Agents use it before spend.';
}

function SignalHuntNav() {
  const pathname = window.location.pathname;
  const active = pathname === '/signal-hunt' || pathname.startsWith('/signal-hunt/');
  return <nav className="global-toolbar proof-check-toolbar" aria-label="Signal Hunt navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Signal Hunt</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Signal Hunt routes">
      <a href="/signal-hunt" aria-current={active ? 'page' : undefined}>Signal Hunt</a>
      <a href="/check">Proof Feed</a>
      <a href="/loops">LoopLab</a>
      <a href="/graph">Signal Graph</a>
      <a href="/spend-terminal">Pre-Spend Terminal</a>
    </div>
  </nav>;
}

function LinkList({ title, values, hrefFor }: { title: string; values: string[]; hrefFor: (value: string) => string }) {
  return <div className="signal-hunt-link-group">
    <span>{title}</span>
    {values.length
      ? <div className="signal-hunt-chip-row">
        {values.map((value) => <a key={value} className="copy-chip" href={hrefFor(value)}>{value}</a>)}
      </div>
      : <strong>None linked</strong>}
  </div>;
}

export function SignalHuntCard({ signal, compact = false }: { signal: SignalHuntCandidate; compact?: boolean }) {
  return <article className="panel signal-hunt-card" aria-label={signal.title}>
    <div className="signal-hunt-card-head">
      <p className="eyebrow">{signal.category}</p>
      <div className="signal-hunt-badge-row">
        <span className={`status-pill ${stateTone(signal.hunt_state)}`}>{titleCase(signal.hunt_state)}</span>
        <span className={`status-pill ${stateTone(signal.proof_state)}`}>{titleCase(signal.proof_state)}</span>
      </div>
    </div>
    <h3>{signal.title}</h3>
    <p className="copy">{signal.thesis}</p>
    <div className="proof-card-grid">
      <p><span>Signal score</span><strong>{signal.signal_score}</strong></p>
      <p><span>Velocity</span><strong>{signal.velocity_score}</strong></p>
      <p><span>Risk</span><strong>{signal.risk_score}</strong></p>
      <p><span>Evidence</span><strong>{signal.evidence_count}</strong></p>
    </div>
    <div className="signal-hunt-link-stack">
      {signal.linked_check_ids.length > 0 && <LinkList title="Proof checks" values={signal.linked_check_ids} hrefFor={proofHref} />}
      {signal.linked_loop_ids.length > 0 && <LinkList title="Loops" values={signal.linked_loop_ids} hrefFor={loopHref} />}
      {signal.linked_signal_ids.length > 0 && <LinkList title="Signal updates" values={signal.linked_signal_ids} hrefFor={narrativeHref} />}
      {signal.linked_route_ids.length > 0 && <LinkList title="Routes" values={signal.linked_route_ids} hrefFor={routeHref} />}
    </div>
    {!compact && signal.tags.length > 0 && <div className="proof-flag-list">
      {signal.tags.map((tag) => <span key={tag}>{tag}</span>)}
    </div>}
    <div className="signal-hunt-card-actions">
      <a className="execute compact secondary" href={signalHref(signal.id)}>Open signal</a>
    </div>
  </article>;
}

function sectionCopy(state: SignalHuntHuntState) {
  switch (state) {
    case 'fresh_signal':
      return 'New cultural intake before the story hardens.';
    case 'under_review':
      return 'Signals with enough surface area to investigate, but not enough proof to graduate.';
    case 'verified_signal':
      return 'Culture-layer signal that now connects cleanly into the proof and memory stack.';
    case 'noise':
      return 'Rejected intake, weak evidence, or recycled chatter.';
    case 'disputed':
      return 'Signals where challenge flows matter more than amplification.';
  }
}

function SignalHuntSection({ title, state, signals }: { title: string; state: SignalHuntHuntState; signals: SignalHuntCandidate[] }) {
  return <section className="panel signal-hunt-section" aria-label={title}>
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">{title}</p>
        <h2>{signals.length}</h2>
      </div>
      <p className="panel-caption">{sectionCopy(state)}</p>
    </div>
    {signals.length
      ? <div className="signal-hunt-grid">
        {signals.map((signal) => <SignalHuntCard key={signal.id} signal={signal} compact />)}
      </div>
      : <p className="panel-caption">No signals in this state right now.</p>}
  </section>;
}

function useSignalGraphContext(entityType: SignalGraphEntityLookupResponse['entity_type'], entityId: string | null) {
  const [node, setNode] = useState<SignalGraphContextNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!entityId) {
      setNode(null);
      return;
    }
    api<{ data: SignalGraphEntityLookupResponse }>(`/v1/graph/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
      .then((response) => {
        if (!cancelled) setNode(response.data.nodes[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setNode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, entityType]);

  return node;
}

export function SignalHuntPage() {
  const [summary, setSummary] = useState<SignalHuntSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: SignalHuntSummary }>('/v1/signal-hunt')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'signal_hunt_unavailable'));
  }, []);

  const sections = useMemo(() => {
    const candidates = summary?.candidates ?? [];
    return {
      fresh: candidates.filter((item) => item.hunt_state === 'fresh_signal'),
      review: candidates.filter((item) => item.hunt_state === 'under_review'),
      verified: candidates.filter((item) => item.hunt_state === 'verified_signal'),
      noise: candidates.filter((item) => item.hunt_state === 'noise' || item.hunt_state === 'disputed')
    };
  }, [summary]);

  return <div className="shell builder-shell proof-feed-shell">
    <SignalHuntNav />
    <main className="builder-page signal-hunt-page" aria-label="Signal Hunt page">
      <section className="panel hero signal-hunt-hero">
        <div>
          <p className="eyebrow">The cultural front door of Infopunks intelligence</p>
          <h1>Signal Hunt</h1>
          <h2>Find signal before it becomes consensus.</h2>
          <p className="copy">Most timelines see noise. Infopunks hunt signal.</p>
          <p className="copy">The crowd finds it. Proof Feed records it. LoopLab remembers it. Agents use it before spend.</p>
          <p className="panel-caption">Signal Hunt turns CT attention into reusable intelligence. Culture finds the edge. Infrastructure makes it durable.</p>
          <div className="signal-hunt-hero-actions">
            <a className="execute" href="#submit-signal">Submit Signal</a>
            <a className="execute compact secondary" href="#verify-signal">Verify Signal</a>
          </div>
        </div>
        <div className="signal-hunt-counter-grid" aria-label="Signal Hunt counters">
          <article className="panel loop-counter-card"><span>fresh</span><strong>{summary?.counts.fresh_signal ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>under review</span><strong>{summary?.counts.under_review ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>verified</span><strong>{summary?.counts.verified_signal ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>noise / disputed</span><strong>{(summary?.counts.noise ?? 0) + (summary?.counts.disputed ?? 0)}</strong></article>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      <SignalHuntSection title="Fresh Signals" state="fresh_signal" signals={sections.fresh} />
      <SignalHuntSection title="Under Review" state="under_review" signals={sections.review} />
      <SignalHuntSection title="Verified Signals" state="verified_signal" signals={sections.verified} />
      <SignalHuntSection title="Noise / Rejected" state="noise" signals={sections.noise} />

      <section className="panel loop-lab-how" aria-label="Signal Hunt flow">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Visible Flow</p>
            <h2>{'Find signal -> attach evidence -> verify receipts -> feed LoopLab -> update agent judgment'}</h2>
          </div>
          <p className="panel-caption">Signal Hunt is the front door. Proof Feed is the receipt printer. LoopLab is the memory engine. Pre-Spend Terminal is the agent judgment layer.</p>
        </div>
      </section>

      <section className="panel loop-lab-how" aria-label="How The Hunt Works">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">How The Hunt Works</p>
            <h2>Culture in, proof out, memory forward.</h2>
          </div>
          <p className="panel-caption">A signal is not real until it has receipts.</p>
        </div>
        <div className="loop-step-grid">
          {[
            ['Find signal', 'The community spots something before the timeline turns it into consensus.'],
            ['Attach evidence', 'Signal Hunt captures thesis, source, and early proof instead of letting it dissolve into the feed.'],
            ['Verify receipts', 'Proof Feed checks whether the story has receipts, challenge pressure, or just vibes.'],
            ['Feed LoopLab', 'LoopLab turns outcomes into memory so future agents can inherit what was learned.'],
            ['Update judgment', 'Pre-Spend Terminal, Evidence Ledger, and Provider Reputation turn that memory into reusable agent judgment.'],
            ['Make trust reusable', 'Agent readiness improves because the cultural intake layer was attached to proof early.']
          ].map(([title, copy]) => <article className="loop-step-card" key={title}>
            <p className="eyebrow">{title}</p>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="signal-hunt-detail-grid" aria-label="Why Signal Hunt matters">
        <article className="panel">
          <p className="eyebrow">Why this matters for agents</p>
          <h2>Agents need evidence before action.</h2>
          <p>Agents can spend, call APIs, consume services, and route payments, but they need evidence before action.</p>
          <p>Signal Hunt helps communities discover early information, while the rest of the Infopunks stack turns that information into proof, memory, reputation, and pre-spend intelligence.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Why this matters for CT</p>
          <h2>CT is already a live intelligence network.</h2>
          <p>Most signals disappear into the timeline. Signal Hunt captures early signal, separates receipts from noise, and turns cultural attention into a reusable intelligence graph.</p>
        </article>
      </section>

      <section className="panel signal-hunt-proof-trail" aria-label="Proof Trail">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Proof Trail</p>
            <h2>Public signal should connect to public memory.</h2>
          </div>
          <p className="panel-caption">Proof Feed is the receipt printer. LoopLab is the memory engine. Evidence Ledger makes claims traceable. Provider Reputation makes trust reusable.</p>
        </div>
        <div className="signal-hunt-proof-grid">
          <article className="panel">
            <h3>Proof Feed</h3>
            <p>A signal is not real until it has receipts.</p>
            <a className="execute compact secondary" href="/check">Open Proof Feed</a>
          </article>
          <article className="panel">
            <h3>LoopLab</h3>
            <p>Turns signal outcomes into reusable memory so the next agent does not start from zero.</p>
            <a className="execute compact secondary" href="/loops">Open LoopLab</a>
          </article>
          <article className="panel">
            <h3>Pre-Spend Terminal</h3>
            <p>Uses recorded memory to slow down agent spend when culture outruns proof.</p>
            <a className="execute compact secondary" href="/spend-terminal">Open Pre-Spend Terminal</a>
          </article>
        </div>
      </section>

      <section className="signal-hunt-cta-grid">
        <article id="submit-signal" className="panel signal-hunt-cta-card">
          <p className="eyebrow">Submit Signal</p>
          <h2>Public intake for early signal.</h2>
          <p className="copy">Use <code>POST /v1/signal-hunt/submit</code> to stage new cultural intake with evidence, thesis, and why it matters.</p>
          <a className="execute compact secondary" href="/developers">Open developer surface</a>
        </article>
        <article id="verify-signal" className="panel signal-hunt-cta-card">
          <p className="eyebrow">Verify Signal</p>
          <h2>Move the hunt from vibes to proof.</h2>
          <p className="copy">Use <code>POST /v1/signal-hunt/:signalId/verify</code> to mark signal, noise, dispute, or continued review and attach linked checks or loops.</p>
          <a className="execute compact secondary" href="/check">Start with Proof Feed</a>
        </article>
      </section>
    </main>
  </div>;
}

export function SignalHuntDetailPage({ signalId }: { signalId: string }) {
  const [signal, setSignal] = useState<SignalHuntCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const signalNode = useSignalGraphContext('narrative', signal?.linked_signal_ids[0] ?? null);

  useEffect(() => {
    api<{ data: SignalHuntCandidate }>(`/v1/signal-hunt/${encodeURIComponent(signalId)}`)
      .then((response) => setSignal(response.data))
      .catch((err) => {
        if (isNotFoundError(err)) setMissing(true);
        else setError(err instanceof Error ? err.message : 'signal_hunt_detail_unavailable');
      });
  }, [signalId]);

  if (missing) {
    return <div className="shell builder-shell proof-feed-shell">
      <SignalHuntNav />
      <main className="builder-page">
        <section className="panel">
          <p className="eyebrow">SIGNAL HUNT</p>
          <p className="copy">No public signal hunt entry exists for {signalId}.</p>
          <a className="execute compact secondary" href="/signal-hunt">Back to Signal Hunt</a>
        </section>
      </main>
    </div>;
  }

  return <div className="shell builder-shell proof-feed-shell">
    <SignalHuntNav />
    <main className="builder-page signal-hunt-detail-page" aria-label="Signal Hunt detail page">
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!signal
        ? <section className="panel"><p className="panel-caption">Loading signal hunt detail...</p></section>
        : <>
          <section className="panel signal-hunt-detail-hero">
            <div>
              <p className="eyebrow">{signal.category}</p>
              <h1>{signal.title}</h1>
              <p className="copy">{signal.thesis}</p>
              <p className="panel-caption">{signal.why_it_matters}</p>
            </div>
            <div className="signal-hunt-badge-row">
              <span className={`status-pill ${stateTone(signal.hunt_state)}`}>{titleCase(signal.hunt_state)}</span>
              <span className={`status-pill ${stateTone(signal.proof_state)}`}>{titleCase(signal.proof_state)}</span>
            </div>
          </section>

          <section className="signal-hunt-detail-grid">
            <article className="panel">
              <p className="eyebrow">Signal read</p>
              <div className="proof-card-grid">
                <p><span>Signal score</span><strong>{signal.signal_score}</strong></p>
                <p><span>Velocity score</span><strong>{signal.velocity_score}</strong></p>
                <p><span>Risk score</span><strong>{signal.risk_score}</strong></p>
                <p><span>Submitted by</span><strong>{signal.submitted_by}</strong></p>
              </div>
            </article>
            <article className="panel">
              <p className="eyebrow">Decision panel</p>
              <h2>{decisionPanelTitle(signal)}</h2>
              <p className="panel-caption">{decisionPanelKicker(signal)}</p>
              <p>{decisionCopy(signal)}</p>
            </article>
          </section>

          <section className="signal-hunt-detail-grid">
            <article className="panel">
              <p className="eyebrow">Evidence list</p>
              <ol className="signal-hunt-evidence-list">
                {signal.evidence.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </article>
            <article className="panel">
              <p className="eyebrow">Linked intelligence</p>
              <LinkList title="Proof Feed checks" values={signal.linked_check_ids} hrefFor={proofHref} />
              <LinkList title="LoopLab runs" values={signal.linked_loop_ids} hrefFor={loopHref} />
              <LinkList title="Signal Graph / Narrative Intel" values={signal.linked_signal_ids} hrefFor={narrativeHref} />
              <LinkList title="Routes" values={signal.linked_route_ids} hrefFor={routeHref} />
            </article>
          </section>

          <section className="panel signal-hunt-proof-trail" aria-label="Signal Hunt detail actions">
            <div className="proof-section-head">
              <div>
                <p className="eyebrow">Next surfaces</p>
                <h2>Turn signal into proof, memory, and judgment.</h2>
              </div>
              <p className="panel-caption">Signal Hunt is the front door. The rest of the stack makes the signal durable.</p>
            </div>
            <div className="signal-hunt-hero-actions">
              {signal.linked_check_ids[0] && <a className="execute compact secondary" href={proofHref(signal.linked_check_ids[0])}>Open related Proof Feed check</a>}
              {signal.linked_loop_ids[0] && <a className="execute compact secondary" href={loopHref(signal.linked_loop_ids[0])}>Open related LoopLab run</a>}
              <a className="execute compact secondary" href="/spend-terminal">Open Pre-Spend Terminal</a>
              <a className="execute compact secondary" href={signal.linked_check_ids.length ? '/check' : '/v1/radar/evidence-ledger/brief'}>{signal.linked_check_ids.length ? 'Open relevant proof surface' : 'Open Evidence Ledger brief'}</a>
            </div>
          </section>

          {signalNode && <SignalGraphContextPanel node={signalNode} />}
        </>}
    </main>
  </div>;
}
