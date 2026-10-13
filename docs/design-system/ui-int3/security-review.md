# UI-INT3 independent security review — HOLD

Review subject: `e0315314264fff395f8e84b37bb6f1984d6b39e7`. Secure baseline: `2c2fe64db173c63048e70353ae926aa199792d1b`. Visual evidence: `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. This package is preparation by the implementing agent, not an independent approval. Authorized independent reviewer identity and decision are unset in [review-dispositions.json](review-dispositions.json).

## Changed boundary inventory and diffs

[All integrated changes](evidence/changed-files-vs-secure-baseline.txt), [focused diff](evidence/security-boundary.diff), [complete presentation diff](evidence/presentation-boundary.diff), [292 protected file hashes](evidence/protected-inventory.json). All non-web source and all 44 migration files are byte-identical to the secure baseline. This limits integration scope; it does not establish that the retained implementation is defect-free.

| Changed file | Review concern |
| --- | --- |
| src/web/canonicalReceiptPage.tsx (new) | Tenant credential in component memory; owner-only no-store read and verify; strict receipt parsing; generic 401/404/503 errors; identity change clears prior record; abort/timeout handling; no mutation authority |
| src/web/main.tsx | New authenticated proof-route dispatch; lazy current Spend controller remains authoritative; malformed/encoded route handling and error boundary |
| src/web/spendTerminalPage.tsx | Presentation and lifecycle only; original request/idempotency logic retained; receiptless assessment cannot appear issued; link to private inspection |
| src/web/radarDesignSystem.tsx, radarAppShell.tsx, productPrimitives.tsx | Shared status/lifecycle, header and navigation; preserve EvidenceScope distinctions, keyboard focus and factual stage semantics |
| src/web/radarApp.tsx | Labelled scroll regions and SVG accessibility; security and request logic must remain unchanged |
| src/web/homepage.tsx, radarNetworks.tsx, productCatalog.ts, radarNavigationCatalog.ts, radarPageIdentity.ts | Deep links, route/network identity, service versus market authority; no financial execution implied |
| index.html, public/site.webmanifest, public/favicon.svg, public/artwork/signal-punk.webp, route CSS | Boot/shell and appearance; inspect security headers/CSP ownership and asset delivery; frozen identity |
| tests/ui-int2-receipt-inspection.test.tsx, tests/web-accessibility.test.tsx, tests/pre-spend-builder-pages.test.tsx, tests/homepage-performance.test.tsx, tests/static-discovery.test.ts | Inspect changed expectations and assertions against current secure behavior; no target test exclusion |

`src/web/judgmentCheckClient.ts`, API, SDK, identity/access policy, signing, payment recovery, authority, persistence and migrations are unchanged. UI-INT3 changes only qualification scripts and documents. Review the new harness's offline response interception separately from production behavior.

## Threat boundaries and required reviewer checks

| Boundary | Exact retained source / tests | Independent check |
| --- | --- | --- |
| Authentication/session | src/security/judgmentIdentity.ts; src/web/judgmentCheckClient.ts; tests/judgment-private-access.test.ts | Server binds opaque credential digest to tenant + agent; missing/invalid/expired keys fail closed. Browser password remains memory-only, absent from URLs, storage, logs and redirect destinations. Test reload/back and pending-request navigation. |
| Tenant/receipt ownership | src/api/judgmentPrivateAccess.ts; src/security/judgmentAccessPolicy.ts; tests/judgment-private-access.test.ts; tests/integration/judgment-dx-postgres.test.ts | Judgment request owner authorizes ancestry-derived execution/evaluation reads; same tenant/wrong agent and cross tenant denied; unowned historical records not made public; stale UI evidence cleared. |
| Private proof/public export | src/security/proofReadBoundary.ts; src/services/receiptAuthorityService.ts; tests/security/private-proof-reads.test.ts | Operator-only tape/attempt/economic reads; owner routes no-store; encoded lookalikes and unknown routes cannot bypass auth; public projection excludes private ancestry. Verify export/download/search caching. |
| Input and error handling | src/api/app.ts; src/schemas/preSpend.ts; src/web/canonicalReceiptPage.tsx | Strict contracts, bounded IDs/body and idempotency headers; malformed paths and response schema fail safely. Internal persistence errors redacted; inspect both operational logs and client errors. |
| Proxy/rate boundary | src/api/app.ts (Fastify construction; Judgment limiter consume(req.ip)); tests/security/controlled-staging.test.ts (rate429); forwarded-header topology needs independent negative test | Fastify is constructed without trustProxy; forwarded headers must not change limiter identity. Confirm actual reverse proxy topology and distributed limiter limitations; do not enable broad trust to make staging pass. |
| Decision reads | src/services/preSpendDecisionService.ts; src/api/app.ts; tests/security/controlled-staging.test.ts | Same owner binding on decision and receipt reads; unknown/missing identity never yields another tenant's decision. |
| Canonical Judgment/payment | src/services/receiptAuthorityService.ts; src/security/judgmentIssuer.ts; src/security/executionAuthorization.ts; tests/unit/x402-judgment.test.ts; tests/integration/pre-spend-payment.test.ts | Hash/signature, trusted issuer, validity, ancestry and execution authorization are separate; insufficient evidence free/no receipt; quote does not settle; idempotency/CAS prevents duplicate settlement. Mock settlement is not live settlement evidence. |
| Reputation/evaluation | src/services/evaluationService.ts; tests/security/score-authority.test.ts; tests/receipt-authority.test.ts | Only independently accepted evaluations affect derived score; legacy intake and ordinary receipt reads cannot mutate reputation. |

The focused tests are enumerated with assertion names/statuses in [security-test-evidence.json](evidence/security-test-evidence.json), derived from the fresh complete PostgreSQL-backed run. The [complete 2,047-test result](evidence/system/full-test-summary.json) and [command outcomes](evidence/system/check-results.json) bind to d3d0a44, whose application/tests match e031531. Prior authenticated real-local-browser evidence remains applicable: UI-INT2 evidence/browser/authenticated-tenant-browser.json, evidence/journeys/results.json and evidence/real-backend-recovery.json. These are synthetic fixtures with payment disabled.

No separate proxy-spoof or multi-replica limiter test was executed in UI-INT3. The retained no-trustProxy construction was inspected; actual reverse-proxy topology and distributed limiter operation remain independent/operational review items.

## Advisories and operational disposition

Fresh npm audit: production 0 findings; all dependencies 1 low esbuild development finding, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). Vendor advisory describes Windows development-server path traversal in >=0.27.3 <0.28.1; patched 0.28.1. Evidence: [all audit](evidence/system/audit-all.json), [production audit](evidence/system/audit-production.json). Proposed containment: deploy compiled production assets only, keep QA servers localhost, do not run affected Windows esbuild serve. Dependency bytes remain frozen. This is a proposed disposition requiring independent acceptance, not a signed risk waiver. No current Dependabot or container SBOM clearance is asserted. Candidate exact-head Linux/container CI remains unqualified; local Docker daemon is unavailable.

## Reproduce and sign off

Follow [reproduction.md](reproduction.md). Run full qualification with disposable local PostgreSQL16 and Node24.21; do not omit TEST_URLs because that skips database cases. Review the diff and boundary tests, then independently probe anonymous/owner/wrong-agent/cross-tenant/expired sessions, request replay, forged parent/issuer, public exports, rate limits, redacted outages and pending navigation. Record reviewer name, independent role/authority, application SHA, evidence digest, commands, findings, advisory disposition, timestamp and explicit APPROVE/REQUEST_CHANGES in review-dispositions.json. Any source change requires new SHA attribution and scoped regression. G3 remains HOLD until that authorized approval exists.
