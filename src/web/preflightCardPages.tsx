import React, { useEffect, useMemo, useState } from 'react';
import {
  getPreflightCardIndex,
  type PreflightCardIndexSection,
  type PreflightCardState,
  type PreflightCardViewModel,
  formatStateLabel,
  loadMachineServicePreflightCard,
  loadRadarPreflightCard
} from './preflightCardAdapters';

type RadarCardType = 'provider' | 'route' | 'benchmark' | 'artifact';

function setMetaTag(attr: 'property' | 'name', key: string, content: string) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function updateCardMetadata(card: PreflightCardViewModel | null, missingLabel: string) {
  const title = card ? `Infopunks Preflight Card: ${card.title}` : `Infopunks Preflight Card: ${missingLabel}`;
  const description = card
    ? `${formatStateLabel(card.state)} · ${card.verdict}`
    : `${missingLabel} was not found in the current Infopunks dataset.`;
  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:type', 'website');
  // TODO: Add generated OG images for preflight cards if this stack later supports dynamic image rendering.
}

function updateCardIndexMetadata() {
  const title = 'Preflight Card Index';
  const description = 'Browse public spend-safety labels for agent routes, benchmarks, providers, and machine services.';
  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:type', 'website');
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch {
    return false;
  }
}

function useCopyState() {
  const [state, setState] = useState<Record<string, 'idle' | 'copied' | 'failed'>>({});
  return {
    state,
    async run(key: string, value: string) {
      const copied = await copyText(value);
      setState((current) => ({ ...current, [key]: copied ? 'copied' : 'failed' }));
      window.setTimeout(() => {
        setState((current) => ({ ...current, [key]: 'idle' }));
      }, 1800);
    }
  };
}

function RadarCardNotFound({ type, id }: { type: string; id: string }) {
  useEffect(() => {
    updateCardMetadata(null, `${type} ${id}`);
  }, [type, id]);
  return <div className="shell preflight-card-shell">
    <main className="preflight-card-page" aria-label="Preflight card not found">
      <section className="panel preflight-card-panel">
        <p className="eyebrow">INFOPUNKS PREFLIGHT CARD</p>
        <h1>{type} card not found.</h1>
        <p className="copy">No public preflight card is available for <code>{id}</code>.</p>
        <a className="execute compact secondary" href="/">Back to Radar</a>
      </section>
    </main>
  </div>;
}

function stateTone(state: PreflightCardState) {
  if (state === 'ALLOW' || state === 'READY_FOR_INSPECTION') return 'allow';
  if (state === 'DENY') return 'deny';
  if (state === 'NO_WINNER') return 'neutral';
  return 'review';
}

function jsonDisplay(value: string | number | undefined) {
  return value ?? 'n/a';
}

function stateExplainer(card: PreflightCardViewModel) {
  if (card.state === 'NO_WINNER') return 'Radar refuses to declare a winner without enough comparable evidence.';
  if (card.state === 'PROOF_PLAN_READY') return 'Planning only · no execution claim.';
  if (card.state === 'NEEDS_EVIDENCE') return 'Not proven yet. More receipts or artifacts are needed before agents should trust spend here.';
  if (card.state === 'CATALOG_ONLY') return 'Catalog-visible only. This route or service is not proven yet.';
  return null;
}

function cardTypeLabel(card: PreflightCardViewModel) {
  return card.type === 'machine-service' ? 'machine service' : card.type;
}

function CardClipboardActions({ card }: { card: PreflightCardViewModel }) {
  const copy = useCopyState();
  return <div className="preflight-card-actions">
    <button className="execute compact" type="button" onClick={() => copy.run('tweet', card.tweetText)}>
      {copy.state.tweet === 'copied' ? 'Copied Tweet' : copy.state.tweet === 'failed' ? 'Tweet Copy Failed' : 'Copy Tweet'}
    </button>
    <button className="execute compact secondary" type="button" onClick={() => copy.run('json', JSON.stringify(card.agentJson, null, 2))}>
      {copy.state.json === 'copied' ? 'Copied JSON' : copy.state.json === 'failed' ? 'JSON Copy Failed' : 'Copy JSON'}
    </button>
  </div>;
}

function PreflightCardLayout({ card, backLabel }: { card: PreflightCardViewModel; backLabel: string }) {
  const copy = useCopyState();
  const stateLabel = useMemo(() => formatStateLabel(card.state), [card.state]);
  const explainer = useMemo(() => stateExplainer(card), [card]);
  useEffect(() => {
    updateCardMetadata(card, `${card.type} ${card.id}`);
  }, [card]);
  return <div className="shell preflight-card-shell">
    <main className="preflight-card-page" aria-label="Shareable Preflight Card">
      <section className={`panel preflight-card-panel state-${stateTone(card.state)}`}>
        <div className="preflight-card-head">
          <div>
            <p className="eyebrow">INFOPUNKS PREFLIGHT CARD</p>
            <p className="preflight-card-label">Agent spend safety label</p>
            <h1>{card.title}</h1>
            <p className="preflight-card-subtitle">{card.subtitle ?? card.type}</p>
          </div>
          <div className="preflight-card-head-actions">
            <a className="execute compact secondary" href="/radar/cards">Preflight Cards</a>
            <a className="execute compact secondary" href={card.sourcePath ?? '/'}>{backLabel}</a>
          </div>
        </div>
        <div className="preflight-card-flow">Discover &rarr; Check &rarr; Pay &rarr; Prove</div>
        <div className="preflight-card-state-row">
          <span className={`preflight-card-badge ${stateTone(card.state)}`}>{stateLabel}</span>
          <strong>{card.verdict}</strong>
        </div>
        {explainer && <p className="preflight-card-explainer">{explainer}</p>}
        <p className="preflight-card-guidance">{card.guidance}</p>
        <div className="preflight-card-stat-pills" aria-label="Preflight card quick stats">
          <span className="preflight-stat-pill"><b>Type</b>{card.type}</span>
          <span className="preflight-stat-pill"><b>Evidence</b>{jsonDisplay(card.evidenceCount)}</span>
          <span className="preflight-stat-pill"><b>Caveats</b>{jsonDisplay(card.caveatCount)}</span>
          <span className="preflight-stat-pill"><b>Trust</b>{jsonDisplay(card.trustScore)}</span>
          <span className="preflight-stat-pill"><b>Signal</b>{jsonDisplay(card.signalScore)}</span>
          {card.benchmarkState && <span className="preflight-stat-pill"><b>Benchmark</b>{card.benchmarkState}</span>}
          {card.readiness && <span className="preflight-stat-pill"><b>Readiness</b>{card.readiness}</span>}
          {card.policyState && <span className="preflight-stat-pill"><b>Policy</b>{card.policyState}</span>}
        </div>
        <div className="preflight-card-grid" aria-label="Preflight card details">
          <article className="wide"><span>latest artifact</span><strong>{card.latestArtifactId ?? 'No artifact recorded yet'}</strong></article>
          <article className="wide"><span>latest receipt</span><strong>{card.latestReceiptId ?? 'No receipt recorded yet'}</strong></article>
        </div>
        <p className="preflight-card-mantra">No receipt, no trust.</p>
        <div className="preflight-card-actions">
          <button className="execute compact" type="button" onClick={() => copy.run('tweet', card.tweetText)}>
            {copy.state.tweet === 'copied' ? 'Copied Tweet' : copy.state.tweet === 'failed' ? 'Tweet Copy Failed' : 'Copy Tweet'}
          </button>
          <button className="execute compact secondary" type="button" onClick={() => copy.run('json', JSON.stringify(card.agentJson, null, 2))}>
            {copy.state.json === 'copied' ? 'Copied JSON' : copy.state.json === 'failed' ? 'JSON Copy Failed' : 'Copy JSON'}
          </button>
        </div>
        <pre className="preflight-card-json" aria-label="Agent JSON preview"><code>{JSON.stringify(card.agentJson, null, 2)}</code></pre>
        <p className="panel-caption preflight-card-footnote">
          Canonical card: <a href={card.canonicalPath}>{card.canonicalPath}</a>
        </p>
      </section>
    </main>
  </div>;
}

export function RadarPreflightCardPage({ type, id }: { type: RadarCardType; id: string }) {
  const [card, setCard] = useState<PreflightCardViewModel | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    setCard(null);
    setMissing(false);
    loadRadarPreflightCard(type, id)
      .then((response) => {
        if (!active) return;
        if (!response) {
          setMissing(true);
          return;
        }
        setCard(response);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [type, id]);
  if (missing) return <RadarCardNotFound type={type} id={id} />;
  if (!card) return <main className="boot">LOADING PREFLIGHT CARD...</main>;
  return <PreflightCardLayout card={card} backLabel="Back to Radar" />;
}

export function MachineMarketPreflightCardPage({ id }: { id: string }) {
  const [card, setCard] = useState<PreflightCardViewModel | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    setCard(null);
    setMissing(false);
    loadMachineServicePreflightCard(id)
      .then((response) => {
        if (!active) return;
        if (!response) {
          setMissing(true);
          return;
        }
        setCard(response);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (missing) return <RadarCardNotFound type="machine-service" id={id} />;
  if (!card) return <main className="boot">LOADING PREFLIGHT CARD...</main>;
  return <PreflightCardLayout card={card} backLabel="Back to Machine Market" />;
}

function PreflightCardIndexTile({ card }: { card: PreflightCardViewModel }) {
  const stateLabel = useMemo(() => formatStateLabel(card.state), [card.state]);
  const explainer = useMemo(() => stateExplainer(card), [card]);
  return <article className={`panel preflight-index-tile state-${stateTone(card.state)}`}>
    <div className="preflight-index-tile-head">
      <span className={`preflight-card-badge ${stateTone(card.state)}`}>{stateLabel}</span>
      <span className="preflight-card-label preflight-index-tag">Agent spend safety label</span>
    </div>
    <div className="preflight-index-title-block">
      <h3>{card.title}</h3>
      <p className="preflight-index-subtitle">{card.subtitle ?? cardTypeLabel(card)}</p>
    </div>
    <div className="preflight-card-stat-pills" aria-label={`${card.title} quick stats`}>
      <span className="preflight-stat-pill"><b>Type</b>{cardTypeLabel(card)}</span>
      <span className="preflight-stat-pill"><b>Evidence</b>{jsonDisplay(card.evidenceCount)}</span>
      <span className="preflight-stat-pill"><b>Caveats</b>{jsonDisplay(card.caveatCount)}</span>
      {typeof card.trustScore === 'number' && <span className="preflight-stat-pill"><b>Trust</b>{card.trustScore}</span>}
      {typeof card.signalScore === 'number' && <span className="preflight-stat-pill"><b>Signal</b>{card.signalScore}</span>}
    </div>
    <p className="preflight-index-verdict">{card.verdict}</p>
    {explainer && <p className="preflight-card-explainer">{explainer}</p>}
    <p className="preflight-card-guidance">{card.guidance}</p>
    <div className="preflight-index-actions">
      <a className="execute compact" href={card.canonicalPath}>Open Card</a>
      <CardClipboardActions card={card} />
    </div>
  </article>;
}

function PreflightCardIndexSectionView({ section }: { section: PreflightCardIndexSection }) {
  return <section className="preflight-index-section" aria-labelledby={section.id}>
    <div className="preflight-index-section-head">
      <div>
        <p className="eyebrow">PUBLIC GALLERY</p>
        <h2 id={section.id}>{section.title}</h2>
      </div>
      <p className="panel-caption">{section.description}</p>
    </div>
    {!!section.cards.length && <div className="preflight-index-grid">
      {section.cards.map((card) => <PreflightCardIndexTile key={card.canonicalPath} card={card} />)}
    </div>}
    {!section.cards.length && <div className="panel preflight-index-empty">
      <p className="preflight-card-label">No public cards yet</p>
      <p className="copy">{section.emptyMessage ?? 'No public cards are available in this section yet.'}</p>
    </div>}
  </section>;
}

export function PreflightCardIndexPage() {
  const [sections, setSections] = useState<PreflightCardIndexSection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    updateCardIndexMetadata();
    setSections(null);
    setFailed(false);
    getPreflightCardIndex()
      .then((response) => {
        if (!active) return;
        setSections(response);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <div className="shell preflight-card-shell">
    <main className="preflight-card-page" aria-label="Preflight card index unavailable">
      <section className="panel preflight-card-panel">
        <p className="eyebrow">PREFLIGHT CARD INDEX</p>
        <h1>Preflight Card Index unavailable.</h1>
        <p className="copy">The public gallery could not load from the current Infopunks dataset.</p>
        <a className="execute compact secondary" href="/">Back to Radar</a>
      </section>
    </main>
  </div>;

  if (!sections) return <main className="boot">LOADING PREFLIGHT CARD INDEX...</main>;

  return <div className="shell preflight-card-shell">
    <main className="preflight-card-page preflight-index-page" aria-label="Preflight Card Index">
      <section className="panel preflight-index-hero">
        <p className="eyebrow">INFOPUNKS PREFLIGHT CARDS</p>
        <h1>Preflight Card Index</h1>
        <p className="copy">Browse public spend-safety labels for agent routes, benchmarks, providers, and machine services.</p>
        <div className="preflight-card-flow">Discover &rarr; Check &rarr; Pay &rarr; Prove</div>
        <p className="preflight-card-mantra">No receipt, no trust.</p>
        <p className="preflight-index-hero-quote">My agent checked Infopunks before it spent.</p>
        <p className="panel-caption">Shareable agent spend safety labels for the agentic and machine economy.</p>
      </section>
      {sections.map((section) => <PreflightCardIndexSectionView key={section.id} section={section} />)}
    </main>
  </div>;
}
