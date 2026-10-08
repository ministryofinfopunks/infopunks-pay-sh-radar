import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { ipxJcs, ipxSha256 } from '../src/services/ipxJcs';
import { IpxLaunchPolicySchema } from '../src/schemas/ipxLaunch';
import { IpxGenesisService, entitlement, verifyGenesisReceipt, type IpxGenesisReceipt, type IpxGenesisStore } from '../src/services/ipxGenesisService';
import { validateIpxIssuanceManifest, loadIpxIssuanceManifest } from '../src/services/ipxIssuanceManifest';
import { serializeRh4663Canonical } from '../src/services/rh4663Service';
import { contribution } from '../src/services/ipxRevenueLedger';
import { executablePltrMarketHours } from '../src/services/ipxMarketHours';
const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
const policy = () => IpxLaunchPolicySchema.parse({ version: 'ipx.launch.v2', chain_id: 4663, constitution_sha256: `0x${'2'.repeat(64)}`, total_supply_atomic: '10000', decimals: 18, allocations: { genesis_wallets: '1000', genesis_calls: '4663', treasury: '1000', liquidity: '1000', ecosystem: '1000', burned: '1337' }, allocation_recipients: { genesis_wallets: `0x${'6'.repeat(40)}`, genesis_calls: `0x${'4'.repeat(40)}`, treasury: `0x${'6'.repeat(40)}`, liquidity: `0x${'6'.repeat(40)}`, ecosystem: `0x${'6'.repeat(40)}`, burned: `0x${'0'.repeat(40)}` }, execution_authorities: { cohort_sealer: `0x${'8'.repeat(40)}`, accountant: `0x${'9'.repeat(40)}`, operations: `0x${'a'.repeat(40)}`, router: `0x${'b'.repeat(40)}`, usdg_pltr_fee: 3000, pltr_ipx_fee: 3000 }, token_contract: `0x${'3'.repeat(40)}`, genesis_distributor: `0x${'4'.repeat(40)}`, contribution_vault: `0x${'7'.repeat(40)}`, canonical_pltr: `0x${'5'.repeat(40)}`, opens_at: '2026-10-08T00:00:00Z', closes_at: '2026-10-10T00:00:00Z', contribution_burn_bps: 5000, minimum_confirmations: 2, call_limit: 4663, distinct_wallet_limit: 4663, one_economic_call_per_wallet: true, quote_is_backing: false });
const call = () => ({ wallet: account.address.toLowerCase(), rotation: 'STOCK_TOKENS', confidence: 90, evidence_digest: null });
class TestStore implements IpxGenesisStore {
  rows: IpxGenesisReceipt[] = [];
  async append(_policy: `0x${string}`, wallet: `0x${string}`, hash: `0x${string}`, create: (ordinal: number) => IpxGenesisReceipt) {
    const prior = this.rows.find(row => row.wallet === wallet);
    if (prior) { if (prior.payload_hash !== hash) throw new Error('economic_wallet_already_called'); return prior; }
    const row = create(this.rows.length + 1); this.rows.push(row); return row;
  }
  async list() { return this.rows; }
}
describe('IPX launch v2', () => {
  it('adds JCS without changing v1 bytes, validates Unicode and ES number formatting', () => {
    const input = { z: 1, a: { b: 1e30, a: -0 } };
    const legacyBytes = serializeRh4663Canonical(input);
    expect(legacyBytes).toBe('{"z":1,"a":{"b":1e+30,"a":0}}');
    expect(createHash('sha256').update(legacyBytes).digest('hex')).toBe('c3d31ccdb77f9057e2c6acf3de84241cd081f206f0f50464ac4eff687434a35c');
    expect(ipxJcs(input)).toBe('{"a":{"a":0,"b":1e+30},"z":1}');
    expect(ipxSha256({ b: 1, a: 2 })).toBe(ipxSha256({ a: 2, b: 1 }));
    expect(() => ipxJcs('\ud800')).toThrow('invalid_unicode');
    expect(() => ipxJcs({ value: NaN })).toThrow();
  });
  it('binds wallet signatures to policy and assigns one economically entitled call', async () => {
    const store = new TestStore(); const service = new IpxGenesisService(policy(), store, async () => {}, () => new Date('2026-10-08T12:00:00Z'));
    const built = service.payload(call()); const signature = await account.signMessage({ message: built.canonical_serialization });
    const receipt = await service.call(call(), signature); expect(receipt.call_ordinal).toBe(1); expect(receipt.entitlement_atomic).toBe('1');
    await expect(verifyGenesisReceipt(policy(), receipt)).resolves.toBeUndefined();
    await expect(verifyGenesisReceipt(policy(), { ...receipt, payload: { ...receipt.payload, token_contract: `0x${'f'.repeat(40)}` } })).rejects.toThrow('genesis_receipt_replay_invalid');
    await expect(verifyGenesisReceipt(policy(), { ...receipt, wallet_ordinal: 2 })).rejects.toThrow('genesis_receipt_replay_invalid');
    expect(await service.call(call(), signature)).toEqual(receipt);
    const changed = { ...call(), confidence: 80 }; const sig = await account.signMessage({ message: service.payload(changed).canonical_serialization });
    await expect(service.call(changed, sig)).rejects.toThrow('economic_wallet_already_called');
    await expect(service.call(changed, signature)).rejects.toThrow('genesis_signature_invalid');
  });
  it('requires a complete policy-bound issuance manifest before any v2 call', () => {
    const p = policy(); const reviewed = { artifact_uri: 'https://example.org/ipx/review-artifact', artifact_sha256: `0x${'a'.repeat(64)}`, reviewer: 'independent-reviewer', reviewed_at: '2026-10-08T12:00:00Z' };
    const manifest = { version: 'ipx.issuance-manifest.v1', policy_hash: ipxSha256(p), chain_id: 4663, finalized_block_number: '100', finalized_block_hash: `0x${'b'.repeat(64)}`, deployed_contracts: { token: p.token_contract, distributor: p.genesis_distributor, vault: p.contribution_vault, pltr: p.canonical_pltr }, constitution: { ...reviewed, artifact_sha256: p.constitution_sha256 }, source_and_build: reviewed, deployed_bytecode_and_constructor: reviewed, independent_contract_review: reviewed, genesis_wallet_claim_terms: reviewed, launch_policy_and_custody: reviewed, venue_routes_and_liquidity: reviewed, x402_v2_exact_4663_usdg: reviewed, rollback_and_operator_runbook: reviewed };
    expect(validateIpxIssuanceManifest(manifest, p).manifest_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(() => loadIpxIssuanceManifest(undefined, p)).toThrow('ipx_issuance_manifest_required');
    expect(() => validateIpxIssuanceManifest({ ...manifest, genesis_wallet_claim_terms: { ...reviewed, reviewer: 'TBD' } }, p)).toThrow();
    expect(() => validateIpxIssuanceManifest({ ...manifest, deployed_contracts: { ...manifest.deployed_contracts, token: p.contribution_vault } }, p)).toThrow('ipx_issuance_manifest_policy_mismatch');
    expect(() => validateIpxIssuanceManifest({ ...manifest, policy_hash: `0x${'c'.repeat(64)}` }, p)).toThrow('ipx_issuance_manifest_policy_mismatch');
  });
  it('does not admit a call when the cohort lock waits beyond campaign close', async () => {
    let now = new Date('2026-10-09T23:59:59Z'); const store = new TestStore();
    const append = store.append.bind(store);
    store.append = async (...args) => { now = new Date('2026-10-10T00:00:00Z'); return append(...args); };
    const service = new IpxGenesisService(policy(), store, async () => {}, () => now);
    const signature = await account.signMessage({ message: service.payload(call()).canonical_serialization });
    await expect(service.call(call(), signature)).rejects.toThrow('genesis_window_not_open');
    expect(store.rows).toHaveLength(0);
  });
  it('rejects campaign close and changed policy, preserves exactly allocated entitlement', () => {
    const service = new IpxGenesisService(policy(), new TestStore(), async () => {}, () => new Date('2026-10-10T00:00:00Z'));
    expect(() => service.payload(call())).toThrow('genesis_window_not_open');
    expect(() => IpxLaunchPolicySchema.parse({ ...policy(), total_supply_atomic: '9999' })).toThrow();
    expect(Array.from({ length: 4663 }, (_, i) => BigInt(entitlement('10000', i + 1))).reduce((a, b) => a + b, 0n)).toBe(10000n);
  });
  it('calculates net contribution precisely and never spends a loss', () => {
    const costs = { infra: '1000', data: '500', facilitator: '500', refunds: '0', evidence_refs: ['reviewed_invoice'] };
    expect(contribution('10000', costs, 5000).purchase_budget_atomic).toBe('4000');
    expect(contribution('1000', costs, 5000)).toMatchObject({ net_contribution_atomic: '-1000', purchase_budget_atomic: '0' });
  });
  it('integrates actual executable depth and exposes gaps instead of importing nominal inventory', () => {
    const config = { pool_id: 'pool', pltr_contract: `0x${'5'.repeat(40)}`, slippage_bps: 100, start: '2026-10-08T00:00:00Z', end: '2026-10-08T01:00:00Z', max_gap_ms: 3600000 };
    const sample = { chain_id: 4663 as const, pool_id: 'pool', pltr_contract: config.pltr_contract, observed_at: config.start, expires_at: config.end, observed_block: 1, block_hash: `0x${'6'.repeat(64)}`, buy_depth_pltr_atomic: '100', sell_depth_pltr_atomic: '80', slippage_bps: 100, source: 'VERIFIED_ONCHAIN_EXECUTION_QUOTES' as const, evidence_refs: ['rpc_quote'] };
    expect(executablePltrMarketHours([sample], config)).toMatchObject({ integral_atomic_milliseconds: '288000000', covered_ms: 3600000, state: 'COMPLETE' });
    expect(executablePltrMarketHours([sample], { ...config, max_gap_ms: 300000 })).toMatchObject({ covered_ms: 300000, missing_ms: 3300000, state: 'PARTIAL' });
    expect(() => executablePltrMarketHours([{ ...sample, pool_id: 'other' }], config)).toThrow('incomparable');
  });
});
