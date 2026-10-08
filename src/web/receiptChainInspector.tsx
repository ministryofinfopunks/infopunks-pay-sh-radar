import React, { useEffect, useState } from 'react';
import type { ReceiptChainInspection } from '../services/receiptChainInspector';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

export function ReceiptChainInspector() {
  const [id, setId] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('evaluation') ?? '');
  const [selected, setSelected] = useState(id);
  const [chain, setChain] = useState<ReceiptChainInspection | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setChain(null); setError('');
    fetch(toApiUrl(getApiBaseUrl(), `/v1/receipt-spine/evaluation/${encodeURIComponent(selected)}/chain`), { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Receipt chain unavailable'); return response.json(); })
      .then(response => setChain(response.data))
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [selected]);
  return <section className="panel" aria-label="Canonical receipt chain inspector" style={{ overflowWrap: 'anywhere' }}>
    <p className="eyebrow">Observe → Judge → Execute → Evaluate → Judge again</p><h2>Receipt chain inspector</h2>
    <form onSubmit={event => { event.preventDefault(); setSelected(id.trim()); }}>
      <label htmlFor="evaluation-receipt-id">Evaluation receipt ID</label>{' '}
      <input id="evaluation-receipt-id" value={id} onChange={event => setId(event.target.value)} required maxLength={256} style={{ maxWidth: '100%' }} />{' '}
      <button className="execute compact secondary" type="submit">Inspect chain</button>
    </form>
    <p className="panel-caption">Public evidence. No wallet required. Settlement classification comes from the evidence report; a verified hash alone does not establish live settlement.</p>
    {error && <p role="alert">{error}</p>}
    {selected && !chain && !error && <p role="status">Verifying persisted ancestry…</p>}
    {chain && <><p role="status">{chain.verified ? 'Hashes and parents verified' : 'Verification failed'}</p>
      <ol>{chain.nodes.map(node => <li key={`${node.kind}:${node.id}`}><a href={toApiUrl(getApiBaseUrl(), `/v1/receipt-spine/${node.kind}/${encodeURIComponent(node.id)}`)}>{node.kind}: {node.id}</a>
        <p>Hash: {node.hash_valid ? 'verified' : 'invalid'} · Parents: {node.ancestry_valid ? 'verified' : 'invalid'}</p>
        <code style={{ overflowWrap: 'anywhere' }}>{node.receipt?.receipt_hash ?? 'Missing parent'}</code></li>)}</ol>
      <p>Outcome: {chain.evaluation_outcome} · Policy: {chain.evaluation_policy_version}</p>
      {chain.projection && <><h3>Derived score: {chain.projection.score}</h3><code style={{ overflowWrap: 'anywhere' }}>{chain.projection.projection_hash}</code>
        <p>Contributing evaluations: {chain.projection.contributing_evaluation_ids.join(', ')}</p></>}
      <h3>Judgment comparison</h3><ol>{chain.judgments.map((judgment, index) => <li key={judgment.judgment_id}>
        <a href={toApiUrl(getApiBaseUrl(), `/v1/receipt-spine/judgment/${encodeURIComponent(judgment.judgment_id)}`)}>{index === 0 ? 'First' : 'Subsequent'} judgment</a>: {judgment.decision} · confidence {judgment.confidence} · {judgment.verified ? 'verified' : 'invalid'}
        <p>{judgment.reasons.join(' · ')}</p></li>)}</ol></>}
  </section>;
}
