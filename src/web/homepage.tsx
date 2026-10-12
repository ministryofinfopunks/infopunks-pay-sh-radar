import { useEffect } from 'react';
import { ECONOMY_ENTRIES, PROOF_STAGES } from './productCatalog';
import { ProductWayfinding } from './productPrimitives';

export function UniversalHomepage() {
  useEffect(() => { performance.mark?.('radar_homepage_rendered'); document.title = 'Infopunks Radar — Intelligence before the wallet acts'; }, []);
  return <div className="radar-homepage">
    <a className="radar-home-skip" href="#radar-home-content">Skip to content</a>
    <header className="radar-home-header">
      <a className="radar-home-brand" href="/" aria-label="Infopunks Radar home"><span>Infopunks</span><strong>Radar</strong></a>
      <ProductWayfinding />
    </header>
    <main className="radar-home-shell" id="radar-home-content" tabIndex={-1}>
      <section className="radar-home-hero" aria-labelledby="radar-home-title">
        <div className="radar-home-manifesto">
          <p className="radar-home-eyebrow">INFOPUNKS RADAR</p>
          <h1 id="radar-home-title">One Radar.<br />Two Economies.<br /><span>One Standard of Proof.</span></h1>
          <h2>Intelligence before the wallet acts.</h2>
          <p className="radar-home-lede">Evidence-backed intelligence for agent spending and onchain markets. Inspect the evidence, understand the decision, and verify the proof.</p>
          <div className="radar-home-actions">
            <a href="/spend-terminal">Run a Check <span aria-hidden="true">↗</span></a>
            <a href="#economies">Explore the Radar <span aria-hidden="true">↓</span></a>
          </div>
          <p className="radar-home-availability">Advisory spend checks. Read-only market inspection. Execution requires separate authorization.</p>
        </div>
        <aside className="radar-signal-lens" aria-label="Signal extraction: source, evidence, judgment">
          <div className="radar-lens-rings" aria-hidden="true"><i /><i /><i /><span /></div>
          <p>Most see noise.</p><strong>Infopunks finds signal.</strong>
          <div className="radar-lens-path"><span>Source</span><b aria-hidden="true">→</b><span>Evidence</span><b aria-hidden="true">→</b><span>Judgment</span></div>
          <small>Evidence first. Unknowns visible.</small>
        </aside>
      </section>
      <section className="radar-home-entry" id="economies" aria-labelledby="radar-home-entry-title">
        <div className="radar-home-section-heading"><p>Two economies. One trust system.</p><h2 id="radar-home-entry-title">Before an agent spends,<br />it checks Infopunks.</h2></div>
        <div className="radar-home-cards">{ECONOMY_ENTRIES.map(entry => <article className={entry.id} key={entry.id}>
          <p>{entry.label}</p><h3>{entry.title}</h3><div>{entry.description}</div><small>{entry.scope}</small>
          <a href={entry.href}>{entry.action}<span aria-hidden="true">↗</span></a>
        </article>)}</div>
      </section>
      <section className="radar-home-proof" id="proof" aria-labelledby="radar-home-proof-title">
        <div className="radar-home-section-heading"><p>One standard of proof</p><h2 id="radar-home-proof-title">No receipt, no trust.</h2><span>What was observed. What was accepted. What remains unknown.</span></div>
        <ol className="radar-home-proof-grid">{PROOF_STAGES.map((stage, index) => <li key={stage.label}>
          <span>{String(index + 1).padStart(2, '0')}</span><h3>{stage.label}</h3><strong>{stage.question}</strong><p>{stage.detail}</p>
        </li>)}</ol>
        <div className="radar-home-proof-note"><p>Receipts bind evidence to accountable decisions. A Judgment never signs a transaction. Execution and Evaluation appear only when their proof exists.</p><a href="/receipts">Inspect receipt evidence <span aria-hidden="true">↗</span></a></div>
      </section>
      <section className="radar-home-developers" aria-labelledby="radar-home-developers-title">
        <div><p className="radar-home-eyebrow">For builders and agents</p><h2 id="radar-home-developers-title">One check before action.</h2><p>Pay.sh is a spend rail. Radar is the intelligence and evidence layer. Judgment assesses the action under policy; the authorized rail handles execution.</p><a href="/developers">Integration documentation <span aria-hidden="true">↗</span></a></div>
        <div><p className="radar-home-api-label">POST /v1/pre-spend/check</p><pre aria-label="Minimal advisory check request"><code>{`{
  "agent_id": "your-agent",
  "intent": "buy_market_research",
  "budget": 25,
  "risk_tolerance": "low",
  "preferred_settlement": "stablecoin",
  "required_confidence": 80
}`}</code></pre><small>Insufficient evidence is free and produces no paid canonical Judgment receipt. This request does not execute or pay.</small></div>
      </section>
    </main>
    <footer className="radar-home-footer"><a href="/">Infopunks Radar</a><span>One Radar. Two Economies. One Standard of Proof.</span><a href="/openapi.json">API contract ↗</a></footer>
  </div>;
}
