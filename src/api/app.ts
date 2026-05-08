import cors from '@fastify/cors';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createIntelligenceStore, defaultRepository, IntelligenceStore, runPayShIngestion } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
import { recommendRoute } from '../services/routeService';
import { semanticSearch } from '../services/searchService';
import { RouteRecommendationRequestSchema, SearchRequestSchema } from '../schemas/entities';
import { endpointHistory, findEndpoint, findProvider, providerHistory, providerIntelligence } from '../services/providerIntelligenceService';
import { endpointMonitorSummary, isMonitorEnabled, monitorIntervalMs, monitorMaxProviders, monitorTimeoutMs, providerMonitorSummary, runMonitor } from '../services/endpointMonitorService';
import { loadRuntimeConfig } from '../config/env';
import { dataSourceState, pulseSummary } from '../services/pulseService';
import { featuredProviderRotation } from '../services/featuredProviderService';
import { classifyEventSeverity, classifyGraphSeverity, classifyNarrativeClusterSeverity, classifyProviderDossierSeverity } from '../engines/severityEngine';
import { analyzePropagation } from '../services/propagationService';
import { resolvePropagationIncident } from '../services/propagationIncidentService';
import { providerReachabilitySummary, providerRootHealthSummary } from '../services/eventSummaryHelpers';

const IngestRequestSchema = z.object({ catalogUrl: z.string().url().optional() }).optional();

export async function createApp(preloadedStore?: IntelligenceStore, repository: IntelligenceRepository = defaultRepository()) {
  const config = loadRuntimeConfig();
  const app = Fastify({ logger: false });
  await app.register(cors, {
    origin: config.frontendOrigin
      ? (origin, callback) => callback(null, !origin || origin === config.frontendOrigin)
      : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    preflight: true
  });
  const store = preloadedStore ?? await createIntelligenceStore(repository);

  app.get('/health', async () => ({ ok: true, service: 'infopunks-pay-sh-radar', role: 'Cognitive Coordination Layer above Pay.sh', persistence: config.databaseUrl ? 'postgres' : 'memory' }));
  app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
  app.get('/v1/pulse', async () => ({ data: pulse(store) }));
  app.get('/v1/pulse/summary', async () => ({ data: pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs) }));
  app.get('/v1/propagation', async () => ({ data: analyzePropagation(store) }));
  app.get<{ Params: { cluster_id: string } }>('/v1/propagation/:cluster_id', async (req, reply) => {
    const incident = resolvePropagationIncident(store, req.params.cluster_id);
    if (!incident) return reply.code(404).send({ error: 'propagation_cluster_not_found' });
    return { data: incident };
  });
  app.get<{ Params: { id: string } }>('/v1/events/:id', async (req, reply) => {
    const event = store.events.find((item) => item.id === req.params.id);
    if (!event) return reply.code(404).send({ error: 'event_not_found' });
    return {
      data: {
        ...event,
        summary: summarizeEvent(event),
        ...classifyEventSeverity(event, store.events)
      }
    };
  });
  app.get('/v1/events/recent', async () => ({ data: [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 100).map((event) => ({ ...event, ...classifyEventSeverity(event, store.events) })) }));
  app.get('/v1/providers', async () => ({ data: store.providers.map((provider) => {
    const trust = latestByAssessedAt(store.trustAssessments.filter((item) => item.entityId === provider.id));
    const signal = latestByAssessedAt(store.signalAssessments.filter((item) => item.entityId === provider.id));
    return {
      ...provider,
      ...classifyProviderDossierSeverity(provider, trust ?? null, signal ?? null, store.events),
      latestTrustScore: trust?.score ?? null,
      latestTrustGrade: trust?.grade ?? 'unknown',
      latestSignalScore: signal?.score ?? null
    };
  }) }));
  app.get('/v1/providers/featured', async () => ({ data: featuredProviderRotation(store, config.featuredProviderRotationMs) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: { provider, endpoints: store.endpoints.filter((item) => item.providerId === provider.id), trustAssessment: store.trustAssessments.find((item) => item.entityId === provider.id), signalAssessment: store.signalAssessments.find((item) => item.entityId === provider.id) } };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/history', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerHistory(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/intelligence', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerIntelligence(store, provider) };
  });
  app.get('/v1/endpoints', async () => ({ data: store.endpoints }));
  app.get('/v1/monitor/runs/recent', async () => ({ data: [...(store.monitorRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 20).map(monitorRunResponse) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id/monitor', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerMonitorSummary(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/monitor', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointMonitorSummary(store, endpoint) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/history', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointHistory(store, endpoint) };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/trust/:entity_id', async (req, reply) => {
    const trust = store.trustAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!trust) return reply.code(404).send({ error: 'trust_assessment_not_found' });
    return { data: trust };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/signal/:entity_id', async (req, reply) => {
    const signal = store.signalAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!signal) return reply.code(404).send({ error: 'signal_assessment_not_found' });
    return { data: signal };
  });
  app.get('/v1/narratives', async () => ({ data: store.narratives }));
  app.post('/v1/search', async (req, reply) => handleParsed(req.body, SearchRequestSchema, (input) => ({ data: semanticSearch(input, store) }), reply));
  app.post('/v1/recommend-route', async (req, reply) => handleParsed(req.body, RouteRecommendationRequestSchema, (input) => ({ data: recommendRoute(input, store) }), reply));
  app.post('/v1/ingest/pay-sh', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    return handleParsed(req.body, IngestRequestSchema, async (input) => {
      const result = await runPayShIngestion(store, repository, input?.catalogUrl);
      return { data: { run: result.run, emittedEvents: result.events.length, usedFixture: result.usedFixture } };
    }, reply);
  });
  app.post('/v1/monitor/run', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const result = await runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() });
    return { data: { run: result.run, emittedEvents: result.events.length } };
  });
  app.get('/v1/graph', async () => ({ data: { nodes: graphNodes(store), edges: graphEdges(store), evidence: graphReceipt(store) } }));
  app.get<{ Params: { id: string } }>('/interpretations/:id', async (req, reply) => {
    const summary = pulseSummary(store);
    const interpretation = summary.interpretations.find((item) => item.interpretation_id === req.params.id);
    if (!interpretation) return reply.code(404).type('text/html; charset=utf-8').send(renderInterpretationNotFoundPage(req, req.params.id, summary.generatedAt));
    return reply.type('text/html; charset=utf-8').send(renderInterpretationPage(req, interpretation, summary));
  });
  app.get<{ Params: { event_id: string } }>('/v1/receipts/:event_id', async (req, reply) => {
    const summary = pulseSummary(store);
    const event = summary.timeline.find((item) => item.id === req.params.event_id || item.event_id === req.params.event_id);
    if (!event) return reply.code(404).send({ error: 'receipt_not_found' });

    const providerId = event.provider_id ?? event.providerId ?? null;
    const provider = providerId ? findProvider(store, providerId) : null;
    const propagation = analyzePropagation(store);
    const interpretations = summary.interpretations
      .filter((item) => item.supporting_event_ids.includes(event.id) || item.supporting_event_ids.includes(event.event_id ?? ''));

    return {
      data: {
        event_id: event.id,
        event_type: event.type,
        provider_id: providerId,
        endpoint_id: event.endpoint_id ?? event.endpointId ?? null,
        severity: event.severity ?? 'unknown',
        severity_reason: event.severity_reason ?? 'No deterministic severity reason available.',
        observed_at: event.observed_at ?? event.observedAt ?? null,
        catalog_generated_at: event.catalog_generated_at ?? null,
        ingested_at: event.ingested_at ?? null,
        source: event.source ?? 'unknown',
        derivation_reason: event.derivation_reason ?? 'Deterministic evidence event.',
        confidence: event.confidence ?? null,
        summary: {
          entity_type: event.entityType,
          entity_id: event.entityId,
          payload: event.payload
        },
        raw_summary: JSON.stringify(event.payload),
        links: {
          provider: provider ? { provider_id: provider.id, provider_name: provider.name, url: `/?provider_id=${encodeURIComponent(provider.id)}` } : null,
          provider_dossier: providerId ? `/?provider_id=${encodeURIComponent(providerId)}` : null,
          interpretations: interpretations.map((item) => ({ interpretation_id: item.interpretation_id, title: item.interpretation_title, url: `/#${item.interpretation_id}` })),
          propagation_cluster: propagation.supporting_event_ids.includes(event.id) || propagation.supporting_event_ids.includes(event.event_id ?? '')
            ? { cluster: propagation.affected_cluster, state: propagation.propagation_state, severity: propagation.severity, url: '/#propagation-watch' }
            : null
        }
      }
    };
  });

  const intervalMs = config.payShIngestIntervalMs ?? 0;
  if (intervalMs > 0) {
    const timer = setInterval(() => {
      void runPayShIngestion(store, repository).catch(() => undefined);
    }, intervalMs);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
  if (isMonitorEnabled() && monitorIntervalMs() > 0) {
    const timer = setInterval(() => {
      void runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() }).catch(() => undefined);
    }, monitorIntervalMs());
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }

  return app;
}

function isAdmin(adminToken: string | null, authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return Boolean(adminToken && match?.[1] === adminToken);
}

function monitorRunResponse(run: NonNullable<IntelligenceStore['monitorRuns']>[number]) {
  const mode = run.mode ?? (run.source.includes('safe-metadata') ? 'safe_metadata' : 'endpoint_health');
  const degradedCount = run.degradedCount ?? 0;
  const reachableCount = run.reachableCount ?? Math.max(0, run.successCount - degradedCount);
  return {
    ...run,
    mode,
    checked_count: run.checkedCount,
    reachable_count: reachableCount,
    degraded_count: degradedCount,
    failed_count: run.failedCount,
    skipped_count: run.skippedCount,
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

function pulse(store: IntelligenceStore) {
  const knownTrust = store.trustAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const knownSignal = store.signalAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const summary = pulseSummary(store);
  return {
    providerCount: store.providers.length,
    endpointCount: store.providers.reduce((sum, provider) => sum + provider.endpointCount, 0),
    eventCount: store.events.length,
    averageTrust: avg(knownTrust),
    averageSignal: avg(knownSignal),
    hottestNarrative: store.narratives[0] ?? null,
    topTrust: [...store.trustAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    topSignal: [...store.signalAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    unknownTelemetry: {
      uptime: store.trustAssessments.filter((item) => item.components.uptime === null).length,
      latency: store.trustAssessments.filter((item) => item.components.latency === null).length,
      responseValidity: store.trustAssessments.filter((item) => item.components.responseValidity === null).length,
      receiptReliability: store.trustAssessments.filter((item) => item.components.receiptReliability === null).length,
      socialVelocity: store.signalAssessments.filter((item) => item.components.socialVelocity === null).length,
      onchainLiquidityResonance: store.signalAssessments.filter((item) => item.components.onchainLiquidityResonance === null).length
    },
    interpretations: summary.interpretations,
    data_source: dataSourceState(store),
    updatedAt: summary.generatedAt
  };
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function latestByAssessedAt<T extends { assessedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))[0] ?? null;
}

function handleParsed<T>(body: unknown, schema: z.ZodSchema<T>, next: (input: T) => unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
  return next(parsed.data);
}

function graphNodes(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ id: provider.id, type: 'provider', label: provider.name, category: provider.category, provider_id: provider.id, observed_at: provider.lastSeenAt, catalog_generated_at: provider.catalogGeneratedAt ?? null, ingested_at: provider.ingestedAt ?? provider.lastSeenAt, source: provider.source, derivation_reason: 'Graph provider node is derived from provider catalog membership.', confidence: provider.confidence ?? 1, ...classifyProviderDossierSeverity(provider, store.trustAssessments.find((item) => item.entityId === provider.id) ?? null, store.signalAssessments.find((item) => item.entityId === provider.id) ?? null, store.events), evidence: provider.evidence[0] ?? null })),
    ...store.narratives.map((narrative) => ({ id: narrative.id, type: 'narrative', label: narrative.title, heat: narrative.heat, provider_id: null, endpoint_id: null, observed_at: narrative.evidence[0]?.observedAt ?? null, catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null, ingested_at: narrative.evidence[0]?.ingestedAt ?? null, source: narrative.evidence[0]?.source ?? 'infopunks:deterministic-scoring', derivation_reason: 'Graph narrative node is derived from deterministic narrative clustering.', confidence: narrative.evidence.length ? 1 : 0.5, ...classifyNarrativeClusterSeverity(narrative), evidence: narrative.evidence[0] ?? null })),
    ...Array.from(new Set(store.providers.map((provider) => provider.category))).map((category) => ({ id: `category-${category}`, type: 'category', label: category, provider_id: null, endpoint_id: null, observed_at: latestProviderTimestamp(store, category), catalog_generated_at: latestCatalogGeneratedAt(store, category), ingested_at: latestProviderTimestamp(store, category), source: 'pay.sh', derivation_reason: 'Graph category node is derived from provider catalog categories.', confidence: 1, ...classifyGraphSeverity('category') }))
  ];
}

function graphEdges(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ source: provider.id, target: `category-${provider.category}`, type: 'listed_in', provider_id: provider.id, endpoint_id: null, observed_at: provider.lastSeenAt, catalog_generated_at: provider.catalogGeneratedAt ?? null, ingested_at: provider.ingestedAt ?? provider.lastSeenAt, derivation_reason: 'Graph edge is derived from provider category metadata.', confidence: provider.confidence ?? 1, ...classifyGraphSeverity('edge'), evidenceCount: provider.evidence.length, evidence: provider.evidence[0] ?? null })),
    ...store.narratives.flatMap((narrative) => narrative.providerIds.map((providerId) => ({ source: narrative.id, target: providerId, type: 'contains', provider_id: providerId, endpoint_id: null, observed_at: narrative.evidence[0]?.observedAt ?? null, catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null, ingested_at: narrative.evidence[0]?.ingestedAt ?? null, derivation_reason: 'Graph edge is derived from narrative keyword membership.', confidence: narrative.evidence.length ? 1 : 0.5, ...classifyNarrativeClusterSeverity(narrative), evidenceCount: narrative.evidence.length, evidence: narrative.evidence[0] ?? null })))
  ];
}

function graphReceipt(store: IntelligenceStore) {
  const latestEvent = [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;
  return {
    event_id: latestEvent?.id ?? null,
    provider_id: null,
    endpoint_id: null,
    observed_at: latestEvent?.observedAt ?? null,
    catalog_generated_at: store.dataSource?.generated_at ?? null,
    ingested_at: store.dataSource?.last_ingested_at ?? null,
    source: store.dataSource?.mode ?? 'fixture_fallback',
    derivation_reason: 'Graph layer is built deterministically from provider, category, and narrative records.',
    confidence: store.events.length ? 1 : 0.5,
    ...classifyGraphSeverity('graph')
  };
}

function latestProviderTimestamp(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.lastSeenAt).sort().reverse()[0] ?? null;
}

function latestCatalogGeneratedAt(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.catalogGeneratedAt).filter((value): value is string => Boolean(value)).sort().reverse()[0] ?? null;
}

function summarizeEvent(event: IntelligenceStore['events'][number]) {
  if (event.type === 'provider.checked') return providerReachabilitySummary(event);
  if (event.type === 'provider.reachable') return providerRootHealthSummary(event, 'healthy');
  if (event.type === 'provider.degraded') return providerRootHealthSummary(event, 'degraded');
  if (event.type === 'provider.failed') return providerRootHealthSummary(event, 'failed');
  if (event.type === 'provider.recovered') return providerRootHealthSummary(event, 'recovered');
  return typeof event.payload.summary === 'string' ? event.payload.summary : `${event.type} observed.`;
}

function renderInterpretationPage(req: FastifyRequest, interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], summary: ReturnType<typeof pulseSummary>) {
  const title = `${interpretation.interpretation_title} | Infopunks Pay.sh Radar`;
  const description = interpretation.interpretation_summary;
  const url = absoluteUrl(req, `/interpretations/${interpretation.interpretation_id}`);
  const dataSourceLabel = summary.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback';
  const propagationRelevant = isPropagationRelevant(interpretation, summary.propagation);
  const whyThisMatters = whyThisMattersSummary(interpretation);
  const receiptLinks = interpretation.supporting_event_ids.map((eventId) => ({ eventId, href: `/v1/events/${eventId}` }));
  const receiptSource = interpretation.evidence?.source ?? 'infopunks:interpretation-layer';
  const methodologyHref = '/#methodology';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #101418; }
    main { max-width: 860px; margin: 2.5rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #dde3ea; border-radius: 14px; padding: 1rem 1.2rem; margin-top: 1rem; }
    .meta { color: #3e4c59; font-size: 0.95rem; }
    .pill { display: inline-block; margin-right: 0.5rem; border-radius: 999px; padding: 0.15rem 0.55rem; border: 1px solid #c6d2df; font-size: 0.8rem; background: #f0f5fa; }
    ul { margin: 0.45rem 0 0 1.2rem; }
    h1, h2 { margin: 0; }
    h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    button { border: 1px solid #c6d2df; background: #fff; border-radius: 8px; padding: 0.45rem 0.7rem; cursor: pointer; }
    a { color: #0043aa; }
  </style>
</head>
<body>
  <main>
    <p class="meta">Public Interpretation Artifact</p>
    <h1>${escapeHtml(interpretation.interpretation_title)}</h1>
    <p>${escapeHtml(interpretation.interpretation_summary)}</p>
    <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.8rem;">
      <span class="pill">severity: ${escapeHtml(interpretation.severity)}</span>
      <span class="pill">confidence: ${escapeHtml(String(interpretation.confidence))}</span>
      <span class="pill">window: ${escapeHtml(interpretation.observed_window.started_at ?? 'n/a')} to ${escapeHtml(interpretation.observed_window.ended_at ?? 'n/a')}</span>
    </div>
    <button id="copy-share-url" type="button">Copy/Share URL</button>
    <span id="copy-state" class="meta" style="margin-left:0.5rem;"></span>

    <section class="card">
      <h2>Why this matters</h2>
      <p>${escapeHtml(whyThisMatters)}</p>
    </section>

    <section class="card">
      <h2>Evidence and Context</h2>
      <p><strong>Reason:</strong> ${escapeHtml(interpretation.interpretation_reason)}</p>
      <p><strong>Affected categories:</strong> ${interpretation.affected_categories.length ? interpretation.affected_categories.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Affected providers:</strong> ${interpretation.affected_providers.length ? interpretation.affected_providers.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Supporting event IDs:</strong> ${interpretation.supporting_event_ids.length ? interpretation.supporting_event_ids.map(escapeHtml).join(', ') : 'none'}</p>
      <p><strong>Supporting receipt links:</strong></p>
      <ul>
        ${receiptLinks.length
    ? receiptLinks.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.eventId)}</a></li>`).join('')
    : '<li>none</li>'}
      </ul>
      <p><strong>Evidence source:</strong> ${escapeHtml(receiptSource)}</p>
      ${propagationRelevant
    ? `<p><strong>Propagation context:</strong> ${escapeHtml(summary.propagation.propagation_state)} (${escapeHtml(summary.propagation.severity)}). ${escapeHtml(summary.propagation.propagation_reason)}</p>`
    : ''}
      <p><a href="${escapeHtml(methodologyHref)}">Methodology</a></p>
      <p class="meta"><strong>Data source:</strong> ${escapeHtml(dataSourceLabel)} | <strong>Last updated:</strong> ${escapeHtml(summary.generatedAt)}</p>
    </section>
  </main>
  <script>
    (function () {
      var button = document.getElementById('copy-share-url');
      var state = document.getElementById('copy-state');
      if (!button) return;
      button.addEventListener('click', function () {
        var shareUrl = window.location.href;
        var done = function (ok) { if (state) state.textContent = ok ? 'Copied.' : 'Copy failed.'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () { done(true); }).catch(function () { done(false); });
        } else {
          done(false);
        }
      });
    })();
  </script>
</body>
</html>`;
}

function renderInterpretationNotFoundPage(req: FastifyRequest, interpretationId: string, generatedAt: string) {
  const title = 'Interpretation Not Found | Infopunks Pay.sh Radar';
  const description = `No interpretation exists for id ${interpretationId}.`;
  const url = absoluteUrl(req, `/interpretations/${interpretationId}`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;">
  <h1>Interpretation Not Found</h1>
  <p>No deterministic interpretation exists for <code>${escapeHtml(interpretationId)}</code>.</p>
  <p>Last checked: ${escapeHtml(generatedAt)}</p>
</body>
</html>`;
}

function whyThisMattersSummary(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number]) {
  if (interpretation.severity === 'critical' || interpretation.severity === 'warning') return 'Operational risk is elevated across observed providers, so route selection and trust assumptions may need immediate review.';
  if (interpretation.severity === 'watch') return 'This pattern indicates meaningful movement that could expand, so teams should monitor for spread or recurrence before treating conditions as normal.';
  if (interpretation.severity === 'info') return 'The pattern is informative for prioritization and category focus, but it does not currently indicate broad reliability degradation.';
  return 'Current evidence indicates no broad ecosystem degradation pattern above deterministic thresholds.';
}

function isPropagationRelevant(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], propagation: ReturnType<typeof pulseSummary>['propagation']) {
  if (propagation.propagation_state === 'unknown') return false;
  if (interpretation.supporting_event_ids.some((id) => propagation.supporting_event_ids.includes(id))) return true;
  const affected = new Set(interpretation.affected_providers);
  return propagation.affected_providers.some((provider) => affected.has(provider.provider_id));
}

function absoluteUrl(req: FastifyRequest, pathname: string) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  const protocol = req.headers['x-forwarded-proto'] ?? 'http';
  return `${protocol}://${host}${pathname}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
