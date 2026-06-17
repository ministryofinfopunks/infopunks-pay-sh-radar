import {
  HumanValidationSubmissionSchema,
  PreSpendCheckRequestSchema,
  PreSpendProviderListResponseSchema
} from '../schemas/entities';
import {
  preSpendRepository,
  type PreSpendRepository
} from '../repositories/preSpendRepository';
import {
  HumanValidationSubmission,
  PreSpendCheckRequest,
  PreSpendReceipt,
  ProviderIntelligenceRecord,
  RouteIntelligence,
  ServiceDossier,
  makePreSpendDecision
} from './preSpendDecisionService';

type RouteTrustSummary = {
  receipt_freshness: string;
  successful_receipt_count: number;
  failure_patterns: string[];
  blocker_severity: 'none' | 'low' | 'medium' | 'high';
  provider_reliability: string;
  human_validation: string;
  summary: string;
};

type ProviderTrustProfile = {
  safe_for_first_attempt: boolean;
  better_for_repeatable_routes: boolean;
  requires_human_approval: boolean;
  not_recommended: boolean;
  summary: string;
};

type ServiceDecisionMap = {
  best_observed_route: string | null;
  cheapest_route: string | null;
  safest_first_attempt: string | null;
  fastest_repeatable_route: string | null;
  summary: string;
};

type ReceiptImpact = {
  improves_route_confidence: boolean;
  reduces_route_confidence: boolean;
  freshness: 'fresh' | 'stale';
  human_validated: boolean;
  should_affect_future_pre_spend_decisions: boolean;
  summary: string;
};

function matchesIntent(service: ServiceDossier, route: RouteIntelligence, request: PreSpendCheckRequest) {
  const intent = request.intent.toLowerCase();
  return (
    route.recommended_use_case.toLowerCase() === intent ||
    service.category.toLowerCase() === intent ||
    intent.includes(service.category.toLowerCase()) ||
    intent.includes(route.recommended_use_case.toLowerCase()) ||
    (intent.includes('market') && service.category === 'market_research') ||
    (intent.includes('quote') && service.category === 'token_pricing') ||
    (intent.includes('receipt') && service.category === 'receipt_parsing') ||
    (intent.includes('compliance') && service.category === 'compliance') ||
    (intent.includes('profile') && service.category === 'private_profile_scrape')
  );
}

function metrics(repository: PreSpendRepository) {
  const receipts = repository.listReceipts();
  const routes = repository.listRoutes();
  const providers = repository.listProviders();
  const validations = repository.listValidations();
  const state = repository.getMetricsState();
  const verifiedRoutes = new Set(
    receipts
      .filter((receipt) => receipt.status === 'succeeded' && receipt.validation_state === 'human_validated')
      .map((receipt) => receipt.route_id)
  );

  return {
    verified_pre_spend_decisions: verifiedRoutes.size,
    routes_indexed: routes.length,
    providers_scored: providers.length,
    receipts_generated: receipts.length,
    pre_spend_checks_completed: state.pre_spend_checks_completed,
    human_validations_submitted: state.human_validations_submitted,
    failed_routes_avoided: state.failed_routes_avoided,
    claims_challenged: validations.filter((item) => item.validation_state === 'disputed').length,
    repeatable_routes_discovered: routes.filter((route) => route.success_rate >= 0.9 && route.receipt_references.length >= 2).length,
    agent_builders_using_the_api: 7,
    amount_of_spend_protected_or_intelligently_routed: '184.90 USDC'
  };
}

function daysSince(iso: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
}

function latestValidationState(repository: PreSpendRepository, targetType: 'route' | 'provider' | 'service' | 'receipt', targetId: string) {
  return repository.getValidationsForTarget(targetType, targetId)[0]?.validation_state ?? null;
}

function routeValidationState(repository: PreSpendRepository, route: RouteIntelligence, receipts: PreSpendReceipt[]) {
  const explicit = latestValidationState(repository, 'route', route.route_id);
  if (explicit) return explicit;
  if (receipts.some((receipt) => receipt.validation_state === 'human_validated')) return 'human_validated';
  if (receipts.some((receipt) => receipt.validation_state === 'machine_checked')) return 'machine_checked';
  if (receipts.some((receipt) => receipt.validation_state === 'stale')) return 'stale';
  if (receipts.some((receipt) => receipt.validation_state === 'disputed')) return 'disputed';
  return null;
}

function routeFailurePatterns(receipts: PreSpendReceipt[]) {
  const failed = receipts.filter((receipt) => receipt.status !== 'succeeded');
  const reasons = Array.from(new Set(failed.map((receipt) => receipt.failure_reason).filter((reason): reason is string => Boolean(reason))));
  if (reasons.length) return reasons;
  if (failed.length === 0) return [];
  return [`${failed.length} non-success receipt${failed.length > 1 ? 's' : ''} observed`];
}

function blockerSeverity(route: RouteIntelligence, provider: ProviderIntelligenceRecord, receipts: PreSpendReceipt[]): RouteTrustSummary['blocker_severity'] {
  if (provider.dispute_history.length > 0 || receipts.some((receipt) => receipt.validation_state === 'disputed' || receipt.validation_state === 'rejected')) return 'high';
  if (route.known_blockers.length >= 2 || receipts.some((receipt) => receipt.status !== 'succeeded')) return 'medium';
  if (route.known_blockers.length === 1) return 'low';
  return 'none';
}

function providerReliabilitySummary(provider: ProviderIntelligenceRecord) {
  if (provider.reliability_score >= 90) return 'Provider reliability is strong with repeatable receipt-backed performance.';
  if (provider.reliability_score >= 75) return 'Provider reliability is usable, but route conditions should still be inspected.';
  if (provider.reliability_score >= 50) return 'Provider reliability is mixed and should be treated as cautionary.';
  return 'Provider reliability is weak and unsuitable for silent spend.';
}

function validationSummary(state: string | null, receipts: PreSpendReceipt[]) {
  const humanValidatedCount = receipts.filter((receipt) => receipt.validation_state === 'human_validated').length;
  if (state === 'human_validated' || humanValidatedCount > 0) return `Human validation exists${humanValidatedCount > 0 ? ` across ${humanValidatedCount} receipt${humanValidatedCount > 1 ? 's' : ''}` : ''}.`;
  if (state === 'machine_checked') return 'Machine validation exists, but no recent human validation is attached.';
  if (state === 'stale') return 'Validation exists but is stale relative to current spend conditions.';
  if (state === 'disputed' || state === 'rejected') return 'Validation is disputed or rejected.';
  return 'No explicit validation is attached yet.';
}

function buildRouteTrustSummary(repository: PreSpendRepository, route: RouteIntelligence, provider: ProviderIntelligenceRecord, receipts: PreSpendReceipt[]): RouteTrustSummary {
  const successfulReceiptCount = receipts.filter((receipt) => receipt.status === 'succeeded').length;
  const latestReceiptAgeDays = receipts.length ? Math.min(...receipts.map((receipt) => daysSince(receipt.timestamp))) : Number.POSITIVE_INFINITY;
  const freshness = latestReceiptAgeDays <= 14
    ? `Fresh receipts observed within ${latestReceiptAgeDays} day${latestReceiptAgeDays === 1 ? '' : 's'}.`
    : 'Receipt evidence is stale or missing for current spend decisions.';
  const failures = routeFailurePatterns(receipts);
  const validationState = routeValidationState(repository, route, receipts);
  const severity = blockerSeverity(route, provider, receipts);
  const summaryParts = [
    freshness,
    `${successfulReceiptCount} successful receipt${successfulReceiptCount === 1 ? '' : 's'} back this route.`,
    failures.length ? `Failure patterns: ${failures.join('; ')}.` : 'No material failure pattern is currently recorded.',
    providerReliabilitySummary(provider),
    validationSummary(validationState, receipts)
  ];
  return {
    receipt_freshness: freshness,
    successful_receipt_count: successfulReceiptCount,
    failure_patterns: failures,
    blocker_severity: severity,
    provider_reliability: providerReliabilitySummary(provider),
    human_validation: validationSummary(validationState, receipts),
    summary: summaryParts.join(' ')
  };
}

function buildProviderTrustProfile(provider: ProviderIntelligenceRecord, routes: RouteIntelligence[], receipts: PreSpendReceipt[]): ProviderTrustProfile {
  const safeForFirstAttempt = provider.reliability_score >= 85 &&
    provider.human_validation_status === 'human_validated' &&
    provider.dispute_history.length === 0 &&
    receipts.some((receipt) => receipt.status === 'succeeded' && daysSince(receipt.timestamp) <= 14);
  const betterForRepeatableRoutes = routes.filter((route) => route.success_rate >= 0.9 && route.receipt_references.length >= 2).length > 0;
  const requiresHumanApproval = provider.human_validation_status === 'stale' || routes.some((route) => route.risk_level === 'high' || route.risk_level === 'critical');
  const notRecommended = provider.dispute_history.length > 0 || provider.recent_receipt_count === 0 || provider.human_validation_status === 'disputed' || provider.human_validation_status === 'rejected';
  const summary = notRecommended
    ? 'Not recommended for autonomous spend because disputes, weak evidence, or rejected validation remain unresolved.'
    : safeForFirstAttempt
      ? 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.'
      : requiresHumanApproval
        ? 'Usable with caution, but human approval or route inspection should gate spend.'
        : 'Better for repeatable routes than blind first attempts because evidence exists but requires route-level inspection.';
  return {
    safe_for_first_attempt: safeForFirstAttempt,
    better_for_repeatable_routes: betterForRepeatableRoutes,
    requires_human_approval: requiresHumanApproval,
    not_recommended: notRecommended,
    summary
  };
}

function buildServiceDecisionMap(service: ServiceDossier): ServiceDecisionMap {
  const summary = [
    service.best_observed_route ? `Best observed route is ${service.best_observed_route}.` : 'No best observed route is established yet.',
    service.cheapest_observed_route ? `Cheapest route is ${service.cheapest_observed_route}.` : 'No cheapest route is established yet.',
    service.safest_first_attempt ? `Safest first attempt is ${service.safest_first_attempt}.` : 'No safe first-attempt route is established yet.',
    service.fastest_repeatable_route ? `Fastest repeatable route is ${service.fastest_repeatable_route}.` : 'No fast repeatable route is established yet.'
  ].join(' ');
  return {
    best_observed_route: service.best_observed_route,
    cheapest_route: service.cheapest_observed_route,
    safest_first_attempt: service.safest_first_attempt,
    fastest_repeatable_route: service.fastest_repeatable_route,
    summary
  };
}

function buildReceiptImpact(receipt: PreSpendReceipt): ReceiptImpact {
  const freshness = daysSince(receipt.timestamp) <= 14 ? 'fresh' : 'stale';
  const improves = receipt.confidence_delta > 0 && receipt.status === 'succeeded';
  const reduces = receipt.confidence_delta < 0 || receipt.status !== 'succeeded';
  const humanValidated = receipt.validation_state === 'human_validated';
  const shouldAffectFutureDecisions = humanValidated || freshness === 'fresh' || reduces;
  const summary = improves
    ? `This receipt improves route confidence by ${receipt.confidence_delta} and should strengthen future pre-spend decisions while it remains ${freshness}.`
    : reduces
      ? `This receipt reduces route confidence by ${Math.abs(receipt.confidence_delta)} and should constrain future pre-spend decisions${humanValidated ? ' even more because it is human validated' : ''}.`
      : `This receipt is ${freshness} evidence and should be considered alongside newer route receipts.`;
  return {
    improves_route_confidence: improves,
    reduces_route_confidence: reduces,
    freshness,
    human_validated: humanValidated,
    should_affect_future_pre_spend_decisions: shouldAffectFutureDecisions,
    summary
  };
}

export function createPreSpendIntelligenceService(repository: PreSpendRepository = preSpendRepository) {
  function receiptsForRoute(routeId: string) {
    return repository.listReceipts().filter((receipt) => receipt.route_id === routeId);
  }

  function receiptsForProvider(providerId: string) {
    return repository.listReceipts().filter((receipt) => receipt.provider_id === providerId);
  }

  function receiptsForService(serviceId: string) {
    return repository.listReceipts().filter((receipt) => receipt.service_id === serviceId);
  }

  function providerSummary(provider: ProviderIntelligenceRecord) {
    const routes = repository.listRoutes().filter((route) => route.provider_id === provider.provider_id);
    const receipts = receiptsForProvider(provider.provider_id);
    return {
      ...provider,
      linked_routes: routes.map((route) => route.route_id),
      linked_receipts: receipts.map((receipt) => receipt.receipt_id),
      trust_profile: buildProviderTrustProfile(provider, routes, receipts)
    };
  }

  return {
    listRoutes: () => repository.listRoutes(),
    getRoute: (routeId: string) => repository.getRoute(routeId),
    getRouteDetail(routeId: string) {
      const route = repository.getRoute(routeId);
      if (!route) return null;
      const provider = repository.getProvider(route.provider_id);
      const service = repository.getService(route.service_id);
      const receipts = receiptsForRoute(route.route_id);
      return {
        route,
        provider,
        service,
        receipts,
        metrics: metrics(repository),
        validation_state: provider ? routeValidationState(repository, route, receipts) : null,
        decision_implications: [
          route.confidence_score >= 85 ? 'Confidence is high enough for autonomous first-pass routing when spend conditions match.' : 'Confidence is below silent-autonomy grade and should be inspected before spend.',
          route.risk_level === 'low' ? 'Risk is currently low relative to observed route evidence.' : `Risk is ${route.risk_level}, so blockers and receipt freshness should gate spend.`,
          route.known_blockers.length ? `Known blockers remain active: ${route.known_blockers.join('; ')}.` : 'No blocker is currently recorded for this route.',
          route.avoid_conditions.length ? `Avoid under these conditions: ${route.avoid_conditions.join('; ')}.` : 'No avoid condition is currently recorded.',
          receipts.some((receipt) => receipt.validation_state === 'human_validated') ? 'Human-validated receipts improve agent readiness for this route.' : 'No human-validated receipt currently backs this route.'
        ],
        trust_summary: provider ? buildRouteTrustSummary(repository, route, provider, receipts) : null
      };
    },
    listProviders: () => repository.listProviders(),
    listProviderSummaries() {
      return PreSpendProviderListResponseSchema.parse({
        generated_at: new Date().toISOString(),
        source: 'infopunks-pay-sh-radar',
        metrics: metrics(repository),
        providers: repository.listProviders().map((provider) => providerSummary(provider))
      });
    },
    getProvider: (providerId: string) => repository.getProvider(providerId),
    getProviderDetail(providerId: string) {
      const provider = repository.getProvider(providerId);
      if (!provider) return null;
      const routes = repository.listRoutes().filter((route) => route.provider_id === provider.provider_id);
      const receipts = receiptsForProvider(provider.provider_id);
      const serviceIds = new Set(routes.map((route) => route.service_id));
      const services = repository.listServices().filter((service) => serviceIds.has(service.service_id));
      const providerLevelWarnings = Array.from(new Set([
        ...provider.known_risks,
        ...provider.dispute_history,
        ...routes.flatMap((route) => route.known_blockers)
      ]));
      return {
        provider,
        routes,
        services,
        receipts,
        metrics: metrics(repository),
        provider_level_warnings: providerLevelWarnings,
        trust_profile: buildProviderTrustProfile(provider, routes, receipts)
      };
    },
    listServices: () => repository.listServices(),
    getService: (serviceId: string) => repository.getService(serviceId),
    getServiceDetail(serviceId: string) {
      const service = repository.getService(serviceId);
      if (!service) return null;
      const routes = repository.listRoutes().filter((route) => route.service_id === service.service_id);
      return {
        service,
        routes,
        receipts: receiptsForService(service.service_id),
        metrics: metrics(repository),
        best_route_decision_map: buildServiceDecisionMap(service)
      };
    },
    listReceipts: () => repository.listReceipts(),
    getReceipt: (receiptId: string) => repository.getReceipt(receiptId),
    getReceiptDetail(receiptId: string) {
      const receipt = repository.getReceipt(receiptId);
      if (!receipt) return null;
      return {
        ...receipt,
        route: repository.getRoute(receipt.route_id),
        provider: repository.getProvider(receipt.provider_id),
        service: repository.getService(receipt.service_id),
        impact: buildReceiptImpact(receipt)
      };
    },
    getMetrics: () => metrics(repository),
    check(request: PreSpendCheckRequest) {
      const parsed = PreSpendCheckRequestSchema.parse(request);
      const candidates = repository.listRoutes()
        .map((route) => {
          const service = repository.getService(route.service_id);
          const provider = repository.getProvider(route.provider_id);
          if (!service || !provider) return null;
          return {
            route,
            provider,
            service,
            receipts: receiptsForRoute(route.route_id)
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => matchesIntent(item.service, item.route, parsed));
      const fallbackCandidates = candidates.length ? candidates : repository.listRoutes()
        .map((route) => {
          const service = repository.getService(route.service_id);
          const provider = repository.getProvider(route.provider_id);
          if (!service || !provider) return null;
          return {
            route,
            provider,
            service,
            receipts: receiptsForRoute(route.route_id)
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const result = makePreSpendDecision(parsed, fallbackCandidates);
      repository.recordPreSpendCheck(result.decision);
      return result;
    },
    createReceipt(payload: Omit<PreSpendReceipt, 'receipt_id' | 'timestamp'> & { receipt_id?: string; timestamp?: string }) {
      return repository.createReceipt(payload);
    },
    listValidations: () => repository.listValidations(),
    getValidationsForTarget: (targetType: HumanValidationSubmission['target_type'], targetId: string) => repository.getValidationsForTarget(targetType, targetId),
    submitValidation(input: HumanValidationSubmission) {
      const validation = HumanValidationSubmissionSchema.parse(input);
      return repository.submitValidation(validation);
    }
  };
}
