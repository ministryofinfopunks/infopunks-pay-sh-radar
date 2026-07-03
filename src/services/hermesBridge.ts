import {
  hermesDeskGeneratedAt,
  hermesRuns,
  hermesSkillPack,
  summarizeHermesRuns,
  type HermesDeskSummary,
  type HermesRun
} from '../data/hermesDesk';

export type HermesBridgeEnv = {
  HERMES_ENABLED?: string;
  HERMES_MODE?: string;
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
};

export type CreateMockPreSpendRunInput = {
  route_id: string;
  provider_id: string;
  service_id: string;
  spend_context?: Record<string, unknown>;
};

function readHermesRuntime(env: HermesBridgeEnv = process.env) {
  const enabled = env.HERMES_ENABLED === 'true';
  const mode = env.HERMES_MODE === 'http' ? 'http' : 'mock';
  const baseUrlConfigured = Boolean(env.HERMES_BASE_URL?.trim());
  const apiKeyConfigured = Boolean(env.HERMES_API_KEY?.trim());
  const liveHttpAllowed = enabled && mode === 'http';

  return {
    enabled,
    mode,
    base_url_configured: baseUrlConfigured,
    api_key_configured: apiKeyConfigured,
    live_http_allowed: liveHttpAllowed,
    status: liveHttpAllowed ? 'http_configured' : enabled ? 'mock_ready' : 'disabled'
  } as const;
}

export function getHermesDeskSummary(env: HermesBridgeEnv = process.env): HermesDeskSummary {
  const runs = listHermesRuns();
  return {
    generated_at: hermesDeskGeneratedAt,
    title: 'Hermes Desk',
    route: '/hermes',
    narrative_route: '/narratives/hermes-desk',
    hero_copy: 'Agentic investigations before money moves.',
    explanation: 'Hermes runs the loop. Infopunks keeps the receipts.',
    source: 'infopunks-pay-sh-radar',
    sidecar: readHermesRuntime(env),
    counts: summarizeHermesRuns(runs),
    skills: hermesSkillPack,
    runs
  };
}

export function listHermesRuns(): HermesRun[] {
  return hermesRuns.map((run) => ({ ...run, artifacts: run.artifacts.map((artifact) => ({ ...artifact })) }));
}

export function getHermesRunById(id: string): HermesRun | null {
  return listHermesRuns().find((run) => run.id === id) ?? null;
}

export function createMockPreSpendRun(input: CreateMockPreSpendRunInput): HermesRun {
  const createdAt = new Date().toISOString();
  const safeRoute = input.route_id.trim();
  const safeProvider = input.provider_id.trim();
  const safeService = input.service_id.trim();
  const spendContextKeys = Object.keys(input.spend_context ?? {});
  return {
    id: `hermes_mock_pre_spend_${safeRoute || 'route'}_${safeProvider || 'provider'}_${safeService || 'service'}`.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 120),
    title: 'Mock Hermes Pre-Spend Run',
    objective: `Investigate ${safeRoute} / ${safeProvider} / ${safeService} before agent spend.`,
    state: 'completed',
    decision: 'caution',
    confidence: 78,
    summary: 'Mock Hermes bridge generated a pre-spend investigation shell. No live Hermes sidecar call was made; Radar can attach this shape to receipts, claims, and loop runs.',
    risk_factors: [
      'Mock mode does not prove live Hermes execution.',
      'Spend context still requires receipt-backed validation before reputation updates.',
      spendContextKeys.length ? `Spend context keys observed: ${spendContextKeys.join(', ')}.` : 'No spend context keys were supplied.'
    ],
    artifacts: [
      {
        artifact_id: 'hermes_mock_artifact_pre_spend_receipt',
        label: 'mock pre-spend receipt candidate',
        type: 'receipt',
        summary: 'Candidate receipt shape for route, provider, service, and spend context review.',
        uri: `/v1/hermes/pre-spend-run`
      },
      {
        artifact_id: 'hermes_mock_artifact_loop_candidate',
        label: 'mock loop run candidate',
        type: 'loop_run',
        summary: 'Candidate loop memory update held in caution until real execution evidence exists.',
        uri: '/loops/loop_pre_spend_route'
      }
    ],
    linked_receipt_id: null,
    linked_claim_id: null,
    linked_loop_id: 'loop_pre_spend_route',
    created_at: createdAt,
    completed_at: createdAt
  };
}

export function getHermesHealth(env: HermesBridgeEnv = process.env) {
  const runtime = readHermesRuntime(env);
  return {
    ok: true,
    service: 'hermes-bridge',
    runtime,
    mode: runtime.mode,
    hermes_enabled: runtime.enabled,
    live_http_allowed: runtime.live_http_allowed,
    sidecar_required: false,
    message: runtime.live_http_allowed
      ? 'Hermes HTTP sidecar mode is configured. Live calls are reserved for future bridge implementation.'
      : 'Hermes bridge is deploy-safe in mock mode. No sidecar is required.'
  };
}
