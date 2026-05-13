const RADAR_BASE_URL = process.env.RADAR_BASE_URL ?? 'https://infopunks-pay-sh-radar.onrender.com';
const PAYSH_CATALOG_URL = 'https://pay.sh/api/catalog';

async function readJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function countProviders(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (typeof payload.provider_count === 'number') return payload.provider_count;
  if (Array.isArray(payload.providers)) return payload.providers.length;
  return 0;
}

function dataLength(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (Array.isArray(payload.data)) return payload.data.length;
  return 0;
}

async function main() {
  const directCatalog = await readJson(PAYSH_CATALOG_URL);
  const providers = await readJson(`${RADAR_BASE_URL}/v1/providers`);
  const pulse = await readJson(`${RADAR_BASE_URL}/v1/pulse`);
  const radarEndpoints = await readJson(`${RADAR_BASE_URL}/v1/radar/endpoints`);

  const pulseData = pulse?.data ?? {};
  const radarEndpointsData = radarEndpoints?.data ?? {};

  console.log(`Pay.sh direct provider_count: ${countProviders(directCatalog)}`);
  console.log(`API /v1/providers data length: ${dataLength(providers)}`);
  console.log(`API /v1/pulse data.providerCount: ${pulseData.providerCount ?? 0}`);
  console.log(`API /v1/pulse data.endpointCount: ${pulseData.endpointCount ?? 0}`);
  console.log(`API /v1/pulse data.bootstrapped: ${pulseData.bootstrapped ?? false}`);
  console.log(`API /v1/pulse data.catalog_status: ${pulseData.catalog_status ?? 'unknown'}`);
  console.log(`API /v1/pulse data.data_source: ${JSON.stringify(pulseData.data_source ?? null)}`);
  console.log(`API /v1/radar/endpoints data.endpoint_metadata: ${JSON.stringify(radarEndpointsData.endpoint_metadata ?? null)}`);
  console.log(`API /v1/radar/endpoints data.endpoints length: ${Array.isArray(radarEndpointsData.endpoints) ? radarEndpointsData.endpoints.length : 0}`);
}

main().catch((error) => {
  console.error(`debug-live-radar failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
