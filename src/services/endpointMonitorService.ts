import { randomUUID } from 'node:crypto';
import { Endpoint, Evidence, InfopunksEvent, MonitorRun } from '../schemas/entities';
import { IntelligenceRepository } from '../persistence/repository';
import { IntelligenceStore, recomputeAssessments } from './intelligenceStore';

export type MonitorOptions = {
  timeoutMs?: number;
  mode?: 'metadata' | 'endpoint';
  allowPaidEndpoints?: boolean;
  degradedLatencyMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type EndpointMonitorSummary = {
  endpoint: Endpoint;
  lastCheck: InfopunksEvent | null;
  recentFailures: InfopunksEvent[];
  events: InfopunksEvent[];
  health: 'healthy' | 'degraded' | 'failed' | 'unknown';
};

const SOURCE = 'infopunks:endpoint-monitor';

export async function runEndpointMonitor(store: IntelligenceStore, repository: IntelligenceRepository, options: MonitorOptions = {}) {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const run: MonitorRun = {
    id: randomUUID(),
    startedAt,
    finishedAt: null,
    source: SOURCE,
    status: 'running',
    checkedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    error: null
  };
  const emittedEvents: InfopunksEvent[] = [];

  try {
    for (const endpoint of store.endpoints) {
      const target = monitorTarget(endpoint, options);
      if (!target) {
        run.skippedCount += 1;
        continue;
      }

      const result = await checkEndpoint(endpoint, target, options);
      run.checkedCount += 1;
      if (result.success) run.successCount += 1;
      else run.failedCount += 1;

      const events = monitorEventsForResult(endpoint, result, latestEndpointMonitorEvent(store, endpoint.id), options.degradedLatencyMs ?? 1000);
      emittedEvents.push(...events);
      applyEndpointEvidence(store, endpoint.id, events);
    }

    run.status = 'succeeded';
  } catch (error) {
    run.status = 'failed';
    run.errorCount += 1;
    run.error = error instanceof Error ? error.message : String(error);
  } finally {
    run.finishedAt = now().toISOString();
    store.events = [...store.events, ...emittedEvents];
    store.monitorRuns = [run, ...(store.monitorRuns ?? [])].slice(0, 100);
    const recomputed = recomputeAssessments(store);
    replaceStore(store, recomputed);
    await repository.saveSnapshot(store);
  }

  return { run, events: emittedEvents };
}

export function endpointMonitorSummary(store: IntelligenceStore, endpoint: Endpoint): EndpointMonitorSummary {
  const events = endpointMonitorEvents(store, endpoint.id);
  const lastCheck = events.find((event) => event.type === 'endpoint.checked') ?? null;
  const recentFailures = events.filter((event) => event.type === 'endpoint.failed').slice(0, 10);
  return {
    endpoint,
    lastCheck,
    recentFailures,
    events,
    health: healthFromEvent(events[0] ?? null)
  };
}

export function isMonitorEnabled() {
  return process.env.MONITOR_ENABLED === 'true';
}

export function monitorIntervalMs() {
  return Number(process.env.MONITOR_INTERVAL_MS ?? 300_000);
}

export function monitorTimeoutMs() {
  return Number(process.env.MONITOR_TIMEOUT_MS ?? 5000);
}

function monitorTarget(endpoint: Endpoint, options: MonitorOptions) {
  const schema = endpoint.schema && typeof endpoint.schema === 'object' ? endpoint.schema as Record<string, unknown> : {};
  const nestedMonitor = schema.monitor && typeof schema.monitor === 'object' ? schema.monitor as Record<string, unknown> : {};
  const metadataUrl = stringValue(schema.monitorUrl) ?? stringValue(schema.monitor_url) ?? stringValue(schema.healthUrl) ?? stringValue(schema.health_url) ?? stringValue(nestedMonitor.url) ?? stringValue(nestedMonitor.healthUrl) ?? stringValue(nestedMonitor.health_url);
  if (metadataUrl) return { url: metadataUrl, method: 'GET' };

  const mode = options.mode ?? (process.env.MONITOR_MODE === 'endpoint' ? 'endpoint' : 'metadata');
  const allowPaid = options.allowPaidEndpoints ?? process.env.MONITOR_ALLOW_PAID_ENDPOINTS === 'true';
  if (mode === 'endpoint' && allowPaid && endpoint.method === 'GET' && endpoint.path?.startsWith('http')) {
    return { url: endpoint.path, method: 'GET' };
  }

  return null;
}

async function checkEndpoint(endpoint: Endpoint, target: { url: string; method: string }, options: MonitorOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? monitorTimeoutMs());

  try {
    const response = await fetchImpl(target.url, { method: target.method, signal: controller.signal, headers: { accept: 'application/json,*/*;q=0.8' } });
    const responseTimeMs = Math.max(0, Math.round(performance.now() - started));
    const schemaValidity = await schemaValidityFor(endpoint, response);
    const success = response.ok && schemaValidity !== false;
    return {
      status_code: response.status,
      response_time_ms: responseTimeMs,
      checked_at: checkedAt,
      error_message: null,
      success,
      schema_validity: schemaValidity,
      target_url: target.url
    };
  } catch (error) {
    return {
      status_code: null,
      response_time_ms: Math.max(0, Math.round(performance.now() - started)),
      checked_at: checkedAt,
      error_message: error instanceof Error ? error.message : String(error),
      success: false,
      schema_validity: null,
      target_url: target.url
    };
  } finally {
    clearTimeout(timer);
  }
}

async function schemaValidityFor(endpoint: Endpoint, response: Response) {
  const schema = endpoint.schema && typeof endpoint.schema === 'object' ? endpoint.schema as Record<string, unknown> : {};
  const responseSchema = schema.response ?? (schema.monitor && typeof schema.monitor === 'object' ? (schema.monitor as Record<string, unknown>).response : undefined);
  if (!responseSchema) return null;

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) return false;
    return validateJsonSchema(await response.clone().json(), responseSchema);
  } catch {
    return false;
  }
}

function validateJsonSchema(value: unknown, schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return true;
  const spec = schema as Record<string, unknown>;
  if (spec.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    const required = Array.isArray(spec.required) ? spec.required.filter((item): item is string => typeof item === 'string') : [];
    if (required.some((key) => !(key in record))) return false;
    const properties = spec.properties && typeof spec.properties === 'object' ? spec.properties as Record<string, unknown> : {};
    return Object.entries(properties).every(([key, childSchema]) => !(key in record) || validateJsonSchema(record[key], childSchema));
  }
  if (spec.type === 'array') return Array.isArray(value);
  if (spec.type === 'string') return typeof value === 'string';
  if (spec.type === 'number') return typeof value === 'number';
  if (spec.type === 'integer') return Number.isInteger(value);
  if (spec.type === 'boolean') return typeof value === 'boolean';
  return true;
}

function monitorEventsForResult(endpoint: Endpoint, result: Record<string, unknown>, previous: InfopunksEvent | null, degradedLatencyMs: number): InfopunksEvent[] {
  const observedAt = result.checked_at as string;
  const payload = { providerId: endpoint.providerId, endpointId: endpoint.id, ...result };
  const events = [monitorEvent('endpoint.checked', endpoint.id, payload, observedAt)];
  const degraded = result.success === true && ((typeof result.response_time_ms === 'number' && result.response_time_ms > degradedLatencyMs) || result.schema_validity === false);

  if (result.success !== true) events.push(monitorEvent('endpoint.failed', endpoint.id, payload, observedAt));
  else if (degraded) events.push(monitorEvent('endpoint.degraded', endpoint.id, payload, observedAt));
  else if (previous && (previous.payload.success !== true || previous.type === 'endpoint.degraded')) events.push(monitorEvent('endpoint.recovered', endpoint.id, payload, observedAt));

  return events;
}

function monitorEvent(type: InfopunksEvent['type'], endpointId: string, payload: Record<string, unknown>, observedAt: string): InfopunksEvent {
  return { id: randomUUID(), type, source: SOURCE, entityType: 'endpoint', entityId: endpointId, observedAt, payload };
}

function latestEndpointMonitorEvent(store: IntelligenceStore, endpointId: string) {
  return endpointMonitorEvents(store, endpointId)[0] ?? null;
}

function endpointMonitorEvents(store: IntelligenceStore, endpointId: string) {
  return store.events
    .filter((event) => event.entityType === 'endpoint' && event.entityId === endpointId && isMonitorEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}

function healthFromEvent(event: InfopunksEvent | null): EndpointMonitorSummary['health'] {
  if (!event) return 'unknown';
  if (event.payload.success !== true) return 'failed';
  if (event.type === 'endpoint.degraded' || event.payload.schema_validity === false) return 'degraded';
  return 'healthy';
}

function applyEndpointEvidence(store: IntelligenceStore, endpointId: string, events: InfopunksEvent[]) {
  const endpoint = store.endpoints.find((item) => item.id === endpointId);
  if (!endpoint) return;
  const evidence = events.map((event): Evidence => ({
    eventId: event.id,
    eventType: event.type,
    source: event.source,
    observedAt: event.observedAt,
    summary: `Monitor recorded ${event.payload.success === true ? 'successful' : 'failed'} check with latency ${event.payload.response_time_ms ?? 'unknown'}ms.`,
    value: event.payload
  }));
  endpoint.evidence = mergeEvidence(endpoint.evidence, evidence);
  const latencies = [...store.events, ...events]
    .filter((event) => event.entityType === 'endpoint' && event.entityId === endpointId && isMonitorEvent(event.type) && event.payload.success === true && typeof event.payload.response_time_ms === 'number')
    .map((event) => event.payload.response_time_ms as number)
    .sort((a, b) => a - b);
  endpoint.latencyMsP50 = latencies.length ? Math.round(latencies[Math.floor((latencies.length - 1) / 2)]) : endpoint.latencyMsP50;
  endpoint.status = events.some((event) => event.type === 'endpoint.failed' || event.type === 'endpoint.degraded') ? 'degraded' : 'available';
}

function mergeEvidence(existing: Evidence[], next: Evidence[]) {
  const evidence = new Map(existing.map((item) => [item.eventId, item]));
  for (const item of next) evidence.set(item.eventId, item);
  return [...evidence.values()];
}

function replaceStore(target: IntelligenceStore, source: IntelligenceStore) {
  target.events = source.events;
  target.providers = source.providers;
  target.endpoints = source.endpoints;
  target.trustAssessments = source.trustAssessments;
  target.signalAssessments = source.signalAssessments;
  target.narratives = source.narratives;
  target.ingestionRuns = source.ingestionRuns;
  target.monitorRuns = source.monitorRuns;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.startsWith('http') ? value : null;
}

function isMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'endpoint.checked' || type === 'endpoint.recovered' || type === 'endpoint.degraded' || type === 'endpoint.failed';
}
