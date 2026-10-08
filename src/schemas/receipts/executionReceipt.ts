import { z } from 'zod';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptMoneySchema, ReceiptVersionSchema } from './common';
export const ExecutionReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  execution_id: id, judgment_id: id, executed_at: time,
  settlement_rail: id, settlement_ref: id, request_hash: hash, response_hash: hash,
  payload_signature: z.string().min(1).nullable(), latency_ms: z.number().finite().nonnegative(),
  status: id, cost_amount: ReceiptMoneySchema, cost_asset: id,
  artifact_refs: z.array(id), parent_hash: hash, receipt_hash: hash,
  execution_authorization: z.object({ version: z.literal('infopunks.execution-authorization.v1'), authorization_id: id, payload_hash: hash }).strict().optional(),
  verification: z.object({
    profile: z.enum(['base_usdc_external.v1', 'rh_usdg_external.v1']), submission_hash: hash,
    settlement: z.object({ verified: z.literal(true), provenance: z.enum(['base_rpc_finalized_usdc_transfer', 'rh_rpc_finalized_usdg_transfer']),
      network: z.enum(['eip155:8453', 'eip155:4663']), transaction_hash: z.string().regex(/^0x[a-f0-9]{64}$/),
      block_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), block_number: z.string().regex(/^[0-9]+$/),
      signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    }).strict(),
    payload_hashes: z.literal('externally_supplied_signed_claims'), status: z.literal('externally_supplied_signed_claim')
  }).strict().optional(),
  /** Set only at the trusted proof-adapter boundary; inspectable receipts remain nonqualifying. */
  score_eligibility: z.object({ state: z.enum(['qualifying', 'nonqualifying']),
    intake: z.enum(['external_proof_gateway.v1', 'internal_review.v1', 'legacy_import.v1', 'synthetic_fixture.v1']),
    proof_profile: z.enum(['base_usdc_external.v1', 'rh_usdg_external.v1']).nullable(),
    reason: id }).strict().optional()
}).strict();
export type ExecutionReceipt = z.infer<typeof ExecutionReceiptSchema>;
