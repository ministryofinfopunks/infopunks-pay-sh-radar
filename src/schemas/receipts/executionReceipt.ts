import { z } from 'zod';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptMoneySchema, ReceiptVersionSchema } from './common';
export const ExecutionReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  execution_id: id, judgment_id: id, executed_at: time,
  settlement_rail: id, settlement_ref: id, request_hash: hash, response_hash: hash,
  payload_signature: z.string().min(1).nullable(), latency_ms: z.number().finite().nonnegative(),
  status: id, cost_amount: ReceiptMoneySchema, cost_asset: id,
  artifact_refs: z.array(id), parent_hash: hash, receipt_hash: hash,
  verification: z.object({
    profile: z.literal('base_usdc_external.v1'), submission_hash: hash,
    settlement: z.object({ verified: z.literal(true), provenance: z.literal('base_rpc_finalized_usdc_transfer'),
      network: z.literal('eip155:8453'), transaction_hash: z.string().regex(/^0x[a-f0-9]{64}$/),
      block_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), block_number: z.string().regex(/^[0-9]+$/),
      signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    }).strict(),
    payload_hashes: z.literal('externally_supplied_signed_claims'), status: z.literal('externally_supplied_signed_claim')
  }).strict().optional()
}).strict();
export type ExecutionReceipt = z.infer<typeof ExecutionReceiptSchema>;
