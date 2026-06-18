import { createPreSpendSeedState } from '../src/repositories/preSpendSeedData';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://radar.infopunks.fun';
export const PRE_SPEND_CHECK_PAYLOAD = {
  agent_id: 'agent_001',
  intent: 'buy_market_research',
  budget: 25,
  risk_tolerance: 'low',
  preferred_settlement: 'stablecoin',
  required_confidence: 75
} as const;

export type SmokePlan = {
  publicPaths: string[];
  apiGetPaths: string[];
  claimsApiPaths: string[];
  preSpendPath: string;
};

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function buildSmokePlan(): SmokePlan {
  const seed = createPreSpendSeedState();
  const routeId = seed.routes[0]?.route_id ?? 'route_pay_sh_market_research_01';
  const providerId = seed.providers[0]?.provider_id ?? 'provider_pay_sh_lattice';
  const serviceId = seed.services[0]?.service_id ?? 'service_market_research';
  const receiptId = seed.receipts[0]?.receipt_id ?? 'receipt_001';
  const claimId = seed.claims[0]?.claim_id ?? 'claim_001';

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
      '/openapi.json',
      `/routes/${encodeURIComponent(routeId)}`,
      `/providers/${encodeURIComponent(providerId)}`,
      `/services/${encodeURIComponent(serviceId)}`,
      `/receipts/${encodeURIComponent(receiptId)}`,
      `/claims/${encodeURIComponent(claimId)}`
    ],
    apiGetPaths: [
      '/v1/routes',
      '/v1/pre-spend/providers',
      '/v1/services',
      '/v1/receipts',
      '/v1/claims',
      '/openapi.json'
    ],
    claimsApiPaths: [
      '/v1/claims',
      `/v1/claims/${encodeURIComponent(claimId)}`,
      `/v1/claims/${encodeURIComponent(claimId)}/challenges`
    ],
    preSpendPath: '/v1/pre-spend/check'
  };
}

function pass(label: string): void {
  console.log(`PASS ${label}`);
}

function fail(label: string, detail: string): void {
  console.error(`FAIL ${label} - ${detail}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(lastError?.message ?? 'unknown fetch failure');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDataEnvelope(value: unknown): value is { data: unknown } {
  return isRecord(value) && 'data' in value;
}

async function checkPublicPage(baseUrl: string, path: string): Promise<void> {
  const response = await fetchWithRetry(`${baseUrl}${path}`, {
    headers: { accept: path === '/openapi.json' ? 'application/json' : 'text/html,application/xhtml+xml' }
  });

  if (response.status !== 200) {
    throw new Error(`expected 200, got ${response.status}`);
  }
}

async function checkJsonGet(baseUrl: string, path: string): Promise<unknown> {
  const response = await fetchWithRetry(`${baseUrl}${path}`, {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`expected 2xx, got ${response.status}`);
  }

  const body = await parseExpectedJson(response);
  if (!isRecord(body)) {
    throw new Error('expected JSON object response');
  }
  return body;
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

export async function runSmoke(baseUrl = resolveBaseUrl()): Promise<boolean> {
  const plan = buildSmokePlan();
  let failed = false;

  for (const path of plan.publicPaths) {
    try {
      await checkPublicPage(baseUrl, path);
      pass(path);
    } catch (error) {
      failed = true;
      fail(path, error instanceof Error ? error.message : String(error));
    }
  }

  for (const path of plan.apiGetPaths) {
    try {
      const body = await checkJsonGet(baseUrl, path);
      if (path !== '/openapi.json' && !hasDataEnvelope(body)) {
        throw new Error('missing data payload');
      }
      pass(`GET ${path}`);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const response = await fetchWithRetry(`${baseUrl}${plan.preSpendPath}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(PRE_SPEND_CHECK_PAYLOAD)
    });

    if (!response.ok) {
      throw new Error(`expected 2xx, got ${response.status}`);
    }

    const body = await parseExpectedJson(response);
    assertPreSpendResponse(body);
    pass(`POST ${plan.preSpendPath}`);
  } catch (error) {
    failed = true;
    fail(`POST ${plan.preSpendPath}`, error instanceof Error ? error.message : String(error));
  }

  const claimId = createPreSpendSeedState().claims[0]?.claim_id ?? 'claim_001';

  for (const path of plan.claimsApiPaths) {
    try {
      const body = await checkJsonGet(baseUrl, path);
      if (path === '/v1/claims') {
        assertClaimsList(body);
      } else if (path.endsWith('/challenges')) {
        assertChallenges(body);
      } else {
        assertClaimDetail(body, claimId);
      }
      pass(`GET ${path}`);
    } catch (error) {
      failed = true;
      fail(`GET ${path}`, error instanceof Error ? error.message : String(error));
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
