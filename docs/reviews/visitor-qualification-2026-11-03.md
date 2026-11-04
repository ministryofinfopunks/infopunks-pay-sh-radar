# Radar visitor qualification — 2026-11-03

**Decision: HOLD public announcement pending RH recovery and external cause review.** This report is a bounded qualification, not a claim that every route has passed end to end.

## Verified baseline and safety boundary

- GitHub `main`: `199831137bce4e478dc791cf7639c0c3fd8957df` (independently checked with `git ls-remote`).
- Render service `srv-d7u6kjhkh4rs738hjbgg`, current live deploy `dep-dbl10jugekts73fcvif0`, commit `199831137bce4e478dc791cf7639c0c3fd8957df`, live since 2026-11-03 16:49:26 UTC. Render service branch is `main`, auto-deploy is off, PR previews are off. The five qualification branches cannot auto-deploy through this service. No deploy was triggered.
- PR #24 is merged in the verified baseline. Its deployment is independently established by the matching live deploy SHA above.
- PR #20 remains open and draft at head `2fa3edadc11890bdbb9f00a87922b0a1b538adb2`, last updated 2026-10-30 11:15:18 UTC; it was not changed.
- Production activity was limited to safe reads/log inspection. No writes, migrations, setting changes, real signing, payment, or deployment were performed.
- Browser journeys for Spend Terminal, Economic OS, and RH controls used the actual local built frontend and local backend with disposable synthetic/memory data. Local backend payment and external network providers were disabled. Production behavior is cited only for read-only RH requests and logs.

## Announcement blockers, ranked

1. **Critical — RH Chain Signal Desk unavailable.** Live direct load and refresh of `/rh-chain-signal-desk` resolved the API origin to `https://radar.infopunks.fun`; `GET /v1/rh-chain` request `req-56` at `2026-11-03T17:02:52.447Z` returned 503 in 1 ms. The service's shared database circuit rejected the request before querying the snapshot. The timeline below shows a preceding schema failure opened the global circuit and no autonomous recovery probe followed. The two PostgreSQL SIGKILLs remain unexplained by available platform evidence. PR #26 addresses circuit classification and autonomous bounded recovery but neither fixes the missing relation nor identifies the SIGKILL sender. Review the patch, then separately resolve schema and Render database cause before announcement.
2. **High — current RH data and related RH actions are not visitor-qualified.** Local RH rows are stale seeded data (last visible sample 2026-07-19), not production intelligence. Local search/filter is corrected by PR #29, but exact-contract success, share, copy, evidence submission, and RH APIs have not all been verified with live data.
3. **High — no browser proof of a successfully issued canonical judgment receipt.** The current local form returns authoritative `insufficient_evidence`; canonical receipt issuance and paid settlement were not driven through an actual browser journey. Integration tests use a synthetic signature and mocked facilitator. They are not real signing/payment and are not an end-to-end receipt qualification.
4. **Medium — broad Solana and cross-product controls are only inventoried, not exercised.** Page render and hrefs were inspected, but many filters, exports, preflight, routing and wallet workflows remain untested.
5. **Medium — mobile and full keyboard coverage incomplete.** Homepage disclosure keyboard behavior passed. Mobile viewport coverage and keyboard traversal across the other routes remain untested.

## RH incident: causal timeline and remedy boundary

All timestamps UTC on 2026-11-03. Evidence is from correlated application and PostgreSQL logs, source inspection, browser network resolution, and the Render deployment record.

| Time | Evidence | Interpretation |
|---|---|---|
| 16:49:18 | Application startup recovery probe succeeded. | Database initially reachable. |
| 16:49:30.799–16:49:31.839 | PostgreSQL PID 418128 received SIGKILL during `insert into intelligence_snapshots (snapshot) values ($1::jsonb)`; PostgreSQL restarted/recovered. App logged terminated connection at 16:49:30.801. | Confirms database backend termination and restart, not its cause. |
| 16:50:13.309 | App logged recovery. | At least one successful recovery observation followed first restart. |
| 16:51:08.290–16:51:10.391 | PostgreSQL PID 418244 received SIGKILL during the same insert; database restarted/recovered. | Second unexplained termination. |
| 16:52:16.366 | App logged recovery. | Connection recovery after second restart. |
| 16:53:21.516 | PostgreSQL returned SQLSTATE `42P01` for `select record from judgment_requests where request_key=$1`; relation `judgment_requests` was absent. | A schema/query failure, not evidence of database connectivity loss. Available records do not establish the earlier increments in the failure counter. |
| 16:53:21.517 | App recorded the relation error as the third consecutive database failure and opened the shared availability circuit. | The global circuit was triggered by a non-connectivity SQL error. The error itself remains a schema defect to resolve. |
| 16:53:22.603 | A recovery probe was scheduled. | No later `database_recovery_probe` or `database_recovered` event was found through 17:03 UTC. |
| 17:02:52.447 | Browser request `req-56`, `GET /v1/rh-chain`, returned 503 in 1 ms at `DatabaseCircuit.beforeOperation` while reading Chain Pulse snapshot. | Request was rejected by the open circuit before its normal DB operation; this was correct fail-closed behavior while the circuit considered storage unavailable, but recovery was not attempted by normal RH traffic. |

**Finding:** Do not call the circuit itself the SIGKILL root cause. The circuit correctly rejected RH reads while open, but it incorrectly counted a relation-specific SQL error as shared database unavailability and the current code path did not automatically probe on normal RH reads. Evidence shows two separate SIGKILL/restart sequences followed by a missing-relation error; it does not establish why the relation was missing or who/what sent SIGKILL. The resolved browser API URL was `https://radar.infopunks.fun/v1/rh-chain`.

**Smallest code remedy prepared:** PR #26 only counts recognized connectivity/availability errors toward the shared circuit; it preserves and rethrows the failing SQL operation. It adds a one-in-flight, bounded/backoff recovery probe scheduler so recovery does not depend on a visitor calling `/health`, with no unsafe operation retry, authorization bypass, or probe storm. It does not alter schema or attempt migration.

**External evidence blocker:** Render/PostgreSQL logs do not expose SIGKILL sender, host OOM/eviction or operator event, sub-minute resource telemetry, or the schema/migration state that explains the missing `judgment_requests` table. Exact requests and affected timestamps are recorded in [the Render support brief](render-postgres-sigkill-support-brief.md). Review it with Render support and inspect schema history outside production mutation. Do not claim the database is healthy based only on the circuit fix.

## Check-to-result / receipt qualification

Local actual frontend + backend, synthetic inputs, external providers/payment disabled:

| Journey | Result and evidence | Status |
|---|---|---|
| Submit a valid Spend Terminal form | Browser issued `POST /v1/pre-spend/check`, received HTTP 200, and displayed canonical root outcome `insufficient_evidence`, confidence 0, charge 0 USDC, `payment_required=false`, `receipt=null`. | PASS for local no-charge judgment path |
| Reconcile route assessment | Response/UI also contains legacy route assessment `use_with_caution` and historical route receipt IDs. The UI labels these as supporting route context; it no longer promotes a route identifier to a canonical judgment receipt. | PASS after PR #25; regression-tested |
| Reject and clear stale result | After successful local result, submit negative budget: `POST /v1/pre-spend/check` returned 400. Prior result cleared and request error displayed. A subsequent valid submission recovered to the canonical 200 result. | PASS after PR #25 |
| Historical receipt link | Clicked `receipt_001`; local `/receipts/receipt_001` displayed the seeded legacy historical receipt (0.25 USDC, dated 2026-06-14, stale by 142 days) and route validation history. It is clearly historical and not a canonical judgment receipt. | PASS, bounded local fixture |
| Canonical receipt issuance | Browser did not perform a successfully charged/issued receipt flow. Existing integration coverage includes a synthetic fixture signature and mocked facilitator only. | NOT TESTED in browser; fixture integration is not real signing/payment |
| Authorization denial | Local unauthenticated POST to internal judgment writer returned 401. No private canonical read path is promised by the current receipt list; this is not cross-tenant receipt-read proof. | PASS for tested write denial; private-read isolation NOT TESTED |
| Payment denial / retry / recovery | No wallet prompt or real facilitator was invoked. No full browser payment denial/recovery journey was performed. | NOT TESTED |

The final local browser wording says the preview has not run a check, that canonical results come from the check endpoint, and that a judgment receipt is shown only when issued. Test evidence disclosure controls were keyboard-operable on the homepage; see matrix. Synthetic signatures in tests are fixture data, not real signing. No transaction was broadcast.

## Journey matrix

**Status definitions:** PASS means the named local/production-safe behavior was directly exercised. FAIL means an observed user-facing failure on the currently live baseline. NOT TESTED means the control or required state was not exercised; a page render, href inspection, or HTTP 200 alone does not qualify its workflow. Product data can be live, fixture/stale, illustrative, gated, or unavailable; the matrix calls that out separately.

| Surface and displayed control group | Expected behavior → actual route/API | Data / access state | Evidence and loading/error/retry | Status |
|---|---|---|---|---|
| Homepage header/global navigation, top quick links, hero CTAs | Navigate to `/solana`, `/4663`, `/radar/cards`, `/spend-terminal`, and `#radar-home-proof` as labeled | Live route shell; page data varies | Hrefs inspected in local DOM. Homepage and Spend Terminal destinations opened. Other destinations not all clicked. | PASS for destination inspection; remaining routes NOT TESTED |
| Homepage judgment preview | Static illustration; CTA opens real `/spend-terminal` check | Illustrative, explicitly not a check result | Local browser showed “Static illustration only; this preview has not run a check”, “Awaiting evidence”, confidence not assessed. CTA opened working local terminal. #28 corrects copy without changing layout/function. | PASS after PR #28 |
| Homepage evidence disclosure summaries (Provider verification, Route history, Payment risk analysis, Policy match) | Native details/summary reveal the named supporting evidence | Illustrative preview evidence | Keyboard Tab/Enter expanded all four; AX tree exposed expanded state and text. Pointer activation also exercised. | PASS for homepage disclosures |
| Homepage pulse status | GET `/v1/pulse` | Local synthetic/seeded status; separate from judgment | Rendered “Live intelligence available” in local app; did not imply judgment was run. No forced API failure/retry. | PASS, bounded; error/retry NOT TESTED |
| Homepage mobile layout and all-route keyboard traversal | Responsive layout and keyboard operation | N/A | Browser viewport override unavailable in the inspected IAB capability surface; no device-width mobile run. Keyboard traversal outside homepage disclosures not completed. | NOT TESTED |
| Spend Terminal check form / refresh | POST `/v1/pre-spend/check`; refresh page to reset session form | Local synthetic; production POST prohibited | Actual local request and displayed canonical result verified. Result refresh/reload and valid retry after rejection observed. | PASS for local insufficient-evidence path |
| Spend Terminal invalid request | Same POST; show validation/API error and clear stale result | Local synthetic | Negative budget returned 400; stale canonical result cleared; later valid request succeeded. Regression test and browser proof. | PASS after PR #25 |
| Spend Terminal route assessment, cost and receipt presentation | Show canonical judgment separately from legacy route/data context; show receipt only if canonical receipt issued | Local synthetic route evidence; no judgment receipt | Browser confirmed canonical `insufficient_evidence`, 0 USDC, null receipt while legacy route says `use_with_caution`. Copy/regression ensures legacy route receipt IDs cannot be mislabeled as judgment receipt. | PASS after PR #25 |
| Spend Terminal receipt link(s) | Historical route receipt opens `/receipts/:id`; canonical receipt should be accessible only when issued/authorized per contract | Seeded historical example | Opened `receipt_001`; page showed historical age/route history and legacy-receipt authority limitation. Canonical issued receipt browser path not generated. | PASS for historical fixture; canonical issuance NOT TESTED |
| Spend Terminal wallet/sign/settlement actions | Only authorized wallet flow may sign/pay; denial/recovery should preserve authorization | Gated external wallet/facilitator | No wallet prompt, signing, real payment, or broadcast. Test integration uses synthetic signature plus mocked facilitator and is not browser E2E. | NOT TESTED |
| Internal judgment receipt writer | Protected write path rejects unauthenticated request | Gated | Local unauthenticated POST returned 401. No production write. | PASS for tested denial |
| Solana navigation / hero / page links | Navigate to product pages, Signal Hunt, Narratives, Unicorn Radar, Signal Graph, Check, Loops, Hermes, benchmarks, and linked workflows | Route shell; downstream data may be live, illustrative, or gated | Local DOM and hrefs inventoried; no comprehensive click-through or destination/API assertions. | NOT TESTED |
| Solana network destination switch and route-mapping selects | Change selected network/route and update results | Gated/network-dependent | Controls present in local DOM; no selection transition or external provider call. | NOT TESTED |
| Solana leaderboard filters/sort and ecosystem search | Filter/sort rows and search ecosystem | Local page data status not established for each control | Controls inventoried, no filter/search success or empty-state test. | NOT TESTED |
| Solana preflight input / Run Preflight / compare selection | Submit preflight and compare supported options | Gated or provider-dependent; compare initially disabled | Controls inventoried; no valid, invalid, loading, error, retry, or compare journey exercised. | NOT TESTED |
| Solana copy URL, JSON/CSV export, evidence-ledger copy | Clipboard/download/export displayed data | Local browser | Buttons inventoried; clipboard permissions/download content not tested. | NOT TESTED |
| Solana featured rotation toggle / provider filters | Toggle rotation and filter/sort/feature providers | Local page data; external freshness not established | Controls inventoried only; no state assertion. | NOT TESTED |
| Solana wallet or transaction actions | Request wallet approval, handle deny/approve and recovery | Gated external wallet/chain | No wallet prompt, signing, payment, or broadcast permitted/performed. | NOT TESTED |
| RH direct route and browser refresh | `/rh-chain-signal-desk` loads; browser calls `/v1/rh-chain` | Production live request unavailable; local fixture is stale | Production resolved API origin `https://radar.infopunks.fun`; `req-56` at 17:02:52.447Z returned 503 in 1ms. Direct and refresh reproduced; local RH is seeded/stale and not evidence of live intelligence. | FAIL on current live baseline |
| RH Brief/Analyst toggle, Today summary links, Daily receipt share/full receipt, movers links/share | Toggle RH view; links/actions point to relevant brief/receipt/mover | Local stale seed | Controls and destinations inventoried. Analyst mode reached. Only filter/search listed below exercised; shares, summary/mover links not activated. | NOT TESTED except Analyst toggle PASS |
| RH Meme Pulse status filters, search, Cards/Analyst Table | Apply the selected status and query in either view | Local stale seed | Reproduced defect: analyst mode displayed all six raw rows when searching `HOOD`. PR #29 now filters the same rows; browser showed only Hood Rail/HOOD; Reviewed returned existing no-match copy. Regression first failed against old behavior then passed with fix. | PASS after PR #29; live RH API remains FAIL |
| RH exact-contract form (“Check 4663”), copy contract, policy/evidence disclosure | Validate contract, open policy, copy/share evidence | Local fixture lacks exact contract; exact success path unavailable | Disclosure link/control inventoried. Local fixture displayed “Contract unavailable”; no successful exact-contract submission, copy, or recovery flow. | NOT TESTED; unavailable fixture state observed |
| RH Review Queue, Live Snapshot, Launch Surface Watch, API/methodology/source-policy links | Open linked RH workflows and source context | Production unavailable; local route shell/stale sample | Links inventoried; not all followed. No production response recovered. | NOT TESTED; supporting live reads FAIL under open circuit |
| Economic OS overview and cross-links | `/economic-os/overview` shows architecture and links to Solana, RH, Attention Market Watch, Signal Graph, LoopLab, Receipts, Claims, Routes, Providers, Spend Terminal and Developers | Illustrative architecture, no execution | Initial local accessible-tree snapshot showed “Opening Economic OS…”; subsequent snapshot resolved with full overview. Links/hrefs inspected; selected links not all opened. No mutations/filters/tabs found. | PASS for page load after loading; workflow destinations NOT TESTED |
| Economic OS request example | Illustrative `POST /v1/pre-spend/check` example | Illustrative; actual local schema contract | Example is explicitly labeled illustrative and linked to Developers. Local executable request was tested from Developers/Terminal path. No check is triggered by Economic OS page. | PASS for labeling; independent action absent |
| Proof / Receipts listing and historical receipt cards | `/receipts`; open `/receipts/receipt_*` | Seeded historical examples, not canonical issuance | Listing/card links inspected; `receipt_001` opened from Terminal. Receipt content and stale age shown. No search/filter/export controls observed in listing tree. | PASS, bounded historical detail; list completeness NOT TESTED |
| Proof canonical receipt issuance, ownership/tenant denial | Open an actually issued canonical receipt under intended authorization boundary | Gated; no issued browser receipt | Current local no-charge check returned `receipt:null`; internal writer 401 was verified. No successful canonical receipt or cross-tenant/private read test. | NOT TESTED |
| Developers navigation and builder links | Navigate among integration registry, Wallet Safety, Spend Terminal, Check, Loops, Routes, Providers, Services, Receipts, Claims, OpenAPI and Agent Example | Documentation/illustrative | Hrefs and link labels inspected; direct `/developers` page read in local browser; not every target opened. | PASS for href inspection; full link verification NOT TESTED |
| Developers executable request | Current request schema (`agent_id`, `intent`, `budget`, `risk_tolerance`, `preferred_settlement`, `required_confidence`) | Local synthetic; no charge | Example matches current schema and local request returned HTTP 200 with canonical `insufficient_evidence`, 0 USDC, `payment_required=false`, `receipt=null`. Docs clarify abbreviated response vs executable request and distinguish legacy route context. | PASS after PR #27 |
| Developers response/error/charge/receipt contracts | Explain canonical outcomes, applicable charges, receipt issuance conditions and errors | Contract docs + local backend | Docs no longer advertise unsupported unconditional receipt behavior; local synthetic request verified no-charge/no-receipt response. HTTP 400 observed for negative budget. Broader OpenAPI response/error variants and all documented examples were not exhaustively executed. | PASS for checked example/copy; full contract matrix NOT TESTED |
| Global loading/error/retry outside named journeys | Each route announces loading/errors, permits recovery where offered | Mixed | Only Economic OS loading-to-resolved, RH live 503, and Terminal 400-to-valid-retry directly captured. Other routes' forced failure/retry branches not exercised. | NOT TESTED |

## Qualified patches and exact checks

All are separate draft PRs against main; none are merged or deployed. Render auto-deploy and PR previews are off. No schema migration is included.

| PR / head | Scope | Checks and direct evidence |
|---|---|---|
| [#25 Spend Terminal canonical judgment truth](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/25) · `c2b95f16643ae4c71fc1d85c38ec0592ce5c51f2` | Canonical judgment authoritative; legacy route IDs are not judgment receipts; clear stale result; clarify issuance copy. | `npx vitest run tests/spend-terminal-judgment-truth.test.tsx tests/integration/pre-spend-judgment.test.ts tests/integration/pre-spend-payment.test.ts tests/integration/execute-proof.test.ts`: 7 passed. Broad integration/resilience subset: 36 passed, 1 skipped. Typecheck and build passed. Local browser success `insufficient_evidence`, 400 stale-clear, valid recovery, historical link and unauthenticated writer 401. No browser-issued paid canonical receipt. |
| [#26 PostgreSQL circuit connectivity-only](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/26) · `b92bb6a7bd7f86b9eb35c53006e82f9e5770d741` | Non-connectivity SQL error does not trip shared availability circuit; preserve operation error; bounded background recovery without `/health`, probe storm, unsafe retries or auth bypass. | `npx vitest run tests/postgres-resilience-failure-matrix.test.ts tests/postgres-resilience.test.ts`: 32 passed, 1 skipped. Missing relation, genuine connection loss/recovery, RH availability despite unrelated schema error covered. Typecheck and build passed. SIGKILL cause and missing table are external/unresolved. |
| [#27 Developer canonical contract docs](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/27) · `bf95055bdc02e721b31f2bebb0a951e8888fd1b5` | Correct executable request and current outcome/charge/receipt issuance explanation; no unsupported promise. | `npx vitest run tests/pre-spend-builder-pages.test.tsx tests/pre-spend-builder-api.test.ts`: 33 passed. Typecheck/build passed. Local schema-valid POST returned 200 canonical `insufficient_evidence`, 0 USDC, no receipt. |
| [#28 Homepage static-preview clarification](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/28) · `5c063d88fd5b9deb17658a72f13cac1cd4910fac` | Separate copy-only clarification that homepage preview is static and has not run a check. | `npx vitest run tests/homepage-performance.test.tsx`: 6 passed. Typecheck/build passed. Local browser verified wording, pending evidence state and working Terminal CTA; all four disclosures keyboard-tested. |
| [#29 RH Analyst filter correction](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/29) · `dd0fabfd2315996d5f2f65df70434d5e645ef41a` | Existing Meme Pulse status/risk/search filters apply in Analyst mode. | `npx vitest run tests/rh-chain-pages.test.tsx tests/rh-chain-signal-desk-selectors.test.ts`: 36 passed. Typecheck/build passed. Browser reproduced HOOD search and Reviewed empty state. Local fixture only; does not restore live RH. |

No tests were weakened or controls removed. The homepage wording patch is separate from reliability changes. PRs #25–#29 are currently draft and pushed at heads recorded in their linked PRs; PR #20 remains untouched.

## Remaining announcement blockers and next steps

1. Review #26 and #25–#29 independently; retain their separation. Do not merge until ordinary repository review passes.
2. Obtain Render/Postgres host termination/resource evidence and explain why `judgment_requests` is absent. Apply any schema change only through explicit reviewed migration planning; none is included here.
3. After a separately approved reliability/schema remedy is deployed, verify current deployment SHA and repeat safe direct-load/refresh RH reads. Do not infer recovery from a local circuit test.
4. Qualify an authorized isolated wallet/facilitator environment for approval denial, recovery and successful canonical receipt issuance. Until then, payment and issued-receipt browser journeys stay NOT TESTED; this report does not use real keys or production writes.
5. Finish Solana controls, remaining RH actions, Developers response/error variants, cross-route keyboard traversal, mobile viewport and forced local error/retry states. These are bounded remaining test tasks, not grounds to imply full end-to-end verification.

There is no claim here that the entire app is end-to-end verified. The strongest unresolved visitor-facing blocker is the live RH 503; external database termination cause, successful issued-receipt browser journey, and the listed unexercised control groups remain explicit blockers or NOT TESTED.

## Release-candidate qualification addendum — 2026-11-04

This addendum updates the prior evidence above for the integrated candidate. Where earlier rows say that a paid browser issuance journey was not tested, the backend fixture outcomes below now qualify the local API path. The browser UI limitation remains a separate failure. This remains a bounded qualification; the matrix's explicit NOT TESTED rows are still in force.

### Integrated candidate and provenance

- Integration branch: `codex/radar-qualified-release`, created from verified current main `199831137bce4e478dc791cf7639c0c3fd8957df`.
- Candidate: `f4fd8742ac8f01028eca567dbedddf4280a611d0`.
- The candidate contains only PRs #25–#29, integrated with no-ff merge commits. Source PR commit heads remain ancestors of the candidate.

| PR | Exact base SHA | Exact reviewed head SHA | Integration merge |
|---|---|---|---|
| #25 | `199831137bce4e478dc791cf7639c0c3fd8957df` | `c2b95f16643ae4c71fc1d85c38ec0592ce5c51f2` | `0705295183b8ccae4278242fe5021e2a76f3208b` |
| #26 | `199831137bce4e478dc791cf7639c0c3fd8957df` | `b92bb6a7bd7f86b9eb35c53006e82f9e5770d741` | `cffd0d9589753930d2af8c19945951b42663771c` |
| #27 | `199831137bce4e478dc791cf7639c0c3fd8957df` | `bf95055bdc02e721b31f2bebb0a951e8888fd1b5` | `a0e779b5cbfb7ecad77dde35d9e74e368b98883b` |
| #28 | `199831137bce4e478dc791cf7639c0c3fd8957df` | `5c063d88fd5b9deb17658a72f13cac1cd4910fac` | `0954389749d9f56b6a1eda3ffd51b3efdb4c7719` |
| #29 | `199831137bce4e478dc791cf7639c0c3fd8957df` | `dd0fabfd2315996d5f2f65df70434d5e645ef41a` | `f4fd8742ac8f01028eca567dbedddf4280a611d0` |

No main merge, production deploy, migration, settings change, production write, real signing, payment, or broadcast occurred. The Render production service remains configured to follow `main`, with auto-deploy and PR previews disabled. This integration branch does not change that configuration.

### Combined checks

On the exact integration candidate before documentation-only qualification updates:

- `npx vitest run tests/spend-terminal-judgment-truth.test.tsx tests/integration/pre-spend-judgment.test.ts tests/integration/pre-spend-payment.test.ts tests/integration/execute-proof.test.ts tests/pre-spend-builder-pages.test.tsx tests/pre-spend-builder-api.test.ts tests/homepage-performance.test.tsx tests/rh-chain-pages.test.tsx tests/rh-chain-signal-desk-selectors.test.ts tests/postgres-resilience-failure-matrix.test.ts tests/postgres-resilience.test.ts` — 11 files passed; 114 tests passed, 1 skipped.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite reported the existing large-chunk advisory (>500 kB).
- `git diff --check` — passed.

### Local check, payment and receipt evidence

The local browser used the actual Vite-built frontend served by a local `createApp` backend. The backend used disposable in-memory synthetic evidence and an ephemeral Ed25519 fixture key. Its x402 facilitator stub accepts only fixture signatures, returns a synthetic settlement reference, and transfers no funds. No production key, wallet prompt, real facilitator, network payment, or transaction broadcast was used.

| Journey | Observed evidence | Status |
|---|---|---|
| Insufficient evidence in Terminal | The browser submitted the form to the actual local `POST /v1/pre-spend/check`; UI displayed canonical `insufficient_evidence`, confidence 0, charge 0 USDC, `payment_required=false`, and no canonical receipt. Legacy route judgment and historical IDs stayed labeled as route context. | PASS |
| Rejected form, stale clearing, retry | Browser changed budget to `-1`; actual endpoint returned 400 and the prior displayed result cleared. Restoring a valid budget and resubmitting returned a fresh canonical insufficient-evidence result. Enter/Return keyboard submission also produced the result panel. | PASS |
| Paid-route Terminal UI | With synthetic evidence seeded locally, the actual Terminal form reached the backend and displayed HTTP 402/payment-required error. The page has no payment-signature entry/approval control to continue from the challenge. | FAIL — UI stops at the payment boundary |
| Payment denial then recovery | Against the same actual local backend/API, first fixture signature was denied: HTTP 400 `invalid_payment_signature`. A second allowed fixture signature retried the same check successfully: HTTP 200 canonical `proceed`, `payment_required=true`, charge `0.01 USDC`, and a signed canonical judgment receipt. This is fixture authorization/payment simulation, not actual user signing or funds movement. | PASS for backend fixture path; NOT TESTED as a complete browser payment journey |
| Canonical receipt verification and access | Local `/v1/receipt-spine/judgment/:id/verify` returned 200; ancestry and issuer signature valid, within validity, assessment eligible, execution authorization false. Browser opened the actual issued receipt URL and rendered the canonical JSON including fixture issuer/key ID, signature, and synthetic settlement reference. | PASS |
| Authorization denial and cross-tenant boundary | Unauthenticated POST to internal receipt writer returned 401. The canonical receipt GET returned 200 without credentials and with a second tenant bearer because this endpoint is public in the current implementation; no private or tenant-isolated read contract is implemented. | PASS for writer denial; cross-tenant denial NOT APPLICABLE to public receipt access, no isolation claim |

This evidence does not establish real signing or payment. The tested receipt signature used `local-release-fixture-ed25519`; its signing key was generated only for the disposable local process and discarded when it stopped.

### Clone rehearsal schema check

Read-only inspection of isolated clone `radar-pr24-migration-rehearsal-20261103` found `public.rh_chain_snapshot_cache` present and `public.judgment_requests` absent. Thus the clone rehearsal currently resolves the RH cache object required by the app but not the judgment journal relation queried by every check. No migration was run. The app's RH cache service lazily creates its cache table; `judgmentRequestRepository` queries `judgment_requests`, and `judgmentService` accesses that journal during a check. Missing `judgment_requests` remains a concrete schema blocker for PostgreSQL-backed checks. This clone observation does not substitute for a production schema query.

### Presentation evidence and remaining matrix coverage

The captured local browser screenshots are:

- [Integrated homepage static preview](screenshots/radar-homepage.jpg)
- [Terminal insufficient-evidence result](screenshots/radar-terminal-result.jpg)
- [Fixture-signed canonical receipt](screenshots/radar-signed-receipt.jpg)

Homepage copy visibly identifies the preview as static and not a check result. The Terminal screenshot shows canonical judgment state without promoting the legacy route identifier. The receipt screenshot shows a canonical receipt signed by the isolated fixture issuer.

The existing matrix above remains authoritative for controls not exercised here. Remaining NOT TESTED items include Solana network/preflight/filter/export/wallet workflows; RH shares, movers and exact-contract success; forced error/retry states outside Terminal and RH; full cross-route keyboard traversal; and mobile viewport behavior. The in-app browser surface exposed no viewport override, so mobile checks could not be run. Some downstream providers, wallet flows and production-only live intelligence require external dependencies or authorization. Screenshot review and integration tests do not qualify those journeys.

### Owner review packet and guarded release sequence

1. Review the integrated draft candidate at the exact SHA above and verify the five source heads and merge provenance in this table. Keep the PRs' original reviews/history intact.
2. Keep the RH SIGKILL investigation separate. Use [the Render support brief](render-postgres-sigkill-support-brief.md) for the missing sender/resource evidence; PR #26 fixes circuit classification/recovery only.
3. Before release, resolve the `judgment_requests` schema gap through an explicitly reviewed migration plan and obtain an explanation or support response for the two PostgreSQL terminations. This candidate contains no migration.
4. Only after review and separate authorization, use the exact approved candidate SHA in the normal protected release process. Do not merge/deploy from this qualification run. After a later approved release, verify deployed SHA and perform safe RH and canonical-check reads; keep payment/browser and mobile states marked unqualified until their requirements are actually met.

**Current decision remains HOLD public announcement.** The live RH 503 and unexplained PostgreSQL termination/schema state are release blockers; the Terminal UI's inability to continue a payment-required response is a demonstrated journey failure. The untouched production boundary and all explicit NOT TESTED matrix rows remain part of this decision.

## Final qualification update — 2026-11-04

This section supersedes earlier statements above where they say the payment-required browser path, successful issued-receipt browser flow, mobile viewports, or clone schema are still untested. It does not supersede the live RH failure or the separate PostgreSQL SIGKILL investigation.

### Current baseline and production boundary

- Independently rechecked remote `main`: `199831137bce4e478dc791cf7639c0c3fd8957df`.
- Render service `srv-d7u6kjhkh4rs738hjbgg` is still on branch `main`; latest live deploy `dep-dbl10jugekts73fcvif0` is also `199831137bce4e478dc791cf7639c0c3fd8957df`. `autoDeployTrigger=off`, PR previews off. No deploy was triggered.
- The production RH 503 remains an announcement blocker. The local clone and memory fixture are not substitutes for production RH recovery or a root cause for either SIGKILL.
- No production database write, migration, settings change, wallet prompt, payment, signing key use, or transaction broadcast occurred.

### Clone schema and PostgreSQL-backed candidate check

The authorized Render clone `radar-pr24-migration-rehearsal-20261103` is database `infopunks_pay_sh_radar_db_uxh6` (`dpg-dbl177mgekts73fde8s0-a`). On the clone only, migration `migrations/20261007_012_judgment_requests.up.sql` was applied. Migration 011's receipt tables were already present. The required objects now resolve: `public.judgment_requests`, its `observation_receipts_judgment_scope_idx`, and `public.rh_chain_snapshot_cache`. Read-only verification after the rehearsal found zero `judgment_requests` rows and zero `observation_receipts` rows; no copied rows were updated or deleted.

The earlier clone rehearsal omitted migration 012 because it was scoped to PR #24's reliability change, whose reviewed diff contained no migration. It therefore copied the schema state without applying the later journal dependency. The SIGKILL investigation remains separate.

The actual frozen candidate backend connected to this clone. A valid read-only qualification check returned HTTP 200 with canonical `insufficient_evidence`, charge `0 USDC`, `payment_required=false`, and `receipt=null`; that path did not create a judgment journal entry. `GET /v1/rh-chain` returned HTTP 200 from the PostgreSQL-backed RH desk. A follow-up read-only count still showed zero journal/observation rows.

### Terminal approval and receipt flow

The product decision is explicit in-browser wallet approval. The smallest Terminal patch adds a disclosed approval step, binds approval to the unchanged check request and idempotency key, rejects unsupported or mismatched x402 quotes, locks the form while signing/submitting/reconciling, clears stale results, and offers a canonical receipt link plus a verification link only after the backend supplies a canonical receipt. The existing cyan layout and terminal structure remain intact.

The browser used the actual local Vite frontend on port 5173 and actual `createApp` backend on port 18788, with a disposable in-memory store and synthetic reviewed evidence. The injected wallet used a disposable fixture private key to produce an EIP-712 test signature; the facilitator was a local simulation that denied the first authorization, accepted the retry, and returned a synthetic settlement reference. These were fixture signatures and simulated settlement only; no real wallet extension/prompt, real facilitator, funds, or chain transaction was involved.

| Browser journey | Observed evidence | Status |
|---|---|---|
| No evidence | Actual local Terminal POST returned 200; displayed `insufficient_evidence`, charge `0 USDG`, no receipt. | PASS |
| Rejected request and stale-result clearing | Negative budget produced actual HTTP 400; the previous result cleared and the validation/API error appeared. The form could be corrected and submitted again. | PASS |
| Quote disclosure and user choice | Actual 402 challenge displayed `0.01 USDG`, `eip155:4663`, token, recipient and 120 second authorization window before requesting a signature. | PASS |
| Facilitator rejection and recovery | First fixture EIP-712 signature returned HTTP 400 `invalid_payment_signature`, no settlement. A second explicit wallet approval retried; HTTP 200 displayed canonical `proceed`, `0.01 USDG`, and a canonical receipt. | PASS, simulated payment |
| Receipt access and verification | Terminal links opened `/v1/receipt-spine/judgment/:id` and `.../:id/verify`; both returned 200. Ancestry, issuer signature, and validity checked true; `execution_authorized=false`. | PASS, fixture issuer |
| Wallet denial | Injected provider returned EIP-1193 code 4001; no `PAYMENT-SIGNATURE` POST followed. Quote remained available for another explicit attempt. | PASS, fixture wallet |
| Cancel during pending wallet authorization | Browser cancelled while `eth_signTypedData_v4` was held pending, then released the fixture signature. No signed payment POST occurred; payment panel closed and check form re-enabled. | PASS, fixture wallet |
| Cross-tenant receipt denial | Current canonical judgment GET and verify APIs are public read endpoints; no private or tenant-isolated receipt-read contract exists. Anonymous read returned 200. | NOT APPLICABLE to current public API; no isolation claim |

Historical route receipt identifiers remain separate from the canonical receipt ID. The canonical receipt link points through the configured API origin. The payment UI does not claim that settlement authorizes execution.

### Remaining control checks and mobile evidence

Browser viewport runner: Playwright/Chromium, actual local frontend/backend. At 390×844, `/`, `/solana`, `/rh-chain-signal-desk`, `/economic-os/overview`, `/receipts`, and `/developers` each rendered with `documentElement.scrollWidth=390` and no horizontal overflow. A keyboard Tab reached a link on each route. This is a basic mobile/keyboard pass, not full keyboard qualification. Homepage evidence disclosures and their expanded state retain the earlier keyboard test.

| Surface/control | Result and limitation | Status |
|---|---|---|
| Solana preflight | Actual local `POST /v1/radar/preflight` returned 200. With the exercised synthetic request, no candidate was accepted and no external paid route executed. | PASS for local preflight response; provider execution NOT TESTED |
| Solana route comparison | Selected two displayed candidates; Compare enabled. A concrete comparison result was not independently asserted. | NOT TESTED for comparison result |
| Solana JSON export | Export control opened a new browser tab at `/v1/radar/scored-catalog`; fixture JSON rendered with `source.mode=fixture_fallback`. It is a read-only fixture export. | PASS for JSON export; other JSON/CSV exports NOT TESTED |
| Solana trust/search filters, route-mapping filters, network switch, clipboard/evidence-ledger copy, wallet actions | Controls were inventoried. This run did not establish state changes for all of them. Clipboard activation stalled in the automation context; no clipboard success is claimed. Wallet/chain actions were not invoked. | NOT TESTED |
| RH direct page and local supporting APIs | Direct local page and refresh rendered. Actual local calls to `/v1/rh-chain`, review queue, 4663 index, daily receipts, Meme Pulse, Today summary, launch surfaces, live snapshot, and provider-status endpoints returned 200 on the clone-backed server. The local content remains fixture/stale and does not qualify live RH intelligence. | PASS for local read paths; live route remains FAIL |
| RH Brief/Analyst and Meme Pulse search/filter | Brief/Analyst and Cards/Analyst controls were exercised. Existing PR #29 selector tests and prior browser evidence show HOOD search and Reviewed empty state filtering correctly; this local fixture run showed HOOD but did not independently establish each filtered row set. | PASS for PR #29 regression evidence; broader filters NOT TESTED |
| RH exact-contract check, receipt sharing, movers/Today links, review actions | Current fixture reports `Contract unavailable`; no successful exact-contract record exists. No share/submission/review mutation was performed. | NOT TESTED; exact-contract external data unavailable |
| Economic OS, Proof, Developers | Pages rendered at mobile size without overflow. Existing local schema/example contract evidence from PR #27 remains valid. No production POST or proof mutation; not every linked destination was opened in this pass. | PASS for page presentation; all linked workflows NOT TESTED |

Screenshots: [Terminal with issued fixture receipt](screenshots/terminal-paid-receipt-desktop.png), [mobile payment cancellation](screenshots/terminal-payment-cancel-mobile.png), [Solana mobile](screenshots/solana-mobile.png), [RH desk mobile](screenshots/rh-desk-mobile.png), [homepage mobile](screenshots/homepage-mobile.png), [Economic OS mobile](screenshots/economic-os-mobile.png), [Proof mobile](screenshots/proof-mobile.png), and [Developers mobile](screenshots/developers-mobile.png). The captures show the existing cyan style; no redesign was made.

### Checks and owner decision

- Combined affected suites: 12 files passed, 118 passed, 1 skipped. This includes Terminal correctness, payment quote/signing, receipt issuance/verification, PR #27 documentation examples, PR #28 homepage wording, PR #29 RH filters, and database circuit regression suites.
- `npm run typecheck`: passed.
- `npm run build`: passed; the existing large Radar client chunk warning (>500 kB) remains.
- `git diff --check`: passed.

The remaining public-announcement blockers are: (1) live RH desk 503 after the missing-schema/circuit episode, (2) unexplained PostgreSQL SIGKILL sender/resource cause and production schema confirmation, and (3) no real external wallet/facilitator qualification. Solana provider-dependent execution, the rest of the export/filter/clipboard controls, RH exact-contract/share/review actions, and full cross-route keyboard coverage remain explicitly NOT TESTED. This is not an end-to-end qualification of the entire application.
