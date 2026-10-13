import React, { useEffect, useState } from 'react';
import { startRhChainMarketRevalidation } from './rhChainMarketRevalidation';
import type { RhChainMarketMoversPayload } from '../services/rhChainMarketMoversService';
import { formatUtcCompact } from '../shared/timestamps';

export function RhChainObservedMovers({ projection, compact = false, now }: { projection: RhChainMarketMoversPayload; compact?: boolean; now?: Date }) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => startRhChainMarketRevalidation(() => setClock(new Date())), []);
  const observed = projection.assets.filter((row) => { const age = (now ?? clock).getTime() - Date.parse(row.observed_at); return row.freshness.state === 'fresh' && age >= -60000 && age <= projection.policy.freshness_ms; });
  const assets = compact ? observed.slice(0, 3) : observed;
  return <section id="observed-movers" className="rh-v2-section rh-v2-movers" aria-label="Observed 4663 Movers">
    <header className="rh-chain-section-head"><div><p className="section-kicker">4663 movers · measured observations</p><h2>What is moving</h2>
      <p>Stored market evidence, ranked by observed significance. Each asset keeps its exact contract, pool, source, and coverage.</p></div>
      <a href={projection.canonical_path}>Movers JSON</a></header>
    {projection.storage_status === 'unavailable' && <p role="status">Observation storage is unavailable. Current rankings cannot be established.</p>}
    <div className="rh-v2-mover-grid">{assets.map((asset) => <article className="rh-v2-mover-card" key={`${asset.token_contract}:${asset.pair_address}`}>
      <header><span>Rank {asset.rank} · {asset.lane.replaceAll('_', ' ')}</span><span>{asset.freshness.state} · {asset.evidence_state.replaceAll('_', ' ').toLowerCase()}</span></header>
      <h3>{asset.ticker}</h3><p>{asset.name}</p><p>Observed significance: {asset.significance_score}/100</p>
      <dl><dt>Price change</dt><dd>{asset.metrics.price_delta_pct}%</dd><dt>Liquidity change</dt><dd>{asset.metrics.liquidity_delta_pct}%</dd>
        <dt>Rolling 1h volume change</dt><dd>{asset.metrics.volume_delta_pct}%</dd><dt>Rolling 24h transaction change</dt><dd>{asset.metrics.transactions_delta_pct}%</dd></dl>
      <p>{asset.coverage.sample_count} observations · {Math.round(asset.coverage.elapsed_ms / 60000)} minute window · complete required coverage</p>
      <p><time dateTime={asset.observed_at}>{formatUtcCompact(asset.observed_at)}</time> · {asset.freshness.time_basis.replaceAll('_', ' ')}</p>
      <p className="panel-caption" style={{ overflowWrap: 'anywhere' }}>Contract {asset.token_contract}<br />Pool {asset.pair_address}</p>
      <p><a href={asset.source.source_url ?? asset.history_href}>Observation source</a> · <a href={asset.history_href}>Stored history</a></p>
      <a className="execute compact secondary" href={asset.investigation_href}>Investigate observation</a>
    </article>)}</div>
    {!assets.length && <p className="rh-v2-empty">No current mover meets the evidence and coverage requirements. Historical memory is available separately.</p>}
    {projection.research.length > 0 && <details><summary>{projection.research.length} pool records require research</summary>
      <ul>{projection.research.map((item) => <li key={`${item.token_contract}:${item.pair_address}`}><a href={`/rh-chain-signal-desk/tokens/${item.token_contract}`}>{item.token_contract}</a> · {item.freshness.state} · {item.reasons.map((reason) => reason.replaceAll('_', ' ').toLowerCase()).join('; ')}</li>)}</ul>
    </details>}
    <p className="panel-caption">{projection.disclaimer}</p>
  </section>;
}
