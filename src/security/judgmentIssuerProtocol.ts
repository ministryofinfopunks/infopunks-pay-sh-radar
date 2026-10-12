/** Browser-safe signing message. Property order matches canonical JSON; historical bytes are unchanged. */
export function judgmentSignatureMessage(receipt: { schema_version: string; receipt_hash: string }, issuer: string, keyId: string) {
  return JSON.stringify({ algorithm: 'Ed25519', domain: receipt.schema_version === 'canonical-receipts.v2' ? 'infopunks.judgment-issuer.v2' : 'infopunks.judgment-issuer.v1',
    issuer, key_id: keyId, receipt_hash: receipt.receipt_hash });
}
