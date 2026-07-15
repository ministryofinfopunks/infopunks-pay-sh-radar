import React from 'react';
import type { RhChainDataFreshness, RhChainSource } from '../data/rhChain';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

export const RH_CHAIN_DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.';

export type RhChainEnvelope<T> = {
  data: T;
  meta: {
    source_policy: string;
    record_count: number | null;
    provider_status: Array<{ provider_name: string; data_mode: string; live_indexing_enabled: boolean }>;
    live_indexing_enabled: false;
  };
  sources: RhChainSource[];
  generated_at: string;
  data_mode: RhChainDataFreshness;
  disclaimer: string;
};

export async function fetchRhChain<T>(path: string, init?: RequestInit): Promise<RhChainEnvelope<T>> {
  const response = await fetch(toApiUrl(getApiBaseUrl(), path), {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers }
  });
  const payload = await response.json().catch(() => null) as (RhChainEnvelope<T> & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error || `${path} ${response.status}`);
  if (!payload || !('data' in payload) || !('meta' in payload)) throw new Error('invalid_rh_chain_envelope');
  return payload;
}

const NAV_LINKS = [
  ['/rh-chain-signal-desk', 'Signal Desk'],
  ['/rh-chain-signal-desk/meme-pulse', 'Meme Pulse'],
  ['/rh-chain-signal-desk/daily-receipts', 'Receipts'],
  ['/rh-chain-signal-desk/4663-index', '4663 Index'],
  ['/rh-chain-signal-desk/review-queue', 'Review'],
  ['/rh-chain-signal-desk/clone-radar', 'Risk'],
  ['/rh-chain-signal-desk/risk-patterns', 'Patterns'],
  ['/rh-chain-signal-desk/scouts', 'Scouts'],
  ['/rh-chain-signal-desk/scout', 'Scout'],
  ['/rh-chain-signal-desk/launch-surfaces', 'Surfaces'],
  ['/rh-chain-signal-desk/launchpad-observatory', 'Observatory'],
  ['/rh-chain-signal-desk/live-snapshot', 'Snapshot'],
  ['/rh-chain-signal-desk/distribution-pack', 'Distribution'],
  ['/rh-chain-signal-desk/submit', 'Submit']
] as const;

export function RhChainSuiteNav({ current }: { current: string }) {
  return <nav className="global-toolbar narrative-toolbar rh-chain-suite-nav" aria-label="RH Chain navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Radar home"><span>Infopunks</span><strong>RH Chain</strong></a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="RH Chain routes">
      {NAV_LINKS.map(([href, label]) => <a key={href} href={href} className={current === href ? 'active' : ''} aria-current={current === href ? 'page' : undefined}>{label}</a>)}
    </div>
    <a className="methodology-trigger rh-chain-api-link" href="/openapi.json">API</a>
  </nav>;
}

function formatObservedAt(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Timestamp required';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

function freshnessLabel(envelope: RhChainEnvelope<unknown>) {
  if (envelope.data_mode === 'unavailable') return 'Unavailable';
  if (envelope.data_mode === 'live_future') return 'Source required';
  const timestamps = envelope.sources.map((source) => Date.parse(source.observed_at)).filter(Number.isFinite);
  if (!timestamps.length) return 'Timestamp required';
  const latest = Math.max(...timestamps);
  const ageHours = Math.max(0, (Date.now() - latest) / 3_600_000);
  if (ageHours <= 36) return 'Fresh';
  if (ageHours <= 72) return 'Aging';
  return 'Stale';
}

export function RhChainProvenance({ envelope, doctrine = RH_CHAIN_DOCTRINE }: { envelope: RhChainEnvelope<unknown>; doctrine?: string }) {
  return <div className="rh-chain-provenance" aria-label="Source policy and freshness">
    <div className="rh-chain-provenance-grid">
      <div><span>Data mode</span><strong>{envelope.data_mode.replaceAll('_', ' ')}</strong></div>
      <div><span>Freshness</span><strong className={`freshness-${freshnessLabel(envelope).toLowerCase().replaceAll(' ', '-')}`}>{freshnessLabel(envelope)}</strong></div>
      <div><span>As of</span><strong>{formatObservedAt(envelope.generated_at)}</strong></div>
      <div><span>Sources</span><strong>{envelope.sources.length || 'Source required'}</strong></div>
    </div>
    <div className="rh-chain-policy-copy"><span>Source policy</span><p>{envelope.meta.source_policy}</p></div>
    <div className="rh-chain-policy-copy"><span>Doctrine</span><p>{doctrine}</p></div>
  </div>;
}

export function RhChainHero({ eyebrow, title, copy, line, envelope, doctrine, disclaimer, primaryCta, secondaryCta }: {
  eyebrow: string;
  title: React.ReactNode;
  copy: string;
  line?: string;
  envelope: RhChainEnvelope<unknown>;
  doctrine?: string;
  disclaimer?: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
  return <section className="panel hero rh-chain-hero rh-chain-unified-hero">
    <div className="rh-chain-hero-copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="copy">{copy}</p>{line && <p className="copy narrative-rally-line">{line}</p>}
      <div className="panel-actions rh-chain-primary-actions"><a className="execute" href={primaryCta.href}>{primaryCta.label}</a>{secondaryCta && <a className="execute compact secondary" href={secondaryCta.href}>{secondaryCta.label}</a>}</div>
    </div>
    <aside className="rh-chain-hero-rail"><RhChainProvenance envelope={envelope} doctrine={doctrine} />{disclaimer && <p className="rh-chain-disclaimer">{disclaimer}</p>}</aside>
  </section>;
}

export function RhChainRouteState({ state, title, detail, onRetry }: { state: 'loading' | 'empty' | 'source_required' | 'stale' | 'unavailable'; title?: string; detail?: string; onRetry?: () => void }) {
  const copy = {
    loading: ['Opening intelligence file…', 'Loading source-stamped public memory.'],
    empty: ['No reviewed memory yet', 'Nothing is promoted from absence. Add a source-linked signal for human review.'],
    source_required: ['Source required', 'Identity and judgment remain unknown until a timestamped source is attached.'],
    stale: ['Context is stale', 'The record remains visible, but it should not be treated as current until refreshed.'],
    unavailable: ['Context unavailable', 'A provider can fail without changing reviewed memory. Try again or continue with receipts.']
  }[state];
  return <section className={`panel rh-chain-state rh-chain-state-${state}`} aria-live="polite" aria-busy={state === 'loading'}>
    <span className="rh-chain-state-mark" aria-hidden="true" />
    <div><p className="section-kicker">{state.replaceAll('_', ' ')}</p><h2>{title ?? copy[0]}</h2><p>{detail ?? copy[1]}</p></div>
    {onRetry && <button className="execute compact secondary" type="button" onClick={onRetry}>Retry</button>}
  </section>;
}
