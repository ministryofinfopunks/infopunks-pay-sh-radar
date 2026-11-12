import './developersStatic.css';

const operatingLoop = [
  ['01', 'Observe', 'Collect scoped evidence with source, time, freshness and integrity context.'],
  ['02', 'Judge', 'Apply policy to cited evidence. A receipt records an assessment; it is not execution permission.'],
  ['03', 'Pre-Spend', 'The host checks the judgment before a consequential action and keeps its own authority boundary.'],
  ['04', 'Settle', 'Record the relevant settlement outcome. Assessment billing and the subject operation are separate events.'],
  ['05', 'Execute-proof', 'Verify what the external rail actually did. Radar does not submit the operation.'],
  ['06', 'Evaluate', 'Assess the evidenced outcome under a versioned policy and preserve the receipt ancestry.'],
  ['07', 'Score projection', 'Derive the projection from qualifying evaluations; an observation or judgment alone adds no score.'],
  ['08', 'Observe again', 'New evidence starts another loop. Prior receipts remain historical records.']
] as const;

const receiptStages = [
  { id: 'O', name: 'Observation', detail: 'A scoped record of what was observed, by which source, when it was observed and ingested, and whether its evidence is sufficient, insufficient, stale or disputed.' },
  { id: 'J', name: 'Judgment', detail: 'A policy assessment that cites one or more observation receipts, records its decision and validity window, and may record assessment payment. It does not itself authorize an executor.' },
  { id: 'X', name: 'Execution', detail: 'A record of an externally performed action. Settlement verification is included only when a supported proof profile verifies it; otherwise the receipt makes no such claim. Radar does not submit the operation.' },
  { id: 'E', name: 'Evaluation', detail: 'A terminal assessment of an execution, backed by outcome evidence and a policy. Verified evaluations are the authority for the score projection.' }
] as const;

const architectureLayers = [
  { label: 'Evidence', name: 'Observation adapters', text: 'Provider, route or host evidence is scoped and timestamped. A hash can protect record integrity; it cannot prove that a source was truthful.' },
  { label: 'Decision', name: 'Judgment service', text: 'The service checks cited observations against policy, freshness and confidence requirements. Missing or stale evidence fails closed.' },
  { label: 'Authority', name: 'Host and execution boundary', text: 'A judgment and execution authority are separate. Where the economic engine is enabled, a signed, narrow capability is checked at the executor boundary.' },
  { label: 'Outcome', name: 'Proof and receipt stores', text: 'Proof ingestion verifies supported settlement evidence, then canonical receipts bind the outcome to its judgment. Evaluation and score projection follow later.' }
] as const;

export function DevelopersStaticPage() {
  return <main className="developers-static" id="top">
    <a className="developers-static-skip" href="#developers-content">Skip to architecture guide</a>
    <header className="developers-static-header">
      <a className="developers-static-brand" href="/" aria-label="Infopunks Radar home">
        <span>INFOPUNKS / RADAR</span>
        <strong>Developers</strong>
      </a>
      <nav aria-label="Developers guide navigation">
        <a href="#operating-loop">Operating loop</a>
        <a href="#receipt-spine">Receipts</a>
        <a href="#architecture">Architecture</a>
        <a href="#integration">Integration</a>
      </nav>
    </header>

    <div className="developers-static-body" id="developers-content">
      <section className="developers-static-hero" aria-labelledby="developers-title">
        <p className="developers-static-kicker">Architecture guide <span>·</span> Static front-door edition</p>
        <h1 id="developers-title">Before an agent spends,<br /><em>it checks Infopunks.</em></h1>
        <p className="developers-static-lede">Radar is trust and intelligence infrastructure for autonomous operations. It turns evidence into economic judgment before consequential execution—and keeps those responsibilities distinct.</p>
        <div className="developers-static-boundary" role="note" aria-label="Service availability">
          <span className="developers-static-boundary-mark" aria-hidden="true">i</span>
          <p><strong>Documentation only.</strong> This public Developers guide is static. Live API access, OpenAPI, live checks and protected operational endpoints are unavailable in this front-door profile.</p>
        </div>
      </section>

      <section className="developers-static-section" id="operating-loop" aria-labelledby="loop-title">
        <div className="developers-static-section-head">
          <p className="developers-static-kicker">01 / Economic operating loop</p>
          <h2 id="loop-title">An evidence cycle,<br /><em>not a payment shortcut.</em></h2>
          <p>The order describes system responsibilities. It does not assert that every stage or rail is currently enabled.</p>
        </div>
        <ol className="developers-static-loop">
          {operatingLoop.map(([number, title, detail]) => <li key={number}>
            <span className="developers-static-step">{number}</span>
            <div><h3>{title}</h3><p>{detail}</p></div>
          </li>)}
        </ol>
      </section>

      <section className="developers-static-section developers-static-receipts" id="receipt-spine" aria-labelledby="receipts-title">
        <div className="developers-static-section-head">
          <p className="developers-static-kicker">02 / Canonical receipt spine</p>
          <h2 id="receipts-title">Four stages.<br /><em>One accountable history.</em></h2>
          <p>Stored ancestry runs from observations to judgment to execution to evaluation. Each stage has a different job.</p>
        </div>
        <div className="developers-static-receipt-grid">
          {receiptStages.map((stage) => <article className="developers-static-receipt" key={stage.id}>
            <span className="developers-static-receipt-id">{stage.id}</span>
            <h3>{stage.name}</h3>
            <p>{stage.detail}</p>
          </article>)}
        </div>
        <p className="developers-static-footnote">Receipt hashes establish content integrity relative to trusted records. They do not establish source truth, signer authenticity or independent verification by themselves.</p>
      </section>

      <section className="developers-static-section" id="architecture" aria-labelledby="architecture-title">
        <div className="developers-static-section-head">
          <p className="developers-static-kicker">03 / System boundaries</p>
          <h2 id="architecture-title">Each boundary has<br /><em>one clear responsibility.</em></h2>
        </div>
        <div className="developers-static-layers">
          {architectureLayers.map((layer, index) => <article className="developers-static-layer" key={layer.label}>
            <span className="developers-static-layer-index">0{index + 1}</span>
            <div><p className="developers-static-kicker">{layer.label}</p><h3>{layer.name}</h3><p>{layer.text}</p></div>
          </article>)}
        </div>
        <div className="developers-static-rule" aria-label="Operational responsibility boundaries">
          <span><b>RADAR</b> judges</span><i aria-hidden="true">/</i>
          <span><b>PAY.SH</b> spends</span><i aria-hidden="true">/</i>
          <span><b>EXECUTION SYSTEMS</b> execute</span><i aria-hidden="true">/</i>
          <span><b>EVIDENCE</b> records what happened</span>
        </div>
      </section>

      <section className="developers-static-section developers-static-integration" id="integration" aria-labelledby="integration-title">
        <div className="developers-static-section-head">
          <p className="developers-static-kicker">04 / Integration reasoning</p>
          <h2 id="integration-title">Build around<br /><em>what can be proven.</em></h2>
          <p>Use this sequence to reason about an integration. It is conceptual guidance, not an executable API recipe.</p>
        </div>
        <ol className="developers-static-checklist">
          <li><strong>Define the operation.</strong><span>Bind the principal, intent, subject, amount, asset, recipient and rail before requesting judgment.</span></li>
          <li><strong>Gather scoped evidence.</strong><span>Keep source identity, observation time, freshness, provenance and uncertainty attached to each fact.</span></li>
          <li><strong>Request judgment before spend.</strong><span>Stop on unavailable service, incomplete evidence, stale policy or an indeterminate outcome. Never turn an error into approval.</span></li>
          <li><strong>Enforce authority at execution.</strong><span>A judgment receipt is an assessment. The host or rail must enforce any separate authorization before the side effect.</span></li>
          <li><strong>Verify settlement and outcome.</strong><span>Keep transaction identity, finalized settlement evidence, request/response commitments and artifact references with the execution record.</span></li>
          <li><strong>Evaluate only supported claims.</strong><span>Missing or conflicting proof remains incomplete. Do not mint a success receipt or score from an unverified status string.</span></li>
        </ol>
        <aside className="developers-static-note">
          <p className="developers-static-kicker">Evidence rule</p>
          <p>Record what was observed, what was judged, what the external system executed, and how the result was evaluated. Keep unknowns explicit; a missing receipt is not a successful operation.</p>
        </aside>
      </section>

      <section className="developers-static-status" aria-labelledby="availability-title">
        <div><p className="developers-static-kicker">Front-door profile</p><h2 id="availability-title">A guide to the system,<br /><em>not a live control surface.</em></h2></div>
        <ul>
          <li>Local page content and assets only</li>
          <li>No browser API calls or polling</li>
          <li>OpenAPI and protected endpoints unavailable</li>
          <li>No database, provider or payment initialization</li>
        </ul>
      </section>
    </div>

    <footer className="developers-static-footer">
      <a href="/">← Radar front door</a>
      <span>MODE: STATIC DOCUMENTATION</span>
      <a href="#top">Back to top ↑</a>
    </footer>
  </main>;
}
