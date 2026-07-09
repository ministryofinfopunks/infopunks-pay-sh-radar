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
import { getRhChainPayload, listRhChainMemes, listRhChainReceipts, listRhChainSignals } from '../data/rhChain';
import { getLatestSignalUpdate, getSignalUpdate, getSignalUpdateSummary, listSignalUpdates } from '../data/signalUpdates';
import { abundanceClaimsFeed, getAbundanceDeskPayload, machineWorkReceipts } from '../data/abundanceDesk';
import { createSignalHuntSubmission, getSignalHuntCandidate, getSignalHuntCounts, listSignalHuntCandidates, verifySignalHuntCandidate } from '../data/signalHunt';
import {
  createAttentionMarketIntakeSubmission,
  getAttentionMarketIntakeRequirements,
  getAttentionMarketSignalBySlug,
  getAttentionMarketWatchIndex
} from '../data/attentionMarketWatch';
import { getNarrativeMetadataForPath, NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';
import { renderAttentionMarketWatchOgImage, renderNarrativesOgImage, renderRevenueReceiptOgImage, renderRevenueReceiptsIndexOgImage, renderSignalHuntOgImage, renderSignalReportOgImage, renderSignalUpdateOgImage, renderUnicornRadarIndexOgImage, renderUnicornRadarOgImage } from '../shared/narrativeOg';
import { renderOgPng } from '../server/narrativeOgPng';
import { applyPayShCatalogIngestion } from '../ingestion/payShCatalogAdapter';
import { createIntelligenceStore, defaultRepository, emptyIntelligenceStore, IntelligenceStore, runPayShIngestion, runPayShIngestionWithOptions } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
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
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];
const CORS_MAX_AGE_SECONDS = 86_400;

export type CreateAppOptions = {
  clientDistDir?: string | null;
};

export async function createApp(
  preloadedStore?: IntelligenceStore,
  repository: IntelligenceRepository = defaultRepository(),
  options: CreateAppOptions = {}
) {
  const config = loadRuntimeConfig();
  const app = Fastify({ logger: false });
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
    : config.databaseUrl
      ? new PostgresMachinePreflightReceiptStorageAdapter(config.databaseUrl)
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
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onRequest', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_start', id: req.id, method: req.method, url: req.url, started_at: new Date(startedAtMs).toISOString() }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onRequest', id: req.id }));
  });
  app.addHook('onError', async (req, reply, error) => {
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onError', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_errored', id: req.id, method: req.method, url: req.url, status_code: reply.statusCode, error: error.message }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onError', id: req.id }));
  });
  app.addHook('onResponse', async (req, reply) => {
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onResponse', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_complete', id: req.id, method: req.method, url: req.url, status_code: reply.statusCode }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onResponse', id: req.id }));
  });
  const store = preloadedStore ?? emptyIntelligenceStore();
  const repositoryDbStatus = (): 'ok' | 'degraded' | 'unavailable' | null => {
    try {
      const getDbStatus = (repository as IntelligenceRepository & { getDbStatus?: () => 'ok' | 'degraded' | 'unavailable' }).getDbStatus;
      if (typeof getDbStatus !== 'function') return null;
      const status = getDbStatus?.();
      return status === 'ok' || status === 'degraded' || status === 'unavailable' ? status : null;
    } catch {
      return null;
    }
  };
  const dbStatusWithFallback = (): 'ok' | 'degraded' | 'unavailable' => {
    const status = repositoryDbStatus();
    if (status) return status;
    return persistenceMode === 'postgres' ? 'degraded' : 'unavailable';
  };
  const healthDbDiagnostics = () => ({
    persistence: persistenceMode,
    persistence_mode: persistenceMode,
    dbStatus: dbStatusWithFallback(),
    db_status: dbStatusWithFallback()
  });
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

  app.get('/health', async () => {
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
    dbMode: persistenceMode,
    dbStatus: dbStatusWithFallback(),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: catalogStatusFromDataSource(store.dataSource)
  }), () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: persistenceMode,
    dbStatus: dbStatusWithFallback(),
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
  app.get('/v1/rh-chain', async () => ({ data: safeJsonExport(getRhChainPayload()) }));
  app.get('/v1/rh-chain/memes', async () => ({ data: safeJsonExport({
    generated_at: getRhChainPayload().generated_at,
    source_policy: getRhChainPayload().source_policy,
    memes: listRhChainMemes()
  }) }));
  app.get('/v1/rh-chain/signals', async () => ({ data: safeJsonExport({
    generated_at: getRhChainPayload().generated_at,
    source_policy: getRhChainPayload().source_policy,
    ...listRhChainSignals()
  }) }));
  app.get('/v1/rh-chain/receipts', async () => ({ data: safeJsonExport({
    generated_at: getRhChainPayload().generated_at,
    receipts: listRhChainReceipts()
  }) }));
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
      if (urlPath.startsWith('/v1/') || urlPath === '/health' || urlPath === '/version' || urlPath === '/status' || urlPath === '/openapi.json') {
        return reply.code(404).send({ error: 'not_found' });
      }
      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const target = normalize(join(clientDistDir, relative));
      if (!target.startsWith(clientDistDir)) return reply.code(403).send({ error: 'forbidden' });
      try {
        const file = await stat(target);
        if (file.isFile()) {
          return reply.type(contentTypeFor(target)).send(createReadStream(target));
        }
      } catch {
        // fall through to SPA index
      }
      const html = await readFile(clientIndexPath, 'utf8');
      return reply.type('text/html; charset=utf-8').send(injectNarrativeRouteMetadata(html, urlPath));
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

  return app;

  function refreshBackgroundAnalytics() {
    setTimeout(() => {
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

function injectNarrativeRouteMetadata(html: string, urlPath: string) {
  const metadata = getNarrativeMetadataForPath(urlPath);
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
