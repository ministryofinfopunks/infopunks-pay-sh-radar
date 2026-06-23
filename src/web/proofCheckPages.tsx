import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

type ProofClaimType = 'agent_autonomy' | 'route_performance' | 'provider_reliability' | 'market_claim' | 'token_claim' | 'partnership_claim' | 'revenue_claim' | 'generic_claim';
type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'missing';
type ReceiptStrength = 'verified_receipts' | 'partial_receipts' | 'weak_receipts' | 'no_receipts';
type ValidationStatus = 'human_validated' | 'community_pending' | 'disputed' | 'unvalidated';
type ProofDecisionState = 'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';

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
  receipts_found: string[];
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

function shareHref(checkId: string) {
  return `/check/${encodeURIComponent(checkId)}`;
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

export function ProofReceiptCard({ check, compact = false }: { check: ProofCheckResult; compact?: boolean }) {
  return <article className={`panel proof-receipt-card ${proofToneClass(check.decision_state)} ${compact ? 'compact' : ''}`} aria-label="Infopunks Receipt Check">
    <div className="proof-card-head">
      <p className="eyebrow">{check.headline}</p>
      <span className="proof-decision-pill">{decisionLabel(check.decision_state)}</span>
    </div>
    <h2>{check.claim}</h2>
    <p className="copy">{check.claim_summary}</p>
    <div className="proof-card-grid">
      <p><span>Type</span><strong>{humanize(check.claim_type)}</strong></p>
      <p><span>Receipts</span><strong>{humanize(check.receipt_strength)}</strong></p>
      <p><span>Evidence</span><strong>{check.evidence_strength.toUpperCase()}</strong></p>
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
    </div>
    {!compact && <div className="proof-card-section">
      <h3>Validation + Decision</h3>
      <p>{check.validation_summary}</p>
      <p>{check.decision_summary}</p>
    </div>}
    <footer className="proof-card-foot">
      <span>No receipt, no trust.</span>
      <small>{formatDateTime(check.created_at)}</small>
    </footer>
  </article>;
}

function ProofCheckNav() {
  return <nav className="global-toolbar proof-check-toolbar" aria-label="Proof Feed navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Proof Feed</strong>
    </a>
    <div className="terminal-nav" aria-label="Proof Feed routes">
      <a href="/check" aria-current={window.location.pathname === '/check' ? 'page' : undefined}>Check</a>
      <a href="/routes">Routes</a>
      <a href="/providers">Providers</a>
      <a href="/receipts">Receipts</a>
      <a href="/claim">Claims</a>
    </div>
  </nav>;
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
          <p><a className="execute compact secondary" href={shareHref(result.check_id)}>Open public share page</a></p>
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
            {checks.map((check) => <a className="proof-check-link" key={check.check_id} href={shareHref(check.check_id)}>
              <ProofReceiptCard check={check} compact />
            </a>)}
          </div>}
      </section>
    </main>
  </div>;
}

export function ProofCheckDetailPage({ checkId }: { checkId: string }) {
  const [check, setCheck] = useState<ProofCheckResult | null>(null);
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
      {check && <>
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
