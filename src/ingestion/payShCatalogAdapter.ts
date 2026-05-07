import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Endpoint, Evidence, InfopunksEvent, IngestionRun, PricingModel, Provider } from '../schemas/entities';
import { PayShCatalogEndpointItem, PayShCatalogItem, payShCatalogFixture } from '../data/payShCatalogFixture';
import { IntelligenceSnapshot } from '../persistence/repository';

const FIXTURE_SOURCE = 'pay.sh:public-catalog-fixture';
const LIVE_SOURCE = 'pay.sh:live-catalog';
const CATALOG_URL = 'https://pay.sh/';

const EndpointMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const CatalogEndpointSchema = z.object({
  name: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  method: EndpointMethodSchema.nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  status: z.enum(['available', 'degraded', 'unknown']).nullable().optional(),
  schema: z.unknown().nullable().optional()
});

const CatalogItemSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  slug: z.string(),
  category: z.string(),
  endpoints: z.number().int().nonnegative(),
  price: z.string(),
  status: z.enum(['free tier', 'metered', 'free', 'unknown']).default('unknown').catch('unknown'),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  manifest: z.record(z.string(), z.unknown()).nullable().optional(),
  schema: z.unknown().nullable().optional(),
  endpointDetails: z.array(CatalogEndpointSchema).optional()
});

export type PayShCatalogSourceResult = {
  items: PayShCatalogItem[];
  source: string;
  usedFixture: boolean;
};

export type PayShIngestionResult = {
  snapshot: IntelligenceSnapshot;
  run: IngestionRun;
  events: InfopunksEvent[];
};

function stableId(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableJson(nested)]));
  }
  return value ?? null;
}

function fingerprint(value: unknown) {
  return stableId([stableJson(value)]);
}

function evidenceFrom(event: InfopunksEvent, summary: string, value?: unknown): Evidence {
  return { eventId: event.id, eventType: event.type, source: event.source, observedAt: event.observedAt, summary, value };
}

function event(source: string, type: InfopunksEvent['type'], entityType: InfopunksEvent['entityType'], entityId: string, payload: Record<string, unknown>, observedAt: string): InfopunksEvent {
  const stablePayload = stableJson(payload) as Record<string, unknown>;
  return { id: stableId([source, type, entityType, entityId, stablePayload]), type, source, entityType, entityId, observedAt, payload: stablePayload };
}

function diffPayload(before: unknown, after: unknown) {
  return { before: stableJson(before), after: stableJson(after) };
}

export function parseCatalogPrice(raw: string, entityId = 'unknown', pricingEvent?: InfopunksEvent): PricingModel {
  const text = raw.trim().toLowerCase();
  const numbers = [...text.matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
  const base = {
    id: `pricing-${entityId}`,
    entityId,
    currency: 'USD' as const,
    unit: 'request',
    raw,
    evidence: pricingEvent ? [evidenceFrom(pricingEvent, `Pay.sh catalog price observed as "${raw}".`, raw)] : []
  };

  if (text === 'free') return { ...base, min: 0, max: 0, clarity: 'free' };
  if (numbers.length === 1) return { ...base, min: numbers[0], max: numbers[0], clarity: 'clear' };
  if (numbers.length >= 2) return { ...base, min: Math.min(...numbers), max: Math.max(...numbers), clarity: text.includes('dynamic') ? 'dynamic' : 'range' };
  return { ...base, min: null, max: null, currency: null, unit: null, clarity: 'unknown' };
}

export async function loadPayShCatalog(url = process.env.PAY_SH_CATALOG_URL): Promise<PayShCatalogSourceResult> {
  if (!url) return { items: payShCatalogFixture, source: FIXTURE_SOURCE, usedFixture: true };

  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Pay.sh catalog returned ${response.status}`);
    return { items: normalizePayShCatalog(await response.json()), source: `${LIVE_SOURCE}:${url}`, usedFixture: false };
  } catch {
    return { items: payShCatalogFixture, source: FIXTURE_SOURCE, usedFixture: true };
  }
}

export function normalizePayShCatalog(input: unknown): PayShCatalogItem[] {
  const candidates = Array.isArray(input)
    ? input
    : Array.isArray((input as { data?: unknown[] })?.data)
      ? (input as { data: unknown[] }).data
      : Array.isArray((input as { providers?: unknown[] })?.providers)
        ? (input as { providers: unknown[] }).providers
        : Array.isArray((input as { catalog?: unknown[] })?.catalog)
          ? (input as { catalog: unknown[] }).catalog
          : [];

  return candidates.map((candidate) => {
    const raw = candidate as Record<string, unknown>;
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
    return parsed as PayShCatalogItem;
  });
}

export function ingestPayShCatalog(items: PayShCatalogItem[] = payShCatalogFixture, observedAt = new Date().toISOString(), source = FIXTURE_SOURCE): { events: InfopunksEvent[]; providers: Provider[]; endpoints: Endpoint[] } {
  const empty = emptySnapshot();
  return applyPayShCatalogIngestion(empty, items, { observedAt, source }).snapshot;
}

export function applyPayShCatalogIngestion(snapshot: IntelligenceSnapshot, items: PayShCatalogItem[], options: { observedAt?: string; source?: string } = {}): PayShIngestionResult {
  const observedAt = options.observedAt ?? new Date().toISOString();
  const source = options.source ?? FIXTURE_SOURCE;
  const run: IngestionRun = {
    id: randomUUID(),
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
  const nextEvents: InfopunksEvent[] = [];
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
    const nextProvider: Provider = {
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

    if (!previousProvider) run.discoveredCount += 1;
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
    } else if (previousProvider && fingerprint(previousProviderSchema) !== fingerprint(nextProviderSchema)) {
      addNewEvents(existingEvents, nextEvents, [event(source, 'schema.changed', 'schema', `schema-${providerId}`, { providerId, ...diffPayload(previousProviderSchema, nextProviderSchema) }, observedAt)]);
      run.changedCount += 1;
    }
    providers.set(providerId, nextProvider);

    for (const endpointInput of expandEndpoints(item)) {
      const endpointId = endpointInput.id;
      const previousEndpoint = endpoints.get(endpointId);
      const endpointEvents = endpointEventSet(providerId, endpointInput, source, observedAt);
      const endpointPricing = parseCatalogPrice(endpointInput.price, endpointId, endpointEvents.pricingEvent);
      const nextEndpoint: Endpoint = {
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

      if (!previousEndpoint) run.discoveredCount += 1;
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
      } else if (previousEndpoint && fingerprint(previousEndpoint.schema ?? null) !== fingerprint(endpointInput.schema)) {
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

function providerEventSet(item: PayShCatalogItem, source: string, observedAt: string) {
  const providerId = item.slug;
  return {
    providerEvent: event(source, 'pay_sh_catalog_provider_seen', 'provider', providerId, item, observedAt),
    metadataEvent: event(source, 'provider_metadata_observed', 'provider', providerId, providerManifestFromItem(item), observedAt),
    manifestEvent: event(source, 'pay_sh_catalog_manifest_seen', 'manifest', `manifest-${providerId}`, { providerId, manifest: item.manifest ?? providerManifestFromItem(item) }, observedAt),
    pricingEvent: event(source, 'pricing_observed', 'pricing_model', `pricing-${providerId}`, { raw: item.price, providerId }, observedAt)
  };
}

function endpointEventSet(providerId: string, endpointInput: ExpandedEndpoint, source: string, observedAt: string) {
  return {
    endpointEvent: event(source, 'pay_sh_catalog_endpoint_seen', 'endpoint', endpointInput.id, { providerId, ordinal: endpointInput.ordinal, category: endpointInput.category, path: endpointInput.path, method: endpointInput.method }, observedAt),
    pricingEvent: event(source, 'pricing_observed', 'pricing_model', `pricing-${endpointInput.id}`, { raw: endpointInput.price, endpointId: endpointInput.id }, observedAt)
  };
}

function endpointEvidence(endpointEvents: ReturnType<typeof endpointEventSet>, endpointInput: ExpandedEndpoint, endpointPricing: PricingModel, _source: string) {
  return [
    evidenceFrom(endpointEvents.endpointEvent, endpointInput.synthetic ? 'Endpoint count was expanded from Pay.sh catalog endpoint total; exact endpoint method/path unavailable in fixture.' : 'Endpoint was observed in the Pay.sh catalog source.', endpointEvents.endpointEvent.payload),
    ...endpointPricing.evidence
  ];
}

function providerManifestFromItem(item: PayShCatalogItem) {
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

function providerManifest(provider: Provider) {
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

function providerSchema(provider?: Provider) {
  return provider?.schema ?? null;
}

function endpointManifest(endpoint: Endpoint) {
  return {
    name: endpoint.name,
    path: endpoint.path,
    method: endpoint.method,
    category: endpoint.category,
    description: endpoint.description,
    status: endpoint.status
  };
}

type ExpandedEndpoint = {
  id: string;
  ordinal: number;
  name: string;
  path: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null;
  category: string;
  description: string | null;
  status: 'available' | 'degraded' | 'unknown';
  schema: unknown | null;
  price: string;
  synthetic: boolean;
};

function expandEndpoints(item: PayShCatalogItem): ExpandedEndpoint[] {
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
    status: 'unknown' as const,
    schema: null,
    synthetic: true
  }));
}

function addNewEvents(existingEvents: Map<string, InfopunksEvent>, nextEvents: InfopunksEvent[], events: InfopunksEvent[]) {
  for (const nextEvent of events) {
    if (existingEvents.has(nextEvent.id)) continue;
    existingEvents.set(nextEvent.id, nextEvent);
    nextEvents.push(nextEvent);
  }
}

function mergeEvidence(existing: Evidence[], next: Evidence[]) {
  const evidence = new Map(existing.map((item) => [item.eventId, item]));
  for (const item of next) evidence.set(item.eventId, item);
  return [...evidence.values()];
}

function emptySnapshot(): IntelligenceSnapshot {
  return { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
}
