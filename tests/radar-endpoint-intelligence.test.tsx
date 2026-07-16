// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const observedAt = '2026-05-08T10:00:00.000Z';

const receipt = {
  event_id: 'evt-alpha',
  provider_id: 'alpha',
  endpoint_id: null,
  observed_at: observedAt,
  catalog_generated_at: observedAt,
  ingested_at: observedAt,
  source: 'pay.sh:test',
  derivation_reason: 'Endpoint intelligence test evidence.',
  confidence: 1,
  severity: 'informational'
};

const provider = {
  ...receipt,
  id: 'alpha',
  name: 'Alpha Data',
  namespace: 'pay/alpha',
  fqn: 'pay.alpha.data',
  category: 'data',
  description: 'Provider with endpoint intelligence.',
  endpointCount: 2,
  pricing: { ...receipt, min: 0.01, max: 0.05, clarity: 'clear', raw: '$0.01 - $0.05' },
  tags: ['data'],
  status: 'metered',
  serviceUrl: 'https://alpha.test',
  lastSeenAt: observedAt,
  latestTrustScore: 86,
  latestSignalScore: 74
};

const endpoint = {
  ...receipt,
  id: 'ep-lookup',
  endpoint_id: 'ep-lookup',
  endpointId: 'ep-lookup',
  providerId: 'alpha',
  provider_id: 'alpha',
  name: 'Lookup',
  path: '/lookup',
  method: 'GET',
  category: 'data',
  description: 'Lookup endpoint.',
  pricing: { ...receipt, min: 0.01, max: 0.01, clarity: 'clear', raw: '$0.01' },
  status: 'available',
  lastSeenAt: observedAt,
  latencyMsP50: null,
  routeEligible: true,
  schema: { input: { type: 'object' }, output: { type: 'object' } }
};

const normalizedEndpoint = {
  endpoint_id: 'ep-lookup',
  endpoint_name: 'Lookup',
  provider_id: 'alpha',
  provider_name: 'Alpha Data',
  category: 'data',
  method: 'GET',
  path: '/lookup',
  url: 'https://alpha.test/lookup',
  description: 'Lookup endpoint.',
  pricing: { min: 0.01, max: 0.01, currency: null, unit: null, clarity: 'clear', raw: '$0.01', source: null },
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  catalog_observed_at: observedAt,
  catalog_generated_at: observedAt,
  provider_trust_score: 86,
  provider_signal_score: 74,
  provider_grade: 'A',
  reachability_status: 'reachable',
  degradation_status: 'healthy',
  route_eligibility: true,
  route_rejection_reasons: [],
  metadata_quality_score: 90,
  pricing_clarity_score: 95,
  source: 'pay.sh:test'
};

const incompleteEndpoint = {
  ...normalizedEndpoint,
  endpoint_id: 'ep-incomplete',
  endpoint_name: null,
  method: null,
  path: null,
  url: null,
  category: null,
  pricing: { min: null, max: null, raw: null },
  input_schema: null,
  output_schema: null,
  catalog_observed_at: null,
  reachability_status: 'degraded',
  degradation_status: 'degraded',
  route_eligibility: false,
  route_rejection_reasons: ['endpoint_method_unknown', 'provider_degraded']
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function pulseSummary(recentDegraded = false) {
  return {
    generatedAt: observedAt,
    latest_event_at: observedAt,
    latest_batch_event_count: 1,
    ingest_interval_ms: 450000,
    latest_ingestion_run: null,
    counters: { providers: 1, endpoints: 2, events: 1, narratives: 0, unknownTelemetry: 1 },
    eventGroups: { discovery: { count: 1, recent: [] }, trust: { count: 0, recent: [] }, monitoring: { count: recentDegraded ? 1 : 0, recent: [] }, pricing: { count: 0, recent: [] }, schema: { count: 0, recent: [] }, signal: { count: 0, recent: [] } },
    timeline: [],
    trustDeltas: [],
    signalDeltas: [],
    recentDegradations: recentDegraded ? [{ ...receipt, id: 'degraded', type: 'provider.failed', category: 'monitoring', entityType: 'provider', entityId: 'alpha', providerId: 'alpha', providerName: 'Alpha Data', observedAt, summary: 'Provider failed safe metadata monitor.' }] : [],
    propagation: { propagation_state: 'unknown', propagation_reason: 'none', affected_cluster: null, affected_categories: [], affected_providers: [], first_observed_at: null, latest_observed_at: null, supporting_event_ids: [], confidence: 1, severity: 'unknown' },
    providerActivity: { '1h': [], '24h': [], '7d': [] },
    signalSpikes: [],
    interpretations: [],
    data_source: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: observedAt, provider_count: 1, last_ingested_at: observedAt, used_fixture: false }
  };
}

function anomalyWatchItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    subject_type: 'provider',
    provider_id: 'alpha',
    endpoint_id: null,
    anomaly_type: `critical_current_state_${index + 1}`,
    severity: 'critical',
    confidence: index === count - 1 ? 'medium' : 'high',
    explanation: `Provider critical state ${index + 1}.`,
    detected_at: new Date(Date.parse(observedAt) - index * 60_000).toISOString(),
    recommended_action: 'not recommended for routing',
    route_implication: 'Not recommended for routing.',
    evidence: [`test-evidence-${index + 1}`]
  }));
}

function installFetch(options: { endpoints?: unknown[]; detailEndpoints?: unknown[]; degraded?: boolean; readiness?: Record<string, unknown>; anomalyWatch?: ReturnType<typeof anomalyWatchItems>; evidenceLedger?: unknown; evidenceLedgerUnavailable?: boolean; bundleRunLedgerUnavailable?: boolean; bundleRunHistorySummaryMissing?: boolean; bundleRunFreshnessMissing?: boolean } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const path = pathOf(input);
    if (path === '/v1/pulse') return json({ providerCount: 1, endpointCount: options.endpoints?.length ?? 0, eventCount: 1, averageTrust: 86, averageSignal: 74, hottestNarrative: null, topTrust: [], topSignal: [], data_source: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: observedAt, provider_count: 1, last_ingested_at: observedAt, used_fixture: false }, updatedAt: observedAt });
    if (path === '/v1/providers') return json([provider]);
    if (path === '/v1/narratives') return json([]);
    if (path === '/v1/graph') return json({ nodes: [], edges: [] });
    if (path === '/v1/pulse/summary') return json(pulseSummary(options.degraded));
    if (path === '/v1/providers/featured') return json({ providerId: 'alpha', providerName: 'Alpha Data', category: 'data', rotationWindowMs: 60000, windowStartedAt: observedAt, nextRotationAt: '2026-05-08T10:01:00.000Z', index: 0, providerCount: 1, strategy: 'time_window_round_robin' });
    if (path === '/v1/radar/endpoints') return json({ generated_at: observedAt, source: {}, count: options.endpoints?.length ?? 0, endpoints: options.endpoints ?? [] });
    if (path === '/v1/radar/history/ecosystem') return json({
      generated_at: observedAt,
      window: '24h',
      sample_count: 2,
      history_available: true,
      reason: null,
      series: { average_trust: [{ at: '2026-05-08T09:00:00.000Z', value: 80 }, { at: observedAt, value: 86 }], average_signal: [{ at: '2026-05-08T09:00:00.000Z', value: 70 }, { at: observedAt, value: 74 }], degradation_count: [] },
      deltas: { average_trust_delta_24h: 6, average_signal_delta_24h: 4, degradation_delta_24h: 0, trend_direction: 'improving' },
      warnings: []
    });
    const watch = options.anomalyWatch ?? [{
      subject_type: 'provider',
      provider_id: 'alpha',
      endpoint_id: null,
      anomaly_type: options.degraded ? 'critical_current_state' : 'sudden_signal_spike',
      severity: options.degraded ? 'critical' : 'medium',
      confidence: 'high',
      explanation: options.degraded ? 'Provider is currently failed.' : 'Signal increased quickly.',
      detected_at: observedAt,
      recommended_action: options.degraded ? 'not recommended for routing' : 'route with caution',
      route_implication: options.degraded ? 'Not recommended for routing.' : 'Monitor before routing.',
      evidence: ['test-evidence']
    }];
    if (path === '/v1/radar/risk/ecosystem') return json({
      generated_at: observedAt,
      subject_type: 'ecosystem',
      subject_id: 'ecosystem',
      risk_score: options.degraded ? 84 : 32,
      risk_level: options.degraded ? 'elevated' : 'watch',
      history_available: true,
      sample_count: 4,
      explanation: 'Advisory ecosystem risk summary.',
      anomalies: options.degraded ? [{ anomaly_type: 'critical_current_state', severity: 'critical', confidence: 'high', explanation: 'Critical provider state present.', evidence: ['provider.failed'], detected_at: observedAt }] : [],
      evidence: ['providers=1'],
      warnings: [],
      recommended_action: options.degraded ? 'required fallback route' : 'route with caution',
      summary: {
        providers_by_risk_level: { low: 0, watch: options.degraded ? 0 : 1, elevated: options.degraded ? 0 : 0, critical: options.degraded || options.anomalyWatch ? 1 : 0, unknown: 0 },
        top_anomalies: [{ anomaly_type: options.degraded ? 'critical_current_state' : 'sudden_signal_spike', count: 1 }],
        categories_most_affected: [{ category: 'data', provider_count: 1 }],
        recent_critical_events: options.degraded ? [{ event_id: 'evt-critical', type: 'provider.failed', provider_id: 'alpha', endpoint_id: null, observed_at: observedAt }] : [],
        stale_catalog_warning: null,
        anomaly_watch: watch
      }
    });
    if (path === '/v1/radar/history/providers/alpha') return json(options.degraded ? {
      generated_at: observedAt,
      window: '24h',
      sample_count: 0,
      history_available: false,
      reason: 'No historical snapshots available yet',
      series: { trust_score: [], signal_score: [], degradation_count: [], latency_ms: [], reachability: [], metadata_quality: [], pricing_clarity: [] },
      deltas: { trust_delta_24h: null, signal_delta_24h: null, latency_delta_24h: null, degradation_delta_24h: null, route_eligibility_changed: null, trend_direction: 'unknown' },
      last_known_good: { last_seen_healthy_at: null, last_degraded_at: observedAt, last_failed_at: observedAt, current_health_state: 'failed', health_state_reason: 'test degraded' },
      warnings: ['history warming up']
    } : {
      generated_at: observedAt,
      window: '24h',
      sample_count: 2,
      history_available: true,
      reason: null,
      series: { trust_score: [{ at: '2026-05-08T09:00:00.000Z', value: 80 }, { at: observedAt, value: 86 }], signal_score: [{ at: '2026-05-08T09:00:00.000Z', value: 70 }, { at: observedAt, value: 74 }], degradation_count: [{ at: observedAt, value: 0 }], latency_ms: [], reachability: [], metadata_quality: [], pricing_clarity: [] },
      deltas: { trust_delta_24h: 6, signal_delta_24h: 4, latency_delta_24h: null, degradation_delta_24h: 0, route_eligibility_changed: false, trend_direction: 'improving' },
      last_known_good: { last_seen_healthy_at: observedAt, last_degraded_at: null, last_failed_at: null, current_health_state: 'reachable', health_state_reason: 'test reachable' },
      warnings: []
    });
    if (path === '/v1/providers/alpha') return json({ provider, endpoints: options.detailEndpoints ?? [], trustAssessment: { entityId: 'alpha', score: 86, grade: 'A', components: {}, unknowns: [] }, signalAssessment: { entityId: 'alpha', score: 74, narratives: ['data'], components: {}, unknowns: [] } });
    if (path === '/v1/radar/risk/providers/alpha') return json({
      generated_at: observedAt,
      subject_type: 'provider',
      subject_id: 'alpha',
      risk_score: options.degraded ? 92 : 28,
      risk_level: options.degraded ? 'critical' : 'low',
      history_available: true,
      sample_count: 3,
      explanation: options.degraded ? 'Current critical state.' : 'Low advisory risk.',
      anomalies: options.degraded ? [{ anomaly_type: 'critical_current_state', severity: 'critical', confidence: 'high', explanation: 'Provider failed.', evidence: ['provider.failed'], detected_at: observedAt }] : [],
      evidence: ['provider=alpha'],
      warnings: [],
      recommended_action: options.degraded ? 'not recommended for routing' : 'route normally'
    });
    if (path === '/v1/providers/alpha/intelligence') return json({
      ...receipt,
      provider,
      latest_trust_score: 86,
      latest_signal_score: 74,
      risk_level: options.degraded ? 'high' : 'low',
      coordination_eligible: !options.degraded,
      unknown_telemetry: ['uptime'],
      recent_changes: options.degraded ? [{ ...receipt, id: 'degraded', type: 'provider.failed', observedAt, summary: 'Provider failed safe metadata monitor.' }] : [],
      endpoint_count: provider.endpointCount,
      endpoint_health: { healthy: options.degraded ? 0 : 1, degraded: options.degraded ? 1 : 0, failed: 0, unknown: 1, last_checked_at: observedAt, median_latency_ms: null, recent_failures: [] },
      service_monitor: { status: options.degraded ? 'failed' : 'reachable', service_url: null, last_checked_at: observedAt, response_time_ms: null, status_code: null, monitor_mode: 'SAFE METADATA', check_type: null, safe_mode: true, explanation: options.degraded ? 'Provider failed safe metadata monitor.' : 'Provider reachable.' },
      category_tags: ['data'],
      last_seen_at: observedAt
    });
    if (path === '/v1/endpoints/ep-lookup/monitor') return json({ health: 'reachable', lastCheck: { observedAt, payload: {} }, recentFailures: [] });
    if (path === '/v1/radar/risk/endpoints/ep-lookup') return json({
      generated_at: observedAt,
      subject_type: 'endpoint',
      subject_id: 'ep-lookup',
      risk_score: options.degraded ? 80 : 34,
      risk_level: options.degraded ? 'elevated' : 'watch',
      history_available: true,
      sample_count: 3,
      explanation: 'Endpoint advisory risk.',
      anomalies: options.degraded ? [{ anomaly_type: 'repeated_degradation', severity: 'high', confidence: 'high', explanation: 'Repeated failures.', evidence: ['endpoint.failed'], detected_at: observedAt }] : [],
      evidence: ['endpoint=ep-lookup'],
      warnings: [],
      recommended_action: options.degraded ? 'required fallback route' : 'route with caution'
    });
    if (path === '/v1/radar/risk/endpoints/ep-incomplete') return json({
      generated_at: observedAt,
      subject_type: 'endpoint',
      subject_id: 'ep-incomplete',
      risk_score: 50,
      risk_level: 'unknown',
      history_available: false,
      sample_count: 1,
      explanation: 'Insufficient history.',
      anomalies: [],
      evidence: ['insufficient history'],
      warnings: ['insufficient_history'],
      recommended_action: 'insufficient history'
    });
    if (path === '/v1/radar/superiority-readiness') return json(options.readiness ?? {
      generated_at: observedAt,
      executable_provider_mappings_count: 1,
      categories_with_at_least_two_executable_mappings: [],
      categories_not_ready_for_comparison: ['data'],
      providers_with_proven_paid_execution: [],
      providers_with_only_catalog_metadata: ['alpha'],
      next_mappings_needed: ['data: +1 executable mapping(s)']
    });
    if (path === '/v1/radar/benchmark-readiness') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      categories: [{
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        executable_mapping_count: 2,
        candidate_mapping_count: 0,
        proven_execution_count: 2,
        benchmark_ready: true,
        superiority_ready: true,
        missing_requirements: [],
        recommended_next_mapping: 'finance/data/get SOL price: record normalized head-to-head benchmark metrics',
        mapping_ladder: ['StableCrypto: verified/proven', 'CoinGecko Onchain DEX API: verified/proven'],
        metadata_only_warning: null
      }],
      benchmark_ready_categories: ['finance/data'],
      superiority_ready_categories: ['finance/data'],
      not_ready_categories: [],
      missing_requirements: [],
      recommended_next_mappings: ['finance/data/get SOL price: record normalized head-to-head benchmark metrics'],
      metadata_only_warning: 'Catalog-estimated is not execution-proven.'
    });
    if (path === '/v1/radar/benchmarks') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      benchmarks: [{
        benchmark_id: 'finance-data-sol-price',
        category: 'finance/data',
        benchmark_intent: 'get SOL price',
        benchmark_recorded: true,
        winner_claimed: false,
        winner_status: 'no_clear_winner',
        winner_policy: {
          policy_id: 'sol-price-v0.1',
          policy_version: '0.1',
          required_successful_runs_per_route: 5,
          minimum_success_rate: 0.8,
          allowed_price_variance_percent: 1.0,
          latency_metric: 'median',
          required_confidence: ['high', 'medium'],
          scoring_weights: {
            reliability: 0.4,
            latency: 0.25,
            normalization_confidence: 0.15,
            price_consistency: 0.1,
            cost_clarity: 0.05,
            freshness: 0.05
          },
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          winner_rationale: 'Required run count met. Both routes succeeded 5/5 with high confidence. No winner claimed because scoring thresholds have not been finalized.',
          completed_runs: 5,
          required_runs: 5,
          next_step: 'define scoring thresholds before declaring a route winner'
        },
        next_step: 'define scoring thresholds before declaring a route winner',
        readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
        routes: [
          {
            provider_id: 'merit-systems-stablecrypto-market-data',
            route_id: 'merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/price',
            execution_status: 'proven',
            success: true,
            latency_ms: 5691,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md',
            normalized_output_available: true,
            extracted_price_usd: 87.57,
            extraction_path: 'solana.usd',
            success_rate: 1,
            median_latency_ms: 5691,
            p95_latency_ms: 6469,
            average_price_usd: 87.57,
            min_price_usd: 87.57,
            max_price_usd: 87.57,
            price_variance_percent: 0,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: { solana: { usd: '<price_usd>' } },
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-16T07:42:42.271Z',
            comparison_notes: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
          },
          {
            provider_id: 'paysponge-coingecko',
            route_id: 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
            execution_status: 'proven',
            success: true,
            latency_ms: 7761,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
            normalized_output_available: true,
            extracted_price_usd: 87.50392093173244,
            extraction_path: 'data[sol_usdc].attributes.base_token_price_usd',
            success_rate: 1,
            median_latency_ms: 7761,
            p95_latency_ms: 7946,
            average_price_usd: 87.50392093173244,
            min_price_usd: 87.50332626375734,
            max_price_usd: 87.50629960363277,
            price_variance_percent: 0.0033979504504081403,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: { data: [{ attributes: { name: 'SOL / USDC', base_token_price_usd: '<base_token_price_usd>', quote_token_price_usd: '<quote_token_price_usd>' } }] },
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-16T07:42:42.271Z',
            comparison_notes: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
          }
        ]
      }, {
        benchmark_id: 'finance-data-token-search',
        category: 'finance/data',
        benchmark_intent: 'token search',
        benchmark_recorded: true,
        winner_claimed: false,
        winner_status: 'no_clear_winner',
        winner_policy: {
          policy_id: 'token-search-v0.1',
          policy_version: '0.1',
          required_successful_runs_per_route: 5,
          minimum_success_rate: 0.8,
          allowed_price_variance_percent: 1.0,
          latency_metric: 'median',
          required_confidence: ['high', 'medium'],
          scoring_weights: {
            reliability: 0.4,
            latency: 0.25,
            normalization_confidence: 0.15,
            price_consistency: 0.1,
            cost_clarity: 0.05,
            freshness: 0.05
          },
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          winner_rationale: 'Required run count met. Both routes succeeded 5/5 with high confidence. No winner claimed because scoring thresholds have not been finalized.',
          completed_runs: 5,
          required_runs: 5,
          next_step: 'define scoring thresholds before declaring a route winner'
        },
        next_step: 'define scoring thresholds before declaring a route winner',
        readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
        routes: [
          {
            provider_id: 'merit-systems-stablecrypto-market-data',
            route_id: 'merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/onchain/search',
            execution_status: 'proven',
            success: true,
            latency_ms: 7048,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md',
            normalized_output_available: true,
            extracted_price_usd: null,
            extraction_path: 'data[].attributes',
            success_rate: 1,
            median_latency_ms: 7048,
            p95_latency_ms: 9946,
            average_price_usd: null,
            min_price_usd: null,
            max_price_usd: null,
            price_variance_percent: null,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-17T02:39:22.786Z',
            comparison_notes: 'Token-search benchmark recorded. No route winner is claimed. Scoring thresholds are not finalized.'
          },
          {
            provider_id: 'paysponge-coingecko',
            route_id: 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
            execution_status: 'proven',
            success: true,
            latency_ms: 8533,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md',
            normalized_output_available: true,
            extracted_price_usd: null,
            extraction_path: 'data[].attributes',
            success_rate: 1,
            median_latency_ms: 8533,
            p95_latency_ms: 10545,
            average_price_usd: null,
            min_price_usd: null,
            max_price_usd: null,
            price_variance_percent: null,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-17T02:39:22.786Z',
            comparison_notes: 'Token-search benchmark recorded. No route winner is claimed. Scoring thresholds are not finalized.'
          }
        ]
      }, {
        benchmark_id: 'document-ocr-text-extraction',
        category: 'document-ai',
        benchmark_intent: 'document OCR text extraction',
        benchmark_recorded: true,
        winner_claimed: false,
        winner_status: 'no_clear_winner',
        next_step: 'define scoring thresholds before declaring a route winner',
        readiness_note: 'Recorded benchmark with caveats preserved.',
        routes: [
          {
            provider_id: 'paysponge-reducto',
            route_id: 'paysponge-reducto:POST:/parse',
            execution_status: 'proven',
            success: true,
            latency_ms: 6000,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/document-ocr-text-extraction-benchmark-runs-2026-05-19.md',
            normalized_output_available: true,
            extracted_price_usd: null,
            extraction_path: null,
            success_rate: 1,
            median_latency_ms: 6000,
            p95_latency_ms: 7000,
            average_price_usd: null,
            min_price_usd: null,
            max_price_usd: null,
            price_variance_percent: null,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-19T00:00:00.000Z',
            comparison_notes: 'Recorded with caveat_objects preserved.'
          },
          {
            provider_id: 'google-vision',
            route_id: 'google-vision:POST:/v1/images:annotate',
            execution_status: 'proven',
            success: true,
            latency_ms: 6200,
            paid_execution_proven: true,
            proof_reference: 'live-proofs/document-ocr-text-extraction-benchmark-runs-2026-05-19.md',
            normalized_output_available: true,
            extracted_price_usd: null,
            extraction_path: null,
            success_rate: 1,
            median_latency_ms: 6200,
            p95_latency_ms: 7100,
            average_price_usd: null,
            min_price_usd: null,
            max_price_usd: null,
            price_variance_percent: null,
            completed_runs: 5,
            failed_runs: 0,
            execution_transport: 'pay_cli',
            cli_exit_code: 0,
            status_code: null,
            status_evidence: 'pay_cli exit code 0 and parsed response body',
            output_shape: null,
            normalization_confidence: 'high',
            freshness_timestamp: '2026-05-19T00:00:00.000Z',
            comparison_notes: 'Recorded with caveat_objects preserved.'
          }
        ]
      }]
    });
    if (path === '/v1/radar/mappings') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      count: 6,
      mappings: [
        {
          provider_name: 'StableCrypto',
          provider_id: 'merit-systems-stablecrypto-market-data',
          category: 'finance/data',
          benchmark_intent: 'get SOL price',
          endpoint_url: 'https://stablecrypto.dev/api/coingecko/price',
          method: 'POST',
          mapping_status: 'verified',
          execution_evidence_status: 'proven',
          proof_source: 'pay_cli',
          proof_reference: 'stablecrypto-sol-price-post-2026-05',
          verified_at: '2026-05-15',
          notes: 'Known successful executable mapping from Pay CLI.'
        },
        {
          provider_name: 'StableCrypto',
          provider_id: 'merit-systems-stablecrypto-market-data',
          category: 'finance/data',
          benchmark_intent: 'token search',
          endpoint_url: 'https://stablecrypto.dev/api/coingecko/onchain/search',
          method: 'POST',
          mapping_status: 'verified',
          execution_evidence_status: 'proven',
          proof_source: 'infopunks-pay-sh-agent-harness',
          proof_reference: 'live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md',
          verified_at: '2026-05-17',
          notes: 'Paid execution succeeded for StableCrypto token-search route. Two proven token-search routes now exist. Ready for normalized benchmark run. No route winner claimed.'
        },
        {
          provider_name: 'CoinGecko Onchain DEX API',
          provider_id: 'paysponge-coingecko',
          category: 'finance/data',
          benchmark_intent: 'token metadata',
          endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/tokens/{network}/{address}',
          method: 'GET',
          mapping_status: 'candidate',
          execution_evidence_status: 'unproven',
          proof_source: 'infopunks-pay-sh-agent-harness',
          proof_reference: 'live-proofs/token-metadata-provider-research-2026-05-18.md',
          verified_at: undefined,
          notes: 'Candidate only. Token metadata semantics need endpoint/method/request-shape verification. Not benchmark-ready. No winner claimed.'
        },
        {
          provider_name: 'StableCrypto',
          provider_id: 'merit-systems-stablecrypto-market-data',
          category: 'finance/data',
          benchmark_intent: 'token metadata',
          endpoint_url: 'https://stablecrypto.dev/api/coingecko/onchain/tokens/{network}/{address}',
          method: 'GET',
          mapping_status: 'candidate',
          execution_evidence_status: 'unproven',
          proof_source: 'infopunks-pay-sh-agent-harness',
          proof_reference: 'live-proofs/token-metadata-provider-research-2026-05-18.md',
          verified_at: undefined,
          notes: 'Candidate only. Token metadata semantics need endpoint/method/request-shape verification. Not benchmark-ready. No winner claimed.'
        },
        {
          provider_name: 'CoinGecko Onchain DEX API',
          provider_id: 'paysponge-coingecko',
          category: 'finance/data',
          benchmark_intent: 'token search',
          endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
          method: 'GET',
          mapping_status: 'verified',
          execution_evidence_status: 'proven',
          proof_source: 'infopunks-pay-sh-agent-harness',
          proof_reference: 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md',
          verified_at: '2026-05-17',
          notes: 'Paid execution succeeded for token-search route. Two proven token-search routes now exist. Ready for normalized benchmark run. No route winner claimed.'
        },
        {
          provider_name: 'CoinGecko Onchain DEX API',
          provider_id: 'paysponge-coingecko',
          category: 'finance/data',
          benchmark_intent: 'get SOL price',
          endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
          method: 'GET',
          mapping_status: 'verified',
          execution_evidence_status: 'proven',
          proof_source: 'infopunks-pay-sh-agent-harness',
          proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
          verified_at: '2026-05-15',
          notes: 'Paid x402 execution succeeded.'
        }
      ]
    });
    if (path === '/v1/radar/mapping-targets') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      count: 5,
      targets: [
        {
          category: 'finance/data',
          benchmark_intent: 'token metadata',
          current_state: 'candidate_mapping_found',
          needed_next_step: 'verify endpoint/method/request shape for token metadata candidates',
          suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
          why_it_matters: 'Token metadata is needed to normalize symbols/contracts before cross-provider benchmark comparisons.',
          readiness_blocker: 'candidate mappings exist, but no verified/proven token metadata route evidence is recorded'
        },
        {
          category: 'finance/data',
          benchmark_intent: 'token search',
          current_state: 'benchmark_ready',
          needed_next_step: 'Run normalized token-search benchmark.',
          suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
          why_it_matters: 'Search intent is a common pre-route step for symbol resolution and benchmark input shaping.',
          readiness_blocker: 'None; two comparable proven routes exist, but benchmark has not been recorded yet.'
        },
        {
          category: 'ai_ml/data',
          benchmark_intent: 'OCR comparison',
          current_state: 'needs_two_comparable_mappings',
          needed_next_step: 'Record two comparable verified mappings for OCR extraction with matching benchmark intent.',
          suggested_provider_candidates: [],
          why_it_matters: 'OCR benchmarking requires comparable extraction tasks to score quality and latency fairly.',
          readiness_blocker: 'Fewer than two comparable mappings are available for this category/intent.'
        },
        {
          category: 'messaging',
          benchmark_intent: 'SMS/send message',
          current_state: 'needs_candidate',
          needed_next_step: 'Add initial candidate mapping(s) for SMS send-message workflow.',
          suggested_provider_candidates: [],
          why_it_matters: 'Messaging routes are high-impact for agent notifications and recovery loops.',
          readiness_blocker: 'No candidate mapping rows are currently tracked for messaging send intent.'
        },
        {
          category: 'search',
          benchmark_intent: 'knowledge/search answer',
          current_state: 'needs_candidate',
          needed_next_step: 'Add first candidate mapping for answer-oriented search response.',
          suggested_provider_candidates: [],
          why_it_matters: 'Search answer benchmarks improve route quality for research and decision-support tasks.',
          readiness_blocker: 'No candidate mapping exists for this search benchmark intent.'
        }
      ]
    });
    if (path === '/v1/radar/bundles/morning-briefing/plan') return json({
      bundle_id: 'morning-briefing',
      label: 'Morning Briefing',
      status: 'recipe_scaffold',
      topic: 'AI, crypto, world news',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.05, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'world_news_search', label: 'World News Search', intent: 'Search and summarize current world news.', plan_status: 'included', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'ai_news_search', label: 'AI News Search', intent: 'Search and summarize current AI news.', plan_status: 'included', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'crypto_market_scan', label: 'Crypto Market Scan', intent: 'Pull token discovery, metadata, and SOL price context for briefing.', plan_status: 'included', evidence_dependencies: ['finance-data-sol-price'], evidence_health: 'recorded', execution_boundary: 'clean_402', reason: 'included', next_action: 'inspect benchmark history before execution' },
        { step_id: 'top_story_selection', label: 'Top Story Selection', intent: 'Select one top story for deeper analysis using prior evidence.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'deep_dive_synthesis', label: 'Deep Dive Synthesis', intent: 'Synthesize briefing findings into an agent-ready deep dive.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [],
      execution_boundary_summary: { clean_402: 3, paid_proven: 0, billing_unclear: 2, billable_probe_observed: 0, blocked: 0 },
      evidence_summary: { recorded: 5, caveated: 0, scaffold: 0, unknown: 0 },
      estimated_cost_usd: '0.02-0.05',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
    if (options.bundleRunLedgerUnavailable && path === '/v1/radar/bundles/morning-briefing/runs') return Promise.resolve(new Response('{}', { status: 503 }));
    const bundleRunHistorySummary = {
      history_count: 2,
      latest_run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
      previous_run_id: 'morning-briefing-run-2026-05-21-075521-pay-cli',
      source_count_delta: 1,
      latest_source_count: 10,
      previous_source_count: 9,
      observed_cost_available: false,
      observed_cost_state: 'unavailable',
      skipped_review_required_steps_stable: true,
      latest_skipped_step_count: 2,
      previous_skipped_step_count: 2,
      caveat_codes_latest: ['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'],
      caveat_codes_previous: ['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'],
      caveat_delta: { added: [], removed: [] },
      winner_claimed: false
    };
    const bundleRunFreshness = {
      last_controlled_run_at: '2026-05-21T08:45:56.919Z',
      latest_run_age_hours: 12.4,
      freshness_state: 'fresh',
      freshness_thresholds_hours: { fresh_until: 24, aging_until: 72 },
      recommended_agent_action: 'Inspect latest run detail before spend.'
    };
    const bundleRunAgentReadinessSummary = {
      ready_for_agent_review: true,
      requires_rerun_before_spend: false,
      requires_human_or_policy_approval: true,
      observed_cost_available: false,
      winner_claimed: false,
      decision_state: 'review_ready_caveated',
      blocking_reasons: [],
      review_reasons: ['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable', 'source_map_empty'],
      recommended_agent_action: 'Inspect latest run detail, skipped review-required steps, and caveats before spend.'
    };
    if (path === '/v1/radar/bundles/morning-briefing/runs') return json({
      bundle_id: 'morning-briefing',
      count: 2,
      latest_run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
      latest_generated_at: '2026-05-21T08:45:56.919Z',
      runs: [
        {
          run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
          status: 'controlled_live_run',
          evidence_health: 'caveated',
          generated_at: '2026-05-21T08:45:56.919Z',
          execution_mode: 'pay_cli',
          final_bundle_state: 'executed_with_review_required_skipped',
          estimated_cost_usd: '0.02-0.05',
          observed_cost_usd: null,
          executed_step_count: 3,
          skipped_step_count: 2,
          blocked_step_count: 0,
          source_count: 10,
          winner_claimed: false
        },
        {
          run_id: 'morning-briefing-run-2026-05-21-075521-pay-cli',
          status: 'controlled_live_run',
          evidence_health: 'caveated',
          generated_at: '2026-05-21T07:55:21.600Z',
          execution_mode: 'pay_cli',
          final_bundle_state: 'executed_with_review_required_skipped',
          estimated_cost_usd: '0.02-0.05',
          observed_cost_usd: null,
          executed_step_count: 3,
          skipped_step_count: 2,
          blocked_step_count: 0,
          source_count: 9,
          winner_claimed: false
        }
      ],
      ...(options.bundleRunHistorySummaryMissing ? {} : { history_summary: bundleRunHistorySummary }),
      ...(options.bundleRunFreshnessMissing ? {} : { freshness: bundleRunFreshness }),
      winner_claimed: false,
      agent_readiness_summary: bundleRunAgentReadinessSummary,
      agent_guidance: ['Bundle runs are Harness proof records, not benchmark claims.']
    });
    if (path === '/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-084556-pay-cli') return json({
      run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
      bundle_id: 'morning-briefing',
      status: 'controlled_live_run',
      evidence_health: 'caveated',
      winner_claimed: false,
      generated_at: '2026-05-21T08:45:56.919Z',
      execution_mode: 'pay_cli',
      final_bundle_state: 'executed_with_review_required_skipped',
      estimated_cost_usd: '0.02-0.05',
      observed_cost_usd: null,
      executed_steps: [{ step_id: 'world_news_search' }, { step_id: 'ai_news_search' }, { step_id: 'crypto_market_scan' }],
      skipped_steps: [{ step_id: 'top_story_selection' }, { step_id: 'deep_dive_synthesis' }],
      blocked_steps: [],
      source_map: [
        { label: 'World News | Latest Top Stories - Reuters', url: 'https://www.reuters.com/world/' },
        { label: 'World | Latest News & Updates - BBC', url: 'https://www.bbc.com/news/world' },
        { label: 'Top & Breaking World News Today | AP News', url: 'https://apnews.com/world-news' },
        { label: 'Crescendo AI', url: 'https://www.crescendo.ai/' }
      ],
      caveat_objects: [{ code: 'status_code_unavailable' }, { code: 'observed_cost_unavailable' }, { code: 'source_map_empty' }]
    });
    if (path === '/v1/radar/bundles/market-research/plan') return json({
      bundle_id: 'market-research',
      label: 'Market Research',
      status: 'research_only_pending_billing_review',
      topic: 'Circle Internet Group',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.1, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'web_research', label: 'Web Research', intent: 'Collect and normalize public web research results for the topic.', plan_status: 'blocked', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billable_probe_observed', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'entity_enrichment', label: 'Entity Enrichment', intent: 'Resolve entity metadata and identity context where available.', plan_status: 'blocked', evidence_dependencies: ['finance-data-token-search'], evidence_health: 'recorded', execution_boundary: 'billable_probe_observed', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'web_source_review', label: 'Web Source Review', intent: 'Review retrieved source coverage.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'company_profile', label: 'Company Profile', intent: 'Build entity profile.', plan_status: 'review_required', evidence_dependencies: ['finance-data-token-search'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'market_context', label: 'Market Context', intent: 'Summarize market context.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' },
        { step_id: 'risk_scan', label: 'Risk Scan', intent: 'Scan risks.', plan_status: 'review_required', evidence_dependencies: ['data-web-search-results'], evidence_health: 'recorded', execution_boundary: 'billing_unclear', reason: 'review required', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [{ step_id: 'web_research', reason: 'billable_probe_observed_not_allowed' }, { step_id: 'entity_enrichment', reason: 'billable_probe_observed_not_allowed' }],
      execution_boundary_summary: { clean_402: 0, paid_proven: 0, billing_unclear: 4, billable_probe_observed: 2, blocked: 2 },
      evidence_summary: { recorded: 2, caveated: 0, scaffold: 0, unknown: 0 },
      estimated_cost_usd: '0.05-0.20',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
    if (path === '/v1/radar/bundles/talent-market-scanner/plan') return json({
      bundle_id: 'talent-market-scanner',
      label: 'Talent Market Scanner',
      status: 'recipe_scaffold',
      topic: 'AI engineer',
      focus: null,
      region: null,
      language: null,
      constraints: { max_cost_usd: 0.05, allow_billing_unclear: false, allow_billable_probe_observed: false, allow_scaffold_routes: false, require_recorded_evidence: false },
      route_plan: [
        { step_id: 'role_search', label: 'Role Search', intent: 'Search role demand signals across public hiring sources.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'company_enrichment', label: 'Company Enrichment', intent: 'Enrich target companies with publicly visible hiring context.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'salary_scan', label: 'Salary Scan', intent: 'Collect salary context for comparable roles.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'hiring_signal_review', label: 'Hiring Signal Review', intent: 'Review hiring velocity and role demand signals.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' },
        { step_id: 'candidate_source_map', label: 'Candidate Source Map', intent: 'Map candidate source coverage.', plan_status: 'blocked', evidence_dependencies: [], evidence_health: 'scaffold', execution_boundary: 'blocked', reason: 'blocked', next_action: 'inspect benchmark history before execution' }
      ],
      blocked_steps: [{ step_id: 'role_search', reason: 'scaffold_not_allowed' }, { step_id: 'company_enrichment', reason: 'scaffold_not_allowed' }, { step_id: 'salary_scan', reason: 'scaffold_not_allowed' }, { step_id: 'hiring_signal_review', reason: 'scaffold_not_allowed' }, { step_id: 'candidate_source_map', reason: 'scaffold_not_allowed' }],
      execution_boundary_summary: { clean_402: 0, paid_proven: 0, billing_unclear: 0, billable_probe_observed: 0, blocked: 5 },
      evidence_summary: { recorded: 0, caveated: 0, scaffold: 5, unknown: 0 },
      estimated_cost_usd: '0.03-0.12',
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.',
      winner_claimed: false
    });
    if (options.evidenceLedgerUnavailable && path === '/v1/radar/evidence-ledger') return Promise.resolve(new Response('{}', { status: 503 }));
    if (path === '/v1/radar/evidence-ledger') return json(options.evidenceLedger ?? {
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      ledger_state: {
        recorded_benchmarks: 5,
        total_benchmarks: 10,
        total_artifacts: 6,
        total_recorded_runs: 40,
        proven_routes: 10,
        winner_claimed: false,
        latest_recorded_at: '2026-05-19T00:00:00.000Z'
      },
      recorded_lanes: [
        { benchmark_id: 'finance-data-sol-price', label: 'SOL Price', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt },
        { benchmark_id: 'finance-data-token-search', label: 'Token Search', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt },
        { benchmark_id: 'finance-data-token-metadata', label: 'Token Metadata', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt },
        { benchmark_id: 'data-web-search-results', label: 'Web Search Results', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt },
        { benchmark_id: 'document-ocr-text-extraction', label: 'Document OCR Text Extraction', status: 'recorded', artifact_count: 2, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: '2026-05-19T00:00:00.000Z' }
      ],
      scaffold_lanes: [
        { benchmark_id: 'communications-email-delivery', label: 'Communications Email Delivery', status: 'scaffold', why_not_promoted: ['StableEmail paid-executed and caveated', 'AgentMail blocked / no second comparable route', 'no benchmark artifact'] },
        { benchmark_id: 'solana-infra-account-balance', label: 'Solana Account Balance', status: 'scaffold', why_not_promoted: ['QuickNode unpaid 402 confirmed', 'paid run failed', 'no second comparable route', 'no benchmark artifact'] },
        { benchmark_id: 'social-data-reddit-post-search', label: 'Reddit Post Search', status: 'scaffold', why_not_promoted: ['StableEnrich paid-proven and caveated', 'StableSocial paid-compatible but semantic proof failed', 'no second paid-proven comparable route', 'no benchmark artifact'] },
        { benchmark_id: 'maps-place-search-results', label: 'Maps Place Search Results', status: 'scaffold', why_not_promoted: ['StableEnrich paid-proven but degraded (missing names/addresses/coordinates, location unconfirmed)', 'Google Places paid-executed and one paid diagnostic retry (includedType=cafe) still returned zero recognizable place candidates', 'no second paid-proven comparable route', 'no benchmark artifact'] },
        { benchmark_id: 'audio-speech-transcription', label: 'Audio Speech Transcription', status: 'scaffold', why_not_promoted: ['Google Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven', 'Alibaba Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven', 'both routes remain candidate/unproven with degraded evidence', 'no benchmark artifact'] }
      ],
      latest_artifacts: [
        { artifact_id: 'document-ocr-text-extraction-benchmark-runs-2026-05-19', benchmark_id: 'document-ocr-text-extraction', label: 'Document OCR Text Extraction', recorded_at: '2026-05-19T00:00:00.000Z', recorded_runs: 10, routes_count: 2, winner_claimed: false }
      ]
    });
    if (path === '/v1/radar/preflight') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      input: { intent: 'get SOL price', category: 'data', constraints: { min_trust: 80 } },
      recommended_route: { provider_id: 'alpha', provider_name: 'Alpha Data', endpoint_id: 'ep-lookup', endpoint_name: 'Lookup', trust_score: 86, signal_score: 74, route_eligibility: true, confidence: 90, reasons: ['mapping_complete'], rejection_reasons: [], mapping_status: 'complete', reachability_status: 'reachable', pricing_status: 'clear', predictive_risk: { predictive_risk_score: 34, predictive_risk_level: 'watch', history_available: true, sample_count: 3, explanation: 'Watch advisory.', evidence: ['signal spike'], warnings: [], recommended_action: 'route with caution', top_anomaly: { anomaly_type: 'sudden_signal_spike', severity: 'medium', confidence: 'high', explanation: 'Signal jumped quickly.', evidence: ['signal_delta_24h=16'], detected_at: observedAt } }, last_seen_healthy: observedAt, trend_context: { trust_trend: 'improving', signal_trend: 'stable', degradation_trend: 'stable', trust_delta_24h: 6, signal_delta_24h: 0, latency_delta_24h: null, degradation_delta_24h: 0, route_eligibility_changed: false, last_seen_healthy_at: observedAt, warning: null } },
      accepted_candidates: [],
      rejected_candidates: [],
      warnings: [],
      superiority_evidence_available: false
    });
    if (path === '/v1/radar/compare') return json({ generated_at: observedAt, mode: 'provider', rows: [{ id: 'alpha', type: 'provider', name: 'Alpha Data', trust_score: 86, signal_score: 74, endpoint_count: 2, mapped_endpoint_count: 2, route_eligible_endpoint_count: 1, degradation_count: 0, pricing_clarity: 95, metadata_quality: 90, reachability: 'reachable', last_observed: observedAt, last_seen_healthy: observedAt, predictive_risk_level: 'watch', predictive_risk_score: 34, recommended_action: 'route with caution', top_anomaly: { anomaly_type: 'sudden_signal_spike', severity: 'medium', confidence: 'high', explanation: 'Signal jump.', evidence: ['signal_delta_24h=16'], detected_at: observedAt }, route_recommendation: 'route_eligible', rejection_reasons: [] }] });
    if (path === '/v1/search') {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const query = String(body.query ?? '');
      return json(query.includes('metadata incomplete') ? [] : [{ provider, relevance: 0.91, trustAssessment: { score: 86 }, signalAssessment: { score: 74 } }]);
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderApp(container: HTMLElement) {
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return root!;
}

function sectionByHeading(container: HTMLElement, heading: string) {
  const title = Array.from(container.querySelectorAll('h2,h4')).find((node) => node.textContent === heading);
  return title?.closest('.dossier-section, .collapsible-section, .panel') as HTMLElement | undefined;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('radar endpoint intelligence UI', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('renders selected provider endpoint intelligence from normalized endpoint export', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Endpoint Intelligence');
    expect(container.textContent).toContain('Lookup');
    expect(container.textContent).toContain('route eligible');
    expect(container.textContent).not.toContain('Developer diagnostics');
  });

  it('renders selected provider with no endpoint rows without hiding the provider', async () => {
    installFetch({ endpoints: [], detailEndpoints: [] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Alpha Data');
    expect(container.textContent).toContain('Mapping incomplete');
    expect(container.textContent).toContain('Pay.sh catalog reports 2 endpoints');
  });

  it('shows expandable endpoint details and copy JSON button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const details = container.querySelector('.endpoint-intelligence-card') as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    details!.open = true;
    const copyButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Copy JSON') as HTMLButtonElement | undefined;
    expect(copyButton).toBeTruthy();

    await act(async () => {
      copyButton!.click();
    });

    expect(container.textContent).toContain('Normalized Endpoint JSON');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"endpoint_id": "ep-lookup"'));
  });

  it('shows incomplete mapping state instead of fake curl', async () => {
    installFetch({ endpoints: [incompleteEndpoint], detailEndpoints: [] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Mapping incomplete');
    expect(container.textContent).toContain('curl unavailable: endpoint mapping incomplete');
    expect(container.textContent).toContain('not recommended for routing');
  });

  it('shows degraded route warning while keeping provider visible', async () => {
    installFetch({ endpoints: [incompleteEndpoint], detailEndpoints: [], degraded: true });
    root = await renderApp(container);

    expect(container.textContent).toContain('Alpha Data');
    expect(container.textContent).toContain('Provider degraded warning');
    expect(container.textContent).toContain('not recommended for routing');
    expect(container.textContent).toContain('last seen healthy');
  });

  it('renders premium navigation and runs agent preflight without executing paid APIs', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    window.history.replaceState({}, '', '/solana');
    root = await renderApp(container);

    const primaryNav = container.querySelector('[aria-label="Primary destinations"]');
    expect(primaryNav?.textContent).toContain('Overview');
    expect(primaryNav?.textContent).toContain('Providers');
    expect(primaryNav?.textContent).toContain('Routes');
    expect(primaryNav?.textContent).toContain('Receipts');
    expect(primaryNav?.textContent).toContain('Benchmarks');
    expect(primaryNav?.textContent).not.toContain('Machine Economy');
    expect(primaryNav?.textContent).not.toContain('Machine Preflight');
    const radarMenu = container.querySelector('[aria-label="Solana destination directory"]');
    expect(radarMenu?.textContent).toContain('Methodology');
    expect(radarMenu?.textContent).toContain('Events');
    expect(container.querySelector('button[aria-label="Solana network. Switch Radar network"]')).not.toBeNull();
    expect(container.querySelector('.header-secondary-rail')).toBeNull();
    expect(container.textContent).toContain('Directory');
    expect(container.textContent).toContain('Events');
    expect(container.textContent).toContain('Preflight');
    const machineMenu = container.querySelector('[aria-label="Machine Economy menu"]');
    expect(machineMenu).toBeNull();
    expect(container.querySelector('a[href="/machine-market"]')).not.toBeNull();
    expect(container.textContent).toContain('Route intelligence, provider evidence, narrative memory and machine-market infrastructure for the Solana economy.');
    expect(container.textContent).toContain('Explore Solana Radar');
    expect(container.textContent).toContain('Most see noise.Infopunks finds signal.');
    expect(container.textContent).toContain('Proof before agent spend.');
    expect(container.textContent).toContain('Mapped Pay.sh routes, provider evidence and benchmark readiness—kept distinct from the Robinhood Chain signal desk.');
    expect(container.textContent).toContain('Pay.sh is the spend rail. Radar is the evidence ledger. Agents inspect evidence, request a non-executing plan, and record proof artifacts before trust compounds.');
    expect(container.textContent).toContain('5 recorded benchmarks');
    expect(container.textContent).toContain('6 artifacts');
    expect(container.textContent).toContain('40 recorded route-runs');
    expect(container.textContent).toContain('10 proven paid routes');
    expect(container.textContent).toContain('0 winner claims');
    const proofMetricText = container.querySelector('[aria-label="Proof metrics"]')?.textContent ?? '';
    expect(proofMetricText.indexOf('5 recorded benchmarks')).toBeLessThan(proofMetricText.indexOf('10 proven paid routes'));
    expect(proofMetricText.indexOf('10 proven paid routes')).toBeLessThan(proofMetricText.indexOf('40 recorded route-runs'));
    expect(proofMetricText.indexOf('40 recorded route-runs')).toBeLessThan(proofMetricText.indexOf('6 artifacts'));
    expect(proofMetricText.indexOf('6 artifacts')).toBeLessThan(proofMetricText.indexOf('0 winner claims'));
    expect(container.textContent).toContain('Recorded means paid evidence exists');
    expect(container.textContent).toContain('Pulse shows live ecosystem intelligence. Benchmarks show artifact-backed route evidence.');
    expect(container.textContent).toContain('Propagation Watch reflects catalog/provider health signals, not Radar execution failure.');
    expect(container.textContent).toContain('Ask Radar where an agent should route before spending.');
    expect(container.textContent).toContain('No preflight decision yet.');
    expect(container.textContent).toContain('Provider/Endpoint Comparison Engine');
    expect(container.textContent).toContain('Compare');
    const dossierSummary = container.querySelector('[aria-label="Selected provider summary strip"]');
    expect(dossierSummary).toBeTruthy();
    expect(dossierSummary?.textContent).toContain('Provider');
    expect(dossierSummary?.textContent).toContain('Alpha Data');
    expect(dossierSummary?.textContent).toContain('State');
    expect(dossierSummary?.textContent).toContain('Trust');
    expect(dossierSummary?.textContent).toContain('Signal');
    expect(dossierSummary?.textContent).toContain('Risk');
    expect(dossierSummary?.textContent).toContain('Route/action');

    const example = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Find SOL price route') as HTMLButtonElement | undefined;
    expect(example).toBeTruthy();
    await act(async () => {
      example!.click();
    });

    const run = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Run Preflight') as HTMLButtonElement | undefined;
    expect(run).toBeTruthy();
    await act(async () => {
      run!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Route candidate found');
    expect(container.textContent).toContain('Accepted candidate');
    expect(container.textContent).toContain('trust_trend');
    expect(container.textContent).toContain('last_seen_healthy');
    expect(container.textContent).toContain('/v1/radar/preflight');
    expect(container.textContent).toContain('Comparison Policy');
    expect(container.textContent).toContain('Recorded benchmark lanes have artifact-backed evidence. Explored lanes remain scaffolded when they do not meet the hard bar.');
    expect(container.textContent).not.toContain('Four benchmark lanes');
    expect(container.textContent).not.toContain('Three explored lanes');
  });

  it('shows evidence ledger unavailable instead of hardcoded proof metric fallbacks', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], evidenceLedgerUnavailable: true });
    root = await renderApp(container);

    const proofMetricText = container.querySelector('[aria-label="Proof metrics"]')?.textContent ?? '';
    expect(proofMetricText).toContain('Evidence Ledger unavailable');
    expect(proofMetricText).not.toContain('5 recorded benchmarks');
    expect(proofMetricText).not.toContain('10 proven paid routes');
    expect(proofMetricText).not.toContain('40 recorded route-runs');
    expect(proofMetricText).not.toContain('6 artifacts');
  });

  it('renders radar freshness timestamps with precise live-state labels', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Radar Freshness');
    expect(container.textContent).toContain('Latest Ingested Catalog');
    expect(container.textContent).toContain('catalog_generated_at');
    expect(container.textContent).toContain('Safe Metadata Monitor');
  });

  it('renders reliability history sparklines when history exists', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Reliability History');
    expect(container.textContent).toContain('Trust improving over 24h');
    expect(container.querySelector('.sparkline svg')).toBeTruthy();
  });

  it('renders UI history unavailable state without fake sparklines', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], degraded: true });
    root = await renderApp(container);

    const historyPanel = sectionByHeading(container, 'Reliability History');
    expect(historyPanel?.textContent).toContain('History warming up.');
    expect(historyPanel?.textContent).toContain('No historical snapshots available yet');
  });

  it('semantic search chips populate and run the query', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const chip = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'high trust finance APIs') as HTMLButtonElement | undefined;
    expect(chip).toBeTruthy();
    await act(async () => {
      chip!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = container.querySelector('input[aria-label="Search Pay.sh ecosystem intelligence"]') as HTMLInputElement | null;
    expect(input?.value).toBe('high trust finance APIs');
    expect(container.textContent).toContain('relevance 0.91');
  });

  it('shows the improved semantic search empty state', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const chip = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'metadata incomplete providers') as HTMLButtonElement | undefined;
    await act(async () => {
      chip!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('No matching providers.');
    expect(container.textContent).toContain('Try a category, provider name, endpoint type, or task intent.');
  });

  it('provider directory filtering keeps local results client-side', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const input = container.querySelector('input[aria-label="Filter providers by name tag FQN or category"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      setInputValue(input!, 'no-match-provider');
    });

    expect(container.textContent).toContain('No providers found.');
    expect(container.textContent).toContain('Adjust the search, category filter, or sort order.');
  });

  it('endpoint intelligence query filtering works on available endpoint rows', async () => {
    installFetch({ endpoints: [normalizedEndpoint, incompleteEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const input = container.querySelector('input[aria-label="Filter endpoints by name provider path or category"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      setInputValue(input!, 'ep-incomplete');
    });

    const endpointPanel = sectionByHeading(container, 'Endpoint Intelligence');
    expect(endpointPanel?.textContent).toContain('ep-incomplete');
    expect(endpointPanel?.textContent).not.toContain('ep-lookup');
  });

  it('collapsible sections render open and closed state', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const heatmap = sectionByHeading(container, 'Narrative Heatmap');
    expect(heatmap).toBeTruthy();
    const toggle = heatmap!.querySelector('button[aria-expanded="true"]') as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle!.click();
    });

    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    expect(heatmap!.className).toContain('is-collapsed');
  });

  it('renders export intelligence with readable copy and preserved routes', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const exportPanel = container.querySelector('.radar-export-panel') as HTMLElement | null;
    expect(exportPanel).not.toBeNull();
    expect(exportPanel!.textContent).toContain('Read-only export routes');
    expect(exportPanel!.textContent).toContain('Open machine-readable radar outputs. These do not execute paid Pay.sh APIs.');
    expect(exportPanel!.textContent).toContain('JSON exports');
    expect(exportPanel!.textContent).toContain('CSV exports');
    expect(exportPanel!.querySelectorAll('.export-group')).toHaveLength(2);
    expect(exportPanel!.querySelectorAll('.export-actions button')).toHaveLength(8);
    expect(exportPanel!.querySelectorAll('.export-copy-details')).toHaveLength(2);
    expect(exportPanel!.querySelector('button[aria-label="Copy OpenAPI URL"]')).not.toBeNull();
    expect(exportPanel!.textContent).toContain('Export Providers CSV');
    expect(exportPanel!.textContent).toContain('Export Endpoints CSV');
    expect(exportPanel!.textContent).toContain('Export Route Candidates CSV');
    expect(exportPanel!.textContent).toContain('Export Degradations CSV');
  });

  it('summarizes long superiority readiness arrays before revealing full details', async () => {
    const metadataOnly = Array.from({ length: 14 }, (_, index) => `provider-${index + 1}`);
    installFetch({
      endpoints: [normalizedEndpoint],
      detailEndpoints: [endpoint],
      readiness: {
        generated_at: observedAt,
        executable_provider_mappings_count: 0,
        categories_with_at_least_two_executable_mappings: ['finance', 'ocr', 'data'],
        categories_not_ready_for_comparison: ['payments', 'search', 'maps', 'documents', 'media', 'crypto', 'identity', 'email', 'sms', 'voice', 'storage', 'analytics', 'translation'],
        providers_with_proven_paid_execution: [],
        providers_with_only_catalog_metadata: metadataOnly,
        next_mappings_needed: metadataOnly.map((providerId) => `${providerId}: +1 executable mapping(s)`)
      }
    });
    root = await renderApp(container);

    expect(container.textContent).toContain('No executable provider mappings detected yet.');
    expect(container.textContent).toContain('Benchmark Readiness');
    expect(container.textContent).toContain('Benchmark Readiness');
    expect(container.textContent).toContain('Evidence Ledger Snapshot');
    expect((container.textContent ?? '').indexOf('Evidence Ledger Snapshot')).toBeLessThan((container.textContent ?? '').indexOf('Propagation Watch'));
    expect(container.textContent).toContain('5 recorded lanes · 5 explored lanes · 0 winner claims');
    expect(container.textContent).toContain('5 recorded benchmarks');
    expect(container.textContent).toContain('SOL Price + Token Search + Token Metadata + Web Search Results + Document OCR Text Extraction');
    expect(container.textContent).toContain('No winner claims');
    expect(container.textContent).toContain('SOL Price');
    expect(container.textContent).toContain('Token Search');
    expect(container.textContent).toContain('Token Metadata');
    expect(container.textContent).toContain('Web Search Results');
    expect(container.textContent).toContain('Recorded means paid route evidence exists. Scaffold means the lane was explored but did not meet the hard bar.');
    expect(container.textContent).toContain('Scaffold lanes are not failed benchmarks. They are lanes where Radar found insufficient comparable paid evidence.');
    expect(container.textContent).toContain('Radar records what graduated and what did not.');
    expect(container.textContent).toContain('Latest Recorded Benchmark');
    expect(container.textContent).toContain('Document OCR Text Extraction');
    expect(container.textContent).toContain('10 recorded route-runs');
    expect(container.textContent).toContain('evidence_health: caveated');
    expect(container.textContent).toContain('winner_claimed=false');
    expect(container.textContent).toContain('2 proven paid routes');
    expect(container.textContent).toContain('Explored, Not Promoted');
    expect(container.textContent).toContain('Communications Email Delivery');
    expect(container.textContent).toContain('StableEmail paid-executed and caveated');
    expect(container.textContent).toContain('AgentMail blocked / no second comparable route');
    expect(container.textContent).toContain('Solana Account Balance');
    expect(container.textContent).toContain('QuickNode unpaid 402 confirmed');
    expect(container.textContent).toContain('paid run failed');
    expect(container.textContent).toContain('Reddit Post Search');
    expect(container.textContent).toContain('StableEnrich paid-proven and caveated');
    expect(container.textContent).toContain('StableSocial paid-compatible but semantic proof failed');
    expect(container.textContent).toContain('no second paid-proven comparable route');
    expect(container.textContent).toContain('Maps Place Search Results');
    expect(container.textContent).toContain('StableEnrich paid-proven but degraded (missing names/addresses/coordinates, location unconfirmed)');
    expect(container.textContent).toContain('Google Places paid-executed and one paid diagnostic retry (includedType=cafe) still returned zero recognizable place candidates');
    expect(container.textContent).toContain('Audio Speech Transcription');
    expect(container.textContent).toContain('Google Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven');
    expect(container.textContent).toContain('Alibaba Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven');
    expect(container.textContent).not.toMatch(/Communications Email Delivery[\s\S]*5-run benchmark/);
    expect(container.textContent).not.toMatch(/Solana Account Balance[\s\S]*2 proven routes/);
    expect(container.textContent).not.toMatch(/Reddit Post Search[\s\S]*5-run benchmark/);
    expect(container.textContent).not.toMatch(/Maps Place Search Results[\s\S]*5-run benchmark/);
    expect(container.textContent).toContain('Catalog-estimated');
    expect(container.textContent).toContain('Agent API Surface');
    expect(container.textContent).toContain('GET /v1/radar/evidence-ledger');
    expect(container.textContent).toContain('GET /v1/radar/evidence-ledger/brief');
    expect(container.textContent).toContain('GET /v1/radar/benchmark-summary');
    expect(container.textContent).toContain('GET /v1/radar/benchmark-history');
    expect(container.textContent).toContain('GET /v1/radar/bundles');
    expect(container.textContent).toContain('GET /v1/radar/bundles/:bundle_id');
    expect(container.textContent).toContain('POST /v1/radar/bundles/:bundle_id/plan');
    expect(container.textContent).toContain('GET /v1/radar/bundles/:bundle_id/runs');
    expect(container.textContent).toContain('GET /v1/radar/bundles/:bundle_id/runs/:run_id');
    expect(container.textContent).toContain('GET /openapi.json');
    for (const group of ['Evidence', 'Bundles', 'Runs', 'Docs']) {
      expect(container.textContent).toContain(group);
    }
    expect(container.textContent).toContain('Compact preflight memory from the Evidence Ledger.');
    expect(container.textContent).toContain('API host: https://infopunks-pay-sh-radar.onrender.com. The public UI lives at radar.infopunks.fun; copyable API calls target the API host.');
    expect(container.textContent).toContain('Read-only evidence and planning endpoints for agents. Radar exposes evidence, plans, and Harness proof records; it does not execute paid APIs.');
    expect(container.querySelectorAll('.bundle-plan-card')).toHaveLength(3);
    expect(container.textContent).toContain('Bundles are non-executing spend recipes. Plans map intent and constraints to included, review-required, and blocked steps. Radar does not execute paid APIs from bundle plans.');
    expect(container.textContent).toContain('3 included · 2 review-required · 0 blocked · winner_claimed=false');
    expect(container.textContent).toContain('Bundle Run Ledger');
    expect(container.textContent).toContain('Bundle runs are Harness proof records, not benchmark claims.');
    expect(container.textContent).toContain('Radar does not execute paid APIs from this surface.');
    expect(container.textContent).toContain('Radar remembers controlled Harness runs over time.');
    expect(container.textContent).toContain('controlled_live_run');
    expect(container.textContent).toContain('Morning Briefing controlled Harness run');
    expect(container.textContent).toContain('caveated');
    expect(container.textContent).toContain('3 executed');
    expect(container.textContent).toContain('2 skipped');
    expect(container.textContent).toContain('0 blocked');
    expect(container.textContent).toContain('10 sources');
    expect(container.textContent).toContain('observed cost unavailable');
    expect(container.textContent).toContain('winner_claimed=false');
    expect(container.textContent).toContain('2 controlled runs tracked');
    expect(container.textContent).toContain('latest source_count +1');
    expect(container.textContent).toContain('Run History');
    expect(container.textContent).toContain('Freshness');
    expect(container.textContent).toContain('fresh · 12.4h · 2026-05-21T08:45:56.919Z');
    expect(container.textContent).toContain('recommended action: Inspect latest run detail before spend.');
    expect(container.textContent).toContain('Agent Readiness Summary');
    expect(container.textContent).toContain('Agent Readiness Summary compresses freshness, caveats, skipped steps, and cost visibility into one pre-spend decision object.');
    expect(container.textContent).toContain('ready_for_agent_review=true');
    expect(container.textContent).toContain('requires_human_or_policy_approval=true');
    expect(container.textContent).toContain('observed_cost_available=false');
    expect(container.textContent).toContain('winner_claimed=false');
    expect(container.textContent).toContain('decision_state=review_ready_caveated');
    expect(container.textContent).toContain('recommended_agent_action: Inspect latest run detail, skipped review-required steps, and caveats before spend.');
    expect(container.textContent).toContain('observed cost still unavailable');
    expect(container.textContent).toContain('+1 source');
    expect(container.textContent).toContain('caveats unchanged');
    expect(container.textContent).toContain('observed cost unavailable');
    expect(container.textContent).toContain('skipped review-required steps stable at 2');
    expect(container.textContent).toContain('Latest run');
    expect(container.textContent).toContain('084556-pay-cli');
    expect(container.textContent).toContain('Previous run');
    expect(container.textContent).toContain('075521-pay-cli');
    expect(container.textContent).toMatch(/Source count.*9 -> 10/);
    expect(container.textContent).toContain('Caveats');
    expect(container.textContent).toContain('unchanged');
    expect(container.textContent).toContain('Skipped review-required steps');
    expect(container.textContent).toContain('stable at 2');
    expect(container.textContent).toContain('Bundle run history records controlled Harness proof evolution, not benchmark claims.');
    expect(container.textContent).toContain('world_news_search');
    expect(container.textContent).toContain('ai_news_search');
    expect(container.textContent).toContain('crypto_market_scan');
    expect(container.textContent).toContain('top_story_selection');
    expect(container.textContent).toContain('deep_dive_synthesis');
    expect(container.textContent).toContain('status_code_unavailable');
    expect(container.textContent).toContain('observed_cost_unavailable');
    expect(container.textContent).toContain('source_map_empty');
    expect(container.textContent).toContain('This run is caveated because observed cost and pay_cli HTTP status were unavailable, and one executed step had an empty source map.');
    expect(container.textContent).toContain('Cleanest future Harness candidate, but not execution-ready until review-required billing boundaries are cleared.');
    expect(container.textContent).toContain('0 included · 4 review-required · 2 blocked');
    expect(container.textContent).toContain('Two billable-probe steps are blocked under strict constraints; remaining steps require billing-boundary review.');
    expect(container.textContent).toContain('0 included · 0 review-required · 5 blocked');
    expect(container.textContent).toContain('Job, salary, and hiring primitives are not yet recorded.');
    const curlDrawer = container.querySelector('.agent-examples-drawer[aria-label="Agent benchmark curl examples"]') as HTMLDetailsElement | null;
    expect(curlDrawer).toBeTruthy();
    expect(curlDrawer!.open).toBe(false);
    expect(curlDrawer!.textContent).toContain('Copyable curl examples');
    for (const label of ['Evidence Ledger', 'Evidence Brief', 'Morning Briefing Plan', 'Market Research Plan', 'Talent Scanner Plan', 'Morning Briefing Run Ledger', 'OpenAPI']) {
      expect(curlDrawer!.textContent).toContain(label);
    }
    const responseDrawer = container.querySelector('.agent-examples-drawer[aria-label="Agent benchmark response snippet"]') as HTMLDetailsElement | null;
    expect(responseDrawer).toBeTruthy();
    expect(responseDrawer!.open).toBe(false);
    expect(container.textContent).toContain('Agent Interpretation Guidance');
    expect(container.textContent).toContain('bundle plans');
    expect(container.textContent).toContain('bundle runs');
    expect(container.textContent).not.toContain('StableCrypto is winning');
    expect(container.textContent).not.toContain('PaySponge is winning');
    expect(container.textContent).not.toContain('Superiority Proof Readiness');
    expect(container.textContent).toContain('Comparison Policy');
    expect(container.textContent).toContain('Recorded benchmark lanes have artifact-backed evidence. Explored lanes remain scaffolded when they do not meet the hard bar.');
    expect(container.textContent).not.toContain('Four benchmark lanes');
    expect(container.textContent).not.toContain('Three explored lanes');
    expect(container.textContent).toContain('Radar can compare recorded metrics. Radar does not crown winners until scoring criteria are finalized. No benchmark currently claims a winner.');
    expect(container.textContent).not.toMatch(/best route|top route|winner route|loser route|ranking authority|guaranteed trust|safest provider|superiority proof|recorded bundle|production briefing/i);
    expect(container.textContent).not.toContain('HTTP 200');
    expect(container.textContent).toContain('StableCrypto: verified/proven');
    expect(container.textContent).toContain('CoinGecko Onchain DEX API: verified/proven');
    expect(container.textContent).toContain('finance/data/get SOL price');
    expect(container.textContent).toContain('+ 4 more');
    expect(container.textContent).toContain('catalog metadata only providers');

    const details = Array.from(container.querySelectorAll('.compact-chip-details')).find((node) => node.textContent?.includes('provider-14')) as HTMLDetailsElement | undefined;
    expect(details).toBeTruthy();
    details!.open = true;
    expect(details!.textContent).toContain('provider-14');
  });

  it('shows Bundle Run Ledger unavailable fallback when runs endpoint fails', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], bundleRunLedgerUnavailable: true });
    root = await renderApp(container);
    expect(container.textContent).toContain('Bundle Run Ledger unavailable');
    expect(container.textContent).toContain('Bundle Run History unavailable');
  });

  it('shows Bundle Run History unavailable fallback when history summary is missing', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], bundleRunHistorySummaryMissing: true });
    root = await renderApp(container);

    expect(container.textContent).toContain('Bundle Run History unavailable');
    expect(container.textContent).not.toContain('084556-pay-cli · 10 sources');
    expect(container.textContent).not.toContain('+1 source');
  });

  it('shows Bundle Run Freshness unavailable fallback when freshness is missing', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], bundleRunFreshnessMissing: true });
    root = await renderApp(container);

    expect(container.textContent).toContain('Bundle Run Freshness unavailable');
    expect(container.textContent).not.toContain('fresh · 12.4h · 2026-05-21T08:45:56.919Z');
  });

  it('derives homepage recorded and scaffold lane ratio from evidence ledger lane arrays', async () => {
    installFetch({
      endpoints: [normalizedEndpoint],
      detailEndpoints: [endpoint],
      evidenceLedger: {
        generated_at: observedAt,
        source: 'infopunks-pay-sh-radar',
        ledger_state: {
          recorded_benchmarks: 5,
          total_benchmarks: 10,
          total_artifacts: 6,
          total_recorded_runs: 40,
          proven_routes: 10,
          winner_claimed: false,
          latest_recorded_at: observedAt
        },
        recorded_lanes: [
          { benchmark_id: 'finance-data-sol-price', label: 'SOL Price', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt },
          { benchmark_id: 'finance-data-token-search', label: 'Token Search', status: 'recorded', artifact_count: 1, recorded_runs: 10, routes_count: 2, proven_routes_count: 2, winner_claimed: false, latest_recorded_at: observedAt }
        ],
        scaffold_lanes: [
          { benchmark_id: 'communications-email-delivery', label: 'Communications Email Delivery', status: 'scaffold', why_not_promoted: ['no second comparable route'] }
        ],
        latest_artifacts: []
      }
    });
    root = await renderApp(container);

    expect(container.textContent).toContain('2 recorded lanes · 1 explored lanes · 0 winner claims');
    expect(container.textContent).not.toContain('5 recorded lanes · 5 explored lanes · 0 winner claims');
  });

  it('renders route mapping registry rows, badges, and explanatory copy', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Route Evidence Registry');
    expect(container.textContent).toContain('Catalog-only is not execution proof.');
    expect(container.textContent).toContain('It is not a recommendation.');
    expect(container.textContent).toContain('StableCrypto');
    expect(container.textContent).toContain('paysponge-coingecko');
    expect(container.textContent).toContain('verified');
    expect(container.textContent).toContain('proven');
  });

  it('route mapping registry filters do not crash', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const status = container.querySelector('select[aria-label="Route mapping status filter"]') as HTMLSelectElement | null;
    const category = container.querySelector('select[aria-label="Route mapping category filter"]') as HTMLSelectElement | null;
    const intent = container.querySelector('select[aria-label="Route mapping intent filter"]') as HTMLSelectElement | null;
    expect(status).not.toBeNull();
    expect(category).not.toBeNull();
    expect(intent).not.toBeNull();

    await act(async () => {
      setSelectValue(status!, 'proven');
      setSelectValue(category!, 'finance/data');
      setSelectValue(intent!, 'get SOL price');
    });

    expect(container.textContent).toContain('StableCrypto');
    expect(container.textContent).toContain('CoinGecko Onchain DEX API');
  });

  it('renders mapping targets as planning-only prompts', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Mapping Targets');
    expect(container.textContent).toContain('Recorded lanes are completed evidence-ledger entries. Scaffold lanes are planning prompts, not recorded benchmark targets.');
    expect(container.textContent).toContain('Recorded');
    expect(container.textContent).toContain('Token Search');
    expect(container.textContent).toContain('Token Metadata');
    expect(container.textContent).toContain('Web Search Results');
    expect(container.textContent).toContain('Document OCR Text Extraction');
    expect(container.textContent).toContain('evidence ledger recorded');
    expect(container.textContent).toContain('Blocked');
    expect(container.textContent).toContain('Communications Email Delivery');
    expect(container.textContent).toContain('Solana Account Balance');
    expect(container.textContent).toContain('Reddit Post Search');
    expect(container.textContent).toContain('Needs candidate');
    expect(container.textContent).not.toContain('OCR comparison');
    expect(container.textContent).toContain('SMS/send message');
    expect(container.textContent).toContain('Knowledge/search answer');
    expect(container.textContent).not.toContain('candidate_mapping_found');
    expect(container.textContent).not.toContain('benchmark_ready');
    expect(container.textContent).not.toContain('needs_two_comparable_mappings');
    expect(container.textContent).not.toContain('candidate A');
    expect(container.textContent).not.toContain('candidate B');
  });

  it('renders predictive risk badges in preflight and comparison surfaces', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    const preflightRun = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Run Preflight') as HTMLButtonElement | undefined;
    expect(preflightRun).toBeTruthy();
    await act(async () => {
      preflightRun!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Watch');
    expect(container.textContent).toContain('route with caution');
  });

  it('renders Anomaly Watch panel with advisory entries', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], degraded: true });
    root = await renderApp(container);

    expect(container.textContent).toContain('Anomaly Watch');
    expect(container.querySelector('[aria-label="Advisory risk summary counts"]')?.textContent).toContain('critical1');
    expect(container.textContent).toContain('Alpha Data');
    expect(container.textContent).toContain('critical_current_state');
    expect(container.textContent).toContain('Not recommended for routing');
  });

  it('summarizes long critical anomaly lists until expanded', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint], degraded: true, anomalyWatch: anomalyWatchItems(9) });
    root = await renderApp(container);

    expect(container.textContent).toContain('critical_current_state_1');
    expect(container.textContent).toContain('critical_current_state_6');
    expect(container.textContent).not.toContain('critical_current_state_7');
    expect(container.textContent).toContain('View all anomalies (9)');
    expect(container.querySelector('.anomaly-list')?.getAttribute('aria-label')).toBe('Top advisory risk anomalies');

    const toggle = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('View all anomalies')) as HTMLButtonElement | undefined;
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('critical_current_state_9');
    expect(container.textContent).toContain('Show top anomalies');
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.anomaly-list')?.getAttribute('aria-label')).toBe('All advisory risk anomalies');
  });
});
