/**
 * Read-only local/staging load profile. It never issues a mutation and is
 * intentionally opt-in for private overlays.
 *
 * BASE_URL=http://127.0.0.1:8787 REQUESTS=100 CONCURRENCY=10 npm run load:4663
 */
const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const total = positiveInt('REQUESTS', 100);
const concurrency = Math.min(positiveInt('CONCURRENCY', 10), total);
const profiles = (process.env.PROFILES ?? 'frontdoor,etag,landing,og,pulse').split(',').map((item) => item.trim()).filter(Boolean);
const paths = {
  frontdoor: process.env.FRONTDOOR_PATH ?? '/v1/4663/frontdoor',
  etag: process.env.FRONTDOOR_PATH ?? '/v1/4663/frontdoor',
  landing: process.env.LANDING_PATH ?? '/4663',
  og: process.env.OG_PATH ?? '/og/4663/prints/rh-print-2026-08-30.png',
  pulse: process.env.PULSE_PATH ?? '/v1/4663/pulse',
  private: process.env.PRIVATE_PATH ?? '/v1/4663/me/call'
};

for (const profile of profiles) {
  if (!(profile in paths)) throw new Error(`Unknown read-only profile: ${profile}`);
  if (profile === 'private' && process.env.INCLUDE_PRIVATE !== '1') {
    console.log(JSON.stringify({ profile, skipped: 'Set INCLUDE_PRIVATE=1 to exercise a private no-store overlay.' }));
    continue;
  }
  const etag = profile === 'etag' ? await warmEtag(paths.etag) : null;
  const results = await run(() => request(paths[profile], etag));
  console.log(JSON.stringify(summarize(profile, results)));
}

async function warmEtag(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`Unable to warm ETag profile: ${response.status}`);
  return response.headers.get('etag');
}
async function request(path, etag) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: etag ? { 'If-None-Match': etag } : {} });
    await response.arrayBuffer();
    return { status: response.status, duration_ms: performance.now() - started };
  } catch (error) { return { status: 0, duration_ms: performance.now() - started, error: error instanceof Error ? error.name : 'fetch_failed' }; }
}
async function run(task) {
  let next = 0; const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < total) { next += 1; results.push(await task()); }
  }));
  return results;
}
function summarize(profile, results) {
  const latencies = results.map((item) => item.duration_ms).sort((a, b) => a - b);
  const statuses = Object.fromEntries([...new Set(results.map((item) => String(item.status)))].sort().map((status) => [status, results.filter((item) => String(item.status) === status).length]));
  return { profile, base_url: baseUrl, requests: results.length, concurrency, statuses, latency_ms: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99), max: Math.round(latencies.at(-1) ?? 0) } };
}
function percentile(values, ratio) { return Math.round(values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))] ?? 0); }
function positiveInt(name, fallback) { const value = Number(process.env[name] ?? fallback); if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`); return value; }
