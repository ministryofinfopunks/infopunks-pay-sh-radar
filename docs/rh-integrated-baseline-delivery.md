# Integrated 1B / Category baseline

Code and local PostgreSQL integration: **PASS**. Staging and production: **HOLD**.

Qualified integrated source is `f128d4fa70076cee513745efaad7b0fd120fa9c4`; its code tree equals Category qualified source `955dd214301f38dabf5b050ac9ae2d2b36559eea`. Qualified 1B `59aa25bd28a6e001fa52fbfa8f13eea2e3d04eac` is an ancestor of report-only candidate `7effafb37f3f8aebd529ad13e90d87222189ba05`, the exact common ancestor with Category. Category was fast-forwarded into new isolated `codex/rh-daily-return-integration`; all original worktrees and refs are preserved. No remote merge, push, deployment or configuration change occurred.

`evidence/rh-integrated-baseline/ancestry.json` pins ancestry, delivery report hashes and changed files. `branch-migration-ledger.json` inspects every local branch and migration hash, including migration/integration candidates affecting the stores. Baseline has 18 migrations. Category adds none and consumes qualified 1B raw snapshots, history and Movers; it introduces neither collection nor scoring/publication authority. Other integration branches remain unqualified inputs and were not incorporated.

Combined full suite: 1,995 passed, zero failed, two optional PostgreSQL cases initially skipped. The separate explicit local URL run passed all 17 cases in those two files, including both formerly skipped cases. Effective coverage: all 1,997 cases executed and passed. Typecheck, lint, server/client builds PASS. Evidence files preserve actual output. PostgreSQL 14 is a disposable localhost-only cluster at port 55463; tests own isolated schemas. No live provider qualification is claimed.

The baseline Radar app bundle measures 1,294.70 kB minified / 247.85 kB gzip and retains the >500 kB warning. Category fixtures, source links and prior synthetic desktop/mobile evidence are inherited; staging still requires real provider and network/mobile checks. Durable change events currently commit separately from the version counter; 1D must close that failure window.

Rollback to 1B `7effafb37f3f8aebd529ad13e90d87222189ba05` needs no schema rollback. All inherited activation flags remain default-off/unchanged. Protected Pulse, resolution, reputation and IPX authority remain outside Category. Qualification authorizes dependent local implementation only; public activation, external distribution, staging and production remain HOLD.
