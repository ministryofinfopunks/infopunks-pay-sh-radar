import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Provider = { id: string; name: string; title?: string; namespace: string; fqn?: string; category: string; description: string | null; useCase?: string | null; serviceUrl?: string | null; endpointCount: number; endpointMetadataPartial?: boolean; hasMetering?: boolean; hasFreeTier?: boolean; sourceSha?: string | null; catalogGeneratedAt?: string | null; pricing: { min: number | null; max: number | null; clarity: string; raw: string }; tags: string[]; status: string; lastSeenAt?: string; latestTrustScore?: number | null; latestTrustGrade?: string; latestSignalScore?: number | null };
type Endpoint = { id: string; providerId: string; name: string; path: string | null; method: string | null; category: string; description: string | null; status: string; pricing: Provider['pricing']; lastSeenAt: string; latencyMsP50: number | null };
type TrustAssessment = { entityId: string; score: number | null; grade: string; components: Record<string, number | null>; unknowns: string[] };
type SignalAssessment = { entityId: string; score: number | null; narratives: string[]; components: Record<string, number | null>; unknowns: string[] };
type Narrative = { id: string; title: string; heat: number | null; momentum: number | null; providerIds: string[]; keywords: string[]; summary: string };
type DataSource = { mode: 'live_pay_sh_catalog' | 'fixture_fallback'; url: string | null; generated_at: string | null; provider_count: number | null; last_ingested_at: string | null; used_fixture: boolean; error?: string | null };
type Pulse = { providerCount: number; endpointCount: number; eventCount: number; averageTrust: number | null; averageSignal: number | null; hottestNarrative: Narrative | null; topTrust: TrustAssessment[]; topSignal: SignalAssessment[]; data_source: DataSource; updatedAt: string };
type HistoryItem = { id: string; type: string; observedAt: string; source: string; summary: string };
type ProviderDetail = { provider: Provider; endpoints: Endpoint[]; trustAssessment: TrustAssessment | null; signalAssessment: SignalAssessment | null };
type ProviderIntelligence = {
  latest_trust_score: number | null;
  latest_signal_score: number | null;
  risk_level: string;
  coordination_eligible: boolean | null;
  unknown_telemetry: string[];
  recent_changes: HistoryItem[];
  endpoint_count: number;
  endpoint_health: { healthy: number; degraded: number; failed: number; unknown: number; last_checked_at: string | null; median_latency_ms: number | null; recent_failures: HistoryItem[] };
  category_tags: string[];
  last_seen_at: string | null;
};
type EndpointMonitor = { health: string; lastCheck: { observedAt: string; payload: Record<string, unknown> } | null; recentFailures: HistoryItem[] };
type EventCategory = 'discovery' | 'trust' | 'monitoring' | 'pricing' | 'schema' | 'signal';
type PulseEvent = { id: string; type: string; category: EventCategory; source: string; entityType: string; entityId: string; providerId: string | null; providerName: string | null; observedAt: string; summary: string };
type ScoreDelta = { eventId: string; providerId: string; providerName: string; score: number | null; previousScore: number | null; delta: number | null; observedAt: string; direction: string };
type ProviderActivity = { providerId: string; providerName: string; count: number; categories: Record<EventCategory, number>; lastObservedAt: string | null };
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
  providerActivity: Record<'1h' | '24h' | '7d', ProviderActivity[]>;
  signalSpikes: ScoreDelta[];
  data_source: DataSource;
};

type AppData = { providers: Provider[]; pulse: Pulse; narratives: Narrative[]; graph: { nodes: unknown[]; edges: unknown[] } };
type RoutePreference = 'cheapest' | 'highest_trust' | 'balanced';
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
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json() as Promise<T>;
}

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState('stableenrich');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryCategory, setDirectoryCategory] = useState('all');
  const [directorySort, setDirectorySort] = useState('trust score');
  const [searchQuery, setSearchQuery] = useState('multimodal generation');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [routeTask, setRouteTask] = useState('Find a low-cost image generation route for an autonomous design agent');
  const [routeCategory, setRouteCategory] = useState('all');
  const [routeMaxPrice, setRouteMaxPrice] = useState('0.1');
  const [routeMinTrust, setRouteMinTrust] = useState(70);
  const [routePreference, setRoutePreference] = useState<RoutePreference>('balanced');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(null);
  const [providerIntel, setProviderIntel] = useState<ProviderIntelligence | null>(null);
  const [endpointMonitors, setEndpointMonitors] = useState<Record<string, EndpointMonitor>>({});
  const [pulseSummary, setPulseSummary] = useState<PulseSummary | null>(null);
  const [pulseWindow, setPulseWindow] = useState<'1h' | '24h' | '7d'>('24h');

  useEffect(() => {
    Promise.all([
      api<{ data: Provider[] }>('/v1/providers'),
      api<{ data: Pulse }>('/v1/pulse'),
      api<{ data: Narrative[] }>('/v1/narratives'),
      api<{ data: { nodes: unknown[]; edges: unknown[] } }>('/v1/graph'),
      api<{ data: PulseSummary }>('/v1/pulse/summary')
    ]).then(([providers, pulse, narratives, graph, summary]) => {
      setData({ providers: providers.data, pulse: pulse.data, narratives: narratives.data, graph: graph.data });
      setPulseSummary(summary.data);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      Promise.all([
        api<{ data: Pulse }>('/v1/pulse'),
        api<{ data: PulseSummary }>('/v1/pulse/summary')
      ]).then(([pulse, summary]) => {
        if (!active) return;
        setData((current) => current ? { ...current, pulse: pulse.data } : current);
        setPulseSummary(summary.data);
      }).catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    api<{ data: any[] }>('/v1/search', { method: 'POST', body: JSON.stringify({ query: searchQuery, limit: 6 }) }).then((res) => setSearchResults(res.data));
  }, [searchQuery]);

  const selectedProvider = data?.providers.find((provider) => provider.id === selectedId) ?? data?.providers[0];
  const providerLookup = useMemo(() => new Map(data?.providers.map((provider) => [provider.id, provider]) ?? []), [data]);
  const trustLookup = useMemo(() => new Map(data?.pulse.topTrust.map((assessment) => [assessment.entityId, assessment]) ?? []), [data]);
  const signalLookup = useMemo(() => new Map(data?.pulse.topSignal.map((assessment) => [assessment.entityId, assessment]) ?? []), [data]);
  const categoryOptions = useMemo(() => Array.from(new Set(data?.providers.map((provider) => provider.category).filter(Boolean) ?? [])).sort(), [data]);
  const filteredProviders = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return [...(data?.providers ?? [])]
      .filter((provider) => directoryCategory === 'all' || provider.category === directoryCategory)
      .filter((provider) => !query || [provider.name, provider.id, provider.fqn, provider.category, provider.description, ...(provider.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a, b) => compareProviders(a, b, directorySort, trustLookup, signalLookup));
  }, [data, directoryCategory, directoryQuery, directorySort, signalLookup, trustLookup]);
  const timelineBatches = useMemo(() => groupTimelineByBatch(pulseSummary?.timeline ?? []), [pulseSummary?.timeline]);
  const catalogNoChanges = Boolean(pulseSummary && pulseSummary.data_source.last_ingested_at && pulseSummary.latest_event_at && Date.parse(pulseSummary.data_source.last_ingested_at) > Date.parse(pulseSummary.latest_event_at));

  useEffect(() => {
    if (!selectedProvider) return;
    Promise.all([
      api<{ data: ProviderDetail }>(`/v1/providers/${selectedProvider.id}`),
      api<{ data: ProviderIntelligence }>(`/v1/providers/${selectedProvider.id}/intelligence`)
    ]).then(([detail, intel]) => {
      setProviderDetail(detail.data);
      setProviderIntel(intel.data);
      return Promise.all(detail.data.endpoints.slice(0, 40).map((endpoint) => api<{ data: EndpointMonitor }>(`/v1/endpoints/${endpoint.id}/monitor`).then((monitor) => [endpoint.id, monitor.data] as const)));
    }).then((monitors) => {
      setEndpointMonitors(Object.fromEntries(monitors));
    });
  }, [selectedProvider?.id]);

  function runRoute() {
    const maxPrice = routeMaxPrice.trim() === '' ? undefined : Number(routeMaxPrice);
    api<{ data: RouteResult }>('/v1/recommend-route', {
      method: 'POST',
      body: JSON.stringify({
        task: routeTask,
        category: routeCategory === 'all' ? undefined : routeCategory,
        trustThreshold: routeMinTrust,
        latencySensitivity: 'medium',
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        preference: routePreference
      })
    }).then((res) => setRouteResult(res.data));
  }

  function recommendProvider(provider: Provider) {
    setRouteTask(`Recommend a Pay.sh route for a task that could use ${provider.name} in ${provider.category}`);
    setRouteCategory(provider.category || 'all');
    window.requestAnimationFrame(() => document.getElementById('route-recommender')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  if (!data) return <main className="boot">INFOPUNKS//PAY.SH COGNITIVE LAYER BOOTING...</main>;

  return <main className="shell">
    <section className="hero panel">
      <div>
        <p className="eyebrow">Infopunks Intelligence Terminal</p>
        <h1>Cognitive Coordination Layer for the Pay.sh agent economy.</h1>
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

    <section className="grid four">
      <Metric label="Ecosystem Pulse" value={data.pulse.hottestNarrative?.title ?? 'unknown'} sub={`heat ${data.pulse.hottestNarrative?.heat ?? 'unknown'} / momentum ${data.pulse.hottestNarrative?.momentum ?? 'unknown'}`} />
      <Metric label="Trust Leader" value={providerLookup.get(data.pulse.topTrust[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topTrust[0]?.score ?? 'unknown'}/100 grade ${data.pulse.topTrust[0]?.grade ?? '-'}`} />
      <Metric label="Signal Leader" value={providerLookup.get(data.pulse.topSignal[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topSignal[0]?.score ?? 'unknown'}/100`} />
      <Metric label="Graph Layer" value={`${data.graph.nodes.length} nodes`} sub={`${data.graph.edges.length} deterministic edges`} />
    </section>

    {pulseSummary && <section className="radar-dashboard" aria-label="Radar intelligence dashboard">
      <div className="radar-left">
        <div className="panel pulse-feed">
          <div className="panel-head">
            <div>
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
          <div className="event-groups">
            {eventCategories.map((category) => <span key={category} className={`category ${category}`}>{category} {pulseSummary.eventGroups[category].count}</span>)}
          </div>
          <div className="event-feed">
            {timelineBatches.map((batch) => <div className="batch-group" key={batch.observedAt}>
              <div className="batch-head">
                <strong>Catalog batch</strong>
                <time>{formatTime(batch.observedAt)}</time>
                <span>{batch.events.length} events emitted</span>
              </div>
              <div className="batch-rows">
                {batch.events.map((event) => <div className={`feed-row ${event.category}`} key={event.id}>
                  <span>{event.category}</span>
                  <strong>{event.providerName ?? event.entityId}</strong>
                  <p>{event.summary}</p>
                </div>)}
              </div>
            </div>)}
            {!pulseSummary.timeline.length && <p className="muted empty-state">No pulse events observed in the current window.</p>}
          </div>
        </div>

        <div className="provider-stack">
          <div className="panel provider-directory-panel">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Catalog Index</p>
                <h2>Provider Directory</h2>
              </div>
              <small>{filteredProviders.length} / {data.providers.length} providers</small>
            </div>
            <div className="directory-controls">
              <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="filter provider, tag, FQN, category" />
              <div className="control-row">
                <select value={directorySort} onChange={(event) => setDirectorySort(event.target.value)} aria-label="Sort providers">
                  <option>trust score</option>
                  <option>signal score</option>
                  <option>endpoint count</option>
                  <option>category</option>
                  <option>name</option>
                </select>
              </div>
              <div className="category-chips">
                <button className={directoryCategory === 'all' ? 'selected' : ''} onClick={() => setDirectoryCategory('all')}>all</button>
                {categoryOptions.map((category) => <button key={category} className={directoryCategory === category ? 'selected' : ''} onClick={() => setDirectoryCategory(category)}>{category}</button>)}
              </div>
            </div>
            <div className="directory">
              {filteredProviders.map((provider) => <button key={provider.id} className={provider.id === selectedProvider?.id ? 'active row' : 'row'} onClick={() => setSelectedId(provider.id)}>
                <span>{provider.name}</span><small>{provider.category} / {provider.endpointCount} endpoints / trust {provider.latestTrustScore ?? 'unknown'}</small>
              </button>)}
              {!filteredProviders.length && <p className="muted empty-state">No providers match the current directory filters.</p>}
            </div>
          </div>
          <div className="panel intelligence dossier">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Selected Provider</p>
                <h2>Provider Intelligence Dossier</h2>
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
                </div>
              </div>
              <div className="intel-summary">
                <DossierStat label="trust" value={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'grade unknown'} />
                <DossierStat label="signal" value={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives[0] ?? 'narrative unknown'} />
                <DossierStat label="coordination" value={formatNullableBoolean(providerIntel?.coordination_eligible ?? null)} sub="eligible" />
                <DossierStat label="risk" value={providerIntel?.risk_level ?? 'unknown'} sub="level" />
                <DossierStat label="unknowns" value={providerIntel?.unknown_telemetry.length ?? 'unknown'} sub="telemetry fields" />
              </div>
              <div className="dossier-body">
                <DossierSection title="Capability Brief">
                  <p>{selectedProvider.description ?? 'No provider description supplied by catalog metadata.'}</p>
                  <p><b>use_case:</b> {selectedProvider.useCase ?? 'unknown'}</p>
                  {selectedProvider.serviceUrl && <p><b>service_url:</b> <a href={selectedProvider.serviceUrl} target="_blank" rel="noreferrer">{selectedProvider.serviceUrl}</a></p>}
                  <div className="chips compact-chips">{(providerIntel?.category_tags.length ? providerIntel.category_tags : selectedProvider.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
                </DossierSection>
                <div className="dossier-grid">
                  <DossierSection title="Market Metadata">
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
                  </DossierSection>
                  <DossierSection title="Trust Breakdown">
                    <KeyValues rows={[
                      ['metadata quality', componentValue(providerDetail?.trustAssessment?.components.metadataQuality)],
                      ['pricing clarity', componentValue(providerDetail?.trustAssessment?.components.pricingClarity)],
                      ['freshness', componentValue(providerDetail?.trustAssessment?.components.freshness)],
                      ['uptime', knownState(providerDetail?.trustAssessment?.components.uptime)],
                      ['latency', knownState(providerDetail?.trustAssessment?.components.latency)],
                      ['response validity', knownState(providerDetail?.trustAssessment?.components.responseValidity)],
                      ['receipt reliability', knownState(providerDetail?.trustAssessment?.components.receiptReliability)]
                    ]} />
                  </DossierSection>
                  <DossierSection title="Signal Breakdown">
                    <KeyValues rows={[
                      ['category heat', componentValue(providerDetail?.signalAssessment?.components.categoryHeat)],
                      ['ecosystem momentum', componentValue(providerDetail?.signalAssessment?.components.ecosystemMomentum)],
                      ['metadata change velocity', componentValue(providerDetail?.signalAssessment?.components.metadataChangeVelocity)],
                      ['social velocity', knownState(providerDetail?.signalAssessment?.components.socialVelocity)],
                      ['onchain/liquidity resonance', knownState(providerDetail?.signalAssessment?.components.onchainLiquidityResonance)]
                    ]} />
                  </DossierSection>
                  <DossierSection title="Unknown Telemetry">
                    <div className="unknown-list">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['No unknown telemetry reported by current assessments.']).map((item) => <span key={item}>{item}</span>)}</div>
                  </DossierSection>
                </div>
                <DossierSection title="Evidence Trail">
                  <div className="evidence-trail">
                    {(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).slice(0, 6).map((item) => <div key={item.id}>
                      <time>{formatDate(item.observedAt)}</time>
                      <strong>{item.type}</strong>
                      <span>{item.summary}</span>
                    </div>)}
                    {providerIntel?.recent_changes.length === 0 && <p className="muted empty-state">No recent discovery, update, price, category, endpoint-count, or metadata events after initial observation.</p>}
                  </div>
                </DossierSection>
                <button className="execute compact" onClick={() => recommendProvider(selectedProvider)}>recommend route</button>
              </div>
            </>}
          </div>
        </div>
      </div>

      <aside className="pulse-side" aria-label="Realtime intelligence sidebar">
        <div className="panel counter-grid">
          <PulseStat label="Events" value={pulseSummary.counters.events} sub={`${pulseSummary.counters.unknownTelemetry} unknown telemetry fields`} />
          <PulseStat label="Providers" value={pulseSummary.counters.providers} sub={`${pulseSummary.counters.endpoints} endpoints tracked`} />
        </div>
        <DeltaPanel title="Trust Changes" caption="Latest trust events from catalog scoring batches." deltas={pulseSummary.trustDeltas} empty="No trust deltas beyond initial scoring." />
        <DeltaPanel title="Signal Spikes" caption="Signal deltas appear only when catalog-derived signal changes." deltas={pulseSummary.signalSpikes} empty="No positive signal deltas observed." />
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Windowed Telemetry</p>
              <h2>Provider Activity</h2>
              <p className="panel-caption">Activity counts are event-spine activity, not Pay.sh transaction volume.</p>
            </div>
            <div className="window-tabs">
              {(['1h', '24h', '7d'] as const).map((windowName) => <button key={windowName} className={pulseWindow === windowName ? 'selected' : ''} onClick={() => setPulseWindow(windowName)}>{windowName}</button>)}
            </div>
          </div>
          <div className="activity-list">
            {pulseSummary.providerActivity[pulseWindow].map((item) => <div className="activity-row" key={item.providerId}>
              <strong>{item.providerName}</strong>
              <span>{item.count} events</span>
              <small>{compactCategories(item.categories)}</small>
            </div>)}
            {!pulseSummary.providerActivity[pulseWindow].length && <p className="muted empty-state">No provider activity in this window.</p>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Monitor Alerts</p>
              <h2>Recent Degradations</h2>
              <p className="panel-caption">Monitor events appear only when endpoint monitoring is enabled.</p>
            </div>
          </div>
          <div className="mini-feed">
            {pulseSummary.recentDegradations.map((event) => <div key={event.id}><strong>{event.providerName ?? event.entityId}</strong><span>{event.summary}</span><small>{formatDate(event.observedAt)}</small></div>)}
            {!pulseSummary.recentDegradations.length && <p className="muted empty-state">No endpoint degradations observed.</p>}
          </div>
        </div>
      </aside>
    </section>}

    <section className="grid three">
      <AssessmentPanel title="Trust Assessment" score={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'unknown'} components={providerDetail?.trustAssessment?.components ?? {}} />
      <AssessmentPanel title="Signal Assessment" score={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives.join(', ') || 'no narrative match'} components={providerDetail?.signalAssessment?.components ?? {}} />
      <div className="panel">
        <h2>Unknown Telemetry</h2>
        <div className="terminal-lines">
          <p>risk: {providerIntel?.risk_level ?? 'unknown'}</p>
          <p>coordination eligible: {formatNullableBoolean(providerIntel?.coordination_eligible ?? null)}</p>
          <p>endpoints: {providerIntel?.endpoint_count ?? selectedProvider?.endpointCount ?? 'unknown'}</p>
          <p>health: {providerIntel ? `${providerIntel.endpoint_health.healthy} ok / ${providerIntel.endpoint_health.degraded} degraded / ${providerIntel.endpoint_health.failed} failed / ${providerIntel.endpoint_health.unknown} unknown` : 'unknown'}</p>
        </div>
        <div className="chips">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['none']).map((item) => <span key={item}>{item}</span>)}</div>
      </div>
    </section>

    <section className="grid two">
      <div className="panel">
        <h2>Endpoint List</h2>
        <div className="endpoint-list">
          {(providerDetail?.endpoints ?? []).map((endpoint) => <div className="endpoint" key={endpoint.id}>
            {(() => {
              const monitor = endpointMonitors[endpoint.id];
              const payload = monitor?.lastCheck?.payload ?? {};
              return <>
            <strong>{endpoint.name}</strong>
            <span>{endpoint.method ?? 'METHOD_UNKNOWN'} {endpoint.path ?? 'path unavailable'}</span>
            <small>{endpoint.category} / {endpoint.status} / {formatPrice(endpoint.pricing)}</small>
            <small>health {monitor?.health ?? 'unknown'} / checked {formatDate(monitor?.lastCheck?.observedAt)} / latency {formatMs((payload.response_time_ms as number | undefined) ?? endpoint.latencyMsP50)}</small>
            {!!monitor?.recentFailures.length && <small className="failure-line">recent failure: {monitor.recentFailures[0].summary}</small>}
              </>;
            })()}
          </div>)}
        </div>
      </div>
      <div className="panel">
        <h2>Recent Changes</h2>
        <p className="panel-caption">Provider recent changes are catalog diff events.</p>
        <div className="timeline">
          {(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).map((item) => <div className="change" key={item.id}>
            <time>{formatDate(item.observedAt)}</time>
            <strong>{item.type}</strong>
            <span>{item.summary}</span>
          </div>)}
          {providerIntel?.recent_changes.length === 0 && <p className="muted">No change events observed after initial discovery.</p>}
        </div>
      </div>
    </section>

    <section className="grid two">
      <Leaderboard title="Trust Leaderboard" scores={data.pulse.topTrust} providers={providerLookup} kind="trust" />
      <Leaderboard title="Signal Leaderboard" scores={data.pulse.topSignal} providers={providerLookup} kind="signal" />
    </section>

    <section className="panel">
      <h2>Narrative Heatmap</h2>
      <div className="heatmap">
        {data.narratives.map((narrative) => <div key={narrative.id} className="heat" style={{ '--heat': `${narrative.heat ?? 0}%` } as React.CSSProperties}>
          <strong>{narrative.title}</strong><span>heat {narrative.heat ?? 'unknown'}</span><small>{narrative.providerIds.length} providers / {narrative.keywords.join(', ')}</small>
        </div>)}
      </div>
    </section>

    <section className="grid two">
      <div className="panel">
        <h2>Semantic Search</h2>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="search Pay.sh ecosystem intelligence" />
        <div className="results">{searchResults.map((result) => <div className="result" key={result.provider.id}><strong>{result.provider.name}</strong><span>relevance {result.relevance} / trust {result.trustAssessment.score ?? 'unknown'} / signal {result.signalAssessment.score ?? 'unknown'}</span></div>)}</div>
      </div>
      <div className="panel" id="route-recommender">
        <h2>Route Recommender</h2>
        <div className="route-panel">
          <label>
            <span>task text</span>
            <textarea value={routeTask} onChange={(event) => setRouteTask(event.target.value)} />
          </label>
          <div className="route-input-grid">
            <label>
              <span>category filter</span>
              <select value={routeCategory} onChange={(event) => setRouteCategory(event.target.value)}>
                <option value="all">all categories</option>
                {categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>max price</span>
              <input value={routeMaxPrice} onChange={(event) => setRouteMaxPrice(event.target.value)} placeholder="unknown allowed" />
            </label>
            <label>
              <span>min trust score</span>
              <input type="number" min={0} max={100} value={routeMinTrust} onChange={(event) => setRouteMinTrust(Number(event.target.value))} />
            </label>
            <label>
              <span>preference</span>
              <select value={routePreference} onChange={(event) => setRoutePreference(event.target.value as RoutePreference)}>
                <option value="balanced">balanced</option>
                <option value="cheapest">cheapest</option>
                <option value="highest_trust">highest trust</option>
              </select>
            </label>
          </div>
        </div>
        <button className="execute" onClick={runRoute}>compute route</button>
        {routeResult && <div className="route decision-output">
          <div className="decision-head">
            <div>
              <span>recommended provider</span>
              <strong>{routeResult.bestProvider?.name ?? 'No route'}</strong>
            </div>
            <small>{routeResult.preference ?? routePreference} decision profile</small>
          </div>
          {routeResult.bestProvider && <div className="intel-summary compact">
            <DossierStat label="trust" value={routeResult.trustAssessment?.score ?? null} sub={routeResult.trustAssessment?.grade ?? 'grade unknown'} />
            <DossierStat label="signal" value={routeResult.signalAssessment?.score ?? null} sub={routeResult.signalAssessment?.narratives[0] ?? 'narrative unknown'} />
            <DossierStat label="price" value={formatPrice(routeResult.estimatedCost ?? routeResult.bestProvider.pricing)} sub="estimated range" />
          </div>}
          <DossierSection title="Rationale">
            {routeResult.reasoning.map((line) => <p key={line}>{line}</p>)}
          </DossierSection>
          <DossierSection title="Fallback Providers">
            <div className="fallback-list">
              {(routeResult.fallbackDetails?.length ? routeResult.fallbackDetails : routeResult.fallbackProviders.map((provider) => ({ provider, trustAssessment: null, signalAssessment: null, rank: null, relevance: null, riskNotes: [] }))).map((candidate) => <div key={candidate.provider.id}>
                <strong>{candidate.provider.name}</strong>
                <span>trust {candidate.trustAssessment?.score ?? 'unknown'} / signal {candidate.signalAssessment?.score ?? 'unknown'} / {formatPrice(candidate.provider.pricing)}</span>
                <small>rank {candidate.rank ?? 'unknown'} / relevance {candidate.relevance ?? 'unknown'}</small>
              </div>)}
              {!routeResult.fallbackProviders.length && <p className="muted empty-state">No fallback providers met the current constraints.</p>}
            </div>
          </DossierSection>
          <DossierSection title="Risk Notes">
            <div className="risk-list">{routeResult.riskNotes.map((note) => <span key={note}>{note}</span>)}</div>
          </DossierSection>
          <DossierSection title="Unknown Telemetry Warning">
            <p>{routeResult.riskNotes.some((note) => /unknown|unavailable/i.test(note)) ? 'Decision contains unknown telemetry. The recommender preserves null evidence instead of estimating missing runtime behavior.' : 'No unknown telemetry warning was emitted for this route.'}</p>
          </DossierSection>
        </div>}
      </div>
    </section>
  </main>;
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="panel metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function PulseStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="pulse-stat"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function TimingItem({ label, value }: { label: string; value: string }) {
  return <div className="timing-item"><span>{label}</span><strong>{value}</strong></div>;
}

function DossierStat({ label, value, sub }: { label: string; value: string | number | null; sub: string }) {
  return <div className="dossier-stat"><span>{label}</span><strong>{value ?? 'unknown'}</strong><small>{sub}</small></div>;
}

function DossierSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="dossier-section"><h4>{title}</h4>{children}</section>;
}

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return <div className="key-values">{rows.map(([label, value]) => <p key={label}><b>{label}</b><span>{value}</span></p>)}</div>;
}

function Leaderboard({ title, scores, providers, kind }: { title: string; scores: any[]; providers: Map<string, Provider>; kind: string }) {
  return <div className="panel"><h2>{title}</h2><div className="leaderboard">{scores.map((score) => <div className="bar" key={score.entityId}><span>{providers.get(score.entityId)?.name}</span><div><i style={{ width: `${score.score ?? 0}%` }} /></div><b>{score.score ?? 'unknown'}{kind === 'trust' ? ` ${score.grade}` : ''}</b></div>)}</div></div>;
}

function AssessmentPanel({ title, score, sub, components }: { title: string; score: number | null; sub: string; components: Record<string, number | null> }) {
  return <div className="panel assessment">
    <h2>{title}</h2>
    <strong>{score ?? 'unknown'}</strong>
    <span>{sub}</span>
    <div className="component-list">{Object.entries(components).map(([key, value]) => <p key={key}><b>{key}</b><i>{value ?? 'unknown'}</i></p>)}</div>
  </div>;
}

const eventCategories: EventCategory[] = ['discovery', 'trust', 'monitoring', 'pricing', 'schema', 'signal'];

function DeltaPanel({ title, caption, deltas, empty }: { title: string; caption?: string; deltas: ScoreDelta[]; empty: string }) {
  return <div className="panel">
    <h2>{title}</h2>
    {caption && <p className="panel-caption">{caption}</p>}
    <div className="delta-list">
      {deltas.slice(0, 6).map((delta) => <div className={`delta-row ${delta.direction}`} key={delta.eventId}>
        <strong>{delta.providerName}</strong>
        <span>{formatScoreDelta(delta)}</span>
        <small>{formatDate(delta.observedAt)}</small>
      </div>)}
      {!deltas.length && <p className="muted">{empty}</p>}
    </div>
  </div>;
}

function formatPrice(price: Provider['pricing']) {
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

function formatNullableBoolean(value: boolean | null) {
  if (value === null) return 'unknown';
  return value ? 'yes' : 'no';
}

function componentValue(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}/100` : 'unknown';
}

function knownState(value: number | null | undefined) {
  return typeof value === 'number' ? `known ${value}/100` : 'unknown';
}

function formatScoreDelta(delta: ScoreDelta) {
  const score = delta.score ?? 'unknown';
  if (delta.delta === null) return `${score} / prior unavailable`;
  const prefix = delta.delta > 0 ? '+' : '';
  return `${score} (${prefix}${delta.delta})`;
}

function compactCategories(categories: Record<EventCategory, number>) {
  const active = Object.entries(categories).filter(([, count]) => count > 0).map(([category, count]) => `${category}:${count}`);
  return active.length ? active.join(' / ') : 'no categorized activity';
}

function groupTimelineByBatch(events: PulseEvent[]) {
  const groups = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const batch = groups.get(event.observedAt) ?? [];
    batch.push(event);
    groups.set(event.observedAt, batch);
  }
  return [...groups.entries()].map(([observedAt, batchEvents]) => ({ observedAt, events: batchEvents }));
}

function sourceLabel(source: DataSource) {
  return source.mode === 'live_pay_sh_catalog' && !source.used_fixture ? 'LIVE PAY.SH CATALOG' : 'FIXTURE FALLBACK';
}

function compareProviders(a: Provider, b: Provider, sort: string, trustLookup: Map<string, TrustAssessment>, signalLookup: Map<string, SignalAssessment>) {
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

createRoot(document.getElementById('root')!).render(<App />);
