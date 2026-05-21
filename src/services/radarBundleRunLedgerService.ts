import { RadarBundleRunDetail, RadarBundleRunListResponse, RadarBundleRunSummary } from '../schemas/entities';

const SOURCE_BUNDLE_ID = 'morning-briefing';

const MORNING_BRIEFING_RUN_DETAIL: RadarBundleRunDetail = {
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
  return [MORNING_BRIEFING_RUN_DETAIL];
}

export function listRadarBundleRuns(bundleId: string): RadarBundleRunListResponse | null {
  if (bundleId !== SOURCE_BUNDLE_ID) return null;
  const runs = morningBriefingRuns();
  return {
    bundle_id: SOURCE_BUNDLE_ID,
    count: runs.length,
    runs: runs.map(toSummary),
    winner_claimed: false,
    agent_guidance: [
      'Bundle runs are Harness proof records, not benchmark claims.',
      'controlled_live_run means the Harness executed approved steps from a Radar plan.',
      'caveated means agents should inspect skipped review-required steps, missing observed cost, and execution caveats before relying on the run.'
    ]
  };
}

export function getRadarBundleRunById(bundleId: string, runId: string): RadarBundleRunDetail | null {
  if (bundleId !== SOURCE_BUNDLE_ID) return null;
  return morningBriefingRuns().find((run) => run.run_id === runId) ?? null;
}
