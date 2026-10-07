import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { RadarProductNavigation } from './radarNetworks';

type ProofClaimType = 'agent_autonomy' | 'route_performance' | 'provider_reliability' | 'market_claim' | 'market_narrative' | 'token_claim' | 'partnership_claim' | 'revenue_claim' | 'generic_claim';
type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'missing';
type ReceiptStrength = 'verified_receipts' | 'partial_receipts' | 'weak_receipts' | 'no_receipts';
type ValidationStatus = 'human_validated' | 'community_pending' | 'disputed' | 'unvalidated';
type ProofDecisionState = 'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';
type ProofSubject = {
  subject_id: string;
  ticker: string;
  name: string;
  chain: string;
  contract: string;
  pair: string;
  site: string;
  x: string;
};

export type ProofCheckResult = {
  check_id: string;
  created_at: string;
  submitted_by: string | null;
  source_url: string | null;
  input: string;
  claim: string;
  claim_type: ProofClaimType;
  claim_summary: string;
  subject_label: string;
  subject_id?: string | null;
  subject?: ProofSubject | null;
  receipts_found: string[];
  missing_receipts?: string[];
  evidence_artifacts: string[];
  evidence_strength: EvidenceStrength;
  receipt_strength: ReceiptStrength;
  validation_status: ValidationStatus;
  risk_flags: string[];
  decision_state: ProofDecisionState;
  share_url: string;
  share_text: string;
  evidence_summary: string;
  validation_summary: string;
  decision_summary: string;
  headline: string;
  public_cta: string;
};

type MonitorPreSpendResponse = {
  subject?: string | null;
  intent: string;
  preferred_settlement?: string;
  required_confidence?: number;
  decision: string;
  confidence_score: number;
  known_blockers: string[];
  requires_human_approval: boolean;
  linked_check_id?: string | null;
  proof_check_reference?: string | null;
  judgment?: {
    receipt_id: string;
    decision: 'ALLOW' | 'DEGRADE' | 'BLOCK';
    outcome_status: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED';
  };
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

function decisionLabel(state: ProofDecisionState) {
  if (state === 'do_not_use_yet') return 'DO NOT USE YET';
  return state.toUpperCase().replaceAll('_', ' ');
}

function humanize(value: string) {
  return value.replaceAll('_', ' ');
}

function formatDateTime(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

function shareHref(check: Pick<ProofCheckResult, 'check_id' | 'share_url'>) {
  return check.share_url || `/check/${encodeURIComponent(check.check_id)}`;
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  return Promise.reject(new Error('clipboard_unavailable'));
}

function proofToneClass(decision: ProofDecisionState) {
  if (decision === 'trust') return 'proof-trust';
  if (decision === 'caution') return 'proof-caution';
  if (decision === 'disputed') return 'proof-disputed';
  if (decision === 'do_not_use_yet') return 'proof-stop';
  return 'proof-unproven';
}

function monitorReceiptLabel(value: string) {
  if (value === 'onchain_pair' || value.startsWith('onchain_pair:')) return 'pair';
  if (value === 'public_site' || value.startsWith('public_site:')) return 'site';
  if (value === 'social' || value.startsWith('social:')) return 'X';
  return humanize(value);
}

function monitorMissingReceiptLabel(value: string) {
  if (value === 'team_dox') return 'team';
  if (value === 'utility_commitment') return 'utility';
  if (value === 'paid_route_benchmark') return 'paid route';
  return humanize(value);
}

function monitorIntentLabel(value: string) {
  if (value === 'allocate_to_pltr_paired_narrative_token') return 'allocate to PLTR-paired narrative token';
  return humanize(value);
}

function monitorSettlementLabel(value: string) {
  if (value === 'tokenized_pltr') return 'tokenized PLTR';
  return humanize(value);
}

export function ProofReceiptCard({ check, compact = false, showShareLink = false }: { check: ProofCheckResult; compact?: boolean; showShareLink?: boolean }) {
  const isMonitor = check.check_id === 'check_monitor' || check.subject?.ticker === 'MONITOR';
  return <article className={`panel proof-receipt-card ${proofToneClass(check.decision_state)} ${compact ? 'compact' : ''}`} aria-label="Infopunks Receipt Check">
    <div className="proof-card-head">
      <p className="eyebrow">{check.headline}</p>
      <span className="proof-decision-pill">{decisionLabel(check.decision_state)}</span>
    </div>
    <h2>{isMonitor && check.subject ? `${check.subject.ticker} / ${check.subject.name}` : check.claim}</h2>
    <p className="copy">{isMonitor ? check.claim : check.claim_summary}</p>
    {check.subject && <div className="proof-card-grid">
      <p><span>Subject</span><strong>{check.subject.ticker} / {check.subject.name}</strong></p>
      <p><span>Subject ID</span><strong>{isMonitor ? 'monitor' : check.subject.subject_id}</strong></p>
      <p><span>Chain</span><strong>{check.subject.chain}</strong></p>
      {isMonitor && <p><span>Check ID</span><strong>{check.check_id}</strong></p>}
    </div>}
    <div className="proof-card-grid">
      <p><span>Type</span><strong>{humanize(check.claim_type)}</strong></p>
      <p><span>{isMonitor ? 'Receipts found' : 'Receipts'}</span><strong>{isMonitor ? check.receipts_found.map(monitorReceiptLabel).join(' / ') : humanize(check.receipt_strength)}</strong></p>
      <p><span>Evidence strength</span><strong>{isMonitor && check.evidence_strength === 'weak' ? 'LOW' : check.evidence_strength.toUpperCase()}</strong></p>
      <p><span>Validation</span><strong>{humanize(check.validation_status)}</strong></p>
    </div>
    <div className="proof-card-section">
      <h3>Risk Flags</h3>
      {check.risk_flags.length
        ? <div className="proof-flag-list">{check.risk_flags.map((flag) => <span key={flag}>{humanize(flag)}</span>)}</div>
        : <p className="panel-caption">No active risk flags in this seeded scope.</p>}
    </div>
    <div className="proof-card-section">
      <h3>Evidence Summary</h3>
      <p>{check.evidence_summary}</p>
      {check.receipts_found.length > 0 && <ul className="proof-list">{check.receipts_found.map((item) => <li key={item}>{isMonitor ? monitorReceiptLabel(item) : item}</li>)}</ul>}
      <h3>Missing Receipts</h3>
      {check.missing_receipts?.length
        ? <div className="proof-flag-list">{check.missing_receipts.map((item) => <span key={item}>{isMonitor ? monitorMissingReceiptLabel(item) : humanize(item)}</span>)}</div>
        : <p className="panel-caption">No missing receipts recorded in this scope.</p>}
    </div>
    {!compact && <div className="proof-card-section">
      <h3>Validation + Decision</h3>
      <p>{check.validation_summary}</p>
      <p>{check.decision_summary}</p>
    </div>}
    <footer className="proof-card-foot">
      <span>No receipt, no trust.</span>
      <span className="proof-card-foot-actions">
        {showShareLink && isMonitor && <a className="builder-link" href="/check/monitor">Share /check/monitor</a>}
        <small>{formatDateTime(check.created_at)}</small>
      </span>
    </footer>
  </article>;
}

export function MonitorPreSpendDecisionCard({ result }: { result: MonitorPreSpendResponse }) {
  const terminalHref = `/spend-terminal?intent=${encodeURIComponent(result.intent)}&subject=${encodeURIComponent(result.subject ?? 'monitor')}`;
  return <article className="panel proof-receipt-card monitor-decision-card proof-caution" aria-label="MONITOR Pre-Spend Decision">
    <div className="proof-card-head">
      <p className="eyebrow">Pre-Spend Decision</p>
      <span className="proof-decision-pill">{result.decision.replaceAll('_', ' ').toUpperCase()}</span>
    </div>
    <h2>USE WITH CAUTION</h2>
    <p className="copy">The linked Proof Check does not support unrestricted spend for this target.</p>
    <div className="proof-card-grid">
      <p><span>Subject ID</span><strong>{result.subject ?? 'monitor'}</strong></p>
      <p><span>Intent</span><strong>{monitorIntentLabel(result.intent)}</strong></p>
      <p><span>Settlement</span><strong>{monitorSettlementLabel(result.preferred_settlement ?? 'tokenized_pltr')}</strong></p>
      <p><span>Confidence</span><strong>{result.confidence_score} / {result.required_confidence ?? 'n/a'}</strong></p>
      <p><span>Canonical judgment</span><strong>{result.judgment?.decision ?? 'DEGRADE'}</strong></p>
      <p><span>Outcome</span><strong>{(result.judgment?.outcome_status ?? 'NOT_VERIFIED').replaceAll('_', ' ')}</strong></p>
      <p><span>Human approval</span><strong>{result.requires_human_approval ? 'required' : 'not required'}</strong></p>
    </div>
    <div className="proof-card-section">
      <h3>Known Blockers</h3>
      <ul className="proof-list">{result.known_blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
    </div>
    <div className="proof-card-section">
      <h3>Linked Proof Check</h3>
      <p>{result.proof_check_reference
        ? <a className="builder-link" href={result.proof_check_reference}>{result.linked_check_id ?? 'check_monitor'}</a>
        : result.linked_check_id ?? 'check_monitor'}</p>
    </div>
    <div className="proof-card-section">
      <h3>Judgment Receipt</h3>
      <p>{result.judgment?.receipt_id ?? 'unavailable'}</p>
    </div>
    <div className="monitor-decision-actions">
      <a className="execute compact" href={terminalHref}>Open Spend Terminal</a>
    </div>
    <footer className="proof-card-foot"><span>Pay.sh spends. Radar decides.</span></footer>
  </article>;
}

function ProofCheckNav() {
  return <RadarProductNavigation context="solana" className="proof-check-toolbar" />;
}

export function ProofCheckPage() {
  const [input, setInput] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [result, setResult] = useState<ProofCheckResult | null>(null);
  const [checks, setChecks] = useState<ProofCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: { checks: ProofCheckResult[] } }>('/v1/checks')
      .then((response) => setChecks(response.data.checks))
      .catch((err) => setError(err instanceof Error ? err.message : 'proof_check_feed_unavailable'))
      .finally(() => setLoading(false));
  }, []);

  const shareText = useMemo(() => result?.share_text ?? '', [result]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await api<{ data: ProofCheckResult }>('/v1/check', {
        method: 'POST',
        body: JSON.stringify({
          input,
          sourceUrl: sourceUrl.trim() || undefined
        })
      });
      setResult(response.data);
      setChecks((current) => [response.data, ...current.filter((item) => item.check_id !== response.data.check_id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'proof_check_create_failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareText() {
    if (!shareText) return;
    try {
      await copyText(shareText);
      setCopied('Share text copied.');
    } catch {
      setCopied('Clipboard unavailable.');
    }
  }

  return <div className="shell builder-shell proof-feed-shell">
    <ProofCheckNav />
    <main className="builder-page" aria-label="Proof Feed check page">
      <section className="panel hero proof-check-hero">
        <div>
          <p className="eyebrow">The receipt layer for the agent economy</p>
          <h1>Check the receipts before the market believes the claim.</h1>
          <p className="copy">Paste an agent, route, provider, project, wallet, API, or claim. Infopunks returns receipts, risks, validations, and a decision state.</p>
          <p className="panel-caption">Before an agent pays, it checks Infopunks.</p>
        </div>
        <form className="proof-check-form" onSubmit={submit}>
          <label>
            <span>Claim input</span>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste a claim, project, wallet, provider, route, link, or market story." required rows={5} />
          </label>
          <label>
            <span>Source URL (optional)</span>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://example.com/context" />
          </label>
          <button className="execute" type="submit" disabled={submitting}>{submitting ? 'Checking...' : 'Check receipts'}</button>
          {error && <p className="route-state error">{error}</p>}
        </form>
      </section>

      {result && <section className="proof-check-output">
        <ProofReceiptCard check={result} />
        <div className="panel proof-share-panel">
          <h2>Share This Check</h2>
          <p>{result.public_cta}</p>
          <p><a className="execute compact secondary" href={shareHref(result)}>Open public share page</a></p>
          <button className="execute compact secondary" type="button" onClick={copyShareText}>Copy share text</button>
          {copied && <p className="panel-caption">{copied}</p>}
          <pre className="proof-share-block">{shareText}</pre>
        </div>
      </section>}

      <section className="proof-check-feed">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Recent Proof Checks</p>
            <h2>Receipt Checks</h2>
          </div>
          <p className="panel-caption">Corrupted signal is economic risk.</p>
        </div>
        {loading
          ? <p className="panel-caption">Loading proof feed...</p>
          : <div className="proof-check-grid">
            {checks.map((check) => <a className="proof-check-link" key={check.check_id} href={shareHref(check)}>
              <ProofReceiptCard check={check} compact />
            </a>)}
          </div>}
      </section>
    </main>
  </div>;
}

export function ProofCheckDetailPage({ checkId }: { checkId: string }) {
  const [check, setCheck] = useState<ProofCheckResult | null>(null);
  const [preSpend, setPreSpend] = useState<MonitorPreSpendResponse | null>(null);
  const [preSpendError, setPreSpendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: ProofCheckResult }>(`/v1/checks/${encodeURIComponent(checkId)}`)
      .then((response) => setCheck(response.data))
      .catch((err) => {
        if (isNotFoundError(err)) setMissing(true);
        else setError(err instanceof Error ? err.message : 'proof_check_detail_unavailable');
      });
  }, [checkId]);

  useEffect(() => {
    if (checkId !== 'check_monitor') return;
    api<{ data: MonitorPreSpendResponse }>('/v1/pre-spend/check', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'infopunks_launch_surface',
        intent: 'allocate_to_pltr_paired_narrative_token',
        subject_id: 'monitor',
        budget: 25,
        risk_tolerance: 'low',
        preferred_settlement: 'tokenized_pltr',
        required_confidence: 75,
        linked_check_id: 'check_monitor'
      })
    }).then((response) => setPreSpend(response.data)).catch((err) => setPreSpendError(err instanceof Error ? err.message : 'pre_spend_unavailable'));
  }, [checkId]);

  async function copyShareText() {
    if (!check) return;
    try {
      await copyText(check.share_text);
      setCopyState('Share text copied.');
    } catch {
      setCopyState('Clipboard unavailable.');
    }
  }

  if (missing) return <div className="shell builder-shell proof-feed-shell">
    <ProofCheckNav />
    <main className="builder-page">
      <section className="panel hero">
        <p className="eyebrow">INFOPUNKS RECEIPT CHECK</p>
        <h1>Proof check not found</h1>
        <p className="copy">No public proof check exists for {checkId}.</p>
      </section>
    </main>
  </div>;

  return <div className="shell builder-shell proof-feed-shell">
    <ProofCheckNav />
    <main className="builder-page" aria-label="Proof check public page">
      {error && <section className="panel" role="alert"><p className="route-state error">{error}</p></section>}
      {check && checkId === 'check_monitor' ? <section className="proof-check-output monitor-launch-grid" aria-label="MONITOR Infopunks check">
        <ProofReceiptCard check={check} showShareLink />
        {preSpend
          ? <MonitorPreSpendDecisionCard result={preSpend} />
          : <section className="panel proof-share-panel" aria-live="polite"><p className="eyebrow">Pre-Spend Decision</p><h2>{preSpendError ? 'Decision unavailable' : 'Loading decision'}</h2><p>{preSpendError ?? 'Loading the linked pre-spend decision.'}</p></section>}
      </section> : check && <>
        <section className="proof-check-output">
          <ProofReceiptCard check={check} />
          <aside className="panel proof-share-panel">
            <p className="eyebrow">Public Share Page</p>
            <h2>{decisionLabel(check.decision_state)}</h2>
            <p>{check.validation_summary}</p>
            <p>{check.decision_summary}</p>
            <p><b>No receipt, no trust.</b></p>
            <button className="execute compact secondary" type="button" onClick={copyShareText}>Copy share text</button>
            {copyState && <p className="panel-caption">{copyState}</p>}
            <pre className="proof-share-block">{check.share_text}</pre>
          </aside>
        </section>

        <section className="proof-detail-grid">
          <article className="panel">
            <p className="eyebrow">Evidence Summary</p>
            <h3>Receipts found</h3>
            {check.receipts_found.length ? <ul className="proof-list">{check.receipts_found.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None recorded yet.</p>}
            <p className="panel-caption">{check.evidence_summary}</p>
            <h3>Missing receipts</h3>
            {check.missing_receipts?.length
              ? <ul className="proof-list">{check.missing_receipts.map((item) => <li key={item}>{humanize(item)}</li>)}</ul>
              : <p>None recorded in this scope.</p>}
          </article>
          <article className="panel">
            <p className="eyebrow">Validation Status</p>
            <h3>{humanize(check.validation_status)}</h3>
            <p>{check.validation_summary}</p>
            <p className="panel-caption">{check.public_cta}</p>
          </article>
          <article className="panel">
            <p className="eyebrow">Risk Flags</p>
            <h3>Decision State</h3>
            <p>{decisionLabel(check.decision_state)}</p>
            {check.risk_flags.length ? <div className="proof-flag-list">{check.risk_flags.map((flag) => <span key={flag}>{humanize(flag)}</span>)}</div> : <p>No active flags in this scope.</p>}
          </article>
        </section>
      </>}
    </main>
  </div>;
}
