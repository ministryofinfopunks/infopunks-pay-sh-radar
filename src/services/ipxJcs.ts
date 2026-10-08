import { createHash } from 'node:crypto';
/** RFC 8785 JSON values: ES number formatting, UTF-16 lexical keys, no normalization. */
export function ipxJcs(value: unknown): string {
  const parents = new Set<object>();
  function text(value: string) {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('invalid_unicode'); }
      else if (code >= 0xdc00 && code <= 0xdfff) throw new Error('invalid_unicode');
    }
    return JSON.stringify(value);
  }
  function encode(item: unknown): string {
    if (typeof item === 'string') return text(item);
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (!item || typeof item !== 'object' || parents.has(item)) throw new Error('invalid_jcs_value');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error('invalid_jcs_value');
    parents.add(item);
    try {
      return Array.isArray(item) ? '[' + Array.from(item, encode).join(',') + ']'
        : '{' + Object.keys(item).sort().map(key => text(key) + ':' + encode((item as Record<string, unknown>)[key])).join(',') + '}';
    } finally { parents.delete(item); }
  }
  return encode(value);
}
export const ipxSha256 = (value: unknown) => `0x${createHash('sha256').update(ipxJcs(value)).digest('hex')}` as `0x${string}`;
