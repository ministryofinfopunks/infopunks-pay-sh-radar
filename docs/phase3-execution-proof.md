# Free external execution proof intake

`POST /v1/execute-proof` records an external agent or Harness execution after a canonical judgment. It never calls Pay.sh, sends a transaction, purchases a route, applies x402 middleware, or changes reputation. Public canonical receipt reads require no wallet.

## Supported proof profile

The current supported profile is `base_usdc_external.v1`. It uses the repository's existing `viem` dependency for EIP-191 EOA verification, read-only Base RPC and standard USDC Transfer decoding. Existing machine/Harness artifacts contain descriptive signature/payment claims rather than reusable cryptographic settlement verification; they are not silently elevated to canonical proof.

An admin-reviewed judgment observation may include an `execution` object:

```json
{
  "profile": "base_usdc_external.v1",
  "request_hash": "sha256:<64 lowercase hex characters>",
  "pay_to": "0x<provider recipient address>",
  "signer": "0x<known external payer/agent EOA>"
}
```

The outer reviewed judgment facts provide `max_cost`, asset, intent/constraint sufficiency and bounded-test permission. The complete original pre-spend request is bound by its observation intent hash. Multiple cited policies must agree on the execution profile. The exact authorized provider request hash must match the submitted proof. No public caller can supply/replace the known signer, recipient or constraints.

Supported input rails: `base-usdc`, `x402-base`, `pay.sh-base`, normalized to canonical `base-usdc` settlement. These mean an independently verified external Base USDC transfer, not a claim that Radar executed Pay.sh or that an unverified x402 response was accepted. Other rails, Solana, receipt-reference-only settlement and unsigned profiles are explicitly unsupported. A Base transaction hash is required. No live chain settlement was verified during local implementation tests.

## Request and signer binding

The strict `ExecuteProofRequestSchema` documents the request fields. Bodies are limited to 16 KiB; refs, signature, hashes, money, dates and status have strict bounds. It rejects unknown fields such as raw payloads or secrets. At most 32 artifact references are accepted. Request/response hashes use `sha256:` plus 64 lowercase hex characters. The supported profile requires a 65-byte EIP-191 EOA signature, despite the generic request field being optional for future profiles.

The signer signs the UTF-8 canonical JSON string returned by `executionProofSigningMessage(proof, judgment)`. Canonical serialization recursively sorts object keys, preserves array order and uses JSON primitive encoding. The message is:

```text
{
  domain: "infopunks.execute-proof.v1",
  parent_hash: judgment.receipt_hash,
  subject_type: judgment.subject_type,
  subject_id: judgment.subject_id,
  proof: <all parsed proof fields except payload_signature>
}
```

The above is explanatory notation; callers should use the helper's canonical serialized string, not stringify this display literally. The binding covers judgment ID, subject context, settlement reference, hashes, cost, execution timestamp, status, artifacts and idempotency key. The known EOA must also be the USDC Transfer sender.

## Read-only settlement verification

Configure `EXECUTION_PROOF_BASE_RPC_URL`. Startup checks chain ID 8453. Durable operation also requires migration `20261007_013_execution_proof_uniqueness.up.sql`; configured startup checks its indexes. Without a verifier, eligible submissions fail with 503; no simulation or fallback marks settlement valid.

The verifier retrieves the actual transaction receipt, checks successful status and exact transaction hash, checks its canonical block hash and finalized block height, and decodes USDC Transfer logs from the known Base token contract. The transfer must match the known payer and provider recipient and its exact atomic USDC amount must equal the submitted cost. Its block timestamp must lie within the judgment authorization window and at or before the supplied execution time. A judgment purchase fee transaction is rejected as external execution proof. The explicit provenance is `base_rpc_finalized_usdc_transfer`; it relies on the configured RPC's chain view, not independent light-client verification.

Judgment integrity and complete ancestry are replayed. Execution must be at or after issuance, strictly before expiry and not in the future. `do_not_spend` and `insufficient_evidence` parents are rejected; no authorized or reputation-bearing receipt is created. Unsupported profiles and missing policy constraints also fail closed. Late submission of an execution that demonstrably occurred inside the historical authorization window is allowed.

## Receipt, claims and replay

The append-only ExecutionReceipt includes the canonical parent hash and an additive hashed `verification` object: profile, original canonical submission hash, RPC settlement evidence and known signer. Request/response hashes are explicitly `externally_supplied_signed_claims`; the status is `externally_supplied_signed_claim`. Radar has no payload bytes to recompute here and does not falsely claim server content or semantic verification. A later independent evaluation is a separate authority; no Phase 4 evaluation workflow was added.

The execution ID derives from the submitted idempotency key. Identical canonical submissions return the same receipt, even after restart, without another verification or payment. Conflicting reuse returns 409. Memory and PostgreSQL enforce one profiled execution per judgment and one per settlement; aliases cannot bypass settlement uniqueness. Concurrent identical submissions converge on the existing verified receipt. PostgreSQL immutability guards continue to block update/delete/truncate.

Rate limiting reuses the existing Fastify infrastructure at 20 free proof writes/IP/minute. Structured logs record accepted receipt IDs or rejection codes, never signatures or raw bodies. Settlement and payload failure paths cannot manufacture success.
