import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { HermesDecisionState, HermesDeskSummary, HermesRun, HermesRunState } from '../data/hermesDesk';
import type { HermesSkillPack } from '../data/hermesSkillPack';
import { convertHermesRunToReceipt, type HermesRunReceiptConversion } from '../services/hermesReceiptConverter';
import { promoteHermesClaimCandidate, type HermesClaimReviewState } from '../services/hermesClaimPromotion';
import { getNarrativeMetadataForPath } from '../shared/narrativeMetadata';

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string): Promise<{ data: T }> {
  const response = await fetch(toApiUrl(API_BASE_URL, path));
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

type HermesHealthResponse = {
  status?: 'mock' | 'online' | 'offline' | 'error';
  mode?: 'mock' | 'http';
  checked_at?: string;
  error?: string;
  base_url?: string;
};

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

function reviewStateLabel(state: HermesClaimReviewState) {
  return ({
    candidate: 'Candidate',
    accepted: 'Accepted',
    needs_more_evidence: 'Needs more evidence',
    disputed: 'Disputed',
    rejected: 'Rejected'
  } as const)[state];
}

function HermesNav({ current }: { current: string }) {
  const links = [
    { href: '/', label: 'Radar Home' },
    { href: '/hermes', label: 'Hermes Desk' },
    { href: '/hermes/skill-pack', label: 'Skill Pack' },
    { href: '/narratives/hermes-desk', label: 'Narrative' },
    { href: '/check', label: 'Proof Feed' },
    { href: '/loops', label: 'Loops' },
    { href: '/receipts', label: 'Receipts' }
  ];

  function active(href: string) {
    if (href === '/hermes') return current === '/hermes';
    if (href === '/hermes/skill-pack') return current === '/hermes/skill-pack';
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

function sourceLabel(source?: HermesRun['source']) {
  return source ? source.replaceAll('_', ' ') : null;
}

function HermesRunCard({ run, receiptPreview }: { run: HermesRun; receiptPreview?: HermesRunReceiptConversion }) {
  return <article className={`panel hermes-run-card state-${run.decision}`} aria-label={run.title}>
    <div className="abundance-card-head">
      <p className="section-kicker">{runStateLabel(run.state)}</p>
      <div className="abundance-chip-row">
        {run.source && <span className="narrative-evidence-chip">source: {sourceLabel(run.source)}</span>}
        <span className="narrative-evidence-chip">Receipt-ready</span>
        <span className={`narrative-decision-pill state-${run.decision}`}>{decisionLabel(run.decision)}</span>
      </div>
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
    {receiptPreview && <div className="hermes-receipt-preview" aria-label={`${run.title} receipt conversion preview`}>
      <p><span>source_run</span><small>{receiptPreview.receipt.source_run_id}</small></p>
      <p><span>decision</span><small>{decisionLabel(receiptPreview.receipt.decision)}</small></p>
      <p><span>confidence</span><small>{receiptPreview.receipt.confidence}</small></p>
      <p><span>evidence_count</span><small>{receiptPreview.receipt.evidence_count}</small></p>
      <p><span>conversion</span><small>{receiptPreview.conversion.status}</small></p>
      <p><span>claim_candidate</span><small>{receiptPreview.claim_candidate.id}</small></p>
    </div>}
    {run.fallback_reason && <p className="hermes-bridge-note">fallback_reason: {run.fallback_reason}</p>}
    <div className="machine-usage-list">
      {run.risk_factors.map((risk) => <p key={risk}><span>risk</span><small>{risk}</small></p>)}
    </div>
    {!!run.lifecycle_events?.length && <div className="hermes-timeline" aria-label={`${run.title} lifecycle`}>
      {run.lifecycle_events.map((event) => <div key={event.id} className="hermes-timeline-event">
        <span>{event.label}</span>
        <small>{event.state} at {event.at}</small>
        {event.detail && <small>{event.detail}</small>}
      </div>)}
    </div>}
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
      <a className="execute compact secondary" href="/hermes/skill-pack">Open Skill Pack</a>
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
          <p className="copy">Hermes runs are not chat logs. They are pre-spend investigations.</p>
          <p className="copy">Receipts remember what happened. Claims decide what it means. Reputation decides who gets trusted next.</p>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Operating split</p>
          <p>Hermes runs the loop. Infopunks keeps the receipts.</p>
          <p>Every agent run can become a receipt. Every receipt can become a claim. Every claim can update provider or route reputation.</p>
          <p>Agent Run Receipts convert investigations into receipts, claims, and eventually reputation.</p>
          <p>Claim Candidate Review decides whether the market should accept, dispute, reject, or request more evidence.</p>
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
        <article>
          <span>4</span>
          <h2>Agent Run Receipts</h2>
          <p>Infopunks converts those investigations into receipts, claims, and eventually reputation.</p>
        </article>
        <article>
          <span>5</span>
          <h2>Claim Candidate Review</h2>
          <p>Claim Candidates propose what the evidence means; Claim Review decides whether market memory should move.</p>
        </article>
      </section>
      <section className="panel hermes-narrative-copy">
        <p>Hermes should be allowed to investigate before money moves, but not allowed to turn investigation into trust by itself. Radar keeps that boundary explicit: a run can suggest a decision, but the proof feed decides whether the evidence says trust, caution, do_not_use_yet, unproven, or disputed.</p>
        <p>This is how agent experience becomes market memory.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Claim Candidate Review">
        <p className="section-kicker">Claim Candidate Review</p>
        <h2>Receipts remember what happened. Claims decide what it means. Reputation decides who gets trusted next.</h2>
        <p>Hermes runs are pre-spend investigations. Agent Run Receipts preserve what happened. Claim Candidates propose what the evidence means. Claim Review decides whether the market should accept, dispute, reject, or request more evidence. Reputation Impact determines who gets trusted next.</p>
      </section>
    </main>
  </div>;
}

function HermesDeskSurface() {
  const [summary, setSummary] = useState<HermesDeskSummary | null>(null);
  const [health, setHealth] = useState<HermesHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes');
  }, []);

  useEffect(() => {
    api<HermesDeskSummary>('/v1/hermes')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_desk_unavailable'));

    api<HermesHealthResponse>('/v1/hermes/health')
      .then((response) => setHealth(response.data))
      .catch(() => setHealth({
        status: 'error',
        mode: 'mock',
        error: 'health_check_failed'
      }));
  }, []);

  const activeRuns = useMemo(() => (summary?.runs ?? []).filter((run) => run.state === 'queued' || run.state === 'running'), [summary?.runs]);
  const completedRuns = useMemo(() => (summary?.runs ?? []).filter((run) => run.state === 'completed'), [summary?.runs]);
  const receiptPreviews = useMemo(() => {
    return new Map((summary?.runs ?? []).map((run) => [run.id, convertHermesRunToReceipt(run)]));
  }, [summary?.runs]);
  const claimPromotions = useMemo(() => {
    return new Map((summary?.runs ?? []).map((run) => [run.id, promoteHermesClaimCandidate(run)]));
  }, [summary?.runs]);
  const bridgeStatus = health?.status ?? 'mock';

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
            <a className="execute compact secondary" href="/hermes/skill-pack">Open Skill Pack</a>
            <a className="execute compact secondary" href="/narratives/hermes-desk">Read Narrative</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Sidecar state</p>
          <p>{summary ? `mode=${summary.sidecar.mode} enabled=${String(summary.sidecar.enabled)} live_http_allowed=${String(summary.sidecar.live_http_allowed)}` : 'mode=mock enabled=false live_http_allowed=false'}</p>
          <p>Bridge status: {bridgeStatus}{health?.mode ? ` (${health.mode})` : ''}</p>
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

        <section className="panel hermes-bridge-status" aria-label="Hermes bridge status">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Bridge status</p>
              <h2>Mock-safe sidecar reachability.</h2>
            </div>
            <a className="execute compact secondary" href="/v1/hermes/health">GET /v1/hermes/health</a>
          </div>
          <div className="machine-usage-list">
            <p><span>status</span><small>{bridgeStatus}</small></p>
            <p><span>mode</span><small>{health?.mode ?? summary.sidecar.mode}</small></p>
            <p><span>checked_at</span><small>{health?.checked_at ?? 'not available'}</small></p>
            <p><span>base_url</span><small>{health?.base_url ?? 'not configured'}</small></p>
            <p><span>bridge_note</span><small>{health?.error ?? 'Hermes can stay unavailable and Radar will keep serving mock-compatible runs.'}</small></p>
          </div>
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
            {activeRuns.map((run) => <HermesRunCard key={run.id} run={run} receiptPreview={receiptPreviews.get(run.id)} />)}
          </div>
        </section>

        <section className="panel hermes-runs-section" aria-label="Agent Run Receipts">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Agent Run Receipts</p>
              <h2>Every Hermes investigation can become a receipt.</h2>
            </div>
            <a className="execute compact secondary" href={`/v1/hermes/runs/${encodeURIComponent(summary.runs[0]?.id ?? 'hermes_pay_sh_route_pre_spend_check')}/receipt-preview`}>GET receipt preview</a>
          </div>
          <p className="copy">Every Hermes investigation can become a receipt. Every receipt can become a claim. Every claim can update market memory.</p>
          <div className="hermes-receipt-grid">
            {summary.runs.map((run) => {
              const preview = receiptPreviews.get(run.id);
              if (!preview) return null;
              return <article className="panel hermes-receipt-card" key={`${run.id}-receipt`}>
                <p className="section-kicker">{preview.conversion.status}</p>
                <h3>{preview.receipt.id}</h3>
                <div className="machine-usage-list">
                  <p><span>source_run</span><small>{preview.run_id}</small></p>
                  <p><span>decision</span><small>{decisionLabel(preview.receipt.decision)}</small></p>
                  <p><span>confidence</span><small>{preview.receipt.confidence}</small></p>
                  <p><span>evidence_count</span><small>{preview.receipt.evidence_count}</small></p>
                  <p><span>claim_candidate</span><small>{preview.claim_candidate.title}</small></p>
                </div>
              </article>;
            })}
          </div>
        </section>

        <section className="panel hermes-runs-section" aria-label="Claim Candidate Review">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Claim Candidate Review</p>
              <h2>Receipts remember what happened. Claims decide what it means. Reputation decides who gets trusted next.</h2>
            </div>
            <a className="execute compact secondary" href={`/v1/hermes/runs/${encodeURIComponent(summary.runs[0]?.id ?? 'hermes_pay_sh_route_pre_spend_check')}/claim/promotion-preview`}>GET promotion preview</a>
          </div>
          <div className="hermes-flow-strip" aria-label="Hermes claim promotion flow">
            {['Hermes Run', 'Agent Run Receipt', 'Claim Candidate', 'Reviewed Claim', 'Reputation Impact'].map((step, index) => (
              <React.Fragment key={step}>
                <span>{step}</span>
                {index < 4 && <b aria-hidden="true">-&gt;</b>}
              </React.Fragment>
            ))}
          </div>
          <div className="hermes-claim-review-grid">
            {summary.runs.map((run) => {
              const receiptPreview = receiptPreviews.get(run.id);
              const promotion = claimPromotions.get(run.id);
              if (!receiptPreview || !promotion) return null;
              const impact = promotion.promoted_claim.reputation_impact;
              return <article className={`panel hermes-claim-review-card review-${promotion.promoted_claim.review_state}`} key={`${run.id}-claim-review`}>
                <div className="abundance-card-head">
                  <p className="section-kicker">{promotion.conversion.status}</p>
                  <span className={`hermes-review-badge review-${promotion.promoted_claim.review_state}`}>{reviewStateLabel(promotion.promoted_claim.review_state)}</span>
                </div>
                <h3>{promotion.promoted_claim.title}</h3>
                <div className="machine-usage-list">
                  <p><span>source_run</span><small>{promotion.run_id}</small></p>
                  <p><span>receipt_id</span><small>{promotion.promoted_claim.source_receipt_id}</small></p>
                  <p><span>claim_candidate</span><small>{receiptPreview.claim_candidate.title}</small></p>
                  <p><span>promoted_claim</span><small>{promotion.promoted_claim.id}</small></p>
                  <p><span>review_state</span><small>{promotion.promoted_claim.review_state}</small></p>
                  <p><span>decision</span><small>{decisionLabel(promotion.promoted_claim.decision)}</small></p>
                  <p><span>confidence</span><small>{promotion.promoted_claim.confidence}</small></p>
                  <p><span>evidence_count</span><small>{promotion.promoted_claim.evidence_count}</small></p>
                  <p><span>impact</span><small>{impact.direction}</small></p>
                  <p><span>target</span><small>{impact.target_type}{impact.target_id ? `:${impact.target_id}` : ''}</small></p>
                </div>
                <div className="machine-usage-list">
                  {impact.reputation_notes.map((note) => <p key={`${promotion.promoted_claim.id}-${note}`}><span>reputation_note</span><small>{note}</small></p>)}
                </div>
              </article>;
            })}
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
            {completedRuns.map((run) => <HermesRunCard key={run.id} run={run} receiptPreview={receiptPreviews.get(run.id)} />)}
          </div>
        </section>

        <SkillPackSection summary={summary} />
      </>}
    </main>
  </div>;
}

function HermesSkillPackPage() {
  const [skillPack, setSkillPack] = useState<HermesSkillPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/skill-pack');
  }, []);

  useEffect(() => {
    api<HermesSkillPack>('/v1/hermes/skill-pack')
      .then((response) => setSkillPack(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_skill_pack_unavailable'));
  }, []);

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-skill-pack-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/skill-pack" />
    </header>
    <main id="hermes-skill-pack-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Skill Manifest</p>
          <h1>Infopunks Hermes Skill Pack</h1>
          <p className="copy hermes-hero-copy">How Hermes learns to investigate before money moves.</p>
          <p className="copy">Hermes runs the investigation. Infopunks turns the investigation into market memory.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/skill-pack">Open Manifest JSON</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Linked primitives</p>
          <p>{skillPack ? skillPack.linked_infopunks_primitives.join(' / ') : 'routes / providers / receipts / claims / loops / proof checks'}</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!skillPack && !error && <section className="panel"><p className="route-state">Loading Hermes Skill Pack...</p></section>}
      {skillPack && <>
        <section className="panel hermes-skills" aria-label="Hermes skill cards">
          <div className="panel-head">
            <div>
              <p className="section-kicker">{skillPack.version}</p>
              <h2>{skillPack.summary}</h2>
            </div>
            <a className="execute compact secondary" href="/v1/hermes/skill-pack/skills">GET skills</a>
          </div>
          <div className="hermes-skill-grid">
            {skillPack.skills.map((skill) => <article className="panel hermes-skill-card" key={skill.id}>
              <p className="section-kicker">{skill.id}</p>
              <h3>{skill.title}</h3>
              <p>{skill.purpose}</p>
              <div className="machine-usage-list">
                <p><span>when_to_use</span><small>{skill.when_to_use[0]}</small></p>
                <p><span>decision_mapping</span><small>{Object.keys(skill.decision_mapping).join(', ')}</small></p>
              </div>
              <div className="abundance-chip-row">
                {skill.linked_infopunks_primitives.map((primitive) => <span key={`${skill.id}-${primitive}`}>{primitive}</span>)}
              </div>
            </article>)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Skill pack rules">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Rules</p>
              <h2>Infopunks-native doctrine.</h2>
            </div>
          </div>
          <div className="hermes-rule-grid">
            {skillPack.doctrine_rules.map((rule) => <article key={rule.id}>
              <h3>{rule.title}</h3>
              <p>{rule.description}</p>
            </article>)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Expected output schema">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Expected output schema</p>
              <h2>Run output must be receipt-ready.</h2>
            </div>
          </div>
          <div className="machine-usage-list">
            <p><span>required_fields</span><small>{skillPack.expected_output_schema.required_fields.join(', ')}</small></p>
            <p><span>artifact_contract</span><small>{skillPack.expected_output_schema.artifact_contract.join(', ')}</small></p>
            <p><span>receipt_ready_fields</span><small>{skillPack.expected_output_schema.receipt_ready_fields.join(', ')}</small></p>
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Decision state mapping">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Decision state mapping</p>
              <h2>Trust language stays bounded.</h2>
            </div>
          </div>
          <div className="machine-usage-list">
            {Object.entries(skillPack.decision_state_mapping).map(([decision, explanation]) => (
              <p key={decision}><span>{decision}</span><small>{explanation}</small></p>
            ))}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Linked primitives">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Linked primitives</p>
              <h2>Routes, providers, receipts, claims, loops, and proof checks.</h2>
            </div>
          </div>
          <div className="abundance-chip-row">
            {skillPack.linked_infopunks_primitives.map((primitive) => <span key={primitive}>{primitive}</span>)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Promotion-ready outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Promotion-ready outputs</p>
              <h2>Skills should produce evidence suitable for claim review.</h2>
            </div>
          </div>
          <div className="abundance-chip-row">
            {['receipt generation', 'claim candidate creation', 'claim review', 'reputation impact'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

export function HermesDeskPage({ narrativeRoute = false, skillPackRoute = false }: { narrativeRoute?: boolean; skillPackRoute?: boolean }) {
  if (skillPackRoute) return <HermesSkillPackPage />;
  return narrativeRoute ? <HermesNarrativePage /> : <HermesDeskSurface />;
}
