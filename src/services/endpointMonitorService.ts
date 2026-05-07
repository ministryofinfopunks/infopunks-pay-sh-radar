import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Endpoint, Evidence, InfopunksEvent, MonitorRun, Provider } from '../schemas/entities';
import { IntelligenceRepository } from '../persistence/repository';
import { IntelligenceStore, recomputeAssessments } from './intelligenceStore';

export type MonitorMode = 'disabled' | 'safe_metadata' | 'endpoint_health' | 'paid_execution_probe';

export type MonitorOptions = {
  timeoutMs?: number;
  mode?: 'metadata' | 'endpoint' | MonitorMode;
  allowPaidEndpoints?: boolean;
  degradedLatencyMs?: number;
  maxProviders?: number;
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

export type ProviderMonitorSummary = {
  provider: Provider;
  serviceUrl: string | null;
  lastCheck: InfopunksEvent | null;
  recentFailures: InfopunksEvent[];
  events: InfopunksEvent[];
  health: 'reachable' | 'degraded' | 'failed' | 'unknown';
  mode: MonitorMode;
  safeMode: true;
};

const SOURCE = 'infopunks:endpoint-monitor';
const SAFE_SOURCE = 'infopunks:safe-metadata-monitor';
const USER_AGENT = 'InfopunksPayShRadar/0.1';
const SAFE_CHECK_TYPE = 'service_url_reachability';

export async function runMonitor(store: IntelligenceStore, repository: IntelligenceRepository, options: MonitorOptions = {}) {
  const mode = currentMonitorMode(options.mode);
  if (mode === 'safe_metadata') return runSafeMetadataMonitor(store, repository, options);
  if (mode === 'endpoint_health' || options.mode === 'endpoint' || options.mode === 'metadata') return runEndpointMonitor(store, repository, options);
  return runDisabledMonitor(store, repository, options);
}

export async function runSafeMetadataMonitor(store: IntelligenceStore, repository: IntelligenceRepository, options: MonitorOptions = {}) {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const run: MonitorRun = {
    id: randomUUID(),
    startedAt,
    finishedAt: null,
    source: SAFE_SOURCE,
    status: 'running',
    checkedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    error: null,
    mode: 'safe_metadata',
    reachableCount: 0,
    degradedCount: 0,
    skippedReasons: []
  };
  const emittedEvents: InfopunksEvent[] = [];

  try {
    const providers = store.providers.slice(0, options.maxProviders ?? monitorMaxProviders());
    run.skippedCount += Math.max(0, store.providers.length - providers.length);
    for (const provider of providers) {
      const target = await safeProviderTarget(provider, Boolean(options.fetchImpl));
      if (!target.ok) {
        run.skippedCount += 1;
        run.skippedReasons?.push({ providerId: provider.id, serviceUrl: provider.serviceUrl ?? null, reason: target.reason });
        continue;
      }

      const result = await checkProviderServiceUrl(provider, target.url, options);
      run.checkedCount += 1;
      if (result.status === 'reachable') {
        run.successCount += 1;
        run.reachableCount = (run.reachableCount ?? 0) + 1;
      } else if (result.status === 'degraded') {
        run.successCount += 1;
        run.degradedCount = (run.degradedCount ?? 0) + 1;
      } else {
        run.failedCount += 1;
      }

      const events = providerMonitorEventsForResult(provider, result, latestProviderMonitorEvent(store, provider.id), options.degradedLatencyMs ?? 1000);
      emittedEvents.push(...events);
      applyProviderEvidence(store, provider.id, events);
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

async function runDisabledMonitor(store: IntelligenceStore, repository: IntelligenceRepository, options: MonitorOptions = {}) {
  const now = options.now ?? (() => new Date());
  const run: MonitorRun = {
    id: randomUUID(),
    startedAt: now().toISOString(),
    finishedAt: now().toISOString(),
    source: SAFE_SOURCE,
    status: 'succeeded',
    checkedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: store.providers.length,
    errorCount: 0,
    error: null,
    mode: 'disabled',
    reachableCount: 0,
    degradedCount: 0,
    skippedReasons: store.providers.map((provider) => ({ providerId: provider.id, serviceUrl: provider.serviceUrl ?? null, reason: 'monitor_mode_disabled' }))
  };
  store.monitorRuns = [run, ...(store.monitorRuns ?? [])].slice(0, 100);
  await repository.saveSnapshot(store);
  return { run, events: [] as InfopunksEvent[] };
}

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

export function providerMonitorSummary(store: IntelligenceStore, provider: Provider): ProviderMonitorSummary {
  const events = providerMonitorEvents(store, provider.id);
  const lastCheck = events.find((event) => event.type === 'provider.checked') ?? null;
  const recentFailures = events.filter((event) => event.type === 'provider.failed' || event.type === 'provider.degraded').slice(0, 10);
  return {
    provider,
    serviceUrl: provider.serviceUrl ?? null,
    lastCheck,
    recentFailures,
    events,
    health: providerHealthFromEvent(events[0] ?? null),
    mode: 'safe_metadata',
    safeMode: true
  };
}

export function isMonitorEnabled() {
  return currentMonitorMode() !== 'disabled';
}

export function currentMonitorMode(value: MonitorOptions['mode'] | string | undefined = process.env.MONITOR_MODE): MonitorMode {
  if (value === 'safe_metadata' || value === 'endpoint_health' || value === 'paid_execution_probe' || value === 'disabled') return value;
  if (process.env.MONITOR_ENABLED === 'true' && !process.env.MONITOR_MODE) return 'safe_metadata';
  return 'disabled';
}

export function monitorIntervalMs() {
  return Number(process.env.MONITOR_INTERVAL_MS ?? 900_000);
}

export function monitorTimeoutMs() {
  return Number(process.env.MONITOR_TIMEOUT_MS ?? 5000);
}

export function monitorMaxProviders() {
  return Number(process.env.MONITOR_MAX_PROVIDERS ?? 100);
}

async function safeProviderTarget(provider: Provider, skipDnsGuard: boolean): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  if (!provider.serviceUrl) return { ok: false, reason: 'missing_service_url' };
  let url: URL;
  try {
    url = new URL(provider.serviceUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'unsupported_protocol' };
  if (looksLikePaidOperationPath(url)) return { ok: false, reason: 'looks_like_paid_operation_path' };
  if (isPrivateHostname(url.hostname)) return { ok: false, reason: 'private_or_local_url' };
  if (!skipDnsGuard && await resolvesToPrivateAddress(url.hostname)) return { ok: false, reason: 'private_or_local_dns_target' };
  return { ok: true, url };
}

async function checkProviderServiceUrl(provider: Provider, url: URL, options: MonitorOptions) {
  const head = await safeFetch(url, 'HEAD', options);
  const result = head.status_code === 405 || head.status_code === 501 ? await safeFetch(url, 'GET', options) : head;
  const degraded = result.success === true && (result.status_code !== null && result.status_code >= 400 || result.response_time_ms > (options.degradedLatencyMs ?? 1000));
  const status = result.success !== true ? 'failed' : degraded ? 'degraded' : 'reachable';
  return {
    provider_id: provider.id,
    service_url: url.toString(),
    checked_at: result.checked_at,
    success: result.success,
    status_code: result.status_code,
    response_time_ms: result.response_time_ms,
    error_message: result.error_message,
    monitor_mode: 'safe_metadata',
    check_type: SAFE_CHECK_TYPE,
    safe_mode: true,
    method: result.method,
    status
  };
}

async function safeFetch(url: URL, method: 'HEAD' | 'GET', options: MonitorOptions, redirectsRemaining = 2): Promise<{
  checked_at: string;
  success: boolean;
  status_code: number | null;
  response_time_ms: number;
  error_message: string | null;
  method: 'HEAD' | 'GET';
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? monitorTimeoutMs());
  try {
    const response = await fetchImpl(url.toString(), {
      method,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        accept: '*/*'
      }
    });
    const responseTimeMs = Math.max(0, Math.round(performance.now() - started));
    if (isRedirect(response.status) && redirectsRemaining > 0) {
      const location = response.headers.get('location');
      if (!location) return fetchResult(checkedAt, method, false, response.status, responseTimeMs, 'redirect_without_location');
      const nextUrl = new URL(location, url);
      const target = await safeProviderTarget({ serviceUrl: nextUrl.toString() } as Provider, Boolean(options.fetchImpl));
      if (!target.ok) return fetchResult(checkedAt, method, false, response.status, responseTimeMs, `unsafe_redirect:${target.reason}`);
      return safeFetch(target.url, method, options, redirectsRemaining - 1);
    }
    return fetchResult(checkedAt, method, response.status < 500, response.status, responseTimeMs, null);
  } catch (error) {
    return fetchResult(checkedAt, method, false, null, Math.max(0, Math.round(performance.now() - started)), error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}

function fetchResult(checkedAt: string, method: 'HEAD' | 'GET', success: boolean, statusCode: number | null, responseTimeMs: number, errorMessage: string | null) {
  return { checked_at: checkedAt, method, success, status_code: statusCode, response_time_ms: responseTimeMs, error_message: errorMessage };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
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

function providerMonitorEventsForResult(provider: Provider, result: Record<string, unknown>, previous: InfopunksEvent | null, degradedLatencyMs: number): InfopunksEvent[] {
  const observedAt = result.checked_at as string;
  const payload = { providerId: provider.id, ...result };
  const events = [providerMonitorEvent('provider.checked', provider.id, payload, observedAt)];
  const degraded = result.success === true && (result.status === 'degraded' || (typeof result.response_time_ms === 'number' && result.response_time_ms > degradedLatencyMs));

  if (result.success !== true || result.status === 'failed') events.push(providerMonitorEvent('provider.failed', provider.id, payload, observedAt));
  else if (degraded) events.push(providerMonitorEvent('provider.degraded', provider.id, payload, observedAt));
  else {
    events.push(providerMonitorEvent('provider.reachable', provider.id, payload, observedAt));
    if (previous && (previous.payload.success !== true || previous.type === 'provider.degraded' || previous.type === 'provider.failed')) {
      events.push(providerMonitorEvent('provider.recovered', provider.id, payload, observedAt));
    }
  }

  return events;
}

function monitorEvent(type: InfopunksEvent['type'], endpointId: string, payload: Record<string, unknown>, observedAt: string): InfopunksEvent {
  return { id: randomUUID(), type, source: SOURCE, entityType: 'endpoint', entityId: endpointId, observedAt, payload };
}

function providerMonitorEvent(type: InfopunksEvent['type'], providerId: string, payload: Record<string, unknown>, observedAt: string): InfopunksEvent {
  return { id: randomUUID(), type, source: SAFE_SOURCE, entityType: 'provider', entityId: providerId, observedAt, payload };
}

function latestEndpointMonitorEvent(store: IntelligenceStore, endpointId: string) {
  return endpointMonitorEvents(store, endpointId)[0] ?? null;
}

function endpointMonitorEvents(store: IntelligenceStore, endpointId: string) {
  return store.events
    .filter((event) => event.entityType === 'endpoint' && event.entityId === endpointId && isMonitorEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}

function latestProviderMonitorEvent(store: IntelligenceStore, providerId: string) {
  return providerMonitorEvents(store, providerId)[0] ?? null;
}

function providerMonitorEvents(store: IntelligenceStore, providerId: string) {
  return store.events
    .filter((event) => event.entityType === 'provider' && event.entityId === providerId && isProviderMonitorEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || providerEventPriority(b.type) - providerEventPriority(a.type));
}

function healthFromEvent(event: InfopunksEvent | null): EndpointMonitorSummary['health'] {
  if (!event) return 'unknown';
  if (event.payload.success !== true) return 'failed';
  if (event.type === 'endpoint.degraded' || event.payload.schema_validity === false) return 'degraded';
  return 'healthy';
}

function providerHealthFromEvent(event: InfopunksEvent | null): ProviderMonitorSummary['health'] {
  if (!event) return 'unknown';
  if (event.payload.success !== true || event.type === 'provider.failed') return 'failed';
  if (event.type === 'provider.degraded' || event.payload.status === 'degraded') return 'degraded';
  return 'reachable';
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

function applyProviderEvidence(store: IntelligenceStore, providerId: string, events: InfopunksEvent[]) {
  const provider = store.providers.find((item) => item.id === providerId);
  if (!provider) return;
  const evidence = events.map((event): Evidence => ({
    eventId: event.id,
    eventType: event.type,
    source: event.source,
    observedAt: event.observedAt,
    summary: `Safe monitor recorded service reachability ${event.payload.status ?? 'unknown'} with latency ${event.payload.response_time_ms ?? 'unknown'}ms.`,
    value: event.payload
  }));
  provider.evidence = mergeEvidence(provider.evidence, evidence);
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

function isProviderMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'provider.checked' || type === 'provider.reachable' || type === 'provider.recovered' || type === 'provider.degraded' || type === 'provider.failed';
}

function providerEventPriority(type: InfopunksEvent['type']) {
  if (type === 'provider.failed') return 5;
  if (type === 'provider.degraded') return 4;
  if (type === 'provider.recovered') return 3;
  if (type === 'provider.reachable') return 2;
  if (type === 'provider.checked') return 1;
  return 0;
}

function looksLikePaidOperationPath(url: URL) {
  const path = url.pathname.toLowerCase();
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) return false;
  return !segments.some((segment) => ['health', 'status', 'ping', 'ready', 'live', 'uptime', 'docs', 'openapi'].includes(segment));
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  const ipVersion = isIP(normalized);
  if (!ipVersion) return false;
  return isPrivateIp(normalized);
}

async function resolvesToPrivateAddress(hostname: string) {
  if (isIP(hostname)) return isPrivateIp(hostname);
  try {
    const records = await lookup(hostname, { all: true });
    return records.some((record) => isPrivateIp(record.address));
  } catch {
    return false;
  }
}

function isPrivateIp(address: string) {
  if (address === '::1' || address.toLowerCase().startsWith('fe80:') || address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) return true;
  if (!address.includes('.')) return false;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
}
