import React, { useEffect, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { ProofReceiptCard, type ProofCheckResult } from './proofCheckPages';

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

function LoopNav() {
  return <nav className="global-toolbar proof-check-toolbar" aria-label="Loop Check navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Loop Check</strong>
    </a>
    <div className="terminal-nav" aria-label="Loop Check routes">
      <a href="/loops" aria-current={window.location.pathname === '/loops' ? 'page' : undefined}>Loops</a>
      <a href="/check">Check</a>
      <a href="/routes">Routes</a>
      <a href="/providers">Providers</a>
      <a href="/claim">Claims</a>
    </div>
  </nav>;
}

function LoopCard({ loop }: { loop: LoopDetail }) {
  return <article className="panel loop-card">
    <p className="eyebrow">AUTONOMOUS LOOP</p>
    <h2>{loop.name}</h2>
    <p className="copy">{loop.objective}</p>
    <div className="proof-card-grid">
      <p><span>Proof State</span><strong>{humanize(loop.proof_state)}</strong></p>
      <p><span>Decision</span><strong>{decisionLabel(loop.decision_state)}</strong></p>
      <p><span>Score</span><strong>{loop.score}</strong></p>
      <p><span>Linked Check</span><strong>{loop.linked_check_id}</strong></p>
    </div>
    <p className="panel-caption">{loop.failure_reason ?? 'Loop is currently operating without a recorded failure reason.'}</p>
    <div className="loop-card-actions">
      <a className="execute compact secondary" href={`/loops/${encodeURIComponent(loop.id)}`}>Inspect loop</a>
      <a className="execute compact secondary" href={`/check/${encodeURIComponent(loop.linked_check_id)}`}>Open proof receipt</a>
    </div>
  </article>;
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

  return <div className="shell builder-shell proof-feed-shell">
    <LoopNav />
    <main className="builder-page" aria-label="Loops page">
      <section className="panel hero proof-check-hero">
        <div>
          <p className="eyebrow">Loop Engineering</p>
          <h1>Autonomous loops need proof receipts.</h1>
          <p className="copy">Prompts made agents talk. Loops make agents work. Proof makes that work trustworthy.</p>
          <p className="panel-caption">Every loop should be checkable. Every loop check should produce a proof receipt.</p>
        </div>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {loading
        ? <p className="panel-caption">Loading loops...</p>
        : <section className="proof-check-grid">{loops.map((loop) => <LoopCard key={loop.id} loop={loop} />)}</section>}
    </main>
  </div>;
}

export function LoopDetailPage({ loopId }: { loopId: string }) {
  const [loop, setLoop] = useState<LoopDetail | null>(null);
  const [check, setCheck] = useState<ProofCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

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
        <p className="eyebrow">AUTONOMOUS LOOP</p>
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
        <section className="proof-check-output">
          <article className="panel proof-share-panel">
            <p className="eyebrow">Loop Objective</p>
            <h1>{loop.name}</h1>
            <p>{loop.objective}</p>
            <div className="proof-card-grid">
              <p><span>Proof State</span><strong>{humanize(loop.proof_state)}</strong></p>
              <p><span>Decision State</span><strong>{decisionLabel(loop.decision_state)}</strong></p>
              <p><span>Score</span><strong>{loop.score}</strong></p>
              <p><span>Linked Check</span><strong>{loop.linked_check_id}</strong></p>
            </div>
            <p><b>Hypothesis</b></p>
            <p>{loop.hypothesis}</p>
            <p><b>Action taken</b></p>
            <p>{loop.action_taken}</p>
            <p><b>Failure reason</b></p>
            <p>{loop.failure_reason ?? 'No failure reason recorded for this loop.'}</p>
            <p><a className="execute compact secondary" href={`/check/${encodeURIComponent(loop.linked_check_id)}`}>Open linked proof receipt</a></p>
          </article>
          {check
            ? <ProofReceiptCard check={check} />
            : <article className="panel proof-share-panel"><p className="eyebrow">Linked Proof Receipt</p><p>Linked proof receipt unavailable.</p></article>}
        </section>
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
            <p className="panel-caption">Loops generate claims, checks, receipts, and public memory.</p>
          </article>
        </section>
      </>}
    </main>
  </div>;
}
