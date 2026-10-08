# Signed judgment assessment

A judgment receipt records the assessment. A separately signed capability grants execution authority. See `economic-engine-implementation.md` for the capability-enforcing execution gate.

This milestone adds Ed25519 issuer authentication to canonical judgments. It does not change the four canonical decisions or the x402 Base USDC payment rail. Solana settlement, Solana anchoring, Jev witnesses and treasury automation remain separate milestones. An issuer signature attests that the configured Judge issued this content; it does not establish that an observation is truthful.

## Receipt contract

A newly signed JudgmentReceipt has an optional compatibility field:

```json
{
  "issuer_signature": {
    "issuer": "https://radar.infopunks.fun",
    "key_id": "radar-2026-10",
    "algorithm": "Ed25519",
    "signature": "<canonical base64 encoding of a 64-byte signature>"
  }
}
```

The detached signature preserves existing canonical receipt hashes and parent hashes. For judgment hashing only, omit `issuer_signature` and `receipt_hash`, then hash the existing canonical `{kind,payload}` representation. The signed bytes are UTF-8 canonical JSON (lexically sorted keys, no whitespace):

```json
{"algorithm":"Ed25519","domain":"infopunks.judgment-issuer.v1","issuer":"https://radar.infopunks.fun","key_id":"radar-2026-10","receipt_hash":"sha256:<receipt content hash>"}
```

Use Ed25519 directly, without an additional signature digest. The receipt hash already commits to decision, request scope, policy, charge, settlement reference, evidence parents and issuance/expiry. The signing envelope binds that hash to the issuer and key ID. A receipt integrity hash or a valid payment signature alone does not grant execution permission.

## Configuration and trust

Set these through the deployment's secret manager:

- `JUDGMENT_ISSUER`: the stable issuer identifier.
- `JUDGMENT_ISSUER_KEYS_JSON`: an array of public SPKI PEM Ed25519 keys with `key_id`, `public_key_pem`, `valid_from`, nullable `valid_until`, and explicit `revoked`.
- `JUDGMENT_SIGNING_KEY_ID`: the current issuance key ID.
- `JUDGMENT_SIGNING_PRIVATE_KEY`: its PKCS8 PEM private key, with actual newlines.

Example public registry record:

```json
[{"key_id":"radar-2026-10","public_key_pem":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n","valid_from":"2026-10-01T00:00:00Z","valid_until":null,"revoked":false}]
```

Duplicate key IDs, mismatched private/public keys, non-Ed25519 keys, invalid windows and partial configuration fail with sanitized diagnostics. Public registry entries reject private PEM material. Production paid issuance requires an active signing key valid now and throughout the configured receipt TTL. Production cannot issue new unsigned canonical judgments or accept unsigned execution ancestry. A read-only deployment may load public keys without a private key; issuance then remains unavailable.

`GET /v1/judgment-issuer/keys` publishes public keys only. Consumers must pin an issuer/public-key trust root through an authenticated operator channel; fetching a key from the same endpoint as an untrusted receipt is discovery, not independent trust establishment. Registry responses are not themselves signed and use `Cache-Control: no-store`.

## Verification and execution

`GET /v1/receipt-spine/judgment/:id/verify` returns ancestry validity, issuer-signature validity, current validity-window status and `assessment_eligible`. Its `execution_authorized` is always false: a receipt alone grants no execution authority. The separate capability binds the exact operation, delegation, reservation, policy and replay constraints. The execution-proof service retains its separate signed-payload and settlement verification requirements.

For independent verification:

1. Validate the strict canonical receipt schema and recompute its content hash.
2. Resolve its issuer/key ID from an independently trusted public registry.
3. Reject unknown/revoked keys. Require issuance at or after `valid_from`, before a finite `valid_until`, and receipt expiry no later than key validity ends.
4. Verify the domain-separated Ed25519 signature over the canonical envelope above.
5. Reconstruct and validate observation ancestry, scope and policy. Assessment eligibility requires current time inside `[issued_at, valid_until)` and `proceed` or `test_spend_first`. Execution additionally requires a valid separately signed capability and the execution gate's current policy, evidence, revocation and single-use checks.

The server implementation is in `src/security/judgmentIssuer.ts`. `createJudgmentIssuer` supports public-key-only verification without signing credentials. Never trust an inline public key supplied by a receipt.

## Persistence, rotation and recovery

The existing append-only PostgreSQL judgment JSONB stores the signature with the receipt in the same transaction as observation membership. No new table or backfill is required. Existing unsigned receipts remain historical records, are never silently re-signed, and cannot authorize new production execution.

Add a new public key before switching the active issuance key. Retain retired public keys indefinitely for replay; never reuse IDs. Existing receipt retries return their original stored signature, even after rotation. A conflicting receipt payload under the same ID is rejected. Marking a key `revoked=true` deliberately fails verification of its receipts, including historical replay and derived projections; ordinary retirement should use a validity cutoff, not revocation. Set a retirement cutoff beyond the expiry of every issued receipt you intend to retain as valid history.

Drain pending settlements and publication recovery before removing an old private key. A settled journal entry without a published receipt may need a key whose validity covers its original frozen issuance window. If the new active key cannot cover that window, recovery fails closed and requires the appropriate signing configuration; it never resettles payment. An ambiguous settlement remains pending reconciliation under the existing journal rules.

## Deployment verification

Apply the existing canonical receipt and judgment-request migrations through the established deployment procedure. Use an application role that cannot disable append-only triggers. Configure trusted public keys and active private key, run runtime configuration verification, and then enable paid traffic. Confirm a sufficient reviewed request produces a standard 402 challenge; its paid retry produces a signed receipt; receipt read and verification agree; and restart/retry returns the identical signature without another settlement. Verify backup/restore preserves the receipt JSON and payment journal.

Local PostgreSQL tests exercise signed publication, repository reconstruction, key rotation, settlement-journal recovery and blocked receipt mutation. They use a test facilitator. They do not prove deployed role permissions, production backup/restore or live mainnet settlement. No deployment or production migration is performed by this milestone.
