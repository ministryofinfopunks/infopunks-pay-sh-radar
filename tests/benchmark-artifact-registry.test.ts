import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { listBenchmarkArtifacts } from '../src/data/benchmarkArtifacts';
import { buildRadarBenchmarks, buildRadarBenchmarkSummary } from '../src/services/radarBenchmarkService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('benchmark artifact registry', () => {
  const CANONICAL_ID = 'finance-data-sol-price-benchmark-runs-2026-05-16';
  const LEGACY_ID = 'finance-data-sol-price-runs-2026-05-16';
  const TOKEN_SEARCH_CANONICAL_ID = 'finance-data-token-search-benchmark-runs-2026-05-17';
  const TOKEN_METADATA_CANONICAL_ID = 'finance-data-token-metadata-benchmark-runs-2026-05-18';
  const TOKEN_METADATA_CANONICAL_ID_NEW = 'finance-data-token-metadata-benchmark-runs-2026-05-19';
  const COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID = 'communications-email-delivery';
  const SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID = 'solana-infra-account-balance';
  const SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID = 'social-data-reddit-post-search';
  const MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID = 'maps-place-search-results';
  const DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID = 'document-ocr-text-extraction';
  const DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID = 'data-web-search-results';
  const DATA_WEB_SEARCH_RESULTS_CANONICAL_ID = 'data-web-search-results-benchmark-runs-2026-05-19';
  const DOCUMENT_OCR_CANONICAL_ID = 'document-ocr-text-extraction-benchmark-runs-2026-05-19';
  const DOCUMENT_OCR_REDUCTO_ROUTE_ID = 'paysponge-reducto:POST:/parse';
  const DOCUMENT_OCR_GOOGLE_VISION_ROUTE_ID = 'google-vision:POST:/v1/images:annotate';
  const DATA_WEB_SEARCH_RESULTS_STABLEENRICH_ROUTE_ID = 'stableenrich-exa-search:POST:/api/exa/search';
  const DATA_WEB_SEARCH_RESULTS_PERPLEXITY_ROUTE_ID = 'perplexity-search:POST:/api/search';
  const PAYSPONGE_ROUTE_ID = 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL';
  const TOKEN_METADATA_PAYSPONGE_ROUTE_ID = 'paysponge-coingecko:GET:/x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112';
  const TOKEN_METADATA_STABLE_ROUTE_ID = 'merit-systems-stablecrypto-market-data:POST:/api/coingecko/coin';

  it('includes five-run SOL benchmark artifact', () => {
    const artifact = listBenchmarkArtifacts().find((row) => row.artifact_id === CANONICAL_ID);
    expect(artifact).toBeTruthy();
    expect(artifact?.benchmark_id).toBe('finance-data-sol-price');
    expect(artifact?.total_runs).toBe(5);
    expect(artifact?.winner_status).toBe('no_clear_winner');
    expect(artifact?.winner_claimed).toBe(false);
    expect(artifact?.source_repo).toBe('https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness');
    const paysponge = artifact?.routes.find((route) => route.provider_id === 'paysponge-coingecko');
    expect(paysponge?.route_id).toBe(PAYSPONGE_ROUTE_ID);
    expect(paysponge?.median_latency_ms).toBe(7761);
    expect(paysponge?.p95_latency_ms).toBe(7946);
    expect(paysponge?.average_price_usd).toBe(87.50392093173244);
    expect(paysponge?.min_price_usd).toBe(87.50332626375734);
    expect(paysponge?.max_price_usd).toBe(87.50629960363277);
    expect(paysponge?.price_variance_percent).toBe(0.0033979504504081403);
  });

  it('benchmark service consumes artifact metrics and preserves prior benchmark values', () => {
    const benchmarks = buildRadarBenchmarks().benchmarks;
    const sol = benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price');
    const tokenSearch = benchmarks.find((row) => row.benchmark_id === 'finance-data-token-search');
    const tokenMetadata = benchmarks.find((row) => row.benchmark_id === 'finance-data-token-metadata');
    const communicationsEmailDelivery = benchmarks.find((row) => row.benchmark_id === COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID);
    const solanaInfraAccountBalance = benchmarks.find((row) => row.benchmark_id === SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID);
    const socialDataRedditPostSearch = benchmarks.find((row) => row.benchmark_id === SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID);
    const mapsPlaceSearchResults = benchmarks.find((row) => row.benchmark_id === MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID);
    const documentOcrTextExtraction = benchmarks.find((row) => row.benchmark_id === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID);
    const dataWebSearchResults = benchmarks.find((row) => row.benchmark_id === DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID);
    expect(benchmarks.map((row) => row.benchmark_id)).toEqual([
      'finance-data-sol-price',
      'finance-data-token-search',
      'finance-data-token-metadata',
      COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
      SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
      SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
      DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
      DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
      MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID,
      'audio-speech-transcription'
    ]);
    expect(sol).toBeTruthy();
    const stable = sol?.routes.find((item) => item.provider_id === 'merit-systems-stablecrypto-market-data');
    const paysponge = sol?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(stable?.route_id).toBe('merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/price');
    expect(paysponge?.route_id).toBe(PAYSPONGE_ROUTE_ID);
    expect(stable?.latency_ms).toBe(5691);
    expect(stable?.average_price_usd).toBe(87.57);
    expect(paysponge?.latency_ms).toBe(7761);
    expect(paysponge?.average_price_usd).toBe(87.50392093173244);
    expect(sol?.winner_status).toBe('no_clear_winner');
    expect(sol?.winner_claimed).toBe(false);
    expect(sol?.benchmark_recorded).toBe(true);
    expect(tokenSearch).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      category: 'finance/data',
      benchmark_intent: 'token search',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
      next_step: 'define scoring thresholds before declaring a route winner'
    });
    expect(tokenSearch?.routes.length).toBe(2);
    const tokenSearchPaysponge = tokenSearch?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(tokenSearchPaysponge?.median_latency_ms).toBe(8533);
    expect(tokenSearchPaysponge?.p95_latency_ms).toBe(10545);
    expect(tokenMetadata).toMatchObject({
      benchmark_id: 'finance-data-token-metadata',
      category: 'finance/data',
      benchmark_intent: 'token metadata',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      next_step: 'define scoring thresholds before declaring a route winner'
    });
    expect(tokenMetadata?.readiness_note).not.toContain('canonical_network_match_rate=0.0');
    expect(tokenMetadata?.routes.length).toBe(2);
    const tokenMetadataPaysponge = tokenMetadata?.routes.find((item) => item.provider_id === 'paysponge-coingecko');
    expect(tokenMetadataPaysponge?.status_evidence).toBe('pay_cli exit code 0 and parsed response body');
    expect(communicationsEmailDelivery).toMatchObject({
      benchmark_id: COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
      category: 'communications',
      benchmark_recorded: false,
      winner_claimed: false,
      winner_status: 'not_evaluated'
    });
    expect(communicationsEmailDelivery?.routes).toEqual([]);
    expect(communicationsEmailDelivery?.readiness_note).toContain('Benchmark Scaffold');
    expect(solanaInfraAccountBalance).toMatchObject({
      benchmark_id: SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
      category: 'solana-infra',
      benchmark_recorded: false,
      winner_claimed: false,
      winner_status: 'not_evaluated'
    });
    expect(solanaInfraAccountBalance?.readiness_note).toContain('Benchmark Scaffold');
    expect(solanaInfraAccountBalance?.readiness_note).toContain('QuickNode');
    expect(solanaInfraAccountBalance?.readiness_note).toContain('evidence_health=unverified');
    expect(solanaInfraAccountBalance?.routes).toEqual([]);
    expect(socialDataRedditPostSearch).toMatchObject({
      benchmark_id: SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
      category: 'social-data',
      benchmark_recorded: false,
      winner_claimed: false,
      winner_status: 'not_evaluated'
    });
    expect(socialDataRedditPostSearch?.readiness_note).toContain('Benchmark Scaffold');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('"query":"x402"');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('route_state=verified/proven');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('evidence_health=caveated');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('unpaid variants A-F returned HTTP 402');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('paid diagnostic retry variant A executed successfully');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('candidate/unproven');
    expect(socialDataRedditPostSearch?.readiness_note).toContain('only one paid-proven route');
    expect(socialDataRedditPostSearch?.routes).toEqual([]);
    expect(mapsPlaceSearchResults).toMatchObject({
      benchmark_id: MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID,
      category: 'maps',
      benchmark_recorded: false,
      winner_claimed: false,
      winner_status: 'not_evaluated'
    });
    expect(mapsPlaceSearchResults?.routes).toEqual([]);
    expect(mapsPlaceSearchResults?.readiness_note).toContain('Benchmark Scaffold');
    expect(documentOcrTextExtraction).toMatchObject({
      benchmark_id: DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
      category: 'document-ai',
      benchmark_recorded: true,
      winner_claimed: false,
      winner_status: 'no_clear_winner'
    });
    expect(documentOcrTextExtraction?.readiness_note).toBe('Five-run normalized benchmark evidence exists. No route winner is claimed.');
    expect(documentOcrTextExtraction?.routes.length).toBe(2);
    expect(dataWebSearchResults).toMatchObject({
      benchmark_id: DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
      category: 'web-search',
      benchmark_recorded: true,
      winner_claimed: false,
      winner_status: 'no_clear_winner'
    });
    expect(dataWebSearchResults?.next_step).toBe('define scoring thresholds before declaring a route winner');
    expect(dataWebSearchResults?.readiness_note).toBe('Five-run normalized benchmark evidence exists. No route winner is claimed.');
    expect(dataWebSearchResults?.routes.length).toBe(2);
  });

  it('builds compact agent benchmark summary from existing benchmark records', () => {
    const before = Date.now();
    const summary = buildRadarBenchmarkSummary();
    const after = Date.now();
    const generatedAtMs = Date.parse(summary.generated_at);
    expect(summary.recorded_benchmarks).toBe(5);
    expect(summary.total_benchmarks).toBe(10);
    expect(summary.winner_claimed).toBe(false);
    expect(summary.total_recorded_runs).toBe(40);
    expect(summary.proven_routes).toBe(10);
    expect(summary.total_artifacts).toBe(6);
    expect(summary.latest_recorded_at).toBe('2026-05-19T11:00:00.000Z');
    expect(Number.isFinite(generatedAtMs)).toBe(true);
    expect(generatedAtMs).toBeGreaterThanOrEqual(before - 2_000);
    expect(generatedAtMs).toBeLessThanOrEqual(after + 2_000);
    expect(summary.agent_guidance).toEqual([
      'winner_claimed=false means no route winner should be inferred.',
      'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
      'Use full benchmark endpoints for route-level metrics.'
    ]);

    const sol = summary.benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price');
    const tokenSearch = summary.benchmarks.find((row) => row.benchmark_id === 'finance-data-token-search');
    const tokenMetadata = summary.benchmarks.find((row) => row.benchmark_id === 'finance-data-token-metadata');
    expect(summary.benchmarks.map((row) => row.benchmark_id)).toEqual(['finance-data-sol-price', 'finance-data-token-search', 'finance-data-token-metadata', 'document-ocr-text-extraction', 'data-web-search-results']);
    expect(sol).toMatchObject({
      label: 'SOL price',
      status: 'recorded',
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      recorded_runs: 5
    });
    expect(tokenSearch).toMatchObject({
      label: 'Token search',
      status: 'recorded',
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      recorded_runs: 5
    });
    expect(tokenMetadata).toMatchObject({
      label: 'Token metadata',
      status: 'recorded',
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      recorded_runs: 5
    });
    const dataWebSearch = summary.benchmarks.find((row) => row.benchmark_id === DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID);
    expect(dataWebSearch).toMatchObject({
      label: 'Web Search Results',
      description: 'Search the web for the same query and return normalized search results.',
      status: 'recorded',
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      routes_count: 2,
      recorded_runs: 10
    });
  });

  it('artifact endpoints return safe metadata only and do not expose raw proof contents', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-artifacts' });
    expect(listResponse.statusCode).toBe(200);
    const artifacts = listResponse.json().data.artifacts as Array<Record<string, unknown>>;
    expect(artifacts.length).toBeGreaterThan(0);
    const sol = artifacts.find((row) => row.artifact_id === CANONICAL_ID);
    expect(sol).toBeTruthy();
    expect(sol).toHaveProperty('artifact_path');
    expect(sol).toHaveProperty('routes');
    expect(sol).not.toHaveProperty('proof_markdown');
    expect(JSON.stringify(sol)).not.toContain('# ');
    expect(JSON.stringify(sol)).not.toContain('```');

    const detailResponse = await app.inject({ method: 'GET', url: `/v1/radar/benchmark-artifacts/${CANONICAL_ID}` });
    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json().data;
    expect(detail.artifact_id).toBe(CANONICAL_ID);
    expect(detail.winner_status).toBe('no_clear_winner');
    expect(detail.winner_claimed).toBe(false);
    expect(detail).not.toHaveProperty('raw_proof_contents');
    const paysponge = detail.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(paysponge.route_id).toBe(PAYSPONGE_ROUTE_ID);

    const legacyResponse = await app.inject({ method: 'GET', url: `/v1/radar/benchmark-artifacts/${LEGACY_ID}` });
    expect(legacyResponse.statusCode).toBe(200);
    expect(legacyResponse.json().data.artifact_id).toBe(CANONICAL_ID);

    const benchmarkListResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    expect(benchmarkListResponse.statusCode).toBe(200);
    expect(benchmarkListResponse.json().data.benchmarks.map((row: { benchmark_id: string }) => row.benchmark_id)).toContain('finance-data-token-search');
    expect(benchmarkListResponse.json().data.benchmarks[0]).toHaveProperty('routes');
    expect(benchmarkListResponse.json().data.benchmarks[0].routes[0]).toHaveProperty('median_latency_ms');

    const summaryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-summary' });
    expect(summaryResponse.statusCode).toBe(200);
    const summary = summaryResponse.json().data;
    expect(summary.recorded_benchmarks).toBe(5);
    expect(summary.total_benchmarks).toBe(10);
    expect(summary.winner_claimed).toBe(false);
    expect(summary.total_recorded_runs).toBe(40);
    expect(summary.proven_routes).toBe(10);
    expect(summary.total_artifacts).toBe(6);
    expect(summary.latest_recorded_at).toBe('2026-05-19T11:00:00.000Z');
    expect(summary.benchmarks.map((row: { benchmark_id: string }) => row.benchmark_id)).toEqual(['finance-data-sol-price', 'finance-data-token-search', 'finance-data-token-metadata', 'document-ocr-text-extraction', 'data-web-search-results']);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-sol-price').routes_count).toBe(2);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-search').routes_count).toBe(2);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-sol-price').recorded_runs).toBe(5);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-search').recorded_runs).toBe(5);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-metadata').recorded_runs).toBe(5);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'data-web-search-results').recorded_runs).toBe(10);
    expect(summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'document-ocr-text-extraction').recorded_runs).toBe(10);
    const webSearchSummary = summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'data-web-search-results');
    const ocrSummary = summary.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID);
    expect(webSearchSummary?.label).toBe('Web Search Results');
    expect(webSearchSummary?.description).toBe('Search the web for the same query and return normalized search results.');
    expect(ocrSummary?.label).toBe('Document OCR Text Extraction');
    expect(ocrSummary?.description).toBe('Extract text from the same simple document/image fixture.');
    expect(summary.winner_claimed).toBe(false);
    expect(summary.benchmarks[0]).not.toHaveProperty('routes');
    expect(summary.benchmarks[0]).not.toHaveProperty('median_latency_ms');
    expect(summary.benchmarks[0]).not.toHaveProperty('success_rate');

    const benchmarkResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price' });
    expect(benchmarkResponse.statusCode).toBe(200);
    const benchmark = benchmarkResponse.json().data;
    const benchmarkPaysponge = benchmark.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(benchmarkPaysponge.route_id).toBe(PAYSPONGE_ROUTE_ID);

    const tokenSearchResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-search' });
    expect(tokenSearchResponse.statusCode).toBe(200);
    expect(tokenSearchResponse.json().data).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect((tokenSearchResponse.json().data.routes as unknown[]).length).toBe(2);

    const tokenMetadataResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-metadata' });
    expect(tokenMetadataResponse.statusCode).toBe(200);
    expect(tokenMetadataResponse.json().data).toMatchObject({
      benchmark_id: 'finance-data-token-metadata',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect((tokenMetadataResponse.json().data.routes as Array<{ provider_id: string; status_evidence: string }>).length).toBe(2);
    const tokenMetadataPaysponge = tokenMetadataResponse.json().data.routes.find((route: { provider_id: string }) => route.provider_id === 'paysponge-coingecko');
    expect(tokenMetadataPaysponge.status_evidence).toBe('pay_cli exit code 0 and parsed response body');

    const communicationsEmailDeliveryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/communications-email-delivery' });
    expect(communicationsEmailDeliveryResponse.statusCode).toBe(200);
    expect(communicationsEmailDeliveryResponse.json().data).toMatchObject({
      benchmark_id: COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
      category: 'communications',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false,
      readiness_note: expect.stringContaining('Benchmark Scaffold')
    });
    expect((communicationsEmailDeliveryResponse.json().data.routes as unknown[]).length).toBe(0);
    const solanaInfraAccountBalanceResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/solana-infra-account-balance' });
    expect(solanaInfraAccountBalanceResponse.statusCode).toBe(200);
    expect(solanaInfraAccountBalanceResponse.json().data).toMatchObject({
      benchmark_id: SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
      category: 'solana-infra',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    expect(solanaInfraAccountBalanceResponse.json().data.readiness_note).toContain('QuickNode');
    expect(solanaInfraAccountBalanceResponse.json().data.readiness_note).toContain('evidence_health=unverified');
    expect((solanaInfraAccountBalanceResponse.json().data.routes as unknown[]).length).toBe(0);
    const socialDataRedditPostSearchResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/social-data-reddit-post-search' });
    expect(socialDataRedditPostSearchResponse.statusCode).toBe(200);
    expect(socialDataRedditPostSearchResponse.json().data).toMatchObject({
      benchmark_id: SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
      category: 'social-data',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    expect((socialDataRedditPostSearchResponse.json().data.routes as unknown[]).length).toBe(0);
    const mapsPlaceSearchResultsResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/maps-place-search-results' });
    expect(mapsPlaceSearchResultsResponse.statusCode).toBe(200);
    expect(mapsPlaceSearchResultsResponse.json().data).toMatchObject({
      benchmark_id: MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID,
      category: 'maps',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    expect((mapsPlaceSearchResultsResponse.json().data.routes as unknown[]).length).toBe(0);
    expect(mapsPlaceSearchResultsResponse.json().data.readiness_note).toContain('StableEnrich Google Maps Text Search paid execution succeeded and returned recognizable place candidates, but evidence_health is degraded');
    expect(mapsPlaceSearchResultsResponse.json().data.readiness_note).toContain('Google Places SearchText paid execution succeeded and later received one paid diagnostic retry with includedType=cafe, but still returned zero recognizable place candidates');
    expect(mapsPlaceSearchResultsResponse.json().data.readiness_note).toContain('no second paid-proven comparable route exists yet');
    expect(mapsPlaceSearchResultsResponse.json().data.readiness_note).toContain('no five-run benchmark artifact exists');
    expect(mapsPlaceSearchResultsResponse.json().data.next_step).toContain('find another comparable place-search provider route, or revisit Google Places only if provider schema/output changes');
    const audioSpeechTranscriptionResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/audio-speech-transcription' });
    expect(audioSpeechTranscriptionResponse.statusCode).toBe(200);
    expect(audioSpeechTranscriptionResponse.json().data).toMatchObject({
      benchmark_id: 'audio-speech-transcription',
      category: 'audio-ai',
      benchmark_recorded: false,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    expect((audioSpeechTranscriptionResponse.json().data.routes as unknown[]).length).toBe(0);
    expect(audioSpeechTranscriptionResponse.json().data.readiness_note).toContain('recommended_state=scaffold_ready');
    expect(audioSpeechTranscriptionResponse.json().data.readiness_note).toContain('AUDIO BENCHMARK 001');
    const documentOcrTextExtractionResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/document-ocr-text-extraction' });
    expect(documentOcrTextExtractionResponse.statusCode).toBe(200);
    expect(documentOcrTextExtractionResponse.json().data).toMatchObject({
      benchmark_id: DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
      category: 'document-ai',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect(documentOcrTextExtractionResponse.json().data.readiness_note).toBe('Five-run normalized benchmark evidence exists. No route winner is claimed.');
    expect((documentOcrTextExtractionResponse.json().data.routes as unknown[]).length).toBe(2);
    const dataWebSearchResultsResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/data-web-search-results' });
    expect(dataWebSearchResultsResponse.statusCode).toBe(200);
    expect(dataWebSearchResultsResponse.json().data).toMatchObject({
      benchmark_id: DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
      category: 'web-search',
      benchmark_recorded: true,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect((dataWebSearchResultsResponse.json().data.routes as unknown[]).length).toBe(2);

    const solHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-sol-price/history' });
    expect(solHistoryResponse.statusCode).toBe(200);
    const solHistory = solHistoryResponse.json().data;
    expect(solHistory.benchmark_id).toBe('finance-data-sol-price');
    expect(solHistory.entries.length).toBe(1);
    expect(solHistory.entries[0].run_count).toBe(5);
    expect(solHistory.entries[0].proof_reference).toBe('live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md');
    expect(solHistory.entries.some((entry: { run_count: number }) => entry.run_count === 1)).toBe(false);
    expect(solHistory.winner_claimed).toBe(false);
    expect(solHistory.latest_artifact_id).toBe(CANONICAL_ID);
    expect(solHistory.routes_count).toBe(2);
    expect(solHistory.route_summaries.length).toBe(2);

    const tokenSearchHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks/finance-data-token-search/history' });
    expect(tokenSearchHistoryResponse.statusCode).toBe(200);
    const tokenSearchHistory = tokenSearchHistoryResponse.json().data;
    expect(tokenSearchHistory.benchmark_id).toBe('finance-data-token-search');
    expect(tokenSearchHistory.entries.length).toBe(1);
    expect(tokenSearchHistory.entries[0].run_count).toBe(5);
    expect(tokenSearchHistory.entries[0].proof_reference).toBe('live-proofs/finance-data-token-search-benchmark-runs-2026-05-17.md');
    expect(tokenSearchHistory.winner_claimed).toBe(false);
    expect(tokenSearchHistory.latest_artifact_id).toBe(TOKEN_SEARCH_CANONICAL_ID);
    expect(tokenSearchHistory.routes_count).toBe(2);
    expect(tokenSearchHistory.route_summaries.length).toBe(2);

    const aggregateHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history' });
    expect(aggregateHistoryResponse.statusCode).toBe(200);
    const aggregateHistory = aggregateHistoryResponse.json().data;
    expect(aggregateHistory.history_count).toBe(5);
    expect(aggregateHistory.total_artifacts).toBe(6);
    expect(aggregateHistory.total_recorded_runs).toBe(40);
    expect(aggregateHistory.winner_claimed).toBe(false);
    expect(aggregateHistory.benchmarks.length).toBe(5);
    expect(aggregateHistory.benchmarks.map((row: { benchmark_id: string }) => row.benchmark_id)).toEqual([
      'finance-data-sol-price',
      'finance-data-token-search',
      'finance-data-token-metadata',
      'document-ocr-text-extraction',
      'data-web-search-results'
    ]);
    expect(aggregateHistory.benchmarks.every((row: { winner_claimed: boolean }) => row.winner_claimed === false)).toBe(true);
    expect(aggregateHistory.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-sol-price')?.artifact_count).toBe(1);
    expect(aggregateHistory.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-search')?.artifact_count).toBe(1);
    expect(aggregateHistory.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'finance-data-token-metadata')?.artifact_count).toBe(2);
    expect(aggregateHistory.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'data-web-search-results')?.artifact_count).toBe(1);
    expect(aggregateHistory.benchmarks.find((row: { benchmark_id: string }) => row.benchmark_id === 'document-ocr-text-extraction')?.artifact_count).toBe(1);
    expect(aggregateHistory.benchmarks.every((row: { latest_artifact_id: string | null }) => typeof row.latest_artifact_id === 'string' && row.latest_artifact_id.length > 0)).toBe(true);

    const solHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/finance-data-sol-price' });
    expect(solHistoryV2Response.statusCode).toBe(200);
    const solHistoryV2 = solHistoryV2Response.json().data;
    expect(solHistoryV2).toMatchObject({
      benchmark_id: 'finance-data-sol-price',
      label: 'SOL price',
      status: 'recorded',
      artifact_count: 1,
      total_recorded_runs: 5,
      routes_count: 2,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect(solHistoryV2.artifacts.length).toBe(1);
    expect(solHistoryV2.artifacts[0].recorded_runs).toBe(5);

    const tokenSearchHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/finance-data-token-search' });
    expect(tokenSearchHistoryV2Response.statusCode).toBe(200);
    const tokenSearchHistoryV2 = tokenSearchHistoryV2Response.json().data;
    expect(tokenSearchHistoryV2).toMatchObject({
      benchmark_id: 'finance-data-token-search',
      label: 'Token search',
      status: 'recorded',
      artifact_count: 1,
      total_recorded_runs: 5,
      routes_count: 2,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    expect(tokenSearchHistoryV2.artifacts.length).toBe(1);
    expect(tokenSearchHistoryV2.artifacts[0].recorded_runs).toBe(5);

    const communicationsEmailDeliveryHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/communications-email-delivery' });
    expect(communicationsEmailDeliveryHistoryV2Response.statusCode).toBe(200);
    const communicationsEmailDeliveryHistoryV2 = communicationsEmailDeliveryHistoryV2Response.json().data;
    expect(communicationsEmailDeliveryHistoryV2).toMatchObject({
      benchmark_id: COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
      label: 'Send or queue canonical plain-text email',
      status: 'planned',
      artifact_count: 0,
      total_recorded_runs: 0,
      routes_count: 0,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    expect(communicationsEmailDeliveryHistoryV2.artifacts).toEqual([]);

    const communicationsEmailDeliveryRouteHistoryAggregateResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/communications-email-delivery/routes' });
    expect(communicationsEmailDeliveryRouteHistoryAggregateResponse.statusCode).toBe(200);
    expect(communicationsEmailDeliveryRouteHistoryAggregateResponse.json().data).toMatchObject({
      benchmark_id: COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
      route_count: 0,
      artifact_count: 0,
      winner_claimed: false,
      routes: []
    });

    const communicationsEmailDeliveryRouteHistoryMissingRouteResponse = await app.inject({
      method: 'GET',
      url: '/v1/radar/benchmark-history/communications-email-delivery/routes/unknown-route'
    });
    expect(communicationsEmailDeliveryRouteHistoryMissingRouteResponse.statusCode).toBe(404);
    expect(communicationsEmailDeliveryRouteHistoryMissingRouteResponse.json()).toEqual({ error: 'route_not_found' });
    const solanaInfraAccountBalanceHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/solana-infra-account-balance' });
    expect(solanaInfraAccountBalanceHistoryV2Response.statusCode).toBe(200);
    expect(solanaInfraAccountBalanceHistoryV2Response.json().data).toMatchObject({
      benchmark_id: SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
      status: 'planned',
      artifact_count: 0,
      total_recorded_runs: 0,
      routes_count: 0,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    const solanaInfraAccountBalanceRouteHistoryAggregateResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/solana-infra-account-balance/routes' });
    expect(solanaInfraAccountBalanceRouteHistoryAggregateResponse.statusCode).toBe(200);
    expect(solanaInfraAccountBalanceRouteHistoryAggregateResponse.json().data).toMatchObject({
      benchmark_id: SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
      route_count: 0,
      artifact_count: 0,
      winner_claimed: false,
      routes: []
    });
    const socialDataRedditPostSearchHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/social-data-reddit-post-search' });
    expect(socialDataRedditPostSearchHistoryV2Response.statusCode).toBe(200);
    expect(socialDataRedditPostSearchHistoryV2Response.json().data).toMatchObject({
      benchmark_id: SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
      status: 'planned',
      artifact_count: 0,
      total_recorded_runs: 0,
      routes_count: 0,
      winner_status: 'not_evaluated',
      winner_claimed: false
    });
    const socialDataRedditPostSearchRouteHistoryAggregateResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/social-data-reddit-post-search/routes' });
    expect(socialDataRedditPostSearchRouteHistoryAggregateResponse.statusCode).toBe(200);
    expect(socialDataRedditPostSearchRouteHistoryAggregateResponse.json().data).toMatchObject({
      benchmark_id: SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
      route_count: 0,
      artifact_count: 0,
      winner_claimed: false,
      routes: []
    });
    const socialDataRedditPostSearchRouteHistoryMissingRouteResponse = await app.inject({
      method: 'GET',
      url: '/v1/radar/benchmark-history/social-data-reddit-post-search/routes/unknown-route'
    });
    expect(socialDataRedditPostSearchRouteHistoryMissingRouteResponse.statusCode).toBe(404);
    expect(socialDataRedditPostSearchRouteHistoryMissingRouteResponse.json()).toEqual({ error: 'route_not_found' });
    const documentOcrTextExtractionHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/document-ocr-text-extraction' });
    expect(documentOcrTextExtractionHistoryV2Response.statusCode).toBe(200);
    expect(documentOcrTextExtractionHistoryV2Response.json().data).toMatchObject({
      benchmark_id: DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
      status: 'recorded',
      artifact_count: 1,
      total_recorded_runs: 10,
      routes_count: 2,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    const documentOcrTextExtractionRouteHistoryAggregateResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/document-ocr-text-extraction/routes' });
    expect(documentOcrTextExtractionRouteHistoryAggregateResponse.statusCode).toBe(200);
    expect(documentOcrTextExtractionRouteHistoryAggregateResponse.json().data).toMatchObject({
      benchmark_id: DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
      route_count: 2,
      artifact_count: 1,
      winner_claimed: false
    });
    const documentOcrRoutes = documentOcrTextExtractionRouteHistoryAggregateResponse.json().data.routes as Array<{ route_id: string; label: string; evidence_health: string; latest_artifact_id: string; caveat_objects: Array<{ code: string }> }>;
    expect(documentOcrRoutes.map((route) => route.route_id).sort()).toEqual([DOCUMENT_OCR_REDUCTO_ROUTE_ID, DOCUMENT_OCR_GOOGLE_VISION_ROUTE_ID].sort());
    expect(documentOcrRoutes.find((route) => route.route_id === DOCUMENT_OCR_REDUCTO_ROUTE_ID)?.label).toBe('PaySponge Reducto');
    expect(documentOcrRoutes.find((route) => route.route_id === DOCUMENT_OCR_GOOGLE_VISION_ROUTE_ID)?.label).toBe('Google Vision OCR');
    expect(documentOcrRoutes.every((route) => route.evidence_health === 'caveated')).toBe(true);
    expect(documentOcrRoutes.every((route) => route.latest_artifact_id === DOCUMENT_OCR_CANONICAL_ID)).toBe(true);
    expect(documentOcrRoutes.every((route) => route.caveat_objects.some((caveat) => caveat.code === 'status_code_unavailable'))).toBe(true);
    const dataWebSearchResultsHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/data-web-search-results' });
    expect(dataWebSearchResultsHistoryV2Response.statusCode).toBe(200);
    expect(dataWebSearchResultsHistoryV2Response.json().data).toMatchObject({
      benchmark_id: DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
      status: 'recorded',
      artifact_count: 1,
      total_recorded_runs: 10,
      routes_count: 2,
      winner_status: 'no_clear_winner',
      winner_claimed: false
    });
    const dataWebSearchResultsRouteHistoryAggregateResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/data-web-search-results/routes' });
    expect(dataWebSearchResultsRouteHistoryAggregateResponse.statusCode).toBe(200);
    expect(dataWebSearchResultsRouteHistoryAggregateResponse.json().data).toMatchObject({
      benchmark_id: DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
      route_count: 2,
      artifact_count: 1,
      winner_claimed: false
    });
    const dataWebRoutes = dataWebSearchResultsRouteHistoryAggregateResponse.json().data.routes as Array<{ route_id: string; label: string }>;
    const dataWebRouteIds = dataWebRoutes.map((route) => route.route_id).sort();
    expect(dataWebRouteIds).toEqual([DATA_WEB_SEARCH_RESULTS_STABLEENRICH_ROUTE_ID, DATA_WEB_SEARCH_RESULTS_PERPLEXITY_ROUTE_ID].sort());
    expect(dataWebRoutes.find((route) => route.route_id === DATA_WEB_SEARCH_RESULTS_STABLEENRICH_ROUTE_ID)?.label).toBe('StableEnrich Exa Search');
    expect(dataWebRoutes.find((route) => route.route_id === DATA_WEB_SEARCH_RESULTS_PERPLEXITY_ROUTE_ID)?.label).toBe('Perplexity Search');
    const dataWebStableDetailResponse = await app.inject({
      method: 'GET',
      url: `/v1/radar/benchmark-history/data-web-search-results/routes/${encodeURIComponent(DATA_WEB_SEARCH_RESULTS_STABLEENRICH_ROUTE_ID)}`
    });
    expect(dataWebStableDetailResponse.statusCode).toBe(200);
    expect(dataWebStableDetailResponse.json().data.evidence_health).toBe('recorded');
    expect(dataWebStableDetailResponse.json().data.label).toBe('StableEnrich Exa Search');
    expect(dataWebStableDetailResponse.json().data.route_id).toBe(DATA_WEB_SEARCH_RESULTS_STABLEENRICH_ROUTE_ID);
    expect(dataWebStableDetailResponse.json().data.timeline[0].caveat_objects.some((row: { code: string }) => row.code === 'pay_cli_status_hidden')).toBe(true);
    const dataWebPerplexityDetailResponse = await app.inject({
      method: 'GET',
      url: `/v1/radar/benchmark-history/data-web-search-results/routes/${encodeURIComponent(DATA_WEB_SEARCH_RESULTS_PERPLEXITY_ROUTE_ID)}`
    });
    expect(dataWebPerplexityDetailResponse.statusCode).toBe(200);
    expect(dataWebPerplexityDetailResponse.json().data.evidence_health).toBe('recorded');
    expect(dataWebPerplexityDetailResponse.json().data.label).toBe('Perplexity Search');
    expect(dataWebPerplexityDetailResponse.json().data.route_id).toBe(DATA_WEB_SEARCH_RESULTS_PERPLEXITY_ROUTE_ID);

    const tokenMetadataRouteHistoryResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/finance-data-token-metadata/routes' });
    expect(tokenMetadataRouteHistoryResponse.statusCode).toBe(200);
    const tokenMetadataRouteHistory = tokenMetadataRouteHistoryResponse.json().data;
    expect(tokenMetadataRouteHistory).toMatchObject({
      benchmark_id: 'finance-data-token-metadata',
      label: 'Token metadata',
      route_count: 2,
      artifact_count: 2,
      winner_claimed: false
    });
    expect(tokenMetadataRouteHistory.routes.map((route: { route_id: string }) => route.route_id).sort()).toEqual([
      TOKEN_METADATA_STABLE_ROUTE_ID,
      TOKEN_METADATA_PAYSPONGE_ROUTE_ID
    ].sort());
    const tokenMetadataPayspongeHistory = tokenMetadataRouteHistory.routes.find((route: { route_id: string }) => route.route_id === TOKEN_METADATA_PAYSPONGE_ROUTE_ID);
    expect(tokenMetadataPayspongeHistory.latest_artifact_id).toBe(TOKEN_METADATA_CANONICAL_ID_NEW);
    expect(tokenMetadataPayspongeHistory.latest_success_count).toBe(5);
    expect(tokenMetadataPayspongeHistory.latest_failure_count).toBe(0);
    expect(tokenMetadataPayspongeHistory.latest_median_latency_ms).toBe(5430);
    expect(tokenMetadataPayspongeHistory.latest_p95_latency_ms).toBe(5730);
    expect(tokenMetadataPayspongeHistory.latest_detection_rate).toBe(1);
    expect(tokenMetadataPayspongeHistory.winner_claimed).toBe(false);
    expect(tokenMetadataPayspongeHistory.evidence_health).toBe('recorded');
    expect(tokenMetadataPayspongeHistory.caveat_objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'pay_cli_status_hidden', severity: 'info', evidence_field: 'status_code', value: null })
    ]));
    expect(tokenMetadataPayspongeHistory.caveat_objects.some((row: { code: string }) => row.code === 'canonical_network_mismatch')).toBe(false);
    const tokenMetadataStableHistory = tokenMetadataRouteHistory.routes.find((route: { route_id: string }) => route.route_id === TOKEN_METADATA_STABLE_ROUTE_ID);
    expect(tokenMetadataStableHistory.evidence_health).toBe('recorded');
    expect(tokenMetadataStableHistory.caveat_objects.some((row: { code: string; severity: string }) => row.code === 'pay_cli_status_hidden' && row.severity === 'info')).toBe(true);

    const tokenMetadataRouteDetailResponse = await app.inject({ method: 'GET', url: `/v1/radar/benchmark-history/finance-data-token-metadata/routes/${encodeURIComponent(TOKEN_METADATA_PAYSPONGE_ROUTE_ID)}` });
    expect(tokenMetadataRouteDetailResponse.statusCode).toBe(200);
    const tokenMetadataRouteDetail = tokenMetadataRouteDetailResponse.json().data;
    expect(tokenMetadataRouteDetail).toMatchObject({
      benchmark_id: 'finance-data-token-metadata',
      route_id: TOKEN_METADATA_PAYSPONGE_ROUTE_ID,
      provider_id: 'paysponge-coingecko',
      artifact_count: 2,
      winner_claimed: false,
      evidence_health: 'recorded'
    });
    expect(tokenMetadataRouteDetail.timeline.length).toBe(2);
    const oldTimelineEntry = tokenMetadataRouteDetail.timeline.find((entry: { artifact_id: string }) => entry.artifact_id === TOKEN_METADATA_CANONICAL_ID);
    const latestTimelineEntry = tokenMetadataRouteDetail.timeline.find((entry: { artifact_id: string }) => entry.artifact_id === TOKEN_METADATA_CANONICAL_ID_NEW);
    expect(oldTimelineEntry).toBeTruthy();
    expect(oldTimelineEntry.metrics.canonical_network_match_rate).toBe(0);
    expect(oldTimelineEntry.caveats).toContain('canonical_network_match_rate=0.0 preserved from benchmark artifact');
    expect(latestTimelineEntry).toMatchObject({
      artifact_id: TOKEN_METADATA_CANONICAL_ID_NEW,
      success_count: 5,
      failure_count: 0,
      median_latency_ms: 5430,
      p95_latency_ms: 5730,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      evidence_health: 'recorded'
    });
    expect(latestTimelineEntry.caveat_objects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'pay_cli_status_hidden',
        severity: 'info',
        evidence_field: 'status_code',
        value: null
      })
    ]));
    expect(latestTimelineEntry.caveat_objects.some((row: { code: string }) => row.code === 'canonical_network_mismatch')).toBe(false);

    const stableTokenMetadataRouteDetailResponse = await app.inject({
      method: 'GET',
      url: `/v1/radar/benchmark-history/finance-data-token-metadata/routes/${encodeURIComponent(TOKEN_METADATA_STABLE_ROUTE_ID)}`
    });
    expect(stableTokenMetadataRouteDetailResponse.statusCode).toBe(200);
    const stableTokenMetadataRouteDetail = stableTokenMetadataRouteDetailResponse.json().data;
    expect(stableTokenMetadataRouteDetail.winner_claimed).toBe(false);
    expect(stableTokenMetadataRouteDetail.evidence_health).toBe('recorded');
    expect(stableTokenMetadataRouteDetail.timeline[0].evidence_health).toBe('recorded');
    expect(stableTokenMetadataRouteDetail.timeline[0].caveat_objects.some((row: { code: string }) => row.code === 'canonical_network_mismatch')).toBe(false);
    expect(stableTokenMetadataRouteDetail.timeline[0].caveat_objects.some((row: { code: string; severity: string }) => row.code === 'pay_cli_status_hidden' && row.severity === 'warning')).toBe(false);
    expect(tokenMetadataRouteHistory.winner_claimed).toBe(false);
    expect(tokenMetadataRouteHistory.routes.some((row: { winner_claimed: boolean }) => row.winner_claimed)).toBe(false);

    const missingRouteBenchmarkResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/unknown-benchmark/routes' });
    expect(missingRouteBenchmarkResponse.statusCode).toBe(404);
    expect(missingRouteBenchmarkResponse.json()).toEqual({ error: 'benchmark_not_found' });

    const missingRouteResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/finance-data-token-metadata/routes/unknown-route' });
    expect(missingRouteResponse.statusCode).toBe(404);
    expect(missingRouteResponse.json()).toEqual({ error: 'route_not_found' });

    const missingHistoryV2Response = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history/unknown-benchmark' });
    expect(missingHistoryV2Response.statusCode).toBe(404);
    expect(missingHistoryV2Response.json()).toEqual({ error: 'benchmark_not_found' });
    expect(artifacts.some((row) => row.benchmark_id === 'finance-data-token-metadata')).toBe(true);

    await app.close();
  });

  it('registers the token-search benchmark artifact', () => {
    const artifacts = listBenchmarkArtifacts();
    const tokenSearch = artifacts.find((row) => row.artifact_id === TOKEN_SEARCH_CANONICAL_ID);
    expect(tokenSearch).toBeTruthy();
    expect(tokenSearch?.benchmark_id).toBe('finance-data-token-search');
    expect(tokenSearch?.artifact_path).toBe('live-proofs/finance-data-token-search-benchmark-runs-2026-05-17.md');
    expect(tokenSearch?.source_repo).toBe('https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness');
    expect(tokenSearch?.total_runs).toBe(5);
    expect(tokenSearch?.winner_status).toBe('no_clear_winner');
    expect(tokenSearch?.winner_claimed).toBe(false);
  });

  it('registers both token-metadata benchmark artifacts and preserves older PaySponge caveat', () => {
    const artifacts = listBenchmarkArtifacts();
    const tokenMetadata = artifacts.find((row) => row.artifact_id === TOKEN_METADATA_CANONICAL_ID);
    const tokenMetadataNew = artifacts.find((row) => row.artifact_id === TOKEN_METADATA_CANONICAL_ID_NEW);
    expect(tokenMetadata).toBeTruthy();
    expect(tokenMetadataNew).toBeTruthy();
    expect(tokenMetadata?.benchmark_id).toBe('finance-data-token-metadata');
    expect(tokenMetadata?.artifact_path).toBe('live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md');
    expect(tokenMetadataNew?.artifact_path).toBe('live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-19.md');
    expect(tokenMetadata?.winner_status).toBe('no_clear_winner');
    expect(tokenMetadataNew?.winner_status).toBe('no_clear_winner');
    expect(tokenMetadata?.winner_claimed).toBe(false);
    expect(tokenMetadataNew?.winner_claimed).toBe(false);
    const paysponge = tokenMetadata?.routes.find((route) => route.provider_id === 'paysponge-coingecko');
    const payspongeNew = tokenMetadataNew?.routes.find((route) => route.provider_id === 'paysponge-coingecko');
    expect(paysponge?.status_evidence).toContain('canonical_network_match_rate=0.0');
    expect(payspongeNew?.status_evidence).toBe('pay_cli exit code 0 and parsed response body');
  });

  it('registers the web-search benchmark artifact', () => {
    const artifacts = listBenchmarkArtifacts();
    const webSearch = artifacts.find((row) => row.artifact_id === DATA_WEB_SEARCH_RESULTS_CANONICAL_ID);
    expect(webSearch).toBeTruthy();
    expect(webSearch?.benchmark_id).toBe(DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID);
    expect(webSearch?.artifact_path).toBe('live-proofs/data-web-search-results-benchmark-runs-2026-05-19.md');
    expect(webSearch?.total_runs).toBe(10);
    expect(webSearch?.winner_status).toBe('no_clear_winner');
    expect(webSearch?.winner_claimed).toBe(false);
    expect(webSearch?.routes.length).toBe(2);
  });
});
