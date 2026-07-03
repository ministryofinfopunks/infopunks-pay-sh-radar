import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import {
  buildHermesReputationLedger,
  getHermesReputationEntry,
  type HermesReputationLedgerEntry,
  type HermesReputationState
} from './hermesReputationLedger';

export type HermesPreSpendDecisionState =
  | 'proceed'
  | 'proceed_with_caution'
  | 'test_spend_first'
  | 'do_not_spend'
  | 'insufficient_evidence';

export type HermesPreSpendRequiredAction =
  | 'none'
  | 'run_small_test_spend'
  | 'request_more_evidence'
  | 'use_fallback_route'
  | 'do_not_use_provider'
  | 'manual_review_required';

export type HermesPreSpendDecisionInput = {
  route_id?: string;
  provider_id?: string;
  service_id?: string;
  amount_usd?: number;
  payment_rail?: string;
  chain?: string;
  agent_type?: string;
  objective?: string;
};

export type HermesPreSpendRiskFactor = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  label: string;
  detail: string;
  source: 'provider_reputation' | 'route_reputation' | 'service_reputation' | 'amount' | 'evidence' | 'unknown';
};

export type HermesPreSpendDecisionInputReference = {
  kind: 'reputation_entry' | 'receipt' | 'claim' | 'run';
  id: string;
  target_type?: string;
  target_id?: string;
  summary: string;
};

export type HermesPreSpendDecision = {
  id: string;
  input: HermesPreSpendDecisionInput;
  decision: HermesPreSpendDecisionState;
  confidence: number;
  reason: string;
  required_action: HermesPreSpendRequiredAction;
  risk_factors: HermesPreSpendRiskFactor[];
  reputation_inputs: HermesPreSpendDecisionInputReference[];
  receipt_inputs: HermesPreSpendDecisionInputReference[];
  claim_inputs: HermesPreSpendDecisionInputReference[];
  run_inputs: HermesPreSpendDecisionInputReference[];
  ledger_state: {
    provider_state?: string;
    route_state?: string;
    service_state?: string;
    provider_score?: number;
    route_score?: number;
    service_score?: number;
  };
  generated_at: string;
};

type MatchedEntries = {
  provider?: HermesReputationLedgerEntry;
  route?: HermesReputationLedgerEntry;
  service?: HermesReputationLedgerEntry;
};

type DecisionDraft = Pick<HermesPreSpendDecision, 'decision' | 'required_action' | 'reason'>;

export const HERMES_PRE_SPEND_DECISION_EXAMPLE_INPUT: HermesPreSpendDecisionInput = {
  route_id: 'route_pay_sh_market_research_01',
  provider_id: 'provider_pay_sh_lattice',
  service_id: 'service_market_research',
  amount_usd: 25,
  payment_rail: 'x402',
  chain: 'base'
};

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeInput(input: HermesPreSpendDecisionInput): HermesPreSpendDecisionInput {
  return {
    route_id: normalizeString(input.route_id),
    provider_id: normalizeString(input.provider_id),
    service_id: normalizeString(input.service_id),
    amount_usd: typeof input.amount_usd === 'number' && Number.isFinite(input.amount_usd) ? Number(input.amount_usd.toFixed(2)) : undefined,
    payment_rail: normalizeString(input.payment_rail),
    chain: normalizeString(input.chain),
    agent_type: normalizeString(input.agent_type),
    objective: normalizeString(input.objective)
  };
}

function clampConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function stableId(input: HermesPreSpendDecisionInput): string {
  const parts = [
    input.route_id ?? 'no_route',
    input.provider_id ?? 'no_provider',
    input.service_id ?? 'no_service',
    typeof input.amount_usd === 'number' ? input.amount_usd.toFixed(2) : 'no_amount',
    input.payment_rail ?? 'no_rail',
    input.chain ?? 'no_chain',
    input.agent_type ?? 'no_agent',
    input.objective ?? 'no_objective'
  ];
  return `hermes_pre_spend_decision_${parts.join('_').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function listMatchedEntries(input: HermesPreSpendDecisionInput): MatchedEntries {
  return {
    provider: input.provider_id ? getHermesReputationEntry('provider', input.provider_id) : undefined,
    route: input.route_id ? getHermesReputationEntry('route', input.route_id) : undefined,
    service: input.service_id ? getHermesReputationEntry('service', input.service_id) : undefined
  };
}

function matchedEntryList(matched: MatchedEntries): HermesReputationLedgerEntry[] {
  return [matched.provider, matched.route, matched.service].filter((entry): entry is HermesReputationLedgerEntry => Boolean(entry));
}

function makeReference(
  kind: HermesPreSpendDecisionInputReference['kind'],
  id: string,
  entry: HermesReputationLedgerEntry,
  summary: string
): HermesPreSpendDecisionInputReference {
  return {
    kind,
    id,
    target_type: entry.target_type,
    target_id: entry.target_id,
    summary
  };
}

function buildReferences(matched: MatchedEntries) {
  const seenReceipts = new Set<string>();
  const seenClaims = new Set<string>();
  const seenRuns = new Set<string>();
  const reputationInputs: HermesPreSpendDecisionInputReference[] = [];
  const receiptInputs: HermesPreSpendDecisionInputReference[] = [];
  const claimInputs: HermesPreSpendDecisionInputReference[] = [];
  const runInputs: HermesPreSpendDecisionInputReference[] = [];

  for (const entry of matchedEntryList(matched)) {
    const targetId = entry.target_id ?? 'unknown';
    reputationInputs.push(makeReference(
      'reputation_entry',
      `${entry.target_type}:${targetId}`,
      entry,
      `${entry.label} is ${entry.current_state} with trust score ${entry.trust_score}.`
    ));

    for (const receiptId of entry.source_receipt_ids) {
      if (seenReceipts.has(receiptId)) continue;
      seenReceipts.add(receiptId);
      receiptInputs.push(makeReference('receipt', receiptId, entry, `Receipt ${receiptId} contributes evidence for ${entry.target_type}:${targetId}.`));
    }

    for (const claimId of entry.source_claim_ids) {
      if (seenClaims.has(claimId)) continue;
      seenClaims.add(claimId);
      claimInputs.push(makeReference('claim', claimId, entry, `Reviewed claim ${claimId} contributes reputation judgment for ${entry.target_type}:${targetId}.`));
    }

    for (const runId of entry.source_run_ids) {
      if (seenRuns.has(runId)) continue;
      seenRuns.add(runId);
      runInputs.push(makeReference('run', runId, entry, `Hermes run ${runId} contributed source evidence for ${entry.target_type}:${targetId}.`));
    }
  }

  return {
    reputation_inputs: reputationInputs,
    receipt_inputs: receiptInputs,
    claim_inputs: claimInputs,
    run_inputs: runInputs
  };
}

function buildLedgerState(matched: MatchedEntries): HermesPreSpendDecision['ledger_state'] {
  return {
    provider_state: matched.provider?.current_state,
    route_state: matched.route?.current_state,
    service_state: matched.service?.current_state,
    provider_score: matched.provider?.trust_score,
    route_score: matched.route?.trust_score,
    service_score: matched.service?.trust_score
  };
}

function addRiskFactor(
  riskFactors: HermesPreSpendRiskFactor[],
  factor: HermesPreSpendRiskFactor
) {
  if (riskFactors.some((item) => item.id === factor.id)) return;
  riskFactors.push(factor);
}

function buildRiskFactors(input: HermesPreSpendDecisionInput, matched: MatchedEntries, draft: DecisionDraft): HermesPreSpendRiskFactor[] {
  const riskFactors: HermesPreSpendRiskFactor[] = [];

  if (input.provider_id && !matched.provider) {
    addRiskFactor(riskFactors, {
      id: 'missing_provider_reputation',
      severity: 'medium',
      label: 'Missing provider reputation',
      detail: `No provider reputation entry was found for ${input.provider_id}.`,
      source: 'provider_reputation'
    });
  }
  if (input.route_id && !matched.route) {
    addRiskFactor(riskFactors, {
      id: 'missing_route_reputation',
      severity: 'medium',
      label: 'Missing route reputation',
      detail: `No route reputation entry was found for ${input.route_id}.`,
      source: 'route_reputation'
    });
  }
  if (input.service_id && !matched.service) {
    addRiskFactor(riskFactors, {
      id: 'missing_service_reputation',
      severity: 'low',
      label: 'Missing service reputation',
      detail: `No service reputation entry was found for ${input.service_id}.`,
      source: 'service_reputation'
    });
  }

  for (const [scope, entry] of [['provider', matched.provider], ['route', matched.route], ['service', matched.service]] as const) {
    if (!entry) continue;
    if (entry.current_state === 'degraded') {
      addRiskFactor(riskFactors, {
        id: `${scope}_degraded`,
        severity: 'high',
        label: `${scope} degraded`,
        detail: `${entry.label} is degraded with trust score ${entry.trust_score}.`,
        source: `${scope}_reputation` as HermesPreSpendRiskFactor['source']
      });
    }
    if (entry.current_state === 'disputed') {
      addRiskFactor(riskFactors, {
        id: `${scope}_disputed`,
        severity: 'high',
        label: `${scope} disputed`,
        detail: `${entry.label} has disputed reputation memory and requires manual review.`,
        source: `${scope}_reputation` as HermesPreSpendRiskFactor['source']
      });
    }
    if (entry.current_state === 'watchlist') {
      addRiskFactor(riskFactors, {
        id: `${scope}_watchlist`,
        severity: 'medium',
        label: `${scope} on watchlist`,
        detail: `${entry.label} is on the watchlist and should be test-spent before larger usage.`,
        source: `${scope}_reputation` as HermesPreSpendRiskFactor['source']
      });
    }
  }

  if (typeof input.amount_usd === 'number' && input.amount_usd >= 100) {
    addRiskFactor(riskFactors, {
      id: input.amount_usd >= 1000 ? 'very_high_amount' : 'high_amount',
      severity: input.amount_usd >= 1000 ? 'high' : 'medium',
      label: input.amount_usd >= 1000 ? 'Very high amount' : 'High amount',
      detail: `Requested spend amount is $${input.amount_usd.toFixed(2)}, which increases the need for stronger evidence.`,
      source: 'amount'
    });
  }

  if (draft.decision === 'insufficient_evidence') {
    addRiskFactor(riskFactors, {
      id: 'insufficient_evidence',
      severity: 'high',
      label: 'Insufficient evidence',
      detail: 'The Reputation Ledger does not provide enough matching evidence to support this spend safely.',
      source: 'evidence'
    });
  }

  return riskFactors;
}

function stateWeight(state: HermesReputationState): number {
  if (state === 'trusted') return 0.08;
  if (state === 'watchlist') return -0.05;
  if (state === 'degraded') return -0.18;
  if (state === 'disputed') return -0.28;
  return -0.12;
}

function computeConfidence(matched: MatchedEntries, input: HermesPreSpendDecisionInput): number {
  const entries = matchedEntryList(matched);
  if (!entries.length) return 0.35;

  let confidence = 0.25 + entries.length * 0.18;
  for (const entry of entries) {
    confidence += (entry.trust_score - 50) / 100 * 0.2;
    confidence += stateWeight(entry.current_state);
  }

  const missingCount = [input.provider_id && !matched.provider, input.route_id && !matched.route, input.service_id && !matched.service]
    .filter(Boolean)
    .length;
  confidence -= missingCount * 0.1;

  return clampConfidence(confidence);
}

function reasonFromTrustedStates(matched: MatchedEntries): string {
  const trustedScopes = [
    matched.provider?.current_state === 'trusted' ? 'provider' : null,
    matched.route?.current_state === 'trusted' ? 'route' : null,
    matched.service?.current_state === 'trusted' ? 'service' : null
  ].filter((item): item is string => Boolean(item));
  return `${trustedScopes.map((scope) => scope.charAt(0).toUpperCase() + scope.slice(1)).join(' and ')} reputation is trusted in the ledger.`;
}

function baseDecision(input: HermesPreSpendDecisionInput, matched: MatchedEntries): DecisionDraft {
  const entries = matchedEntryList(matched);
  const hasProvider = Boolean(matched.provider);
  const hasRoute = Boolean(matched.route);
  const hasService = Boolean(matched.service);
  const hasAnyDisputed = entries.some((entry) => entry.current_state === 'disputed');
  const providerDegraded = matched.provider?.current_state === 'degraded';
  const routeDegraded = matched.route?.current_state === 'degraded';
  const hasWatchlist = entries.some((entry) => entry.current_state === 'watchlist');
  const providerTrusted = matched.provider?.current_state === 'trusted';
  const routeTrusted = matched.route?.current_state === 'trusted';
  const trustedCount = entries.filter((entry) => entry.current_state === 'trusted').length;
  const missingCount = [input.provider_id && !hasProvider, input.route_id && !hasRoute, input.service_id && !hasService].filter(Boolean).length;

  if (!entries.length) {
    return {
      decision: 'insufficient_evidence',
      required_action: 'request_more_evidence',
      reason: 'No matching provider, route, or service reputation entries were found in the ledger.'
    };
  }

  if (hasAnyDisputed) {
    return {
      decision: 'do_not_spend',
      required_action: 'manual_review_required',
      reason: 'At least one matching reputation target is disputed in the ledger.'
    };
  }

  if (providerDegraded || routeDegraded) {
    return {
      decision: 'do_not_spend',
      required_action: providerDegraded ? 'do_not_use_provider' : 'use_fallback_route',
      reason: providerDegraded
        ? 'Provider reputation is degraded in the ledger.'
        : 'Route reputation is degraded in the ledger.'
    };
  }

  if (providerTrusted && routeTrusted) {
    return {
      decision: 'proceed',
      required_action: 'none',
      reason: reasonFromTrustedStates(matched)
    };
  }

  if (hasWatchlist) {
    return {
      decision: 'proceed_with_caution',
      required_action: 'run_small_test_spend',
      reason: 'One or more matching reputation targets are on the watchlist.'
    };
  }

  if (trustedCount === 1 && missingCount >= 1) {
    return {
      decision: 'proceed_with_caution',
      required_action: 'run_small_test_spend',
      reason: 'Only one matching target is trusted while the rest of the intended spend context is missing ledger evidence.'
    };
  }

  if ((matched.provider?.current_state === 'unproven' || matched.route?.current_state === 'unproven' || matched.service?.current_state === 'unproven')) {
    return {
      decision: 'insufficient_evidence',
      required_action: 'request_more_evidence',
      reason: 'Matching reputation entries exist, but the current ledger state remains unproven.'
    };
  }

  if (trustedCount >= 1) {
    return {
      decision: 'proceed_with_caution',
      required_action: 'run_small_test_spend',
      reason: 'Some positive ledger evidence exists, but trust is not strong enough across the full spend path.'
    };
  }

  return {
    decision: 'insufficient_evidence',
    required_action: 'request_more_evidence',
    reason: 'The ledger has partial evidence, but it does not support a strong spend recommendation yet.'
  };
}

function increaseCaution(draft: DecisionDraft): DecisionDraft {
  if (draft.decision === 'proceed') {
    return {
      decision: 'proceed_with_caution',
      required_action: 'run_small_test_spend',
      reason: `${draft.reason} Amount sensitivity increases caution for this spend.`
    };
  }
  if (draft.decision === 'proceed_with_caution') {
    return {
      decision: 'test_spend_first',
      required_action: 'run_small_test_spend',
      reason: `${draft.reason} Amount sensitivity pushes this to a test spend first.`
    };
  }
  return draft;
}

function applyAmountSensitivity(
  input: HermesPreSpendDecisionInput,
  matched: MatchedEntries,
  draft: DecisionDraft,
  confidence: number
): DecisionDraft {
  if (typeof input.amount_usd !== 'number') return draft;

  const providerTrusted = matched.provider?.current_state === 'trusted';
  const routeTrusted = matched.route?.current_state === 'trusted';
  const hasWatchlist = matchedEntryList(matched).some((entry) => entry.current_state === 'watchlist');

  let next = draft;
  if (input.amount_usd >= 100 && confidence < 0.8) {
    next = increaseCaution(next);
  }

  if (input.amount_usd >= 1000 && !(providerTrusted && routeTrusted)) {
    next = {
      decision: next.decision === 'do_not_spend' || next.decision === 'insufficient_evidence' ? next.decision : 'test_spend_first',
      required_action: 'manual_review_required',
      reason: `${next.reason} Amount exceeds $1000.00 without trusted provider and route coverage, so manual review is required.`
    };
  }

  if (input.amount_usd <= 25 && hasWatchlist && next.decision === 'proceed_with_caution') {
    next = {
      decision: 'test_spend_first',
      required_action: 'run_small_test_spend',
      reason: `${next.reason} The amount is small enough to prefer a test spend before a larger commitment.`
    };
  }

  return next;
}

export function createHermesPreSpendDecision(input: HermesPreSpendDecisionInput): HermesPreSpendDecision {
  const normalizedInput = normalizeInput(input);
  const ledger = buildHermesReputationLedger();
  const matched = listMatchedEntries(normalizedInput);
  const base = baseDecision(normalizedInput, matched);
  const confidence = computeConfidence(matched, normalizedInput);
  const draft = applyAmountSensitivity(normalizedInput, matched, base, confidence);
  const references = buildReferences(matched);

  return {
    id: stableId(normalizedInput),
    input: normalizedInput,
    decision: draft.decision,
    confidence,
    reason: draft.reason,
    required_action: draft.required_action,
    risk_factors: buildRiskFactors(normalizedInput, matched, draft),
    reputation_inputs: references.reputation_inputs,
    receipt_inputs: references.receipt_inputs,
    claim_inputs: references.claim_inputs,
    run_inputs: references.run_inputs,
    ledger_state: buildLedgerState(matched),
    generated_at: ledger.generated_at || hermesDeskGeneratedAt
  };
}

export function createHermesPreSpendDecisionExample(
  input: HermesPreSpendDecisionInput = HERMES_PRE_SPEND_DECISION_EXAMPLE_INPUT
): HermesPreSpendDecision {
  return createHermesPreSpendDecision(input);
}

export function buildHermesPreSpendDecisionExamples(): HermesPreSpendDecision[] {
  const ledger = buildHermesReputationLedger();
  const trustedEntry = ledger.entries.find((entry) => entry.current_state === 'trusted');

  if (trustedEntry?.target_type === 'route' && trustedEntry.target_id) {
    return [createHermesPreSpendDecision({
      route_id: trustedEntry.target_id,
      amount_usd: 10,
      payment_rail: 'x402',
      chain: 'base'
    })];
  }

  return [createHermesPreSpendDecisionExample()];
}
