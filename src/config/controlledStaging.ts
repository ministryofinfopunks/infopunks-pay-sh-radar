/** Controlled Track A staging cannot acquire spend, execution or publication authority. */
export const STAGING_DISABLED_FLAGS = [
  'JUDGMENT_PAYMENT_ENABLED', 'MACHINE_EXECUTION_ENABLED', 'MACHINE_DEMO_SEED',
  'ECONOMIC_ENGINE_ENABLED', 'ECONOMIC_ENGINE_AUTHORIZATION_ENABLED', 'ECONOMIC_ENGINE_JEV_ENABLED',
  'MONITOR_ENABLED', 'MONITOR_ALLOW_PAID_ENDPOINTS', 'OPENAI_DECISIONS_SHADOW_ENABLED',
  'EVALUATION_REPUTATION_PROJECTION_ENABLED', 'IPX_PLTR_SHADOW_OBSERVATION_ENABLED',
  'IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED', 'RH_CHAIN_AUTOMATION_ENABLED',
  'RH_4663_PHASE2_ENABLED', 'RH_4663_PHASE3_ENABLED', 'RH_4663_PHASE3_PUBLICATION_ENABLED',
  'RH_4663_AUTO_PUBLICATION_ENABLED', 'RH_4663_EXTERNAL_DISTRIBUTION_ENABLED',
  'RH_4663_CAMPAIGN_REHEARSAL_ENABLED'
] as const;
export const STAGING_ABSENT_BINDINGS = [
  'JUDGMENT_FACILITATOR_URL', 'JUDGMENT_PAY_TO', 'JUDGMENT_RESOURCE_URL',
  'JUDGMENT_SIGNING_PRIVATE_KEY', 'JUDGMENT_ISSUER_KEYS_JSON', 'JUDGMENT_RH_RPC_URL',
  'EXECUTION_PROOF_BASE_RPC_URL', 'ECONOMIC_ENGINE_FACILITATOR_URL',
  'ECONOMIC_ENGINE_SIGNING_PRIVATE_KEY', 'PAY_SH_TRANSLATION_AUTH_TOKEN',
  'PAY_SH_TRANSLATION_PAYMENT_VALUE', 'RH_4663_RESOLUTION_PRIVATE_KEY',
  'RH_4663_ANCHOR_PRIVATE_KEY', 'IPX_LAUNCH_POLICY_PATH', 'IPX_SOLANA_RPC_URL',
  'IPX_SOLANA_WATCH_MANIFEST_PATH', 'OPENAI_API_KEY', 'HERMES_API_KEY',
  'EVALUATION_REVIEWER_TRUST_JSON', 'EXECUTION_AUTHORIZATION_PRIVATE_KEY',
  'EXECUTION_AUTHORIZATION_KEYS_JSON', 'TYPESAFE_API_KEY'
] as const;
export function controlledStagingIssues(env: NodeJS.ProcessEnv): Array<{ variable: string; code: string }> {
  if (env.RADAR_CONTROLLED_STAGING !== 'true') return [];
  return [
    ...STAGING_DISABLED_FLAGS.filter(name => env[name] !== undefined && env[name] !== '' && env[name] !== 'false')
      .map(variable => ({ variable, code: 'controlled_staging_capability_forbidden' })),
    ...STAGING_ABSENT_BINDINGS.filter(name => Boolean(env[name]?.trim()))
      .map(variable => ({ variable, code: 'controlled_staging_binding_forbidden' })),
    ...(env.MONITOR_MODE && env.MONITOR_MODE !== 'disabled' ? [{ variable: 'MONITOR_MODE', code: 'controlled_staging_monitor_forbidden' }] : [])
  ];
}
/** Only the bounded assessment endpoints may append their free idempotency journal. */
export function controlledStagingRequestError(method: string, route: string): string | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null;
  if (method === 'POST' && ['/v1/pre-spend/check', '/v1/decide'].includes(route)) return null;
  return 'controlled_staging_write_disabled';
}

/** PUBLIC-ROUTE-POLICY-01: opt-in availability restriction, never an authority grant.
 * Existing operator/tenant handlers still validate ownership, payment and policy.
 */
export const PUBLIC_READ_API_ROUTES = [
  '/v1/unicorn-radar', '/v1/unicorn-radar/candidates',
  '/v1/unicorn-radar/candidates/:candidateId', '/openapi.json'
] as const;
export const PUBLIC_READ_UI_ROUTES = ['/', '/unicorn-radar', '/unicorn-radar/:candidateId', '/developers'] as const;
export const PUBLIC_READ_OPERATIONAL_ROUTES = ['/healthz', '/readyz', '/version'] as const;
const publicFiles = new Set(['/favicon.svg', '/favicon.ico', '/og-radar.png', '/icon-192.png',
  '/icon-512.png', '/apple-touch-icon.png', '/site.webmanifest', '/artwork/signal-punk.webp']);
export function publicReadTarget(path: string, matchedRoute: string): boolean {
  if (PUBLIC_READ_OPERATIONAL_ROUTES.some(route => path === route)) return true;
  if (path === '/openapi.json' || path === '/v1/unicorn-radar' || path === '/v1/unicorn-radar/candidates') return true;
  if (matchedRoute === '/v1/unicorn-radar/candidates/:candidateId' && /^\/v1\/unicorn-radar\/candidates\/[A-Za-z0-9_-]+$/.test(path)) return true;
  if (['/', '/unicorn-radar', '/developers'].includes(path) || /^\/unicorn-radar\/[A-Za-z0-9_-]+$/.test(path)) return true;
  return publicFiles.has(path) || /^\/assets\/[A-Za-z0-9_-]+\.(?:js|css|woff2?)$/.test(path);
}
export function privateReadTransport(path: string): boolean {
  // Authentication shells contain no tenant records. Their APIs retain all owner guards.
  return /^\/decisions\/[A-Za-z0-9_.:-]{1,200}$/.test(path)
    || /^\/proof\/(?:observation|judgment|execution|evaluation)\/[A-Za-z0-9_.:-]{1,200}$/.test(path)
    || path === '/spend-terminal';
}
export function existingTenantRoute(path: string, method: string): boolean {
  return method === 'POST' && ['/v1/pre-spend/check', '/v1/decide'].includes(path)
    || method === 'GET' && (['/v1/judgment/session', '/v1/judgments/history'].includes(path)
      || /^\/v1\/judgments\/requests\/[A-Za-z0-9_.:-]{1,128}$/.test(path));
}
export function publicReadRequestError(input: {
  method: string; url: string; matchedRoute: string; existingPrivate: boolean;
  operator: boolean; tenant: boolean; requestedMethod?: string; payment: boolean;
}): string | null {
  // Operator access never skips any existing handler or authorization guard.
  if (input.operator) return null;
  const path = input.url.split('?')[0];
  if (input.existingPrivate || existingTenantRoute(path, input.method)) {
    // Delegate original private errors and tenant decisions to the original handlers.
    if (input.existingPrivate || input.tenant || input.method === 'GET') return null;
    return 'public_release_route_unavailable';
  }
  const read = ['GET', 'HEAD'].includes(input.method);
  const preflight = input.method === 'OPTIONS' && ['GET', 'HEAD'].includes(input.requestedMethod ?? '');
  const tenantPreflight = input.method === 'OPTIONS' && existingTenantRoute(path, input.requestedMethod ?? '');
  if (tenantPreflight) return null; // CORS origin/header policy remains authoritative; no handler runs.
  const candidatePreflight = preflight && /^\/v1\/unicorn-radar\/candidates\/[A-Za-z0-9_-]+$/.test(path) && !path.endsWith('/revenue-receipts');
  if (!(read || preflight) || !(publicReadTarget(path, input.matchedRoute) || candidatePreflight || privateReadTransport(path))) return 'public_release_route_unavailable';
  if (input.payment) return 'public_release_payment_forbidden';
  if (input.url.includes('?')) return 'public_release_query_unsupported';
  return null;
}
