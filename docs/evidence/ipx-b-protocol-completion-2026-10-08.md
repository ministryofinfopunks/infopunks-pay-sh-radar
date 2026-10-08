# IPX B-track protocol completion and release dependencies

Scope: isolated branch `codex/ipx-b-protocol-completion`, based on `c56ca7e` (which contains the B identity fix `d03bf51`). This is source and local test evidence, not deployment evidence or launch approval.

| Package | Implementation and reproducible check | Remaining release dependency |
| --- | --- | --- |
| B1 | Legacy CALL serializer has a fixed byte and SHA-256 vector in `tests/ipx-launch.test.ts`; v2 JCS remains a separate domain in `ipx.genesis.call.v2`. | Historical production corpus replay and retained public keys at the frozen candidate. |
| B2 | Signed 4663 calls, transactional unique ordinals/wallets, dual-signature identity links, fixed-supply contracts, and allocation tests already existed. Cohort commitment now replays every stored call against the policy, accepted window, signature and entitlement before root construction. | Full 4,663-call cohort, reviewed contract build, deployed bytecode and constructor comparison at one finalized block. |
| B3 | Existing x402 gateway requires facilitator-advertised V2 `exact` on `eip155:4663`, canonical USDG and validated domain. The append-only SERVICE→REVENUE→CONTRIBUTION→PURCHASE→BURN ledger has dedupe, finalized burn ancestry and loss-floor tests. | Actual facilitator capability, canonical USDG chain read, finalized USDG source transfers, venue liquidity and independently reviewed accountant cost evidence. These cannot be established from local mocks. |
| B4 | `ipx.issuance-manifest.v1` validates policy hash, Constitution digest, all four contract identities, finalized block, and evidence entries. Missing/placeholder entries block economic CALL issuance. Live verifier reads policy contracts at the manifest's finalized block and checks its hash twice. | Reviewed manifest with real artifacts, independent reviewer identities, claim terms, venue and x402 evidence; operator authorization before any activation. |

## Issuance manifest fields and operator sequence

`IPX_LAUNCH_POLICY_PATH` and `IPX_ISSUANCE_MANIFEST_PATH` must point to reviewed JSON files. No template placeholder is accepted. Each evidence entry has a public artifact URI, nonzero SHA-256 digest, reviewer and ISO review time. The manifest requires `policy_hash`, `chain_id=4663`, finalized block number/hash, token/distributor/vault/PLTR addresses, and evidence for Constitution, source/build, deployed bytecode/constructor, independent contract review, historical Genesis wallet claim terms, launch policy/custody, venue routes/liquidity, x402 V2 exact USDG, and rollback/operator runbook. URI availability and digest matching are separate release evidence checks; structural validation alone does not attest review quality.

Operator checklist:

1. Agree and sign all economic terms, including six allocations and Genesis wallet claims. Freeze exact policy JSON and Constitution bytes; independently compute their SHA-256 values.
2. Build reviewed contracts from pinned source and dependencies. Review constructor arguments, allocation sum, recipients, vault authorities, router and fees.
3. At a named finalized 4663 block, compare chain ID, code, birth fields, allocations, authorities, canonical PLTR and USDG, and manifest block hash to reviewed artifacts.
4. Verify facilitator V2 exact USDG support and an actual funded route with bounded slippage. Attach review artifacts and independent reviewer identities.
5. Rehearse issuance, retries, full-cohort commitment, settlement ancestry, rollback and read-only recovery on the exact candidate. Only then produce the complete manifest. The manifest makes issuance eligible for operator review; it does not authorize production activation by itself.

**Current status:** B1/B2/B3 local implementation evidence is available; B3 live-rail proof and B4 complete manifest are **BLOCKED** on external configuration, reviewed economics and deployment. Economic CALL issuance remains blocked without a complete manifest and live finalized deployment verification. Do not set G6 PASS from this branch alone.
