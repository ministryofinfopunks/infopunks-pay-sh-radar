# Browser validation procedure and final evidence

The user selected the existing cyan implementation at **`d3d0a445ec20e8c55170c2fc1f52aff220b2a851`**. The UI branch is `codex/radar-subpages-ui-unification`. The initial green-homepage `main` reports under `../baseline/current-main/` are historical; they do not qualify this implementation. Current before/after evidence is exclusively in `cyan-baseline/`.

## Source and environment

The final browser suite tests the actual candidate source with Node **24.21.0**, Playwright **1.64.0**, axe **4.14.0** and installed Google Chrome **155.0.8059.40**. Dependencies match the unchanged lockfile. The backend uses development fixture data with no database URL, live ingestion, monitoring, automation, publication, paid execution or payment features enabled. Every interactive API request uses this actual local backend. No success response is substituted for interactive checks.

For strict controls, a fresh `git archive d3d0a445ec20e8c55170c2fc1f52aff220b2a851` is extracted to a temporary directory and served separately, sharing the exact candidate dependency tree. It is the original source, not a reconstructed screenshot or older recovery component. The final source and script hashes, exact commands, browser-suite timestamps, exit statuses, logs and evidence hashes are recorded in [final-browser-provenance.json](cyan-baseline/final-browser-provenance.json). The runner verifies application source does not change during the checks. `sourceCommitAtCapture` is the parent commit while changes are under review; `sourceFiles` identifies the exact candidate application bytes. The final review commit is recorded separately in the handoff.

## Safe local startup

Run the genuine local API with live jobs disabled. Receipt scratch files remain outside the repository. Use the supported Node 24 runtime on `PATH`.

```sh
NODE_ENV=development PORT=8787 DATABASE_URL= \
PAYSH_CATALOG_SOURCE=fixture PAYSH_ALLOW_FIXTURE_FALLBACK=true \
PAYSH_BOOTSTRAP_ENABLED=false INGESTION_ENABLED=false MONITOR_ENABLED=false \
MACHINE_EXECUTION_ENABLED=false \
MACHINE_RECEIPTS_JSONL_PATH=/private/tmp/radar-browser-machine-receipts.jsonl \
RH_CHAIN_LIVE_SNAPSHOTS_ENABLED=false RH_CHAIN_AUTOMATION_ENABLED=false \
RH_CHAIN_MARKET_INGESTION_ENABLED=false DEXSCREENER_ENABLED=false BLOCKSCOUT_ENABLED=false \
RH_4663_PHASE3_ENABLED=false RH_4663_AUTO_PUBLICATION_ENABLED=false \
RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false \
IPX_PLTR_SHADOW_OBSERVATION_ENABLED=false IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED=false \
JUDGMENT_PAYMENT_ENABLED=false ECONOMIC_ENGINE_ENABLED=false \
ECONOMIC_ENGINE_AUTHORIZATION_ENABLED=false node --import tsx src/server.ts
```

Run the candidate frontend preview separately:

```sh
VITE_API_TARGET=http://127.0.0.1:8787 node node_modules/vite/bin/vite.js --host 127.0.0.1 --strictPort
```

Serve the immutable baseline archive on port 5174 with the same `VITE_API_TARGET`, runtime and dependencies. No source modification is needed. Local listener startup and Chrome require sandbox approval in this desktop environment; those approvals succeeded. Initial sandbox listener failures and the missing dependency symlink were environmental startup failures, resolved before qualification. No production configuration was changed.

## Repeatable final suite

With candidate port 5173 and immutable baseline port 5174 running:

```sh
node scripts/browser-radar-ui-final.cjs
```

The defaults are documented here; override `RADAR_UI_EVIDENCE_DIR`, `RADAR_UI_BASE_URL`, `RADAR_BASELINE_URL` and `RADAR_CANDIDATE_URL` to use other local directories or ports. `RADAR_BROWSER_EXECUTABLE` chooses Chrome. Individual evidence, interaction, accessibility and zoom scripts also accept `RADAR_PLAYWRIGHT_PATH`; axe accepts `RADAR_AXE_PATH`.

The final runner invokes these actual checks and retains a separate log for each:

| Check | Coverage / result |
|---|---|
| Screenshots / layout | Three pages at 360, 375, 390, 768, 1024, 1280, 1440 and 1920px: **24 combinations pass**, zero document overflow or page exceptions |
| Interactions | **20 checks pass**: Solana settings, actual Dense spacing, Agent Mode, commands, filters/sorting, registry, preflight, disclosures, search and mobile navigation; RH modes, contract validation / real read-only GET, receipt clipboard/dismissal, movers, Meme Pulse, source policy, stale state and mobile navigation |
| Viewport reflow | **Six checks pass**, separate from actual native zoom |
| Automated accessibility | **12 axe audits, zero violation nodes**, including mobile/desktop, expanded navigation/controls and expanded Analyst disclosures |
| Native Chrome zoom | **Six checks pass** at actual 200% / 400%: all three pages, verified 1440px outer window, CSS viewport and DPR; keyboard/input checks remain usable |
| Lower-fold mobile | All requested sections retained; full-width 44px Solana hero actions; provider-context text wraps; RH has no hidden overflowing content; only existing provider-name ellipsis remains |
| Homepage control | Original and candidate complete/viewport PNGs are **byte-identical** at desktop/mobile; geometry, text, fonts and colors match |
| Separate RH narrative control | Same strict desktop/mobile equality; narrative appearance remains unchanged |
| Preservation comparison | Every original href, control identity, heading and title retained; no new custom input-name or heading-order regressions |

The density assertion measures actual spacing: comfortable dossier-stat padding / endpoint-list gap / provider-copy height are **16 / 14 / 44px**; Dense values are **8 / 6 / 30px**. Restoring comfortable view returns exactly to the original computed values. It goes beyond checking a class name or pressed state. A first supplementary assertion assumed the selected provider always had endpoint rows; its null-selector harness failure is retained under [attempts/density-selector/](cyan-baseline/attempts/density-selector/README.md). The corrected assertion uses the persistent provider-copy control and passes. Application bytes did not change for that harness repair.

The screenshot script saves complete pages and first viewports at 1440×1000 and 390×844. Screenshot-only response replay uses the genuine fixture GET payloads captured before implementation, keeping timestamps/data stable for comparison. It does not invent evidence or alter application data. The interaction, axe, zoom and lower-fold scripts call the actual local API. Inventories retain all headings, links, controls and landmarks.

## Exact homepage comparison and raster noise

Raw GPU screenshots have **102 desktop and 29 mobile differing pixels**, with maximum channel differences 4 and 9; first-viewports match exactly. These differences remain in [homepage-raster-differences.json](cyan-baseline/homepage-raster-differences.json). They were investigated instead of approved. The immutable baseline and final candidate were then captured using the same software renderer, exact browser/dependencies, API snapshots and warm-up: [homepage-control-results.json](cyan-baseline/homepage-control-results.json) and [robinhood-narrative-control-results.json](cyan-baseline/robinhood-narrative-control-results.json) require exact PNG and computed-style equality and pass. The raw differences do not establish a homepage design change.

All before/after and below-fold images are indexed in [VISUAL-REVIEW.md](../VISUAL-REVIEW.md); every linked image exists. Existing approved references are untouched. Candidate images require human visual approval.

## Limits and retained concerns

This qualifies the local fixture-backed UI. It does not establish live production freshness, payment execution, signed/finalized proofs, financial recommendations or production authority. UNKNOWN, fixture-backed and STALE labels remain visible.

No manual screen-reader, physical-device or virtual-keyboard testing was performed. Native Chrome zoom was actually changed through `chrome://settings/appearance` in isolated temporary profiles; this is automated native browser zoom, not a claim of manual testing. Full automated axe results retain incomplete findings for color contrast and ARIA for human assessment. Zero reported violations does not certify complete WCAG conformance.

The advisory 44px target inventory retains existing compact controls, checkbox geometry and intentionally Dense behavior. Raw small-target counts depend on selected provider/rendered endpoint rows; they must not be treated as a matched regression comparison. Direct same-viewport inspection confirmed existing baseline copy controls were 40px desktop (dossier copy 30px desktop / 40px mobile); comfortable candidate copy controls are now 44px on both viewports. No claim is made that every existing control meets a 44px recommendation. Existing provider-name ellipsis retains the accessible full text.

A matched original/candidate read-only contract inspection also captures development console warnings: [final-console-diagnostics.json](cyan-baseline/final-console-diagnostics.json), with its reproducible script beside it. The Brief flow reports zero warnings/errors on either source. Expanded Analyst / Meme Pulse table diagnostics reproduce **five identical duplicate-key warnings on each source**, zero new candidate warning signatures and zero page exceptions; see [analyst-console-diagnostics.json](cyan-baseline/analyst-console-diagnostics.json). Existing `unverified_contract_required` duplicate-key warnings remain a documented pre-existing diagnostic caveat rather than a claimed clean console across every state. Existing security, migration and operational holds remain in force. **No merge or deployment was performed or authorized.**
