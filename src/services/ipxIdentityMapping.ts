import { createPublicKey, verify } from 'node:crypto';
type Hex = `0x${string}`;
import { z } from 'zod';
import { ipxJcs, ipxSha256 } from './ipxJcs';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function decodeBase58(value: string): Buffer {
  let number = 0n;
  for (const character of value) { const digit = alphabet.indexOf(character); if (digit < 0) throw new Error('invalid_solana_identity'); number = number * 58n + BigInt(digit); }
  const hex = number.toString(16); const bytes = number ? Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex') : Buffer.alloc(0);
  return Buffer.concat([Buffer.alloc(value.match(/^1*/)?.[0].length ?? 0), bytes]);
}
export const IdentityMappingPayloadSchema = z.object({ version: z.literal('ipx.solana.identity.v1'), chain_id: z.literal(4663), policy_hash: z.string().regex(/^0x[0-9a-f]{64}$/), evm_wallet: z.string().regex(/^0x[0-9a-f]{40}$/), solana_wallet: z.string().min(32).max(44), nonce: z.string().regex(/^0x[0-9a-f]{64}$/), issued_at: z.string().datetime(), expires_at: z.string().datetime() }).strict();
/** Both wallets attest the same domain-separated bytes; no circulating tokens move. */
export async function verifyIdentityMapping(raw: unknown, evmSignature: Hex, solanaSignature: string, policyHash: Hex, now = new Date()) {
  const { recoverMessageAddress } = await import('viem');
  const payload = IdentityMappingPayloadSchema.parse(raw);
  if (payload.policy_hash !== policyHash || Date.parse(payload.issued_at) > now.getTime() || Date.parse(payload.expires_at) <= now.getTime() || Date.parse(payload.expires_at) - Date.parse(payload.issued_at) > 10 * 60000) throw new Error('identity_mapping_scope_or_expiry');
  const message = ipxJcs(payload);
  if ((await recoverMessageAddress({ message, signature: evmSignature })).toLowerCase() !== payload.evm_wallet) throw new Error('identity_mapping_evm_signature_invalid');
  const key = decodeBase58(payload.solana_wallet); const signature = Buffer.from(solanaSignature, 'base64');
  if (key.length !== 32 || signature.length !== 64 || signature.toString('base64') !== solanaSignature) throw new Error('identity_mapping_solana_signature_invalid');
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]), format: 'der', type: 'spki' });
  if (!verify(null, Buffer.from(message), publicKey, signature)) throw new Error('identity_mapping_solana_signature_invalid');
  return { receipt_id: `ipx_identity_${ipxSha256(payload).slice(2)}`, payload, canonical_serialization: message, payload_hash: ipxSha256(payload), evm_signature: evmSignature, solana_signature: solanaSignature, verified: true, token_bridge: false, immutable: true };
}
