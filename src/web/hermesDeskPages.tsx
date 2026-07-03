import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { HermesDecisionState, HermesDeskSummary, HermesRun, HermesRunState } from '../data/hermesDesk';
import { getNarrativeMetadataForPath } from '../shared/narrativeMetadata';

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string): Promise<{ data: T }> {
  const response = await fetch(toApiUrl(API_BASE_URL, path));
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

function syncHermesMetadata(pathname: string) {
  const metadata = getNarrativeMetadataForPath(pathname);
  if (!metadata || typeof document === 'undefined') return;
  document.title = metadata.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', metadata.description);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', metadata.canonicalPath);
}

function decisionLabel(state: HermesDecisionState) {
  return ({
    trust: 'Trust',
    caution: 'Caution',
    do_not_use_yet: 'Do not use yet',
    unproven: 'Unproven',
    disputed: 'Disputed'
  } as const)[state];
}

function runStateLabel(state: HermesRunState) {
  return ({
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    blocked: 'Blocked'
  } as const)[state];
}

function HermesNav({ current }: { current: string }) {
  const links = [
    { href: '/', label: 'Radar Home' },
    { href: '/hermes', label: 'Hermes Desk' },
    { href: '/narratives/hermes-desk', label: 'Narrative' },
    { href: '/check', label: 'Proof Feed' },
    { href: '/loops', label: 'Loops' },
    { href: '/receipts', label: 'Receipts' }
  ];

  function active(href: string) {
    if (href === '/hermes') return current === '/hermes';
    if (href === '/narratives/hermes-desk') return current === '/narratives/hermes-desk';
    return current === href;
  }

  return <nav className="global-toolbar narrative-toolbar hermes-toolbar" aria-label="Hermes Desk navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Hermes Desk</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Hermes Desk routes">
      {links.map((link) => <a key={link.href} href={link.href} className={active(link.href) ? 'active' : ''} aria-current={active(link.href) ? 'page' : undefined}>{link.label}</a>)}
    </div>
    <div className="terminal-actions" aria-label="Hermes quick links">
      <span className="terminal-action-cluster">
        <a className="methodology-trigger" href="/v1/hermes">JSON</a>
        <a className="methodology-trigger" href="/v1/hermes/health">Health</a>
      </span>
    </div>
  </nav>;
}

function HermesMetric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <article className="panel metric hermes-metric">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{sub}</small>
  </article>;
}

function HermesRunCard({ run }: { run: HermesRun }) {
  return <article className={`panel hermes-run-card state-${run.decision}`} aria-label={run.title}>
    <div className="abundance-card-head">
      <p className="section-kicker">{runStateLabel(run.state)}</p>
      <span className={`narrative-decision-pill state-${run.decision}`}>{decisionLabel(run.decision)}</span>
    </div>
    <h2>{run.title}</h2>
    <p>{run.summary}</p>
    <div className="hermes-confidence" aria-label={`${run.confidence} confidence`}>
      <span>confidence</span>
      <strong>{run.confidence}</strong>
    </div>
    <div className="machine-usage-list">
      <p><span>objective</span><small>{run.objective}</small></p>
      <p><span>created_at</span><small>{run.created_at}</small></p>
      <p><span>completed_at</span><small>{run.completed_at ?? 'still running'}</small></p>
    </div>
    <div className="abundance-chip-row hermes-links">
      <span>receipt: {run.linked_receipt_id ?? 'pending'}</span>
      <span>claim: {run.linked_claim_id ?? 'pending'}</span>
      <span>loop: {run.linked_loop_id ?? 'pending'}</span>
    </div>
    <div className="machine-usage-list">
      {run.risk_factors.map((risk) => <p key={risk}><span>risk</span><small>{risk}</small></p>)}
    </div>
    <div className="hermes-artifact-list">
      {run.artifacts.map((artifact) => <a key={artifact.artifact_id} className="narrative-evidence-chip" href={artifact.uri}>{artifact.label}</a>)}
    </div>
  </article>;
}

function SkillPackSection({ summary }: { summary: HermesDeskSummary }) {
  return <section className="panel hermes-skills" aria-label="Infopunks skill pack">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Infopunks skill pack</p>
        <h2>Skills Hermes can run, receipts Radar can judge.</h2>
      </div>
      <a className="execute compact secondary" href="/v1/hermes/skills">GET /v1/hermes/skills</a>
    </div>
    <div className="hermes-skill-grid">
      {summary.skills.map((skill) => <article className="panel hermes-skill-card" key={skill.id}>
        <p className="section-kicker">{skill.enabled ? 'enabled' : 'disabled'}</p>
        <h3>{skill.label}</h3>
        <p>{skill.purpose}</p>
        <div className="abundance-chip-row">
          {skill.produces.map((item) => <span key={`${skill.id}-${item}`}>{item.replaceAll('_', ' ')}</span>)}
        </div>
      </article>)}
    </div>
  </section>;
}

function HermesNarrativePage() {
  useEffect(() => {
    syncHermesMetadata('/narratives/hermes-desk');
  }, []);

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-narrative-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/narratives/hermes-desk" />
    </header>
    <main id="hermes-narrative-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Hermes Desk Narrative</p>
          <h1>Hermes Desk</h1>
          <p className="copy">Hermes as the execution brain. Infopunks as the evidence and judgment layer.</p>
          <p className="copy">Agentic investigations become useful only when their outputs can be checked, disputed, repeated, and connected to route reputation.</p>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Operating split</p>
          <p>Hermes runs the loop. Infopunks keeps the receipts.</p>
          <p>Every agent run can become a receipt. Every receipt can become a claim. Every claim can update provider or route reputation.</p>
        </div>
      </section>
      <section className="panel hermes-narrative-flow" aria-label="Hermes evidence flow">
        <article>
          <span>1</span>
          <h2>Execution brain</h2>
          <p>Hermes handles the investigation run: objective, skills, intermediate artifacts, risk notes, and loop progress.</p>
        </article>
        <article>
          <span>2</span>
          <h2>Evidence layer</h2>
          <p>Infopunks stores what the run produced: receipts, claims, linked loops, caveats, and public judgment state.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Reputation memory</h2>
          <p>Provider and route reputation move only when receipt-backed claims survive validation or dispute review.</p>
        </article>
      </section>
      <section className="panel hermes-narrative-copy">
        <p>Hermes should be allowed to investigate before money moves, but not allowed to turn investigation into trust by itself. Radar keeps that boundary explicit: a run can suggest a decision, but the proof feed decides whether the evidence says trust, caution, do_not_use_yet, unproven, or disputed.</p>
      </section>
    </main>
  </div>;
}

function HermesDeskSurface() {
  const [summary, setSummary] = useState<HermesDeskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes');
  }, []);

  useEffect(() => {
    api<HermesDeskSummary>('/v1/hermes')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_desk_unavailable'));
  }, []);

  const activeRuns = useMemo(() => (summary?.runs ?? []).filter((run) => run.state === 'queued' || run.state === 'running'), [summary?.runs]);
  const completedRuns = useMemo(() => (summary?.runs ?? []).filter((run) => run.state === 'completed'), [summary?.runs]);

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes" />
    </header>
    <main id="hermes-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Optional Agent Sidecar</p>
          <h1>Hermes Desk</h1>
          <p className="copy hermes-hero-copy">Agentic investigations before money moves.</p>
          <p className="copy">Hermes runs the loop. Infopunks keeps the receipts.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes">Open JSON Surface</a>
            <a className="execute compact secondary" href="/narratives/hermes-desk">Read Narrative</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Sidecar state</p>
          <p>{summary ? `mode=${summary.sidecar.mode} enabled=${String(summary.sidecar.enabled)} live_http_allowed=${String(summary.sidecar.live_http_allowed)}` : 'mode=mock enabled=false live_http_allowed=false'}</p>
          <p>Hermes Agent is not vendored here and is not required for deploy, build, tests, or smoke checks.</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!summary && !error && <section className="panel"><p className="route-state">Loading Hermes Desk...</p></section>}
      {summary && <>
        <section className="grid four hermes-metric-grid" aria-label="Hermes Desk summary">
          <HermesMetric label="runs" value={summary.counts.runs} sub="seeded investigations" />
          <HermesMetric label="active" value={summary.counts.active_runs} sub="queued or running" />
          <HermesMetric label="completed" value={summary.counts.completed_runs} sub="finished runs" />
          <HermesMetric label="sidecar" value={summary.sidecar.status} sub="optional runtime" />
        </section>

        <section className="panel hermes-runs-section" aria-label="Active Hermes runs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Active runs</p>
              <h2>Investigations still under judgment.</h2>
            </div>
            <a className="execute compact secondary" href="/v1/hermes/runs">GET /v1/hermes/runs</a>
          </div>
          <div className="hermes-run-grid">
            {activeRuns.map((run) => <HermesRunCard key={run.id} run={run} />)}
          </div>
        </section>

        <section className="panel hermes-runs-section" aria-label="Completed Hermes runs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Completed runs</p>
              <h2>Agent work with evidence handles.</h2>
            </div>
          </div>
          <div className="hermes-run-grid">
            {completedRuns.map((run) => <HermesRunCard key={run.id} run={run} />)}
          </div>
        </section>

        <SkillPackSection summary={summary} />
      </>}
    </main>
  </div>;
}

export function HermesDeskPage({ narrativeRoute = false }: { narrativeRoute?: boolean }) {
  return narrativeRoute ? <HermesNarrativePage /> : <HermesDeskSurface />;
}
