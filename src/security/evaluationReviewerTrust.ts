import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { EvaluationReviewAttestationSchema, type EvaluationReviewAttestation } from '../schemas/evaluationReviewAttestation';
import { canonicalSerialize, hashCanonical } from '../services/receiptIntegrityService';
import { ReceiptHashSchema, ReceiptIdSchema } from '../schemas/receipts/common';

export const EvaluationReviewerKeySchema = z.object({
  key_id: ReceiptIdSchema,
  public_key_pem: z.string().min(1),
  valid_from: z.string().datetime({ offset: true }),
  valid_until: z.string().datetime({ offset: true }).nullable(),
  revoked: z.boolean()
}).strict();
export const EvaluationReviewerSchema = z.object({
  reviewer_id: ReceiptIdSchema,
  keys: z.array(EvaluationReviewerKeySchema).min(1).max(32)
}).strict();
export const EvaluationReviewerTrustRegistrySchema = z.object({
  schema_version: z.literal('evaluation-reviewer-trust.v1'),
  accepted_rubric_sha256s: z.array(ReceiptHashSchema).min(1).max(64),
  reviewers: z.array(EvaluationReviewerSchema).min(1).max(128)
}).strict();

export type EvaluationReviewerTrustRegistry = z.infer<typeof EvaluationReviewerTrustRegistrySchema>;
export interface EvaluationReviewerTrust {
  readonly registrySha256: string;
  acceptsRubric(rubricSha256: string): boolean;
  verify(attestation: EvaluationReviewAttestation): boolean;
}

const DOMAIN = 'infopunks.evaluation-review-attestation.v1';
// Receipt IDs may contain colons. A tuple encoding prevents cross-identity aliases.
const keyIdentity = (reviewerId: string, keyId: string) => JSON.stringify([reviewerId, keyId]);
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function evaluationAttestationSigningBytes(attestation: EvaluationReviewAttestation) {
  const { signature: _signature, ...payload } = attestation;
  return Buffer.from(canonicalSerialize({ domain: DOMAIN, algorithm: 'Ed25519', attestation: payload }));
}
export function evaluationAttestationDigest(attestation: EvaluationReviewAttestation) {
  return hashCanonical(attestation);
}
export function evaluationOutcomeEvidenceDigest(input: {
  execution_receipt_id: string; rubric_sha256: string; evidence_refs: string[];
}) {
  return hashCanonical({
    schema_version: 'evaluation-outcome-evidence.v1',
    execution_receipt_id: input.execution_receipt_id,
    rubric_sha256: input.rubric_sha256,
    evidence_refs: [...input.evidence_refs].sort()
  });
}

/** Public reviewer trust is operator-pinned. An attestation cannot add its own key to trust. */
export function createEvaluationReviewerTrust(raw: unknown): EvaluationReviewerTrust {
  try {
    const registry = EvaluationReviewerTrustRegistrySchema.parse(raw);
    const publicKeys = new Map<string, { reviewerId: string; key: z.infer<typeof EvaluationReviewerKeySchema>; object: KeyObject }>();
    const normalizedReviewers = registry.reviewers.map((reviewer) => {
      if (reviewer.keys.some((key, index) => reviewer.keys.findIndex((other) => other.key_id === key.key_id) !== index)) throw new Error();
      const keys = reviewer.keys.map((key) => {
        if (key.valid_until && Date.parse(key.valid_until) <= Date.parse(key.valid_from)) throw new Error();
        if (!key.public_key_pem.trim().startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error();
        const publicKey = createPublicKey(key.public_key_pem);
        if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error();
        const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const identity = keyIdentity(reviewer.reviewer_id, key.key_id);
        if (publicKeys.has(identity)) throw new Error();
        publicKeys.set(identity, { reviewerId: reviewer.reviewer_id, key, object: publicKey });
        return { ...key, public_key_pem: publicKeyPem };
      }).sort((a, b) => lexical(a.key_id, b.key_id));
      return { reviewer_id: reviewer.reviewer_id, keys };
    }).sort((a, b) => lexical(a.reviewer_id, b.reviewer_id));
    if (new Set(normalizedReviewers.map((reviewer) => reviewer.reviewer_id)).size !== normalizedReviewers.length) throw new Error();
    const acceptedRubrics = [...new Set(registry.accepted_rubric_sha256s)].sort();
    if (acceptedRubrics.length !== registry.accepted_rubric_sha256s.length) throw new Error();
    const normalized = { schema_version: registry.schema_version, accepted_rubric_sha256s: acceptedRubrics, reviewers: normalizedReviewers };
    const registrySha256 = hashCanonical(normalized);
    return {
      registrySha256,
      acceptsRubric: (rubricSha256) => acceptedRubrics.includes(rubricSha256),
      verify(rawAttestation) {
        try {
          const parsed = EvaluationReviewAttestationSchema.parse(rawAttestation);
          if (parsed.trust_registry_sha256 !== registrySha256 || !acceptedRubrics.includes(parsed.rubric_sha256)) return false;
          const trusted = publicKeys.get(keyIdentity(parsed.reviewer_id, parsed.reviewer_key_id));
          if (!trusted || trusted.key.revoked || Date.parse(parsed.attested_at) < Date.parse(trusted.key.valid_from)
              || (trusted.key.valid_until !== null && Date.parse(parsed.attested_at) >= Date.parse(trusted.key.valid_until))) return false;
          const signature = Buffer.from(parsed.signature, 'base64');
          if (signature.toString('base64') !== parsed.signature || signature.length !== 64) return false;
          return verify(null, evaluationAttestationSigningBytes(parsed), trusted.object, signature);
        } catch { return false; }
      }
    };
  } catch { throw new Error('invalid_evaluation_reviewer_trust_configuration'); }
}

/** Parse only the public registry; never echo malformed registry contents. */
export function evaluationReviewerTrustFromEnv(env: NodeJS.ProcessEnv): EvaluationReviewerTrust | null {
  const raw = env.EVALUATION_REVIEWER_TRUST_JSON;
  if (!raw) return null;
  try { return createEvaluationReviewerTrust(JSON.parse(raw)); }
  catch { throw new Error('invalid_evaluation_reviewer_trust_configuration'); }
}
