import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Provider = { id: string; name: string; namespace: string; fqn?: string; category: string; description: string | null; endpointCount: number; endpointMetadataPartial?: boolean; pricing: { min: number | null; max: number | null; clarity: string; raw: string }; tags: string[]; status: string };
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json() as Promise<T>;
}

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState('stableenrich');
  const [searchQuery, setSearchQuery] = useState('multimodal generation');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [routeTask, setRouteTask] = useState('Find a low-cost image generation route for an autonomous design agent');
  const [routeResult, setRouteResult] = useState<any>(null);
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
    api<{ data: any }>('/v1/recommend-route', { method: 'POST', body: JSON.stringify({ task: routeTask, trustThreshold: 70, latencySensitivity: 'medium', maxPrice: 0.1 }) }).then((res) => setRouteResult(res.data));
  }

  function recommendProvider(provider: Provider) {
    setRouteTask(`Recommend a Pay.sh route for a task that could use ${provider.name} in ${provider.category}`);
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
              <h2>Realtime Ecosystem Pulse</h2>
            </div>
            <small>polling / last refresh {formatDate(pulseSummary.generatedAt)}</small>
          </div>
          <div className="event-groups">
            {eventCategories.map((category) => <span key={category} className={`category ${category}`}>{category} {pulseSummary.eventGroups[category].count}</span>)}
          </div>
          <div className="event-feed">
            {pulseSummary.timeline.map((event) => <div className={`feed-row ${event.category}`} key={event.id}>
              <time>{formatTime(event.observedAt)}</time>
              <span>{event.category}</span>
              <strong>{event.providerName ?? event.entityId}</strong>
              <p>{event.summary}</p>
            </div>)}
            {!pulseSummary.timeline.length && <p className="muted empty-state">No pulse events observed in the current window.</p>}
          </div>
        </div>

        <div className="provider-stack">
          <div className="panel">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Catalog Index</p>
                <h2>Provider Directory</h2>
              </div>
              <small>{data.providers.length} providers</small>
            </div>
            <div className="directory">
              {data.providers.map((provider) => <button key={provider.id} className={provider.id === selectedProvider?.id ? 'active row' : 'row'} onClick={() => setSelectedId(provider.id)}>
                <span>{provider.name}</span><small>{provider.category} / {provider.endpointCount} endpoints</small>
              </button>)}
            </div>
          </div>
          <div className="panel intelligence">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Selected Provider</p>
                <h2>Provider Overview</h2>
              </div>
            </div>
            {selectedProvider && <>
              <p className="eyebrow">{selectedProvider.namespace}</p>
              <h3>{selectedProvider.name}</h3>
              <p>{selectedProvider.description}</p>
              <div className="chips">{selectedProvider.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="terminal-lines">
                <p>category: {selectedProvider.category}</p>
                <p>price: {formatPrice(selectedProvider.pricing)}</p>
                <p>status: {selectedProvider.status}</p>
                <p>last seen: {formatDate(providerIntel?.last_seen_at)}</p>
                <p>monitor checked: {formatDate(providerIntel?.endpoint_health.last_checked_at)}</p>
                <p>monitor latency: {formatMs(providerIntel?.endpoint_health.median_latency_ms ?? null)}</p>
              </div>
              <button className="execute compact" onClick={() => recommendProvider(selectedProvider)}>recommend route</button>
            </>}
          </div>
        </div>
      </div>

      <aside className="pulse-side" aria-label="Realtime intelligence sidebar">
        <div className="panel counter-grid">
          <PulseStat label="Events" value={pulseSummary.counters.events} sub={`${pulseSummary.counters.unknownTelemetry} unknown telemetry fields`} />
          <PulseStat label="Providers" value={pulseSummary.counters.providers} sub={`${pulseSummary.counters.endpoints} endpoints tracked`} />
        </div>
        <DeltaPanel title="Trust Changes" deltas={pulseSummary.trustDeltas} empty="No trust deltas beyond initial scoring." />
        <DeltaPanel title="Signal Spikes" deltas={pulseSummary.signalSpikes} empty="No positive signal deltas observed." />
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Windowed Telemetry</p>
              <h2>Provider Activity</h2>
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
        <textarea value={routeTask} onChange={(event) => setRouteTask(event.target.value)} />
        <button className="execute" onClick={runRoute}>compute route</button>
        {routeResult && <div className="route"><strong>{routeResult.bestProvider?.name ?? 'No route'}</strong><p>{routeResult.reasoning.join(' ')}</p><small>{routeResult.riskNotes.join(' ')}</small></div>}
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

function DeltaPanel({ title, deltas, empty }: { title: string; deltas: ScoreDelta[]; empty: string }) {
  return <div className="panel">
    <h2>{title}</h2>
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

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'unknown';
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMs(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}ms` : 'unknown';
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) return 'unknown';
  return value ? 'yes' : 'no';
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

function formatDataSource(source: DataSource, providers: number, endpoints: number) {
  const sourceUrl = source.url?.replace(/^https?:\/\//, '') ?? 'pay.sh/api/catalog';
  return `Source: ${sourceUrl} · providers ${source.provider_count ?? providers} · endpoints ${endpoints} · last ingested ${formatDate(source.last_ingested_at ?? source.generated_at)}`;
}

createRoot(document.getElementById('root')!).render(<App />);
