import { IntelligenceStore } from './intelligenceStore';
import { listBenchmarkArtifacts } from '../data/benchmarkArtifacts';
import {
  buildRadarBenchmarkRouteHistoryByBenchmarkId,
  buildRadarEvidenceLedger
} from './radarBenchmarkService';
import { listRadarBundles } from './radarBundleRegistryService';
import { listRadarBundleRuns } from './radarBundleRunLedgerService';
import { listRouteMappings } from './providerEndpointMap';
import {
  AgentSpendReadiness,
  AgentSpendReadinessCard,
  AgentSpendReadinessList,
  AgentSpendReadinessState
} from '../schemas/entities';

type MutableCard = Omit<AgentSpendReadinessCard, 'readiness_state' | 'agent_spend_readiness' | 'builder_next_step' | 'agent_guidance' | 'what_this_means' | 'share_copy'> & {
  routeEvidenceHealth: Set<string>;
  routeCaveatCount: number;
  blockerNotes: string[];
  scaffoldReasons: string[];
  hasBillingBoundaryConcern: boolean;
  hasBillableProbeObserved: boolean;
};

const AGENT_GUIDANCE = [
  'Readiness cards are proof-state diagnostics, not rankings.',
  'Agents should inspect route timelines, caveats, and latest artifacts before spend.',
  'winner_claimed=false means no provider winner should be inferred.'
];

const MATURITY_ORDER: AgentSpendReadinessState[] = [
  'recorded_evidence',
  'caveated_evidence',
  'controlled_run_observed',
  'scaffold_only',
  'catalog_only',
  'blocked_or_unclear'
];

const SCAFFOLD_PROVIDER_EVIDENCE: Record<string, Array<{ provider_id: string; provider_label: string; blocked?: boolean }>> = {
  'communications-email-delivery': [
    { provider_id: 'stableemail', provider_label: 'StableEmail' },
    { provider_id: 'agentmail', provider_label: 'AgentMail', blocked: true }
  ],
  'solana-infra-account-balance': [
    { provider_id: 'quicknode', provider_label: 'QuickNode', blocked: true }
  ],
  'social-data-reddit-post-search': [
    { provider_id: 'stableenrich-reddit-search', provider_label: 'StableEnrich Reddit Search' },
    { provider_id: 'stablesocial-reddit-search', provider_label: 'StableSocial Reddit Search' }
  ],
  'maps-place-search-results': [
    { provider_id: 'stableenrich-google-maps-text-search', provider_label: 'StableEnrich Google Maps Text Search' },
    { provider_id: 'google-places-searchtext', provider_label: 'Google Places SearchText' }
  ],
  'audio-speech-transcription': [
    { provider_id: 'google-speech', provider_label: 'Google Speech' },
    { provider_id: 'alibaba-speech', provider_label: 'Alibaba Speech' }
  ]
};

export function buildAgentSpendReadiness(store: IntelligenceStore): AgentSpendReadinessList {
  const generatedAt = new Date().toISOString();
  const cards = new Map<string, MutableCard>();

  for (const provider of store.providers) {
    const label = provider.title ?? provider.name ?? humanizeProviderId(provider.id);
    cards.set(provider.id, createMutableCard(provider.id, label));
  }

  const mappings = listRouteMappings();
  const providerLabels = new Map(mappings.map((mapping) => [mapping.provider_id, mapping.provider_name]));
  for (const mapping of mappings) {
    ensureCard(cards, mapping.provider_id, mapping.provider_name);
  }

  const artifacts = listBenchmarkArtifacts();
  for (const artifact of artifacts) {
    for (const route of artifact.routes) {
      const card = ensureCard(cards, route.provider_id, providerLabels.get(route.provider_id) ?? humanizeProviderId(route.provider_id));
      card.evidence_summary.recorded_benchmarks += artifact.aggregate_metrics?.benchmark_recorded === true ? 1 : 0;
      if (route.execution_status === 'proven' || route.paid_execution_proven) card.evidence_summary.proven_routes += 1;
      card.evidence_summary.latest_artifact_id = latestArtifactId(card.evidence_summary.latest_artifact_id, card.evidence_summary.latest_observed_at, artifact.artifact_id, artifact.generated_at);
      card.evidence_summary.latest_observed_at = latestIso(card.evidence_summary.latest_observed_at, artifact.generated_at);
      card.proof_links.benchmark_history.push(`/v1/radar/benchmark-history/${artifact.benchmark_id}`);
    }
  }

  const ledger = buildRadarEvidenceLedger();
  for (const lane of ledger.recorded_lanes) {
    const routeHistory = buildRadarBenchmarkRouteHistoryByBenchmarkId(lane.benchmark_id);
    for (const route of routeHistory?.routes ?? []) {
      const card = ensureCard(cards, route.provider_id, providerLabels.get(route.provider_id) ?? route.label);
      card.evidence_summary.caveat_count += route.caveat_objects.length;
      card.routeCaveatCount += route.caveat_objects.filter((caveat) => caveat.severity !== 'info').length;
      card.routeEvidenceHealth.add(route.evidence_health);
      card.proof_links.route_timelines.push(`/v1/radar/benchmark-history/${lane.benchmark_id}/routes/${encodeURIComponent(route.route_id)}`);
    }
  }

  for (const lane of ledger.scaffold_lanes) {
    const providers = SCAFFOLD_PROVIDER_EVIDENCE[lane.benchmark_id] ?? [];
    for (const provider of providers) {
      const card = ensureCard(cards, provider.provider_id, provider.provider_label);
      card.evidence_summary.scaffold_lanes += 1;
      card.scaffoldReasons.push(...lane.why_not_promoted);
      card.blockerNotes.push(lane.why_not_promoted[0] ?? 'Scaffold lane has insufficient proof.');
      card.hasBillingBoundaryConcern ||= lane.why_not_promoted.some((reason) => /billing[- ]boundary|billing_unclear/i.test(reason));
      card.hasBillableProbeObserved ||= lane.why_not_promoted.some((reason) => /billable probe/i.test(reason));
      if (provider.blocked || lane.promotion_status === 'blocked') card.hasBillingBoundaryConcern ||= /blocked|failed|insufficient|unproven/i.test(lane.why_not_promoted.join(' '));
    }
  }

  const bundles = listRadarBundles();
  const controlledRuns = listRadarBundleRuns('morning-briefing');
  const controlledBundleRunCount = controlledRuns?.count ?? 0;
  const controlledRunLinks = controlledRuns?.runs.map((run) => `/v1/radar/bundles/morning-briefing/runs/${run.run_id}`) ?? [];
  const recordedProvidersByBenchmark = new Map<string, Set<string>>();
  for (const artifact of artifacts) {
    const providerIds = recordedProvidersByBenchmark.get(artifact.benchmark_id) ?? new Set<string>();
    for (const route of artifact.routes) providerIds.add(route.provider_id);
    recordedProvidersByBenchmark.set(artifact.benchmark_id, providerIds);
  }
  for (const bundle of bundles.bundles) {
    for (const dependency of bundle.evidence_dependencies) {
      for (const providerId of recordedProvidersByBenchmark.get(dependency) ?? []) {
        const card = ensureCard(cards, providerId, providerLabels.get(providerId) ?? humanizeProviderId(providerId));
        card.evidence_summary.controlled_bundle_runs += controlledBundleRunCount;
        card.proof_links.bundle_runs.push(...controlledRunLinks);
      }
    }
  }

  const normalizedCards = Array.from(cards.values()).map(finalizeCard).sort((a, b) => {
    const stateDelta = MATURITY_ORDER.indexOf(a.readiness_state) - MATURITY_ORDER.indexOf(b.readiness_state);
    if (stateDelta !== 0) return stateDelta;
    return a.provider_label.localeCompare(b.provider_label);
  });

  return {
    count: normalizedCards.length,
    generated_at: generatedAt,
    cards: normalizedCards,
    winner_claimed: false,
    agent_guidance: AGENT_GUIDANCE
  };
}

export function getAgentSpendReadinessCard(store: IntelligenceStore, providerId: string): AgentSpendReadinessCard | null {
  return buildAgentSpendReadiness(store).cards.find((card) => card.provider_id === providerId) ?? null;
}

function createMutableCard(providerId: string, providerLabel: string): MutableCard {
  return {
    provider_id: providerId,
    provider_label: providerLabel,
    evidence_summary: {
      recorded_benchmarks: 0,
      proven_routes: 0,
      controlled_bundle_runs: 0,
      scaffold_lanes: 0,
      caveat_count: 0,
      latest_artifact_id: null,
      latest_observed_at: null
    },
    proof_links: {
      benchmark_history: [],
      route_timelines: [],
      bundle_runs: []
    },
    winner_claimed: false,
    routeEvidenceHealth: new Set(),
    routeCaveatCount: 0,
    blockerNotes: [],
    scaffoldReasons: [],
    hasBillingBoundaryConcern: false,
    hasBillableProbeObserved: false
  };
}

function ensureCard(cards: Map<string, MutableCard>, providerId: string, providerLabel: string) {
  const existing = cards.get(providerId);
  if (existing) {
    if (existing.provider_label === humanizeProviderId(existing.provider_id) && providerLabel) existing.provider_label = providerLabel;
    return existing;
  }
  const card = createMutableCard(providerId, providerLabel);
  cards.set(providerId, card);
  return card;
}

function finalizeCard(card: MutableCard): AgentSpendReadinessCard {
  const readiness_state = readinessState(card);
  const agent_spend_readiness = spendReadiness(readiness_state);
  const builder_next_step = builderNextStep(card, readiness_state);
  const evidenceSummary = {
    ...card.evidence_summary,
    recorded_benchmarks: uniqueCount(card.proof_links.benchmark_history),
    controlled_bundle_runs: uniqueCount(card.proof_links.bundle_runs),
    scaffold_lanes: card.evidence_summary.scaffold_lanes,
    caveat_count: card.evidence_summary.caveat_count + card.blockerNotes.length
  };
  const proofLinks = {
    benchmark_history: unique(card.proof_links.benchmark_history),
    route_timelines: unique(card.proof_links.route_timelines),
    bundle_runs: unique(card.proof_links.bundle_runs)
  };
  const agentReadinessSummary = agentReadinessSummaryFromBundleProofLinks(proofLinks.bundle_runs);
  return {
    provider_id: card.provider_id,
    provider_label: card.provider_label,
    readiness_state,
    agent_spend_readiness,
    evidence_summary: evidenceSummary,
    proof_links: proofLinks,
    builder_next_step,
    agent_guidance: agentGuidance(readiness_state),
    what_this_means: deriveReadinessMeaning(readiness_state),
    winner_claimed: false,
    ...(agentReadinessSummary ? { agent_readiness_summary: agentReadinessSummary } : {}),
    share_copy: `Radar card: ${card.provider_label} is ${readiness_state}. Proof exists: ${evidenceSummary.recorded_benchmarks} recorded benchmarks, ${evidenceSummary.proven_routes} proven routes, winner_claimed=false. Agents should inspect caveats before spend.`
  };
}

function agentReadinessSummaryFromBundleProofLinks(bundleRunLinks: string[]): AgentSpendReadinessCard['agent_readiness_summary'] {
  for (const link of bundleRunLinks) {
    const match = link.match(/^\/v1\/radar\/bundles\/([^/]+)\/runs(?:\/([^/]+))?$/);
    if (!match) continue;
    const bundleId = decodeURIComponent(match[1]);
    const runId = match[2] ? decodeURIComponent(match[2]) : null;
    const history = listRadarBundleRuns(bundleId);
    if (!history?.agent_readiness_summary) continue;
    if (runId && !history.runs.some((run) => run.run_id === runId)) continue;
    return history.agent_readiness_summary;
  }
  return undefined;
}

function readinessState(card: MutableCard): AgentSpendReadinessState {
  const hasRecorded = card.evidence_summary.recorded_benchmarks > 0 || card.evidence_summary.proven_routes > 0;
  const hasMaterialCaveat = card.routeCaveatCount > 0 || Array.from(card.routeEvidenceHealth).some((health) => health !== 'recorded');
  if (card.hasBillingBoundaryConcern || card.hasBillableProbeObserved) return 'blocked_or_unclear';
  if (hasRecorded && hasMaterialCaveat) return 'caveated_evidence';
  if (hasRecorded) return 'recorded_evidence';
  if (card.evidence_summary.controlled_bundle_runs > 0) return 'controlled_run_observed';
  if (card.evidence_summary.scaffold_lanes > 0) return 'scaffold_only';
  return 'catalog_only';
}

function spendReadiness(state: AgentSpendReadinessState): AgentSpendReadiness {
  if (state === 'recorded_evidence') return 'ready_for_inspection';
  if (state === 'caveated_evidence' || state === 'controlled_run_observed') return 'needs_review';
  return 'not_ready';
}

function builderNextStep(card: MutableCard, state: AgentSpendReadinessState) {
  if (state === 'recorded_evidence') return 'Inspect latest route timeline and caveats before routing agents.';
  if (state === 'caveated_evidence') return 'Provide clearer request/response schema examples for route verification.';
  if (state === 'controlled_run_observed') return 'Inspect latest controlled bundle run and skipped review-required steps before routing agents.';
  if (state === 'blocked_or_unclear') return 'Resolve billing-boundary ambiguity before bundle execution.';
  if (state === 'scaffold_only') return 'Add comparable paid proof before treating this lane as benchmark-ready.';
  return 'No artifact-backed route evidence yet; start with unpaid 402 verification and one controlled paid proof.';
}

function agentGuidance(state: AgentSpendReadinessState) {
  if (state === 'recorded_evidence') return 'Artifact-backed route evidence exists; inspect latest route timelines and caveats before spend.';
  if (state === 'caveated_evidence') return 'Evidence exists with caveats; inspect caveat_objects before spend.';
  if (state === 'controlled_run_observed') return 'Controlled bundle run evidence exists; review skipped steps and observed cost availability before spend.';
  if (state === 'blocked_or_unclear') return 'Do not route autonomous spend until blockers or billing-boundary ambiguity are resolved.';
  if (state === 'scaffold_only') return 'Treat this as explored evidence only; benchmark-grade proof is not recorded.';
  return 'Catalog metadata exists, but no proof lane is recorded yet.';
}

export function deriveReadinessMeaning(state: AgentSpendReadinessState) {
  if (state === 'recorded_evidence') return 'Artifact-backed route evidence exists. Agents should still inspect caveats before spend.';
  if (state === 'caveated_evidence') return 'Evidence exists, but caveats require review before routing agents.';
  if (state === 'controlled_run_observed') return 'A controlled Harness run exists. Agents should inspect run freshness, skipped steps, and caveats.';
  if (state === 'scaffold_only') return 'This lane was explored but does not yet meet the hard bar for recorded evidence.';
  if (state === 'catalog_only') return 'Catalog presence exists, but no artifact-backed route evidence has been recorded yet.';
  return 'Billing, proof, or route semantics remain unclear; this is not ready for automated spend.';
}

function latestIso(current: string | null, candidate: string) {
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function latestArtifactId(currentId: string | null, currentAt: string | null, candidateId: string, candidateAt: string) {
  if (!currentAt || Date.parse(candidateAt) > Date.parse(currentAt)) return candidateId;
  return currentId;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

function humanizeProviderId(providerId: string) {
  return providerId
    .split(/[-_/]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
