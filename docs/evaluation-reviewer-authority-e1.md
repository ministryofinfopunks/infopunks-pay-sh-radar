# E1 Independent Evaluation Authority

Status: implementation candidate only. No staging database, reviewer roster, or reviewer signature was supplied for this change, so this document is not evidence of a staging activation or a verified real-world causal loop.

## Authority boundary

The public Evaluation write routes (`POST /v1/evaluate` and `POST /internal/receipt-spine/evaluation`) require operator authentication and a reviewer attestation signed by an Ed25519 key in the operator-pinned `evaluation-reviewer-trust.v1` registry. The reviewer key must be active at the attestation time, and the rubric digest must be in the registry's accepted rubric list. The service loads the referenced canonical Execution, verifies its ancestry, checks the attestation timestamp and evidence digest, then derives the Evaluation fields and score delta itself. Client-supplied score fields and unsigned evaluator claims are rejected.

The signed payload binds reviewer and key identities, trust-registry digest, Execution receipt ID, rubric digest, sorted evidence content digests, verdict, timestamp, and nonce. The canonical Evaluation receipt's existing `evaluator.signature_ref` field contains the attestation digest. The original signed payload is retained in an append-only sidecar table; the four-receipt schema remains unchanged. Receipt replay validates the attestation, trust registry, digest, rubric, evidence references, Execution linkage, and Evaluation binding.

An operator-authenticated request alone cannot create a verified Evaluation. Model output has no Evaluation authority. Existing internal Evaluation creation remains an in-process compatibility path with `internal` provenance; it is not exposed by either network write route.

## E1 isolated staging checklist

1. Create a disposable PostgreSQL database and dedicated staging service identity. Do not point staging at production or a shared canonical database.
2. Apply migrations 011 and 014, then migration 018. Preserve the migration ledger and a pre/post migration database snapshot. Never apply this migration to production as part of E1.
3. Set `EVALUATION_REPUTATION_PROJECTION_ENABLED=false`; confirm both score projection routes return 503. Keep `OPENAI_DECISIONS_SHADOW_ENABLED=false`, judgment payment disabled, economic authorization disabled, and all settlement/execution credentials absent.
4. Put only the public reviewer registry in `EVALUATION_REVIEWER_TRUST_JSON`. Independently approve the roster, key validity/revocation dates, registry digest, and rubric digest. Keep reviewer private keys offline and outside the service environment.
5. Freeze the rubric and evidence manifest before a reviewer sees model output or later-outcome predictions. Retain the exact artifacts addressed by each evidence digest in a read-only archive; the application does not fetch remote URLs or treat a digest string as proof that the artifact itself is authentic.
6. Use a disposable test issuer identity unrelated to production trust. Do not import or generate verified historical receipts. Any fixture keys and fixtures remain test-only.
7. Run the positive and rejection tests, then submit one independently signed staging attestation against a genuine inspectable staging Execution only if separately authorized. The current code work itself does not authorize that external action.
8. Verify the persisted Evaluation and sidecar from a read-only connection; restart the service; replay the same signed request; verify identical receipt bytes/hash; alter each signed field and confirm rejection; test nonce replay, conflicting attestation, missing sidecar, and DB restart durability.
9. Keep reputation projection disabled until a reviewer independent of the implementer accepts database durability, receipt replay, and route behavior. No reputation update is part of this E1 gate.

## Known boundary and migration risks

- The service validates the evidence digest against the signed list of content hashes. Artifact acquisition, provider delivery authenticity, and independent outcome review remain the reviewer's responsibility and must be documented outside the receipt.
- Trust changes invalidate prior attestations if verification is attempted only against a changed registry digest. Retain immutable registry snapshots keyed by digest for audit and replay; do not silently replace the trust input for historical audits.
- Migration 018 adds a sidecar table and extends the Evaluation score-policy constraint. Its down migration must refuse rollback while attestations exist. Test both migrations only on disposable staging before proposing production rollout.
- No migration has been applied here. `CANONICAL_RECEIPT_TEST_URL` was unavailable, so PostgreSQL behavior is not verified in this environment.
- No production database, production issuer key, provider API, payment signer, settlement rail, or deployment was accessed. OpenAI Decisions remains disabled and has no spend authority.

## Release decision

**Implementation:** candidate for disposable staging after code review. **Evaluation judgment quality:** not established by this implementation test. **Verified causal-loop evidence / E1:** blocked; no genuine independently reviewed Execution outcome was available. **Reputation mutation:** disabled for the E1 staging profile. **Commercial readiness / billing / production:** no-go.

Before staging activation, an operator must provision the isolated database and service, and an independent authority must approve the reviewer roster, rubric, evidence archive, and staging test authorization. A separate explicit approval is required for any later reputation projection, production migration, provider spend, billing, signing, settlement, or deployment.
