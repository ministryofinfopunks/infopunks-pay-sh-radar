import { z } from 'zod';
import {
  ProofCheckResultSchema,
  ProofCheckResult,
  ProofCheckInput
} from '../schemas/entities';

const SEEDED_CHECKS = [
  {
    check_id: 'check_agent_autonomy_seed',
    created_at: '2026-06-20T09:30:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/agent-autonomy-demo',
    input: 'Autonomous checkout agent claims full autonomy for vendor routing and settlement.',
    claim: 'Agent claims autonomous routing and settlement readiness.',
    claim_type: 'agent_autonomy',
    claim_summary: 'Autonomy narrative is ahead of the recorded execution receipts.',
    subject_label: 'Autonomous checkout agent',
    receipts_found: ['operator demo clip', 'sandbox invoice preview'],
    evidence_artifacts: ['artifact://proof-check/agent-autonomy-brief'],
    evidence_strength: 'weak',
    receipt_strength: 'weak_receipts',
    validation_status: 'unvalidated',
    risk_flags: ['autonomy_unproven', 'no_human_validation', 'hype_without_receipts'],
    decision_state: 'do_not_use_yet',
    share_url: '/check/check_agent_autonomy_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Agent claims autonomous routing and settlement readiness.\nDecision: DO NOT USE YET\nNo receipt, no trust.',
    evidence_summary: 'Only narrative-level receipts were matched. No repeatable route proof or human validation is attached.',
    validation_summary: 'No human validator has closed this claim yet.',
    decision_summary: 'Do not use yet because autonomy is still asserted more loudly than it is evidenced.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'No receipt, no trust.'
  },
  {
    check_id: 'check_route_pay_sh_seed',
    created_at: '2026-06-19T13:10:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/pay-sh-route-demo',
    input: 'Pay.sh market intelligence route claims production repeatability for pre-spend checks.',
    claim: 'Pay.sh route claims repeatable market intelligence performance.',
    claim_type: 'route_performance',
    claim_summary: 'Route has real receipts, but the repeatability claim still needs more validation.',
    subject_label: 'Pay.sh market intelligence route',
    receipts_found: ['2 bounded route-run receipts', '1 latency capture', '1 operator note'],
    evidence_artifacts: ['artifact://proof-check/pay-sh-route-pack'],
    evidence_strength: 'medium',
    receipt_strength: 'partial_receipts',
    validation_status: 'community_pending',
    risk_flags: ['route_not_repeatable', 'no_human_validation'],
    decision_state: 'caution',
    share_url: '/check/check_route_pay_sh_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Pay.sh route claims repeatable market intelligence performance.\nDecision: CAUTION\nNo receipt, no trust.',
    evidence_summary: 'Deterministic seeded receipts show the route can work, but repeatability proof is still partial.',
    validation_summary: 'Community review is pending and no human validator has marked the route stable.',
    decision_summary: 'Use caution because receipts exist, but repeatability is not fully closed.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'Before an agent pays, it checks Infopunks.'
  },
  {
    check_id: 'check_provider_reliability_seed',
    created_at: '2026-06-18T16:45:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/provider-reliability-demo',
    input: 'Provider says its invoice parsing route is reliable for agent spend flows.',
    claim: 'Provider claims reliable invoice parsing for agent spend flows.',
    claim_type: 'provider_reliability',
    claim_summary: 'Receipts and human review align on reliability within the seeded scope.',
    subject_label: 'Reliable receipt provider',
    receipts_found: ['3 verified execution receipts', '1 human QA note', '1 route comparison summary'],
    evidence_artifacts: ['artifact://proof-check/provider-reliability-pack'],
    evidence_strength: 'strong',
    receipt_strength: 'verified_receipts',
    validation_status: 'human_validated',
    risk_flags: [],
    decision_state: 'trust',
    share_url: '/check/check_provider_reliability_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Provider claims reliable invoice parsing for agent spend flows.\nDecision: TRUST\nNo receipt, no trust.',
    evidence_summary: 'Multiple verified receipts and one human validation note support the reliability claim.',
    validation_summary: 'Human validation is present and no active dispute is attached.',
    decision_summary: 'Trust is appropriate for this limited seeded claim scope.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'Agents can spend. Infopunks helps them judge.'
  },
  {
    check_id: 'check_machine_market_seed',
    created_at: '2026-06-17T11:05:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/machine-market-demo',
    input: 'Machine market service claims agents can use it out of the box for DePIN tasks.',
    claim: 'Machine market service claims out-of-box DePIN readiness.',
    claim_type: 'market_claim',
    claim_summary: 'The market presence is real, but safe-first operating receipts are still partial.',
    subject_label: 'Machine market service',
    receipts_found: ['listing record', 'policy map note', 'first-safe route draft'],
    evidence_artifacts: ['artifact://proof-check/machine-market-brief'],
    evidence_strength: 'medium',
    receipt_strength: 'partial_receipts',
    validation_status: 'community_pending',
    risk_flags: ['route_not_repeatable', 'unclear_provider_history'],
    decision_state: 'caution',
    share_url: '/check/check_machine_market_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Machine market service claims out-of-box DePIN readiness.\nDecision: CAUTION\nNo receipt, no trust.',
    evidence_summary: 'Evidence exists for listing and setup, but not enough repeatable service receipts for autonomous first use.',
    validation_summary: 'Validation is still community-pending.',
    decision_summary: 'Caution is appropriate until route receipts become more repeatable.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'Corrupted signal is economic risk.'
  },
  {
    check_id: 'check_token_narrative_seed',
    created_at: '2026-06-16T08:20:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/token-narrative-demo',
    input: 'Token narrative says the market has already validated the new utility story.',
    claim: 'Token narrative claims market validation without receipts.',
    claim_type: 'token_claim',
    claim_summary: 'The claim is mostly narrative momentum with minimal evidence artifacts.',
    subject_label: 'Token narrative',
    receipts_found: [],
    evidence_artifacts: [],
    evidence_strength: 'missing',
    receipt_strength: 'no_receipts',
    validation_status: 'unvalidated',
    risk_flags: ['narrative_over_evidence', 'hype_without_receipts', 'missing_source'],
    decision_state: 'unproven',
    share_url: '/check/check_token_narrative_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Token narrative claims market validation without receipts.\nDecision: UNPROVEN\nNo receipt, no trust.',
    evidence_summary: 'No inspectable receipts were attached to the narrative claim.',
    validation_summary: 'No validation trail exists.',
    decision_summary: 'Unproven because the market story currently outruns the receipts.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'The receipt layer for the agent economy.'
  },
  {
    check_id: 'check_disputed_seed',
    created_at: '2026-06-15T07:55:00.000Z',
    submitted_by: 'seed:infopunks',
    source_url: 'https://example.com/disputed-claim-demo',
    input: 'Provider partnership claim is circulating with conflicting screenshots and stale notes.',
    claim: 'Partnership claim is circulating with conflicting evidence.',
    claim_type: 'partnership_claim',
    claim_summary: 'Some evidence exists, but it is contested and should not be treated as closed.',
    subject_label: 'Partnership claim',
    receipts_found: ['1 screenshot', '1 stale note'],
    evidence_artifacts: ['artifact://proof-check/disputed-claim-note'],
    evidence_strength: 'weak',
    receipt_strength: 'weak_receipts',
    validation_status: 'disputed',
    risk_flags: ['disputed_claim', 'missing_source'],
    decision_state: 'disputed',
    share_url: '/check/check_disputed_seed',
    share_text: 'INFOPUNKS RECEIPT CHECK\nClaim: Partnership claim is circulating with conflicting evidence.\nDecision: DISPUTED\nNo receipt, no trust.',
    evidence_summary: 'Evidence exists, but the claim is actively disputed and source quality is incomplete.',
    validation_summary: 'Dispute state is open.',
    decision_summary: 'Disputed claims should not be treated as routing truth.',
    headline: 'INFOPUNKS RECEIPT CHECK',
    public_cta: 'No receipt, no trust.'
  }
] satisfies ProofCheckResult[];

export type ProofCheckRecord = z.infer<typeof ProofCheckResultSchema>;

export type CreateProofCheckInput = ProofCheckInput & {
  check_id?: string;
  created_at?: string;
  source_url?: string | null;
  submitted_by?: string | null;
};

export interface ProofCheckRepository {
  listProofChecks(): ProofCheckRecord[];
  getProofCheck(checkId: string): ProofCheckRecord | null;
  createProofCheck(input: ProofCheckRecord): ProofCheckRecord;
}

export function createInMemoryProofCheckRepository(seedChecks: ProofCheckRecord[] = SEEDED_CHECKS.map((check) => ProofCheckResultSchema.parse(check))): ProofCheckRepository {
  const state = seedChecks.slice();

  return {
    listProofChecks() {
      return state.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },
    getProofCheck(checkId) {
      return state.find((check) => check.check_id === checkId) ?? null;
    },
    createProofCheck(input) {
      const parsed = ProofCheckResultSchema.parse(input);
      state.unshift(parsed);
      return parsed;
    }
  };
}

export const proofCheckRepository = createInMemoryProofCheckRepository();
