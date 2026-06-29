import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

type NarrativeDecisionState = 'strong_signal' | 'watch_closely' | 'concentrated_power' | 'high_reflexivity' | 'unproven' | 'do_not_chase';

type NarrativeEvidenceArtifact = {
  label: string;
  note: string;
  href?: string;
};

type NarrativeRelatedRoute = {
  label: string;
  href: string;
};

type NarrativeAsset = {
  id: string;
  slug: string;
  ticker: string;
  name: string;
  chain: string;
  category: string;
  thesis: string;
  signal_source: string;
  attention_velocity_score: number;
  myth_coherence_score: number;
  centralization_risk_score: number;
  reflexivity_risk_score: number;
  kol_dependency_score: number;
  trench_contagion_score: number;
  sovereignty_score: number;
  infopunk_verdict: string;
  evidence_artifacts: NarrativeEvidenceArtifact[];
  related_routes: NarrativeRelatedRoute[];
  last_updated: string;
};

type NarrativeSignalCard = {
  id: string;
  title: string;
  score: number | string;
  short_explanation: string;
  evidence_note: string;
  decision_state: NarrativeDecisionState;
};

type NarrativeSignalSection = {
  id: string;
  title: string;
  body: string;
  card_ids: string[];
};

type NarrativeSignalSurface = {
  slug: string;
  type: 'signal_source' | 'signal_report';
  title: string;
  subtitle: string;
  thesis: string;
  disclaimer: string;
  signal_source: string;
  asset_slug: string | null;
  last_updated: string;
  cards: NarrativeSignalCard[];
  sections: NarrativeSignalSection[];
  asset?: NarrativeAsset;
};

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message.endsWith(' 404');
}

function stateLabel(value: NarrativeDecisionState) {
  return value.replaceAll('_', ' ');
}

function formatScore(value: number | string) {
  return typeof value === 'number' ? `${value}/100` : value;
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

function NarrativeIntelNav({ current }: { current: string }) {
  const links = [
    { href: '/narratives', label: 'Narrative Intel' },
    { href: '/narratives/attention-markets', label: 'Attention Markets' },
    { href: '/signals/ansem', label: 'Ansem' },
    { href: '/signals/black-bull', label: 'Black Bull' }
  ];

  return <nav className="global-toolbar narrative-toolbar" aria-label="Narrative Intel navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Narrative Intel</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Narrative Intel routes">
      {links.map((link) => <a key={link.href} href={link.href} className={current === link.href ? 'active' : ''} aria-current={current === link.href ? 'page' : undefined}>{link.label}</a>)}
    </div>
    <div className="terminal-actions" aria-label="Narrative Intel quick links">
      <span className="terminal-action-cluster">
        <a className="methodology-trigger" href="/">Radar Home</a>
        <a className="methodology-trigger" href="/graph">Signal Graph</a>
      </span>
    </div>
  </nav>;
}

function NarrativeMetricCard({ card }: { card: NarrativeSignalCard }) {
  return <article className={`panel narrative-metric-card state-${card.decision_state}`}>
    <div className="narrative-metric-head">
      <p className="section-kicker">{card.title}</p>
      <span className={`narrative-decision-pill state-${card.decision_state}`}>{stateLabel(card.decision_state)}</span>
    </div>
    <strong>{formatScore(card.score)}</strong>
    <p>{card.short_explanation}</p>
    <small>Evidence note: {card.evidence_note}</small>
  </article>;
}

function NarrativeEvidenceList({ artifacts }: { artifacts: NarrativeEvidenceArtifact[] }) {
  return <div className="narrative-evidence-list">
    {artifacts.map((artifact) => <article key={artifact.label} className="panel narrative-evidence-card">
      <p className="section-kicker">{artifact.label}</p>
      <p>{artifact.note}</p>
      {artifact.href && <a href={artifact.href}>Open artifact</a>}
    </article>)}
  </div>;
}

function NarrativeAssetPreview({ asset }: { asset: NarrativeAsset }) {
  return <article className="panel narrative-asset-preview">
    <div className="narrative-asset-head">
      <div>
        <p className="section-kicker">{asset.category}</p>
        <h2>{asset.ticker} / {asset.name}</h2>
      </div>
      <span className="source-badge">{asset.chain}</span>
    </div>
    <p>{asset.thesis}</p>
    <div className="narrative-asset-stats">
      <span>attention {asset.attention_velocity_score}</span>
      <span>myth {asset.myth_coherence_score}</span>
      <span>reflexivity {asset.reflexivity_risk_score}</span>
      <span>sovereignty {asset.sovereignty_score}</span>
    </div>
    <div className="panel-actions">
      <a className="execute compact secondary" href="/signals/black-bull">Open signal report</a>
      <a className="execute compact secondary" href="/signals/ansem">Open signal source</a>
    </div>
  </article>;
}

export function NarrativesIndexPage() {
  const [assets, setAssets] = useState<NarrativeAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NarrativeAsset[]>('/v1/narratives')
      .then((response) => setAssets(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'narratives_unavailable'));
  }, []);

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#narrative-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current="/narratives" />
    </header>
    <main id="narrative-content" className="narrative-page">
      <section className="panel hero narrative-hero">
        <div>
          <p className="eyebrow">Narrative Asset Intelligence</p>
          <h1>Narrative Intel</h1>
          <p className="copy">Infopunks maps attention markets before they become consensus.</p>
          <p className="copy">Infopunks do not worship signal. Infopunks map signal.</p>
          <div className="panel-actions">
            <a className="execute" href="/narratives/attention-markets">Read attention markets</a>
            <a className="execute compact secondary" href="/signals/black-bull">Open seeded report</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail">
          <p className="section-kicker">Desk stance</p>
          <p>Attention can become a market before it becomes a business.</p>
          <p>Personas can become liquidity. Memes can become coordination rails. Wallets can become myth objects.</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      <section className="narrative-grid">
        {assets.map((asset) => <NarrativeAssetPreview key={asset.id} asset={asset} />)}
      </section>

      {!!assets[0] && <>
        <section className="panel narrative-copy-panel">
          <p className="section-kicker">Core Positioning</p>
          <h2>Signal without sovereignty is not conviction.</h2>
          <p>{assets[0].infopunk_verdict}</p>
        </section>
        <NarrativeEvidenceList artifacts={assets[0].evidence_artifacts} />
      </>}
    </main>
  </div>;
}

export function AttentionMarketsPage() {
  const bullets = [
    'personas can become liquidity',
    'memes can become coordination rails',
    'wallets can become myth objects',
    'attention velocity can precede price action',
    'narrative assets require sovereignty checks'
  ];

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#attention-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current="/narratives/attention-markets" />
    </header>
    <main id="attention-content" className="narrative-page">
      <section className="panel hero narrative-hero">
        <div>
          <p className="eyebrow">Attention Markets</p>
          <h1>Attention Markets</h1>
          <p className="copy">Narrative markets are not just about price. They are about who gets to compress attention into a tradeable object first.</p>
        </div>
        <div className="panel narrative-hero-rail">
          <p className="section-kicker">Operational note</p>
          <p>Minimal hype. Evidence first. Watch the flow, the concentration, and the sovereignty gap.</p>
        </div>
      </section>

      <section className="narrative-grid" aria-label="Attention market theses">
        {bullets.map((item) => <article key={item} className="panel narrative-thesis-card">
          <p className="section-kicker">Infopunks thesis</p>
          <h2>{item}</h2>
          <p>{item === 'attention velocity can precede price action'
            ? 'Signal can arrive before conventional market consensus notices. Velocity itself becomes a data point.'
            : item === 'narrative assets require sovereignty checks'
              ? 'Before treating an asset as durable, check whether it can hold meaning without a single amplifier.'
              : 'Narrative compression can turn a social pattern into a market rail faster than fundamentals can catch up.'}</p>
        </article>)}
      </section>
    </main>
  </div>;
}

function SignalSurfacePage({ slug, expectedType }: { slug: string; expectedType: NarrativeSignalSurface['type'] }) {
  const [surface, setSurface] = useState<NarrativeSignalSurface | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NarrativeSignalSurface>(`/v1/signals/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (response.data.type !== expectedType) throw new Error('signal_surface_type_mismatch');
        setSurface(response.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'signal_surface_unavailable'));
  }, [slug, expectedType]);

  const cardsById = useMemo(() => new Map((surface?.cards ?? []).map((card) => [card.id, card])), [surface?.cards]);

  if (error && isNotFoundError(new Error(error))) {
    return <div className="shell narrative-shell"><main className="narrative-page"><section className="panel"><h1>Signal Not Found</h1><p>{slug}</p></section></main></div>;
  }

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#signal-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current={`/signals/${slug}`} />
    </header>
    <main id="signal-content" className="narrative-page">
      {error && !surface && <section className="panel"><p className="route-state error">{error}</p></section>}
      {surface && <>
        <section className="panel hero narrative-hero">
          <div>
            <p className="eyebrow">{surface.subtitle}</p>
            <h1>{surface.title}</h1>
            <p className="copy">{surface.thesis}</p>
            <p className="copy">{surface.disclaimer}</p>
          </div>
          <div className="panel narrative-hero-rail">
            <p className="section-kicker">Signal source</p>
            <p>{surface.signal_source}</p>
            <p className="section-kicker">Last updated</p>
            <p>{formatDate(surface.last_updated)}</p>
          </div>
        </section>

        {surface.asset && <section className="panel narrative-copy-panel">
          <p className="section-kicker">Mapped asset</p>
          <h2>{surface.asset.ticker} / {surface.asset.name}</h2>
          <p>{surface.asset.infopunk_verdict}</p>
        </section>}

        <section className="narrative-section-stack">
          {surface.sections.map((section) => <section key={section.id} className="panel narrative-report-section" aria-label={section.title}>
            <div className="narrative-section-head">
              <div>
                <p className="section-kicker">Narrative desk</p>
                <h2>{section.title}</h2>
              </div>
            </div>
            <p>{section.body}</p>
            <div className="narrative-card-grid">
              {section.card_ids.map((cardId) => {
                const card = cardsById.get(cardId);
                return card ? <NarrativeMetricCard key={card.id} card={card} /> : null;
              })}
            </div>
          </section>)}
        </section>

        {surface.asset && <NarrativeEvidenceList artifacts={surface.asset.evidence_artifacts} />}
      </>}
    </main>
  </div>;
}

export function SignalSourcePage({ slug }: { slug: string }) {
  return <SignalSurfacePage slug={slug} expectedType="signal_source" />;
}

export function NarrativeSignalReportPage({ slug }: { slug: string }) {
  return <SignalSurfacePage slug={slug} expectedType="signal_report" />;
}
