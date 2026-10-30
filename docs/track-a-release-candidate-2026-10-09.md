# Track A release candidate: integration and staging record

**Status: HOLD.** This is a local release candidate, not a production sign-off. No deployment, production migration, DNS change, funded transaction, or production credential access occurred.

## Frozen candidate and branch reconciliation

Candidate branch: `codex/track-a-release-candidate`. Foundation: `origin/main` at `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` (`codex/track-a-launch-baseline` points to the same head). The candidate selectively applies reviewed commits `1c06aa2`, `745c98c`, `c56ca7e`, `37399ee`, and `094826f` for committed decision context, verified-execution score eligibility, accepted-history classification, and causal witness replay. IPX Genesis contracts, token launch operations, financial-contract authority, and optional model-spend influence were not cherry-picked.

Remote heads captured after `git fetch --all --prune` on 2026-10-09:

| Branch | Head | Reconciliation |
|---|---|---|
| `main` | `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` | Selected Track A foundation; already contains `codex/radar-phase6-integration`. |
| `codex/radar-phase6b1-preflight` | `d0d6081cbb9e965571dda53d268c9cfddf35d6b2` | Includes Phase 5/6 validation additions and staging preflight; its integration changes are already ancestral to the selected line. |
| `codex/radar-phase6-integration` | `b640edfafc1e30e20309d0441e1153da3688faea` | Ancestor of current main; no separate merge needed. |
| `codex/ipx-a2-decision-context` | `c56ca7e60efafb68a792223a173c2840cd274c50` | Diverged from pre-IPX main. Selected only decision context and execution eligibility commits. |
| `codex/ipx-a4-a6` | `094826f12a7ca94362a60cd80f78e6b5b62d68c6` | Contains Track B material alongside accepted-history and causal replay fixes; only the relevant commits were cherry-picked. |
| `codex/decisions-integration-candidate` | `3a93867e0d8d36be4977166bcd6fba40ac9e2325` | Shadow adapter and test harness; non-authoritative optional model path, excluded from Track A decision authority. |
| `codex/decisions-labeled-corpus` | `b8ea7ccaa5b7c9d96425bd0bb11a73e0288fa65d` | Qualification corpus and shadow benchmark; synthetic/policy-derived, not production feedback. |
| `codex/decisions-live-benchmark` | `ee32dbf121bc6a705910b8802bdb1b840ff56211` | Reserves benchmark report and live qualification runner; no reviewed benchmark evidence. |
| `codex/decisions-real-evidence-qualification` | `a52a6b4cc140ada3312170f068cf940bcbead8b5` | Independent evidence-gate/report tooling; reports real-evidence gates blocked. |
| `codex/decisions-e1-evidence-readiness` | `32bcf68104d70e478706bb8fff92c91c4b2308b9` | Latest E1 readiness and prospective cohort records; evidence recovery and independent review remain external dependencies. |

The candidate’s file overlap is concentrated in `src/api/app.ts`, `src/api/openapi.ts`, `src/services/judgmentService.ts`, receipt persistence/authority, schemas, and migration numbering. Decisions branches also touch the judgment service, app/config, SDK-adjacent interfaces, tests, and docs; their model adapter remains excluded to preserve deterministic authority. The IPX branch changes the same receipt spine, derived-score policy, canonical schemas, and migration range while adding unrelated contracts, accounting, launch, and treasury surfaces. Cherry-picking whole branch tips would overwrite or widen authority. The selected commits preserve main’s prior receipts and add migrations 018–021 in timestamp order after existing 016–017. No migration was reordered or applied.

## Migration inventory and staging controls

Repository migration files are numbered 001–021 with gaps in the current visible listing; the code-backed readiness inventory currently checks only 001–010, 011, and 016. It does **not** inventory 012–015 or 017–021, including candidate migrations 018–021. This makes its `pending_migrations` output incomplete and blocks staging approval. `migration_runner` is `external_only`; application startup does not run DDL. Database was not configured for this local run, so every inspected schema is unknown, not proven pending/applied. Before staging, reconcile every `.up.sql` and `.down.sql` to a reviewed ordered ledger, include checksums and applied timestamps in a dedicated ledger, rehearse forward upgrades on a disposable PostgreSQL database, and keep execution operator-controlled. Do not infer applied state from missing objects alone.

| Area | Staging setting/requirement | Initial state |
|---|---|---|
| Database | `DATABASE_URL` over Railway private networking; TLS/role policy per operator; persistent PostgreSQL backup configured | Not configured/verified |
| Catalog | `PAY_SH_CATALOG_URL`, source and ingestion settings; live freshness probe required | No live staging endpoint checked |
| Payment | `JUDGMENT_PAYMENT_ENABLED=false`; facilitator URL, pay-to, resource, issuer and signing values withheld/unset | Disabled |
| Execution | External proof RPC settings only; no transaction broadcast/signing key in Radar | No execution enabled |
| IPX | `IPX_LAUNCH_POLICY_PATH` unset; Solana watch configuration omitted; Genesis disabled | Disabled |
| 4663 publication/anchors | Phase 2/3 publication and anchor flags/keys unset; rehearsal/shadow only | Disabled |
| Storage | PostgreSQL durable mode required for readiness; backup/restore receipt replay evidence required | Not verified |
| Observability | JSON structured request events exist; staging must wire health alerts for readiness, DB, catalog age, payment ambiguity, signature/replay and error rates | Alert receiver not configured |

Staging sequence: build the repository Dockerfile; create an isolated Railway staging service and private database; boot with payment/signing/execution/publication flags off; verify `/healthz`, `/readyz`, catalog timestamps and durable storage; apply reviewed migrations through the operator ledger only; take a backup and restore to a separate database; compare canonical receipt JSON, signatures and replay results; then perform non-funded mock-facilitator payment tests. Roll back application image first. Database rollback is not automatic: use forward fixes for append-only receipt schema and restore the pre-upgrade snapshot only with operator approval and explicit data-loss review. Do not run down migrations against populated receipt history.

## Paid judgment path and feedback boundary

`POST /v1/pre-spend/check` remains the primary entry point. The path is strict canonical request/schema validation → currently qualified materialized evidence → versioned deterministic policy/judgment → committed decision context → insufficient-evidence free result or x402 V2 challenge → payment facilitator verification and durable idempotency journal → signed canonical receipt → retrieval and integrity/signature verification. Existing journal behavior is designed to avoid resettlement on identical retry and to leave uncertain settlement pending operator reconciliation. The configured payment/network implementation is not equivalent to verified Solana settlement; prior validation says there is no live verified settlement network. SDK/OpenAPI coverage exists in the baseline but staging negotiation, live facilitator compatibility, production issuer key coverage, and payment replay need environment-backed verification. Use mock settlement only in CI/staging.

Knowledge feedback is gated as Observation → Judgment → verified Execution → independently reviewed Evaluation → later Judgment. An integrity hash proves bytes, not source truth; a facilitator attestation is not task success. Execution must be externally settled and task/output evidence independently reviewed before an evaluation can alter qualified precedent. Accepted-history classification and causal replay commits are included, but production-grade external evidence, independent reviewers, public bundle hosting, and real replay on durable PostgreSQL have not been validated here. Synthetic fixtures remain tests only.

### Prospective Level 3 evaluation preregistration

Before collecting outcomes, publish a timestamped protocol and hash: (1) freeze eligible evidence, policy/model version, route universe, and a fixed prospective enrollment window; (2) define qualified feedback before outcomes, excluding fixtures, self-claims, disputed/expired artifacts, and incomplete settlement/task proofs; (3) run paired deterministic judgments for each eligible request, one with the frozen qualified-history snapshot and one without it, blinded to later outcome; (4) define one primary endpoint in advance (decision utility under independently reviewed task success/cost labels) plus calibration, abstention, and safety-veto secondary endpoints; (5) set minimum cohort size and stopping date before enrollment, with no interim significance peeking; (6) use an independent blinded reviewer and adjudication procedure; (7) retain all request/evidence/context/policy hashes and publish exclusions, disagreements, confidence intervals, and a reproducible replay bundle; (8) prohibit promotion unless the preregistered comparison passes and security/replay audits pass. No statistical improvement is claimed by this candidate.

## F1–F7 remediation snapshot

The repository does not expose a single authoritative F1–F7 issue register. Based on the release requirements and branch evidence, the current status is:

| Gate | Status |
|---|---|
| F1 Canonical pre-spend / deterministic judgment | Implemented in baseline; candidate adds immutable decision context v2. Needs full frozen-SHA regression and qualified live evidence check. |
| F2 x402 payment and no double charge | Implemented with V2 flow and durable journal; payment disabled by default. No live facilitator or funded settlement verification. |
| F3 Signed receipt history | Canonical receipt spine and immutability guards exist; preserve legacy signatures. PostgreSQL migration and backup/restore replay not run. |
| F4 Verified execution and evaluation eligibility | Candidate adds externally verified execution eligibility and accepted-history classification. Independent real-world evaluation corpus/review remains blocked. |
| F5 Causal context/replay | Candidate adds committed context, bounded witness and offline verification. Public independently hosted verification bundle and full negative replay suite remain to verify. |
| F6 Staging operations | HOLD: no isolated Railway environment, private DB, backup/restore, alert receiver or complete migration ledger evidence. |
| F7 Frontend/release quality | HOLD: no route-by-route desktop/mobile browser evidence, accessibility/performance report, or route regression capture on a running app. |

## Frontend, operational validation, and unresolved blockers

The frontend audit found a 14,540-line `src/web/radarApp.tsx` and a 18,616-line stylesheet alongside route-feature modules, so the requested route-level decomposition and design-system consolidation are not complete. This candidate contains no genuine browser screenshots, console/API failure log, desktop/mobile route matrix, or visual regression capture. The listed routes, responsive states, reduced-motion behavior, accessible semantics, loading/error/stale/empty states, and existing navigation still require browser QA. There is no browser screenshot to present as evidence.

Validation on the candidate before this report commit: `npm run typecheck` passed; `npm run build` passed with a 1.29 MB `radarApp` chunk warning; the first full test run reported 253 files passed, 3 files failed, 11 skipped and 4 failing tests. One failure was a stale score-projection fixture; it was updated to use a qualifying externally verified execution and classified artifact, and its focused test passed (19/19). A subsequent full rerun passed 256 files and 1,866 tests, with 11 files and 21 tests skipped. PostgreSQL was not configured (`database_not_configured`), so PostgreSQL migration-upgrade, durability, backup/restore and replay validation are unknown. Deployment probes and JSON structured request logs are present, but external alert routing and operational smoke/rollback rehearsal are not verified. The test-first failures were timeout-related under concurrent compilation/build load; they did not recur in the clean rerun.

**Exact external dependencies to clear before GO:** an operator-provisioned isolated Railway staging service and private PostgreSQL database; complete checksummed migration ledger and disposable upgrade rehearsal; approved staging-only facilitator/mock and signing configuration; live catalog credentials/source and freshness target; backup/restore operator plus storage evidence; incident-alert destination; independent evaluator/reviewer and real content-addressed evidence artifacts; an instrumented browser environment for route screenshots, accessibility and performance; and successful reruns of every failed/skipped test on the final immutable SHA. No production credentials or funded wallet are needed or requested for these checks.
