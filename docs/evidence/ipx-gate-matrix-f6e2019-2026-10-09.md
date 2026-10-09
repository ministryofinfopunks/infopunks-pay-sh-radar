# IPX release gate matrix — current candidate `f6e2019`

Candidate SHA: `f6e201963e0beaed0ec2bcc291fb07c04ca67b7b`  
Policy hash: **not approved or frozen**  
Deployment: **none verified**  
Final determination: **G6 BLOCKED**

| Gate | Determination | Evidence and remaining condition |
| --- | --- | --- |
| G0 — Real causal route | **BLOCKED** | A4 outcome classification, A5 frozen context replay, A6 signed synthetic witness and offline verifier pass locally. No real eligible O→J1→X→E→J2 route, genuine executor artifact, independent outcome review or live finalized settlement was established. |
| G1 — Public tape and outcomes | **BLOCKED** | Three-boundary manifest replay stays stable under later receipt, free-attempt and quarantine writes; unit, full-suite and PostgreSQL durability checks pass. External immutable publication/mirror, complete externally observed tape and independently measured improvement series are absent. Verified causal revision and measured improvement counters remain zero. |
| G2 — Economic policy | **BLOCKED** | D1 compares Model A, Model B, neither and hybrid without selecting one. D2 tests explicitly hypothetical inputs. No signed model, rates, supply allocations, rights, cost policy or launch limits. |
| G3 — Assets, venue and liquidity | **BLOCKED** | No finalized independent proof of canonical 4663 USDG/PLTR identities, deployed bytecode, compatible router/pools, bidirectional executable depth or facilitator capability at an identified deployment. |
| G4 — Security, legal and operating authority | **BLOCKED** | No independent financial-contract audit closure, jurisdiction/participant scope, custody/operator authority map or legal sign-off. Lockfile refresh removes high/moderate advisories; one low `esbuild` advisory and cached OpenZeppelin source provenance remain review items. |
| G5 — Frozen production release | **BLOCKED** | Exact local candidate passes tests/build/migrations with a Node 25/Vitest engine caveat. All five current public paths return suspended-service 503; deployed revision, database role, production migration state, backup and readiness are unverified. No production change was authorized or made. |
| G6 — Final release | **BLOCKED** | G0–G5 are not all passed for the same candidate, approved policy hash and identified deployment. No live activation or deployment has occurred. |

## Package status

- **A4–A6:** integrated and locally validated. A6's manifest replay defect is repaired. External G0/G1 evidence remains blocked.
- **B1–B4:** local protocol implementation and tests are integrated. B3 finalized live settlement/cost evidence and B4 a complete reviewed manifest remain blocked. Economic CALL issuance stays disabled without the complete manifest and operator review.
- **C1:** local checks pass at one exact SHA. Vitest 5's declared runtime range excludes the available Node 25 runtime; repeat under Node 24 or 26 before strict promotion parity.
- **C2:** public suspended-route observation and recovery runbook prepared. Operator root-cause confirmation and recovery remain blocked.
- **C3:** local migration, durability and restore rehearsal complete. Production-role and staging-copy evidence remain blocked.
- **C4–C6:** blocked on verified assets, venue, facilitator, approvals and production authorization. C6 is explicitly operator gated.
- **D1–D2:** decision record and conservation scenarios prepared; rates remain hypothetical and no model is selected.
- **D3–D4:** conditional on model selection and independent review.
- **D5:** remains a dependency for an independently verifiable read-only economic namespace, reviewed legal scope, finalized roots, custody/obligation disclosure and material finding closure.

No synthetic or local test is presented as production evidence. No service was resumed, no contract deployed, no production key used, and no funds moved.
