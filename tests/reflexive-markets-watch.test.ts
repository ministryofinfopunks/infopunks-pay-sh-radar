import { describe, expect, it } from 'vitest';
import { createOpenApiSpec } from '../src/api/openapi';
import { createApp } from '../src/api/app';
import { InMemoryReflexiveStore, type ReflexiveSnapshot } from '../src/services/rhChainReflexiveRadarService';
import { PINNED_CANDIDATE_CONFIGURATIONS, SHADOW_MINIMUM_EVIDENCE_POLICY } from '../src/services/ipxPltrShadowLabService';
import {
  compareHistoricalClaimToRadarWindow,
  createWatchClaim,
  deterministicAuditPriority,
  InMemoryReflexiveWatchStore,
  ReflexiveMarketsWatchService,
  ReflexiveWatchError,
  transitionCaseState,
  type ReflexiveWatchClaimInput
} from '../src/services/rhChainReflexiveWatchService';

const now = '2026-09-03T00:00:00.000Z';
const AI = '0x2e8c31162b855a2ffa90f6f8634643ad6f111e18';
const NVDA = '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec';
const claimInput = (overrides: Partial<ReflexiveWatchClaimInput> = {}): ReflexiveWatchClaimInput => ({
  captured_at: now,
  source_type: 'THIRD_PARTY_RESEARCH',
  source_url: 'https://example.com/report',
  source_reference: null,
  source_name: 'Example Research',
  claim_text: 'Example mission market holds material canonical Stock Token inventory.',
  subject_assets: ['AI', 'NVDA'],
  mission_token: 'AI',
  stock_token_or_rwa: 'NVDA',
  venue: 'LONG',
  pool_identifiers: ['0xpool'],
  observation_window: 'D7',
  claimed_metrics: { share: '20%' },
  claimed_timestamp: '2026-09-01T00:00:00.000Z',
  claim_category: 'MATERIAL_STOCK_TOKEN_SHARE',
  provisional_interpretation: 'Watch suggests an audit target only.',
  watch_verdict: 'CONFIRMS',
  evidence_status: 'RADAR_AUDIT_TARGET',
  ...overrides
});

async function watched(snapshot?: Partial<ReflexiveSnapshot>, at = now) {
  const store = new InMemoryReflexiveStore();
  if (snapshot) await store.save({ ...await store.load(), ...snapshot });
  return new ReflexiveMarketsWatchService(() => store.load(), new InMemoryReflexiveWatchStore(), () => new Date(at));
}

const raw = (units: number) => String(BigInt(units) * 10n ** 18n);
const nvdaAsset = { asset_id: 'asset-nvda', ticker: 'NVDA', name: 'NVIDIA', chain_id: 4663, canonical_contract: NVDA, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null, trading_capabilities: null, logo: null, observed_at: now, fetched_at: now, provenance: 'test', first_party_asset: false } as const;
function longAudit(units: number, supply: number, observedAt: string, block: number) {
  return { market_id: 'long-ai-nvda', inventory_status: 'AVAILABLE', stock_principal_raw: raw(units), stock_principal_units: String(units), stock_total_supply_raw: raw(supply), stock_total_supply_units: String(supply), scoped_absorption_pct: String(units / supply * 100), observed_block: block, observed_at: observedAt, positions: [{ stock_principal_raw: raw(Math.floor(units / 2)), range_state: 'IN_RANGE', core_status: 'CORE_POSITION_OBSERVED', launch_state: 'UNCHANGED_SINCE_LAUNCH' }, { stock_principal_raw: raw(units - Math.floor(units / 2)), range_state: 'IN_RANGE', core_status: 'CORE_POSITION_OBSERVED', launch_state: 'UNCHANGED_SINCE_LAUNCH' }] } as any;
}
function quote(id: string, observedAt: string, stockLiquidity: number, stockVolume: number, wethLiquidity: number, wethVolume: number) {
  const stockMarket = { market_id: `stock-${id}`, mission_contract: AI, quote_class: 'CANONICAL_STOCK_TOKEN', liquidity_usd: stockLiquidity, volume_usd: stockVolume } as any;
  const wethMarket = { market_id: `weth-${id}`, mission_contract: AI, quote_class: 'WETH', liquidity_usd: wethLiquidity, volume_usd: wethVolume } as any;
  return { markets: [stockMarket, wethMarket], observation: { observation_id: `quote-${id}`, mission_contract: AI, mission_symbol: 'AI', observed_at: observedAt, window: 'ROLLING_24H', eligible_market_ids: [stockMarket.market_id, wethMarket.market_id], excluded_market_ids: [], stock_quote_market_ids: [stockMarket.market_id], stock_quote_volume_usd: stockVolume, total_eligible_volume_usd: stockVolume + wethVolume, stock_quote_volume_share: stockVolume / (stockVolume + wethVolume), stock_quote_liquidity_usd: stockLiquidity, total_eligible_liquidity_usd: stockLiquidity + wethLiquidity, stock_quote_liquidity_share: stockLiquidity / (stockLiquidity + wethLiquidity), capital_flow_divergence: stockLiquidity / (stockLiquidity + wethLiquidity) - stockVolume / (stockVolume + wethVolume), quote_regime: 'STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED', source_alignment: 'ALIGNED', methodology_version: 'rmm-v0.4.2-quote-persistence-v1', immutable: true } as any };
}

describe('Reflexive Markets Watch v0.1', () => {
  it('creates immutable Watch claims with source provenance and Watch interpretation verdicts', () => {
    const claim = createWatchClaim(claimInput());
    expect(claim).toMatchObject({ object_type: 'REFLEXIVE_WATCH_CLAIM', immutable: true, source_type: 'THIRD_PARTY_RESEARCH', watch_verdict: 'CONFIRMS', watch_verdict_type: 'WATCH_INTERPRETATION' });
    expect(Object.isFrozen(claim)).toBe(true);
    expect(Object.isFrozen(claim.claimed_metrics)).toBe(true);
  });

  it('detects duplicate claims but creates a new immutable claim when source figures change', async () => {
    const service = await watched();
    const first = await service.createClaim(claimInput({ source_url: 'https://example.com/new-report' }));
    await expect(service.createClaim(claimInput({ source_url: 'https://example.com/new-report' }))).rejects.toMatchObject({ code: 'duplicate_watch_claim' } satisfies Partial<ReflexiveWatchError>);
    const revised = await service.createClaim(claimInput({ source_url: 'https://example.com/new-report', claimed_metrics: { share: '22%' } }));
    expect(revised.claim_id).not.toBe(first.claim_id);
  });

  it('supports Watch CONFIRMS, FALSIFIES, MIXED and INSUFFICIENT_DATA without creating Radar evidence', () => {
    for (const watch_verdict of ['CONFIRMS', 'FALSIFIES', 'MIXED', 'INSUFFICIENT_DATA'] as const) {
      const claim = createWatchClaim(claimInput({ watch_verdict }));
      expect(claim.watch_verdict_type).toBe('WATCH_INTERPRETATION');
      expect(JSON.stringify(claim)).not.toMatch(/RADAR_VERDICT|verified_inventory|verified_supply/i);
    }
  });

  it('builds RWA Activation Cases with append-only transitions and no single activation score', async () => {
    const service = await watched();
    const ai = await service.case('AI_NVDA_CAPITAL_VS_FLOW');
    expect(ai).toMatchObject({ object_type: 'RWA_ACTIVATION_CASE', current_evidence_state: 'MIXED', activation_dimensions: expect.any(Object) });
    expect(ai).not.toHaveProperty('score');
    const transitioned = transitionCaseState(ai!, 'VERIFYING', now, 'Reviewer opened a new proof pass.');
    expect(transitioned.state_transitions).toHaveLength(ai!.state_transitions.length + 1);
    expect(ai!.state_transitions).toHaveLength(1);
  });

  it('promotes a Watch claim to a Radar audit target with confirmation and falsification criteria only', async () => {
    const service = await watched();
    const claim = (await service.claims())[0];
    const target = await service.promoteClaim({ claim_id: claim.claim_id, case_id: 'AI_NVDA_CAPITAL_VS_FLOW', confirm_criteria: ['canonical NVDA', 'same-block totalSupply'], falsify_criteria: ['noncanonical quote', 'pool mismatch'], required_onchain_objects: ['PoolKey', 'PositionManager NFT'], time_alignment_required: ['same block'], missing_data: ['vault identity'] });
    expect(target).toMatchObject({ object_type: 'RADAR_AUDIT_TARGET', current_result: 'UNRESOLVED', immutable: true });
    expect(target.potential_results).toEqual(expect.arrayContaining(['CONFIRMED', 'PARTIALLY_CONFIRMED', 'CONTRADICTED', 'NOT_COMPARABLE', 'HISTORICAL_STATE_UNAVAILABLE']));
    expect(JSON.stringify(target)).not.toMatch(/CALL|RESOLUTION|PRINT|GENESIS|transaction_capability/i);
  });

  it('flags historical temporal mismatch for the HIMS 81% claim', async () => {
    const service = await watched();
    const hims = (await service.claims()).find((claim) => claim.stock_token_or_rwa === 'HIMS')!;
    expect(hims.evidence_status).toBe('HISTORICAL_STATE_UNAVAILABLE');
    expect(compareHistoricalClaimToRadarWindow(hims, '2026-09-03T00:00:00.000Z', false)).toBe('HISTORICAL_STATE_UNAVAILABLE');
  });

  it('links AI verified evidence surfaces while preserving a mixed Capital vs Flow case', async () => {
    const service = await watched({
      long_inventory_history: [{ inventory_status: 'AVAILABLE', market_id: 'ai-nvda', stock_total_supply_raw: '100', observed_block: 10, observed_at: now } as any],
      mission_stock_footprints: [{ status: 'PARTIAL', footprint_id: 'footprint', scoped_footprint_pct: '20' } as any],
      quote_persistence: [{ observation_id: 'quote', quote_regime: 'CAPITAL_PERSISTENCE_FLOW_MIGRATION' } as any]
    });
    const ai = await service.case('AI_NVDA_CAPITAL_VS_FLOW');
    expect(ai?.radar_evidence.some((link) => link.radar_state === 'VERIFIED')).toBe(true);
    expect(ai?.activation_dimensions.CAPITAL_PERSISTENCE).toBe('SUPPORTING_EVIDENCE');
    expect(ai?.activation_dimensions.FLOW_PERSISTENCE).toBe('MIXED');
    expect(ai?.current_evidence_state).toBe('MIXED');
  });

  it('precommits the AI/NVDA D7 re-audit before the checkpoint exists', async () => {
    const service = await watched({ assets: [nvdaAsset], long_inventory_history: [longAudit(8782, 57300, '2026-09-01T00:00:00.000Z', 100)] });
    const audit = (await service.case('AI_NVDA_CAPITAL_VS_FLOW'))?.research_observations[0];
    expect(audit).toMatchObject({ object_type: 'AI_NVDA_D7_RE_AUDIT', status: 'PENDING', target_at: '2026-09-08T00:00:00.000Z', h2b_verdict: 'OBSERVING', h2b_policy: { policy_version: 'H2B_D7_PRECOMMIT_V1', frozen_before_d7_fetch: true } });
    expect(audit?.baseline?.verified_long_launch_position_nvda).toBe('8782');
    expect(audit?.d7).toBeNull();
  });

  it('moves H2B toward support when D7 principal retention survives multi-rail flow', async () => {
    const baseQuote = quote('base', '2026-09-01T00:00:00.000Z', 80_000, 20_000, 20_000, 80_000);
    const d7Quote = quote('d7', '2026-09-08T00:00:00.000Z', 70_000, 20_000, 30_000, 80_000);
    const service = await watched({ assets: [nvdaAsset], long_inventory_history: [longAudit(8782, 57300, '2026-09-01T00:00:00.000Z', 100), longAudit(8500, 90000, '2026-09-08T00:00:00.000Z', 200)], quote_markets: [...baseQuote.markets, ...d7Quote.markets], quote_persistence: [baseQuote.observation, d7Quote.observation], vault_observations: [], supply_events: [{ event_id: 'mint-1', asset_id: 'asset-nvda', event_type: 'mint', raw_token_amount: raw(32700), share_equivalent_amount: null, block: 150, tx_hash: '0xmint', timestamp: '2026-09-04T00:00:00.000Z', before_supply_raw: null, after_supply_raw: null, provenance: { source: 'test', href: '', observed_at: '2026-09-04T00:00:00.000Z', fetched_at: '2026-09-04T00:00:00.000Z', note: 'test', quality: 'onchain' } }] as any }, '2026-09-09T00:00:00.000Z');
    const ai = await service.case('AI_NVDA_CAPITAL_VS_FLOW');
    const audit = ai?.research_observations[0];
    expect(audit?.status).toBe('OBSERVED');
    expect(Number(audit?.change.nvda_principal_retention_pct)).toBeCloseTo(96.7889, 4);
    expect(audit?.h2b_verdict).toBe('SUPPORTING_EVIDENCE');
    expect(audit?.capital_regime).toBe('STOCK_CAPITAL_PERSISTS');
    expect(audit?.flow_regime).toBe('MULTIRAIL_FLOW');
    expect(audit?.capital_vs_flow_regime).toBe('STOCK_CAPITAL_MULTIRAIL_FLOW');
    expect(audit?.d7?.position_range_liquidity_state).toHaveLength(2);
    expect(audit?.d7?.vault_status).toBe('UNAVAILABLE');
    expect(audit?.change.mint_burn_events).toHaveLength(1);
    expect(ai?.current_evidence_state).toBe('PARTIALLY_VERIFIED');
  });

  it('emits falsifying evidence when D7 principal unwinds and stock quote context decays', async () => {
    const baseQuote = quote('base', '2026-09-01T00:00:00.000Z', 80_000, 20_000, 20_000, 80_000);
    const d7Quote = quote('d7', '2026-09-08T00:00:00.000Z', 20_000, 20_000, 80_000, 80_000);
    const service = await watched({ assets: [nvdaAsset], long_inventory_history: [longAudit(8782, 57300, '2026-09-01T00:00:00.000Z', 100), longAudit(2000, 57300, '2026-09-08T00:00:00.000Z', 200)], quote_markets: [...baseQuote.markets, ...d7Quote.markets], quote_persistence: [baseQuote.observation, d7Quote.observation] }, '2026-09-09T00:00:00.000Z');
    const snapshot = await service.snapshot();
    const ai = snapshot.cases.find((item) => item.case_id === 'AI_NVDA_CAPITAL_VS_FLOW');
    expect(ai?.research_observations[0]).toMatchObject({ h2b_verdict: 'FALSIFYING_EVIDENCE', capital_regime: 'STOCK_CAPITAL_UNWINDING', capital_vs_flow_regime: 'STOCK_RELATIONSHIP_DECAYING' });
    expect(ai?.current_evidence_state).toBe('FALSIFIED');
    expect(snapshot.falsification_queue.map((item) => item.case_id)).toContain('AI_NVDA_CAPITAL_VS_FLOW');
  });

  it('keeps BONER/HIMS historical, LongX unverified, RMM mapped, RA1 unconfirmed, and falsification visible', async () => {
    const snapshot = await (await watched()).snapshot();
    expect(snapshot.cases.find((item) => item.case_id === 'BONER_HIMS_FLOAT_STRESS')?.current_evidence_state).toBe('NOT_REPRODUCIBLE');
    expect(snapshot.cases.find((item) => item.case_id === 'LONGX_NVDA3L')).toMatchObject({ current_evidence_state: 'RADAR_CANDIDATE', activity_classification: 'SPECULATIVE_ACTIVITY' });
    expect(snapshot.thesis_board.map((item) => [item.hypothesis_id, item.state])).toEqual([['H2A', 'SUPPORTING'], ['H2B', 'OBSERVING'], ['H2C', 'MIXED'], ['H2D', 'INSUFFICIENT'], ['H7', 'OBSERVATIONAL'], ['RA1', 'EARLY_SUPPORTING_EVIDENCE']]);
    expect(snapshot.thesis_board.find((item) => item.hypothesis_id === 'RA1')?.watch_claims_can_upgrade).toBe(false);
    expect(snapshot.falsification_queue.map((item) => item.case_id)).toEqual(expect.arrayContaining(['AI_NVDA_CAPITAL_VS_FLOW', 'BONER_HIMS_FLOAT_STRESS']));
  });

  it('makes audit priority deterministic and independent of token price', () => {
    const priority = deterministicAuditPriority({ material_stock_share_claim: true, new_architecture: true, strong_falsification_potential: true, cross_market_significance: true, historical_data_urgency: false, existing_radar_adapter: false });
    expect(priority).toBe('HIGH');
  });

  it('exposes public API and OpenAPI without protocol or trading endpoints', async () => {
    const app = await createApp();
    try {
      for (const path of ['/v1/4663/reflexive/watch', '/v1/4663/reflexive/watch/cases', '/v1/4663/reflexive/watch/cases/AI_NVDA_CAPITAL_VS_FLOW', '/v1/4663/reflexive/watch/claims']) {
        const response = await app.inject(path);
        expect(response.statusCode, path).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/internal/4663/reflexive/watch/claims', payload: claimInput() })).statusCode).toBe(401);
      const paths = (createOpenApiSpec() as any).paths;
      for (const path of ['/v1/4663/reflexive/watch', '/v1/4663/reflexive/watch/cases', '/v1/4663/reflexive/watch/cases/{id}', '/v1/4663/reflexive/watch/claims', '/internal/4663/reflexive/watch/claims', '/internal/4663/reflexive/watch/audit-targets']) expect(paths[path]).toBeDefined();
      expect(Object.keys(paths).filter((path) => path.includes('/reflexive/watch')).join(' ')).not.toMatch(/trade|swap|transaction/i);
    } finally { await app.close(); }
  });

  it('does not mutate IPX candidates, shadow policy, or evidence policy hash', async () => {
    const candidates = structuredClone(PINNED_CANDIDATE_CONFIGURATIONS);
    const shadowPolicy = structuredClone(SHADOW_MINIMUM_EVIDENCE_POLICY);
    await (await watched()).snapshot();
    expect(PINNED_CANDIDATE_CONFIGURATIONS).toEqual(candidates);
    expect(SHADOW_MINIMUM_EVIDENCE_POLICY).toEqual(shadowPolicy);
  });
});
