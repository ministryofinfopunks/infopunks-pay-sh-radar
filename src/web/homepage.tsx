import { useEffect, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { ECONOMY_ENTRIES } from './radarNavigationCatalog';
import { RadarReceiptLifecycle } from './radarDesignSystem';
import { TerminalIcon } from './terminalIcon';

const API_BASE_URL = getApiBaseUrl();

function mark(name: string) {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') performance.mark(name);
}

const evidenceRequirements = [
  { label: 'Provider verification', state: 'NOT CHECKED', detail: 'A reviewed identity and evidence provenance must support the provider. No provider has been checked in this preview.' },
  { label: 'Route history', state: 'NOT CHECKED', detail: 'Fresh, accepted execution outcomes and relevant independent evaluations inform the check. No route history is loaded here.' },
  { label: 'Payment risk analysis', state: 'NOT CHECKED', detail: 'Price, budget and the service payment method must satisfy policy. The Judgment fee rail is independent of the subject network.' },
  { label: 'Policy match (your rules)', state: 'REQUIRED', detail: 'A supported policy and its frozen version must match the requested action. Market inspection does not authorize a trade.' }
];

function JudgmentPreview() {
  return <aside className="radar-judgment-panel terminal-panel" id="judgment-preview" aria-labelledby="judgment-preview-title" tabIndex={-1}>
    <div className="terminal-panel-heading"><h2 id="judgment-preview-title"><TerminalIcon name="judgment" /> JUDGMENT PREVIEW</h2><span className="terminal-state">NO CHECK RUN</span></div>
    <div className="radar-preview-subject"><span className="terminal-symbol"><TerminalIcon name="solana" /></span><div><h3>Your next spend route</h3><p>Service / provider / payment endpoint</p><p>Subject network and fee rail are independent.</p></div></div>
    <div className="radar-preview-outcome"><div><p className="terminal-field-label">Outcome</p><strong><TerminalIcon name="judgment" /> AWAITING EVIDENCE</strong></div><div className="radar-preview-confidence"><p className="terminal-field-label">Confidence</p><strong aria-label="Confidence not assessed">—</strong></div></div>
    <p className="radar-preview-description">A policy-bound decision appears after a check. Missing or stale evidence cannot become permission to spend.</p>
    <h3 className="radar-evidence-title">Evidence summary</h3>
    <div className="radar-evidence-list">{evidenceRequirements.map(row => <details key={row.label}><summary><TerminalIcon name="unknown" /><span>{row.label}</span><span className="radar-evidence-state">{row.state}</span><span className="radar-evidence-view">View <span aria-hidden="true">↗</span></span></summary><p>{row.detail}</p></details>)}</div>
    <div className="radar-preview-receipt"><TerminalIcon name="receipt" /><div><strong>Receipt</strong><p>Not issued. No check or execution has occurred.</p></div><span className="terminal-state">NOT ISSUED</span></div>
    <p className="radar-preview-boundary">Judgment is advisory. Execution requires separate authorization.</p>
  </aside>;
}

export function UniversalHomepage() {
  const [status, setStatus] = useState<'loading' | 'live' | 'degraded'>('loading');
  useEffect(() => {
    mark('radar_homepage_rendered');
    mark('radar_live_status_started');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    void fetch(toApiUrl(API_BASE_URL, '/v1/pulse'), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`pulse_status_${response.status}`);
        setStatus('live');
        mark('radar_live_status_finished');
      })
      .catch(() => {
        setStatus('degraded');
        mark('radar_live_status_failed');
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);
  return <div className="radar-homepage">
    <a className="radar-home-skip" href="#radar-home-content">Skip to intelligence thesis</a>
    <div className="radar-home-frame">
      <nav className="radar-home-quick-nav" aria-label="Primary navigation"><a href="/solana">Solana</a><a href="/4663">//4663</a><a href="/radar/cards">Pre-Spend Intelligence</a></nav>
      <main className="radar-home-shell" id="radar-home-content" tabIndex={-1}>
        <section className="radar-home-hero" aria-labelledby="radar-home-title">
          <div className="radar-home-manifesto">
            <p className="radar-home-eyebrow"><span aria-hidden="true">[ 01 ]</span> INFOPUNKS RADAR / TWO ECONOMIES</p>
            <h1 id="radar-home-title"><span>Before your agent</span> <span>spends, check</span> <span>the evidence.</span></h1>
            <p className="radar-home-lede">Radar evaluates routes, providers, and payment risk before funds move. Evidence-bound decisions. Inspectable reasoning. Accountable receipts.</p>
            <div className="radar-home-actions"><a href="/radar/cards">Open Pre-Spend Intelligence <TerminalIcon name="arrow" /></a><a href="/spend-terminal">Open Spend Terminal <TerminalIcon name="arrow" /></a><a href="#radar-home-proof">See the proof</a></div>
            <p role="status" aria-live="polite">{status === 'loading' ? 'Live status connecting' : status === 'live' ? 'Live intelligence available' : 'Live status delayed — browse remains available'}</p>
          </div>
          <div className="radar-signal-portrait" aria-hidden="true"><picture><source media="(min-width: 1024px)" srcSet="/artwork/signal-punk.webp" /><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="533" height="800" fetchPriority="high" /></picture><span className="portrait-note">INTELLIGENCE<br />BEFORE<br />THE WALLET<br />ACTS.</span><span className="portrait-note portrait-note-bottom">VERIFIABLE<br />EVIDENCE.<br />ACCOUNTABLE<br />DECISIONS.</span></div>
          <JudgmentPreview />
        </section>
        <section className="radar-home-proof terminal-panel" id="radar-home-proof" aria-labelledby="radar-home-proof-title">
          <div className="radar-home-section-heading"><div><p className="radar-home-eyebrow">[ 02 ]</p><h2 id="radar-home-proof-title">One Judgment Protocol</h2><p>From evidence to accountable action.</p></div><div className="radar-protocol-note"><span>ONE CANONICAL RECEIPT ARCHITECTURE.<br />DIFFERENT EVIDENCE ADAPTERS. SAME STANDARD.</span><a href="/developers">Learn more <TerminalIcon name="arrow" /></a></div></div>
          <RadarReceiptLifecycle reference />
          <p className="radar-protocol-boundary">Execution and Evaluation receipts appear only when their proof exists.</p>
        </section>
        <section className="radar-home-entry" id="economies" aria-label="Two economies and one standard of proof">
          <div className="radar-home-cards">{ECONOMY_ENTRIES.map((entry, index) => <article className={`${entry.id} terminal-panel`} key={entry.id}>
            <p className="radar-home-eyebrow">[ {String(index + 3).padStart(2, '0')} ] <span>{index === 0 ? 'PRIMARY UTILITY' : 'MARKET INTELLIGENCE'}</span></p>
            <div className="radar-entry-title"><span className="terminal-symbol"><TerminalIcon name={entry.id === 'solana' ? 'solana' : 'rh'} /></span><div><h2>{entry.label}</h2><p>{entry.title}</p></div><a className="radar-entry-arrow" href={entry.href} aria-label={entry.action}><TerminalIcon name="arrow" /></a></div>
            <p className="radar-entry-description">{entry.id === 'solana' ? 'Inspect service routes, providers, payment risk, and evidence before funds move.' : 'Inspect contracts, PLTR markets, liquidity, counterparties, and proof.'}</p>
            <p className="radar-entry-scope">{entry.scope}</p>
            {entry.id === 'solana' ? <a href="/solana">Open Solana Radar</a> : <><a href="/4663">Enter //4663</a><a href="/rh-chain-signal-desk">Signal Desk</a></>}
            <div className="radar-entry-tags" aria-label={`${entry.label} coverage`}>{(entry.id === 'solana' ? ['Routes', 'Providers', 'Payments', 'Risk', 'Evidence'] : ['Contracts', 'Liquidity', 'Counterparties', 'Proof']).map(tag => <span key={tag}>{tag}</span>)}</div>
          </article>)}
          <article className="radar-principles terminal-panel"><p className="radar-home-eyebrow">[ 05 ] PRINCIPLES</p><div className="radar-entry-title"><span className="terminal-symbol"><TerminalIcon name="receipt" /></span><h2>No receipt,<br />no trust.</h2></div><p>Every decision should be inspectable, verifiable, and accountable.</p><a href="/receipts">Inspect receipt evidence <TerminalIcon name="arrow" /></a></article></div>
        </section>
        <section className="radar-home-developers terminal-panel" aria-labelledby="radar-home-developers-title">
          <div><p className="radar-home-eyebrow">[ 06 ] ONE RADAR. TWO ECONOMIES.</p><h2 id="radar-home-developers-title">One Standard of Proof.</h2><p>Intelligence before the wallet acts.</p><p>Solana leads with service spending intelligence. Robinhood Chain leads with read-only market inspection. Both use the same trust principles and receipt authority.</p><p>Pay.sh is a spend rail. Judgment assesses the action under policy. Separately authorized infrastructure handles execution.</p><a href="/developers">Integration documentation <TerminalIcon name="arrow" /></a></div>
          <div><p className="radar-home-api-label">POST /v1/pre-spend/check · illustrative request</p><pre aria-label="Minimal advisory check request"><code>{`{
  "agent_id": "your-agent",
  "intent": "buy_market_research",
  "budget": 25,
  "risk_tolerance": "low",
  "preferred_settlement": "stablecoin",
  "required_confidence": 80
}`}</code></pre><p className="radar-home-api-note">Illustrative advisory request; inspect the API contract for required fields. This request does not execute or pay.</p></div>
        </section>
      </main>
    </div>
  </div>;
}
