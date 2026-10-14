/** Public metadata is separate from private request/receipt payloads. No anonymous proof projection is approved. */
export function judgmentAccessPolicy(path: string, method: string, production: boolean): 'public' | 'owner' | 'operator' {
  if (path.startsWith('/v1/decision-views/')) return 'owner';
  if (path.startsWith('/v1/receipt-spine/')) return /\/(tape|attempts|scores|witness)(?:\/|$)/.test(path) ? 'operator' : 'owner';
  if (['/v1/economics/revenue','/v1/attribution'].includes(path) || path.startsWith('/v1/score/')) return 'operator';
  if (path === '/v1/execute-proof') return 'owner';
  // Legacy wallet selectors are discovery inputs, never authenticated ownership.
  // Keep personal histories/profiles closed in every mode until a reviewed
  // wallet binding or public projection exists.
  if (method === 'GET' && /^(?:\/v1\/4663\/(?:me|proof|pulse\/reputation)(?:\/|$)|\/og\/4663\/proof(?:\/|$)|\/4663\/proof(?:\/|$))/.test(path)) return 'operator';
  if (!production) return 'public';
  const legacyDetail = /^(?:\/v1\/graph(?:\/|$)|\/v1\/checks(?:\/|$)|\/v1\/hermes\/(?:runs|decision-feedback)(?:\/|$))/.test(path) ||
    /^\/v1\/(?:routes\/[:{]|providers\/[:{][^/]+\/intelligence|services\/[:{])/.test(path);
  if (method === 'GET' && (/receipt|receipt-preview|wallet-audit-trail|reputation-ledger/.test(path) || legacyDetail)) return 'operator';
  if (method === 'POST' && (['/v1/receipts','/v1/claims','/v1/validations'].includes(path) || /^\/v1\/claims\/[^/]+\/challenges$/.test(path))) return 'operator';
  return 'public';
}
