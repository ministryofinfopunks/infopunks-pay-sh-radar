# Judgment payment reconciliation — operator runbook

Production payments remain disabled and public paid launch remains HOLD. This procedure confirms an already claimed payment; it never initiates another payment. The new mechanism still requires independent review and real-rail qualification before production use.

1. Locate the durable `settling` record. Preserve its payment hash, original quote/requirements, tenant binding and verified EIP-3009 payer/recipient/amount/nonce/time bounds. Do not clear a hash, reset the state to `quoted`, infer failure from a timeout, or ask a client to sign a replacement payment.
2. Obtain a candidate transaction hash from trustworthy facilitator/chain records. A transaction hash is a hint, not evidence. Retain the incident correlation without recording a raw `PAYMENT-SIGNATURE`.
3. Configure the read-only RPC for the selected rail. Current code uses `EXECUTION_PROOF_BASE_RPC_URL` for Base or `JUDGMENT_RH_RPC_URL` for RH, with canonical token identities. No client wallet/write RPC is used by reconciliation.
4. Use operator authentication to call `POST /internal/judgments/:id/reconcile` with `{ "transaction_hash": "0x..." }`. A tenant credential is not operator authority.
5. The verifier requires the expected chain, successful transaction, canonical block hash and finalized height, exact token/payer/merchant/atomic amount, original authorization window, and exactly one matching `AuthorizationUsed(authorizer, nonce)` event. This nonce event is specified by [ERC-3009](https://eips.ethereum.org/EIPS/eip-3009). The block timestamp must also be at/after quote issuance; this is conservative at subsecond boundaries and needs live-profile qualification. Batched same-payer/merchant transfers and unsupported proof profiles remain unconfirmed if attribution is ambiguous.
6. A transaction lock and compare-and-set admit `settling → settled` only for the original payment hash. Case differences cannot reuse a settlement reference. The versioned journal witness records block/transaction/time and verification provenance. Concurrent identical confirmation is idempotent; conflicting hints fail. Reverted, missing, unfinalized, mismatched and unavailable evidence all preserve `settling`.
7. Confirmation does not publish a receipt. The owner resumes the protected client session. The paid POST again requires the original verified proof and recovers/publishes one signed canonical receipt without another facilitator verification or settlement. Existing receipts/signatures replay unchanged. New RPC-only recovered receipts do not falsely label settlement as facilitator-attested; see the developer guide's optional billing/provenance limitation.

Old records lacking a verified authorization binding cannot use this automatic profile. Keep them closed pending a separately reviewed evidence/ownership procedure. The mechanism trusts the configured RPC's canonical/finalized view, not a light-client proof or the operator's supplied transaction hint. Tests use mocked RPC/facilitator evidence; they are not proof of live USDG settlement.

For rollback, disable paid traffic and preserve the journal/keys/receipts. Rolling back to PR #7 restores public read exposure and removes tenant binding; do not expose a rolled-back service publicly. No migration or down migration is required for this change.
## Local physical recovery qualification

The committed [qualification script](evidence/judgment-dx1/2026-10-12/physical-recovery-qualification.ts) uses synthetic issuer keys and a mock facilitator. Run it only in a disposable migrated database, with its snapshot directory mounted at `/qualification`. `prepare` issues one test paid receipt and records the expected bytes; `verify` reconstructs repositories, proves identical signed historical replay and requires zero new settlement/verification calls. The snapshot contains a synthetic private key and must remain private and uncommitted.

```sh
# Inside the development image, using an isolated PostgreSQL database:
QUALIFICATION_DATABASE_URL="$DISPOSABLE_DATABASE_URL" \
  npx tsx docs/evidence/judgment-dx1/2026-10-12/physical-recovery-qualification.ts prepare
pg_dump --format=custom "$DISPOSABLE_DATABASE_URL" > private-backup.dump
# Restart only the owned disposable PostgreSQL instance, then wait for pg_isready.
QUALIFICATION_DATABASE_URL="$DISPOSABLE_DATABASE_URL" \
  npx tsx docs/evidence/judgment-dx1/2026-10-12/physical-recovery-qualification.ts verify
# Restore into a second empty disposable database; do not overwrite an existing DB.
pg_restore --dbname="$RESTORED_DISPOSABLE_DATABASE_URL" private-backup.dump
QUALIFICATION_DATABASE_URL="$RESTORED_DISPOSABLE_DATABASE_URL" \
  npx tsx docs/evidence/judgment-dx1/2026-10-12/physical-recovery-qualification.ts verify
```

This test does not establish live settlement compatibility or authorize a production restart or restore.
