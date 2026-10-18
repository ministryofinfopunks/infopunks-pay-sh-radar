# R3 validation and review boundary

**HOLD. Engineering validation only; independent reviews remain unassigned.** Local validation uses Node **24.21.0**. The package imports only Node built-ins; no provider, wallet, production, staging, payment, external economic service or dataset was accessed. Existing locked development dependencies were reused solely for selected historical regression tests; package/dependency files remain byte-identical to #17.

| Check | Result / limits |
|---|---|
| `node --test tools/first-spender-trust-r3/tests/*.test.mjs` | 83 checks passed. Absent/null/forged/revoked/expired identities, exact scope, fixture exclusion, missing/changed artifacts, unsupported fields, simulated self-review, independently signed inconsistent input, label/decision commitment mismatch, hindsight fields, cluster overlap, complete case/arm accounting, null costs/counterfactuals, safe integer amounts, CLI private output/exclusive creation, and registration/freeze without reveal. All keys/data are fictional in-memory software vectors. |
| Historical regression suite | 87 checks passed across 5 unchanged files: `tests/receipt-integrity.test.ts`, `tests/receipt-authority.test.ts`, `tests/decision-context.test.ts`, `tests/unit/judgment-service.test.ts`, `tests/spend-lab-value-r2.test.ts`. Includes old receipt/context and legacy-provenance characterization; no production fix inferred. Existing Vite config warning is inherited. |
| Historical fractional payload compatibility | Dedicated R3 vector checks the old finite-number canonical receipt algorithm separately from the new integer-only signed contract encoding. Original bytes/hashes are unchanged. This is not a production corpus compatibility assessment. |
| Dirty checkout | Exact-head verifier rejected the uncommitted package with `clean_committed_checkout_required`, exit 1, without an accepted head manifest. |
| Exact baseline inventory capture | #16: 1,418 files, tree `20ada31431b693cb67916942b6a09eb11161d115`; #17: 1,450 files, tree `901b63c433ddc848a55e921cefb0da564fc11db2`. Complete Git blob/byte digests, original metadata and original claims retained separately. Read-only API capture confirmed both requested draft heads. |
| Exact R3 head and unchanged source | `source-manifest.mjs` must run after committing, bind exact HEAD/tree and package/workflow digests, verify both baseline inventories and unchanged application/migration/test/lab/docs/dependency trees. Generated result belongs in `.data/trust-r3/`, bound to the source commit, not embedded back into itself. CI repeats before/after and uploads only source manifests. Actual run/head is reported in the draft submission and generated artifact, not predicted here. |

Reproduce historical checks after installing the unchanged lockfile in an appropriately isolated local environment:

```sh
node node_modules/vitest/vitest.mjs run tests/receipt-integrity.test.ts tests/receipt-authority.test.ts tests/decision-context.test.ts tests/unit/judgment-service.test.ts tests/spend-lab-value-r2.test.ts
```

No fresh 1,020-case payment simulation, economic grid, claim of independent security audit, source-contract qualification, actual migration test, external economic result, source admission rollout or independent approval is inferred. All baseline reports/claims retain their original qualification scope. R3's CI proves only offline checks and exact-source preservation. The private actual-source inventory, applicable authentication profile, registry and external heldout corpus are missing. The production predicate gap stays a release blocker until separately reviewed implementation and qualification; reviewer approval of this package alone cannot lift HOLD.
