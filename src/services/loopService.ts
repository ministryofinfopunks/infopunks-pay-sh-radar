import { createHash } from 'node:crypto';
import {
  LoopCheckInput,
  LoopCheckInputSchema,
  LoopDetail,
  LoopDetailSchema,
  LoopProofState,
  ProofDecisionState
} from '../schemas/entities';
import {
  LoopRepository,
  loopRepository
} from '../repositories/loopRepository';

type LoopProfile = {
  name: string;
  objective: string;
  hypothesis: string;
  action_taken: string;
  evidence_artifacts: string[];
  score: number;
  failure_reason: string | null;
  proof_state: LoopProofState;
  decision_state: ProofDecisionState;
  linked_check_id: string;
};

function stableId(input: string) {
  return `loop_${createHash('sha1').update(input).digest('hex').slice(0, 12)}`;
}

function normalizeInput(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

function profileFor(input: string, linkedCheckId?: string): LoopProfile {
  const normalized = normalizeInput(input);

  if (/(machine|service|depin)/i.test(normalized)) {
    return {
      name: 'Generated Machine Service Loop',
      objective: 'Expose whether machine service loops are actually ready for route use.',
      hypothesis: 'Machine loops need first-safe proof before they become autonomous defaults.',
      action_taken: 'Linked the input to a machine route evidence loop and preserved caution.',
      evidence_artifacts: ['artifact://loops/generated-machine-loop'],
      score: 63,
      failure_reason: 'Service receipts are still partial.',
      proof_state: 'partial',
      decision_state: 'caution',
      linked_check_id: linkedCheckId ?? 'check_machine_market_seed'
    };
  }

  if (/(pre-spend|route|pay\.sh)/i.test(normalized)) {
    return {
      name: 'Seeded Route Discipline Loop',
      objective: 'Convert route checks into repeatable memory before autonomous spend.',
      hypothesis: 'Receipt-backed route loops create safer default spend behavior.',
      action_taken: 'Matched the input to a pre-spend route discipline loop and linked its proof receipt.',
      evidence_artifacts: ['artifact://loops/generated-route-discipline'],
      score: 76,
      failure_reason: null,
      proof_state: 'partial',
      decision_state: 'caution',
      linked_check_id: linkedCheckId ?? 'check_route_pay_sh_seed'
    };
  }

  if (/(provider|trust|reliab)/i.test(normalized)) {
    return {
      name: 'Generated Provider Trust Loop',
      objective: 'Keep provider trust memory attached to inspectable receipts.',
      hypothesis: 'Loops with reliable provider proof should converge toward trust.',
      action_taken: 'Mapped the input into a provider-trust loop and reused the strongest linked proof receipt.',
      evidence_artifacts: ['artifact://loops/generated-provider-trust'],
      score: 84,
      failure_reason: null,
      proof_state: 'verified',
      decision_state: 'trust',
      linked_check_id: linkedCheckId ?? 'check_provider_reliability_seed'
    };
  }

  if (/(carbon|offset|integrity|narrative)/i.test(normalized)) {
    return {
      name: 'Generated Claim Integrity Loop',
      objective: 'Force narrative-heavy integrity claims through receipt discipline.',
      hypothesis: 'Integrity loops should prevent narrative from outrunning evidence.',
      action_taken: 'Stored the claim as public memory and linked it to an unproven proof receipt.',
      evidence_artifacts: ['artifact://loops/generated-claim-integrity'],
      score: 33,
      failure_reason: 'Narrative evidence remains stronger than receipt evidence.',
      proof_state: 'unproven',
      decision_state: 'unproven',
      linked_check_id: linkedCheckId ?? 'check_token_narrative_seed'
    };
  }

  return {
    name: 'Generated Failure Memory Loop',
    objective: 'Store loop failure in public memory before retries compound risk.',
    hypothesis: 'Loop systems improve when failure reasons become explicit public artifacts.',
    action_taken: 'Recorded the loop as a failure-memory candidate and linked it to a do-not-use-yet proof receipt.',
    evidence_artifacts: ['artifact://loops/generated-failure-memory'],
    score: 40,
    failure_reason: 'The loop claim is still under-evidenced for autonomous use.',
    proof_state: 'failure_recorded',
    decision_state: 'do_not_use_yet',
    linked_check_id: linkedCheckId ?? 'check_agent_autonomy_seed'
  };
}

export function createLoopService(repository: LoopRepository = loopRepository) {
  return {
    listLoops() {
      return repository.listLoops();
    },
    getLoop(loopId: string) {
      return repository.getLoop(loopId) ?? undefined;
    },
    createLoopCheck(input: LoopCheckInput): LoopDetail {
      const parsedInput = LoopCheckInputSchema.parse(input);
      const profile = profileFor(parsedInput.input, parsedInput.linked_check_id);
      const id = stableId(parsedInput.input);
      const now = new Date().toISOString();
      const loop = LoopDetailSchema.parse({
        id,
        ...profile,
        runs: [{
          run_id: `${id}_run_001`,
          started_at: now,
          completed_at: now,
          hypothesis: profile.hypothesis,
          action_taken: profile.action_taken,
          evidence_artifacts: profile.evidence_artifacts,
          score: profile.score,
          failure_reason: profile.failure_reason,
          proof_state: profile.proof_state,
          decision_state: profile.decision_state,
          linked_check_id: profile.linked_check_id
        }]
      });

      const existing = repository.getLoop(loop.id);
      if (existing) return existing;
      return repository.createLoop(loop);
    }
  };
}
