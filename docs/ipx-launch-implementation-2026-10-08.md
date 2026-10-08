# IPX launch implementation and evidence — 8 October 2026

The launch foundation is implemented locally. The economic flywheel is **not operationally proven**. This report updates the earlier repository audit without replacing historical observations. All changes remain in the shared working tree; no deployment or production migration was performed.

## Implemented and verified

| Area | Result | Evidence |
| --- | --- | --- |
| Historical CALLs | Original serializer, signature domain and v1 records remain intact; economically entitled calls use a separate v2 namespace | `tests/ipx-launch.test.ts`, `tests/rh-4663-phase2-resolution.test.ts`, existing CALL suites |
| Genesis calls | 4,663 signed calls from 4,663 distinct wallets, one economic call per wallet; atomic ordinals, fixed allocation, expiring UTC/campaign windows | `src/services/ipxGenesisService.ts`, `tests/ipx-launch-postgres.test.ts`; lock-wait boundary test |
| Fixed supply | Six explicit constructor allocations, supply-reducing initial burn, no mint entrypoint, owner transfer control, proxy, tax or blacklist | `contracts/src/IPX.sol`, Foundry tests |
| Certificate | Immutable birth fields plus later sealed cohort root, Constitution and allocation hashes | `contracts/src/IPXGenesisCertificate.sol`; rejects unsealed or noncanonical distributor |
| Entitlements | Funded one-time root seal and SHA-256 Merkle claims; ordinal/wallet replay protection | `contracts/src/IPXGenesisCalls.sol` |
| Solana identity | Both wallets sign the same expiring JCS message; append-only association without token bridging | `src/services/ipxIdentityMapping.ts`, signature tests |
| Paid judgments | New issuance defaults to USDG on 4663; enabled new payment configuration rejects another network; historical Base evidence remains supported | `src/config/env.ts`, USDG settlement/accounting and payment durability suites |
| Contribution | Source revenue is reconciled through the finalized accounting verifier; append-only service/revenue/contribution ancestry; atomic costs and loss handling | `src/services/ipxRevenueLedger.ts`, PostgreSQL revenue tests |
| Purchase/burn adapter | Immutable USDG → PLTR → IPX route parameters, funded source reservations, minimum output/deadline, exact input consumption, cleared allowances, supply burn | `contracts/src/IPXContributionVault.sol`; failure/retry/replay tests |
| Burn proof | Canonical finalized block, minimum depth, exact vault event/source budget, unambiguous log metadata and matching IPX transfer to zero | `tests/ipx-revenue-ledger.test.ts`; forged/orphaned/pending/mismatched evidence rejected |
| Policy integrity | All allocation amounts/recipients and execution authorities/fees committed in policy hash; deployment getters/code checked at one finalized block; policy registration immutable | `src/schemas/ipxLaunch.ts`, `src/api/ipxLaunchRoutes.ts`, migration 017 |
| Anchor correctness | Chain, destination code, exact calldata/value, canonical block, event and stored commitment must agree before confirmation | `src/services/rh4663AnchorIntegrity.ts`, anchor/resolution tests |
| PLTR correctness | Burn recency uses burn events; 2026 exchange calendar handles DST, holidays and early closes; unreviewed years return unknown | `src/services/pltrExchangeCalendar.ts`, calendar and Radar tests |
| Solana raw collection | Registered watches, finalized mainnet transactions, durable pagination/cursors, immutable observations, missing-history failure | `src/services/ipxSolanaIndexer.ts`, PostgreSQL tests |
| Market-Hours methodology | Integer integration of smaller bidirectional executable depth, fixed slippage/identity, bounded expiry/gaps and explicit coverage | `src/services/ipxMarketHours.ts`, methodology tests |
| Dashboard/discovery | Read-only `/ipx/economy`, OpenAPI endpoints, full-ledger totals separate from bounded history, unavailable states, quote-not-backing language | API and DOM tests; local browser preview inspected |

Matching contract getters and fixture tests are not a deployed-bytecode audit. The cohort sealer and cost accountant remain explicitly trusted authorities. A sealed root alone does not prove human uniqueness or the truth of a signed judgment.

## Validation record

- Full application suite with local PostgreSQL enabled: **259 files passed, 1 skipped; 1,871 tests passed, 2 skipped**. This was the shared-checkout snapshot before the final policy/finality/window-boundary tightening.
- Follow-up verification after that tightening: **17 tests passed across five IPX suites**; dashboard suite subsequently rechecked after using the repository's standard DOM test environment.
- Solidity: **6 contract tests passed**, including funded claims, certificate binding, immutable commitments and purchase/burn retry safety.
- Type checking and production build pass. The build retains its existing browser-chunk size warning.
- `git diff --check` passes.
- Database tests create and remove isolated local schemas. They cover restart/replay, concurrent writes and immutable records; they do not prove production backup restoration or application-role privileges.

The repository is shared with concurrent judgment/accounting work. These checks establish the tested snapshot and focused final changes, not an assertion about future edits.

## Production observation

Public read-only requests captured at **2026-10-08 04:01 UTC** returned HTTP **503**, with HTML responses, for `/health`, `/status`, `/v1/ipx/launch`, `/v1/ipx/economy/summary` and `/v1/radar/benchmark-summary` on `radar.infopunks.fun`.

See `docs/evidence/ipx-production-read-2026-10-08.json`. It records timestamps, response hashes, content types and selected public fields. It establishes that the endpoint was unavailable from this check, not the cause or whether the latest checkout was deployed. Reproduce using `npx tsx scripts/audit-ipx-production.ts`.

## Required inputs and remaining launch work

1. **Economic terms:** total supply, six allocation amounts, custody/vesting recipients, burn basis points and historical-wallet claim terms. No numerical examples have been adopted as launch terms. The legacy-wallet distribution remains unimplemented until its terms are defined.
2. **Launch configuration:** campaign dates, exact Constitution bytes/version, token/distributor/vault/certificate addresses, cohort sealer, accountant, operations authority and verified canonical PLTR identity. Freeze the complete policy only after these inputs are resolved; the economic CALL API stays disabled without it.
3. **Venue implementation:** verify an actually deployed router and routes, select/fund the canonical IPX/PLTR pool and LP custody policy, review execution/slippage settings and independently review the contracts. The current V3-style adapter is not a claim that the required venue exists; if the chosen venue differs, implement and test its specific executor.
4. **Live execution evidence:** apply reviewed migrations, verify production roles/readiness, recover the unavailable deployment, verify facilitator capability and run a funded paid judgment → reconciliation → contribution → purchase → supply-burn sequence. Capture receipts and independently check deployed bytecode/constructor arguments. No simulated event counts satisfy this gate.
5. **Live market metrics:** implement the sampler for the selected actual venue, persist verified execution quotes and integrate them into dashboard Market-Hours. Conversion measurement also needs mission attribution and retained liquidity evidence. The dashboard reports these as unavailable.
6. **Solana semantic coverage:** configure watches/worker cadence; implement venue-specific DEX decoders, authenticated social PRINT sources and normalized cross-venue reconciliation/wash-trade analysis. Raw finalized collection is implemented; those semantic adapters are not.
7. **Production durability:** demonstrate actual application-role migrations, restart/reconciliation, outage handling and backup/restore under deployment access. Local database results do not close this gate.

The next review should use `docs/ipx-launch-protocol-v2.md` together with this evidence record. Launch is blocked by the missing terms, unverified venue/deployments and unavailable production service; it must not be represented as complete.
