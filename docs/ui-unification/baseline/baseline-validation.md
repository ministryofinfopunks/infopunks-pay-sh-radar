# Cyan baseline validation — PASS

Selected baseline: `d3d0a445ec20e8c55170c2fc1f52aff220b2a851` on `codex/radar-subpages-ui-unification`. Source was archived before edits, so all checks ran against frozen bytes while implementation continued separately. User-selected cyan homepage is authoritative; earlier main-branch results are historical and do not qualify this source.

| Check | Result | Evidence |
| --- | --- | --- |
| Node | 24.21.0, matches package engine | `logs/runtime.log`, `baseline-validation-summary.json` |
| `npm run lint` | PASS | `logs/lint.log`, `logs/static-results.json` |
| `npm run typecheck` | PASS | `logs/typecheck.log`, `logs/static-results.json` |
| `npm run build` | PASS; existing large-chunk warning | `logs/build.log`, `logs/static-results.json` |
| `npm run check:design` | PASS, 130 router patterns | `logs/design.log`, `logs/static-results.json` |
| Targeted frontend, two workers | PASS, 9 files / 92 tests, no skips | `logs/frontend-tests.log`, `logs/test-results.json`, `logs/frontend-tests.json` |
| Full PostgreSQL-backed suite, two workers | PASS, 282 files / 567 nested suites / 2,047 tests, zero failures or skips | `logs/full-tests.log`, `logs/test-results.json`, `logs/full-tests.json` |

Full suite duration107.38 seconds (runner wall107.806). Compiler checks and suites ran sequentially, original default timeouts unchanged. Full command: `npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/radar-ui-cyan-baseline/full-tests.json`.

Runtime reused existing local Node24.21 and an already installed dependency tree after exact selected package-lock SHA256 equality: `42cc2afd6cf52d6a3b30b0af1ec74f8d4126f0aa867135204c6e4f35e4044c00`. No dependency upgrade, package/lock edit or network install. The initial reversible dependency symlinks and temporary archive were later lost when the interrupted temporary environment was cleared. Final validation restored the exact lockfile dependencies offline; see `../validation/FINAL-VALIDATION.md`.

PostgreSQL16.15 used a newly initialized disposable localhost-only cluster at127.0.0.1:55452 under the temporary baseline directory, with purpose-named databases `radar_ui_cyan_baseline` and `radar_ui_cyan_resilience`. Test variables CANONICAL_RECEIPT_TEST_URL, ECONOMIC_ENGINE_TEST_URL and POSTGRES_RESILIENCE_TEST_URL pointed only to those databases. Canonical receipt, migration, durability and real termination coverage all ran; no optional skips. Database initialization needed sandbox escalation because shared-memory operations are restricted. Test process had authorized local database/socket permission. No pre-existing or production data was used. This historical temporary cluster no longer exists; final checks used a fresh disposable cluster, subsequently stopped.

Existing Vite warning: radarApp JavaScript1,562.51kB minified /313.25kB gzip, over500kB recommendation. Existing React act environment warnings are present in component logs but no assertions fail. These are preserved baseline conditions.

Existing unrelated untracked docs/qualification was preserved. All1532 tracked file hashes are in `source-hashes.json`; control/href/event manifest in `interactive-source-manifest.json`; functionality/token mapping in `functionality-inventory.md`. Plain-text logs and result JSON above retain actual commands, exit codes and complete test assertions. The original temporary source archive is no longer present; reconstruct it with `git archive d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. Final browser controls use a fresh archive of that commit. No application source, authorization, backend/API contract or production configuration changed during baseline qualification. No deployment or merge.

Actual browser screenshots, viewport/zoom/focus/contrast and manual screen-reader qualification are separate evidence; this report does not claim them.
