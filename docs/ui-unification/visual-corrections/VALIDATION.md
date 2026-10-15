# Correction validation

**Release HOLD; independent visual review required.** The reviewed parent is `7f44417fcad683a48397dad251f5d4245aa34643`. [source-hashes.json](source-hashes.json) binds 722 application/test/configuration/QA files to the actual checks; [source-integrity.json](source-integrity.json) reports zero changes during the full suite. Browser source and driver hashes are independently recorded in [final-browser-provenance.json](evidence/final-browser-provenance.json). The parent SHA in command output is pre-commit metadata, not a claim that the unmodified parent was tested.

Node24.21.0 matches the engine; the existing lockfile/dependency tree is unchanged. Full tests used a fresh, disposable PostgreSQL16.15 cluster bound only to 127.0.0.1:55433, with known synthetic test databases and no production data. [Database metadata](database.json) records scope. Existing preview requests use the actual local fixture API, with payments/jobs disabled. Screenshot-only response replay uses genuine pre-correction GET responses to hold source data/timestamps constant; it invents no evidence or fresh observations.

| Command / check | Actual result |
|---|---|
| Preliminary nine-file frontend run | 98 tests PASS after correcting a new test's assumption about the existing share-button markup; initial failed assertion retained under `attempts/`. The final full suite below includes these files and the subsequent source-badge/test-selector refinement against the frozen final bytes. |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing chunk/native-loader warnings retained |
| `npm run check:design` | PASS; 130 route patterns unchanged |
| `npm test -- --maxWorkers=2` with disposable test PostgreSQL URLs | **283 files / 569 nested suites / 2,056 tests PASS, zero skipped/pending**; default timeouts unchanged; [summary](test-summary.json), [full JSON](full-tests.json), [raw log](full-tests.log) |
| Original `verify-radar-subpage-boundary.cjs` | PASS: 1,526 protected cyan-baseline files, all original bindings and 295 legacy style rules preserved; [report](source-boundary.json) |
| Additional candidate boundary | PASS: 1,834 protected tracked files; handlers, navigation, state and requests unchanged; [report](candidate-source-boundary.json) |
| `browser-radar-ui-final.cjs` | **All eight groups PASS**; exact commands, script hashes, logs and artifact hashes in the linked manifest |
| Responsive matrix | 24 route/width combinations at 360/375/390/768/1024/1280/1440/1920; zero document overflow or page exceptions |
| Browser interactions | 20 actual checks and six reflow checks PASS; original controls/links retained |
| Accessibility automation | 12 expanded-state/viewport axe audits, zero violation nodes; incomplete findings retained |
| Native browser zoom | Six actual Chrome 200%/400% cases PASS, separate from viewport emulation |
| Homepage / separate RH narrative controlled comparison | Desktop/mobile complete and viewport PNGs byte-identical; measured geometry, text, type and color identical |
| Focused correction assertions | Both widths PASS: unchanged Solana metrics/provenance/slogan, actual state/order, all eight receipt fields and identical receipt text/control content; [report](evidence/after-corrections-results.json) |
| Directory count geometry | All six cards retain exact width/height at all eight widths; [report](evidence/directory-count-geometry.json) |
| Existing `qualify-ui-int2-routes.cjs` | PASS: four relevant routes / 28 widths including 320 and 430; [summary](existing-routes/summary.json) |
| Existing `qualify-unified-radar-browser.mjs` | PASS: 33 route/view audits, zero HTTP/overflow/axe/private-request failures; eight reflow checks; keyboard/reduced motion recorded; [summary](existing-unified/summary.json) |
| Existing `compare-ui-int2-visuals.cjs`, unmodified | **Exit1 / REVIEW_REQUIRED**, exactly four changed subpage captures. Homepage and Spend Terminal: zero changed pixels both widths. Receipts: below the unchanged threshold. [Results](approved-visual-comparison/results.json) |
| Premium strict static audit | **FAIL, exit2:** 57 existing findings before/after, zero new/resolved findings; [comparison](premium-comparison.json), [actual output](premium-after.log) |

Static/build/full-suite command arguments, timings and exit codes are in [checks.json](checks.json). The broader original browser tools were run unmodified. The approved comparator ran in an exact current-source temporary snapshot so its fixed output path could not overwrite the root's historical evidence. Its [command record](approved-visual-command.json) and [snapshot provenance](snapshot.json) identify the bytes. Cached randexp0.5.3/pngjs7.0.0 were installed only in an ephemeral QA directory, with scripts disabled; no application package/lockfile was edited.

## Preserved failures and limitations

The first narrative control had identical DOM geometry/type/color/text but 10 complete-page and 20 viewport raster pixels differed by one channel level, confined to rounded borders. [Diagnostics](attempts/narrative-raster-diagnostics.json) and first-run files under `attempts/browser-first-pass/` remain. An isolated repeat and the entire final eight-group rerun both pass exact equality. No application source or approval tolerance changed to obtain that result.

The initial added receipt test assumed `aria-haspopup="menu"`; the existing control actually uses `aria-expanded`/`aria-controls`. Only the test was corrected; [initial failure JSON](attempts/frontend-initial-selector-failure.json) is retained. The source badge moves outside its old provenance wrapper, so the focused driver compares its unchanged text separately from the unchanged source/freshness paragraphs. Original component capture artifacts and capture-method notes remain under `attempts/`. Native viewport clips and ordinary 390×844 viewport tiles supply complete, unaltered receipt evidence.

The original inherited Search journey-harness failure and its prior ten passing selector-scoped API journeys remain documented in [the prior validation](../VALIDATION.md). Private tenant/payment/receipt journeys were not newly claimed from the fixture-only browser preview. Existing authority/API/domain tests do run in the full PostgreSQL-backed suite. No original harness was silently fixed. The 57 existing static findings, prior low development dependency advisory and five existing expanded-Analyst duplicate-key warnings remain unresolved. No dependency/security/migration gate was relaxed or newly certified.

No manual screen-reader, real-device or virtual-keyboard testing was performed. The broad browser audit retains 374 incomplete axe nodes for human review. Zero automated violations does not establish full accessibility compliance. Changed-page snapshots remain independent-review candidates; no merge, release or deployment approval is implied.
