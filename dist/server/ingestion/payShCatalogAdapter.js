"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCatalogPrice = parseCatalogPrice;
exports.loadPayShCatalog = loadPayShCatalog;
exports.normalizePayShCatalog = normalizePayShCatalog;
exports.ingestPayShCatalog = ingestPayShCatalog;
exports.applyPayShCatalogIngestion = applyPayShCatalogIngestion;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const payShCatalogFixture_1 = require("../data/payShCatalogFixture");
const FIXTURE_SOURCE = 'pay.sh:public-catalog-fixture';
const LIVE_SOURCE = 'pay.sh:live-catalog';
const CATALOG_URL = 'https://pay.sh/';
const EndpointMethodSchema = zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const CatalogEndpointSchema = zod_1.z.object({
    name: zod_1.z.string().nullable().optional(),
    path: zod_1.z.string().nullable().optional(),
    method: EndpointMethodSchema.nullable().optional(),
    category: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    price: zod_1.z.string().nullable().optional(),
    status: zod_1.z.enum(['available', 'degraded', 'unknown']).nullable().optional(),
    schema: zod_1.z.unknown().nullable().optional()
});
const CatalogItemSchema = zod_1.z.object({
    name: zod_1.z.string(),
    namespace: zod_1.z.string(),
    slug: zod_1.z.string(),
    category: zod_1.z.string(),
    endpoints: zod_1.z.number().int().nonnegative(),
    price: zod_1.z.string(),
    status: zod_1.z.enum(['free tier', 'metered', 'free', 'unknown']).default('unknown').catch('unknown'),
    description: zod_1.z.string().default(''),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    manifest: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    schema: zod_1.z.unknown().nullable().optional(),
    endpointDetails: zod_1.z.array(CatalogEndpointSchema).optional()
});
function stableId(parts) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}
function stableJson(value) {
    if (Array.isArray(value))
        return value.map(stableJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableJson(nested)]));
    }
    return value ?? null;
}
function fingerprint(value) {
    return stableId([stableJson(value)]);
}
function evidenceFrom(event, summary, value) {
    return { eventId: event.id, eventType: event.type, source: event.source, observedAt: event.observedAt, summary, value };
}
function event(source, type, entityType, entityId, payload, observedAt) {
    const stablePayload = stableJson(payload);
    return { id: stableId([source, type, entityType, entityId, stablePayload]), type, source, entityType, entityId, observedAt, payload: stablePayload };
}
function diffPayload(before, after) {
    return { before: stableJson(before), after: stableJson(after) };
}
function parseCatalogPrice(raw, entityId = 'unknown', pricingEvent) {
    const text = raw.trim().toLowerCase();
    const numbers = [...text.matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
    const base = {
        id: `pricing-${entityId}`,
        entityId,
        currency: 'USD',
        unit: 'request',
        raw,
        evidence: pricingEvent ? [evidenceFrom(pricingEvent, `Pay.sh catalog price observed as "${raw}".`, raw)] : []
    };
    if (text === 'free')
        return { ...base, min: 0, max: 0, clarity: 'free' };
    if (numbers.length === 1)
        return { ...base, min: numbers[0], max: numbers[0], clarity: 'clear' };
    if (numbers.length >= 2)
        return { ...base, min: Math.min(...numbers), max: Math.max(...numbers), clarity: text.includes('dynamic') ? 'dynamic' : 'range' };
    return { ...base, min: null, max: null, currency: null, unit: null, clarity: 'unknown' };
}
async function loadPayShCatalog(url = process.env.PAY_SH_CATALOG_URL) {
    if (!url)
        return { items: payShCatalogFixture_1.payShCatalogFixture, source: FIXTURE_SOURCE, usedFixture: true };
    try {
        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (!response.ok)
            throw new Error(`Pay.sh catalog returned ${response.status}`);
        return { items: normalizePayShCatalog(await response.json()), source: `${LIVE_SOURCE}:${url}`, usedFixture: false };
    }
    catch {
        return { items: payShCatalogFixture_1.payShCatalogFixture, source: FIXTURE_SOURCE, usedFixture: true };
    }
}
function normalizePayShCatalog(input) {
    const candidates = Array.isArray(input)
        ? input
        : Array.isArray(input?.data)
            ? input.data
            : Array.isArray(input?.providers)
                ? input.providers
                : Array.isArray(input?.catalog)
                    ? input.catalog
                    : [];
    return candidates.map((candidate) => {
        const raw = candidate;
        const endpointDetails = Array.isArray(raw.endpointDetails) ? raw.endpointDetails : Array.isArray(raw.endpoints) ? raw.endpoints : undefined;
        const endpointCount = typeof raw.endpoints === 'number' ? raw.endpoints : endpointDetails?.length ?? Number(raw.endpointCount ?? 0);
        const parsed = CatalogItemSchema.parse({
            ...raw,
            endpoints: endpointCount,
            endpointDetails,
            price: raw.price ?? raw.pricing ?? 'unknown',
            description: raw.description ?? '',
            tags: Array.isArray(raw.tags) ? raw.tags : []
        });
        return parsed;
    });
}
function ingestPayShCatalog(items = payShCatalogFixture_1.payShCatalogFixture, observedAt = new Date().toISOString(), source = FIXTURE_SOURCE) {
    const empty = emptySnapshot();
    return applyPayShCatalogIngestion(empty, items, { observedAt, source }).snapshot;
}
function applyPayShCatalogIngestion(snapshot, items, options = {}) {
    const observedAt = options.observedAt ?? new Date().toISOString();
    const source = options.source ?? FIXTURE_SOURCE;
    const run = {
        id: (0, node_crypto_1.randomUUID)(),
        startedAt: observedAt,
        finishedAt: null,
        source,
        status: 'running',
        discoveredCount: 0,
        changedCount: 0,
        errorCount: 0,
        error: null
    };
    const existingEvents = new Map(snapshot.events.map((item) => [item.id, item]));
    const nextEvents = [];
    const providers = new Map(snapshot.providers.map((item) => [item.id, item]));
    const endpoints = new Map(snapshot.endpoints.map((item) => [item.id, item]));
    for (const item of items) {
        const providerId = item.slug;
        const previousProvider = providers.get(providerId);
        const providerEvents = providerEventSet(item, source, observedAt);
        const providerPricing = parseCatalogPrice(item.price, providerId, providerEvents.pricingEvent);
        const providerEvidence = [
            evidenceFrom(providerEvents.providerEvent, source === FIXTURE_SOURCE ? 'Provider was observed in the public Pay.sh catalog fixture.' : 'Provider was observed in the Pay.sh catalog source.', item.namespace),
            evidenceFrom(providerEvents.metadataEvent, 'Provider metadata came from Pay.sh catalog fields.', providerEvents.metadataEvent.payload),
            evidenceFrom(providerEvents.manifestEvent, 'Provider manifest was observed from Pay.sh catalog fields.', providerEvents.manifestEvent.payload),
            ...providerPricing.evidence
        ];
        const nextProvider = {
            id: providerId,
            name: item.name,
            slug: item.slug,
            namespace: item.namespace,
            category: item.category,
            description: item.description || null,
            status: item.status,
            endpointCount: item.endpoints,
            tags: item.tags,
            schema: item.schema ?? null,
            source: 'pay.sh',
            catalogUrl: `${CATALOG_URL}services/${item.namespace}`,
            firstSeenAt: previousProvider?.firstSeenAt ?? observedAt,
            lastSeenAt: observedAt,
            pricing: providerPricing,
            evidence: previousProvider ? mergeEvidence(previousProvider.evidence, providerEvidence) : providerEvidence
        };
        if (!previousProvider)
            run.discoveredCount += 1;
        addNewEvents(existingEvents, nextEvents, Object.values(providerEvents));
        if (previousProvider && fingerprint(providerManifest(previousProvider)) !== fingerprint(providerManifest(nextProvider))) {
            addNewEvents(existingEvents, nextEvents, [event(source, 'manifest.updated', 'manifest', `manifest-${providerId}`, { providerId, ...diffPayload(providerManifest(previousProvider), providerManifest(nextProvider)) }, observedAt)]);
            run.changedCount += 1;
        }
        if (previousProvider && previousProvider.pricing.raw !== nextProvider.pricing.raw) {
            addNewEvents(existingEvents, nextEvents, [event(source, 'price.changed', 'pricing_model', `pricing-${providerId}`, { providerId, ...diffPayload(previousProvider.pricing.raw, nextProvider.pricing.raw) }, observedAt)]);
            run.changedCount += 1;
        }
        const previousProviderSchema = providerSchema(previousProvider);
        const nextProviderSchema = item.schema ?? null;
        if (!previousProvider && nextProviderSchema !== null) {
            addNewEvents(existingEvents, nextEvents, [event(source, 'pay_sh_catalog_schema_seen', 'schema', `schema-${providerId}`, { providerId, schema: nextProviderSchema }, observedAt)]);
        }
        else if (previousProvider && fingerprint(previousProviderSchema) !== fingerprint(nextProviderSchema)) {
            addNewEvents(existingEvents, nextEvents, [event(source, 'schema.changed', 'schema', `schema-${providerId}`, { providerId, ...diffPayload(previousProviderSchema, nextProviderSchema) }, observedAt)]);
            run.changedCount += 1;
        }
        providers.set(providerId, nextProvider);
        for (const endpointInput of expandEndpoints(item)) {
            const endpointId = endpointInput.id;
            const previousEndpoint = endpoints.get(endpointId);
            const endpointEvents = endpointEventSet(providerId, endpointInput, source, observedAt);
            const endpointPricing = parseCatalogPrice(endpointInput.price, endpointId, endpointEvents.pricingEvent);
            const nextEndpoint = {
                id: endpointId,
                providerId,
                name: endpointInput.name,
                path: endpointInput.path,
                method: endpointInput.method,
                category: endpointInput.category,
                description: endpointInput.description,
                pricing: endpointPricing,
                status: endpointInput.status,
                schema: endpointInput.schema,
                latencyMsP50: null,
                firstSeenAt: previousEndpoint?.firstSeenAt ?? observedAt,
                lastSeenAt: observedAt,
                evidence: previousEndpoint ? mergeEvidence(previousEndpoint.evidence, endpointEvidence(endpointEvents, endpointInput, endpointPricing, source)) : endpointEvidence(endpointEvents, endpointInput, endpointPricing, source)
            };
            if (!previousEndpoint)
                run.discoveredCount += 1;
            addNewEvents(existingEvents, nextEvents, Object.values(endpointEvents));
            if (previousEndpoint && fingerprint(endpointManifest(previousEndpoint)) !== fingerprint(endpointManifest(nextEndpoint))) {
                addNewEvents(existingEvents, nextEvents, [event(source, 'endpoint.updated', 'endpoint', endpointId, { providerId, ...diffPayload(endpointManifest(previousEndpoint), endpointManifest(nextEndpoint)) }, observedAt)]);
                run.changedCount += 1;
            }
            if (previousEndpoint && previousEndpoint.pricing.raw !== nextEndpoint.pricing.raw) {
                addNewEvents(existingEvents, nextEvents, [event(source, 'price.changed', 'pricing_model', `pricing-${endpointId}`, { endpointId, providerId, ...diffPayload(previousEndpoint.pricing.raw, nextEndpoint.pricing.raw) }, observedAt)]);
                run.changedCount += 1;
            }
            if (!previousEndpoint && endpointInput.schema !== null) {
                addNewEvents(existingEvents, nextEvents, [event(source, 'pay_sh_catalog_schema_seen', 'schema', `schema-${endpointId}`, { endpointId, providerId, schema: endpointInput.schema }, observedAt)]);
            }
            else if (previousEndpoint && fingerprint(previousEndpoint.schema ?? null) !== fingerprint(endpointInput.schema)) {
                addNewEvents(existingEvents, nextEvents, [event(source, 'schema.changed', 'schema', `schema-${endpointId}`, { endpointId, providerId, ...diffPayload(previousEndpoint.schema ?? null, endpointInput.schema) }, observedAt)]);
                run.changedCount += 1;
            }
            endpoints.set(endpointId, nextEndpoint);
        }
    }
    run.finishedAt = new Date().toISOString();
    run.status = 'succeeded';
    const nextSnapshot = {
        ...snapshot,
        events: [...snapshot.events, ...nextEvents],
        providers: [...providers.values()],
        endpoints: [...endpoints.values()],
        ingestionRuns: [run, ...(snapshot.ingestionRuns ?? [])].slice(0, 100)
    };
    return { snapshot: nextSnapshot, run, events: nextEvents };
}
function providerEventSet(item, source, observedAt) {
    const providerId = item.slug;
    return {
        providerEvent: event(source, 'pay_sh_catalog_provider_seen', 'provider', providerId, item, observedAt),
        metadataEvent: event(source, 'provider_metadata_observed', 'provider', providerId, providerManifestFromItem(item), observedAt),
        manifestEvent: event(source, 'pay_sh_catalog_manifest_seen', 'manifest', `manifest-${providerId}`, { providerId, manifest: item.manifest ?? providerManifestFromItem(item) }, observedAt),
        pricingEvent: event(source, 'pricing_observed', 'pricing_model', `pricing-${providerId}`, { raw: item.price, providerId }, observedAt)
    };
}
function endpointEventSet(providerId, endpointInput, source, observedAt) {
    return {
        endpointEvent: event(source, 'pay_sh_catalog_endpoint_seen', 'endpoint', endpointInput.id, { providerId, ordinal: endpointInput.ordinal, category: endpointInput.category, path: endpointInput.path, method: endpointInput.method }, observedAt),
        pricingEvent: event(source, 'pricing_observed', 'pricing_model', `pricing-${endpointInput.id}`, { raw: endpointInput.price, endpointId: endpointInput.id }, observedAt)
    };
}
function endpointEvidence(endpointEvents, endpointInput, endpointPricing, _source) {
    return [
        evidenceFrom(endpointEvents.endpointEvent, endpointInput.synthetic ? 'Endpoint count was expanded from Pay.sh catalog endpoint total; exact endpoint method/path unavailable in fixture.' : 'Endpoint was observed in the Pay.sh catalog source.', endpointEvents.endpointEvent.payload),
        ...endpointPricing.evidence
    ];
}
function providerManifestFromItem(item) {
    return {
        name: item.name,
        namespace: item.namespace,
        category: item.category,
        description: item.description || null,
        tags: item.tags,
        endpointCount: item.endpoints,
        status: item.status,
        manifest: item.manifest ?? null
    };
}
function providerManifest(provider) {
    return {
        name: provider.name,
        namespace: provider.namespace,
        category: provider.category,
        description: provider.description,
        tags: provider.tags,
        endpointCount: provider.endpointCount,
        status: provider.status
    };
}
function providerSchema(provider) {
    return provider?.schema ?? null;
}
function endpointManifest(endpoint) {
    return {
        name: endpoint.name,
        path: endpoint.path,
        method: endpoint.method,
        category: endpoint.category,
        description: endpoint.description,
        status: endpoint.status
    };
}
function expandEndpoints(item) {
    if (item.endpointDetails?.length) {
        return item.endpointDetails.map((endpoint, index) => ({
            id: `${item.slug}-endpoint-${index + 1}`,
            ordinal: index + 1,
            name: endpoint.name ?? `${item.name} endpoint ${index + 1}`,
            path: endpoint.path ?? null,
            method: endpoint.method ?? null,
            category: endpoint.category ?? item.category,
            description: endpoint.description ?? null,
            price: endpoint.price ?? item.price,
            status: endpoint.status ?? 'unknown',
            schema: endpoint.schema ?? null,
            synthetic: false
        }));
    }
    return Array.from({ length: item.endpoints }, (_, index) => ({
        id: `${item.slug}-endpoint-${index + 1}`,
        ordinal: index + 1,
        name: index === 0 ? `${item.name} primary endpoint` : `${item.name} endpoint ${index + 1}`,
        path: null,
        method: null,
        category: item.category,
        description: index === 0 ? item.description : null,
        price: item.price,
        status: 'unknown',
        schema: null,
        synthetic: true
    }));
}
function addNewEvents(existingEvents, nextEvents, events) {
    for (const nextEvent of events) {
        if (existingEvents.has(nextEvent.id))
            continue;
        existingEvents.set(nextEvent.id, nextEvent);
        nextEvents.push(nextEvent);
    }
}
function mergeEvidence(existing, next) {
    const evidence = new Map(existing.map((item) => [item.eventId, item]));
    for (const item of next)
        evidence.set(item.eventId, item);
    return [...evidence.values()];
}
function emptySnapshot() {
    return { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
}
