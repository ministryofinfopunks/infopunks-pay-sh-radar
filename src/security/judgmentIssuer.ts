import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import type { JudgmentReceipt } from '../schemas/receipts';
import { canonicalSerialize, verifyReceiptIntegrity } from '../services/receiptIntegrityService';

export const JudgmentIssuerKeySchema = z.object({
  key_id: z.string().min(1).max(128), public_key_pem: z.string().min(1),
  valid_from: z.string().datetime({ offset: true }),
  valid_until: z.string().datetime({ offset: true }).nullable(), revoked: z.boolean()
}).strict();
const KeyringSchema = z.array(JudgmentIssuerKeySchema).min(1).max(64);
export type JudgmentIssuerKey = z.infer<typeof JudgmentIssuerKeySchema>;
export interface JudgmentIssuerTrust {
  requireSigned: boolean;
  verify(receipt: JudgmentReceipt): boolean;
}
export interface JudgmentIssuer extends JudgmentIssuerTrust {
  assertCanSign(at: string, validUntil?: string): void;
  sign(receipt: JudgmentReceipt): JudgmentReceipt;
  publicKeys(): { issuer: string; keys: JudgmentIssuerKey[] };
}
const DOMAIN = 'infopunks.judgment-issuer.v1';
function signingBytes(receipt: JudgmentReceipt, issuer: string, keyId: string) {
  return Buffer.from(canonicalSerialize({ domain: DOMAIN, algorithm: 'Ed25519', issuer, key_id: keyId, receipt_hash: receipt.receipt_hash }));
}
const within = (key: JudgmentIssuerKey, at: string) => !key.revoked && Date.parse(at) >= Date.parse(key.valid_from)
  && (key.valid_until === null || Date.parse(at) < Date.parse(key.valid_until));

/** Trust is supplied by operator configuration, never by the receipt itself. */
export function createJudgmentIssuer(input: {
  issuer: string; keys: JudgmentIssuerKey[]; activeKeyId?: string; privateKeyPem?: string; requireSigned?: boolean;
}): JudgmentIssuer {
  try {
    if (!input.issuer || input.issuer.length > 256) throw new Error();
    const keys = KeyringSchema.parse(input.keys);
    const publicKeys = new Map<string, KeyObject>();
    for (const key of keys) {
      if (publicKeys.has(key.key_id) || (key.valid_until && Date.parse(key.valid_until) <= Date.parse(key.valid_from))) throw new Error();
      if (!key.public_key_pem.trim().startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error();
      const publicKey = createPublicKey(key.public_key_pem);
      if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error();
      key.public_key_pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
      publicKeys.set(key.key_id, publicKey);
    }
    let privateKey: KeyObject | undefined;
    if (input.privateKeyPem || input.activeKeyId) {
      if (!input.privateKeyPem || !input.activeKeyId || !publicKeys.has(input.activeKeyId)) throw new Error();
      privateKey = createPrivateKey(input.privateKeyPem);
      if (privateKey.asymmetricKeyType !== 'ed25519' || !createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).equals(publicKeys.get(input.activeKeyId)!.export({ type: 'spki', format: 'der' }))) throw new Error();
    }
    const assertCanSign = (at: string, validUntil?: string) => {
      const key = keys.find(k => k.key_id === input.activeKeyId);
      if (!privateKey || !key || !within(key, at) || (validUntil && key.valid_until !== null && Date.parse(validUntil) > Date.parse(key.valid_until))) throw new Error('judgment_signing_unavailable');
    };
    const verifySignature = (receipt: JudgmentReceipt) => {
      try {
        if (!verifyReceiptIntegrity('judgment', receipt)) return false;
        const signature = receipt.issuer_signature;
        if (!signature || signature.issuer !== input.issuer || signature.algorithm !== 'Ed25519') return false;
        const key = keys.find(k => k.key_id === signature.key_id);
        if (!key || !within(key, receipt.issued_at) || (key.valid_until !== null && Date.parse(receipt.valid_until) > Date.parse(key.valid_until))) return false;
        const bytes = Buffer.from(signature.signature, 'base64');
        if (bytes.toString('base64') !== signature.signature) return false;
        return verify(null, signingBytes(receipt, signature.issuer, signature.key_id), publicKeys.get(key.key_id)!, bytes);
      } catch { return false; }
    };
    return {
      requireSigned: input.requireSigned ?? true,
      assertCanSign,
      sign(receipt) {
        assertCanSign(receipt.issued_at);
        const key = keys.find(k => k.key_id === input.activeKeyId)!;
        if (!verifyReceiptIntegrity('judgment', receipt) || (key.valid_until !== null && Date.parse(receipt.valid_until) > Date.parse(key.valid_until))) throw new Error('judgment_signing_window_invalid');
        const signed = { ...receipt, issuer_signature: { issuer: input.issuer, key_id: key.key_id, algorithm: 'Ed25519' as const,
          signature: sign(null, signingBytes(receipt, input.issuer, key.key_id), privateKey!).toString('base64') } };
        return signed;
      },
      verify: verifySignature,
      publicKeys: () => ({ issuer: input.issuer, keys: structuredClone(keys) })
    };
  } catch { throw new Error('invalid_judgment_signing_configuration'); }
}

/** Parse secrets only here; errors never contain keys or raw configuration. */
export function judgmentIssuerFromEnv(env: NodeJS.ProcessEnv, requireSigned: boolean): JudgmentIssuer | null {
  const names = ['JUDGMENT_ISSUER', 'JUDGMENT_ISSUER_KEYS_JSON', 'JUDGMENT_SIGNING_KEY_ID', 'JUDGMENT_SIGNING_PRIVATE_KEY'] as const;
  if (!names.some(name => env[name])) return null;
  try {
    return createJudgmentIssuer({ issuer: env.JUDGMENT_ISSUER!, keys: JSON.parse(env.JUDGMENT_ISSUER_KEYS_JSON ?? ''),
      activeKeyId: env.JUDGMENT_SIGNING_KEY_ID, privateKeyPem: env.JUDGMENT_SIGNING_PRIVATE_KEY, requireSigned });
  } catch { throw new Error('invalid_judgment_signing_configuration'); }
}
