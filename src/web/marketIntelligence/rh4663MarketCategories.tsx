import React, { useEffect, useState } from 'react';
import type { RhCategoryIntelligence } from '../../services/rhChainCategoryIntelligenceService';
import { startRhChainMarketRevalidation } from '../rhChainMarketRevalidation';

export function Rh4663MarketCategories({ market, unavailable = false }: { market?: RhCategoryIntelligence | null; unavailable?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => startRhChainMarketRevalidation(() => setNow(Date.now())), []);
  if (!market) return <div id="market-categories" className="fd-market-categories"><h3>Market intelligence</h3><p role="status">{unavailable ? 'Stored market observations are unavailable. Open the Signal Desk to investigate.' : 'Reading stored market observations…'}</p><a className="fd-research-link" href="/rh-chain-signal-desk">Signal Desk ↗</a></div>;
  return <section id="market-categories" className="fd-market-categories" aria-labelledby="market-categories-title">
    <h3 id="market-categories-title">One market. Different evidence.</h3>
    <p>Market movements stay visible. Each category needs its own evidence before interpretation.</p>
    {!market.observed_at && market.last_observed_at && <p>Last-known market observation: <time dateTime={market.last_observed_at}>{new Date(market.last_observed_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</time>. Fresh evidence is needed.</p>}
    {market.source_health.category_identity === 'unavailable' && <p role="status">Category identity is unavailable. Unclassified observations remain visible with scores withheld.</p>}
    {market.source_health.category_evidence === 'unavailable' && <p role="status">Some category evidence is unavailable. Missing inputs remain explicit.</p>}
    <div className="fd-category-grid">{market.categories.map(category => {
      const rows = category.findings.filter(f => now - Date.parse(f.observation.observed_at) <= 15 * 60_000 && now - Date.parse(f.observation.freshness.fetched_at ?? '') <= 15 * 60_000);
      return <details key={category.category} className="fd-category" open={category.category === 'stock_tokens'}>
        <summary><strong>{category.label}</strong><span>{rows.length} current observations · {rows.filter(f => f.category_score).length} scored</span></summary>
        {!rows.length && <p>{category.findings.length ? 'Last-known observations have expired. A fresh capture is needed.' : 'No eligible stored observations in this category yet.'}</p>}
        <ul>{rows.slice(0, 3).map(finding => <li key={finding.token_contract}>
          <strong>{finding.ticker || finding.token_contract.slice(0, 10)}</strong><span className="fd-category-contract">{finding.token_contract}</span>
          <p>Observed liquidity change: {finding.observation.metrics.liquidity_delta_pct}% · {finding.observation.coverage.sample_count} samples</p>
          <p>{finding.evidence.state === 'INCOMPLETE' ? `Evidence incomplete: ${finding.evidence.missing_inputs.map(s => s.replaceAll('_', ' ')).join(', ')}.` : 'Required observation inputs present.'}</p>
          <p>{finding.category_score ? `${finding.category_score.value} / 100 observed activity · ${finding.category_score.version}` : 'Category score withheld.'}</p>
          <time dateTime={finding.observation.observed_at}>Observed {new Date(finding.observation.observed_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</time>
          <footer><a className="fd-research-link" href={finding.observation.source.source_url ?? finding.observation.history_href}>Market source ↗</a><a className="fd-research-link" href={finding.evidence_href}>Evidence ↗</a><a className="fd-research-link" href={finding.observation.investigation_href}>Investigate ↗</a></footer>
        </li>)}</ul>
        {rows.length > 3 && <a className="fd-research-link" href="/v1/4663/market/categories">All {rows.length} observations ↗</a>}
        <p className="fd-category-policy">{category.policy.scoring}</p>
      </details>;
    })}</div>
    <p>Scores apply within a category. Observation coverage grants no reviewed judgment or trading authority.</p>
    <a className="fd-research-link" href="/rh-chain-signal-desk/4663-index">All market movers ↗</a>
  </section>;
}
