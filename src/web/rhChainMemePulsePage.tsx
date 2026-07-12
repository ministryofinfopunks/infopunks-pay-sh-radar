import React, { useEffect, useState } from 'react';
import type { RhChainMemePulsePayload } from '../data/rhChain';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

export function RhChainMemePulsePage() {
  const [pulse, setPulse] = useState<RhChainMemePulsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = 'RH Meme Pulse | Infopunks';
    fetch(toApiUrl(API_BASE_URL, '/v1/rh-chain/meme-pulse'), { headers: { Accept: 'application/json' } })
      .then(async (response) => { if (!response.ok) throw new Error(`meme_pulse ${response.status}`); return response.json() as Promise<{ data: RhChainMemePulsePayload }>; })
      .then(({ data }) => setPulse(data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'meme_pulse_unavailable'));
  }, []);

  return <div className="shell narrative-shell rh-chain-shell meme-pulse-shell">
    <a className="skip-link" href="#meme-pulse-content">Skip to content</a>
    <header className="site-header"><nav className="global-toolbar narrative-toolbar" aria-label="RH Chain navigation">
      <a className="nav-brand" href="/"><span>Infopunks</span><strong>RH Chain</strong></a>
      <div className="terminal-nav terminal-nav-scroll-rail"><a href="/rh-chain-signal-desk">Signal Desk</a><a className="active" aria-current="page" href="/rh-chain-signal-desk/meme-pulse">Meme Pulse</a><a href="/rh-chain-signal-desk/review-queue">Review Queue</a><a href="/rh-chain-signal-desk/daily-receipts">Daily Receipts</a><a href="/rh-chain-signal-desk/scout">Scout Agent</a></div>
    </nav></header>
    <main id="meme-pulse-content" className="narrative-page rh-chain-page meme-pulse-page">
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {!pulse && !error && <section className="panel"><p className="route-state">Loading public market memory…</p></section>}
      {pulse && <>
        <section className="panel hero rh-chain-hero meme-pulse-hero">
          <div><p className="eyebrow">RH Chain attention memory</p><h1>RH Meme Pulse</h1><p className="copy">What’s moving. What’s risky. What the market is trying to say.</p><p className="meme-pulse-line">Most see noise. Infopunks keeps the receipt.</p></div>
          <aside className="rh-chain-hero-rail"><p className="section-kicker">Doctrine</p><p>{pulse.doctrine}</p><p className="rh-chain-disclaimer">{pulse.disclaimer}</p></aside>
        </section>
        <section className="meme-pulse-section" aria-labelledby="pulse-snapshot"><div className="rh-chain-section-head"><div><p className="section-kicker">Pulse Snapshot</p><h2 id="pulse-snapshot">Read the surface</h2></div></div><div className="meme-pulse-snapshot-grid">
          {Object.entries(pulse.snapshot).map(([label, value]) => <article className="meme-pulse-snapshot" key={label}><p>{label.replaceAll('_', ' ')}</p><strong>{value}</strong></article>)}
        </div></section>
        <section className="meme-pulse-section" aria-labelledby="top-attention"><div className="rh-chain-section-head"><div><p className="section-kicker">Top Attention Assets</p><h2 id="top-attention">Memory before momentum</h2><p>Ranked desk context drawn from 4663, receipts, review states, and snapshot availability.</p></div><a className="methodology-trigger" href="/v1/rh-chain/meme-pulse">Pulse JSON</a></div><div className="meme-pulse-assets">
          {pulse.top_attention_assets.map((asset) => <article className="meme-pulse-asset" key={asset.ticker}><div className="meme-pulse-asset-top"><div><p className="section-kicker">{asset.narrative_class.join(' · ')}</p><h3>{asset.ticker}</h3><p>{asset.name}</p></div><span className={`meme-pulse-risk risk-${asset.risk_state}`}>{asset.risk_state.replaceAll('_', ' ')}</span></div><dl><div><dt>Signal score</dt><dd>{asset.signal_score ?? 'Receipt pending'}</dd></div><div><dt>Launch surface</dt><dd>{asset.launch_surface?.replaceAll('_', ' ') ?? 'Unknown / manual'}</dd></div><div><dt>Receipt state</dt><dd>{asset.receipt_state.replaceAll('_', ' ')}</dd></div></dl><p>{asset.infopunks_verdict}</p></article>)}
        </div></section>
        <section className="meme-pulse-section meme-pulse-risk-strip" aria-labelledby="risk-strip"><div className="rh-chain-section-head"><div><p className="section-kicker">Risk Strip</p><h2 id="risk-strip">Pause before narrative</h2><p>These are verification gates, not calls to action.</p></div></div><div className="meme-pulse-risk-grid">{pulse.risk_strip.map((risk) => <article key={risk.id}><span className={`meme-pulse-risk risk-${risk.risk_state}`}>{risk.risk_state.replaceAll('_', ' ')}</span><h3>{risk.title}</h3><p>{risk.summary}</p></article>)}</div></section>
        <section className="meme-pulse-section" aria-labelledby="translation"><div className="rh-chain-section-head"><div><p className="section-kicker">Meme → Market Translation</p><h2 id="translation">What the meme might be saying</h2><p>Interpretation is not prediction.</p></div></div><div className="meme-pulse-translation-grid">{pulse.market_translation.map((item) => <article key={item.id}><p className="section-kicker">{item.trend}</p><h3>{item.translation}</h3><p>{item.caveat}</p></article>)}</div></section>
        <section className="panel meme-pulse-cta" aria-label="RH Meme Pulse actions"><p className="section-kicker">Keep the desk honest</p><h2>Context is external. Judgment stays accountable.</h2><div className="panel-actions"><a className="execute" href="/rh-chain-signal-desk/submit">Submit a Signal</a><a className="execute compact secondary" href="/rh-chain-signal-desk/review-queue">View Review Queue</a><a className="execute compact secondary" href="/rh-chain-signal-desk/scout">Open Scout Agent</a><a className="execute compact secondary" href="/rh-chain-signal-desk/daily-receipts/rh_daily_001">View Daily Receipt #001</a></div></section>
      </>}
    </main>
  </div>;
}
