import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { buildRh4663CallPayload, hashRh4663Canonical, RH_4663_GENESIS_POLICY, RH_4663_GENESIS_POLICY_HASH, serializeRh4663CallPayload } from '../src/services/rh4663Service';
import { IpxGenesisService, type IpxGenesisReceipt, type IpxGenesisStore } from '../src/services/ipxGenesisService';
import { IpxLaunchPolicySchema } from '../src/schemas/ipxLaunch';

const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
const now = new Date('2026-10-08T12:00:00Z');
const legacyInput = { wallet: account.address.toLowerCase(), rotation: 'STOCK_TOKENS' as const, confidence: 74, evidence_digest: null };
const v2Policy = () => IpxLaunchPolicySchema.parse({
  version: 'ipx.launch.v2', chain_id: 4663, constitution_sha256: `0x${'2'.repeat(64)}`, total_supply_atomic: '10000', decimals: 18,
  allocations: { genesis_wallets: '1000', genesis_calls: '4663', treasury: '1000', liquidity: '1000', ecosystem: '1000', burned: '1337' },
  allocation_recipients: { genesis_wallets: `0x${'6'.repeat(40)}`, genesis_calls: `0x${'4'.repeat(40)}`, treasury: `0x${'6'.repeat(40)}`, liquidity: `0x${'6'.repeat(40)}`, ecosystem: `0x${'6'.repeat(40)}`, burned: `0x${'0'.repeat(40)}` },
  execution_authorities: { cohort_sealer: `0x${'8'.repeat(40)}`, accountant: `0x${'9'.repeat(40)}`, operations: `0x${'a'.repeat(40)}`, router: `0x${'b'.repeat(40)}`, usdg_pltr_fee: 3000, pltr_ipx_fee: 3000 },
  token_contract: `0x${'3'.repeat(40)}`, genesis_distributor: `0x${'4'.repeat(40)}`, contribution_vault: `0x${'7'.repeat(40)}`, canonical_pltr: `0x${'5'.repeat(40)}`,
  opens_at: '2026-10-08T00:00:00Z', closes_at: '2026-10-10T00:00:00Z', contribution_burn_bps: 5000, minimum_confirmations: 2, call_limit: 4663, distinct_wallet_limit: 4663, one_economic_call_per_wallet: true, quote_is_backing: false
});

class Store implements IpxGenesisStore {
  rows: IpxGenesisReceipt[] = [];
  async append(_policyHash: `0x${string}`, wallet: `0x${string}`, hash: `0x${string}`, create: (ordinal: number) => IpxGenesisReceipt) {
    const prior = this.rows.find(item => item.wallet === wallet);
    if (prior) { if (prior.payload_hash !== hash) throw new Error('economic_wallet_already_called'); return prior; }
    const receipt = create(this.rows.length + 1); this.rows.push(receipt); return receipt;
  }
  async list() { return this.rows; }
}

describe('IPX protocol v1/v2 isolation', () => {
  it('keeps the pinned CALL v1 canonical bytes, hash and non-economic Genesis policy unchanged', () => {
    const built = buildRh4663CallPayload(legacyInput, now);
    expect(serializeRh4663CallPayload(built.payload)).toBe('{"version":"rh4663.call.v1","wallet":"0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a","window_id":"rh4663:2026-10-08","window_opens_at":"2026-10-08T00:00:00.000Z","window_closes_at":"2026-10-09T00:00:00.000Z","rotation":"STOCK_TOKENS","confidence":74,"evidence_digest":null}');
    expect(built.payload_hash).toBe('0x6e20b8af5d6289580d82e69bb8f544cc57767a18b50fa47a6d8b72826758348f');
    expect(RH_4663_GENESIS_POLICY).toMatchObject({ version: 'rh4663.genesis.v1', genesis_economic_entitlement: false });
    expect(RH_4663_GENESIS_POLICY_HASH).toBe(hashRh4663Canonical(JSON.stringify(RH_4663_GENESIS_POLICY)));
  });

  it('uses a distinct v2 domain and commits every required economic-call field', () => {
    const service = new IpxGenesisService(v2Policy(), new Store(), async () => undefined, () => now);
    const built = service.payload({ ...legacyInput, confidence: 90 });
    expect(built.payload).toMatchObject({
      version: 'ipx.genesis.call.v2', chain_id: 4663, token_contract: v2Policy().token_contract,
      genesis_distributor: v2Policy().genesis_distributor, policy_hash: service.policyHash,
      constitution_sha256: v2Policy().constitution_sha256, wallet: account.address.toLowerCase(),
      rotation: 'STOCK_TOKENS', confidence: 90, evidence_digest: null,
      window_opens_at: '2026-10-08T00:00:00.000Z', window_closes_at: '2026-10-09T00:00:00.000Z',
      campaign_opens_at: '2026-10-08T00:00:00Z', campaign_closes_at: '2026-10-10T00:00:00Z'
    });
    expect(built.canonical_serialization).not.toContain('rh4663.call.v1');
    expect(built.payload_hash).not.toBe(buildRh4663CallPayload(legacyInput, now).payload_hash);
  });
});
