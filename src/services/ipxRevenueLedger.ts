import { ECONOMIC_RAILS } from '../security/economicRails';
import type pg from 'pg';
import { z } from 'zod';
import { atomicAmount } from '../schemas/ipxLaunch';
import { ipxJcs, ipxSha256 } from './ipxJcs';
import { SettledRevenueSchema, type SettledRevenue } from '../schemas/economicAccounting';
import type { BaseProofRpc } from '../security/settlementProofVerifier';
export const IpxCostsSchema = z.object({ infra: atomicAmount, data: atomicAmount, facilitator: atomicAmount, refunds: atomicAmount, evidence_refs: z.array(z.string().min(1).max(500)).min(1).max(50) }).strict();
export function contribution(gross: string, costs: z.infer<typeof IpxCostsSchema>, bps: number) {
  atomicAmount.parse(gross); IpxCostsSchema.parse(costs);
  if (!Number.isInteger(bps) || bps < 1 || bps > 10000) throw new Error('invalid_burn_policy');
  const totalCosts = BigInt(costs.infra) + BigInt(costs.data) + BigInt(costs.facilitator) + BigInt(costs.refunds);
  const net = BigInt(gross) - totalCosts;
  return { gross_atomic: gross, costs_atomic: String(totalCosts), net_contribution_atomic: String(net), purchase_budget_atomic: String(net > 0n ? net * BigInt(bps) / 10000n : 0n), burn_bps: bps };
}
type EconomicReceipt = { receipt_id: string; kind: string; parent_id: string | null; dedupe_key: string; receipt_hash: string; payload: Record<string, unknown> };
/** Append-only source evidence, not a claim that purchases or burns have run. */
export class IpxRevenueLedger {
  constructor(private readonly pool: pg.Pool, private readonly rpc: BaseProofRpc, private readonly reconcile: (judgmentId: string) => Promise<SettledRevenue>, private readonly bps: number, private readonly market: { ipx: `0x${string}`; vault: `0x${string}` }, private readonly minimumConfirmations = 2) {
    if (!Number.isSafeInteger(minimumConfirmations) || minimumConfirmations < 2) throw new Error('invalid_confirmation_policy');
  }
  private async append(kind: string, dedupe: string, payload: Record<string, unknown>, parent: string | null = null): Promise<EconomicReceipt> {
    const hash = ipxSha256({ kind, dedupe, parent, payload }); const receipt = { receipt_id: `ipx_${kind.toLowerCase()}_${hash.slice(2)}`, kind, parent_id: parent, dedupe_key: dedupe, receipt_hash: hash, payload };
    await this.pool.query('insert into ipx_economic_receipts(receipt_id,kind,dedupe_key,parent_id,receipt_hash,receipt) values($1,$2,$3,$4,$5,$6) on conflict(dedupe_key) do nothing', [receipt.receipt_id, kind, dedupe, parent, hash, receipt]);
    const prior = (await this.pool.query('select receipt from ipx_economic_receipts where dedupe_key=$1', [dedupe])).rows[0]?.receipt;
    if (!prior || ipxJcs(prior) !== ipxJcs(receipt)) throw new Error('economic_receipt_conflict');
    return prior;
  }
  async revenue(judgmentId: string) {
    const proof = SettledRevenueSchema.parse(await this.reconcile(judgmentId));
    if (proof.asset !== 'USDG' || proof.network !== 'eip155:4663' || proof.judgment_id !== judgmentId || proof.token.toLowerCase() !== ECONOMIC_RAILS['eip155:4663'].token.toLowerCase() || !/^0x[0-9a-fA-F]{64}$/.test(proof.transaction_hash)) throw new Error('verified_usdg_judgment_required');
    atomicAmount.parse(proof.amount_atomic);
    const source = `4663:${proof.transaction_hash.toLowerCase()}`;
    const service = await this.append('SERVICE', `service:${source}`, { judgment_id: judgmentId, judgment_hash: proof.judgment_hash, network: proof.network, asset: proof.asset, source_transaction: proof.transaction_hash, settled_revenue_hash: proof.receipt_hash });
    return this.append('REVENUE', `revenue:${source}`, { asset: 'USDG', network: 'eip155:4663', gross_atomic: proof.amount_atomic, decimals: 6, source_transaction: proof.transaction_hash, settlement_block_hash: proof.block_hash, settled_at: proof.settled_at, parent_hash: service.receipt_hash, settled_revenue_hash: proof.receipt_hash }, service.receipt_id);
  }

  async account(revenueId: string, rawCosts: unknown) {
    const revenue = (await this.pool.query("select receipt from ipx_economic_receipts where receipt_id=$1 and kind='REVENUE'", [revenueId])).rows[0]?.receipt as EconomicReceipt | undefined;
    if (!revenue) throw new Error('revenue_receipt_required');
    const costs = IpxCostsSchema.parse(rawCosts);
    return this.append('CONTRIBUTION', `contribution:${revenueId}`, { ...contribution(String(revenue.payload.gross_atomic), costs, this.bps), costs, asset: 'USDG', network: 'eip155:4663', source_transaction: revenue.payload.source_transaction, parent_hash: revenue.receipt_hash, accounting_authority: 'reviewed_cost_evidence', execution_state: 'NOT_EXECUTED' }, revenueId);
  }
  async list() { return (await this.pool.query('select receipt from ipx_economic_receipts order by receipt_id limit 500')).rows.map(row => row.receipt as EconomicReceipt); }
  async summary() {
    const rows = await this.pool.query("select kind,count(*)::int as count,coalesce(sum(case when kind='REVENUE' then (receipt->'payload'->>'gross_atomic')::numeric when kind='BURN' then (receipt->'payload'->>'ipx_burned_atomic')::numeric when kind='CONTRIBUTION' then (receipt->'payload'->>'purchase_budget_atomic')::numeric else 0 end),0)::text as amount from ipx_economic_receipts group by kind");
    const entry = (kind: string) => rows.rows.find(row => row.kind === kind) ?? { count: 0, amount: '0' };
    return { verified_revenue_usdg_atomic: entry('REVENUE').amount, revenue_count: entry('REVENUE').count, verified_burn_ipx_atomic: entry('BURN').amount, burn_count: entry('BURN').count, contribution_purchase_budget_usdg_atomic: entry('CONTRIBUTION').amount, coverage: 'ALL_DURABLE_RECEIPTS', executable_pltr_market_hours: null, economic_flywheel_operational: false };
  }
  async burn(contributionId: string, transaction: `0x${string}`) {
    const contribution = (await this.pool.query("select receipt from ipx_economic_receipts where receipt_id=$1 and kind='CONTRIBUTION'", [contributionId])).rows[0]?.receipt as EconomicReceipt | undefined;
    if (!contribution?.parent_id) throw new Error('contribution_receipt_required');
    const revenue = (await this.pool.query("select receipt from ipx_economic_receipts where receipt_id=$1 and kind='REVENUE'", [contribution.parent_id])).rows[0]?.receipt as EconomicReceipt | undefined;
    if (!revenue || BigInt(String(contribution.payload.purchase_budget_atomic)) <= 0n || await this.rpc.getChainId() !== 4663) throw new Error('burn_source_or_network_invalid');
    const receipt = await this.rpc.getTransactionReceipt({ hash: transaction });
    if (receipt.status !== 'success' || receipt.transactionHash.toLowerCase() !== transaction.toLowerCase()) throw new Error('burn_transaction_invalid');
    const [block, finalized] = await Promise.all([this.rpc.getBlock({ blockNumber: receipt.blockNumber }), this.rpc.getBlock({ blockTag: 'finalized' })]);
    if (block.hash?.toLowerCase() !== receipt.blockHash.toLowerCase() || finalized.number === null || receipt.blockNumber > finalized.number || finalized.number - receipt.blockNumber + 1n < BigInt(this.minimumConfirmations)) throw new Error('burn_not_finalized');
    if (receipt.logs.some(log => log.removed || log.blockHash?.toLowerCase() !== receipt.blockHash.toLowerCase() || log.transactionHash?.toLowerCase() !== receipt.transactionHash.toLowerCase() || log.blockNumber !== receipt.blockNumber || log.logIndex === null) || new Set(receipt.logs.map(log => log.logIndex)).size !== receipt.logs.length) throw new Error('burn_logs_ambiguous');
    const { parseAbi, parseEventLogs } = await import('viem');
    const events = parseEventLogs({ abi: parseAbi(['event IPXPurchasedAndBurned(bytes32 indexed revenueReceiptHash, uint256 usdgSpent, uint256 ipxBurned)']), logs: receipt.logs.filter(log => !log.removed && log.address.toLowerCase() === this.market.vault.toLowerCase()) });
    const event = events.find(event => event.args.revenueReceiptHash.toLowerCase() === revenue.receipt_hash.toLowerCase());
    if (!event || event.args.usdgSpent !== BigInt(String(contribution.payload.purchase_budget_atomic)) || event.args.ipxBurned <= 0n || events.filter(item => item.args.revenueReceiptHash === event.args.revenueReceiptHash).length !== 1) throw new Error('burn_receipt_binding_invalid');
    const transfers = parseEventLogs({ abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']), logs: receipt.logs.filter(log => !log.removed && log.address.toLowerCase() === this.market.ipx.toLowerCase()) });
    const burned = transfers.filter(log => log.args.from.toLowerCase() === this.market.vault.toLowerCase() && /^0x0+$/.test(log.args.to)).reduce((sum, log) => sum + log.args.value, 0n);
    if (burned !== event.args.ipxBurned) throw new Error('ipx_supply_burn_not_proven');
    const purchase = await this.append('PURCHASE', `purchase:${revenue.receipt_id}`, { parent_hash: contribution.receipt_hash, source_transaction: revenue.payload.source_transaction, purchase_transaction: transaction.toLowerCase(), usdg_spent_atomic: event.args.usdgSpent.toString(), ipx_received_atomic: event.args.ipxBurned.toString(), vault: this.market.vault, observed_block: receipt.blockNumber.toString(), block_hash: receipt.blockHash, verification: 'FINALIZED_VAULT_EVENT', venue_execution_authority: 'CONFIGURED_IMMUTABLE_VAULT_ROUTER' }, contribution.receipt_id);
    return this.append('BURN', `burn:${revenue.receipt_id}`, { parent_hash: purchase.receipt_hash, source_transaction: revenue.payload.source_transaction, burn_transaction: transaction.toLowerCase(), ipx_burned_atomic: burned.toString(), token_contract: this.market.ipx, block_hash: receipt.blockHash, verification: 'FINALIZED_IPX_TRANSFER_TO_ZERO' }, purchase.receipt_id);
  }
}
