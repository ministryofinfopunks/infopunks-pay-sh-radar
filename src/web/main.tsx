import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MethodologyDrawer } from './methodology';
import { getApiBaseUrl } from './apiBaseUrl';
import './styles.css';

type Severity = 'critical' | 'warning' | 'informational' | 'unknown';
type EvidenceReceipt = { event_id?: string | null; eventId?: string | null; provider_id?: string | null; providerId?: string | null; endpoint_id?: string | null; endpointId?: string | null; observed_at?: string | null; observedAt?: string | null; catalog_generated_at?: string | null; catalogGeneratedAt?: string | null; ingested_at?: string | null; ingestedAt?: string | null; source?: string | null; derivation_reason?: string | null; derivationReason?: string | null; confidence?: number | null; severity?: Severity | string | null; severity_reason?: string | null; severityReason?: string | null; severity_score?: number | null; severityScore?: number | null; severity_window?: string | null; severityWindow?: string | null; summary?: string | null; evidence?: EvidenceReceipt | EvidenceReceipt[] | Record<string, EvidenceReceipt[]> | null };
type Pricing = EvidenceReceipt & { min: number | null; max: number | null; clarity: string; raw: string };
type Provider = EvidenceReceipt & { id: string; name: string; title?: string; namespace: string; fqn?: string; category: string; description: string | null; useCase?: string | null; serviceUrl?: string | null; endpointCount: number; endpointMetadataPartial?: boolean; hasMetering?: boolean; hasFreeTier?: boolean; sourceSha?: string | null; catalogGeneratedAt?: string | null; pricing: Pricing; tags: string[]; status: string; lastSeenAt?: string; latestTrustScore?: number | null; latestTrustGrade?: string; latestSignalScore?: number | null };
type Endpoint = EvidenceReceipt & { id: string; providerId: string; name: string; path: string | null; method: string | null; category: string; description: string | null; status: string; pricing: Pricing; lastSeenAt: string; latencyMsP50: number | null; routeEligible?: boolean | null };
type TrustAssessment = EvidenceReceipt & { entityId: string; score: number | null; grade: string; components: Record<string, number | null>; unknowns: string[] };
type SignalAssessment = EvidenceReceipt & { entityId: string; score: number | null; narratives: string[]; components: Record<string, number | null>; unknowns: string[] };
type Narrative = EvidenceReceipt & { id: string; title: string; heat: number | null; momentum: number | null; providerIds: string[]; keywords: string[]; summary: string };
type DataSource = { mode: 'live_pay_sh_catalog' | 'fixture_fallback'; url: string | null; generated_at: string | null; provider_count: number | null; last_ingested_at: string | null; used_fixture: boolean; error?: string | null };
type Pulse = { providerCount: number; endpointCount: number; eventCount: number; averageTrust: number | null; averageSignal: number | null; hottestNarrative: Narrative | null; topTrust: TrustAssessment[]; topSignal: SignalAssessment[]; interpretations?: EcosystemInterpretation[]; data_source: DataSource; updatedAt: string };
type HistoryItem = EvidenceReceipt & { id: string; type: string; observedAt: string; source: string; summary: string };
type ProviderDetail = { provider: Provider; endpoints: Endpoint[]; trustAssessment: TrustAssessment | null; signalAssessment: SignalAssessment | null };
type ProviderIntelligence = EvidenceReceipt & {
  provider?: Provider;
  latest_trust_score: number | null;
  latest_signal_score: number | null;
  risk_level: string;
  coordination_eligible: boolean | null;
  unknown_telemetry: string[];
  recent_changes: HistoryItem[];
  endpoint_count: number;
  endpoint_health: { healthy: number; degraded: number; failed: number; unknown: number; last_checked_at: string | null; median_latency_ms: number | null; recent_failures: HistoryItem[] };
  service_monitor: EvidenceReceipt & {
    status: 'reachable' | 'degraded' | 'failed' | 'unknown';
    service_url: string | null;
    last_checked_at: string | null;
    response_time_ms: number | null;
    status_code: number | null;
    monitor_mode: 'SAFE METADATA' | 'UNKNOWN';
    check_type: string | null;
    safe_mode: boolean;
    explanation: string;
  };
  propagation_context?: { propagation_state: PropagationAnalysis['propagation_state']; severity: PropagationAnalysis['severity']; affected: boolean; affected_cluster: string | null; propagation_reason: string };
  category_tags: string[];
  last_seen_at: string | null;
  endpoints?: Endpoint[];
  endpointList?: Endpoint[];
};
type EndpointMonitor = { health: string; lastCheck: { observedAt: string; payload: Record<string, unknown> } | null; recentFailures: HistoryItem[] };
type EventCategory = 'discovery' | 'trust' | 'monitoring' | 'pricing' | 'schema' | 'signal';
type PulseEvent = EvidenceReceipt & { id: string; type: string; category: EventCategory; source: string; entityType: string; entityId: string; providerId: string | null; providerName: string | null; observedAt: string; summary: string };
type ScoreDelta = EvidenceReceipt & { eventId: string; providerId: string; providerName: string; score: number | null; previousScore: number | null; delta: number | null; observedAt: string; direction: string };
type ProviderActivity = EvidenceReceipt & { providerId: string; providerName: string; count: number; categories: Record<EventCategory, number>; lastObservedAt: string | null };
type PropagationAnalysis = {
  cluster_id?: string;
  clusterId?: string;
  propagation_state: 'isolated' | 'clustered' | 'spreading' | 'systemic' | 'unknown';
  propagation_reason: string;
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: { provider_id: string; providerId?: string; provider_name: string; providerName?: string; category: string; tags: string[]; event_count: number; eventCount?: number }[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  supporting_event_ids: string[];
  supporting_event_count?: number;
  remaining_event_count?: number;
  view_full_receipts_url?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
};
type PropagationIncident = {
  cluster_id: string;
  propagation_state: 'isolated' | 'clustered' | 'spreading' | 'systemic' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: { provider_id: string; provider_name: string }[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  propagation_reason: string;
  confidence: number;
  supporting_event_ids: string[];
  supporting_receipt_links: { event_id: string; href: string }[];
  related_interpretation_links: { interpretation_id: string; title: string; href: string }[];
  related_provider_links: { provider_id: string; provider_name: string; href: string }[];
  current_status: 'active' | 'monitoring' | 'unknown';
  timeline: { event_id: string; type: string; category: string; provider_id: string | null; provider_name: string | null; observed_at: string; summary: string; severity: Severity }[];
};
type EcosystemInterpretation = EvidenceReceipt & {
  interpretation_id: string;
  interpretation_title: string;
  interpretation_summary: string;
  interpretation_reason: string;
  affected_categories: string[];
  affected_providers: string[];
  supporting_event_ids: string[];
  supporting_event_count?: number;
  remaining_event_count?: number;
  view_full_receipts_url?: string;
  confidence: number;
  severity: 'stable' | 'info' | 'watch' | 'warning' | 'critical';
  observed_window: { started_at: string | null; ended_at: string | null; event_count: number };
  evidence?: EvidenceReceipt;
};
type PulseSummary = {
  generatedAt: string;
  latest_event_at: string | null;
  latest_batch_event_count: number;
  ingest_interval_ms: number | null;
  latest_ingestion_run: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
    discoveredCount: number;
    changedCount: number;
    emittedEvents: number;
    usedFixture: boolean;
    source: string;
  } | null;
  counters: { providers: number; endpoints: number; events: number; narratives: number; unknownTelemetry: number };
  eventGroups: Record<EventCategory, { count: number; recent: PulseEvent[] }>;
  timeline: PulseEvent[];
  trustDeltas: ScoreDelta[];
  signalDeltas: ScoreDelta[];
  recentDegradations: PulseEvent[];
  propagation: PropagationAnalysis;
  providerActivity: Record<'1h' | '24h' | '7d', ProviderActivity[]>;
  signalSpikes: ScoreDelta[];
  interpretations: EcosystemInterpretation[];
  data_source: DataSource;
};

type AppData = { providers: Provider[]; pulse: Pulse; narratives: Narrative[]; graph: { nodes: unknown[]; edges: unknown[]; evidence?: EvidenceReceipt } };
type ReceiptRecord = {
  event_id: string;
  event_type: string;
  provider_id: string | null;
  endpoint_id: string | null;
  severity: string;
  severity_reason: string;
  observed_at: string | null;
  catalog_generated_at: string | null;
  ingested_at: string | null;
  source: string;
  derivation_reason: string;
  confidence: number | null;
  summary: Record<string, unknown>;
  raw_summary: string;
  links: {
    provider: { provider_id: string; provider_name: string; url: string } | null;
    provider_dossier: string | null;
    interpretations: { interpretation_id: string; title: string; url: string }[];
    propagation_cluster: { cluster: string | null; state: string; severity: string; url: string } | null;
  };
};
type FeaturedProvider = { providerId: string | null; providerName: string | null; category: string | null; rotationWindowMs: number; windowStartedAt: string; nextRotationAt: string; index: number | null; providerCount: number; strategy: 'time_window_round_robin' };
type RoutePreference = 'cheapest' | 'highest_trust' | 'highest_signal' | 'balanced';
type RouteResult = {
  bestProvider: Provider | null;
  fallbackProviders: Provider[];
  fallbackDetails?: { provider: Provider; trustAssessment: TrustAssessment; signalAssessment: SignalAssessment; rank: number; relevance: number; riskNotes: string[] }[];
  reasoning: string[];
  estimatedCost: Provider['pricing'] | null;
  trustAssessment: TrustAssessment | null;
  signalAssessment: SignalAssessment | null;
  riskNotes: string[];
  preference?: RoutePreference;
  scoringInputs?: { source: 'LIVE PAY.SH CATALOG'; preference: RoutePreference; preferredProviderId: string | null };
  excludedProviders?: { provider: Provider; reasons: string[] }[];
  unknownTelemetry?: string[];
  rationale?: string[];
  coordinationScore?: number | null;
  selectedProviderNotRecommendedReason?: string | null;
};
type SearchResponse = { data: any[]; degraded?: boolean; reason?: string };
type ErrorBoundaryState = { hasError: boolean };

const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT_MS = 10_000;
const DOSSIER_INTERACTION_HOLD_MS = 20_000;
const ROUTE_INTERACTION_HOLD_MS = 60_000;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    return response.json() as Promise<T>;
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const suffix = timedOut ? `timed out after ${API_TIMEOUT_MS}ms` : error instanceof Error ? error.message : String(error);
    const method = init?.method ?? 'GET';
    console.error(`[frontend-api] ${method} ${path} failed: ${suffix}`);
    throw new Error(`${method} ${path} failed: ${suffix}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function toPulse(candidate: unknown): Pulse | null {
  if (!isRecord(candidate) || !isRecord(candidate.data_source)) return null;
  return {
    providerCount: typeof candidate.providerCount === 'number' ? candidate.providerCount : 0,
    endpointCount: typeof candidate.endpointCount === 'number' ? candidate.endpointCount : 0,
    eventCount: typeof candidate.eventCount === 'number' ? candidate.eventCount : 0,
    averageTrust: typeof candidate.averageTrust === 'number' ? candidate.averageTrust : null,
    averageSignal: typeof candidate.averageSignal === 'number' ? candidate.averageSignal : null,
    hottestNarrative: isRecord(candidate.hottestNarrative) ? candidate.hottestNarrative as Narrative : null,
    topTrust: asArray<TrustAssessment>(candidate.topTrust),
    topSignal: asArray<SignalAssessment>(candidate.topSignal),
    interpretations: asArray<EcosystemInterpretation>(candidate.interpretations),
    data_source: {
      mode: candidate.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback',
      url: typeof candidate.data_source.url === 'string' ? candidate.data_source.url : null,
      generated_at: typeof candidate.data_source.generated_at === 'string' ? candidate.data_source.generated_at : null,
      provider_count: typeof candidate.data_source.provider_count === 'number' ? candidate.data_source.provider_count : null,
      last_ingested_at: typeof candidate.data_source.last_ingested_at === 'string' ? candidate.data_source.last_ingested_at : null,
      used_fixture: Boolean(candidate.data_source.used_fixture),
      error: typeof candidate.data_source.error === 'string' ? candidate.data_source.error : null
    },
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString()
  };
}

function toPulseSummary(candidate: unknown): PulseSummary | null {
  if (!isRecord(candidate) || !isRecord(candidate.data_source)) return null;
  const eventGroupsRaw = isRecord(candidate.eventGroups) ? candidate.eventGroups : {};
  const eventGroups = Object.fromEntries(eventCategories.map((category) => {
    const group = isRecord(eventGroupsRaw[category]) ? eventGroupsRaw[category] : {};
    return [category, { count: typeof group.count === 'number' ? group.count : 0, recent: asArray<PulseEvent>(group.recent) }];
  })) as Record<EventCategory, { count: number; recent: PulseEvent[] }>;
  const providerActivityRaw = isRecord(candidate.providerActivity) ? candidate.providerActivity : {};
  return {
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    latest_event_at: typeof candidate.latest_event_at === 'string' ? candidate.latest_event_at : null,
    latest_batch_event_count: typeof candidate.latest_batch_event_count === 'number' ? candidate.latest_batch_event_count : 0,
    ingest_interval_ms: typeof candidate.ingest_interval_ms === 'number' ? candidate.ingest_interval_ms : null,
    latest_ingestion_run: isRecord(candidate.latest_ingestion_run) ? candidate.latest_ingestion_run as PulseSummary['latest_ingestion_run'] : null,
    counters: isRecord(candidate.counters) ? {
      providers: typeof candidate.counters.providers === 'number' ? candidate.counters.providers : 0,
      endpoints: typeof candidate.counters.endpoints === 'number' ? candidate.counters.endpoints : 0,
      events: typeof candidate.counters.events === 'number' ? candidate.counters.events : 0,
      narratives: typeof candidate.counters.narratives === 'number' ? candidate.counters.narratives : 0,
      unknownTelemetry: typeof candidate.counters.unknownTelemetry === 'number' ? candidate.counters.unknownTelemetry : 0
    } : { providers: 0, endpoints: 0, events: 0, narratives: 0, unknownTelemetry: 0 },
    eventGroups,
    timeline: asArray<PulseEvent>(candidate.timeline),
    trustDeltas: asArray<ScoreDelta>(candidate.trustDeltas),
    signalDeltas: asArray<ScoreDelta>(candidate.signalDeltas),
    recentDegradations: asArray<PulseEvent>(candidate.recentDegradations),
    propagation: isRecord(candidate.propagation) ? candidate.propagation as PropagationAnalysis : undefined as unknown as PropagationAnalysis,
    providerActivity: {
      '1h': asArray<ProviderActivity>(providerActivityRaw['1h']),
      '24h': asArray<ProviderActivity>(providerActivityRaw['24h']),
      '7d': asArray<ProviderActivity>(providerActivityRaw['7d'])
    },
    signalSpikes: asArray<ScoreDelta>(candidate.signalSpikes),
    interpretations: asArray<EcosystemInterpretation>(candidate.interpretations),
    data_source: {
      mode: candidate.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback',
      url: typeof candidate.data_source.url === 'string' ? candidate.data_source.url : null,
      generated_at: typeof candidate.data_source.generated_at === 'string' ? candidate.data_source.generated_at : null,
      provider_count: typeof candidate.data_source.provider_count === 'number' ? candidate.data_source.provider_count : null,
      last_ingested_at: typeof candidate.data_source.last_ingested_at === 'string' ? candidate.data_source.last_ingested_at : null,
      used_fixture: Boolean(candidate.data_source.used_fixture),
      error: typeof candidate.data_source.error === 'string' ? candidate.data_source.error : null
    }
  };
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[radar-ui-error-boundary]', error);
  }
  retry = () => this.setState({ hasError: false });
  render() {
    if (this.state.hasError) {
      return <main className="boot" aria-label="Radar fallback shell">
        <section className="panel">
          <h1>Radar UI degraded: rendering fallback shell</h1>
          <button className="execute compact secondary" type="button" onClick={this.retry}>Retry</button>
        </section>
      </main>;
    }
    return this.props.children;
  }
}

function routeProviderId(pathname: string) {
  const match = pathname.match(/^\/providers\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeReceiptId(pathname: string) {
  const match = pathname.match(/^\/receipts\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routePropagationId(pathname: string) {
  const match = pathname.match(/^\/propagation\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
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

function updateProviderPageMetadata(providerId: string, providerName: string | null, description: string | null) {
  const title = providerName ? `${providerName} Provider Intelligence | Infopunks Pay.sh Radar` : `${providerId} Provider Intelligence | Infopunks Pay.sh Radar`;
  const desc = description?.trim() || `Public provider intelligence dossier for ${providerName ?? providerId} on Infopunks Pay.sh Radar.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updateReceiptPageMetadata(receipt: ReceiptRecord | null, eventId: string, missing = false) {
  const providerLabel = receipt?.provider_id ?? 'unknown provider';
  const title = missing
    ? `Receipt Not Found | Infopunks Pay.sh Radar`
    : `Receipt ${eventId} | ${receipt?.event_type ?? 'event'} | Infopunks Pay.sh Radar`;
  const desc = missing
    ? `No public receipt was found for event ${eventId}.`
    : `${receipt?.event_type ?? 'event'} from ${providerLabel}. Severity ${String(receipt?.severity ?? 'unknown')}.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updatePropagationPageMetadata(incident: PropagationIncident | null, clusterId: string, missing = false) {
  const title = missing
    ? `Propagation Cluster Not Found | Infopunks Pay.sh Radar`
    : `Propagation ${clusterId} | ${incident?.propagation_state ?? 'unknown'} | Infopunks Pay.sh Radar`;
  const desc = missing
    ? `No propagation incident currently matches cluster id ${clusterId}.`
    : `${incident?.propagation_reason ?? 'Propagation incident intelligence.'} Severity ${incident?.severity ?? 'unknown'}.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function PublicProviderPage({ providerId }: { providerId: string }) {
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(null);
  const [providerIntel, setProviderIntel] = useState<ProviderIntelligence | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    setMissing(false);
    Promise.all([
      api<{ data: ProviderDetail }>(`/v1/providers/${providerId}`),
      api<{ data: ProviderIntelligence }>(`/v1/providers/${providerId}/intelligence`),
      api<{ data: Pulse }>('/v1/pulse')
    ]).then(([detail, intel, pulseResult]) => {
      if (!active) return;
      setProviderDetail(detail.data);
      setProviderIntel(intel.data);
      setPulse(pulseResult.data);
      updateProviderPageMetadata(providerId, detail.data.provider.name, detail.data.provider.description ?? null);
    }).catch(() => {
      if (!active) return;
      setMissing(true);
      updateProviderPageMetadata(providerId, null, `Provider ${providerId} was not found in the current Infopunks Pay.sh Radar dataset.`);
    });
    return () => {
      active = false;
    };
  }, [providerId]);

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  }

  if (missing) {
    return <main className="boot" aria-label="Provider not found">
      <section className="panel public-provider-page">
        <h1>Provider Not Found</h1>
        <p className="copy">No provider dossier exists for <code>{providerId}</code> in the current dataset.</p>
        <p className="copy">Try a known provider ID/FQN from the main radar directory.</p>
      </section>
    </main>;
  }

  if (!providerDetail || !providerIntel || !pulse) {
    return <main className="boot" aria-label="Provider dossier loading">LOADING PROVIDER DOSSIER...</main>;
  }

  const provider = providerDetail.provider;
  const endpointRows = resolveProviderEndpointRows(providerDetail, providerIntel);

  return <div className="shell public-provider-shell">
    <main id="terminal-content" className="public-provider-page" aria-label="Public provider intelligence dossier">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Infopunks Pay.sh Radar</p>
            <h1>{provider.name}</h1>
            <p className="copy">{provider.description ?? 'No provider description available.'}</p>
          </div>
          <div className="public-actions">
            <button className="execute compact secondary" type="button" onClick={copyShareUrl} aria-label="Copy share URL">
              {copyState === 'copied' ? 'Copied URL' : 'Copy Share URL'}
            </button>
            <a className="execute compact secondary" href="/#terminal-content">Open Radar</a>
            <a className="execute compact secondary" href="/#terminal-content" onClick={(event) => {
              event.preventDefault();
              window.location.href = '/#terminal-content';
            }}>Methodology</a>
          </div>
        </div>
        {copyState === 'error' && <p className="route-state error">Unable to copy URL in this browser context. Share this link manually: {window.location.href}</p>}
        <p className="route-state">Share URL: {window.location.href}</p>
      </section>

      <section className="panel">
        <div className="intel-summary">
          <DossierStat label="trust" value={providerIntel.latest_trust_score} sub={providerDetail.trustAssessment?.grade ?? 'grade unknown'} />
          <DossierStat label="signal" value={providerIntel.latest_signal_score} sub={providerDetail.signalAssessment?.narratives?.[0] ?? 'narrative unknown'} />
          <DossierStat label="severity" value={normalSeverity(providerIntel.severity).toUpperCase()} sub={providerIntel.severity_reason ?? 'severity state'} />
          <DossierStat label="risk" value={providerIntel.risk_level} sub="risk level" />
          <DossierStat label="coordination" value={formatNullableBoolean(providerIntel.coordination_eligible)} sub="eligibility" />
        </div>
      </section>

      <section className="grid two">
        <DossierSection title="Provider Identity">
          <KeyValues rows={[
            ['provider_id', provider.id],
            ['fqn', provider.fqn ?? provider.namespace],
            ['category', provider.category],
            ['service_url', provider.serviceUrl ?? 'unknown']
          ]} />
        </DossierSection>
        <DossierSection title="Propagation & Telemetry">
          <KeyValues rows={[
            ['propagation_state', providerIntel.propagation_context?.propagation_state ?? 'unknown'],
            ['propagation_severity', providerIntel.propagation_context?.severity ?? 'unknown'],
            ['cluster', providerIntel.propagation_context?.affected_cluster ?? 'none'],
            ['unknown_telemetry', providerIntel.unknown_telemetry.length ? providerIntel.unknown_telemetry.join(', ') : 'none']
          ]} />
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Endpoint Summary">
          <KeyValues rows={[
            ['endpoint_count', providerIntel.endpoint_count],
            ['healthy', providerIntel.endpoint_health.healthy],
            ['degraded', providerIntel.endpoint_health.degraded],
            ['failed', providerIntel.endpoint_health.failed],
            ['unknown', providerIntel.endpoint_health.unknown],
            ['last_checked', formatDate(providerIntel.endpoint_health.last_checked_at)]
          ]} />
          <div className="endpoint-list has-rows">
            {endpointRows.slice(0, 8).map((endpoint) => <div className="endpoint" key={endpoint.id}>
              <strong>{endpoint.name}</strong>
              <span>{endpoint.method ?? 'METHOD'} {endpoint.path ?? endpoint.id}</span>
              <small>{endpoint.category}</small>
            </div>)}
            {!endpointRows.length && <p className="muted">No endpoint rows available in this dossier payload.</p>}
          </div>
        </DossierSection>
        <DossierSection title="Recent Changes">
          <div className="timeline">
            {sortBySeverity(providerIntel.recent_changes).slice(0, 8).map((item) => <div className="change" key={item.id}>
              <SeverityBadge evidence={item} />
              <strong>{item.type}</strong>
              <span>{item.summary}</span>
              <time>{formatDate(item.observedAt)}</time>
              <EvidenceReceiptView evidence={item} title="Evidence" compact />
            </div>)}
            {!providerIntel.recent_changes.length && <p className="muted">No recent change events observed.</p>}
          </div>
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Data Source">
          <KeyValues rows={[
            ['source_mode', pulse.data_source.mode],
            ['source_url', pulse.data_source.url ?? 'unknown'],
            ['last_ingested_at', formatDate(pulse.data_source.last_ingested_at)],
            ['provider_count', pulse.data_source.provider_count ?? 'unknown']
          ]} />
        </DossierSection>
        <DossierSection title="Evidence Metadata">
          <EvidenceReceiptView evidence={providerIntel} title="Provider Intelligence Receipt" />
          <p><a href="/#terminal-content">Methodology link</a></p>
        </DossierSection>
      </section>
    </main>
  </div>;
}

function PublicReceiptPage({ eventId }: { eventId: string }) {
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    setMissing(false);
    setReceipt(null);
    api<{ data: ReceiptRecord }>(`/v1/receipts/${encodeURIComponent(eventId)}`)
      .then((response) => {
        if (!active) return;
        setReceipt(response.data);
        updateReceiptPageMetadata(response.data, eventId, false);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        updateReceiptPageMetadata(null, eventId, true);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  async function copyReceiptUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  }

  if (missing) {
    return <main className="boot" aria-label="Receipt not found">
      <section className="panel public-provider-page">
        <h1>Receipt Not Found</h1>
        <p className="copy">No receipt exists for <code>{eventId}</code> in the current event spine.</p>
      </section>
    </main>;
  }

  if (!receipt) return <main className="boot" aria-label="Receipt loading">LOADING RECEIPT...</main>;

  return <div className="shell public-provider-shell">
    <main id="terminal-content" className="public-provider-page" aria-label="Public event receipt page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Infopunks Pay.sh Radar</p>
            <h1>Public Event Receipt</h1>
            <p className="copy">Deterministic receipt for event <code>{receipt.event_id}</code>.</p>
          </div>
          <div className="public-actions">
            <button className="execute compact secondary" type="button" onClick={copyReceiptUrl}>{
              copyState === 'copied' ? 'Copied Receipt URL' : 'Copy Receipt URL'
            }</button>
            {receipt.links.provider_dossier && <a className="execute compact secondary" href={receipt.links.provider_dossier}>Open provider dossier</a>}
          </div>
        </div>
        {copyState === 'error' && <p className="route-state error">Unable to copy URL automatically. Share this URL manually: {window.location.href}</p>}
      </section>

      <section className="grid two">
        <DossierSection title="Receipt Fields">
          <KeyValues rows={[
            ['event_id', receipt.event_id],
            ['event_type', receipt.event_type],
            ['provider_id', receipt.provider_id ?? 'unknown'],
            ['endpoint_id', receipt.endpoint_id ?? 'none'],
            ['severity', `${receipt.severity} · ${receipt.severity_reason}`],
            ['observed_at', formatDate(receipt.observed_at)],
            ['catalog_generated_at', formatDate(receipt.catalog_generated_at)],
            ['ingested_at', formatDate(receipt.ingested_at)],
            ['source', receipt.source],
            ['derivation_reason', receipt.derivation_reason],
            ['confidence', formatConfidence(receipt.confidence)]
          ]} />
        </DossierSection>
        <DossierSection title="Related Links">
          <div className="risk-list">
            {receipt.links.provider && <a href={receipt.links.provider.url}>Related provider: {receipt.links.provider.provider_name}</a>}
            {receipt.links.provider_dossier && <a href={receipt.links.provider_dossier}>Open provider dossier</a>}
            {receipt.links.interpretations.map((item) => <a key={item.interpretation_id} href={item.url}>Interpretation: {item.title}</a>)}
            {receipt.links.propagation_cluster && <a href={receipt.links.propagation_cluster.url}>
              Propagation cluster: {receipt.links.propagation_cluster.cluster ?? 'none'} · {receipt.links.propagation_cluster.state}
            </a>}
            {!receipt.links.provider && !receipt.links.provider_dossier && !receipt.links.interpretations.length && !receipt.links.propagation_cluster && <span>No related links available.</span>}
          </div>
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Structured Event Summary">
          <pre className="methodology-code-block">{JSON.stringify(receipt.summary, null, 2)}</pre>
        </DossierSection>
        <DossierSection title="Raw Event Summary">
          <pre className="methodology-code-block">{receipt.raw_summary}</pre>
        </DossierSection>
      </section>
    </main>
  </div>;
}

function RadarApp() {
  const preferredProviderId = useMemo(() => new URLSearchParams(window.location.search).get('provider_id'), []);
  const [data, setData] = useState<AppData | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [featuredRotationEnabled, setFeaturedRotationEnabled] = useState(true);
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [featuredProvider, setFeaturedProvider] = useState<FeaturedProvider | null>(null);
  const [nextRotationAt, setNextRotationAt] = useState<number | null>(null);
  const [rotationNow, setRotationNow] = useState(() => Date.now());
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryCategory, setDirectoryCategory] = useState('all');
  const [directorySort, setDirectorySort] = useState('trust score');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [routeTask, setRouteTask] = useState('Find a low-cost image generation route for an autonomous design agent');
  const [routeCategory, setRouteCategory] = useState('all');
  const [routeMaxPrice, setRouteMaxPrice] = useState('0.1');
  const [routeMinTrust, setRouteMinTrust] = useState(70);
  const [routePreference, setRoutePreference] = useState<RoutePreference>('balanced');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [routeError, setRouteError] = useState<string | null>(null);
  const [includeSelectedProvider, setIncludeSelectedProvider] = useState(true);
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(null);
  const [providerIntel, setProviderIntel] = useState<ProviderIntelligence | null>(null);
  const [endpointMonitors, setEndpointMonitors] = useState<Record<string, EndpointMonitor>>({});
  const [pulseSummary, setPulseSummary] = useState<PulseSummary | null>(null);
  const [pulseWindow, setPulseWindow] = useState<'1h' | '24h' | '7d'>('24h');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const refreshInFlightRef = useRef(false);
  const interactionHoldUntil = useRef(0);
  const featuredRotationEnabledRef = useRef(featuredRotationEnabled);
  const selectionModeRef = useRef(selectionMode);
  const routeInputFocusedRef = useRef(false);
  const dossierControlsEditingRef = useRef(false);

  function applyFeaturedProvider(featured: FeaturedProvider, force = false) {
    setFeaturedProvider(featured);
    setNextRotationAt(Date.parse(featured.nextRotationAt));
    if (!featured.providerId) return;
    if (!force && (!featuredRotationEnabledRef.current || selectionModeRef.current !== 'auto')) return;
    if (!force && (routeInputFocusedRef.current || dossierControlsEditingRef.current || Date.now() < interactionHoldUntil.current)) return;
    setSelectedId(featured.providerId);
    setSelectionMode('auto');
  }

  function fetchFeaturedProvider() {
    return api<{ data: FeaturedProvider }>('/v1/providers/featured')
      .then((featured) => {
        if (featured?.data && typeof featured.data.nextRotationAt === 'string') applyFeaturedProvider(featured.data);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    let active = true;
    setIsBootLoading(true);
    setBootError(null);
    api<{ data: Pulse }>('/v1/pulse').then((pulse) => {
      if (!active) return;
      const safePulse = toPulse(pulse?.data);
      if (!safePulse) throw new Error('malformed pulse payload');
      setData({ providers: [], pulse: safePulse, narratives: [], graph: { nodes: [], edges: [] } });
      setSelectedId(null);
      setSelectionMode('auto');
      void Promise.allSettled([
        api<{ data: Provider[] }>('/v1/providers'),
        api<{ data: Narrative[] }>('/v1/narratives'),
        api<{ data: { nodes: unknown[]; edges: unknown[] } }>('/v1/graph'),
        api<{ data: PulseSummary }>('/v1/pulse/summary'),
        api<{ data: FeaturedProvider }>('/v1/providers/featured')
      ]).then((results) => {
        if (!active) return;
        const providers = results[0].status === 'fulfilled' && Array.isArray(results[0].value?.data) ? results[0].value.data : null;
        const narratives = results[1].status === 'fulfilled' && Array.isArray(results[1].value?.data) ? results[1].value.data : null;
        const graphRaw = results[2].status === 'fulfilled' && isRecord(results[2].value?.data) ? results[2].value.data : null;
        const summary = results[3].status === 'fulfilled' ? toPulseSummary(results[3].value?.data) : null;
        const featured = results[4].status === 'fulfilled' ? results[4].value.data : null;
        setData((current) => current ? {
          ...current,
          providers: providers ?? current.providers,
          narratives: narratives ?? current.narratives,
          graph: graphRaw && Array.isArray(graphRaw.nodes) && Array.isArray(graphRaw.edges) ? graphRaw as AppData['graph'] : current.graph
        } : current);
        if (summary) setPulseSummary(summary);
        if (featured && typeof featured.nextRotationAt === 'string') applyFeaturedProvider(featured, true);
        if (preferredProviderId && (providers ?? []).some((provider) => provider.id === preferredProviderId)) {
          setSelectedId(preferredProviderId);
          setSelectionMode('manual');
          setFeaturedRotationEnabled(false);
          return;
        }
        if (providers && providers.length) setSelectedId((current) => current ?? providers[0].id);
      });
    }).catch(() => {
      if (!active) return;
      setData({
        providers: [],
        pulse: {
          providerCount: 0,
          endpointCount: 0,
          eventCount: 0,
          averageTrust: null,
          averageSignal: null,
          hottestNarrative: null,
          topTrust: [],
          topSignal: [],
          interpretations: [],
          data_source: { mode: 'fixture_fallback', url: null, generated_at: null, provider_count: 0, last_ingested_at: null, used_fixture: true, error: 'core_pulse_unavailable' },
          updatedAt: new Date().toISOString()
        },
        narratives: [],
        graph: { nodes: [], edges: [] }
      });
      setBootError('Radar degraded: unable to load live pulse');
    }).finally(() => {
      if (!active) return;
      setIsBootLoading(false);
    });
    return () => {
      active = false;
    };
  }, [preferredProviderId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      try {
        const results = await Promise.allSettled([
        api<{ data: Pulse }>('/v1/pulse'),
        api<{ data: PulseSummary }>('/v1/pulse/summary'),
        api<{ data: FeaturedProvider }>('/v1/providers/featured')
        ]);
        if (!active) return;
        const pulse = results[0].status === 'fulfilled' ? toPulse(results[0].value?.data) : null;
        const summary = results[1].status === 'fulfilled' ? toPulseSummary(results[1].value?.data) : null;
        const featured = results[2].status === 'fulfilled' ? results[2].value?.data : null;
        if (pulse) setData((current) => current ? { ...current, pulse } : current);
        if (summary) setPulseSummary(summary);
        if (featured && typeof featured.nextRotationAt === 'string') applyFeaturedProvider(featured);
      } catch {
        // Preserve existing dashboard state on refresh failure.
      } finally {
        refreshInFlightRef.current = false;
      }
    };
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const safeProviders = useMemo(() => asArray<Provider>(data?.providers), [data?.providers]);
  const safeTopTrust = useMemo(() => asArray<TrustAssessment>(data?.pulse.topTrust), [data?.pulse.topTrust]);
  const safeTopSignal = useMemo(() => asArray<SignalAssessment>(data?.pulse.topSignal), [data?.pulse.topSignal]);
  const safeNarratives = useMemo(() => asArray<Narrative>(data?.narratives), [data?.narratives]);
  const providerLookup = useMemo(() => new Map(safeProviders.map((provider) => [provider.id, provider])), [safeProviders]);
  const trustLookup = useMemo(() => new Map(safeTopTrust.map((assessment) => [assessment.entityId, assessment])), [safeTopTrust]);
  const signalLookup = useMemo(() => new Map(safeTopSignal.map((assessment) => [assessment.entityId, assessment])), [safeTopSignal]);
  const categoryOptions = useMemo(() => Array.from(new Set(safeProviders.map((provider) => provider.category).filter(Boolean))).sort(), [safeProviders]);
  const filteredProviders = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return [...safeProviders]
      .filter((provider) => directoryCategory === 'all' || provider.category === directoryCategory)
      .filter((provider) => !query || [provider.name, provider.id, provider.fqn, provider.category, provider.description, ...(provider.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a, b) => compareProviders(a, b, directorySort, trustLookup, signalLookup));
  }, [safeProviders, directoryCategory, directoryQuery, directorySort, signalLookup, trustLookup]);
  const selectedProvider = safeProviders.find((provider) => provider.id === selectedId) ?? null;
  const endpointRows = useMemo(() => resolveProviderEndpointRows(providerDetail, providerIntel), [providerDetail, providerIntel]);
  const reportedEndpointCount = providerIntel?.endpoint_count ?? providerDetail?.provider.endpointCount ?? selectedProvider?.endpointCount ?? 0;
  const endpointProvider = providerDetail?.provider ?? providerIntel?.provider ?? selectedProvider;
  const hasPartialEndpointMetadata = reportedEndpointCount > 0 && endpointRows.length === 0;
  const nextRotationLabel = featuredRotationEnabled && selectionMode === 'auto' && nextRotationAt ? formatRotationCountdown(nextRotationAt - rotationNow) : 'paused';
  const isFeaturedProvider = selectionMode === 'auto' && featuredRotationEnabled && selectedProvider?.id === featuredProvider?.providerId;
  const timelineBatches = useMemo(() => groupTimelineByBatch(pulseSummary?.timeline ?? []), [pulseSummary?.timeline]);
  const ecosystemInterpretations = asArray<EcosystemInterpretation>(pulseSummary?.interpretations ?? data?.pulse.interpretations);
  const catalogNoChanges = Boolean(pulseSummary && pulseSummary.data_source.last_ingested_at && pulseSummary.latest_event_at && Date.parse(pulseSummary.data_source.last_ingested_at) > Date.parse(pulseSummary.latest_event_at));

  useEffect(() => {
    featuredRotationEnabledRef.current = featuredRotationEnabled;
  }, [featuredRotationEnabled]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    if (!featuredRotationEnabled || selectionMode !== 'auto') {
      setNextRotationAt(null);
      return;
    }
    if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
  }, [featuredRotationEnabled, selectionMode, featuredProvider]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRotationNow(now);
      if (featuredRotationEnabledRef.current && selectionModeRef.current === 'auto' && nextRotationAt && now >= nextRotationAt) {
        void fetchFeaturedProvider();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [nextRotationAt]);

  useEffect(() => {
    if (!selectedProvider) return;
    let active = true;
    setProviderDetail(null);
    setProviderIntel(null);
    setEndpointMonitors({});
    Promise.allSettled([
      api<{ data: ProviderDetail }>(`/v1/providers/${selectedProvider.id}`),
      api<{ data: ProviderIntelligence }>(`/v1/providers/${selectedProvider.id}/intelligence`)
    ]).then(async ([detailResult, intelResult]) => {
      if (!active) return;
      const detail = detailResult.status === 'fulfilled' && detailResult.value?.data ? detailResult.value.data : null;
      const intel = intelResult.status === 'fulfilled' && intelResult.value?.data ? intelResult.value.data : null;
      if (detail) setProviderDetail(detail);
      if (intel) setProviderIntel(intel);
      const endpoints = asArray<Endpoint>(detail?.endpoints).slice(0, 40);
      if (!endpoints.length) return;
      const monitorResults = await Promise.allSettled(endpoints.map((endpoint) => api<{ data: EndpointMonitor }>(`/v1/endpoints/${endpoint.id}/monitor`)));
      if (!active) return;
      const entries: Array<[string, EndpointMonitor]> = [];
      monitorResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.data) entries.push([endpoints[index].id, result.value.data]);
      });
      setEndpointMonitors(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedProvider?.id]);

  function runRoute() {
    const maxPrice = routeMaxPrice.trim() === '' ? undefined : Number(routeMaxPrice);
    setRouteStatus('loading');
    setRouteError(null);
    api<{ data: RouteResult }>('/v1/recommend-route', {
      method: 'POST',
      body: JSON.stringify({
        task: routeTask,
        category: routeCategory === 'all' ? undefined : routeCategory,
        trustThreshold: routeMinTrust,
        latencySensitivity: 'medium',
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        preference: routePreference,
        preferredProviderId: includeSelectedProvider ? selectedProvider?.id : undefined
      })
    }).then((res) => {
      setRouteResult(res.data);
      setRouteStatus('idle');
    }).catch(() => {
      setRouteStatus('error');
      setRouteError('route API unavailable');
    });
  }

  function runSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchStatus('idle');
      return;
    }
    setSearchStatus('loading');
    setSearchError(null);
    void api<SearchResponse>('/v1/search', { method: 'POST', body: JSON.stringify({ query, limit: 6 }) })
      .then((res) => {
        setSearchResults(Array.isArray(res.data) ? res.data : []);
        if (res.degraded) {
          setSearchStatus('error');
          setSearchError(res.reason ?? 'search_timeout');
          return;
        }
        setSearchStatus('idle');
      })
      .catch(() => {
        setSearchResults([]);
        setSearchStatus('error');
        setSearchError('search_unavailable');
      });
  }

  function recommendProvider(provider: Provider) {
    setRouteTask(`Recommend a Pay.sh route for a task that could use ${provider.name} in ${provider.category}`);
    setRouteCategory(provider.category || 'all');
    setIncludeSelectedProvider(true);
    window.requestAnimationFrame(() => document.getElementById('route-decision-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function holdAutoRotation(durationMs: number) {
    interactionHoldUntil.current = Math.max(interactionHoldUntil.current, Date.now() + durationMs);
  }

  function selectProviderManually(providerId: string) {
    setSelectedId(providerId);
    setSelectionMode('manual');
    setFeaturedRotationEnabled(false);
    setNextRotationAt(null);
  }

  function toggleAutoRotation(enabled: boolean) {
    setFeaturedRotationEnabled(enabled);
    if (enabled) {
      setSelectionMode('auto');
      if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
      else void fetchFeaturedProvider();
    }
  }

  function resumeAutoRotation() {
    setSelectionMode('auto');
    setFeaturedRotationEnabled(true);
    if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
    else void fetchFeaturedProvider();
  }

  function setRouteInputFocused(focused: boolean) {
    routeInputFocusedRef.current = focused;
    if (focused) holdAutoRotation(ROUTE_INTERACTION_HOLD_MS);
  }

  function setDossierControlsEditing(editing: boolean) {
    dossierControlsEditingRef.current = editing;
    if (editing) holdAutoRotation(DOSSIER_INTERACTION_HOLD_MS);
  }

  if (isBootLoading) return <main className="boot" aria-label="Infopunks Pay.sh Radar loading state">INFOPUNKS//PAY.SH COGNITIVE LAYER BOOTING...</main>;
  if (!data) return <main className="boot" aria-label="Infopunks Pay.sh Radar loading state">BOOT FAILED</main>;

  const providerContextLabel = selectedProvider ? `${selectedProvider.name} / ${selectedProvider.category}`.toUpperCase() : 'PROVIDER / UNKNOWN';

  return <div className="shell">
    <a className="skip-link" href="#terminal-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar" aria-label="Global controls">
        <button className="methodology-trigger" type="button" onClick={() => setMethodologyOpen(true)} aria-label="Open methodology drawer">
          Methodology
        </button>
      </nav>
    </header>
    <MethodologyDrawer open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

    <main id="terminal-content">
    {bootError && <section className="panel" role="status" aria-live="polite">
      <p className="route-state error">{bootError}</p>
      <button className="execute compact secondary" type="button" onClick={() => window.location.reload()}>Retry</button>
    </section>}
    <section className="hero panel" aria-labelledby="terminal-title">
      <div>
        <p className="eyebrow">Infopunks Intelligence Terminal</p>
        <h1 id="terminal-title">Cognitive Coordination Layer for the Pay.sh agent economy.</h1>
        <p className="copy">Pay.sh remains the provider, payment, and discovery substrate. Infopunks turns ecosystem exhaust into trust scores, signal scores, narrative maps, semantic search, and routing recommendations.</p>
        <div className="source-stack">
          <span className={`source-badge ${data.pulse.data_source.mode}`}>{data.pulse.data_source.mode === 'live_pay_sh_catalog' ? 'LIVE PAY.SH CATALOG' : 'FIXTURE FALLBACK'}</span>
          <small className="source-line">{formatDataSource(data.pulse.data_source, data.pulse.providerCount, data.pulse.endpointCount)}</small>
        </div>
      </div>
      <div className="ticker">
        <span>PROVIDERS {data.pulse.providerCount}</span>
        <span>ENDPOINTS {data.pulse.endpointCount}</span>
        <span>AVG TRUST {data.pulse.averageTrust ?? 'unknown'}</span>
        <span>AVG SIGNAL {data.pulse.averageSignal ?? 'unknown'}</span>
      </div>
    </section>

    <section className="ecosystem-layout" aria-label="Global intelligence layout">
      <div className="ecosystem-main">
        <section className="zone zone-ecosystem" aria-labelledby="ecosystem-zone-title">
          <ZoneHeader eyebrow="ZONE A" title="ECOSYSTEM INTELLIGENCE" subtitle="Realtime machine economy observability" scope="GLOBAL" />

          <section className="grid four ecosystem-metrics" aria-label="Ecosystem summary metrics">
            <Metric label="Ecosystem Pulse" value={data.pulse.hottestNarrative?.title ?? 'unknown'} sub={`heat ${data.pulse.hottestNarrative?.heat ?? 'unknown'} / momentum ${data.pulse.hottestNarrative?.momentum ?? 'unknown'}`} evidence={data.pulse.hottestNarrative as EvidenceReceipt | null} />
            <Metric label="Trust Leader" value={providerLookup.get(data.pulse.topTrust[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topTrust[0]?.score ?? 'unknown'}/100 grade ${data.pulse.topTrust[0]?.grade ?? '-'}`} evidence={data.pulse.topTrust[0]} />
            <Metric label="Signal Leader" value={providerLookup.get(data.pulse.topSignal[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topSignal[0]?.score ?? 'unknown'}/100`} evidence={data.pulse.topSignal[0]} />
            <Metric label="Graph Layer" value={`${data.graph.nodes.length} nodes`} sub={`${data.graph.edges.length} deterministic edges`} evidence={data.graph.evidence ?? graphFallbackEvidence(data.graph)} />
          </section>

          <EcosystemInterpretationPanel interpretations={ecosystemInterpretations} providerLookup={providerLookup} />

          <div className="ecosystem-canvas">
          {pulseSummary && <section className="panel pulse-feed" aria-label="Live catalog pulse">
            <div className="panel-head">
              <div>
                <ScopeLabel scope="GLOBAL" />
                <p className="section-kicker">Live Signals</p>
                <h2>Live Catalog Pulse</h2>
                <p className="panel-caption">Pay.sh catalog ingests every {formatInterval(pulseSummary.ingest_interval_ms) ?? '7.5 min'} · UI polls every 15s · events emit when catalog changes are detected.</p>
              </div>
              <small>UI refresh {formatDate(pulseSummary.generatedAt)}</small>
            </div>
            <div className="timing-strip" aria-label="Catalog timing">
              <TimingItem label="UI refreshed" value={formatDate(pulseSummary.generatedAt)} />
              <TimingItem label="Catalog ingestion" value={formatDate(pulseSummary.data_source.last_ingested_at)} />
              <TimingItem label="Pay.sh catalog generated" value={formatDate(pulseSummary.data_source.generated_at)} />
              <TimingItem label="Source" value={sourceLabel(pulseSummary.data_source)} />
              <TimingItem label="Latest event batch" value={pulseSummary.latest_event_at ? `${formatTime(pulseSummary.latest_event_at)} · ${pulseSummary.latest_batch_event_count} events` : 'none'} />
            </div>
            {catalogNoChanges && <p className="batch-notice">Latest catalog refresh completed. No provider, pricing, endpoint, or category changes detected.</p>}
            <div className="event-groups" aria-label="Catalog event categories">
              {eventCategories.map((category) => <span key={category} className={`category ${category}`}>{eventCategoryIcon(category)} {category} {pulseSummary.eventGroups[category].count}</span>)}
            </div>
            <div className="event-feed">
              {timelineBatches.map((batch) => <div className="batch-group" key={batch.observedAt}>
                <div className="batch-head">
                  <strong>Catalog batch</strong>
                  <time>{formatTime(batch.observedAt)}</time>
                  <span>{batch.events.length} events emitted</span>
                </div>
                <div className="batch-rows">
                  {sortBySeverity(batch.events).map((event) => <div className={`feed-row ${event.category} severity-${normalSeverity(event.severity)}`} key={event.id}>
                    <span>{eventCategoryIcon(event.category)} {event.category}</span>
                    <SeverityBadge evidence={event} />
                    <strong>{event.providerName ?? event.entityId}</strong>
                    <p>{event.summary}</p>
                    <time>{formatTime(event.observedAt)}</time>
                    <EvidenceReceiptView evidence={event} title="Receipt" compact />
                  </div>)}
                </div>
              </div>)}
              {!pulseSummary.timeline.length && <p className="muted empty-state">No pulse events observed in the current window.</p>}
            </div>
          </section>}

          <section className="grid two">
            <Leaderboard title="Trust Leaderboard" scores={safeTopTrust} providers={providerLookup} kind="trust" />
            <Leaderboard title="Signal Leaderboard" scores={safeTopSignal} providers={providerLookup} kind="signal" />
          </section>

          <section className="panel">
            <ScopeLabel scope="GLOBAL" />
            <h2>Narrative Heatmap</h2>
            <div className="heatmap">
              {sortBySeverity(safeNarratives).map((narrative) => <div key={narrative.id} className={`heat severity-${normalSeverity(narrative.severity)}`} style={{ '--heat': `${narrative.heat ?? 0}%` } as React.CSSProperties}>
                <strong>{narrative.title}</strong><SeverityBadge evidence={narrative} /><span>heat {narrative.heat ?? 'unknown'}</span><small>{narrative.providerIds.length} providers / {narrative.keywords.join(', ')}</small>
              </div>)}
            </div>
          </section>

          <section className="panel">
            <ScopeLabel scope="GLOBAL" />
            <h2>Semantic Search</h2>
            <form onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="search Pay.sh ecosystem intelligence" aria-label="Search Pay.sh ecosystem intelligence" />
              <button className="execute compact secondary" type="submit" disabled={searchStatus === 'loading'}>
                {searchStatus === 'loading' ? 'Searching...' : 'Search'}
              </button>
            </form>
            {searchError && <p className="route-state error">Semantic search unavailable: {searchError}</p>}
            <div className="results">{searchResults.filter((result) => isRecord(result) && isRecord(result.provider) && typeof result.provider.id === 'string').map((result) => <div className="result" key={result.provider.id}><strong>{result.provider.name ?? 'unknown provider'}</strong><span>relevance {result.relevance ?? 'unknown'} / trust {result.trustAssessment?.score ?? 'unknown'} / signal {result.signalAssessment?.score ?? 'unknown'}</span></div>)}</div>
          </section>
          </div>
        </section>

        <section className="zone zone-provider" aria-labelledby="provider-zone-title">
      <ZoneHeader eyebrow="ZONE B" title="SELECTED PROVIDER DOSSIER" subtitle="Live intelligence for selected provider" scope="PROVIDER" />
      {selectedProvider && <div className="provider-ribbon" aria-label="Selected provider context">
        <strong>{selectedProvider.name}</strong>
        <SeverityBadge evidence={providerIntel ?? selectedProvider} />
        <span>TRUST {providerIntel?.latest_trust_score ?? 'unknown'}</span>
        <span>SIGNAL {providerIntel?.latest_signal_score ?? 'unknown'}</span>
        <span>PROPAGATION {providerIntel?.propagation_context?.affected ? providerIntel.propagation_context.propagation_state.toUpperCase() : 'CLEAR'}</span>
        <span className={`service-status ${providerIntel?.service_monitor.status ?? 'unknown'}`}>MONITOR {statusLabel(providerIntel?.service_monitor.status ?? 'unknown')}</span>
      </div>}

      <div className="provider-stack">
        <div className="panel provider-directory-panel">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Catalog Index</p>
              <h2>Provider Directory</h2>
            </div>
            <small>{filteredProviders.length} / {data.providers.length} providers</small>
          </div>
          <div className="directory-controls">
            <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="filter provider, tag, FQN, category" aria-label="Filter providers by name tag FQN or category" />
            <div className="control-row">
              <select value={directorySort} onChange={(event) => setDirectorySort(event.target.value)} aria-label="Sort providers">
                <option>trust score</option>
                <option>signal score</option>
                <option>endpoint count</option>
                <option>category</option>
                <option>name</option>
              </select>
            </div>
            <div className="category-chips" role="group" aria-label="Filter providers by category">
              <button type="button" className={directoryCategory === 'all' ? 'selected' : ''} aria-pressed={directoryCategory === 'all'} onClick={() => setDirectoryCategory('all')}>all</button>
              {categoryOptions.map((category) => <button key={category} type="button" className={directoryCategory === category ? 'selected' : ''} aria-pressed={directoryCategory === category} onClick={() => setDirectoryCategory(category)}>{category}</button>)}
            </div>
          </div>
          <div className="directory">
            {filteredProviders.map((provider) => <button key={provider.id} type="button" aria-pressed={provider.id === selectedProvider?.id} className={provider.id === selectedProvider?.id ? 'active row' : 'row'} onClick={() => selectProviderManually(provider.id)}>
              <span>{provider.name}</span><SeverityBadge evidence={provider} /><small>{provider.category} / {provider.endpointCount} endpoints / trust {provider.latestTrustScore ?? 'unknown'}</small>
            </button>)}
            {!filteredProviders.length && <p className="muted empty-state">No providers match the current directory filters.</p>}
          </div>
        </div>
        <div className="panel intelligence dossier">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
              <p className="section-kicker">Selected Provider</p>
              <h2>Provider Intelligence Dossier</h2>
            </div>
            <div className="auto-rotate-control" aria-label="Featured provider auto-rotate control" onFocus={() => setDossierControlsEditing(true)} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDossierControlsEditing(false);
            }} onPointerDown={() => setDossierControlsEditing(true)} onPointerUp={() => setDossierControlsEditing(false)}>
              {isFeaturedProvider && <span className="featured-label">Featured provider</span>}
              <label>
                <input type="checkbox" checked={featuredRotationEnabled} aria-label="Toggle featured provider rotation" onChange={(event) => toggleAutoRotation(event.target.checked)} />
                <span>Featured rotation</span>
              </label>
              {selectionMode === 'manual' && <button className="resume-rotate" type="button" onClick={resumeAutoRotation}>Resume featured rotation</button>}
              <small>{selectionMode === 'manual' ? 'Paused by manual selection' : `Next provider in ${nextRotationLabel}`}</small>
            </div>
          </div>
          {selectedProvider && <>
            <div className="dossier-header">
              <div>
                <p className="eyebrow">{selectedProvider.namespace}</p>
                <h3>{selectedProvider.title ?? selectedProvider.name}</h3>
                <code>{selectedProvider.fqn ?? selectedProvider.id}</code>
              </div>
              <div className="dossier-badges">
                <span>{selectedProvider.category}</span>
                <span>{data.pulse.data_source.mode === 'live_pay_sh_catalog' ? 'live catalog' : 'fixture fallback'}</span>
                <span>{selectedProvider.endpointCount} endpoints</span>
                <span>{formatPrice(selectedProvider.pricing)}</span>
                <span>{selectedProvider.hasFreeTier || selectedProvider.status.includes('free') ? 'free tier' : 'no free-tier evidence'}</span>
                <span>{selectedProvider.hasMetering || selectedProvider.status === 'metered' ? 'metering' : 'metering unknown'}</span>
                <SeverityBadge evidence={providerIntel ?? selectedProvider} />
              </div>
            </div>
            <div className="intel-summary">
              <DossierStat label="trust" value={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'grade unknown'} />
              <DossierStat label="signal" value={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives[0] ?? 'narrative unknown'} />
              <DossierStat label="coordination" value={formatNullableBoolean(providerIntel?.coordination_eligible ?? null)} sub="eligible" />
              <DossierStat label="risk" value={riskLabel(providerIntel?.risk_level ?? 'unknown')} sub="level" />
              <DossierStat label="unknowns" value={providerIntel?.unknown_telemetry.length ?? 'unknown'} sub="telemetry fields" />
            </div>
            <div className="dossier-body" onScroll={() => holdAutoRotation(DOSSIER_INTERACTION_HOLD_MS)}>
              <DossierSection title="Capability Brief" context={providerContextLabel}>
                <p>{selectedProvider.description ?? 'No provider description supplied by catalog metadata.'}</p>
                <p><b>use_case:</b> {selectedProvider.useCase ?? 'unknown'}</p>
                {selectedProvider.serviceUrl && <p><b>service_url:</b> <a href={selectedProvider.serviceUrl} target="_blank" rel="noreferrer">{selectedProvider.serviceUrl}</a></p>}
                <div className="chips compact-chips">{(providerIntel?.category_tags.length ? providerIntel.category_tags : selectedProvider.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <EvidenceReceiptView evidence={selectedProvider} title="Evidence" />
              </DossierSection>
              <div className="dossier-grid">
                <DossierSection title="Market Metadata" context={providerContextLabel}>
                  <KeyValues rows={[
                    ['min_price_usd', moneyOrUnknown(selectedProvider.pricing.min)],
                    ['max_price_usd', moneyOrUnknown(selectedProvider.pricing.max)],
                    ['endpoint_count', selectedProvider.endpointCount],
                    ['has_free_tier', formatNullableBoolean(selectedProvider.hasFreeTier ?? selectedProvider.status.includes('free') ? true : null)],
                    ['has_metering', formatNullableBoolean(selectedProvider.hasMetering ?? selectedProvider.status === 'metered' ? true : null)],
                    ['source_sha', selectedProvider.sourceSha ?? 'unknown'],
                    ['catalog_generated_at', formatDate(selectedProvider.catalogGeneratedAt)],
                    ['last_seen_at', formatDate(providerIntel?.last_seen_at ?? selectedProvider.lastSeenAt)]
                  ]} />
                  <EvidenceReceiptView evidence={selectedProvider.pricing ?? selectedProvider} title="Receipt" />
                </DossierSection>
                <DossierSection title="Trust Breakdown" context={providerContextLabel}>
                  <KeyValues rows={[
                    ['metadata quality', componentValue(providerDetail?.trustAssessment?.components.metadataQuality)],
                    ['pricing clarity', componentValue(providerDetail?.trustAssessment?.components.pricingClarity)],
                    ['freshness', componentValue(providerDetail?.trustAssessment?.components.freshness)],
                    ['service reachability', knownState(providerDetail?.trustAssessment?.components.uptime)],
                    ['latency', knownState(providerDetail?.trustAssessment?.components.latency)],
                    ['endpoint response validity', knownState(providerDetail?.trustAssessment?.components.responseValidity)],
                    ['receipt reliability', knownState(providerDetail?.trustAssessment?.components.receiptReliability)]
                  ]} />
                </DossierSection>
                <DossierSection title="Operational Monitor" context={providerContextLabel}>
                  <div className="monitor-card">
                    <div className="monitor-head">
                      <span className="safe-badge">SAFE METADATA</span>
                      <SeverityBadge evidence={providerIntel?.service_monitor} />
                      <strong className={`service-status ${providerIntel?.service_monitor.status ?? 'unknown'}`}>{statusLabel(providerIntel?.service_monitor.status ?? 'unknown')}</strong>
                    </div>
                    <KeyValues rows={[
                      ['last_check', formatDate(providerIntel?.service_monitor.last_checked_at ?? null)],
                      ['latency', formatMs(providerIntel?.service_monitor.response_time_ms ?? null)],
                      ['http_status', providerIntel?.service_monitor.status_code ?? 'unknown'],
                      ['monitor_mode', providerIntel?.service_monitor.monitor_mode ?? 'UNKNOWN']
                    ]} />
                    <p className="monitor-note">{providerIntel?.service_monitor.explanation ?? 'Safe monitor checks provider service reachability only. It does not execute paid Pay.sh calls.'}</p>
                  </div>
                </DossierSection>
                <DossierSection title="Propagation Context" context={providerContextLabel}>
                  <KeyValues rows={[
                    ['state', providerIntel?.propagation_context?.propagation_state ?? 'unknown'],
                    ['severity', providerIntel?.propagation_context?.severity ?? 'unknown'],
                    ['provider affected', formatNullableBoolean(providerIntel?.propagation_context?.affected ?? null)],
                    ['cluster', providerIntel?.propagation_context?.affected_cluster ?? 'none']
                  ]} />
                  <p className="monitor-note">{providerIntel?.propagation_context?.propagation_reason ?? 'No propagation analysis available for this provider.'}</p>
                </DossierSection>
                <DossierSection title="Signal Breakdown" context={providerContextLabel}>
                  <KeyValues rows={[
                    ['category heat', componentValue(providerDetail?.signalAssessment?.components.categoryHeat)],
                    ['ecosystem momentum', componentValue(providerDetail?.signalAssessment?.components.ecosystemMomentum)],
                    ['metadata change velocity', componentValue(providerDetail?.signalAssessment?.components.metadataChangeVelocity)],
                    ['social velocity', knownState(providerDetail?.signalAssessment?.components.socialVelocity)],
                    ['onchain/liquidity resonance', knownState(providerDetail?.signalAssessment?.components.onchainLiquidityResonance)]
                  ]} />
                </DossierSection>
                <DossierSection title="Unknown Telemetry" context={providerContextLabel}>
                  <div className="unknown-list">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['No unknown telemetry reported by current assessments.']).map((item) => <span key={item}>{item}</span>)}</div>
                  <EvidenceReceiptView evidence={providerDetail?.trustAssessment ?? providerDetail?.signalAssessment ?? selectedProvider} title="Evidence" />
                </DossierSection>
              </div>
              <DossierSection title="Evidence Trail" context={providerContextLabel}>
                <div className="evidence-trail">
                  {sortBySeverity(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).slice(0, 6).map((item) => <div key={item.id}>
                    <time>{formatDate(item.observedAt)}</time>
                    <SeverityBadge evidence={item} />
                    <strong>{item.type}</strong>
                    <span>{item.summary}</span>
                    <EvidenceReceiptView evidence={item} title="Receipt" compact />
                  </div>)}
                  {providerIntel?.recent_changes.length === 0 && <p className="muted empty-state">No recent discovery, update, price, category, endpoint-count, or metadata events after initial observation.</p>}
                </div>
              </DossierSection>
              <DossierSection title="Route Decision Panel" context={providerContextLabel}>
                <div className="route-panel compact-route-panel" id="route-decision-panel" onFocus={() => setRouteInputFocused(true)} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRouteInputFocused(false);
                }} onPointerDown={() => holdAutoRotation(ROUTE_INTERACTION_HOLD_MS)} onInput={() => holdAutoRotation(ROUTE_INTERACTION_HOLD_MS)}>
                  <label>
                    <span>task text</span>
                    <textarea value={routeTask} aria-label="Route task text" onChange={(event) => setRouteTask(event.target.value)} />
                  </label>
                  <div className="route-input-grid">
                    <label>
                      <span>category filter</span>
                      <select value={routeCategory} aria-label="Route category filter" onChange={(event) => setRouteCategory(event.target.value)}>
                        <option value="all">all categories</option>
                        {categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>max price</span>
                      <input value={routeMaxPrice} aria-label="Route maximum price" onChange={(event) => setRouteMaxPrice(event.target.value)} placeholder="unknown allowed" />
                    </label>
                    <label>
                      <span>Minimum trust score</span>
                      <input type="number" min={0} max={100} value={routeMinTrust} aria-label="Route minimum trust score" onChange={(event) => setRouteMinTrust(Number(event.target.value))} />
                    </label>
                    <label>
                      <span>preference</span>
                      <select value={routePreference} aria-label="Route preference" onChange={(event) => setRoutePreference(event.target.value as RoutePreference)}>
                        <option value="balanced">balanced</option>
                        <option value="highest_trust">highest trust</option>
                        <option value="cheapest">cheapest</option>
                        <option value="highest_signal">highest signal</option>
                      </select>
                    </label>
                  </div>
                  <label className="route-check">
                    <input type="checkbox" checked={includeSelectedProvider} aria-label="Include selected provider as preferred route input" onChange={(event) => setIncludeSelectedProvider(event.target.checked)} />
                    <span>include selected provider as preferred route input</span>
                  </label>
                  <div className="route-actions">
                    <button className="execute compact" type="button" onClick={runRoute} disabled={routeStatus === 'loading'}>{routeStatus === 'loading' ? 'computing route...' : 'compute recommended route'}</button>
                    <button className="execute compact secondary" type="button" onClick={() => recommendProvider(selectedProvider)}>seed from selected</button>
                  </div>
                  {routeError && <p className="route-state error">{routeError}</p>}
                  {routeStatus === 'loading' && <p className="route-state">computing route...</p>}
                  {routeResult && <RouteDecisionOutput routeResult={routeResult} routePreference={routePreference} selectedProvider={selectedProvider} />}
                </div>
              </DossierSection>
            </div>
          </>}
        </div>
      </div>

      <section className="grid three provider-analysis-grid">
        <AssessmentPanel title="Trust Assessment" score={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'unknown'} components={providerDetail?.trustAssessment?.components ?? {}} context={providerContextLabel} evidence={providerDetail?.trustAssessment ?? undefined} />
        <AssessmentPanel title="Signal Assessment" score={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives.join(', ') || 'no narrative match'} components={providerDetail?.signalAssessment?.components ?? {}} context={providerContextLabel} evidence={providerDetail?.signalAssessment ?? undefined} />
        <div className="panel assessment">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <h2>Unknown Telemetry</h2>
          <div className="terminal-lines">
            <p>risk: {riskLabel(providerIntel?.risk_level ?? 'unknown')}</p>
            <p>coordination eligible: {formatNullableBoolean(providerIntel?.coordination_eligible ?? null)}</p>
            <p>endpoints: {providerIntel?.endpoint_count ?? selectedProvider?.endpointCount ?? 'unknown'}</p>
            <p>health: {providerIntel ? `${providerIntel.endpoint_health.healthy} [OK] ok / ${providerIntel.endpoint_health.degraded} [DEGRADED] degraded / ${providerIntel.endpoint_health.failed} [FAILED] failed / ${providerIntel.endpoint_health.unknown} [?] unknown` : '[?] unknown'}</p>
          </div>
          <div className="chips">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['none']).map((item) => <span key={item}>{item}</span>)}</div>
          <EvidenceReceiptView evidence={providerDetail?.trustAssessment ?? providerDetail?.signalAssessment ?? selectedProvider ?? undefined} title="Evidence" />
        </div>
      </section>

      <section className="grid two provider-analysis-grid">
        <div className="panel">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <div className="endpoint-panel-head">
            <h2>Endpoint List</h2>
            {hasPartialEndpointMetadata && <span className="partial-badge">LIVE CATALOG PARTIAL</span>}
          </div>
          <div className={`endpoint-list ${endpointRows.length ? 'has-rows' : 'compact-state'}`}>
            {endpointRows.map((endpoint) => <div className="endpoint" key={endpoint.id}>
              {(() => {
                const monitor = endpointMonitors[endpoint.id];
                const payload = monitor?.lastCheck?.payload ?? {};
                return <>
              <strong>{endpoint.name}</strong>
              <span>{endpoint.method ?? 'METHOD_UNKNOWN'} {endpoint.path ?? 'path unavailable'}</span>
              <small>category {endpoint.category} / type {endpoint.status} / pricing {formatPrice(endpoint.pricing)}</small>
              <small>health {statusLabel(monitor?.health ?? 'unknown')} / checked {formatDate(monitor?.lastCheck?.observedAt)} / latency {formatMs((payload.response_time_ms as number | undefined) ?? endpoint.latencyMsP50)}</small>
              {typeof endpoint.routeEligible === 'boolean' && <small>route eligible {formatNullableBoolean(endpoint.routeEligible)}</small>}
              {!!monitor?.recentFailures.length && <small className="failure-line">recent failure: {monitor.recentFailures[0].summary}</small>}
              <EvidenceReceiptView evidence={endpoint} title="Evidence" compact />
                </>;
              })()}
            </div>)}
            {!endpointRows.length && reportedEndpointCount > 0 && endpointProvider && <>
              <p className="endpoint-state">Pay.sh catalog reports {reportedEndpointCount} endpoints for this provider. Full endpoint-level metadata is not exposed in the current catalog feed.</p>
              <div className="endpoint synthetic">
                <strong>Provider capability surface</strong>
                <span>Endpoint count: {reportedEndpointCount}</span>
                <small>Category: {endpointProvider.category}</small>
                <small>Pricing range: {formatPrice(endpointProvider.pricing)}</small>
                <small>Source: live Pay.sh catalog</small>
                <EvidenceReceiptView evidence={endpointProvider} title="Evidence" compact />
              </div>
            </>}
            {!endpointRows.length && reportedEndpointCount === 0 && <p className="endpoint-state">No endpoints reported by the live Pay.sh catalog.</p>}
          </div>
        </div>
        <div className="panel">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <h2>Recent Changes</h2>
          <p className="panel-caption">Provider recent changes are catalog diff events.</p>
          <div className="timeline">
            {sortBySeverity(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).map((item) => <div className="change" key={item.id}>
              <time>{formatDate(item.observedAt)}</time>
              <SeverityBadge evidence={item} />
              <strong>{item.type}</strong>
              <span>{item.summary}</span>
              <EvidenceReceiptView evidence={item} title="Receipt" compact />
            </div>)}
            {providerIntel?.recent_changes.length === 0 && <p className="muted">No change events observed after initial discovery.</p>}
          </div>
        </div>
      </section>
        </section>
      </div>

      {pulseSummary && <aside className="ecosystem-rail" aria-label="Realtime ecosystem intelligence sidebar">
        <div className="panel counter-grid scoped-panel">
          <ScopeLabel scope="GLOBAL" />
          <PulseStat label="Events" value={pulseSummary.counters.events} sub={`${pulseSummary.counters.unknownTelemetry} unknown telemetry fields`} />
          <PulseStat label="Providers" value={pulseSummary.counters.providers} sub={`${pulseSummary.counters.endpoints} endpoints tracked`} />
          {pulseSummary.eventGroups.monitoring.count > 0 && <PulseStat label="Monitor" value={pulseSummary.eventGroups.monitoring.count} sub="safe service reachability events" />}
        </div>
        <PropagationWatch propagation={pulseSummary.propagation} />
        <DeltaPanel title="Trust Changes" caption="Latest trust events from catalog scoring batches." deltas={pulseSummary.trustDeltas} empty="No trust deltas beyond initial scoring." scope="GLOBAL" />
        <DeltaPanel title="Signal Spikes" caption="Signal deltas appear only when catalog-derived signal changes." deltas={pulseSummary.signalSpikes} empty="No positive signal deltas observed." scope="GLOBAL" />
        <div className="panel">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Windowed Telemetry</p>
              <h2>Provider Activity</h2>
              <p className="panel-caption">Activity counts are event-spine activity, not Pay.sh transaction volume.</p>
            </div>
            <div className="window-tabs">
              {(['1h', '24h', '7d'] as const).map((windowName) => <button key={windowName} type="button" className={pulseWindow === windowName ? 'selected' : ''} aria-pressed={pulseWindow === windowName} aria-label={`Show provider activity for ${windowName}`} onClick={() => setPulseWindow(windowName)}>{windowName}</button>)}
            </div>
          </div>
          <div className="activity-list">
            {pulseSummary.providerActivity[pulseWindow].map((item) => <div className="activity-row" key={item.providerId}>
              <strong>{item.providerName}</strong>
              <span>{item.count} events</span>
              <small>{compactCategories(item.categories)}</small>
              <EvidenceReceiptView evidence={item} title="Evidence" compact />
            </div>)}
            {!pulseSummary.providerActivity[pulseWindow].length && <p className="muted empty-state">No provider activity in this window.</p>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Monitor Alerts</p>
              <h2>Recent Degradations</h2>
              <p className="panel-caption">Safe metadata events are service reachability signals, not API execution failures.</p>
            </div>
          </div>
          <div className="mini-feed">
            {sortBySeverity(pulseSummary.recentDegradations).map((event) => <div className={`severity-${normalSeverity(event.severity)}`} key={event.id}><SeverityBadge evidence={event} /><strong>{event.providerName ?? event.entityId}</strong><span>{event.summary}</span><small>{formatDate(event.observedAt)}</small><EvidenceReceiptView evidence={event} title="Evidence" compact /></div>)}
            {!pulseSummary.recentDegradations.length && <p className="muted empty-state">No service reachability degradations observed.</p>}
          </div>
        </div>
      </aside>}
    </section>
    </main>
    <footer className="site-footer">
      <p>INFOPUNKS PAY.SH RADAR</p>
      <small>Catalog-derived trust, signal, routing, and safe metadata monitoring. Unknowns stay visible.</small>
    </footer>
  </div>;
}

function Metric({ label, value, sub, evidence }: { label: string; value: string | number; sub: string; evidence?: EvidenceReceipt | null }) {
  return <div className="panel metric"><ScopeLabel scope="GLOBAL" /><span>{label}</span><strong>{value}</strong><small>{sub}</small><EvidenceReceiptView evidence={evidence} title="Evidence" compact /></div>;
}

function EcosystemInterpretationPanel({ interpretations, providerLookup }: { interpretations: EcosystemInterpretation[]; providerLookup: Map<string, Provider> }) {
  const safeInterpretations = Array.isArray(interpretations) ? interpretations : [];
  const primary = safeInterpretations[0] ?? null;
  const secondary = safeInterpretations.slice(1, 5);
  if (!primary) return null;
  return <section className="panel ecosystem-interpretation" aria-labelledby="ecosystem-interpretation-title">
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Interpretation Layer</p>
        <h2 id="ecosystem-interpretation-title">Ecosystem Interpretation</h2>
      </div>
      <small>{primary.severity.toUpperCase()} / confidence {Math.round(primary.confidence * 100)}%</small>
    </div>
    <article className={`interpretation-primary ${primary.severity}`}>
      <div className="interpretation-copy">
        <strong>{primary.interpretation_title}</strong>
        <p className="interpretation-summary">{safeInterpretationSummary(primary.interpretation_summary)}</p>
      </div>
      <InterpretationMeta interpretation={primary} providerLookup={providerLookup} />
      <EvidenceReceiptView evidence={primary.evidence ?? primary} title="Evidence" compact />
    </article>
    {!!secondary.length && <div className="interpretation-secondary" aria-label="Secondary ecosystem interpretations">
      {secondary.map((interpretation) => <article key={interpretation.interpretation_id} className={interpretation.severity}>
        <strong>{interpretation.interpretation_title}</strong>
        <p className="interpretation-summary">{safeInterpretationSummary(interpretation.interpretation_summary)}</p>
        <InterpretationMeta interpretation={interpretation} providerLookup={providerLookup} />
        <EvidenceReceiptView evidence={interpretation.evidence ?? interpretation} title="Evidence" compact />
      </article>)}
    </div>}
  </section>;
}

function InterpretationMeta({ interpretation, providerLookup }: { interpretation: EcosystemInterpretation; providerLookup: Map<string, Provider> }) {
  const affectedCategories = asArray<string>(interpretation.affected_categories);
  const affectedProviders = asArray<string>(interpretation.affected_providers);
  const supportingEventIds = asArray<string>(interpretation.supporting_event_ids);
  const categories = affectedCategories.length ? compactList(affectedCategories, 3) : 'global';
  const providers = affectedProviders.length;
  const knownProviderCount = affectedProviders.filter((id) => providerLookup.has(id)).length;
  const providerCountLabel = providers > 0
    ? knownProviderCount === providers
      ? `${providers} affected providers`
      : `${providers} affected providers (${knownProviderCount} named)`
    : 'no affected providers';
  const events = interpretation.supporting_event_count ?? supportingEventIds.length;
  const remaining = interpretation.remaining_event_count ?? 0;
  return <div className="interpretation-meta">
    <span>categories: {categories}</span>
    <span>providers: {providerCountLabel}</span>
    <span>severity: {interpretation.severity}</span>
    <span>confidence: {Math.round(interpretation.confidence * 100)}%</span>
    <span>window: {formatDate(interpretation.observed_window.started_at)} to {formatDate(interpretation.observed_window.ended_at)}</span>
    <span>evidence: {events} supporting events{remaining > 0 ? ` (${remaining} not shown inline)` : ''}</span>
    {interpretation.view_full_receipts_url ? <a href={interpretation.view_full_receipts_url}>view full receipts</a> : null}
  </div>;
}

function PulseStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="pulse-stat"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function PropagationWatch({ propagation }: { propagation?: PropagationAnalysis | null }) {
  const current = propagation ?? {
    propagation_state: 'unknown',
    propagation_reason: 'Propagation analysis is not available in this pulse payload.',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: null,
    latest_observed_at: null,
    supporting_event_ids: [],
    supporting_event_count: 0,
    remaining_event_count: 0,
    confidence: 0,
    severity: 'unknown',
    view_full_receipts_url: undefined
  } satisfies PropagationAnalysis;
  const totalSupportingEvents = current.supporting_event_count ?? current.supporting_event_ids.length;
  const remainingSupportingEvents = current.remaining_event_count ?? Math.max(0, totalSupportingEvents - current.supporting_event_ids.length);
  return <div className={`panel propagation-watch ${current.propagation_state}`}>
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Contagion Watch</p>
        <h2>Propagation Watch</h2>
        <p className="panel-caption">Deterministic read across degradations, trust drops, unknown telemetry, narratives, and graph adjacency.</p>
      </div>
      <span className={`severity-label ${current.severity}`}>severity {current.severity}</span>
    </div>
    <div className="propagation-state">
      <span>state</span>
      <strong>{current.propagation_state}</strong>
      <small>confidence {Math.round(current.confidence * 100)}%</small>
    </div>
    <KeyValues rows={[
      ['cluster', current.affected_cluster ?? 'none'],
      ['categories', current.affected_categories.length ? current.affected_categories.join(', ') : 'none'],
      ['first seen', formatDate(current.first_observed_at)],
      ['latest', formatDate(current.latest_observed_at)]
    ]} />
    <p className="monitor-note">{current.propagation_reason}</p>
    <div className="affected-provider-list" aria-label="Top affected providers">
      {current.affected_providers.slice(0, 5).map((provider) => <span key={provider.provider_id}>{provider.provider_name} · {provider.category} · {provider.event_count} events</span>)}
      {!current.affected_providers.length && <span>No affected providers in active window</span>}
    </div>
    <details className="receipt compact propagation-evidence">
      <summary>Evidence</summary>
      <div className="receipt-grid">
        <p><b>supporting events</b><span>{totalSupportingEvents}{remainingSupportingEvents > 0 ? ` (${remainingSupportingEvents} not shown inline)` : ''}</span></p>
        <p><b>recent degradations</b><span>monitor degradation and failure events</span></p>
        <p><b>narrative heatmap</b><span>{current.affected_cluster ?? 'no affected heatmap cluster'}</span></p>
        <p><b>graph layer</b><span>category, tag, and narrative adjacency considered</span></p>
        <p><b>receipts</b><span>{current.view_full_receipts_url ? <a href={current.view_full_receipts_url}>view full receipts</a> : 'none'}</span></p>
      </div>
    </details>
  </div>;
}

function ZoneHeader({ eyebrow, title, subtitle, scope }: { eyebrow: string; title: string; subtitle: string; scope: 'GLOBAL' | 'PROVIDER' }) {
  const id = scope === 'GLOBAL' ? 'ecosystem-zone-title' : 'provider-zone-title';
  return <header className="zone-header">
    <div>
      <p className="zone-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p>{subtitle}</p>
    </div>
    <ScopeLabel scope={scope} />
  </header>;
}

function ScopeLabel({ scope, context }: { scope: 'GLOBAL' | 'PROVIDER'; context?: string }) {
  return <span className={`scope-label ${scope.toLowerCase()}`}>{scope}{context ? ` · ${context}` : ''}</span>;
}

function TimingItem({ label, value }: { label: string; value: string }) {
  return <div className="timing-item"><span>{label}</span><strong>{value}</strong></div>;
}

function RouteDecisionOutput({ routeResult, routePreference, selectedProvider }: { routeResult: RouteResult; routePreference: RoutePreference; selectedProvider: Provider }) {
  const fallbackItems = routeResult.fallbackDetails?.length
    ? routeResult.fallbackDetails
    : routeResult.fallbackProviders.map((provider) => ({ provider, trustAssessment: null, signalAssessment: null, rank: null, relevance: null, riskNotes: [] }));
  const unknownTelemetry = routeResult.unknownTelemetry?.length
    ? routeResult.unknownTelemetry
    : routeResult.riskNotes.filter((note) => /unknown|unavailable/i.test(note));
  const selectedMiss = routeResult.bestProvider && routeResult.bestProvider.id !== selectedProvider.id ? routeResult.selectedProviderNotRecommendedReason : null;

  return <div className="route decision-output">
    <div className="decision-head">
      <div>
        <span>recommended route</span>
        <strong>{routeResult.bestProvider?.name ?? 'No route'}</strong>
      </div>
      <small>{routeResult.scoringInputs?.source ?? 'LIVE PAY.SH CATALOG'} / {routeResult.preference ?? routePreference} / catalog-derived recommendation</small>
    </div>
    {!routeResult.bestProvider && <p className="route-state warn">no route matched constraints</p>}
    {routeResult.bestProvider && <>
      <div className="intel-summary compact route-score-grid">
        <DossierStat label="category" value={routeResult.bestProvider.category} sub="catalog class" />
        <DossierStat label="trust" value={routeResult.trustAssessment?.score ?? null} sub={routeResult.trustAssessment?.grade ?? 'grade unknown'} />
        <DossierStat label="signal" value={routeResult.signalAssessment?.score ?? null} sub={routeResult.signalAssessment?.narratives[0] ?? 'narrative unknown'} />
        <DossierStat label="endpoints" value={routeResult.bestProvider.endpointCount} sub="catalog count" />
        <DossierStat label="pricing" value={formatPrice(routeResult.estimatedCost ?? routeResult.bestProvider.pricing)} sub="catalog range" />
        <DossierStat label="coordination" value={routeResult.coordinationScore ?? null} sub="trust/signal weighted" />
      </div>
      {selectedMiss && <p className="route-state warn">Selected provider was not top route because: {selectedMiss}</p>}
    </>}
    <DossierSection title="Rationale">
      {(routeResult.rationale?.length ? routeResult.rationale : routeResult.reasoning).map((line) => <p key={line}>{line}</p>)}
    </DossierSection>
    <DossierSection title="Fallback Providers">
      <div className="fallback-list">
        {fallbackItems.map((candidate) => <div key={candidate.provider.id}>
          <strong>{candidate.provider.name}</strong>
          <span>trust {candidate.trustAssessment?.score ?? 'unknown'} / signal {candidate.signalAssessment?.score ?? 'unknown'} / {formatPrice(candidate.provider.pricing)}</span>
          <small>rank {candidate.rank ?? 'unknown'} / relevance {candidate.relevance ?? 'unknown'}</small>
        </div>)}
        {!routeResult.fallbackProviders.length && <p className="muted empty-state">No fallback providers met the current constraints.</p>}
      </div>
    </DossierSection>
    <DossierSection title="Unknown Telemetry Warning">
      {unknownTelemetry.length
        ? <div className="risk-list">{unknownTelemetry.map((note) => <span key={note}>{note}</span>)}</div>
        : <p>No unknown telemetry warning was emitted for this recommended route.</p>}
    </DossierSection>
  </div>;
}

function DossierStat({ label, value, sub }: { label: string; value: string | number | null; sub: string }) {
  return <div className="dossier-stat"><span>{label}</span><strong>{value ?? 'unknown'}</strong><small>{sub}</small></div>;
}

function SeverityBadge({ evidence }: { evidence?: EvidenceReceipt | null }) {
  const severity = normalSeverity(evidence?.severity);
  const reason = evidence?.severity_reason ?? evidence?.severityReason ?? 'severity unknown';
  return <span className={`severity-badge severity-${severity}`} title={reason}>SEVERITY {severity.toUpperCase()}</span>;
}

function DossierSection({ title, children, context }: { title: string; children: React.ReactNode; context?: string }) {
  return <section className="dossier-section">
    <div className="dossier-section-head">
      <h4>{title}</h4>
      {context && <ScopeLabel scope="PROVIDER" context={context} />}
    </div>
    {children}
  </section>;
}

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return <div className="key-values">{rows.map(([label, value]) => <p key={label}><b>{label}</b><span>{value}</span></p>)}</div>;
}

function Leaderboard({ title, scores, providers, kind }: { title: string; scores: any[]; providers: Map<string, Provider>; kind: string }) {
  const safeScores = Array.isArray(scores) ? scores : [];
  return <div className="panel"><ScopeLabel scope="GLOBAL" /><h2>{title}</h2><div className="leaderboard">{safeScores.map((score, index) => <div className="bar" key={score.entityId ?? `${title}-${index}`}><span>{providers.get(score.entityId)?.name ?? 'unknown provider'}</span><div><i style={{ width: `${score.score ?? 0}%` }} /></div><b>{score.score ?? 'unknown'}{kind === 'trust' ? ` ${score.grade ?? '-'}` : ''}</b></div>)}</div></div>;
}

function AssessmentPanel({ title, score, sub, components, context, evidence }: { title: string; score: number | null; sub: string; components: Record<string, number | null>; context: string; evidence?: EvidenceReceipt }) {
  return <div className="panel assessment">
    <ScopeLabel scope="PROVIDER" context={context} />
    <h2>{title}</h2>
    <strong>{score ?? 'unknown'}</strong>
    <span>{sub}</span>
    <div className="component-list">{Object.entries(components).map(([key, value]) => <p key={key}><b>{key}</b><i>{value ?? 'unknown'}</i></p>)}</div>
    <EvidenceReceiptView evidence={evidence} title="Evidence" />
  </div>;
}

export function PropagationIncidentPage({ clusterId }: { clusterId: string }) {
  const [incident, setIncident] = useState<PropagationIncident | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let active = true;
    api<{ data: PropagationIncident }>(`/v1/propagation/${clusterId}`)
      .then((response) => {
        if (!active) return;
        setIncident(response.data);
        setMissing(false);
        updatePropagationPageMetadata(response.data, clusterId, false);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        updatePropagationPageMetadata(null, clusterId, true);
      });
    return () => {
      active = false;
    };
  }, [clusterId]);

  async function copyShareUrl() {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  }

  if (missing) return <main className="shell"><section className="panel"><h1>Propagation Cluster Not Found</h1><p className="copy">No incident currently matches cluster id <code>{clusterId}</code>.</p></section></main>;
  if (!incident) return <main className="boot">LOADING PROPAGATION INCIDENT...</main>;

  return <main className="shell propagation-incident-page">
    <section className={`panel propagation-watch ${incident.propagation_state}`}>
      <p className="eyebrow">Infopunks Pay.sh Radar Incident Intelligence</p>
      <h1>Propagation Incident {incident.cluster_id}</h1>
      <div className="propagation-state">
        <span>state</span><strong>{incident.propagation_state}</strong>
        <span>severity</span><strong>{incident.severity}</strong>
        <small>current status: {incident.current_status}</small>
      </div>
      <p className="copy">{incident.propagation_reason}</p>
      <button type="button" className="methodology-trigger" onClick={copyShareUrl}>Share URL {copyState === 'copied' ? '(copied)' : copyState === 'failed' ? '(failed)' : ''}</button>
    </section>
    <section className="grid two">
      <div className="panel">
        <h2>Incident Facts</h2>
        <KeyValues rows={[
          ['Affected cluster', incident.affected_cluster ?? 'none'],
          ['Affected categories', incident.affected_categories.join(', ') || 'none'],
          ['Affected providers', String(incident.affected_providers.length)],
          ['First observed at', formatDate(incident.first_observed_at)],
          ['Latest observed at', formatDate(incident.latest_observed_at)],
          ['Confidence', formatConfidence(incident.confidence)],
          ['Supporting events', String(incident.supporting_event_ids.length)]
        ]} />
      </div>
      <div className="panel">
        <h2>Links</h2>
        <div className="delta-list">
          <div className="delta-row">
            <strong>Supporting Receipts</strong>
            {incident.supporting_receipt_links.map((item) => <a key={item.event_id} href={item.href}>{item.event_id}</a>)}
          </div>
          <div className="delta-row">
            <strong>Related Providers</strong>
            {incident.related_provider_links.map((item) => <a key={item.provider_id} href={item.href}>{item.provider_name}</a>)}
          </div>
          <div className="delta-row">
            <strong>Related Interpretations</strong>
            {incident.related_interpretation_links.length ? incident.related_interpretation_links.map((item) => <a key={item.interpretation_id} href={item.href}>{item.title}</a>) : <span>none</span>}
          </div>
        </div>
      </div>
    </section>
    <section className="panel">
      <h2>Incident Timeline</h2>
      <div className="event-feed">
        {incident.timeline.map((event) => <div key={event.event_id} id={`event-${event.event_id}`} className={`feed-row ${event.category} severity-${normalSeverity(event.severity)}`}>
          <span>{event.category}</span>
          <strong>{event.type}</strong>
          <p>{event.summary}</p>
          <time>{formatDate(event.observed_at)}</time>
          <a href={`/v1/events/${event.event_id}`}>receipt</a>
        </div>)}
        {!incident.timeline.length && <p className="muted empty-state">No supporting events available for this incident.</p>}
      </div>
    </section>
  </main>;
}

const eventCategories: EventCategory[] = ['discovery', 'trust', 'monitoring', 'pricing', 'schema', 'signal'];

function DeltaPanel({ title, caption, deltas, empty, scope }: { title: string; caption?: string; deltas: ScoreDelta[]; empty: string; scope?: 'GLOBAL' | 'PROVIDER' }) {
  return <div className="panel">
    {scope && <ScopeLabel scope={scope} />}
    <h2>{title}</h2>
    {caption && <p className="panel-caption">{caption}</p>}
    <div className="delta-list">
      {deltas.slice(0, 6).map((delta) => <div className={`delta-row ${delta.direction}`} key={delta.eventId}>
        <SeverityBadge evidence={delta} />
        <strong>{delta.providerName}</strong>
        <span>{formatScoreDelta(delta)}</span>
        <small>{formatDate(delta.observedAt)}</small>
        <EvidenceReceiptView evidence={delta} title="Evidence" compact />
      </div>)}
      {!deltas.length && <p className="muted">{empty}</p>}
    </div>
  </div>;
}

function EvidenceReceiptView({ evidence, title = 'Evidence', compact = false }: { evidence?: EvidenceReceipt | null; title?: string; compact?: boolean }) {
  const receipt = normalizeEvidence(evidence);
  if (!receipt) return <details className={`receipt ${compact ? 'compact' : ''}`}><summary>{title}</summary><p className="receipt-note">No evidence receipt available.</p></details>;
  return <details className={`receipt ${compact ? 'compact' : ''}`}>
    <summary>{title}</summary>
    <div className="receipt-grid">
      <p><b>event_id</b><span>{receipt.event_id ?? 'none'}</span></p>
      <p><b>provider_id</b><span>{receipt.provider_id ?? 'unknown'}</span></p>
      <p><b>endpoint_id</b><span>{receipt.endpoint_id ?? 'provider-level evidence only'}</span></p>
      <p><b>observed_at</b><span>{formatDate(receipt.observed_at)}</span></p>
      <p><b>catalog_generated_at</b><span>{formatDate(receipt.catalog_generated_at)}</span></p>
      <p><b>ingested_at</b><span>{formatDate(receipt.ingested_at)}</span></p>
      <p><b>source</b><span>{receipt.source ?? 'unknown'}</span></p>
      <p><b>confidence</b><span>{formatConfidence(receipt.confidence)}</span></p>
      <p><b>severity</b><span>{severityLabel(receipt)}</span></p>
      <p><b>severity_score</b><span>{receipt.severity_score ?? 'unknown'}</span></p>
      <p><b>severity_window</b><span>{receipt.severity_window ?? 'none'}</span></p>
    </div>
    <p className="receipt-note">{receipt.derivation_reason ?? receipt.summary ?? 'Deterministic evidence receipt.'}</p>
  </details>;
}

function normalizeEvidence(input?: EvidenceReceipt | null): EvidenceReceipt | null {
  if (!input) return null;
  const nested = firstNestedEvidence(input.evidence);
  const source = nested ?? input;
  return {
    event_id: source.event_id ?? source.eventId ?? input.event_id ?? input.eventId ?? null,
    provider_id: source.provider_id ?? source.providerId ?? input.provider_id ?? input.providerId ?? null,
    endpoint_id: source.endpoint_id ?? source.endpointId ?? input.endpoint_id ?? input.endpointId ?? null,
    observed_at: resolveObservedAt(source) ?? resolveObservedAt(input),
    catalog_generated_at: source.catalog_generated_at ?? source.catalogGeneratedAt ?? input.catalog_generated_at ?? input.catalogGeneratedAt ?? null,
    ingested_at: source.ingested_at ?? source.ingestedAt ?? input.ingested_at ?? input.ingestedAt ?? null,
    source: source.source ?? input.source ?? null,
    derivation_reason: source.derivation_reason ?? source.derivationReason ?? source.summary ?? input.derivation_reason ?? input.derivationReason ?? input.summary ?? null,
    confidence: source.confidence ?? input.confidence ?? null,
    severity: source.severity ?? input.severity ?? 'unknown',
    severity_reason: source.severity_reason ?? source.severityReason ?? input.severity_reason ?? input.severityReason ?? null,
    severity_score: source.severity_score ?? source.severityScore ?? input.severity_score ?? input.severityScore ?? null,
    severity_window: source.severity_window ?? source.severityWindow ?? input.severity_window ?? input.severityWindow ?? null,
    summary: source.summary ?? input.summary ?? null
  };
}

function firstNestedEvidence(evidence: EvidenceReceipt['evidence']): EvidenceReceipt | null {
  if (!evidence) return null;
  if (Array.isArray(evidence)) return evidence[0] ?? null;
  if ('event_id' in evidence || 'eventId' in evidence) return evidence as EvidenceReceipt;
  const firstList = Object.values(evidence).find((items): items is EvidenceReceipt[] => Array.isArray(items) && items.length > 0);
  return firstList?.[0] ?? null;
}

function resolveProviderEndpointRows(detail: ProviderDetail | null, intel: ProviderIntelligence | null) {
  const candidates = [
    detail?.endpoints,
    intel?.endpoints,
    intel?.endpointList
  ];
  return candidates.find((items): items is Endpoint[] => Array.isArray(items) && items.length > 0) ?? [];
}

function formatPrice(price: Pricing) {
  if (price.min === null || price.max === null) return price.raw || 'unknown';
  if (price.min === 0 && price.max === 0) return 'free';
  return price.min === price.max ? `$${price.min}` : `$${price.min} - $${price.max}`;
}

function moneyOrUnknown(value: number | null | undefined) {
  return typeof value === 'number' ? `$${value}` : 'unknown';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'unknown';
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatInterval(value: number | null | undefined) {
  if (!value) return null;
  const minutes = value / 60_000;
  if (Number.isInteger(minutes)) return `${minutes} min`;
  return `${Number(minutes.toFixed(1))} min`;
}

function formatMs(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}ms` : 'unknown';
}

function formatConfidence(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'deterministic';
}

function normalSeverity(value: unknown): Severity {
  return value === 'critical' || value === 'warning' || value === 'informational' || value === 'unknown' ? value : 'unknown';
}

function severityRank(value: unknown) {
  const severity = normalSeverity(value);
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  if (severity === 'informational') return 2;
  return 3;
}

function sortBySeverity<T extends EvidenceReceipt>(items: T[]) {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || ((b.severity_score ?? b.severityScore ?? 0) - (a.severity_score ?? a.severityScore ?? 0)));
}

function severityLabel(receipt: EvidenceReceipt) {
  const severity = normalSeverity(receipt.severity).toUpperCase();
  const reason = receipt.severity_reason ?? receipt.severityReason ?? 'No deterministic severity reason available.';
  return `${severity}: ${reason}`;
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) return 'unknown';
  return value ? 'yes' : 'no';
}

function resolveObservedAt(value: { observed_at?: unknown; observedAt?: unknown; timestamp?: unknown; created_at?: unknown } | null | undefined) {
  if (!value) return null;
  const candidate = value.observed_at ?? value.observedAt ?? value.timestamp ?? value.created_at;
  return typeof candidate === 'string' ? candidate : null;
}

function statusLabel(status: string) {
  if (/reachable|healthy|ok/i.test(status)) return `[OK] ${status}`;
  if (/degraded|slow/i.test(status)) return `[DEGRADED] ${status}`;
  if (/failed|failure|down|error/i.test(status)) return `[FAILED] ${status}`;
  return `[?] ${status || 'unknown'}`;
}

function riskLabel(risk: string) {
  if (/high|warning|elevated/i.test(risk)) return `[WARNING] ${risk}`;
  if (/low|clear|safe/i.test(risk)) return `[OK] ${risk}`;
  return `[?] ${risk || 'unknown'}`;
}

function eventCategoryIcon(category: EventCategory) {
  const labels: Record<EventCategory, string> = {
    discovery: '[DISC]',
    trust: '[TRUST]',
    monitoring: '[MON]',
    pricing: '[$]',
    schema: '[SCHEMA]',
    signal: '[SIGNAL]'
  };
  return labels[category];
}

function componentValue(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}/100` : 'unknown';
}

function knownState(value: number | null | undefined) {
  return typeof value === 'number' ? `known ${value}/100` : 'unknown';
}

function formatRotationCountdown(valueMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatScoreDelta(delta: ScoreDelta) {
  const score = delta.score ?? 'unknown';
  if (delta.delta === null) return `[UNKNOWN] ${score} / prior unavailable`;
  const direction = delta.delta > 0 ? '[IMPROVED]' : delta.delta < 0 ? '[DEGRADED]' : '[UNCHANGED]';
  const prefix = delta.delta > 0 ? '+' : '';
  return `${direction} ${score} (${prefix}${delta.delta})`;
}

function compactCategories(categories: Record<EventCategory, number>) {
  const active = Object.entries(categories).filter(([, count]) => count > 0).map(([category, count]) => `${category}:${count}`);
  return active.length ? active.join(' / ') : 'no categorized activity';
}

function compactList(items: string[], limit: number) {
  if (items.length <= limit) return items.join(', ');
  const shown = items.slice(0, limit).join(', ');
  return `${shown} +${items.length - limit} more`;
}

function safeInterpretationSummary(summary: string) {
  if (!summary) return '';
  return summary
    .replace(/\b0x[a-fA-F0-9]{16,}\b/g, '[id]')
    .replace(/\b[a-fA-F0-9]{24,}\b/g, '[id]')
    .replace(/\b[a-zA-Z0-9_-]{28,}\b/g, '[id]');
}

function groupTimelineByBatch(events: PulseEvent[]) {
  const groups = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const observedAt = resolveObservedAt(event as unknown as Record<string, unknown>) ?? event.observedAt;
    const batch = groups.get(observedAt) ?? [];
    batch.push(event);
    groups.set(observedAt, batch);
  }
  return [...groups.entries()].map(([observedAt, batchEvents]) => ({ observedAt, events: batchEvents }));
}

function sourceLabel(source: DataSource) {
  return source.mode === 'live_pay_sh_catalog' && !source.used_fixture ? 'LIVE PAY.SH CATALOG' : 'FIXTURE FALLBACK';
}

function graphFallbackEvidence(graph: { nodes: unknown[]; edges: unknown[] }): EvidenceReceipt {
  return {
    event_id: null,
    provider_id: null,
    endpoint_id: null,
    source: 'infopunks:graph-layer',
    derivation_reason: `Graph layer rendered ${graph.nodes.length} nodes and ${graph.edges.length} deterministic edges from current API payload.`,
    confidence: 1
  };
}

function compareProviders(a: Provider, b: Provider, sort: string, trustLookup: Map<string, TrustAssessment>, signalLookup: Map<string, SignalAssessment>) {
  const severity = severityRank(a.severity) - severityRank(b.severity);
  if (severity !== 0) return severity;
  if (sort === 'trust score') return (b.latestTrustScore ?? trustLookup.get(b.id)?.score ?? -1) - (a.latestTrustScore ?? trustLookup.get(a.id)?.score ?? -1) || a.name.localeCompare(b.name);
  if (sort === 'signal score') return (b.latestSignalScore ?? signalLookup.get(b.id)?.score ?? -1) - (a.latestSignalScore ?? signalLookup.get(a.id)?.score ?? -1) || a.name.localeCompare(b.name);
  if (sort === 'endpoint count') return b.endpointCount - a.endpointCount || a.name.localeCompare(b.name);
  if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}

function formatDataSource(source: DataSource, providers: number, endpoints: number) {
  const sourceUrl = source.url?.replace(/^https?:\/\//, '') ?? 'pay.sh/api/catalog';
  return `Source: ${sourceUrl} · providers ${source.provider_count ?? providers} · endpoints ${endpoints} · last ingested ${formatDate(source.last_ingested_at ?? source.generated_at)}`;
}

export function App() {
  const propagationId = routePropagationId(window.location.pathname);
  if (propagationId) return <PropagationIncidentPage clusterId={propagationId} />;
  const receiptId = routeReceiptId(window.location.pathname);
  if (receiptId) return <PublicReceiptPage eventId={receiptId} />;
  const providerId = routeProviderId(window.location.pathname);
  if (providerId) return <PublicProviderPage providerId={providerId} />;
  return <RadarApp />;
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
