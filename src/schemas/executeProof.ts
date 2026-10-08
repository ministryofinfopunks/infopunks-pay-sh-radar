import { z } from 'zod';
import { ReceiptHashSchema, ReceiptTimeSchema } from './receipts/common';
export const ExecuteProofRequestSchema = z.object({
  judgment_id: z.string().min(1).max(256),
  settlement: z.object({
    rail: z.enum(['base-usdc', 'x402-base', 'pay.sh-base', 'rh-usdg', 'x402-rh']),
    transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    receipt_ref: z.string().min(1).max(256).optional()
  }).strict(),
  request_hash: ReceiptHashSchema, response_hash: ReceiptHashSchema,
  payload_signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/).optional(),
  latency_ms: z.number().finite().min(0).max(86400000),
  status: z.enum(['succeeded', 'failed', 'partial']),
  cost: z.object({ amount: z.string().regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,6})?$/), asset: z.enum(['USDC', 'USDG']) }).strict(),
  artifact_refs: z.array(z.string().min(1).max(256)).max(32).optional(),
  executed_at: ReceiptTimeSchema,
  idempotency_key: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/)
}).strict();
export type ExecuteProofRequest = z.infer<typeof ExecuteProofRequestSchema>;
export const BaseExecutionProfileSchema = z.object({
  profile: z.literal('base_usdc_external.v1'),
  request_hash: ReceiptHashSchema,
  pay_to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
}).strict();
export type BaseExecutionProfile = z.infer<typeof BaseExecutionProfileSchema>;

export const RhExecutionProfileSchema = z.object({ ...BaseExecutionProfileSchema.shape, profile: z.literal('rh_usdg_external.v1') }).strict();
export const EvmExecutionProfileSchema = z.discriminatedUnion('profile', [BaseExecutionProfileSchema, RhExecutionProfileSchema]);
export type EvmExecutionProfile = z.infer<typeof EvmExecutionProfileSchema>;
