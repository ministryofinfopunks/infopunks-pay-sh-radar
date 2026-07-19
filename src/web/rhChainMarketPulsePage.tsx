import React, { useEffect, useState } from 'react';
import { getNarrativeMetadataForPath, NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';
import type { RhChainMarketPulse as Pulse, RhChainMarketPulseConfidence as Confidence, RhChainMarketPulseFinding as Finding, RhChainMarketPulseFreshness as Freshness, RhChainMarketPulseMetric as Metric } from '../services/rhChainMarketStructureService';
import { fetchRhChain, type RhChainEnvelope, RhChainRouteState, RhChainSuiteNav } from './rhChainUi';

type Layer = Pulse['layer_composition'][number];

const CANONICAL_PATH = '/rh-chain-signal-desk/market';
const CANONICAL_URL = `${NARRATIVE_PUBLIC_HOST}${CANONICAL_PATH}`;

export function RhChainMarketPulsePage() {
  const [envelope, setEnvelope] = useState<RhChainEnvelope<Pulse> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const load = () => { setError(null); return fetchRhChain<Pulse>('/v1/rh-chain/market').then(setEnvelope).catch(() => setError('Market Pulse is temporarily unavailable. The last trusted observation has not been replaced.')); };
  useEffect(() => { syncMetadata(); void load(); }, []);
  const pulse = envelope?.data ?? null;
  const insight = pulse ? `${pulse.interpretation.headline} ${pulse.interpretation.conclusion} — ${formatTime(pulse.captured_at)} · ${pulse.observation_window.label} · Infopunks Radar` : '';
  async function copyInsight() { if (await copyText(insight)) setActionState('copied'); }
  async function shareInsight() {
    if (navigator.share) {
      try { await navigator.share({ title: pulse?.title, text: insight, url: CANONICAL_URL }); setActionState('shared'); return; } catch { /* A cancelled native share is not an error state. */ }
    }
    await copyInsight();
  }

  return <div className="shell narrative-shell rh-chain-shell market-pulse-shell">
    <a className="skip-link" href="#market-pulse-content">Skip to Market Pulse</a>
    <header className="site-header"><RhChainSuiteNav current={CANONICAL_PATH} /></header>
    <main id="market-pulse-content" className="narrative-page rh-chain-page market-pulse-page">
      {error && <RhChainRouteState state="unavailable" detail={error} onRetry={() => void load()} />}
      {!pulse && !error && <MarketPulseSkeleton />}
      {pulse && envelope && <>
        <section className="market-pulse-hero" aria-labelledby="market-pulse-title" data-social-card="market-pulse">
          <div className="market-pulse-hero-top"><p className="section-kicker">Infopunks Radar · Robinhood Chain</p><FreshnessBadge freshness={pulse.freshness} confidence={pulse.confidence} /></div>
          <div className="market-pulse-hero-copy"><p className="market-pulse-product-name">Market Pulse</p><h1 id="market-pulse-title">{pulse.interpretation.headline}</h1><p className="market-pulse-conclusion">{pulse.interpretation.conclusion}</p></div>
          <div className="market-pulse-meta" aria-label="Observation details"><span>{pulse.observation_window.label}</span><span>Captured {formatTime(pulse.captured_at)}</span><span>{pulse.metrics.active_tracked_tokens.value ?? 0} tracked tokens</span></div>
          <div className="market-pulse-actions" role="group" aria-label="Share Market Pulse insight">
            <button type="button" className="execute compact" onClick={() => void shareInsight()} aria-label="Share Market Pulse insight">Share insight</button>
            <button type="button" className="execute compact secondary" onClick={() => void copyInsight()} aria-label="Copy Market Pulse insight">{actionState === 'copied' ? 'Insight copied' : 'Copy insight'}</button>
            <a className="execute compact secondary" href="/rh-chain-signal-desk/live-snapshot">Live Snapshot</a>
          </div>
          <p className="market-pulse-action-status" aria-live="polite">{actionState === 'shared' ? 'Share sheet opened.' : actionState === 'copied' ? 'Insight copied to clipboard.' : ''}</p>
        </section>

        {(pulse.freshness !== 'fresh' || pulse.warnings.length > 0) && <section className={`market-pulse-data-state state-${pulse.freshness}`} role="status" aria-label="Market data quality"><strong>{dataStateTitle(pulse.freshness)}</strong><span>{pulse.warnings[0] ?? 'Check source detail before relying on this observation.'}</span></section>}

        <section className="market-pulse-section" aria-labelledby="market-state-title">
          <SectionHead kicker="Market state" title="The tracked market, at a glance" id="market-state-title" copy="Canonical-pair observations only. No secondary-pool double counting." />
          <div className="market-pulse-state-grid">
            <MetricCard label="Tracked 24h volume" metric={pulse.metrics.tracked_volume_24h} />
            <MetricCard label="Tracked liquidity" metric={pulse.metrics.tracked_liquidity} />
            <MetricCard label="24h transactions" metric={pulse.metrics.tracked_transactions_24h} />
            <MetricCard label="Active tracked tokens" metric={pulse.metrics.active_tracked_tokens} />
            <MetricCard label="New pair observations" metric={pulse.metrics.newly_discovered_tokens} />
            <article className="market-pulse-metric provider-health-card"><span>Provider health</span><strong>{humanize(pulse.provider_provenance.health.state)}</strong><small>{humanize(pulse.provider_provenance.health.activeCacheStatus)} cache · {pulse.provider_provenance.health.latestLatencyMs === null ? 'latency unavailable' : `${pulse.provider_provenance.health.latestLatencyMs} ms`}</small></article>
          </div>
        </section>

        <section className="market-pulse-section" aria-labelledby="layer-composition-title">
          <SectionHead kicker="Layer composition" title="Where attention is accumulating" id="layer-composition-title" copy="Reviewed exact-contract layers, weighted by tracked 24-hour volume." />
          {pulse.metrics.active_tracked_tokens.value ? <div className="market-pulse-layer-layout"><LayerCompositionChart layers={pulse.layer_composition} /><div className="market-pulse-layer-list">{pulse.layer_composition.map((layer) => <article key={layer.layer}><span className={`market-pulse-layer-dot layer-${layer.layer}`} aria-hidden="true" /><div><strong>{layer.label}</strong><small>{formatMetric(layer.volume_24h)} volume · {formatMetric(layer.liquidity)} liquidity</small></div><b>{formatPercent(layer.volume_share.value)}</b></article>)}</div></div> : <RhChainRouteState state="source_required" detail="No current exact-contract pair observations are available. Layer shares remain uncalculated." />}
        </section>

        <section className="market-pulse-section" aria-labelledby="momentum-title">
          <SectionHead kicker="Market momentum" title="What changed between windows" id="momentum-title" copy="Change claims require comparable stored observations. Missing history stays visible." />
          <div className="market-pulse-finding-grid">
            <FindingCard label="Fastest-growing layer" finding={pulse.momentum.fastest_growing_layer} />
            <FindingCard label="Largest liquidity increase" finding={pulse.momentum.largest_liquidity_increase} />
            <FindingCard label="Largest volume acceleration" finding={pulse.momentum.largest_volume_acceleration} />
            <FindingCard label="Strongest post-boost retention" finding={pulse.momentum.strongest_post_boost_retention} />
            <FindingCard label="Cross-layer development" finding={pulse.momentum.most_important_cross_layer_development} />
          </div>
        </section>

        <section className="market-pulse-section market-pulse-concentration" aria-labelledby="concentration-title">
          <SectionHead kicker="Concentration" title="How narrow is the tracked market?" id="concentration-title" copy="High concentration means a small number of assets or venues dominate the observed set." />
          <div className="market-pulse-concentration-grid"><ConcentrationItem label="Top-three volume share" metric={pulse.concentration.top_three_volume_share} /><ConcentrationItem label="Top-three liquidity share" metric={pulse.concentration.top_three_liquidity_share} /><ConcentrationItem label="Unknown volume share" metric={pulse.concentration.unknown_volume_share} /><ConcentrationItem label="Leading DEX share" metric={pulse.concentration.leading_dex?.volume_share ?? null} detail={pulse.concentration.leading_dex?.dex_id ?? 'No leading DEX available'} /></div>
        </section>

        <section className="market-pulse-section market-pulse-interpretation" aria-labelledby="interpretation-title">
          <SectionHead kicker="Market interpretation" title="Measured first. Interpreted second." id="interpretation-title" copy="A deterministic ruleset turns observed differences into a concise public read." />
          <blockquote>{pulse.interpretation.headline}</blockquote>
          <ul>{pulse.interpretation.supporting.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="market-pulse-method">Rules applied: {pulse.interpretation.rules.map(humanize).join(' · ') || 'No directional rule applied'}.</p>
        </section>

        <aside className="market-pulse-social-card" aria-label="Compact Market Pulse social card">
          <p>Infopunks / Market Pulse</p><strong>{pulse.interpretation.headline}</strong><span>{pulse.observation_window.label} · {formatTime(pulse.captured_at)} · {humanize(pulse.freshness)}</span>
        </aside>

        <details className="market-pulse-sources"><summary>Source, freshness, and methodology details</summary><div><dl><div><dt>Provider</dt><dd>DEX Screener / chain id robinhood</dd></div><div><dt>Role</dt><dd>Market and attention sensor, not a complete chain index</dd></div><div><dt>Cache</dt><dd>{humanize(pulse.provider_provenance.health.activeCacheStatus)}</dd></div><div><dt>Confidence</dt><dd>{humanize(pulse.confidence)}</dd></div><div><dt>Canonical URL</dt><dd><a href={CANONICAL_PATH}>{CANONICAL_URL}</a></dd></div></dl><p>{pulse.disclaimer}</p>{pulse.warnings.length > 0 && <ul>{pulse.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}<p><a href="/v1/rh-chain/market">Open Market Pulse JSON</a> · <a href="/rh-chain-signal-desk/live-snapshot">Open Live Snapshot</a> · <a href="/rh-chain-signal-desk/market-structure">Open 4663 Market Structure</a></p></div></details>
      </>}
    </main>
  </div>;
}

function MarketPulseSkeleton() { return <section className="market-pulse-skeleton" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">Loading Robinhood Chain Market Pulse</span><div className="market-pulse-skeleton-line short" aria-hidden="true" /><div className="market-pulse-skeleton-line headline" aria-hidden="true" /><div className="market-pulse-skeleton-line medium" aria-hidden="true" /><div className="market-pulse-skeleton-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></section>; }
function SectionHead({ kicker, title, id, copy }: { kicker: string; title: string; id: string; copy: string }) { return <div className="market-pulse-section-head"><div><p className="section-kicker">{kicker}</p><h2 id={id}>{title}</h2></div><p>{copy}</p></div>; }
function MetricCard({ label, metric }: { label: string; metric: Metric }) { return <article className="market-pulse-metric"><span>{label}</span><strong>{formatMetric(metric)}</strong><Delta metric={metric} /><small>{humanize(metric.freshness)} · {humanize(metric.confidence)} confidence</small></article>; }
function Delta({ metric }: { metric: Metric }) { return <em className={metric.absolute_change === null ? 'delta-none' : metric.absolute_change >= 0 ? 'delta-up' : 'delta-down'}>{metric.percentage_change === null ? 'No comparable window' : `${metric.percentage_change >= 0 ? '+' : ''}${metric.percentage_change.toFixed(1)}% vs previous`}</em>; }
function FindingCard({ label, finding: value }: { label: string; finding: Finding }) { return <article className="market-pulse-finding"><span>{label}</span>{value ? <><strong>{value.subject}</strong><p>{value.detail}</p><small>{formatMetric(value.metric)} · {humanize(value.metric.confidence)} confidence</small></> : <><strong>Insufficient history</strong><p>A comparable previous-window observation is required.</p><small>No directional claim generated.</small></>}</article>; }
function ConcentrationItem({ label, metric, detail }: { label: string; metric: Metric | null; detail?: string }) { return <article><span>{label}</span><strong>{metric?.value === null || !metric ? 'Unavailable' : `${metric.value.toFixed(1)}%`}</strong><small>{detail ?? 'Share of the tracked canonical-pair set'}</small></article>; }
function FreshnessBadge({ freshness, confidence }: { freshness: Freshness; confidence: Confidence }) { return <span className={`market-pulse-freshness freshness-${freshness}`}>{humanize(freshness)} · {confidence} confidence</span>; }
function LayerCompositionChart({ layers }: { layers: Layer[] }) { let offset = 0; return <figure className="market-pulse-layer-chart"><svg viewBox="0 0 100 12" role="img" aria-labelledby="layer-chart-title layer-chart-description"><title id="layer-chart-title">Tracked volume composition by market layer</title><desc id="layer-chart-description">A stacked bar showing memes, RWAs, agents, infrastructure, DeFi, and unknown shares of tracked volume.</desc>{layers.map((layer) => { const width = Math.max(0, layer.volume_share.value ?? 0); const x = offset; offset += width; return <rect key={layer.layer} className={`layer-${layer.layer}`} x={x} y="1" width={width} height="10" rx="1" />; })}</svg><figcaption>Share of tracked 24-hour canonical-pair volume.</figcaption></figure>; }

function syncMetadata() {
  const metadata = getNarrativeMetadataForPath(CANONICAL_PATH);
  const title = metadata?.title ?? 'Robinhood Chain Market Pulse | Infopunks Radar';
  const description = metadata?.description ?? 'A measured Robinhood Chain market-structure read from Infopunks Radar.';
  document.title = title;
  for (const [attribute, name, content] of [
    ['name', 'description', description], ['property', 'og:title', title], ['property', 'og:description', description], ['property', 'og:url', CANONICAL_URL], ['name', 'twitter:card', metadata?.twitterCard ?? 'summary'], ['name', 'twitter:title', title], ['name', 'twitter:description', description]
  ] as const) setMeta(attribute, name, content);
  if (metadata?.ogImageUrl) { setMeta('property', 'og:image', metadata.ogImageUrl); setMeta('name', 'twitter:image', metadata.ogImageUrl); }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = CANONICAL_URL;
}
function setMeta(attribute: 'name' | 'property', name: string, content: string) { let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`); if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, name); document.head.appendChild(tag); } tag.content = content; }
async function copyText(value: string) { if (!value) return false; try { await navigator.clipboard?.writeText(value); return Boolean(navigator.clipboard); } catch { return false; } }
function formatMetric(metric: Metric) { if (metric.value === null) return 'Unavailable'; if (metric.unit === 'usd') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: metric.value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: metric.value >= 1_000 ? 0 : 2 }).format(metric.value); if (metric.unit === 'percent') return `${metric.value.toFixed(1)}%`; if (metric.unit === 'score') return `${metric.value.toFixed(0)} / 100`; return new Intl.NumberFormat('en-US').format(metric.value); }
function formatPercent(value: number | null) { return value === null ? '—' : `${value.toFixed(1)}%`; }
function formatTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Timestamp unavailable' : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(parsed).replace(' at ', ' · ') + ' UTC'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dataStateTitle(freshness: Freshness) { return freshness === 'stale' ? 'Market memory is serving stale context.' : freshness === 'partial' ? 'The market read is partial.' : freshness === 'unavailable' ? 'Current market data is unavailable.' : 'Source caveat'; }
