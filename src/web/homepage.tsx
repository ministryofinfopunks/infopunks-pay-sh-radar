import { useEffect, useState } from 'react';
import { toApiUrl, getApiBaseUrl } from './apiBaseUrl';

type LiveStatus = 'loading' | 'live' | 'degraded';

const API_BASE_URL = getApiBaseUrl();

function mark(name: string) {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') performance.mark(name);
}

export function UniversalHomepage() {
  const [status, setStatus] = useState<LiveStatus>('loading');

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
    <header className="radar-home-header">
      <a className="radar-home-brand" href="/" aria-label="Infopunks Radar home"><span>Infopunks</span><strong>Radar</strong></a>
      <nav aria-label="Primary navigation">
        <a href="/solana">Solana</a>
        <a href="/4663">//4663</a>
        <a href="/radar/cards">Pre-Spend Intelligence</a>
      </nav>
      <p className={`radar-live-status ${status}`} role="status" aria-live="polite">
        {status === 'loading' ? 'Live status connecting' : status === 'live' ? 'Live intelligence available' : 'Live status delayed — browse remains available'}
      </p>
    </header>
    <main className="radar-home-shell" id="radar-home-content">
      <section className="radar-home-hero" aria-labelledby="radar-home-title">
        <div className="radar-home-manifesto">
          <p className="radar-home-eyebrow">Infopunks · Category thesis</p>
          <h1 id="radar-home-title"><span>After attention,</span><strong>intelligence.</strong></h1>
          <p className="radar-home-lede"><strong>Intelligence before the wallet acts.</strong> Before agents spend, they check Infopunks.</p>
          <div className="radar-home-actions">
            <a href="/radar/cards">Open Pre-Spend Intelligence</a>
            <a href="#radar-home-proof">See the proof</a>
          </div>
        </div>
        <aside className="radar-category-sequence" aria-label="Evolution of economic primitives">
          <p>Economic primitives</p>
          <ol>
            <li><span>Bitcoin</span><strong>Scarcity</strong><b aria-hidden="true">↓</b></li>
            <li><span>Ethereum</span><strong>Computation</strong><b aria-hidden="true">↓</b></li>
            <li><span>Solana</span><strong>Throughput</strong><b aria-hidden="true">↓</b></li>
            <li><span>Memecoins</span><strong>Attention</strong><b aria-hidden="true">↓</b></li>
            <li className="intelligence"><span>Infopunks</span><strong>Intelligence</strong></li>
          </ol>
        </aside>
      </section>

      <section className="radar-home-proof" id="radar-home-proof" aria-labelledby="radar-home-proof-title">
        <div className="radar-home-section-heading">
          <p>One movement</p>
          <h2 id="radar-home-proof-title">Culture → intelligence → infrastructure.</h2>
        </div>
        <div className="radar-home-proof-grid">
          <article><span>01</span><p>$INFOPUNKS</p><h3>Genesis</h3><small>The cultural signal.</small></article>
          <article><span>02</span><p>Radar / RH Pulse</p><h3>Proof</h3><small>Evidence, receipts, and market memory.</small></article>
          <article><span>03</span><p>IPX</p><h3>Infrastructure economy</h3><small>Intelligence as an economic primitive.</small></article>
        </div>
        <p className="radar-home-proof-line">Most see noise. <strong>Infopunks finds signal.</strong></p>
      </section>

      <section className="radar-home-entry" aria-labelledby="radar-home-entry-title">
        <div><p>Choose an intelligence surface</p><h2 id="radar-home-entry-title">One Radar. Two economies.</h2></div>
        <div className="radar-home-cards">
          <article><p>Solana Radar</p><h3>Pre-Spend Intelligence</h3><span>Routes · Providers · Receipts · Machine-market evidence</span><a href="/solana">Open Solana Radar <b aria-hidden="true">→</b></a></article>
          <article className="rh"><p>Robinhood Chain</p><h3>//4663</h3><span>Pulse · Today · Signals · Receipts · Market memory</span><a href="/4663">Enter //4663 <b aria-hidden="true">→</b></a></article>
        </div>
      </section>
    </main>
    <footer className="radar-home-footer"><span>$INFOPUNKS · Genesis</span><span>Radar / RH Pulse · Proof</span><span>IPX · Infrastructure economy</span></footer>
  </div>;
}
