/** Render a catalog price conservatively. Unsupported values are unknown. */
export function formatCatalogPrice(price: unknown): string {
  if (typeof price === 'string') {
    const text = price.trim().toLowerCase();
    if (text === 'free') return 'free';
    const values = [...text.matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
    if (values.length === 1 && Number.isFinite(values[0])) return `$${values[0]}`;
    if (values.length >= 2 && values.every((value) => Number.isFinite(value))) return `$${Math.min(...values)} - $${Math.max(...values)}`;
    return 'unknown';
  }
  if (!price || typeof price !== 'object' || Array.isArray(price)) return 'unknown';
  const value = price as Record<string, unknown>;
  const min = typeof value.min === 'number' && Number.isFinite(value.min) && value.min >= 0 ? value.min : null;
  const max = typeof value.max === 'number' && Number.isFinite(value.max) && value.max >= 0 ? value.max : null;
  if (min === null || max === null || min > max) return typeof value.raw === 'string' ? formatCatalogPrice(value.raw) : 'unknown';
  if (min === 0 && max === 0) return value.clarity === 'free' || (typeof value.raw === 'string' && value.raw.trim().toLowerCase() === 'free') ? 'free' : 'unknown';
  return min === max ? `$${min}` : `$${min} - $${max}`;
}
