import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('radar mapping targets route', () => {
  it('returns read-only mapping target list', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/mapping-targets' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.count).toBe(10);
    expect(body.targets.some((row: any) => row.category === 'solana-infra' && row.benchmark_intent === 'account balance' && row.current_state === 'needs_two_comparable_mappings')).toBe(true);
    const solanaInfra = body.targets.find((row: any) => row.category === 'solana-infra' && row.benchmark_intent === 'account balance');
    expect(solanaInfra.suggested_provider_candidates).toEqual(['QuickNode Solana Mainnet JSON-RPC']);
    expect(solanaInfra.readiness_blocker).toContain('evidence_health=unverified');
    expect(solanaInfra.readiness_blocker).toContain('stablecrypto.dev/api/alchemy/node/rpc');
    expect(body.targets.some((row: any) => row.category === 'communications' && row.benchmark_intent === 'email delivery' && row.current_state === 'candidate_mapping_found')).toBe(true);
    expect(body.targets.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token metadata' && row.current_state === 'candidate_mapping_found')).toBe(true);
    const tokenMetadata = body.targets.find((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token metadata');
    expect(tokenMetadata.needed_next_step).toBe('verify endpoint/method/request shape for token metadata candidates');
    expect(tokenMetadata.readiness_blocker).toBe('candidate mappings exist, but no verified/proven token metadata route evidence is recorded');
    expect(tokenMetadata.suggested_provider_candidates).toEqual(['CoinGecko Onchain DEX API', 'StableCrypto']);
    expect(body.targets.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token search' && row.current_state === 'benchmark_ready')).toBe(true);
    expect(body.targets.some((row: any) => row.category === 'social-data' && row.benchmark_intent === 'reddit post search' && row.current_state === 'needs_two_comparable_mappings')).toBe(true);
    const socialData = body.targets.find((row: any) => row.category === 'social-data' && row.benchmark_intent === 'reddit post search');
    expect(socialData.suggested_provider_candidates).toEqual(['StableEnrich Reddit Search', 'StableSocial Reddit Search']);
    expect(socialData.needed_next_step).toContain('Benchmark Scaffold');
    expect(socialData.needed_next_step).toContain('evidence_health=caveated');
    expect(socialData.readiness_blocker).toContain('Only one comparable paid-proven route exists today');
    expect(socialData.readiness_blocker).toContain('variants A-F');
    expect(socialData.readiness_blocker).toContain('candidate/unproven');
    expect(body.targets.some((row: any) => row.category === 'document-ai' && row.benchmark_intent === 'document OCR text extraction' && row.current_state === 'benchmark_ready')).toBe(true);
    expect(JSON.stringify(body.targets)).not.toContain('candidate A');
    expect(JSON.stringify(body.targets)).not.toContain('candidate B');
    expect(body.targets.some((row: any) => row.category === 'finance/data' && Array.isArray(row.suggested_provider_candidates) && row.suggested_provider_candidates.includes('StableCrypto'))).toBe(true);
    expect(body.targets.some((row: any) => row.category === 'web-search' && row.benchmark_intent === 'web search results' && row.current_state === 'benchmark_ready')).toBe(true);
    const webSearch = body.targets.find((row: any) => row.category === 'web-search' && row.benchmark_intent === 'web search results');
    expect(webSearch.suggested_provider_candidates).toEqual(['StableEnrich Exa Search', 'Perplexity Search']);
    expect(webSearch.needed_next_step).toContain('Recorded benchmark is available');
    expect(webSearch.readiness_blocker).toContain('No winner is claimed');
    expect(body.targets.some((row: any) => row.category === 'maps' && row.benchmark_intent === 'place search results' && row.current_state === 'needs_two_comparable_mappings')).toBe(true);
    const maps = body.targets.find((row: any) => row.category === 'maps' && row.benchmark_intent === 'place search results');
    expect(maps.needed_next_step).toContain('Benchmark Scaffold');
    expect(maps.needed_next_step).toContain('repair Google Places request shape or find another comparable place-search route');
    expect(maps.readiness_blocker).toContain('StableEnrich Google Maps Text Search is paid-proven');
    expect(maps.readiness_blocker).toContain('Google Places SearchText paid execution returned zero recognizable place candidates');
    expect(maps.readiness_blocker).toContain('no five-run benchmark artifact exists');

    await app.close();
  });

  it('does not change benchmark readiness state', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const readinessResponse = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-readiness' });
    expect(readinessResponse.statusCode).toBe(200);
    const readiness = readinessResponse.json().data;
    expect(readiness.categories.some((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'get SOL price')).toBe(true);
    const tokenSearch = readiness.categories.find((row: any) => row.category === 'finance/data' && row.benchmark_intent === 'token search');
    expect(tokenSearch).toBeTruthy();
    expect(tokenSearch.benchmark_ready).toBe(true);
    expect(tokenSearch.superiority_ready).toBe(true);

    await app.close();
  });
});
