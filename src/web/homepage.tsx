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
    <header className="radar-home-header">
      <a className="radar-home-brand" href="/" aria-label="Infopunks Radar home"><span>Infopunks</span><strong>Radar</strong></a>
      <nav aria-label="Primary navigation">
        <a href="/solana">Solana</a>
        <a href="/rh-chain-signal-desk">RH Chain</a>
        <a href="/radar/cards">Pre-Spend Intelligence</a>
      </nav>
      <p className={`radar-live-status ${status}`} role="status" aria-live="polite">
        {status === 'loading' ? 'Live status connecting' : status === 'live' ? 'Live intelligence available' : 'Live status delayed — browse remains available'}
      </p>
    </header>
    <main className="radar-home-shell">
      <section className="radar-home-hero" aria-labelledby="radar-home-title">
        <div>
          <p className="radar-home-eyebrow">Infopunks Radar</p>
          <h1 id="radar-home-title">Intelligence before the wallet acts.</h1>
          <p className="radar-home-lede">Before agents spend, they check Infopunks. Signal extraction for the agentic economy.</p>
          <div className="radar-home-actions">
            <a href="/solana">Open Solana Radar</a>
            <a href="/rh-chain-signal-desk">Explore Robinhood Chain</a>
          </div>
        </div>
        <aside aria-label="Radar system architecture">
          <p>System architecture</p>
          <strong>One evidence system.<br />Multiple chain intelligence surfaces.</strong>
          <span>Most see noise. Infopunks finds signal.</span>
        </aside>
      </section>
      <section className="radar-home-entry" aria-labelledby="radar-home-entry-title">
        <div><p>Choose an intelligence surface</p><h2 id="radar-home-entry-title">One Radar. Two economies.</h2></div>
        <div className="radar-home-cards">
          <article><p>Solana Radar</p><h3>Pre-spend intelligence</h3><span>Routes, providers, receipts, claims, and machine-market evidence.</span><a href="/solana">Open Solana Radar <b aria-hidden="true">→</b></a></article>
          <article className="rh"><p>Robinhood Chain</p><h3>Signal Desk</h3><span>Attention Market Watch, Signal Graph, LoopLab, market structure and reviewed chain intelligence.</span><a href="/rh-chain-signal-desk">Enter RH Chain Desk <b aria-hidden="true">→</b></a></article>
        </div>
      </section>
    </main>
  </div>;
}
