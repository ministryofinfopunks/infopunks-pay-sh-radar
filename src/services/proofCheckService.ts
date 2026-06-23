import { createHash } from 'node:crypto';
import {
  ProofCheckInput,
  ProofCheckInputSchema,
  ProofCheckResult,
  ProofCheckResultSchema,
  ProofClaimType,
  ProofDecisionState,
  ProofRiskFlag,
  ProofValidationStatus
} from '../schemas/entities';
import {
  ProofCheckRepository,
  proofCheckRepository
} from '../repositories/proofCheckRepository';

type MatchProfile = {
  claimType: ProofClaimType;
  subjectLabel: string;
  claim: string;
  claimSummary: string;
  receiptsFound: string[];
  evidenceArtifacts: string[];
  validationStatus: ProofValidationStatus;
  riskFlags: ProofRiskFlag[];
};

function normalizeInput(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

function detectClaimType(text: string): ProofClaimType {
  if (/(autonom|agent)/i.test(text)) return 'agent_autonomy';
  if (/(route|latency|uptime|p95|endpoint|api)/i.test(text)) return 'route_performance';
  if (/(provider|reliab|vendor|service history)/i.test(text)) return 'provider_reliability';
  if (/(token|ticker|fdv|market cap)/i.test(text)) return 'token_claim';
  if (/(partner|integration|collab)/i.test(text)) return 'partnership_claim';
  if (/(revenue|arr|mrr|gmv)/i.test(text)) return 'revenue_claim';
  if (/(market|depin|machine|network)/i.test(text)) return 'market_claim';
  return 'generic_claim';
}

function deriveProfile(input: string, sourceUrl?: string): MatchProfile {
  const normalized = normalizeInput(input);
  const claimType = detectClaimType(normalized);
  const base: MatchProfile = {
    claimType,
    subjectLabel: normalized.slice(0, 72),
    claim: normalized,
    claimSummary: 'Evidence intake remains limited and deterministic in this MVP.',
    receiptsFound: [],
    evidenceArtifacts: [],
    validationStatus: 'unvalidated',
    riskFlags: []
  };

  if (claimType === 'agent_autonomy') {
    const riskFlags: ProofRiskFlag[] = ['autonomy_unproven', 'no_human_validation'];
    if (!sourceUrl) riskFlags.push('missing_source');
    return {
      ...base,
      subjectLabel: 'Agent autonomy claim',
      claim: 'Agent claims autonomous execution readiness.',
      claimSummary: 'Autonomy claims require route receipts, not just screenshots or narrative demos.',
      receiptsFound: normalized.includes('receipt') ? ['1 attached demo receipt'] : [],
      evidenceArtifacts: normalized.includes('wallet') ? ['artifact://proof-check/wallet-trace-note'] : [],
      riskFlags
    };
  }

  if (claimType === 'route_performance') {
    return {
      ...base,
      subjectLabel: 'Route performance claim',
      claim: 'Route claims repeatable performance.',
      claimSummary: 'Performance claims need receipts plus repeatability evidence.',
      receiptsFound: ['1 deterministic route receipt', ...(normalized.includes('pay.sh') ? ['1 pay.sh route note'] : [])],
      evidenceArtifacts: ['artifact://proof-check/route-performance-brief'],
      validationStatus: 'community_pending',
      riskFlags: ['route_not_repeatable', 'no_human_validation']
    };
  }

  if (claimType === 'provider_reliability') {
    const humanValidated = /(validated|verified|reviewed)/i.test(normalized);
    return {
      ...base,
      subjectLabel: 'Provider reliability claim',
      claim: 'Provider claims reliable execution.',
      claimSummary: 'Provider reliability claims become stronger when validated receipts exist.',
      receiptsFound: ['2 provider receipts', ...(humanValidated ? ['1 validation note'] : [])],
      evidenceArtifacts: ['artifact://proof-check/provider-reliability-note'],
      validationStatus: humanValidated ? 'human_validated' : 'community_pending',
      riskFlags: humanValidated ? [] : ['unclear_provider_history']
    };
  }

  if (claimType === 'market_claim') {
    return {
      ...base,
      subjectLabel: 'Market claim',
      claim: 'Market or project claims production readiness.',
      claimSummary: 'Market presence is not the same thing as repeatable execution evidence.',
      receiptsFound: normalized.includes('wallet') ? ['1 wallet mention'] : ['1 listing note'],
      evidenceArtifacts: ['artifact://proof-check/market-claim-note'],
      validationStatus: 'community_pending',
      riskFlags: ['unclear_provider_history', 'route_not_repeatable']
    };
  }

  if (claimType === 'token_claim') {
    const riskFlags: ProofRiskFlag[] = ['narrative_over_evidence', 'hype_without_receipts'];
    if (!sourceUrl) riskFlags.push('missing_source');
    return {
      ...base,
      subjectLabel: 'Token claim',
      claim: 'Token narrative claims validation.',
      claimSummary: 'Token claims often arrive as narrative before receipts.',
      riskFlags
    };
  }

  if (claimType === 'partnership_claim') {
    const disputed = /(dispute|fake|conflict|conflicting)/i.test(normalized);
    return {
      ...base,
      subjectLabel: 'Partnership claim',
      claim: 'Partnership claim is being circulated.',
      claimSummary: disputed ? 'The partnership claim is disputed by the available seeded signals.' : 'Partnership claims need sources and receipts to become usable.',
      receiptsFound: disputed ? ['1 conflicting screenshot'] : ['1 announcement link'],
      evidenceArtifacts: disputed ? ['artifact://proof-check/partnership-dispute-note'] : [],
      validationStatus: disputed ? 'disputed' : 'unvalidated',
      riskFlags: disputed ? ['disputed_claim', 'missing_source'] : ['missing_source']
    };
  }

  if (claimType === 'revenue_claim') {
    return {
      ...base,
      subjectLabel: 'Revenue claim',
      claim: 'Revenue claim is being circulated.',
      claimSummary: 'Revenue claims need receipts, source windows, and validation.',
      riskFlags: ['hype_without_receipts', 'missing_source']
    };
  }

  return {
    ...base,
    subjectLabel: 'Generic claim',
    claim: 'Generic claim needs evidence intake.',
    claimSummary: 'Generic claims stay unproven until receipts or validations appear.',
    riskFlags: ['missing_source', 'hype_without_receipts']
  };
}

function evidenceStrength(profile: MatchProfile) {
  if (profile.validationStatus === 'disputed') return 'weak' as const;
  const receiptCount = profile.receiptsFound.length;
  const artifactCount = profile.evidenceArtifacts.length;
  if (receiptCount >= 3 || (receiptCount >= 2 && profile.validationStatus === 'human_validated')) return 'strong' as const;
  if (receiptCount >= 1 || artifactCount >= 1) return 'medium' as const;
  if (profile.riskFlags.length) return 'missing' as const;
  return 'weak' as const;
}

function receiptStrength(profile: MatchProfile) {
  if (profile.validationStatus === 'human_validated' && profile.receiptsFound.length >= 2) return 'verified_receipts' as const;
  if (profile.receiptsFound.length >= 1) return 'partial_receipts' as const;
  if (profile.evidenceArtifacts.length >= 1) return 'weak_receipts' as const;
  return 'no_receipts' as const;
}

function decide(profile: MatchProfile): ProofDecisionState {
  const receipts = receiptStrength(profile);
  if (profile.riskFlags.includes('disputed_claim') || profile.validationStatus === 'disputed') return 'disputed';
  if (receipts === 'no_receipts' && profile.validationStatus === 'unvalidated') return profile.claimType === 'generic_claim' ? 'unproven' : 'do_not_use_yet';
  if (receipts === 'partial_receipts' && profile.validationStatus !== 'human_validated') return 'caution';
  if (receipts === 'verified_receipts' && profile.validationStatus === 'human_validated') return 'trust';
  if (profile.claimType === 'generic_claim') return 'unproven';
  return 'unproven';
}

function stableId(input: string, sourceUrl?: string) {
  const digest = createHash('sha1').update(`${input}|${sourceUrl ?? ''}`).digest('hex').slice(0, 12);
  return `check_${digest}`;
}

function decisionLabel(decision: ProofDecisionState) {
  if (decision === 'do_not_use_yet') return 'DO NOT USE YET';
  return decision.toUpperCase().replaceAll('_', ' ');
}

function publicCta(decision: ProofDecisionState) {
  if (decision === 'trust') return 'Agents can spend. Infopunks helps them judge.';
  if (decision === 'caution') return 'Before an agent pays, it checks Infopunks.';
  if (decision === 'do_not_use_yet') return 'Do not use yet.';
  return 'No receipt, no trust.';
}

export function createProofCheckService(repository: ProofCheckRepository = proofCheckRepository) {
  return {
    createProofCheck(input: ProofCheckInput): ProofCheckResult {
      const parsedInput = ProofCheckInputSchema.parse(input);
      const profile = deriveProfile(parsedInput.input, parsedInput.sourceUrl);
      const result = ProofCheckResultSchema.parse({
        check_id: stableId(parsedInput.input, parsedInput.sourceUrl),
        created_at: new Date().toISOString(),
        submitted_by: parsedInput.submittedBy ?? null,
        source_url: parsedInput.sourceUrl ?? null,
        input: normalizeInput(parsedInput.input),
        claim: profile.claim,
        claim_type: profile.claimType,
        claim_summary: profile.claimSummary,
        subject_label: profile.subjectLabel,
        receipts_found: profile.receiptsFound,
        evidence_artifacts: profile.evidenceArtifacts,
        evidence_strength: evidenceStrength(profile),
        receipt_strength: receiptStrength(profile),
        validation_status: profile.validationStatus,
        risk_flags: profile.riskFlags,
        decision_state: decide(profile),
        share_url: `/check/${stableId(parsedInput.input, parsedInput.sourceUrl)}`,
        share_text: `INFOPUNKS RECEIPT CHECK\nClaim: ${profile.claim}\nDecision: ${decisionLabel(decide(profile))}\nNo receipt, no trust.`,
        evidence_summary: profile.receiptsFound.length
          ? `${profile.receiptsFound.length} seeded receipt signal${profile.receiptsFound.length === 1 ? '' : 's'} matched this claim.`
          : 'No seeded receipt matches were found for this claim.',
        validation_summary: profile.validationStatus === 'human_validated'
          ? 'Human validation exists.'
          : profile.validationStatus === 'community_pending'
            ? 'Community validation is still pending.'
            : profile.validationStatus === 'disputed'
              ? 'Validation is disputed.'
              : 'No validation is attached yet.',
        decision_summary: `${decisionLabel(decide(profile))} because the current receipt layer does not fully close this claim.`,
        headline: 'INFOPUNKS RECEIPT CHECK',
        public_cta: publicCta(decide(profile))
      });

      const existing = repository.getProofCheck(result.check_id);
      if (existing) return existing;
      return repository.createProofCheck(result);
    },
    getProofCheck(checkId: string) {
      return repository.getProofCheck(checkId) ?? undefined;
    },
    listProofChecks() {
      return repository.listProofChecks();
    }
  };
}
