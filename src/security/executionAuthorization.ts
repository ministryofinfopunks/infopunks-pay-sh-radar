import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { ExecutionAuthorizationPayloadSchema, ExecutionAuthorizationSchema, type ExecutionAuthorization, type ExecutionAuthorizationPayload } from '../schemas/economicEngine';
import { JudgmentIssuerKeySchema, type JudgmentIssuerKey } from './judgmentIssuer';
import { canonicalSerialize, hashCanonical } from '../services/receiptIntegrityService';

export interface ExecutionAuthorizationIssuer {
  issue(payload: Omit<ExecutionAuthorizationPayload, 'issuer' | 'key_id'>): ExecutionAuthorization;
  verify(raw: unknown, now: Date): boolean;
  publicKeys(): { issuer: string; keys: JudgmentIssuerKey[]; domain: string };
}
const DOMAIN = 'infopunks.execution-authorization.v1';
const bytes = (payload: ExecutionAuthorizationPayload) => Buffer.from(canonicalSerialize({ domain: DOMAIN, algorithm: 'Ed25519', payload }));
/** A separate signature domain prevents using a signed assessment as an execution capability. */
export function createExecutionAuthorizationIssuer(config: { issuer: string; keys: JudgmentIssuerKey[]; activeKeyId?: string; privateKeyPem?: string }): ExecutionAuthorizationIssuer {
  try {
    if (!config.issuer || config.issuer.length > 256 || !config.keys.length) throw new Error();
    const keys = config.keys.map(k => JudgmentIssuerKeySchema.parse(k));
    if (new Set(keys.map(k => k.key_id)).size !== keys.length) throw new Error();
    const ring = new Map(keys.map(k => {
      if (!k.public_key_pem.trim().startsWith('-----BEGIN PUBLIC KEY-----') || (k.valid_until && Date.parse(k.valid_until) <= Date.parse(k.valid_from))) throw new Error();
      const publicKey = createPublicKey(k.public_key_pem);
      if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error();
      k.public_key_pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
      return [k.key_id, publicKey] as const;
    }));
    const privateKey = config.privateKeyPem ? createPrivateKey(config.privateKeyPem) : null;
    if (Boolean(config.activeKeyId) !== Boolean(privateKey) || (privateKey && (privateKey.asymmetricKeyType !== 'ed25519'
      || !ring.has(config.activeKeyId!) || !createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).equals(ring.get(config.activeKeyId!)!.export({ type: 'spki', format: 'der' }))))) throw new Error();
    const keyValid = (key: JudgmentIssuerKey, payload: ExecutionAuthorizationPayload) => !key.revoked
      && Date.parse(payload.issued_at) >= Date.parse(key.valid_from)
      && (key.valid_until === null || (Date.parse(payload.issued_at) < Date.parse(key.valid_until) && Date.parse(payload.valid_until) <= Date.parse(key.valid_until)));
    return {
      issue(input) {
        const payload = ExecutionAuthorizationPayloadSchema.parse({ ...input, issuer: config.issuer, key_id: config.activeKeyId });
        const key = keys.find(k => k.key_id === config.activeKeyId);
        if (!key || !privateKey || !keyValid(key, payload)) throw new Error('execution_signing_unavailable');
        return { payload, payload_hash: hashCanonical(payload), algorithm: 'Ed25519', signature: sign(null, bytes(payload), privateKey).toString('base64') };
      },
      verify(raw, now) {
        try {
          const auth = ExecutionAuthorizationSchema.parse(raw), payload = auth.payload;
          const key = keys.find(k => k.key_id === payload.key_id);
          if (payload.issuer !== config.issuer || !key || !keyValid(key, payload) || auth.payload_hash !== hashCanonical(payload)
            || now.getTime() < Date.parse(payload.issued_at) || now.getTime() >= Date.parse(payload.valid_until)) return false;
          const signature = Buffer.from(auth.signature, 'base64');
          return signature.toString('base64') === auth.signature && verify(null, bytes(payload), ring.get(key.key_id)!, signature);
        } catch { return false; }
      },
      publicKeys: () => ({ issuer: config.issuer, keys: structuredClone(keys), domain: DOMAIN })
    };
  } catch { throw new Error('invalid_execution_signing_configuration'); }
}

export function executionAuthorizationIssuerFromEnv(env: NodeJS.ProcessEnv): ExecutionAuthorizationIssuer | null {
  const names = ['EXECUTION_AUTHORIZATION_ISSUER', 'EXECUTION_AUTHORIZATION_KEYS_JSON', 'EXECUTION_AUTHORIZATION_KEY_ID', 'EXECUTION_AUTHORIZATION_PRIVATE_KEY'];
  if (!names.some(name => env[name])) return null;
  try { return createExecutionAuthorizationIssuer({ issuer: env.EXECUTION_AUTHORIZATION_ISSUER!, keys: JSON.parse(env.EXECUTION_AUTHORIZATION_KEYS_JSON ?? ''),
    activeKeyId: env.EXECUTION_AUTHORIZATION_KEY_ID, privateKeyPem: env.EXECUTION_AUTHORIZATION_PRIVATE_KEY }); }
  catch { throw new Error('invalid_execution_signing_configuration'); }
}
