import {
  LoopDetail,
  LoopDetailSchema,
  LoopCheckInput
} from '../schemas/entities';

const SEEDED_LOOPS = [
  {
    id: 'loop_pre_spend_route',
    name: 'Pre-Spend API Route Loop',
    objective: 'Keep pre-spend route decisions tied to receipt-backed evidence before autonomous spend.',
    hypothesis: 'If every pre-spend route decision is checked against receipts, agents avoid silent bad spend.',
    action_taken: 'Ran deterministic route checks, linked route evidence, and generated a public proof receipt.',
    evidence_artifacts: ['artifact://loops/pre-spend-route-ledger', 'artifact://loops/pre-spend-route-memory'],
    score: 88,
    failure_reason: null,
    proof_state: 'verified',
    decision_state: 'trust',
    linked_check_id: 'check_route_pay_sh_seed',
    runs: [{
      run_id: 'loop_run_pre_spend_route_001',
      started_at: '2026-06-20T10:00:00.000Z',
      completed_at: '2026-06-20T10:04:00.000Z',
      hypothesis: 'Receipt-backed route checks improve first-pass routing discipline.',
      action_taken: 'Compared pre-spend route receipts against current route narrative and linked the strongest proof receipt.',
      evidence_artifacts: ['artifact://loops/pre-spend-route-ledger'],
      score: 88,
      failure_reason: null,
      proof_state: 'verified',
      decision_state: 'trust',
      linked_check_id: 'check_route_pay_sh_seed'
    }]
  },
  {
    id: 'loop_provider_trust',
    name: 'Provider Trust Loop',
    objective: 'Turn provider reliability observations into reusable trust memory.',
    hypothesis: 'If providers accumulate validated receipts, future routing becomes safer and faster.',
    action_taken: 'Scored seeded provider reliability evidence and attached a strong proof receipt.',
    evidence_artifacts: ['artifact://loops/provider-trust-pack'],
    score: 92,
    failure_reason: null,
    proof_state: 'verified',
    decision_state: 'trust',
    linked_check_id: 'check_provider_reliability_seed',
    runs: [{
      run_id: 'loop_run_provider_trust_001',
      started_at: '2026-06-19T16:10:00.000Z',
      completed_at: '2026-06-19T16:16:00.000Z',
      hypothesis: 'Validated provider receipts reduce blind vendor trust.',
      action_taken: 'Aggregated seeded provider receipts and human notes into a deterministic trust decision.',
      evidence_artifacts: ['artifact://loops/provider-trust-pack'],
      score: 92,
      failure_reason: null,
      proof_state: 'verified',
      decision_state: 'trust',
      linked_check_id: 'check_provider_reliability_seed'
    }]
  },
  {
    id: 'loop_failure_memory',
    name: 'Failure Memory Loop',
    objective: 'Record failures so agents stop repeating bad paths.',
    hypothesis: 'If failure reasons are written into public memory, loop quality improves even before perfect receipts exist.',
    action_taken: 'Captured weak autonomy evidence, attached failure notes, and routed the claim into public caution memory.',
    evidence_artifacts: ['artifact://loops/failure-memory-journal', 'artifact://loops/autonomy-failure-note'],
    score: 41,
    failure_reason: 'Autonomy claim is still louder than the recorded evidence.',
    proof_state: 'failure_recorded',
    decision_state: 'do_not_use_yet',
    linked_check_id: 'check_agent_autonomy_seed',
    runs: [{
      run_id: 'loop_run_failure_memory_001',
      started_at: '2026-06-18T08:00:00.000Z',
      completed_at: '2026-06-18T08:06:00.000Z',
      hypothesis: 'Failure memory should become public before the same loop is retried.',
      action_taken: 'Stored the failure reason, linked the autonomy proof receipt, and kept the decision at do not use yet.',
      evidence_artifacts: ['artifact://loops/failure-memory-journal'],
      score: 41,
      failure_reason: 'Autonomy claim is still louder than the recorded evidence.',
      proof_state: 'failure_recorded',
      decision_state: 'do_not_use_yet',
      linked_check_id: 'check_agent_autonomy_seed'
    }]
  },
  {
    id: 'loop_machine_service_route',
    name: 'Machine Service Route Loop',
    objective: 'Test whether machine-service route surfaces are safe enough for first use.',
    hypothesis: 'If first-safe machine routes are tracked as loops, machine routing becomes inspectable before execution.',
    action_taken: 'Mapped seeded machine route evidence to a proof receipt and left the loop in caution.',
    evidence_artifacts: ['artifact://loops/machine-service-route-map', 'artifact://loops/first-safe-route-draft'],
    score: 67,
    failure_reason: 'Repeatable service receipts are still partial.',
    proof_state: 'partial',
    decision_state: 'caution',
    linked_check_id: 'check_machine_market_seed',
    runs: [{
      run_id: 'loop_run_machine_service_route_001',
      started_at: '2026-06-17T11:00:00.000Z',
      completed_at: '2026-06-17T11:09:00.000Z',
      hypothesis: 'Machine service loops need safe-first proof before autonomous execution.',
      action_taken: 'Linked machine route scaffolding to the DePIN-market proof receipt.',
      evidence_artifacts: ['artifact://loops/machine-service-route-map'],
      score: 67,
      failure_reason: 'Repeatable service receipts are still partial.',
      proof_state: 'partial',
      decision_state: 'caution',
      linked_check_id: 'check_machine_market_seed'
    }]
  },
  {
    id: 'loop_carbon_claim_integrity',
    name: 'Carbon Claim Integrity Loop',
    objective: 'Force environmental market claims through a receipt discipline before they become routing memory.',
    hypothesis: 'If carbon and integrity claims are checked like other market narratives, narrative premium decays into evidence discipline.',
    action_taken: 'Marked the narrative as unproven, preserved the missing-source warning, and kept the loop public.',
    evidence_artifacts: ['artifact://loops/carbon-claim-watchlist'],
    score: 29,
    failure_reason: 'Narrative outruns receipts and the claim source remains incomplete.',
    proof_state: 'unproven',
    decision_state: 'unproven',
    linked_check_id: 'check_token_narrative_seed',
    runs: [{
      run_id: 'loop_run_carbon_claim_integrity_001',
      started_at: '2026-06-16T07:30:00.000Z',
      completed_at: '2026-06-16T07:35:00.000Z',
      hypothesis: 'Claim integrity loops should expose narrative-over-evidence states in public.',
      action_taken: 'Attached the token-narrative style proof receipt to a carbon-integrity memory loop.',
      evidence_artifacts: ['artifact://loops/carbon-claim-watchlist'],
      score: 29,
      failure_reason: 'Narrative outruns receipts and the claim source remains incomplete.',
      proof_state: 'unproven',
      decision_state: 'unproven',
      linked_check_id: 'check_token_narrative_seed'
    }]
  }
] satisfies LoopDetail[];

export interface LoopRepository {
  listLoops(): LoopDetail[];
  getLoop(loopId: string): LoopDetail | null;
  createLoop(loop: LoopDetail): LoopDetail;
}

export function createInMemoryLoopRepository(seedLoops: LoopDetail[] = SEEDED_LOOPS.map((loop) => LoopDetailSchema.parse(loop))): LoopRepository {
  const state = seedLoops.slice();

  return {
    listLoops() {
      return state.slice();
    },
    getLoop(loopId) {
      return state.find((loop) => loop.id === loopId) ?? null;
    },
    createLoop(loop) {
      const parsed = LoopDetailSchema.parse(loop);
      state.unshift(parsed);
      return parsed;
    }
  };
}

export const loopRepository = createInMemoryLoopRepository();

export type CreateLoopInput = LoopCheckInput;
