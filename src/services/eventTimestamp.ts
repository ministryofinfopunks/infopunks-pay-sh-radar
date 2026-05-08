type TimestampLike = {
  observed_at?: unknown;
  observedAt?: unknown;
  timestamp?: unknown;
  created_at?: unknown;
  ingested_at?: unknown;
  ingestedAt?: unknown;
  catalog_generated_at?: unknown;
  catalogGeneratedAt?: unknown;
};

function asTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function resolveEventObservedAt(event: TimestampLike | null | undefined, fallback: string | null = null): string | null {
  if (!event) return asTimestamp(fallback);
  return asTimestamp(event.observed_at)
    ?? asTimestamp(event.observedAt)
    ?? asTimestamp(event.timestamp)
    ?? asTimestamp(event.created_at)
    ?? asTimestamp(fallback);
}

export function resolveEventIngestedAt(event: TimestampLike | null | undefined, fallback: string | null = null): string | null {
  if (!event) return asTimestamp(fallback);
  return asTimestamp(event.ingested_at)
    ?? asTimestamp(event.ingestedAt)
    ?? asTimestamp(fallback);
}

export function resolveEventCatalogGeneratedAt(event: TimestampLike | null | undefined, fallback: string | null = null): string | null {
  if (!event) return asTimestamp(fallback);
  return asTimestamp(event.catalog_generated_at)
    ?? asTimestamp(event.catalogGeneratedAt)
    ?? asTimestamp(fallback);
}
