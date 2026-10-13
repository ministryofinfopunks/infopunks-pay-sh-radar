# INFOPUNKS RADAR UI-INT3 — HOLD

2026-10-13, Asia/Colombo. Solana investigation and independent-review preparation completed within authorized local scope. **G1 remains PASS. No application redesign or backend/security/migration change. No merge, remote push, staging deployment or production release.** Solana capture defects are demonstrated and corrected in qualification code; baseline replacement and independent/human approvals remain HOLD.

## Frozen subject and evidence

| Subject | Full SHA / disposition |
| --- | --- |
| Qualified application | `e0315314264fff395f8e84b37bb6f1984d6b39e7` — unchanged |
| Visual approval evidence | `d3d0a445ec20e8c55170c2fc1f52aff220b2a851` — direct child of candidate;28 documentation/evidence files only |
| Approved source used for paired rebuild and prior full tests | `35f2e54a288311d1df0f8820dacb216c27175791` —680 checked application/test/asset/config files identical to candidate |
| Secure integrated baseline | `2c2fe64db173c63048e70353ae926aa199792d1b` —292 protected non-web source/SQL files identical to candidate |
| UI-INT3 qualification-code commit | `b7f477cff624404a230c2a9ea921f09c2ca2dcd5` —two QA scripts only; no new application candidate |
| Original integration branch | `codex/radar-terminal-secure-integration` at d3d0a44; initial clean checkout preserved |
| Isolated delivery branch | `codex/radar-ui-int3-qualification`; subsequent docs-only evidence commit; see [commit attribution](commits.md) |
| Shared main | `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`; existing untracked docs/robinhood-stack-inventory-2026-10-12.md untouched |

[Freeze record](evidence/freeze.json), [runtime hashes](evidence/runtime-inventory.json), [protected hashes](evidence/protected-inventory.json), [QA code attribution](evidence/qualification-code.json). All existing golden references and approval hashes were checked and preserved. The original UI-INT2 report at the evidence commit was read before modification. Its pending holds were Solana full-page comparisons, independent security/migration review, human AT/device/native zoom, legacy unavailable-state usability, candidate Linux/container CI and operational staging authorization. Their exact affected files/test assertions are in the packages below. The reported G1 PASS is the completed approval record, not the earlier e031 report's pending checkpoint.

## Solana root cause and correction

**Classification B: nondeterministic/incomplete capture plus an empirically demonstrated tall-raster capture defect.** No source layout regression between approved source and candidate is demonstrated: their application/test/asset bytes are identical, and paired settled DOM/text/grid/flex/font/section geometry matches exactly. No intentional new product/security feature explains this difference; no fixed height, overflow hiding, content removal or theme change was applied.

1. The original harness waited for `main h1` plus 1.4s and fonts, then captured the entire page. Solana starts from `/v1/pulse`, loads three enrichment stages, selected-provider detail/monitor data, and later ledger/readiness data. Heading visibility is not completed-data readiness. The approved **desktop** PNG shows `EVIDENCE LEDGER UNAVAILABLE`; the completed controlled capture shows actual fixture counts. First changed pixels against the historical image occur at row1906 in time-dependent ingestion metadata. The first demonstrated content-layout boundary is `.proof-metrics-strip` inside `.solana-orientation-summary`: delayed versus settled desktop125→76.890625px; mobile59→305.453125px, at unchanged top coordinates. Other async sections subsequently expand. [State/section deltas](evidence/visual/layout-state-deltas.json) record exact geometry, content and document heights. Controlled delayed trials reached25690→29946px desktop and48469→62733px mobile under the same responses/source.
2. Both approved Solana PNGs repeat their top raster after **16,384 rows**. All 250 sampled row pairs are exact repeats at that offset, desktop and mobile. This is absent from corrected bounded-tile captures (0/250 repeats). The DOM contains one page; these duplicate pixels are a capture-path defect, not duplicated application content. The old images do not show the real final footer. [Capture integrity](evidence/visual/capture-integrity.json) documents the empirical defect; a generic browser root cause beyond this measured behavior is not asserted.
3. The historical desktop height25390 versus prior30701, and prior mobile62733 versus62758, were captured without saved DOM/API traces. It would be unsound to assign every historical pixel of height drift to a particular late response or wrapped timestamp. These old comparisons are **not retrospectively marked PASS**. Stable corrected references are proposed explicitly, rather than changing the application to fit an unreproducible capture.

The original harness was rerun unchanged except a new output-directory override: [original results](evidence/original-harness/results.json), exit 1. Eight non-Solana full-page comparisons still have zero threshold pixel drift. Mobile Solana happened to match height and fit the old tolerance this time, illustrating the prior timing variability; its repeated lower raster makes that insufficient full-page proof.

The new `scripts/qualify-ui-int3-solana.cjs` uses96 immutable anonymous local responses, including three intercepted non-executing bundle-plan POSTs. Unsupported paths/methods fail; external requests are blocked. Reference35f2e54 and candidate e031/d3 were rebuilt with identical dependencies/environment, then captured with Chrome 155.0.8059.40, scale 1, same system fonts, locale en-US, Asia/Colombo timezone, fixed Date, reduced motion, empty anonymous context and scroll 0. It waits for fonts/images, five identical DOM/layout samples, no pending fixture responses/busy controls, and unchanged layout after capture. 4096px bounded clips are stitched at the original viewport without masking or resizing page content. Both widths run twice for each subject, including 1800ms delayed ledger delivery. All eight corrected captures include the final footer; lower-page evidence was visually inspected. Tile coordinates/hashes and measured sections are saved. [Detailed comparisons](evidence/visual/results.json), [environment](evidence/environment.json).

| Corrected comparison | Size | Result |
| --- | --- | --- |
| Approved source ↔ candidate, desktop |1440×29946 |Identical settled DOM; zero pixels above24-level threshold |
| Approved source ↔ candidate, mobile |390×62733 |Identical settled DOM; zero pixels above24-level threshold |
| Repeated/delayed desktop source/candidate |1440×29946 |Identical settled DOM; maximum threshold drift1 pixel in43,122,240 pixels |
| Repeated/delayed mobile source/candidate |390×62733 |Identical settled DOM; zero threshold drift |
| Historical approved desktop ↔ corrected candidate |25390→29946 tall capture |HOLD; completed data and corrected raster require scoped reference approval |
| Historical approved mobile ↔ corrected candidate |62733px unchanged height |HOLD;11.53% threshold drift because lower raster is now real content |

These use the unchanged UI-INT2 acceptance policy (same dimensions and≤0.5% pixels differing by>24 levels) **plus exact settled DOM equality**. Small subthreshold raster differences exist; byte/pixel identity is not claimed. Paired reproducibility passes that policy. G2 remains HOLD because no baseline change is authorized. [Scoped review](review-solana.html), [two proposed files and exact PNG hashes](solana-baseline-proposal.json). Approval concerns only completed Solana desktop/mobile captures; the homepage/global identity is not reopened and existing references remain immutable.

## Independent packages and human qualification

- [Security review](security-review.md): exact candidate/baseline, changed boundary inventory, focused and complete diffs, tenant/session/private/public proof/payment/Judgment/error/proxy/rate boundaries, 244 relevant assertions across 25 files, advisories and reproduction/checklist. All protected source unchanged. Separate proxy-spoof and distributed limiter/topology checks remain explicit reviewer work. Fresh npm audit reports 0 production findings and 1 low esbuild development advisory; [vendor advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) and proposed containment are documented, not independently accepted.
- [Migration review](migration-review.md): all 22 up/down checksums, actual fresh applied ledger/order, clean/repeat/concurrent/adoption/failure/drift tests, 95 relevant assertions across 14 files, immutable receipt/ownership/evaluation authority, backup/restore/cryptographic replay. PostgreSQL 16.15; no migration changes. 22 ledger rows, valid signature/ancestry, identical projection/tape/receipt hashes and exact replay after restoration. Actual deployed role permissions/ledger/RPO/RTO remain unverified.
- [Manual accessibility/device package](manual-qualification.md), [60 result records](manual-results.json): Safari/Chrome, keyboard/native200/400% zoom, focus/menu/dialogs, VoiceOver/NVDA, physical iOS/Android touch/virtual keyboard/text/orientation/reduced motion; representative Spend/Solana/Robinhood/receipt cases. Native Chrome pilot loaded labelled/password controls at inherited50% zoom; subsequent keyboard/zoom attempts were interrupted by the user-changed-app guard. No native zoom, AT audio or physical-device pass is claimed. Authorized human identities/approvals unset. Axe inconclusive results and legacy unavailable-state usability remain human review items.
- [Staging package](staging-readiness.md), [configuration template](staging-config.env.example): prerequisites, isolated identities/policies, observability, test plan, backup/restoration and compatible app rollback. Existing production render.yaml must not be applied. Controlled staging's forbidden signing/reviewer bindings and mutation gate are preserved; expected unavailable signed/evaluation operations are explicit, not bypassed.

[Review dispositions](review-dispositions.json) contain no approvals. None of these packages self-certifies independent assurance. Candidate-specific GitHub commit/check requests return 422 (`No commit found`), workflow list empty and combined status pending/zero statuses; [remote evidence](evidence/remote-candidate-commit.json), [check runs](evidence/remote-candidate-check-runs.json), [workflow runs](evidence/remote-candidate-runs.json). The prior secure-baseline CI does not transfer to this candidate. Local Docker daemon is unavailable, so no local Linux/container run is claimed. No remote push/workflow dispatch was performed.

## Tests and changed-file inventory

| Command / qualification | Result | Exact evidence |
| --- | --- | --- |
| `npm ci` with Node 24.21.0 |PASS; lockfile unchanged |ignored output/ui-int3/npm-ci.log; runtime inventory |
| `python3 scripts/qualify-unified-radar-local.py --node-bin …` with disposable localhost PG16 and UI-INT3 output/log paths |PASS; source head d3d0a44, application/test bytes identical to e031 |[commands/exits/timing](evidence/system/check-results.json) |
| typecheck, lint, production build, migration inventory |PASS |same command evidence; raw logs output/ui-int3/system |
| `npm test -- --maxWorkers=1 --testTimeout=30000 --reporter=default --reporter=json --outputFile=…` |2047 passed; 0 failed; 0 skipped; 282 files / 567 nested suites |[full summary](evidence/system/full-test-summary.json), [security](evidence/security-test-evidence.json), [migration](evidence/migration-test-evidence.json) assertions |
| `npm audit --omit=dev --json` |exit 0; 0 findings |[production audit](evidence/system/audit-production.json) |
| `npm audit --json` |exit 1 ; disclosed 1 low dev finding |[all audit](evidence/system/audit-all.json) |
| migration apply→validate→repeat |PASS;22 migrations |[first](evidence/system/migration-first.json), [check](evidence/system/migration-check.json), [repeat](evidence/system/migration-repeat.json) |
| recovery seed→pg_dump→fresh DB pg_restore→verify |PASS; exact cryptographic/projection/tape replay |[before](evidence/system/recovery-before.json), [after](evidence/system/recovery-after.json) |
| original `npm run test:ui:visuals` with isolated output |exit 1; expected desktop Solana HOLD |[original results](evidence/original-harness/results.json) |
| `node scripts/qualify-ui-int3-solana.cjs` |exit 0 paired reproducibility; G2 remains HOLD |[corrected results](evidence/visual/results.json) |
| `node scripts/qualify-ui-int2-routes.cjs` with eight representative routes |56 viewport checks across 320/375/390/430/768/1024/1440; no route errors, overflow or axe violations |[new route summary](evidence/routes/summary.json); individual incomplete axe nodes retained |
| `node --check scripts/qualify-ui-int3-solana.cjs`; `git diff --check` |PASS |local validation; qualification code pinned in b7f477c |

[Reproduction](reproduction.md) gives complete safe commands, environment, client/server source attribution and fixture rules. The full system test command was executed before committing the new capture harness, using unchanged qualified d3 application/tests; the new QA script was separately executed and syntax-checked. There is no reason to relabel unchanged source tests as a new application qualification. Earlier UI-INT2 route 973, authenticated tenant journeys, laboratory performance and protected-boundary PASS results are retained in their stated scope. New screenshots do not claim live settlement, benchmark superiority, production performance or human accessibility.

Exact [UI-INT3 changed files](changed-files-ui-int3.txt) and [integrated changes versus secure baseline](evidence/changed-files-vs-secure-baseline.txt). UI-INT3 modifies only `scripts/compare-ui-int2-visuals.cjs` (output override), adds `scripts/qualify-ui-int3-solana.cjs`, and adds this report/review/evidence package. Application source, tests, dependencies, migrations, assets, canonical tokens and approved reference files are unchanged. Exported .diff artifacts retain exact Git context-marker spaces; evidence/.gitattributes scopes the whitespace-check exception to these raw patch artifacts only. Ordinary source/docs retain normal checks. Raw diagnostics/dumps stay ignored under output/ui-int3; portable evidence is committed with checksums in [evidence manifest](evidence-manifest.json).

## Gate matrix and remaining blockers

[Machine-readable matrix](gate-matrix.json); statuses refer to this exact frozen application subject, not another branch or production deployment.

| Gate | Status | Exact basis / remaining condition |
| --- | --- | --- |
| G0 Candidate/evidence |PASS |freeze.json; direct ancestry; unchanged runtime; clean original integration |
| G1 Canonical visual approval |PASS |existing explicit completed approval and preserved hashes; unchanged identity |
| G2 Solana full page |HOLD |paired correction verified; two corrected reference PNGs need explicit scoped approval |
| G3 Security review |HOLD |package/automated evidence ready; authorized independent exact-SHA approval absent |
| G4 Migration review |HOLD |local compatibility/restore PASS; independent/operational approval absent |
| G5 Human accessibility |HOLD |manual package; human keyboard/AT/native zoom/contrast/focus acceptance missing |
| G6 Real devices |HOLD |physical iOS/Android input/touch/orientation testing and acceptance missing |
| G7 Full regressions |PASS, local scope |2047/0/0; unchanged test subject; Linux/container remains required for staging, unclaimed here |
| G8 Staging readiness |HOLD |G2–G6, candidate Linux/container CI and isolated operator configuration/role/backup review open |
| G9 Staging authorization |HOLD |explicit deployment approval absent; not requested until prerequisites satisfied |

**Decision: HOLD.** Required next human actions: scoped Solana capture approval; independent security and migration decisions; authorized accessibility/real-device results. Required operational actions: make the exact candidate available for reviewed CI, complete Linux/container qualification and isolated staging configuration/rollback/restore review. These are not inferred from the 2,047-test total. Formal staging authorization must be requested only after mandatory prerequisites pass. This report introduces no merge, deployment or release approval.
