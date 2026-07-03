import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { HermesDecisionState, HermesDeskSummary, HermesRun, HermesRunState } from '../data/hermesDesk';
import type { HermesSkillPack } from '../data/hermesSkillPack';
import { convertHermesRunToReceipt, type HermesRunReceiptConversion } from '../services/hermesReceiptConverter';
import { promoteHermesClaimCandidate, type HermesClaimReviewState } from '../services/hermesClaimPromotion';
import type { HermesReputationLedgerEntry, HermesReputationLedgerSummary, HermesReputationState } from '../services/hermesReputationLedger';
import type {
  HermesPreSpendDecision,
  HermesPreSpendDecisionState,
  HermesPreSpendDecisionInputReference,
  HermesPreSpendRequiredAction,
  HermesPreSpendRiskFactor
} from '../services/hermesPreSpendDecision';
import type { HermesDecisionFeedbackResult, HermesDecisionOutcomeState, HermesDecisionReceipt } from '../services/hermesDecisionFeedback';
import { createHermesDecisionReceipt, recordHermesDecisionOutcome } from '../services/hermesDecisionFeedback';
import type { HermesMemoryLoop, HermesMemoryLoopSummary } from '../services/hermesMemoryLoop';
import { createHermesPolicyDecisionReceipt, type HermesPolicyDecisionReceiptConversion } from '../services/hermesPolicyReceipt';
import type {
  HermesSpendPolicy,
  HermesSpendPolicyCheckResult,
  HermesSpendPolicyDecision,
  HermesSpendPolicyReference,
  HermesSpendPolicyRule,
  HermesSpendPolicyViolation
} from '../services/hermesSpendPolicy';
import {
  previewHermesPolicyReconciliation,
  type HermesPolicyComplianceState,
  type HermesPolicyOutcomeState,
  type HermesPolicyReconciliationResult
} from '../services/hermesPolicyReconciliation';
import type {
  HermesWalletAuditEvent,
  HermesWalletAuditEventState,
  HermesWalletAuditRiskPosture,
  HermesWalletAuditSummary,
  HermesWalletAuditTrail
} from '../services/hermesWalletAuditTrail';
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

function reputationStateLabel(state: HermesReputationState) {
  return ({
    trusted: 'Trusted',
    watchlist: 'Watchlist',
    unproven: 'Unproven',
    degraded: 'Degraded',
    disputed: 'Disputed'
  } as const)[state];
}

function formatLedgerNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function titleCaseWords(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function preSpendDecisionLabel(state: HermesPreSpendDecisionState) {
  return titleCaseWords(state);
}

function requiredActionLabel(state: HermesPreSpendRequiredAction | HermesSpendPolicyCheckResult['required_action']) {
  return titleCaseWords(state);
}

function riskSeverityLabel(severity: HermesPreSpendRiskFactor['severity']) {
  return titleCaseWords(severity);
}

function outcomeStateLabel(state: HermesDecisionOutcomeState) {
  return titleCaseWords(state);
}

function spendPolicyDecisionLabel(state: HermesSpendPolicyDecision) {
  return titleCaseWords(state);
}

function spendPolicyViolationOutcomeLabel(state: HermesSpendPolicyViolation['outcome']) {
  return titleCaseWords(state);
}

function policyRiskLevelLabel(state: HermesPolicyDecisionReceiptConversion['receipt']['risk_summary']['risk_level']) {
  return titleCaseWords(state);
}

function policyOutcomeStateLabel(state: HermesPolicyOutcomeState) {
  return titleCaseWords(state);
}

function policyComplianceStateLabel(state: HermesPolicyComplianceState) {
  return titleCaseWords(state);
}

function walletAuditEventStateLabel(state: HermesWalletAuditEventState) {
  return titleCaseWords(state);
}

function walletAuditRiskLevelLabel(level: HermesWalletAuditRiskPosture['level']) {
  return titleCaseWords(level);
}

function HermesNav({ current }: { current: string }) {
  const links = [
    { href: '/', label: 'Radar Home' },
    { href: '/hermes', label: 'Hermes Desk' },
    { href: '/hermes/memory-loop', label: 'Memory Loop' },
    { href: '/hermes/pre-spend-decision', label: 'Pre-Spend Decision' },
    { href: '/hermes/spend-policy', label: 'Spend Policy' },
    { href: '/hermes/decision-feedback', label: 'Decision Feedback' },
    { href: '/hermes/wallet-audit-trail', label: 'Wallet Audit Trail' },
    { href: '/hermes/reputation-ledger', label: 'Reputation Ledger' },
    { href: '/hermes/skill-pack', label: 'Skill Pack' },
    { href: '/narratives/hermes-desk', label: 'Narrative' },
    { href: '/check', label: 'Proof Feed' },
    { href: '/loops', label: 'Loops' },
    { href: '/receipts', label: 'Receipts' }
  ];

  function active(href: string) {
    if (href === '/hermes') return current === '/hermes';
    if (href === '/hermes/memory-loop') return current === '/hermes/memory-loop';
    if (href === '/hermes/pre-spend-decision') return current === '/hermes/pre-spend-decision';
    if (href === '/hermes/spend-policy') return current === '/hermes/spend-policy';
    if (href === '/hermes/decision-feedback') return current === '/hermes/decision-feedback';
    if (href === '/hermes/wallet-audit-trail') return current === '/hermes/wallet-audit-trail';
    if (href === '/hermes/reputation-ledger') return current === '/hermes/reputation-ledger';
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

function HermesMetric({ label, value, sub }: { label: string; value: string | number | boolean; sub: string }) {
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

function HermesLedgerEntryCard({ entry, compact = false }: { entry: HermesReputationLedgerEntry; compact?: boolean }) {
  const firstEvent = entry.decision_history[0];
  return <article className={`panel hermes-ledger-card state-${entry.current_state}`} aria-label={`${entry.label} reputation ledger entry`}>
    <div className="abundance-card-head">
      <p className="section-kicker">{entry.target_type}</p>
      <span className={`hermes-review-badge review-${entry.current_state}`}>{reputationStateLabel(entry.current_state)}</span>
    </div>
    <h3>{entry.label}</h3>
    <div className="machine-usage-list">
      <p><span>target_id</span><small>{entry.target_id ?? 'unknown'}</small></p>
      <p><span>trust_score</span><small>{entry.trust_score}</small></p>
      <p><span>impact_total</span><small>{formatLedgerNumber(entry.impact_total)}</small></p>
      <p><span>counts</span><small>positive={entry.positive_count} watch={entry.watch_count} negative={entry.negative_count} disputed={entry.disputed_count}</small></p>
      <p><span>latest_event</span><small>{entry.latest_event_at ?? 'not available'}</small></p>
      <p><span>source_claims</span><small>{entry.source_claim_ids.join(', ') || 'none'}</small></p>
      <p><span>source_receipts</span><small>{entry.source_receipt_ids.join(', ') || 'none'}</small></p>
      <p><span>source_runs</span><small>{entry.source_run_ids.join(', ') || 'none'}</small></p>
    </div>
    {!compact && <div className="hermes-ledger-history" aria-label={`${entry.label} decision history`}>
      {entry.decision_history.map((event) => <div key={event.id} className="hermes-timeline-event">
        <span>{event.direction} / {event.decision}</span>
        <small>{event.review_state} at {event.at}</small>
        <small>{event.summary}</small>
        {event.notes.slice(0, 2).map((note) => <small key={`${event.id}-${note}`}>{note}</small>)}
      </div>)}
    </div>}
    {compact && firstEvent && <p className="panel-caption">{firstEvent.direction} impact from {firstEvent.source_claim_id}</p>}
  </article>;
}

function HermesReputationLedgerSection({ ledger }: { ledger: HermesReputationLedgerSummary | null }) {
  if (!ledger) return <section className="panel"><p className="route-state">Loading Reputation Ledger...</p></section>;
  const providerEntries = ledger.entries.filter((entry) => entry.target_type === 'provider');
  const routeEntries = ledger.entries.filter((entry) => entry.target_type === 'route');

  return <section className="panel hermes-runs-section hermes-ledger-section" aria-label="Reputation Ledger">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Reputation Ledger</p>
        <h2>One receipt is evidence. One claim is judgment. Many judgments become reputation.</h2>
      </div>
      <a className="execute compact secondary" href="/v1/hermes/reputation-ledger">GET ledger</a>
      <a className="execute compact secondary" href="/hermes/reputation-ledger">Open ledger</a>
    </div>
    <p className="copy">One receipt is evidence.</p>
    <p className="copy">One claim is judgment.</p>
    <p className="copy">Many judgments become reputation.</p>
    <section className="grid four hermes-metric-grid" aria-label="Reputation Ledger summary">
      <HermesMetric label="entries" value={ledger.entry_count} sub="targets with reviewed claims" />
      <HermesMetric label="trusted" value={ledger.trusted_count} sub="evidence-backed trust" />
      <HermesMetric label="watchlist" value={ledger.watchlist_count} sub="needs more evidence" />
      <HermesMetric label="degraded" value={ledger.degraded_count} sub="negative movement" />
      <HermesMetric label="disputed" value={ledger.disputed_count} sub="challenged memory" />
    </section>
    <div className="hermes-ledger-grid">
      {ledger.entries.map((entry) => <HermesLedgerEntryCard key={`${entry.target_type}-${entry.target_id ?? 'unknown'}`} entry={entry} />)}
    </div>
    <div className="hermes-impact-surfaces">
      <section className="panel hermes-impact-surface" aria-label="Provider Impact Surface">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Provider Impact Surface</p>
            <h3>Provider trust from reviewed claims.</h3>
          </div>
          <a className="execute compact secondary" href="/v1/hermes/reputation-ledger/providers">GET providers</a>
        </div>
        <div className="hermes-ledger-grid compact">
          {providerEntries.map((entry) => <HermesLedgerEntryCard key={`provider-${entry.target_id}`} entry={entry} compact />)}
          {!providerEntries.length && <p className="route-state">No provider reputation entries yet.</p>}
        </div>
      </section>
      <section className="panel hermes-impact-surface" aria-label="Route Impact Surface">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Route Impact Surface</p>
            <h3>Route trust from reviewed claims.</h3>
          </div>
          <a className="execute compact secondary" href="/v1/hermes/reputation-ledger/routes">GET routes</a>
        </div>
        <div className="hermes-ledger-grid compact">
          {routeEntries.map((entry) => <HermesLedgerEntryCard key={`route-${entry.target_id}`} entry={entry} compact />)}
          {!routeEntries.length && <p className="route-state">No route reputation entries yet.</p>}
        </div>
      </section>
    </div>
  </section>;
}

function HermesInputReferenceList({
  title,
  items
}: {
  title: string;
  items: HermesPreSpendDecisionInputReference[];
}) {
  return <div className="machine-usage-list">
    <p><span>{title}</span><small>{items.length ? items.map((item) => item.id).join(', ') : 'none'}</small></p>
  </div>;
}

function HermesPreSpendDecisionCard({
  decision,
  compact = false
}: {
  decision: HermesPreSpendDecision;
  compact?: boolean;
}) {
  return <article className={`panel hermes-run-card state-${decision.decision}`} aria-label={`Pre-spend decision ${decision.id}`}>
    <div className="abundance-card-head">
      <p className="section-kicker">Pre-Spend Decision</p>
      <div className="abundance-chip-row">
        <span className={`narrative-decision-pill state-${decision.decision}`}>{preSpendDecisionLabel(decision.decision)}</span>
        <span className="narrative-evidence-chip">{requiredActionLabel(decision.required_action)}</span>
      </div>
    </div>
    <h3>{decision.input.route_id ?? 'No route specified'}</h3>
    <p>{decision.reason}</p>
    <div className="hermes-confidence" aria-label={`${decision.confidence} confidence`}>
      <span>confidence</span>
      <strong>{decision.confidence}</strong>
    </div>
    <div className="machine-usage-list">
      <p><span>route_id</span><small>{decision.input.route_id ?? 'not supplied'}</small></p>
      <p><span>provider_id</span><small>{decision.input.provider_id ?? 'not supplied'}</small></p>
      <p><span>service_id</span><small>{decision.input.service_id ?? 'not supplied'}</small></p>
      <p><span>amount_usd</span><small>{typeof decision.input.amount_usd === 'number' ? decision.input.amount_usd.toFixed(2) : 'not supplied'}</small></p>
      <p><span>decision</span><small>{decision.decision}</small></p>
      <p><span>required_action</span><small>{decision.required_action}</small></p>
      <p><span>ledger_state</span><small>{`provider=${decision.ledger_state.provider_state ?? 'missing'} route=${decision.ledger_state.route_state ?? 'missing'} service=${decision.ledger_state.service_state ?? 'missing'}`}</small></p>
      <p><span>ledger_score</span><small>{`provider=${decision.ledger_state.provider_score ?? 'na'} route=${decision.ledger_state.route_score ?? 'na'} service=${decision.ledger_state.service_score ?? 'na'}`}</small></p>
    </div>
    <div className="abundance-chip-row">
      {decision.risk_factors.map((risk) => <span key={risk.id}>{risk.label} ({riskSeverityLabel(risk.severity)})</span>)}
      {!decision.risk_factors.length && <span>no additional risk factors</span>}
    </div>
    {!compact && <>
      <div className="machine-usage-list">
        {decision.risk_factors.map((risk) => <p key={`${decision.id}-${risk.id}`}><span>{risk.source}</span><small>{risk.detail}</small></p>)}
      </div>
      <HermesInputReferenceList title="reputation inputs" items={decision.reputation_inputs} />
      <HermesInputReferenceList title="receipt inputs" items={decision.receipt_inputs} />
      <HermesInputReferenceList title="claim inputs" items={decision.claim_inputs} />
      <HermesInputReferenceList title="run inputs" items={decision.run_inputs} />
    </>}
  </article>;
}

function HermesPreSpendDecisionSection({ decision }: { decision: HermesPreSpendDecision | null }) {
  if (!decision) return <section className="panel"><p className="route-state">Loading Pre-Spend Decision Engine...</p></section>;

  return <section className="panel hermes-runs-section" aria-label="Pre-Spend Decision Engine">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Pre-Spend Decision Engine</p>
        <h2>Before an agent spends, it checks the ledger.</h2>
      </div>
      <a className="execute compact secondary" href="/v1/hermes/pre-spend-decision/example">GET example</a>
      <a className="execute compact secondary" href="/hermes/pre-spend-decision">Open decision engine</a>
    </div>
    <p className="copy">Reputation is not just displayed.</p>
    <p className="copy">Reputation now decides.</p>
    <div className="hermes-run-grid">
      <HermesPreSpendDecisionCard decision={decision} />
    </div>
  </section>;
}

function HermesSpendPolicyReferenceList({
  title,
  items
}: {
  title: string;
  items: HermesSpendPolicyReference[];
}) {
  return <section className="panel hermes-skill-pack-detail" aria-label={title}>
    <div className="panel-head">
      <div>
        <p className="section-kicker">{title}</p>
        <h2>{title}</h2>
      </div>
    </div>
    <div className="machine-usage-list">
      {items.map((item) => <p key={`${item.kind}-${item.id}`}><span>{`${item.kind}:${item.id}`}</span><small>{item.summary}</small></p>)}
      {!items.length && <p><span>none</span><small>No references were attached.</small></p>}
    </div>
  </section>;
}

function HermesSpendPolicyRuleMap({ rules }: { rules: HermesSpendPolicyRule[] }) {
  return <section className="panel hermes-skill-pack-detail" aria-label="Rule Map">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Rule Map</p>
        <h2>Deterministic policy rules.</h2>
      </div>
    </div>
    <div className="hermes-rule-grid">
      {rules.map((rule) => <article key={rule.id}>
        <h3>{rule.label}</h3>
        <p>{rule.description}</p>
        <p className="copy">{`${rule.id} · ${titleCaseWords(rule.severity)}`}</p>
      </article>)}
    </div>
  </section>;
}

function HermesSpendPolicyCard({
  result,
  compact = false
}: {
  result: HermesSpendPolicyCheckResult;
  compact?: boolean;
}) {
  return <article className={`panel hermes-run-card state-${result.decision}`} aria-label={`Spend policy result ${result.id}`}>
    <div className="abundance-card-head">
      <p className="section-kicker">Agent Spend Policy Layer</p>
      <div className="abundance-chip-row">
        <span className={`narrative-decision-pill state-${result.decision}`}>{spendPolicyDecisionLabel(result.decision)}</span>
        <span className="narrative-evidence-chip">{result.allowed ? 'Allowed' : 'Not allowed'}</span>
        <span className="narrative-evidence-chip">{requiredActionLabel(result.required_action)}</span>
      </div>
    </div>
    <h3>{result.policy.title}</h3>
    <p>{result.reason}</p>
    <div className="machine-usage-list">
      <p><span>policy_id</span><small>{result.policy.id}</small></p>
      <p><span>amount_usd</span><small>{typeof result.input.amount_usd === 'number' ? result.input.amount_usd.toFixed(2) : 'not supplied'}</small></p>
      <p><span>chain</span><small>{result.input.chain ?? 'not supplied'}</small></p>
      <p><span>payment_rail</span><small>{result.input.payment_rail ?? 'not supplied'}</small></p>
      <p><span>decision</span><small>{result.decision}</small></p>
      <p><span>allowed</span><small>{String(result.allowed)}</small></p>
      <p><span>required_action</span><small>{result.required_action}</small></p>
      <p><span>pre_spend_decision</span><small>{result.pre_spend_decision.decision}</small></p>
    </div>
    <div className="abundance-chip-row">
      {result.violations.map((item) => <span key={item.id}>{item.label} ({titleCaseWords(item.severity)})</span>)}
      {result.warnings.map((item) => <span key={item.id}>{item.label} ({titleCaseWords(item.severity)})</span>)}
      {!result.violations.length && !result.warnings.length && <span>no violations or warnings</span>}
    </div>
    {!compact && <>
      <div className="machine-usage-list">
        <p><span>max_amount_usd</span><small>{result.policy.max_amount_usd.toFixed(2)}</small></p>
        <p><span>allowed_chains</span><small>{result.policy.allowed_chains.join(', ') || 'none'}</small></p>
        <p><span>allowed_payment_rails</span><small>{result.policy.allowed_payment_rails.join(', ') || 'none'}</small></p>
        <p><span>blocked_providers</span><small>{result.policy.blocked_providers.join(', ') || 'none'}</small></p>
        <p><span>require_test_spend_for_watchlist</span><small>{String(result.policy.require_test_spend_for_watchlist)}</small></p>
        <p><span>manual_review_threshold_usd</span><small>{result.policy.manual_review_threshold_usd.toFixed(2)}</small></p>
        <p><span>do_not_spend_on_disputed</span><small>{String(result.policy.do_not_spend_on_disputed)}</small></p>
      </div>
    </>}
  </article>;
}

function HermesSpendPolicySection({
  result
}: {
  result: HermesSpendPolicyCheckResult | null;
}) {
  if (!result) return <section className="panel"><p className="route-state">Loading Agent Spend Policy Layer...</p></section>;

  return <section className="panel hermes-runs-section" aria-label="Agent Spend Policy Layer">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Agent Spend Policy Layer</p>
        <h2>Decision tells an agent what to do.</h2>
      </div>
      <a className="execute compact secondary" href="/v1/hermes/spend-policy/example">GET example</a>
      <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
    </div>
    <p className="copy">Policy tells an agent what it is allowed to do.</p>
    <div className="hermes-run-grid">
      <HermesSpendPolicyCard result={result} compact />
    </div>
  </section>;
}

function HermesPolicyReconciliationCard({
  reconciliation,
  policyDecision,
  compact = false
}: {
  reconciliation: HermesPolicyReconciliationResult;
  policyDecision?: HermesSpendPolicyDecision;
  compact?: boolean;
}) {
  return <article className={`panel hermes-run-card state-${reconciliation.compliance_state}`} aria-label={`Policy reconciliation ${reconciliation.check_id}`}>
    <div className="abundance-card-head">
      <p className="section-kicker">Policy Outcome Reconciliation</p>
      <div className="abundance-chip-row">
        <span className={`narrative-decision-pill state-${reconciliation.outcome.outcome_state}`}>{policyOutcomeStateLabel(reconciliation.outcome.outcome_state)}</span>
        <span className="narrative-evidence-chip">{policyComplianceStateLabel(reconciliation.compliance_state)}</span>
        <span className="narrative-evidence-chip">{reconciliation.feedback.next_policy_action}</span>
      </div>
    </div>
    <h3>{reconciliation.policy_receipt_id}</h3>
    <p>{reconciliation.summary}</p>
    <div className="machine-usage-list">
      <p><span>check_id</span><small>{reconciliation.check_id}</small></p>
      <p><span>policy_receipt_id</span><small>{reconciliation.policy_receipt_id}</small></p>
      <p><span>policy_decision</span><small>{policyDecision ?? 'not available'}</small></p>
      <p><span>outcome_state</span><small>{reconciliation.outcome.outcome_state}</small></p>
      <p><span>compliance_state</span><small>{reconciliation.compliance_state}</small></p>
      <p><span>spend_happened</span><small>{String(reconciliation.outcome.spend_happened)}</small></p>
      <p><span>amount_usd</span><small>{typeof reconciliation.outcome.amount_usd === 'number' ? reconciliation.outcome.amount_usd.toFixed(2) : 'not supplied'}</small></p>
      <p><span>impact_direction</span><small>{reconciliation.impact.direction}</small></p>
      <p><span>impact_magnitude</span><small>{reconciliation.impact.magnitude}</small></p>
      <p><span>next_policy_action</span><small>{reconciliation.feedback.next_policy_action}</small></p>
    </div>
    <div className="abundance-chip-row">
      {reconciliation.findings.map((finding) => <span key={finding.id}>{finding.label}</span>)}
      {!reconciliation.findings.length && <span>no findings</span>}
    </div>
    {!compact && <>
      <div className="hermes-flow-strip" aria-label="Policy reconciliation flow">
        {['Policy Check', 'Policy Receipt', 'Wallet Outcome', 'Reconciliation', 'Feedback'].map((step, index) => (
          <React.Fragment key={step}>
            <span>{step}</span>
            {index < 4 && <b aria-hidden="true">-&gt;</b>}
          </React.Fragment>
        ))}
      </div>
      <div className="machine-usage-list">
        {reconciliation.findings.map((finding) => <p key={finding.id}><span>{finding.label}</span><small>{finding.detail}</small></p>)}
        {!reconciliation.findings.length && <p><span>findings</span><small>No deterministic reconciliation findings were raised.</small></p>}
      </div>
    </>}
  </article>;
}

function HermesPolicyReconciliationSection({
  result
}: {
  result: HermesSpendPolicyCheckResult | null;
}) {
  if (!result) return <section className="panel"><p className="route-state">Loading Policy Outcome Reconciliation...</p></section>;
  const reconciliation = previewHermesPolicyReconciliation(result);

  return <section className="panel hermes-runs-section" aria-label="Policy Outcome Reconciliation">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Policy Outcome Reconciliation</p>
        <h2>A policy receipt proves what was allowed.</h2>
      </div>
      <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
    </div>
    <p className="copy">A reconciliation proves what actually happened.</p>
    <div className="hermes-run-grid">
      <HermesPolicyReconciliationCard reconciliation={reconciliation} policyDecision={result.decision} compact />
    </div>
  </section>;
}

function HermesDecisionFeedbackCard({
  feedback,
  compact = false
}: {
  feedback: HermesDecisionFeedbackResult;
  compact?: boolean;
}) {
  return <article className={`panel hermes-run-card state-${feedback.outcome.impact.direction}`} aria-label={`Decision feedback ${feedback.decision_id}`}>
    <div className="abundance-card-head">
      <p className="section-kicker">Decision Feedback</p>
      <div className="abundance-chip-row">
        <span className={`narrative-decision-pill state-${feedback.receipt.decision}`}>{preSpendDecisionLabel(feedback.receipt.decision)}</span>
        <span className="narrative-evidence-chip">{outcomeStateLabel(feedback.outcome.outcome_state)}</span>
        <span className="narrative-evidence-chip">{feedback.outcome.impact.direction}</span>
      </div>
    </div>
    <h3>{feedback.receipt.id}</h3>
    <p>{feedback.outcome.outcome_summary}</p>
    <div className="machine-usage-list">
      <p><span>decision_id</span><small>{feedback.decision_id}</small></p>
      <p><span>receipt_id</span><small>{feedback.receipt.id}</small></p>
      <p><span>decision</span><small>{feedback.receipt.decision}</small></p>
      <p><span>required_action</span><small>{feedback.receipt.required_action}</small></p>
      <p><span>confidence</span><small>{feedback.receipt.confidence}</small></p>
      <p><span>outcome_state</span><small>{feedback.outcome.outcome_state}</small></p>
      <p><span>spend_happened</span><small>{String(feedback.outcome.spend_happened)}</small></p>
      <p><span>impact_direction</span><small>{feedback.outcome.impact.direction}</small></p>
      <p><span>impact_magnitude</span><small>{feedback.outcome.impact.magnitude}</small></p>
      <p><span>target</span><small>{`${feedback.outcome.impact.target_type}:${feedback.outcome.impact.target_id ?? 'unknown'}`}</small></p>
    </div>
    <div className="abundance-chip-row">
      {feedback.reputation_feedback.reputation_notes.map((note) => <span key={`${feedback.decision_id}-${note}`}>{note}</span>)}
    </div>
    {!compact && <>
      <div className="hermes-flow-strip" aria-label="Decision feedback flow">
        {['Pre-Spend Decision', 'Decision Receipt', 'Spend Outcome', 'Reputation Feedback', 'Better Next Spend'].map((step, index) => (
          <React.Fragment key={step}>
            <span>{step}</span>
            {index < 4 && <b aria-hidden="true">-&gt;</b>}
          </React.Fragment>
        ))}
      </div>
      <div className="machine-usage-list">
        {feedback.reputation_feedback.reputation_notes.map((note) => <p key={note}><span>reputation_note</span><small>{note}</small></p>)}
      </div>
    </>}
  </article>;
}

function HermesDecisionFeedbackSection({ decision }: { decision: HermesPreSpendDecision | null }) {
  if (!decision) return <section className="panel"><p className="route-state">Loading Decision Receipt and Feedback Loop...</p></section>;
  const feedback = recordHermesDecisionOutcome(decision);

  return <section className="panel hermes-runs-section" aria-label="Decision Receipt and Feedback Loop">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Decision Receipt and Feedback Loop</p>
        <h2>A decision becomes intelligence when the outcome is recorded.</h2>
      </div>
      <a className="execute compact secondary" href={`/hermes/decision-feedback`}>Open feedback loop</a>
    </div>
    <p className="copy">A decision without an outcome is advice.</p>
    <p className="copy">A decision with a receipt becomes intelligence.</p>
    <div className="hermes-run-grid">
      <HermesDecisionFeedbackCard feedback={feedback} compact />
    </div>
  </section>;
}

function walletAuditReferenceCount(trail: HermesWalletAuditTrail) {
  return new Set(trail.events.flatMap((event) => event.references.map((reference) => `${reference.kind}:${reference.id}`))).size;
}

function HermesWalletAuditEventCard({ event }: { event: HermesWalletAuditEvent }) {
  return <article className={`panel hermes-run-card state-${event.state}`} aria-label={event.title}>
    <div className="abundance-card-head">
      <p className="section-kicker">{titleCaseWords(event.kind)}</p>
      <div className="abundance-chip-row">
        <span className={`narrative-decision-pill state-${event.state}`}>{walletAuditEventStateLabel(event.state)}</span>
        <span className="narrative-evidence-chip">{event.actor}</span>
      </div>
    </div>
    <h3>{event.title}</h3>
    <p>{event.summary}</p>
    <div className="machine-usage-list">
      <p><span>source_id</span><small>{event.source_id ?? 'not available'}</small></p>
      <p><span>actor</span><small>{event.actor}</small></p>
      <p><span>at</span><small>{event.at}</small></p>
      <p><span>decision</span><small>{event.decision ?? 'not available'}</small></p>
      <p><span>compliance_state</span><small>{event.compliance_state ?? 'not available'}</small></p>
      <p><span>required_action</span><small>{event.required_action ?? 'not available'}</small></p>
      <p><span>amount / chain / rail</span><small>{typeof event.amount_usd === 'number' ? `$${event.amount_usd.toFixed(2)}` : 'not supplied'} / {event.chain ?? 'not supplied'} / {event.payment_rail ?? 'not supplied'}</small></p>
      <p><span>references</span><small>{event.references.length}</small></p>
    </div>
  </article>;
}

function HermesWalletAuditCompactCard({ trail }: { trail: HermesWalletAuditTrail }) {
  return <section className="panel hermes-skill-pack-detail" aria-label="Autonomous Wallet Audit Trail">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Autonomous Wallet Audit Trail</p>
        <h2>Autonomous wallets need more than logs.</h2>
      </div>
      <a className="execute compact secondary" href="/hermes/wallet-audit-trail">Open Wallet Audit Trail</a>
    </div>
    <p className="copy">They need audit trails with judgment.</p>
    <div className="machine-usage-list">
      <p><span>trail_id</span><small>{trail.id}</small></p>
      <p><span>risk_posture</span><small>{walletAuditRiskLevelLabel(trail.risk_posture.level)}</small></p>
      <p><span>event_count</span><small>{trail.summary.event_count}</small></p>
      <p><span>policy_decision</span><small>{trail.events.find((event) => event.kind === 'policy_check')?.decision ?? 'not available'}</small></p>
      <p><span>compliance_state</span><small>{trail.summary.final_compliance_state ?? 'not available'}</small></p>
      <p><span>next_policy_action</span><small>{trail.summary.next_policy_action ?? 'not available'}</small></p>
    </div>
  </section>;
}

function HermesWalletAuditTrailPage() {
  const [auditSummary, setAuditSummary] = useState<HermesWalletAuditSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/wallet-audit-trail');
  }, []);

  useEffect(() => {
    api<HermesWalletAuditSummary>('/v1/hermes/wallet-audit-trail')
      .then((response) => setAuditSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_wallet_audit_trail_unavailable'));
  }, []);

  const trail = auditSummary?.trails[0] ?? null;
  const orderedSteps = ['Spend Intent', 'Pre-Spend Decision', 'Decision Receipt', 'Policy Check', 'Policy Receipt', 'Wallet Outcome', 'Reconciliation', 'Feedback'];
  const references = trail ? Array.from(new Map(
    trail.events.flatMap((event) => event.references).map((reference) => [`${reference.kind}:${reference.id}`, reference] as const)
  ).values()) : [];

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-wallet-audit-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/wallet-audit-trail" />
    </header>
    <main id="hermes-wallet-audit-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Wallet Judgment Timeline</p>
          <h1>Autonomous Wallet Audit Trail</h1>
          <p className="copy hermes-hero-copy">Autonomous wallets need more than logs. They need audit trails with judgment.</p>
          <p className="copy">Spend Intent -&gt; Pre-Spend Decision -&gt; Decision Receipt -&gt; Policy Check -&gt; Policy Receipt -&gt; Wallet Outcome -&gt; Reconciliation -&gt; Feedback</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/wallet-audit-trail">Open Audit Trail JSON</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Stateless build</p>
          <p>No live Hermes sidecar is required.</p>
          <p>No persistence or wallet mutation is performed by this audit trail.</p>
        </div>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!error && !trail && <section className="panel"><p className="route-state">Loading Autonomous Wallet Audit Trail...</p></section>}
      {trail && <>
        <section className="panel hermes-skill-pack-detail" aria-label="Audit Trail Summary">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Audit Trail Summary</p>
              <h2>{trail.thesis}</h2>
            </div>
          </div>
          <div className="machine-usage-list">
            <p><span>trail_id</span><small>{trail.id}</small></p>
            <p><span>source_check_id</span><small>{trail.source_check_id}</small></p>
            <p><span>source_decision_id</span><small>{trail.source_decision_id}</small></p>
            <p><span>event_count</span><small>{trail.summary.event_count}</small></p>
            <p><span>final_compliance_state</span><small>{trail.summary.final_compliance_state ?? 'not available'}</small></p>
            <p><span>final_feedback_direction</span><small>{trail.summary.final_feedback_direction ?? 'not available'}</small></p>
            <p><span>next_policy_action</span><small>{trail.summary.next_policy_action ?? 'not available'}</small></p>
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Risk Posture">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Risk Posture</p>
              <h2>{walletAuditRiskLevelLabel(trail.risk_posture.level)}</h2>
            </div>
          </div>
          <p className="copy">{trail.risk_posture.summary}</p>
          <div className="abundance-chip-row">
            {trail.risk_posture.reasons.map((reason) => <span key={reason}>{reason}</span>)}
          </div>
        </section>

        <section className="panel hermes-runs-section" aria-label="Timeline">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Timeline</p>
              <h2>Eight deterministic wallet safety events.</h2>
            </div>
          </div>
          <div className="hermes-flow-strip" aria-label="Wallet audit trail flow">
            {orderedSteps.map((step, index) => (
              <React.Fragment key={step}>
                <span>{step}</span>
                {index < orderedSteps.length - 1 && <b aria-hidden="true">-&gt;</b>}
              </React.Fragment>
            ))}
          </div>
          <div className="hermes-run-grid">
            {trail.events.map((event) => <HermesWalletAuditEventCard key={event.id} event={event} />)}
          </div>
        </section>

        <section className="panel hermes-runs-section" aria-label="Signals">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Signals</p>
              <h2>Compact wallet safety indicators.</h2>
            </div>
          </div>
          <div className="grid four hermes-metric-grid">
            {trail.signals.map((signal) => <HermesMetric key={signal.id} label={signal.label} value={signal.value} sub={signal.summary} />)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="References">
          <div className="panel-head">
            <div>
              <p className="section-kicker">References</p>
              <h2>Stitched evidence handles across the wallet sequence.</h2>
            </div>
          </div>
          <div className="machine-usage-list">
            {references.map((reference) => <p key={`${reference.kind}:${reference.id}`}><span>{`${reference.kind}:${reference.id}`}</span><small>{reference.summary}</small></p>)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="What builders can inspect">
          <div className="panel-head">
            <div>
              <p className="section-kicker">What builders can inspect</p>
              <h2>One timeline, one inspection surface.</h2>
            </div>
          </div>
          <p className="copy">Builders can inspect the spend intent, decision reason, receipt trail, policy gate, wallet outcome, reconciliation result, and feedback action in one place.</p>
          <div className="machine-usage-list">
            <p><span>reference_count</span><small>{walletAuditReferenceCount(trail)}</small></p>
            <p><span>recorded_count</span><small>{trail.summary.recorded_count}</small></p>
            <p><span>compliant_count</span><small>{trail.summary.compliant_count}</small></p>
            <p><span>needs_review_count</span><small>{trail.summary.needs_review_count}</small></p>
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function HermesMemoryLoopStageCard({ stage }: { stage: HermesMemoryLoop['stages'][number] }) {
  return <article className={`panel hermes-memory-stage state-${stage.state}`} aria-label={`${stage.label} memory stage`}>
    <div className="abundance-card-head">
      <p className="section-kicker">{stage.label}</p>
      <span className={`hermes-review-badge review-${stage.state}`}>{stage.state}</span>
    </div>
    <h3>{stage.title}</h3>
    <p>{stage.summary}</p>
    <div className="machine-usage-list">
      <p><span>primitive</span><small>{stage.primitive}</small></p>
      <p><span>source_id</span><small>{stage.source_id ?? 'not available'}</small></p>
      <p><span>decision</span><small>{stage.decision ?? 'not available'}</small></p>
      <p><span>confidence</span><small>{typeof stage.confidence === 'number' ? stage.confidence : 'not available'}</small></p>
      <p><span>evidence_count</span><small>{typeof stage.evidence_count === 'number' ? stage.evidence_count : 'not available'}</small></p>
      <p><span>target</span><small>{stage.target_type ? `${stage.target_type}:${stage.target_id ?? 'unknown'}` : 'not available'}</small></p>
    </div>
  </article>;
}

function HermesMemoryLoopDashboardPage() {
  const [memoryLoopSummary, setMemoryLoopSummary] = useState<HermesMemoryLoopSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/memory-loop');
  }, []);

  useEffect(() => {
    api<HermesMemoryLoopSummary>('/v1/hermes/memory-loop')
      .then((response) => setMemoryLoopSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_memory_loop_unavailable'));
  }, []);

  const loop = memoryLoopSummary?.loops[0] ?? null;
  const selectedSignals = loop?.signals.filter((signal) => [
    'evidence_count',
    'claim_review_state',
    'reputation_state',
    'pre_spend_decision',
    'required_action',
    'outcome_state',
    'feedback_direction'
  ].includes(signal.id)) ?? [];

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-memory-loop-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/memory-loop" />
    </header>
    <main id="hermes-memory-loop-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Agent Memory Circuit</p>
          <h1>Agent Memory Loop</h1>
          <p className="copy hermes-hero-copy">Agents do not need chat history. Agents need memory that changes future action.</p>
          <p className="copy">Run → Receipt → Claim → Review → Reputation → Decision → Outcome → Feedback</p>
          <p className="copy">Policy sits between Decision and Outcome as the wallet safety gate.</p>
          <p className="copy">Policy reconciliation compares the policy receipt against the actual wallet outcome before feedback is used for the next spend.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/memory-loop">Open Memory Loop JSON</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Stateless build</p>
          <p>No live Hermes sidecar is required.</p>
          <p>No receipts, claims, reputation entries, decisions, or outcomes are persisted or mutated by this dashboard.</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!error && !loop && <section className="panel"><p className="route-state">Loading Agent Memory Loop...</p></section>}
      {loop && <>
        <section className="panel hermes-runs-section" aria-label="Complete agent memory loop">
          <div className="panel-head">
            <div>
              <p className="section-kicker">{loop.source_run_id}</p>
              <h2>{loop.thesis}</h2>
            </div>
            <a className="execute compact secondary" href={`/v1/hermes/memory-loop/${encodeURIComponent(loop.id)}`}>GET loop</a>
          </div>
          <div className="hermes-flow-strip hermes-memory-flow" aria-label="Agent memory loop flow">
            {loop.stages.map((stage, index) => (
              <React.Fragment key={stage.id}>
                <span>{stage.label}</span>
                {index < loop.stages.length - 1 && <b aria-hidden="true">-&gt;</b>}
              </React.Fragment>
            ))}
          </div>
          <div className="hermes-memory-edge-list" aria-label="Memory loop edges">
            {loop.edges.map((edge) => <span key={edge.label}>{edge.label}: {edge.summary}</span>)}
          </div>
          <div className="hermes-memory-stage-grid">
            {loop.stages.map((stage) => <HermesMemoryLoopStageCard key={stage.id} stage={stage} />)}
          </div>
        </section>

        <section className="grid four hermes-metric-grid" aria-label="Memory loop signal summary">
          {selectedSignals.map((signal) => <HermesMetric key={signal.id} label={signal.label} value={signal.value} sub={signal.summary} />)}
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="What changed for the next spend?">
          <div className="panel-head">
            <div>
              <p className="section-kicker">What changed for the next spend?</p>
              <h2>The next agent does not start from zero.</h2>
            </div>
          </div>
          <p className="copy">The next agent does not start from zero. It inherits receipts, reviewed claims, reputation state, and feedback from previous outcomes.</p>
          <p className="copy">Policy sits between Decision and Outcome as the wallet safety gate.</p>
          <p className="copy">Policy decisions can now become receipts, making the safety gate auditable before the outcome feeds back into reputation.</p>
          <p className="copy">Optional artifact: Outcome → Policy Reconciliation → Feedback.</p>
          <div className="machine-usage-list">
            <p><span>current_decision</span><small>{loop.summary.current_decision ?? 'not available'}</small></p>
            <p><span>required_action</span><small>{loop.summary.current_required_action ?? 'not available'}</small></p>
            <p><span>reputation_state</span><small>{loop.summary.reputation_state ?? 'not available'}</small></p>
            <p><span>feedback_direction</span><small>{loop.summary.feedback_direction ?? 'not available'}</small></p>
          </div>
        </section>
        <section className="panel hermes-skill-pack-detail" aria-label="Wallet audit trail note">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Wallet audit trail</p>
              <h2>The memory loop teaches future action.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/wallet-audit-trail">Open Wallet Audit Trail</a>
          </div>
          <p className="copy">The memory loop teaches future action. The wallet audit trail makes that action inspectable.</p>
        </section>
      </>}
    </main>
  </div>;
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
      <section className="panel hermes-narrative-copy" aria-label="Reputation Ledger">
        <p className="section-kicker">Reputation Ledger</p>
        <h2>One receipt is evidence. One claim is judgment. Many judgments become reputation.</h2>
        <p>Agent Run Receipts preserve evidence. Claim Review decides what the evidence means. Reputation Ledger accumulates many reviewed claims.</p>
        <p>Providers, routes, and services become more or less trusted based on evidence-backed history.</p>
        <p>One receipt is evidence.</p>
        <p>One claim is judgment.</p>
        <p>Many judgments become reputation.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Pre-Spend Decision Engine">
        <p className="section-kicker">Pre-Spend Decision Engine</p>
        <h2>The Reputation Ledger is not only for display.</h2>
        <p>Agents should query it before money moves.</p>
        <p>The decision engine turns accumulated evidence into a spend recommendation.</p>
        <p>Every decision can create a new run, receipt, claim, and future reputation update.</p>
        <p>Reputation is not just displayed.</p>
        <p>Reputation now decides.</p>
        <p>Before an agent spends, it checks the ledger.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Agent Spend Policy Layer">
        <p className="section-kicker">Agent Spend Policy Layer</p>
        <h2>Decision tells an agent what to do. Policy tells an agent what it is allowed to do.</h2>
        <p>Decisions recommend action.</p>
        <p>Policies enforce boundaries.</p>
        <p>Autonomous wallets need both judgment and rules.</p>
        <p>Policy can block disputed providers, require test spends, enforce chain/payment rail limits, and escalate large spends to manual review.</p>
        <p>Decision tells an agent what to do.</p>
        <p>Policy tells an agent what it is allowed to do.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Policy Decision Receipts">
        <p className="section-kicker">Policy Decision Receipts</p>
        <h2>Policy checks should not be invisible runtime decisions.</h2>
        <p>Every allow, test, review, or block should be auditable.</p>
        <p>Policy receipts preserve the rule set, spend intent, decision, violations, warnings, and references used.</p>
        <p>These receipts can later be compared against outcomes and used as feedback.</p>
        <p>A policy decision should not disappear after the wallet acts. It should become an audit receipt.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Policy Outcome Reconciliation">
        <p className="section-kicker">Policy Outcome Reconciliation</p>
        <h2>Policy receipts preserve what the system allowed. Outcomes preserve what the wallet actually did.</h2>
        <p>Policy receipts preserve what the system allowed, tested, reviewed, or blocked.</p>
        <p>Outcomes show what actually happened.</p>
        <p>Reconciliation compares the expected policy behavior against observed wallet behavior.</p>
        <p>This detects non-compliance, missing manual review, spends despite blocks, and test-spend success.</p>
        <p>Reconciliation turns enforcement into feedback.</p>
        <p>A policy receipt proves what was allowed.</p>
        <p>A reconciliation proves what actually happened.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Decision Receipt and Feedback Loop">
        <p className="section-kicker">Decision Receipt and Feedback Loop</p>
        <h2>The loop closes when outcomes are recorded.</h2>
        <p>The Pre-Spend Decision Engine recommends action before money moves.</p>
        <p>Decision Receipts preserve why the recommendation was made.</p>
        <p>Outcomes record what actually happened after the decision.</p>
        <p>Feedback turns the result into future reputation input.</p>
        <p>This closes the loop from advice to intelligence.</p>
        <p>A decision without an outcome is advice.</p>
        <p>A decision with a receipt becomes intelligence.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Agent Memory Loop">
        <p className="section-kicker">Agent Memory Loop</p>
        <h2>Agents do not need chat history. Agents need memory that changes future action.</h2>
        <p>Hermes runs create evidence.</p>
        <p>Receipts preserve what happened.</p>
        <p>Claims interpret the evidence.</p>
        <p>Reviews decide whether the claim should affect trust.</p>
        <p>Reputation accumulates across claims.</p>
        <p>Decisions use reputation before money moves.</p>
        <p>Policy sits between Decision and Outcome as the wallet safety gate.</p>
        <p>Outcomes teach the next decision.</p>
        <p>Agents do not need chat history.</p>
        <p>Agents need memory that changes future action.</p>
      </section>
      <section className="panel hermes-narrative-copy" aria-label="Autonomous Wallet Audit Trail">
        <p className="section-kicker">Autonomous Wallet Audit Trail</p>
        <h2>Autonomous wallets need more than logs. They need audit trails with judgment.</h2>
        <p>Logs say what happened.</p>
        <p>Audit trails explain why it happened and whether it obeyed policy.</p>
        <p>Infopunks stitches spend intent, decision, receipts, policy checks, wallet outcomes, reconciliation, and feedback into one inspectable timeline.</p>
        <p>This makes autonomous wallet behavior understandable to builders, users, communities, and eventually regulators.</p>
      </section>
    </main>
  </div>;
}

function HermesDeskSurface() {
  const [summary, setSummary] = useState<HermesDeskSummary | null>(null);
  const [health, setHealth] = useState<HermesHealthResponse | null>(null);
  const [ledger, setLedger] = useState<HermesReputationLedgerSummary | null>(null);
  const [preSpendDecision, setPreSpendDecision] = useState<HermesPreSpendDecision | null>(null);
  const [spendPolicyResult, setSpendPolicyResult] = useState<HermesSpendPolicyCheckResult | null>(null);
  const [walletAuditSummary, setWalletAuditSummary] = useState<HermesWalletAuditSummary | null>(null);
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

    api<HermesReputationLedgerSummary>('/v1/hermes/reputation-ledger')
      .then((response) => setLedger(response.data))
      .catch(() => setLedger(null));

    api<HermesPreSpendDecision>('/v1/hermes/pre-spend-decision/example')
      .then((response) => setPreSpendDecision(response.data))
      .catch(() => setPreSpendDecision(null));

    api<HermesSpendPolicyCheckResult>('/v1/hermes/spend-policy/example')
      .then((response) => setSpendPolicyResult(response.data))
      .catch(() => setSpendPolicyResult(null));

    api<HermesWalletAuditSummary>('/v1/hermes/wallet-audit-trail')
      .then((response) => setWalletAuditSummary(response.data))
      .catch(() => setWalletAuditSummary(null));
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
  const policyReceiptPreview = useMemo(() => {
    if (!spendPolicyResult) return null;
    return createHermesPolicyDecisionReceipt(spendPolicyResult);
  }, [spendPolicyResult]);
  const policyReconciliationPreview = useMemo(() => {
    if (!spendPolicyResult) return null;
    return previewHermesPolicyReconciliation(spendPolicyResult);
  }, [spendPolicyResult]);
  const walletAuditTrail = walletAuditSummary?.trails[0] ?? null;

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

        <section className="panel hermes-runs-section" aria-label="Agent Memory Loop">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Agent Memory Loop</p>
              <h2>Agents do not need chat history.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
          </div>
          <p className="copy">Agents do not need chat history.</p>
          <p className="copy">Agents need memory that changes future action.</p>
          <div className="hermes-flow-strip" aria-label="Agent Memory Loop flow">
            {['Run', 'Receipt', 'Claim', 'Review', 'Reputation', 'Decision', 'Outcome', 'Feedback'].map((step, index) => (
              <React.Fragment key={step}>
                <span>{step}</span>
                {index < 7 && <b aria-hidden="true">-&gt;</b>}
              </React.Fragment>
            ))}
          </div>
          <p className="copy">Policy sits between Decision and Outcome as the wallet safety gate.</p>
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

        <HermesReputationLedgerSection ledger={ledger} />

        <HermesPreSpendDecisionSection decision={preSpendDecision} />

        <HermesSpendPolicySection result={spendPolicyResult} />

        {walletAuditTrail && <HermesWalletAuditCompactCard trail={walletAuditTrail} />}

        {policyReceiptPreview && <section className="panel hermes-skill-pack-detail" aria-label="Policy Decision Receipts">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Policy Decision Receipts</p>
              <h2>Policy checks become auditable wallet evidence.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
          </div>
          <p className="copy">A policy decision should not disappear after the wallet acts.</p>
          <p className="copy">It should become an audit receipt.</p>
          <div className="machine-usage-list">
            <p><span>policy_receipt_id</span><small>{policyReceiptPreview.receipt.id}</small></p>
            <p><span>decision</span><small>{spendPolicyDecisionLabel(policyReceiptPreview.receipt.policy_decision)}</small></p>
            <p><span>risk_level</span><small>{policyRiskLevelLabel(policyReceiptPreview.receipt.risk_summary.risk_level)}</small></p>
            <p><span>audit_trail_events</span><small>{policyReceiptPreview.receipt.audit_trail.events.length}</small></p>
          </div>
        </section>}

        {policyReconciliationPreview && <section className="panel hermes-skill-pack-detail" aria-label="Policy Outcome Reconciliation">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Policy Outcome Reconciliation</p>
              <h2>A policy receipt proves what was allowed.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
          </div>
          <p className="copy">A reconciliation proves what actually happened.</p>
          <div className="machine-usage-list">
            <p><span>compliance_state</span><small>{policyReconciliationPreview.compliance_state}</small></p>
            <p><span>outcome_state</span><small>{policyReconciliationPreview.outcome.outcome_state}</small></p>
            <p><span>next_policy_action</span><small>{policyReconciliationPreview.feedback.next_policy_action}</small></p>
            <p><span>impact_direction</span><small>{policyReconciliationPreview.impact.direction}</small></p>
          </div>
        </section>}

        <HermesDecisionFeedbackSection decision={preSpendDecision} />

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

        <section className="panel hermes-skill-pack-detail" aria-label="Reputation-aware skill outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Reputation-aware outputs</p>
              <h2>Hermes skills should produce outputs that can update reputation over time.</h2>
            </div>
          </div>
          <p className="copy">Hermes skills should produce outputs that can update reputation over time.</p>
          <div className="abundance-chip-row">
            {['route reputation', 'provider reputation', 'service reputation', 'disputed evidence', 'watchlist state'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
        <section className="panel hermes-skill-pack-detail" aria-label="Policy-ready outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Policy-ready outputs</p>
              <h2>Hermes skills should emit structured outputs that policy can evaluate deterministically.</h2>
            </div>
          </div>
        <p className="copy">Hermes skills should generate structured outputs useful for policy checks.</p>
        <div className="abundance-chip-row">
          {['risk level', 'required action', 'disputed evidence', 'provider status', 'route status', 'spend amount sensitivity', 'chain/payment rail context'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Reconciliation-ready outputs">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Reconciliation-ready outputs</p>
            <h2>Hermes skills should help compare expected policy behavior against observed outcomes.</h2>
          </div>
        </div>
        <p className="copy">Hermes skills should emit enough structured detail to compare what policy allowed against what the wallet actually did.</p>
        <div className="abundance-chip-row">
          {['expected action', 'allowed amount', 'observed spend', 'chain/payment rail used', 'manual review status', 'failure reason', 'evidence artifacts'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
        <section className="panel hermes-skill-pack-detail" aria-label="Audit-ready outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Audit-ready outputs</p>
              <h2>Hermes skills should produce outputs that can survive audit.</h2>
            </div>
          </div>
          <p className="copy">Policy receipts compare what the wallet was allowed to do against what actually happened, so skill outputs need audit-grade structure.</p>
          <div className="abundance-chip-row">
            {['decision reason', 'cited evidence', 'risk factors', 'rule triggers', 'expected action', 'outcome criteria'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
        <section className="panel hermes-skill-pack-detail" aria-label="Audit-trail-ready outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Audit-trail-ready outputs</p>
              <h2>Hermes skills should produce outputs that can be inspected later.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/wallet-audit-trail">Open Wallet Audit Trail</a>
          </div>
          <div className="abundance-chip-row">
            {['spend intent', 'decision reason', 'policy trigger', 'evidence reference', 'expected wallet behavior', 'actual wallet behavior', 'reconciliation finding', 'feedback action'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

      <section className="panel hermes-skill-pack-detail" aria-label="Memory-loop-ready skills">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Memory-loop-ready skills</p>
              <h2>Hermes skills should produce outputs that can flow through the full memory loop.</h2>
            </div>
            <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
          </div>
          <p className="copy">Hermes skills should produce outputs that can flow through: Run → Receipt → Claim → Review → Reputation → Decision → Outcome → Feedback</p>
          <p className="copy">Policy-ready outputs let the wallet add a final safety gate between Decision and Outcome.</p>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Decision-ready outputs">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Decision-ready outputs</p>
              <h2>Hermes skills should emit structured outputs that can feed the next spend decision.</h2>
            </div>
          </div>
          <div className="abundance-chip-row">
            {['pre-spend decisions', 'required actions', 'risk factors', 'reputation inputs', 'receipt generation', 'claim review'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section className="panel hermes-skill-pack-detail" aria-label="Feedback-ready skills">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Feedback-ready skills</p>
              <h2>Skills should emit outputs that can be compared with what happened after spend.</h2>
            </div>
          </div>
          <div className="abundance-chip-row">
            {['expected result', 'required action', 'risk factors', 'success criteria', 'failure reasons', 'evidence artifacts'].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function HermesSpendPolicyPage() {
  const [policySurface, setPolicySurface] = useState<{
    generated_at: string;
    count: number;
    policies: HermesSpendPolicy[];
    rules: HermesSpendPolicyRule[];
  } | null>(null);
  const [result, setResult] = useState<HermesSpendPolicyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/spend-policy');
  }, []);

  useEffect(() => {
    api<{
      generated_at: string;
      count: number;
      policies: HermesSpendPolicy[];
      rules: HermesSpendPolicyRule[];
    }>('/v1/hermes/spend-policy')
      .then((response) => setPolicySurface(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_spend_policy_unavailable'));

    api<HermesSpendPolicyCheckResult>('/v1/hermes/spend-policy/example')
      .then((response) => setResult(response.data))
      .catch(() => setResult(null));
  }, []);

  const policy = result?.policy ?? policySurface?.policies[0] ?? null;
  const receiptPreview = useMemo(() => (result ? createHermesPolicyDecisionReceipt(result) : null), [result]);
  const reconciliationPreview = useMemo(() => (result ? previewHermesPolicyReconciliation(result) : null), [result]);

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-spend-policy-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/spend-policy" />
    </header>
    <main id="hermes-spend-policy-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Wallet Safety Gate</p>
          <h1>Agent Spend Policy Layer</h1>
          <p className="copy hermes-hero-copy">Decision tells an agent what to do. Policy tells an agent what it is allowed to do.</p>
          <p className="copy">Before an agent spends, it checks the ledger. Before a wallet signs, it checks policy.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/spend-policy/example">Open Example JSON</a>
            <a className="execute compact secondary" href="/v1/hermes/spend-policy">Open Policy JSON</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Narrative</p>
          <p>Decision tells an agent what to do.</p>
          <p>Policy tells an agent what it is allowed to do.</p>
          <p>Before an agent spends, it checks the ledger. Before a wallet signs, it checks policy.</p>
        </div>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!error && !policy && <section className="panel"><p className="route-state">Loading Agent Spend Policy Layer...</p></section>}
      {policy && <section className="panel hermes-skill-pack-detail" aria-label="Policy Summary">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Policy Summary</p>
            <h2>{policy.title}</h2>
          </div>
        </div>
        <p className="copy">{policy.summary}</p>
        <div className="machine-usage-list">
          <p><span>max_amount_usd</span><small>{policy.max_amount_usd.toFixed(2)}</small></p>
          <p><span>allowed_chains</span><small>{policy.allowed_chains.join(', ') || 'none'}</small></p>
          <p><span>allowed_payment_rails</span><small>{policy.allowed_payment_rails.join(', ') || 'none'}</small></p>
          <p><span>blocked_providers</span><small>{policy.blocked_providers.join(', ') || 'none'}</small></p>
          <p><span>require_test_spend_for_watchlist</span><small>{String(policy.require_test_spend_for_watchlist)}</small></p>
          <p><span>manual_review_threshold_usd</span><small>{policy.manual_review_threshold_usd.toFixed(2)}</small></p>
          <p><span>do_not_spend_on_disputed</span><small>{String(policy.do_not_spend_on_disputed)}</small></p>
        </div>
      </section>}
      {result && <section className="panel hermes-skill-pack-detail" aria-label="Example Spend Intent">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Example Spend Intent</p>
            <h2>Deterministic seeded spend intent.</h2>
          </div>
        </div>
        <div className="machine-usage-list">
          <p><span>route_id</span><small>{result.input.route_id ?? 'not supplied'}</small></p>
          <p><span>provider_id</span><small>{result.input.provider_id ?? 'not supplied'}</small></p>
          <p><span>service_id</span><small>{result.input.service_id ?? 'not supplied'}</small></p>
          <p><span>amount_usd</span><small>{typeof result.input.amount_usd === 'number' ? result.input.amount_usd.toFixed(2) : 'not supplied'}</small></p>
          <p><span>payment_rail</span><small>{result.input.payment_rail ?? 'not supplied'}</small></p>
          <p><span>chain</span><small>{result.input.chain ?? 'not supplied'}</small></p>
        </div>
      </section>}
      {result && <section className="panel hermes-runs-section" aria-label="Policy Check Result">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Policy Check Result</p>
            <h2>Deterministic wallet gate output.</h2>
          </div>
        </div>
        <div className="hermes-run-grid">
          <HermesSpendPolicyCard result={result} />
        </div>
      </section>}
      {receiptPreview && <section className="panel hermes-runs-section" aria-label="Policy Decision Receipts">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Policy Decision Receipts</p>
            <h2>Policy checks become audit-ready receipts.</h2>
          </div>
          <a className="execute compact secondary" href={`/v1/hermes/spend-policy/check/${encodeURIComponent(receiptPreview.check_id)}/receipt-preview`}>GET receipt preview</a>
        </div>
        <p className="copy">A policy decision should not disappear after the wallet acts.</p>
        <p className="copy">It should become an audit receipt.</p>
        <div className="hermes-flow-strip" aria-label="Policy receipt flow">
          {['Spend Intent', 'Pre-Spend Decision', 'Policy Check', 'Policy Receipt', 'Audit Trail', 'Future Feedback'].map((step, index) => (
            <React.Fragment key={step}>
              <span>{step}</span>
              {index < 5 && <b aria-hidden="true">-&gt;</b>}
            </React.Fragment>
          ))}
        </div>
        <div className="hermes-run-grid">
          <article className="panel hermes-receipt-card">
            <p className="section-kicker">{receiptPreview.conversion.status}</p>
            <h3>{receiptPreview.receipt.id}</h3>
            <div className="machine-usage-list">
              <p><span>source_check_id</span><small>{receiptPreview.receipt.source_check_id}</small></p>
              <p><span>policy_id</span><small>{receiptPreview.receipt.source_policy_id}</small></p>
              <p><span>policy_decision</span><small>{spendPolicyDecisionLabel(receiptPreview.receipt.policy_decision)}</small></p>
              <p><span>allowed</span><small>{String(receiptPreview.receipt.allowed)}</small></p>
              <p><span>required_action</span><small>{receiptPreview.receipt.required_action}</small></p>
              <p><span>risk_level</span><small>{policyRiskLevelLabel(receiptPreview.receipt.risk_summary.risk_level)}</small></p>
              <p><span>violation_count</span><small>{receiptPreview.receipt.risk_summary.violation_count}</small></p>
              <p><span>warning_count</span><small>{receiptPreview.receipt.risk_summary.warning_count}</small></p>
              <p><span>audit_trail_event_count</span><small>{receiptPreview.receipt.audit_trail.events.length}</small></p>
              <p><span>references_count</span><small>{receiptPreview.receipt.references.length}</small></p>
            </div>
          </article>
        </div>
      </section>}
      {receiptPreview && <section className="panel hermes-skill-pack-detail" aria-label="Audit Trail">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Audit Trail</p>
            <h2>Deterministic policy decision evidence.</h2>
          </div>
        </div>
        <div className="machine-usage-list">
          {receiptPreview.receipt.audit_trail.events.map((event) => <p key={event.id}><span>{event.label.toLowerCase()}</span><small>{event.summary}</small></p>)}
        </div>
      </section>}
      {reconciliationPreview && <section className="panel hermes-runs-section" aria-label="Policy Outcome Reconciliation">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Policy Outcome Reconciliation</p>
            <h2>A policy receipt proves what was allowed.</h2>
          </div>
          <a className="execute compact secondary" href={`/v1/hermes/spend-policy/check/${encodeURIComponent(reconciliationPreview.check_id)}/reconciliation-preview`}>GET reconciliation preview</a>
        </div>
        <p className="copy">A reconciliation proves what actually happened.</p>
        <div className="hermes-flow-strip" aria-label="Policy outcome reconciliation flow">
          {['Policy Check', 'Policy Receipt', 'Wallet Outcome', 'Reconciliation', 'Feedback'].map((step, index) => (
            <React.Fragment key={step}>
              <span>{step}</span>
              {index < 4 && <b aria-hidden="true">-&gt;</b>}
            </React.Fragment>
          ))}
        </div>
        <div className="hermes-run-grid">
          <HermesPolicyReconciliationCard reconciliation={reconciliationPreview} policyDecision={result.decision} />
        </div>
      </section>}
      <section className="panel hermes-skill-pack-detail" aria-label="Wallet audit trail note">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Wallet audit trail</p>
            <h2>Policy checks, policy receipts, and reconciliations now roll up into one autonomous wallet audit trail.</h2>
          </div>
          <a className="execute compact secondary" href="/hermes/wallet-audit-trail">Open Wallet Audit Trail</a>
        </div>
      </section>
      {result && <section className="panel hermes-skill-pack-detail" aria-label="Violations and Warnings">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Violations and Warnings</p>
            <h2>Why the policy responded this way.</h2>
          </div>
        </div>
        <div className="machine-usage-list">
          {result.violations.map((item) => <p key={item.id}><span>{`${item.label} · ${spendPolicyViolationOutcomeLabel(item.outcome)}`}</span><small>{item.detail}</small></p>)}
          {result.warnings.map((item) => <p key={item.id}><span>{`${item.label} · ${spendPolicyViolationOutcomeLabel(item.outcome)}`}</span><small>{item.detail}</small></p>)}
          {!result.violations.length && !result.warnings.length && <p><span>none</span><small>No violations or warnings were raised.</small></p>}
        </div>
      </section>}
      {result && <section className="panel hermes-skill-pack-detail" aria-label="Pre-Spend Decision Used">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Pre-Spend Decision Used</p>
            <h2>Policy consumes the existing decision engine.</h2>
          </div>
        </div>
        <div className="hermes-run-grid">
          <HermesPreSpendDecisionCard decision={result.pre_spend_decision} compact />
        </div>
      </section>}
      {result && <HermesSpendPolicyReferenceList title="References Used" items={result.references} />}
      {policySurface && <HermesSpendPolicyRuleMap rules={policySurface.rules} />}
    </main>
  </div>;
}

function HermesPreSpendDecisionPage() {
  const [decision, setDecision] = useState<HermesPreSpendDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/pre-spend-decision');
  }, []);

  useEffect(() => {
    api<HermesPreSpendDecision>('/v1/hermes/pre-spend-decision/example')
      .then((response) => setDecision(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_pre_spend_decision_unavailable'));
  }, []);
  const decisionReceipt = decision ? createHermesDecisionReceipt(decision) : null;

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-pre-spend-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/pre-spend-decision" />
    </header>
    <main id="hermes-pre-spend-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Spend Gate</p>
          <h1>Pre-Spend Decision Engine</h1>
          <p className="copy hermes-hero-copy">Before an agent spends, it checks the ledger.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/pre-spend-decision/example">Open Example JSON</a>
            <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
            <a className="execute compact secondary" href="/hermes/decision-feedback">Open feedback loop</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Decision doctrine</p>
          <p>Reputation is not just displayed.</p>
          <p>Reputation now decides.</p>
        </div>
      </section>
      <section className="panel hermes-narrative-flow" aria-label="Pre-spend decision flow">
        <article><span>1</span><h2>Spend Intent</h2><p>Route, provider, service, amount, and execution context enter the decision engine.</p></article>
        <article><span>2</span><h2>Reputation Ledger</h2><p>Provider, route, and service memory are gathered from reviewed claims and receipts.</p></article>
        <article><span>3</span><h2>Decision</h2><p>A deterministic state is returned: proceed, caution, test spend, stop, or request more evidence.</p></article>
        <article><span>4</span><h2>Required Action</h2><p>The engine recommends the next action the agent should take before money moves.</p></article>
        <article><span>5</span><h2>New Receipt</h2><p>The next run can create a new receipt, claim, and future ledger update.</p></article>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Memory loop note">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Memory loop</p>
            <h2>The decision engine is part of a larger memory loop.</h2>
          </div>
          <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
          <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
        </div>
        <p className="copy">The decision engine is part of a larger memory loop. Decisions produce receipts. Outcomes produce feedback. Feedback changes future reputation.</p>
        <p className="copy">The Pre-Spend Decision Engine recommends action. The Spend Policy Layer converts that recommendation into an allow, test, review, or block decision.</p>
        <p className="copy">Policy reconciliation compares the policy receipt against the actual wallet outcome before feedback is used for the next spend.</p>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!error && decision && <section className="panel hermes-runs-section" aria-label="Example decision card">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Example decision card</p>
            <h2>Seeded decision output.</h2>
          </div>
        </div>
        <div className="hermes-run-grid">
          <HermesPreSpendDecisionCard decision={decision} />
        </div>
      </section>}
      {!error && !decision && <section className="panel"><p className="route-state">Loading example decision...</p></section>}
      {decisionReceipt && <section className="panel hermes-skill-pack-detail" aria-label="Decision Receipts">
        <div className="panel-head"><div><p className="section-kicker">Decision Receipts</p><h2>Pre-spend decisions should be receiptable.</h2></div></div>
        <p className="copy">Outcomes close the loop.</p>
        <p className="copy">Decision receipts become intelligence when compared against what happened after spend.</p>
        <p className="copy">A decision without an outcome is advice.</p>
        <p className="copy">A decision with a receipt becomes intelligence.</p>
        <div className="machine-usage-list">
          <p><span>receipt_id</span><small>{decisionReceipt.receipt.id}</small></p>
          <p><span>summary</span><small>{decisionReceipt.receipt.summary}</small></p>
          <p><span>conversion</span><small>{decisionReceipt.conversion.notes.join(' ')}</small></p>
        </div>
      </section>}
      <section className="panel hermes-skill-pack-detail" aria-label="Decision state mapping">
        <div className="panel-head"><div><p className="section-kicker">Decision state mapping</p><h2>Bounded spend language.</h2></div></div>
        <div className="machine-usage-list">
          {[
            ['proceed', 'Provider and route evidence is strong enough to spend without extra gating.'],
            ['proceed_with_caution', 'Evidence is mixed or incomplete, so spend should stay constrained.'],
            ['test_spend_first', 'The next safe move is a small deterministic test spend.'],
            ['do_not_spend', 'Ledger evidence says stop or move to a fallback path.'],
            ['insufficient_evidence', 'The spend context needs more proof before money moves.']
          ].map(([state, detail]) => <p key={state}><span>{state}</span><small>{detail}</small></p>)}
        </div>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Required action mapping">
        <div className="panel-head"><div><p className="section-kicker">Required action mapping</p><h2>What the agent should do next.</h2></div></div>
        <div className="machine-usage-list">
          {[
            ['none', 'Spend can proceed without extra gating.'],
            ['run_small_test_spend', 'Use a constrained test spend before scaling.'],
            ['request_more_evidence', 'Wait for stronger receipt or claim evidence.'],
            ['use_fallback_route', 'Move to a safer route.'],
            ['do_not_use_provider', 'Do not spend through the provider.'],
            ['manual_review_required', 'Escalate before spending.']
          ].map(([state, detail]) => <p key={state}><span>{state}</span><small>{detail}</small></p>)}
        </div>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Risk factors">
        <div className="panel-head"><div><p className="section-kicker">Risk factors</p><h2>Why the engine raises caution.</h2></div></div>
        <div className="abundance-chip-row">
          {['missing provider reputation', 'missing route reputation', 'missing service reputation', 'watchlist status', 'degraded target', 'disputed target', 'high amount', 'insufficient evidence'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Inputs used">
        <div className="panel-head"><div><p className="section-kicker">Inputs used</p><h2>The decision engine reads accumulated evidence, not vibes.</h2></div></div>
        <div className="abundance-chip-row">
          {['provider reputation', 'route reputation', 'service reputation', 'receipts', 'reviewed claims', 'Hermes runs'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </main>
  </div>;
}

function HermesDecisionFeedbackPage() {
  const [decision, setDecision] = useState<HermesPreSpendDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/decision-feedback');
  }, []);

  useEffect(() => {
    api<HermesPreSpendDecision>('/v1/hermes/pre-spend-decision/example')
      .then((response) => setDecision(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_decision_feedback_unavailable'));
  }, []);

  const receipt = decision ? createHermesDecisionReceipt(decision) : null;
  const feedback = decision ? recordHermesDecisionOutcome(decision) : null;

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-decision-feedback-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/decision-feedback" />
    </header>
    <main id="hermes-decision-feedback-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Feedback Loop</p>
          <h1>Decision Receipt and Feedback Loop</h1>
          <p className="copy hermes-hero-copy">A decision becomes intelligence when the outcome is recorded.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/pre-spend-decision/example">Open decision JSON</a>
            <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
            <a className="execute compact secondary" href="/hermes/pre-spend-decision">Back to decision engine</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Loop doctrine</p>
          <p>A decision without an outcome is advice.</p>
          <p>A decision with a receipt becomes intelligence.</p>
        </div>
      </section>
      <section className="panel hermes-narrative-flow" aria-label="Decision feedback loop flow">
        <article><span>1</span><h2>Flow</h2><p>Pre-Spend Decision -&gt; Decision Receipt -&gt; Spend Outcome -&gt; Reputation Feedback -&gt; Better Next Spend.</p></article>
        <article><span>2</span><h2>Example Decision Receipt</h2><p>The receipt preserves why the recommendation was made.</p></article>
        <article><span>3</span><h2>Example Outcome</h2><p>The outcome records what actually happened after the recommendation.</p></article>
        <article><span>4</span><h2>Reputation Feedback</h2><p>The impact object turns the result into future route, provider, or service memory.</p></article>
        <article><span>5</span><h2>What the system learns</h2><p>The next spend inherits memory from both the recommendation and the outcome.</p></article>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Memory loop note">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Memory loop</p>
            <h2>Feedback is not the end of the loop.</h2>
          </div>
          <a className="execute compact secondary" href="/hermes/memory-loop">Open Memory Loop</a>
          <a className="execute compact secondary" href="/hermes/spend-policy">Open Spend Policy Layer</a>
        </div>
        <p className="copy">Feedback is not the end of the loop. It becomes input for the next pre-spend decision.</p>
        <p className="copy">Policy receipts can become part of the feedback trail when comparing what the wallet was allowed to do against what actually happened.</p>
        <p className="copy">Decision feedback tells whether the spend outcome matched the recommendation. Policy reconciliation tells whether the wallet obeyed the safety gate.</p>
      </section>
      <section className="panel hermes-skill-pack-detail" aria-label="Wallet audit trail note">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Wallet audit trail</p>
            <h2>Decision feedback is one part of the larger wallet audit trail.</h2>
          </div>
          <a className="execute compact secondary" href="/hermes/wallet-audit-trail">Open Wallet Audit Trail</a>
        </div>
        <p className="copy">Decision feedback is one part of the larger wallet audit trail that shows what was recommended, what was allowed, what happened, and what changed.</p>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {receipt && <section className="panel hermes-runs-section" aria-label="Example Decision Receipt">
        <div className="panel-head"><div><p className="section-kicker">Example Decision Receipt</p><h2>Receipt-shaped decision memory.</h2></div></div>
        <div className="machine-usage-list">
          <p><span>receipt_id</span><small>{receipt.receipt.id}</small></p>
          <p><span>decision</span><small>{receipt.receipt.decision}</small></p>
          <p><span>required_action</span><small>{receipt.receipt.required_action}</small></p>
          <p><span>confidence</span><small>{receipt.receipt.confidence}</small></p>
          <p><span>summary</span><small>{receipt.receipt.summary}</small></p>
        </div>
      </section>}
      {feedback && <section className="panel hermes-runs-section" aria-label="Example Outcome">
        <div className="panel-head"><div><p className="section-kicker">Example Outcome</p><h2>Deterministic feedback result.</h2></div></div>
        <div className="hermes-run-grid">
          <HermesDecisionFeedbackCard feedback={feedback} />
        </div>
      </section>}
      {feedback && <section className="panel hermes-skill-pack-detail" aria-label="Reputation Feedback">
        <div className="panel-head"><div><p className="section-kicker">Reputation Feedback</p><h2>What gets fed back into the next spend.</h2></div></div>
        <div className="machine-usage-list">
          <p><span>direction</span><small>{feedback.reputation_feedback.direction}</small></p>
          <p><span>magnitude</span><small>{feedback.reputation_feedback.magnitude}</small></p>
          <p><span>target</span><small>{`${feedback.reputation_feedback.target_type}:${feedback.reputation_feedback.target_id ?? 'unknown'}`}</small></p>
          <p><span>summary</span><small>{feedback.reputation_feedback.summary}</small></p>
        </div>
      </section>}
      <section className="panel hermes-skill-pack-detail" aria-label="What the system learns">
        <div className="panel-head"><div><p className="section-kicker">What the system learns</p><h2>Advice becomes reusable market memory only after outcomes land.</h2></div></div>
        <div className="abundance-chip-row">
          {['what was recommended', 'what action was required', 'what actually happened', 'what evidence exists now', 'what should change next spend'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </main>
  </div>;
}

function HermesReputationLedgerPage() {
  const [ledger, setLedger] = useState<HermesReputationLedgerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncHermesMetadata('/hermes/reputation-ledger');
  }, []);

  useEffect(() => {
    api<HermesReputationLedgerSummary>('/v1/hermes/reputation-ledger')
      .then((response) => setLedger(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'hermes_reputation_ledger_unavailable'));
  }, []);

  return <div className="shell narrative-shell hermes-shell">
    <a className="skip-link" href="#hermes-ledger-content">Skip to content</a>
    <header className="site-header">
      <HermesNav current="/hermes/reputation-ledger" />
    </header>
    <main id="hermes-ledger-content" className="narrative-page hermes-page">
      <section className="panel hero narrative-hero hermes-hero">
        <div>
          <p className="eyebrow">Provider and Route Memory</p>
          <h1>Reputation Ledger</h1>
          <p className="copy hermes-hero-copy">One receipt is evidence. One claim is judgment. Many judgments become reputation.</p>
          <div className="panel-actions">
            <a className="execute" href="/v1/hermes/reputation-ledger">Open Ledger JSON</a>
            <a className="execute compact secondary" href="/hermes">Back to Hermes Desk</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail hermes-hero-rail">
          <p className="section-kicker">Stateless ledger</p>
          <p>Reputation Impact metadata is aggregated from deterministic promoted Hermes claims. No live Hermes sidecar is required.</p>
        </div>
      </section>
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!error && <HermesReputationLedgerSection ledger={ledger} />}
    </main>
  </div>;
}

export function HermesDeskPage({
  narrativeRoute = false,
  memoryLoopRoute = false,
  skillPackRoute = false,
  reputationLedgerRoute = false,
  preSpendDecisionRoute = false,
  spendPolicyRoute = false,
  decisionFeedbackRoute = false,
  walletAuditTrailRoute = false
}: { narrativeRoute?: boolean; memoryLoopRoute?: boolean; skillPackRoute?: boolean; reputationLedgerRoute?: boolean; preSpendDecisionRoute?: boolean; spendPolicyRoute?: boolean; decisionFeedbackRoute?: boolean; walletAuditTrailRoute?: boolean }) {
  if (memoryLoopRoute) return <HermesMemoryLoopDashboardPage />;
  if (decisionFeedbackRoute) return <HermesDecisionFeedbackPage />;
  if (walletAuditTrailRoute) return <HermesWalletAuditTrailPage />;
  if (spendPolicyRoute) return <HermesSpendPolicyPage />;
  if (preSpendDecisionRoute) return <HermesPreSpendDecisionPage />;
  if (reputationLedgerRoute) return <HermesReputationLedgerPage />;
  if (skillPackRoute) return <HermesSkillPackPage />;
  return narrativeRoute ? <HermesNarrativePage /> : <HermesDeskSurface />;
}
