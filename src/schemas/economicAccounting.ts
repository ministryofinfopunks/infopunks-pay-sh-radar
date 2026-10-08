import { z } from 'zod';
import { EconomicNetworkSchema, ECONOMIC_RAILS } from '../security/economicRails';
import { ReceiptHashSchema, ReceiptTimeSchema } from './receipts/common';
const AccountingCostBaseSchema = z.object({
  cost_id: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/), network: EconomicNetworkSchema,
  asset: z.enum(['USDC', 'USDG']), amount_atomic: z.string().regex(/^[1-9][0-9]*$/),
  category: z.enum(['infrastructure', 'reviewers', 'operations']),
  judgment_id: z.string().min(1).max(256).nullable(), incurred_at: ReceiptTimeSchema,
  evidence_refs: z.array(z.string().min(1).max(256)).min(1).max(32)
}).strict();
export const AccountingCostInputSchema = AccountingCostBaseSchema.refine(v => ECONOMIC_RAILS[v.network].asset === v.asset, 'accounting_asset_network_mismatch');
export const SettledRevenueSchema = z.object({
  version: z.literal('settled-revenue.v1'), revenue_id: z.string(), judgment_id: z.string(), judgment_hash: ReceiptHashSchema,
  network: EconomicNetworkSchema, asset: z.enum(['USDC', 'USDG']), token: z.string(),
  amount_atomic: z.string().regex(/^[1-9][0-9]*$/), transaction_hash: z.string(), payer: z.string(), pay_to: z.string(),
  block_hash: z.string(), block_number: z.string(), settled_at: ReceiptTimeSchema,
  verification: z.literal('rpc_finalized_transfer'), receipt_hash: ReceiptHashSchema
}).strict();
export const RecordedCostSchema = AccountingCostBaseSchema.extend({ version: z.literal('recorded-cost.v1'), recorded_by: z.literal('canonical-admin'), receipt_hash: ReceiptHashSchema }).refine(v => ECONOMIC_RAILS[v.network].asset === v.asset, 'accounting_asset_network_mismatch');
export type SettledRevenue = z.infer<typeof SettledRevenueSchema>;
export type RecordedCost = z.infer<typeof RecordedCostSchema>;
