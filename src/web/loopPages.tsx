import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { ProofReceiptCard, type ProofCheckResult } from './proofCheckPages';
import { SignalGraphContextPanel, type SignalGraphContextNode } from './signalGraphContextPanel';
import { RadarHeaderIdentity } from './radarNetworks';

type LoopProofState = 'verified' | 'partial' | 'failure_recorded' | 'memory_recorded' | 'unproven' | 'disputed';
type ProofDecisionState = 'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';

export type LoopRun = {
  run_id: string;
  started_at: string;
  completed_at: string;
  hypothesis: string;
  action_taken: string;
  evidence_artifacts: string[];
  score: number;
  failure_reason: string | null;
  proof_state: LoopProofState;
  decision_state: ProofDecisionState;
  linked_check_id: string;
};

export type LoopDetail = {
  id: string;
  name: string;
  objective: string;
  hypothesis: string;
  action_taken: string;
  evidence_artifacts: string[];
  score: number;
  failure_reason: string | null;
  proof_state: LoopProofState;
  decision_state: ProofDecisionState;
  linked_check_id: string;
  runs: LoopRun[];
};

type LoopCounters = {
  totalLoops: number;
  proofChecksLinked: number;
  evidenceArtifacts: number;
  failureReasonsLogged: number;
  decisionStatesIssued: number;
};
type SignalGraphEntityLookupResponse = {
  entity_type: 'loop';
  entity_id: string;
  nodes: SignalGraphContextNode[];
};

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string): Promise<T> {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message.endsWith(' 404');
}

function humanize(value: string) {
  return value.replaceAll('_', ' ');
}

function decisionLabel(value: ProofDecisionState) {
  if (value === 'do_not_use_yet') return 'DO NOT USE YET';
  return value.toUpperCase().replaceAll('_', ' ');
}

function loopCounters(loops: LoopDetail[]): LoopCounters {
  return {
    totalLoops: loops.length,
    proofChecksLinked: new Set(loops.map((loop) => loop.linked_check_id)).size,
    evidenceArtifacts: loops.reduce((total, loop) => total + loop.evidence_artifacts.length, 0),
    failureReasonsLogged: loops.filter((loop) => loop.failure_reason).length,
    decisionStatesIssued: new Set(loops.map((loop) => loop.decision_state)).size
  };
}

function isFailureWallLoop(loop: LoopDetail) {
  return ['caution', 'do_not_use_yet', 'unproven', 'disputed'].includes(loop.decision_state);
}

function LoopNav() {
  return <nav className="global-toolbar proof-check-toolbar" aria-label="Loop Check navigation">
    <RadarHeaderIdentity active="solana" />
    <div className="terminal-nav" aria-label="Loop Check routes">
      <a href="/loops" aria-current={window.location.pathname === '/loops' ? 'page' : undefined}>Loops</a>
      <a href="/check">Check</a>
      <a href="/routes">Routes</a>
      <a href="/providers">Providers</a>
      <a href="/claim">Claims</a>
    </div>
  </nav>;
}

function LoopToneClass(loop: Pick<LoopDetail, 'decision_state'>) {
  if (loop.decision_state === 'trust') return 'proof-trust';
  if (loop.decision_state === 'caution') return 'proof-caution';
  if (loop.decision_state === 'disputed') return 'proof-disputed';
  if (loop.decision_state === 'do_not_use_yet') return 'proof-stop';
  return 'proof-unproven';
}

export function LoopReceiptCard({ loop, compact = false }: { loop: LoopDetail; compact?: boolean }) {
  return <article className={`panel proof-receipt-card loop-receipt-card ${LoopToneClass(loop)} ${compact ? 'compact' : ''}`} aria-label="Loop Receipt Card">
    <div className="proof-card-head">
      <p className="eyebrow">INFOPUNKS LOOP RECEIPT</p>
      <span className="proof-decision-pill">{decisionLabel(loop.decision_state)}</span>
    </div>
    <h2>{loop.name}</h2>
    <p className="copy">{loop.objective}</p>
    <div className="proof-card-grid">
      <p><span>Proof state</span><strong>{humanize(loop.proof_state)}</strong></p>
      <p><span>Score</span><strong>{loop.score}</strong></p>
      <p><span>Linked check</span><strong>{loop.linked_check_id}</strong></p>
      <p><span>Runs</span><strong>{loop.runs.length}</strong></p>
    </div>
    <div className="proof-card-section">
      <h3>Failure reason</h3>
      <p>{loop.failure_reason ?? 'No failure reason recorded for this loop.'}</p>
    </div>
    {!compact && <div className="proof-card-section">
      <h3>Collective memory</h3>
      <p>This loop is public memory so the next agent does not start from zero.</p>
    </div>}
    <footer className="proof-card-foot">
      <span>No receipt, no trust.</span>
      <small>{loop.linked_check_id}</small>
    </footer>
  </article>;
}

function HowLoopWorksSection() {
  const steps = [
    ['Objective', 'Define what autonomous work is supposed to improve.'],
    ['Hypothesis', 'State what the loop expects to prove or disprove.'],
    ['Action', 'Record what the agent or operator actually ran.'],
    ['Evidence', 'Attach artifacts, notes, and linked proof receipts.'],
    ['Score', 'Quantify how much confidence the loop earned.'],
    ['Proof Receipt', 'Link the loop to a public Infopunks receipt check.'],
    ['Memory', 'Persist failure and success so the next agent starts ahead.']
  ];

  return <section className="panel loop-lab-how" aria-label="How the loop works">
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">How The Loop Works</p>
        <h2>Loop engineering in seven fields</h2>
      </div>
      <p className="panel-caption">Prompts made agents talk. Loops make agents work.</p>
    </div>
    <div className="loop-step-grid">
      {steps.map(([title, copy]) => <article className="loop-step-card" key={title}>
        <p className="eyebrow">{title}</p>
        <p>{copy}</p>
      </article>)}
    </div>
  </section>;
}

function LoopCard({ loop }: { loop: LoopDetail }) {
  return <div className="loop-lab-card-stack">
    <LoopReceiptCard loop={loop} compact />
    <div className="loop-card-actions">
      <a className="execute compact secondary" href={`/loops/${encodeURIComponent(loop.id)}`}>Inspect loop</a>
      <a className="execute compact secondary" href={`/check/${encodeURIComponent(loop.linked_check_id)}`}>Open proof receipt</a>
    </div>
  </div>;
}

function FailureWall({ loops }: { loops: LoopDetail[] }) {
  const failures = loops.filter(isFailureWallLoop);
  return <section className="panel loop-failure-wall" aria-label="Failure Wall">
    <div className="proof-section-head">
      <div>
        <p className="eyebrow">Failure Wall</p>
        <h2>Every failed loop is memory for the next agent.</h2>
      </div>
      <p className="panel-caption">Corrupted signal is economic risk.</p>
    </div>
    <div className="loop-failure-grid">
      {failures.map((loop) => <article className="panel loop-failure-card" key={loop.id}>
        <p className="eyebrow">{humanize(loop.proof_state)}</p>
        <h3>{loop.name}</h3>
        <p>{loop.failure_reason ?? 'Failure state recorded without a specific reason.'}</p>
        <div className="proof-card-grid">
          <p><span>Score</span><strong>{loop.score}</strong></p>
          <p><span>Decision</span><strong>{decisionLabel(loop.decision_state)}</strong></p>
          <p><span>Proof</span><strong>{humanize(loop.proof_state)}</strong></p>
        </div>
        <p><a className="execute compact secondary" href={`/loops/${encodeURIComponent(loop.id)}`}>Inspect failure memory</a></p>
      </article>)}
    </div>
  </section>;
}

function useLoopSignalGraphContext(loopId: string) {
  const [node, setNode] = useState<SignalGraphContextNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNode(null);
    api<{ data: SignalGraphEntityLookupResponse }>(`/v1/graph/entities/loop/${encodeURIComponent(loopId)}`)
      .then((response) => {
        if (cancelled) return;
        setNode(response.data.nodes[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setNode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loopId]);

  return node;
}

export function LoopsPage() {
  const [loops, setLoops] = useState<LoopDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: { loops: LoopDetail[] } }>('/v1/loops')
      .then((response) => setLoops(response.data.loops))
      .catch((err) => setError(err instanceof Error ? err.message : 'loops_unavailable'))
      .finally(() => setLoading(false));
  }, []);

  const counters = useMemo(() => loopCounters(loops), [loops]);
  const firstLoopHref = loops[0] ? `/loops/${encodeURIComponent(loops[0].id)}` : '/loops';

  return <div className="shell builder-shell proof-feed-shell">
    <LoopNav />
    <main className="builder-page" aria-label="Loops page">
      <section className="panel hero proof-check-hero loop-lab-hero">
        <div>
          <p className="eyebrow">Infopunks LoopLab</p>
          <h1>Where autonomous work becomes collective memory.</h1>
          <p className="copy">AI is moving from prompts to loops. LoopLab turns autonomous runs into proof receipts so the next agent does not start from zero.</p>
          <p className="panel-caption">Prompts made agents talk. Loops make agents work. Proof receipts make that work trustworthy.</p>
          <div className="loop-hero-actions">
            <a className="execute" href="/check">Open Proof Feed</a>
            <a className="execute compact secondary" href={firstLoopHref}>Inspect first loop</a>
          </div>
        </div>
        <div className="loop-counter-grid" aria-label="Collective memory counters">
          <article className="panel loop-counter-card"><span>total loops</span><strong>{counters.totalLoops}</strong></article>
          <article className="panel loop-counter-card"><span>proof checks linked</span><strong>{counters.proofChecksLinked}</strong></article>
          <article className="panel loop-counter-card"><span>evidence artifacts</span><strong>{counters.evidenceArtifacts}</strong></article>
          <article className="panel loop-counter-card"><span>failure reasons logged</span><strong>{counters.failureReasonsLogged}</strong></article>
          <article className="panel loop-counter-card"><span>decision states issued</span><strong>{counters.decisionStatesIssued}</strong></article>
        </div>
      </section>
      <HowLoopWorksSection />
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {loading
        ? <p className="panel-caption">Loading loops...</p>
        : <>
          <section className="proof-check-grid" aria-label="Loop receipt cards">{loops.map((loop) => <LoopCard key={loop.id} loop={loop} />)}</section>
          <FailureWall loops={loops} />
        </>}
    </main>
  </div>;
}

export function LoopDetailPage({ loopId }: { loopId: string }) {
  const [loop, setLoop] = useState<LoopDetail | null>(null);
  const [check, setCheck] = useState<ProofCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const signalGraphNode = useLoopSignalGraphContext(loopId);

  useEffect(() => {
    let cancelled = false;
    api<{ data: LoopDetail }>(`/v1/loops/${encodeURIComponent(loopId)}`)
      .then(async (response) => {
        if (cancelled) return;
        setLoop(response.data);
        try {
          const linked = await api<{ data: ProofCheckResult }>(`/v1/checks/${encodeURIComponent(response.data.linked_check_id)}`);
          if (!cancelled) setCheck(linked.data);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'linked_check_unavailable');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFoundError(err)) setMissing(true);
        else setError(err instanceof Error ? err.message : 'loop_detail_unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [loopId]);

  if (missing) return <div className="shell builder-shell proof-feed-shell">
    <LoopNav />
    <main className="builder-page">
      <section className="panel hero">
        <p className="eyebrow">INFOPUNKS LOOPLAB</p>
        <h1>Loop not found</h1>
        <p className="copy">No public loop exists for {loopId}.</p>
      </section>
    </main>
  </div>;

  return <div className="shell builder-shell proof-feed-shell">
    <LoopNav />
    <main className="builder-page" aria-label="Loop detail page">
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {loop && <>
        <section className="proof-check-output loop-detail-top">
          <LoopReceiptCard loop={loop} />
          <article className="panel proof-share-panel">
            <p className="eyebrow">Collective Memory</p>
            <h1>{loop.name}</h1>
            <p>This loop becomes collective memory because its hypothesis, action, evidence, score, and linked proof receipt are public.</p>
            <div className="proof-card-grid">
              <p><span>Objective</span><strong>{loop.objective}</strong></p>
              <p><span>Hypothesis</span><strong>{loop.hypothesis}</strong></p>
            </div>
            <p><b>Action taken</b></p>
            <p>{loop.action_taken}</p>
            <p><b>Failure reason</b></p>
            <p>{loop.failure_reason ?? 'No failure reason recorded for this loop.'}</p>
            <p><a className="execute compact secondary" href={`/check/${encodeURIComponent(loop.linked_check_id)}`}>Open linked proof receipt</a></p>
          </article>
        </section>
        <section className="proof-check-output">
          {check
            ? <ProofReceiptCard check={check} />
            : <article className="panel proof-share-panel"><p className="eyebrow">Linked Proof Receipt</p><p>Linked proof receipt unavailable.</p></article>}
          <article className="panel proof-share-panel">
            <p className="eyebrow">Memory Chain</p>
            <p>Objective defines the work. Hypothesis sets the expectation. Action creates artifacts. Proof receipt closes the claim. Public memory keeps the next agent from starting from zero.</p>
            <ul className="proof-list">
              <li>objective: {loop.objective}</li>
              <li>hypothesis: {loop.hypothesis}</li>
              <li>proof receipt: {loop.linked_check_id}</li>
            </ul>
          </article>
        </section>
        {signalGraphNode && <SignalGraphContextPanel node={signalGraphNode} />}
        <section className="proof-detail-grid">
          <article className="panel">
            <p className="eyebrow">Evidence Artifacts</p>
            <ul className="proof-list">{loop.evidence_artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}</ul>
          </article>
          <article className="panel">
            <p className="eyebrow">Loop Runs</p>
            <ul className="proof-list">{loop.runs.map((run) => <li key={run.run_id}>{run.run_id} · {decisionLabel(run.decision_state)} · score {run.score}</li>)}</ul>
          </article>
          <article className="panel">
            <p className="eyebrow">Public Memory</p>
            <p>No receipt, no trust.</p>
            <p className="panel-caption">Every failed loop is memory for the next agent.</p>
          </article>
        </section>
      </>}
    </main>
  </div>;
}
