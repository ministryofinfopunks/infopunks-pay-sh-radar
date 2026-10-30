import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
import { judgmentSignatureMessage } from '../security/judgmentIssuerProtocol';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k])).join(',') + '}';
  throw new Error('invalid_json');
}
export async function jsonDigest(value: unknown) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)));
  return 'sha256:' + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function receiptHash(kind: string, receipt: Record<string, unknown>) {
  const { receipt_hash: _hash, ...payload } = receipt;
  if (kind === 'judgment') delete payload.issuer_signature;
  return jsonDigest({ kind, payload });
}
/** Hash/parent verification is distinct from trust in an issuer or truth of an outcome. */
export type TrustedJudgmentIssuer = { issuer: string; keys: Array<{ key_id: string; public_key_pem: string; valid_from: string; valid_until: string | null; revoked?: boolean }> };
export async function verifyJudgmentIntegrity(result: CanonicalJudgmentResponse,
  read: (path: string) => Promise<unknown>, trustedIssuer?: TrustedJudgmentIssuer) {
  const receipt = result.receipt;
  if (!receipt || receipt.judgment_id !== result.judgment_id || receipt.decision !== result.decision || receipt.confidence !== result.confidence ||
    receipt.issued_at !== result.issued_at || receipt.valid_until !== result.valid_until || receipt.charge !== result.cost.amount ||
    receipt.payment_required !== result.payment_required || canonicalJson(receipt.reasons) !== canonicalJson(result.reasons) ||
    canonicalJson(receipt.cited_observation_ids) !== canonicalJson(result.cited_observations) ||
    receipt.receipt_hash !== await receiptHash('judgment', receipt)) throw new Error('receipt_mismatch');
  for (const [index, id] of receipt.cited_observation_ids.entries()) {
    const observation = await read('/v1/receipt-spine/observation/' + encodeURIComponent(id)) as Record<string, unknown>;
    if (!observation || observation.receipt_hash !== await receiptHash('observation', observation) ||
      observation.payload_hash !== await jsonDigest(observation.payload) || receipt.parent_hashes[index] !== observation.receipt_hash ||
      observation.subject_id !== receipt.subject_id || observation.subject_type !== receipt.subject_type || observation.intent_hash !== receipt.intent_hash) throw new Error('parent_mismatch');
  }
  if (receipt.schema_version === 'canonical-receipts.v2') {
    const envelope = await read('/v1/receipt-spine/judgment/' + encodeURIComponent(receipt.judgment_id) + '/context') as { context?: Record<string, unknown>; replay_valid?: boolean };
    const { context_hash, ...context } = envelope.context ?? {};
    if (!context_hash || context_hash !== await jsonDigest(context) || context_hash !== receipt.decision_context_hash || context_hash !== result.decision_context_hash || !envelope.replay_valid) throw new Error('context_mismatch');
  }
  let issuer: 'verified' | 'unverified' = 'unverified';
  if (trustedIssuer) {
    const signature = receipt.issuer_signature;
    const pinned = trustedIssuer.keys.find(k => k.key_id === signature?.key_id);
    const pem = pinned?.public_key_pem;
    if (!signature || !pinned || !pem || signature.issuer !== trustedIssuer.issuer || pinned.revoked || Date.parse(receipt.issued_at) < Date.parse(pinned.valid_from) ||
      (pinned.valid_until && (Date.parse(receipt.issued_at) >= Date.parse(pinned.valid_until) || Date.parse(receipt.valid_until) > Date.parse(pinned.valid_until)))) throw new Error('issuer_key_untrusted');
    const raw = pem.replace(/-----[^-]+-----|\s/g, '');
    const key = await globalThis.crypto.subtle.importKey('spki', Uint8Array.from(atob(raw), c => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['verify']);
    // The exact issuer signing message is supplied below by the shared protocol helper.
    if (!await globalThis.crypto.subtle.verify('Ed25519', key, Uint8Array.from(atob(signature.signature), c => c.charCodeAt(0)), new TextEncoder().encode(judgmentSignatureMessage(receipt, signature.issuer, signature.key_id)))) throw new Error('issuer_signature_invalid');
    issuer = 'verified';
  }
  return { integrity: true as const, issuer, historical: Date.parse(receipt.valid_until) <= Date.now(), execution_authorized: false as const };
}
