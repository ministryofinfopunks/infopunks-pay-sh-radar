import { UnicornRadarCandidateSchema, UnicornRadarSummarySchema } from '../schemas/entities';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The existing public exporter converts omitted optional receipt URLs to null.
// Validate that established wire format without changing the API or inventing URLs.
function candidateForValidation(value: unknown): unknown {
  if (!record(value) || !Array.isArray(value.receipts)) return value;
  return { ...value, receipts: value.receipts.map(receipt => {
    if (!record(receipt) || receipt.url !== null) return receipt;
    const { url: _unavailableUrl, ...rest } = receipt;
    return rest;
  }) };
}

/** Validate existing read contracts; do not turn invalid success into empty evidence. */
export function validateReleaseRead(path: string, body: unknown): void {
  const endpoint = path.split('?')[0];
  const invalid = () => { throw new Error('Evidence response is invalid. Retry when the service is available.'); };
  if (endpoint === '/v1/unicorn-radar') {
    if (!record(body)) return invalid();
    const parsed = UnicornRadarSummarySchema.safeParse(record(body.data) && Array.isArray(body.data.candidates)
      ? { ...body.data, candidates: body.data.candidates.map(candidateForValidation) } : body.data);
    if (!parsed.success) return invalid();
    const summary = parsed.data;
    if (summary.counts.total !== summary.candidates.length || new Set(summary.candidates.map(candidate => candidate.id)).size !== summary.candidates.length || summary.candidates.some(candidate => !candidate.id.trim())) return invalid();
    for (const [key, field] of [['by_status', 'status'], ['by_verdict', 'verdict'], ['by_sector', 'sector']] as const) {
      for (const [value, count] of Object.entries(summary.counts[key])) {
        if (count !== summary.candidates.filter(candidate => candidate[field] === value).length) return invalid();
      }
    }
    return;
  }
  if (/^\/v1\/unicorn-radar\/candidates\/[^/]+$/.test(endpoint)) {
    if (!record(body) || !UnicornRadarCandidateSchema.safeParse(candidateForValidation(body.data)).success) invalid();
    return;
  }
  if (endpoint === '/v1/machine-market/summary') {
    if (!record(body) || !record(body.data) || typeof body.data.total_services !== 'number' || !Number.isFinite(body.data.total_services)) invalid();
    return;
  }
  if (endpoint === '/v1/machine-execution/benchmark-gate') {
    if (!record(body) || !record(body.data) || typeof body.data.benchmark_execution_allowed !== 'boolean' || ['allowed_lanes', 'blocked_lanes', 'blocking_reasons', 'required_conditions'].some(key => !Array.isArray((body.data as Record<string, unknown>)[key]))) invalid();
    return;
  }
  const collections: Record<string, string> = {
    '/v1/machine-market/services': 'services',
    '/v1/machine-preflight/receipts/recent': 'receipts',
    '/v1/machine-preflight/coverage-runs/recent': 'runs',
    '/v1/machine-execution/benchmark-readiness': 'lanes'
  };
  const key = collections[endpoint];
  if (!key) return;
  if (!record(body) || !record(body.data) || !Array.isArray(body.data[key])) return invalid();
  const items = body.data[key] as unknown[];
  if (items.some(item => !record(item))) return invalid();
  if (key === 'services') for (const item of items as Record<string, unknown>[]) {
    for (const field of ['id', 'name', 'provider', 'category', 'market_type', 'source_market', 'chain', 'status', 'price_display', 'description', 'machine_use_case', 'evidence_health', 'evidence_stage', 'policy_risk', 'observed_source', 'observed_at', 'phase_scope']) {
      if (typeof item[field] !== 'string') return invalid();
    }
    if (!Array.isArray(item.caveats) || item.caveats.some(value => typeof value !== 'string')) return invalid();
    if (item.catalog_routes != null && (!Array.isArray(item.catalog_routes) || item.catalog_routes.some(route => !record(route) || ['method', 'path', 'label', 'risk'].some(field => typeof route[field] !== 'string')))) return invalid();
    if (item.source_attribution != null && (!record(item.source_attribution) || ['source', 'scope', 'observed_at', 'caveat'].some(field => typeof (item.source_attribution as Record<string, unknown>)[field] !== 'string'))) return invalid();
  }
  if (key === 'receipts') for (const item of items as Record<string, unknown>[]) {
    if (typeof item.receipt_id !== 'string' || typeof item.decision !== 'string' || typeof item.demo_mode !== 'boolean') return invalid();
  }
  if (key === 'lanes') for (const item of items as Record<string, unknown>[]) {
    if (['lane_id', 'task_class', 'readiness_status', 'repeatability_state', 'next_action'].some(field => typeof item[field] !== 'string') || ['candidate_routes', 'missing_requirements', 'caveats'].some(field => !Array.isArray(item[field]))) return invalid();
  }
}

export function marketObservationLabel(candidate: { dexScreenerData?: unknown; marketDataUpdatedAt?: string }, now = Date.now()): string {
  const observed = Date.parse(candidate.marketDataUpdatedAt ?? '');
  if (!candidate.dexScreenerData || !Number.isFinite(observed)) return 'Market observation unavailable';
  if (observed > now) return 'Market capture time invalid · current freshness unavailable';
  const age = now - observed;
  return age >= 0 && age <= 90_000 ? 'Recent Radar market capture · may be cached up to 90 seconds' : 'Historical market observation · current refresh not established';
}
