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

function installFetch(options: { endpoints?: unknown[]; detailEndpoints?: unknown[]; degraded?: boolean; readiness?: Record<string, unknown>; anomalyWatch?: ReturnType<typeof anomalyWatchItems> } = {}) {
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
        benchmark_recorded: false,
        winner_claimed: false,
        winner_status: 'not_evaluated',
        next_step: 'add and prove a second comparable token-search route',
        readiness_note: 'One proven token-search route exists. A second comparable proven route is required before benchmark readiness. No winner claimed.',
        routes: []
      }]
    });
    if (path === '/v1/radar/mappings') return json({
      generated_at: observedAt,
      source: 'infopunks-pay-sh-radar',
      count: 2,
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
          notes: 'Paid execution succeeded for token-search route. One proven route exists. Need a second comparable proven route before benchmark readiness. No route winner claimed.'
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
          current_state: 'needs_candidate',
          needed_next_step: 'Add at least one candidate route mapping row for token metadata retrieval.',
          suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
          why_it_matters: 'Token metadata is needed to normalize symbols/contracts before cross-provider benchmark comparisons.',
          readiness_blocker: 'No candidate mapping exists yet for this benchmark intent.'
        },
        {
          category: 'finance/data',
          benchmark_intent: 'token search',
          current_state: 'one_proven_mapping_found',
          needed_next_step: 'Add and prove a second comparable token-search route.',
          suggested_provider_candidates: ['CoinGecko Onchain DEX API'],
          why_it_matters: 'Search intent is a common pre-route step for symbol resolution and benchmark input shaping.',
          readiness_blocker: 'One proven route exists, but benchmark readiness requires two comparable proven routes.'
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
    root = await renderApp(container);

    const primaryNav = container.querySelector('[aria-label="Primary radar zones"]');
    expect(primaryNav?.textContent).toContain('Pulse');
    expect(primaryNav?.textContent).toContain('Benchmarks');
    expect(primaryNav?.textContent).toContain('Mappings');
    expect(primaryNav?.textContent).not.toContain('Agent Benchmark API');
    expect(container.textContent).toContain('Directory');
    expect(container.textContent).toContain('Events');
    expect(container.textContent).toContain('Preflight');
    expect(container.textContent).toContain('Routing intelligence for the Pay.sh agent economy.');
    expect(container.textContent).toContain('Ask Radar where an agent should route before spending.');
    expect(container.textContent).toContain('No preflight decision yet.');
    expect(container.textContent).toContain('Provider/Endpoint Comparison Engine');
    expect(container.textContent).toContain('Compare');

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
    expect(container.textContent).toContain('Superiority Proof Readiness');
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
    expect(container.textContent).toContain('Superiority readiness requires at least two proven executable mappings for the same benchmark intent.');
    expect(container.textContent).toContain('Benchmark Readiness');
    expect(container.textContent).toContain('Head-to-Head Benchmark');
    expect(container.textContent).toContain('Five-run benchmark recorded.');
    expect(container.textContent).toContain('5 / 5 required benchmark runs recorded.');
    expect(container.textContent).toContain('finance-data-token-search');
    expect(container.textContent).toContain('Benchmark scaffold');
    expect(container.textContent).toContain('Planning');
    expect(container.textContent).toContain('winner_status not_evaluated');
    expect(container.textContent).toContain('No proof recorded');
    expect(container.textContent).toContain('Winner status: no_clear_winner.');
    expect(container.textContent).toContain('Winner claimed: no.');
    expect(container.textContent).toContain('winner_claimed false');
    expect(container.textContent).toContain('Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.');
    expect(container.textContent).toContain('live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md');
    expect(container.textContent).toContain('HTTP status was not exposed by pay_cli; success is supported by CLI exit code 0 and parsed response body.');
    expect(container.textContent).toContain('Price difference recorded. No winner claimed.');
    expect(container.textContent).toContain('live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md');
    expect(container.textContent).toContain('Catalog-estimated');
    expect(container.textContent).toContain('Two proven executable routes exist. Benchmark comparison can begin.');
    expect(container.textContent).toContain('minimum 5 successful runs per route');
    expect(container.textContent).toContain('compare median latency');
    expect(container.textContent).toContain('require success rate >= 80%');
    expect(container.textContent).toContain('require high/medium normalization confidence');
    expect(container.textContent).toContain('allow no-clear-winner outcome');
    expect(container.textContent).toContain('GET /v1/radar/benchmarks/finance-data-token-search');
    expect(container.textContent).toContain('benchmark_recorded=false');
    expect(container.textContent).toContain('winner_status=not_evaluated');
    expect(container.textContent).toContain('routes=[]');
    expect(container.textContent).not.toContain('StableCrypto is winning');
    expect(container.textContent).not.toContain('PaySponge is winning');
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

  it('renders route mapping registry rows, badges, and explanatory copy', async () => {
    installFetch({ endpoints: [normalizedEndpoint], detailEndpoints: [endpoint] });
    root = await renderApp(container);

    expect(container.textContent).toContain('Route Mapping Registry');
    expect(container.textContent).toContain('Catalog-only is not execution proof.');
    expect(container.textContent).toContain('Proven does not mean best.');
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
    expect(container.textContent).toContain('These targets are planning prompts, not verified routes.');
    expect(container.textContent).toContain('token metadata');
    expect(container.textContent).toContain('needs_candidate');
    expect(container.textContent).toContain('one_proven_mapping_found');
    expect(container.textContent).toContain('needs_two_comparable_mappings');
    expect(container.textContent).toContain('No candidate selected yet.');
    expect(container.textContent).toContain('Needs catalog review.');
    expect(container.textContent).toContain('CoinGecko Onchain DEX API');
    expect(container.textContent).toContain('StableCrypto');
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
    expect(container.querySelector('[aria-label="Predictive risk summary counts"]')?.textContent).toContain('critical1');
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
    expect(container.querySelector('.anomaly-list')?.getAttribute('aria-label')).toBe('Top predictive risk anomalies');

    const toggle = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('View all anomalies')) as HTMLButtonElement | undefined;
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('critical_current_state_9');
    expect(container.textContent).toContain('Show top anomalies');
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.anomaly-list')?.getAttribute('aria-label')).toBe('All predictive risk anomalies');
  });
});
