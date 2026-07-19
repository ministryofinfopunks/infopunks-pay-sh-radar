import React, { useState } from 'react';
import type { RhChainDataFreshness, RhChainSource } from '../data/rhChain';
import {
  calculateFreshness,
  formatAbsoluteUtc,
  formatRelativeAge,
  freshnessLabel,
  freshnessSourceMode,
  parseTimestamp
} from '../shared/timestamps';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { RadarProductNavigation } from './radarNetworks';

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

export type RhChainRequestFailure = {
  service: string;
  status: 'temporarily_unavailable';
  attemptedAt: string;
  endpoint: string;
  httpStatus: number | null;
  requestId: string | null;
  message: string;
};

export class RhChainApiError extends Error {
  constructor(readonly failure: RhChainRequestFailure) {
    super(failure.message);
    this.name = 'RhChainApiError';
  }
}

function safeRequestIdentifier(response: Response): string | null {
  const value = response.headers.get('x-request-id') ?? response.headers.get('x-trace-id');
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : null;
}

export async function fetchRhChain<T>(path: string, init?: RequestInit): Promise<RhChainEnvelope<T>> {
  const attemptedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(toApiUrl(getApiBaseUrl(), path), {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers }
    });
  } catch (error) {
    const failure: RhChainRequestFailure = {
      service: serviceNameForPath(path),
      status: 'temporarily_unavailable',
      attemptedAt,
      endpoint: path,
      httpStatus: null,
      requestId: null,
      message: error instanceof Error ? error.message : 'network_request_failed'
    };
    console.error('[rh-chain-api] request failed', failure);
    throw new RhChainApiError(failure);
  }
  const payload = await response.json().catch(() => null) as (RhChainEnvelope<T> & { error?: string }) | null;
  if (!response.ok || !payload || !('data' in payload) || !('meta' in payload)) {
    const failure: RhChainRequestFailure = {
      service: serviceNameForPath(path),
      status: 'temporarily_unavailable',
      attemptedAt,
      endpoint: path,
      httpStatus: response.ok ? null : response.status,
      requestId: safeRequestIdentifier(response),
      message: payload?.error || (response.ok ? 'invalid_rh_chain_envelope' : `request_failed_${response.status}`)
    };
    console.error('[rh-chain-api] request failed', failure);
    throw new RhChainApiError(failure);
  }
  return payload;
}

function serviceNameForPath(path: string): string {
  if (path.includes('/review-queue')) return 'review queue';
  if (path.includes('/4663-index')) return '4663 signal index';
  if (path.includes('/daily-receipts')) return 'daily receipts';
  if (path.includes('/launch-surfaces')) return 'launch surfaces';
  if (path.includes('/live-snapshot')) return 'live snapshot';
  if (path === '/v1/rh-chain/market') return 'market pulse';
  if (path.includes('/meme-pulse')) return 'meme pulse';
  return 'signal desk';
}

export function RhChainSuiteNav({ current }: { current: string }) {
  return <RadarProductNavigation context="robinhood-chain" current={current} className="narrative-toolbar rh-chain-suite-nav" />;
}

export function RhChainDisclaimer({ text, independent = false }: { text?: string; independent?: boolean }) {
  if (independent) {
    return <div className="rh-chain-legal-note" role="note" aria-label="Independent intelligence disclaimer">
      <strong>Independent Infopunks intelligence surface.</strong>
      <span>Not affiliated with or endorsed by Robinhood.</span>
      <small>No buy, sell, or listing recommendation.</small>
    </div>;
  }
  return text ? <p className="rh-chain-disclaimer">{text}</p> : null;
}

function latestObservedAt(envelope: RhChainEnvelope<unknown>): string | null {
  const candidates = envelope.sources
    .map((source) => ({ value: source.observed_at, parsed: parseTimestamp(source.observed_at) }))
    .filter((candidate): candidate is { value: string; parsed: number } => candidate.parsed !== null)
    .sort((left, right) => right.parsed - left.parsed);
  return candidates[0]?.value ?? (parseTimestamp(envelope.generated_at) === null ? null : envelope.generated_at);
}

function sourceModeLabel(mode: RhChainDataFreshness): string {
  if (mode === 'cached' || mode === 'live_cached') return 'Cached provider snapshot';
  if (mode === 'manual' || mode === 'seeded') return 'Manual snapshot';
  if (mode === 'persisted' || mode === 'community_submission') return 'Persisted review memory';
  if (mode === 'unavailable') return 'Unavailable';
  return 'Source required';
}

export function RhChainProvenance({ envelope, doctrine = RH_CHAIN_DOCTRINE }: { envelope: RhChainEnvelope<unknown>; doctrine?: string }) {
  const [now] = useState(() => Date.now());
  const observedAt = latestObservedAt(envelope);
  const state = calculateFreshness(observedAt, freshnessSourceMode(envelope.data_mode), now);
  return <div className="rh-chain-provenance" aria-label="Source policy and freshness">
    <div className="rh-chain-provenance-grid">
      <div><span>Source mode</span><strong>{sourceModeLabel(envelope.data_mode)}</strong></div>
      <div><span>Status</span><strong className={`freshness-${state}`}>{freshnessLabel(state)}</strong></div>
      <div className="rh-chain-observed-time"><span>Observed</span><strong>{formatAbsoluteUtc(observedAt)}</strong></div>
      <div><span>Relative age</span><strong>{formatRelativeAge(observedAt, now)}</strong></div>
      <div><span>Sources</span><strong>{envelope.sources.length || 'Source required'}</strong></div>
    </div>
    <div className="rh-chain-policy-copy"><span>Source policy</span><p>{envelope.meta.source_policy}</p></div>
    <div className="rh-chain-policy-copy"><span>Doctrine</span><p>{doctrine}</p></div>
  </div>;
}

function diagnosticsEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') return true;
    const flag = window.localStorage.getItem('radar_debug') ?? window.localStorage.getItem('debug');
    return flag === 'true' || flag === '1' || flag === 'on';
  } catch {
    return false;
  }
}

export function RhChainModuleDegradedNotice({ failure, moduleName, unaffectedCopy }: {
  failure: RhChainRequestFailure;
  moduleName: string;
  unaffectedCopy: string;
}) {
  const [showDiagnostics, setShowDiagnostics] = useState(() => diagnosticsEnabled());
  return <section className="rh-chain-module-notice" role="status" aria-live="polite" aria-label={`${moduleName} temporarily unavailable`}>
    <span className="rh-chain-state-mark" aria-hidden="true" />
    <div className="rh-chain-module-notice-copy">
      <p className="section-kicker">Module unavailable</p>
      <h2>{moduleName} temporarily unavailable.</h2>
      <p>{unaffectedCopy}</p>
    </div>
    {!showDiagnostics && <button className="rh-chain-diagnostic-trigger" type="button" onClick={() => setShowDiagnostics(true)}>Technical details</button>}
    {showDiagnostics && <div className="rh-chain-module-diagnostics" aria-label={`${moduleName} technical details`}>
      <div><span>service</span><strong>{failure.service}</strong></div>
      <div><span>status</span><strong>temporarily unavailable</strong></div>
      <div><span>last attempted</span><strong>{formatAbsoluteUtc(failure.attemptedAt)}</strong></div>
      {failure.requestId && <div><span>request id</span><strong>{failure.requestId}</strong></div>}
      <div><span>endpoint</span><strong>{failure.endpoint}</strong></div>
      <div><span>HTTP status</span><strong>{failure.httpStatus ?? 'unavailable'}</strong></div>
    </div>}
  </section>;
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
    <aside className="rh-chain-hero-rail"><RhChainProvenance envelope={envelope} doctrine={doctrine} /><RhChainDisclaimer text={disclaimer} /></aside>
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
