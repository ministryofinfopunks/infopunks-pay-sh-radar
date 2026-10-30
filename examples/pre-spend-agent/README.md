# Canonical advisory pre-spend example

This example calls `POST /v1/pre-spend/check` through the existing SDK. Read `canonical_judgment`; the legacy `decision` field is a diagnostic and cannot grant spend authority. Missing or expired canonical receipts stop action. A canonical assessment still requires separately authorized execution infrastructure; this example never signs, pays or executes.

Insufficient evidence is free and does not issue a paid canonical Judgment receipt. HTTP 401/402 reports a gated capability; no automatic payment retry is made. Operator-only paid/proof access and general tenant qualification are documented in `docs/product/unified-radar-product-contract.md`. Do not put signing keys or operator tokens into browser code.

Set a twelve-second request deadline. The server supports `Idempotency-Key` through SDK `headers` and the strict optional `radar-judgment-context.v1` request extension. Subject chain, service payment preference, and Judgment fee settlement remain independent. Native Solana fee settlement and RH trading authorization are unavailable.

Run this only when an advisory network request is intended. It is not a qualification of live payments, execution or outcome truth.
