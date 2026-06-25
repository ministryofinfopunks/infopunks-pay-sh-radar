import React from 'react';

export type SignalGraphContextNode = {
  id: string;
  label: string;
  cluster_id: string;
  proof_state: string;
  confidence_score: number;
  velocity_score: number;
};

function titleCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function proofStateLabel(value: string) {
  return titleCase(value);
}

export function SignalGraphContextPanel({ node }: { node: SignalGraphContextNode }) {
  return <section className="panel signal-graph-context-panel" aria-label="Signal Graph context">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Signal Graph context</p>
        <h2>{node.label}</h2>
      </div>
      <a className="execute compact secondary" href={`/graph?node=${encodeURIComponent(node.id)}`}>View in Signal Graph</a>
    </div>
    <div className="builder-detail-grid signal-graph-context-grid">
      <article><span>proof state</span><strong>{proofStateLabel(node.proof_state)}</strong></article>
      <article><span>cluster</span><strong>{titleCase(node.cluster_id)}</strong></article>
      <article><span>confidence score</span><strong>{node.confidence_score}</strong></article>
      <article><span>velocity score</span><strong>{node.velocity_score}</strong></article>
    </div>
  </section>;
}
