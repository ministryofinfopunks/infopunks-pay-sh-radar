export type AbundanceProofState =
  | 'receipts_present'
  | 'plausible_unproven'
  | 'hype_without_route'
  | 'dangerous_if_automated'
  | 'ready_for_agent_spend'
  | 'needs_human_validation';

export type AbundanceDecisionState = 'ready' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';

export type MachineLaborWatchCard = {
  card_id: string;
  title: string;
  category: 'ai_agents' | 'robotics' | 'automation' | 'machine_services';
  claim_surface: string;
  watch_signal: string;
  proof_state: AbundanceProofState;
  decision_state: AbundanceDecisionState;
};

export type ProofGapIndexRow = {
  state: AbundanceProofState;
  label: string;
  count: number;
  interpretation: string;
};

export type MachineWorkReceipt = {
  receipt_id: string;
  task: string;
  performer_type: 'ai_agent' | 'robot' | 'automation_service' | 'machine_wallet';
  performer_name: string;
  requester: string;
  route_used: string;
  cost_paid_usd: number | null;
  chain: 'solana' | 'base' | 'peaq' | 'offchain' | 'unknown';
  output_summary: string;
  evidence_artifacts: string[];
  validation_state: AbundanceProofState;
  human_validator: string | null;
  failure_reason: string | null;
  reputation_impact: string;
};

export type AgentSpendReadinessCard = {
  service_id: string;
  service_name: string;
  readiness_state: AbundanceDecisionState;
  payment_route: string;
  reason: string;
  required_next_receipt: string;
};

export type AbundanceClaim = {
  claim_id: string;
  claim: string;
  source_type: 'builder_demo' | 'robotics_vendor' | 'wallet_infrastructure' | 'productivity_report' | 'policy_thesis' | 'market_claim';
  proof_state: AbundanceProofState;
  decision_state: AbundanceDecisionState;
  evidence: string[];
  infopunks_interpretation: string;
};

export type AbundanceDeskPayload = {
  generated_at: string;
  title: 'Abundance Desk';
  route: '/abundance';
  narrative_route: '/narratives/abundance-desk';
  hero_copy: string;
  subcopy: string;
  thesis: string;
  machine_labor_watch: MachineLaborWatchCard[];
  proof_gap_index: ProofGapIndexRow[];
  machine_work_receipts: MachineWorkReceipt[];
  agent_spend_readiness: AgentSpendReadinessCard[];
  human_validator_layer: string[];
  abundance_claims_feed: AbundanceClaim[];
};

const generatedAt = '2026-07-02T00:00:00.000Z';

export const abundanceClaimsFeed: AbundanceClaim[] = [
  {
    claim_id: 'abd_claim_agent_paid_api_work',
    claim: 'AI agents can complete paid API work autonomously.',
    source_type: 'builder_demo',
    proof_state: 'receipts_present',
    decision_state: 'caution',
    evidence: ['preflight receipt', 'service-specific execution receipt', 'payment route policy'],
    infopunks_interpretation: 'Autonomous paid work is credible only when the route, cost, output, and validator are all attached to the claim.'
  },
  {
    claim_id: 'abd_claim_humanoid_warehouse_tasks',
    claim: 'Humanoid robots can perform repetitive warehouse tasks.',
    source_type: 'robotics_vendor',
    proof_state: 'needs_human_validation',
    decision_state: 'caution',
    evidence: ['vendor demo', 'task video', 'missing independent failure log'],
    infopunks_interpretation: 'Physical-world automation needs human validation, incident memory, and constrained deployment receipts before the claim graduates.'
  },
  {
    claim_id: 'abd_claim_wallets_route_machine_payments',
    claim: 'Autonomous wallets can route payments to machine services.',
    source_type: 'wallet_infrastructure',
    proof_state: 'ready_for_agent_spend',
    decision_state: 'ready',
    evidence: ['bounded wallet policy', 'chain route', 'pre-spend check', 'receipt requirement'],
    infopunks_interpretation: 'Machine wallets are acceptable when spend limits, routes, proof requirements, and revocation paths are explicit.'
  },
  {
    claim_id: 'abd_claim_ai_productivity_receipts',
    claim: 'AI productivity claims need receipts.',
    source_type: 'productivity_report',
    proof_state: 'plausible_unproven',
    decision_state: 'unproven',
    evidence: ['self-reported time savings', 'no task-level audit trail'],
    infopunks_interpretation: 'Productivity without task receipts is a narrative, not a ledger. Infopunks asks what changed, who checked it, and whether the loop repeated.'
  },
  {
    claim_id: 'abd_claim_uhi_machine_surplus',
    claim: 'Universal high income requires proof of machine-generated surplus.',
    source_type: 'policy_thesis',
    proof_state: 'hype_without_route',
    decision_state: 'unproven',
    evidence: ['macro thesis', 'missing surplus attribution route', 'missing distribution proof'],
    infopunks_interpretation: 'Abundance policy needs machine-output accounting. The claim is not ready until surplus can be traced from machine labor to verified distribution.'
  },
  {
    claim_id: 'abd_claim_robot_route_safety',
    claim: 'Robots can safely use live route and mapping APIs while operating.',
    source_type: 'market_claim',
    proof_state: 'dangerous_if_automated',
    decision_state: 'do_not_use_yet',
    evidence: ['navigation API surface', 'physical-world consequence risk', 'missing no-movement guard'],
    infopunks_interpretation: 'Route outputs that can affect movement require non-operational fixtures first, then constrained human-approved trials.'
  }
];

export const machineWorkReceipts: MachineWorkReceipt[] = [
  {
    receipt_id: 'mwr_agent_translation_001',
    task: 'Translate a bounded field report phrase.',
    performer_type: 'ai_agent',
    performer_name: 'infopunks-pay-sh-agent-harness',
    requester: 'field-maintenance-bot',
    route_used: 'pay.sh / Alibaba Machine Translation General',
    cost_paid_usd: null,
    chain: 'solana',
    output_summary: 'Returned a Spanish translation preview with execution latency attached.',
    evidence_artifacts: ['preflight receipt', 'service-specific execution artifact', 'repeatability pack'],
    validation_state: 'receipts_present',
    human_validator: 'validator_operations_01',
    failure_reason: null,
    reputation_impact: '+3 route confidence; payment proof still absent'
  },
  {
    receipt_id: 'mwr_robot_geocode_fixture_001',
    task: 'Resolve a public landmark geocode without commanding movement.',
    performer_type: 'robot',
    performer_name: 'delivery-bot-geocode-fixture',
    requester: 'route-risk-desk',
    route_used: 'robotic.sh / NAVER Maps fixture',
    cost_paid_usd: null,
    chain: 'unknown',
    output_summary: 'Fixture returned coordinates with no robot command and no physical movement.',
    evidence_artifacts: ['fixture receipt', 'no-physical-movement assertion', 'route-risk note'],
    validation_state: 'needs_human_validation',
    human_validator: 'validator_safety_02',
    failure_reason: null,
    reputation_impact: '+1 planning confidence; live automation remains gated'
  },
  {
    receipt_id: 'mwr_autonomous_wallet_policy_001',
    task: 'Preflight a machine wallet spend against route policy.',
    performer_type: 'machine_wallet',
    performer_name: 'did:peaq:delivery-bot-01',
    requester: 'machine-preflight',
    route_used: 'Infopunks pre-spend decision engine',
    cost_paid_usd: 0,
    chain: 'peaq',
    output_summary: 'Allowed only bounded document parsing routes and denied unsupported chains.',
    evidence_artifacts: ['policy template', 'decision receipt', 'violations list'],
    validation_state: 'ready_for_agent_spend',
    human_validator: 'validator_policy_01',
    failure_reason: null,
    reputation_impact: '+4 spend boundary confidence'
  }
];

export const machineLaborWatch: MachineLaborWatchCard[] = [
  {
    card_id: 'mlw_agents',
    title: 'AI Agents',
    category: 'ai_agents',
    claim_surface: 'Agents promise paid API work, research, translation, routing, and admin loops.',
    watch_signal: 'Receipts must connect intent, route, cost, output, and validation state.',
    proof_state: 'receipts_present',
    decision_state: 'caution'
  },
  {
    card_id: 'mlw_robotics',
    title: 'Robotics',
    category: 'robotics',
    claim_surface: 'Robots promise warehouse, delivery, inspection, and repetitive physical labor.',
    watch_signal: 'Physical claims need task logs, failure logs, safety constraints, and human validators.',
    proof_state: 'needs_human_validation',
    decision_state: 'caution'
  },
  {
    card_id: 'mlw_automation',
    title: 'Automation',
    category: 'automation',
    claim_surface: 'Automation promises fewer human operators and faster repeated workflows.',
    watch_signal: 'The proof gap is whether outputs improved, repeated, and survived edge cases.',
    proof_state: 'plausible_unproven',
    decision_state: 'unproven'
  },
  {
    card_id: 'mlw_machine_services',
    title: 'Machine Services',
    category: 'machine_services',
    claim_surface: 'Callable services promise machine-native spend, settlement, and composable labor.',
    watch_signal: 'Ready services expose safe routes, bounded costs, payment rails, and receipt hooks.',
    proof_state: 'ready_for_agent_spend',
    decision_state: 'ready'
  }
];

export const agentSpendReadiness: AgentSpendReadinessCard[] = [
  {
    service_id: 'translation-safe-phrase',
    service_name: 'Machine Translation Safe Phrase',
    readiness_state: 'ready',
    payment_route: 'pay.sh / Solana',
    reason: 'Bounded text input, low physical consequence, execution receipts available.',
    required_next_receipt: 'Attach payment evidence to repeatable execution receipts.'
  },
  {
    service_id: 'robot-geocode-fixture',
    service_name: 'Robot Geocode Fixture',
    readiness_state: 'caution',
    payment_route: 'robotic.sh / operator-defined',
    reason: 'Useful for planning, but navigation can influence physical action if connected to runtime control.',
    required_next_receipt: 'Human-approved non-operational fixture receipt with no movement.'
  },
  {
    service_id: 'humanoid-warehouse-live',
    service_name: 'Humanoid Warehouse Live Task',
    readiness_state: 'do_not_use_yet',
    payment_route: 'unknown',
    reason: 'Physical-world consequences and missing independent incident trail.',
    required_next_receipt: 'Independent task log with failure modes and human safety validator.'
  },
  {
    service_id: 'agent-productivity-suite',
    service_name: 'Agent Productivity Suite',
    readiness_state: 'unproven',
    payment_route: 'base / subscription',
    reason: 'Claimed productivity gains lack task-level receipts and counterfactuals.',
    required_next_receipt: 'Before/after workflow receipt with validated output quality.'
  },
  {
    service_id: 'disputed-surplus-oracle',
    service_name: 'Machine Surplus Oracle',
    readiness_state: 'disputed',
    payment_route: 'offchain',
    reason: 'Surplus attribution is asserted, not measured through machine labor receipts.',
    required_next_receipt: 'Auditable surplus route from machine output to distribution ledger.'
  }
];

export function buildProofGapIndex(claims: AbundanceClaim[] = abundanceClaimsFeed): ProofGapIndexRow[] {
  const states: Array<{ state: AbundanceProofState; label: string; interpretation: string }> = [
    { state: 'receipts_present', label: 'Receipts present', interpretation: 'A concrete route, cost/output trace, and evidence artifacts exist.' },
    { state: 'plausible_unproven', label: 'Plausible, unproven', interpretation: 'The claim may be true, but the task-level receipt trail is thin.' },
    { state: 'hype_without_route', label: 'Hype without route', interpretation: 'The story points at abundance without showing how work, surplus, or distribution is proven.' },
    { state: 'dangerous_if_automated', label: 'Dangerous if automated', interpretation: 'The claim can create real-world harm if routed into autonomous action too early.' },
    { state: 'ready_for_agent_spend', label: 'Ready for agent spend', interpretation: 'Policy, route, cost boundary, receipt requirement, and rollback path are visible.' },
    { state: 'needs_human_validation', label: 'Needs human validation', interpretation: 'Humans must inspect output, consequences, and dispute paths before scale.' }
  ];
  return states.map((item) => ({
    ...item,
    count: claims.filter((claim) => claim.proof_state === item.state).length
  }));
}

export function getAbundanceDeskPayload(): AbundanceDeskPayload {
  return {
    generated_at: generatedAt,
    title: 'Abundance Desk',
    route: '/abundance',
    narrative_route: '/narratives/abundance-desk',
    hero_copy: 'When machines do the work, Infopunks checks the receipts.',
    subcopy: 'AI and robots may make work optional. But abundance still needs proof: who acted, what worked, who verified it, which route was safe, and which machine deserves trust.',
    thesis: 'Infopunks is the proof, receipt, and judgment layer for the machine-labor economy.',
    machine_labor_watch: machineLaborWatch,
    proof_gap_index: buildProofGapIndex(),
    machine_work_receipts: machineWorkReceipts,
    agent_spend_readiness: agentSpendReadiness,
    human_validator_layer: [
      'Humans stop doing every task and start validating claims.',
      'Humans own consequences when machine loops fail.',
      'Humans design bounded loops, escalation paths, and rollback policies.',
      'Humans resolve disputes when receipts conflict with outcomes.'
    ],
    abundance_claims_feed: abundanceClaimsFeed
  };
}
