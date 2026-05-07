const baseUrl = (process.env.BACKEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:8787').replace(/\/$/, '');

const checks = [
  { path: '/health', expect: (json) => json.ok === true },
  { path: '/version', expect: (json) => json.service === 'infopunks-pay-sh-radar' && typeof json.version === 'string' },
  { path: '/v1/pulse', expect: (json) => typeof json.data?.providerCount === 'number' },
  { path: '/v1/providers', expect: (json) => Array.isArray(json.data) }
];

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${check.path} returned ${response.status}`);
  }
  const json = await response.json();
  if (!check.expect(json)) {
    throw new Error(`${check.path} returned an unexpected payload`);
  }
  console.log(JSON.stringify({ check: check.path, status: response.status, ok: true }));
}

console.log(JSON.stringify({ smoke: 'backend', baseUrl, ok: true }));
