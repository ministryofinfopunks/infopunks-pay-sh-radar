import type pg from 'pg';
import { createRequire } from 'node:module';
import { join } from 'node:path';
type Hex = `0x${string}`;
const { recoverMessageAddress, encodePacked, sha256 } = createRequire(join(process.cwd(), 'package.json'))('viem') as typeof import('viem', { with: { 'resolution-mode': 'import' } });
import { IpxCallRequestSchema, type IpxLaunchPolicy } from '../schemas/ipxLaunch';
import { getRh4663PulseWindow } from './rh4663Service';
import { ipxJcs, ipxSha256 } from './ipxJcs';
export type IpxGenesisReceipt = { receipt_id: string; version: 'ipx.genesis.call.v2'; payload: Record<string, unknown>; canonical_serialization: string; payload_hash: Hex; signature: Hex; signature_verified: true; call_ordinal: number; wallet_ordinal: number; wallet: Hex; entitlement_atomic: string; accepted_at: string; immutable: true; policy_hash: Hex };
export interface IpxGenesisStore {
  append(policyHash: Hex, wallet: Hex, hash: Hex, create: (ordinal: number) => IpxGenesisReceipt): Promise<IpxGenesisReceipt>;
  list(policyHash: Hex): Promise<IpxGenesisReceipt[]>;
}
export class PostgresIpxGenesisStore implements IpxGenesisStore {
  constructor(private readonly pool: pg.Pool) {}
  async append(policyHash: Hex, wallet: Hex, hash: Hex, create: (ordinal: number) => IpxGenesisReceipt) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('ipx-genesis-v2:' || $1))", [policyHash]);
      const existing = await client.query('select receipt from ipx_genesis_calls_v2 where policy_hash=$1 and wallet=$2', [policyHash, wallet]);
      if (existing.rows[0]) {
        if (existing.rows[0].receipt.payload_hash !== hash) throw new Error('economic_wallet_already_called');
        await client.query('commit'); return existing.rows[0].receipt as IpxGenesisReceipt;
      }
      const count = await client.query('select count(*)::int as count from ipx_genesis_calls_v2 where policy_hash=$1', [policyHash]);
      const ordinal = Number(count.rows[0].count) + 1;
      if (ordinal > 4663) throw new Error('genesis_cohort_full');
      const receipt = create(ordinal);
      await client.query('insert into ipx_genesis_calls_v2(policy_hash,wallet,ordinal,payload_hash,receipt) values($1,$2,$3,$4,$5)', [policyHash, wallet, ordinal, hash, receipt]);
      await client.query('commit'); return receipt;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async list(policyHash: Hex) { return (await this.pool.query('select receipt from ipx_genesis_calls_v2 where policy_hash=$1 order by ordinal', [policyHash])).rows.map(row => row.receipt as IpxGenesisReceipt); }
}
/** Entirely separate v2 namespace; never reserializes or mutates a v1 CALL. */
export class IpxGenesisService {
  readonly policyHash: Hex;
  constructor(readonly policy: IpxLaunchPolicy, private readonly store: IpxGenesisStore, private readonly verifyDeployment: () => Promise<void>, private readonly now = () => new Date()) { this.policyHash = ipxSha256(policy); }
  payload(raw: unknown) {
    const input = IpxCallRequestSchema.parse(raw); const at = this.now(); const window = getRh4663PulseWindow(at);
    if (at.getTime() < Date.parse(this.policy.opens_at) || at.getTime() >= Date.parse(this.policy.closes_at) || (input.window_id && input.window_id !== window.window_id)) throw new Error('genesis_window_not_open');
    const payload = { version: 'ipx.genesis.call.v2', chain_id: 4663, token_contract: this.policy.token_contract, genesis_distributor: this.policy.genesis_distributor, policy_hash: this.policyHash, constitution_sha256: this.policy.constitution_sha256, wallet: input.wallet, rotation: input.rotation, confidence: input.confidence, evidence_digest: input.evidence_digest, window_id: window.window_id, window_opens_at: window.opens_at, window_closes_at: window.closes_at, campaign_opens_at: this.policy.opens_at, campaign_closes_at: this.policy.closes_at };
    return { payload, canonical_serialization: ipxJcs(payload), payload_hash: ipxSha256(payload) };
  }
  async call(raw: unknown, signature: Hex) {
    const built = this.payload(raw);
    if ((await recoverMessageAddress({ message: built.canonical_serialization, signature })).toLowerCase() !== built.payload.wallet) throw new Error('genesis_signature_invalid');
    await this.verifyDeployment();
    // Recheck after RPC verification so slow verification cannot admit a closed day.
    if (this.payload(raw).payload_hash !== built.payload_hash) throw new Error('genesis_window_changed');
    return this.store.append(this.policyHash, built.payload.wallet, built.payload_hash, ordinal => {
      // The cohort lock may wait across a window boundary; admission time is assigned after it.
      if (this.payload(raw).payload_hash !== built.payload_hash) throw new Error('genesis_window_changed');
      const acceptedAt = this.now().toISOString();
      return ({ receipt_id: `ipx_call_v2_${built.payload_hash.slice(2)}`, version: 'ipx.genesis.call.v2', ...built, signature, signature_verified: true, call_ordinal: ordinal, wallet_ordinal: ordinal, wallet: built.payload.wallet, entitlement_atomic: entitlement(this.policy.allocations.genesis_calls, ordinal), accepted_at: acceptedAt, immutable: true, policy_hash: this.policyHash });
    });
  }
  async cohort() { return this.store.list(this.policyHash); }
}
export function entitlement(allocation: string, ordinal: number) {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4663 || BigInt(allocation) < 4663n) throw new Error('invalid_entitlement');
  const amount = BigInt(allocation); return String(amount / 4663n + (ordinal === 4663 ? amount % 4663n : 0n));
}
export function entitlementLeaf(policy: IpxLaunchPolicy, receipt: IpxGenesisReceipt): Hex {
  return sha256(encodePacked(['string', 'uint256', 'address', 'uint256', 'address', 'uint256', 'bytes32'], ['ipx.genesis.entitlement.v2', 4663n, policy.genesis_distributor, BigInt(receipt.call_ordinal), receipt.wallet, BigInt(receipt.entitlement_atomic), receipt.payload_hash]));
}
/** Sorted SHA-256 pairs match the distributor; deterministic ordinal leaf order, duplicate last for odd levels. */
export function buildEntitlementTree(policy: IpxLaunchPolicy, receipts: IpxGenesisReceipt[]) {
  if (receipts.length !== 4663 || receipts.some((receipt, index) => receipt.call_ordinal !== index + 1 || receipt.policy_hash !== ipxSha256(policy) || receipt.entitlement_atomic !== entitlement(policy.allocations.genesis_calls, index + 1)) || new Set(receipts.map(receipt => receipt.wallet)).size !== 4663) throw new Error('complete_verified_cohort_required');
  const levels: Hex[][] = [receipts.map(receipt => entitlementLeaf(policy, receipt))];
  while (levels.at(-1)!.length > 1) { const prior = levels.at(-1)!; const next: Hex[] = []; for (let i = 0; i < prior.length; i += 2) { const pair = [prior[i], prior[i + 1] ?? prior[i]].sort(); next.push(sha256(`0x${pair[0].slice(2)}${pair[1].slice(2)}`)); } levels.push(next); }
  return { root: levels.at(-1)![0], proof(ordinal: number) { if (ordinal < 1 || ordinal > 4663) throw new Error('invalid_ordinal'); let index = ordinal - 1; const proof: Hex[] = []; for (const level of levels.slice(0, -1)) { proof.push(level[index ^ 1] ?? level[index]); index = Math.floor(index / 2); } return proof; } };
}
