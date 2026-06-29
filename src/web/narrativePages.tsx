import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { getNarrativeMetadataForPath, NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';

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

type SignalEvidenceUpdateType = 'attention_shift' | 'holder_shift' | 'myth_shift' | 'risk_shift' | 'verdict_change';

type SignalEvidenceUpdate = {
  update_id: string;
  signal_slug: string;
  timestamp: string;
  update_type: SignalEvidenceUpdateType;
  summary: string;
  evidence_links: string[];
  previous_score?: number;
  new_score?: number;
  analyst_note: string;
};

type SignalEvidenceUpdateResponse = {
  signal_slug: string;
  count: number;
  updates: SignalEvidenceUpdate[];
  latest_update: SignalEvidenceUpdate | null;
  summary: string;
};

type SignalEvidenceUpdateDetailResponse = {
  signal_slug: string;
  update: SignalEvidenceUpdate;
};

const NARRATIVE_METHOD_STEPS = [
  'Detect Narrative Asset',
  'Map Signal Source',
  'Score Attention Velocity',
  'Check Power Concentration',
  'Track Reflexivity Risk',
  'Publish Versioned Evidence Updates'
] as const;

const BLACK_BULL_SHARE_LINES = [
  "$ANSEM is the market asking how much Ansem's attention is worth. Infopunks is asking who understands attention before it becomes price.",
  'Infopunks do not worship signal. Infopunks map signal.',
  'Solana is entering the attention-market era. Personas become liquidity. Memes become coordination rails.',
  'Reports are not final. Signals mutate.',
  'Infopunks Radar is watching the narratives that become markets.'
] as const;

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

function canonicalUrl(path: string) {
  return `${NARRATIVE_PUBLIC_HOST}${path}`;
}

function setMetaTag(attr: 'property' | 'name', key: string, content: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

function updateNarrativeMetadata({
  title,
  description,
  canonicalPath,
  type
}: {
  title: string;
  description: string;
  canonicalPath: string;
  type: 'website' | 'article';
}) {
  const url = canonicalUrl(canonicalPath);
  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:url', url);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setCanonicalLink(url);
}

function syncNarrativeMetadata(pathname: string) {
  const metadata = getNarrativeMetadataForPath(pathname);
  if (!metadata) return;
  updateNarrativeMetadata({
    title: metadata.title,
    description: metadata.description,
    canonicalPath: metadata.canonicalPath,
    type: 'website'
  });
}

async function copyText(value: string) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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

function signalUpdateTypeLabel(value: SignalEvidenceUpdateType) {
  switch (value) {
    case 'attention_shift':
      return 'Attention Shift';
    case 'holder_shift':
      return 'Holder / Power Shift';
    case 'myth_shift':
      return 'Myth Shift';
    case 'risk_shift':
      return 'Risk Shift';
    case 'verdict_change':
      return 'Verdict Change';
  }
}

function signalDelta(update: SignalEvidenceUpdate) {
  if (typeof update.previous_score !== 'number' || typeof update.new_score !== 'number') return null;
  const delta = update.new_score - update.previous_score;
  const prefix = delta > 0 ? '+' : '';
  return {
    value: delta,
    label: `${prefix}${delta}`,
    trajectory: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  };
}

function deskStatus(signal: NarrativeSignalSurface, updateCount: number) {
  if (signal.slug === 'black-bull') return 'Live Watch';
  if (!updateCount) return 'Seeded Report';
  return 'Needs Review';
}

function EvidenceChip({ href }: { href: string }) {
  return <a className="narrative-evidence-chip" href={href}>{href}</a>;
}

function SignalUpdateScoreDelta({ update }: { update: SignalEvidenceUpdate }) {
  const delta = signalDelta(update);
  if (!delta) return null;

  return <div className={`narrative-signal-delta ${delta.trajectory}`}>
    <span>Signal Delta</span>
    <strong>{update.previous_score} → {update.new_score} ({delta.label})</strong>
  </div>;
}

function DeskDispatchCard({ signalName, updateType }: { signalName: string; updateType: SignalEvidenceUpdateType }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = `Infopunks Signal Update: ${signalUpdateTypeLabel(updateType)} detected for ${signalName}. Reports are not final. Signals mutate.`;

  async function handleCopy() {
    const copied = await copyText(copy);
    setState(copied ? 'copied' : 'failed');
    window.setTimeout(() => setState('idle'), 1400);
  }

  const buttonLabel = state === 'copied' ? 'Copied' : state === 'failed' ? 'Failed to copy' : 'Copy Dispatch';

  return <section className="panel narrative-desk-dispatch" aria-label="Desk Dispatch">
    <div className="narrative-desk-dispatch-head">
      <div>
        <p className="section-kicker">Share-ready copy</p>
        <h2>Desk Dispatch</h2>
      </div>
      <button className="copy-chip" type="button" onClick={handleCopy} aria-label="Copy Desk Dispatch" aria-live="polite">{buttonLabel}</button>
    </div>
    <p className="narrative-desk-dispatch-copy">{copy}</p>
  </section>;
}

function SignalUpdateNotFound({ slug }: { slug: string }) {
  return <div className="shell narrative-shell">
    <main className="narrative-page" aria-label="Signal update not found">
      <section className="panel narrative-update-not-found">
        <p className="section-kicker">Narrative desk</p>
        <h1>Signal update not found.</h1>
        <p>This permalink does not match a known versioned evidence update.</p>
        <div className="panel-actions">
          <a className="execute" href={`/signals/${slug}`}>Back to signal</a>
          <a className="execute compact secondary" href="/narratives">Back to narratives</a>
        </div>
      </section>
    </main>
  </div>;
}

function LatestDeskUpdateChip({ latestUpdate }: { latestUpdate: SignalEvidenceUpdate | null }) {
  if (!latestUpdate) return null;

  return <section className="panel narrative-desk-chip" aria-label="Latest desk update">
    <div className="narrative-desk-chip-head">
      <div>
        <p className="section-kicker">Latest Desk Update</p>
        <h2>{signalUpdateTypeLabel(latestUpdate.update_type)}</h2>
      </div>
      <span className={`narrative-update-badge type-${latestUpdate.update_type}`}>{signalUpdateTypeLabel(latestUpdate.update_type)}</span>
    </div>
    <p>{latestUpdate.summary}</p>
    <div className="narrative-desk-chip-meta">
      <span>{formatDate(latestUpdate.timestamp)}</span>
      <a className="execute compact secondary" href="#living-evidence-feed">Open Living Evidence Feed</a>
    </div>
  </section>;
}

function ReportFreshnessCard({ surface, updateCount, latestUpdate }: {
  surface: NarrativeSignalSurface;
  updateCount: number;
  latestUpdate: SignalEvidenceUpdate | null;
}) {
  const status = deskStatus(surface, updateCount);

  return <article className="panel narrative-freshness-card" aria-label="Report freshness card">
    <div className="narrative-freshness-head">
      <div>
        <p className="section-kicker">Report Freshness</p>
        <h2>{status}</h2>
      </div>
      <span className="source-badge">{status}</span>
    </div>
    <div className="narrative-freshness-grid">
      <div><span>Last updated</span><strong>{formatDate(surface.last_updated)}</strong></div>
      <div><span>Evidence updates</span><strong>{updateCount}</strong></div>
      <div><span>Latest update type</span><strong>{latestUpdate ? signalUpdateTypeLabel(latestUpdate.update_type) : 'No updates'}</strong></div>
      <div><span>Desk status</span><strong>{status}</strong></div>
    </div>
  </article>;
}

function LivingEvidenceFeed({ updates, latestUpdate, summary }: {
  updates: SignalEvidenceUpdate[];
  latestUpdate: SignalEvidenceUpdate | null;
  summary: string;
}) {
  return <section id="living-evidence-feed" className="panel narrative-living-feed" aria-label="Living Evidence Feed">
    <div className="narrative-living-feed-head">
      <div>
        <p className="section-kicker">Living desk</p>
        <h2>Living Evidence Feed</h2>
        <p>Versioned updates tracking how the narrative changes over time.</p>
      </div>
      {latestUpdate && <span className={`narrative-update-badge type-${latestUpdate.update_type}`}>{signalUpdateTypeLabel(latestUpdate.update_type)}</span>}
    </div>
    <p className="narrative-feed-rally">Reports are not final. Signals mutate.</p>
    <p className="narrative-feed-summary">{summary}</p>
    {!updates.length && <div className="narrative-feed-empty">
      <p className="section-kicker">Static report mode</p>
      <p>No versioned evidence updates yet. This signal remains in static report mode.</p>
    </div>}
    {!!updates.length && <div className="timeline narrative-update-timeline">
      {updates.map((update) => {
        const delta = signalDelta(update);
        return <article key={update.update_id} className="panel narrative-update-card">
          <div className="narrative-update-head">
            <div>
              <p className="section-kicker">{formatDate(update.timestamp)}</p>
              <h3>{signalUpdateTypeLabel(update.update_type)}</h3>
            </div>
            <span className={`narrative-update-badge type-${update.update_type}`}>{signalUpdateTypeLabel(update.update_type)}</span>
          </div>
          <p>{update.summary}</p>
          {delta && <SignalUpdateScoreDelta update={update} />}
          <p className="narrative-analyst-note"><b>Analyst note:</b> {update.analyst_note}</p>
          <div className="panel-actions">
            <a className="execute compact secondary" href={`/signals/${update.signal_slug}/updates/${update.update_id}`}>Open Dispatch</a>
          </div>
          <div className="chips narrative-update-chips">
            {update.evidence_links.map((href) => <EvidenceChip key={`${update.update_id}-${href}`} href={href} />)}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

function NarrativeMethodModule() {
  return <section className="panel narrative-method-module" aria-label="Narrative Asset Intelligence Method">
    <div className="narrative-method-head">
      <div>
        <p className="section-kicker">Desk method</p>
        <h2>Narrative Asset Intelligence Method</h2>
        <p>Narrative Asset Intelligence treats attention, myth, wallet power, and reflexivity as one evidence desk.</p>
      </div>
    </div>
    <div className="narrative-method-grid">
      {NARRATIVE_METHOD_STEPS.map((step, index) => <article key={step} className="panel narrative-method-step">
        <p className="section-kicker">Step {index + 1}</p>
        <h3>{step}</h3>
      </article>)}
    </div>
  </section>;
}

function FeaturedNarrativeReport() {
  const metrics = [
    ['Signal Strength', 'High'],
    ['Myth Coherence', 'High'],
    ['Reflexivity Risk', 'High'],
    ['Sovereignty Status', 'Unproven']
  ] as const;

  return <section className="panel narrative-featured-report" aria-label="Featured ANSEM Black Bull report">
    <div className="narrative-featured-head">
      <div>
        <p className="section-kicker">First Narrative Asset Intelligence Report</p>
        <h2>$ANSEM / The Black Bull</h2>
        <p>A live signal report on what happens when persona, attention, myth, wallet flows, and market reflexivity become one tradable object.</p>
      </div>
      <span className="source-badge">Narrative Asset Intelligence</span>
    </div>
    <div className="narrative-featured-metrics">
      {metrics.map(([label, value]) => <div key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>)}
    </div>
    <div className="panel-actions">
      <a className="execute" href="/signals/black-bull">Open Signal Report</a>
      <a className="execute compact secondary" href="/narratives/attention-markets">Read Attention Markets Thesis</a>
    </div>
  </section>;
}

function ShareLinesModule() {
  return <section className="panel narrative-share-lines" aria-label="Share Lines">
    <div className="narrative-share-lines-head">
      <div>
        <p className="section-kicker">Field copy</p>
        <h2>Share Lines</h2>
      </div>
    </div>
    <div className="narrative-share-lines-grid">
      {BLACK_BULL_SHARE_LINES.map((line, index) => <article key={line} className="panel narrative-share-line-card">
        <p className="section-kicker">Line {index + 1}</p>
        <p>{line}</p>
      </article>)}
    </div>
  </section>;
}

function DoNotWorshipSignalCard() {
  return <section className="panel narrative-warning-card state-high_reflexivity" aria-label="Do Not Worship Signal">
    <div className="narrative-warning-head">
      <div>
        <p className="section-kicker">Sovereignty warning</p>
        <h2>Do Not Worship Signal</h2>
      </div>
      <span className="narrative-decision-pill state-high_reflexivity">high reflexivity</span>
    </div>
    <p>High signal does not mean low risk. Narrative assets can move fast because belief, liquidity, and attention reinforce each other. Infopunks maps the loop so readers do not get owned by it.</p>
  </section>;
}

function NarrativeLinkCluster({ links }: { links: Array<{ href: string; label: string }> }) {
  return <section className="panel narrative-link-cluster" aria-label="Related narrative routes">
    <p className="section-kicker">Desk links</p>
    <div className="chips narrative-route-chips">
      {links.map((link) => <a key={link.href} className="narrative-evidence-chip" href={link.href}>{link.label}</a>)}
    </div>
  </section>;
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
    syncNarrativeMetadata('/narratives');
  }, []);

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

      <FeaturedNarrativeReport />

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

  useEffect(() => {
    syncNarrativeMetadata('/narratives/attention-markets');
  }, []);

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

      <NarrativeMethodModule />
    </main>
  </div>;
}

function SignalSurfacePage({ slug, expectedType }: { slug: string; expectedType: NarrativeSignalSurface['type'] }) {
  const [surface, setSurface] = useState<NarrativeSignalSurface | null>(null);
  const [updates, setUpdates] = useState<SignalEvidenceUpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NarrativeSignalSurface>(`/v1/signals/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (response.data.type !== expectedType) throw new Error('signal_surface_type_mismatch');
        setSurface(response.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'signal_surface_unavailable'));
  }, [slug, expectedType]);

  useEffect(() => {
    api<SignalEvidenceUpdateResponse>(`/v1/signals/${encodeURIComponent(slug)}/updates`)
      .then((response) => setUpdates(response.data))
      .catch((err) => {
        if (isNotFoundError(err)) return;
        setError(err instanceof Error ? err.message : 'signal_updates_unavailable');
      });
  }, [slug]);

  const cardsById = useMemo(() => new Map((surface?.cards ?? []).map((card) => [card.id, card])), [surface?.cards]);
  const feedUpdates = updates?.updates ?? [];
  const latestUpdate = updates?.latest_update ?? null;
  const preVerdictSections = useMemo(() => (surface?.sections ?? []).filter((section) => section.id !== 'infopunk-verdict'), [surface?.sections]);
  const verdictSection = useMemo(() => (surface?.sections ?? []).find((section) => section.id === 'infopunk-verdict') ?? null, [surface?.sections]);

  useEffect(() => {
    if (!surface) return;
    syncNarrativeMetadata(`/signals/${surface.slug}`);
  }, [surface]);

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
            {surface.type === 'signal_report' && <p className="copy narrative-rally-line">Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.</p>}
          </div>
          <div className="panel narrative-hero-rail">
            <p className="section-kicker">Signal source</p>
            <p>{surface.signal_source}</p>
            <p className="section-kicker">Last updated</p>
            <p>{formatDate(surface.last_updated)}</p>
          </div>
        </section>

        {surface.type === 'signal_report' && <LatestDeskUpdateChip latestUpdate={latestUpdate} />}

        {surface.asset && <section className="panel narrative-copy-panel">
          <p className="section-kicker">Mapped asset</p>
          <h2>{surface.asset.ticker} / {surface.asset.name}</h2>
          <p>{surface.asset.infopunk_verdict}</p>
        </section>}

        {surface.type === 'signal_report' && <ReportFreshnessCard surface={surface} updateCount={updates?.count ?? 0} latestUpdate={latestUpdate} />}
        {surface.slug === 'ansem' && <NarrativeLinkCluster links={[
          { href: '/signals/black-bull', label: 'Black Bull Signal Report' },
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' }
        ]} />}
        {surface.slug === 'black-bull' && <NarrativeLinkCluster links={[
          { href: '/signals/ansem', label: 'Ansem Signal Source' },
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' },
          { href: '/narratives', label: 'Narrative Intel Index' }
        ]} />}

        <section className="narrative-section-stack">
          {(surface.type === 'signal_report' ? preVerdictSections : surface.sections).map((section) => <section key={section.id} className="panel narrative-report-section" aria-label={section.title}>
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

          {surface.slug === 'black-bull' && <DoNotWorshipSignalCard />}
          {surface.slug === 'black-bull' && <NarrativeMethodModule />}
          {surface.type === 'signal_report' && <LivingEvidenceFeed
            updates={feedUpdates}
            latestUpdate={latestUpdate}
            summary={updates?.summary ?? 'Evidence update summary: no evidence updates yet.'}
          />}
          {surface.slug === 'black-bull' && <ShareLinesModule />}

          {surface.type === 'signal_report' && verdictSection && <section key={verdictSection.id} className="panel narrative-report-section" aria-label={verdictSection.title}>
            <div className="narrative-section-head">
              <div>
                <p className="section-kicker">Narrative desk</p>
                <h2>{verdictSection.title}</h2>
              </div>
            </div>
            <p>{verdictSection.body}</p>
            <div className="narrative-card-grid">
              {verdictSection.card_ids.map((cardId) => {
                const card = cardsById.get(cardId);
                return card ? <NarrativeMetricCard key={card.id} card={card} /> : null;
              })}
            </div>
          </section>}
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

export function SignalUpdatePermalinkPage({ slug, updateId }: { slug: string; updateId: string }) {
  const [surface, setSurface] = useState<NarrativeSignalSurface | null>(null);
  const [updateDetail, setUpdateDetail] = useState<SignalEvidenceUpdateDetailResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const signalName = surface?.asset ? `${surface.asset.ticker} / ${surface.asset.name}` : surface?.title ?? slug;

  useEffect(() => {
    let active = true;
    setMissing(false);
    Promise.all([
      api<NarrativeSignalSurface>(`/v1/signals/${encodeURIComponent(slug)}`),
      api<SignalEvidenceUpdateDetailResponse>(`/v1/signals/${encodeURIComponent(slug)}/updates/${encodeURIComponent(updateId)}`)
    ])
      .then(([surfaceResponse, updateResponse]) => {
        if (!active) return;
        setSurface(surfaceResponse.data);
        setUpdateDetail(updateResponse.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isNotFoundError(error)) setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [slug, updateId]);

  useEffect(() => {
    if (!surface || !updateDetail) return;
    syncNarrativeMetadata(`/signals/${slug}/updates/${updateId}`);
  }, [signalName, slug, surface, updateDetail, updateId]);

  if (missing) return <SignalUpdateNotFound slug={slug} />;
  if (!surface || !updateDetail) return <div className="shell narrative-shell"><main className="narrative-page"><section className="panel"><p>Loading update dispatch...</p></section></main></div>;

  const update = updateDetail.update;

  return <div className="shell narrative-shell">
    <main className="narrative-page" aria-label="Signal update dispatch">
      <section className="panel narrative-update-permalink">
        <div className="narrative-update-permalink-head">
          <div>
            <p className="section-kicker">Versioned Evidence Update</p>
            <h1>{signalName}</h1>
            <p>{surface.subtitle}</p>
          </div>
          <span className={`narrative-update-badge type-${update.update_type}`}>{signalUpdateTypeLabel(update.update_type)}</span>
        </div>
        <div className="narrative-update-permalink-meta">
          <span>Signal: {surface.title}</span>
          <span>Timestamp: {formatDate(update.timestamp)}</span>
        </div>
        <p className="narrative-update-summary">{update.summary}</p>
        <SignalUpdateScoreDelta update={update} />
        <p className="narrative-analyst-note"><b>Analyst note:</b> {update.analyst_note}</p>
        <div className="chips narrative-update-chips">
          {update.evidence_links.map((href) => <EvidenceChip key={`${update.update_id}-${href}`} href={href} />)}
        </div>
        <div className="panel-actions">
          <a className="execute" href={`/signals/${slug}`}>Back to signal</a>
          <a className="execute compact secondary" href="/narratives/attention-markets">Attention Markets</a>
          <a className="execute compact secondary" href="/narratives">Narratives</a>
        </div>
      </section>
      <DeskDispatchCard signalName={signalName} updateType={update.update_type} />
    </main>
  </div>;
}
