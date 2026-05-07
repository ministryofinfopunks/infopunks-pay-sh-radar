"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEndpointMonitor = runEndpointMonitor;
exports.endpointMonitorSummary = endpointMonitorSummary;
exports.isMonitorEnabled = isMonitorEnabled;
exports.monitorIntervalMs = monitorIntervalMs;
exports.monitorTimeoutMs = monitorTimeoutMs;
const node_crypto_1 = require("node:crypto");
const intelligenceStore_1 = require("./intelligenceStore");
const SOURCE = 'infopunks:endpoint-monitor';
async function runEndpointMonitor(store, repository, options = {}) {
    const now = options.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const run = {
        id: (0, node_crypto_1.randomUUID)(),
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
    const emittedEvents = [];
    try {
        for (const endpoint of store.endpoints) {
            const target = monitorTarget(endpoint, options);
            if (!target) {
                run.skippedCount += 1;
                continue;
            }
            const result = await checkEndpoint(endpoint, target, options);
            run.checkedCount += 1;
            if (result.success)
                run.successCount += 1;
            else
                run.failedCount += 1;
            const events = monitorEventsForResult(endpoint, result, latestEndpointMonitorEvent(store, endpoint.id), options.degradedLatencyMs ?? 1000);
            emittedEvents.push(...events);
            applyEndpointEvidence(store, endpoint.id, events);
        }
        run.status = 'succeeded';
    }
    catch (error) {
        run.status = 'failed';
        run.errorCount += 1;
        run.error = error instanceof Error ? error.message : String(error);
    }
    finally {
        run.finishedAt = now().toISOString();
        store.events = [...store.events, ...emittedEvents];
        store.monitorRuns = [run, ...(store.monitorRuns ?? [])].slice(0, 100);
        const recomputed = (0, intelligenceStore_1.recomputeAssessments)(store);
        replaceStore(store, recomputed);
        await repository.saveSnapshot(store);
    }
    return { run, events: emittedEvents };
}
function endpointMonitorSummary(store, endpoint) {
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
function isMonitorEnabled() {
    return process.env.MONITOR_ENABLED === 'true';
}
function monitorIntervalMs() {
    return Number(process.env.MONITOR_INTERVAL_MS ?? 300_000);
}
function monitorTimeoutMs() {
    return Number(process.env.MONITOR_TIMEOUT_MS ?? 5000);
}
function monitorTarget(endpoint, options) {
    const schema = endpoint.schema && typeof endpoint.schema === 'object' ? endpoint.schema : {};
    const nestedMonitor = schema.monitor && typeof schema.monitor === 'object' ? schema.monitor : {};
    const metadataUrl = stringValue(schema.monitorUrl) ?? stringValue(schema.monitor_url) ?? stringValue(schema.healthUrl) ?? stringValue(schema.health_url) ?? stringValue(nestedMonitor.url) ?? stringValue(nestedMonitor.healthUrl) ?? stringValue(nestedMonitor.health_url);
    if (metadataUrl)
        return { url: metadataUrl, method: 'GET' };
    const mode = options.mode ?? (process.env.MONITOR_MODE === 'endpoint' ? 'endpoint' : 'metadata');
    const allowPaid = options.allowPaidEndpoints ?? process.env.MONITOR_ALLOW_PAID_ENDPOINTS === 'true';
    if (mode === 'endpoint' && allowPaid && endpoint.method === 'GET' && endpoint.path?.startsWith('http')) {
        return { url: endpoint.path, method: 'GET' };
    }
    return null;
}
async function checkEndpoint(endpoint, target, options) {
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
    }
    catch (error) {
        return {
            status_code: null,
            response_time_ms: Math.max(0, Math.round(performance.now() - started)),
            checked_at: checkedAt,
            error_message: error instanceof Error ? error.message : String(error),
            success: false,
            schema_validity: null,
            target_url: target.url
        };
    }
    finally {
        clearTimeout(timer);
    }
}
async function schemaValidityFor(endpoint, response) {
    const schema = endpoint.schema && typeof endpoint.schema === 'object' ? endpoint.schema : {};
    const responseSchema = schema.response ?? (schema.monitor && typeof schema.monitor === 'object' ? schema.monitor.response : undefined);
    if (!responseSchema)
        return null;
    try {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('json'))
            return false;
        return validateJsonSchema(await response.clone().json(), responseSchema);
    }
    catch {
        return false;
    }
}
function validateJsonSchema(value, schema) {
    if (!schema || typeof schema !== 'object')
        return true;
    const spec = schema;
    if (spec.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return false;
        const record = value;
        const required = Array.isArray(spec.required) ? spec.required.filter((item) => typeof item === 'string') : [];
        if (required.some((key) => !(key in record)))
            return false;
        const properties = spec.properties && typeof spec.properties === 'object' ? spec.properties : {};
        return Object.entries(properties).every(([key, childSchema]) => !(key in record) || validateJsonSchema(record[key], childSchema));
    }
    if (spec.type === 'array')
        return Array.isArray(value);
    if (spec.type === 'string')
        return typeof value === 'string';
    if (spec.type === 'number')
        return typeof value === 'number';
    if (spec.type === 'integer')
        return Number.isInteger(value);
    if (spec.type === 'boolean')
        return typeof value === 'boolean';
    return true;
}
function monitorEventsForResult(endpoint, result, previous, degradedLatencyMs) {
    const observedAt = result.checked_at;
    const payload = { providerId: endpoint.providerId, endpointId: endpoint.id, ...result };
    const events = [monitorEvent('endpoint.checked', endpoint.id, payload, observedAt)];
    const degraded = result.success === true && ((typeof result.response_time_ms === 'number' && result.response_time_ms > degradedLatencyMs) || result.schema_validity === false);
    if (result.success !== true)
        events.push(monitorEvent('endpoint.failed', endpoint.id, payload, observedAt));
    else if (degraded)
        events.push(monitorEvent('endpoint.degraded', endpoint.id, payload, observedAt));
    else if (previous && (previous.payload.success !== true || previous.type === 'endpoint.degraded'))
        events.push(monitorEvent('endpoint.recovered', endpoint.id, payload, observedAt));
    return events;
}
function monitorEvent(type, endpointId, payload, observedAt) {
    return { id: (0, node_crypto_1.randomUUID)(), type, source: SOURCE, entityType: 'endpoint', entityId: endpointId, observedAt, payload };
}
function latestEndpointMonitorEvent(store, endpointId) {
    return endpointMonitorEvents(store, endpointId)[0] ?? null;
}
function endpointMonitorEvents(store, endpointId) {
    return store.events
        .filter((event) => event.entityType === 'endpoint' && event.entityId === endpointId && isMonitorEvent(event.type))
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
function healthFromEvent(event) {
    if (!event)
        return 'unknown';
    if (event.payload.success !== true)
        return 'failed';
    if (event.type === 'endpoint.degraded' || event.payload.schema_validity === false)
        return 'degraded';
    return 'healthy';
}
function applyEndpointEvidence(store, endpointId, events) {
    const endpoint = store.endpoints.find((item) => item.id === endpointId);
    if (!endpoint)
        return;
    const evidence = events.map((event) => ({
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
        .map((event) => event.payload.response_time_ms)
        .sort((a, b) => a - b);
    endpoint.latencyMsP50 = latencies.length ? Math.round(latencies[Math.floor((latencies.length - 1) / 2)]) : endpoint.latencyMsP50;
    endpoint.status = events.some((event) => event.type === 'endpoint.failed' || event.type === 'endpoint.degraded') ? 'degraded' : 'available';
}
function mergeEvidence(existing, next) {
    const evidence = new Map(existing.map((item) => [item.eventId, item]));
    for (const item of next)
        evidence.set(item.eventId, item);
    return [...evidence.values()];
}
function replaceStore(target, source) {
    target.events = source.events;
    target.providers = source.providers;
    target.endpoints = source.endpoints;
    target.trustAssessments = source.trustAssessments;
    target.signalAssessments = source.signalAssessments;
    target.narratives = source.narratives;
    target.ingestionRuns = source.ingestionRuns;
    target.monitorRuns = source.monitorRuns;
}
function stringValue(value) {
    return typeof value === 'string' && value.startsWith('http') ? value : null;
}
function isMonitorEvent(type) {
    return type === 'endpoint.checked' || type === 'endpoint.recovered' || type === 'endpoint.degraded' || type === 'endpoint.failed';
}
