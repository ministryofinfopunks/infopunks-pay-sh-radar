import { useEffect, useRef, useState } from 'react';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import { ProductHeader, EvidenceScope } from './productPrimitives';
import { requestJudgment } from './judgmentCheckClient';
import './spendTerminal.css';

const labels = { proceed: 'Proceed under policy', test_spend_first: 'Test spend first', do_not_spend: 'Do not spend', insufficient_evidence: 'Insufficient evidence' };
export function SpendTerminalPage() {
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
  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    const input = { ...form, budget: Number(form.budget), required_confidence: Number(form.required_confidence), subject_id: form.subject_id || undefined };
    const hash = JSON.stringify(input);
    if (attempt.current?.hash !== hash) attempt.current = { hash, key: crypto.randomUUID() };
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 12_000);
    setLoading(true); setError(null); setResult(null);
    try { setResult(await requestJudgment(input, attempt.current!.key, abort.signal)); }
    catch (err) { if (controller.current === abort) setError(abort.signal.aborted ? 'The check timed out. Retry the same check safely; your wallet has not been used.' : err instanceof Error ? err.message : 'Check unavailable. Try again.'); }
    finally { clearTimeout(timeout); if (controller.current === abort) { controller.current = null; setLoading(false); } }
  }
  const judgment = result?.judgment;
  return <div className="spend-check">
    <a className="radar-home-skip" href="#spend-content">Skip to check</a>
    <div className="spend-header"><ProductHeader current="/solana" /></div>
    <main id="spend-content" tabIndex={-1}>
      <section className="spend-intro"><p className="spend-kicker">Solana Radar · Pre-Spend Intelligence</p><h1>Should this agent spend?</h1><p>Describe the intent. Inspect the evidence-bound decision before committing funds.</p><EvidenceScope kind="service" /></section>
      <div className="spend-grid">
        <form onSubmit={check} onChange={() => { setResult(null); setError(null); }} aria-label="Spend check" aria-busy={loading}>
          <h2>Run a Check</h2>
          <fieldset disabled={loading}>
          <label>Agent identity<input value={form.agent_id} required maxLength={128} onChange={e => setForm({ ...form, agent_id: e.target.value })} /></label>
          <label>Intent<input value={form.intent} required maxLength={256} onChange={e => setForm({ ...form, intent: e.target.value })} /></label>
          <label>Subject or route identifier <small>Optional · preserved in deep links</small><input value={form.subject_id} maxLength={256} onChange={e => setForm({ ...form, subject_id: e.target.value })} /></label>
          <div className="spend-form-pair"><label>Budget<input type="number" min="0" step="0.01" required value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></label><label>Risk tolerance<select value={form.risk_tolerance} onChange={e => setForm({ ...form, risk_tolerance: e.target.value as typeof form.risk_tolerance })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div>
          <label>Service payment preference<input value={form.preferred_settlement} required maxLength={64} onChange={e => setForm({ ...form, preferred_settlement: e.target.value })} /><small>This is the service method, independent of the Judgment fee rail. Native Solana fee settlement is unavailable.</small></label>
          <label>Required confidence<input type="number" min="0" max="100" required value={form.required_confidence} onChange={e => setForm({ ...form, required_confidence: e.target.value })} /></label>
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
            <details><summary>Inspect the canonical response</summary><pre>{JSON.stringify(judgment, null, 2)}</pre></details>
            <a className="spend-next" href="/routes">Inspect route evidence ↗</a>
          </>}
        </section>
      </div>
      <footer><a href="/receipts">Receipt evidence</a><a href="/developers">Developer contract</a><span>No receipt, no trust.</span></footer>
    </main>
  </div>;
}
