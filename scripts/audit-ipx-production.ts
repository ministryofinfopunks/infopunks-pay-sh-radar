import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
async function main() {
const base = process.env.RADAR_VERIFY_BASE_URL ?? 'https://radar.infopunks.fun';
const paths = ['/health','/status','/v1/ipx/launch','/v1/ipx/economy/summary','/v1/radar/benchmark-summary'];
const keys = new Set(['ok','service','persistenceMode','persistence_mode','databaseMode','database_mode','storage_mode','state','payment_asset','quote_asset','quote_is_backing','historical_calls_preserved','economic_flywheel_operational','recorded_benchmarks','total_recorded_runs','proven_routes','total_artifacts','winner_claimed','coverage','executable_pltr_market_hours']);
const observations = await Promise.all(paths.map(async path => {
  const observed_at = new Date().toISOString();
  try {
    const response = await fetch(new URL(path, base), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const body = await response.text(); let selected: Record<string, unknown> = {};
    try { const json = JSON.parse(body); const data = json.data ?? json; selected = Object.fromEntries(Object.entries(data).filter(([key, value]) => keys.has(key) && (value === null || ['string','number','boolean'].includes(typeof value)))); } catch { /* HTML fallback is not API evidence. */ }
    return { path, observed_at, status: response.status, content_type: response.headers.get('content-type'), response_sha256: createHash('sha256').update(body).digest('hex'), selected_public_fields: selected };
  } catch (error) { return { path, observed_at, status: null, error: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_UNAVAILABLE' }; }
}));
const evidence = { version: 'ipx.production-read-evidence.v1', base_url: base, captured_at: new Date().toISOString(), methodology: 'PUBLIC_READ_ONLY_HTTP; response hashes prove captured bytes, not deployment durability', observations, durability_proven: false, economic_flywheel_operational_proven: false };
writeFileSync('docs/evidence/ipx-production-read-2026-10-08.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));

}
void main().catch(() => { console.error("Production evidence capture failed"); process.exitCode = 1; });
