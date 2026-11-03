import React from 'react';
import { RadarSectionHeader, RadarReceiptLifecycle } from './radarDesignSystem';
import './economicOsOverviewPage.css';

const ECONOMIES = [
  {
    index: '01',
    title: 'Solana Radar',
    question: 'Should this agent spend?',
    detail: 'Inspect service routes, providers, payment risk and evidence before funds move.',
    scope: 'Advisory checks · execution separately authorized',
    href: '/solana',
    label: 'Open Solana Radar'
  },
  {
    index: '02',
    title: 'Robinhood Chain',
    question: 'Does this market deserve trust?',
    detail: 'Inspect contracts, liquidity, counterparties and proof through read-only market intelligence.',
    scope: 'Read-only inspection · trading policy unqualified',
    href: '/rh-chain-signal-desk',
    label: 'Open Robinhood Chain'
  }
];

export function EconomicOsOverviewPage() {
  return <main className="economic-os-overview">
    <section className="economic-os-intro terminal-panel" aria-labelledby="economic-os-title">
      <div>
        <p className="economic-os-kicker">[ 01 ] ONE RADAR. TWO ECONOMIES.</p>
        <h1 id="economic-os-title">One Standard of Proof.</h1>
        <p className="economic-os-lede">Intelligence before the wallet acts.</p>
        <p>Solana leads with service spending intelligence. Robinhood Chain leads with read-only market inspection. Both use the same trust principles and receipt authority.</p>
        <p>Judgment is advisory. It does not execute or pay. Separate authorization is required for execution.</p>
        <a className="economic-os-link" href="/developers">Integration documentation <span aria-hidden="true">→</span></a>
      </div>
      <div className="economic-os-request">
        <p>POST /v1/pre-spend/check · illustrative request</p>
        <pre role="region" tabIndex={0} aria-label="Illustrative advisory request; scroll horizontally to inspect the full request"><code>{`{
  "agent_id": "your-agent",
  "intent": "buy_market_research",
  "budget": 25,
  "risk_tolerance": "low",
  "preferred_settlement": "stablecoin",
  "required_confidence": 80
}`}</code></pre>
        <small>Illustrative advisory request. Inspect the API contract for required fields. This request does not execute or pay.</small>
      </div>
    </section>
    <section className="economic-os-economies" aria-label="Economy intelligence surfaces">
      {ECONOMIES.map(economy => <article className="terminal-panel economic-os-card" key={economy.index}>
        <p className="economic-os-kicker">[ {economy.index} ] INTELLIGENCE SURFACE</p>
        <h2>{economy.title}</h2><h3>{economy.question}</h3>
        <p>{economy.detail}</p><p className="economic-os-scope">{economy.scope}</p>
        <a className="economic-os-link" href={economy.href}>{economy.label} <span aria-hidden="true">→</span></a>
      </article>)}
    </section>
    <section className="terminal-panel economic-os-protocol">
      <div className="economic-os-protocol-heading"><RadarSectionHeader index="02" title="ONE JUDGMENT PROTOCOL" subtitle="FROM EVIDENCE TO ACCOUNTABLE ACTION" level={2} /><span>ONE CANONICAL RECEIPT ARCHITECTURE.<br/>DIFFERENT EVIDENCE ADAPTERS. SAME STANDARD.</span></div>
      <RadarReceiptLifecycle reference />
      <p>Execution and Evaluation receipts appear only when their proof exists.</p>
    </section>
    <nav className="economic-os-related" aria-label="Related Radar intelligence">
      <a href="/narratives/attention-market-watch">Attention Market Watch</a><a href="/graph">Signal Graph</a><a href="/loops">LoopLab</a><a href="/receipts">Receipts</a><a href="/claim">Claims</a><a href="/routes">Routes</a><a href="/providers">Providers</a><a href="/spend-terminal">Pre-Spend Intelligence</a>
    </nav>
  </main>;
}
