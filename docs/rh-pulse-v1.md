# RH Pulse: Call the Rotation — Phase 1 + Phase 2.5

## Product boundary

RH Pulse is the standalone public-intelligence front door for `Call the Rotation`. Its canonical production URL is `https://pulse.infopunks.fun/`; `/rh-pulse` is the local-development and Radar-host fallback.

The product combines a read-only interpretation of reviewed RH Chain memory with an explicitly gated signed-participation layer. It is not an exchange, prediction market, transaction client, token gate, or Robinhood product. A visitor can inspect the bounded Layer Flow Map, select one of four equally weighted theses before connecting a wallet, and—only during an internally opened pilot window with `RH_PULSE_CALLS_ENABLED=true`—record one gasless public prediction per wallet.

Independent public-intelligence product built by Infopunks. Not affiliated with or endorsed by Robinhood Markets, Inc.

## Host architecture

RH Pulse uses the existing Fastify/Vite application:

- `pulse.infopunks.fun/*` serves the Pulse shell and maps `/`, `/methodology`, `/calls/:callId`, and `/receipts/:receiptId`.
- `/rh-pulse`, `/rh-pulse/methodology`, `/rh-pulse/calls/:callId`, and `/rh-pulse/receipts/:receiptId` serve the same shell on local or Radar hosts.
- `radar.infopunks.fun/*` continues to use the existing Radar router unless the explicit `/rh-pulse` prefix is present.
- One server-side metadata injector and one React entry choose the surface. There is no second Vite build.
- `PULSE_PUBLIC_HOST` is the only canonical Pulse authority and defaults to `pulse.infopunks.fun`. Canonical URLs never use an arbitrary request host.
- Forwarded host is considered only when the direct host is a known Radar/Pulse/Render deployment host. Localhost is trusted only outside production.

The full decision and trust boundary are recorded in [architecture/rh-pulse-host-routing.md](architecture/rh-pulse-host-routing.md).

## Shared engine and data sources

`RhPulseService` is a provider-free, deadline-bounded read projection over existing RH Chain services:

- reviewed exact-contract classifications;
- the existing Cross-Layer integration;
- latest persisted market snapshots;
- Chain Pulse snapshot memory;
- Meme Pulse snapshot memory;
- Launchpad snapshot memory;
- reviewed RH Chain receipt memory.

The React market page calls only the RH Pulse API. It does not call DEX Screener, Blockscout, or another market-data provider. The participation sheet may call a user-selected EIP-1193 wallet only after `Sign My Call` is invoked. The service reuses the existing shared Postgres pool and in-memory test convention. Phase 2 adds participation tables but no market-data ingestion path.

## Domain model

Layers have stable IDs: `memes`, `agents`, and `rwas`.

Connections have stable IDs:

- `memes_to_agents`
- `memes_to_rwas`
- `agents_to_rwas`

Every connection carries a nullable relative strength, nullable recent change, evidence type, confidence, freshness, explanation, supporting-observation count, observed timestamp, methodology version, source/receipt references, `under_watch`, and `is_strongest_current_signal`.

Public request and response models are validated with Zod. Timestamps are UTC ISO 8601 strings.

## API surface

| Endpoint | Purpose | Cache policy |
|---|---|---|
| `GET /v1/rh-pulse` | Complete first-page read model | short shared read cache |
| `GET /v1/rh-pulse/connections` | Three connections and separately derived strongest signal | short shared read cache |
| `GET /v1/rh-pulse/current-window` | Durable authority or honest preview | short shared read cache |
| `GET /v1/rh-pulse/methodology` | Versioned layer/evidence/confidence/freshness doctrine | longer methodology cache |
| `GET /v1/rh-pulse/source-health` | Health of each reused memory source | short shared read cache |
| `POST /v1/rh-pulse/calls/challenge` | Exact, single-use EIP-191 challenge for an open window | `no-store` |
| `POST /v1/rh-pulse/calls` | Verify and atomically commit a call and receipt | `no-store` |
| `GET /v1/rh-pulse/calls/:callId` | Shortened-wallet public call projection | short public record cache |
| `GET /v1/rh-pulse/calls/:callId/receipt` | Immutable receipt payload and SHA-256 hash | short public record cache |

All public endpoints use the existing RH Chain response envelope and error conventions and are documented in `/openapi.json`.

With no durable record, the current window is `preview`; `opens_at` and `closes_at` are null. `RH_PULSE_CALLS_ENABLED` defaults to `false`. Enabling the flag alone does not fabricate a window: stored status and server time must both permit submissions.

## Evidence semantics

Methodology version: `rh_pulse_layer_flow_v1`.

- `verified`: exact-contract reviewed overlap with retained classification evidence and no unresolved material classification conflict.
- `activity_coupling`: reviewed overlap with persisted activity context; co-observation only.
- `narrative`: a reviewed layer narrative exists but activity or receipt support is incomplete.
- `insufficient_evidence`: no qualifying reviewed overlap supports a numeric value.

Relative strength is the share of qualifying reviewed overlap observations across the three displayed connections. It is not dollars, market share, direction, capital flow, address ownership, agent control, or causality.

Agents ↔ RWAs is always marked `Connection Under Watch` because it is editorially important to the product thesis. That label never adds observations, increases strength, breaks a tie, preselects an option, or makes the edge thicker. The strongest current signal is derived independently; ties remain ties.

Freshness is `live`, `delayed`, `stale`, or `unavailable`. Confidence is `high`, `medium`, `low`, or `insufficient`. Freshness describes memory recency and never guarantees that a rotation exists.

## Honest fallback behavior

If the bounded Cross-Layer read fails, times out, or cannot validate:

- every unsupported connection uses `insufficient_evidence`;
- relative strength stays `null`;
- confidence becomes `insufficient`;
- the strongest signal is withheld;
- source health names the unavailable or degraded memory;
- the UI keeps the map structure visible and explains why claims are withheld.

Zero is never substituted for missing evidence. Old data is never silently labeled live. No directional dollar field exists in the API.

## Mobile UX rules

The Pulse stylesheet is isolated under `rh-pulse-*` selectors and a Pulse body class. The page is designed first for 390 × 844 and verified at 360 × 800, 375 × 812, 393 × 852, and 430 × 932.

The first viewport prioritizes the movement identity, freshness, hero question, accessible SVG Layer Flow Map, strongest measurable signal, and Agents ↔ RWAs watch state. The map is legible without animation and distinguishes evidence with line pattern and text, not color alone.

All four call cards share the same component, dimensions, interaction target, and selection behavior. No card is preselected. A safe-area-aware sticky preview appears only after selection. The selection is copied to a bounded URL parameter and session storage before wallet handoff. With calls disabled its CTA reads `Call window opening soon`; with an enabled but non-open window it reads `Call window not open`.

Pulse motion conveys activity/watch state only and is removed under `prefers-reduced-motion`. The map uses SVG and CSS only—no canvas, WebGL, D3, or chart dependency.

## Window lifecycle

Durable windows use `not_open`, `open`, `closed`, `resolving`, `resolved`, or `cancelled`. The public read additionally supports `preview` when no durable window exists.

- Internal creation always starts at `not_open`.
- Opening is allowed only after `opens_at`, before `call_submission_closes_at`, with valid time ordering, the supported `rh-pulse-v1.0` methodology, and no other open window.
- Calls require stored `open` status, server time at or after `opens_at`, and server time strictly before the submission deadline.
- Closing is idempotent. Cancellation is allowed from `not_open` or `open` and requires a reason.
- No scheduler advances a window in Phase 2. A stored open window past its deadline remains visibly non-accepting and rejects writes.

Internal pilot routes are:

- `POST /internal/rh-pulse/windows`
- `POST /internal/rh-pulse/windows/:windowId/open`
- `POST /internal/rh-pulse/windows/:windowId/close`
- `POST /internal/rh-pulse/windows/:windowId/cancel`
- `GET /internal/rh-pulse/windows`

They require `Authorization: Bearer $RH_PULSE_INTERNAL_TOKEN`. With no token configured they return `404`, not an open admin surface.

## Signature and challenge lifecycle

The server creates and stores the exact EIP-191 message. The client displays and signs that exact string; it does not reconstruct fields.

```text
RH Pulse: Call the Rotation

Domain: pulse.infopunks.fun
URI: https://pulse.infopunks.fun/
Chain ID: 4663
Wallet: 0x...
Call: Agents → RWAs
Call ID: agents_to_rwas
Window ID: rhp_window_...
Window Opens: ...
Window Closes: ...
Methodology: rh-pulse-v1.0
Nonce: ...
Issued At: ...
Expires At: ...

This signature records a public prediction.
It cannot move funds or approve transactions.
```

The domain and URI come only from trusted configuration. The wallet is checksum-normalized. The challenge binds wallet, window, outcome, chain 4663, methodology, a cryptographically secure nonce, issue time, and expiry. Default TTL is five minutes and is clamped to 60–900 seconds. Only the nonce hash is stored as a separate field; the nonce necessarily remains visible inside the retained signed message.

Submission accepts only `challenge_id` and `signature`. The server re-reads the challenge, verifies every authority field and exact message, performs EIP-191 recovery with `viem`, then re-locks and rechecks the challenge inside the acceptance transaction. Challenges are single use. Replays, expiry, closed windows, duplicate wallets and deadline races fail without a partial call.

Externally owned accounts with conventional 65-byte EIP-191 signatures are supported. EIP-1271 contract-wallet verification is not implemented. Signature length alone cannot establish that an address is a contract wallet, so malformed or non-65-byte submissions return `signature_invalid`; `contract_wallet_signature_unsupported` is reserved for a future path that has positively established contract code and an EIP-1271 verification requirement. There is no chain transaction, token approval, balance check, token requirement or automatic network-switch request.

## Wallet support and bundle boundaries

- Injected EIP-1193 wallets work without WalletConnect configuration.
- Desktop extensions and wallet-hosted mobile browsers use `eth_requestAccounts` and `personal_sign`.
- WalletConnect loads only after the user invokes signing, and its provider package is a separate asynchronous chunk.
- If `VITE_WALLETCONNECT_PROJECT_ID` is absent, the option is visibly unavailable while injected signing remains operational.
- The RH Pulse page itself is route-lazy. Wallet code is a second dynamic import and is absent from the initial Radar and initial Pulse chunks.
- Selection is retained through session storage and a stable `?call=` parameter for mobile app handoff.

Measured with the production Vite build and `gzip -c` before and after Phase 2:

| Asset boundary | Phase 1 | Phase 2 | Change |
| --- | ---: | ---: | ---: |
| Shared entry JavaScript | 1,728,184 B / 362,087 B gzip | 1,781,077 B / 376,837 B gzip | +52,893 B / +14,750 B gzip |
| Shared entry CSS | 436,668 B / 78,306 B gzip | 417,893 B / 74,549 B gzip | -18,775 B / -3,757 B gzip |
| Lightweight routing chunk | — | 10,545 B / 4,030 B gzip | async/shared route core |
| RH Pulse page | — | 48,750 B / 12,778 B gzip | Pulse route only |
| RH Pulse page CSS | — | 28,830 B / 6,357 B gzip | Pulse route only |
| Wallet bridge | — | 2,978 B / 1,341 B gzip | after `Sign My Call` only |
| WalletConnect primary provider chunk | — | 332,601 B / 95,375 B gzip | after WalletConnect selection only |

The main shared JavaScript gzip increase is 14.40 KiB, below the 15 KiB target. Including the new lightweight routing chunk, aggregate eager JavaScript increases by 18,780 bytes gzip; this is the cost of making RH Pulse route-lazy while keeping hostname decisions available to the shared shell. WalletConnect has a larger provider dependency graph, but every provider chunk remains behind nested dynamic imports and is not requested by Radar visitors or by Pulse visitors before they invoke signing.

The Phase 2.5 production build reproduces the Phase 2 sizes above byte-for-byte using the same `stat` plus `gzip -c` measurement. Its changes are server, migration, test-harness, and documentation only. The emitted import graph remains entry → RH Pulse page → wallet bridge → WalletConnect provider. An emitted-asset scan must find no gate database URL, integration failure marker, internal-token identifier/value, or test project ID.

The bottom sheet keeps the non-custodial trust statement visible before signing. It handles module loading, options, connection, missing account, challenge creation, message review, signature request/pending/rejection, invalid signature, expiry, closed window, duplicate call, server failure, atomic acceptance, receipt loading and sealed receipt. Motion is state-bearing and removed by `prefers-reduced-motion`.

## Data model and migration

Apply `migrations/20260723_007_rh_pulse_signed_calls.up.sql` through the normal external migration runner. Application startup never executes DDL.

- `rh_pulse_windows`: global window authority and source-health/audit metadata.
- `rh_pulse_call_challenges`: single-use signed-message authority. It retains no separate plaintext nonce.
- `rh_pulse_calls`: verified calls with globally unique public number and one-call-per-wallet-per-window constraint.
- `rh_pulse_call_receipts`: canonical immutable payloads and hashes, with optional supersession linkage.
- `rh_pulse_counters`: row-locked committed-call and window-sequence counters.
- `rh_pulse_audit_events`: hashed wallet/origin provenance and bounded operational facts.

The migration enforces foreign keys, status/outcome/methodology vocabularies, time ordering, one open window, unique public numbers/slugs, one call per wallet/window, deterministic Genesis rank, and immutable receipt updates/deletes.

Rollback:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/20260723_007_rh_pulse_signed_calls.down.sql
```

The down migration refuses to run after any signed call exists. Operational rollback is flag-first: set `RH_PULSE_CALLS_ENABLED=false`, preserve the records, diagnose forward, and only use the down file on an empty pilot database.

## Phase 2.5 real-Postgres production gate

The production gate uses a dedicated local PostgreSQL 14.x cluster, not the developer's normal server:

| Property | Gate value |
|---|---|
| Required major | PostgreSQL 14 |
| Address | `127.0.0.1:55463` |
| Database | `rh_pulse_gate` |
| User | `postgres` |
| Authentication | local throwaway cluster only |
| Data directory | OS temporary directory scoped by Postgres major and user ID |
| Teardown | fast stop followed by removal of only the validated gate directory |

The runner checks `postgres --version`, rejects every database URL except the exact target above, initializes a clean database, applies all `.up.sql` migrations in filename order, records their SHA-256 hashes and timings in `infopunks_schema_migrations`, and uses a migration advisory lock. A second migration pass must report all seven files as `already_applied`; changed SQL for a recorded migration fails as hash drift.

The isolated cluster disables `fsync`, `synchronous_commit`, and full-page writes for test speed. Those settings are never applied to application or production Postgres. The gate never reads `DATABASE_URL`, never connects to the default local port, and destroys the cluster in a `finally` path.

Run the mandatory all-in-one gate:

```bash
npm run test:rh-pulse:postgres
```

The command fails if PostgreSQL is absent, the detected major is not 14, the test URL is ambiguous, migrations fail, or any database assertion fails. Normal `npm test` visibly skips this external suite; it cannot substitute for the production-gate command.

The lower-level lifecycle is available for inspection:

```bash
npm run test:postgres:up
npm run test:postgres:migrate
npm run test:postgres:reset
npm run test:postgres:down
```

`test:postgres:down` stops and removes the validated throwaway cluster. It is unrelated to the SQL down migration.

### Migration and rollback proof

The gate applies migrations 001–007 against an empty database, inserts a representative existing RH Chain market snapshot before migration 007, and confirms that record survives the migration and both rollback paths. It directly exercises all six RH Pulse tables, the one-open-window partial unique index, foreign keys, time-order checks, Genesis rules, receipt triggers, and lookup indexes.

For an empty RH Pulse state, the 007 down migration removes only Phase 2 objects and its own optional `infopunks_schema_migrations` ledger row. Migration 007 can then be reapplied. If any row exists in `rh_pulse_calls`, down fails with PostgreSQL code `P0001` and:

```text
unsafe rollback: signed RH Pulse calls exist
```

Because the down file is transactional and performs this check before dropping anything, the call, receipt, migration record, and unrelated RH tables remain intact. Operator recovery is to keep calls disabled, preserve the database, inspect the failure, and fix forward. Do not delete the call to force a rollback.

### Database behavior proved by the gate

The in-memory and Postgres adapters run the same behavioral contract for window creation/transitions, challenge expiry and single use, accepted/duplicate calls, numbering, Genesis rank, receipt serialization/hash, community distribution, audit types, public retrieval, and cancellation.

The real-Postgres suite additionally covers:

- three concurrent unique-wallet batches of 100, 50, and 50 calls;
- same-challenge races with 2, 10, and 25 clients;
- 25 different challenges racing for the same wallet/window;
- two independent application server processes sharing one database;
- the Genesis boundary at 4663/4664 in a clean database;
- forced rollback after each of the eight acceptance stages;
- close-versus-submit row-lock races in both lock orders;
- database stop/restart during challenge and submission operations;
- direct receipt `UPDATE` and `DELETE` rejection plus superseding receipt insertion;
- community aggregation at 100, 1,000, and 10,000 stored calls;
- audit and process-log checks for signatures, messages, nonces, raw origins, and full wallet addresses.

The deadline interval is precisely `[opens_at, call_submission_closes_at)`: a database timestamp equal to the deadline is rejected. `clock_timestamp()` is read after the challenge lock; the locked window status and database time—not an application clock or cached public read—decide acceptance. Public reads may remain cacheable for their documented short TTL, but every write re-reads durable authority. The multi-process gate records any observed read-cache delay separately.

Integration-only failure injection exists at challenge lock, window lock, duplicate check, counter allocation, call insert, receipt insert, challenge-used update, and audit insert. The constructor rejects this hook unless both `NODE_ENV=test` and `RH_PULSE_POSTGRES_GATE=1`; it is not reachable through HTTP or production configuration. Every injected failure must roll back the call, receipt, challenge-use update, counter, Genesis rank, audit inserts, and community count before a retry is attempted.

Critical queries are inspected with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. The suite asserts use of the wallet/window uniqueness index, counter primary key, receipt call/time index, window/outcome call index, and Genesis-rank unique index. New indexes are added only when the observed plan justifies them.

## Atomic call and Genesis allocation

Postgres acceptance begins a transaction and:

1. locks and revalidates the challenge;
2. locks and revalidates the window and server deadline;
3. rejects an existing wallet/window call;
4. locks `rh_pulse_public_call_number`;
5. allocates the next number;
6. inserts the verified call;
7. inserts the immutable receipt;
8. marks the challenge used;
9. appends signature, call and receipt audit events;
10. commits and reads the verified window distribution.

Unique constraints remain the final authority across application instances. The in-memory adapter serializes and clones state to preserve the same semantics in tests.

Public call numbers 1–4663 permanently receive matching Genesis ranks. Number allocation occurs only inside acceptance; failed verification, duplicates, expired challenges, exceptions and rollbacks consume no rank. Public copy is `GENESIS CALL #0482 / 4663` and explicitly implies no token, airdrop, reward, eligibility or financial benefit.

## Receipt immutability

The canonical receipt payload records the call/window/wallet/outcome, methodology, EIP-191 verification and the RH Pulse structural snapshot at call time. Recursive key-sorted JSON serialization is hashed with SHA-256 and stored as `sha256:<hex>`.

Canonical JSON recursively sorts object keys by code-point order, emits no insignificant whitespace, preserves array order, and uses JSON scalar serialization. The gate proves the same logical payload hashes identically across property insertion orders, fresh Node processes, and both adapters; nested object or meaningful value changes produce a different hash.

The call stores the signed-message hash; the full signed message remains with the challenge. Public call projections shorten the wallet and omit the raw signature. The public receipt contains the wallet address required for durable verification.

There is no update endpoint. Postgres rejects receipt `UPDATE` and `DELETE`. A correction must insert a new receipt with `supersedes_receipt_id`; the original remains addressable.

## Community conviction

Community conviction is absent from the first-page read model and standard DOM before successful submission. The accepted `POST /calls` response reveals it.

- Verified accepted calls only.
- Exactly one call per wallet per window.
- No balance, token, volume or activity weighting.
- No seed calls or fabricated totals.
- Percentages use two-decimal largest-remainder rounding and total exactly 100 for nonzero distributions.
- A zero-call distribution explicitly returns four zero counts and zero percentages.
- Community conviction never influences resolution.

## Security assumptions and limitations

- Challenge TTL, secure nonce generation, nonce hashing, single use, exact authority-field comparison, EIP-191 recovery and atomic replay prevention.
- Strict address/outcome/signature schemas and 16 KiB public request limits.
- Per-wallet and request-origin fixed-window challenge throttles. Keys are SHA-256 hashes; raw IP addresses are not written to audit storage.
- The in-memory limiter is bounded to 2,000 entries by default and evicts expired/oldest keys.
- The limiter is process-local. Distributed throttling requires shared infrastructure and is a Phase 3 hardening item; database uniqueness and transaction locks remain cross-instance authorities.
- Audit payloads omit messages, signatures, nonces, tokens and raw request origins.
- Calls-enabled production startup requires both `DATABASE_URL` and `RH_PULSE_INTERNAL_TOKEN`.
- Postgres operation observations report only a fixed event/operation/outcome, rounded duration, safe rejection code, public call number where committed, and PostgreSQL error code where applicable. They never include a message, signature, nonce, full wallet, token, or origin.

## Deployment

Attach `pulse.infopunks.fun` as a second custom domain on the existing Radar Render Web Service and point its DNS to the Render-provided domain target. Set:

```env
PULSE_PUBLIC_HOST=pulse.infopunks.fun
RH_PULSE_CALLS_ENABLED=false
RH_PULSE_CHALLENGE_TTL_SECONDS=300
RH_PULSE_INTERNAL_TOKEN=
VITE_WALLETCONNECT_PROJECT_ID=
```

No new service, framework, Postgres instance, scheduler or market-data pipeline is required. Apply migration `007` before any production pilot. `RH_PULSE_INTERNAL_TOKEN` is server-only. `VITE_WALLETCONNECT_PROJECT_ID` is intentionally public build configuration and grants no signing authority.

## Operational pilot checklist

Keep this local or staging-only until production review.

1. Apply the migration:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -f migrations/20260723_007_rh_pulse_signed_calls.up.sql
   ```

2. Configure and restart locally:

   ```env
   RH_PULSE_CALLS_ENABLED=true
   RH_PULSE_INTERNAL_TOKEN=<strong-random-local-secret>
   RH_PULSE_CHALLENGE_TTL_SECONDS=300
   PULSE_PUBLIC_HOST=pulse.infopunks.fun
   ```

3. Choose UTC timestamps with `opens_at <= current server time < call_submission_closes_at`, then create:

   ```bash
   curl -sS -X POST http://localhost:8787/internal/rh-pulse/windows \
     -H "Authorization: Bearer $RH_PULSE_INTERNAL_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"opens_at":"2026-07-23T12:00:00.000Z","closes_at":"2026-07-24T12:00:00.000Z","call_submission_closes_at":"2026-07-24T12:00:00.000Z","methodology_version":"rh-pulse-v1.0","source_health":{"state":"delayed","observed_at":"2026-07-23T11:55:00.000Z","detail":"Local pilot evidence snapshot."},"audit_note":"Create local two-wallet pilot."}'
   ```

4. Copy the returned window ID and open it:

   ```bash
   curl -sS -X POST "http://localhost:8787/internal/rh-pulse/windows/$WINDOW_ID/open" \
     -H "Authorization: Bearer $RH_PULSE_INTERNAL_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"audit_note":"Open local two-wallet pilot."}'
   ```

5. Open `/rh-pulse`, submit from two distinct EOA wallets, and inspect both `/rh-pulse/calls/:callId` pages. Verify the accepted response reveals community conviction only after each submission.

6. Attempt another call from the first wallet in the same window. Confirm `duplicate_call` and confirm no public number is consumed.

7. Fetch `/v1/rh-pulse/calls/:callId/receipt`, recompute the canonical SHA-256 hash, and verify the Genesis rank matches the global public number when `<= 4663`.

8. Close the window:

   ```bash
   curl -sS -X POST "http://localhost:8787/internal/rh-pulse/windows/$WINDOW_ID/close" \
     -H "Authorization: Bearer $RH_PULSE_INTERNAL_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"audit_note":"Close completed local pilot."}'
   ```

9. Set `RH_PULSE_CALLS_ENABLED=false` and restart. Confirm read/receipt pages remain available while new challenges return `calls_disabled`.

## Operational failure and recovery

| Drill | Required result |
|---|---|
| Database unavailable before challenge | No challenge row; honest unavailable response; retry only after storage returns |
| Database unavailable during submission | Transaction fails; no call, receipt, counter increment, Genesis rank, or challenge-use update |
| Database restored | Existing unused challenge may be retried if still valid; otherwise create a new challenge |
| Window opened accidentally | Set `RH_PULSE_CALLS_ENABLED=false` immediately, then close or cancel through the authenticated internal route |
| Flag disabled while window open | New challenges and submissions stop; public calls/receipts and window history remain readable |
| Internal token rotated | Restart with the new server-only token; old bearer fails and public endpoints are unaffected |

The database-loss gate stops the actual Postgres process between operations and restarts the same cluster. Pool errors are contained, operations reject, and no partial state appears after recovery.

## Real-wallet production checklist

Automated wallet-bridge tests verify Rabby-over-MetaMask provider preference, `eth_requestAccounts`, exact UTF-8 hex `personal_sign`, no chain switch/transaction methods, missing/empty/invalid WalletConnect configuration, initialization failure, user rejection, session timeout, and recovery states. They do not replace a physical-device pilot.

Use wallets created solely for this test with no meaningful funds. For every row below, inspect the displayed server message, reject once, sign once, confirm one receipt, confirm the selected call survives app return, and inspect the wallet request history for no transaction, approval, or network-switch request.

| Environment | Required scenario | Gate status in this repository environment |
|---|---|---|
| Desktop MetaMask, current Chrome | Injected connection and EIP-191 signing | Outstanding manual device test |
| Desktop Rabby, current Chrome | Preferred injected provider and signing | Outstanding manual device test |
| MetaMask mobile browser, current iOS/Android | Injected signing and deep-link return | Outstanding manual device test |
| X in-app browser, one real mobile platform | Handoff, session/URL state restoration | Outstanding manual device test |
| WalletConnect with a valid project ID | QR/deep-link, wallet close, timeout, successful return | Outstanding; no project credential is available to the automated gate |
| WalletConnect absent/empty | Honest unavailable option; injected path remains usable | Automated |
| WalletConnect invalid/init failure | Recoverable error; no broken session | Automated with provider boundary |

Do not claim the production mobile-wallet gate complete until the outstanding rows record device, OS, browser/wallet version, outcome, and receipt ID in a local/staging pilot log. Never paste project credentials, seed phrases, raw signatures, or full signed messages into that log.

## Current Phase 2.5 limitations and Phase 3 handoff

Phase 2 intentionally excludes:

- final movement scoring and prediction resolution;
- scheduled window creation/closure/resolution;
- Called It and incorrect-result cards;
- dynamic per-call OG/share images;
- EIP-1271 contract-wallet verification;
- distributed rate limiting;
- profiles, accuracy histories, points, rewards, referrals, NFTs or token gating;
- public admin controls;
- agent transaction attribution or new market-data ingestion.

Phase 3 should add deterministic resolution, scheduler/operational review, distributed abuse controls if traffic requires them, contract-wallet verification only with an explicit chain/RPC trust policy, superseding-receipt operations if corrections become necessary, and resolved share assets derived only from persisted facts.
