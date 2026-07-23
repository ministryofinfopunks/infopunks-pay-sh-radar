import { useEffect, useMemo, useState } from 'react';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  RhPulseResponseSchema
} from '../../shared/rhPulse';
import {
  getRhPulseClientResolution,
  getRhPulseMetadata,
  type RhPulseRoute
} from '../../shared/rhPulseRouting';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import { RhPulseCallCards } from './RhPulseCallCards';
import { RhPulseCallPreview } from './RhPulseCallPreview';
import { RhPulseHeader } from './RhPulseHeader';
import { RhPulseHero } from './RhPulseHero';
import { RhPulseLayerFlowMap } from './RhPulseLayerFlowMap';
import { RhPulseMethodology } from './RhPulseMethodology';
import { RhPulsePublicCallPage } from './RhPulsePublicCallPage';
import { RhPulseSigningSheet } from './RhPulseSigningSheet';
import { RhPulseStructureStrip } from './RhPulseStructureStrip';
import type { RhPulseCallOption, RhPulsePageData } from './rhPulseTypes';
import './rhPulse.css';

const PULSE_API_TIMEOUT_MS = 5_000;

export function RhPulsePage({ route }: { route: RhPulseRoute }) {
  const [data, setData] = useState<RhPulsePageData | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<RhPulseCallOption['id'] | null>(() => restoredCallSelection());
  const [signingOpen, setSigningOpen] = useState(false);
  const reservedRoute = route.kind === 'receipt' || route.kind === 'not_found';
  const readsFirstPage = route.kind === 'home' || route.kind === 'methodology';
  const clientResolution = useMemo(() => getRhPulseClientResolution(window.location, window.__RH_PULSE_CONTEXT__), []);
  const homeHref = clientResolution.isPulseHost ? '/' : '/rh-pulse';
  const methodologyHref = clientResolution.isPulseHost ? '/methodology' : '/rh-pulse/methodology';

  useEffect(() => {
    document.body.classList.add('rh-pulse-document');
    applyRhPulseDocumentMetadata();
    return () => document.body.classList.remove('rh-pulse-document');
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    persistCallSelection(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!readsFirstPage) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setError(true);
      controller.abort();
    }, PULSE_API_TIMEOUT_MS);
    setError(false);
    fetch(toApiUrl(getApiBaseUrl(), '/v1/rh-pulse'), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) {
          throw new Error('rh_pulse_read_unavailable');
        }
        const parsed = RhPulseResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('rh_pulse_schema_mismatch');
        setData(parsed.data.data);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setError(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [readsFirstPage]);

  if (route.kind === 'call') {
    return <RhPulsePublicCallPage
      callId={route.id}
      homeHref={homeHref}
      methodologyHref={methodologyHref}
    />;
  }

  if (reservedRoute) {
    return <div className="rh-pulse-app">
      <div className="rh-pulse-ambient" aria-hidden="true" />
      <main className="rh-pulse-shell">
        <RhPulseHeader freshness="unavailable" homeHref={homeHref} />
        <section className="rh-pulse-reserved-route">
          <p className="rh-pulse-kicker">Public record boundary</p>
          <h1>{route.kind === 'receipt' ? 'Receipt route reserved.' : 'Signal route not found.'}</h1>
          <p>
            {route.kind === 'receipt'
                ? `Receipt ${route.id} has not been generated. RH Pulse does not invent receipts.`
                : 'This RH Pulse path is not part of the public surface.'}
          </p>
          <a href={homeHref}>Return to Call the Rotation</a>
        </section>
        <RhPulseFooter methodologyHref={methodologyHref} />
      </main>
    </div>;
  }

  const selected = data?.call_options.find((option) => option.id === selectedId) ?? null;
  return <div className="rh-pulse-app">
    <div className="rh-pulse-ambient" aria-hidden="true" />
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness={data?.source_health.overall ?? 'unavailable'} loading={!data && !error} homeHref={homeHref} />
      <RhPulseHero hero={data?.hero} />
      {error && <div className="rh-pulse-read-notice" role="status">
        <strong>Reviewed connection memory is temporarily unavailable.</strong>
        <span>RH Pulse is withholding live strength and structural claims until a validated read returns.</span>
      </div>}
      <RhPulseLayerFlowMap
        connections={data?.connections}
        strongest={data?.strongest_current_signal}
      />

      {data && <>
        <RhPulseStructureStrip statements={data.structural_statements} />
        <RhPulseCallCards options={data.call_options} selectedId={selectedId} onSelect={setSelectedId} />
        <RhPulseMethodology
          methodology={data.methodology}
          sourceHealth={data.source_health}
          expanded={route.kind === 'methodology'}
        />
      </>}

      {!data && !error && <p className="rh-pulse-loading-detail" role="status" aria-live="polite">
        Loading reviewed memory. No connection strength is inferred while the read is pending.
      </p>}
      <RhPulseFooter methodologyHref={methodologyHref} />
    </main>
    {selected && <RhPulseCallPreview
      selected={selected}
      callsEnabled={data?.calls_enabled ?? false}
      acceptingCalls={data?.current_window.accepting_calls ?? false}
      onSign={() => setSigningOpen(true)}
    />}
    {selected && signingOpen && <RhPulseSigningSheet selected={selected} onClose={() => setSigningOpen(false)} />}
  </div>;
}

function RhPulseFooter({ methodologyHref }: { methodologyHref: string }) {
  return <footer className="rh-pulse-footer">
    <div>
      <span>RH PULSE / INFOPUNKS</span>
      <a href={methodologyHref}>Methodology</a>
      <a href="https://radar.infopunks.fun/rh-chain-signal-desk">Shared Radar engine</a>
    </div>
    <p>{RH_PULSE_INDEPENDENCE_DISCLAIMER}</p>
  </footer>;
}

function applyRhPulseDocumentMetadata() {
  const resolution = getRhPulseClientResolution(window.location, window.__RH_PULSE_CONTEXT__);
  const metadata = getRhPulseMetadata(resolution);
  if (!metadata) return;
  document.title = metadata.title;
  setMeta('name', 'description', metadata.description);
  setMeta('name', 'theme-color', metadata.themeColor);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:title', metadata.ogTitle);
  setMeta('property', 'og:description', metadata.ogDescription);
  setMeta('property', 'og:url', metadata.ogUrl);
  setMeta('name', 'twitter:card', metadata.twitterCard);
  setMeta('name', 'twitter:title', metadata.twitterTitle);
  setMeta('name', 'twitter:description', metadata.twitterDescription);
  document.head.querySelectorAll('meta[property^="og:image"], meta[name="twitter:image"]').forEach((element) => element.remove());
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = metadata.canonicalUrl;
  let structured = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (!structured) {
    structured = document.createElement('script');
    structured.type = 'application/ld+json';
    document.head.append(structured);
  }
  structured.textContent = JSON.stringify(metadata.structuredData);
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.append(tag);
  }
  tag.content = content;
}

const RH_PULSE_SELECTION_KEY = 'rh-pulse:selected-outcome:v1';
const RH_PULSE_CALL_IDS: RhPulseCallOption['id'][] = [
  'agents_to_rwas',
  'memes_to_agents',
  'memes_to_rwas',
  'no_qualified_rotation'
];

function restoredCallSelection(): RhPulseCallOption['id'] | null {
  try {
    const queryValue = new URL(window.location.href).searchParams.get('call');
    if (isCallId(queryValue)) return queryValue;
    const stored = window.sessionStorage.getItem(RH_PULSE_SELECTION_KEY);
    return isCallId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistCallSelection(id: RhPulseCallOption['id']) {
  try {
    window.sessionStorage.setItem(RH_PULSE_SELECTION_KEY, id);
    const url = new URL(window.location.href);
    url.searchParams.set('call', id);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Selection remains in React state when privacy mode blocks storage/history.
  }
}

function isCallId(value: string | null): value is RhPulseCallOption['id'] {
  return Boolean(value && RH_PULSE_CALL_IDS.includes(value as RhPulseCallOption['id']));
}
