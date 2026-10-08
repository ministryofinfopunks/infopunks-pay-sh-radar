import { PreSpendCheckResponseSchema } from '../../src/schemas/entities';

export const request = { agent_id: 'agent', intent: 'quote', budget: 1, risk_tolerance: 'low' as const, preferred_settlement: 'stablecoin', required_confidence: 80, subject_id: 'provider_test' };
export const facts = { catalog_live: true, identity_resolved: true, required_proof_complete: true, intent_satisfied: true, constraints_satisfied: true,
  confidence: 90, deterministic_veto: false, bounded_test_allowed: false, max_cost: 0.1, asset: 'USDC', settlement: 'stablecoin',
  route_id: 'route_test', decision_state: 'approved', reasons: ['Reviewed scoped proof supports the requested action.'] };
export const legacy = PreSpendCheckResponseSchema.parse({ intent: 'quote', decision: 'use_with_caution', recommended_route: 'route_test', confidence_score: 0, risk_level: 'low', estimated_cost: '0.1 USDC', last_successful_run: null, known_blockers: [], requires_human_approval: false, receipt_references: [], safer_alternatives: [], do_not_use: [], rationale: ['Legacy intake cannot authorize.'] });
