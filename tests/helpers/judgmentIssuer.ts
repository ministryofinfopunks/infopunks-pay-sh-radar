import { generateKeyPairSync } from 'node:crypto';
import type { JudgmentIssuerKey } from '../../src/security/judgmentIssuer';

export function issuerFixture(keyId = 'key-1') {
  const pair = generateKeyPairSync('ed25519');
  const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const key: JudgmentIssuerKey = { key_id: keyId, public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    valid_from: '2026-01-01T00:00:00Z', valid_until: null, revoked: false };
  return { issuer: 'https://radar.infopunks.fun', keys: [key], activeKeyId: keyId, privateKeyPem };
}
