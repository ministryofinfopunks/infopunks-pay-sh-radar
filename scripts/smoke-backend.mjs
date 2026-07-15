const baseUrl = (process.env.BACKEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_BACKEND_TIMEOUT_MS ?? '5000', 10) || 5000;

const checks = [
  { path: '/health', expect: (json) => json.ok === true },
  { path: '/version', expect: (json) => json.service === 'infopunks-pay-sh-radar' && typeof json.version === 'string' },
  { path: '/v1/pulse', expect: (json) => typeof json.data?.providerCount === 'number' },
  { path: '/v1/providers', expect: (json) => Array.isArray(json.data) },
  { path: '/v1/signal-hunt', expect: (json) => Array.isArray(json.data?.candidates) && typeof json.data?.counts?.total === 'number' },
  { path: '/v1/signal-hunt/hunt_black_bull_coordination', expect: (json) => json.data?.id === 'hunt_black_bull_coordination' },
  { path: '/v1/graph', expect: (json) => Array.isArray(json.data?.nodes) && Array.isArray(json.data?.edges) },
  { path: '/v1/graph/ripples', expect: (json) => Array.isArray(json.data?.ripples) },
  { path: '/v1/rh-chain', expect: (json) => json.data?.title === 'RH Chain Signal Desk' },
  { path: '/v1/rh-chain/daily-receipts', expect: (json) => Array.isArray(json.data?.receipts) },
  { path: '/v1/rh-chain/review-queue', expect: (json) => Array.isArray(json.data?.items) },
  { path: '/v1/rh-chain/clone-radar', expect: (json) => typeof json.data?.title === 'string' },
  { path: '/v1/rh-chain/scouts', expect: (json) => Array.isArray(json.data?.scouts) },
  { path: '/v1/rh-chain/distribution-pack', expect: (json) => typeof json.data?.title === 'string' }
];

function formatResult({ method, path, status, elapsedMs, reason }) {
  const parts = [`method=${method}`, `path=${path}`];
  if (typeof status === 'number') parts.push(`status=${status}`);
  if (typeof elapsedMs === 'number') parts.push(`elapsed=${elapsedMs}ms`);
  if (reason) parts.push(`reason=${reason}`);
  return parts.join(' ');
}

async function fetchWithTimeout(url, init, method, path) {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    throw new Error(formatResult({
      method,
      path,
      elapsedMs: Date.now() - startedAt,
      reason: timedOut ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : error instanceof Error ? error.message : String(error)
    }));
  } finally {
    clearTimeout(timeout);
  }
}

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const { response, elapsedMs } = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, 'GET', check.path);
  if (!response.ok) {
    throw new Error(formatResult({ method: 'GET', path: check.path, status: response.status, elapsedMs, reason: 'expected 2xx' }));
  }
  const json = await response.json();
  if (!check.expect(json)) {
    throw new Error(formatResult({ method: 'GET', path: check.path, status: response.status, elapsedMs, reason: 'unexpected payload' }));
  }
  console.log(JSON.stringify({ check: check.path, method: 'GET', status: response.status, elapsedMs, ok: true }));
}

console.log(JSON.stringify({ smoke: 'backend', baseUrl, ok: true }));

const graphCheckUrl = `${baseUrl}/v1/graph/check`;
const { response: graphCheckResponse, elapsedMs: graphCheckElapsedMs } = await fetchWithTimeout(graphCheckUrl, {
  method: 'POST',
  headers: { accept: 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify({ label: 'Smoke graph check', summary: 'Receipt-backed memory should outrank feed scrolling.' })
}, 'POST', '/v1/graph/check');
if (!graphCheckResponse.ok) {
  throw new Error(formatResult({ method: 'POST', path: '/v1/graph/check', status: graphCheckResponse.status, elapsedMs: graphCheckElapsedMs, reason: 'expected 2xx' }));
}
const graphCheckJson = await graphCheckResponse.json();
if (!graphCheckJson.data?.generated_node_preview?.id) {
  throw new Error(formatResult({ method: 'POST', path: '/v1/graph/check', status: graphCheckResponse.status, elapsedMs: graphCheckElapsedMs, reason: 'unexpected payload' }));
}
console.log(JSON.stringify({ check: '/v1/graph/check', method: 'POST', status: graphCheckResponse.status, elapsedMs: graphCheckElapsedMs, ok: true }));
