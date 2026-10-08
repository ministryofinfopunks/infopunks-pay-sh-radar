import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { IpxRevenueLedger } from '../src/services/ipxRevenueLedger';
import type { SettledRevenue } from '../src/schemas/economicAccounting';
import type { BaseProofRpc } from '../src/security/settlementProofVerifier';
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
type Hex = `0x${string}`;
const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const ipx: Hex = `0x${'1'.repeat(40)}`, vault: Hex = `0x${'2'.repeat(40)}`;
describe.skipIf(!url)('IPX finalized revenue and burn provenance', () => {
  const schema = 'ipx_ledger_' + randomUUID().replaceAll('-', '');
  let bootstrap: pg.Pool; let pool: pg.Pool;
  beforeAll(async () => {
    bootstrap = new pg.Pool({ connectionString: url }); await bootstrap.query(`create schema ${schema}`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await pool.query(readFileSync('migrations/20261008_017_ipx_launch.up.sql', 'utf8'));
  });
  afterAll(async () => { await pool?.end(); await bootstrap?.query(`drop schema if exists ${schema} cascade`); await bootstrap?.end(); });
  const source = (n: number): SettledRevenue => ({ version: 'settled-revenue.v1', revenue_id: `revenue_${n}`, judgment_id: `judgment_${n}`, judgment_hash: `sha256:${'a'.repeat(64)}`, network: 'eip155:4663', asset: 'USDG', token: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', amount_atomic: '100000', transaction_hash: hash(n), payer: ipx, pay_to: vault, block_hash: hash(90), block_number: '90', settled_at: '2026-10-08T00:00:00Z', verification: 'rpc_finalized_transfer', receipt_hash: `sha256:${'b'.repeat(64)}` });
  const costs = { infra: '10000', data: '5000', facilitator: '5000', refunds: '0', evidence_refs: ['cost-review:1'] };
  function fixture(n: number) {
    let finalized = 101n; let canonical = hash(100); let chain = 4663;
    const receipt: Awaited<ReturnType<BaseProofRpc['getTransactionReceipt']>> = { status: 'success', transactionHash: hash(n + 1000), blockHash: hash(100), blockNumber: 100n, logs: [] };
    const rpc: BaseProofRpc = { getChainId: async () => chain, getTransactionReceipt: async () => receipt, getBlock: async input => ({ hash: 'blockNumber' in input ? canonical : hash(101), number: 'blockNumber' in input ? input.blockNumber : finalized, timestamp: 1791417600n }) };
    const ledger = new IpxRevenueLedger(pool, rpc, async () => source(n), 5000, { ipx, vault });
    const setLogs = (revenueHash: Hex, spent = 40000n, burned = 500n, transferred = burned) => {
      const meta = { removed: false, blockHash: receipt.blockHash, blockNumber: receipt.blockNumber, transactionHash: receipt.transactionHash, transactionIndex: 0 };
      receipt.logs = [
        { ...meta, address: vault, logIndex: 0, topics: encodeEventTopics({ abi: parseAbi(['event IPXPurchasedAndBurned(bytes32 indexed revenueReceiptHash,uint256 usdgSpent,uint256 ipxBurned)']), eventName: 'IPXPurchasedAndBurned', args: { revenueReceiptHash: revenueHash } }) as [Hex, ...Hex[]], data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [spent, burned]) },
        { ...meta, address: ipx, logIndex: 1, topics: encodeEventTopics({ abi: parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']), eventName: 'Transfer', args: { from: vault, to: `0x${'0'.repeat(40)}` } }) as [Hex, ...Hex[]], data: encodeAbiParameters([{ type: 'uint256' }], [transferred]) }
      ];
    };
    return { ledger, receipt, setLogs, setFinalized: (value: bigint) => { finalized = value; }, setCanonical: (value: Hex) => { canonical = value; }, setChain: (value: number) => { chain = value; } };
  }
  it('preserves source ancestry across restart and rejects revised accounting', async () => {
    const f = fixture(1); const revenue = await f.ledger.revenue('judgment_1');
    expect(await f.ledger.revenue('judgment_1')).toEqual(revenue);
    const contribution = await f.ledger.account(revenue.receipt_id, costs);
    expect(contribution.payload.purchase_budget_atomic).toBe('40000');
    await expect(f.ledger.account(revenue.receipt_id, { ...costs, infra: '1' })).rejects.toThrow('economic_receipt_conflict');
    f.setLogs(revenue.receipt_hash as Hex);
    const burn = await f.ledger.burn(contribution.receipt_id, f.receipt.transactionHash);
    expect(burn.payload).toMatchObject({ source_transaction: hash(1), ipx_burned_atomic: '500', verification: 'FINALIZED_IPX_TRANSFER_TO_ZERO' });
    expect(await f.ledger.burn(contribution.receipt_id, f.receipt.transactionHash)).toEqual(burn);
    expect((await f.ledger.list()).filter(r => r.payload.source_transaction === hash(1)).map(r => r.kind).sort()).toEqual(['BURN','CONTRIBUTION','PURCHASE','REVENUE','SERVICE']);
    expect(await f.ledger.summary()).toMatchObject({ verified_revenue_usdg_atomic: '100000', verified_burn_ipx_atomic: '500', economic_flywheel_operational: false });
    await expect(pool.query("update ipx_economic_receipts set receipt=receipt where kind='BURN'")).rejects.toThrow('append-only');
  });
  it('rejects orphaned blocks, pending finality, forged events and mismatched supply burns before appending', async () => {
    const f = fixture(2); const revenue = await f.ledger.revenue('judgment_2'); const c = await f.ledger.account(revenue.receipt_id, costs);
    f.setLogs(revenue.receipt_hash as Hex);
    f.setChain(1); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_source_or_network_invalid'); f.setChain(4663);
    f.setFinalized(99n); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_not_finalized'); f.setFinalized(101n);
    f.setFinalized(100n); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_not_finalized'); f.setFinalized(101n);
    f.setCanonical(hash(999)); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_not_finalized'); f.setCanonical(hash(100));
    f.receipt.logs[0].removed = true; await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_logs_ambiguous');
    f.setLogs(hash(999)); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_receipt_binding_invalid');
    f.setLogs(revenue.receipt_hash as Hex, 39999n); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('burn_receipt_binding_invalid');
    f.setLogs(revenue.receipt_hash as Hex, 40000n, 500n, 499n); await expect(f.ledger.burn(c.receipt_id, f.receipt.transactionHash)).rejects.toThrow('ipx_supply_burn_not_proven');
    expect((await pool.query("select count(*)::int as count from ipx_economic_receipts where kind='BURN' and receipt->'payload'->>'source_transaction'=$1", [hash(2)])).rows[0].count).toBe(0);
  });
  it('rejects legacy USDC revenue from the new economic rail', async () => {
    const ledger = new IpxRevenueLedger(pool, { getChainId: async () => 4663 } as BaseProofRpc, async () => ({ ...source(3), network: 'eip155:8453', asset: 'USDC' }), 5000, { ipx, vault });
    await expect(ledger.revenue('judgment_3')).rejects.toThrow('verified_usdg_judgment_required');
  });
});
