# IPX frozen candidate validation — 8 October 2026

Candidate source: `d9065dc1682a22fc73c87b0d2a63bc4f0229e235` on `codex/ipx-integration-candidate`. The worktree was clean after validation; shared `main` remained `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`. This evidence branch only stores logs and the gate assessment; it is not a new application candidate. No production mutation, deployment, contract call, transfer, or live signer use occurred.

## Reproduction and results

| Check on d9065dc | Result | Evidence |
| --- | --- | --- |
| Node/npm/Forge/PostgreSQL | v25.6.1 / 11.9.0 / 1.5.1 stable / 14.20 | Recorded command outputs. |
| `npm run typecheck` | PASS | `runs/ipx-d9065dc/typecheck.log.gz` |
| `npm run lint` | PASS | `runs/ipx-d9065dc/lint.log.gz` |
| `npm run build` | PASS; Vite large-chunk warning | `runs/ipx-d9065dc/build.log.gz` |
| `CANONICAL_RECEIPT_TEST_URL=... ECONOMIC_ENGINE_TEST_URL=... npx vitest run --maxWorkers=4 --testTimeout=30000 --reporter=dot` | 268 files PASS; 1,895 tests PASS, one skipped | `runs/ipx-d9065dc/full-suite.log.gz` |
| `forge test` from `contracts/` | 6 PASS, zero failed/skipped | `runs/ipx-d9065dc/foundry.log.gz` |
| All 21 `.up.sql` migrations in order on disposable PostgreSQL schema | PASS; 46 tables, six immutable triggers across acceptance/quarantine/free-attempt tables | `runs/ipx-d9065dc/migrations.log.gz` |
| Disposable backup/restore | PASS: 46 tables restored and one immutable free-attempt fixture retained its hash | `runs/ipx-d9065dc/restore.log.gz`; dump SHA-256 `dd41ee5af9fa5b7148068bcbef200d0d665b919cb0ea1e243bb3e0ba5968bb29` |
| `git diff --check`; clean tracked worktree | PASS | Candidate checkout at stated SHA. |
| `npm audit --json` | 11 findings: 8 high, 2 moderate, 1 low. `npm audit --omit=dev` reports 7 high, 1 low. | JSON snapshots in `runs/ipx-d9065dc/`. Findings require review before G4. |

The full test run used a disposable local PostgreSQL 14 cluster at localhost:55465. It did not exercise production application-role grants or a restored staging dataset. Application tests use the same lockfile hash as the existing A3 dependency install: SHA-256 `9e9cfa70a4a439e96b4324ca4fbe28726d6883c25f68cbbcd187bf357fff203c`.

The Foundry run used a local copy of the repository-documented OpenZeppelin 5.4.0 source. Its canonical file-tree fingerprint was `4a03aea8c7d6ccf1129a6c4d89b7f8bc493f6befdeb3df83e5d85cef44a24606`; source and candidate copies matched byte for byte. A fresh pinned Git clone was attempted but interrupted after a slow transfer. The repository setup script pins commit `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0`; independent network retrieval of that pin remains a release reproducibility check.

Migration SHA-256: 011 `78759614ada801c801920410d5010f6fcb6ec1c563a1974cba836ea3c8ba551f`; 014 `d6f033ee13d73b36477c080d3b38cc6c343cf5bf8f5c64a00373ee2573afbec3`; 017 `77583eea4504ce611737f8f73f94172309229378bceefb21068752ee07e6f364`; 020 `4f72db8131c5b3620254a9c8ac52e761397296ec3b581440b69f36ad7da55be7`; 021 `64cb87863e6f6a425e60aea8145a943a39eb058d0e1dcc0368df8616a39e7989`. Build SHA-256: `dist/server/server.js` `d544f80088043ffab7876ebeb1fb6baea5bd60d5eb6b797bdee7c1df5f150a71`; `dist/client/index.html` `6dbe2042c8b2acd243ee4757ca76e5028cd9e0473aab60cb0a6f7e17c9242355`.

`runs/ipx-d9065dc/checksums.sha256` hashes every stored log and audit snapshot. Re-run the listed commands on the source SHA and compare counts, migration hashes and source outputs. The logs are evidence of local execution only.

## Deployment observation and recovery boundary

A read-only GET to `https://radar.infopunks.fun/health` at 2026-10-08 16:33:17 UTC returned HTTP 503 with `x-render-routing: suspend`. The response does not establish why the route is suspended. Inspect the actual Render service state, events and deployed revision through authorized operator access; then follow `docs/render-production-runbook.md` and `docs/rh4663-production-runbook.md`. No service resume or deployment was authorized or attempted. The candidate has no identified production deployment or approved policy hash.

## G0–G6 matrix on this candidate

| Gate | Status | Missing or adverse evidence |
| --- | --- | --- |
| G0 | BLOCKED | No genuine externally reviewed O→J1→X→E→J2 route or finalized source output. Synthetic signed witness tests count zero. |
| G1 | BLOCKED | Local public tape and offline verifier exist, but no healthy public deployment, external manifest mirror, real-route coverage or measured improvement series. |
| G2 | BLOCKED | No written model choice, signed allocations/rates/cost policy or owner approval. D1/D2 are decision support. |
| G3 | BLOCKED | Canonical assets, deployed bytecode, funded two-way venue, executable quotes and facilitator capability are unverified at one finalized block. |
| G4 | BLOCKED | Independent financial-contract/security and legal review, authority/rights sign-off and audit-finding disposition are missing. Eleven npm findings need triage. |
| G5 | FAIL for observed live health; BLOCKED for candidate release | Public service returned 503. Candidate is not deployed; production role, staging migration, restore and rollback drills are not evidenced. |
| G6 | **BLOCKED** | G0–G5 do not pass for one code SHA, approved policy and identified deployment. |

C6 real economic flow, D3/D4 activation, production signing and transfers remain operator gated. D5 needs independently verifiable finalized economic lineage and legal/permissions closure. The economic dependency register explicitly includes B3/B4, C6 and D5.
