# UI-INT3 reproducible local qualification

Run only on an isolated worktree; do not modify approved references. Application SHA remains e0315314264fff395f8e84b37bb6f1984d6b39e7. Evidence commit d3d0a445ec20e8c55170c2fc1f52aff220b2a851 adds only docs/screenshots. [freeze.json](evidence/freeze.json) verifies 680 runtime/test/asset files identical to the approved source 35f2e54 and e031531; 292 protected files identical to secure baseline 2c2fe64. UI-INT3 adds qualification code only.

Use Node24.21.0, npm lockfile (`npm ci`), PostgreSQL16.15 and Playwright1.64.0. QA-only `pngjs` and `randexp` live in an external runtime, set through RADAR_UI_TEST_RUNTIME. Record that runtime's versions/hash. Do not upgrade dependencies to reproduce this result. Chrome version used here is 155.0.8059.40 on macOS14.4.1 arm64; the older UI-INT2 narrative lists Chrome154 but did not bind a browser version to each approved PNG. The new paired captures use one exact installed browser binary for both sources. Fonts are the same host system fonts declared by the unchanged CSS; no webfont asset is substituted.

## Complete regression, migrations and restore

Supply PGHOST/PGPORT/PGUSER/PGPASSWORD only for a disposable localhost PostgreSQL cluster. Supply RADAR_QUALIFICATION_DATABASE_URL pointing at that cluster (without a database suffix). Never copy a production connection or signing key. The qualifier scrubs inherited credential/payment configuration, creates four purpose-named temporary databases and drops them on successful completion. If interrupted, inspect the created names before cleaning only those databases. The role needs CREATE DATABASE and local DDL/advisory-lock permissions; this is not proof of least-privilege staging roles.

```
npm ci
RADAR_QUALIFICATION_OUTPUT_DIR=docs/design-system/ui-int3/evidence/system \
RADAR_QUALIFICATION_LOG_DIR=output/ui-int3/system \
python3 scripts/qualify-unified-radar-local.py --node-bin /absolute/path/to/node24.21/bin
```

This runs typecheck, lint, build, migration inventory, the full non-skipped Vitest suite, production/all audits, migration apply/validate/repeat, seed→pg_dump→new database restore→signature/ancestry/projection/tape replay and diff check. audit-all exits 1 for the disclosed low dev advisory and is explicitly tolerated by the qualifier; audit-production passed. Portable results are under evidence/system; raw logs and the disposable dump are under ignored output/ui-int3/system.

## Original harness reproduction

The original qualified UI-INT2 preview on localhost5183 uses the protected local8812 synthetic API. Do not point these scripts at production. Hash-verify source and compiled artifacts before substituting another server.

```
RADAR_UI_VISUAL_OUTPUT=docs/design-system/ui-int3/evidence/original-harness \
RADAR_UI_BASE_URL=http://127.0.0.1:5183 npm run test:ui:visuals
```

The only edit to this original harness is an output-path override so UI-INT2 evidence remains immutable. Original behavior is preserved for reproduction: it exits 1 for the desktop Solana dimension mismatch. This reproduction is diagnostic, not a qualified completed-data capture.

## Corrected paired Solana capture

Archive approved source 35f2e54a288311d1df0f8820dacb216c27175791 into an isolated ignored reference directory, link its node_modules to the candidate's lockfile installation, then build it with the same Node/runtime/environment. Build the candidate from e031531 or evidence-only d3d0a44. Both builds here use default same-origin API resolution; offline interception supplies identical responses. No API deployment is needed.

```
mkdir -p output/ui-int3/reference
git archive 35f2e54a288311d1df0f8820dacb216c27175791 | tar -x -C output/ui-int3/reference
ln -s ../../../node_modules output/ui-int3/reference/node_modules
(cd output/ui-int3/reference && node_modules/.bin/vite build)
npm run build
```

Start separate loopback previews (separate terminals):

```
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5190 --strictPort
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5191 --strictPort --outDir output/ui-int3/reference/dist/client
```

Then:

```
RADAR_UI_BASE_URL=http://127.0.0.1:5190 \
RADAR_UI_REFERENCE_URL=http://127.0.0.1:5191 \
node scripts/qualify-ui-int3-solana.cjs
```

The frozen solana-fixture.json contains 96 anonymous local synthetic responses, including three non-executing bundle-plan POST responses. Every request is intercepted, never forwarded; unsupported methods/paths fail qualification. Credentials are absent. Fixed Date, locale en-US, Asia/Colombo timezone, device scale1, reduced motion, original 1440×1000/390×844 viewports, same browser and assets. Wait for heading + fonts + decoded images + five identical DOM/layout samples + no pending response/busy control; measure before/after capture. Run twice per subject/width, including delayed ledger delivery. Capture 4096px clips and stitch them without resizing viewport, masking, or hiding content. Output contains full-page candidates, per-element geometry/text/font/grid/flex data, tile hashes, and paired/golden comparison outcomes. It does not overwrite references or approve a baseline. Exit0 certifies paired reproducibility under the existing UI-INT2 tolerance; G2 still HOLD until human baseline disposition.

## Responsive supplemental checks

```
RADAR_UI_OUTPUT=docs/design-system/ui-int3/evidence/routes \
RADAR_UI_ROUTES=/solana,/spend-terminal,/routes,/providers,/4663,/rh-chain-signal-desk,/receipts,/proof/judgment/missing \
node scripts/qualify-ui-int2-routes.cjs
```

Eight routes × seven widths produce 56 checks. Original qualified localhost5183 compiled UI and synthetic backend were used, with unchanged application bytes. This automated route/axe check is not human AT, native zoom or physical-device approval. [Manual package](manual-qualification.md) covers those holds.
