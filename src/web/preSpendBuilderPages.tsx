import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { SignalGraphContextPanel, type SignalGraphContextNode } from './signalGraphContextPanel';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type DecisionState = 'approved' | 'approved_with_warning' | 'use_with_caution' | 'requires_human_approval' | 'do_not_use';
type ValidationState = 'unvalidated' | 'machine_checked' | 'human_validated' | 'disputed' | 'rejected' | 'stale';
type ClaimTargetType = 'route' | 'provider' | 'service' | 'receipt' | 'counterparty' | 'claim';
type ClaimStatus = 'submitted' | 'under_review' | 'supported' | 'challenged' | 'rejected' | 'resolved' | 'stale';
type ClaimType = 'reliability' | 'cost' | 'latency' | 'output_quality' | 'safety' | 'dispute' | 'blocker' | 'benchmark' | 'counterparty_risk';

type RouteIntelligence = {
  route_id: string;
  provider_id: string;
  service_id: string;
  endpoint: string;
  payment_method: string;
  estimated_cost: string;
  latency_ms_p50: number;
  latency_ms_p95: number;
  success_rate: number;
  last_tested_at: string;
  last_successful_run: string | null;
  last_failed_run: string | null;
  confidence_score: number;
  risk_level: RiskLevel;
  known_blockers: string[];
  receipt_references: string[];
  recommended_use_case: string;
  avoid_conditions: string[];
};

type ProviderIntelligence = {
  provider_id: string;
  name: string;
  service_categories: string[];
  reliability_score: number;
  pricing_consistency: string;
  output_quality_notes: string[];
  uptime_notes: string[];
  dispute_history: string[];
  human_validation_status: ValidationState;
  known_risks: string[];
  agent_compatibility: string[];
  route_coverage: number;
  recent_receipt_count: number;
};

type ServiceDossier = {
  service_id: string;
  category: string;
  available_routes: string[];
  supported_inputs: string[];
  observed_cost_range: { min: string; max: string };
  observed_latency_range: { min_ms: number; max_ms: number };
  best_observed_route: string | null;
  cheapest_observed_route: string | null;
  safest_first_attempt: string | null;
  fastest_repeatable_route: string | null;
  known_blockers: string[];
  evidence_artifacts: string[];
  benchmark_readiness: ValidationState;
  pre_spend_recommendation: string;
};

type Receipt = {
  receipt_id: string;
  timestamp: string;
  agent_id: string;
  route_id: string;
  provider_id: string;
  service_id: string;
  task_type: string;
  cost: string;
  payment_method: string;
  latency_ms: number;
  input_summary: string;
  output_summary: string;
  status: 'succeeded' | 'failed' | 'timed_out' | 'partial';
  failure_reason: string | null;
  validation_state: ValidationState;
  human_notes: string[];
  confidence_delta: number;
  evidence_artifact: string;
};

type Metrics = {
  verified_pre_spend_decisions: number;
  routes_indexed: number;
  providers_scored: number;
  receipts_generated: number;
  pre_spend_checks_completed: number;
  human_validations_submitted: number;
  failed_routes_avoided: number;
  claims_challenged: number;
  repeatable_routes_discovered: number;
  agent_builders_using_the_api: number;
  amount_of_spend_protected_or_intelligently_routed: string;
};

type PreSpendCheckResponse = {
  intent: string;
  decision: DecisionState;
  recommended_route: string | null;
  confidence_score: number;
  risk_level: RiskLevel;
  estimated_cost: string | null;
  last_successful_run: string | null;
  known_blockers: string[];
  requires_human_approval: boolean;
  receipt_references: string[];
  safer_alternatives: string[];
  do_not_use: Array<{ provider: string; reason: string }>;
  rationale: string[];
};

type RouteTrustSummary = {
  receipt_freshness: string;
  successful_receipt_count: number;
  failure_patterns: string[];
  blocker_severity: 'none' | 'low' | 'medium' | 'high';
  provider_reliability: string;
  human_validation: string;
  summary: string;
};

type ProviderTrustProfile = {
  safe_for_first_attempt: boolean;
  better_for_repeatable_routes: boolean;
  requires_human_approval: boolean;
  not_recommended: boolean;
  summary: string;
};

type ServiceDecisionMap = {
  best_observed_route: string | null;
  cheapest_route: string | null;
  safest_first_attempt: string | null;
  fastest_repeatable_route: string | null;
  summary: string;
};

type ReceiptImpact = {
  improves_route_confidence: boolean;
  reduces_route_confidence: boolean;
  freshness: 'fresh' | 'stale';
  human_validated: boolean;
  should_affect_future_pre_spend_decisions: boolean;
  summary: string;
};

type RouteDetail = {
  route: RouteIntelligence;
  provider: ProviderIntelligence | null;
  service: ServiceDossier | null;
  receipts: Receipt[];
  metrics: Metrics;
  validation_state: ValidationState | null;
  decision_implications: string[];
  trust_summary: RouteTrustSummary | null;
};

type ProviderDetail = {
  provider: ProviderIntelligence;
  routes: RouteIntelligence[];
  services: ServiceDossier[];
  receipts: Receipt[];
  metrics: Metrics;
  provider_level_warnings: string[];
  trust_profile: ProviderTrustProfile;
};

type PreSpendProviderSummary = {
  provider_id: string;
  name: string;
  service_categories: string[];
  reliability_score: number;
  pricing_consistency: string;
  output_quality_notes: string[];
  uptime_notes: string[];
  dispute_history: string[];
  human_validation_status: ValidationState;
  known_risks: string[];
  agent_compatibility: string[];
  route_coverage: number;
  recent_receipt_count: number;
  linked_routes: string[];
  linked_receipts: string[];
  trust_profile: ProviderTrustProfile;
};

type PreSpendProviderListResponse = {
  generated_at: string;
  source: string;
  metrics: Metrics;
  providers: PreSpendProviderSummary[];
};

type ServiceDetail = {
  service: ServiceDossier;
  routes: RouteIntelligence[];
  receipts: Receipt[];
  metrics: Metrics;
  best_route_decision_map: ServiceDecisionMap;
};

type ReceiptDetail = Receipt & {
  route: RouteIntelligence | null;
  provider: ProviderIntelligence | null;
  service: ServiceDossier | null;
  impact: ReceiptImpact;
};

type Claim = {
  claim_id: string;
  created_at: string;
  submitted_by: string;
  claim_type: ClaimType;
  target_type: ClaimTargetType;
  target_id: string;
  statement: string;
  evidence_receipt_ids: string[];
  evidence_artifact_uris: string[];
  status: ClaimStatus;
  confidence_score: number;
  validation_state: ValidationState;
  challenge_count: number;
  support_count: number;
  human_notes: string[];
};

type ClaimChallenge = {
  challenge_id: string;
  claim_id: string;
  created_at: string;
  challenged_by: string;
  reason: string;
  evidence_receipt_ids: string[];
  evidence_artifact_uris: string[];
  status: 'submitted' | 'under_review' | 'resolved' | 'rejected';
  human_notes: string[];
};

type ClaimDetail = Claim & {
  challenges: ClaimChallenge[];
};

type SignalGraphEntityType = 'receipt' | 'claim' | 'loop' | 'route' | 'provider' | 'service';
type SignalGraphEntityLookupResponse = {
  entity_type: SignalGraphEntityType;
  entity_id: string;
  nodes: SignalGraphContextNode[];
};

const API_BASE_URL = getApiBaseUrl();
const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatDate(value: string | null) {
  if (!value) return 'n/a';
  return value.slice(0, 10);
}

function formatDateTime(value: string | null) {
  if (!value) return 'n/a';
  return value.replace('T', ' ').slice(0, 16);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function routeHref(routeId: string) {
  return `/routes/${encodeURIComponent(routeId)}`;
}

function providerHref(providerId: string) {
  return `/providers/${encodeURIComponent(providerId)}`;
}

function serviceHref(serviceId: string) {
  return `/services/${encodeURIComponent(serviceId)}`;
}

function receiptHref(receiptId: string) {
  return `/receipts/${encodeURIComponent(receiptId)}`;
}

function claimHref(claimId: string) {
  return `/claims/${encodeURIComponent(claimId)}`;
}

function terminalCopy(decision: DecisionState) {
  switch (decision) {
    case 'approved': return 'Verified Pre-Spend Decisions';
    case 'approved_with_warning': return 'Receipt-backed route intelligence';
    case 'use_with_caution': return 'Known blockers';
    case 'requires_human_approval': return 'Should this agent spend?';
    default: return 'No receipt, no trust';
  }
}

function decisionTone(decision: DecisionState) {
  switch (decision) {
    case 'approved':
      return 'ok';
    case 'approved_with_warning':
    case 'use_with_caution':
    case 'requires_human_approval':
      return 'warn';
    default:
      return 'error';
  }
}

function decisionLabel(decision: DecisionState) {
  return decision.replaceAll('_', ' ');
}

function joined(items: string[]) {
  return items.length ? items.join(', ') : 'none';
}

function ageLabel(timestamp: string | null) {
  if (!timestamp) return 'n/a';
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / DAY_MS));
  if (ageDays <= 0) return 'today';
  if (ageDays === 1) return '1 day old';
  return `${ageDays} days old`;
}

function BuilderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="builder-link" href={href}>{children}</a>;
}

function LinkedIds({ items, buildHref }: { items: string[]; buildHref: (value: string) => string }) {
  if (!items.length) return <span>none</span>;
  return <div className="builder-link-list">
    {items.map((item) => <BuilderLink href={buildHref(item)} key={item}>{item}</BuilderLink>)}
  </div>;
}

function DetailList({ title, items, emptyLabel = 'none observed' }: { title: string; items: string[]; emptyLabel?: string }) {
  return <section className="panel builder-detail-panel">
    <div className="panel-head">
      <div>
        <p className="section-kicker">{title}</p>
        <h2>{title}</h2>
      </div>
    </div>
    <div className="builder-note-stack">
      {items.length
        ? items.map((item) => <p className="builder-note-row" key={item}>{item}</p>)
        : <p className="panel-caption">{emptyLabel}</p>}
    </div>
  </section>;
}

function DetailTable({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return <section className="panel builder-detail-panel">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Evidence view</p>
        <h2>{title}</h2>
      </div>
    </div>
    <div className="builder-detail-grid">
      {rows.map(([label, value]) => <article key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
      </article>)}
    </div>
  </section>;
}

function DetailShell({
  title,
  eyebrow,
  headline,
  copy,
  metrics,
  children
}: {
  title: string;
  eyebrow: string;
  headline: string;
  copy: string;
  metrics: Metrics | null;
  children: React.ReactNode;
}) {
  return <div className="shell builder-shell">
    <main className="builder-page" aria-label={title}>
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{headline}</h1>
          <p className="copy">{copy}</p>
        </div>
      </section>
      <MetricsBand metrics={metrics} />
      <div className="builder-detail-stack">{children}</div>
    </main>
  </div>;
}

function DetailNotFound({
  title,
  body,
  href,
  linkLabel
}: {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}) {
  return <div className="shell builder-shell">
    <main className="builder-page" aria-label={title}>
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">Pre-Spend Intelligence</p>
          <h1>{title}</h1>
          <p className="copy">{body}</p>
          <BuilderLink href={href}>{linkLabel}</BuilderLink>
        </div>
      </section>
    </main>
  </div>;
}

function LoadingShell({ title }: { title: string }) {
  return <div className="shell builder-shell">
    <main className="builder-page" aria-label={title}>
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">Pre-Spend Intelligence</p>
          <h1>{title}</h1>
          <p className="copy">Loading evidence-backed detail.</p>
        </div>
      </section>
    </main>
  </div>;
}

function useSignalGraphContext(entityType: SignalGraphEntityType, entityId: string) {
  const [node, setNode] = useState<SignalGraphContextNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNode(null);
    api<{ data: SignalGraphEntityLookupResponse }>(`/v1/graph/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
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
  }, [entityId, entityType]);

  return node;
}

function MetricsBand({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) return null;
  const rows: Array<[string, string | number]> = [
    ['Verified Pre-Spend Decisions', metrics.verified_pre_spend_decisions],
    ['routes indexed', metrics.routes_indexed],
    ['providers scored', metrics.providers_scored],
    ['receipts generated', metrics.receipts_generated],
    ['pre-spend checks completed', metrics.pre_spend_checks_completed],
    ['human validations submitted', metrics.human_validations_submitted],
    ['failed routes avoided', metrics.failed_routes_avoided],
    ['claims challenged', metrics.claims_challenged],
    ['repeatable routes discovered', metrics.repeatable_routes_discovered],
    ['agent builders using the API', metrics.agent_builders_using_the_api],
    ['amount of spend protected or intelligently routed', metrics.amount_of_spend_protected_or_intelligently_routed]
  ];
  return <section className="grid four builder-metrics" aria-label="Pre-spend intelligence metrics">
    {rows.map(([label, value]) => <article className="panel metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
  </section>;
}

function PlaceholderMarketPanel() {
  return <section className="panel builder-placeholder-panel" aria-label="Claims and validation placeholder">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Claim Primitive</p>
        <h2>Receipt-backed signal comes before markets</h2>
      </div>
    </div>
    <div className="builder-placeholder-grid">
      {['claim submission', 'claim challenge', 'human validation', 'receipt references', 'known blockers', 'safer alternatives'].map((label) => <article key={label}><strong>{label}</strong><span>small evidence primitive only</span></article>)}
    </div>
  </section>;
}

export function SpendTerminalPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [result, setResult] = useState<PreSpendCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    agent_id: 'agent_001',
    intent: 'buy_market_research',
    budget: 25,
    risk_tolerance: 'low' as RiskLevel,
    preferred_settlement: 'stablecoin',
    required_confidence: 75
  });

  useEffect(() => {
    document.title = 'Pre-Spend Intelligence | Infopunks Builder';
    api<{ data: { metrics: Metrics } }>('/v1/routes').then((response) => setMetrics(response.data.metrics)).catch(() => undefined);
  }, []);

  async function runCheck(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ data: PreSpendCheckResponse }>('/v1/pre-spend/check', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'pre-spend check failed');
    } finally {
      setLoading(false);
    }
  }

  const resultTone = result ? decisionTone(result.decision) : 'warn';
  const hasReceipts = Boolean(result?.receipt_references.length);
  const hasWarnings = Boolean(result && (result.known_blockers.length || result.do_not_use.length || result.requires_human_approval || result.decision !== 'approved'));

  return <div className="shell builder-shell">
    <main className="builder-page spend-terminal-page" aria-label="Pre-Spend Intelligence Terminal">
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">Pre-Spend Intelligence</p>
          <h1>Should this agent spend?</h1>
          <p className="copy">Decision Terminal for agentic finance preflight. Interrogate route evidence, inspect blockers, and decide whether this agent should spend here, now, on this route, with this provider, under these conditions.</p>
        </div>
        <div className="ticker" aria-label="Decision terminal copy">
          <span>Should this agent spend?</span>
          <span>Receipt-backed route intelligence</span>
          <span>Verified Pre-Spend Decisions</span>
          <span>No receipt, no trust</span>
        </div>
      </section>
      <MetricsBand metrics={metrics} />
      <section className="grid two builder-terminal-grid">
        <form className="panel builder-form-panel" onSubmit={runCheck}>
          <div className="panel-head"><div><p className="section-kicker">Agent Intent</p><h2>Pre-spend input flow</h2></div></div>
          <p className="panel-caption">Run a receipt-backed preflight before any paid route call. No receipt, no trust.</p>
          <label><span>intent</span><input aria-label="intent" value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })} /></label>
          <label><span>budget</span><input aria-label="budget" type="number" value={form.budget} onChange={(event) => setForm({ ...form, budget: Number(event.target.value) })} /></label>
          <label><span>risk tolerance</span><select aria-label="risk tolerance" value={form.risk_tolerance} onChange={(event) => setForm({ ...form, risk_tolerance: event.target.value as RiskLevel })}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></label>
          <label><span>preferred settlement</span><input aria-label="preferred settlement" value={form.preferred_settlement} onChange={(event) => setForm({ ...form, preferred_settlement: event.target.value })} /></label>
          <label><span>required confidence</span><input aria-label="required confidence" type="number" value={form.required_confidence} onChange={(event) => setForm({ ...form, required_confidence: Number(event.target.value) })} /></label>
          <button className="execute compact" type="submit" disabled={loading}>{loading ? 'Checking route' : 'Run pre-spend check'}</button>
          {error && <p className="route-state error">{error}</p>}
        </form>
        <section className="panel builder-result-panel" aria-label="Decision result">
          <div className="panel-head"><div><p className="section-kicker">Decision Output</p><h2>{result ? terminalCopy(result.decision) : 'Should this agent spend?'}</h2></div></div>
          {!result && <div className="empty-state polished-empty builder-terminal-empty">
            <strong>Awaiting pre-spend decision.</strong>
            <span>Set agent intent, risk tolerance, settlement preference, and required confidence, then interrogate the route before any economic action.</span>
            <small>Should this agent spend? The terminal will not answer without route evidence, receipt references, and explicit rationale.</small>
          </div>}
          {result && <>
            <div className={`builder-decision-banner ${resultTone}`}>
              <div>
                <span className="section-kicker">Decision state</span>
                <strong>{decisionLabel(result.decision)}</strong>
                <p>{result.recommended_route
                  ? <>Recommended route: <BuilderLink href={routeHref(result.recommended_route)}>{result.recommended_route}</BuilderLink></>
                  : 'No route cleared for spend.'}</p>
              </div>
              <div className="builder-banner-meta">
                <span>confidence {result.confidence_score}</span>
                <span>risk {result.risk_level}</span>
                <span>human approval {result.requires_human_approval ? 'required' : 'not required'}</span>
              </div>
            </div>
            {!hasReceipts && <p className="route-state error">No receipt, no trust. No recent successful receipt is attached to this recommendation.</p>}
            {hasWarnings && <p className={`route-state ${resultTone === 'error' ? 'error' : 'warn'}`}>
              {result.requires_human_approval
                ? 'Human approval is required before spend.'
                : result.known_blockers.length
                  ? 'Known blockers are active. Review them before spend.'
                  : result.do_not_use.length
                    ? 'Unsafe providers were flagged for this intent.'
                    : 'Decision is not a silent approval. Review rationale before spend.'}
            </p>}
            <div className="builder-result-grid">
              <article><span>decision</span><strong>{result.decision}</strong></article>
              <article><span>recommended route</span><strong>{result.recommended_route ? <BuilderLink href={routeHref(result.recommended_route)}>{result.recommended_route}</BuilderLink> : 'none'}</strong></article>
              <article><span>confidence score</span><strong>{result.confidence_score}</strong></article>
              <article><span>risk level</span><strong>{result.risk_level}</strong></article>
              <article><span>estimated cost</span><strong>{result.estimated_cost ?? 'n/a'}</strong></article>
              <article><span>last successful run</span><strong>{formatDate(result.last_successful_run)}</strong></article>
              <article><span>human approval</span><strong>{result.requires_human_approval ? 'required' : 'not required'}</strong></article>
              <article><span>receipts</span><strong><LinkedIds items={result.receipt_references} buildHref={receiptHref} /></strong></article>
              <article className="wide"><span>known blockers</span><strong>{joined(result.known_blockers)}</strong></article>
              <article className="wide"><span>safer alternatives</span><strong><LinkedIds items={result.safer_alternatives} buildHref={routeHref} /></strong></article>
              <article className="wide"><span>do-not-use warnings</span><strong>{result.do_not_use.length
                ? <div className="builder-note-stack">{result.do_not_use.map((item) => <span key={`${item.provider}:${item.reason}`}>{item.provider.startsWith('provider_') ? <><BuilderLink href={providerHref(item.provider)}>{item.provider}</BuilderLink>: {item.reason}</> : `${item.provider}: ${item.reason}`}</span>)}</div>
                : 'none'}</strong></article>
              <article className="wide"><span>rationale</span><strong>{result.rationale.join(' ')}</strong></article>
            </div>
          </>}
        </section>
      </section>
      <PlaceholderMarketPanel />
    </main>
  </div>;
}

export function DevelopersPage() {
  useEffect(() => {
    document.title = 'Developers | Infopunks Builder';
  }, []);

  const sdkExample = `import { createInfopunksPreSpendClient } from "infopunks-pay-sh-radar/sdk";

const client = createInfopunksPreSpendClient({
  baseUrl: "https://radar.infopunks.fun"
});

const decision = await client.checkPreSpend({
  agent_id: "agent_001",
  intent: "buy_market_research",
  budget: 25,
  risk_tolerance: "low",
  preferred_settlement: "stablecoin",
  required_confidence: 75
});`;

  const apiRequest = `POST /v1/pre-spend/check
Content-Type: application/json

{
  "agent_id": "agent_001",
  "intent": "buy_market_research",
  "budget": 25,
  "risk_tolerance": "low",
  "preferred_settlement": "stablecoin",
  "required_confidence": 75
}`;

  const apiResponse = `{
  "data": {
    "intent": "buy_market_research",
    "decision": "approved_with_warning",
    "recommended_route": "route_pay_sh_market_research_01",
    "confidence_score": 82,
    "risk_level": "medium",
    "estimated_cost": "0.25 USDC",
    "requires_human_approval": false,
    "receipt_references": ["receipt_001"],
    "known_blockers": ["occasional timeout under high load"]
  }
}`;

  const decisionStates: Array<{ state: DecisionState; copy: string }> = [
    { state: 'approved', copy: 'Route can be used under the declared constraints.' },
    { state: 'approved_with_warning', copy: 'Use is allowed, but the agent should surface caveats.' },
    { state: 'use_with_caution', copy: 'Evidence is usable but fragile. Slow down and inspect the route.' },
    { state: 'requires_human_approval', copy: 'The agent should stop and request an explicit human decision.' },
    { state: 'do_not_use', copy: 'Observed evidence does not support spend on this route or counterparty.' }
  ];

  const resourceCards = [
    { href: '/spend-terminal', title: 'Spend Terminal', copy: 'Run the receipt-backed pre-spend check UI.' },
    { href: '/check', title: 'Check', copy: 'Turn claims, routes, providers, wallets, and links into public receipt checks.' },
    { href: '/loops', title: 'Loops', copy: 'Inspect autonomous loops as proof-linked public memory objects.' },
    { href: '/routes', title: 'Routes', copy: 'Inspect route-level intelligence before autonomous spend.' },
    { href: '/providers', title: 'Providers', copy: 'Review provider reliability, disputes, and coverage.' },
    { href: '/services', title: 'Services', copy: 'Compare best route, safest first attempt, and blockers.' },
    { href: '/receipts', title: 'Receipts', copy: 'Trace every decision back to recorded route evidence.' },
    { href: '/claim', title: 'Claims', copy: 'Turn receipts into reusable signal objects with evidence and challenge placeholders.' },
    { href: '/openapi.json', title: 'OpenAPI', copy: 'Pull the public OpenAPI spec from the live endpoint.' },
    { href: '/developers#agent-example', title: 'Agent Example', copy: 'See the minimal example and repo path for examples/pre-spend-agent.' }
  ];

  return <div className="shell builder-shell">
    <main className="builder-page developers-page" aria-label="Developers">
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">Developer Surface</p>
          <h1>Before your agent pays, it checks Infopunks.</h1>
          <p className="copy">Infopunks is the pre-spend intelligence layer before payment. It returns receipt-backed route intelligence, known blockers, safer alternatives, and validation context before economic action.</p>
          <p className="copy">Infopunks is not executing payment. The SDK calls POST /v1/pre-spend/check against https://radar.infopunks.fun.</p>
        </div>
        <div className="ticker" aria-label="Developer page signals">
          <span>pre-spend intelligence</span>
          <span>receipt-backed decisions</span>
          <span>not payment execution</span>
          <span>before your agent pays, it checks Infopunks</span>
        </div>
      </section>

      <section className="panel builder-detail-panel" aria-label="Three-step builder flow">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Builder Flow</p>
            <h2>Three-step builder flow</h2>
          </div>
        </div>
        <div className="builder-card-grid builder-step-grid">
          <article className="panel builder-card">
            <p className="section-kicker">Step 1</p>
            <h2>Agent declares intent.</h2>
            <p className="panel-caption">Describe the task, budget, risk tolerance, settlement preference, and minimum confidence before any money moves.</p>
          </article>
          <article className="panel builder-card">
            <p className="section-kicker">Step 2</p>
            <h2>Infopunks checks the route.</h2>
            <p className="panel-caption">Route intelligence, provider reliability, receipts, blockers, validation, risk, and confidence are evaluated before spend.</p>
          </article>
          <article className="panel builder-card">
            <p className="section-kicker">Step 3</p>
            <h2>Agent receives a decision.</h2>
            <div className="builder-chip-row" aria-label="Pre-spend decision states">
              {decisionStates.map((item) => <span className={`builder-decision-chip ${decisionTone(item.state)}`} key={item.state}>{item.state}</span>)}
            </div>
          </article>
        </div>
      </section>

      <section className="grid two builder-section-grid">
        <section className="panel builder-detail-panel" aria-labelledby="sdk-usage-heading">
          <div className="panel-head">
            <div>
              <p className="section-kicker">SDK Usage</p>
              <h2 id="sdk-usage-heading">Use the pre-spend client</h2>
            </div>
          </div>
          <p className="panel-caption">Import the SDK, create a client, and ask Infopunks whether the agent should spend before payment execution happens somewhere else.</p>
          <pre className="builder-code-block"><code>{sdkExample}</code></pre>
        </section>

        <section className="panel builder-detail-panel" aria-labelledby="api-heading">
          <div className="panel-head">
            <div>
              <p className="section-kicker">API</p>
              <h2 id="api-heading">POST /v1/pre-spend/check</h2>
            </div>
          </div>
          <p className="panel-caption">Builders can call the HTTP endpoint directly when they do not want the SDK wrapper. The public contract is the intelligence layer before payment, not the payment client itself.</p>
          <pre className="builder-code-block"><code>{apiRequest}</code></pre>
          <pre className="builder-code-block"><code>{apiResponse}</code></pre>
        </section>
      </section>

      <section className="panel builder-detail-panel" aria-label="Decision states">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Decision States</p>
            <h2>Crisp outcomes for builders</h2>
          </div>
        </div>
        <div className="builder-detail-grid">
          {decisionStates.map((item) => <article key={item.state}>
            <span>{item.state}</span>
            <strong>{item.copy}</strong>
          </article>)}
        </div>
      </section>

      <section className="panel builder-detail-panel" aria-label="Receipt-backed trust">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Receipt-Backed Trust</p>
            <h2>No receipt, no trust.</h2>
          </div>
        </div>
        <div className="builder-note-stack">
          <p className="builder-note-row">No receipt, no trust.</p>
          <p className="builder-note-row">Every decision should point back to receipts.</p>
          <p className="builder-note-row">Receipts capture route runs, cost, latency, status, validation, confidence delta, and evidence artifacts.</p>
          <p className="builder-note-row">Evidence graph pages connect routes, providers, services, receipts, and human validation.</p>
        </div>
      </section>

      <section className="panel builder-detail-panel" id="agent-example" aria-label="Developer links">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Builder Links</p>
            <h2>Inspect the public surfaces</h2>
          </div>
        </div>
        <div className="builder-card-grid">
          {resourceCards.map((card) => <article className="panel builder-card" key={card.title}>
            <a className="builder-card-anchor" href={card.href}>
              <p className="section-kicker">Public link</p>
              <h2>{card.title}</h2>
              <p className="panel-caption">{card.copy}</p>
              <span className="builder-card-cta">Open</span>
            </a>
          </article>)}
        </div>
        <p className="panel-caption">Minimal agent example path in repo: <code>examples/pre-spend-agent/README.md</code></p>
      </section>
    </main>
  </div>;
}

export function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [targetType, setTargetType] = useState<ClaimTargetType>('route');
  const [targetId, setTargetId] = useState('route_pay_sh_token_quote_01');
  const [claimType, setClaimType] = useState<ClaimType>('reliability');
  const [statement, setStatement] = useState('Receipt-backed route remains safe for stablecoin quote checks.');
  const [receiptEvidence, setReceiptEvidence] = useState('receipt_005, receipt_006');
  const [artifactEvidence, setArtifactEvidence] = useState('artifact://artifact_token_quote_run_001');
  const [status, setStatus] = useState<ClaimStatus>('submitted');
  const [validationState, setValidationState] = useState<ValidationState>('unvalidated');

  useEffect(() => {
    document.title = 'Claims | Infopunks Builder';
    api<{ data: { claims: Claim[]; metrics: Metrics } }>('/v1/claims').then((response) => {
      setClaims(response.data.claims);
      setMetrics(response.data.metrics);
    }).catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await api<{ data: Claim }>('/v1/claims', {
      method: 'POST',
      body: JSON.stringify({
        submitted_by: 'builder_ui',
        claim_type: claimType,
        target_type: targetType,
        target_id: targetId,
        statement,
        evidence_receipt_ids: receiptEvidence.split(',').map((item) => item.trim()).filter(Boolean),
        evidence_artifact_uris: artifactEvidence.split(',').map((item) => item.trim()).filter(Boolean),
        status,
        confidence_score: 60,
        validation_state: validationState,
        human_notes: ['Submitted from the public claim placeholder UI.']
      })
    });
    setClaims((current) => [response.data, ...current]);
  }

  return <div className="shell builder-shell">
    <main className="builder-page" aria-label="Claims">
      <section className="panel hero builder-hero">
        <div>
          <p className="eyebrow">Claim Primitive</p>
          <h1>Claims are how Infopunks turns receipts into reusable signal.</h1>
          <p className="copy">route decision → receipt → claim → validation → reputation</p>
          <p className="copy">No claim without evidence. Claims are not votes. Claims are not token markets yet. Claims are structured signal objects backed by receipts.</p>
        </div>
      </section>
      <MetricsBand metrics={metrics} />
      <section className="grid two builder-section-grid">
        <form className="panel builder-form-panel" onSubmit={submit}>
          <div className="panel-head"><div><p className="section-kicker">Claim Submission</p><h2>Submission placeholder</h2></div></div>
          <p className="panel-caption">Tie the statement to receipts, evidence artifacts, human validation, and a target object. No claim without evidence.</p>
          <label><span>target type</span><select aria-label="target type" value={targetType} onChange={(event) => setTargetType(event.target.value as ClaimTargetType)}>{['route', 'provider', 'service', 'receipt', 'counterparty', 'claim'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>target ID</span><input aria-label="target ID" value={targetId} onChange={(event) => setTargetId(event.target.value)} /></label>
          <label><span>claim type</span><select aria-label="claim type" value={claimType} onChange={(event) => setClaimType(event.target.value as ClaimType)}>{['reliability', 'cost', 'latency', 'output_quality', 'safety', 'dispute', 'blocker', 'benchmark', 'counterparty_risk'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>statement</span><textarea aria-label="statement" value={statement} onChange={(event) => setStatement(event.target.value)} rows={4} /></label>
          <label><span>receipt evidence IDs</span><input aria-label="receipt evidence IDs" value={receiptEvidence} onChange={(event) => setReceiptEvidence(event.target.value)} /></label>
          <label><span>evidence artifact URIs</span><input aria-label="evidence artifact URIs" value={artifactEvidence} onChange={(event) => setArtifactEvidence(event.target.value)} /></label>
          <label><span>validation state</span><select aria-label="validation state" value={validationState} onChange={(event) => setValidationState(event.target.value as ValidationState)}>{['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>claim status</span><select aria-label="claim status" value={status} onChange={(event) => setStatus(event.target.value as ClaimStatus)}>{['submitted', 'under_review', 'supported', 'challenged', 'rejected', 'resolved', 'stale'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button className="builder-button" type="submit">Submit claim placeholder</button>
        </form>
        <section className="panel builder-detail-panel">
          <div className="panel-head"><div><p className="section-kicker">Claim Rules</p><h2>Validation posture</h2></div></div>
          <div className="builder-note-stack">
            <p className="builder-note-row">Claims are not votes.</p>
            <p className="builder-note-row">Claims are not token markets yet.</p>
            <p className="builder-note-row">Human validation and challenge flow decide whether the claim should survive as reusable route intelligence.</p>
            <p className="builder-note-row">Related receipts and evidence graph links should remain inspectable from every claim.</p>
          </div>
        </section>
      </section>
      <section className="panel builder-detail-panel" aria-label="Existing claims">
        <div className="panel-head"><div><p className="section-kicker">Existing Claims</p><h2>Reusable signal objects</h2></div></div>
        <div className="builder-card-grid">
          {claims.map((claim) => <article className="panel builder-card" key={claim.claim_id}>
            <a className="builder-card-anchor" href={claimHref(claim.claim_id)}>
              <p className="section-kicker">{claim.claim_type}</p>
              <h2>{claim.claim_id}</h2>
              <div className="builder-stat-list">
                <span>target {claim.target_type}:{claim.target_id}</span>
                <span>status {claim.status}</span>
                <span>validation {claim.validation_state}</span>
                <span>confidence {claim.confidence_score}</span>
                <span>challenges {claim.challenge_count}</span>
              </div>
              <p className="panel-caption">{claim.statement}</p>
              <div className="panel-caption">Related receipts: <LinkedIds items={claim.evidence_receipt_ids} buildHref={receiptHref} /></div>
              <span className="builder-card-cta">Inspect claim</span>
            </a>
          </article>)}
        </div>
      </section>
    </main>
  </div>;
}

export function ClaimDetailPage({ claimId }: { claimId: string }) {
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const signalGraphNode = useSignalGraphContext('claim', claimId);

  useEffect(() => {
    document.title = `${claimId} | Claim Detail`;
    setMissing(false);
    api<{ data: ClaimDetail }>(`/v1/claims/${encodeURIComponent(claimId)}`)
      .then((response) => setDetail(response.data))
      .catch((error) => {
        if (isNotFoundError(error)) setMissing(true);
      });
  }, [claimId]);

  if (missing) return <DetailNotFound title="Claim not found" body={`No inspectable claim exists for ${claimId}.`} href="/claim" linkLabel="Back to claims" />;
  if (!detail) return <LoadingShell title="Claim detail" />;

  return <DetailShell title="Claim detail" eyebrow="Receipt-backed claim" headline={detail.claim_id} copy="Claims connect route decisions, receipts, challenges, and human validation into reusable signal." metrics={null}>
    {signalGraphNode && <SignalGraphContextPanel node={signalGraphNode} />}
    <DetailTable title="Claim evidence" rows={[
      ['claim ID', detail.claim_id],
      ['submitted by', detail.submitted_by],
      ['created at', formatDateTime(detail.created_at)],
      ['claim type', detail.claim_type],
      ['target', `${detail.target_type}:${detail.target_id}`],
      ['statement', detail.statement],
      ['status', detail.status],
      ['validation state', detail.validation_state],
      ['confidence score', detail.confidence_score],
      ['support count', detail.support_count],
      ['challenge count', detail.challenge_count],
      ['evidence receipts', <LinkedIds items={detail.evidence_receipt_ids} buildHref={receiptHref} />],
      ['evidence artifact URIs', joined(detail.evidence_artifact_uris)],
      ['human notes', joined(detail.human_notes)]
    ]} />
    <DetailList title="Challenges" items={detail.challenges.map((challenge) => `${challenge.challenge_id}: ${challenge.reason}`)} emptyLabel="No challenges recorded yet." />
    <section className="panel builder-detail-panel">
      <div className="panel-head"><div><p className="section-kicker">Challenge placeholder</p><h2>Challenge action</h2></div></div>
      <p className="panel-caption">Challenge flow remains intentionally small: reason, receipt evidence, artifact evidence, and human notes.</p>
      <div className="builder-note-stack">
        {detail.challenges.length
          ? detail.challenges.map((challenge) => <p className="builder-note-row" key={challenge.challenge_id}>{challenge.challenge_id} · {challenge.status} · {challenge.reason}</p>)
          : <p className="builder-note-row">No challenge submitted yet.</p>}
      </div>
      <BuilderLink href="/claim">Back to /claim</BuilderLink>
    </section>
  </DetailShell>;
}

export function RoutesIndexPage() {
  const [routes, setRoutes] = useState<RouteIntelligence[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [sort, setSort] = useState<'risk' | 'confidence'>('confidence');

  useEffect(() => {
    document.title = 'Routes | Infopunks Builder';
    api<{ data: { routes: RouteIntelligence[]; metrics: Metrics } }>('/v1/routes').then((response) => {
      setRoutes(response.data.routes);
      setMetrics(response.data.metrics);
    }).catch(() => undefined);
  }, []);

  const visible = useMemo(() => routes
    .filter((route) => serviceFilter === 'all' || route.service_id === serviceFilter)
    .sort((a, b) => sort === 'confidence'
      ? b.confidence_score - a.confidence_score
      : ['low', 'medium', 'high', 'critical'].indexOf(a.risk_level) - ['low', 'medium', 'high', 'critical'].indexOf(b.risk_level)), [routes, serviceFilter, sort]);

  return <div className="shell builder-shell"><main className="builder-page" aria-label="Routes"><section className="panel hero builder-hero"><div><p className="eyebrow">Receipt-backed route intelligence</p><h1>Routes</h1><p className="copy">Before your agent pays, inspect the route. These cards show known blockers, safer route posture, and the receipts behind each economic action.</p></div></section><MetricsBand metrics={metrics} /><section className="panel builder-filter-panel"><label><span>service type</span><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="all">all</option>{Array.from(new Set(routes.map((route) => route.service_id))).map((serviceId) => <option key={serviceId} value={serviceId}>{serviceId}</option>)}</select></label><label><span>sort</span><select value={sort} onChange={(event) => setSort(event.target.value as 'risk' | 'confidence')}><option value="confidence">confidence sorting</option><option value="risk">risk sorting</option></select></label></section><section className="builder-card-grid" aria-label="Route cards">{visible.map((route) => <article className="panel builder-card" key={route.route_id}><a className="builder-card-anchor" href={routeHref(route.route_id)}><p className="section-kicker">{route.recommended_use_case}</p><h2>{route.route_id}</h2><p>{route.endpoint}</p><div className="builder-stat-list"><span>risk {route.risk_level}</span><span>confidence {route.confidence_score}</span><span>cost {route.estimated_cost}</span><span>latency range {route.latency_ms_p50}-{route.latency_ms_p95} ms</span><span>last successful run {formatDate(route.last_successful_run)}</span></div><p className="panel-caption">Known blockers: {joined(route.known_blockers)}</p><span className="builder-card-cta">Inspect route evidence graph</span></a></article>)}</section></main></div>;
}

export function ProvidersIndexPage() {
  const [providers, setProviders] = useState<ProviderIntelligence[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    document.title = 'Providers | Infopunks Builder';
    api<{ data: PreSpendProviderListResponse }>('/v1/pre-spend/providers').then((response) => {
      setProviders(response.data.providers);
      setMetrics(response.data.metrics);
    }).catch(() => undefined);
  }, []);

  return <div className="shell builder-shell"><main className="builder-page" aria-label="Providers"><section className="panel hero builder-hero"><div><p className="eyebrow">Providers scored</p><h1>Providers</h1><p className="copy">Provider pages show receipt-backed route intelligence, human validation, dispute history, and whether the provider belongs in a pre-spend decision at all.</p></div></section><MetricsBand metrics={metrics} /><section className="builder-card-grid" aria-label="Provider cards">{providers.map((provider) => <article className="panel builder-card" key={provider.provider_id}><a className="builder-card-anchor" href={providerHref(provider.provider_id)}><p className="section-kicker">{provider.service_categories.join(', ')}</p><h2>{provider.name}</h2><div className="builder-stat-list"><span>reliability score {provider.reliability_score}</span><span>route coverage {provider.route_coverage}</span><span>receipt count {provider.recent_receipt_count}</span><span>validation status {provider.human_validation_status}</span></div><p className="panel-caption">Known risks: {joined(provider.known_risks)}</p><p className="panel-caption">Dispute history: {joined(provider.dispute_history)}</p><span className="builder-card-cta">Inspect provider trust</span></a></article>)}</section></main></div>;
}

export function ServicesIndexPage() {
  const [services, setServices] = useState<ServiceDossier[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    document.title = 'Services | Infopunks Builder';
    api<{ data: { services: ServiceDossier[]; metrics: Metrics } }>('/v1/services').then((response) => {
      setServices(response.data.services);
      setMetrics(response.data.metrics);
    }).catch(() => undefined);
  }, []);

  return <div className="shell builder-shell"><main className="builder-page" aria-label="Services"><section className="panel hero builder-hero"><div><p className="eyebrow">Service dossiers</p><h1>Services</h1><p className="copy">Service dossiers answer should this agent spend, which route is safer first, where the known blockers sit, and which receipt-backed alternatives remain available.</p></div></section><MetricsBand metrics={metrics} /><section className="builder-card-grid" aria-label="Service dossiers">{services.map((service) => <article className="panel builder-card" key={service.service_id}><a className="builder-card-anchor" href={serviceHref(service.service_id)}><p className="section-kicker">{service.category}</p><h2>{service.service_id}</h2><div className="builder-stat-list"><span>best observed route {service.best_observed_route ?? 'n/a'}</span><span>cheapest observed route {service.cheapest_observed_route ?? 'n/a'}</span><span>safest first attempt {service.safest_first_attempt ?? 'n/a'}</span><span>fastest repeatable route {service.fastest_repeatable_route ?? 'n/a'}</span><span>benchmark readiness {service.benchmark_readiness}</span></div><p className="panel-caption">Known blockers: {joined(service.known_blockers)}</p><p className="panel-caption">{service.pre_spend_recommendation}</p><span className="builder-card-cta">Inspect service dossier</span></a></article>)}</section><PlaceholderMarketPanel /></main></div>;
}

export function ReceiptsIndexPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    document.title = 'Receipts | Infopunks Builder';
    api<{ data: { receipts: Receipt[]; metrics: Metrics } }>('/v1/receipts').then((response) => {
      setReceipts(response.data.receipts);
      setMetrics(response.data.metrics);
    }).catch(() => undefined);
  }, []);

  return <div className="shell builder-shell"><main className="builder-page" aria-label="Receipts"><section className="panel hero builder-hero"><div><p className="eyebrow">Receipt-backed route intelligence</p><h1>Receipts</h1><p className="copy">Receipts are the proof layer behind route intelligence. No receipt, no trust. Every receipt should link back to route, provider, service, validation, and evidence graph context.</p></div></section><MetricsBand metrics={metrics} /><section className="builder-card-grid" aria-label="Receipt ledger rows">{receipts.map((receipt) => <article className="panel builder-card" key={receipt.receipt_id}><a className="builder-card-anchor" href={receiptHref(receipt.receipt_id)}><p className="section-kicker">{receipt.task_type}</p><h2>{receipt.receipt_id}</h2><div className="builder-stat-list"><span>status {receipt.status}</span><span>cost {receipt.cost}</span><span>latency {receipt.latency_ms} ms</span><span>validation state {receipt.validation_state}</span><span>linked route {receipt.route_id}</span><span>linked provider {receipt.provider_id}</span></div><p className="panel-caption">Failure reason: {receipt.failure_reason ?? 'none'}</p><p className="panel-caption">Evidence artifact: {receipt.evidence_artifact}</p><span className="builder-card-cta">Inspect receipt impact</span></a></article>)}</section></main></div>;
}

export function RouteDetailPage({ routeId }: { routeId: string }) {
  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const signalGraphNode = useSignalGraphContext('route', routeId);

  useEffect(() => {
    document.title = `${routeId} | Route Detail`;
    setMissing(false);
    api<{ data: RouteDetail }>(`/v1/routes/${encodeURIComponent(routeId)}`)
      .then((response) => setDetail(response.data))
      .catch((error) => {
        if (isNotFoundError(error)) setMissing(true);
      });
  }, [routeId]);

  if (missing) return <DetailNotFound title="Route not found" body={`No inspectable pre-spend route exists for ${routeId}.`} href="/routes" linkLabel="Back to routes" />;
  if (!detail) return <LoadingShell title="Route detail" />;

  const { route, provider, service, receipts, metrics, trust_summary } = detail;
  return <DetailShell title="Route detail" eyebrow="Pre-Spend Route Detail" headline={route.route_id} copy="Trace route evidence, inspect receipt freshness, and decide whether this route is ready for spend." metrics={metrics}>
    {signalGraphNode && <SignalGraphContextPanel node={signalGraphNode} />}
    <DetailTable title="Route evidence" rows={[
      ['route ID', route.route_id],
      ['provider', provider ? <BuilderLink href={providerHref(provider.provider_id)}>{provider.name}</BuilderLink> : route.provider_id],
      ['service', service ? <BuilderLink href={serviceHref(service.service_id)}>{service.service_id}</BuilderLink> : route.service_id],
      ['endpoint', route.endpoint],
      ['payment method', route.payment_method],
      ['estimated cost', route.estimated_cost],
      ['latency p50', `${route.latency_ms_p50} ms`],
      ['latency p95', `${route.latency_ms_p95} ms`],
      ['success rate', formatPercent(route.success_rate)],
      ['confidence score', route.confidence_score],
      ['risk level', route.risk_level],
      ['last tested', formatDateTime(route.last_tested_at)],
      ['last successful run', formatDateTime(route.last_successful_run)],
      ['last failed run', formatDateTime(route.last_failed_run)],
      ['recommended use case', route.recommended_use_case],
      ['avoid conditions', joined(route.avoid_conditions)],
      ['known blockers', joined(route.known_blockers)],
      ['linked receipts', <LinkedIds items={route.receipt_references} buildHref={receiptHref} />],
      ['validation state', detail.validation_state ?? 'n/a'],
      ['decision implications', detail.decision_implications.join(' ')]
    ]} />
    <section className="grid two builder-section-grid">
      <section className="panel builder-detail-panel">
        <div className="panel-head"><div><p className="section-kicker">Linked intelligence</p><h2>Route graph</h2></div></div>
        <div className="builder-note-stack">
          <p className="builder-note-row">Linked provider: {provider ? <BuilderLink href={providerHref(provider.provider_id)}>{provider.provider_id}</BuilderLink> : route.provider_id}</p>
          <p className="builder-note-row">Linked service: {service ? <BuilderLink href={serviceHref(service.service_id)}>{service.service_id}</BuilderLink> : route.service_id}</p>
          <p className="builder-note-row">Linked receipts: <LinkedIds items={receipts.map((receipt) => receipt.receipt_id)} buildHref={receiptHref} /></p>
        </div>
      </section>
      <section className="panel builder-detail-panel">
        <div className="panel-head"><div><p className="section-kicker">Decision impact</p><h2>Route implications</h2></div></div>
        <div className="builder-note-stack">
          {detail.decision_implications.map((item) => <p className="builder-note-row" key={item}>{item}</p>)}
        </div>
      </section>
    </section>
    <section className="panel builder-detail-panel">
      <div className="panel-head"><div><p className="section-kicker">Why this route can or cannot be trusted</p><h2>Trust summary</h2></div></div>
      {trust_summary
        ? <>
          <div className="builder-detail-grid">
            <article><span>receipt freshness</span><strong>{trust_summary.receipt_freshness}</strong></article>
            <article><span>successful receipt count</span><strong>{trust_summary.successful_receipt_count}</strong></article>
            <article><span>failure patterns</span><strong>{joined(trust_summary.failure_patterns)}</strong></article>
            <article><span>blocker severity</span><strong>{trust_summary.blocker_severity}</strong></article>
            <article><span>provider reliability</span><strong>{trust_summary.provider_reliability}</strong></article>
            <article><span>human validation</span><strong>{trust_summary.human_validation}</strong></article>
          </div>
          <p className="panel-caption">{trust_summary.summary}</p>
        </>
        : <p className="panel-caption">Trust summary unavailable for this route.</p>}
    </section>
  </DetailShell>;
}

export function ProviderDetailPage({ providerId }: { providerId: string }) {
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    document.title = `${providerId} | Provider Detail`;
    setMissing(false);
    api<{ data: ProviderDetail }>(`/v1/providers/${encodeURIComponent(providerId)}`)
      .then((response) => setDetail(response.data))
      .catch((error) => {
        if (isNotFoundError(error)) setMissing(true);
      });
  }, [providerId]);

  if (missing) return <DetailNotFound title="Provider not found" body={`No inspectable pre-spend provider exists for ${providerId}.`} href="/providers" linkLabel="Back to providers" />;
  if (!detail) return <LoadingShell title="Provider detail" />;

  const { provider, routes, services, receipts, metrics, trust_profile } = detail;
  return <DetailShell title="Provider detail" eyebrow="Pre-Spend Provider Detail" headline={provider.name} copy="Inspect provider reliability, disputes, route coverage, and the receipt evidence behind provider trust." metrics={metrics}>
    <DetailTable title="Provider evidence" rows={[
      ['provider ID', provider.provider_id],
      ['provider name', provider.name],
      ['service categories', joined(provider.service_categories)],
      ['reliability score', provider.reliability_score],
      ['pricing consistency', provider.pricing_consistency],
      ['output quality notes', joined(provider.output_quality_notes)],
      ['uptime notes', joined(provider.uptime_notes)],
      ['dispute history', joined(provider.dispute_history)],
      ['human validation status', provider.human_validation_status],
      ['known risks', joined(provider.known_risks)],
      ['agent compatibility', joined(provider.agent_compatibility)],
      ['route coverage', provider.route_coverage],
      ['recent receipt count', provider.recent_receipt_count],
      ['linked routes', <LinkedIds items={routes.map((route) => route.route_id)} buildHref={routeHref} />],
      ['linked receipts', <LinkedIds items={receipts.map((receipt) => receipt.receipt_id)} buildHref={receiptHref} />],
      ['provider-level warnings', joined(detail.provider_level_warnings)]
    ]} />
    <section className="panel builder-detail-panel">
      <div className="panel-head"><div><p className="section-kicker">Provider trust profile</p><h2>Provider trust profile</h2></div></div>
      <div className="builder-detail-grid">
        <article><span>safe for first attempts</span><strong>{trust_profile.safe_for_first_attempt ? 'yes' : 'no'}</strong></article>
        <article><span>better for repeatable routes</span><strong>{trust_profile.better_for_repeatable_routes ? 'yes' : 'no'}</strong></article>
        <article><span>requires human approval</span><strong>{trust_profile.requires_human_approval ? 'yes' : 'no'}</strong></article>
        <article><span>not recommended</span><strong>{trust_profile.not_recommended ? 'yes' : 'no'}</strong></article>
      </div>
      <p className="panel-caption">{trust_profile.summary}</p>
    </section>
    <section className="grid two builder-section-grid">
      <DetailList title="Linked services" items={services.map((service) => service.service_id)} />
      <DetailList title="Provider-level warnings" items={detail.provider_level_warnings} />
    </section>
  </DetailShell>;
}

export function ServiceDetailPage({ serviceId }: { serviceId: string }) {
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    document.title = `${serviceId} | Service Detail`;
    setMissing(false);
    api<{ data: ServiceDetail }>(`/v1/services/${encodeURIComponent(serviceId)}`)
      .then((response) => setDetail(response.data))
      .catch((error) => {
        if (isNotFoundError(error)) setMissing(true);
      });
  }, [serviceId]);

  if (missing) return <DetailNotFound title="Service not found" body={`No inspectable pre-spend service exists for ${serviceId}.`} href="/services" linkLabel="Back to services" />;
  if (!detail) return <LoadingShell title="Service detail" />;

  const { service, routes, receipts, metrics, best_route_decision_map } = detail;
  return <DetailShell title="Service detail" eyebrow="Pre-Spend Service Detail" headline={service.service_id} copy="Compare observed routes, blockers, evidence artifacts, and recommendation posture before service-level spend decisions." metrics={metrics}>
    <DetailTable title="Service evidence" rows={[
      ['service ID', service.service_id],
      ['category', service.category],
      ['supported inputs', joined(service.supported_inputs)],
      ['available routes', <LinkedIds items={service.available_routes} buildHref={routeHref} />],
      ['observed cost range', `${service.observed_cost_range.min} to ${service.observed_cost_range.max}`],
      ['observed latency range', `${service.observed_latency_range.min_ms}-${service.observed_latency_range.max_ms} ms`],
      ['best observed route', service.best_observed_route ? <BuilderLink href={routeHref(service.best_observed_route)}>{service.best_observed_route}</BuilderLink> : 'n/a'],
      ['cheapest observed route', service.cheapest_observed_route ? <BuilderLink href={routeHref(service.cheapest_observed_route)}>{service.cheapest_observed_route}</BuilderLink> : 'n/a'],
      ['safest first attempt', service.safest_first_attempt ? <BuilderLink href={routeHref(service.safest_first_attempt)}>{service.safest_first_attempt}</BuilderLink> : 'n/a'],
      ['fastest repeatable route', service.fastest_repeatable_route ? <BuilderLink href={routeHref(service.fastest_repeatable_route)}>{service.fastest_repeatable_route}</BuilderLink> : 'n/a'],
      ['known blockers', joined(service.known_blockers)],
      ['evidence artifacts', joined(service.evidence_artifacts)],
      ['benchmark readiness', service.benchmark_readiness],
      ['pre-spend recommendation', service.pre_spend_recommendation],
      ['linked receipts', <LinkedIds items={receipts.map((receipt) => receipt.receipt_id)} buildHref={receiptHref} />]
    ]} />
    <section className="panel builder-detail-panel">
      <div className="panel-head"><div><p className="section-kicker">Best route decision map</p><h2>Best route decision map</h2></div></div>
      <div className="builder-detail-grid">
        <article><span>best observed route</span><strong>{best_route_decision_map.best_observed_route ? <BuilderLink href={routeHref(best_route_decision_map.best_observed_route)}>{best_route_decision_map.best_observed_route}</BuilderLink> : 'n/a'}</strong></article>
        <article><span>cheapest route</span><strong>{best_route_decision_map.cheapest_route ? <BuilderLink href={routeHref(best_route_decision_map.cheapest_route)}>{best_route_decision_map.cheapest_route}</BuilderLink> : 'n/a'}</strong></article>
        <article><span>safest first attempt</span><strong>{best_route_decision_map.safest_first_attempt ? <BuilderLink href={routeHref(best_route_decision_map.safest_first_attempt)}>{best_route_decision_map.safest_first_attempt}</BuilderLink> : 'n/a'}</strong></article>
        <article><span>fastest repeatable route</span><strong>{best_route_decision_map.fastest_repeatable_route ? <BuilderLink href={routeHref(best_route_decision_map.fastest_repeatable_route)}>{best_route_decision_map.fastest_repeatable_route}</BuilderLink> : 'n/a'}</strong></article>
      </div>
      <p className="panel-caption">{best_route_decision_map.summary}</p>
    </section>
    <DetailList title="Linked route set" items={routes.map((route) => route.route_id)} />
  </DetailShell>;
}

export function ReceiptDetailPage({ receiptId }: { receiptId: string }) {
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const signalGraphNode = useSignalGraphContext('receipt', receiptId);

  useEffect(() => {
    document.title = `${receiptId} | Receipt Detail`;
    setMissing(false);
    api<{ data: ReceiptDetail }>(`/v1/receipts/${encodeURIComponent(receiptId)}`)
      .then((response) => setDetail(response.data))
      .catch((error) => {
        if (isNotFoundError(error)) setMissing(true);
      });
  }, [receiptId]);

  if (missing) return <DetailNotFound title="Receipt not found" body={`No inspectable pre-spend receipt exists for ${receiptId}.`} href="/receipts" linkLabel="Back to receipts" />;
  if (!detail) return <LoadingShell title="Receipt detail" />;

  return <DetailShell title="Receipt detail" eyebrow="Pre-Spend Receipt Detail" headline={detail.receipt_id} copy="Inspect receipt evidence, linked route intelligence, and whether this run should change future pre-spend decisions." metrics={null}>
    {signalGraphNode && <SignalGraphContextPanel node={signalGraphNode} />}
    <DetailTable title="Receipt evidence" rows={[
      ['receipt ID', detail.receipt_id],
      ['timestamp', formatDateTime(detail.timestamp)],
      ['agent ID', detail.agent_id],
      ['route ID', detail.route ? <BuilderLink href={routeHref(detail.route.route_id)}>{detail.route.route_id}</BuilderLink> : detail.route_id],
      ['provider ID', detail.provider ? <BuilderLink href={providerHref(detail.provider.provider_id)}>{detail.provider.provider_id}</BuilderLink> : detail.provider_id],
      ['service ID', detail.service ? <BuilderLink href={serviceHref(detail.service.service_id)}>{detail.service.service_id}</BuilderLink> : detail.service_id],
      ['task type', detail.task_type],
      ['cost', detail.cost],
      ['payment method', detail.payment_method],
      ['latency', `${detail.latency_ms} ms`],
      ['input summary', detail.input_summary],
      ['output summary', detail.output_summary],
      ['status', detail.status],
      ['success or failure reason', detail.failure_reason ?? 'succeeded'],
      ['validation state', detail.validation_state],
      ['human notes', joined(detail.human_notes)],
      ['confidence delta', detail.confidence_delta],
      ['evidence artifact', detail.evidence_artifact],
      ['linked route', detail.route ? <BuilderLink href={routeHref(detail.route.route_id)}>{detail.route.route_id}</BuilderLink> : detail.route_id],
      ['linked provider', detail.provider ? <BuilderLink href={providerHref(detail.provider.provider_id)}>{detail.provider.provider_id}</BuilderLink> : detail.provider_id],
      ['linked service', detail.service ? <BuilderLink href={serviceHref(detail.service.service_id)}>{detail.service.service_id}</BuilderLink> : detail.service_id]
    ]} />
    <section className="panel builder-detail-panel">
      <div className="panel-head"><div><p className="section-kicker">Receipt impact</p><h2>Receipt impact</h2></div></div>
      <div className="builder-detail-grid">
        <article><span>improves route confidence</span><strong>{detail.impact.improves_route_confidence ? 'yes' : 'no'}</strong></article>
        <article><span>reduces route confidence</span><strong>{detail.impact.reduces_route_confidence ? 'yes' : 'no'}</strong></article>
        <article><span>fresh or stale</span><strong>{detail.impact.freshness} ({ageLabel(detail.timestamp)})</strong></article>
        <article><span>human validated</span><strong>{detail.impact.human_validated ? 'yes' : 'no'}</strong></article>
        <article><span>affect future pre-spend decisions</span><strong>{detail.impact.should_affect_future_pre_spend_decisions ? 'yes' : 'no'}</strong></article>
      </div>
      <p className="panel-caption">{detail.impact.summary}</p>
    </section>
  </DetailShell>;
}
