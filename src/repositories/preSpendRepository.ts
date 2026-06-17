import { z } from 'zod';
import {
  ClaimChallengeCreateRequestSchema,
  ClaimChallengeSchema,
  ClaimCreateRequestSchema,
  ClaimSchema,
  HumanValidationSubmissionSchema,
  PreSpendReceiptSchema,
  ProviderIntelligenceRecordSchema,
  RouteIntelligenceSchema,
  ServiceDossierSchema
} from '../schemas/entities';
import { createPreSpendSeedState, type PreSpendSeedState } from './preSpendSeedData';

export type RouteIntelligenceRecord = z.infer<typeof RouteIntelligenceSchema>;
export type ProviderIntelligence = z.infer<typeof ProviderIntelligenceRecordSchema>;
export type ServiceDossierRecord = z.infer<typeof ServiceDossierSchema>;
export type PreSpendReceiptRecord = z.infer<typeof PreSpendReceiptSchema>;
export type HumanValidationSubmissionRecord = z.infer<typeof HumanValidationSubmissionSchema>;
export type ClaimRecord = z.infer<typeof ClaimSchema>;
export type ClaimChallengeRecord = z.infer<typeof ClaimChallengeSchema>;

export type CreatePreSpendReceiptInput = Omit<PreSpendReceiptRecord, 'receipt_id' | 'timestamp'> & {
  receipt_id?: string;
  timestamp?: string;
};
export type SubmitClaimInput = z.infer<typeof ClaimCreateRequestSchema> & {
  claim_id?: string;
  created_at?: string;
};
export type SubmitClaimChallengeInput = z.infer<typeof ClaimChallengeCreateRequestSchema> & {
  claim_id?: string;
  challenge_id?: string;
  created_at?: string;
};

export type PreSpendRepositoryMetricsState = PreSpendSeedState['metrics'];

export interface PreSpendRepository {
  listRoutes(): RouteIntelligenceRecord[];
  getRoute(routeId: string): RouteIntelligenceRecord | null;
  listProviders(): ProviderIntelligence[];
  getProvider(providerId: string): ProviderIntelligence | null;
  listServices(): ServiceDossierRecord[];
  getService(serviceId: string): ServiceDossierRecord | null;
  listReceipts(): PreSpendReceiptRecord[];
  getReceipt(receiptId: string): PreSpendReceiptRecord | null;
  createReceipt(input: CreatePreSpendReceiptInput): PreSpendReceiptRecord;
  listValidations(): HumanValidationSubmissionRecord[];
  getValidationsForTarget(targetType: HumanValidationSubmissionRecord['target_type'], targetId: string): HumanValidationSubmissionRecord[];
  submitValidation(input: HumanValidationSubmissionRecord): HumanValidationSubmissionRecord;
  listClaims(): ClaimRecord[];
  getClaim(claimId: string): ClaimRecord | null;
  submitClaim(input: SubmitClaimInput): ClaimRecord;
  listChallenges(): ClaimChallengeRecord[];
  getChallenge(challengeId: string): ClaimChallengeRecord | null;
  getChallengesForClaim(claimId: string): ClaimChallengeRecord[];
  submitClaimChallenge(input: SubmitClaimChallengeInput): ClaimChallengeRecord;
  getMetricsState(): PreSpendRepositoryMetricsState;
  recordPreSpendCheck(decision: 'approved' | 'approved_with_warning' | 'use_with_caution' | 'requires_human_approval' | 'do_not_use'): void;
}

export function createInMemoryPreSpendRepository(seedState: PreSpendSeedState = createPreSpendSeedState()): PreSpendRepository {
  const state = seedState;
  let receiptSequence = state.receipts.reduce((max, receipt) => {
    const match = /^receipt_(\d+)$/.exec(receipt.receipt_id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  let claimSequence = state.claims.reduce((max, claim) => {
    const match = /^claim_(\d+)$/.exec(claim.claim_id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  let challengeSequence = state.claimChallenges.reduce((max, challenge) => {
    const match = /^challenge_(\d+)$/.exec(challenge.challenge_id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  function nextReceiptId() {
    const receiptId = `receipt_${String(receiptSequence).padStart(3, '0')}`;
    receiptSequence += 1;
    return receiptId;
  }

  function nextClaimId() {
    const claimId = `claim_${String(claimSequence).padStart(3, '0')}`;
    claimSequence += 1;
    return claimId;
  }

  function nextChallengeId() {
    const challengeId = `challenge_${String(challengeSequence).padStart(3, '0')}`;
    challengeSequence += 1;
    return challengeId;
  }

  return {
    listRoutes: () => state.routes,
    getRoute: (routeId) => state.routes.find((route) => route.route_id === routeId) ?? null,
    listProviders: () => state.providers,
    getProvider: (providerId) => state.providers.find((provider) => provider.provider_id === providerId) ?? null,
    listServices: () => state.services,
    getService: (serviceId) => state.services.find((service) => service.service_id === serviceId) ?? null,
    listReceipts: () => state.receipts.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    getReceipt: (receiptId) => state.receipts.find((receipt) => receipt.receipt_id === receiptId) ?? null,
    createReceipt(input) {
      const receipt = PreSpendReceiptSchema.parse({
        ...input,
        receipt_id: input.receipt_id ?? nextReceiptId(),
        timestamp: input.timestamp ?? new Date().toISOString()
      });
      state.receipts.unshift(receipt);

      const route = state.routes.find((item) => item.route_id === receipt.route_id);
      if (route) {
        route.receipt_references = [receipt.receipt_id, ...route.receipt_references].slice(0, 10);
        if (receipt.status === 'succeeded') route.last_successful_run = receipt.timestamp;
        else route.last_failed_run = receipt.timestamp;
      }

      const provider = state.providers.find((item) => item.provider_id === receipt.provider_id);
      if (provider) provider.recent_receipt_count += 1;

      return receipt;
    },
    listValidations: () => state.validations,
    getValidationsForTarget(targetType, targetId) {
      return state.validations.filter((validation) => validation.target_type === targetType && validation.target_id === targetId);
    },
    submitValidation(input) {
      const validation = HumanValidationSubmissionSchema.parse(input);
      state.validations.unshift(validation);
      state.metrics.human_validations_submitted += 1;

      if (validation.target_type === 'receipt') {
        const receipt = state.receipts.find((item) => item.receipt_id === validation.target_id);
        if (receipt) {
          receipt.validation_state = validation.validation_state;
          receipt.confidence_delta += validation.confidence_adjustment;
          if (validation.human_notes) receipt.human_notes = [...receipt.human_notes, validation.human_notes];
        }
      }

      if (validation.target_type === 'provider') {
        const provider = state.providers.find((item) => item.provider_id === validation.target_id);
        if (provider) {
          provider.human_validation_status = validation.validation_state;
          if (validation.output_quality_note) provider.output_quality_notes.push(validation.output_quality_note);
          if (validation.blocker_note) provider.known_risks.push(validation.blocker_note);
          if (validation.dispute_note) provider.dispute_history.push(validation.dispute_note);
        }
      }

      if (validation.target_type === 'route') {
        const route = state.routes.find((item) => item.route_id === validation.target_id);
        if (route && validation.blocker_note) route.known_blockers.push(validation.blocker_note);
      }

      if (validation.target_type === 'service') {
        const service = state.services.find((item) => item.service_id === validation.target_id);
        if (service) {
          service.benchmark_readiness = validation.validation_state;
          if (validation.blocker_note) service.known_blockers.push(validation.blocker_note);
        }
      }

      return validation;
    },
    listClaims: () => state.claims.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    getClaim: (claimId) => state.claims.find((claim) => claim.claim_id === claimId) ?? null,
    submitClaim(input) {
      const claim = ClaimSchema.parse({
        ...input,
        claim_id: input.claim_id ?? nextClaimId(),
        created_at: input.created_at ?? new Date().toISOString(),
        challenge_count: 0
      });
      state.claims.unshift(claim);
      return claim;
    },
    listChallenges: () => state.claimChallenges.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    getChallenge: (challengeId) => state.claimChallenges.find((challenge) => challenge.challenge_id === challengeId) ?? null,
    getChallengesForClaim(claimId) {
      return state.claimChallenges
        .filter((challenge) => challenge.claim_id === claimId)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },
    submitClaimChallenge(input) {
      const challenge = ClaimChallengeSchema.parse({
        ...input,
        claim_id: input.claim_id,
        challenge_id: input.challenge_id ?? nextChallengeId(),
        created_at: input.created_at ?? new Date().toISOString()
      });
      state.claimChallenges.unshift(challenge);
      const claim = state.claims.find((item) => item.claim_id === challenge.claim_id);
      if (claim) {
        claim.challenge_count += 1;
        if (claim.status === 'submitted' || claim.status === 'supported') claim.status = 'challenged';
        if (claim.validation_state === 'human_validated') claim.validation_state = 'disputed';
        if (challenge.human_notes.length) claim.human_notes = [...claim.human_notes, ...challenge.human_notes];
      }
      return challenge;
    },
    getMetricsState: () => state.metrics,
    recordPreSpendCheck(decision) {
      state.metrics.pre_spend_checks_completed += 1;
      if (decision === 'do_not_use') state.metrics.failed_routes_avoided += 1;
    }
  };
}

export const createPreSpendRepository = createInMemoryPreSpendRepository;

export const preSpendRepository = createInMemoryPreSpendRepository();
