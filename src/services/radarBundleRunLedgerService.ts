import { RadarBundleRunDetail, RadarBundleRunListResponse, RadarBundleRunSummary } from '../schemas/entities';

const SOURCE_BUNDLE_ID = 'morning-briefing';

const MORNING_BRIEFING_RUN_LATEST_DETAIL: RadarBundleRunDetail = {
  run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
  bundle_id: 'morning-briefing',
  status: 'controlled_live_run',
  evidence_health: 'caveated',
  winner_claimed: false,
  generated_at: '2026-05-21T08:45:56.919Z',
  execution_mode: 'pay_cli',
  live_execution_enabled: true,
  final_bundle_state: 'executed_with_review_required_skipped',
  estimated_cost_usd: '0.02-0.05',
  observed_cost_usd: null,
  radar_plan_endpoint: 'https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/morning-briefing/plan',
  canonical_request: {
    topic: 'AI, crypto, world news',
    constraints: {
      max_cost_usd: 0.05,
      allow_billing_unclear: false,
      allow_scaffold_routes: false
    }
  },
  route_plan_summary: {
    total: 5,
    included: 3,
    review_required: 2,
    blocked: 0,
    clean_402: 3,
    paid_proven: 0,
    billing_unclear: 2,
    billable_probe_observed: 0
  },
  executed_steps: [
    {
      step_id: 'world_news_search',
      execution_boundary: 'clean_402',
      success: true,
      status_code: null,
      status_evidence: 'pay_cli_exit_0_status_unavailable',
      observed_cost_usd: null,
      normalized_output_preview: {
        title: 'World News | Latest Top Stories - Reuters',
        url: 'https://www.reuters.com/world/',
        snippet: null,
        source: null,
        published_at: null,
        answer: null,
        citations: [],
        results_count: 5
      },
      source_count: 5
    },
    {
      step_id: 'ai_news_search',
      execution_boundary: 'clean_402',
      success: true,
      status_code: null,
      status_evidence: 'pay_cli_exit_0_status_unavailable',
      observed_cost_usd: null,
      normalized_output_preview: {
        title: 'AI News | Latest AI News, Analysis & Events',
        url: 'https://www.artificialintelligence-news.com',
        snippet: 'The UK and Canada have signed a landmark agreement to collaborate on the computing power needed to advance AI research and development. ... Quantum AI is the next frontier in the evolution of artificial intelligence, harnessing the power of quantum mechanics to propel capabilities beyond current limits. ... A new open-source toolkit from Microsoft focuses on runtime security to force strict governance onto enterprise AI agents.',
        source: null,
        published_at: null,
        answer: null,
        citations: [],
        results_count: 5
      },
      source_count: 5
    },
    {
      step_id: 'crypto_market_scan',
      execution_boundary: 'clean_402',
      success: true,
      status_code: null,
      status_evidence: 'pay_cli_exit_0_status_unavailable',
      observed_cost_usd: null,
      normalized_output_preview: {
        symbol: null,
        price: 86.3233427074135,
        token: 'SOL / ZEC',
        network: null,
        address: 'nep141:sol.omft.near___nep141:zec.omft.near',
        metadata: null,
        result_count: 20,
        route_output_shape: ['data']
      },
      source_count: 0
    }
  ],
  skipped_steps: [
    {
      step_id: 'top_story_selection',
      plan_status: 'review_required',
      execution_boundary: 'billing_unclear',
      reason: 'billing_unclear'
    },
    {
      step_id: 'deep_dive_synthesis',
      plan_status: 'review_required',
      execution_boundary: 'billing_unclear',
      reason: 'billing_unclear'
    }
  ],
  blocked_steps: [],
  source_map: [
    { label: 'World News | Latest Top Stories - Reuters', url: 'https://www.reuters.com/world/' },
    { label: 'World | Latest News & Updates - BBC', url: 'https://www.bbc.com/news/world' },
    { label: 'Top & Breaking World News Today | AP News', url: 'https://apnews.com/world-news' },
    { label: 'World news - breaking news, video, headlines and opinion | CNN', url: 'https://www.cnn.com/world' },
    { label: 'Breaking News, World News and Video from Al Jazeera', url: 'https://www.aljazeera.com/' },
    { label: 'AI News | Latest AI News, Analysis & Events', url: 'https://www.artificialintelligence-news.com' },
    { label: 'Artificial intelligence | MIT News | Massachusetts Institute of ...', url: 'https://news.mit.edu/topic/artificial-intelligence2' },
    { label: 'AI News & Artificial Intelligence | TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/' },
    { label: 'Official Google AI news and updates', url: 'https://blog.google/innovation-and-ai/technology/ai/' },
    { label: 'Crescendo AI', url: 'https://www.crescendo.ai/' }
  ],
  caveat_objects: [
    {
      code: 'status_code_unavailable',
      severity: 'warning',
      affects_core_semantics: false,
      detail: 'HTTP status code was not available in pay_cli execution output.'
    },
    {
      code: 'observed_cost_unavailable',
      severity: 'warning',
      affects_core_semantics: false,
      detail: 'Observed step cost was not available in live execution output.'
    },
    {
      code: 'source_map_empty',
      severity: 'warning',
      affects_core_semantics: false,
      detail: 'Crypto market scan executed successfully but produced an empty source map.'
    }
  ],
  recommended_next_action: 'Review skipped review_required steps and explicitly enable gates only if approved.'
};

const MORNING_BRIEFING_RUN_PREVIOUS_DETAIL: RadarBundleRunDetail = {
  ...MORNING_BRIEFING_RUN_LATEST_DETAIL,
  run_id: 'morning-briefing-run-2026-05-21-075521-pay-cli',
  generated_at: '2026-05-21T07:55:21.600Z',
  source_map: MORNING_BRIEFING_RUN_LATEST_DETAIL.source_map.slice(0, 9)
};

const FRESH_UNTIL_HOURS = 24 as const;
const AGING_UNTIL_HOURS = 72 as const;

export function deriveBundleRunFreshness(latestGeneratedAt: string, now = new Date()) {
  const latestMs = Date.parse(latestGeneratedAt);
  const nowMs = now.getTime();
  const ageHoursRaw = Number.isFinite(latestMs) ? Math.max(0, (nowMs - latestMs) / (1000 * 60 * 60)) : 0;
  const latestRunAgeHours = Math.round(ageHoursRaw * 10) / 10;
  const freshnessState: 'fresh' | 'aging' | 'stale' = latestRunAgeHours <= FRESH_UNTIL_HOURS ? 'fresh' : latestRunAgeHours <= AGING_UNTIL_HOURS ? 'aging' : 'stale';
  const recommendedAgentAction = freshnessState === 'fresh'
    ? 'Inspect latest run detail before spend.'
    : freshnessState === 'aging'
      ? 'Inspect latest run detail and consider re-running before spend if the bundle is time-sensitive.'
      : 'Re-run the bundle before relying on this history for spend decisions.';
  return {
    last_controlled_run_at: latestGeneratedAt,
    latest_run_age_hours: latestRunAgeHours,
    freshness_state: freshnessState,
    freshness_thresholds_hours: {
      fresh_until: FRESH_UNTIL_HOURS,
      aging_until: AGING_UNTIL_HOURS
    },
    recommended_agent_action: recommendedAgentAction
  };
}

function toSummary(detail: RadarBundleRunDetail): RadarBundleRunSummary {
  return {
    run_id: detail.run_id,
    status: detail.status,
    evidence_health: detail.evidence_health,
    generated_at: detail.generated_at,
    execution_mode: detail.execution_mode,
    final_bundle_state: detail.final_bundle_state,
    estimated_cost_usd: detail.estimated_cost_usd,
    observed_cost_usd: detail.observed_cost_usd,
    executed_step_count: detail.executed_steps.length,
    skipped_step_count: detail.skipped_steps.length,
    blocked_step_count: detail.blocked_steps.length,
    source_count: detail.source_map.length,
    winner_claimed: detail.winner_claimed
  };
}

function morningBriefingRuns(): RadarBundleRunDetail[] {
  return [MORNING_BRIEFING_RUN_LATEST_DETAIL, MORNING_BRIEFING_RUN_PREVIOUS_DETAIL];
}

export function listRadarBundleRuns(bundleId: string): RadarBundleRunListResponse | null {
  if (bundleId !== SOURCE_BUNDLE_ID) return null;
  const runs = morningBriefingRuns().sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at));
  const summaries = runs.map(toSummary);
  const latest = summaries[0];
  const previous = summaries[1];
  const latestCaveats = runs[0]?.caveat_objects.map((item) => item.code) ?? [];
  const previousCaveats = runs[1]?.caveat_objects.map((item) => item.code) ?? [];
  const freshness = latest ? deriveBundleRunFreshness(latest.generated_at) : null;
  return {
    bundle_id: SOURCE_BUNDLE_ID,
    count: runs.length,
    latest_run_id: latest?.run_id ?? null,
    latest_generated_at: latest?.generated_at ?? null,
    runs: summaries,
    history_summary: {
      history_count: runs.length,
      latest_run_id: latest?.run_id ?? null,
      previous_run_id: previous?.run_id ?? null,
      source_count_delta: (latest?.source_count ?? 0) - (previous?.source_count ?? 0),
      latest_source_count: latest?.source_count ?? 0,
      previous_source_count: previous?.source_count ?? 0,
      observed_cost_available: latest?.observed_cost_usd != null,
      observed_cost_state: latest?.observed_cost_usd == null ? 'unavailable' : 'available',
      skipped_review_required_steps_stable: (latest?.skipped_step_count ?? 0) === (previous?.skipped_step_count ?? 0),
      latest_skipped_step_count: latest?.skipped_step_count ?? 0,
      previous_skipped_step_count: previous?.skipped_step_count ?? 0,
      caveat_codes_latest: latestCaveats,
      caveat_codes_previous: previousCaveats,
      caveat_delta: {
        added: latestCaveats.filter((code) => !previousCaveats.includes(code)),
        removed: previousCaveats.filter((code) => !latestCaveats.includes(code))
      },
      winner_claimed: false
    },
    freshness,
    winner_claimed: false,
    agent_guidance: [
      'Bundle run history records controlled Harness proof evolution, not benchmark winners.',
      'Agents should inspect latest run detail, skipped review-required steps, caveats, and observed cost availability before relying on a bundle.',
      'winner_claimed=false means no bundle or route winner should be inferred.'
    ]
  };
}

export function getRadarBundleRunById(bundleId: string, runId: string): RadarBundleRunDetail | null {
  if (bundleId !== SOURCE_BUNDLE_ID) return null;
  return morningBriefingRuns().find((run) => run.run_id === runId) ?? null;
}
