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

export type HermesBridgeConfig = {
  enabled: boolean;
  mode: 'mock' | 'http';
  baseUrl?: string;
  hasApiKey: boolean;
};

export type HermesBridgeHealth = {
  enabled: boolean;
  mode: 'mock' | 'http';
  status: 'mock' | 'online' | 'offline' | 'error';
  base_url?: string;
  checked_at: string;
  latency_ms?: number;
  error?: string;
  capabilities?: string[];
};

const HERMES_HEALTH_TIMEOUT_MS = 2_000;
const HERMES_RUN_TIMEOUT_MS = 4_000;

function readHermesRuntime(env: HermesBridgeEnv = process.env) {
  const config = getHermesBridgeConfig(env);
  const baseUrlConfigured = Boolean(config.baseUrl);
  const liveHttpAllowed = config.enabled && config.mode === 'http' && baseUrlConfigured;
  return {
    enabled: config.enabled,
    mode: config.mode,
    base_url_configured: baseUrlConfigured,
    api_key_configured: config.hasApiKey,
    live_http_allowed: liveHttpAllowed,
    status: liveHttpAllowed ? 'http_configured' : config.enabled ? 'mock_ready' : 'disabled'
  } as const;
}

export function getHermesBridgeConfig(env: HermesBridgeEnv = process.env): HermesBridgeConfig {
  const enabled = env.HERMES_ENABLED === 'true';
  const mode = enabled && env.HERMES_MODE === 'http' ? 'http' : 'mock';
  const baseUrl = env.HERMES_BASE_URL?.trim() || undefined;
  const hasApiKey = Boolean(env.HERMES_API_KEY?.trim());
  return { enabled, mode, baseUrl, hasApiKey };
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
  return hermesRuns.map((run) => ({
    ...run,
    artifacts: run.artifacts.map((artifact) => ({ ...artifact })),
    lifecycle_events: run.lifecycle_events?.map((event) => ({ ...event }))
  }));
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
  const runId = `hermes_mock_pre_spend_${safeRoute || 'route'}_${safeProvider || 'provider'}_${safeService || 'service'}`.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 120);
  return {
    id: runId,
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
    completed_at: createdAt,
    source: 'mock',
    lifecycle_events: [
      { id: `${runId}_queued`, at: createdAt, state: 'queued', label: 'Queued' },
      { id: `${runId}_mock_investigation_started`, at: createdAt, state: 'mock_investigation_started', label: 'Mock investigation started', detail: 'Hermes live mode is unavailable, so Radar generated a deploy-safe run shell.' },
      { id: `${runId}_mock_receipt_generated`, at: createdAt, state: 'mock_receipt_generated', label: 'Mock receipt generated', detail: 'Receipt and loop candidate artifacts were created without live Hermes execution.' },
      { id: `${runId}_completed`, at: createdAt, state: 'completed', label: 'Completed' }
    ]
  };
}

function addBridgeMetadata(run: HermesRun, source: HermesRun['source'], fallbackReason?: string): HermesRun {
  return {
    ...run,
    source,
    fallback_reason: fallbackReason ?? run.fallback_reason,
    lifecycle_events: run.lifecycle_events?.map((event) => ({ ...event }))
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ response: Response; json: unknown; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const json = await response.json();
    return { response, json, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCapabilities(candidate: unknown): string[] | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined;
  const value = (candidate as Record<string, unknown>).capabilities;
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function healthFallback(config: HermesBridgeConfig, status: HermesBridgeHealth['status'], error?: string): HermesBridgeHealth {
  return {
    enabled: config.enabled,
    mode: config.mode,
    status,
    base_url: config.baseUrl,
    checked_at: new Date().toISOString(),
    error
  };
}

export async function checkHermesHealth(env: HermesBridgeEnv = process.env): Promise<HermesBridgeHealth> {
  const config = getHermesBridgeConfig(env);
  if (!config.enabled || config.mode !== 'http') return healthFallback(config, 'mock');
  if (!config.baseUrl) return healthFallback(config, 'offline', 'missing_base_url');

  const url = new URL('/health', config.baseUrl).toString();
  try {
    const { response, json, latencyMs } = await fetchJsonWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(config.hasApiKey ? { Authorization: `Bearer ${env.HERMES_API_KEY!.trim()}` } : {})
      }
    }, HERMES_HEALTH_TIMEOUT_MS);

    if (!response.ok) {
      return {
        ...healthFallback(config, response.status >= 500 ? 'offline' : 'error', `http_${response.status}`),
        latency_ms: latencyMs
      };
    }

    return {
      enabled: config.enabled,
      mode: config.mode,
      status: 'online',
      base_url: config.baseUrl,
      checked_at: new Date().toISOString(),
      latency_ms: latencyMs,
      capabilities: normalizeCapabilities(json)
    };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'timeout'
      : error instanceof Error ? error.message : 'unknown_error';
    return healthFallback(config, 'offline', message);
  }
}

function coerceHermesRunResponse(json: unknown): HermesRun | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const candidate = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || typeof candidate.summary !== 'string') return null;
  if (typeof candidate.state !== 'string' || typeof candidate.decision !== 'string' || typeof candidate.confidence !== 'number') return null;
  if (!Array.isArray(candidate.risk_factors) || !Array.isArray(candidate.artifacts)) return null;
  if (typeof candidate.objective !== 'string' || typeof candidate.created_at !== 'string' || !('completed_at' in candidate)) return null;
  return candidate as unknown as HermesRun;
}

export async function createLivePreSpendRun(
  input: CreateMockPreSpendRunInput,
  env: HermesBridgeEnv = process.env
): Promise<HermesRun> {
  const config = getHermesBridgeConfig(env);
  if (!config.enabled || config.mode !== 'http') return createMockPreSpendRun(input);

  const fallback = (reason: string) => addBridgeMetadata(createMockPreSpendRun(input), 'hermes_http_fallback', reason);
  if (!config.baseUrl) return fallback('missing_base_url');

  const url = new URL('/v1/hermes/pre-spend-run', config.baseUrl).toString();
  try {
    const { response, json } = await fetchJsonWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(config.hasApiKey ? { Authorization: `Bearer ${env.HERMES_API_KEY!.trim()}` } : {})
      },
      body: JSON.stringify({
        route_id: input.route_id,
        provider_id: input.provider_id,
        service_id: input.service_id,
        spend_context: input.spend_context,
        // TODO: tighten the request/response contract once the Hermes sidecar run API is finalized.
        adapter: 'infopunks_radar_pre_spend_v0'
      })
    }, HERMES_RUN_TIMEOUT_MS);

    if (!response.ok) return fallback(`http_${response.status}`);
    const run = coerceHermesRunResponse(json);
    if (!run) return fallback('malformed_response');
    return addBridgeMetadata(run, 'hermes_http');
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'timeout'
      : error instanceof Error ? error.message : 'unknown_error';
    return fallback(message);
  }
}

export async function getHermesHealth(env: HermesBridgeEnv = process.env) {
  const runtime = readHermesRuntime(env);
  const bridge = await checkHermesHealth(env);
  return {
    ok: bridge.status === 'mock' || bridge.status === 'online',
    service: 'hermes-bridge',
    runtime,
    mode: bridge.mode,
    hermes_enabled: bridge.enabled,
    live_http_allowed: runtime.live_http_allowed,
    sidecar_required: false,
    message: bridge.status === 'online'
      ? 'Hermes HTTP sidecar is reachable.'
      : bridge.status === 'mock'
        ? 'Hermes bridge is deploy-safe in mock mode. No sidecar is required.'
        : 'Hermes bridge is enabled but the sidecar is unavailable; Radar will fall back to mock mode.',
    bridge
  };
}
