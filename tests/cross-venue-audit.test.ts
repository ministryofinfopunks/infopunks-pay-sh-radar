import { describe, expect, it } from 'vitest';
import { aggregateCrossVenueStockInventory, auditPercentageClaim, unresolvedLongInventory, verifyLongMarketCandidate, type ExternalClaim, type VenueInventoryObservation } from '../src/services/rhChainCrossVenueAuditService';
import type { CanonicalStockAsset, Evidence } from '../src/services/rhChainReflexiveRadarService';

const nvda = { asset_id: 'nvda', ticker: 'NVDA', name: 'NVIDIA', chain_id: 4663, canonical_contract: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', status: 'ASSET_STATUS_ACTIVE', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null, trading_capabilities: null, logo: null, observed_at: '2026-09-02T00:00:00.000Z', fetched_at: '2026-09-02T00:00:00.000Z', provenance: 'test', first_party_asset: false } satisfies CanonicalStockAsset;
const evidence: Evidence = { source: 'test', href: 'https://example.test', observed_at: '2026-09-02T00:00:00.000Z', fetched_at: '2026-09-02T00:00:00.000Z', note: 'test', quality: 'onchain' };
const available = (overrides: Record<string, unknown> = {}) => ({ observation_id: 'pair-1', inventory_identity: '4663|PAIR|position-1', market_id: 'pair-nvda', venue: 'PAIR', venue_version: 'V5', verification_method: 'test', inventory_method: 'test', scope: 'PAIR_TRACKED_LOCKED_POSITIONS', status: 'AVAILABLE', failure: null, stock_asset_id: 'nvda', stock_contract: nvda.canonical_contract, stock_symbol: 'NVDA', stock_decimals: 18, stock_principal_raw: '20000000000000000000', stock_principal_units: '20', stock_total_supply_raw: '100000000000000000000', stock_total_supply_units: '100', absorption_pct: '20', observed_block: 100, observed_at: '2026-09-02T00:00:00.000Z', evidence: [evidence], methodology_version: 'rmm-v0.4.0', immutable: true, ...overrides }) as VenueInventoryObservation;

describe('cross-venue stock audit', () => {
  it('verifies the canonical quote and V4 state but never invents a LONG inventory container', () => {
    const market = verifyLongMarketCandidate({ market_id: 'long-ai-nvda', mission_contract: '0x2e8c31162b855a2ffa90f6f8634643ad6f111e18', mission_symbol: 'AI', quote_contract: nvda.canonical_contract, quote_symbol: 'NVDA', pool_id: '0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27', source: evidence, launch_tx: null, launch_block: null, launch_timestamp: null, venue_version: 'unknown' }, [nvda], { pool_initialized: true, observed_block: 100, observed_at: evidence.observed_at });
    expect(market).toMatchObject({ identity_status: 'VERIFIED', stock_asset_id: 'nvda' }); expect(market.failures).toContain('LONG_FACTORY_UNVERIFIED');
    expect(unresolvedLongInventory(market)).toMatchObject({ status: 'UNAVAILABLE', failure: 'LIQUIDITY_CONTAINER_UNRESOLVED', scope: 'LONG_TRACKED_MARKETS' });
  });
  it('rejects fake same-symbol quotes', () => {
    expect(verifyLongMarketCandidate({ market_id: 'fake', mission_contract: '0x2e8c31162b855a2ffa90f6f8634643ad6f111e18', mission_symbol: 'AI', quote_contract: '0x1111111111111111111111111111111111111111', quote_symbol: 'NVDA', pool_id: null, source: evidence, launch_tx: null, launch_block: null, launch_timestamp: null, venue_version: null }, [nvda], { pool_initialized: false, observed_block: null, observed_at: evidence.observed_at }).failures).toContain('QUOTE_NONCANONICAL');
  });
  it('does not compare different claim scopes or timestamps as a contradiction', () => {
    const claim: ExternalClaim = { claim_id: 'claim', subject: 'AI/NVDA', metric: 'absorption', reported_value: '23', reported_unit: 'PERCENT_OF_CANONICAL_STOCK_SUPPLY', reported_scope: 'LONG_TRACKED_MARKETS', source: evidence, source_type: 'MEDIA_REPORTED', published_at: '2026-08-01T00:00:00.000Z', observed_at: evidence.observed_at, notes: '', immutable: true };
    expect(auditPercentageClaim(claim, available()).status).toBe('NOT_COMPARABLE');
    expect(auditPercentageClaim({ ...claim, reported_scope: 'PAIR_TRACKED_LOCKED_POSITIONS' }, available()).status).toBe('TEMPORAL_MISMATCH');
  });
  it('aggregates only aligned, non-duplicate cross-venue inventory', () => {
    const result = aggregateCrossVenueStockInventory(nvda, [available(), available({ observation_id: 'long-1', inventory_identity: '4663|LONG|vault-1', market_id: 'long-ai', venue: 'LONG', scope: 'LONG_TRACKED_MARKETS', stock_principal_raw: '10000000000000000000', stock_principal_units: '10', absorption_pct: '10' }), available({ observation_id: 'duplicate', inventory_identity: '4663|LONG|vault-1', market_id: 'long-ai', venue: 'LONG', scope: 'LONG_TRACKED_MARKETS' })]);
    expect(result).toMatchObject({ status: 'ALIGNED', pair_raw_units: '20', long_raw_units: '10', total_raw_units: '30', coverage_pct: '30', unclassified_pct: '70' }); expect(result.duplicate_inventory_ids).toEqual(['duplicate']);
  });
});
