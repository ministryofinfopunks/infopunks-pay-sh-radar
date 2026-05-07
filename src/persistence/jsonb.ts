export type JsonPrimitive = string | number | boolean | null;
export type JsonSafe = JsonPrimitive | JsonSafe[] | { [key: string]: JsonSafe };

type JsonContext = {
  operation: string;
  table: string;
  column: string;
};

const MAX_LOG_PREVIEW = 300;

export function normalizeJson(value: unknown): JsonSafe {
  return normalizeWithSeen(value, new WeakSet<object>());
}

export function toJsonb(value: unknown): string {
  return JSON.stringify(normalizeJson(value ?? null));
}

export function safeJsonbParam(value: unknown, context: JsonContext): string {
  const normalized = normalizeJson(value ?? null);
  const serialized = JSON.stringify(normalized);
  try {
    JSON.parse(serialized);
    return serialized;
  } catch (error) {
    logJsonNormalizationIssue(context, normalized, serialized, error);
    return 'null';
  }
}

export function logPostgres22P02(context: JsonContext, value: unknown) {
  const normalized = normalizeJson(value ?? null);
  const serialized = JSON.stringify(normalized);
  console.error('[jsonb-22P02]', {
    operation: context.operation,
    table: context.table,
    column: context.column,
    normalizedType: normalized === null ? 'null' : Array.isArray(normalized) ? 'array' : typeof normalized,
    preview: serialized.slice(0, MAX_LOG_PREVIEW)
  });
}

function normalizeWithSeen(value: unknown, seen: WeakSet<object>): JsonSafe {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null
    };
  }

  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();

  if (Array.isArray(value)) {
    return value.map((item) => normalizeWithSeen(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);
    const output: Record<string, JsonSafe> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = normalizeWithSeen(nested, seen);
    }
    seen.delete(value as object);
    return output;
  }

  return String(value);
}

function logJsonNormalizationIssue(context: JsonContext, normalized: JsonSafe, serialized: string, error: unknown) {
  console.error('[jsonb-normalization-fallback]', {
    operation: context.operation,
    table: context.table,
    column: context.column,
    normalizedType: normalized === null ? 'null' : Array.isArray(normalized) ? 'array' : typeof normalized,
    preview: serialized.slice(0, MAX_LOG_PREVIEW),
    error: error instanceof Error ? error.message : String(error)
  });
}
