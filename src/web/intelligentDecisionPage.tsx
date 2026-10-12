import React, { useEffect, useState } from 'react';
import { DecisionViewV1Schema, type DecisionViewV1 } from '../schemas/decisionView';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import './intelligentDecision.css';

const verdictLabels: Record<DecisionViewV1['judgment']['decision'], string> = {
  proceed: 'Proceed assessment',
  test_spend_first: 'Limited test assessment',
  do_not_spend: 'Do not spend',
  insufficient_evidence: 'Insufficient evidence'
};

export function IntelligentDecisionPage({ id }: { id: string | null }) {
  const [view, setView] = useState<DecisionViewV1 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [showEvidence, setShowEvidence] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setView(null); setError('');
    fetch(toApiUrl(getApiBaseUrl(), `/v1/decision-views/${encodeURIComponent(id)}`), {
      signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store'
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'No canonical judgment found.'
        : response.status === 429 ? 'Too many requests. Wait before trying again.' : 'Decision view unavailable.');
      const body: unknown = await response.json();
      const data = body && typeof body === 'object' && 'data' in body ? body.data : null;
      const parsed = DecisionViewV1Schema.safeParse(data);
      if (!parsed.success || parsed.data.judgment.id !== id) throw new Error('Decision view failed validation.');
      return parsed.data;
    }).then(result => { if (!controller.signal.aborted) setView(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Decision view unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  const receiptLink = view ? toApiUrl(getApiBaseUrl(), `/v1/receipt-spine/judgment/${encodeURIComponent(view.judgment.id)}`) : '';
  const trusted = Boolean(view?.verification.record_verified);
  const ready = Boolean(view?.verification.assessment_eligible);
  const status = !view ? '' : !trusted ? 'UNVERIFIED RECORD'
    : !view.verification.within_validity_window ? 'EXPIRED OR NOT YET VALID'
      : view.judgment.decision === 'do_not_spend' ? 'VERIFIED VETO'
        : view.judgment.decision === 'insufficient_evidence' ? 'ABSTAIN: NO SPEND'
          : ready ? 'VALID ASSESSMENT, NOT EXECUTION AUTHORITY' : 'NOT ELIGIBLE';

  return <div className="shell intelligent-decision-shell">
    <main className="intelligent-decision-page" aria-label="Infopunks Intelligent UI">
      <section className="panel intelligent-decision-panel">
        <p className="eyebrow">INFOPUNKS INTELLIGENT UI / READ ONLY</p>
        <h1>Economic decisions, with evidence attached.</h1>
        <p className="copy">Models propose. Infopunks judges. Code enforces. Receipts remember. Interfaces adapt.</p>
        {!id && <form className="intelligent-decision-search" onSubmit={event => {
          event.preventDefault();
          const value = search.trim();
          if (value && value.length <= 256 && !value.includes('/')) window.location.assign(`/radar/decisions/${encodeURIComponent(value)}`);
        }}>
          <label htmlFor="judgment-lookup">Inspect a canonical judgment ID</label>
          <input id="judgment-lookup" value={search} maxLength={256} onChange={event => setSearch(event.target.value)} placeholder="Judgment ID" />
          <button className="execute compact" type="submit">Inspect</button>
        </form>}
        {loading && <p role="status">Checking the canonical record…</p>}
        {error && <p role="alert" className="route-state error">{error} No spending authority can be inferred.</p>}
        {view && <section aria-label="Canonical decision card" className="intelligent-decision-card">
          <div className="intelligent-decision-card-head">
            <div><p className="section-kicker">CANONICAL JUDGMENT</p><h2>{verdictLabels[view.judgment.decision]}</h2></div>
            <strong className={ready ? 'intelligent-decision-status qualified' : 'intelligent-decision-status'}>{status}</strong>
          </div>
          <p className="intelligent-decision-warning">{!trusted
            ? 'Receipt integrity or trusted issuer verification failed. Do not rely on this assessment.'
            : !view.verification.within_validity_window
              ? 'This is a historical assessment, not current permission.'
              : 'A judgment receipt is an assessment. A separate signed, single-use capability and live policy check are required for execution.'}</p>
          <dl className="intelligent-decision-fields">
            <div><dt>Subject</dt><dd>{view.subject.type} / {view.subject.id}</dd></div>
            <div><dt>Decision</dt><dd>{view.judgment.decision}</dd></div>
            <div><dt>Assessment confidence</dt><dd>{view.judgment.confidence}/100</dd></div>
            <div><dt>Assessment fee</dt><dd>{view.judgment.assessment_charge.required
              ? `${view.judgment.assessment_charge.amount} ${view.judgment.assessment_charge.asset ?? 'asset unspecified'}` : 'No fee recorded'}</dd></div>
            <div><dt>Valid until</dt><dd>{view.judgment.valid_until}</dd></div>
            <div><dt>Execution authorized</dt><dd>NO</dd></div>
          </dl>
          <section aria-label="Recorded judgment reasons">
            <h3>Recorded judgment reasons</h3>
            <ul>{view.judgment.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul>
            <p className="panel-caption">Reasons are sourced from the signed record. Their completeness is not independently established by this interface.</p>
          </section>
          <div className="intelligent-decision-controls">
            <button className="execute compact secondary" type="button" onClick={() => setShowEvidence(value => !value)} aria-expanded={showEvidence}>{showEvidence ? 'Hide evidence' : 'Inspect evidence'}</button>
            <button className="execute compact secondary" type="button" onClick={() => setShowJson(value => !value)} aria-expanded={showJson}>{showJson ? 'Hide JSON' : 'View machine contract'}</button>
            <button className="execute compact secondary" type="button" onClick={() => {
              if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(JSON.stringify(view, null, 2)).catch(() => undefined);
            }}>Copy JSON</button>
            <a className="execute compact secondary" href={receiptLink}>Inspect original receipt</a>
          </div>
          {showEvidence && <section className="intelligent-decision-evidence" aria-label="Evidence inspector">
            <h3>Evidence ancestry: {view.evidence.state}</h3>
            {view.evidence.observations.map(observation => <article key={observation.id}>
              <strong>{observation.id} · {observation.state}</strong>
              <p>Source type: {observation.source_type} · Observed: {observation.observed_at}</p>
              <p>Freshness expires: {observation.freshness_expires_at ?? 'Not provided'}</p>
              <a href={toApiUrl(getApiBaseUrl(), `/v1/receipt-spine/observation/${encodeURIComponent(observation.id)}`)}>View canonical observation</a>
            </article>)}
            {view.evidence.missing_observation_ids.length > 0 && <p role="alert">Unavailable observations: {view.evidence.missing_observation_ids.join(', ')}</p>}
            <p className="panel-caption">{view.evidence.history_commitment.status === 'committed_in_canonical_v2'
              ? `Verified canonical v2 evaluation-history commitment: ${view.evidence.history_commitment.hash}`
              : view.evidence.history_commitment.status === 'not_available_in_canonical_v1'
                ? 'Causal history commitment is NOT AVAILABLE in the v1 receipt. Do not claim replayable evaluation-history attribution.'
                : 'Canonical v2 history context is unavailable or failed verification. Do not claim replayable evaluation-history attribution.'}</p>
          </section>}
          {showJson && <pre className="intelligent-decision-json" aria-label="Decision view JSON"><code>{JSON.stringify(view, null, 2)}</code></pre>}
          <p className="panel-caption">Read-only decision surface. No approve, sign, pay, or execute action exists here.</p>
        </section>}
        <p className="panel-caption"><a href="/radar/cards">Diagnostic preflight cards</a> remain separate from authoritative judgments. <a href="/">Return to Radar</a></p>
      </section>
    </main>
  </div>;
}
