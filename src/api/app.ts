import cors from '@fastify/cors';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import { payShCatalogFixture } from '../data/payShCatalogFixture';
import { getNarrativeAssetBySlug, getSignalSurfaceBySlug, listNarrativeAssets, listSignalSurfaces } from '../data/narrativeIntel';
import { getCandidateSignal, listCandidateSignals } from '../data/candidateSignals';
import { getSignalDeskIndex } from '../data/signalDesk';
import { createRhChainSignalReviewPacket, getRhChainDailyReceipt, getRhChainDailyReceipts, getRhChainPayload, listRhChainSignals } from '../data/rhChain';
import { rhChainReviewedLayerClassifications } from '../data/rhChainMarketStructure';
import { resolveRhChainContractIntelligence } from '../services/rhChainContractIntelligenceService';
import { getRhChain100ReceiptsCampaign } from '../data/rhChain100Receipts';
import { asRhChainPersistedReviewItem, createRhChainSignalSubmission, InMemoryRhChainSubmissionStore, PostgresRhChainSubmissionStore, redactRhChainSubmissionForReview, type RhChainSubmissionStore, UnconfiguredRhChainSubmissionStore, updateRhChainSubmissionReviewRecord } from '../services/rhChainSignalVault';
import { RhChainLiveSnapshotService, type RhChainLiveSnapshotOptions } from '../services/rhChainLiveSnapshotService';
import { DexScreenerProvider, type RhChainDexScreenerIngestionSource } from '../providers/dexscreenerProvider';
import { BlockscoutProvider } from '../providers/blockscoutProvider';
import { RhChainTokenRegistryService, type RhChainTokenRegistryOptions } from '../services/rhChainTokenRegistryService';
import { RhChainMarketDataService, type RhChainMarketDataServiceOptions, type RhChainReviewedClassification } from '../services/rhChainMarketDataService';
import { RhChainMarketStructureService, type RhChainMarketStructureOptions } from '../services/rhChainMarketStructureService';
import { RhChainCrossLayerIntegrationService } from '../services/rhChainCrossLayerIntegrationService';
import { RhChainDiscoveryQueueService } from '../services/rhChainDiscoveryQueueService';
import { RhChainReviewPipelineService, type RhChainReviewClassification, type RhChainReviewSecondaryTag } from '../services/rhChainReviewPipelineService';
import { InMemoryRhChainReviewedClassificationStore, PostgresRhChainReviewedClassificationStore, RhChainClassificationApprovalSchema, RhChainClassificationAuditPagingSchema, RhChainClassificationContractSchema, RhChainClassificationError, RhChainClassificationPagingSchema, RhChainClassificationProposalSchema, RhChainClassificationRejectionSchema, RhChainClassificationSupersessionSchema, RhChainReviewedClassificationService, type RhChainReviewedClassificationStore } from '../services/rhChainReviewedClassificationService';
import { InMemoryRhChainProjectClaimsStore, PostgresRhChainProjectClaimsStore, RhChainProjectClaimsError, RhChainProjectClaimsService, publicReceipt, type RhChainProjectClaimsStore } from '../services/rhChainProjectClaimsService';
import { inspectRhChainOperationalReadiness } from '../services/rhChainProductionReadiness';
import { InMemoryRhChainMarketSnapshotStore, PostgresRhChainMarketSnapshotStore, RhChainMarketSnapshotService, type RhChainMarketSnapshotServiceOptions, type RhChainMarketSnapshotStore } from '../services/rhChainMarketSnapshotService';
import { InMemoryRhChainAttentionReceiptStore, PostgresRhChainAttentionReceiptStore, RhChainAttentionQualityService, type RhChainAttentionReceiptStore, type RhChainAttentionWindow } from '../services/rhChainAttentionQualityService';
import { InMemoryRhChainMetricsSnapshotStore, PostgresRhChainMetricsSnapshotStore, RhChainChainPulseService, type RhChainMetricsSnapshotStore } from '../services/rhChainChainPulseService';
import { InMemoryRhChainMemePulseSnapshotStore, PostgresRhChainMemePulseSnapshotStore, RhChainMemePulseSnapshotService, type RhChainMemePulseSnapshotStore } from '../services/rhChainMemePulseSnapshotService';
import { InMemoryRhChainLaunchpadSnapshotStore, PostgresRhChainLaunchpadSnapshotStore, RhChainLaunchpadSnapshotService, type RhChainLaunchpadSnapshotStore } from '../services/rhChainLaunchpadSnapshotService';
import { InMemoryRhChainDailyReceiptDraftStore, PostgresRhChainDailyReceiptDraftStore, RhChainDailyReceiptDraftService, type RhChainDailyReceiptDraftStore } from '../services/rhChainDailyReceiptDraftService';
import { InMemoryRhChainRiskCorrelationSnapshotStore, PostgresRhChainRiskCorrelationSnapshotStore, RhChainRiskCorrelationSweepService, type RhChainRiskCorrelationSnapshotStore } from '../services/rhChainRiskCorrelationSweepService';
import { InMemoryRhChainAutomationStore, isRhChainAutomationJobName, PostgresRhChainAutomationStore, RH_CHAIN_AUTOMATION_JOB_NAMES, RhChainAutomationService, type RhChainAutomationStore } from '../services/rhChainAutomationService';
import { assembleRhChainTokenDossier } from '../services/rhChainTokenDossierService';
import { assembleRhChainCloneRadar } from '../services/rhChainCloneRadarService';
import { assembleRhChainTodayOn4663 } from '../services/rhChainTodayOn4663Service';
import { getLatestRh4663Print, getRh4663Print } from '../services/rh4663PrintService';
import { Rh4663CampaignEventSchema, Rh4663CampaignTelemetry } from '../services/rh4663CampaignTelemetry';
import { InMemoryRh4663PrintStore, PostgresRh4663PrintStore, Rh4663PrintGeneratorError, Rh4663PrintGeneratorService, type Rh4663ObservationFreshness, type Rh4663PrintStore, type Rh4663VerifiedObservation } from '../services/rh4663PrintGeneratorService';
import { createRh4663UtcDayProviders, InMemoryRh4663UtcDayObservationStore, isValidRh4663UtcDate, PostgresRh4663UtcDayObservationStore, Rh4663UtcDayObservationError, Rh4663UtcDayObservationService, type Rh4663UtcDayObservationStore } from '../services/rh4663UtcDayObservationService';
import {
  InMemoryRh4663Store,
  PostgresRh4663Store,
  Rh4663PulseCallInputSchema,
  Rh4663PulsePayloadInputSchema,
  Rh4663Service,
  Rh4663ServiceError,
  Rh4663SignalEvidenceInputSchema,
  Rh4663SignalSubmissionSchema,
  Rh4663SignalTransitionInputSchema,
  Rh4663RotationOptionSchema,
  Rh4663EvidenceReferenceSchema,
  resolveRh4663Consensus,
  type Rh4663EvidenceReference,
  type Rh4663Store,
  type Rh4663TodayEdition,
  Rh4663EventTypeSchema,
  Rh4663IntelligenceCategorySchema
} from '../services/rh4663Service';
import {
  InMemoryRh4663IntelligenceStore,
  PostgresRh4663IntelligenceStore,
  Rh4663IntelligenceService,
  Rh4663RawObservationInputSchema,
  rankPublishedSignalsForToday,
  intelligenceCategory,
  type Rh4663IntelligenceStore,
  type Rh4663ProviderAdapter,
  type Rh4663RawObservationInput
} from '../services/rh4663IntelligenceService';
import {
  DisabledRh4663AnchorAdapter,
  InMemoryRh4663ResolutionStore,
  PostgresRh4663ResolutionStore,
  PrivateKeyRh4663ResolutionSigner,
  Rh4663ResolutionService,
  UnavailableRh4663ResolutionSigner,
  ViemRh4663AnchorAdapter,
  type Rh4663AnchorAdapter,
  type Rh4663ResolutionSigner,
  type Rh4663ResolutionStore
} from '../services/rh4663ResolutionService';
import { assembleRhChainLaunchpadObservatory } from '../services/rhChainLaunchpadObservatoryService';
import { assembleRhChainScouts } from '../services/rhChainScoutsService';
import { assembleRhChainDistributionPack } from '../services/rhChainDistributionPackService';
import { assembleRhChainReceiptRelay } from '../services/rhChainReceiptRelayService';
import { InMemoryReflexiveStore, PairV5DiscoveryAdapter, PairV5OnchainVerifier, PostgresReflexiveStore, ReflexiveRadarService, stableId, type ReflexiveProvider } from '../services/rhChainReflexiveRadarService';
import { LongDopplerVerifier, StockTokenSupplyIndexer } from '../services/rhChainCrossVenueAuditService';
import { CANONICAL_UNISWAP_V4_POOL_MANAGER_4663, classifyPltrRelationship, pltrBasis, recoverV4PoolKeyFromInitialize, v4PriceFromSqrtPriceX96, verifyPltrV4Market } from '../services/rhChainPltrPreflightService';
import { quoteMarketFromRaw } from '../services/rhChainQuotePersistenceService';
import { buildRhChainProjectReceiptShare } from '../services/rhChainShareService';
import { queryRhChainScout, RH_CHAIN_SCOUT_MODES } from '../services/rhChainScoutService';
import { isRhChainIdentityContract } from '../services/rhChainTruthGuards';
import { getLatestSignalUpdate, getSignalUpdate, getSignalUpdateSummary, listSignalUpdates } from '../data/signalUpdates';
import { abundanceClaimsFeed, getAbundanceDeskPayload, machineWorkReceipts } from '../data/abundanceDesk';
import { createSignalHuntSubmission, getSignalHuntCandidate, getSignalHuntCounts, listSignalHuntCandidates, verifySignalHuntCandidate } from '../data/signalHunt';
import {
  createAttentionMarketIntakeSubmission,
  getAttentionMarketIntakeRequirements,
  getAttentionMarketSignalBySlug,
  getAttentionMarketWatchIndex
} from '../data/attentionMarketWatch';
import { getNarrativeMetadataForPath, NARRATIVE_PUBLIC_HOST, type NarrativeMetadata } from '../shared/narrativeMetadata';
import { renderAttentionMarketWatchOgImage, renderNarrativesOgImage, renderRevenueReceiptOgImage, renderRevenueReceiptsIndexOgImage, renderRhChainAttentionQualityOgImage, renderRhChainCrossLayerOgImage, renderRhChainMarketPulseOgImage, renderRhChainShareOgImage, renderSignalHuntOgImage, renderSignalReportOgImage, renderSignalUpdateOgImage, renderUnicornRadarIndexOgImage, renderUnicornRadarOgImage } from '../shared/narrativeOg';
import { renderOgPng } from '../server/narrativeOgPng';
import { parseRh4663ShareFormat, renderRh4663ShareSvg } from '../shared/rh4663Share';
import { renderCapitalVsFlowCardSvg, renderMissionFootprintCardSvg, renderReflexiveBirthCardSvg, renderReflexiveInventoryCardSvg, renderReflexiveStockMoneyCardSvg } from '../shared/rhChainReflexiveShare';
import { applyPayShCatalogIngestion } from '../ingestion/payShCatalogAdapter';
import { createIntelligenceStore, defaultRepository, emptyIntelligenceStore, IntelligenceStore, runPayShIngestion, runPayShIngestionWithOptions } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
import { closeDatabasePool, getDatabaseCircuitDiagnostics, getDatabasePool, isPersistenceUnavailable, probeDatabaseRecovery } from '../persistence/databasePool';
import { classifyPostgresFailure, postgresErrorCode, RhChainPostgresReadiness, safeOperationalErrorMessage, type RhChainStorageDiagnostics } from '../persistence/retryablePostgresSchema';
import { recommendRoute } from '../services/routeService';
import { semanticSearch } from '../services/searchService';
import {
  PreflightRequestSchema,
  PreflightResponseSchema,
  PreSpendCheckRequestSchema,
  PreSpendReceiptSchema,
  HumanValidationSubmissionSchema,
  ClaimCreateRequestSchema,
  ClaimChallengeCreateRequestSchema,
  ProofCheckInputSchema,
  LoopCheckInputSchema,
  SignalHuntSubmissionInputSchema,
  SignalHuntSummarySchema,
  SignalHuntVerifyInputSchema,
  SignalHuntCandidateSchema,
  SignalGraphCheckInputSchema,
  SignalGraphCheckResponseSchema,
  SignalGraphClusterDetailSchema,
  SignalGraphClusterSchema,
  SignalGraphEntityLookupResponseSchema,
  SignalGraphEntityTypeSchema,
  SignalGraphNodeDetailSchema,
  SignalGraphResponseSchema,
  SignalGraphRippleSchema,
  UnicornRadarCandidateListSchema,
  UnicornRadarCandidateSchema,
  UnicornRadarEvaluationRequestInputSchema,
  UnicornRadarEvaluationRequestResponseSchema,
  EvaluationRequestResponseSchema,
  UnicornRadarRevenueReceiptSchema,
  UnicornRadarSubmissionInputSchema,
  UnicornRadarSubmissionResponseSchema,
  UnicornRadarSummarySchema,
  RevenueReceiptSchema,
  RevenueReceiptSummarySchema,
  RadarComparisonRequestSchema,
  RadarEcosystemRiskSummarySchema,
  RadarBatchPreflightRequestSchema,
  RadarBatchPreflightResponseSchema,
  RadarBenchmarkReadinessSchema,
  RadarBenchmarkSummarySchema,
  RadarEvidenceLedgerSchema,
  RadarEvidenceLedgerBriefSchema,
  RadarBundleListSchema,
  RadarBundleSchema,
  BundleRunListResponseSchema,
  BundleRunDetailSchema,
  RadarBundlePlanRequestSchema,
  RadarBundlePlanResponseSchema,
  RadarBenchmarkListSchema,
  RadarBenchmarkDetailSchema,
  RadarBenchmarkHistorySchema,
  RadarBenchmarkHistoryV2AggregateSchema,
  RadarBenchmarkHistoryV2DetailSchema,
  RadarBenchmarkRouteHistoryAggregateSchema,
  RadarBenchmarkRouteHistoryDetailSchema,
  RadarBenchmarkArtifactListSchema,
  RadarBenchmarkArtifactSchema,
  AgentSpendReadinessCardSchema,
  AgentSpendReadinessListSchema,
  RadarPreflightRequestSchema,
  RadarPreflightResponseSchema,
  RadarRiskResponseSchema,
  RadarSuperiorityReadinessSchema,
  RouteRecommendationRequestSchema,
  SearchRequestSchema
} from '../schemas/entities';
import { endpointHistory, findEndpoint, findProvider, providerHistory, providerIntelligence } from '../services/providerIntelligenceService';
import { endpointMonitorSummary, isMonitorEnabled, monitorIntervalMs, monitorMaxProviders, monitorTimeoutMs, providerMonitorSummary, runMonitor } from '../services/endpointMonitorService';
import { loadRuntimeConfig } from '../config/env';
import { dataSourceState, PULSE_CAPS, pulseSummary } from '../services/pulseService';
import { recomputeAssessments } from '../services/intelligenceStore';
import { featuredProviderRotation } from '../services/featuredProviderService';
import { classifyEventSeverity, classifyGraphSeverity, classifyNarrativeClusterSeverity, classifyProviderDossierSeverity } from '../engines/severityEngine';
import { analyzePropagation } from '../services/propagationService';
import { resolvePropagationIncident } from '../services/propagationIncidentService';
import { providerReachabilitySummary, providerRootHealthSummary } from '../services/eventSummaryHelpers';
import { runPreflight } from '../services/preflightService';
import { buildRadarExportSnapshot, safeJsonExport } from '../services/radarExportService';
import { buildBenchmarkReadiness, buildSuperiorityReadiness, runRadarComparison, runRadarPreflight, runRadarPreflightBatch } from '../services/radarRouteIntelligenceService';
import {
  buildRadarBenchmarkById,
  buildRadarBenchmarkHistoryById,
  buildRadarBenchmarkRouteHistoryByBenchmarkId,
  buildRadarBenchmarkRouteHistoryDetail,
  buildRadarBenchmarkHistoryV2Aggregate,
  buildRadarBenchmarkHistoryV2ById,
  buildRadarBenchmarks,
  buildRadarBenchmarkSummary,
  buildRadarEvidenceLedger,
  buildRadarEvidenceLedgerBrief,
  getBenchmarkArtifactMetadataById,
  listBenchmarkArtifactMetadata
} from '../services/radarBenchmarkService';
import { buildRadarBundlePlan, getRadarBundleById, listRadarBundles } from '../services/radarBundleRegistryService';
import { getRadarBundleRunById, listRadarBundleRuns } from '../services/radarBundleRunLedgerService';
import { buildEcosystemHistory, buildEndpointHistory, buildProviderHistory, normalizeHistoryWindow } from '../services/radarHistoryService';
import { buildEcosystemRiskSummary, buildEndpointRiskAssessment, buildProviderRiskAssessment } from '../services/radarRiskService';
import { buildAgentSpendReadiness, getAgentSpendReadinessCard } from '../services/radarAgentReadinessService';
import { createResponseCache } from '../services/responseCache';
import { createRequestDeadline, runWithinDeadline } from '../services/requestDeadline';
import { DEFAULT_LIVE_CATALOG_URL } from '../ingestion/payShCatalogAdapter';
import { degradationsCsv, endpointsCsv, providersCsv, routeCandidatesCsv } from '../services/radarCsvService';
import { listRouteMappings } from '../services/providerEndpointMap';
import { listMappingTargets } from '../services/mappingTargetService';
import { MACHINE_MARKET_PHASE_SCOPE, buildMachineMarketSummary, listMachineMarketServices } from '../services/machineMarketService';
import { getMachinePolicyTemplateById, listMachinePolicyTemplates } from '../services/machinePolicyService';
import {
  buildMachineDossier,
  configureMachineDemoSeed,
  configureMachinePreflightReceiptStorage,
  getMachinePreflightCoverageRunById,
  getMachinePreflightReceiptById,
  listRecentMachinePreflightCoverageRuns,
  listRecentMachinePreflightReceipts,
  runMachinePreflight,
  runMachinePreflightCoverageRun
} from '../services/machinePreflightService';
import { createMachineReceiptStorageMetadata, JsonlMachinePreflightReceiptStorageAdapter, MemoryMachinePreflightReceiptStorageAdapter, PostgresMachinePreflightReceiptStorageAdapter, type MachinePreflightReceiptStorageAdapter } from '../services/machinePreflightReceiptStorage';
import {
  buildAlibabaMachineTranslationGeneralBenchmarkReadinessArtifact,
  buildAlibabaMachineTranslationGeneralRepeatabilityArtifact,
  buildMachineBenchmarkReadinessReport,
  buildMachineBenchmarkMethodologyArtifacts,
  buildMachineBenchmarkGateCheck,
  buildMachineComparableRouteDiscovery,
  buildMachineTranslationEvidencePlan,
  buildBigQueryBoundedQueryFixtureReceipt,
  buildMachineExecutionRepeatabilityPack,
  buildNaverGeocodeFixtureReceipt,
  buildCloudTranslationSafePhraseFixtureReceipt,
  buildStableuploadTinyFixtureReceipt,
  deprecatedCloudTranslationExecutionResponse,
  ingestMachineExecutionReceipt,
  ingestAlibabaMachineTranslationGeneralArtifact,
  ingestAnyTransExecutionArtifact,
  runBigQueryLiveBoundedQuery,
  runTranslationExecutionRoute
} from '../services/machineExecutionService';
import { validateMachineExecutionProofByProfile } from '../services/machineExecutionProofProfiles';
import { createPreSpendIntelligenceService } from '../services/preSpendIntelligenceService';
import { createInMemoryPreSpendRepository, preSpendRepository } from '../repositories/preSpendRepository';
import { createInMemoryProofCheckRepository, proofCheckRepository } from '../repositories/proofCheckRepository';
import { createProofCheckService } from '../services/proofCheckService';
import { createInMemoryLoopRepository, loopRepository } from '../repositories/loopRepository';
import { createLoopService } from '../services/loopService';
import { checkSignalGraph, findSignalGraphNodesForEntity, getSignalGraph, getSignalGraphCluster, getSignalGraphClusters, getSignalGraphNode, getSignalGraphRipples, isSignalGraphEntityType } from '../services/signalGraphService';
import {
  buildRevenueReceiptSummary,
  getRevenueReceipt,
  listRevenueReceipts
} from '../services/revenueReceiptService';
import {
  assembleRhChain4663Index,
  assembleRhChainDailyReceipts,
  assembleRhChainLaunchSurfaces,
  assembleRhChainIntelligence,
  assembleRhChainMemePulse,
  assembleRhChainMemePulseScreen,
  assembleRhChainReceipts,
  assembleRhChainReviewQueue,
  buildRhChainApiErrorResponse,
  buildRhChainApiResponse
} from '../services/rhChainIntelligenceService';
import {
  buildUnicornRadarCandidateList,
  buildUnicornRadarSummary,
  createUnicornRadarSubmission,
  requestUnicornRadarEvaluation,
  resolveEnrichedUnicornRadarCandidate,
  UNICORN_RADAR_GENERATED_AT
} from '../services/unicornRadarService';
import { createEvaluationRequest, EvaluationRequestValidationError } from '../services/evaluationRequestService';
import { checkHermesHealth, createLivePreSpendRun, getHermesDeskSummary, getHermesRunById, listHermesRuns } from '../services/hermesBridge';
import { getHermesSkillById, getHermesSkillPack, listHermesSkillPackSkills } from '../data/hermesSkillPack';
import { convertHermesRunToReceipt } from '../services/hermesReceiptConverter';
import { isHermesClaimReviewState, promoteHermesClaimCandidate } from '../services/hermesClaimPromotion';
import {
  buildHermesReputationLedger,
  getHermesReputationEntry,
  listHermesProviderReputationEntries,
  listHermesRouteReputationEntries,
  listHermesServiceReputationEntries
} from '../services/hermesReputationLedger';
import {
  createHermesPreSpendDecision,
  createHermesPreSpendDecisionExample,
  resolveHermesPreSpendDecisionById
} from '../services/hermesPreSpendDecision';
import { createHermesDecisionReceipt, recordHermesDecisionOutcome } from '../services/hermesDecisionFeedback';
import { buildHermesMemoryLoopSummary } from '../services/hermesMemoryLoop';
import {
  checkHermesSpendPolicy,
  createHermesSpendPolicyExample,
  getDefaultHermesSpendPolicy,
  listHermesSpendPolicies,
  listHermesSpendPolicyRules,
  resolveHermesSpendPolicyCheckById
} from '../services/hermesSpendPolicy';
import { createHermesPolicyDecisionReceipt } from '../services/hermesPolicyReceipt';
import { previewHermesPolicyReconciliation, reconcileHermesPolicyOutcome, type HermesPolicyOutcome } from '../services/hermesPolicyReconciliation';
import {
  buildHermesWalletAuditTrailSummary,
  resolveHermesWalletAuditTrailById
} from '../services/hermesWalletAuditTrail';
import {
  buildHermesWalletRiskScoreSummary,
  resolveHermesWalletRiskScoreById
} from '../services/hermesWalletRiskScore';
import {
  createHermesWalletSafetyCheck,
  getHermesWalletSafetyExampleCheck
} from '../services/hermesWalletSafetyBundle';
import {
  buildWalletSafetyIntegrationReadinessReport,
  buildWalletSafetyIntegrationRegistry,
  getWalletSafetyIntegrationById
} from '../services/walletSafetyIntegrationRegistry';
import { createOpenApiSpec } from './openapi';

const IngestRequestSchema = z.object({ catalogUrl: z.string().url().optional() }).optional();
const HermesPreSpendRunRequestSchema = z.object({
  route_id: z.string().min(1),
  provider_id: z.string().min(1),
  service_id: z.string().min(1),
  spend_context: z.record(z.string(), z.unknown()).optional()
});
const HermesPreSpendDecisionInputSchema = z.object({
  route_id: z.string().min(1).optional(),
  provider_id: z.string().min(1).optional(),
  service_id: z.string().min(1).optional(),
  amount_usd: z.number().nonnegative().optional(),
  payment_rail: z.string().min(1).optional(),
  chain: z.string().min(1).optional(),
  agent_type: z.string().min(1).optional(),
  objective: z.string().min(1).optional()
}).strict();
const HermesSpendPolicyCheckInputSchema = HermesPreSpendDecisionInputSchema.extend({
  policy_id: z.string().min(1).optional()
}).strict();
const HermesWalletSafetyCheckInputSchema = HermesSpendPolicyCheckInputSchema;
const HermesDecisionOutcomeRequestSchema = z.object({
  outcome_state: z.enum(['successful', 'failed', 'partial', 'blocked', 'manual_review', 'unknown']).optional(),
  outcome_summary: z.string().min(1).optional(),
  spend_happened: z.boolean().optional(),
  amount_usd: z.number().nonnegative().optional(),
  observed_latency_ms: z.number().int().nonnegative().optional(),
  error_code: z.string().min(1).optional(),
  evidence_artifacts: z.array(z.object({
    id: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    kind: z.enum(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']).optional(),
    uri: z.string().min(1).optional(),
    summary: z.string().min(1).optional()
  }).strict()).optional()
}).strict().optional();
const HermesPolicyOutcomeRequestSchema = z.object({
  id: z.string().min(1).optional(),
  outcome_state: z.enum(['spent', 'test_spend_completed', 'blocked_as_required', 'manual_review_completed', 'manual_review_missing', 'spend_attempt_blocked', 'spent_despite_block', 'failed', 'unknown']).optional(),
  outcome_summary: z.string().min(1).optional(),
  spend_happened: z.boolean().optional(),
  amount_usd: z.number().nonnegative().optional(),
  chain: z.string().min(1).optional(),
  payment_rail: z.string().min(1).optional(),
  provider_id: z.string().min(1).optional(),
  route_id: z.string().min(1).optional(),
  service_id: z.string().min(1).optional(),
  observed_latency_ms: z.number().int().nonnegative().optional(),
  error_code: z.string().min(1).optional(),
  evidence_artifacts: z.array(z.object({
    id: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    kind: z.enum(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']).optional(),
    uri: z.string().min(1).optional(),
    summary: z.string().min(1).optional()
  }).strict()).optional(),
  created_at: z.string().datetime().optional()
}).strict().optional();
const HermesClaimPromotionRequestSchema = z.object({
  review_state: z.unknown().optional()
}).optional();
const MachinePreflightRequestSchema = z.object({
  machine_id: z.string().min(1),
  intent: z.string().min(1),
  category: z.string().min(1),
  max_cost_usd: z.number().nonnegative().optional(),
  allowed_markets: z.array(z.enum(['robotic.sh', 'pay.sh', 'agentic.market'])).optional(),
  allowed_chains: z.array(z.enum(['solana', 'base', 'peaq', 'omnichain', 'unknown'])).optional(),
  risk_tolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  requires_receipt: z.boolean().default(true),
  human_approved: z.boolean().optional(),
  policy_id: z.string().min(1).optional(),
  minimum_evidence_stage: z.enum(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']).optional()
});
const MachineReceiptQuerySchema = z.object({
  decision: z.enum(['allow', 'deny', 'review']).optional(),
  machine_id: z.string().min(1).optional(),
  service_id: z.string().min(1).optional(),
  source_market: z.enum(['robotic.sh', 'pay.sh', 'agentic.market']).optional(),
  chain: z.enum(['solana', 'base', 'peaq', 'omnichain', 'unknown']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});
const MachineCoverageRunQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(25).optional()
});
const MachineExecutionTranslationRequestSchema = z.object({
  machine_id: z.string().min(1),
  policy_id: z.string().min(1),
  service_id: z.string().optional(),
  text: z.string().min(1),
  source_language: z.string().min(2),
  target_language: z.string().min(2),
  max_cost_usd: z.number().positive(),
  minimum_evidence_stage: z.enum(['policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']).optional(),
  human_approved: z.boolean().optional()
});
const AnyTransExecutionArtifactIngestSchema = z.object({
  machine_id: z.string().min(1),
  service_id: z.literal('anytrans'),
  fqn: z.literal('solana-foundation/alibaba/anytrans'),
  source_market: z.literal('pay.sh'),
  chain: z.literal('solana'),
  preflight_receipt_id: z.string().min(1).optional().nullable(),
  execution_status: z.enum(['attempted', 'succeeded', 'failed']),
  execution_occurred: z.boolean(),
  payment_occurred: z.boolean(),
  payment_evidence: z.unknown().nullable(),
  execution_started_at: z.string().datetime(),
  execution_completed_at: z.string().datetime(),
  execution_latency_ms: z.number().int().nonnegative(),
  request_summary: z.record(z.string(), z.unknown()),
  response_summary: z.record(z.string(), z.unknown()).nullable(),
  executor: z.object({
    name: z.string().min(1),
    version: z.string().min(1).optional().nullable(),
    mode: z.enum(['pay_cli', 'x402', 'manual'])
  }),
  artifact_signature: z.string().optional().nullable()
}).strict().superRefine((value, ctx) => {
  const candidate = value as Record<string, unknown>;
  if ('benchmark' in candidate || 'benchmark_claim' in candidate || 'winner' in candidate || 'winner_claim' in candidate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'benchmark_or_winner_claim_fields_not_allowed' });
  }
  if (value.execution_status === 'succeeded') {
    const preview = value.response_summary && typeof value.response_summary.translated_text_preview === 'string'
      ? value.response_summary.translated_text_preview.trim()
      : '';
    if (!preview.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'response_summary.translated_text_preview required for succeeded execution_status' });
  }
  if (value.payment_occurred && value.payment_evidence == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'payment_occurred requires payment_evidence' });
  }
});
const AlibabaMachineTranslationGeneralExecutionArtifactIngestSchema = z.object({
  machine_id: z.string().min(1),
  service_id: z.literal('alibaba-machine-translation-general'),
  fqn: z.literal('solana-foundation/alibaba/machinetranslation'),
  source_market: z.literal('pay.sh'),
  chain: z.literal('solana'),
  preflight_receipt_id: z.string().min(1).optional().nullable(),
  execution_status: z.enum(['attempted', 'succeeded', 'failed']),
  execution_occurred: z.boolean(),
  payment_occurred: z.boolean(),
  payment_evidence: z.unknown().nullable(),
  execution_started_at: z.string().datetime(),
  execution_completed_at: z.string().datetime(),
  execution_latency_ms: z.number().int().nonnegative(),
  request_summary: z.record(z.string(), z.unknown()),
  response_summary: z.record(z.string(), z.unknown()).nullable(),
  executor: z.object({
    name: z.string().min(1),
    version: z.string().min(1).optional().nullable(),
    mode: z.enum(['pay_cli', 'x402', 'manual'])
  }),
  artifact_signature: z.string().optional().nullable()
}).strict().superRefine((value, ctx) => {
  const candidate = value as Record<string, unknown>;
  if ('benchmark' in candidate || 'benchmark_claim' in candidate || 'winner' in candidate || 'winner_claim' in candidate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'benchmark_or_winner_claim_fields_not_allowed' });
  }
  if (value.execution_status === 'succeeded') {
    const preview = value.response_summary && typeof value.response_summary.translated_text_preview === 'string'
      ? value.response_summary.translated_text_preview.trim()
      : '';
    if (!value.execution_occurred) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'execution_occurred=true required for succeeded execution_status' });
    if (!preview.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'response_summary.translated_text_preview required for succeeded execution_status' });
  }
  if (value.payment_occurred && value.payment_evidence == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'payment_occurred requires payment_evidence' });
  }
});
const MachineExecutionReceiptIngestSchema = z.object({
  machine_id: z.string().min(1),
  service_id: z.string().min(1),
  fqn: z.string().min(3),
  source_market: z.enum(['robotic.sh', 'pay.sh', 'agentic.market']),
  chain: z.enum(['solana', 'base', 'peaq', 'omnichain', 'unknown']),
  preflight_receipt_id: z.string().min(1).optional().nullable(),
  execution_status: z.enum(['attempted', 'succeeded', 'failed']),
  execution_occurred: z.boolean(),
  payment_occurred: z.boolean(),
  payment_evidence: z.unknown().nullable(),
  execution_started_at: z.string().datetime(),
  execution_completed_at: z.string().datetime(),
  execution_latency_ms: z.number().int().nonnegative(),
  request_summary: z.record(z.string(), z.unknown()),
  response_summary: z.record(z.string(), z.unknown()).nullable(),
  executor: z.object({
    name: z.string().min(1),
    version: z.string().min(1).optional().nullable(),
    mode: z.enum(['pay_cli', 'x402', 'manual'])
  }),
  artifact_signature: z.string().optional().nullable()
}).strict().superRefine((value, ctx) => {
  const candidate = value as Record<string, unknown>;
  if ('benchmark' in candidate || 'benchmark_claim' in candidate || 'winner' in candidate || 'winner_claim' in candidate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'benchmark_or_winner_claim_fields_not_allowed' });
  }
  const proofValidation = validateMachineExecutionProofByProfile({
    service_id: value.service_id,
    execution_status: value.execution_status,
    execution_occurred: value.execution_occurred,
    response_summary: value.response_summary
  });
  for (const issue of proofValidation.issues) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
  }
  if (value.payment_occurred && value.payment_evidence == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'payment_occurred requires payment_evidence' });
  }
});
const BigQueryFixtureIngestSchema = z.object({
  machine_id: z.string().min(1).optional(),
  execution_completed_at: z.string().datetime().optional()
}).optional();
const BigQueryLiveBoundedQueryRunSchema = z.object({
  machine_id: z.string().min(1),
  query: z.string().min(1),
  query_label: z.string().min(1),
  row_limit: z.number().int().positive().max(1000),
  dataset_classification: z.enum(['public', 'synthetic', 'explicitly_safe']),
  payment_evidence: z.unknown().nullable().optional()
}).strict();
const AttentionMarketIntakeRequestSchema = z.object({
  ticker: z.string().min(1),
  name: z.string().min(1),
  chain: z.string().min(1).optional(),
  attention_source_type: z.enum(['influencer', 'dev', 'ai_agent', 'community_archetype', 'streamer', 'reply_gang', 'anonymous_cult', 'unknown']).optional(),
  attention_source_label: z.string().min(1).optional(),
  submitter_handle: z.string().min(1).optional(),
  why_it_matters: z.string().min(1),
  evidence_links: z.array(z.string()).optional()
});
const optionalRhChainText = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).optional());
const optionalRhChainUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).max(500).refine((value) => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'must_be_a_valid_https_url').optional());
const RhChainSignalSubmissionSchema = z.object({
  token_contract: z.string().trim().min(1).max(128).refine(isRhChainIdentityContract, 'exact_non_placeholder_contract_required'),
  ticker: z.string().trim().min(1).max(24),
  chain: z.string().trim().min(1).max(64).default('Robinhood Chain'),
  x_twitter_link: optionalRhChainUrl,
  website_link: optionalRhChainUrl,
  liquidity_link: optionalRhChainUrl,
  evidence_links: z.array(z.string().trim().min(1).max(500).refine((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, 'must_be_a_valid_https_url')).max(12).optional(),
  deployer_notes: optionalRhChainText.pipe(z.string().max(2_000).optional()),
  submitter_notes: optionalRhChainText.pipe(z.string().max(2_000).optional()),
  launch_source: z.enum(['noxa_fun', 'flap_sh', 'trensh_today', 'bankr', 'tokeny_fun', 'vlad_fun', 'robindotmarket', '20lab_erc20', 'pump_fun_routed_rh_chain', 'uniswap_direct_pool', 'hardhat_foundry_custom', 'unknown_manual']).optional(),
  launch_surface_url: optionalRhChainUrl,
  pair_address: optionalRhChainText.pipe(z.string().max(128).optional()),
  deployer_address: optionalRhChainText.pipe(z.string().max(128).optional()),
  lp_status_claim: z.enum(['unknown', 'locked_claimed', 'burned_claimed', 'unlocked', 'unavailable']).optional(),
  scout_handle: optionalRhChainText.pipe(z.string().min(2).max(64).optional()),
  scout_contact: optionalRhChainText.pipe(z.string().max(256).optional()),
  public_attribution_consent: z.boolean().optional(),
  disclosure_confirmed: z.boolean().refine((value) => value, { message: 'disclosure_must_be_confirmed' })
}).strict().superRefine((value, ctx) => {
  if (!value.x_twitter_link && !value.website_link && !value.liquidity_link && !value.deployer_notes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'at_least_one_receipt_or_deployer_note_required',
      path: ['x_twitter_link']
    });
  }
  if (value.public_attribution_consent && !value.scout_handle) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scout_handle_required_for_public_attribution', path: ['scout_handle'] });
});
const RhChainScoutQuerySchema = z.object({ query: z.string().trim().min(1).max(500), mode: z.enum(RH_CHAIN_SCOUT_MODES).optional() }).strict();
const RhChainReviewUpdateSchema = z.object({
  review_status: z.enum(['queued_for_manual_review', 'under_receipt_check', 'needs_more_evidence', 'watch_only', 'approved_signal', 'do_not_touch_yet', 'rejected_low_receipt_quality']).optional(),
  reviewer_note: optionalRhChainText,
  evidence_summary: optionalRhChainText,
  missing_evidence: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  risk_state: z.enum(['low_watch', 'medium_watch', 'high_risk', 'source_required', 'do_not_touch_yet']).optional(),
  signal_state: z.enum(['fresh_signal', 'attention_spike', 'durable_candidate', 'liquidity_mirage', 'deployer_cluster_risk', 'top_holder_risk', 'stock_token_spillover', 'rwa_narrative_reassertion', 'agentic_economy_signal', 'meme_rwa_divergence', 'do_not_touch_yet']).optional(),
  infopunks_verdict: optionalRhChainText,
  audit_note: z.string().trim().min(1).max(2_000),
  last_seen_updated_at: z.string().datetime().optional()
}).strict().refine((value) => Object.keys(value).some((key) => key !== 'audit_note' && key !== 'last_seen_updated_at'), { message: 'at_least_one_review_field_required' });
const MAX_INLINE_SUPPORTING_EVENT_IDS = 10;
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://radar.infopunks.fun',
  'https://infopunks-pay-sh-radar.onrender.com',
  'https://infopunks-pay-sh-radar-web.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-RH-Chain-Reviewer-Id'];
const CORS_MAX_AGE_SECONDS = 86_400;

export type CreateAppOptions = {
  clientDistDir?: string | null;
  rhChainSubmissionStore?: RhChainSubmissionStore;
  rhChainReviewedClassificationStore?: RhChainReviewedClassificationStore;
  rhChainProjectClaimsStore?: RhChainProjectClaimsStore;
  rhChainLiveSnapshotOptions?: Partial<RhChainLiveSnapshotOptions>;
  rhChainLiveTokenRouteTimeoutMs?: number;
  rhChainMarketDataOptions?: Partial<Omit<RhChainMarketDataServiceOptions, 'provider'>> & { provider?: RhChainDexScreenerIngestionSource };
  rhChainMarketStructureOptions?: Partial<Omit<RhChainMarketStructureOptions, 'marketData'>>;
  rhChainTokenRegistryOptions?: Partial<Omit<RhChainTokenRegistryOptions, 'provider' | 'enabled' | 'receipts' | 'marketStructure'>> & { provider?: BlockscoutProvider; enabled?: boolean };
  rhChainMarketSnapshotStore?: RhChainMarketSnapshotStore;
  rhChainMarketSnapshotOptions?: Partial<Omit<RhChainMarketSnapshotServiceOptions, 'store' | 'provider' | 'watchlist' | 'classificationFor' | 'enabled'>> & { enabled?: boolean };
  rhChainAttentionReceiptStore?: RhChainAttentionReceiptStore;
  rhChainPublicRateLimit?: Partial<{ enabled: boolean; windowMs: number; max: number }>;
  rhChainAutomationStore?: RhChainAutomationStore;
  rhChainMetricsSnapshotStore?: RhChainMetricsSnapshotStore;
  rhChainMemePulseSnapshotStore?: RhChainMemePulseSnapshotStore;
  rhChainLaunchpadSnapshotStore?: RhChainLaunchpadSnapshotStore;
  rhChainDailyReceiptDraftStore?: RhChainDailyReceiptDraftStore;
  rhChainRiskCorrelationSnapshotStore?: RhChainRiskCorrelationSnapshotStore;
  rh4663Store?: Rh4663Store;
  rh4663ResolutionStore?: Rh4663ResolutionStore;
  rh4663ResolutionSigner?: Rh4663ResolutionSigner;
  rh4663AnchorAdapter?: Rh4663AnchorAdapter;
  rh4663IntelligenceStore?: Rh4663IntelligenceStore;
  rh4663PrintStore?: Rh4663PrintStore;
  rh4663UtcDayObservationStore?: Rh4663UtcDayObservationStore;
};

const RH_CHAIN_LIVE_TOKEN_ROUTE_RESERVE_MS = 1_000;
const RH_CHAIN_LIVE_TOKEN_CONTEXT_READ_MAX_MS = 800;
const RH_CHAIN_LIVE_TOKEN_CACHE_READ_MAX_MS = 300;

export function liveTokenRouteBudgets(totalMs: number, configuredProviderMs: number) {
  const total = Math.max(1, Math.floor(totalMs));
  return {
    totalMs: total,
    providerMs: Math.max(1, Math.min(configuredProviderMs, total - Math.min(RH_CHAIN_LIVE_TOKEN_ROUTE_RESERVE_MS, Math.floor(total / 2)))),
    contextReadMs: Math.max(1, Math.min(RH_CHAIN_LIVE_TOKEN_CONTEXT_READ_MAX_MS, total - 1)),
    cacheReadMs: Math.max(1, Math.min(RH_CHAIN_LIVE_TOKEN_CACHE_READ_MAX_MS, total - 1))
  };
}

class RhChainPublicRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly enabled: boolean, private readonly windowMs: number, private readonly max: number) {}
  consume(key: string) {
    if (!this.enabled) return { allowed: true, retryAfterMs: 0 };
    const now = Date.now();
    const prior = this.hits.get(key);
    const entry = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + this.windowMs } : prior;
    entry.count += 1; this.hits.set(key, entry);
    return { allowed: entry.count <= this.max, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
}

export async function createApp(
  preloadedStore?: IntelligenceStore,
  repositoryInput?: IntelligenceRepository,
  options: CreateAppOptions = {}
) {
  const config = loadRuntimeConfig();
  const app = Fastify({ logger: false });
  const rh4663CampaignTelemetry = new Rh4663CampaignTelemetry();
  const rhChainPostgresPool = config.databaseUrl
    ? getDatabasePool({ connectionString: config.databaseUrl, max: config.databasePoolMax })
    : null;
  const repository = repositoryInput ?? defaultRepository(rhChainPostgresPool ?? undefined);
  const rhChainPostgresReadiness = rhChainPostgresPool ? new RhChainPostgresReadiness() : null;
  // Reflexive observations are a separate evidence stream; this does not read or
  // mutate any CALL, RESOLUTION, PRINT, Genesis, signature, or Merkle state.
  const reflexiveRpcUrl = config.rhChainRpcUrl ?? (!config.isProduction ? 'https://rpc.mainnet.chain.robinhood.com' : null);
  const reflexiveVerifier = reflexiveRpcUrl ? new PairV5OnchainVerifier({ rpcUrl: reflexiveRpcUrl, providerName: config.rhChainRpcUrl ? 'configured_rh_chain_rpc' : 'robinhood_public_rpc_development_fallback' }) : null;
  const longDopplerVerifier = reflexiveRpcUrl ? new LongDopplerVerifier({ rpcUrl: reflexiveRpcUrl, providerName: config.rhChainRpcUrl ? 'configured_rh_chain_rpc' : 'robinhood_public_rpc_development_fallback' }) : null;
  const stockSupplyIndexer = reflexiveRpcUrl ? new StockTokenSupplyIndexer({ rpcUrl: reflexiveRpcUrl, providerName: config.rhChainRpcUrl ? 'configured_rh_chain_rpc' : 'robinhood_public_rpc_development_fallback' }) : null;
  const reflexiveProvider: ReflexiveProvider = {
    async assets() {
      const response = await fetch('https://api.robinhood.com/rhj/assets', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(config.rhChainProviderTimeoutMs) });
      if (!response.ok) throw new Error(`rhj_assets_http_${response.status}`);
      return response.json();
    },
    async discover(assets) {
      if (!reflexiveVerifier) return [];
      return new PairV5DiscoveryAdapter({ verifyPool: (candidate) => reflexiveVerifier.verify(candidate, assets) }).discover(assets);
    },
    async observations(pairs, assets) {
      if (!reflexiveVerifier) return [];
      const now = new Date().toISOString(); const observations = [];
      for (const pair of pairs) {
        const verification = await reflexiveVerifier.verify({ protocol: pair.protocol, venue: pair.venue, pool_id: pair.pool_id, mission_contract: pair.mission_contract, mission_symbol: pair.mission_symbol, quote_contract: pair.quote_contract, launched_at: pair.launched_at, launch_tx_hash: pair.launch_id, hook: pair.verification.pool_key?.hooks ?? null, evidence: pair.evidence }, assets);
        if (verification.verification_status !== 'VERIFIED') continue;
        const asset = assets.find((item) => item.asset_id === pair.stock_asset_id);
        observations.push({ observation_id: stableId('v4-observation', pair.pair_id, String(verification.state_observed_block)), pair_id: pair.pair_id, observed_at: verification.state_observed_at ?? now, fetched_at: now, observed_block: verification.state_observed_block, sqrt_price_x96: verification.sqrt_price_x96, tick: verification.tick, active_liquidity: verification.active_liquidity, mission_stock_price: null, multiplier_context: asset?.current_multiplier ?? null, mission_usd_price: null, stock_dex_usd_price: null, underlying_usd_price: null, underlying_observed_at: null, liquidity_usd: null, volume_24h_usd: null, quote_inventory_raw: null, quote_inventory_share_equivalent: null, inventory_method: 'unavailable' as const, fresh: true, provenance: pair.evidence, immutable: true as const });
      }
      return observations;
    },
    async inventory(pairs, assets) {
      if (!reflexiveVerifier) return { identities: [], proofs: [], observations: [] };
      // One pinned block makes every position numerator and canonical totalSupply denominator
      // directly comparable. If this read fails, individual observations fail closed.
      const referenceBlock = await reflexiveVerifier.currentBlock(); const identities = []; const proofs = []; const observations = [];
      for (const pair of pairs) { const asset = assets.find((item) => item.asset_id === pair.stock_asset_id); if (!asset || pair.verification.verification_status !== 'VERIFIED') continue; const accounted = await reflexiveVerifier.observeLockedPosition(pair, asset, referenceBlock); if (accounted.identity) identities.push(accounted.identity); if (accounted.proof) proofs.push(accounted.proof); observations.push(accounted.observation); }
      return { identities, proofs, observations };
    },
    async supplyEvents(assets, prior) {
      const nvda = assets.find((asset) => asset.ticker === 'NVDA'); const pltr = assets.find((asset) => asset.ticker === 'PLTR');
      const selected = [nvda, pltr].filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
      return stockSupplyIndexer ? (await Promise.all(selected.map((asset) => stockSupplyIndexer.scan(asset, prior)))).flat() : [];
    },
    async canonicalSupply(asset) {
      const observed = stockSupplyIndexer ? await stockSupplyIndexer.observeSupply(asset) : null;
      return observed ? { ...observed, share_equivalent_supply: observed.total_supply_units } : null;
    },
    async pltrUnderlyingReference(asset) {
      try { const fetchedAt = new Date(); const response = await fetch(`https://api.robinhood.com/rhj/prices/${encodeURIComponent(asset.ticker)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(config.rhChainProviderTimeoutMs) }); const payload = await response.json() as { quotes?: Array<{ tokenSymbol?: string; bid?: string; ask?: string; generatedAt?: string }> }; const quote = payload.quotes?.find((item) => item.tokenSymbol === 'PLTR'); const bid = Number(quote?.bid); const ask = Number(quote?.ask); const generatedAt = quote?.generatedAt ?? null; const age = generatedAt ? fetchedAt.getTime() - Date.parse(generatedAt) : Number.POSITIVE_INFINITY; if (!response.ok || !quote || !Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0 || !generatedAt || age > 120_000) return null; const session = (() => { const day = fetchedAt.getUTCDay(); if (day === 0 || day === 6) return 'WEEKEND' as const; const minute = fetchedAt.getUTCHours() * 60 + fetchedAt.getUTCMinutes(); return minute >= 13 * 60 + 30 && minute < 20 * 60 ? 'OPEN' as const : 'CLOSED' as const; })(); return { symbol: 'PLTR' as const, bid, ask, midpoint: (bid + ask) / 2, generated_at: generatedAt, fetched_at: fetchedAt.toISOString(), freshness: 'fresh' as const, session, source: 'RHJ_PRICES' as const, methodology: 'RHJ_RAW_UNDERLYING_MIDPOINT_V1' as const };
      } catch { return null; }
    },
    async pltrMarkets(asset, assets) {
      let records; try { records = await rhChainMarketProvider.getTokenPairs(asset.canonical_contract); } catch { return []; }
      const canonical = new Set(assets.map((item) => item.canonical_contract));
      return (await Promise.all(records.map(async (record) => {
        const base = record.baseToken?.address?.toLowerCase(); const quote = (record.quoteTokenAddress ?? record.quoteToken?.address)?.toLowerCase(); if (!base || !quote || !record.pairAddress || (base !== asset.canonical_contract && quote !== asset.canonical_contract)) return [];
        const matchingPair = false; // Provider listings are discovery context; launch provenance is not inferred.
        let relationship = classifyPltrRelationship({ pltr_contract: asset.canonical_contract, base_contract: base, quote_contract: quote, base_is_canonical_stock: canonical.has(base), quote_is_canonical_stock: canonical.has(quote), mission_provenance_verified: matchingPair });
        const transactions = record.txns.h24.buys === null || record.txns.h24.sells === null ? null : record.txns.h24.buys + record.txns.h24.sells;
        const poolId = record.pairAddress.toLowerCase(); let state = null; let recovered = null; let verification = null; let priceUsd: string | null = null;
        if (reflexiveVerifier && reflexiveRpcUrl && /^0x[a-f0-9]{64}$/.test(poolId)) { try { [state, recovered] = await Promise.all([reflexiveVerifier.stateViewPoolState(poolId as `0x${string}`), recoverV4PoolKeyFromInitialize({ rpc_url: reflexiveRpcUrl, pool_id: poolId, pool_manager: CANONICAL_UNISWAP_V4_POOL_MANAGER_4663 })]); if (recovered) { const pltrContract = '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a'; const usdg = '0x5fc5360d0400a0fd4f2af552add042d716f1d168'; const isUsdG = [recovered.currency0, recovered.currency1].includes(pltrContract) && [recovered.currency0, recovered.currency1].includes(usdg); const isStockStock = canonical.has(recovered.currency0) && canonical.has(recovered.currency1); relationship = isUsdG ? 'DIRECT_PRICE_DISCOVERY' : isStockStock ? 'STOCK_STOCK' : 'OTHER'; verification = await verifyPltrV4Market({ chain_id: 4663, canonical_pltr_contract: pltrContract, base_contract: recovered.currency0, quote_contract: recovered.currency1, relationship, pool_key: { currency0: recovered.currency0, currency1: recovered.currency1, fee: recovered.fee, tick_spacing: recovered.tick_spacing, hooks: recovered.hooks }, reported_pool_id: poolId, state: state ? { sqrt_price_x96: state.sqrt_price_x96, tick: state.tick, active_liquidity: state.active_liquidity, observed_block: state.observed_block, observed_at: state.observed_at, state_view: state.state_view } : null }); if (verification.status === 'VERIFIED' && isUsdG) { let requestId = 0; const rpcCall = async (contract: string) => { const response = await fetch(reflexiveRpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method: 'eth_call', params: [{ to: contract, data: '0x313ce567' }, 'latest'] }) }); const body = await response.json() as { result?: string }; return Number(BigInt(body.result ?? '0x0')); }; const usdgDecimals = await rpcCall(usdg); const pltrDecimals = await rpcCall(pltrContract); if (usdgDecimals !== 6 || pltrDecimals !== 18) throw new Error('canonical_decimal_verification_failed'); priceUsd = v4PriceFromSqrtPriceX96({ sqrt_price_x96: state!.sqrt_price_x96, currency0_decimals: recovered.currency0 === usdg ? usdgDecimals : pltrDecimals, currency1_decimals: recovered.currency1 === usdg ? usdgDecimals : pltrDecimals, base_is_currency0: recovered.currency0 === pltrContract }); } } } catch { /* every failed proof remains discovery context */ } }
        const freshness = state ? 'fresh' as const : record.freshness === 'fresh' || record.freshness === 'stale' ? record.freshness : 'unavailable' as const;
        return [{ pool_id: poolId, pool_address: poolId, venue: record.dexId ?? 'unknown_amm', dex_version: state ? 'V4' : null, base_contract: recovered?.currency0 ?? base, quote_contract: recovered?.currency1 ?? quote, base_symbol: record.baseToken?.symbol ?? null, quote_symbol: record.quoteTokenSymbol ?? record.quoteToken?.symbol ?? null, relationship, quote_direction_verified: false, verification_state: verification?.status ?? 'DISCOVERED_UNVERIFIED' as const, liquidity_usd: record.liquidityUsd, volume_24h_usd: record.volume.h24, transaction_count: transactions, observed_at: state?.observed_at ?? record.providerTimestamp ?? record.capturedAt, source: recovered ? 'Canonical Uniswap V4 Initialize event + StateView' : 'DexScreener discovery context', freshness, pool_state: state ? { sqrt_price_x96: state.sqrt_price_x96, tick: state.tick, active_liquidity: state.active_liquidity, observed_block: state.observed_block, state_view: state.state_view } : null, depth_primitive: verification?.depth_primitive ?? null, pool_key: recovered ? { currency0: recovered.currency0, currency1: recovered.currency1, fee: recovered.fee, tick_spacing: recovered.tick_spacing, hooks: recovered.hooks } : null, pool_id_derived: verification?.pool_id_derived ?? null, initialize_evidence: recovered, price_usd: priceUsd, price_source: priceUsd ? 'VERIFIED_DIRECT_PLTR_PRICE_V1' : null, verification_failures: verification?.failures ?? (state ? ['POOL_KEY_UNRESOLVED'] : ['POOL_KEY_UNRESOLVED', 'STATEVIEW_UNAVAILABLE']) }];
      }))).flat();
    },
    async quoteMarkets(missionContract) {
      // Exact-contract taxonomy, pinned here until a first-party quote registry exists.
      let records; try { records = await rhChainMarketProvider.getTokenPairs(missionContract); } catch { return []; }
      return records.flatMap((record) => {
        const mission = missionContract.toLowerCase(); const base = record.baseToken?.address?.toLowerCase(); const quote = (record.quoteTokenAddress ?? record.quoteToken?.address)?.toLowerCase(); if (!base || !quote || !record.pairAddress) return [];
        const quoteContract = base === mission ? quote : quote === mission ? base : null; if (!quoteContract) return [];
        const quoteSymbol = base === mission ? (record.quoteTokenSymbol ?? record.quoteToken?.symbol ?? null) : (record.baseToken?.symbol ?? null);
        const transactions = record.txns.h24.buys === null || record.txns.h24.sells === null ? null : record.txns.h24.buys + record.txns.h24.sells;
        return [quoteMarketFromRaw({ pool_id: record.pairAddress, protocol: record.dexId ?? 'unknown_amm', dex: record.dexId, mission_contract: mission, mission_symbol: 'AI', base_contract: base, quote_contract: quoteContract, quote_symbol: quoteSymbol, liquidity_usd: record.liquidityUsd, volume_24h_usd: record.volume.h24, transaction_count: transactions, observed_at: record.providerTimestamp ?? record.capturedAt, source_url: record.sourceUrl, freshness: record.freshness ?? 'unavailable' }, { canonical_stock_contracts: ['0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec'], weth_contracts: ['0x0bd7d308f8e1639fab988df18a8011f41eacad73', '0x0000000000000000000000000000000000000000'], stablecoin_contracts: ['0x5fc5360d0400a0fd4f2af552add042d716f1d168'], mission_contracts: [mission], derivative_equity_contracts: [] })];
      });
    },
    async longAudit(asset) { return longDopplerVerifier ? longDopplerVerifier.observeAiNvda(asset) : null; }
  };
  const reflexiveRadar = new ReflexiveRadarService(rhChainPostgresPool ? new PostgresReflexiveStore(rhChainPostgresPool) : new InMemoryReflexiveStore(), reflexiveProvider);
  const rhChainExpectedTables = [
    'rh_chain_signal_submissions',
    'rh_chain_metrics_snapshots',
    'rh_chain_daily_receipt_drafts',
    'rh_chain_published_daily_receipts',
    'rh_chain_risk_correlation_snapshots',
    'rh_4663_genesis_wallets',
    'rh_4663_pulse_calls',
    'rh_4663_events',
    'rh_4663_today_editions',
    'rh_4663_signals',
    'rh_4663_pulse_window_resolutions',
    'rh_4663_resolution_receipts',
    'rh_4663_window_anchors',
    ...(config.rh4663Phase3Enabled ? ['rh_4663_observations', 'rh_4663_signal_candidates', 'rh_4663_signal_publications', 'rh_4663_signal_distribution', 'rh_4663_signal_corrections', 'rh_4663_provider_health'] as const : []),
    ...((config.rhChainMarketHistoryEnabled || config.rhChainAutomationEnabled) ? ['rh_chain_market_snapshots'] as const : []),
    ...(config.rhChainReviewedClassificationsEnabled ? ['rh_chain_reviewed_classifications', 'rh_chain_reviewed_classification_audit'] as const : [])
    ,...((config.rhChainProjectClaimsEnabled || config.rhChainIntelligenceReceiptsEnabled || config.rhChainProjectDirectoryEnabled) ? ['rh_chain_projects', 'rh_chain_project_claims', 'rh_chain_project_evidence', 'rh_chain_project_observations', 'rh_chain_project_verdicts', 'rh_chain_intelligence_receipts', 'rh_chain_project_audit', 'rh_chain_project_contract_relationships'] as const : [])
  ] as const;
  rhChainPostgresPool?.on('error', (error) => {
    console.log(JSON.stringify({
      event: 'rh_chain_storage_pool_error',
      service: 'rh_chain_storage',
      operation: 'idle_pool_client',
      failure_kind: classifyPostgresFailure(error),
      error_code: postgresErrorCode(error),
      error: safeOperationalErrorMessage(error),
      stack: safeOperationalStack(error)
    }));
  });
  if (rhChainPostgresPool && rhChainPostgresReadiness) {
    void probeDatabaseRecovery(rhChainPostgresPool);
  }
  const rhChainSubmissionStore: RhChainSubmissionStore = options.rhChainSubmissionStore
    ?? (rhChainPostgresPool ? new PostgresRhChainSubmissionStore(rhChainPostgresPool)
      : config.isProduction ? new UnconfiguredRhChainSubmissionStore()
        : new InMemoryRhChainSubmissionStore());
  const rhChainReviewedClassificationStore: RhChainReviewedClassificationStore = options.rhChainReviewedClassificationStore
    ?? (rhChainPostgresPool ? new PostgresRhChainReviewedClassificationStore(rhChainPostgresPool) : new InMemoryRhChainReviewedClassificationStore());
  const rhChainReviewedClassifications = new RhChainReviewedClassificationService(rhChainReviewedClassificationStore);
  const rhChainProjectClaimsStore: RhChainProjectClaimsStore = options.rhChainProjectClaimsStore
    ?? (rhChainPostgresPool ? new PostgresRhChainProjectClaimsStore(rhChainPostgresPool) : new InMemoryRhChainProjectClaimsStore());
  const rhChainProjectClaims = new RhChainProjectClaimsService(rhChainProjectClaimsStore);
  const rhChainLiveSnapshots = new RhChainLiveSnapshotService({
    enabled: config.rhChainLiveSnapshotsEnabled,
    timeoutMs: config.rhChainProviderTimeoutMs,
    ttlSeconds: config.rhChainCacheTtlSeconds,
    blockscoutUrl: config.rhChainBlockscoutUrl,
    databaseUrl: config.databaseUrl,
    databasePool: rhChainPostgresPool,
    log: (entry) => console.log(JSON.stringify(entry)),
    ...options.rhChainLiveSnapshotOptions
  });
  const rhChainMarketProvider = options.rhChainMarketDataOptions?.provider ?? new DexScreenerProvider({
    enabled: config.dexScreenerEnabled,
    baseUrl: config.dexScreenerBaseUrl,
    chainId: config.dexScreenerRhChainId,
    timeoutMs: config.dexScreenerTimeoutMs,
    cacheTtlSeconds: config.dexScreenerCacheTtlSeconds,
    staleWhileRevalidateSeconds: config.dexScreenerStaleWhileRevalidateSeconds,
    staleIfErrorSeconds: config.dexScreenerStaleIfErrorSeconds,
    maxStaleSeconds: config.dexScreenerMaxStaleSeconds,
    maxBatchSize: config.dexScreenerMaxBatchSize,
    maxRetries: config.dexScreenerMaxRetries,
    retryBaseMs: config.dexScreenerRetryBaseMs,
    maxConcurrency: config.dexScreenerMaxConcurrency,
    rateLimitPerSecond: config.dexScreenerRateLimitPerSecond,
    log: (entry) => console.warn(JSON.stringify(entry))
  });
  const rhChainMarketData = new RhChainMarketDataService({
    provider: rhChainMarketProvider,
    enabled: config.dexScreenerEnabled,
    knownTokenAddresses: async () => [...(await rhChainSubmissionStore.list()).map((submission) => submission.token_contract), ...rhChainReviewedLayerClassifications.map((classification) => classification.contract)],
    classificationFor: async (contract): Promise<RhChainReviewedClassification> => {
      const record = (await rhChainSubmissionStore.list()).find((submission) => submission.token_contract.toLowerCase() === contract.toLowerCase());
      if (!record || !['approved_signal', 'rejected', 'needs_evidence', 'queued_for_manual_review', 'under_review'].includes(record.review_status)) {
        return { primary_layer: 'unknown', secondary_layers: [], confidence: null, source: 'review_required' };
      }
      return {
        primary_layer: record.signal_state ?? 'unknown', secondary_layers: [],
        confidence: record.review_status === 'approved_signal' ? 'reviewed' : null,
        source: record.review_status === 'approved_signal' ? 'human_reviewed' : 'review_required'
      };
    },
    ...options.rhChainMarketDataOptions
  });
  const rhChainMetricsSnapshotStore: RhChainMetricsSnapshotStore = options.rhChainMetricsSnapshotStore
    ?? (rhChainPostgresPool ? new PostgresRhChainMetricsSnapshotStore(rhChainPostgresPool) : new InMemoryRhChainMetricsSnapshotStore());
  const rhChainChainPulse = new RhChainChainPulseService(rhChainMetricsSnapshotStore);
  const rh4663UtcDayObservationStore = options.rh4663UtcDayObservationStore ?? (rhChainPostgresPool ? new PostgresRh4663UtcDayObservationStore(rhChainPostgresPool) : new InMemoryRh4663UtcDayObservationStore());
  const rh4663UtcDayObservations = new Rh4663UtcDayObservationService({ store: rh4663UtcDayObservationStore, providers: createRh4663UtcDayProviders({ blockscoutUrl: config.rhChainBlockscoutUrl, timeoutMs: config.rhChainProviderTimeoutMs }), log: (entry) => console.log(JSON.stringify(entry)) });
  const rh4663PrintStore = options.rh4663PrintStore ?? (rhChainPostgresPool ? new PostgresRh4663PrintStore(rhChainPostgresPool) : new InMemoryRh4663PrintStore());
  const rh4663PrintGenerator = new Rh4663PrintGeneratorService({
    store: rh4663PrintStore,
    log: (entry) => console.log(JSON.stringify(entry)),
    observations: async (requestedDate) => {
      const metrics = await rhChainChainPulse.getLatest();
      const completedDate = requestedDate ?? metrics?.observed_at.slice(0, 10) ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const completed = await rh4663UtcDayObservations.observations(completedDate);
      if (!metrics) {
        const live = await rhChainLiveSnapshots.getLiveSnapshot(); const provider = live.provider_statuses.find((item) => item.provider_name === 'DefiLlama'); const observedAt = live.chain_metrics.source_timestamp ?? live.generated_at;
        if (requestedDate && requestedDate !== observedAt.slice(0, 10)) return { observations: completed, warnings: [`No cached provider snapshot matches ${requestedDate}; latest observed snapshot is ${observedAt.slice(0, 10)}.`] };
        if (provider?.status !== 'fresh') return { observations: completed, warnings: ['No persisted DefiLlama metrics snapshot is available.', `Live DefiLlama cache is ${provider?.status ?? 'unavailable'}; no candidate observation is inferred.`] };
        const start = new Date(new Date(observedAt).getTime() - 86_400_000).toISOString(); const liveObservations: Rh4663VerifiedObservation[] = [];
        const addLive = (metric: string, value: number | null, unit: Rh4663VerifiedObservation['unit'], window_type: Rh4663VerifiedObservation['window_type'], methodology: string) => { if (typeof value === 'number' && Number.isFinite(value)) liveObservations.push({ observation_id: `defillama:live:${observedAt}:${metric}`, chain_id: 4663, metric, value, unit, provider: 'DefiLlama', source_url: 'https://defillama.com/chain/Robinhood', observed_at: observedAt, fetched_at: live.generated_at, window_start: window_type === 'LIVE_SNAPSHOT' ? observedAt : start, window_end: observedAt, window_type, methodology, freshness: 'LIVE', confidence: live.chain_metrics.source_timestamp ? 70 : 55, status: 'PROVISIONAL' }); };
        addLive('dex_volume_rolling_24h_usd', live.chain_metrics.dex_volume_24h_usd, 'USD', 'ROLLING_24H', 'Fresh cached DefiLlama rolling 24-hour chain DEX-volume context.'); addLive('tvl_usd', live.chain_metrics.tvl_usd, 'USD', 'LIVE_SNAPSHOT', 'Fresh cached DefiLlama chain TVL context.'); addLive('stablecoin_market_cap_usd', live.chain_metrics.stablecoin_market_cap_usd, 'USD', 'LIVE_SNAPSHOT', 'Fresh cached DefiLlama stablecoin market-cap context.');
        return { observations: [...completed, ...liveObservations], warnings: ['Using a fresh cached provider observation; it remains provisional until a completed UTC-day source is available.', 'Blockscout chain-wide UTC transaction totals and DefiLlama UTC-day DEX volume are not currently exposed by the existing snapshot surfaces.'] };
      }
      const observedDate = metrics.observed_at.slice(0, 10);
      if (requestedDate && requestedDate !== observedDate) return { observations: completed, warnings: [`No persisted provider snapshot matches ${requestedDate}; latest observed snapshot is ${observedDate}.`] };
      const freshness: Rh4663ObservationFreshness = metrics.freshness_state === 'fresh' ? 'RECENT' : metrics.freshness_state === 'stale' ? 'STALE' : 'UNAVAILABLE';
      const end = metrics.observed_at; const start = new Date(new Date(end).getTime() - 86_400_000).toISOString(); const observations: Rh4663VerifiedObservation[] = [];
      const add = (metric: string, value: number | null, unit: Rh4663VerifiedObservation['unit'], window_type: Rh4663VerifiedObservation['window_type'], methodology: string) => { if (typeof value === 'number' && Number.isFinite(value)) observations.push({ observation_id: `defillama:${metrics.snapshot_id}:${metric}`, chain_id: 4663, metric, value, unit, provider: 'DefiLlama', source_url: 'https://defillama.com/chain/Robinhood', observed_at: metrics.observed_at, fetched_at: metrics.fetched_at, window_start: window_type === 'LIVE_SNAPSHOT' ? metrics.observed_at : start, window_end: end, window_type, methodology, freshness, confidence: metrics.confidence_level === 'high' ? 85 : metrics.confidence_level === 'medium' ? 70 : 45, status: 'PROVISIONAL' }); };
      add('dex_volume_rolling_24h_usd', metrics.dex_volume_24h, 'USD', 'ROLLING_24H', 'Persisted DefiLlama rolling 24-hour chain DEX-volume context.');
      add('tvl_usd', metrics.tvl, 'USD', 'LIVE_SNAPSHOT', 'Persisted DefiLlama chain TVL context.');
      add('stablecoin_market_cap_usd', metrics.stablecoin_market_cap, 'USD', 'LIVE_SNAPSHOT', 'Persisted DefiLlama chain stablecoin market-cap context.');
      const warnings = [...metrics.source_notes];
      if (metrics.freshness_state !== 'fresh') warnings.push(`Provider snapshot is ${metrics.freshness_state}; it cannot qualify a Print for freezing.`);
      warnings.push('Rolling snapshot data is contextual only. Final UTC-day observations, when available, are loaded separately from the completed-day observation store.');
      return { observations: [...completed, ...observations], warnings };
    }
  });
  let rhChainDiscoveryQueue: RhChainDiscoveryQueueService | null = null;
  let rhChainReviewPipeline: RhChainReviewPipelineService | null = null;
  let rhChainMarketSnapshots: RhChainMarketSnapshotService;
  const rhChainCrossLayerIntegration = config.rhChainReviewedClassificationsEnabled ? new RhChainCrossLayerIntegrationService({
    reviewedClassifications: rhChainReviewedClassifications,
    curatedClassifications: rhChainReviewedLayerClassifications,
    latestSnapshotsForContracts: (contracts) => rhChainMarketSnapshots.getLatestSnapshotsForContracts(contracts)
  }) : null;
  const rhChainMarketStructure = new RhChainMarketStructureService({
    marketData: rhChainMarketData,
    metrics: () => rhChainChainPulse.getLatest(),
    classifications: () => [...rhChainReviewedLayerClassifications, ...(rhChainDiscoveryQueue?.marketStructureCandidates() ?? []), ...(rhChainReviewPipeline?.marketStructureCandidates() ?? [])],
    latestReceipt: () => {
      const receipt = getRhChainDailyReceipts().receipts[0];
      return receipt ? { receipt_id: receipt.receipt_id, timestamp: receipt.observed_at ?? receipt.generated_at, summary: receipt.headline } : null;
    },
    snapshotHistoryForContracts: (contracts) => rhChainMarketSnapshots.listSnapshotsForContracts(contracts),
    ...options.rhChainMarketStructureOptions,
    crossLayerIntegration: config.rhChainReviewedClassificationsEnabled ? options.rhChainMarketStructureOptions?.crossLayerIntegration ?? rhChainCrossLayerIntegration ?? undefined : undefined
  });
  const rhChainBlockscoutProvider = options.rhChainTokenRegistryOptions?.provider ?? new BlockscoutProvider({
    enabled: options.rhChainTokenRegistryOptions?.enabled ?? config.blockscoutEnabled,
    baseUrl: config.blockscoutBaseUrl,
    timeoutMs: config.blockscoutTimeoutMs,
    cacheTtlSeconds: config.blockscoutCacheTtlSeconds,
    maxPageSize: config.blockscoutMaxPageSize
  });
  const rhChainTokenRegistry = new RhChainTokenRegistryService({
    provider: rhChainBlockscoutProvider,
    enabled: options.rhChainTokenRegistryOptions?.enabled ?? config.blockscoutEnabled,
    receipts: () => getRhChain100ReceiptsCampaign().assets,
    marketStructure: () => rhChainReviewedLayerClassifications,
    dexScreenerContracts: async () => {
      if (!config.dexScreenerEnabled) return [];
      try { return (await rhChainMarketData.getBoosts()).boosts.map((boost) => boost.tokenAddress); } catch { return []; }
    },
    manualIntakeContracts: async () => (await rhChainSubmissionStore.list()).map((submission) => submission.token_contract),
    ...options.rhChainTokenRegistryOptions
  });
  rhChainDiscoveryQueue = new RhChainDiscoveryQueueService({ provider: rhChainMarketProvider, marketData: rhChainMarketData, tokenRegistry: rhChainTokenRegistry });
  const rhChainMarketSnapshotStore: RhChainMarketSnapshotStore = options.rhChainMarketSnapshotStore
    ?? (rhChainPostgresPool ? new PostgresRhChainMarketSnapshotStore(rhChainPostgresPool) : new InMemoryRhChainMarketSnapshotStore());
  const rhChainMarketCaptureEnabled = options.rhChainMarketSnapshotOptions?.enabled ?? (config.rhChainAutomationEnabled || config.rhChainMarketIngestionEnabled);
  const rhChainMarketHistoryEnabled = options.rhChainMarketSnapshotOptions?.storageEnabled ?? (config.rhChainAutomationEnabled || config.rhChainMarketHistoryEnabled);
  rhChainMarketSnapshots = new RhChainMarketSnapshotService({
    store: rhChainMarketSnapshotStore,
    provider: rhChainMarketProvider,
    enabled: rhChainMarketCaptureEnabled,
    storageEnabled: rhChainMarketHistoryEnabled,
    // Snapshot history remains DEX Screener market data. Blockscout only adds exact-contract watchlist provenance/evidence.
    watchlist: async () => [...new Set([...(await rhChainTokenRegistry.seedWatchlistFromBlockscout()).map((item) => item.contract), ...(rhChainDiscoveryQueue?.watchedContracts() ?? [])])],
    classificationFor: (contract) => [...rhChainReviewedLayerClassifications, ...(rhChainDiscoveryQueue?.marketStructureCandidates() ?? []), ...(rhChainReviewPipeline?.marketStructureCandidates() ?? [])].find((classification) => classification.contract.toLowerCase() === contract.toLowerCase()) ?? null,
    ...options.rhChainMarketSnapshotOptions
  });
  const rhChainAttentionReceiptStore: RhChainAttentionReceiptStore = options.rhChainAttentionReceiptStore
    ?? (rhChainPostgresPool ? new PostgresRhChainAttentionReceiptStore(rhChainPostgresPool) : new InMemoryRhChainAttentionReceiptStore());
  const rhChainAttentionQuality = new RhChainAttentionQualityService({
    snapshots: (contract) => rhChainMarketSnapshots.listSnapshots(contract),
    curated: (contract) => rhChainReviewedLayerClassifications.find((item) => item.contract.toLowerCase() === contract.toLowerCase()) ?? null,
    durable: async (contract) => {
      if (!config.rhChainReviewedClassificationsEnabled) return null;
      try { return rhChainReviewedClassifications.store.get(contract); } catch { return null; }
    },
    receipts: rhChainAttentionReceiptStore
  });
  rhChainReviewPipeline = new RhChainReviewPipelineService({
    discoveryQueue: rhChainDiscoveryQueue,
    snapshots: rhChainMarketSnapshots,
    classifications: () => [...rhChainReviewedLayerClassifications, ...(rhChainDiscoveryQueue?.marketStructureCandidates() ?? []), ...(rhChainReviewPipeline?.marketStructureCandidates() ?? [])]
  });
  const rhChainMemePulseSnapshotStore: RhChainMemePulseSnapshotStore = options.rhChainMemePulseSnapshotStore
    ?? (rhChainPostgresPool ? new PostgresRhChainMemePulseSnapshotStore(rhChainPostgresPool) : new InMemoryRhChainMemePulseSnapshotStore());
  const rhChainMemePulse = new RhChainMemePulseSnapshotService(rhChainMemePulseSnapshotStore, rhChainLiveSnapshots, undefined, rhChainSubmissionStore);
  const rhChainLaunchpadSnapshotStore: RhChainLaunchpadSnapshotStore = options.rhChainLaunchpadSnapshotStore
    ?? (rhChainPostgresPool ? new PostgresRhChainLaunchpadSnapshotStore(rhChainPostgresPool) : new InMemoryRhChainLaunchpadSnapshotStore());
  const rhChainLaunchpad = new RhChainLaunchpadSnapshotService(rhChainLaunchpadSnapshotStore, rhChainSubmissionStore);
  const rhChainDailyReceiptDraftStore: RhChainDailyReceiptDraftStore = options.rhChainDailyReceiptDraftStore
    ?? (rhChainPostgresPool ? new PostgresRhChainDailyReceiptDraftStore(rhChainPostgresPool) : new InMemoryRhChainDailyReceiptDraftStore());
  const rhChainDailyReceiptDrafts = new RhChainDailyReceiptDraftService(rhChainDailyReceiptDraftStore, rhChainChainPulse, rhChainMemePulse, rhChainLaunchpad, rhChainLiveSnapshots, rhChainSubmissionStore, rhChainMarketSnapshots);
  const rhChainRiskCorrelationSnapshotStore: RhChainRiskCorrelationSnapshotStore = options.rhChainRiskCorrelationSnapshotStore
    ?? (rhChainPostgresPool ? new PostgresRhChainRiskCorrelationSnapshotStore(rhChainPostgresPool) : new InMemoryRhChainRiskCorrelationSnapshotStore());
  const rhChainRiskCorrelationSweep = new RhChainRiskCorrelationSweepService(rhChainRiskCorrelationSnapshotStore, rhChainSubmissionStore);
  const rhChainAutomationStore: RhChainAutomationStore = options.rhChainAutomationStore
    ?? (rhChainPostgresPool ? new PostgresRhChainAutomationStore(rhChainPostgresPool) : new InMemoryRhChainAutomationStore());
  const rh4663Store: Rh4663Store = options.rh4663Store
    ?? (rhChainPostgresPool ? new PostgresRh4663Store(rhChainPostgresPool) : new InMemoryRh4663Store());
  const rh4663 = new Rh4663Service(rh4663Store);
  const rh4663ResolutionStore = options.rh4663ResolutionStore
    ?? (rhChainPostgresPool ? new PostgresRh4663ResolutionStore(rhChainPostgresPool) : new InMemoryRh4663ResolutionStore());
  const configuredResolutionKey = process.env.RH_4663_RESOLUTION_PRIVATE_KEY;
  const rh4663ResolutionSigner = options.rh4663ResolutionSigner
    ?? (configuredResolutionKey && /^0x[0-9a-fA-F]{64}$/.test(configuredResolutionKey)
      ? new PrivateKeyRh4663ResolutionSigner(configuredResolutionKey as `0x${string}`, process.env.RH_4663_RESOLUTION_KEY_ID ?? 'rh4663-resolution-v1')
      : process.env.NODE_ENV === 'test'
        ? new PrivateKeyRh4663ResolutionSigner('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', 'rh4663-test-resolution-v1')
        : new UnavailableRh4663ResolutionSigner());
  const anchorKey = process.env.RH_4663_ANCHOR_PRIVATE_KEY; const anchorRpc = process.env.RH_4663_ANCHOR_RPC_URL; const anchorContract = process.env.RH_4663_ANCHOR_CONTRACT;
  const rh4663AnchorAdapter = options.rh4663AnchorAdapter ?? (anchorKey && /^0x[0-9a-fA-F]{64}$/.test(anchorKey) && anchorRpc && anchorContract && /^0x[0-9a-fA-F]{40}$/.test(anchorContract)
    ? new ViemRh4663AnchorAdapter(anchorRpc, anchorContract as `0x${string}`, anchorKey as `0x${string}`, Number(process.env.RH_4663_ANCHOR_CONFIRMATIONS ?? 2))
    : new DisabledRh4663AnchorAdapter());
  const rh4663Phase2 = new Rh4663ResolutionService(rh4663Store, rh4663ResolutionStore, rh4663ResolutionSigner, rh4663AnchorAdapter);
  const rh4663PublicRouteMetadata = async (urlPath: string): Promise<NarrativeMetadata | null> => {
    const printMatch = urlPath.match(/^\/4663\/print\/([^/?]+)\/?$/);
    if (printMatch) {
      const print = await rh4663PrintRead(printMatch[1]);
      if (!print) return null;
      const imagePath = `/og/4663/prints/${encodeURIComponent(print.print_id)}.png`;
      return { title: `//4663 PRINT · ${print.title} | Infopunks Radar`, description: `${print.regime}. Frozen market-state evidence with explicit source windows and methodology.`, canonicalPath: print.canonical_path, ogTitle: `//4663 PRINT · ${print.title}`, ogDescription: `${print.regime}. Inspect the evidence windows.`, ogImageUrl: `${NARRATIVE_PUBLIC_HOST}${imagePath}`, ogImageWidth: 1200, ogImageHeight: 630, twitterTitle: `//4663 PRINT · ${print.title}`, twitterDescription: `${print.regime}. Inspect the evidence windows.`, twitterImageUrl: `${NARRATIVE_PUBLIC_HOST}${imagePath}`, twitterCard: 'summary_large_image' };
    }
    const match = urlPath.match(/^\/4663\/(call|resolution)\/([^/?]+)\/?$/);
    if (!match) return null;
    const [_, route, rawReceiptId] = match;
    let receiptId = rawReceiptId;
    try { receiptId = decodeURIComponent(rawReceiptId); } catch { /* Use the raw public path component. */ }
    const receipt = await rh4663Phase2.receipt(receiptId);
    const imagePath = `/og/4663/pulse/${encodeURIComponent(receipt.receipt_id)}.png`;
    const canonicalPath = `/4663/${route}/${encodeURIComponent(receipt.receipt_id)}`;
    const make = (title: string, description: string): NarrativeMetadata => ({
      title, description, canonicalPath, ogTitle: title, ogDescription: description,
      ogImageUrl: `${NARRATIVE_PUBLIC_HOST}${imagePath}`, ogImageWidth: 1200, ogImageHeight: 630,
      twitterTitle: title, twitterDescription: description, twitterImageUrl: `${NARRATIVE_PUBLIC_HOST}${imagePath}`, twitterCard: 'summary_large_image'
    });
    if (route === 'call' && 'rotation' in receipt) {
      return make(`I'm calling ${receipt.rotation} | Infopunks //4663`, `${receipt.confidence}% confidence for the next Robinhood Chain window. Canonical Call Receipt ${receipt.receipt_id.slice(0, 16)}…`);
    }
    if (route === 'resolution' && 'resolved_category' in receipt) {
      return make(`Resolved: ${receipt.resolved_category} | Infopunks //4663`, `Outcome ${receipt.resolved_category}. This Resolution Receipt preserves the original call, deterministic result, and public proof.`);
    }
    return null;
  };
  const rh4663IntelligenceStore: Rh4663IntelligenceStore = options.rh4663IntelligenceStore
    ?? (rhChainPostgresPool ? new PostgresRh4663IntelligenceStore(rhChainPostgresPool) : new InMemoryRh4663IntelligenceStore());
  const rh4663Intelligence = new Rh4663IntelligenceService(rh4663Store, rh4663IntelligenceStore, {
    enabled: config.rh4663Phase3Enabled,
    ingestion_enabled: config.rh4663Phase3IngestionEnabled,
    candidate_generation_enabled: config.rh4663Phase3CandidateGenerationEnabled,
    publication_enabled: config.rh4663Phase3PublicationEnabled,
    auto_publication_enabled: config.rh4663Phase3AutoPublicationEnabled,
    external_distribution_enabled: config.rh4663Phase3ExternalDistributionEnabled,
    shadow_mode: config.rh4663Phase3ShadowMode,
    is_production: config.isProduction,
    phase2_production_proof_verified: config.rh4663Phase2ProductionProofVerified,
    log: (entry) => console.log(JSON.stringify(entry))
  });
  const phase3Classifications = () => [...rhChainReviewedLayerClassifications, ...(rhChainDiscoveryQueue?.marketStructureCandidates() ?? []), ...(rhChainReviewPipeline?.marketStructureCandidates() ?? [])];
  const phase3CategoryFor = (contract: string) => {
    const classification = phase3Classifications().find((item) => item.contract.toLowerCase() === contract.toLowerCase());
    if (classification?.secondary_layers.includes('tokenized_equities')) return 'STOCK_TOKENS' as const;
    if (classification?.primary_layer === 'meme') return 'MEMES' as const;
    if (classification?.primary_layer === 'rwa' || classification?.primary_layer === 'defi') return 'RWA_DEFI' as const;
    if (classification?.primary_layer === 'agent') return 'AGENT' as const;
    if (classification?.primary_layer === 'infrastructure') return 'UTILITY' as const;
    return 'OTHER' as const;
  };
  const phase3Providers: Rh4663ProviderAdapter[] = [{
    name: 'dexscreener', enabled: config.dexScreenerEnabled, timeout_ms: Math.max(1_000, config.dexScreenerTimeoutMs * 3), max_retries: config.dexScreenerMaxRetries,
    collect: async () => {
      const capture = await rhChainMarketSnapshots.captureKnownWatchlistSnapshot(); const observations: Rh4663RawObservationInput[] = [];
      for (const snapshot of capture.captured) {
        const history = await rhChainMarketSnapshots.listSnapshots(snapshot.token_address); const prior = [...history].reverse().find((item) => item.snapshot_id !== snapshot.snapshot_id) ?? null;
        const baselineFor = (key: 'volume_h24' | 'liquidity_usd' | 'price_usd') => {
          const values = history.slice(0, -1).map((item) => item[key]).filter((value): value is number => typeof value === 'number').slice(-30);
          if (values.length < 5) return undefined; const mean = values.reduce((sum, value) => sum + value, 0) / values.length; const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
          return { mean, standard_deviation: Math.sqrt(variance), sample_size: values.length, window: 'last_30_persisted_snapshots' };
        };
        const base = { provider: 'dexscreener', source_type: 'dex_market' as const, observed_at: snapshot.provider_timestamp ?? snapshot.captured_at, category: phase3CategoryFor(snapshot.token_address), subject: { subject_type: 'token_contract', subject_id: snapshot.token_address, ...(snapshot.ticker ? { label: snapshot.ticker } : {}) }, confidence: snapshot.freshness_state === 'fresh' ? 82 : 55, freshness: snapshot.freshness_state === 'fresh' ? 'fresh' as const : 'stale' as const, provider_reference: snapshot.pair_address ?? snapshot.token_address, source_url: snapshot.source_url ?? `${config.dexScreenerBaseUrl}/latest/dex/tokens/${snapshot.token_address}`, dimensions: { persistence_windows: Math.min(5, history.length), subject_importance: 50 } };
        if (snapshot.volume_h24 !== null) observations.push({ ...base, provider_observation_id: `${snapshot.snapshot_id}:volume_h24`, metric: 'volume_24h_usd', current_value: snapshot.volume_h24, previous_value: prior?.volume_h24 ?? undefined, units: 'USD', event_type: 'VOLUME_SPIKE', baseline: baselineFor('volume_h24') });
        if (snapshot.liquidity_usd !== null) observations.push({ ...base, provider_observation_id: `${snapshot.snapshot_id}:liquidity_usd`, metric: 'liquidity_usd', current_value: snapshot.liquidity_usd, previous_value: prior?.liquidity_usd ?? undefined, units: 'USD', event_type: 'LIQUIDITY_CHANGE', baseline: baselineFor('liquidity_usd') });
        if (snapshot.price_change_h24 !== null) observations.push({ ...base, provider_observation_id: `${snapshot.snapshot_id}:price_change_h24`, metric: 'price_change_24h_percent', current_value: snapshot.price_change_h24, previous_value: 0, units: 'percent', event_type: 'PRICE_MOVE' });
        if (snapshot.pair_created_at && !prior?.pair_created_at) observations.push({ ...base, provider_observation_id: `${snapshot.snapshot_id}:new_pair`, metric: 'new_pair', current_value: true, units: null, event_type: 'NEW_PAIR' });
      }
      return observations;
    }
  }, {
    name: 'blockscout', enabled: config.blockscoutEnabled, timeout_ms: config.blockscoutTimeoutMs * 2, max_retries: 1,
    collect: async () => {
      const registry = await rhChainTokenRegistry.listObservedTokens();
      return registry.tokens.map((token): Rh4663RawObservationInput => ({ provider: 'blockscout', provider_observation_id: `token:${token.contract}`, source_type: 'chain_explorer', observed_at: token.captured_at, category: phase3CategoryFor(token.contract), subject: { subject_type: 'token_contract', subject_id: token.contract, ...(token.symbol ? { label: token.symbol } : {}) }, metric: 'new_contract', current_value: true, units: null, provider_reference: token.contract, source_url: token.source_url, confidence: 72, freshness: 'fresh', event_type: 'NEW_CONTRACT', dimensions: { holders_count: token.holders_count, token_type: token.token_type } }));
    }
  }, {
    name: 'defillama_persisted', enabled: true, timeout_ms: 1_000, max_retries: 0,
    collect: async () => {
      const snapshot = await rhChainChainPulse.getLatest(); if (!snapshot) return [];
      const base = { provider: 'defillama_persisted', source_type: 'defi_metrics' as const, observed_at: snapshot.observed_at, subject: { subject_type: 'chain', subject_id: 'robinhood-chain', label: 'ROBINHOOD CHAIN' }, provider_reference: snapshot.snapshot_id, source_url: 'https://defillama.com', confidence: snapshot.confidence_level === 'high' ? 85 : snapshot.confidence_level === 'medium' ? 70 : 45, freshness: snapshot.freshness_state === 'fresh' ? 'fresh' as const : 'stale' as const, dimensions: { persistence_windows: 1, subject_importance: 90 } };
      return [
        ...(snapshot.tvl === null ? [] : [{ ...base, provider_observation_id: `${snapshot.snapshot_id}:tvl`, category: 'RWA_DEFI' as const, metric: 'tvl_usd', current_value: snapshot.tvl, units: 'USD', event_type: 'LIQUIDITY_CHANGE' as const }]),
        ...(snapshot.dex_volume_24h === null ? [] : [{ ...base, provider_observation_id: `${snapshot.snapshot_id}:dex_volume`, category: 'LIQUIDITY' as const, metric: 'dex_volume_24h_usd', current_value: snapshot.dex_volume_24h, units: 'USD', event_type: 'VOLUME_SPIKE' as const }]),
        ...(snapshot.stablecoin_market_cap === null ? [] : [{ ...base, provider_observation_id: `${snapshot.snapshot_id}:stable_supply`, category: 'STABLES' as const, metric: 'stablecoin_supply_usd', current_value: snapshot.stablecoin_market_cap, units: 'USD', event_type: 'LIQUIDITY_CHANGE' as const }])
      ];
    }
  }];
  const runPhase3Intelligence = async () => {
    const providerResult = await rh4663Intelligence.runProviders(phase3Providers); let communityObservations = 0; let communityEvents = 0; let communityCandidates = 0; let communityPublications = 0;
    for (const signal of await rh4663Store.listSignals(1_000)) for (const result of await rh4663Intelligence.ingestCommunitySignal(signal)) { communityObservations += Number(result.observation_created); communityEvents += Number(Boolean(result.event)); communityCandidates += Number(Boolean(result.candidate)); communityPublications += Number(Boolean(result.publication)); }
    return { observations: providerResult.observations + communityObservations, events: providerResult.events + communityEvents, candidates: providerResult.candidates + communityCandidates, publications: providerResult.publications + communityPublications, providers: [...providerResult.providers, { provider: 'community_signal_hunt', state: 'healthy' }] };
  };
  const enabledAutomationJobs = [
    ...(config.rhChainAutomationEnabled ? RH_CHAIN_AUTOMATION_JOB_NAMES.filter((job) => job !== 'rh_4663_intelligence_refresh') : []),
    ...(config.rh4663Phase3Enabled && config.rh4663Phase3IngestionEnabled ? ['rh_4663_intelligence_refresh' as const] : [])
  ];
  const rhChainAutomation = new RhChainAutomationService({
    enabled: config.rhChainAutomationEnabled || (config.rh4663Phase3Enabled && config.rh4663Phase3IngestionEnabled),
    enabledJobs: enabledAutomationJobs,
    isProduction: config.isProduction,
    instanceId: config.rhChainAutomationInstanceId,
    lockTtlMs: config.rhChainJobLockTtlMs,
    store: rhChainAutomationStore,
    snapshots: rhChainLiveSnapshots,
    chainPulseSnapshots: rhChainChainPulse,
    memePulseSnapshots: rhChainMemePulse,
    launchpadSnapshots: rhChainLaunchpad,
    dailyReceiptDrafts: rhChainDailyReceiptDrafts,
    riskCorrelationSweep: rhChainRiskCorrelationSweep,
    submissions: rhChainSubmissionStore,
    rh4663IntelligenceRun: runPhase3Intelligence
  });
  const rhChainPublicRateLimiter = new RhChainPublicRateLimiter(
    options.rhChainPublicRateLimit?.enabled ?? config.rhChainPublicRateLimitEnabled,
    options.rhChainPublicRateLimit?.windowMs ?? config.rhChainPublicRateLimitWindowMs,
    options.rhChainPublicRateLimit?.max ?? config.rhChainPublicRateLimitMax
  );
  const persistenceMode: 'postgres' | 'memory' = config.databaseUrl ? 'postgres' : 'memory';
  const ROUTE_TIMEOUT_MS = 2_500;
  const SEARCH_ROUTE_TIMEOUT_MS = 3_000;
  const RADAR_BENCHMARKS_TTL_MS = 5 * 60 * 1000;
  const RADAR_ENDPOINTS_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_RISK_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_HISTORY_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_RISK_TIMEOUT_MS = 1_200;
  const RADAR_ECOSYSTEM_HISTORY_TIMEOUT_MS = 1_200;
  const PROVIDER_LIST_MAX = 100;
  const machineReceiptAdapter: MachinePreflightReceiptStorageAdapter = process.env.NODE_ENV === 'test'
    ? new MemoryMachinePreflightReceiptStorageAdapter()
    : rhChainPostgresPool
      ? new PostgresMachinePreflightReceiptStorageAdapter(rhChainPostgresPool)
      : new JsonlMachinePreflightReceiptStorageAdapter({
          filePath: process.env.MACHINE_RECEIPTS_JSONL_PATH ?? join(process.cwd(), '.data', 'machine-preflight-receipts.jsonl')
        });
  configureMachinePreflightReceiptStorage(machineReceiptAdapter);
  const machineReceiptStorage = createMachineReceiptStorageMetadata({
    env: config.env,
    adapter: process.env.NODE_ENV === 'test' ? 'memory' : config.databaseUrl ? 'postgres' : 'jsonl',
    durable: process.env.NODE_ENV !== 'test',
    limitation: process.env.NODE_ENV === 'test' ? 'Machine preflight receipts use isolated in-memory test storage.' : undefined,
    demoSeedEnabled: config.machineDemoSeed
  });
  const machineReceiptStorageWarning = config.env === 'production' && machineReceiptStorage.adapter === 'jsonl'
    ? 'Production is using JSONL machine receipt storage. Configure DATABASE_URL for Postgres-backed durability.'
    : null;
  const preSpendIntelligence = createPreSpendIntelligenceService(
    process.env.NODE_ENV === 'test' ? createInMemoryPreSpendRepository() : preSpendRepository
  );
  const proofCheckService = createProofCheckService(
    process.env.NODE_ENV === 'test' ? createInMemoryProofCheckRepository() : proofCheckRepository
  );
  const loopService = createLoopService(
    process.env.NODE_ENV === 'test' ? createInMemoryLoopRepository() : loopRepository
  );
  configureMachineDemoSeed(config.machineDemoSeed);
  const responseCache = createResponseCache();
  app.addHook('onClose', async () => {
    await rhChainSubmissionStore.close?.();
    await rhChainReviewedClassificationStore.close?.();
    await rhChainProjectClaimsStore.close?.();
    await rhChainAutomationStore.close?.();
    await rhChainMetricsSnapshotStore.close?.();
    await rhChainMemePulseSnapshotStore.close?.();
    await rhChainLaunchpadSnapshotStore.close?.();
    await rhChainDailyReceiptDraftStore.close?.();
    await rhChainRiskCorrelationSnapshotStore.close?.();
    await rh4663Store.close?.();
    await rh4663ResolutionStore.close?.();
    await rh4663IntelligenceStore.close?.();
    await closeDatabasePool();
  });
  const allowedOrigins = new Set(DEFAULT_ALLOWED_ORIGINS);
  if (config.frontendOrigin) allowedOrigins.add(config.frontendOrigin);
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    maxAge: CORS_MAX_AGE_SECONDS,
    optionsSuccessStatus: 204,
    preflight: true,
    strictPreflight: true
  });
  app.addHook('onRequest', async (req, _reply) => {
    const startedAtMs = Date.now();
    const route = safeRequestPath(req.url);
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onRequest', id: req.id, method: req.method, route }));
    console.log(JSON.stringify({ event: 'request_start', id: req.id, method: req.method, route, started_at: new Date(startedAtMs).toISOString() }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onRequest', id: req.id }));
  });
  app.addHook('onError', async (req, reply, error) => {
    const route = req.routeOptions.url || safeRequestPath(req.url);
    const context = rhChainOperationContext(route);
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onError', id: req.id, method: req.method, route }));
    console.log(JSON.stringify({
      event: 'request_errored',
      id: req.id,
      method: req.method,
      route,
      status_code: error.statusCode && error.statusCode >= 400 ? error.statusCode : Math.max(500, reply.statusCode),
      ...context,
      failure_kind: classifyPostgresFailure(error),
      error_name: error.name,
      error_code: postgresErrorCode(error),
      error: safeOperationalErrorMessage(error),
      stack: safeOperationalStack(error)
    }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onError', id: req.id }));
  });
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url || safeRequestPath(req.url);
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onResponse', id: req.id, method: req.method, route }));
    console.log(JSON.stringify({ event: 'request_complete', id: req.id, method: req.method, route, status_code: reply.statusCode }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onResponse', id: req.id }));
  });
  app.setErrorHandler((error, _req, reply) => {
    if (isPersistenceUnavailable(error)) {
      return reply.code(503).send({
        error: 'persistence_unavailable',
        code: 'persistence_unavailable',
        message: 'Durable persistence is temporarily unavailable.'
      });
    }
    const reportedStatus = error && typeof error === 'object' && 'statusCode' in error
      ? (error as { statusCode?: unknown }).statusCode
      : null;
    const statusCode = typeof reportedStatus === 'number' && reportedStatus >= 400 ? reportedStatus : 500;
    if (statusCode < 500) return reply.code(statusCode).send(error);
    return reply.code(statusCode).send({
      statusCode,
      error: 'Internal Server Error',
      message: 'Internal Server Error'
    });
  });
  const store = preloadedStore ?? emptyIntelligenceStore();
  const repositoryDbStatus = (): 'ok' | 'degraded' | 'unavailable' | null => {
    try {
      const diagnosticRepository = repository as IntelligenceRepository & { getDbStatus?: () => 'ok' | 'degraded' | 'unavailable' };
      if (typeof diagnosticRepository.getDbStatus !== 'function') return null;
      const status = diagnosticRepository.getDbStatus();
      return status === 'ok' || status === 'degraded' || status === 'unavailable' ? status : null;
    } catch {
      return null;
    }
  };
  const dbStatusWithFallback = (): 'ok' | 'degraded' | 'unavailable' => {
    const status = repositoryDbStatus();
    if (status) return status;
    const circuit = getDatabaseCircuitDiagnostics();
    if (config.databaseUrl && circuit.dbMode === 'postgres') return circuit.dbStatus;
    // An intentionally memory-backed public terminal is available but not
    // durable, so readiness is degraded rather than unavailable.
    return 'degraded';
  };
  const healthDbDiagnostics = () => ({
    persistence: persistenceMode,
    persistence_mode: persistenceMode,
    dbStatus: dbStatusWithFallback(),
    db_status: dbStatusWithFallback(),
    ...databaseRuntimeStatus()
  });
  const readinessState = (): 'healthy' | 'degraded' | 'unavailable' => {
    const dbStatus = dbStatusWithFallback();
    if (dbStatus === 'ok') return 'healthy';
    return 'degraded';
  };
  const databaseRuntimeStatus = () => {
    const circuit = getDatabaseCircuitDiagnostics();
    if (!config.databaseUrl) {
      return {
        dbMode: 'memory' as const,
        dbCircuitState: 'degraded' as const,
        dbLastSuccessAt: null,
        dbLastFailureAt: null,
        databasePoolMax: null
      };
    }
    return {
      dbMode: 'postgres' as const,
      dbCircuitState: circuit.dbCircuitState,
      dbLastSuccessAt: circuit.dbLastSuccessAt,
      dbLastFailureAt: circuit.dbLastFailureAt,
      databasePoolMax: config.databasePoolMax
    };
  };
  let bootstrapped = Boolean(preloadedStore);
  const liveBootstrapEnabled = process.env.PAYSH_BOOTSTRAP_ENABLED === 'true'
    || (process.env.PAYSH_BOOTSTRAP_ENABLED !== 'false' && process.env.NODE_ENV !== 'test');
  const liveCatalogUrl = config.payShCatalogUrl ?? DEFAULT_LIVE_CATALOG_URL;
  let startupLoadPromise: Promise<void> | null = null;
  let liveBootstrapPromise: Promise<void> | null = null;
  let liveBootstrapStatus: 'idle' | 'pending' | 'ready' | 'failed' = 'idle';
  let liveBootstrapError: string | null = null;
  let cachedPropagation = analyzePropagation(store);
  let cachedInterpretations = pulseSummary(
    store,
    new Date().toISOString(),
    config.payShIngestIntervalMs,
    { includePropagation: false, includeInterpretations: true, propagationFallback: cachedPropagation }
  ).interpretations;
  let cachedPulseDashboard = buildPulseDashboard(store, cachedInterpretations, bootstrapped);
  const fixturePulseStore = createFixturePulseStore();
  const fixturePulseInterpretations = pulseSummary(
    fixturePulseStore,
    new Date().toISOString(),
    config.payShIngestIntervalMs,
    { includePropagation: false, includeInterpretations: true, propagationFallback: analyzePropagation(fixturePulseStore) }
  ).interpretations;

  if (!preloadedStore) {
    const bootstrapStartMs = Date.now();
    startupLoadPromise = createIntelligenceStore(repository)
      .then((loadedStore) => {
        copyStoreInto(store, loadedStore);
        bootstrapped = Boolean(loadedStore.providers.length > 0);
        liveBootstrapStatus = bootstrapped ? 'ready' : 'failed';
        liveBootstrapError = bootstrapped ? null : 'bootstrap_not_called';
        logTiming('database_connect', bootstrapStartMs);
        logTiming('catalog_load', bootstrapStartMs);
        refreshBackgroundAnalytics();
      })
      .catch((error) => {
        logDbDegraded('startup_load', classifyBootstrapFailure(error), error);
        liveBootstrapStatus = 'failed';
        liveBootstrapError = errorMessage(error);
        console.log(JSON.stringify({
          event: 'startup_load_failed',
          code: errorCode(error),
          message: errorMessage(error)
        }));
      });
    void ensureLiveBootstrap('startup');
  } else {
    refreshBackgroundAnalytics();
  }

  // Render's liveness probe must be cheap and independent of Postgres or any
  // market/provider integration. Readiness below covers persistence separately.
  app.get('/healthz', async () => ({ ok: true, status: 'live', service: 'infopunks-pay-sh-radar' }));
  app.get('/readyz', async (_req, reply) => {
    const status = readinessState();
    const body = {
      ok: status !== 'unavailable',
      status,
      service: 'infopunks-pay-sh-radar',
      persistence: persistenceMode,
      db_status: dbStatusWithFallback(),
      ...databaseRuntimeStatus(),
      disabled_features: Object.keys(config.disabledFeatures).sort()
    };
    return reply.code(status === 'unavailable' ? 503 : 200).send(body);
  });
  app.get('/health', async () => {
    if (rhChainPostgresPool && rhChainPostgresReadiness) void probeDatabaseRecovery(rhChainPostgresPool);
    const adapterDiagnostics: { receipt_count?: number; warning?: string | null } = machineReceiptAdapter.getDiagnostics
      ? await machineReceiptAdapter.getDiagnostics().catch((error) => ({
          receipt_count: undefined,
          warning: `Machine receipt diagnostics unavailable: ${errorMessage(error)}`
        }))
      : {};
    return {
      ok: true,
      service: 'infopunks-pay-sh-radar',
      role: 'Cognitive Coordination Layer above Pay.sh',
      ...healthDbDiagnostics(),
      catalogSource: config.payShCatalogSource,
      ingestionEnabled: config.ingestionEnabled,
      lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
      providerCount: store.providers.length,
      endpointCount: safeStoreEndpointCount(store),
      databasePoolMax: config.databasePoolMax,
      rh_chain_storage: rhChainPostgresReadiness?.diagnostics() ?? ({
        adapter: 'unconfigured',
        durable: false,
        readiness: 'not_configured',
        failure_kind: null,
        error_code: null,
        missing_tables: []
      } satisfies RhChainStorageDiagnostics),
      machine_receipts_storage: {
        adapter: machineReceiptStorage.adapter,
        mode: machineReceiptStorage.mode,
        durable: machineReceiptStorage.durable,
        demo_seed_enabled: machineReceiptStorage.demo_seed_enabled,
        receipt_count: adapterDiagnostics.receipt_count,
        warning: adapterDiagnostics.warning ?? machineReceiptStorageWarning
      }
    };
  });
  app.get('/openapi.json', async () => createOpenApiSpec(config.version));
  app.get('/status', async () => withRouteTimeout('/status', ROUTE_TIMEOUT_MS, () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbStatus: dbStatusWithFallback(),
    ...databaseRuntimeStatus(),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: catalogStatusFromDataSource(store.dataSource)
  }), () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbStatus: dbStatusWithFallback(),
    ...databaseRuntimeStatus(),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: 'warming_up'
  })));
  app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
  app.get('/v1/pulse', async () => withRouteTimeout('/v1/pulse', ROUTE_TIMEOUT_MS, () => {
    const generatedAt = new Date().toISOString();
    const liveDataSource = dataSourceState(store, generatedAt);
    const livePulseReady = store.providers.length > 0 && liveDataSource.mode === 'live_pay_sh_catalog' && liveDataSource.used_fixture === false;
    const routeBootstrapState = liveBootstrapStatus === 'idle' ? 'pending' : liveBootstrapStatus;
    if (livePulseReady) {
      const status = pulseRouteStatus(store, routeBootstrapState, liveBootstrapError);
      const diagnostics = pulseDiagnostics(liveDataSource, routeBootstrapState, status.upstream.reason ?? liveBootstrapError, generatedAt);
      void ensureLiveBootstrap('route:/v1/pulse');
      return {
        data: {
          ...buildPulseDashboard(store, cachedInterpretations, true, generatedAt),
          ...diagnostics,
          status
        }
      };
    }

    void ensureLiveBootstrap('route:/v1/pulse');
    const status = pulseRouteStatus(fixturePulseStore, routeBootstrapState, liveBootstrapError);
    const fixtureStore = pulseFixtureStoreWithStatus(fixturePulseStore, status.upstream.reason);
    const diagnostics = pulseDiagnostics(dataSourceState(fixtureStore), routeBootstrapState, status.upstream.reason, generatedAt);
    return {
      data: {
        ...buildPulseDashboard(fixtureStore, fixturePulseInterpretations, true, generatedAt),
        ...diagnostics,
        catalog_status: 'fixture_fallback',
        status
      }
    };
  }, () => ({
    data: {
      ...buildPulseDashboard(
        pulseFixtureStoreWithStatus(fixturePulseStore, liveBootstrapError ?? 'pulse_timeout'),
        fixturePulseInterpretations,
        true,
        new Date().toISOString()
      ),
      ...pulseDiagnostics(dataSourceState(fixturePulseStore), liveBootstrapStatus === 'idle' ? 'pending' : liveBootstrapStatus, liveBootstrapError ?? 'pulse_timeout', new Date().toISOString()),
      catalog_status: 'fixture_fallback',
      status: pulseRouteStatus(fixturePulseStore, liveBootstrapStatus === 'idle' ? 'pending' : liveBootstrapStatus, liveBootstrapError ?? 'pulse_timeout')
    }
  })));
  app.get('/v1/pulse/summary', async () => withRouteTimeout('/v1/pulse/summary', ROUTE_TIMEOUT_MS, () => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const pulse = buildPulseDashboard(store, cachedInterpretations, bootstrapped || store.providers.length > 0);
    summary.data_source = { ...summary.data_source, mode: pulse.data_source.mode };
    return { data: compactPulseSummaryPayload(summary) };
  }, () => ({
    data: (() => {
      const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
      const pulse = buildPulseDashboard(store, cachedInterpretations, bootstrapped || store.providers.length > 0);
      summary.data_source = { ...summary.data_source, mode: pulse.data_source.mode };
      return compactPulseSummaryPayload(summary);
    })()
  })));
  app.get('/v1/propagation', async () => ({ data: compactPropagationSummary(cachedPropagation) }));
  app.get<{ Params: { cluster_id: string } }>('/v1/propagation/:cluster_id', async (req, reply) => {
    const incident = resolvePropagationIncident(store, req.params.cluster_id, new Date().toISOString(), cachedPropagation, cachedInterpretations);
    if (!incident) return reply.code(404).send({ error: 'propagation_cluster_not_found' });
    return { data: incident };
  });
  app.get<{ Params: { id: string } }>('/v1/events/:id', async (req, reply) => {
    const event = store.events.find((item) => item.id === req.params.id);
    if (!event) return reply.code(404).send({ error: 'event_not_found' });
    return {
      data: {
        ...event,
        summary: summarizeEvent(event),
        ...classifyEventSeverity(event, store.events)
      }
    };
  });
  app.get('/v1/events/recent', async () => ({ data: [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 100).map((event) => ({ ...event, ...classifyEventSeverity(event, store.events) })) }));
  app.get<{ Querystring: { scope?: string } }>('/v1/providers', async (req) => {
    await ensureLiveBootstrapWithinBudget('route:/v1/providers');
    if (req.query.scope === 'pre-spend') {
      return {
        data: safeJsonExport(preSpendIntelligence.listProviderSummaries())
      };
    }
    const builderProviders = preSpendIntelligence.listProviders().map((provider) => ({
      id: provider.provider_id,
      provider_id: provider.provider_id,
      name: provider.name,
      namespace: 'infopunks/builder',
      fqn: `infopunks.builder.${provider.provider_id}`,
      category: provider.service_categories[0] ?? 'pre_spend',
      description: provider.output_quality_notes[0] ?? null,
      endpointCount: provider.route_coverage,
      pricing: { min: null, max: null, clarity: 'route_observed', raw: provider.pricing_consistency },
      tags: ['pre_spend_intelligence', ...provider.service_categories],
      status: 'metered',
      latestTrustScore: provider.reliability_score,
      latestSignalScore: provider.recent_receipt_count * 20,
      route_coverage: provider.route_coverage,
      reliability_score: provider.reliability_score,
      known_risks: provider.known_risks,
      validation_status: provider.human_validation_status,
      dispute_history: provider.dispute_history,
      receipt_count: provider.recent_receipt_count
    }));
    const providerPayload = store.providers.length > 0
      ? lightweightProviders(store, PROVIDER_LIST_MAX)
      : builderProviders.slice(0, PROVIDER_LIST_MAX);
    const fallbackPayload = store.providers.length > 0
      ? lightweightProviders(store, 25)
      : builderProviders.slice(0, 25);
    return withRouteTimeout('/v1/providers', ROUTE_TIMEOUT_MS, () => ({
      data: providerPayload
    }), () => ({
      data: fallbackPayload
    }));
  });
  app.get('/v1/pre-spend/providers', async () => ({
    data: safeJsonExport(preSpendIntelligence.listProviderSummaries())
  }));
  app.get<{ Params: { provider_id: string } }>('/v1/pre-spend/providers/:provider_id', async (req, reply) => {
    const detail = preSpendIntelligence.getProviderDetail(req.params.provider_id);
    if (!detail) return reply.code(404).send({ error: 'provider_not_found' });
    return {
      data: safeJsonExport(detail)
    };
  });
  app.get('/v1/providers/featured', async () => ({ data: featuredProviderRotation(store, config.featuredProviderRotationMs) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id', async (req, reply) => {
    const builderProviderDetail = preSpendIntelligence.getProviderDetail(req.params.id);
    if (builderProviderDetail) {
      return {
        data: safeJsonExport(builderProviderDetail)
      };
    }
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: { provider, endpoints: store.endpoints.filter((item) => item.providerId === provider.id), trustAssessment: store.trustAssessments.find((item) => item.entityId === provider.id), signalAssessment: store.signalAssessments.find((item) => item.entityId === provider.id) } };
  });
  app.get('/v1/routes', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    metrics: preSpendIntelligence.getMetrics(),
    routes: preSpendIntelligence.listRoutes()
  }) }));
  app.get<{ Params: { route_id: string } }>('/v1/routes/:route_id', async (req, reply) => {
    const detail = preSpendIntelligence.getRouteDetail(req.params.route_id);
    if (!detail) return reply.code(404).send({ error: 'route_not_found' });
    return { data: safeJsonExport(detail) };
  });
  app.get('/v1/services', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    metrics: preSpendIntelligence.getMetrics(),
    services: preSpendIntelligence.listServices()
  }) }));
  app.get<{ Params: { service_id: string } }>('/v1/services/:service_id', async (req, reply) => {
    const detail = preSpendIntelligence.getServiceDetail(req.params.service_id);
    if (!detail) return reply.code(404).send({ error: 'service_not_found' });
    return { data: safeJsonExport(detail) };
  });
  app.post('/v1/pre-spend/check', async (req, reply) => {
    const parsed = PreSpendCheckRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_pre_spend_check_request', details: parsed.error.flatten() });
    return { data: safeJsonExport(preSpendIntelligence.check(parsed.data)) };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/history', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerHistory(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/intelligence', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerIntelligence(store, provider) };
  });
  app.get('/v1/endpoints', async () => ({ data: store.endpoints }));
  app.get('/v1/radar/scored-catalog', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        counts: {
          providers: snapshot.providers.length,
          endpoints: snapshot.endpoints.length
        },
        providers: snapshot.providers,
        endpoints: snapshot.endpoints
      })
    };
  });
  app.get('/v1/radar/providers', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.providers.length,
        providers: snapshot.providers
      })
    };
  });
  app.get('/v1/radar/endpoints', async () => {
    const startedAtMs = Date.now();
    await ensureLiveBootstrapWithinBudget('route:/v1/radar/endpoints');
    const cached = await responseCache.getOrSet('radar:endpoints', RADAR_ENDPOINTS_TTL_MS, () => {
      const snapshot = buildRadarExportSnapshot(store);
      return {
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.endpoints.length,
        endpoint_metadata: endpointMetadataState(store),
        endpoints: snapshot.endpoints
      };
    });
    logRadarRouteTiming('/v1/radar/endpoints', Date.now() - startedAtMs, cached.metadata.hit, 'ok');
    return {
      data: safeJsonExport({
        generated_at: cached.value.generated_at,
        source: cached.value.source,
        count: cached.value.count,
        endpoint_metadata: cached.value.endpoint_metadata,
        endpoints: cached.value.endpoints
      })
    };
  });
  app.get('/v1/radar/routes/candidates', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.route_candidates.count,
        total_endpoints: snapshot.route_candidates.total_endpoints,
        grouped_by_category: snapshot.route_candidates.by_category,
        grouped_by_provider: snapshot.route_candidates.by_provider
      })
    };
  });
  app.get('/v1/radar/mappings', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      count: listRouteMappings().length,
      mappings: listRouteMappings()
    })
  }));
  app.get('/v1/radar/mapping-targets', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      count: listMappingTargets().length,
      targets: listMappingTargets()
    })
  }));
  app.get('/v1/machine-market/services', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'machine-economy',
      phase_scope: MACHINE_MARKET_PHASE_SCOPE,
      count: listMachineMarketServices().length,
      services: listMachineMarketServices()
    })
  }));
  app.get('/v1/machine-market/summary', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'machine-economy',
      ...buildMachineMarketSummary()
    })
  }));
  app.get('/v1/machine-policies/templates', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'machine-economy',
      phase_scope: MACHINE_MARKET_PHASE_SCOPE,
      positioning: {
        authority: 'Bounded authority needs receipts.',
        boundary: 'peaqOS gives machines identity and wallets. Infopunks defines the boundary of machine spend.'
      },
      count: listMachinePolicyTemplates().length,
      templates: listMachinePolicyTemplates()
    })
  }));
  app.get<{ Params: { policy_id: string } }>('/v1/machine-policies/:policy_id', async (req, reply) => {
    const policy = getMachinePolicyTemplateById(req.params.policy_id);
    if (!policy) return reply.code(404).send({ error: 'machine_policy_not_found', phase_scope: MACHINE_MARKET_PHASE_SCOPE });
    return {
      data: safeJsonExport({
        generated_at: new Date().toISOString(),
        source: 'infopunks-pay-sh-radar',
        module: 'machine-economy',
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        policy
      })
    };
  });
  app.get<{ Querystring: { decision?: string; machine_id?: string; service_id?: string; source_market?: string; chain?: string; limit?: string } }>('/v1/machine-preflight/receipts/recent', async (req, reply) => {
    const parsed = MachineReceiptQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_machine_receipt_query', phase_scope: MACHINE_MARKET_PHASE_SCOPE, details: parsed.error.flatten() });
    const receipts = await listRecentMachinePreflightReceipts(parsed.data);
    return { data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'machine-economy',
      phase_scope: MACHINE_MARKET_PHASE_SCOPE,
      storage: machineReceiptStorage,
      count: receipts.length,
      receipts
    }) };
  });
  app.get<{ Params: { receipt_id: string } }>('/v1/machine-preflight/receipts/:receipt_id', async (req, reply) => {
    const receipt = await getMachinePreflightReceiptById(req.params.receipt_id);
    if (!receipt) return reply.code(404).send({ error: 'machine_preflight_receipt_not_found', phase_scope: MACHINE_MARKET_PHASE_SCOPE });
    return { data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'machine-economy',
      phase_scope: MACHINE_MARKET_PHASE_SCOPE,
      storage: machineReceiptStorage,
      receipt
    }) };
  });
  app.get<{ Params: { machine_id: string } }>('/v1/machine-dossier/:machine_id', async (req) => ({
    data: safeJsonExport({
      ...await buildMachineDossier(decodeURIComponent(req.params.machine_id)),
      storage: machineReceiptStorage
    })
  }));
  app.post('/v1/machine-preflight/coverage-run', async () => ({
    data: safeJsonExport({
      ...await runMachinePreflightCoverageRun(),
      storage: machineReceiptStorage
    })
  }));
  app.get<{ Querystring: { limit?: string } }>('/v1/machine-preflight/coverage-runs/recent', async (req, reply) => {
    const parsed = MachineCoverageRunQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_machine_coverage_run_query', phase_scope: MACHINE_MARKET_PHASE_SCOPE, details: parsed.error.flatten() });
    const runs = await listRecentMachinePreflightCoverageRuns(parsed.data.limit);
    return {
      data: safeJsonExport({
        generated_at: new Date().toISOString(),
        source: 'infopunks-pay-sh-radar',
        module: 'machine-economy',
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage,
        count: runs.length,
        runs
      })
    };
  });
  app.get<{ Params: { run_id: string } }>('/v1/machine-preflight/coverage-runs/:run_id', async (req, reply) => {
    const run = await getMachinePreflightCoverageRunById(req.params.run_id);
    if (!run) return reply.code(404).send({ error: 'machine_preflight_coverage_run_not_found', phase_scope: MACHINE_MARKET_PHASE_SCOPE });
    return {
      data: safeJsonExport({
        ...run,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-preflight', async (req, reply) => {
    const parsed = MachinePreflightRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_machine_preflight_request', phase_scope: MACHINE_MARKET_PHASE_SCOPE, details: parsed.error.flatten() });
    return { data: safeJsonExport({
      ...await runMachinePreflight(parsed.data),
      storage: machineReceiptStorage
    }) };
  });
  app.post('/v1/machine-execution/translation', async (req, reply) => {
    const parsed = MachineExecutionTranslationRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_machine_execution_request', phase_scope: MACHINE_MARKET_PHASE_SCOPE, details: parsed.error.flatten() });
    if (parsed.data.service_id && parsed.data.service_id !== 'anytrans') {
      return reply.code(400).send({
        error: 'unsupported_service_execution',
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        supported_service_id: 'anytrans'
      });
    }
    const result = await runTranslationExecutionRoute(parsed.data);
    return {
      data: safeJsonExport({
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-execution/anytrans/artifacts', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = AnyTransExecutionArtifactIngestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_anytrans_execution_artifact', phase_scope: MACHINE_MARKET_PHASE_SCOPE, details: parsed.error.flatten() });
    const result = await ingestAnyTransExecutionArtifact(parsed.data);
    return {
      data: safeJsonExport({
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-execution/machine-translation-general/artifacts', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = AlibabaMachineTranslationGeneralExecutionArtifactIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_machine_translation_general_execution_artifact',
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        details: parsed.error.flatten()
      });
    }
    const result = await ingestAlibabaMachineTranslationGeneralArtifact(parsed.data);
    return {
      data: safeJsonExport({
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-execution/receipts/ingest', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = MachineExecutionReceiptIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_machine_execution_receipt_ingest',
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        details: parsed.error.flatten()
      });
    }
    const result = await ingestMachineExecutionReceipt(parsed.data);
    return {
      data: safeJsonExport({
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/bigquery/fixtures/bounded-query', async () => {
    const fixture = buildBigQueryBoundedQueryFixtureReceipt();
    return {
      data: safeJsonExport({
        fixture_label: 'BigQuery bounded public/synthetic query fixture',
        proof_profile: 'bigquery_bounded_query',
        replace_with: 'Harness-generated receipt payload',
        payload: fixture
      })
    };
  });
  app.post('/v1/machine-execution/bigquery/fixtures/ingest', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = BigQueryFixtureIngestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_bigquery_fixture_ingest', details: parsed.error.flatten() });
    const fixturePayload = buildBigQueryBoundedQueryFixtureReceipt(parsed.data ?? {});
    const result = await ingestMachineExecutionReceipt(fixturePayload);
    return {
      data: safeJsonExport({
        fixture_ingested: true,
        fixture_label: 'BigQuery bounded public/synthetic query fixture',
        proof_profile: 'bigquery_bounded_query',
        payload: fixturePayload,
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-execution/bigquery/run-bounded-query', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = BigQueryLiveBoundedQueryRunSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_bigquery_live_run_request', details: parsed.error.flatten() });
    const result = await runBigQueryLiveBoundedQuery(parsed.data);
    if (result.status === 'blocked') {
      return reply.code(409).send({
        data: safeJsonExport({
          ...result,
          phase_scope: MACHINE_MARKET_PHASE_SCOPE,
          storage: machineReceiptStorage
        })
      });
    }
    return {
      data: safeJsonExport({
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/stableupload/fixtures/tiny-fixture', async () => {
    const fixture = buildStableuploadTinyFixtureReceipt();
    return {
      data: safeJsonExport({
        fixture_label: 'Stableupload tiny non-sensitive fixture',
        proof_profile: 'stableupload_tiny_fixture',
        replace_with: 'Harness-generated receipt payload',
        payload: fixture
      })
    };
  });
  app.post('/v1/machine-execution/stableupload/fixtures/ingest', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = BigQueryFixtureIngestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_stableupload_fixture_ingest', details: parsed.error.flatten() });
    const fixturePayload = buildStableuploadTinyFixtureReceipt(parsed.data ?? {});
    const result = await ingestMachineExecutionReceipt(fixturePayload);
    return {
      data: safeJsonExport({
        fixture_ingested: true,
        fixture_label: 'Stableupload tiny non-sensitive fixture',
        proof_profile: 'stableupload_tiny_fixture',
        payload: fixturePayload,
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/naver/fixtures/geocode', async () => {
    const fixture = buildNaverGeocodeFixtureReceipt();
    return {
      data: safeJsonExport({
        fixture_label: 'NAVER Maps non-operational geocode fixture',
        proof_profile: 'naver_geocode_lookup',
        replace_with: 'Harness-generated receipt payload',
        payload: fixture
      })
    };
  });
  app.post('/v1/machine-execution/naver/fixtures/geocode/ingest', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = BigQueryFixtureIngestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_naver_geocode_fixture_ingest', details: parsed.error.flatten() });
    const fixturePayload = buildNaverGeocodeFixtureReceipt(parsed.data ?? {});
    const result = await ingestMachineExecutionReceipt(fixturePayload);
    return {
      data: safeJsonExport({
        fixture_ingested: true,
        fixture_label: 'NAVER Maps non-operational geocode fixture',
        proof_profile: 'naver_geocode_lookup',
        payload: fixturePayload,
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/cloud-translation/fixtures/safe-phrase', async () => {
    const fixture = buildCloudTranslationSafePhraseFixtureReceipt();
    return {
      data: safeJsonExport({
        fixture_label: 'Cloud Translation safe phrase fixture',
        proof_profile: 'machine_translation_safe_phrase',
        replace_with: 'Harness-generated service-specific receipt payload',
        payload: fixture
      })
    };
  });
  app.post('/v1/machine-execution/cloud-translation/fixtures/safe-phrase/ingest', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const parsed = BigQueryFixtureIngestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_cloud_translation_fixture_ingest', details: parsed.error.flatten() });
    const existing = await listRecentMachinePreflightReceipts({ service_id: 'cloud-translation', limit: 25 });
    const hasLiveSuccess = existing.some((row) =>
      row.receipt_type === 'machine_execution'
      && row.execution_status === 'succeeded'
      && row.execution_occurred
      && !String(row.execution_request_summary ?? '').includes('"fixture"')
    );
    if (hasLiveSuccess) {
      return reply.code(409).send({ error: 'cloud_translation_live_receipt_already_exists', message: 'live_service_specific_receipt_exists' });
    }
    const fixturePayload = buildCloudTranslationSafePhraseFixtureReceipt(parsed.data ?? {});
    const result = await ingestMachineExecutionReceipt(fixturePayload);
    return {
      data: safeJsonExport({
        fixture_ingested: true,
        fixture_label: 'Cloud Translation safe phrase fixture',
        proof_profile: 'machine_translation_safe_phrase',
        payload: fixturePayload,
        ...result,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/alibaba-machine-translation-general/repeatability', async () => {
    const artifact = await buildAlibabaMachineTranslationGeneralRepeatabilityArtifact();
    return {
      data: safeJsonExport({
        ...artifact,
        storage: machineReceiptStorage
      })
    };
  });
  app.get<{ Params: { service_id: string } }>('/v1/machine-execution/repeatability/:service_id', async (req, reply) => {
    try {
      const normalizedServiceId = req.params.service_id === 'machine-translation-safe-phrase' ? 'anytrans' : req.params.service_id;
      const pack = await buildMachineExecutionRepeatabilityPack(normalizedServiceId);
      return {
        data: safeJsonExport({
          ...pack,
          storage: machineReceiptStorage
        })
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('repeatability_not_supported_for_service_id:')) {
        return reply.code(404).send({ error: 'repeatability_service_not_supported', service_id: req.params.service_id });
      }
      throw error;
    }
  });
  app.get('/v1/machine-execution/benchmark-readiness', async () => {
    const report = await buildMachineBenchmarkReadinessReport();
    return {
      data: safeJsonExport({
        ...report,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/comparable-routes', async () => {
    const discovery = await buildMachineComparableRouteDiscovery();
    return {
      data: safeJsonExport({
        ...discovery,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/translation-evidence-plan', async () => {
    const plan = await buildMachineTranslationEvidencePlan();
    return {
      data: safeJsonExport({
        ...plan,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/benchmark-methodology', async () => {
    const methodology = await buildMachineBenchmarkMethodologyArtifacts();
    return {
      data: safeJsonExport({
        ...methodology,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/benchmark-gate', async () => {
    const gate = await buildMachineBenchmarkGateCheck();
    return {
      data: safeJsonExport({
        ...gate,
        phase_scope: MACHINE_MARKET_PHASE_SCOPE,
        storage: machineReceiptStorage
      })
    };
  });
  app.get('/v1/machine-execution/alibaba-machine-translation-general/benchmark-readiness', async () => {
    const artifact = await buildAlibabaMachineTranslationGeneralBenchmarkReadinessArtifact(machineReceiptStorage.durable);
    return {
      data: safeJsonExport({
        ...artifact,
        storage: machineReceiptStorage
      })
    };
  });
  app.post('/v1/machine-execution/cloud-translation', async (_req, reply) => {
    return reply.code(409).send({
      ...deprecatedCloudTranslationExecutionResponse(),
      phase_scope: MACHINE_MARKET_PHASE_SCOPE
    });
  });
  app.addHook('onClose', async () => {
    if (machineReceiptAdapter.close) await machineReceiptAdapter.close();
  });
  app.get('/v1/radar/export/providers.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return providersCsv(store);
  });
  app.get('/v1/radar/export/endpoints.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return endpointsCsv(store);
  });
  app.get('/v1/radar/export/route-candidates.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return routeCandidatesCsv(store);
  });
  app.get('/v1/radar/export/degradations.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return degradationsCsv(store);
  });
  app.get<{ Params: { provider_id: string }; Querystring: { window?: string } }>('/v1/radar/history/providers/:provider_id', async (req, reply) => {
    const history = buildProviderHistory(store, req.params.provider_id, normalizeHistoryWindow(req.query.window));
    if (!history) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: safeJsonExport(history) };
  });
  app.get<{ Params: { endpoint_id: string }; Querystring: { window?: string } }>('/v1/radar/history/endpoints/:endpoint_id', async (req, reply) => {
    const history = buildEndpointHistory(store, req.params.endpoint_id, normalizeHistoryWindow(req.query.window));
    if (!history) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: safeJsonExport(history) };
  });
  app.get<{ Querystring: { window?: string } }>('/v1/radar/history/ecosystem', async (req) => {
    const startedAtMs = Date.now();
    const windowName = normalizeHistoryWindow(req.query.window);
    const cacheKey = `radar:history:ecosystem:${windowName}`;
    try {
      const cached = await responseCache.getOrSet(cacheKey, RADAR_ECOSYSTEM_HISTORY_TTL_MS, async () => withTimeout(
        () => buildEcosystemHistory(store, windowName),
        RADAR_ECOSYSTEM_HISTORY_TIMEOUT_MS,
        'ecosystem_history_timeout'
      ));
      logRadarRouteTiming('/v1/radar/history/ecosystem', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
      return { data: safeJsonExport(cached.value) };
    } catch {
      const fallback = buildEcosystemHistory(store, windowName);
      fallback.history_available = false;
      fallback.reason = 'History enrichment is warming up.';
      fallback.warnings = Array.from(new Set([...fallback.warnings, 'history warming up']));
      logRadarRouteTiming('/v1/radar/history/ecosystem', Date.now() - startedAtMs, false, 'warming_up');
      return { data: safeJsonExport(fallback) };
    }
  });
  app.get<{ Params: { provider_id: string } }>('/v1/radar/risk/providers/:provider_id', async (req, reply) => {
    const risk = buildProviderRiskAssessment(store, req.params.provider_id);
    if (!risk) return reply.code(404).send({ error: 'provider_not_found' });
    return {
      data: safeJsonExport(RadarRiskResponseSchema.parse({
        generated_at: risk.generated_at,
        subject_type: risk.subject_type,
        subject_id: risk.subject_id,
        risk_score: risk.predictive_risk_score,
        risk_level: risk.predictive_risk_level,
        history_available: risk.history_available,
        sample_count: risk.sample_count,
        explanation: risk.explanation,
        anomalies: risk.anomalies,
        evidence: risk.evidence,
        warnings: risk.warnings,
        recommended_action: risk.recommended_action
      }))
    };
  });
  app.get<{ Params: { endpoint_id: string } }>('/v1/radar/risk/endpoints/:endpoint_id', async (req, reply) => {
    const risk = buildEndpointRiskAssessment(store, req.params.endpoint_id);
    if (!risk) return reply.code(404).send({ error: 'endpoint_not_found' });
    return {
      data: safeJsonExport(RadarRiskResponseSchema.parse({
        generated_at: risk.generated_at,
        subject_type: risk.subject_type,
        subject_id: risk.subject_id,
        risk_score: risk.predictive_risk_score,
        risk_level: risk.predictive_risk_level,
        history_available: risk.history_available,
        sample_count: risk.sample_count,
        explanation: risk.explanation,
        anomalies: risk.anomalies,
        evidence: risk.evidence,
        warnings: risk.warnings,
        recommended_action: risk.recommended_action
      }))
    };
  });
  app.get('/v1/radar/risk/ecosystem', async () => {
    const startedAtMs = Date.now();
    try {
      const cached = await responseCache.getOrSet('radar:risk:ecosystem', RADAR_ECOSYSTEM_RISK_TTL_MS, async () => {
        const risk = await withTimeout(() => buildEcosystemRiskSummary(store), RADAR_ECOSYSTEM_RISK_TIMEOUT_MS, 'ecosystem_risk_timeout');
        return RadarEcosystemRiskSummarySchema.parse({
          generated_at: risk.generated_at,
          subject_type: risk.subject_type,
          subject_id: risk.subject_id,
          risk_score: risk.risk_score,
          risk_level: risk.risk_level,
          history_available: risk.history_available,
          sample_count: risk.sample_count,
          anomalies: risk.anomalies,
          evidence: risk.evidence,
          warnings: risk.warnings,
          recommended_action: risk.recommended_action,
          summary: risk.summary
        });
      });
      logRadarRouteTiming('/v1/radar/risk/ecosystem', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
      return { data: safeJsonExport(cached.value) };
    } catch {
      const fallback = RadarEcosystemRiskSummarySchema.parse({
        generated_at: new Date().toISOString(),
        subject_type: 'ecosystem',
        subject_id: 'ecosystem',
        risk_score: 50,
        risk_level: 'unknown',
        history_available: false,
        sample_count: 0,
        explanation: 'Risk enrichment is warming up.',
        anomalies: [],
        evidence: ['Risk enrichment is warming up.'],
        warnings: ['risk warming up'],
        recommended_action: 'insufficient history',
        summary: {
          providers_by_risk_level: { low: 0, watch: 0, elevated: 0, critical: 0, unknown: 0 },
          top_anomalies: [],
          categories_most_affected: [],
          recent_critical_events: [],
          stale_catalog_warning: null,
          anomaly_watch: []
        }
      });
      logRadarRouteTiming('/v1/radar/risk/ecosystem', Date.now() - startedAtMs, false, 'warming_up');
      return { data: safeJsonExport(fallback) };
    }
  });
  app.post('/v1/radar/preflight', async (req, reply) => handleParsed(req.body, RadarPreflightRequestSchema, (input) => ({
    data: safeJsonExport(RadarPreflightResponseSchema.parse(runRadarPreflight(input, store)))
  }), reply));
  app.post('/v1/radar/preflight/batch', async (req, reply) => handleParsed(req.body, RadarBatchPreflightRequestSchema, (input) => ({
    data: safeJsonExport(RadarBatchPreflightResponseSchema.parse(runRadarPreflightBatch(input, store)))
  }), reply));
  app.post('/v1/radar/compare', async (req, reply) => handleParsed(req.body, RadarComparisonRequestSchema, (input) => ({
    data: safeJsonExport(runRadarComparison(input, store))
  }), reply));
  app.get('/v1/radar/superiority-readiness', async () => ({
    data: safeJsonExport(RadarSuperiorityReadinessSchema.parse(buildSuperiorityReadiness(store)))
  }));
  app.get('/v1/radar/benchmark-readiness', async () => ({
    data: safeJsonExport(RadarBenchmarkReadinessSchema.parse(buildBenchmarkReadiness(store)))
  }));
  app.get('/v1/radar/benchmark-summary', async () => {
    const startedAtMs = Date.now();
    const cached = await responseCache.getOrSet('radar:benchmark-summary', RADAR_BENCHMARKS_TTL_MS, () => RadarBenchmarkSummarySchema.parse(buildRadarBenchmarkSummary()));
    logRadarRouteTiming('/v1/radar/benchmark-summary', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
    return { data: safeJsonExport(cached.value) };
  });
  app.get('/v1/radar/evidence-ledger', async () => ({
    data: safeJsonExport(RadarEvidenceLedgerSchema.parse(buildRadarEvidenceLedger()))
  }));
  app.get('/v1/radar/evidence-ledger/brief', async () => ({
    data: safeJsonExport(RadarEvidenceLedgerBriefSchema.parse(buildRadarEvidenceLedgerBrief()))
  }));
  app.get('/v1/radar/agent-readiness', async () => ({
    data: safeJsonExport(AgentSpendReadinessListSchema.parse(buildAgentSpendReadiness(store)))
  }));
  app.get<{ Params: { provider_id: string } }>('/v1/radar/agent-readiness/:provider_id', async (req, reply) => {
    const card = getAgentSpendReadinessCard(store, req.params.provider_id);
    if (!card) return reply.code(404).send({ error: 'provider_readiness_not_found' });
    return {
      data: safeJsonExport(AgentSpendReadinessCardSchema.parse(card))
    };
  });
  app.get('/v1/radar/bundles', async () => ({
    data: safeJsonExport(RadarBundleListSchema.parse(listRadarBundles()))
  }));
  app.get<{ Params: { bundle_id: string } }>('/v1/radar/bundles/:bundle_id', async (req, reply) => {
    const bundle = getRadarBundleById(req.params.bundle_id);
    if (!bundle) return reply.code(404).send({ error: 'bundle_not_found' });
    return {
      data: safeJsonExport(RadarBundleSchema.parse(bundle))
    };
  });
  app.get<{ Params: { bundle_id: string } }>('/v1/radar/bundles/:bundle_id/runs', async (req, reply) => {
    const runs = listRadarBundleRuns(req.params.bundle_id);
    if (!runs) return reply.code(404).send({ error: 'bundle_not_found' });
    return {
      data: safeJsonExport(BundleRunListResponseSchema.parse(runs))
    };
  });
  app.get<{ Params: { bundle_id: string; run_id: string } }>('/v1/radar/bundles/:bundle_id/runs/:run_id', async (req, reply) => {
    const bundleRuns = listRadarBundleRuns(req.params.bundle_id);
    if (!bundleRuns) return reply.code(404).send({ error: 'bundle_not_found' });
    const run = getRadarBundleRunById(req.params.bundle_id, req.params.run_id);
    if (!run) return reply.code(404).send({ error: 'bundle_run_not_found' });
    return {
      data: safeJsonExport(BundleRunDetailSchema.parse(run))
    };
  });
  app.post<{ Params: { bundle_id: string } }>('/v1/radar/bundles/:bundle_id/plan', async (req, reply) => handleParsed(req.body, RadarBundlePlanRequestSchema, (input) => {
    const plan = buildRadarBundlePlan(req.params.bundle_id, input);
    if (!plan) return reply.code(404).send({ error: 'bundle_not_found' });
    return { data: safeJsonExport(RadarBundlePlanResponseSchema.parse(plan)) };
  }, reply));
  app.get('/v1/radar/benchmarks', async () => {
    const startedAtMs = Date.now();
    const cached = await responseCache.getOrSet('radar:benchmarks', RADAR_BENCHMARKS_TTL_MS, () => RadarBenchmarkListSchema.parse(buildRadarBenchmarks()));
    logRadarRouteTiming('/v1/radar/benchmarks', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
    return { data: safeJsonExport(cached.value) };
  });
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmarks/:benchmark_id', async (req, reply) => {
    const benchmark = buildRadarBenchmarkById(req.params.benchmark_id);
    if (!benchmark) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkDetailSchema.parse(benchmark))
    };
  });
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmarks/:benchmark_id/history', async (req, reply) => {
    const history = buildRadarBenchmarkHistoryById(req.params.benchmark_id);
    if (!history) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkHistorySchema.parse(history))
    };
  });
  app.get('/v1/radar/benchmark-history', async () => ({
    data: safeJsonExport(RadarBenchmarkHistoryV2AggregateSchema.parse(buildRadarBenchmarkHistoryV2Aggregate()))
  }));
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmark-history/:benchmark_id', async (req, reply) => {
    const history = buildRadarBenchmarkHistoryV2ById(req.params.benchmark_id);
    if (!history) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkHistoryV2DetailSchema.parse(history))
    };
  });
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmark-history/:benchmark_id/routes', async (req, reply) => {
    const history = buildRadarBenchmarkRouteHistoryByBenchmarkId(req.params.benchmark_id);
    if (!history) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkRouteHistoryAggregateSchema.parse(history))
    };
  });
  app.get<{ Params: { benchmark_id: string; '*': string } }>('/v1/radar/benchmark-history/:benchmark_id/routes/*', async (req, reply) => {
    const routeId = decodeURIComponent(req.params['*']);
    const history = buildRadarBenchmarkRouteHistoryDetail(req.params.benchmark_id, routeId);
    if (!history) {
      const benchmark = buildRadarBenchmarkById(req.params.benchmark_id);
      return reply.code(404).send({ error: benchmark ? 'route_not_found' : 'benchmark_not_found' });
    }
    return {
      data: safeJsonExport(RadarBenchmarkRouteHistoryDetailSchema.parse(history))
    };
  });
  app.get('/v1/radar/benchmark-artifacts', async () => ({
    data: safeJsonExport(RadarBenchmarkArtifactListSchema.parse({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      artifacts: listBenchmarkArtifactMetadata()
    }))
  }));
  app.get<{ Params: { artifact_id: string } }>('/v1/radar/benchmark-artifacts/:artifact_id', async (req, reply) => {
    const artifact = getBenchmarkArtifactMetadataById(req.params.artifact_id);
    if (!artifact) return reply.code(404).send({ error: 'benchmark_artifact_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkArtifactSchema.parse(artifact))
    };
  });
  app.get('/v1/monitor/runs/recent', async () => ({ data: [...(store.monitorRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 20).map(monitorRunResponse) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id/monitor', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerMonitorSummary(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/monitor', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointMonitorSummary(store, endpoint) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/history', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointHistory(store, endpoint) };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/trust/:entity_id', async (req, reply) => {
    const trust = store.trustAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!trust) return reply.code(404).send({ error: 'trust_assessment_not_found' });
    return { data: trust };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/signal/:entity_id', async (req, reply) => {
    const signal = store.signalAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!signal) return reply.code(404).send({ error: 'signal_assessment_not_found' });
    return { data: signal };
  });
  app.get('/v1/narratives', async () => ({ data: listNarrativeAssets() }));
  const optionalFeatureUnavailable = (reply: FastifyReply, feature: string) => {
    const reason = config.disabledFeatures[feature];
    if (!reason) return false;
    reply.code(503).send(buildRhChainApiErrorResponse('feature_unavailable', { message: `${feature}: ${reason}` }));
    return true;
  };
  const classificationFeatureAvailable = () => config.rhChainReviewedClassificationsEnabled;
  const classificationReviewAccess = (authorization: string | undefined) => classificationFeatureAvailable() && config.rhChainReviewConsoleEnabled && Boolean(config.rhChainReviewAdminToken) && isRhChainReviewAdmin(config.rhChainReviewAdminToken, authorization);
  const classificationReviewer = (value: string | string[] | undefined) => {
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof candidate === 'string' && /^[A-Za-z0-9._:@-]{1,64}$/.test(candidate.trim()) ? candidate.trim() : null;
  };
  const classificationFailure = (reply: FastifyReply, error: unknown) => {
    if (error instanceof z.ZodError) return reply.code(400).send(buildRhChainApiErrorResponse('invalid_request', { issues: error.issues }));
    if (error instanceof RhChainClassificationError) {
      if (error.code === 'rh_chain_classification_not_found') return reply.code(404).send(buildRhChainApiErrorResponse(error.code));
      if (error.code === 'rh_chain_classification_stored_payload_invalid') return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_classification_storage_invalid'));
      return reply.code(409).send({ ...buildRhChainApiErrorResponse(error.code), ...(error.current ? { current: error.current } : {}) });
    }
    return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_classification_storage_unavailable'));
  };
  const internalClassificationGuard = (reply: FastifyReply, authorization: string | undefined) => {
    if (!classificationFeatureAvailable() || !config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) { reply.code(404).send(buildRhChainApiErrorResponse('not_found')); return false; }
    if (!classificationReviewAccess(authorization)) { reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required')); return false; }
    return true;
  };
  app.get<{ Querystring: Record<string, unknown> }>('/internal/rh-chain/classifications', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.list(RhChainClassificationPagingSchema.parse(req.query)))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.get<{ Params: { contract: string } }>('/internal/rh-chain/classifications/:contract', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.get(RhChainClassificationContractSchema.parse(req.params)))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.post('/internal/rh-chain/classifications', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.propose(RhChainClassificationProposalSchema.parse(req.body), reviewer))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.post<{ Params: { contract: string } }>('/internal/rh-chain/classifications/:contract/approve', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.approve(RhChainClassificationContractSchema.parse(req.params), RhChainClassificationApprovalSchema.parse(req.body), reviewer))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.post<{ Params: { contract: string } }>('/internal/rh-chain/classifications/:contract/reject', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.reject(RhChainClassificationContractSchema.parse(req.params), RhChainClassificationRejectionSchema.parse(req.body), reviewer))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.post<{ Params: { contract: string } }>('/internal/rh-chain/classifications/:contract/supersede', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.supersede(RhChainClassificationContractSchema.parse(req.params), RhChainClassificationSupersessionSchema.parse(req.body), reviewer))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.get<{ Params: { contract: string }; Querystring: Record<string, unknown> }>('/internal/rh-chain/classifications/:contract/audit', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.audit(RhChainClassificationContractSchema.parse(req.params), RhChainClassificationAuditPagingSchema.parse(req.query)))); } catch (error) { return classificationFailure(reply, error); }
  });
  app.get('/internal/rh-chain/market-structure/cross-layer/conflicts', async (req, reply) => {
    if (!internalClassificationGuard(reply, req.headers.authorization)) return;
    if (!rhChainCrossLayerIntegration) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainCrossLayerIntegration.inspectConflicts())); }
    catch { return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_cross_layer_conflicts_unavailable')); }
  });
  app.get<{ Querystring: Record<string, unknown> }>('/v1/rh-chain/classifications', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_reviewed_classifications')) return;
    if (!classificationFeatureAvailable()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewedClassifications.listApproved(RhChainClassificationPagingSchema.omit({ status: true }).parse(req.query)))); } catch (error) { return classificationFailure(reply, error); }
  });
  const projectClaimsEnabled = () => config.rhChainProjectClaimsEnabled;
  const projectDirectoryEnabled = () => config.rhChainProjectDirectoryEnabled && projectClaimsEnabled();
  const projectReceiptsEnabled = () => config.rhChainIntelligenceReceiptsEnabled && projectClaimsEnabled();
  const operationalReadinessGuard = (reply: FastifyReply, authorization: string | undefined) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) { reply.code(404).send(buildRhChainApiErrorResponse('not_found')); return false; }
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, authorization)) { reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required')); return false; }
    return true;
  };
  app.get('/internal/rh-chain/operational-readiness', async (req, reply) => {
    if (!operationalReadinessGuard(reply, req.headers.authorization)) return;
    const readiness = await inspectRhChainOperationalReadiness({
      pool: rhChainPostgresPool,
      config,
      approvedClassificationCount: async () => (await rhChainReviewedClassifications.listApproved({ page: 1, page_size: 100 })).classifications.length,
      classificationConflictCount: async () => rhChainCrossLayerIntegration ? (await rhChainCrossLayerIntegration.inspectConflicts()).conflict_count : 0
    });
    return safeJsonExport(buildRhChainApiResponse(readiness));
  });
  const projectClaimsInternalGuard = (reply: FastifyReply, authorization: string | undefined) => {
    if (!projectClaimsEnabled() || !config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) { reply.code(404).send(buildRhChainApiErrorResponse('not_found')); return false; }
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, authorization)) { reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required')); return false; }
    return true;
  };
  const projectClaimsFailure = (reply: FastifyReply, error: unknown) => {
    if (error instanceof z.ZodError) return reply.code(400).send(buildRhChainApiErrorResponse('invalid_request', { issues: error.issues }));
    if (error instanceof RhChainProjectClaimsError) return reply.code(error.code.includes('not_found') ? 404 : error.code.includes('stored_payload') ? 503 : 409).send(buildRhChainApiErrorResponse(error.code));
    return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_project_claims_unavailable'));
  };
  app.get<{ Querystring: Record<string, unknown> }>('/v1/rh-chain/projects', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_project_directory') || optionalFeatureUnavailable(reply, 'rh_chain_project_claims')) return;
    if (!projectDirectoryEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.list(req.query))); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get<{ Params: { project_id: string } }>('/v1/rh-chain/projects/:project_id', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_project_claims')) return;
    if (!projectClaimsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.project(req.params.project_id))); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get<{ Params: { project_id: string } }>('/v1/rh-chain/projects/:project_id/claims', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_project_claims')) return;
    if (!projectClaimsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { const p = await rhChainProjectClaims.project(req.params.project_id); return safeJsonExport(buildRhChainApiResponse({ project_id: req.params.project_id, project_submitted_claims: p.project_submitted_claims, not_financial_advice: true })); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get<{ Params: { project_id: string } }>('/v1/rh-chain/projects/:project_id/observations', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_project_claims')) return;
    if (!projectClaimsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { const p = await rhChainProjectClaims.project(req.params.project_id); return safeJsonExport(buildRhChainApiResponse({ project_id: req.params.project_id, infopunks_observations: p.infopunks_observations, onchain_evidence: p.onchain_evidence, not_financial_advice: true })); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get<{ Params: { project_id: string } }>('/v1/rh-chain/projects/:project_id/receipts', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_intelligence_receipts')) return;
    if (!projectReceiptsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    try { const p = await rhChainProjectClaims.project(req.params.project_id); return safeJsonExport(buildRhChainApiResponse({ project_id: req.params.project_id, receipts: p.receipts, not_financial_advice: true })); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get('/v1/rh-chain/intelligence-receipts', async (_req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_intelligence_receipts')) return;
    if (!projectReceiptsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    return safeJsonExport(buildRhChainApiResponse({ receipts: (await rhChainProjectClaims.store.receipts()).filter((item) => ['published', 'superseded'].includes(item.reviewer_publication_state)).map(publicReceipt), not_financial_advice: true }));
  });
  app.get<{ Params: { receipt_id: string } }>('/v1/rh-chain/intelligence-receipts/:receipt_id', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_intelligence_receipts')) return;
    if (!projectReceiptsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    const receipt = await rhChainProjectClaims.store.getReceipt(req.params.receipt_id);
    if (!receipt || !['published', 'superseded'].includes(receipt.reviewer_publication_state)) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_intelligence_receipt_not_found'));
    return safeJsonExport(buildRhChainApiResponse({ receipt: publicReceipt(receipt), share: buildRhChainProjectReceiptShare(receipt), not_financial_advice: true }));
  });
  app.post('/v1/rh-chain/projects/claims', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_project_claims')) return;
    if (!projectClaimsEnabled()) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    const limit = rhChainPublicRateLimiter.consume(`project_claim:${req.ip}`); if (!limit.allowed) return reply.code(429).header('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000))).send(buildRhChainApiErrorResponse('rate_limited'));
    try { return reply.code(202).send(safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.submit(req.body)))); } catch (error) { return projectClaimsFailure(reply, error); }
  });
  app.get('/internal/rh-chain/projects', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.list(req.query))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.get<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.internalProject(req.params.project_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.get<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id/contracts', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; try { return safeJsonExport(buildRhChainApiResponse({ relationships: await rhChainProjectClaims.store.relationships(req.params.project_id) })); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id/contracts', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.linkContract(req.params.project_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/verify', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.verifyContract(req.params.project_id, req.params.relationship_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/dispute', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.disputeContract(req.params.project_id, req.params.relationship_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/reject', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.rejectContract(req.params.project_id, req.params.relationship_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/supersede', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.supersedeContract(req.params.project_id, req.params.relationship_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.get<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/audit', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; try { return safeJsonExport(buildRhChainApiResponse({ audit: await rhChainProjectClaims.relationshipAudit(req.params.project_id, req.params.relationship_id) })); } catch (error) { return projectClaimsFailure(reply, error); } });
  const reviewerEvidence = async (projectId: string, body: unknown, reviewer: string, targetType: string, targetId: string) => rhChainProjectClaims.attachEvidence(projectId, { ...(body as Record<string, unknown>), target_type: targetType, target_id: targetId }, reviewer);
  app.post<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'project_identity', req.params.project_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; relationship_id: string } }>('/internal/rh-chain/projects/:project_id/contracts/:relationship_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'contract_relationship', req.params.relationship_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; claim_id: string } }>('/internal/rh-chain/projects/:project_id/claims/:claim_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'claim', req.params.claim_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; observation_id: string } }>('/internal/rh-chain/projects/:project_id/observations/:observation_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'observation', req.params.observation_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; verdict_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'verdict', req.params.verdict_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; receipt_id: string } }>('/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/evidence', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await reviewerEvidence(req.params.project_id, req.body, reviewer, 'receipt', req.params.receipt_id))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; evidence_id: string } }>('/internal/rh-chain/projects/:project_id/evidence/:evidence_id/status', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.transitionEvidence(req.params.project_id, req.params.evidence_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; evidence_id: string } }>('/internal/rh-chain/projects/:project_id/evidence/:evidence_id/supersede', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.supersedeEvidence(req.params.project_id, req.params.evidence_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; claim_id: string } }>('/internal/rh-chain/projects/:project_id/claims/:claim_id/review', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.reviewClaim(req.params.project_id, req.params.claim_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id/observations', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); const parsed = z.object({ expected_version: z.number().int().positive() }).passthrough().safeParse(req.body); if (!parsed.success) return projectClaimsFailure(reply, parsed.error); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.addObservation(req.params.project_id, parsed.data, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); const parsed = z.object({ expected_version: z.number().int().positive() }).passthrough().safeParse(req.body); if (!parsed.success) return projectClaimsFailure(reply, parsed.error); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.createVerdict(req.params.project_id, parsed.data, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; verdict_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/approve', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); const parsed = z.object({ expected_version: z.number().int().positive() }).strict().safeParse(req.body); if (!parsed.success) return projectClaimsFailure(reply, parsed.error); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.approveVerdict(req.params.project_id, req.params.verdict_id, parsed.data.expected_version, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; verdict_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/reject', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization)) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.rejectVerdict(req.params.project_id, req.params.verdict_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; verdict_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/publish', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.publishReceipt(req.params.project_id, req.params.verdict_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; verdict_id: string } }>('/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/receipt-drafts', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.createReceiptDraft(req.params.project_id, req.params.verdict_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; receipt_id: string } }>('/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/approve', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.approveReceiptDraft(req.params.project_id, req.params.receipt_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; receipt_id: string } }>('/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/reject', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.rejectReceiptDraft(req.params.project_id, req.params.receipt_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { project_id: string; receipt_id: string } }>('/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/publish', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.publishReceiptDraft(req.params.project_id, req.params.receipt_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  app.post<{ Params: { receipt_id: string } }>('/internal/rh-chain/intelligence-receipts/:receipt_id/supersede', async (req, reply) => { if (!projectClaimsInternalGuard(reply, req.headers.authorization) || !projectReceiptsEnabled()) return; const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required')); try { return safeJsonExport(buildRhChainApiResponse(await rhChainProjectClaims.supersedeReceipt(req.params.receipt_id, req.body, reviewer))); } catch (error) { return projectClaimsFailure(reply, error); } });
  const attentionQualityInternalGuard = (reply: FastifyReply, authorization: string | undefined) => {
    if (!config.rhChainAttentionQualityV2Enabled || !config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) { reply.code(404).send(buildRhChainApiErrorResponse('not_found')); return false; }
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, authorization)) { reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required')); return false; }
    return true;
  };
  app.get('/internal/rh-chain/attention-quality/assessments', async (req, reply) => {
    if (!attentionQualityInternalGuard(reply, req.headers.authorization)) return;
    const receipts = await rhChainAttentionReceiptStore.list();
    return safeJsonExport(buildRhChainApiResponse({ assessments: receipts.map((item) => item.assessment), receipts, provider_requests_in_path: 0 }));
  });
  app.get<{ Params: { contract: string }; Querystring: { window?: RhChainAttentionWindow } }>('/internal/rh-chain/attention-quality/assessments/:contract', async (req, reply) => {
    if (!attentionQualityInternalGuard(reply, req.headers.authorization)) return;
    const window = req.query.window === '24h' || req.query.window === '30d' ? req.query.window : '7d';
    return safeJsonExport(buildRhChainApiResponse({ assessment: await rhChainAttentionQuality.assess(req.params.contract, window), receipts: await rhChainAttentionReceiptStore.list(req.params.contract), provider_requests_in_path: 0 }));
  });
  app.post<{ Params: { contract: string }; Body: { window?: RhChainAttentionWindow } }>('/internal/rh-chain/attention-quality/assessments/:contract/receipts', async (req, reply) => {
    if (!attentionQualityInternalGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    const window = req.body?.window === '24h' || req.body?.window === '30d' ? req.body.window : '7d';
    return safeJsonExport(buildRhChainApiResponse({ receipt: await rhChainAttentionQuality.createReceipt(req.params.contract, window, reviewer) }));
  });
  app.post<{ Params: { receipt_id: string } }>('/internal/rh-chain/attention-quality/receipts/:receipt_id/publish', async (req, reply) => {
    if (!attentionQualityInternalGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    const receipt = await rhChainAttentionQuality.publishReceipt(req.params.receipt_id, reviewer); if (!receipt) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_attention_quality_receipt_not_found'));
    return safeJsonExport(buildRhChainApiResponse({ receipt }));
  });
  app.post<{ Params: { receipt_id: string } }>('/internal/rh-chain/attention-quality/receipts/:receipt_id/reject', async (req, reply) => {
    if (!attentionQualityInternalGuard(reply, req.headers.authorization)) return;
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    const receipt = await rhChainAttentionQuality.rejectReceipt(req.params.receipt_id, reviewer); if (!receipt) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_attention_quality_receipt_not_found'));
    return safeJsonExport(buildRhChainApiResponse({ receipt }));
  });
  app.get<{ Querystring: { status?: string } }>('/internal/rh-chain/review-console/submissions', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const status = req.query.status;
    const records = await rhChainSubmissionStore.list();
    const reviewItems = assembleRhChainReviewQueue(records.map(asRhChainPersistedReviewItem)).items;
    const submissions = (status ? records.filter((item) => item.review_status === status) : records).map((item) => {
      const intelligence = resolveRhChainContractIntelligence(item.token_contract, { reviewItems });
      return { ...redactRhChainSubmissionForReview(item), contract_intelligence: { source: intelligence.source, display_name: intelligence.display_name, review_status: intelligence.review_status, claim_status: intelligence.claim_status } };
    });
    return safeJsonExport(buildRhChainApiResponse({ submissions, storage: { adapter: rhChainSubmissionStore.adapter, durable: rhChainSubmissionStore.durable } }));
  });
  app.get<{ Params: { submissionId: string } }>('/internal/rh-chain/review-console/submissions/:submissionId', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const submission = (await rhChainSubmissionStore.list()).find((item) => item.submission_id === req.params.submissionId);
    if (!submission) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_submission_not_found'));
    const reviewItems = assembleRhChainReviewQueue((await rhChainSubmissionStore.list()).map(asRhChainPersistedReviewItem)).items;
    const intelligence = resolveRhChainContractIntelligence(submission.token_contract, { reviewItems });
    return safeJsonExport(buildRhChainApiResponse({ submission: { ...redactRhChainSubmissionForReview(submission), contract_intelligence: { source: intelligence.source, display_name: intelligence.display_name, review_status: intelligence.review_status, claim_status: intelligence.claim_status } } }));
  });
  app.patch<{ Params: { submissionId: string } }>('/internal/rh-chain/review-console/submissions/:submissionId', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const parsed = RhChainReviewUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(buildRhChainApiErrorResponse('invalid_request', { issues: parsed.error.issues }));
    try {
      const reviewerHeader = req.headers['x-rh-chain-reviewer-id'];
      const reviewer_id = typeof reviewerHeader === 'string' && reviewerHeader.trim().length <= 64 ? reviewerHeader.trim() : 'system_reviewer';
      const updated = await rhChainSubmissionStore.updateReview(req.params.submissionId, { ...parsed.data, reviewer_id });
      if (!updated) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_submission_not_found'));
      if ('conflict' in updated) return reply.code(409).send({ ...buildRhChainApiErrorResponse('rh_chain_review_conflict'), submission: redactRhChainSubmissionForReview(updated.current) });
      return safeJsonExport(buildRhChainApiResponse({ submission: redactRhChainSubmissionForReview(updated) }));
    } catch (error) {
      if (error instanceof Error && error.message === 'rh_chain_submission_storage_not_configured') return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_submission_storage_not_configured'));
      throw error;
    }
  });
  app.get('/internal/rh-chain/jobs', async (req, reply) => {
    // Internal job visibility uses the same dedicated Review Console credential.
    // Without that credential this route is deliberately undiscoverable.
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    return safeJsonExport(buildRhChainApiResponse({
      enabled: rhChainAutomation.enabled,
      durable_lock_available: rhChainAutomation.durableLockAvailable,
      jobs: RH_CHAIN_AUTOMATION_JOB_NAMES,
      runs: await rhChainAutomation.listRuns()
    }));
  });
  app.post<{ Params: { job_name: string } }>('/internal/rh-chain/jobs/:job_name/run', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    if (!isRhChainAutomationJobName(req.params.job_name)) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_automation_job_not_found'));
    const run = await rhChainAutomation.run(req.params.job_name);
    return safeJsonExport(buildRhChainApiResponse({ run }));
  });
  app.get('/internal/rh-chain/daily-receipt-drafts', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    return safeJsonExport(buildRhChainApiResponse({ drafts: await rhChainDailyReceiptDrafts.listDrafts() }));
  });
  app.post<{ Body: { day?: string } }>('/internal/rh-chain/review-cycle-receipt-drafts', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const summary = await rhChainReviewPipeline.dailySummary(req.body?.day);
    const draft = await rhChainDailyReceiptDrafts.generateReviewCycleDraft(summary);
    return safeJsonExport(buildRhChainApiResponse({ draft, publication_status: 'unpublished', public_surface_unchanged: true }));
  });
  app.post('/internal/rh-chain/market-structure-receipt-drafts', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const draft = await rhChainDailyReceiptDrafts.generateMarketStructureDraft();
    return safeJsonExport(buildRhChainApiResponse({ draft, publication_status: 'unpublished', public_surface_unchanged: true }));
  });
  app.post('/internal/rh-chain/agentic-market-structure-receipt-drafts', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const draft = await rhChainDailyReceiptDrafts.generateAgenticMarketStructureDraft();
    return safeJsonExport(buildRhChainApiResponse({ draft, publication_status: 'unpublished', public_surface_unchanged: true }));
  });
  app.get('/internal/rh-chain/risk-correlations', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const snapshot = await rhChainRiskCorrelationSweep.getLatest();
    return safeJsonExport(buildRhChainApiResponse({ observed_at: snapshot?.observed_at ?? null, correlations: snapshot?.suspected_correlations ?? [] }));
  });
  app.get<{ Params: { draft_id: string } }>('/internal/rh-chain/daily-receipt-drafts/:draft_id', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const draft = await rhChainDailyReceiptDrafts.getDraft(req.params.draft_id);
    return draft ? safeJsonExport(buildRhChainApiResponse({ draft })) : reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_daily_receipt_draft_not_found'));
  });
  app.post<{ Params: { draft_id: string } }>('/internal/rh-chain/daily-receipt-drafts/:draft_id/publish', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const reviewer = typeof req.headers['x-rh-chain-reviewer-id'] === 'string' ? req.headers['x-rh-chain-reviewer-id'].trim() : '';
    if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { const published = await rhChainDailyReceiptDrafts.publish(req.params.draft_id, reviewer, (req.body as { reviewer_edits?: Record<string, string> } | undefined)?.reviewer_edits); return safeJsonExport(buildRhChainApiResponse({ ...published, detail_route: `/rh-chain-signal-desk/daily-receipts/${published.receipt.receipt_id}`, share_card_route: `/rh-chain-signal-desk/daily-receipts/${published.receipt.receipt_id}/card`, distribution_copy: 'Receipt Relay and Distribution Pack read the reviewer-published Daily Receipt feed.' })); } catch (error) { return reply.code(409).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'rh_chain_daily_receipt_publish_failed')); }
  });
  app.post<{ Params: { draft_id: string } }>('/internal/rh-chain/daily-receipt-drafts/:draft_id/reject', async (req, reply) => {
    if (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('review_admin_token_required'));
    const reviewer = typeof req.headers['x-rh-chain-reviewer-id'] === 'string' ? req.headers['x-rh-chain-reviewer-id'].trim() : '';
    if (!reviewer) return reply.code(400).send(buildRhChainApiErrorResponse('reviewer_id_required'));
    try { return safeJsonExport(buildRhChainApiResponse({ draft: await rhChainDailyReceiptDrafts.reject(req.params.draft_id, reviewer) })); } catch (error) { return reply.code(409).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'rh_chain_daily_receipt_reject_failed')); }
  });
  app.get('/v1/rh-chain', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChainIntelligence(await rhChainChainPulse.getLatest()))));
  app.get('/v1/rh-chain/memes', async () => safeJsonExport(buildRhChainApiResponse({
    generated_at: getRhChainPayload().generated_at,
    source_policy: getRhChainPayload().source_policy,
    memes: assembleRhChainMemePulse()
  })));
  app.get('/v1/rh-chain/signals', async () => safeJsonExport(buildRhChainApiResponse({
    generated_at: getRhChainPayload().generated_at,
    source_policy: getRhChainPayload().source_policy,
    ...listRhChainSignals()
  })));
  const rh4663Failure = (reply: FastifyReply, error: unknown) => {
    if (error instanceof Rh4663ServiceError) return reply.code(error.statusCode).send({ error: error.code });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_4663_request', details: error.flatten() });
    throw error;
  };
  const rh4663SourceStatus = (freshness: string | undefined): Rh4663EvidenceReference['source_status'] => {
    if (freshness === 'live' || freshness === 'fresh') return 'fresh';
    if (freshness === 'aging' || freshness === 'stale') return 'stale';
    if (freshness === 'unavailable') return 'unavailable';
    return 'degraded';
  };
  const rh4663ProviderState = (freshness: string | undefined): Rh4663TodayEdition['provider_state'] => {
    const status = rh4663SourceStatus(freshness);
    return status === 'fresh' ? 'available' : status;
  };
  const rh4663PulseRead = async () => {
    try { return await rh4663.pulse(); }
    catch { const window = rh4663.pulseWindow(); return { window, consensus: resolveRh4663Consensus([], window.window_id), options: Rh4663RotationOptionSchema.options, mechanics: { version: 'infopunks.rh-pulse.call.v1', one_call_per_wallet_per_window: true, signature_required: true, immutable_call_receipts: true, genesis_limit: 4_663 }, storage_status: 'unavailable' as const }; }
  };
  const rh4663GenesisRead = async () => {
    try { return await rh4663.genesis(); }
    catch { return { limit: 4_663, recorded: 0, remaining: 4_663, progress: 0, policy: 'Genesis storage is unavailable. No provenance count is inferred.', storage_status: 'unavailable' as const }; }
  };
  const rh4663TodayInput = async (date?: string) => {
    const index = assembleRhChain4663Index();
    const editionDate = date ?? new Date().toISOString().slice(0, 10);
    const priorEdition = await rh4663Store.getToday(editionDate).catch(() => null);
    try {
      const [dailyReceipts, publishedIntelligence] = await Promise.all([
        rhChainDailyReceiptDrafts.publicFeed(),
        rh4663Intelligence.publicSignals({ since: `${editionDate}T00:00:00.000Z`, limit: 100 }).catch(() => [])
      ]);
      const rankedIntelligence = rankPublishedSignalsForToday(publishedIntelligence, 5);
      const legacy = assembleRhChainTodayOn4663({ dailyReceipts, index, storage_status: 'available' });
      const providerState = rh4663ProviderState(legacy.freshness_state);
      const evidence: Rh4663EvidenceReference[] = legacy.cards.map((card) => ({
        reference_id: `${card.id}:${card.source.updated_at}`,
        reference_type: card.id === 'latest_receipt' ? 'reviewed_receipt' : 'provider_observation',
        label: card.title,
        href: card.source.source_url || card.href,
        observed_at: card.source.observed_at,
        source_status: rh4663SourceStatus(card.freshness_state)
      }));
      const categoryFlows = index.assets.slice(0, 4).map((asset, position) => ({
        category: rh4663CategoryFromNarrative(asset.narrative_class),
        direction: (position === 0 ? 'leading' : position === 1 ? 'building' : 'watch') as 'leading' | 'building' | 'watch',
        summary: `${asset.ticker} · ${asset.infopunks_verdict}`,
        confidence: asset.signal_score
      }));
      const edition = await rh4663.today({ date, keySignal: legacy.cards.find((card) => card.id === 'top_signal')?.verdict ?? legacy.latest_receipt.top_signal, categoryFlows, evidence, providerState, confidence: legacy.latest_receipt.confidence_level === 'high' ? 85 : legacy.latest_receipt.confidence_level === 'medium' ? 65 : 45,
        intelligenceSignals: rankedIntelligence.map((signal) => ({ signal_id: signal.signal_id, event_id: signal.event_ids[0] ?? signal.signal_id, headline: signal.headline, category: rh4663LegacyCategory(signal.category), significance_score: signal.significance_score, detected_at: signal.detected_at, evidence: signal.evidence }))
      });
      if (!priorEdition) rh4663Intelligence.recordToday(edition.edition_state === 'degraded' ? 'degraded' : 'generated', { edition_id: edition.edition_id, date: edition.date, provider_state: edition.provider_state, intelligence_signal_count: edition.intelligence_signal_ids?.length ?? 0 });
      return { ...edition, rh_pulse: await rh4663Phase2.todayPulse(edition.date).catch(() => null) };
    } catch (error) {
      rh4663Intelligence.recordToday('degraded', { date: editionDate, error_code: error instanceof Rh4663ServiceError ? error.code : 'today_generation_failed' });
      return { edition_id: `today_4663_${editionDate.replaceAll('-', '')}_unavailable`, date: editionDate, generated_at: new Date().toISOString(), top_events: [], category_flows: [], key_signal: 'Current reviewed intelligence is unavailable. No live flow is asserted.', rh_pulse_consensus: null, evidence_references: [], confidence: 0, source_timestamps: [], provider_state: 'unavailable' as const, storage_status: 'unavailable' as const, archive_path: `/v1/4663/today/${editionDate}`, data_notice: 'Provider or storage state is unavailable. No missing live observation has been fabricated.' };
    }
  };
  const rh4663PrintRead = async (printId: string) => await rh4663PrintGenerator.get(printId) ?? getRh4663Print(printId);
  const rh4663LatestPrintRead = async () => await rh4663PrintGenerator.latest() ?? getLatestRh4663Print();
  app.get('/v1/4663', async () => {
    const [pulse, genesis, today, signals, liveSignals, latestPrint] = await Promise.all([rh4663PulseRead(), rh4663GenesisRead(), rh4663TodayInput(), rh4663Store.listSignals(5).catch(() => []), rh4663Intelligence.publicSignals({ limit: 3 }).catch(() => []), rh4663LatestPrintRead()]);
    const index = assembleRhChain4663Index();
    return { data: safeJsonExport({
      identity: 'INFOPUNKS // 4663', thesis: 'WE WATCH THE FLOW.',
      rotation_snapshot: { top_signal: index.overview.top_signal, highest_volume: index.overview.highest_volume, highest_risk: index.overview.highest_risk, last_updated: index.last_updated, source_status: rh4663SourceStatus(index.freshness_state) },
      pulse, today, latest_print: latestPrint, live_signals: { count: liveSignals.length, signals: liveSignals }, signal_hunt: { count: signals.length, signals }, genesis,
      semantics: { signal_card: 'Editorial intelligence representation.', evidence_receipt: 'Machine-verifiable observation object.', protocol_receipt: 'Canonical CALL / RESOLUTION / GENESIS FINALIZATION object.' }
    }) };
  });
  app.get('/v1/4663/prints', async () => ({ data: safeJsonExport({ prints: [...await rh4663PrintGenerator.list(), getLatestRh4663Print()].sort((a, b) => b.canonical_path.localeCompare(a.canonical_path)), storage: { adapter: rh4663PrintStore.adapter, durable: rh4663PrintStore.durable } }) }));
  app.get('/v1/4663/prints/latest', async () => ({ data: safeJsonExport(await rh4663LatestPrintRead()) }));
  app.get<{ Params: { printId: string } }>('/v1/4663/prints/:printId', async (req, reply) => {
    const print = await rh4663PrintRead(req.params.printId);
    return print ? { data: safeJsonExport(print) } : reply.code(404).send({ error: '4663_print_not_found' });
  });
  app.get<{ Params: { printId: string } }>('/v1/4663/prints/:printId/share', async (req, reply) => {
    const print = await rh4663PrintRead(req.params.printId);
    return print ? { data: safeJsonExport({ object_version: 'infopunks.rh4663.print.share.v1', object_type: 'market_state_print', print_id: print.print_id, canonical_path: print.canonical_path, images: print.share, verified_property: 'Campaign snapshot preserves its published source windows and methodology.' }) } : reply.code(404).send({ error: '4663_print_not_found' });
  });
  app.get<{ Querystring: { date?: string } }>('/v1/4663/print-candidate', async (req) => {
    const candidate = await rh4663PrintGenerator.candidate(req.query.date); rh4663CampaignTelemetry.record({ event: candidate.lifecycle === 'READY' ? '4663_print_candidate_generated' : '4663_print_candidate_incomplete' });
    for (const disagreement of candidate.disagreements.filter((item) => item.kind === 'SOURCE_DISAGREEMENT')) rh4663CampaignTelemetry.record({ event: '4663_print_provider_disagreement' });
    return { data: safeJsonExport(candidate) };
  });
  app.get<{ Querystring: { date?: string } }>('/v1/4663/observations', async (req, reply) => {
    const date = req.query.date;
    if (!date || !isValidRh4663UtcDate(date)) return reply.code(400).send({ error: 'invalid_utc_date' });
    const observations = await rh4663UtcDayObservationStore.current(date);
    const transactions = observations.find((item) => item.metric === 'transactions_utc_day') ?? null;
    const dex_volume = observations.find((item) => item.metric === 'dex_volume_utc_day_usd') ?? null;
    return { data: safeJsonExport({ date, transactions, dex_volume, status: transactions && dex_volume ? 'FINALIZED' : 'INCOMPLETE', warnings: [transactions ? null : 'MISSING_FINAL_UTC_TRANSACTIONS', dex_volume ? null : 'MISSING_FINAL_UTC_DEX_VOLUME'].filter((item): item is string => item !== null), storage: { adapter: rh4663UtcDayObservationStore.adapter, durable: rh4663UtcDayObservationStore.durable } }) };
  });
  app.post<{ Params: { candidateId: string }; Body: { fingerprint?: string } }>('/internal/4663/prints/:candidateId/freeze', async (req, reply) => {
    const reviewer = rh4663OperationalGuard(reply, req.headers.authorization, req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return;
    const date = req.params.candidateId.match(/^rh-print-candidate-(\d{4}-\d{2}-\d{2})$/)?.[1]; if (!date) return reply.code(400).send({ error: 'invalid_print_candidate_id' });
    if (!req.body?.fingerprint) return reply.code(400).send({ error: 'candidate_fingerprint_required' });
    try { const candidate = await rh4663PrintGenerator.candidate(date); const print = await rh4663PrintGenerator.freeze(candidate, req.body.fingerprint); rh4663CampaignTelemetry.record({ event: '4663_print_frozen', print_id: print.print_id }); return reply.code(201).send({ data: safeJsonExport({ print, requested_by: reviewer }) }); }
    catch (error) { if (error instanceof Rh4663PrintGeneratorError) return reply.code(error.statusCode).send({ error: error.code }); throw error; }
  });
  app.post('/v1/4663/campaign/events', async (req, reply) => {
    try { return reply.code(202).send({ data: rh4663CampaignTelemetry.record(Rh4663CampaignEventSchema.parse(req.body)) }); }
    catch (error) { return rh4663Failure(reply, error); }
  });
  app.get('/v1/4663/pulse', async () => ({ data: safeJsonExport(await rh4663PulseRead()) }));
  app.post('/v1/4663/pulse/payload', async (req, reply) => {
    try { return { data: safeJsonExport(rh4663.pulsePayload(Rh4663PulsePayloadInputSchema.parse(req.body))) }; }
    catch (error) { return rh4663Failure(reply, error); }
  });
  app.post('/v1/4663/pulse/calls', async (req, reply) => {
    try { return reply.code(201).send({ data: safeJsonExport(await rh4663.call(Rh4663PulseCallInputSchema.parse(req.body))) }); }
    catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { windowId: string } }>('/v1/4663/pulse/windows/:windowId', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.window(req.params.windowId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { windowId: string } }>('/v1/4663/pulse/windows/:windowId/resolution', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.publicResolution(req.params.windowId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { receiptId: string } }>('/v1/4663/pulse/receipts/:receiptId/proof', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.proof(req.params.receiptId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { receiptId: string } }>('/v1/4663/pulse/receipts/:receiptId/share', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.share(req.params.receiptId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { windowId: string } }>('/v1/4663/pulse/windows/:windowId/share', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.windowShare(req.params.windowId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { wallet: string } }>('/v1/4663/pulse/reputation/:wallet', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.reputation(req.params.wallet)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  const rh4663OperationalGuard = (reply: FastifyReply, authorization: string | undefined, reviewerHeader: unknown) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, authorization)) { reply.code(401).send({ error: 'review_admin_token_required' }); return null; }
    if (!config.rh4663Phase2Enabled) { reply.code(503).send({ error: 'phase2_not_enabled' }); return null; }
    const reviewer = classificationReviewer(reviewerHeader as string | string[] | undefined); if (!reviewer) { reply.code(400).send({ error: 'reviewer_id_required' }); return null; } return reviewer;
  };
  app.post<{ Params: { date: string } }>('/internal/4663/observations/utc-day/:date/refresh', async (req, reply) => {
    const reviewer = rh4663OperationalGuard(reply, req.headers.authorization, req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return;
    try { const result = await rh4663UtcDayObservations.refresh(req.params.date); return { data: safeJsonExport({ ...result, requested_by: reviewer, storage: { adapter: rh4663UtcDayObservationStore.adapter, durable: rh4663UtcDayObservationStore.durable } }) }; }
    catch (error) { if (error instanceof Rh4663UtcDayObservationError) return reply.code(error.statusCode).send({ error: error.code }); throw error; }
  });
  app.post<{ Params: { windowId: string } }>('/internal/4663/pulse/windows/:windowId/resolve', async (req, reply) => {
    const reviewer = rh4663OperationalGuard(reply, req.headers.authorization, req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return;
    try { return { data: safeJsonExport({ resolution: await rh4663Phase2.resolve(req.params.windowId), requested_by: reviewer }) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.post<{ Params: { windowId: string } }>('/internal/4663/pulse/windows/:windowId/publish', async (req, reply) => {
    const reviewer = rh4663OperationalGuard(reply, req.headers.authorization, req.headers['x-rh-chain-reviewer-id']); if (!reviewer) return;
    try { return { data: safeJsonExport({ ...(await rh4663Phase2.publish(req.params.windowId)), requested_by: reviewer }) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get('/internal/4663/pulse/metrics', async (req, reply) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' });
    return { data: { counters: rh4663Phase2.metrics() } };
  });
  app.get('/v1/4663/today', async () => ({ data: safeJsonExport(await rh4663TodayInput()) }));
  app.get('/v1/4663/today/archive', async () => ({ data: safeJsonExport({ editions: await rh4663Store.listToday(366), storage: { adapter: rh4663Store.adapter, durable: rh4663Store.durable } }) }));
  app.get<{ Params: { date: string } }>('/v1/4663/today/:date', async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) return reply.code(400).send({ error: 'invalid_edition_date' });
    const edition = await rh4663Store.getToday(req.params.date);
    if (!edition) return reply.code(404).send({ error: 'today_edition_not_found' });
    return { data: safeJsonExport({ ...edition, rh_pulse: await rh4663Phase2.todayPulse(req.params.date).catch(() => null) }) };
  });
  app.get<{ Querystring: { category?: string; subject?: string; signal_type?: string; since?: string; publication_state?: string; limit?: string } }>('/v1/4663/signals', async (req, reply) => {
    const category = req.query.category ? Rh4663IntelligenceCategorySchema.safeParse(req.query.category.toUpperCase()) : null;
    const signalType = req.query.signal_type ? Rh4663EventTypeSchema.safeParse(req.query.signal_type.toUpperCase()) : null;
    if ((category && !category.success) || (signalType && !signalType.success) || (req.query.publication_state && req.query.publication_state !== 'published') || (req.query.since && !Number.isFinite(Date.parse(req.query.since)))) return reply.code(400).send({ error: 'invalid_4663_signal_filter' });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100) || 100));
    const [signals, community] = await Promise.all([
      rh4663Intelligence.publicSignals({ ...(category?.success ? { category: category.data } : {}), ...(signalType?.success ? { signal_type: signalType.data } : {}), ...(req.query.subject ? { subject: req.query.subject } : {}), ...(req.query.since ? { since: new Date(req.query.since).toISOString() } : {}), limit }).catch(() => []),
      rh4663Store.listSignals(100).catch(() => [])
    ]);
    const watching = community.filter((signal) => ['watching', 'evidence_added', 'unresolved', 'confirmed'].includes(signal.lifecycle_state));
    return { data: safeJsonExport({ signals, watching, signal_hunt: community, archive_count: signals.length, publication_state: 'published', provider_requests_in_path: 0, guarantee_notice: 'Signal Cards are editorial intelligence, not Evidence Receipts or Protocol Receipts.' }) };
  });
  app.post('/v1/4663/signals', async (req, reply) => {
    try { return reply.code(201).send({ data: safeJsonExport(await rh4663.submitSignal(Rh4663SignalSubmissionSchema.parse(req.body))) }); }
    catch (error) { return rh4663Failure(reply, error); }
  });
  app.post<{ Params: { signalId: string } }>('/v1/4663/signals/:signalId/evidence', async (req, reply) => {
    const actor = typeof req.headers['x-rh-chain-reviewer-id'] === 'string' ? req.headers['x-rh-chain-reviewer-id'] : 'public_evidence_contributor';
    try { return { data: safeJsonExport(await rh4663.addSignalEvidence(req.params.signalId, Rh4663SignalEvidenceInputSchema.parse(req.body), actor)) }; }
    catch (error) { return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { signalId: string } }>('/v1/4663/signals/:signalId', async (req, reply) => {
    const published = await rh4663Intelligence.publicSignal(req.params.signalId).catch(() => null);
    if (published) return { data: safeJsonExport(published) };
    const community = await rh4663Store.getSignal(req.params.signalId).catch(() => null);
    if (!community) return reply.code(404).send({ error: 'signal_not_found' });
    return { data: safeJsonExport({ ...community, publication_state: 'community_watch', proof_status: 'not_published' }) };
  });
  app.get<{ Params: { signalId: string } }>('/v1/4663/signals/:signalId/evidence', async (req, reply) => {
    const evidence = await rh4663Intelligence.evidence(req.params.signalId).catch(() => null);
    if (!evidence) return reply.code(404).send({ error: 'published_signal_not_found' });
    return { data: safeJsonExport(evidence) };
  });
  app.get<{ Params: { lens: string }; Querystring: { since?: string } }>('/v1/4663/lenses/:lens', async (req, reply) => {
    const aliases: Record<string, string> = { meme: 'MEMES', memes: 'MEMES', stock_tokens: 'STOCK_TOKENS', rwa_defi: 'RWA_DEFI', stables: 'STABLES', stablecoin: 'STABLES', culture: 'CULTURE_NFT', nft: 'CULTURE_NFT', agent: 'AGENT', utility: 'UTILITY' };
    const category = Rh4663IntelligenceCategorySchema.safeParse(aliases[req.params.lens.toLowerCase()] ?? req.params.lens.toUpperCase());
    if (!category.success || (req.query.since && !Number.isFinite(Date.parse(req.query.since)))) return reply.code(400).send({ error: 'invalid_4663_lens' });
    return { data: safeJsonExport(await rh4663Intelligence.lens(category.data, req.query.since ? { since: new Date(req.query.since).toISOString() } : {})) };
  });
  app.get<{ Querystring: { since?: string } }>('/v1/4663/rotation', async (req, reply) => {
    if (req.query.since && !Number.isFinite(Date.parse(req.query.since))) return reply.code(400).send({ error: 'invalid_since' });
    return { data: safeJsonExport(await rh4663Intelligence.rotation(req.query.since ? new Date(req.query.since).toISOString() : undefined)) };
  });
  // RMM observations are public evidence objects, never receipt protocol objects.
  app.get('/v1/4663/reflexive', async () => ({ data: safeJsonExport(await reflexiveRadar.snapshot()) }));
  app.get('/v1/4663/reflexive/pairs', async () => {
    const state = await reflexiveRadar.snapshot(); return { data: safeJsonExport({ pairs: state.pairs, refreshed_at: state.refreshed_at, methodology_version: 'rmm-v0.3.1' }) };
  });
  app.get<{ Params: { id: string } }>('/v1/4663/reflexive/pairs/:id', async (req, reply) => {
    const pair = await reflexiveRadar.pair(req.params.id); if (!pair) return reply.code(404).send({ error: 'reflexive_pair_not_found' });
    const state = await reflexiveRadar.snapshot(); return { data: safeJsonExport({ pair, birth: state.births.find((item) => item.mission_pair_id === pair.pair_id) ?? null, lifecycle: state.lifecycle.filter((item) => item.pair_id === pair.pair_id), observations: state.observations.filter((item) => item.pair_id === pair.pair_id), position_identities: state.position_identities.filter((item) => item.mission_pair_id === pair.pair_id), inventory: state.inventory_observations.filter((item) => item.mission_pair_id === pair.pair_id).at(-1) ?? { status: 'UNAVAILABLE', reason: 'POSITION_UNRESOLVED' }, events: state.events.filter((item) => item.subject_id === pair.pair_id) }) };
  });
  app.get<{ Params: { symbol: string } }>('/v1/4663/reflexive/stocks/:symbol', async (req, reply) => {
    const stock = await reflexiveRadar.stock(req.params.symbol); if (!stock) return reply.code(404).send({ error: 'reflexive_stock_not_found' }); return { data: safeJsonExport(stock) };
  });
  app.get<{ Querystring: { observation_id?: string } }>('/v1/4663/reflexive/stocks/PLTR/preflight', async (req, reply) => {
    const state = await reflexiveRadar.pltrPreflight(req.query.observation_id); if (!state) return reply.code(req.query.observation_id ? 404 : 409).send({ error: req.query.observation_id ? 'pltr_preflight_observation_not_found' : 'pltr_canonical_registry_not_refreshed' }); return { data: safeJsonExport(state) };
  });
  app.get('/v1/4663/reflexive/events', async () => ({ data: safeJsonExport({ events: (await reflexiveRadar.snapshot()).events }) }));
  app.get('/v1/4663/reflexive/thesis', async () => ({ data: safeJsonExport({ thesis: (await reflexiveRadar.snapshot()).thesis }) }));
  app.get('/v1/4663/reflexive/audits/long-ai-nvda', async (_req, reply) => {
    if (!longDopplerVerifier) return reply.code(503).send({ error: 'long_audit_rpc_unavailable' }); const snapshot = await reflexiveRadar.snapshot(); const nvda = snapshot.assets.find((asset) => asset.ticker === 'NVDA'); if (!nvda) return reply.code(409).send({ error: 'long_audit_canonical_registry_not_refreshed' });
    // The direct audit remains the authoritative onchain read. v0.4.2 appends
    // durable market-context and longitudinal evidence without changing that scope.
    return { data: safeJsonExport({ ...await longDopplerVerifier.observeAiNvda(nvda), ...await reflexiveRadar.aiNvdaAudit() }) };
  });
  app.post('/internal/4663/reflexive/refresh', async (req, reply) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' });
    try { return { data: safeJsonExport(await reflexiveRadar.refresh()) }; } catch (error) { return reply.code(503).send({ error: error instanceof Error ? error.message : 'reflexive_refresh_failed' }); }
  });
  app.post('/internal/4663/reflexive/stocks/PLTR/preflight/refresh', async (req, reply) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' });
    try { const state = await reflexiveRadar.refreshPltrPreflight(); return state ? { data: safeJsonExport(state) } : reply.code(409).send({ error: 'pltr_canonical_registry_unavailable' }); } catch (error) { return reply.code(503).send({ error: error instanceof Error ? error.message : 'pltr_preflight_refresh_failed' }); }
  });
  app.post<{ Params: { signalId: string } }>('/internal/4663/signals/:signalId/transition', async (req, reply) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' });
    const actor = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!actor) return reply.code(400).send({ error: 'reviewer_id_required' });
    try { return { data: safeJsonExport(await rh4663.transitionSignal(req.params.signalId, Rh4663SignalTransitionInputSchema.parse(req.body), actor)) }; }
    catch (error) { return rh4663Failure(reply, error); }
  });
  const rh4663Phase3Reviewer = (req: FastifyRequest, reply: FastifyReply) => {
    if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) { reply.code(401).send({ error: 'review_admin_token_required' }); return null; }
    const reviewer = classificationReviewer(req.headers['x-rh-chain-reviewer-id']); if (!reviewer) { reply.code(400).send({ error: 'reviewer_id_required' }); return null; } return reviewer;
  };
  app.post('/internal/4663/intelligence/run', async (req, reply) => { const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; if (!rh4663Intelligence.activation().ingestion_enabled) return reply.code(503).send({ error: 'phase3_ingestion_disabled' }); const result = await runPhase3Intelligence(); return { data: safeJsonExport({ ...result, requested_by: reviewer }) }; });
  app.post('/internal/4663/intelligence/observations', async (req, reply) => { const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; try { const result = await rh4663Intelligence.ingest(Rh4663RawObservationInputSchema.parse(req.body)); return reply.code(201).send({ data: safeJsonExport({ ...result, requested_by: reviewer }) }); } catch (error) { return rh4663Failure(reply, error); } });
  app.get('/internal/4663/intelligence/candidates', async (req, reply) => { if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' }); return { data: safeJsonExport({ candidates: await rh4663IntelligenceStore.listCandidates(1_000), storage: { adapter: rh4663IntelligenceStore.adapter, durable: rh4663IntelligenceStore.durable } }) }; });
  app.post<{ Params: { candidateId: string } }>('/internal/4663/intelligence/candidates/:candidateId/action', async (req, reply) => {
    const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; const parsed = z.object({ action: z.enum(['publish', 'hold', 'reject', 'false_positive']), note: z.string().trim().min(3).max(1_000) }).strict().safeParse(req.body); if (!parsed.success) return reply.code(400).send({ error: 'invalid_candidate_action', details: parsed.error.flatten() });
    try { if (parsed.data.action === 'publish') return { data: safeJsonExport({ signal: await rh4663Intelligence.publish(req.params.candidateId, reviewer) }) }; const candidate = await rh4663IntelligenceStore.getCandidate(req.params.candidateId); if (!candidate) return reply.code(404).send({ error: 'candidate_not_found' }); const state = parsed.data.action === 'hold' ? 'held' as const : 'rejected' as const; const outcome = parsed.data.action === 'false_positive' ? 'false_positive' as const : parsed.data.action === 'reject' ? 'rejected' as const : 'held' as const; const updated = await rh4663IntelligenceStore.updateCandidate({ ...candidate, publication_state: state, outcome, updated_at: new Date().toISOString(), policy_reasons: [...candidate.policy_reasons, `reviewer:${parsed.data.action}:${parsed.data.note}`] }); rh4663Intelligence.recordCandidateAction(candidate.candidate_id,state,outcome,reviewer); return { data: safeJsonExport({ candidate: updated }) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.post<{ Params: { signalId: string } }>('/internal/4663/intelligence/signals/:signalId/corrections', async (req, reply) => { const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; const parsed = z.object({ correction_type: z.enum(['CORRECTION', 'SUPERSEDED', 'UPDATED_EVIDENCE']), note: z.string().trim().min(3).max(1_000), evidence: z.array(Rh4663EvidenceReferenceSchema).max(50).optional() }).strict().safeParse(req.body); if (!parsed.success) return reply.code(400).send({ error: 'invalid_correction', details: parsed.error.flatten() }); try { return { data: safeJsonExport(await rh4663Intelligence.correct(req.params.signalId, parsed.data, reviewer)) }; } catch (error) { return rh4663Failure(reply, error); } });
  app.post<{ Params: { signalId: string } }>('/internal/4663/intelligence/signals/:signalId/distribution', async (req, reply) => { const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; try { return { data: safeJsonExport({ ...(await rh4663Intelligence.queueDistribution(req.params.signalId)), requested_by: reviewer }) }; } catch (error) { return rh4663Failure(reply, error); } });
  app.post('/internal/4663/intelligence/backtest', async (req, reply) => { const reviewer = rh4663Phase3Reviewer(req, reply); if (!reviewer) return; const parsed = z.object({ since: z.string().datetime().optional(), until: z.string().datetime().optional(), heuristic_version: z.string().min(1).max(120).optional() }).strict().safeParse(req.body ?? {}); if (!parsed.success) return reply.code(400).send({ error: 'invalid_backtest_request', details: parsed.error.flatten() }); return { data: safeJsonExport({ ...(await rh4663Intelligence.backtest(parsed.data)), requested_by: reviewer }) }; });
  app.get('/internal/4663/intelligence/metrics', async (req, reply) => { if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' }); return { data: safeJsonExport(await rh4663Intelligence.metrics()) }; });
  app.get('/internal/4663/intelligence/activation', async (req, reply) => { if (!isRhChainReviewAdmin(config.rhChainReviewAdminToken, req.headers.authorization)) return reply.code(401).send({ error: 'review_admin_token_required' }); return { data: safeJsonExport(rh4663Intelligence.activation()) }; });
  app.get('/v1/4663/events', async () => ({ data: safeJsonExport({ events: (await rh4663Store.listEvents(500).catch(() => [])).filter((event) => event.publication_state === 'public') }) }));
  app.get('/v1/4663/receipts', async () => ({ data: safeJsonExport({ receipt_kind: 'PROTOCOL_RECEIPT', receipts: await rh4663Store.listCalls(undefined, 100).catch(() => []), immutable: true }) }));
  app.get<{ Params: { receiptId: string } }>('/v1/4663/receipts/:receiptId', async (req, reply) => {
    try { return { data: safeJsonExport(await rh4663Phase2.receipt(req.params.receiptId)) }; } catch (error) { return rh4663Failure(reply, error); }
  });
  app.get('/v1/rh-chain/4663-index', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChain4663Index())));
  app.get('/v1/rh-chain/campaigns/100-receipts', async () => safeJsonExport(buildRhChainApiResponse(getRhChain100ReceiptsCampaign())));
  app.get('/v1/rh-chain/today-on-4663', async () => {
    try {
      const [dailyReceipts, submissions] = await Promise.all([
        rhChainDailyReceiptDrafts.publicFeed(),
        rhChainSubmissionStore.list(),
        rhChainMemePulse.getLatest()
      ]);
      const reviewQueue = assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem));
      return safeJsonExport(buildRhChainApiResponse(assembleRhChainTodayOn4663({
        dailyReceipts,
        index: assembleRhChain4663Index(),
        cloneRadar: assembleRhChainCloneRadar(reviewQueue.items),
        // Reading the automation snapshot is intentional: a failed snapshot read
        // sends this convenience surface to its manual fallback. The public card
        // remains derived from existing reviewed/manual desk memory.
        memePulse: assembleRhChainMemePulseScreen(),
        storage_status: 'available'
      })));
    } catch {
      // This endpoint is a distribution convenience, never a reason to hide the reviewed static record.
      return safeJsonExport(buildRhChainApiResponse(assembleRhChainTodayOn4663({
        data_mode: 'manual_fallback',
        freshness_state: 'source_required',
        storage_status: 'unavailable'
      })));
    }
  });
  app.get('/v1/rh-chain/daily-receipts', async () => safeJsonExport(buildRhChainApiResponse(await rhChainDailyReceiptDrafts.publicFeed())));
  app.get<{ Params: { receipt_id: string } }>('/v1/rh-chain/daily-receipts/:receipt_id', async (req, reply) => {
    const receipt = await rhChainDailyReceiptDrafts.publicReceipt(req.params.receipt_id);
    if (!receipt) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_daily_receipt_not_found'));
    return safeJsonExport(buildRhChainApiResponse(receipt));
  });
  app.get('/v1/rh-chain/meme-pulse', async () => {
    const snapshot = await rhChainMemePulse.getLatest();
    return safeJsonExport(buildRhChainApiResponse(snapshot?.pulse ?? assembleRhChainMemePulseScreen(await rhChainLiveSnapshots.getLiveSnapshot())));
  });
  app.get('/v1/rh-chain/launch-surfaces', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChainLaunchSurfaces())));
  app.get('/v1/rh-chain/launchpad-observatory', async () => safeJsonExport(buildRhChainApiResponse((await rhChainLaunchpad.getLatest())?.observatory ?? assembleRhChainLaunchpadObservatory())));
  app.post('/v1/rh-chain/scout/query', async (req, reply) => {
    const rate = rhChainPublicRateLimiter.consume(`scout:${req.ip}`);
    if (!rate.allowed) return reply.header('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000))).code(429).send(buildRhChainApiErrorResponse('rh_chain_public_rate_limit_exceeded'));
    const parsed = RhChainScoutQuerySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(buildRhChainApiErrorResponse('invalid_request', { issues: parsed.error.issues }));
    const submissions = await rhChainSubmissionStore.list();
    return safeJsonExport(buildRhChainApiResponse(queryRhChainScout(parsed.data, assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem)).items, (await rhChainLaunchpad.getLatest())?.observatory)));
  });
  app.get('/v1/rh-chain/live-snapshot', async () => {
    const snapshot = await rhChainLiveSnapshots.getLiveSnapshot();
    return safeJsonExport(buildRhChainApiResponse({ ...snapshot, data_mode: snapshot.live_snapshots_enabled && snapshot.cache_status === 'fresh' ? 'live_cached' as const : snapshot.live_snapshots_enabled ? 'unavailable' as const : 'seeded' as const }));
  });
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/live-snapshot/token/:contract', async (req) => {
    const startedAtMs = Date.now();
    const budgets = liveTokenRouteBudgets(options.rhChainLiveTokenRouteTimeoutMs ?? config.rhChainLiveTokenRouteTimeoutMs, config.rhChainProviderTimeoutMs);
    const deadline = createRequestDeadline(budgets.totalMs);
    try {
      const [snapshotOutcome, submissionsOutcome, snapshotHistoryOutcome, onchainOutcome] = await Promise.all([
        runWithinDeadline(deadline, budgets.totalMs - 1, () => rhChainLiveSnapshots.getTokenSnapshot(req.params.contract, { deadline, providerTimeoutMs: budgets.providerMs, cacheLookupTimeoutMs: budgets.cacheReadMs })),
        runWithinDeadline(deadline, budgets.contextReadMs, () => rhChainSubmissionStore.list({ timeoutMs: budgets.contextReadMs })),
        runWithinDeadline(deadline, budgets.contextReadMs, () => rhChainMarketSnapshots.listSnapshots(req.params.contract, { timeoutMs: budgets.contextReadMs })),
        runWithinDeadline(deadline, budgets.providerMs, (signal) => rhChainTokenRegistry.enrichToken(req.params.contract, { signal }))
      ]);
      const snapshot = snapshotOutcome.ok ? snapshotOutcome.value : rhChainLiveSnapshots.unavailableTokenSnapshot(req.params.contract);
      const submissions = submissionsOutcome.ok ? submissionsOutcome.value : [];
      const snapshotHistory = snapshotHistoryOutcome.ok ? snapshotHistoryOutcome.value : [];
      const onchain = onchainOutcome.ok ? onchainOutcome.value : { token: null };
      const reviewItems = assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem)).items;
      const contextWarnings = [
        !submissionsOutcome.ok && 'Reviewed submission context exceeded its bounded read budget.',
        !snapshotHistoryOutcome.ok && 'Market Memory context exceeded its bounded read budget.',
        !onchainOutcome.ok && 'Blockscout token enrichment exceeded its bounded provider budget.'
      ].filter((value): value is string => Boolean(value));
      const snapshotWarnings = 'warnings' in snapshot && Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
      const responseStatus = contextWarnings.length
        ? ('token_pair' in snapshot && (snapshot.token_pair || snapshot.explorer) ? 'partial' : 'unavailable')
        : ('response_status' in snapshot ? snapshot.response_status : snapshot.cache_status === 'unavailable' ? 'unavailable' : 'complete');
      const providerTimeoutCount = snapshot.provider_statuses.filter((provider) => provider.error?.code === 'provider_timeout').length + (onchainOutcome.ok ? 0 : 1);
      const deadlineExhausted = deadline.signal.aborted || [snapshotOutcome, submissionsOutcome, snapshotHistoryOutcome, onchainOutcome].some((outcome) => !outcome.ok && outcome.reason === 'timeout');
      console.log(JSON.stringify({
        event: 'rh_chain_live_token_route', route: '/v1/rh-chain/live-snapshot/token/:contract', duration_ms: Date.now() - startedAtMs,
        route_budget_ms: budgets.totalMs, provider_budget_ms: budgets.providerMs, response_status: responseStatus,
        cache_status: snapshot.cache_status, stale_cache_used: snapshot.cache_status === 'stale', partial_response: responseStatus === 'partial',
        provider_timeout_count: providerTimeoutCount, deadline_exhausted: deadlineExhausted,
        operations: {
          live_snapshot: { outcome: snapshotOutcome.ok ? 'completed' : snapshotOutcome.reason, duration_ms: snapshotOutcome.durationMs },
          reviewed_context: { outcome: submissionsOutcome.ok ? 'completed' : submissionsOutcome.reason, duration_ms: submissionsOutcome.durationMs },
          market_memory: { outcome: snapshotHistoryOutcome.ok ? 'completed' : snapshotHistoryOutcome.reason, duration_ms: snapshotHistoryOutcome.durationMs },
          blockscout_enrichment: { outcome: onchainOutcome.ok ? 'completed' : onchainOutcome.reason, duration_ms: onchainOutcome.durationMs }
        }
      }));
      return safeJsonExport(buildRhChainApiResponse({
        ...snapshot,
        response_status: responseStatus,
        warnings: [...snapshotWarnings, ...contextWarnings],
        deadline_exhausted: deadlineExhausted,
        resolved_context: resolveRhChainContractIntelligence(req.params.contract, { reviewItems, snapshotHistory, dexscreener: snapshot.token_pair, blockscout: snapshot.explorer, blockscoutToken: onchain.token }),
        data_mode: snapshot.live_snapshots_enabled && snapshot.cache_status === 'fresh' ? 'live_cached' as const : snapshot.live_snapshots_enabled ? 'unavailable' as const : 'seeded' as const
      }));
    } finally {
      deadline.abort('route_response_complete');
      deadline.dispose();
    }
  });
  app.get('/v1/rh-chain/market/provider-status', async () => safeJsonExport(buildRhChainApiResponse(await rhChainMarketData.getProviderStatus())));
  app.get('/v1/rh-chain/onchain/provider-status', async () => safeJsonExport(buildRhChainApiResponse(await rhChainTokenRegistry.getProviderStatus())));
  app.get<{ Querystring: { type?: string; page_size?: string } }>('/v1/rh-chain/onchain/tokens', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainTokenRegistry.listObservedTokens({ type: req.query.type, pageSize: req.query.page_size ? Number(req.query.page_size) : undefined }))));
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/onchain/tokens/:contract', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainTokenRegistry.enrichToken(req.params.contract))));
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/onchain/tokens/:contract/transfers', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainTokenRegistry.getTokenTransfers(req.params.contract))));
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/onchain/tokens/:contract/holders', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainTokenRegistry.getTokenHolders(req.params.contract))));
  app.get('/v1/rh-chain/onchain/watchlist-diff', async () => safeJsonExport(buildRhChainApiResponse({ dex_screener: await rhChainTokenRegistry.compareWithDexScreenerWatchlist(), market_structure: await rhChainTokenRegistry.compareWithMarketStructureRegistry(), caveats: ['Snapshot history uses Blockscout only for exact-contract watchlist seeding and onchain evidence. Market data remains DEX Screener.'] })));
  app.get<{ Querystring: { contracts?: string } }>('/v1/rh-chain/market/tokens', async (req, reply) => {
    const contracts = req.query.contracts?.split(',').map((contract) => contract.trim()).filter(Boolean);
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainMarketData.getTokens(contracts))); }
    catch (error) { return reply.code(error instanceof Error && error.message === 'rh_chain_market_contract_limit_exceeded' ? 400 : 503).send(buildRhChainApiErrorResponse(error instanceof Error && error.message === 'rh_chain_market_contract_limit_exceeded' ? error.message : 'rh_chain_market_request_failed')); }
  });
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/market/tokens/:contract', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainMarketData.getToken(req.params.contract))));
  app.get('/v1/rh-chain/market/boosts', async () => safeJsonExport(buildRhChainApiResponse(await rhChainMarketData.getBoosts())));
  app.get<{ Querystring: { contract?: string } }>('/v1/rh-chain/market/attention', async (req) => {
    if (!req.query.contract) return safeJsonExport(buildRhChainApiResponse({ attention: null, caveats: ['An exact contract is required. Tickers are never used for identity.'] }));
    if (config.rhChainAttentionQualityV2Enabled) {
      return safeJsonExport(buildRhChainApiResponse({ token: { contract: req.query.contract }, attention: null, attention_quality: await rhChainAttentionQuality.assess(req.query.contract), caveats: ['Attention Quality uses persisted snapshot memory only. No provider request occurs in this public path.'] }));
    }
    return safeJsonExport(buildRhChainApiResponse({ token: { contract: req.query.contract }, attention: await rhChainMarketData.getAttention(req.query.contract), caveats: ['Attention is provider context only and cannot change reviewed classification.'] }));
  });
  app.post('/v1/rh-chain/market/snapshots/capture', async (req, reply) => {
    if (!rhChainMarketCaptureEnabled) return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_snapshot_capture_disabled'));
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send(buildRhChainApiErrorResponse('admin_token_required'));
    return safeJsonExport(buildRhChainApiResponse(await rhChainMarketSnapshots.captureKnownWatchlistSnapshot()));
  });
  app.get<{ Params: { contract: string }; Querystring: { window?: string } }>('/v1/rh-chain/market/snapshots/:contract', async (req) => {
    const snapshots = req.query.window ? await rhChainMarketSnapshots.getSnapshotWindow(req.params.contract, req.query.window) : await rhChainMarketSnapshots.listSnapshots(req.params.contract);
    return safeJsonExport(buildRhChainApiResponse({ token: { contract: req.params.contract }, snapshots, latest_snapshot: snapshots.at(-1) ?? null, snapshot_count: snapshots.length, caveats: ['Snapshots are low-frequency provider observations and do not change reviewed classification, receipts, or approved-signal status.'] }));
  });
  app.get<{ Params: { contract: string }; Querystring: { window?: RhChainAttentionWindow } }>('/v1/rh-chain/market/attention-quality/:contract', async (req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_attention_quality_v2')) return;
    if (!config.rhChainAttentionQualityV2Enabled) return safeJsonExport(buildRhChainApiResponse(await rhChainMarketSnapshots.summarizeAttentionHistory(req.params.contract)));
    const window = req.query.window === '24h' || req.query.window === '30d' ? req.query.window : '7d';
    return safeJsonExport(buildRhChainApiResponse(await rhChainAttentionQuality.assess(req.params.contract, window)));
  });
  app.get('/v1/rh-chain/market', async () => safeJsonExport(buildRhChainApiResponse(await rhChainMarketStructure.marketPulse())));
  app.get('/v1/rh-chain/market-structure', async () => safeJsonExport(buildRhChainApiResponse(await rhChainMarketStructure.marketStructure())));
  app.get('/v1/rh-chain/market-structure/cross-layer', async () => safeJsonExport(buildRhChainApiResponse(await rhChainMarketStructure.crossLayer())));
  app.get('/v1/rh-chain/market-structure/attention-quality', async (_req, reply) => {
    if (optionalFeatureUnavailable(reply, 'rh_chain_attention_quality_v2')) return;
    if (!config.rhChainAttentionQualityV2Enabled) return safeJsonExport(buildRhChainApiResponse(await rhChainMarketStructure.attentionQuality()));
    const contracts = rhChainReviewedLayerClassifications.map((item) => item.contract).slice(0, 100);
    const attention_quality = await Promise.all(contracts.map((contract) => rhChainAttentionQuality.assess(contract)));
    return safeJsonExport(buildRhChainApiResponse({ title: 'Attention Quality', observations: [], attention_quality, contract_intelligence: attention_quality.map((item) => ({ contract: item.contract, source: item.classification_provenance, display_name: item.reviewed_project_identity, review_status: item.classification_provenance === 'unknown' ? 'not_reviewed' : 'reviewed', claim_status: 'not_assessed' })), observed_at: new Date().toISOString(), data_mode: 'persisted_memory', provider_requests_in_path: 0, methodology_version: 'rh_chain_attention_quality_v2', caveats: ['Paid attention is provider-derived context captured in persisted snapshots. It never establishes identity, approval, organic demand, agent activity, or legitimacy.'] }));
  });
  app.get<{ Params: { receipt_id: string } }>('/v1/rh-chain/attention-quality/receipts/:receipt_id', async (req, reply) => {
    if (!config.rhChainAttentionQualityV2Enabled) return reply.code(404).send(buildRhChainApiErrorResponse('not_found'));
    const receipt = await rhChainAttentionQuality.publicReceipt(req.params.receipt_id);
    if (!receipt) return reply.code(404).send(buildRhChainApiErrorResponse('rh_chain_attention_quality_receipt_not_found'));
    return safeJsonExport(buildRhChainApiResponse(receipt));
  });
  app.get('/v1/rh-chain/discovery-queue', async () => safeJsonExport(buildRhChainApiResponse(await rhChainDiscoveryQueue!.refresh())));
  app.post('/v1/rh-chain/discovery-queue/refresh', async () => safeJsonExport(buildRhChainApiResponse(await rhChainDiscoveryQueue!.refresh())));
  app.post<{ Params: { contract: string }; Body: { target?: 'market_structure' | '100_receipts' } }>('/v1/rh-chain/discovery-queue/:contract/promote', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: rhChainDiscoveryQueue!.promote(req.params.contract, req.body?.target === '100_receipts' ? '100_receipts' : 'market_structure') })); }
    catch (error) { return reply.code(404).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'discovery_contract_not_found')); }
  });
  app.post<{ Params: { contract: string } }>('/v1/rh-chain/discovery-queue/:contract/ignore', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: rhChainDiscoveryQueue!.ignore(req.params.contract) })); }
    catch (error) { return reply.code(404).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'discovery_contract_not_found')); }
  });
  app.post<{ Params: { contract: string } }>('/v1/rh-chain/discovery-queue/:contract/watch', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: rhChainDiscoveryQueue!.watch(req.params.contract) })); }
    catch (error) { return reply.code(404).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'discovery_contract_not_found')); }
  });
  type ReviewPipelineBody = { reviewer_note?: string; missing_evidence?: string[]; caveats?: string[]; market_structure_layer?: RhChainReviewClassification; secondary_tags?: RhChainReviewSecondaryTag[]; day?: string; outcome_check_at?: string };
  const reviewPipelineError = (reply: FastifyReply, error: unknown) => reply.code(error instanceof Error && error.message === 'exact_contract_required' ? 400 : 404).send(buildRhChainApiErrorResponse(error instanceof Error ? error.message : 'review_pipeline_action_failed'));
  app.get<{ Querystring: { day?: string } }>('/v1/rh-chain/review-pipeline', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainReviewPipeline.pipeline(req.query.day))));
  app.post<{ Body: { day?: string } }>('/v1/rh-chain/review-pipeline/start-daily-review', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainReviewPipeline.startDailyReview(req.body?.day))));
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/classify', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.classify(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/promote-to-market-structure', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.promoteToMarketStructure(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/promote-to-100-receipts', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.promoteTo100Receipts(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/add-to-daily-draft', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse(await rhChainReviewPipeline.addToDailyDraft(req.params.contract, req.body ?? {}))); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/set-outcome-check', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.setOutcomeCheck(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/watch', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.watch(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/source-required', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.sourceRequired(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.post<{ Params: { contract: string }; Body: ReviewPipelineBody }>('/v1/rh-chain/review-pipeline/:contract/ignore-duplicate', async (req, reply) => {
    try { return safeJsonExport(buildRhChainApiResponse({ item: await rhChainReviewPipeline.ignoreDuplicate(req.params.contract, req.body ?? {}) })); } catch (error) { return reviewPipelineError(reply, error); }
  });
  app.get<{ Querystring: { day?: string } }>('/v1/rh-chain/review-pipeline/daily-summary', async (req) => safeJsonExport(buildRhChainApiResponse(await rhChainReviewPipeline.dailySummary(req.query.day))));
  app.get<{ Params: { contract: string } }>('/v1/rh-chain/tokens/:contract/dossier', async (req) => {
    const startedAtMs = Date.now();
    const budgets = liveTokenRouteBudgets(options.rhChainLiveTokenRouteTimeoutMs ?? config.rhChainLiveTokenRouteTimeoutMs, config.rhChainProviderTimeoutMs);
    const deadline = createRequestDeadline(budgets.totalMs);
    try {
      const [submissions, tokenSnapshotOutcome, liveSnapshot, sweep, snapshotHistory, onchainOutcome] = await Promise.all([
        rhChainSubmissionStore.list(),
        runWithinDeadline(deadline, budgets.totalMs - 1, () => rhChainLiveSnapshots.getTokenSnapshot(req.params.contract, { deadline, providerTimeoutMs: budgets.providerMs, cacheLookupTimeoutMs: budgets.cacheReadMs })),
        rhChainLiveSnapshots.getLiveSnapshot(),
        rhChainRiskCorrelationSweep.getLatest(),
        rhChainMarketSnapshots.listSnapshots(req.params.contract),
        runWithinDeadline(deadline, budgets.providerMs, (signal) => rhChainTokenRegistry.enrichToken(req.params.contract, { signal }))
      ]);
      const tokenSnapshot = tokenSnapshotOutcome.ok ? tokenSnapshotOutcome.value : rhChainLiveSnapshots.unavailableTokenSnapshot(req.params.contract);
      const onchain = onchainOutcome.ok ? onchainOutcome.value : { token: null };
      const warnings = [
        !tokenSnapshotOutcome.ok && 'Live token context exceeded its bounded provider budget.',
        !onchainOutcome.ok && 'Blockscout token enrichment exceeded its bounded provider budget.'
      ].filter((value): value is string => Boolean(value));
      const reviewItems = assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem)).items;
      const resolution = resolveRhChainContractIntelligence(req.params.contract, { reviewItems, snapshotHistory, dexscreener: tokenSnapshot.token_pair, blockscout: tokenSnapshot.explorer, blockscoutToken: onchain.token });
      const dossier = assembleRhChainTokenDossier(req.params.contract, submissions, tokenSnapshot, liveSnapshot, resolution);
      const related_suspected_correlations = sweep?.suspected_correlations.filter((correlation) => correlation.related_records.some((record) => record.token_contract.toLowerCase() === req.params.contract.toLowerCase())).map(({ correlation_id, correlation_type, evidence_summary, confidence_level, review_status, observed_at }) => ({ correlation_id, correlation_type, evidence_summary, confidence_level, review_status, observed_at }));
      console.log(JSON.stringify({
        event: 'rh_chain_token_dossier_route', route: '/v1/rh-chain/tokens/:contract/dossier', duration_ms: Date.now() - startedAtMs,
        route_budget_ms: budgets.totalMs, provider_budget_ms: budgets.providerMs, response_status: warnings.length ? 'partial' : 'complete',
        provider_timeout_count: [tokenSnapshotOutcome, onchainOutcome].filter((outcome) => !outcome.ok && outcome.reason === 'timeout').length,
        deadline_exhausted: deadline.signal.aborted,
        operations: {
          live_token_context: { outcome: tokenSnapshotOutcome.ok ? 'completed' : tokenSnapshotOutcome.reason, duration_ms: tokenSnapshotOutcome.durationMs },
          blockscout_enrichment: { outcome: onchainOutcome.ok ? 'completed' : onchainOutcome.reason, duration_ms: onchainOutcome.durationMs }
        }
      }));
      return safeJsonExport(buildRhChainApiResponse({
        ...dossier,
        ...(warnings.length ? { response_status: 'partial' as const, warnings } : {}),
        ...(related_suspected_correlations?.length ? { related_suspected_correlations } : {})
      }));
    } finally {
      deadline.abort('route_response_complete');
      deadline.dispose();
    }
  });
  app.get('/v1/rh-chain/review-queue', async () => {
    const submissions = await rhChainSubmissionStore.list();
    return safeJsonExport(buildRhChainApiResponse(assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem))));
  });
  app.get('/v1/rh-chain/clone-radar', async () => {
    const submissions = await rhChainSubmissionStore.list();
    const sweep = await rhChainRiskCorrelationSweep.getLatest();
    const radar = sweep?.radar ?? assembleRhChainCloneRadar(assembleRhChainReviewQueue(submissions.map(asRhChainPersistedReviewItem)).items);
    return safeJsonExport(buildRhChainApiResponse({ ...radar, ...(sweep ? { correlation_sweep: { observed_at: sweep.observed_at, freshness_state: sweep.freshness_state, correlation_count: sweep.suspected_correlations.length } } : {}) }));
  });
  app.get('/v1/rh-chain/scouts', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChainScouts(await rhChainSubmissionStore.list()))));
  app.get('/v1/rh-chain/distribution-pack', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChainDistributionPack((await rhChainDailyReceiptDrafts.publicFeed()).latest_receipt))));
  app.get('/v1/rh-chain/receipt-relay', async () => safeJsonExport(buildRhChainApiResponse(assembleRhChainReceiptRelay((await rhChainDailyReceiptDrafts.publicFeed()).latest_receipt))));
  app.get('/v1/rh-chain/signals/submissions', async () => {
    const submissions = await rhChainSubmissionStore.list();
    return safeJsonExport(buildRhChainApiResponse({
      generated_at: submissions[0]?.updated_at ?? new Date().toISOString(),
      data_mode: rhChainSubmissionStore.durable ? 'persisted' as const : 'community_submission' as const,
      source_policy: 'Persisted community submissions only. Submission is not endorsement; review is not financial advice; inclusion is not safety.',
      storage: { adapter: rhChainSubmissionStore.adapter, durable: rhChainSubmissionStore.durable },
      submissions: submissions.map(publicRhChainSubmission)
    }));
  });
  app.post('/v1/rh-chain/signals/submit', async (req, reply) => {
    const rate = rhChainPublicRateLimiter.consume(`submit:${req.ip}`);
    if (!rate.allowed) return reply.header('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000))).code(429).send(buildRhChainApiErrorResponse('rh_chain_public_rate_limit_exceeded'));
    const parsed = RhChainSignalSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(buildRhChainApiErrorResponse('invalid_request', { issues: parsed.error.issues }));
    try {
      const now = new Date();
      const normalizedContract = normalizeRhChainDuplicateField(parsed.data.token_contract);
      const normalizedChain = normalizeRhChainDuplicateField(parsed.data.chain ?? 'Robinhood Chain');
      const existing = (await rhChainSubmissionStore.list()).find((item) =>
        normalizeRhChainDuplicateField(item.token_contract) === normalizedContract
        && normalizeRhChainDuplicateField(item.chain) === normalizedChain
        && now.getTime() - Date.parse(item.submitted_at) <= config.rhChainDuplicateWindowMs
      );
      if (existing) return reply.code(200).send(safeJsonExport(buildRhChainApiResponse({
        data_mode: existing.data_mode, duplicate_detected: true, duplicate_of: existing.submission_id, existing_submission_id: existing.submission_id,
        submission: publicRhChainSubmission(existing), storage: { adapter: rhChainSubmissionStore.adapter, durable: rhChainSubmissionStore.durable }
      })));
      const submission = await rhChainSubmissionStore.save(createRhChainSignalSubmission(parsed.data, now.toISOString(), rhChainSubmissionStore.durable ? 'persisted' : 'community_submission'));
      return safeJsonExport(buildRhChainApiResponse({
        data_mode: submission.data_mode,
        review_packet: createRhChainSignalReviewPacket(parsed.data, submission.submitted_at),
        submission: publicRhChainSubmission(submission),
        storage: { adapter: rhChainSubmissionStore.adapter, durable: rhChainSubmissionStore.durable }
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'rh_chain_submission_storage_not_configured') {
        return reply.code(503).send(buildRhChainApiErrorResponse('rh_chain_submission_storage_not_configured', { message: 'Signal Vault requires DATABASE_URL for durable production persistence.' }));
      }
      throw error;
    }
  });
  app.get('/v1/rh-chain/receipts', async () => safeJsonExport(buildRhChainApiResponse({
    generated_at: getRhChainPayload().generated_at,
    receipts: assembleRhChainReceipts()
  })));
  app.get('/v1/hermes', async () => ({ data: safeJsonExport(getHermesDeskSummary()) }));
  app.get('/v1/hermes/skill-pack', async () => ({ data: safeJsonExport(getHermesSkillPack()) }));
  app.get('/v1/hermes/spend-policy', async () => ({
    data: safeJsonExport({
      generated_at: getDefaultHermesSpendPolicy().created_at,
      count: listHermesSpendPolicies().length,
      policies: listHermesSpendPolicies(),
      rules: listHermesSpendPolicyRules()
    })
  }));
  app.get('/v1/hermes/spend-policy/example', async () => ({
    data: safeJsonExport(createHermesSpendPolicyExample())
  }));
  app.post('/v1/hermes/spend-policy/check', async (req, reply) => handleParsed(req.body, HermesSpendPolicyCheckInputSchema, (input) => ({
    data: safeJsonExport(checkHermesSpendPolicy(input))
  }), reply));
  app.get<{ Params: { check_id: string } }>('/v1/hermes/spend-policy/check/:check_id/reconciliation-preview', async (req, reply) => {
    const check = resolveHermesSpendPolicyCheckById(req.params.check_id);
    if (!check) {
      return reply.code(404).send({
        error: 'hermes_spend_policy_check_not_found',
        message: `No deterministic Hermes spend policy check found for check_id=${req.params.check_id}`
      });
    }
    return { data: safeJsonExport(previewHermesPolicyReconciliation(check)) };
  });
  app.get<{ Params: Record<string, string> }>('/v1/hermes/spend-policy/check/*', async (req, reply) => {
    const wildcard = typeof req.params['*'] === 'string' ? req.params['*'] : '';
    const match = wildcard.trim().match(/^([^/]+)\/(receipt-preview|reconciliation-preview)$/);
    const checkId = match?.[1];
    const action = match?.[2];
    if (!checkId) {
      return reply.code(404).send({
        error: 'hermes_spend_policy_check_not_found',
        message: `No Hermes spend policy receipt preview action found for path=${req.url}`
      });
    }
    const check = resolveHermesSpendPolicyCheckById(checkId);
    if (!check) {
      return reply.code(404).send({
        error: 'hermes_spend_policy_check_not_found',
        message: `No deterministic Hermes spend policy check found for check_id=${checkId}`
      });
    }
    if (action === 'reconciliation-preview') {
      return { data: safeJsonExport(previewHermesPolicyReconciliation(check)) };
    }
    return { data: safeJsonExport(createHermesPolicyDecisionReceipt(check)) };
  });
  app.post<{ Params: { check_id: string } }>('/v1/hermes/spend-policy/check/:check_id/outcome', async (req, reply) => handleParsed(
    req.body,
    HermesPolicyOutcomeRequestSchema,
    (input) => {
      const check = resolveHermesSpendPolicyCheckById(req.params.check_id);
      if (!check) {
        reply.code(404);
        return {
          error: 'hermes_spend_policy_check_not_found',
          message: `No deterministic Hermes spend policy check found for check_id=${req.params.check_id}`
        };
      }
      return { data: safeJsonExport(reconcileHermesPolicyOutcome(check, input as Partial<HermesPolicyOutcome>)) };
    },
    reply
  ));
  app.post<{ Params: Record<string, string> }>('/v1/hermes/spend-policy/check/*', async (req, reply) => {
    const wildcard = typeof req.params['*'] === 'string' ? req.params['*'] : '';
    const match = wildcard.trim().match(/^([^/]+)\/(receipt|outcome)$/);
    const checkId = match?.[1];
    const action = match?.[2];
    if (!checkId) {
      return reply.code(404).send({
        error: 'hermes_spend_policy_check_not_found',
        message: `No Hermes spend policy receipt action found for path=${req.url}`
      });
    }
    const check = resolveHermesSpendPolicyCheckById(checkId);
    if (!check) {
      return reply.code(404).send({
        error: 'hermes_spend_policy_check_not_found',
        message: `No deterministic Hermes spend policy check found for check_id=${checkId}`
      });
    }
    if (action === 'outcome') {
      return handleParsed(req.body, HermesPolicyOutcomeRequestSchema, (input) => ({
        data: safeJsonExport(reconcileHermesPolicyOutcome(check, input as Partial<HermesPolicyOutcome>))
      }), reply);
    }
    return { data: safeJsonExport(createHermesPolicyDecisionReceipt(check)) };
  });
  app.get('/v1/hermes/memory-loop', async () => ({ data: safeJsonExport(buildHermesMemoryLoopSummary()) }));
  app.get<{ Params: { loop_id: string } }>('/v1/hermes/memory-loop/:loop_id', async (req, reply) => {
    const loop = buildHermesMemoryLoopSummary().loops.find((item) => item.id === req.params.loop_id);
    if (!loop) {
      return reply.code(404).send({
        error: 'hermes_memory_loop_not_found',
        message: `No Hermes memory loop found for loop_id=${req.params.loop_id}`
      });
    }
    return { data: safeJsonExport(loop) };
  });
  app.get('/v1/hermes/wallet-audit-trail', async () => ({ data: safeJsonExport(buildHermesWalletAuditTrailSummary()) }));
  app.get<{ Params: Record<string, string> }>('/v1/hermes/wallet-audit-trail/*', async (req, reply) => {
    const trailId = typeof req.params['*'] === 'string' ? req.params['*'].trim() : '';
    const trail = resolveHermesWalletAuditTrailById(trailId);
    if (!trail) {
      return reply.code(404).send({
        error: 'hermes_wallet_audit_trail_not_found',
        message: `No Hermes wallet audit trail found for trail_id=${trailId || 'unknown'}`
      });
    }
    return { data: safeJsonExport(trail) };
  });
  app.get('/v1/hermes/wallet-risk-score', async () => ({ data: safeJsonExport(buildHermesWalletRiskScoreSummary()) }));
  app.get<{ Params: Record<string, string> }>('/v1/hermes/wallet-risk-score/*', async (req, reply) => {
    const scoreId = typeof req.params['*'] === 'string' ? req.params['*'].trim() : '';
    const score = resolveHermesWalletRiskScoreById(scoreId);
    if (!score) {
      return reply.code(404).send({
        error: 'hermes_wallet_risk_score_not_found',
        message: `No Hermes wallet risk score found for score_id=${scoreId || 'unknown'}`
      });
    }
    return { data: safeJsonExport(score) };
  });
  app.post('/v1/hermes/wallet-safety/check', async (req, reply) => handleParsed(req.body, HermesWalletSafetyCheckInputSchema, (input) => ({
    data: safeJsonExport(createHermesWalletSafetyCheck(input))
  }), reply));
  app.get('/v1/hermes/wallet-safety/example', async () => ({
    data: safeJsonExport(getHermesWalletSafetyExampleCheck())
  }));
  app.get('/v1/hermes/wallet-safety/integrations', async () => ({
    data: safeJsonExport(buildWalletSafetyIntegrationRegistry())
  }));
  app.get<{ Params: { integration_id: string } }>('/v1/hermes/wallet-safety/integrations/:integration_id/readiness', async (req, reply) => {
    const report = buildWalletSafetyIntegrationReadinessReport(req.params.integration_id);
    if (!report) {
      return reply.code(404).send({
        error: 'wallet_safety_integration_not_found',
        message: `No Wallet Safety integration readiness report found for integration_id=${req.params.integration_id || 'unknown'}`
      });
    }
    return { data: safeJsonExport(report) };
  });
  app.get<{ Params: { integration_id: string } }>('/v1/hermes/wallet-safety/integrations/:integration_id', async (req, reply) => {
    const integration = getWalletSafetyIntegrationById(req.params.integration_id);
    if (!integration) {
      return reply.code(404).send({
        error: 'wallet_safety_integration_not_found',
        message: `No Wallet Safety integration registry entry found for integration_id=${req.params.integration_id || 'unknown'}`
      });
    }
    return { data: safeJsonExport(integration) };
  });
  app.get('/v1/hermes/skill-pack/skills', async () => ({
    data: safeJsonExport({
      generated_at: '2026-07-03T00:00:00.000Z',
      source: 'infopunks-pay-sh-radar',
      module: 'hermes-skill-pack',
      count: listHermesSkillPackSkills().length,
      skills: listHermesSkillPackSkills()
    })
  }));
  app.get<{ Params: { skill_id: string } }>('/v1/hermes/skill-pack/skills/:skill_id', async (req, reply) => {
    const skill = getHermesSkillById(req.params.skill_id);
    if (!skill) return reply.code(404).send({ error: 'hermes_skill_not_found' });
    return { data: safeJsonExport(skill) };
  });
  app.get('/v1/hermes/reputation-ledger', async () => ({ data: safeJsonExport(buildHermesReputationLedger()) }));
  app.get('/v1/hermes/reputation-ledger/providers', async () => ({
    data: safeJsonExport({
      generated_at: buildHermesReputationLedger().generated_at,
      count: listHermesProviderReputationEntries().length,
      entries: listHermesProviderReputationEntries()
    })
  }));
  app.get('/v1/hermes/reputation-ledger/routes', async () => ({
    data: safeJsonExport({
      generated_at: buildHermesReputationLedger().generated_at,
      count: listHermesRouteReputationEntries().length,
      entries: listHermesRouteReputationEntries()
    })
  }));
  app.get('/v1/hermes/reputation-ledger/services', async () => ({
    data: safeJsonExport({
      generated_at: buildHermesReputationLedger().generated_at,
      count: listHermesServiceReputationEntries().length,
      entries: listHermesServiceReputationEntries()
    })
  }));
  app.post<{ Params: Record<string, string> }>('/v1/hermes/pre-spend-decision/*', async (req, reply) => {
    const wildcard = typeof req.params['*'] === 'string' ? req.params['*'] : '';
    const suffix = wildcard.trim();
    const receiptMatch = suffix.match(/^([^/]+)\/receipt$/);
    const outcomeMatch = suffix.match(/^([^/]+)\/outcome$/);
    const decisionId = receiptMatch?.[1] ?? outcomeMatch?.[1];

    if (!decisionId) {
      return reply.code(404).send({
        error: 'hermes_pre_spend_decision_not_found',
        message: `No Hermes pre-spend decision action found for path=${req.url}`
      });
    }

    const decision = resolveHermesPreSpendDecisionById(decisionId);
    if (!decision) {
      return reply.code(404).send({
        error: 'hermes_pre_spend_decision_not_found',
        message: `No Hermes pre-spend decision found for decision_id=${decisionId}`
      });
    }

    if (receiptMatch) {
      return { data: safeJsonExport(createHermesDecisionReceipt(decision)) };
    }

    return handleParsed(req.body, HermesDecisionOutcomeRequestSchema, (input) => ({
      data: safeJsonExport(recordHermesDecisionOutcome(decision, input))
    }), reply);
  });
  app.post('/v1/hermes/pre-spend-decision', async (req, reply) => handleParsed(req.body, HermesPreSpendDecisionInputSchema, (input) => ({
    data: safeJsonExport(createHermesPreSpendDecision(input))
  }), reply));
  app.get('/v1/hermes/pre-spend-decision/example', async () => ({
    data: safeJsonExport(createHermesPreSpendDecisionExample())
  }));
  app.get<{ Params: { target_type: string; target_id: string } }>('/v1/hermes/reputation-ledger/:target_type/:target_id', async (req, reply) => {
    const entry = getHermesReputationEntry(req.params.target_type, req.params.target_id);
    if (!entry) {
      return reply.code(404).send({
        error: 'hermes_reputation_entry_not_found',
        message: `No Hermes reputation ledger entry found for target_type=${req.params.target_type} target_id=${req.params.target_id}`
      });
    }
    return { data: safeJsonExport(entry) };
  });
  app.get('/v1/hermes/runs', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'hermes-desk',
      count: listHermesRuns().length,
      runs: listHermesRuns()
    })
  }));
  app.get<{ Params: { run_id: string } }>('/v1/hermes/runs/:run_id', async (req, reply) => {
    const run = getHermesRunById(req.params.run_id);
    if (!run) return reply.code(404).send({ error: 'hermes_run_not_found' });
    return { data: safeJsonExport(run) };
  });
  app.post<{ Params: { run_id: string } }>('/v1/hermes/runs/:run_id/receipt', async (req, reply) => {
    const run = getHermesRunById(req.params.run_id);
    if (!run) {
      return reply.code(404).send({
        error: 'hermes_run_not_found',
        message: `No Hermes run found for run_id=${req.params.run_id}`
      });
    }
    return { data: safeJsonExport(convertHermesRunToReceipt(run)) };
  });
  app.get<{ Params: { run_id: string } }>('/v1/hermes/runs/:run_id/receipt-preview', async (req, reply) => {
    const run = getHermesRunById(req.params.run_id);
    if (!run) {
      return reply.code(404).send({
        error: 'hermes_run_not_found',
        message: `No Hermes run found for run_id=${req.params.run_id}`
      });
    }
    return { data: safeJsonExport(convertHermesRunToReceipt(run)) };
  });
  app.post<{ Params: { run_id: string } }>('/v1/hermes/runs/:run_id/claim/promote', async (req, reply) => {
    const run = getHermesRunById(req.params.run_id);
    if (!run) {
      return reply.code(404).send({
        error: 'hermes_run_not_found',
        message: `No Hermes run found for run_id=${req.params.run_id}`
      });
    }
    const parsed = HermesClaimPromotionRequestSchema.safeParse(req.body);
    const requestedState = parsed.success && isHermesClaimReviewState(parsed.data?.review_state)
      ? parsed.data.review_state
      : undefined;
    return { data: safeJsonExport(promoteHermesClaimCandidate(run, requestedState)) };
  });
  app.get<{ Params: { run_id: string } }>('/v1/hermes/runs/:run_id/claim/promotion-preview', async (req, reply) => {
    const run = getHermesRunById(req.params.run_id);
    if (!run) {
      return reply.code(404).send({
        error: 'hermes_run_not_found',
        message: `No Hermes run found for run_id=${req.params.run_id}`
      });
    }
    return { data: safeJsonExport(promoteHermesClaimCandidate(run)) };
  });
  app.post('/v1/hermes/pre-spend-run', async (req, reply) => handleParsed(req.body, HermesPreSpendRunRequestSchema, async (input) => ({
    data: safeJsonExport(await createLivePreSpendRun(input))
  }), reply));
  app.get('/v1/hermes/skills', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'hermes-desk',
      skills: getHermesDeskSummary().skills
    })
  }));
  app.get('/v1/hermes/health', async () => ({ data: safeJsonExport(await checkHermesHealth()) }));
  app.get('/v1/abundance', async () => ({ data: safeJsonExport(getAbundanceDeskPayload()) }));
  app.get('/v1/abundance/claims', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'abundance-desk',
      count: abundanceClaimsFeed.length,
      claims: abundanceClaimsFeed
    })
  }));
  app.get('/v1/abundance/receipts', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      module: 'abundance-desk',
      count: machineWorkReceipts.length,
      receipts: machineWorkReceipts
    })
  }));
  app.get('/v1/attention-market-watch', async () => ({ data: getAttentionMarketWatchIndex() }));
  app.get('/v1/attention-market-watch/intake/requirements', async () => ({ data: getAttentionMarketIntakeRequirements() }));
  app.post('/v1/attention-market-watch/intake', async (req, reply) => handleParsed(req.body, AttentionMarketIntakeRequestSchema, (input) => ({
    data: {
      submission: createAttentionMarketIntakeSubmission(input)
    }
  }), reply));
  app.get<{ Params: { slug: string } }>('/v1/attention-market-watch/:slug', async (req, reply) => {
    const signal = getAttentionMarketSignalBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'attention_market_signal_not_found' });
    return { data: { signal } };
  });
  app.get('/v1/signal-desk', async () => ({ data: getSignalDeskIndex() }));
  app.get('/v1/signal-desk/candidates', async () => {
    const candidates = listCandidateSignals();
    return { data: { count: candidates.length, candidates } };
  });
  app.get<{ Params: { candidateId: string } }>('/v1/signal-desk/candidates/:candidateId', async (req, reply) => {
    const candidate = getCandidateSignal(req.params.candidateId);
    if (!candidate) return reply.code(404).send({ error: 'candidate_signal_not_found' });
    return { data: { candidate } };
  });
  app.get('/v1/signal-hunt', async () => ({
    data: safeJsonExport(SignalHuntSummarySchema.parse({
      generated_at: new Date().toISOString(),
      counts: getSignalHuntCounts(),
      candidates: listSignalHuntCandidates()
    }))
  }));
  app.get<{ Params: { signalId: string } }>('/v1/signal-hunt/:signalId', async (req, reply) => {
    const candidate = getSignalHuntCandidate(req.params.signalId);
    if (!candidate) return reply.code(404).send({ error: 'signal_hunt_not_found' });
    return { data: safeJsonExport(SignalHuntCandidateSchema.parse(candidate)) };
  });
  app.post('/v1/signal-hunt/submit', async (req, reply) => handleParsed(req.body, SignalHuntSubmissionInputSchema, (input) => ({
    data: safeJsonExport(SignalHuntCandidateSchema.parse(createSignalHuntSubmission(input)))
  }), reply));
  app.post<{ Params: { signalId: string } }>('/v1/signal-hunt/:signalId/verify', async (req, reply) => handleParsed(req.body, SignalHuntVerifyInputSchema, (input) => {
    const candidate = verifySignalHuntCandidate(req.params.signalId, input);
    if (!candidate) return reply.code(404).send({ error: 'signal_hunt_not_found' });
    return { data: safeJsonExport(SignalHuntCandidateSchema.parse(candidate)) };
  }, reply));
  app.get('/v1/unicorn-radar', async () => ({
    data: safeJsonExport(UnicornRadarSummarySchema.parse(await buildUnicornRadarSummary()))
  }));
  app.get('/v1/unicorn-radar/candidates', async () => ({
    data: safeJsonExport(UnicornRadarCandidateListSchema.parse(await buildUnicornRadarCandidateList()))
  }));
  app.get<{ Params: { candidateId: string } }>('/v1/unicorn-radar/candidates/:candidateId', async (req, reply) => {
    const candidate = await resolveEnrichedUnicornRadarCandidate(req.params.candidateId);
    if (!candidate) return reply.code(404).send({ error: 'unicorn_radar_candidate_not_found' });
    return { data: safeJsonExport(UnicornRadarCandidateSchema.parse(candidate)) };
  });
  app.post('/v1/unicorn-radar/submit', async (req, reply) => handleParsed(req.body, UnicornRadarSubmissionInputSchema, (input) => ({
    data: safeJsonExport(UnicornRadarSubmissionResponseSchema.parse(createUnicornRadarSubmission(input)))
  }), reply));
  app.post('/v1/unicorn-radar/request-evaluation', async (req, reply) => handleParsed(req.body, UnicornRadarEvaluationRequestInputSchema, (input) => ({
    data: safeJsonExport(UnicornRadarEvaluationRequestResponseSchema.parse(requestUnicornRadarEvaluation(input)))
  }), reply));
  app.post('/v1/evaluation-request', async (req, reply) => {
    try {
      const result = await createEvaluationRequest(req.body, {
        webhookUrl: process.env.EVALUATION_REQUEST_WEBHOOK_URL ?? null
      });
      if (result.status === 'accepted') reply.code(202);
      return {
        data: safeJsonExport(EvaluationRequestResponseSchema.parse(result))
      };
    } catch (error) {
      if (error instanceof EvaluationRequestValidationError) {
        if (error.code === 'DISCLOSURE_REQUIRED') {
          return reply.code(400).send({
            code: error.code,
            message: error.message
          });
        }
        return reply.code(400).send({
          error: 'invalid_request',
          issues: error.issues ?? [{ path: 'body', message: error.message }]
        });
      }
      throw error;
    }
  });
  app.get('/v1/unicorn-radar/revenue-receipts', async () => {
    const receipts = listRevenueReceipts();
    return {
      data: safeJsonExport({
        deprecated: true,
        canonical: '/v1/revenue-receipts',
        message: 'Revenue Receipts now live at the canonical public ledger endpoint.',
        generated_at: UNICORN_RADAR_GENERATED_AT,
        count: receipts.length,
        receipts
      })
    };
  });
  app.get('/v1/revenue-receipts', async () => ({
    data: safeJsonExport(RevenueReceiptSummarySchema.parse(buildRevenueReceiptSummary()))
  }));
  app.get<{ Params: { receiptId: string } }>('/v1/revenue-receipts/:receiptId', async (req, reply) => {
    const receipt = getRevenueReceipt(req.params.receiptId);
    if (!receipt) return reply.code(404).send({ error: 'revenue_receipt_not_found' });
    return { data: safeJsonExport(RevenueReceiptSchema.parse(receipt)) };
  });
  app.get<{ Params: { slug: string } }>('/v1/narratives/:slug', async (req, reply) => {
    const asset = getNarrativeAssetBySlug(req.params.slug);
    if (!asset) return reply.code(404).send({ error: 'narrative_not_found' });
    return { data: asset };
  });
  app.get('/v1/signals', async () => ({ data: listSignalSurfaces() }));
  app.get<{ Params: { slug: string } }>('/v1/signals/:slug', async (req, reply) => {
    const signal = getSignalSurfaceBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'signal_surface_not_found' });
    return { data: signal };
  });
  app.get<{ Params: { slug: string } }>('/v1/signals/:slug/updates', async (req, reply) => {
    const signal = getSignalSurfaceBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'signal_surface_not_found' });

    const updates = listSignalUpdates(req.params.slug);
    const latestUpdate = getLatestSignalUpdate(req.params.slug);

    return {
      data: {
        signal_slug: req.params.slug,
        count: updates.length,
        updates,
        latest_update: latestUpdate,
        summary: getSignalUpdateSummary(req.params.slug)
      }
    };
  });
  app.get<{ Params: { slug: string; updateId: string } }>('/v1/signals/:slug/updates/:updateId', async (req, reply) => {
    const signal = getSignalSurfaceBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'signal_surface_not_found' });

    const update = getSignalUpdate(req.params.slug, req.params.updateId);
    if (!update) return reply.code(404).send({ error: 'signal_update_not_found' });

    return {
      data: {
        signal_slug: req.params.slug,
        update
      }
    };
  });
  app.get('/og/narratives.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderNarrativesOgImage()));
  });
  app.get<{ Params: { printId: string }; Querystring: { format?: string } }>('/og/4663/prints/:printId.png', async (req, reply) => {
    const print = await rh4663PrintRead(req.params.printId);
    if (!print) return reply.code(404).send({ error: '4663_print_not_found' });
    const format = parseRh4663ShareFormat(req.query.format);
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRh4663ShareSvg(print, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get<{ Params: { receiptId: string }; Querystring: { format?: string } }>('/og/4663/pulse/:receiptId.png', async (req, reply) => {
    try {
      const format = parseRh4663ShareFormat(req.query.format); const share = await rh4663Phase2.share(req.params.receiptId);
      reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      return reply.type('image/png').send(renderOgPng(renderRh4663ShareSvg(share, format), format === 'landscape' ? 1200 : 1080));
    } catch (error) {
      console.log(JSON.stringify({ event: 'share_render_failed', service: 'rh_4663_resolution', receipt_id: req.params.receiptId, error_code: error instanceof Rh4663ServiceError ? error.code : 'render_failed' }));
      return rh4663Failure(reply, error);
    }
  });
  app.get<{ Params: { windowId: string }; Querystring: { format?: string } }>('/og/4663/pulse/window/:windowId.png', async (req, reply) => {
    try { const format = parseRh4663ShareFormat(req.query.format); const share = await rh4663Phase2.windowShare(req.params.windowId); reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'); return reply.type('image/png').send(renderOgPng(renderRh4663ShareSvg(share, format), format === 'landscape' ? 1200 : 1080)); }
    catch (error) { console.log(JSON.stringify({ event: 'share_render_failed', service: 'rh_4663_resolution', window_id: req.params.windowId, error_code: error instanceof Rh4663ServiceError ? error.code : 'render_failed' })); return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { signalId: string }; Querystring: { format?: string } }>('/og/4663/signals/:signalId.png', async (req, reply) => {
    try { const format = parseRh4663ShareFormat(req.query.format); const signal = await rh4663Intelligence.publicSignal(req.params.signalId); if (!signal) return reply.code(404).send({ error: 'published_signal_not_found' }); reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'); return reply.type('image/png').send(renderOgPng(renderRh4663ShareSvg(signal, format), format === 'landscape' ? 1200 : 1080)); }
    catch (error) { rh4663Intelligence.recordShareRenderFailed(req.params.signalId, error instanceof Rh4663ServiceError ? error.code : 'render_failed'); return rh4663Failure(reply, error); }
  });
  app.get<{ Params: { pairId: string }; Querystring: { format?: string } }>('/og/4663/reflexive/birth/:pairId.png', async (req, reply) => {
    const pair = await reflexiveRadar.pair(req.params.pairId); if (!pair) return reply.code(404).send({ error: 'reflexive_pair_not_found' });
    if (pair.verification.verification_status !== 'VERIFIED') return reply.code(409).send({ error: 'reflexive_pair_not_verified' });
    const snapshot = await reflexiveRadar.snapshot(); const ticker = snapshot.assets.find((asset) => asset.asset_id === pair.stock_asset_id)?.ticker; if (!ticker) return reply.code(404).send({ error: 'reflexive_quote_asset_not_found' });
    const format = req.query.format === 'portrait' ? 'portrait' : 'landscape'; reply.header('cache-control', 'public, max-age=31536000, immutable');
    return reply.type('image/png').send(renderOgPng(renderReflexiveBirthCardSvg(pair, ticker, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get<{ Params: { observationId: string }; Querystring: { format?: string } }>('/og/4663/reflexive/inventory/:observationId.png', async (req, reply) => {
    const snapshot = await reflexiveRadar.snapshot(); const inventory = snapshot.inventory_observations.find((item) => item.observation_id === req.params.observationId); if (!inventory) return reply.code(404).send({ error: 'reflexive_inventory_observation_not_found' });
    if (inventory.status !== 'AVAILABLE') return reply.code(409).send({ error: 'reflexive_inventory_unavailable', reason: inventory.reason }); const pair = snapshot.pairs.find((item) => item.pair_id === inventory.mission_pair_id); if (!pair) return reply.code(404).send({ error: 'reflexive_pair_not_found' });
    const format = req.query.format === 'portrait' ? 'portrait' : 'landscape'; reply.header('cache-control', 'public, max-age=31536000, immutable'); return reply.type('image/png').send(renderOgPng(renderReflexiveInventoryCardSvg(pair, inventory, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get<{ Params: { observationId: string }; Querystring: { format?: string } }>('/og/4663/reflexive/stock-money/:observationId.png', async (req, reply) => {
    const snapshot = await reflexiveRadar.snapshot(); const aggregate = snapshot.inventory_aggregates.find((item) => item.aggregate_observation_id === req.params.observationId);
    if (!aggregate) return reply.code(404).send({ error: 'reflexive_stock_money_observation_not_found' }); if (aggregate.status !== 'ALIGNED') return reply.code(409).send({ error: 'reflexive_stock_money_incomplete' });
    const format = req.query.format === 'portrait' ? 'portrait' : 'landscape'; reply.header('cache-control', 'public, max-age=31536000, immutable'); return reply.type('image/png').send(renderOgPng(renderReflexiveStockMoneyCardSvg(aggregate, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get<{ Params: { observationId: string }; Querystring: { format?: string } }>('/og/4663/reflexive/capital-flow/:observationId.png', async (req, reply) => {
    const observation = (await reflexiveRadar.snapshot()).quote_persistence.find((item) => item.observation_id === req.params.observationId); if (!observation) return reply.code(404).send({ error: 'capital_flow_observation_not_found' }); if (observation.source_alignment !== 'ALIGNED') return reply.code(409).send({ error: 'capital_flow_observation_unaligned' }); const format = req.query.format === 'portrait' ? 'portrait' : 'landscape'; reply.header('cache-control', 'public, max-age=31536000, immutable'); return reply.type('image/png').send(renderOgPng(renderCapitalVsFlowCardSvg(observation, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get<{ Params: { footprintId: string }; Querystring: { format?: string } }>('/og/4663/reflexive/footprint/:footprintId.png', async (req, reply) => {
    const footprint = (await reflexiveRadar.snapshot()).mission_stock_footprints.find((item) => item.footprint_id === req.params.footprintId); if (!footprint) return reply.code(404).send({ error: 'mission_stock_footprint_not_found' }); if (footprint.combined_units === null) return reply.code(409).send({ error: 'mission_stock_footprint_unavailable' }); const format = req.query.format === 'portrait' ? 'portrait' : 'landscape'; reply.header('cache-control', 'public, max-age=31536000, immutable'); return reply.type('image/png').send(renderOgPng(renderMissionFootprintCardSvg(footprint, format), format === 'landscape' ? 1200 : 1080));
  });
  app.get('/og/rh-chain/market.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRhChainMarketPulseOgImage()));
  });
  app.get('/og/rh-chain/cross-layer.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    let context: { headline: string; reviewedProjectCount: number; capturedAt: string } | null = null;
    if (rhChainCrossLayerIntegration) {
      try {
        const data = await rhChainCrossLayerIntegration.build();
        context = { headline: data.headline, reviewedProjectCount: data.reviewed_project_count, capturedAt: data.captured_at };
      } catch { /* Static card remains available when reviewed storage is temporarily unavailable. */ }
    }
    return reply.type('image/png').send(renderOgPng(renderRhChainCrossLayerOgImage(context)));
  });
  app.get('/og/rh-chain/attention-quality.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    let context: { verdict: string; capturedAt: string | null } | null = null;
    if (config.rhChainAttentionQualityV2Enabled) {
      const first = rhChainReviewedLayerClassifications[0];
      if (first) { try { const assessment = await rhChainAttentionQuality.assess(first.contract); context = { verdict: assessment.verdict, capturedAt: assessment.captured_at }; } catch { /* Static card is still useful when storage is unavailable. */ } }
    }
    return reply.type('image/png').send(renderOgPng(renderRhChainAttentionQualityOgImage(context)));
  });
  app.get<{ Params: { receipt_id: string } }>('/og/rh-chain/share/:receipt_id.png', async (req, reply) => {
    // A receipt card is a public projection only. Drafts, rejected receipts, and reviewer-only data have no card route.
    if (!projectReceiptsEnabled()) return reply.code(404).send({ error: 'not_found' });
    const receipt = await rhChainProjectClaims.store.getReceipt(req.params.receipt_id);
    if (!receipt || !['published', 'superseded'].includes(receipt.reviewer_publication_state)) return reply.code(404).send({ error: 'rh_chain_intelligence_receipt_not_found' });
    const share = buildRhChainProjectReceiptShare(receipt);
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRhChainShareOgImage(share)));
  });
  app.get('/og/attention-market-watch.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderAttentionMarketWatchOgImage()));
  });
  app.get('/og/signal-hunt.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderSignalHuntOgImage()));
  });
  app.get('/og/unicorn-radar.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderUnicornRadarIndexOgImage()));
  });
  app.get('/og/evaluation-request.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRevenueReceiptsIndexOgImage()));
  });
  app.get('/og/revenue-receipts.png', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRevenueReceiptsIndexOgImage()));
  });
  app.get<{ Params: { candidateId: string } }>('/og/unicorn-radar/:candidateId.png', async (req, reply) => {
    const candidate = await resolveEnrichedUnicornRadarCandidate(req.params.candidateId);
    if (!candidate) return reply.code(404).send({ error: 'og_image_not_found' });
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderUnicornRadarOgImage(candidate)));
  });
  app.get<{ Params: { receiptId: string } }>('/og/revenue-receipts/:receiptId.png', async (req, reply) => {
    const receipt = getRevenueReceipt(req.params.receiptId);
    if (!receipt) return reply.code(404).send({ error: 'og_image_not_found' });
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderRevenueReceiptOgImage(receipt)));
  });
  app.get<{ Params: { slug: string } }>('/og/attention-market-watch/:slug.png', async (req, reply) => {
    const signal = getAttentionMarketSignalBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'og_image_not_found' });
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(renderAttentionMarketWatchOgImage(signal.slug)));
  });
  app.get<{ Params: { slug: string } }>('/og/signals/:slug.png', async (req, reply) => {
    const svg = renderSignalReportOgImage(req.params.slug);
    if (!svg) return reply.code(404).send({ error: 'og_image_not_found' });
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(svg));
  });
  app.get<{ Params: { slug: string; updateId: string } }>('/og/signals/:slug/updates/:updateId.png', async (req, reply) => {
    const svg = renderSignalUpdateOgImage(req.params.slug, req.params.updateId);
    if (!svg) return reply.code(404).send({ error: 'og_image_not_found' });
    reply.header('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.type('image/png').send(renderOgPng(svg));
  });
  app.post('/v1/search', async (req, reply) => handleParsed(req.body, SearchRequestSchema, async (input) => {
    const startedAtMs = Date.now();
    console.log(JSON.stringify({ event: 'route_timing_start', route: '/v1/search', started_at: new Date(startedAtMs).toISOString() }));
    try {
      const result = await withTimeout(() => semanticSearch(input, store), SEARCH_ROUTE_TIMEOUT_MS, 'search_timeout');
      console.log(JSON.stringify({ event: 'route_timing_end', route: '/v1/search', duration_ms: Date.now() - startedAtMs, timed_out: false }));
      return { data: result };
    } catch {
      console.log(JSON.stringify({ event: 'route_timing_end', route: '/v1/search', duration_ms: Date.now() - startedAtMs, timed_out: true }));
      return { data: [], degraded: true, reason: 'search_timeout' };
    }
  }, reply));
  app.get('/v1/receipts', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    metrics: preSpendIntelligence.getMetrics(),
    receipts: preSpendIntelligence.listReceipts()
  }) }));
  app.post('/v1/receipts', async (req, reply) => {
    const parsed = PreSpendReceiptSchema.omit({ receipt_id: true, timestamp: true }).partial({ human_notes: true }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_pre_spend_receipt', details: parsed.error.flatten() });
    return { data: safeJsonExport(preSpendIntelligence.createReceipt({
      ...parsed.data,
      human_notes: parsed.data.human_notes ?? []
    })) };
  });
  app.post('/v1/validation/submit', async (req, reply) => {
    const parsed = HumanValidationSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_human_validation_submission', details: parsed.error.flatten() });
    return { data: safeJsonExport(preSpendIntelligence.submitValidation(parsed.data)) };
  });
  app.get('/v1/claims', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    metrics: preSpendIntelligence.getMetrics(),
    claims: preSpendIntelligence.listClaims()
  }) }));
  app.post('/v1/check', async (req, reply) => {
    const parsed = ProofCheckInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_proof_check_input', details: parsed.error.flatten() });
    return { data: safeJsonExport(proofCheckService.createProofCheck(parsed.data)) };
  });
  app.get('/v1/checks', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    checks: proofCheckService.listProofChecks()
  }) }));
  app.get<{ Params: { check_id: string } }>('/v1/checks/:check_id', async (req, reply) => {
    const check = proofCheckService.getProofCheck(req.params.check_id);
    if (!check) return reply.code(404).send({ error: 'proof_check_not_found' });
    return { data: safeJsonExport(check) };
  });
  app.get('/v1/loops', async () => ({ data: safeJsonExport({
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    loops: loopService.listLoops()
  }) }));
  app.get<{ Params: { loop_id: string } }>('/v1/loops/:loop_id', async (req, reply) => {
    const loop = loopService.getLoop(req.params.loop_id);
    if (!loop) return reply.code(404).send({ error: 'loop_not_found' });
    return { data: safeJsonExport(loop) };
  });
  app.post('/v1/loops/check', async (req, reply) => {
    const parsed = LoopCheckInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_loop_check_input', details: parsed.error.flatten() });
    return { data: safeJsonExport(loopService.createLoopCheck(parsed.data)) };
  });
  app.get<{ Params: { claim_id: string } }>('/v1/claims/:claim_id', async (req, reply) => {
    const detail = preSpendIntelligence.getClaim(req.params.claim_id);
    if (!detail) return reply.code(404).send({ error: 'claim_not_found' });
    return { data: safeJsonExport(detail) };
  });
  app.post('/v1/claims', async (req, reply) => {
    const parsed = ClaimCreateRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_claim_submission', details: parsed.error.flatten() });
    return { data: safeJsonExport(preSpendIntelligence.submitClaim(parsed.data)) };
  });
  app.get<{ Params: { claim_id: string } }>('/v1/claims/:claim_id/challenges', async (req, reply) => {
    const claim = preSpendIntelligence.getClaim(req.params.claim_id);
    if (!claim) return reply.code(404).send({ error: 'claim_not_found' });
    return { data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      claim_id: req.params.claim_id,
      challenges: preSpendIntelligence.getChallengesForClaim(req.params.claim_id)
    }) };
  });
  app.post<{ Params: { claim_id: string } }>('/v1/claims/:claim_id/challenges', async (req, reply) => {
    const claim = preSpendIntelligence.getClaim(req.params.claim_id);
    if (!claim) return reply.code(404).send({ error: 'claim_not_found' });
    const parsed = ClaimChallengeCreateRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_claim_challenge_submission', details: parsed.error.flatten() });
    return { data: safeJsonExport(preSpendIntelligence.submitClaimChallenge(req.params.claim_id, parsed.data)) };
  });
  app.get('/v1/graph/clusters', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      clusters: SignalGraphClusterSchema.array().parse(getSignalGraphClusters())
    })
  }));
  app.get<{ Params: { cluster_id: string } }>('/v1/graph/clusters/:cluster_id', async (req, reply) => {
    const cluster = getSignalGraphCluster(req.params.cluster_id);
    if (!cluster) return reply.code(404).send({ error: 'signal_graph_cluster_not_found' });
    return {
      data: safeJsonExport(SignalGraphClusterDetailSchema.parse(cluster))
    };
  });
  app.get<{ Params: { node_id: string } }>('/v1/graph/nodes/:node_id', async (req, reply) => {
    const node = getSignalGraphNode(req.params.node_id);
    if (!node) return reply.code(404).send({ error: 'signal_graph_node_not_found' });
    return {
      data: safeJsonExport(SignalGraphNodeDetailSchema.parse(node))
    };
  });
  app.get<{ Params: { entity_type: string; entity_id: string } }>('/v1/graph/entities/:entity_type/:entity_id', async (req, reply) => {
    if (!isSignalGraphEntityType(req.params.entity_type)) {
      return reply.code(400).send({
        error: 'unsupported_signal_graph_entity_type',
        supported_entity_types: SignalGraphEntityTypeSchema.options
      });
    }
    return {
      data: safeJsonExport(SignalGraphEntityLookupResponseSchema.parse(findSignalGraphNodesForEntity(req.params.entity_type, req.params.entity_id)))
    };
  });
  app.get('/v1/graph/ripples', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      ripples: SignalGraphRippleSchema.array().parse(getSignalGraphRipples())
    })
  }));
  app.post('/v1/graph/check', async (req, reply) => {
    const parsed = SignalGraphCheckInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_graph_check_input', details: parsed.error.flatten() });
    return {
      data: safeJsonExport(SignalGraphCheckResponseSchema.parse(checkSignalGraph(parsed.data)))
    };
  });
  app.post('/v1/recommend-route', async (req, reply) => handleParsed(req.body, RouteRecommendationRequestSchema, (input) => ({ data: recommendRoute(input, store) }), reply));
  app.post('/v1/preflight', async (req, reply) => handleParsed(req.body, PreflightRequestSchema, (input) => ({ data: runPreflight(input, store) }), reply));
  app.get('/v1/preflight/schema', async () => ({
    data: {
      request: z.toJSONSchema(PreflightRequestSchema),
      response: z.toJSONSchema(PreflightResponseSchema),
      example: {
        request: {
          intent: 'prepay route selection for settlement',
          category: 'Payments',
          constraints: { minTrustScore: 80, maxLatencyMs: 500, maxCostUsd: 0.05 },
          candidateProviders: ['alpha', 'beta']
        },
        response: {
          decision: 'route_approved',
          selectedProvider: 'alpha'
        }
      }
    }
  }));
  app.post('/v1/ingest/pay-sh', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    return handleParsed(req.body, IngestRequestSchema, async (input) => {
      const result = await runPayShIngestion(store, repository, input?.catalogUrl);
      refreshBackgroundAnalytics();
      return { data: { run: result.run, emittedEvents: result.events.length, usedFixture: result.usedFixture, liveFetchFailed: result.liveFetchFailed } };
    }, reply);
  });
  app.post('/v1/monitor/run', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const result = await runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() });
    refreshBackgroundAnalytics();
    return { data: { run: result.run, emittedEvents: result.events.length } };
  });
  app.get('/v1/graph', async () => ({
    data: safeJsonExport(SignalGraphResponseSchema.parse(buildGraphPayload(store)))
  }));
  app.get<{ Params: { id: string } }>('/interpretations/:id', async (req, reply) => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const interpretation = summary.interpretations.find((item) => item.interpretation_id === req.params.id);
    if (!interpretation) return reply.code(404).type('text/html; charset=utf-8').send(renderInterpretationNotFoundPage(req, req.params.id, summary.generatedAt));
    return reply.type('text/html; charset=utf-8').send(renderInterpretationPage(req, interpretation, summary));
  });
  app.get<{ Params: { event_id: string } }>('/v1/receipts/:event_id', async (req, reply) => {
    const builderReceiptDetail = preSpendIntelligence.getReceiptDetail(req.params.event_id);
    if (builderReceiptDetail) {
      return {
        data: safeJsonExport(builderReceiptDetail)
      };
    }
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const event = summary.timeline.find((item) => item.id === req.params.event_id || item.event_id === req.params.event_id);
    if (!event) return reply.code(404).send({ error: 'receipt_not_found' });

    const providerId = event.provider_id ?? event.providerId ?? null;
    const provider = providerId ? findProvider(store, providerId) : null;
    const propagation = cachedPropagation;
    const interpretations = summary.interpretations
      .filter((item) => item.supporting_event_ids.includes(event.id) || item.supporting_event_ids.includes(event.event_id ?? ''));

    return {
      data: {
        event_id: event.id,
        event_type: event.type,
        provider_id: providerId,
        endpoint_id: event.endpoint_id ?? event.endpointId ?? null,
        severity: event.severity ?? 'unknown',
        severity_reason: event.severity_reason ?? 'No deterministic severity reason available.',
        observed_at: event.observed_at ?? event.observedAt ?? null,
        catalog_generated_at: event.catalog_generated_at ?? null,
        ingested_at: event.ingested_at ?? null,
        source: event.source ?? 'unknown',
        derivation_reason: event.derivation_reason ?? 'Deterministic evidence event.',
        confidence: event.confidence ?? null,
        summary: {
          entity_type: event.entityType,
          entity_id: event.entityId,
          payload: event.payload
        },
        raw_summary: JSON.stringify(event.payload),
        links: {
          provider: provider ? { provider_id: provider.id, provider_name: provider.name, url: `/?provider_id=${encodeURIComponent(provider.id)}` } : null,
          provider_dossier: providerId ? `/?provider_id=${encodeURIComponent(providerId)}` : null,
          interpretations: interpretations.map((item) => ({ interpretation_id: item.interpretation_id, title: item.interpretation_title, url: `/#${item.interpretation_id}` })),
          propagation_cluster: propagation.supporting_event_ids.includes(event.id) || propagation.supporting_event_ids.includes(event.event_id ?? '')
            ? { cluster: propagation.affected_cluster, state: propagation.propagation_state, severity: propagation.severity, url: '/#propagation-watch' }
            : null
        }
      }
    };
  });
  const configuredClientDistDir = options.clientDistDir === undefined
    ? resolve(process.cwd(), 'dist/client')
    : options.clientDistDir;
  const clientDistDir = configuredClientDistDir ? resolve(configuredClientDistDir) : null;
  const clientIndexPath = clientDistDir ? join(clientDistDir, 'index.html') : null;
  if (clientDistDir && clientIndexPath && existsSync(clientIndexPath)) {
    app.get('/*', async (req, reply) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(404).send({ error: 'not_found' });
      const urlPath = (req.raw.url ?? '/').split('?')[0] ?? '/';
      if (urlPath.startsWith('/v1/') || urlPath === '/health' || urlPath === '/healthz' || urlPath === '/readyz' || urlPath === '/version' || urlPath === '/status' || urlPath === '/openapi.json') {
        return reply.code(404).send({ error: 'not_found' });
      }
      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const target = normalize(join(clientDistDir, relative));
      if (!target.startsWith(clientDistDir)) return reply.code(403).send({ error: 'forbidden' });
      try {
        const file = await stat(target);
        if (file.isFile()) {
          if (relative === 'index.html') reply.header('Cache-Control', 'no-cache');
          else if (relative.startsWith('assets/')) reply.header('Cache-Control', 'public, max-age=31536000, immutable');
          else reply.header('Cache-Control', 'public, max-age=86400');
          return reply.type(contentTypeFor(target)).send(createReadStream(target));
        }
      } catch {
        // fall through to SPA index
      }
      const html = await readFile(clientIndexPath, 'utf8');
      const campaignMetadata = await rh4663PublicRouteMetadata(urlPath).catch(() => null);
      return reply.header('Cache-Control', 'no-cache').type('text/html; charset=utf-8').send(injectNarrativeRouteMetadata(html, urlPath, campaignMetadata));
    });
  }

  const intervalMs = config.ingestionEnabled ? (config.payShIngestIntervalMs ?? 0) : 0;
  if (intervalMs > 0) {
    const timer = setInterval(() => {
      void runPayShIngestion(store, repository)
        .then(() => refreshBackgroundAnalytics())
        .catch((error) => {
          logDbDegraded('ingestion_scheduler', classifyBootstrapFailure(error), error);
          console.log(JSON.stringify({
            event: 'ingestion_db_write_failed',
            stage: 'ingestion_scheduler',
            reason: classifyBootstrapFailure(error),
            code: errorCode(error),
            message: errorMessage(error)
          }));
          console.log(JSON.stringify({
            event: 'ingestion_job_failed',
            code: errorCode(error),
            message: errorMessage(error)
          }));
        });
    }, intervalMs);
    timer.unref();
    app.addHook('onClose', async () => {
      console.log(JSON.stringify({ event: 'hook_enter', hook: 'onClose', source: 'ingestion_timer' }));
      clearInterval(timer);
      console.log(JSON.stringify({ event: 'hook_exit', hook: 'onClose', source: 'ingestion_timer' }));
    });
  }
  if (isMonitorEnabled() && monitorIntervalMs() > 0) {
    const timer = setInterval(() => {
      void runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() })
        .then(() => refreshBackgroundAnalytics())
        .catch((error) => {
          logDbDegraded('monitor_scheduler', classifyBootstrapFailure(error), error);
          console.log(JSON.stringify({
            event: 'monitor_job_failed',
            code: errorCode(error),
            message: errorMessage(error)
          }));
        });
    }, monitorIntervalMs());
    timer.unref();
    app.addHook('onClose', async () => {
      console.log(JSON.stringify({ event: 'hook_enter', hook: 'onClose', source: 'monitor_timer' }));
      clearInterval(timer);
      console.log(JSON.stringify({ event: 'hook_exit', hook: 'onClose', source: 'monitor_timer' }));
    });
  }

  if (config.rhChainAutomationEnabled || (config.rh4663Phase3Enabled && config.rh4663Phase3IngestionEnabled)) {
    const schedule = (jobName: import('../services/rhChainAutomationService').RhChainAutomationJobName, intervalMs: number) => {
      const timer = setInterval(() => { void runRhChainAutomationJob(jobName); }, intervalMs);
      timer.unref();
      app.addHook('onClose', async () => clearInterval(timer));
    };
    // Context refreshes are independently scheduled. A provider or job failure is
    // recorded on that run and cannot prevent the next job from executing.
    if (config.rhChainAutomationEnabled) {
      schedule('rh_chain_pulse_refresh', config.rhChainChainPulseIntervalMs);
      schedule('rh_freshness_sweep', config.rhChainChainPulseIntervalMs);
      schedule('rh_meme_pulse_refresh', config.rhChainMemePulseIntervalMs);
      schedule('rh_launchpad_observatory_refresh', config.rhChainLaunchpadIntervalMs);
    }
    if (config.rh4663Phase3Enabled && config.rh4663Phase3IngestionEnabled) schedule('rh_4663_intelligence_refresh', config.rh4663Phase3IntervalMs);
    if (config.rhChainAutomationEnabled && config.rhChainReceiptDraftCron) {
      let lastReceiptDraftMinute = '';
      const timer = setInterval(() => {
        const now = new Date();
        const minuteKey = now.toISOString().slice(0, 16);
        if (minuteKey !== lastReceiptDraftMinute && cronMatches(config.rhChainReceiptDraftCron!, now)) {
          lastReceiptDraftMinute = minuteKey;
          void runRhChainAutomationJob('rh_daily_receipt_draft');
        }
      }, 30_000);
      timer.unref();
      app.addHook('onClose', async () => clearInterval(timer));
    }
  }

  return app;

  async function runRhChainAutomationJob(jobName: import('../services/rhChainAutomationService').RhChainAutomationJobName) {
    try {
      const run = await rhChainAutomation.run(jobName);
      console.log(JSON.stringify({ event: 'rh_chain_automation_run', job_id: run.job_id, job_name: run.job_name, status: run.status, error_summary: run.error_summary, records_observed: run.records_observed, records_updated: run.records_updated }));
    } catch (error) {
      console.log(JSON.stringify({
        event: 'rh_chain_automation_job_failed',
        job_name: jobName,
        code: errorCode(error),
        message: errorMessage(error),
        persistence_unavailable: isPersistenceUnavailable(error)
      }));
    }
  }

  function refreshBackgroundAnalytics() {
    setTimeout(() => {
      try {
        const generatedAt = new Date().toISOString();
        const propagationStartMs = Date.now();
        cachedPropagation = analyzePropagation(store, generatedAt);
        logTiming('propagation_build', propagationStartMs);
        const interpretationStartMs = Date.now();
        cachedInterpretations = pulseSummary(store, generatedAt, config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: true, propagationFallback: cachedPropagation }).interpretations;
        logTiming('interpretation_build', interpretationStartMs);
        cachedPulseDashboard = buildPulseDashboard(store, cachedInterpretations, bootstrapped, generatedAt);
        console.log(JSON.stringify({
          event: 'ingestion_state',
          catalogSource: config.payShCatalogSource,
          ingestionEnabled: config.ingestionEnabled,
          dbMode: config.databaseUrl ? 'postgres' : 'memory',
          providerCount: store.providers.length,
          endpointCount: store.endpoints.length,
          lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
          catalogStatus: catalogStatusFromDataSource(store.dataSource)
        }));
      } catch (error) {
        console.log(JSON.stringify({ event: 'background_analytics_failed', code: errorCode(error), message: errorMessage(error) }));
      }
    }, 0);
  }

  async function ensureLiveBootstrap(reason: 'startup' | 'route:/v1/pulse' | 'route:/v1/providers' | 'route:/v1/radar/endpoints') {
    if (startupLoadPromise) await startupLoadPromise;
    if (isLiveBootstrapSatisfied(store)) {
      bootstrapped = true;
      liveBootstrapStatus = 'ready';
      liveBootstrapError = null;
      return;
    }
    if (!liveBootstrapEnabled) {
      if (!store.dataSource || store.dataSource.error === null) {
        store.dataSource = {
          mode: 'fixture_fallback',
          url: liveCatalogUrl,
          generated_at: null,
          provider_count: store.providers.length,
          last_ingested_at: new Date().toISOString(),
          used_fixture: true,
          error: 'bootstrap_not_called'
        };
      }
      bootstrapped = store.providers.length > 0;
      liveBootstrapStatus = bootstrapped ? 'ready' : 'failed';
      liveBootstrapError = bootstrapped ? null : 'bootstrap_not_called';
      return;
    }
    if (liveBootstrapPromise) {
      await liveBootstrapPromise;
      return;
    }

    liveBootstrapStatus = 'pending';
    liveBootstrapError = null;
    liveBootstrapPromise = (async () => {
      console.log('[radar-bootstrap] starting live Pay.sh catalog bootstrap');
      let result: Awaited<ReturnType<typeof runPayShIngestionWithOptions>>;
      try {
        result = await runPayShIngestionWithOptions(store, repository, {
          catalogUrl: liveCatalogUrl,
          catalogSource: 'live',
          allowFixtureFallback: false
        });
      } catch (error) {
        const reason = classifyBootstrapFailure(error);
        logDbDegraded('live_bootstrap', reason, error);
        console.log(JSON.stringify({
          event: 'live_bootstrap_db_failure',
          reason,
          code: errorCode(error),
          message: errorMessage(error)
        }));
        throw new Error(reason);
      }
      const endpointCount = safeStoreEndpointCount(store);
      if (result.liveFetchFailed || !store.providers.length || store.dataSource?.mode !== 'live_pay_sh_catalog' || store.dataSource?.used_fixture) {
        const failureReason = store.dataSource?.error ?? 'pulse_state_inconsistent';
        throw new Error(failureReason);
      }
      bootstrapped = true;
      liveBootstrapStatus = 'ready';
      liveBootstrapError = null;
      refreshBackgroundAnalytics();
      console.log(`[radar-bootstrap] live catalog bootstrap succeeded provider_count=${store.providers.length} endpoint_count=${endpointCount}`);
    })()
      .catch(async (error) => {
        const reasonLabel = error instanceof Error ? error.message : String(error);
        console.log(`[radar-bootstrap] live catalog bootstrap failed reason=${reasonLabel}`);
        bootstrapped = store.providers.length > 0;
        liveBootstrapStatus = 'failed';
        liveBootstrapError = reasonLabel;
        if (!store.providers.length) {
          try {
            await runPayShIngestionWithOptions(store, repository, {
              catalogSource: 'fixture',
              catalogUrl: liveCatalogUrl,
              allowFixtureFallback: true
            });
            if (store.dataSource) {
              store.dataSource = {
                ...store.dataSource,
                mode: 'fixture_fallback',
                url: liveCatalogUrl,
                used_fixture: true,
                error: reasonLabel
              };
            }
            bootstrapped = store.providers.length > 0;
          } catch (fixtureError) {
            store.dataSource = {
              mode: 'fixture_fallback',
              url: liveCatalogUrl,
              generated_at: null,
              provider_count: 0,
              last_ingested_at: new Date().toISOString(),
              used_fixture: true,
              error: fixtureError instanceof Error ? fixtureError.message : String(fixtureError)
            };
          }
        }
        refreshBackgroundAnalytics();
      })
      .finally(() => {
        liveBootstrapPromise = null;
      });

    await liveBootstrapPromise;
  }

  async function ensureLiveBootstrapWithinBudget(reason: 'route:/v1/pulse' | 'route:/v1/providers' | 'route:/v1/radar/endpoints') {
    try {
      await withTimeout(() => ensureLiveBootstrap(reason), ROUTE_TIMEOUT_MS, 'bootstrap_timeout');
    } catch {
      refreshBackgroundAnalytics();
    }
  }

  async function withRouteTimeout<T>(route: '/status' | '/v1/pulse' | '/v1/providers' | '/v1/pulse/summary', timeoutMs: number, work: () => T | Promise<T>, fallback: () => T): Promise<T> {
    const startedAtMs = Date.now();
    console.log(JSON.stringify({ event: 'route_timing_start', route, started_at: new Date(startedAtMs).toISOString() }));
    try {
      const result = await withTimeout(work, timeoutMs, 'route_timeout');
      console.log(JSON.stringify({ event: 'route_timing_end', route, duration_ms: Date.now() - startedAtMs, timed_out: false }));
      return result;
    } catch {
      console.log(JSON.stringify({ event: 'route_timing_end', route, duration_ms: Date.now() - startedAtMs, timed_out: true }));
      return fallback();
    }
  }
}

async function withTimeout<T>(work: () => T | Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(reason));
    }, timeoutMs);

    Promise.resolve()
      .then(work)
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function logRadarRouteTiming(route: '/v1/radar/benchmark-summary' | '/v1/radar/benchmarks' | '/v1/radar/endpoints' | '/v1/radar/risk/ecosystem' | '/v1/radar/history/ecosystem', durationMs: number, cacheHit: boolean, status: 'ok' | 'stale_ok' | 'warming_up') {
  console.log(JSON.stringify({ event: 'radar_route_timing', route, duration_ms: durationMs, cache_hit: cacheHit, status }));
}

function contentTypeFor(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function isAdmin(adminToken: string | null, authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return Boolean(adminToken && match?.[1] === adminToken);
}

function isRhChainReviewAdmin(reviewToken: string | null, authorization: string | undefined) {
  // A console without its dedicated token is always closed. Never fall back to
  // a public/admin token or an implicit allow.
  if (!reviewToken) return false;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] === reviewToken;
}

function rh4663CategoryFromNarrative(classes: readonly string[]) {
  if (classes.some((value) => value.includes('stock_token'))) return 'stock_token' as const;
  if (classes.some((value) => value.includes('agent') || value.includes('ai_'))) return 'agent' as const;
  if (classes.some((value) => value.includes('liquidity'))) return 'liquidity' as const;
  if (classes.some((value) => value.includes('risk') || value.includes('deployer'))) return 'risk' as const;
  return 'meme' as const;
}

function rh4663LegacyCategory(category: import('../services/rh4663Service').Rh4663IntelligenceCategory): import('../services/rh4663Service').Rh4663SignalCategory {
  return ({ MEMES: 'meme', STOCK_TOKENS: 'stock_token', RWA_DEFI: 'defi', STABLES: 'liquidity', CULTURE_NFT: 'nft_culture', UTILITY: 'utility', AGENT: 'agent', WALLET: 'wallet', LIQUIDITY: 'liquidity', INTEGRATION: 'integration', SECURITY: 'risk', OTHER: 'other' } as const)[category];
}

/** Small, intentionally bounded five-field cron matcher for an optional local scheduler. */
function cronMatches(expression: string, date: Date) {
  const fields = expression.split(/\s+/);
  if (fields.length !== 5) return false;
  return cronFieldMatches(fields[0], date.getMinutes(), 0, 59)
    && cronFieldMatches(fields[1], date.getHours(), 0, 23)
    && cronFieldMatches(fields[2], date.getDate(), 1, 31)
    && cronFieldMatches(fields[3], date.getMonth() + 1, 1, 12)
    && cronFieldMatches(fields[4], date.getDay(), 0, 7);
}

function cronFieldMatches(field: string, value: number, min: number, max: number) {
  return field.split(',').some((part) => {
    if (part === '*') return true;
    const stepped = part.match(/^\*\/(\d+)$/);
    if (stepped) return Number(stepped[1]) > 0 && value % Number(stepped[1]) === 0;
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) return value >= Number(range[1]) && value <= Number(range[2]);
    const numeric = Number(part);
    return Number.isInteger(numeric) && numeric >= min && numeric <= max && (numeric === value || (max === 7 && numeric === 7 && value === 0));
  });
}

function normalizeRhChainDuplicateField(value: string) {
  return value.trim().toLowerCase();
}

function publicRhChainSubmission(submission: import('../services/rhChainSignalVault').RhChainSignalSubmission) {
  const { scout_contact: _scoutContact, audit_events, ...safeSubmission } = submission;
  return { ...safeSubmission, audit_events: audit_events.map(({ reviewer_id: _reviewerId, ...event }) => event) };
}

function safeRequestPath(url: string) {
  return url.split('?', 1)[0] || '/';
}

function rhChainOperationContext(route: string) {
  if (!route.startsWith('/v1/rh-chain') && !route.startsWith('/internal/rh-chain')) {
    return { service: 'radar_api', operation: 'request' };
  }
  if (route === '/v1/rh-chain') return { service: 'rh_chain_signal_desk', operation: 'read_signal_desk' };
  if (route.endsWith('/today-on-4663')) return { service: 'rh_chain_today_on_4663', operation: 'read_today_on_4663' };
  if (route.includes('/daily-receipts')) return { service: 'rh_chain_daily_receipts', operation: 'read_daily_receipts' };
  if (route.endsWith('/review-queue')) return { service: 'rh_chain_review_queue', operation: 'read_review_queue' };
  if (route.endsWith('/clone-radar')) return { service: 'rh_chain_clone_radar', operation: 'read_clone_radar' };
  if (route.endsWith('/scouts')) return { service: 'rh_chain_scouts', operation: 'read_scouts' };
  if (route.endsWith('/distribution-pack')) return { service: 'rh_chain_distribution_pack', operation: 'read_distribution_pack' };
  if (route.includes('/jobs')) return { service: 'rh_chain_automation', operation: 'automation_job' };
  return { service: 'rh_chain', operation: 'request' };
}

function safeOperationalStack(error: Error) {
  return safeOperationalErrorMessage(error.stack ?? error.message, 1_200);
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return String(error ?? '');
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(message ?? '');
}

function classifyBootstrapFailure(error: unknown): string {
  const code = errorCode(error);
  if (code === 'ECONNREFUSED') return 'db_connection_refused';
  const message = errorMessage(error).toLowerCase();
  if (message.includes('connection terminated unexpectedly')) return 'db_connection_terminated';
  if (message.includes('timeout')) return 'db_timeout';
  if (message.includes('pool') || message.includes('closed')) return 'db_pool_closed';
  return 'db_unavailable';
}

function logDbDegraded(stage: string, reason: string, error: unknown) {
  console.log(JSON.stringify({
    event: 'db_degraded',
    stage,
    reason,
    code: errorCode(error),
    message: errorMessage(error)
  }));
}

function monitorRunResponse(run: NonNullable<IntelligenceStore['monitorRuns']>[number]) {
  const mode = run.mode ?? (run.source.includes('safe-metadata') ? 'safe_metadata' : 'endpoint_health');
  const degradedCount = run.degradedCount ?? 0;
  const reachableCount = run.reachableCount ?? Math.max(0, run.successCount - degradedCount);
  return {
    ...run,
    mode,
    checked_count: run.checkedCount,
    reachable_count: reachableCount,
    degraded_count: degradedCount,
    failed_count: run.failedCount,
    skipped_count: run.skippedCount,
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

function buildPulseDashboard(store: IntelligenceStore, interpretations: unknown[], bootstrapped: boolean, generatedAt = new Date().toISOString()) {
  const knownTrust = store.trustAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const knownSignal = store.signalAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const dataSource = dataSourceState(store, generatedAt);
  const endpointCount = safeStoreEndpointCount(store);
  const endpointMetadata = endpointMetadataState(store);
  const effectiveBootstrapped = bootstrapped || store.providers.length > 0;
  return {
    providerCount: store.providers.length,
    endpointCount,
    eventCount: store.events.length,
    averageTrust: avg(knownTrust),
    averageSignal: avg(knownSignal),
    hottestNarrative: summarizeNarrative(store.narratives[0] ?? null),
    topTrust: [...store.trustAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((item) => summarizeAssessment(item)),
    topSignal: [...store.signalAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((item) => summarizeAssessment(item)),
    unknownTelemetry: {
      uptime: store.trustAssessments.filter((item) => item.components.uptime === null).length,
      latency: store.trustAssessments.filter((item) => item.components.latency === null).length,
      responseValidity: store.trustAssessments.filter((item) => item.components.responseValidity === null).length,
      receiptReliability: store.trustAssessments.filter((item) => item.components.receiptReliability === null).length,
      socialVelocity: store.signalAssessments.filter((item) => item.components.socialVelocity === null).length,
      onchainLiquidityResonance: store.signalAssessments.filter((item) => item.components.onchainLiquidityResonance === null).length
    },
    interpretations: compactInterpretationsSummary(interpretations as ReturnType<typeof pulseSummary>['interpretations']),
    data_source: dataSource,
    catalog_status: pulseCatalogStatusFromDataSource(dataSource, store.providers.length, effectiveBootstrapped),
    catalog_error: sanitizeCatalogError(dataSource.error ?? null),
    endpoint_metadata: endpointMetadata,
    updatedAt: generatedAt,
    bootstrapped: effectiveBootstrapped
  };
}

function compactPulseSummaryPayload(summary: ReturnType<typeof pulseSummary>) {
  return {
    ...summary,
    propagation: compactPropagationSummary(summary.propagation),
    interpretations: compactInterpretationsSummary(summary.interpretations)
  };
}

function compactPropagationSummary(propagation: ReturnType<typeof pulseSummary>['propagation']) {
  const supporting_event_count = propagation.supporting_event_ids.length;
  const supporting_event_ids = propagation.supporting_event_ids.slice(0, MAX_INLINE_SUPPORTING_EVENT_IDS);
  return {
    ...propagation,
    supporting_event_ids,
    supporting_event_count,
    remaining_event_count: Math.max(0, supporting_event_count - supporting_event_ids.length),
    view_full_receipts_url: `/propagation/${encodeURIComponent(propagation.cluster_id)}`
  };
}

function compactInterpretationsSummary(interpretations: ReturnType<typeof pulseSummary>['interpretations']) {
  return interpretations.map((item) => {
    const supporting_event_count = item.supporting_event_ids.length;
    const supporting_event_ids = item.supporting_event_ids.slice(0, MAX_INLINE_SUPPORTING_EVENT_IDS);
    return {
      ...item,
      supporting_event_ids,
      supporting_event_count,
      remaining_event_count: Math.max(0, supporting_event_count - supporting_event_ids.length),
      view_full_receipts_url: `/interpretations/${encodeURIComponent(item.interpretation_id)}`
    };
  });
}

function pulseDashboardResponse(cachedPulseDashboard: ReturnType<typeof buildPulseDashboard> | null, store: IntelligenceStore) {
  if (cachedPulseDashboard) return cachedPulseDashboard;
  return pulseWarmingUpFallback(store, false, 'pulse_cache_missing');
}

function createFixturePulseStore(): IntelligenceStore {
  const generatedAt = new Date().toISOString();
  const fixtureIngestion = applyPayShCatalogIngestion(emptyIntelligenceStore(), payShCatalogFixture, {
    source: 'pay.sh:public-catalog-fixture',
    dataSource: {
      mode: 'fixture_fallback',
      url: DEFAULT_LIVE_CATALOG_URL,
      generated_at: null,
      provider_count: payShCatalogFixture.length,
      last_ingested_at: generatedAt,
      used_fixture: true,
      error: null
    }
  });
  const fixtureSnapshot = recomputeAssessments(fixtureIngestion.snapshot);
  const baseDataSource = fixtureSnapshot.dataSource ?? {
    mode: 'fixture_fallback' as const,
    url: DEFAULT_LIVE_CATALOG_URL,
    generated_at: null,
    provider_count: fixtureSnapshot.providers.length,
    last_ingested_at: generatedAt,
    used_fixture: true,
    error: null
  };
  return {
    ...fixtureSnapshot,
    dataSource: {
      ...baseDataSource,
      mode: 'fixture_fallback',
      error: 'bootstrap_pending',
      last_ingested_at: baseDataSource.last_ingested_at ?? generatedAt
    }
  };
}

function pulseFixtureStoreWithStatus(store: IntelligenceStore, error: string | null): IntelligenceStore {
  const generatedAt = new Date().toISOString();
  const baseDataSource = store.dataSource ?? {
    mode: 'fixture_fallback' as const,
    url: DEFAULT_LIVE_CATALOG_URL,
    generated_at: null,
    provider_count: store.providers.length,
    last_ingested_at: generatedAt,
    used_fixture: true,
    error: null
  };
  return {
    ...store,
    dataSource: {
      ...baseDataSource,
      mode: 'fixture_fallback',
      error: error ?? 'bootstrap_pending',
      last_ingested_at: generatedAt
    }
  };
}

function pulseRouteStatus(store: IntelligenceStore, state: 'idle' | 'pending' | 'ready' | 'failed', error: string | null) {
  const dataSource = dataSourceState(store);
  const fixtureBacked = dataSource.used_fixture === true || store.providers.length === 0;
  const liveReady = dataSource.mode === 'live_pay_sh_catalog' && store.providers.length > 0 && dataSource.used_fixture === false;
  const upstreamState = state === 'ready'
    ? fixtureBacked ? 'unavailable' : 'ready'
    : state === 'failed' && error?.includes('timeout')
      ? 'timeout'
      : liveReady
        ? 'ready'
        : 'unavailable';
  return {
    backend: 'healthy' as const,
    upstream: {
      state: upstreamState,
      reason: error ?? (liveReady ? null : state === 'pending' ? 'bootstrap_pending' : fixtureBacked ? 'fixture_backed_fallback' : null)
    },
    radar: {
      state: fixtureBacked ? 'fixture_backed' as const : 'live' as const,
      reason: fixtureBacked ? 'live_bootstrap_pending_or_failed' : 'live_bootstrap_complete'
    }
  };
}

function pulseDiagnostics(
  dataSource: ReturnType<typeof dataSourceState>,
  bootstrapState: 'idle' | 'pending' | 'ready' | 'failed',
  fallbackReason: string | null,
  generatedAt: string
) {
  const liveCatalogState = dataSource.mode === 'live_pay_sh_catalog' && dataSource.used_fixture === false
    ? 'live'
    : dataSource.used_fixture
      ? 'fixture_fallback'
      : 'unavailable';
  return {
    pulse_source: dataSource.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_backed',
    live_catalog_state: liveCatalogState,
    bootstrap_state: bootstrapState,
    fallback_reason: fallbackReason,
    generated_at: generatedAt
  };
}

function pulseWarmingUpFallback(store: IntelligenceStore, bootstrapped: boolean, error: string) {
  const dataSource = dataSourceState(store);
  const endpointCount = safeStoreEndpointCount(store);
  const endpointMetadata = endpointMetadataState(store);
  const effectiveBootstrapped = bootstrapped || store.providers.length > 0;
  const status = pulseCatalogStatusFromDataSource(dataSource, store.providers.length, effectiveBootstrapped);
  const catalogError = dataSource.mode === 'live_pay_sh_catalog' ? null : sanitizeCatalogError(error);
  return {
    providerCount: store.providers.length,
    endpointCount,
    eventCount: store.events.length,
    averageTrust: null,
    averageSignal: null,
    hottestNarrative: null,
    topTrust: [],
    topSignal: [],
    unknownTelemetry: {
      uptime: 0,
      latency: 0,
      responseValidity: 0,
      receiptReliability: 0,
      socialVelocity: 0,
      onchainLiquidityResonance: 0
    },
    interpretations: [],
    data_source: dataSource,
    catalog_status: status,
    catalog_error: catalogError,
    endpoint_metadata: endpointMetadata,
    updatedAt: new Date().toISOString(),
    bootstrapped: effectiveBootstrapped,
    warming_up: status === 'warming_up'
  };
}

function summarizeNarrative(item: IntelligenceStore['narratives'][number] | null) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    heat: item.heat ?? null,
    momentum: item.momentum ?? null,
    providerIds: [],
    keywords: [],
    summary: item.summary
  };
}

function summarizeAssessment(item: IntelligenceStore['trustAssessments'][number] | IntelligenceStore['signalAssessments'][number]) {
  const evidenceEventIds = Object.values(item.evidence).flat().map((entry) => entry.eventId).slice(0, PULSE_CAPS.maxEvidenceIdsInline);
  return {
    entityId: item.entityId,
    score: item.score,
    grade: 'grade' in item ? item.grade : undefined,
    narratives: 'narratives' in item ? item.narratives.slice(0, 5) : undefined,
    evidenceEventIds
  };
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function lightweightProviders(store: IntelligenceStore, maxItems: number) {
  const trustByProvider = latestAssessmentsByProvider(store.trustAssessments);
  const signalByProvider = latestAssessmentsByProvider(store.signalAssessments);
  const endpointCountZero = safeStoreEndpointCount(store) === 0;
  return store.providers.slice(0, maxItems).map((provider) => {
    const trust = trustByProvider.get(provider.id) ?? null;
    const signal = signalByProvider.get(provider.id) ?? null;
    const severity = classifyProviderDossierSeverity(provider, trust, signal, store.events);
    return {
      id: provider.id,
      provider_id: provider.id,
      fqn: provider.fqn ?? provider.namespace ?? null,
      name: provider.name,
      category: provider.category,
      observed_at: provider.observed_at ?? provider.observedAt ?? provider.lastSeenAt ?? null,
      ingested_at: provider.ingested_at ?? provider.ingestedAt ?? provider.lastSeenAt ?? null,
      catalog_generated_at: provider.catalog_generated_at ?? provider.catalogGeneratedAt ?? null,
      trust: {
        score: trust?.score ?? null,
        grade: trust?.grade ?? 'unknown'
      },
      signal: {
        score: signal?.score ?? null
      },
      severity: severity.severity,
      risk: severity.severity_reason,
      endpointCount: safeProviderEndpointCount(provider),
      endpointMetadata: {
        available: endpointCountZero ? false : !provider.endpointMetadataPartial,
        reason: endpointCountZero ? 'endpoint_count_zero_or_missing' : provider.endpointMetadataPartial ? 'partial_from_live_catalog' : null
      }
    };
  });
}

function latestAssessmentsByProvider<T extends { entityId: string; assessedAt: string }>(items: T[]) {
  const byProvider = new Map<string, T>();
  for (const item of items) {
    const existing = byProvider.get(item.entityId);
    if (!existing || Date.parse(item.assessedAt) > Date.parse(existing.assessedAt)) byProvider.set(item.entityId, item);
  }
  return byProvider;
}

function safeProviderEndpointCount(provider: IntelligenceStore['providers'][number]) {
  return typeof provider.endpointCount === 'number' && Number.isFinite(provider.endpointCount) ? Math.max(0, provider.endpointCount) : 0;
}

function safeStoreEndpointCount(store: IntelligenceStore) {
  return store.providers.reduce((sum, provider) => sum + safeProviderEndpointCount(provider), 0);
}

function copyStoreInto(target: IntelligenceStore, source: IntelligenceStore) {
  target.events = source.events;
  target.providers = source.providers;
  target.endpoints = source.endpoints;
  target.trustAssessments = source.trustAssessments;
  target.signalAssessments = source.signalAssessments;
  target.narratives = source.narratives;
  target.ingestionRuns = source.ingestionRuns;
  target.monitorRuns = source.monitorRuns;
  target.dataSource = source.dataSource;
}

function logTiming(stage: string, startedAtMs: number) {
  console.log(JSON.stringify({ event: 'timing', stage, duration_ms: Date.now() - startedAtMs }));
}

function catalogStatusFromDataSource(dataSource: IntelligenceStore['dataSource']) {
  if (!dataSource) return 'warming_up';
  if (dataSource.mode === 'live_pay_sh_catalog' && dataSource.error) return 'live_fetch_failed';
  if (dataSource.mode === 'live_pay_sh_catalog') return 'live_ok';
  if (dataSource.used_fixture) return 'fixture_fallback';
  return 'unknown';
}

function pulseCatalogStatusFromDataSource(dataSource: ReturnType<typeof dataSourceState>, providerCount: number, bootstrapped: boolean) {
  if (dataSource.mode === 'live_pay_sh_catalog' && !dataSource.error) return 'live';
  if (providerCount > 0) return 'ready';
  if (dataSource.mode === 'live_pay_sh_catalog' && dataSource.error) return 'live_fetch_failed';
  if (dataSource.used_fixture) return 'fixture_fallback';
  return bootstrapped ? 'ready' : 'warming_up';
}

function endpointMetadataState(store: IntelligenceStore) {
  if (store.endpoints.length > 0) {
    return {
      available: true,
      mode: 'full',
      reason: null
    };
  }
  if (store.providers.length > 0) {
    return {
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    };
  }
  return {
    available: false,
    mode: 'unavailable',
    reason: 'endpoint_count_zero_or_missing'
  };
}

function isLiveBootstrapSatisfied(store: IntelligenceStore) {
  return store.providers.length > 0
    && store.dataSource?.mode === 'live_pay_sh_catalog'
    && store.dataSource?.used_fixture === false;
}

function sanitizeCatalogError(value: string | null) {
  if (!value) return null;
  return value.slice(0, 240);
}

function handleParsed<T>(body: unknown, schema: z.ZodSchema<T>, next: (input: T) => unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
  return next(parsed.data);
}

function graphNodes(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => {
      const trustAssessment = store.trustAssessments.find((item) => item.entityId === provider.id);
      const signalAssessment = store.signalAssessments.find((item) => item.entityId === provider.id);
      const trustScore = trustAssessment?.score ?? null;
      const signalScore = signalAssessment?.score ?? null;
      const proofState = trustScore !== null && trustScore !== undefined
        ? trustScore >= 85 ? 'validated' : trustScore >= 60 ? 'compounding' : 'disputed'
        : 'unproven';
      return {
        id: provider.id,
        type: 'provider',
        label: provider.name,
        summary: provider.description ?? `Provider node for ${provider.name}.`,
        cluster_id: clusterIdForCategory(provider.category),
        proof_state: proofState,
        confidence_score: trustScore ?? Math.round((provider.confidence ?? 0.7) * 100),
        velocity_score: signalScore ?? 58,
        linked_provider_ids: [provider.id],
        created_at: provider.firstSeenAt,
        updated_at: provider.lastSeenAt,
        category: provider.category,
        provider_id: provider.id,
        observed_at: provider.lastSeenAt,
        catalog_generated_at: provider.catalogGeneratedAt ?? null,
        ingested_at: provider.ingestedAt ?? provider.lastSeenAt,
        source: provider.source,
        derivation_reason: 'Graph provider node is derived from provider catalog membership.',
        confidence: provider.confidence ?? 1,
        ...classifyProviderDossierSeverity(provider, store.trustAssessments.find((item) => item.entityId === provider.id) ?? null, store.signalAssessments.find((item) => item.entityId === provider.id) ?? null, store.events),
        evidence: provider.evidence[0] ?? null
      };
    }),
    ...store.narratives.map((narrative) => ({
      id: narrative.id,
      type: 'narrative',
      label: narrative.title,
      summary: narrative.summary,
      cluster_id: clusterIdForNarrative(narrative.title),
      proof_state: narrative.evidence.length ? 'compounding' : 'unproven',
      confidence_score: Math.round((narrative.heat ?? 50)),
      velocity_score: Math.round((narrative.momentum ?? 50)),
      linked_provider_ids: narrative.providerIds,
      created_at: narrative.evidence[0]?.observedAt ?? NOW_FALLBACK,
      updated_at: narrative.evidence[0]?.observedAt ?? NOW_FALLBACK,
      heat: narrative.heat,
      provider_id: null,
      endpoint_id: null,
      observed_at: narrative.evidence[0]?.observedAt ?? null,
      catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null,
      ingested_at: narrative.evidence[0]?.ingestedAt ?? null,
      source: narrative.evidence[0]?.source ?? 'infopunks:deterministic-scoring',
      derivation_reason: 'Graph narrative node is derived from deterministic narrative clustering.',
      confidence: narrative.evidence.length ? 1 : 0.5,
      ...classifyNarrativeClusterSeverity(narrative),
      evidence: narrative.evidence[0] ?? null
    })),
    ...Array.from(new Set(store.providers.map((provider) => provider.category))).map((category) => ({
      id: `category-${category}`,
      type: 'category',
      label: category,
      summary: `Provider catalog category node for ${category}.`,
      cluster_id: clusterIdForCategory(category),
      proof_state: 'compounding',
      confidence_score: 72,
      velocity_score: 54,
      created_at: latestProviderTimestamp(store, category) ?? NOW_FALLBACK,
      updated_at: latestProviderTimestamp(store, category) ?? NOW_FALLBACK,
      provider_id: null,
      endpoint_id: null,
      observed_at: latestProviderTimestamp(store, category),
      catalog_generated_at: latestCatalogGeneratedAt(store, category),
      ingested_at: latestProviderTimestamp(store, category),
      source: 'pay.sh',
      derivation_reason: 'Graph category node is derived from provider catalog categories.',
      confidence: 1,
      ...classifyGraphSeverity('category')
    }))
  ];
}

function graphEdges(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({
      id: `edge-provider-category-${provider.id}`,
      source: provider.id,
      target: `category-${provider.category}`,
      source_node_id: provider.id,
      target_node_id: `category-${provider.category}`,
      type: 'provider_category',
      strength: Math.round((provider.confidence ?? 1) * 100),
      explanation: 'Graph edge is derived from provider category metadata.',
      provider_id: provider.id,
      endpoint_id: null,
      observed_at: provider.lastSeenAt,
      catalog_generated_at: provider.catalogGeneratedAt ?? null,
      ingested_at: provider.ingestedAt ?? provider.lastSeenAt,
      derivation_reason: 'Graph edge is derived from provider category metadata.',
      confidence: provider.confidence ?? 1,
      ...classifyGraphSeverity('edge'),
      evidenceCount: provider.evidence.length,
      evidence: provider.evidence[0] ?? null
    })),
    ...store.narratives.flatMap((narrative) => narrative.providerIds.map((providerId) => ({
      id: `edge-narrative-provider-${narrative.id}-${providerId}`,
      source: narrative.id,
      target: providerId,
      source_node_id: narrative.id,
      target_node_id: providerId,
      type: 'amplification',
      strength: narrative.evidence.length ? 76 : 52,
      explanation: 'Graph edge is derived from narrative keyword membership.',
      provider_id: providerId,
      endpoint_id: null,
      observed_at: narrative.evidence[0]?.observedAt ?? null,
      catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null,
      ingested_at: narrative.evidence[0]?.ingestedAt ?? null,
      derivation_reason: 'Graph edge is derived from narrative keyword membership.',
      confidence: narrative.evidence.length ? 1 : 0.5,
      ...classifyNarrativeClusterSeverity(narrative),
      evidenceCount: narrative.evidence.length,
      evidence: narrative.evidence[0] ?? null
    })))
  ];
}

function buildGraphPayload(store: IntelligenceStore) {
  const legacyNodes = graphNodes(store);
  const legacyEdges = graphEdges(store);
  const signalGraph = getSignalGraph();
  const mergedNodes = [...signalGraph.nodes, ...legacyNodes].filter((node, index, array) => array.findIndex((candidate) => candidate.id === node.id) === index);
  const mergedEdges = [
    ...signalGraph.edges.map((edge) => ({ ...edge, source: edge.source_node_id, target: edge.target_node_id })),
    ...legacyEdges
  ].filter((edge, index, array) => array.findIndex((candidate) => candidate.id === edge.id || `${candidate.source_node_id ?? candidate.source}:${candidate.target_node_id ?? candidate.target}:${candidate.type}` === `${edge.source_node_id ?? edge.source}:${edge.target_node_id ?? edge.target}:${edge.type}`) === index);
  const proofStateNodes = mergedNodes.filter((node) => typeof node === 'object' && node !== null && 'proof_state' in node);
  return {
    tagline: signalGraph.tagline,
    clusters: signalGraph.clusters,
    nodes: mergedNodes,
    edges: mergedEdges,
    ripples: signalGraph.ripples,
    stats: {
      node_count: mergedNodes.length,
      edge_count: mergedEdges.length,
      cluster_count: signalGraph.clusters.length,
      validated_count: proofStateNodes.filter((node) => node.proof_state === 'validated').length,
      disputed_count: proofStateNodes.filter((node) => node.proof_state === 'disputed').length,
      compounding_count: proofStateNodes.filter((node) => node.proof_state === 'compounding').length,
      last_updated_at: signalGraph.stats.last_updated_at
    },
    evidence: graphReceipt(store)
  };
}

function graphReceipt(store: IntelligenceStore) {
  const latestEvent = [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;
  return {
    event_id: latestEvent?.id ?? null,
    provider_id: null,
    endpoint_id: null,
    observed_at: latestEvent?.observedAt ?? null,
    catalog_generated_at: store.dataSource?.generated_at ?? null,
    ingested_at: store.dataSource?.last_ingested_at ?? null,
    source: store.dataSource?.mode ?? 'fixture_fallback',
    derivation_reason: 'Graph layer is built deterministically from provider, category, and narrative records.',
    confidence: store.events.length ? 1 : 0.5,
    ...classifyGraphSeverity('graph')
  };
}

const NOW_FALLBACK = '2026-06-25T09:00:00.000Z';

function clusterIdForCategory(category: string) {
  if (/(payment|finance|crypto|wallet)/i.test(category)) return 'agentic_payments';
  if (/(machine|compute|translation|vision|navigation|storage)/i.test(category)) return 'machine_markets';
  if (/(search|data|ocr|audit|research)/i.test(category)) return 'pre_spend_intelligence';
  return 'ct_subcultures';
}

function clusterIdForNarrative(title: string) {
  if (/(carbon|credit|integrity)/i.test(title)) return 'carbon_finance_2_0';
  if (/(depin|machine|robot|market)/i.test(title)) return 'machine_markets';
  if (/(wallet|payment|solana|base|x402)/i.test(title)) return 'agentic_payments';
  if (/(route|receipt|proof|loop|claim)/i.test(title)) return 'pre_spend_intelligence';
  return 'ct_subcultures';
}

function latestProviderTimestamp(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.lastSeenAt).sort().reverse()[0] ?? null;
}

function latestCatalogGeneratedAt(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.catalogGeneratedAt).filter((value): value is string => Boolean(value)).sort().reverse()[0] ?? null;
}

function summarizeEvent(event: IntelligenceStore['events'][number]) {
  if (event.type === 'provider.checked') return providerReachabilitySummary(event);
  if (event.type === 'provider.reachable') return providerRootHealthSummary(event, 'healthy');
  if (event.type === 'provider.degraded') return providerRootHealthSummary(event, 'degraded');
  if (event.type === 'provider.failed') return providerRootHealthSummary(event, 'failed');
  if (event.type === 'provider.recovered') return providerRootHealthSummary(event, 'recovered');
  return typeof event.payload.summary === 'string' ? event.payload.summary : `${event.type} observed.`;
}

function renderInterpretationPage(req: FastifyRequest, interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], summary: ReturnType<typeof pulseSummary>) {
  const title = `${interpretation.interpretation_title} | Infopunks Pay.sh Radar`;
  const description = interpretation.interpretation_summary;
  const url = absoluteUrl(req, `/interpretations/${interpretation.interpretation_id}`);
  const dataSourceLabel = summary.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback';
  const propagationRelevant = isPropagationRelevant(interpretation, summary.propagation);
  const whyThisMatters = whyThisMattersSummary(interpretation);
  const receiptLinks = interpretation.supporting_event_ids.map((eventId) => ({ eventId, href: `/v1/events/${eventId}` }));
  const receiptSource = interpretation.evidence?.source ?? 'infopunks:interpretation-layer';
  const methodologyHref = '/#methodology';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #101418; }
    main { max-width: 860px; margin: 2.5rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #dde3ea; border-radius: 14px; padding: 1rem 1.2rem; margin-top: 1rem; }
    .meta { color: #3e4c59; font-size: 0.95rem; }
    .pill { display: inline-block; margin-right: 0.5rem; border-radius: 999px; padding: 0.15rem 0.55rem; border: 1px solid #c6d2df; font-size: 0.8rem; background: #f0f5fa; }
    ul { margin: 0.45rem 0 0 1.2rem; }
    h1, h2 { margin: 0; }
    h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    button { border: 1px solid #c6d2df; background: #fff; border-radius: 8px; padding: 0.45rem 0.7rem; cursor: pointer; }
    a { color: #0043aa; }
  </style>
</head>
<body>
  <main>
    <p class="meta">Public Interpretation Artifact</p>
    <h1>${escapeHtml(interpretation.interpretation_title)}</h1>
    <p>${escapeHtml(interpretation.interpretation_summary)}</p>
    <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.8rem;">
      <span class="pill">severity: ${escapeHtml(interpretation.severity)}</span>
      <span class="pill">confidence: ${escapeHtml(String(interpretation.confidence))}</span>
      <span class="pill">window: ${escapeHtml(interpretation.observed_window.started_at ?? 'n/a')} to ${escapeHtml(interpretation.observed_window.ended_at ?? 'n/a')}</span>
    </div>
    <button id="copy-share-url" type="button">Copy/Share URL</button>
    <span id="copy-state" class="meta" style="margin-left:0.5rem;"></span>

    <section class="card">
      <h2>Why this matters</h2>
      <p>${escapeHtml(whyThisMatters)}</p>
    </section>

    <section class="card">
      <h2>Evidence and Context</h2>
      <p><strong>Reason:</strong> ${escapeHtml(interpretation.interpretation_reason)}</p>
      <p><strong>Affected categories:</strong> ${interpretation.affected_categories.length ? interpretation.affected_categories.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Affected providers:</strong> ${interpretation.affected_providers.length ? interpretation.affected_providers.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Supporting event IDs:</strong> ${interpretation.supporting_event_ids.length ? interpretation.supporting_event_ids.map(escapeHtml).join(', ') : 'none'}</p>
      <p><strong>Supporting receipt links:</strong></p>
      <ul>
        ${receiptLinks.length
    ? receiptLinks.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.eventId)}</a></li>`).join('')
    : '<li>none</li>'}
      </ul>
      <p><strong>Evidence source:</strong> ${escapeHtml(receiptSource)}</p>
      ${propagationRelevant
    ? `<p><strong>Propagation context:</strong> ${escapeHtml(summary.propagation.propagation_state)} (${escapeHtml(summary.propagation.severity)}). ${escapeHtml(summary.propagation.propagation_reason)}</p>`
    : ''}
      <p><a href="${escapeHtml(methodologyHref)}">Methodology</a></p>
      <p class="meta"><strong>Data source:</strong> ${escapeHtml(dataSourceLabel)} | <strong>Last updated:</strong> ${escapeHtml(summary.generatedAt)}</p>
    </section>
  </main>
  <script>
    (function () {
      var button = document.getElementById('copy-share-url');
      var state = document.getElementById('copy-state');
      if (!button) return;
      button.addEventListener('click', function () {
        var shareUrl = window.location.href;
        var done = function (ok) { if (state) state.textContent = ok ? 'Copied.' : 'Copy failed.'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () { done(true); }).catch(function () { done(false); });
        } else {
          done(false);
        }
      });
    })();
  </script>
</body>
</html>`;
}

function renderInterpretationNotFoundPage(req: FastifyRequest, interpretationId: string, generatedAt: string) {
  const title = 'Interpretation Not Found | Infopunks Pay.sh Radar';
  const description = `No interpretation exists for id ${interpretationId}.`;
  const url = absoluteUrl(req, `/interpretations/${interpretationId}`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;">
  <h1>Interpretation Not Found</h1>
  <p>No deterministic interpretation exists for <code>${escapeHtml(interpretationId)}</code>.</p>
  <p>Last checked: ${escapeHtml(generatedAt)}</p>
</body>
</html>`;
}

function whyThisMattersSummary(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number]) {
  if (interpretation.severity === 'critical' || interpretation.severity === 'warning') return 'Operational risk is elevated across observed providers, so route selection and trust assumptions may need immediate review.';
  if (interpretation.severity === 'watch') return 'This pattern indicates meaningful movement that could expand, so teams should monitor for spread or recurrence before treating conditions as normal.';
  if (interpretation.severity === 'info') return 'The pattern is informative for prioritization and category focus, but it does not currently indicate broad reliability degradation.';
  return 'Current evidence indicates no broad ecosystem degradation pattern above deterministic thresholds.';
}

function isPropagationRelevant(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], propagation: ReturnType<typeof pulseSummary>['propagation']) {
  if (propagation.propagation_state === 'unknown') return false;
  if (interpretation.supporting_event_ids.some((id) => propagation.supporting_event_ids.includes(id))) return true;
  const affected = new Set(interpretation.affected_providers);
  return propagation.affected_providers.some((provider) => affected.has(provider.provider_id));
}

function absoluteUrl(req: FastifyRequest, pathname: string) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  const protocol = req.headers['x-forwarded-proto'] ?? 'http';
  return `${protocol}://${host}${pathname}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceTag(html: string, pattern: RegExp, replacement: string) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function injectNarrativeRouteMetadata(html: string, urlPath: string, metadataOverride?: NarrativeMetadata | null) {
  const metadata = metadataOverride ?? getNarrativeMetadataForPath(urlPath);
  if (!metadata) return html;

  const absoluteCanonical = `${NARRATIVE_PUBLIC_HOST}${metadata.canonicalPath}`;
  const replacements = [
    [/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`],
    [/<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(metadata.description)}" />`],
    [/<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(metadata.ogTitle)}" />`],
    [/<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(metadata.ogDescription)}" />`],
    [/<meta\s+property="og:type"\s+content="[\s\S]*?"\s*\/?>/i, '<meta property="og:type" content="website" />'],
    [/<meta\s+property="og:url"\s+content="[\s\S]*?"\s*\/?>/i, `<meta property="og:url" content="${escapeHtml(absoluteCanonical)}" />`],
    [/<meta\s+property="og:image"\s+content="[\s\S]*?"\s*\/?>/i, metadata.ogImageUrl ? `<meta property="og:image" content="${escapeHtml(metadata.ogImageUrl)}" />` : ''],
    [/<meta\s+property="og:image:width"\s+content="[\s\S]*?"\s*\/?>/i, metadata.ogImageUrl ? `<meta property="og:image:width" content="${escapeHtml(String(metadata.ogImageWidth))}" />` : ''],
    [/<meta\s+property="og:image:height"\s+content="[\s\S]*?"\s*\/?>/i, metadata.ogImageUrl ? `<meta property="og:image:height" content="${escapeHtml(String(metadata.ogImageHeight))}" />` : ''],
    [/<meta\s+name="twitter:card"\s+content="[\s\S]*?"\s*\/?>/i, `<meta name="twitter:card" content="${escapeHtml(metadata.twitterCard)}" />`],
    [/<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(metadata.twitterTitle)}" />`],
    [/<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(metadata.twitterDescription)}" />`],
    [/<meta\s+name="twitter:image"\s+content="[\s\S]*?"\s*\/?>/i, metadata.twitterImageUrl ? `<meta name="twitter:image" content="${escapeHtml(metadata.twitterImageUrl)}" />` : ''],
    [/<link\s+rel="canonical"\s+href="[\s\S]*?"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(absoluteCanonical)}" />`]
  ] as const;

  let output = html;
  for (const [pattern, replacement] of replacements) {
    output = replaceTag(output, pattern, replacement);
  }

  const headClose = /<\/head>/i;
  const ensure = (pattern: RegExp, snippet: string) => {
    if (pattern.test(output)) return;
    output = output.replace(headClose, `    ${snippet}\n  </head>`);
  };

  ensure(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  ensure(/<meta\s+name="description"/i, `<meta name="description" content="${escapeHtml(metadata.description)}" />`);
  ensure(/<meta\s+property="og:title"/i, `<meta property="og:title" content="${escapeHtml(metadata.ogTitle)}" />`);
  ensure(/<meta\s+property="og:description"/i, `<meta property="og:description" content="${escapeHtml(metadata.ogDescription)}" />`);
  ensure(/<meta\s+property="og:type"/i, '<meta property="og:type" content="website" />');
  ensure(/<meta\s+property="og:url"/i, `<meta property="og:url" content="${escapeHtml(absoluteCanonical)}" />`);
  if (metadata.ogImageUrl) {
    ensure(/<meta\s+property="og:image"/i, `<meta property="og:image" content="${escapeHtml(metadata.ogImageUrl)}" />`);
    ensure(/<meta\s+property="og:image:width"/i, `<meta property="og:image:width" content="${escapeHtml(String(metadata.ogImageWidth))}" />`);
    ensure(/<meta\s+property="og:image:height"/i, `<meta property="og:image:height" content="${escapeHtml(String(metadata.ogImageHeight))}" />`);
  }
  ensure(/<meta\s+name="twitter:card"/i, `<meta name="twitter:card" content="${escapeHtml(metadata.twitterCard)}" />`);
  ensure(/<meta\s+name="twitter:title"/i, `<meta name="twitter:title" content="${escapeHtml(metadata.twitterTitle)}" />`);
  ensure(/<meta\s+name="twitter:description"/i, `<meta name="twitter:description" content="${escapeHtml(metadata.twitterDescription)}" />`);
  if (metadata.twitterImageUrl) {
    ensure(/<meta\s+name="twitter:image"/i, `<meta name="twitter:image" content="${escapeHtml(metadata.twitterImageUrl)}" />`);
  }
  ensure(/<link\s+rel="canonical"/i, `<link rel="canonical" href="${escapeHtml(absoluteCanonical)}" />`);

  return output;
}
