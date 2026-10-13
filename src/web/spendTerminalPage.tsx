import { FieldFeedback, TenantKeyField } from './fieldFeedback';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { useEffect, useRef, useState } from 'react';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import { EvidenceScope } from './productPrimitives';
import { RadarReceiptLifecycle } from './radarDesignSystem';
import { requestJudgment } from './judgmentCheckClient';
import './spendTerminal.css';

const labels = { proceed: 'Proceed under policy', test_spend_first: 'Test spend first', do_not_spend: 'Do not spend', insufficient_evidence: 'Insufficient evidence' };
export function SpendTerminalPage() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [catalogRoute, setCatalogRoute] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [form, setForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { agent_id: 'radar-browser', intent: params.get('intent') ?? 'buy_market_research', budget: '25', risk_tolerance: 'low' as 'low' | 'medium' | 'high' | 'critical', preferred_settlement: 'stablecoin', required_confidence: '80', subject_id: params.get('subject') ?? '' };
  });
  const [result, setResult] = useState<{ judgment: CanonicalJudgmentResponse; quoted: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const attempt = useRef<{ hash: string; key: string } | null>(null);
  useEffect(() => { document.title = 'Spend Check | Infopunks Radar'; return () => { const prior = controller.current; controller.current = null; prior?.abort(); }; }, []);
  useEffect(() => {
    let active = true; setCatalogRoute(null);
    if (form.subject_id) void fetch(toApiUrl(getApiBaseUrl(), '/v1/routes'), { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(body => {
      if (active && Array.isArray(body?.data?.routes) && body.data.routes.some((route: { route_id: string }) => route.route_id === form.subject_id)) setCatalogRoute(form.subject_id);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [form.subject_id]);
  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    const input = { ...form, budget: Number(form.budget), required_confidence: Number(form.required_confidence), subject_id: form.subject_id || undefined };
    const errors: Record<string, string> = {};
    if (!apiKey.trim()) errors['spend-tenant-key'] = 'Enter your operator-issued tenant access key before running a check.';
    // Current native constraint metadata owns required/range/step feedback. The server remains the contract and authorization authority.
    if (!Number.isFinite(input.budget)) errors.budget = 'Enter a finite budget of zero or more.';
    if (!Number.isFinite(input.required_confidence)) errors.required_confidence = 'Enter finite confidence from 0 to 100.';
    if (!form.budget.trim()) errors.budget = 'Enter a budget of zero or more.';
    if (!form.required_confidence.trim()) errors.required_confidence = 'Enter required confidence from 0 to 100.';
    for (const field of Array.from((event.currentTarget as HTMLFormElement).elements)) {
      if (field instanceof HTMLInputElement && field.id && !field.validity.valid) errors[field.id] ??= field.validity.rangeUnderflow ? 'Enter a value of zero or more.' : field.validity.rangeOverflow ? 'Enter a value no greater than 100.' : field.validity.stepMismatch ? 'Use the indicated numeric increment.' : 'Enter a valid value for this field.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setError(null); setResult(null); Array.from((event.currentTarget as HTMLFormElement).elements).find((field): field is HTMLInputElement => field instanceof HTMLInputElement && Boolean(errors[field.id]))?.focus(); return; }
    const hash = JSON.stringify(input);
    if (attempt.current?.hash !== hash) attempt.current = { hash, key: crypto.randomUUID() };
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 12_000);
    setLoading(true); setError(null); setResult(null);
    try { setResult(await requestJudgment(input, attempt.current!.key, abort.signal, apiKey)); }
    catch (err) { if (controller.current === abort) {
      const message = abort.signal.aborted ? 'The check timed out. Retry the same check safely; your wallet has not been used.' : err instanceof Error ? err.message : 'Check unavailable. Try again.';
      if (message.startsWith('Enter a valid tenant access key')) { setFieldErrors({ 'spend-tenant-key': 'This key could not authorize the check. Ask your operator for a valid key for this tenant and agent.' }); document.getElementById('spend-tenant-key')?.focus(); }
      else setError(message);
    } }
    finally { clearTimeout(timeout); if (controller.current === abort) { controller.current = null; setLoading(false); } }
  }
  useEffect(() => { if (!loading && fieldErrors['spend-tenant-key']) document.getElementById('spend-tenant-key')?.focus(); }, [loading, fieldErrors]);
  const judgment = result?.judgment;
  return <div className="spend-check">
    <main id="spend-content" tabIndex={-1}>
      <section className="spend-intro"><p className="spend-kicker">Solana Radar · Pre-Spend Intelligence</p><h1>Should this agent spend?</h1><p>Describe the intent. Inspect the evidence-bound decision before committing funds.</p><EvidenceScope kind="service" /></section>
      <div className="spend-grid">
        <form noValidate onSubmit={check} onChange={() => { setResult(null); setError(null); setFieldErrors({}); }} aria-label="Spend check" aria-busy={loading}>
          <h2>Run a Check</h2>
          <fieldset disabled={loading}>
          <label>Agent identity<input id="agent_id" aria-invalid={Boolean(fieldErrors.agent_id)} aria-describedby={fieldErrors.agent_id ? 'agent_id-error' : undefined} value={form.agent_id} required maxLength={128} onChange={e => setForm({ ...form, agent_id: e.target.value })} /><FieldFeedback id="agent_id-error" message={fieldErrors.agent_id} /></label>
          <TenantKeyField id="spend-tenant-key" value={apiKey} onChange={setApiKey} error={fieldErrors['spend-tenant-key']} lifetime="this tab's" />
          <label>Intent<input id="intent" aria-invalid={Boolean(fieldErrors.intent)} aria-describedby={fieldErrors.intent ? 'intent-error' : undefined} value={form.intent} required maxLength={256} onChange={e => setForm({ ...form, intent: e.target.value })} /><FieldFeedback id="intent-error" message={fieldErrors.intent} /></label>
          <label>Subject or route identifier <small>Optional · preserved in deep links</small><input id="subject_id" aria-invalid={Boolean(fieldErrors.subject_id)} aria-describedby={fieldErrors.subject_id ? 'subject_id-error' : undefined} value={form.subject_id} maxLength={256} onChange={e => setForm({ ...form, subject_id: e.target.value })} /><FieldFeedback id="subject_id-error" message={fieldErrors.subject_id} /></label>
          <div className="spend-form-pair"><label>Budget<input type="number" min="0" step="0.01" required id="budget" aria-invalid={Boolean(fieldErrors.budget)} aria-describedby={fieldErrors.budget ? 'budget-error' : undefined} value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /><FieldFeedback id="budget-error" message={fieldErrors.budget} /></label><label>Risk tolerance<select value={form.risk_tolerance} onChange={e => setForm({ ...form, risk_tolerance: e.target.value as typeof form.risk_tolerance })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div>
          <label>Service payment preference<input id="preferred_settlement" aria-invalid={Boolean(fieldErrors.preferred_settlement)} aria-describedby={fieldErrors.preferred_settlement ? 'preferred_settlement-error' : undefined} value={form.preferred_settlement} required maxLength={64} onChange={e => setForm({ ...form, preferred_settlement: e.target.value })} /><small>This is the service method, independent of the Judgment fee rail. Native Solana fee settlement is unavailable.</small><FieldFeedback id="preferred_settlement-error" message={fieldErrors.preferred_settlement} /></label>
          <label>Required confidence<input type="number" min="0" max="100" required id="required_confidence" aria-invalid={Boolean(fieldErrors.required_confidence)} aria-describedby={fieldErrors.required_confidence ? 'required_confidence-error' : undefined} value={form.required_confidence} onChange={e => setForm({ ...form, required_confidence: e.target.value })} /><FieldFeedback id="required_confidence-error" message={fieldErrors.required_confidence} /></label>
          <button disabled={loading} type="submit">{loading ? 'Checking evidence…' : error ? 'Retry check' : 'Run a Check'}<span aria-hidden="true">↗</span></button>
          </fieldset>
          <p className="spend-form-note">This check cannot sign, execute, or automatically pay.</p>
          {error && <p className="spend-error" role="alert">{error}</p>}
        </form>
        <section className="spend-result" aria-labelledby="spend-result-title" aria-live="polite" aria-busy={loading}>
          <p className="spend-kicker">Canonical Judgment</p>
          <h2 id="spend-result-title">{judgment ? labels[judgment.decision] : loading ? 'Inspecting evidence…' : 'Evidence before action.'}</h2>
          {!judgment && <div className="spend-empty"><span aria-hidden="true">◎</span><p>A check returns one of four decisions. Missing, stale, or unqualified evidence remains visible.</p><p>Insufficient evidence is free. No paid canonical receipt is issued.</p></div>}
          {judgment && <>
            <p className={`spend-verdict verdict-${judgment.decision}`}>{result.quoted ? 'Quoted assessment · payment required for issuance' : judgment.receipt ? 'Canonical receipt issued' : 'Free assessment · no canonical receipt'}</p>
            <p className="spend-no-execution">Execution: not authorized. Outcome: not verified.</p>
            <ul className="spend-reasons">{judgment.reasons.map((reason, i) => <li key={i}>{reason.replaceAll('_', ' ')}</li>)}</ul>
            <dl><div><dt>Confidence</dt><dd>{judgment.confidence}/100</dd></div><div><dt>Judgment fee</dt><dd>{judgment.cost.amount} {judgment.cost.asset}</dd></div><div><dt>Evidence accepted</dt><dd>{judgment.cited_observations.length}</dd></div><div><dt>Receipt</dt><dd>{judgment.receipt?.judgment_id ?? 'Not issued'}</dd></div><div><dt>Expiry</dt><dd>{judgment.decision === 'insufficient_evidence' ? 'No actionable validity window' : judgment.valid_until}</dd></div></dl>
            {result.quoted && <p className="spend-form-note">No payment was submitted. An authorized integration must complete the payment boundary before a canonical receipt exists.</p>}
            <RadarReceiptLifecycle records={{
              observation: { state: judgment.cited_observations.length ? 'recorded' : 'missing', detail: `${judgment.cited_observations.length} cited observations; inspect provenance separately.` },
              judgment: { state: judgment.receipt ? 'judgment' : 'missing', detail: judgment.receipt ? judgment.decision : result.quoted ? 'Quote only; no canonical receipt issued.' : 'Free assessment; no canonical receipt issued.' },
              execution: { state: 'missing', detail: 'No separately authorized execution record supplied.' },
              evaluation: { state: 'missing', detail: 'No independently verified outcome supplied.' }
            }} />
            <details><summary>Inspect the canonical response</summary><pre>{JSON.stringify(judgment, null, 2)}</pre></details>
            {judgment.receipt && <a className="spend-next" href={`/proof/judgment/${encodeURIComponent(judgment.judgment_id)}`}>Inspect authenticated Judgment ↗</a>}
            <a className="spend-next" href={catalogRoute ? `/routes/${encodeURIComponent(catalogRoute)}` : form.subject_id ? `/routes?subject=${encodeURIComponent(form.subject_id)}` : '/routes'}>Inspect route evidence ↗</a>
          </>}
        </section>
      </div>
    </main>
  </div>;
}
