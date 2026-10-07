import { canonicalSerialize } from '../services/receiptIntegrityService';
import type { ExecuteProofRequest } from '../schemas/executeProof';
import type { JudgmentReceipt } from '../schemas/receipts';

/** EIP-191 EOA signature over the complete proof, domain and canonical parent scope. */
export function executionProofSigningMessage(proof: ExecuteProofRequest, parent: JudgmentReceipt) {
  const { payload_signature: ignored, ...claims } = proof;
  return canonicalSerialize({ domain: 'infopunks.execute-proof.v1', parent_hash: parent.receipt_hash,
    subject_type: parent.subject_type, subject_id: parent.subject_id, proof: claims });
}
export async function verifyExecutionPayloadSignature(proof: ExecuteProofRequest, parent: JudgmentReceipt, signer: string) {
  if (!proof.payload_signature) return false;
  try {
    const { verifyMessage } = await import('viem');
    return await verifyMessage({ address: signer as `0x${string}`, message: executionProofSigningMessage(proof, parent), signature: proof.payload_signature as `0x${string}` });
  }
  catch { return false; }
}
