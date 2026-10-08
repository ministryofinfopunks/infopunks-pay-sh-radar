import { expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { ipxJcs } from '../src/services/ipxJcs';
import { verifyIdentityMapping } from '../src/services/ipxIdentityMapping';
function base58(bytes: Buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = BigInt('0x' + bytes.toString('hex')); let text = '';
  while (number) { text = alphabet[Number(number % 58n)] + text; number /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; text = '1' + text; }
  return text;
}
it('requires both wallet signatures on the identical scoped bytes and rejects stale or substituted identities', async () => {
  const evm = privateKeyToAccount(`0x${'1'.repeat(64)}`); const solana = generateKeyPairSync('ed25519');
  const key = solana.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const policy = `0x${'2'.repeat(64)}` as const;
  const payload = { version: 'ipx.solana.identity.v1', chain_id: 4663, policy_hash: policy, evm_wallet: evm.address.toLowerCase(), solana_wallet: base58(key), nonce: `0x${'3'.repeat(64)}`, issued_at: '2026-10-08T12:00:00Z', expires_at: '2026-10-08T12:05:00Z' };
  const message = ipxJcs(payload); const evmSignature = await evm.signMessage({ message }); const solanaSignature = sign(null, Buffer.from(message), solana.privateKey).toString('base64');
  const receipt = await verifyIdentityMapping(payload, evmSignature, solanaSignature, policy, new Date('2026-10-08T12:01:00Z'));
  expect(receipt).toMatchObject({ verified: true, token_bridge: false, immutable: true });
  await expect(verifyIdentityMapping(payload, evmSignature, solanaSignature, policy, new Date(payload.expires_at))).rejects.toThrow('scope_or_expiry');
  await expect(verifyIdentityMapping({ ...payload, nonce: `0x${'4'.repeat(64)}` }, evmSignature, solanaSignature, policy, new Date('2026-10-08T12:01:00Z'))).rejects.toThrow();
  await expect(verifyIdentityMapping(payload, evmSignature, Buffer.alloc(64).toString('base64'), policy, new Date('2026-10-08T12:01:00Z'))).rejects.toThrow('solana_signature_invalid');
});
