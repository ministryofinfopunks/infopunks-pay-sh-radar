import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createApp } from '../src/api/app';
import { assembleRhChainCloneRadar } from '../src/services/rhChainCloneRadarService';
import { InMemoryReflexiveStore, type CanonicalStockAsset, type MissionPair, type PairObservation, type PositionIdentityObservation, type PositionStateProof, type LockedInventoryObservation } from '../src/services/rhChainReflexiveRadarService';
import { RhChainSpendPreflightService, type RhChainSpendOptions } from '../src/services/rhChainSpendPreflightService';
import { canonicalSpendJson, InMemoryRhChainSpendReceiptStore, PostgresRhChainSpendReceiptStore } from '../src/services/rhChainSpendReceiptStore';
import { measureHolderConcentration, measureTransferActivity } from '../src/services/rhChainSpendMeasurements';

const now = new Date('2026-09-17T00:00:00.000Z');
const at = now.toISOString();
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const subject = addr(1); const quote = addr(2); const pool = `0x${'a'.repeat(64)}`;
const request = { subject: { kind: 'contract', address: subject }, action: { kind: 'swap', amount_usd: 250 } };
const asset = (): CanonicalStockAsset => ({ asset_id: 'pltr', ticker: 'PLTR', name: 'Palantir', chain_id: 4663, canonical_contract: quote,
  status: 'ASSET_STATUS_ACTIVE', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null,
  trading_capabilities: null, logo: null, observed_at: at, fetched_at: at, provenance: 'Robinhood RHJ /assets + chain 4663 deployment', first_party_asset: false });

async function fixture() {
  const snapshot = await new InMemoryReflexiveStore().load();
  const key = { currency0: subject, currency1: quote, fee: 3000, tick_spacing: 60, hooks: addr(3) };
  snapshot.assets = [asset()];
  // Fields unrelated to the spend reducer remain absent in these narrowly scoped fixtures.
  snapshot.pairs = [{ pair_id: 'pair', chain_id: 4663, mission_contract: subject, mission_symbol: 'IPX', quote_contract: quote,
    pool_id: pool, pool_address: null, canonicality: 'verified', verification: { verification_status: 'VERIFIED', failure_reasons: [],
      verified_at: at, state_observed_at: at, pool_key: key, position_verification_status: 'VERIFIED_LOCKER_POSITION', position_token_id: '1', launch_provenance_method: 'launchpad_registry_and_receipt' } } as unknown as MissionPair];
  snapshot.observations = [{ pair_id: 'pair', observation_id: 'obs', observed_at: at, fresh: true, active_liquidity: '1000', liquidity_usd: 100_000, volume_24h_usd: 2000 } as PairObservation];
  snapshot.position_identities = [{ position_identity_id: 'position', mission_pair_id: 'pair', pool_id: pool, token_id: '1', nft_owner: addr(3), expected_locker: addr(3), lock_status: 'VERIFIED_LOCKED', observed_block: 10, observed_at: at } as PositionIdentityObservation];
  snapshot.position_state_proofs = [{ proof_id: 'proof', mission_pair_id: 'pair', pool_id: pool, token_id: '1', owner_locker: addr(3), position_manager_liquidity_raw: '100', v4_core_liquidity_raw: '100', match_status: 'POSITIONMANAGER_CORE_MATCH', observed_block: 10, observed_at: at } as PositionStateProof];
  snapshot.inventory_observations = [{ observation_id: 'inventory', mission_pair_id: 'pair', token_id: '1', status: 'AVAILABLE', accounting_classification: 'VERIFIED_POSITION_ACCOUNTING',
    position_identity_id: 'position', position_state_proof_id: 'proof', stock_contract: quote, range_state: 'IN_RANGE', observed_block: 10, observed_at: at } as LockedInventoryObservation];
  const token = { address: subject, name: 'IPX', symbol: 'IPX', decimals: 18, tokenType: 'ERC-20', holdersCount: 50, totalSupply: '1000000000000000000000000000000', raw: {} };
  const holders = { items: Array.from({ length: 50 }, (_, i) => ({ address: { hash: addr(i + 100) }, value: '20000000000000000000000000000' })), nextPageParams: null };
  const receipts = new InMemoryRhChainSpendReceiptStore();
  const clones = assembleRhChainCloneRadar([]);
  const options: RhChainSpendOptions = { snapshot: async () => snapshot, clones: async () => clones,
    attention: async () => { throw new Error('unavailable'); },
    onchain: { getToken: async () => token, getTokenHolders: async () => holders, getTokenTransfers: async () => ({ items: [], nextPageParams: null }) },
    receipts, now: () => now };
  return { snapshot, token, holders, receipts, options, clones, service: new RhChainSpendPreflightService(options) };
}

describe('RH spend reducer and receipt evidence', () => {
  it('returns a degraded verdict for otherwise verified evidence; sample-only activity cannot clear spend', async () => {
    const { service } = await fixture(); const result = await service.preflight(request);
    expect(result).toMatchObject({ decision: 'SIZE_SMALL', rule_version: 'rh-spend-v1', receipt_durable: false,
      holder_concentration: { state: 'COMPLETE', top_10_pct: 20 }, liquidity: { state: 'VERIFIED', lock_state: 'VERIFIED_LOCKED' } });
    const receipt = (await service.receipt(result.receipt_id))!;
    const { receipt_id, integrity_hash, ...content } = receipt;
    const digest = createHash('sha256').update(canonicalSpendJson(content)).digest('hex');
    expect(receipt_id).toBe(`rhsp_${digest}`); expect(integrity_hash).toBe(`sha256:${digest}`);
    expect(content.evidence_inventory).toHaveProperty('holders');
    receipt.result.decision = 'CLEAR';
    expect((await service.receipt(receipt_id))!.result.decision).toBe('SIZE_SMALL');
    expect((await service.preflight(request)).receipt_id).toBe(receipt_id);
  });
  it.each([
    ['stale quote', 'CANONICAL_QUOTE_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.assets[0].observed_at = '2026-01-01'; }],
    ['future verification', 'POOL_VERIFICATION_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.pairs[0].verification.verified_at = '2027-01-01'; }],
    ['unlocked position', 'LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.position_identities[0].lock_status = 'VERIFIED_NOT_LOCKED'; }],
    ['different proof block', 'LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.position_state_proofs[0].observed_block = 11; }],
    ['different pool proof', 'LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.position_state_proofs[0].pool_id = addr(99); }],
    ['mismatched core liquidity', 'LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.position_state_proofs[0].v4_core_liquidity_raw = '99'; }],
    ['missing proof block', 'LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.position_state_proofs[0].observed_block = null; }],
    ['out of range position', 'TRACKED_LOCKED_POSITION_NOT_IN_RANGE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.inventory_observations[0].range_state = 'ABOVE_RANGE'; }],
    ['zero active liquidity', 'ACTIVE_LIQUIDITY_UNAVAILABLE_OR_STALE', (f: Awaited<ReturnType<typeof fixture>>) => { f.snapshot.observations[0].active_liquidity = '0'; }],
    ['partial holder coverage', 'HOLDER_DISTRIBUTION_INCOMPLETE', (f: Awaited<ReturnType<typeof fixture>>) => { f.holders.items.pop(); }],
    ['fake stock ticker', 'CANONICAL_TICKER_CONTRACT_MISMATCH', (f: Awaited<ReturnType<typeof fixture>>) => { f.token.symbol = 'PLTR'; }],
    ['wrong exact contract', 'EXACT_TOKEN_UNAVAILABLE', (f: Awaited<ReturnType<typeof fixture>>) => { f.token.address = addr(88); }]
  ])('blocks %s', async (_name, code, mutate) => {
    const f = await fixture(); mutate(f); const result = await f.service.preflight(request);
    expect(result.decision).toBe('DO_NOT_SPEND'); expect(result.reasons).toContainEqual({ code, severity: 'BLOCK' });
  });
  it('requires a selected route and supports exact V4 pool IDs', async () => {
    const f = await fixture(); f.snapshot.pairs.push({ ...f.snapshot.pairs[0], pair_id: 'other', pool_id: `0x${'b'.repeat(64)}` });
    expect((await f.service.preflight(request)).reasons).toContainEqual({ code: 'EXPLICIT_POOL_REQUIRED', severity: 'BLOCK' });
    expect((await f.service.preflight({ ...request, pool })).decision).toBe('SIZE_SMALL');
    expect((await f.service.preflight({ subject: { kind: 'pool', address: pool }, action: request.action })).resolved_contract).toBe(subject);
    expect((await f.service.preflight({ ...request, pool: addr(99) })).decision).toBe('DO_NOT_SPEND');
  });
  it('blocks at the concentration and spend/liquidity boundaries', async () => {
    const f = await fixture();
    expect((await f.service.preflight({ ...request, action: { kind: 'swap', amount_usd: 10_000 } })).reasons).toContainEqual({ code: 'SPEND_EXCEEDS_LIQUIDITY_POLICY', severity: 'BLOCK' });
    f.holders.items = [{ address: { hash: addr(100) }, value: f.token.totalSupply }]; f.token.holdersCount = 1;
    expect((await f.service.preflight(request)).reasons).toContainEqual({ code: 'HIGH_HOLDER_CONCENTRATION', severity: 'BLOCK' });
  });
  it('makes source failure a blocked receipt and refuses to invent a receipt on write failure', async () => {
    const f = await fixture(); f.options.snapshot = async () => { throw new Error('database failed'); };
    const result = await f.service.preflight(request);
    expect(result).toMatchObject({ decision: 'DO_NOT_SPEND', source_failures: expect.arrayContaining(['reflexive_snapshot']) });
    expect(await f.service.receipt(result.receipt_id)).toBeTruthy();
    f.options.receipts.create = async () => { throw new Error('storage down'); };
    await expect(f.service.preflight(request)).rejects.toThrow('storage down');
  });
  it('resolves canonical identity without implying spend safety and catches ambiguous/stale registries', async () => {
    const f = await fixture();
    expect(await f.service.asset('pltr')).toMatchObject({ canonical: true, canonical_contract: quote, pairing_state: 'VERIFIED_CANONICAL' });
    expect(await f.service.asset('MISSING')).toMatchObject({ canonical: false, pairing_state: 'NOT_FOUND' });
    f.snapshot.assets[0].observed_at = '2026-01-01';
    expect(await f.service.asset('PLTR')).toMatchObject({ pairing_state: 'STALE_CANONICAL_IDENTITY' });
    f.snapshot.assets.push({ ...asset(), canonical_contract: addr(88) });
    expect(await f.service.asset('PLTR')).toMatchObject({ canonical: false, canonical_contract: null, pairing_state: 'AMBIGUOUS_CANONICAL_IDENTITY' });
  });
});

describe('honest concentration and transfer measurements', () => {
  it('uses exact big integers and rejects duplicate or impossible balances', async () => {
    const f = await fixture();
    expect(measureHolderConcentration(f.token, f.holders)).toMatchObject({ state: 'COMPLETE', top_1_pct: 2, top_10_pct: 20 });
    expect(measureHolderConcentration(f.token, { ...f.holders, nextPageParams: { cursor: 'next' } }).state).toBe('PARTIAL_LOWER_BOUND');
    f.holders.items.push(f.holders.items[0]);
    expect(measureHolderConcentration(f.token, f.holders).state).toBe('UNAVAILABLE');
    expect(measureHolderConcentration({ ...f.token, totalSupply: '1' }, { items: f.holders.items.slice(0, 1), nextPageParams: null }).state).toBe('UNAVAILABLE');
  });
  it('measures only exact-contract dated transfer events, deduplicates logs, and never calls them wash trades', () => {
    const transfer = (from: string, to: string, log: number) => ({ from: { hash: from }, to: { hash: to }, timestamp: at, transaction_hash: '0xabc', log_index: log, token: { address_hash: subject } });
    const a = transfer(addr(10), addr(11), 0); const b = transfer(addr(11), addr(10), 1);
    const result = measureTransferActivity(subject, { items: [a, a, b, { ...a, token: { address_hash: quote }, log_index: 2 }, { ...a, timestamp: '2026-01-01', log_index: 3 }], nextPageParams: { cursor: 'more' } }, now);
    expect(result).toMatchObject({ state: 'SAMPLE_ONLY', sample_size: 2, wallet_concentration: 0.5, counterparty_concentration: 1, round_trip_intensity: 1, burstiness: 1 });
    expect(measureTransferActivity(subject, null, now).state).toBe('UNAVAILABLE');
  });
  it('Postgres receipts use append-only conflict handling and retry schema initialization', async () => {
    const f = await fixture(); const result = await f.service.preflight(request); const receipt = await f.service.receipt(result.receipt_id);
    const query = vi.fn().mockRejectedValueOnce(new Error('temporarily unavailable')).mockImplementation(async (sql: string) => ({ rows: sql.startsWith('select') ? [{ payload: receipt }] : [] }));
    const store = new PostgresRhChainSpendReceiptStore({ query } as never);
    await expect(store.get(result.receipt_id)).rejects.toThrow('temporarily unavailable');
    await expect(store.create(receipt!)).resolves.toEqual(receipt);
    expect(query.mock.calls.some(([sql]) => sql.includes('on conflict(receipt_id) do nothing'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => /update |delete /i.test(sql))).toBe(false);
  });
});

describe('RH spend API integration', () => {
  const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
  it('validates requests, returns/retrieves receipts, and publishes discovery docs', async () => {
    const f = await fixture(); const app = await createApp(undefined, undefined, { rhChainSpendOptions: f.options, rhChainSpendReceiptStore: f.receipts }); apps.push(app);
    const post = (payload: object) => app.inject({ method: 'POST', url: '/v1/rh-chain/preflight', payload });
    for (const payload of [{ subject: { kind: 'contract', address: 'PLTR' } }, { subject: { kind: 'contract', address: subject, chain_id: 1 } }, { ...request, decision: 'CLEAR' }, { ...request, action: { kind: 'swap', amount_usd: -1 } }]) expect((await post(payload)).statusCode).toBe(400);
    const result = await post(request); expect(result.statusCode).toBe(200);
    const saved = await app.inject(result.json().data.receipt_url); expect(saved.statusCode).toBe(200); expect(saved.json().data.result.decision).toBe('SIZE_SMALL');
    expect((await app.inject('/v1/rh-chain/assets/pltr')).json().data.canonical_contract).toBe(quote);
    expect((await app.inject('/v1/rh-chain/preflight/receipts/invalid')).statusCode).toBe(400);
    expect((await app.inject(`/v1/rh-chain/preflight/receipts/rhsp_${'0'.repeat(64)}`)).statusCode).toBe(404);
    const spec = (await app.inject('/openapi.json')).json();
    expect(spec.paths['/v1/rh-chain/preflight'].post).toBeTruthy(); expect(spec.paths['/v1/radar/preflight'].post).toBeTruthy();
    f.receipts.create = async () => { throw new Error('private database error'); };
    const failure = await post(request); expect(failure.statusCode).toBe(503); expect(failure.body).not.toContain('private database error');
  });
});
