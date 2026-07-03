export type HermesRunState = 'queued' | 'running' | 'completed' | 'failed' | 'blocked';

export type HermesDecisionState = 'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';

export type HermesArtifact = {
  artifact_id: string;
  label: string;
  type: 'receipt' | 'claim' | 'loop_run' | 'risk_note' | 'narrative_scan' | 'skill_trace';
  summary: string;
  uri: string;
};

export type HermesRunSource = 'mock' | 'hermes_http' | 'hermes_http_fallback';

export type HermesRunLifecycleEvent = {
  id: string;
  at: string;
  state: string;
  label: string;
  detail?: string;
};

export type HermesRun = {
  id: string;
  title: string;
  objective: string;
  state: HermesRunState;
  decision: HermesDecisionState;
  confidence: number;
  summary: string;
  risk_factors: string[];
  artifacts: HermesArtifact[];
  linked_receipt_id: string | null;
  linked_claim_id: string | null;
  linked_loop_id: string | null;
  created_at: string;
  completed_at: string | null;
  source?: HermesRunSource;
  fallback_reason?: string;
  lifecycle_events?: HermesRunLifecycleEvent[];
};

export type HermesSkillSummary = {
  id: string;
  label: string;
  purpose: string;
  enabled: boolean;
  produces: Array<'receipt' | 'claim' | 'loop_run' | 'risk_note' | 'narrative_signal'>;
};

export type HermesDeskSummary = {
  generated_at: string;
  title: 'Hermes Desk';
  route: '/hermes';
  narrative_route: '/narratives/hermes-desk';
  hero_copy: 'Agentic investigations before money moves.';
  explanation: 'Hermes runs the loop. Infopunks keeps the receipts.';
  source: 'infopunks-pay-sh-radar';
  sidecar: {
    enabled: boolean;
    mode: 'mock' | 'http';
    base_url_configured: boolean;
    api_key_configured: boolean;
    live_http_allowed: boolean;
    status: 'mock_ready' | 'http_configured' | 'disabled';
  };
  counts: {
    runs: number;
    active_runs: number;
    completed_runs: number;
    trust: number;
    caution: number;
    do_not_use_yet: number;
    unproven: number;
    disputed: number;
  };
  skills: HermesSkillSummary[];
  runs: HermesRun[];
};

export const hermesDeskGeneratedAt = '2026-07-03T00:00:00.000Z';

export const hermesSkillPack: HermesSkillSummary[] = [
  {
    id: 'pre-spend-route-check',
    label: 'pre-spend route check',
    purpose: 'Investigate a candidate route before an agent spends through it.',
    enabled: true,
    produces: ['receipt', 'claim', 'loop_run', 'risk_note']
  },
  {
    id: 'provider-risk-check',
    label: 'provider risk check',
    purpose: 'Review provider reliability, caveats, disputes, and observed route memory.',
    enabled: true,
    produces: ['claim', 'risk_note']
  },
  {
    id: 'receipt-validator',
    label: 'receipt validator',
    purpose: 'Check whether an agent run has enough evidence to become durable Radar memory.',
    enabled: true,
    produces: ['receipt', 'risk_note']
  },
  {
    id: 'claim-dispute-review',
    label: 'claim dispute review',
    purpose: 'Compare claims against attached receipts and flag disputed or stale evidence.',
    enabled: true,
    produces: ['claim', 'risk_note']
  },
  {
    id: 'signal-hunt-analyst',
    label: 'signal hunt analyst',
    purpose: 'Scan narrative inputs and connect credible signals into proof and loop memory.',
    enabled: true,
    produces: ['narrative_signal', 'claim', 'loop_run']
  }
];

export const hermesRuns: HermesRun[] = [
  {
    id: 'hermes_pay_sh_route_pre_spend_check',
    title: 'Pay.sh Route Pre-Spend Check',
    objective: 'Decide whether an agent should use the market research route before money moves.',
    state: 'completed',
    decision: 'caution',
    confidence: 82,
    summary: 'Hermes found recent route memory and usable output receipts, but kept the run in caution because timeout and prompt-specific quality caveats remain active.',
    risk_factors: [
      'Known blocker: occasional timeout under high load.',
      'Output quality varies by prompt specificity.',
      'Payment proof remains separate from execution proof.'
    ],
    artifacts: [
      {
        artifact_id: 'hermes_artifact_pre_spend_receipt_001',
        label: 'pre-spend decision receipt',
        type: 'receipt',
        summary: 'Route, cost, known blockers, safer alternatives, and confidence delta captured before spend.',
        uri: '/receipts/receipt_001'
      },
      {
        artifact_id: 'hermes_artifact_pre_spend_loop_001',
        label: 'loop memory update',
        type: 'loop_run',
        summary: 'Loop run updated route confidence without claiming a universal winner.',
        uri: '/loops/loop_pre_spend_route'
      }
    ],
    linked_receipt_id: 'receipt_001',
    linked_claim_id: 'claim_001',
    linked_loop_id: 'loop_pre_spend_route',
    created_at: '2026-07-02T09:10:00.000Z',
    completed_at: '2026-07-02T09:14:00.000Z',
    source: 'mock',
    lifecycle_events: [
      { id: 'hermes_pay_sh_route_pre_spend_check_queued', at: '2026-07-02T09:10:00.000Z', state: 'queued', label: 'Queued' },
      { id: 'hermes_pay_sh_route_pre_spend_check_running', at: '2026-07-02T09:11:00.000Z', state: 'running', label: 'Running' },
      { id: 'hermes_pay_sh_route_pre_spend_check_completed', at: '2026-07-02T09:14:00.000Z', state: 'completed', label: 'Completed' }
    ]
  },
  {
    id: 'hermes_agentic_market_provider_risk_review',
    title: 'Agentic Market Provider Risk Review',
    objective: 'Review provider readiness and dispute exposure before routing autonomous agent spend.',
    state: 'completed',
    decision: 'do_not_use_yet',
    confidence: 74,
    summary: 'Hermes identified useful provider metadata but found insufficient recent receipts for autonomous spend. Infopunks keeps the provider gated until fresh validation arrives.',
    risk_factors: [
      'Provider setup appears stronger than route execution evidence.',
      'No fresh payment-confirmed receipt attached.',
      'Dispute memory is too thin for repeat autonomous use.'
    ],
    artifacts: [
      {
        artifact_id: 'hermes_artifact_provider_risk_note_001',
        label: 'provider risk note',
        type: 'risk_note',
        summary: 'Risk review separates listed capability from receipt-backed readiness.',
        uri: '/providers/provider_pay_sh_lattice'
      },
      {
        artifact_id: 'hermes_artifact_provider_claim_001',
        label: 'provider readiness claim',
        type: 'claim',
        summary: 'Provider is not ready for first autonomous spend until a new successful receipt exists.',
        uri: '/claims/claim_002'
      }
    ],
    linked_receipt_id: null,
    linked_claim_id: 'claim_002',
    linked_loop_id: 'loop_provider_trust',
    created_at: '2026-07-02T11:20:00.000Z',
    completed_at: '2026-07-02T11:27:00.000Z',
    source: 'mock',
    lifecycle_events: [
      { id: 'hermes_agentic_market_provider_risk_review_queued', at: '2026-07-02T11:20:00.000Z', state: 'queued', label: 'Queued' },
      { id: 'hermes_agentic_market_provider_risk_review_running', at: '2026-07-02T11:21:00.000Z', state: 'running', label: 'Running' },
      { id: 'hermes_agentic_market_provider_risk_review_completed', at: '2026-07-02T11:27:00.000Z', state: 'completed', label: 'Completed' }
    ]
  },
  {
    id: 'hermes_signal_hunt_narrative_scan',
    title: 'Signal Hunt Narrative Scan',
    objective: 'Scan emerging narrative evidence and decide whether it should feed claims, loops, or provider reputation.',
    state: 'running',
    decision: 'unproven',
    confidence: 61,
    summary: 'Hermes is scanning narrative evidence for agentic payment and signal-market claims. The run is not final; current evidence is useful for watch status only.',
    risk_factors: [
      'Narrative velocity can outrun proof.',
      'Signal evidence is mixed between public artifacts and analyst interpretation.',
      'No provider reputation update should occur until receipts attach.'
    ],
    artifacts: [
      {
        artifact_id: 'hermes_artifact_signal_scan_001',
        label: 'signal hunt scan',
        type: 'narrative_scan',
        summary: 'Narrative scan links Signal Hunt intake to Proof Feed language without promoting a trust decision yet.',
        uri: '/signal-hunt/hunt_black_bull_coordination'
      },
      {
        artifact_id: 'hermes_artifact_signal_skill_trace_001',
        label: 'signal hunt analyst trace',
        type: 'skill_trace',
        summary: 'Skill trace shows Hermes running the scan while Radar holds judgment at unproven.',
        uri: '/v1/hermes/runs/hermes_signal_hunt_narrative_scan'
      }
    ],
    linked_receipt_id: null,
    linked_claim_id: null,
    linked_loop_id: 'loop_pre_spend_route',
    created_at: '2026-07-03T06:00:00.000Z',
    completed_at: null,
    source: 'mock',
    lifecycle_events: [
      { id: 'hermes_signal_hunt_narrative_scan_queued', at: '2026-07-03T06:00:00.000Z', state: 'queued', label: 'Queued' },
      { id: 'hermes_signal_hunt_narrative_scan_running', at: '2026-07-03T06:03:00.000Z', state: 'running', label: 'Running' },
      { id: 'hermes_signal_hunt_narrative_scan_completed', at: '2026-07-03T06:20:00.000Z', state: 'completed', label: 'Completed' }
    ]
  }
];

export function summarizeHermesRuns(runs: HermesRun[]) {
  return {
    runs: runs.length,
    active_runs: runs.filter((run) => run.state === 'queued' || run.state === 'running').length,
    completed_runs: runs.filter((run) => run.state === 'completed').length,
    trust: runs.filter((run) => run.decision === 'trust').length,
    caution: runs.filter((run) => run.decision === 'caution').length,
    do_not_use_yet: runs.filter((run) => run.decision === 'do_not_use_yet').length,
    unproven: runs.filter((run) => run.decision === 'unproven').length,
    disputed: runs.filter((run) => run.decision === 'disputed').length
  };
}
