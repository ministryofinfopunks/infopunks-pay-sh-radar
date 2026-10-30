import { useEffect, useRef, useState } from 'react';
import { ObservationReceiptSchema, JudgmentReceiptSchema, ExecutionReceiptSchema, EvaluationReceiptSchema } from '../schemas/receipts';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { RadarAsyncState, RadarReceiptLifecycle, RadarStatus, type RadarEvidenceState } from './radarDesignSystem';
const schemas = { observation: ObservationReceiptSchema, judgment: JudgmentReceiptSchema, execution: ExecutionReceiptSchema, evaluation: EvaluationReceiptSchema };
type Kind = keyof typeof schemas;
export default function CanonicalReceiptPage({ kind, id }: { kind: Kind; id: string }) {
  const [key, setKey] = useState('');
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function clear() { setRecord(null); setVerification(null); setError(null); }
  async function inspect(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const abort = new AbortController(); controller.current = abort;
    clear(); setBusy(true);
    const timeout = setTimeout(() => abort.abort(), 12_000);
    try {
      const headers = { Accept: 'application/json', Authorization: `Bearer ${key.trim()}` };
      const endpoint = `/v1/receipt-spine/${kind}/${encodeURIComponent(id)}`;
      const response = await fetch(toApiUrl(getApiBaseUrl(), endpoint), { headers, cache: 'no-store', redirect: 'error', signal: abort.signal });
      if (!response.ok) throw new Error(response.status === 401 ? 'A valid tenant identity is required.' : response.status === 404 || response.status === 403 ? 'Receipt unavailable for this authenticated identity.' : 'Receipt service unavailable. Retry safely.');
      const body = await response.json(); const parsed = schemas[kind].safeParse(body.data);
      if (!parsed.success) throw new Error('Receipt contract validation failed. No proof is established.');
      let proof: Record<string, unknown> | null = null;
      if (kind === 'judgment') {
        const checked = await fetch(toApiUrl(getApiBaseUrl(), endpoint + '/verify'), { headers, cache: 'no-store', redirect: 'error', signal: abort.signal });
        if (checked.ok) proof = (await checked.json()).data;
      }
      setRecord(parsed.data as unknown as Record<string, unknown>); setVerification(proof);
    } catch (err) { setError(abort.signal.aborted ? 'Inspection timed out. No new action was authorized.' : err instanceof Error ? err.message : 'Receipt service unavailable.'); }
    finally { clearTimeout(timeout); controller.current = null; setBusy(false); }
  }
  const verified = verification?.issuer_signature_valid === true && verification?.ancestry_valid === true;
  const state: RadarEvidenceState = !record ? 'missing' : kind === 'judgment' ? verified ? 'verified' : 'recorded' : kind === 'execution' && record.status === 'pending' ? 'pending' : 'recorded';
  const detail = record ? String(record.status ?? record.outcome ?? record.decision ?? 'Source-bound record') : 'No authenticated record loaded.';
  return <main className="shell canonical-receipt-page">
    <h1>Inspect {kind} evidence.</h1>
    <p>Private provenance. Authenticated ownership. Each stage is inspected independently.</p>
    <form className="panel" onSubmit={inspect} aria-busy={busy} aria-label="Authenticated receipt inspection">
      <p><strong>{id}</strong></p>
      <label>Tenant access key<input aria-label="Tenant access key" type="password" autoComplete="off" value={key} disabled={busy} onChange={event => { setKey(event.target.value); clear(); }} /></label>
      <p className="panel-caption">Your operator-issued key stays in this page's memory. Inspection cannot pay, sign, execute, or change reputation.</p>
      <button className="execute" type="submit" disabled={busy || !key.trim()}>{busy ? 'Inspecting receipt…' : error ? 'Retry inspection' : 'Inspect receipt'}</button>
    </form>
    {error && <RadarAsyncState kind="error" title={error} />}
    {busy && <RadarAsyncState kind="loading" title="Reading authenticated provenance…" />}
    {!busy && <section className="panel" aria-label="Receipt evidence" aria-live="polite">
      <RadarStatus state={state} detail={detail} />
      {record && <>
        {kind === 'judgment' && <p>{verified ? 'Issuer signature and ancestry verified.' : 'Issuer verification unavailable or not established.'} Execution authorization remains separate. {verification?.within_validity_window === false ? 'This Judgment is outside its validity window.' : ''}</p>}
        <RadarReceiptLifecycle records={{ [kind]: { state, detail, recordId: id } }} />
        <details><summary>Inspect source receipt</summary><pre>{JSON.stringify({ receipt: record, verification }, null, 2)}</pre></details>
      </>}
    </section>}
  </main>;
}
