// Read-only aggregate of real structured events. Missing instrumentation is unknown, never invented.
import fs from 'node:fs';
import readline from 'node:readline';
const source = process.argv[2];
if (!source) throw new Error('Provide a local NDJSON application log; output contains aggregates only.');
const latencies = [], dbLatencies = [], decisions = {}, rejections = {}, statuses = {}, events = {};
let judgmentVolume = 0, completeRequests = 0;
const samplesSeen = { api: 0, database: 0 }, paymentStages = {}, freshness = { observations: 0, fresh: 0, stale: 0 };
function retain(values, value, kind) { values[samplesSeen[kind]++ % 10000] = value; }
for await (const line of readline.createInterface({ input: fs.createReadStream(source), crlfDelay: Infinity })) {
  let item; try { item = JSON.parse(line); } catch { continue; }
  if (!item || typeof item.event !== 'string') continue;
  events[item.event] = (events[item.event] ?? 0) + 1;
  if (item.event === 'request_complete') {
    completeRequests++;
    if (typeof item.route === 'string' && /^\/(v1|internal)\//.test(item.route) && Number.isFinite(item.duration_ms)) retain(latencies, item.duration_ms, 'api');
    statuses[item.status_code] = (statuses[item.status_code] ?? 0) + 1;
    if (item.method === 'POST' && ['/v1/pre-spend/check', '/v1/decide'].includes(item.route)) judgmentVolume++;
  }
  if (item.event === 'database_query_timing' && Number.isFinite(item.elapsed_ms)) retain(dbLatencies, item.elapsed_ms, 'database');
  if (item.event === 'judgment_payment_stage' && ['challenge','verified','settled','duplicate_prevented'].includes(item.stage)) paymentStages[item.stage] = (paymentStages[item.stage] ?? 0) + 1;
  if (item.event === 'judgment_evidence_freshness') for (const key of Object.keys(freshness)) if (Number.isFinite(item[key])) freshness[key] += item[key];
  if (item.event === 'judgment_assessed' && ['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence'].includes(item.decision)) decisions[item.decision] = (decisions[item.decision] ?? 0) + 1;
  if (['judgment_rejected', 'judgment_request_rejected', 'execution_proof_rejected'].includes(item.event) && typeof (item.code ?? item.reason) === 'string') {
    const code = item.code ?? item.reason;
    rejections[code] = (rejections[code] ?? 0) + 1;
  }
}
function quantiles(values) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const at = fraction => values[Math.max(0, Math.ceil(values.length * fraction) - 1)];
  return { samples: values.length, p50_ms: at(.5), p95_ms: at(.95), p99_ms: at(.99) };
}
const assessed = Object.values(decisions).reduce((total, count) => total + count, 0);
console.log(JSON.stringify({ scope: 'Single supplied log only; not a replica-wide metric or production SLO.', request_volume: completeRequests,
  judgment_request_volume: judgmentVolume, decision_distribution: assessed ? decisions : null,
  insufficient_evidence_rate: assessed ? (decisions.insufficient_evidence ?? 0) / assessed : null,
  unsupported_policy_events: rejections.unsupported_policy ?? 0, rejection_codes: rejections, http_status_distribution: statuses,
  api_latency: quantiles(latencies), database_query_latency: quantiles(dbLatencies), sample_window: 'Last 10000 observed durations per metric; deterministic bounded memory.', samples_seen: samplesSeen,
  proof_verification_failures: events.execution_proof_rejected ?? 0,
  payment_stages: events.judgment_payment_stage ? paymentStages : null,
  evidence_freshness: events.judgment_evidence_freshness ? freshness : null,
  telemetry_gaps: ['No cross-replica collector is configured.', 'Real RPC/settlement/evaluation/capacity baselines require approved staging bindings.'],
  relevant_event_counts: Object.fromEntries(Object.entries(events).filter(([event]) => !event.startsWith('hook_'))) }, null, 2));
