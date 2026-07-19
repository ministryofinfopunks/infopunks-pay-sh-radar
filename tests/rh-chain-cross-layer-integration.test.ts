import { describe, expect, it, vi } from 'vitest';
import { RhChainCrossLayerIntegrationService } from '../src/services/rhChainCrossLayerIntegrationService';
import type { RhChainLayerClassification } from '../src/services/rhChainMarketStructureService';
import type { RhChainMarketSnapshot } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryRhChainReviewedClassificationStore, RhChainReviewedClassificationService } from '../src/services/rhChainReviewedClassificationService';

const NOW = new Date('2026-07-19T12:00:00.000Z');
const contract = (digit: string) => `0x${digit.repeat(40)}`;
const evidence = (id: string) => ({ evidence_id: id, kind: 'primary_source' as const, source_name: 'Reviewed project documentation', source_url: 'https://example.com/evidence', summary: 'Primary evidence supports both reviewed layers for this exact contract.', observed_at: NOW.toISOString(), content_hash: null });

function reviewedService(now = NOW) {
  return new RhChainReviewedClassificationService(new InMemoryRhChainReviewedClassificationStore(), { now: () => now });
}

async function approve(service: RhChainReviewedClassificationService, exactContract: string, primary = 'agent', secondary: string[] = ['defi'], source = 'internal_research') {
  await service.propose({ chain: 'robinhood', contract: exactContract, primary_layer: primary, secondary_layers: secondary, confidence: 'high', classification_evidence: [evidence(`e-${exactContract.slice(-4)}`)], review_status: 'proposed', source, manual_override_reason: null, audit_note: 'Exact-contract proposal.' }, 'reviewer');
  await service.approve({ contract: exactContract }, { expected_version: 1, audit_note: 'Evidence approved.' }, 'approver');
}

function snapshot(exactContract: string, liquidity = 100, volume = 50, capturedAt = NOW.toISOString()): RhChainMarketSnapshot {
  return { snapshot_id: `snapshot-${exactContract}`, captured_at: capturedAt, provider: 'dexscreener', chain_id: 'robinhood', token_address: exactContract, ticker: 'TEST', pair_address: `pair-${exactContract.slice(-4)}`, dex_id: 'uniswap', price_usd: 1, liquidity_usd: liquidity, market_cap: 1_000, fdv: 1_200, volume_h24: volume, volume_h6: volume / 2, volume_h1: volume / 10, txns_h24_buys: 8, txns_h24_sells: 5, txns_h6_buys: 3, txns_h6_sells: 2, price_change_h24: 2, pair_created_at: '2026-07-01T00:00:00.000Z', active_boosts: 0, paid_order_types: [], paid_order_statuses: [], data_mode: 'live_cached', source_url: 'https://dexscreener.com/robinhood/pair', freshness_state: 'fresh', raw_data_version: 'dexscreener-v1', cache_status: 'fresh', cache_provenance: 'historical_snapshot' };
}

function integration(service: RhChainReviewedClassificationService, curated: RhChainLayerClassification[] = [], snapshots: Record<string, RhChainMarketSnapshot | null> = {}) {
  const latestSnapshotsForContracts = vi.fn(async (contracts: string[]) => Object.fromEntries(contracts.map((item) => [item, snapshots[item] ?? null])));
  return { latestSnapshotsForContracts, subject: new RhChainCrossLayerIntegrationService({ reviewedClassifications: service, curatedClassifications: curated, latestSnapshotsForContracts, now: () => NOW, cacheTtlMs: 1 }) };
}

const curated = (exactContract: string, overrides: Partial<RhChainLayerClassification> = {}): RhChainLayerClassification => ({ contract: exactContract, ticker: 'CURATED', display_name: 'Curated intersection', dexscreener_pair: null, primary_layer: 'rwa', secondary_layers: ['defi'], cross_layer_category: 'defi_x_rwa', classification_reason: 'Curated exact-contract review supports the RWA and DeFi intersection.', classification_source: 'manual_review', classification_confidence: 'medium', evidence_state: 'under_receipt_check', missing_evidence: [], caveat: null, reviewed_at: '2026-07-18T00:00:00.000Z', observed_at: '2026-07-18T00:00:00.000Z', data_mode: 'manual', ...overrides });

describe('RH Chain durable Cross-Layer integration', () => {
  it('consumes only approved, active, effective durable records', async () => {
    const service = reviewedService();
    await approve(service, contract('1'));
    await service.propose({ chain: 'robinhood', contract: contract('2'), primary_layer: 'agent', secondary_layers: ['rwa'], confidence: 'medium', classification_evidence: [evidence('proposed')], review_status: 'proposed', source: 'internal_research', manual_override_reason: null, audit_note: 'Proposal only.' }, 'reviewer');
    await service.propose({ chain: 'robinhood', contract: contract('3'), primary_layer: 'meme', secondary_layers: ['rwa'], confidence: 'medium', classification_evidence: [evidence('rejected')], review_status: 'proposed', source: 'internal_research', manual_override_reason: null, audit_note: 'Will reject.' }, 'reviewer');
    await service.reject({ contract: contract('3') }, { expected_version: 1, audit_note: 'Rejected.', reason: 'Evidence mismatch.' }, 'reviewer');
    await approve(service, contract('4'), 'infrastructure', ['defi']);
    await service.supersede({ contract: contract('4') }, { expected_version: 2, audit_note: 'Superseded.', reason: 'New review required.' }, 'reviewer');
    const { subject } = integration(service, [], { [contract('1')]: snapshot(contract('1')) });
    const result = await subject.build();
    expect(result.entries.map((entry) => entry.contract)).toEqual([contract('1')]);
    expect(result.entries[0]).toMatchObject({ category: 'agent_x_defi', classification_source: 'durable_reviewed_classification', classification_version: 2 });
  });

  it('rejects future-effective records and keeps unknown visible', async () => {
    const future = reviewedService(new Date('2026-07-20T12:00:00.000Z'));
    await approve(future, contract('5'));
    const { subject } = integration(future);
    const result = await subject.build();
    expect(result.entries).toEqual([]);
    expect(result.classification_coverage.reviewed_exact_contracts).toBe(0);

    const unknown = reviewedService();
    await approve(unknown, contract('6'), 'unknown', ['data']);
    const unknownResult = await integration(unknown).subject.build();
    expect(unknownResult.entries).toEqual([]);
    expect(unknownResult.unknown_count).toBe(1);
    expect(unknownResult.source_required_count).toBe(1);
  });

  it('preserves curated memory and emits an explicit durable disagreement', async () => {
    const exactContract = contract('7');
    const service = reviewedService();
    await approve(service, exactContract, 'agent', ['rwa']);
    const { subject } = integration(service, [curated(exactContract)], { [exactContract]: snapshot(exactContract) });
    const result = await subject.build();
    expect(result.entries[0]).toMatchObject({ primary_layer: 'rwa', secondary_layers: ['defi'], classification_source: 'curated_reviewed_memory', conflict_state: 'curated_durable_disagreement' });
    expect(result.conflict_count).toBe(1);
    expect(result.warnings.join(' ')).toContain('curated/durable');
    const internal = await subject.inspectConflicts();
    expect(internal.conflicts[0]).toMatchObject({ contract: exactContract, resolution: 'curated_memory_preserved', durable: { primary_layer: 'agent', classification_version: 2 } });
  });

  it('keeps source-required curated claims outside the public list and never upgrades AI narrative to agent activity', async () => {
    const exactContract = contract('8');
    const service = reviewedService();
    const record = curated(exactContract, { primary_layer: 'meme', secondary_layers: ['ai_narrative'], cross_layer_category: 'meme_x_ai_narrative', evidence_state: 'source_required_for_claims', caveat: 'AI narrative does not prove agent activity.' });
    const { subject } = integration(service, [record]);
    const result = await subject.build();
    expect(result.entries).toEqual([]);
    expect(result.source_required_count).toBe(1);
    expect(JSON.stringify(result.entries)).not.toContain('agent_x_meme');
  });

  it('withholds mismatched stored market data without hiding the reviewed classification', async () => {
    const exactContract = contract('9');
    const service = reviewedService();
    await approve(service, exactContract);
    const mismatched = snapshot(contract('a'));
    const { subject } = integration(service, [], { [exactContract]: mismatched });
    const result = await subject.build();
    expect(result.entries[0]).toMatchObject({ contract: exactContract, freshness: 'unavailable', market_data: { available: false } });
    expect(result.entries[0].warnings.join(' ')).toContain('exact-match');
    expect(result.market_data_coverage.percentage).toBe(0);
  });

  it('uses one bounded classification read and one preloaded snapshot map with no provider path', async () => {
    const reader = { listApproved: vi.fn(async (paging: unknown) => ({ classifications: [], page: 1, page_size: 100, has_more: false, authoritative: true as const, doctrine: 'reviewed' })) };
    const snapshots = vi.fn(async () => ({}));
    const subject = new RhChainCrossLayerIntegrationService({ reviewedClassifications: reader as never, curatedClassifications: [], latestSnapshotsForContracts: snapshots, now: () => NOW, cacheTtlMs: 60_000 });
    await subject.build();
    await subject.build();
    expect(reader.listApproved).toHaveBeenCalledTimes(1);
    expect(reader.listApproved).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    expect(snapshots).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenCalledWith([]);
  });

  it('calculates deterministic coverage, intersection totals, and concentration from persisted snapshots', async () => {
    const service = reviewedService();
    const contracts = ['a', 'b', 'c', 'd'].map(contract);
    for (const item of contracts) await approve(service, item);
    const snapshots = {
      [contracts[0]]: snapshot(contracts[0], 70, 70),
      [contracts[1]]: snapshot(contracts[1], 20, 20),
      [contracts[2]]: snapshot(contracts[2], 5, 5)
    };
    const result = await integration(service, [], snapshots).subject.build();
    expect(result).toMatchObject({ intersection_count: 1, reviewed_project_count: 4, freshness: 'partial', confidence: 'medium', methodology_version: 'cross_layer_intersections_v1' });
    expect(result.intersection_counts).toEqual([{ category: 'agent_x_defi', project_count: 4 }]);
    expect(result.tracked_liquidity_by_intersection).toEqual([expect.objectContaining({ category: 'agent_x_defi', liquidity_usd: 95 })]);
    expect(result.market_data_coverage).toMatchObject({ eligible_exact_contracts: 4, with_persisted_market_data: 3, percentage: 75, provider_requests_in_path: 0 });
    expect(result.classification_coverage).toMatchObject({ reviewed_exact_contracts: 4, cross_layer_eligible_exact_contracts: 4, percentage: 100 });
    expect(result.concentration).toMatchObject({ top_three_liquidity_share: 100, top_three_volume_share: 100 });
    expect(result.headline).toBe('Agent × DeFi is the clearest reviewed intersection in the bounded set.');
  });
});
