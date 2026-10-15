# Baseline validation

Baseline `main` at `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`. Node v25.6.1, npm 11.9.0. All commands ran before source edits. Existing `docs/qualification/` preserved. No deployment, production smoke/load checks, or backend changes.

| Check | Result | Evidence |
|---|---|---|
| `npm run lint` | PASS, exit 0 | `lint.log` |
| `npm run typecheck` | PASS, exit 0 | `typecheck.log` |
| `npm run build` | PASS, exit 0; existing large-chunk warning | `build.log` |
| Full `npm test` | Initially 235 passed / 16 failed / 9 skipped files; 1,834 passed / 21 failed / 19 skipped tests | `test.log`, `tests.json` |
| Failed-file rerun, `--maxWorkers=2` | 15 passed / 1 failed files; 178 passed / 2 failed / 1 skipped tests; all 19 timeouts resolved | `retry-failed.log`, `retry-failed.json`, `failed-file-list.json` |
| Authorized unsandboxed process probes, `--maxWorkers=1` | 1 passed file; 15 passed / 1 existing skipped tests; both local permission failures resolved | `process-probes-unsandboxed.log`, `process-probes-unsandboxed.json` |

Initial full run took 301.94 seconds and was run concurrently with compiler commands. Nineteen failures were unchanged 5-second test timeouts; all nineteen passed when the initially failing files were rerun alone at two workers with the original timeout unchanged (17.87 seconds). Two remaining failures are pre-existing environment limitations in `tests/postgres-resilience-failure-matrix.test.ts`: sandbox prevents tsx IPC local pipe and 127.0.0.1 listener with EPERM. Authorized isolated unsandboxed rerun passed: 15 passed / 1 existing skipped tests, exit 0, 5.09 seconds (`process-probes-unsandboxed.log` and `.json`). Both sandbox EPERM cases passed. No test timeout, source or configuration change was needed.

Combining the original full run and the targeted retries: 1,855 tests passed, 19 existing optional tests skipped, no persistent failures across 1,874 tests. This is a combined baseline qualification, not a clean single full-run pass.

The full suite includes intentional optional/Postgres skips; no existing test was skipped by a new exclusion or changed test configuration. Do not describe the initial full suite as an unconditional pass. Use the retry and environmental evidence alongside the original output.

The Vite baseline warning is for chunks over 500 kB: `radarApp` JavaScript 1,285.66 kB minified / 245.56 kB gzip and CSS 417.61 kB / 74.30 kB gzip. This UI task does not authorize broader bundle restructuring.

Existing frontend tests validate behavior in jsdom. Actual browser screenshots, responsive layout, zoom, contrast, keyboard and reduced-motion qualification are separate work; no manual screen-reader testing was performed by this worker.
