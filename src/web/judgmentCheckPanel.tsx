import React, { useMemo, useRef, useState } from 'react';
import { createInfopunksClient, InfopunksJudgmentError, type CanonicalJudgmentResponse } from '../sdk';
import { getApiBaseUrl } from './apiBaseUrl';
import './judgmentCheck.css';
export function JudgmentCheckPanel() {
  const [apiKey,setApiKey] = useState('');
  const params = new URLSearchParams(window.location.search);
  const [intent,setIntent] = useState(params.get('intent') ?? 'buy market research');
  const [subject,setSubject] = useState(params.get('subject') ? 'market:'+params.get('subject') : 'route:route_pay_sh_market_research_03');
  const [budget,setBudget] = useState('0.20');
  const [risk,setRisk] = useState<'low'|'medium'|'high'|'critical'>('low');
  const [result,setResult] = useState<CanonicalJudgmentResponse|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [proof,setProof] = useState<unknown>(null);
  const [recovery,setRecovery] = useState<string|null>(null);
  const controller = useRef<AbortController|null>(null);
  const baseUrl = getApiBaseUrl() || window.location.origin;
  const client = useMemo(() => createInfopunksClient({ baseUrl,apiKey,onAssessment:setResult }),[baseUrl,apiKey]);
  async function check(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null); setResult(null); setProof(null); setRecovery(null);
    controller.current = new AbortController();
    try { await client.judge({ intent,subject,budget:Number(budget),risk },{ signal:controller.current.signal }); }
    catch (e) {
      const known = e instanceof InfopunksJudgmentError;
      setError(known && e.state === 'PAYMENT_DECLINED' ? 'A paid Judgment requires explicit payment authorization. No payment was submitted.' : known ? e.nextAction : 'The service is unavailable. Your request was not approved.');
      if (known && e.state === 'PAYMENT_PENDING_RECONCILIATION') setRecovery(e.sessionId);
    } finally { setBusy(false); }
  }
  async function inspect(id: string) {
    setError(null);
    try {
      const response = await fetch(baseUrl+'/v1/receipt-spine/observation/'+encodeURIComponent(id),{ headers:{ authorization:'Bearer '+apiKey },redirect:'error' });
      if (!response.ok) throw new Error(); setProof((await response.json()).data);
    } catch { setError('Supporting proof is unavailable for this authenticated session.'); }
  }
  async function resume() {
    if (!recovery || busy) return; setBusy(true);
    try { await client.resume(recovery); setRecovery(null); setError(null); }
    catch { setError('Settlement still requires independent confirmation. Do not submit another payment.'); }
    finally { setBusy(false); }
  }
  const state = !result ? 'Awaiting your check' : result.receipt ? 'Paid Judgment' : result.payment_required ? 'Payment required · Judgment not issued' : 'Free assessment · insufficient evidence';
  return <>
    <section className="panel judgment-hero"><p className="eyebrow">Pre-spend intelligence</p><h1>Check before you spend.</h1><p>One justified decision. Inspect the evidence before taking action.</p></section>
    <section className="judgment-check-grid">
      <form className="panel judgment-form" onSubmit={check} aria-label="Check a spend">
        <label>Intent<input aria-label="Intent" required value={intent} onChange={e=>setIntent(e.target.value)} /></label>
        <label>Subject or route<input aria-label="Subject or route" required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="route:route-id" /></label>
        <label>Budget<input aria-label="Budget" type="number" min="0" step="0.01" required value={budget} onChange={e=>setBudget(e.target.value)} /></label>
        <label>Risk preference<select aria-label="Risk preference" value={risk} onChange={e=>setRisk(e.target.value as typeof risk)}>{['low','medium','high','critical'].map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Tenant access key<input aria-label="Tenant access key" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} /></label>
        <p className="panel-caption">Use an operator-issued credential. It stays in this tab's memory. Checking does not authorize payment or execute an action.</p>
        <button className="execute compact judgment-check-button" type="submit" disabled={busy||!apiKey}>{busy?'Checking…':'Check'}</button>
        {busy && <button type="button" onClick={()=>controller.current?.abort()}>Cancel</button>}
      </form>
      <section className="panel judgment-answer" aria-label="Judgment result" aria-live="polite" aria-busy={busy}>
        <p className="section-kicker">{state}</p>
        <h2>{result ? result.decision.replaceAll('_',' ') : 'Should this agent spend?'}</h2>
        {!result && <p>Enter the intent, route and budget, then Check. A result requires qualified evidence.</p>}
        {result && <>
          <dl><div><dt>Evidence status</dt><dd>{result.decision==='insufficient_evidence'?'Missing, stale or unqualified':`${result.cited_observations.length} scoped observations`}</dd></div><div><dt>Judgment</dt><dd>{result.decision.replaceAll('_',' ')}</dd></div><div><dt>Judgment fee</dt><dd>{result.cost.amount} {result.cost.asset}</dd></div></dl>
          <h3>Why</h3><ul>{result.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
          <h3>What next</h3><p>{result.decision==='insufficient_evidence'?'Collect fresh, verified evidence and request a new assessment.':result.payment_required&&!result.receipt?'Review the quoted fee and explicitly authorize payment through your agent SDK.':result.decision==='do_not_spend'?'Choose another route.':'Inspect the receipt and apply your execution policy.'}</p>
          <h3>Supporting proof</h3>{result.cited_observations.length ? <ul>{result.cited_observations.map(id=><li key={id}><button type="button" onClick={()=>void inspect(id)}>{id}</button></li>)}</ul> : <p>No qualifying observation is attached. No paid receipt was issued.</p>}
          <p className="judgment-authority-note">Executed action: none. Independently verified outcome: none. A Judgment records an assessment.</p>
          <details><summary>Technical inspection</summary><pre>{JSON.stringify({ judgment:result, supporting_proof:proof },null,2)}</pre></details>
        </>}
        {error && <p role="alert">{error}</p>}
        {recovery && <button type="button" onClick={()=>void resume()} disabled={busy}>Check payment status</button>}
      </section>
    </section>
  </>;
}
