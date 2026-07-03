import { createPreSpendSeedState } from '../src/repositories/preSpendSeedData';
import { createInMemoryLoopRepository } from '../src/repositories/loopRepository';
import { pathToFileURL } from 'node:url';
import { listSignalHuntCandidates } from '../src/data/signalHunt';

export const DEFAULT_BASE_URL = 'https://radar.infopunks.fun';
export const PRE_SPEND_CHECK_PAYLOAD = {
  agent_id: 'agent_001',
  intent: 'buy_market_research',
  budget: 25,
  risk_tolerance: 'low',
  preferred_settlement: 'stablecoin',
  required_confidence: 75
} as const;

export const ATTENTION_MARKET_INTAKE_PAYLOAD = {
  ticker: 'SAFE',
  name: 'Safe Persona Object',
  chain: 'Solana',
  attention_source_type: 'influencer',
  attention_source_label: 'Smoke test observer',
  submitter_handle: '@smoke',
  why_it_matters: 'This attention-market object needs evidence review before any watch-profile promotion.',
  evidence_links: ['/narratives/attention-market-watch']
} as const;

export type SmokePlan = {
  publicPaths: string[];
  publicHeadPaths: string[];
  apiGetPaths: string[];
  apiHeadJsonPaths: string[];
  pngPaths: string[];
  claimsApiPaths: string[];
  preSpendPath: string;
  attentionMarketIntakePath: string;
  attentionMarketIntakeRequirementsPath: string;
  graphCheckPath: string;
  livePulsePath: string;
};

export type SmokeConfig = {
  publicPageTimeoutMs: number;
  apiTimeoutMs: number;
  publicPageRetryAttempts: number;
  publicPageRetryDelayMs: number;
};

export const DEFAULT_PUBLIC_PAGE_TIMEOUT_MS = 15_000;
export const DEFAULT_API_TIMEOUT_MS = 5_000;
export const DEFAULT_PUBLIC_PAGE_RETRY_ATTEMPTS = 3;
export const DEFAULT_PUBLIC_PAGE_RETRY_DELAY_MS = 1_000;
const SIGNAL_HUNT_LIST_PATH = '/v1/signal-hunt';
const SIGNAL_HUNT_DETAIL_OPENAPI_PATH = '/v1/signal-hunt/{signalId}';

export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveSmokeConfig(env: NodeJS.ProcessEnv = process.env): SmokeConfig {
  return {
    publicPageTimeoutMs: parsePositiveInteger(env.SMOKE_PUBLIC_PAGE_TIMEOUT_MS, DEFAULT_PUBLIC_PAGE_TIMEOUT_MS),
    apiTimeoutMs: parsePositiveInteger(env.SMOKE_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS),
    publicPageRetryAttempts: parsePositiveInteger(env.SMOKE_PUBLIC_PAGE_RETRY_ATTEMPTS, DEFAULT_PUBLIC_PAGE_RETRY_ATTEMPTS),
    publicPageRetryDelayMs: parsePositiveInteger(env.SMOKE_PUBLIC_PAGE_RETRY_DELAY_MS, DEFAULT_PUBLIC_PAGE_RETRY_DELAY_MS)
  };
}

export function buildSmokePlan(): SmokePlan {
  const seed = createPreSpendSeedState();
  const routeId = seed.routes[0]?.route_id ?? 'route_pay_sh_market_research_01';
  const providerId = seed.providers[0]?.provider_id ?? 'provider_pay_sh_lattice';
  const serviceId = seed.services[0]?.service_id ?? 'service_market_research';
  const receiptId = seed.receipts[0]?.receipt_id ?? 'receipt_001';
  const claimId = seed.claims[0]?.claim_id ?? 'claim_001';
  const loopId = createInMemoryLoopRepository().listLoops()[0]?.id ?? 'loop_pre_spend_route';
  const signalHuntId = listSignalHuntCandidates()[0]?.id ?? 'hunt_black_bull_coordination';

  return {
    publicPaths: [
      '/',
      '/developers',
      '/spend-terminal',
      '/routes',
      '/providers',
      '/services',
      '/receipts',
      '/claim',
      '/loops',
      '/signal-hunt',
      '/graph',
      '/narratives',
      '/narratives/attention-markets',
      '/narratives/attention-market-watch',
      '/abundance',
      '/narratives/abundance-desk',
      '/hermes',
      '/narratives/hermes-desk',
      '/attention-market-watch',
      '/attention-market-watch/ansem',
      '/signals/ansem',
      '/signals/black-bull',
      '/signals/troll',
      '/openapi.json',
      `/routes/${encodeURIComponent(routeId)}`,
      `/providers/${encodeURIComponent(providerId)}`,
      `/services/${encodeURIComponent(serviceId)}`,
      `/receipts/${encodeURIComponent(receiptId)}`,
      `/claims/${encodeURIComponent(claimId)}`,
      `/loops/${encodeURIComponent(loopId)}`,
      `/signal-hunt/${encodeURIComponent(signalHuntId)}`,
      '/radar/cards',
      '/radar/cards/provider/coingecko-onchain',
      '/radar/cards/route/sol-price',
      '/radar/cards/benchmark/web-search',
      '/machine-market/cards/cloud-translation'
    ],
    publicHeadPaths: [
      '/radar/cards',
      '/radar/cards/provider/coingecko-onchain',
      '/radar/cards/route/sol-price',
      '/radar/cards/benchmark/web-search',
      '/machine-market/cards/cloud-translation'
    ],
    apiGetPaths: [
      '/v1/graph',
      '/v1/graph/ripples',
      '/v1/loops',
      '/v1/signal-hunt',
      '/v1/routes',
      '/v1/narratives',
      '/v1/abundance',
      '/v1/abundance/claims',
      '/v1/abundance/receipts',
      '/v1/hermes',
      '/v1/hermes/runs',
      '/v1/hermes/health',
      '/v1/attention-market-watch',
      '/v1/attention-market-watch/ansem',
      '/v1/attention-market-watch/intake/requirements',
      '/v1/signal-desk',
      '/v1/signal-desk/candidates',
      '/v1/signal-desk/candidates/candidate_sol_persona_attention',
      `/v1/signal-hunt/${encodeURIComponent(signalHuntId)}`,
      '/v1/narratives/black-bull',
      '/v1/signals',
      '/v1/signals/black-bull',
      '/v1/signals/black-bull/updates',
      '/v1/signals/troll',
      '/v1/signals/troll/updates',
      '/v1/pre-spend/providers',
      '/v1/services',
      '/v1/receipts',
      '/v1/claims',
      '/openapi.json'
    ],
    apiHeadJsonPaths: [
      '/openapi.json',
      '/v1/loops',
      '/v1/checks'
    ],
    pngPaths: [
      '/og/narratives.png',
      '/og/attention-market-watch.png',
      '/og/attention-market-watch/ansem.png',
      '/og/signals/black-bull.png',
      '/og/signals/black-bull/updates/seu_black_bull_007.png',
      '/og/signals/troll.png',
      '/og/signals/troll/updates/seu_troll_002.png'
    ],
    claimsApiPaths: [
      '/v1/claims',
      `/v1/claims/${encodeURIComponent(claimId)}`,
      `/v1/claims/${encodeURIComponent(claimId)}/challenges`
    ],
    preSpendPath: '/v1/pre-spend/check',
    attentionMarketIntakePath: '/v1/attention-market-watch/intake',
    attentionMarketIntakeRequirementsPath: '/v1/attention-market-watch/intake/requirements',
    graphCheckPath: '/v1/graph/check',
    livePulsePath: '/v1/pulse'
  };
}

function pass(label: string, elapsedMs?: number): void {
  console.log(`PASS ${label}${typeof elapsedMs === 'number' ? ` - elapsed=${elapsedMs}ms` : ''}`);
}

function fail(label: string, detail: string): void {
  console.error(`FAIL ${label} - ${detail}`);
}

function warn(label: string, detail: string): void {
  console.warn(`WARN ${label} - ${detail}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TimedFetchResult = {
  response: Response;
  elapsedMs: number;
};

type RequestFailureDetail = {
  method: string;
  path: string;
  elapsedMs?: number;
  status?: number;
  reason: string;
};

class SmokeRequestError extends Error {
  readonly detail: RequestFailureDetail;

  constructor(detail: RequestFailureDetail) {
    super(formatFailureDetail(detail));
    this.name = 'SmokeRequestError';
    this.detail = detail;
  }
}

function formatFailureDetail(detail: RequestFailureDetail): string {
  const parts = [`method=${detail.method}`, `path=${detail.path}`];
  if (typeof detail.status === 'number') parts.push(`status=${detail.status}`);
  parts.push(`reason=${detail.reason}`);
  if (typeof detail.elapsedMs === 'number') parts.push(`elapsed=${detail.elapsedMs}ms`);
  return parts.join(' ');
}

function toFailureDetail(method: string, path: string, error: unknown): string {
  if (error instanceof SmokeRequestError) return formatFailureDetail(error.detail);
  return formatFailureDetail({
    method,
    path,
    reason: error instanceof Error ? error.message : String(error)
  });
}

async function timedFetch(input: string, init: RequestInit | undefined, timeoutMs: number, method: string, path: string): Promise<TimedFetchResult> {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal
    });
    return {
      response,
      elapsedMs: Date.now() - startedAt
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const reason = timedOut
      ? `timeout after ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : String(error);
    throw new SmokeRequestError({
      method,
      path,
      elapsedMs,
      reason
    });
  } finally {
    clearTimeout(timeout);
  }
}

type FetchWithRetryOptions = {
  input: string;
  method: string;
  path: string;
  init?: RequestInit;
  timeoutMs: number;
  retryAttempts?: number;
  retryDelayMs?: number;
};

async function fetchWithRetry(options: FetchWithRetryOptions): Promise<TimedFetchResult> {
  const {
    input,
    method,
    path,
    init,
    timeoutMs,
    retryAttempts = 1,
    retryDelayMs = 0
  } = options;

  let lastError: SmokeRequestError | null = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      return await timedFetch(input, init, timeoutMs, method, path);
    } catch (error) {
      lastError = error instanceof SmokeRequestError
        ? error
        : new SmokeRequestError({
            method,
            path,
            reason: error instanceof Error ? error.message : String(error)
          });
      if (attempt < retryAttempts) {
        warn(`${method} ${path}`, `attempt ${attempt}/${retryAttempts} failed (${formatFailureDetail(lastError.detail)}); retrying in ${retryDelayMs}ms`);
        await sleep(retryDelayMs);
      }
    }
  }

  if (lastError && method === 'GET' && path === '/v1/pulse' && lastError.detail.reason.startsWith('timeout after ')) {
    throw new SmokeRequestError({
      ...lastError.detail,
      reason: `${lastError.detail.reason}; backend route may be waiting on live bootstrap or upstream catalog`
    });
  }

  throw lastError ?? new SmokeRequestError({ method, path, reason: 'unknown fetch failure' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDataEnvelope(value: unknown): value is { data: unknown } {
  return isRecord(value) && 'data' in value;
}

function isSignalHuntShellPath(path: string): boolean {
  return path === '/signal-hunt' || path.startsWith('/signal-hunt/');
}

function formatPublicPagePassLabel(path: string): string {
  return isSignalHuntShellPath(path) ? `GET ${path} (shell route)` : `GET ${path}`;
}

async function checkPublicPage(baseUrl: string, path: string, config: SmokeConfig): Promise<number> {
  const { response, elapsedMs } = await fetchWithRetry({
    input: `${baseUrl}${path}`,
    method: 'GET',
    path,
    timeoutMs: config.publicPageTimeoutMs,
    retryAttempts: config.publicPageRetryAttempts,
    retryDelayMs: config.publicPageRetryDelayMs,
    init: {
      headers: { accept: path === '/openapi.json' ? 'application/json' : 'text/html,application/xhtml+xml' }
    }
  });

  if (response.status !== 200) {
    throw new SmokeRequestError({
      method: 'GET',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected 200'
    });
  }

  return elapsedMs;
}

async function checkPublicHead(baseUrl: string, path: string, config: SmokeConfig): Promise<number> {
  const { response, elapsedMs } = await fetchWithRetry({
    input: `${baseUrl}${path}`,
    method: 'HEAD',
    path,
    timeoutMs: config.publicPageTimeoutMs,
    retryAttempts: config.publicPageRetryAttempts,
    retryDelayMs: config.publicPageRetryDelayMs,
    init: {
      method: 'HEAD',
      headers: { accept: 'text/html,application/xhtml+xml' }
    }
  });

  if (response.status !== 200) {
    throw new SmokeRequestError({
      method: 'HEAD',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected 200'
    });
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('text/html')) {
    throw new SmokeRequestError({
      method: 'HEAD',
      path,
      status: response.status,
      elapsedMs,
      reason: `expected text/html content-type, got ${contentType || 'missing'}`
    });
  }

  return elapsedMs;
}

async function checkJsonGet(baseUrl: string, path: string, timeoutMs: number): Promise<{ body: unknown; elapsedMs: number }> {
  const { response, elapsedMs } = await fetchWithRetry({
    input: `${baseUrl}${path}`,
    method: 'GET',
    path,
    timeoutMs,
    init: {
      headers: { accept: 'application/json' }
    }
  });

  if (!response.ok) {
    throw new SmokeRequestError({
      method: 'GET',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected 2xx'
    });
  }

  const body = await parseJsonOrThrow('GET', path, response, elapsedMs);
  if (!isRecord(body)) {
    throw new SmokeRequestError({
      method: 'GET',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected JSON object response'
    });
  }
  return { body, elapsedMs };
}

async function checkJsonHead(baseUrl: string, path: string, timeoutMs: number): Promise<number> {
  const { response, elapsedMs } = await fetchWithRetry({
    input: `${baseUrl}${path}`,
    method: 'HEAD',
    path,
    timeoutMs,
    init: {
      method: 'HEAD',
      headers: { accept: 'application/json' }
    }
  });

  if (!response.ok) {
    throw new SmokeRequestError({
      method: 'HEAD',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected 2xx'
    });
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new SmokeRequestError({
      method: 'HEAD',
      path,
      status: response.status,
      elapsedMs,
      reason: `expected application/json content-type, got ${contentType || 'missing'}`
    });
  }

  return elapsedMs;
}

async function checkPngGet(baseUrl: string, path: string, timeoutMs: number): Promise<number> {
  const { response, elapsedMs } = await fetchWithRetry({
    input: `${baseUrl}${path}`,
    method: 'GET',
    path,
    timeoutMs,
    init: {
      headers: { accept: 'image/png' }
    }
  });

  if (response.status !== 200) {
    throw new SmokeRequestError({
      method: 'GET',
      path,
      status: response.status,
      elapsedMs,
      reason: 'expected 200'
    });
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('image/png')) {
    throw new SmokeRequestError({
      method: 'GET',
      path,
      status: response.status,
      elapsedMs,
      reason: `expected image/png content-type, got ${contentType || 'missing'}`
    });
  }

  return elapsedMs;
}

async function parseExpectedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const text = await response.text();
  const trimmed = text.trimStart();

  if (contentType.includes('text/html') || trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
    throw new Error('Expected JSON but received HTML. The frontend SPA fallback may be swallowing this API route.');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`expected JSON response, parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function parseJsonOrThrow(method: string, path: string, response: Response, elapsedMs: number): Promise<unknown> {
  try {
    return await parseExpectedJson(response);
  } catch (error) {
    throw new SmokeRequestError({
      method,
      path,
      status: response.status,
      elapsedMs,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

function assertPreSpendResponse(body: unknown): void {
  if (!hasDataEnvelope(body) || !isRecord(body.data)) {
    throw new Error('missing data payload');
  }

  const data = body.data;
  const requiredFields = ['decision', 'confidence_score', 'risk_level', 'receipt_references'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`missing data.${field}`);
    }
  }

  if (!Array.isArray(data.receipt_references)) {
    throw new Error('data.receipt_references is not an array');
  }
}

function assertClaimsList(body: unknown): void {
  if (!hasDataEnvelope(body) || !isRecord(body.data) || !Array.isArray(body.data.claims)) {
    throw new Error('missing data.claims payload');
  }
}

function assertClaimDetail(body: unknown, claimId: string): void {
  if (!hasDataEnvelope(body) || !isRecord(body.data)) {
    throw new Error('missing claim data payload');
  }
  if (body.data.claim_id !== claimId) {
    throw new Error(`expected claim_id=${claimId}, got ${String(body.data.claim_id)}`);
  }
}

function assertChallenges(body: unknown): void {
  if (!hasDataEnvelope(body) || !isRecord(body.data) || !Array.isArray(body.data.challenges)) {
    throw new Error('missing data.challenges payload');
  }
}

export function assertSignalHuntDeployment(
  openapiBody: unknown,
  signalHuntListBody: unknown,
  signalHuntDetailBody: unknown,
  expectedSignalId: string,
  expectedTitle: string
): void {
  const openapiPaths = isRecord(openapiBody) && isRecord(openapiBody.paths)
    ? openapiBody.paths
    : null;
  if (!openapiPaths || !(SIGNAL_HUNT_LIST_PATH in openapiPaths) || !(SIGNAL_HUNT_DETAIL_OPENAPI_PATH in openapiPaths)) {
    throw new Error('Signal Hunt OpenAPI paths missing');
  }

  if (!hasDataEnvelope(signalHuntListBody) || !isRecord(signalHuntListBody.data)) {
    throw new Error('Signal Hunt API missing from production deployment');
  }

  const listCandidates = Array.isArray(signalHuntListBody.data.candidates) ? signalHuntListBody.data.candidates : null;
  if (!listCandidates) {
    throw new Error('Signal Hunt API missing from production deployment');
  }

  const matchedCandidate = listCandidates.find((candidate) => isRecord(candidate) && candidate.id === expectedSignalId);
  if (!matchedCandidate) {
    throw new Error(`Signal Hunt seeded candidate missing: ${expectedSignalId}`);
  }

  if (!hasDataEnvelope(signalHuntDetailBody) || !isRecord(signalHuntDetailBody.data)) {
    throw new Error('Signal Hunt detail API missing from production deployment');
  }

  if (signalHuntDetailBody.data.id !== expectedSignalId) {
    throw new Error(`Signal Hunt detail mismatch: expected id=${expectedSignalId}, got ${String(signalHuntDetailBody.data.id)}`);
  }

  if (signalHuntDetailBody.data.title !== expectedTitle) {
    throw new Error(`Signal Hunt detail mismatch: expected title=${expectedTitle}, got ${String(signalHuntDetailBody.data.title)}`);
  }
}

function assertLivePulse(body: unknown): { fixtureFallback: boolean; summary: string } {
  if (!hasDataEnvelope(body) || !isRecord(body.data)) {
    throw new Error('missing pulse data payload');
  }

  const data = body.data;
  if (typeof data.providerCount !== 'number') throw new Error('missing data.providerCount');
  if (typeof data.endpointCount !== 'number') throw new Error('missing data.endpointCount');
  if (!isRecord(data.data_source)) throw new Error('missing data.data_source');

  const source = data.data_source;
  if (typeof source.used_fixture !== 'boolean') throw new Error('missing data.data_source.used_fixture');
  if (!('catalog_status' in data) || typeof data.catalog_status !== 'string') throw new Error('missing data.catalog_status');

  const sourceMode = typeof source.mode === 'string' ? source.mode : 'unknown';
  const error = typeof source.error === 'string' ? source.error : 'none';
  const summary = `catalog_status=${String(data.catalog_status)} source_mode=${sourceMode} used_fixture=${String(source.used_fixture)} providers=${data.providerCount} endpoints=${data.endpointCount} error=${error}`;

  return {
    fixtureFallback: source.used_fixture,
    summary
  };
}

export async function runSmoke(baseUrl = resolveBaseUrl(), config = resolveSmokeConfig()): Promise<boolean> {
  const plan = buildSmokePlan();
  let failed = false;
  const apiBodies = new Map<string, unknown>();
  const seededSignal = listSignalHuntCandidates()[0];
  const signalHuntId = seededSignal?.id ?? 'hunt_black_bull_coordination';
  const signalHuntTitle = seededSignal?.title ?? 'Black Bull Coordination'
  const signalHuntDetailPath = `${SIGNAL_HUNT_LIST_PATH}/${encodeURIComponent(signalHuntId)}`;

  for (const path of plan.publicPaths) {
    try {
      const elapsedMs = await checkPublicPage(baseUrl, path, config);
      pass(formatPublicPagePassLabel(path), elapsedMs);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, toFailureDetail('GET', path, error));
    }
  }

  for (const path of plan.publicHeadPaths) {
    try {
      const elapsedMs = await checkPublicHead(baseUrl, path, config);
      pass(`HEAD ${path}`, elapsedMs);
    } catch (error) {
      failed = true;
      fail(`HEAD ${path}`, toFailureDetail('HEAD', path, error));
    }
  }

  for (const path of plan.apiGetPaths) {
    try {
      const { body, elapsedMs } = await checkJsonGet(baseUrl, path, config.apiTimeoutMs);
      if (path !== '/openapi.json' && !hasDataEnvelope(body)) {
        throw new Error('missing data payload');
      }
      apiBodies.set(path, body);
      pass(`GET ${path}`, elapsedMs);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, toFailureDetail('GET', path, error));
    }
  }

  try {
    assertSignalHuntDeployment(
      apiBodies.get('/openapi.json'),
      apiBodies.get(SIGNAL_HUNT_LIST_PATH),
      apiBodies.get(signalHuntDetailPath),
      signalHuntId,
      signalHuntTitle
    );
    pass('Signal Hunt deployment proof');
  } catch (error) {
    failed = true;
    fail('Signal Hunt deployment proof', error instanceof Error ? error.message : String(error));
  }

  for (const path of plan.apiHeadJsonPaths) {
    try {
      const elapsedMs = await checkJsonHead(baseUrl, path, config.apiTimeoutMs);
      pass(`HEAD ${path}`, elapsedMs);
    } catch (error) {
      failed = true;
      fail(`HEAD ${path}`, toFailureDetail('HEAD', path, error));
    }
  }

  for (const path of plan.pngPaths) {
    try {
      const elapsedMs = await checkPngGet(baseUrl, path, config.apiTimeoutMs);
      pass(`GET ${path}`, elapsedMs);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, toFailureDetail('GET', path, error));
    }
  }

  try {
    const { body, elapsedMs } = await checkJsonGet(baseUrl, plan.livePulsePath, config.apiTimeoutMs);
    const result = assertLivePulse(body);
    if (result.fixtureFallback) warn(`GET ${plan.livePulsePath}`, `backend healthy; upstream catalog fallback active (${result.summary})`);
    else pass(`GET ${plan.livePulsePath}`, elapsedMs);
  } catch (error) {
    failed = true;
    fail(`GET ${plan.livePulsePath}`, toFailureDetail('GET', plan.livePulsePath, error));
  }

  try {
    const { response, elapsedMs } = await fetchWithRetry({
      input: `${baseUrl}${plan.preSpendPath}`,
      method: 'POST',
      path: plan.preSpendPath,
      timeoutMs: config.apiTimeoutMs,
      init: {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(PRE_SPEND_CHECK_PAYLOAD)
      }
    });

    if (!response.ok) {
      throw new SmokeRequestError({
        method: 'POST',
        path: plan.preSpendPath,
        status: response.status,
        elapsedMs,
        reason: 'expected 2xx'
      });
    }

    const body = await parseJsonOrThrow('POST', plan.preSpendPath, response, elapsedMs);
    assertPreSpendResponse(body);
    pass(`POST ${plan.preSpendPath}`, elapsedMs);
  } catch (error) {
    failed = true;
    fail(`POST ${plan.preSpendPath}`, toFailureDetail('POST', plan.preSpendPath, error));
  }

  try {
    const { response, elapsedMs } = await fetchWithRetry({
      input: `${baseUrl}${plan.attentionMarketIntakePath}`,
      method: 'POST',
      path: plan.attentionMarketIntakePath,
      timeoutMs: config.apiTimeoutMs,
      init: {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(ATTENTION_MARKET_INTAKE_PAYLOAD)
      }
    });

    if (!response.ok) {
      throw new SmokeRequestError({
        method: 'POST',
        path: plan.attentionMarketIntakePath,
        status: response.status,
        elapsedMs,
        reason: 'expected 2xx'
      });
    }

    const body = await parseJsonOrThrow('POST', plan.attentionMarketIntakePath, response, elapsedMs);
    if (!hasDataEnvelope(body) || !isRecord(body.data) || !isRecord(body.data.submission)) {
      throw new Error('missing attention market intake submission payload');
    }
    pass(`POST ${plan.attentionMarketIntakePath}`, elapsedMs);
  } catch (error) {
    failed = true;
    fail(`POST ${plan.attentionMarketIntakePath}`, toFailureDetail('POST', plan.attentionMarketIntakePath, error));
  }

  try {
    const { response, elapsedMs } = await fetchWithRetry({
      input: `${baseUrl}${plan.graphCheckPath}`,
      method: 'POST',
      path: plan.graphCheckPath,
      timeoutMs: config.apiTimeoutMs,
      init: {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          label: 'Smoke graph check',
          summary: 'Receipt-backed memory should outrank feed scrolling.'
        })
      }
    });

    if (!response.ok) {
      throw new SmokeRequestError({
        method: 'POST',
        path: plan.graphCheckPath,
        status: response.status,
        elapsedMs,
        reason: 'expected 2xx'
      });
    }

    const body = await parseJsonOrThrow('POST', plan.graphCheckPath, response, elapsedMs);
    if (!hasDataEnvelope(body) || !isRecord(body.data) || !isRecord(body.data.generated_node_preview)) {
      throw new Error('missing graph check preview payload');
    }
    pass(`POST ${plan.graphCheckPath}`, elapsedMs);
  } catch (error) {
    failed = true;
    fail(`POST ${plan.graphCheckPath}`, toFailureDetail('POST', plan.graphCheckPath, error));
  }

  const claimId = createPreSpendSeedState().claims[0]?.claim_id ?? 'claim_001';

  for (const path of plan.claimsApiPaths) {
    try {
      const { body, elapsedMs } = await checkJsonGet(baseUrl, path, config.apiTimeoutMs);
      if (path === '/v1/claims') {
        assertClaimsList(body);
      } else if (path.endsWith('/challenges')) {
        assertChallenges(body);
      } else {
        assertClaimDetail(body, claimId);
      }
      pass(`GET ${path}`, elapsedMs);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, toFailureDetail('GET', path, error));
    }
  }

  return !failed;
}

const executedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (executedPath === import.meta.url) {
  runSmoke()
    .then((ok) => {
      if (ok) {
        console.log('Production smoke passed.');
        process.exit(0);
      }

      console.error('Production smoke failed.');
      process.exit(1);
    })
    .catch((error) => {
      fail('smoke', error instanceof Error ? error.message : String(error));
      console.error('Production smoke failed.');
      process.exit(1);
    });
}
