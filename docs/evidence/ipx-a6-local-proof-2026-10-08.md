# IPX A6 local proof package — 8 October 2026

Certified claim scope: paid `/v1/pre-spend/check` only. No claim is made that the separate economic decision engine learns from O/J/X/E or that IPX token economics are live.

Implementation:

- `/v1/receipt-spine/tape` pages O/J/X/E with server acceptance labels, full receipt-parent closure, frozen decision contexts and a content-addressed manifest at an accepted sequence. `/v1/receipt-spine/attempts` pages append-only free `insufficient_evidence` assessment attempts. Same-key retries return the stored free result; a fresh key reassesses.
- `/v1/receipt-spine/witness/:j1/:evaluation/:j2` emits a signed bounded J1→X→E→J2 bundle with both contexts, raw E output artifact, acceptance metadata, signer registry and same-input-minus-E counterfactual. `scripts/verify-ipx-causal-witness.ts` verifies a saved JSON bundle offline. The bounded verifier currently supports one designated contributing E; wider causal graphs fail closed.
- Synthetic fixtures and locally mocked proof adapters have `real_route_verified=false`, `improvement_measured=false`, and zero verified revision/improvement counters. An ancestry-complete count only measures replay of locally available receipts.
- Migration `20261008_021_free_assessment_attempts` keeps the free-attempt tape immutable. The manifest hash is deterministic for its accepted boundary. All parent receipts are immutable; prior manifests can be reconstructed from a boundary, though a separate external transparency mirror remains outstanding.

Focused local validation: `tests/causal-tape-witness.test.ts`, `tests/integration/free-assessment-attempts-durability.test.ts`, `tests/acceptance-history.test.ts`, `tests/integration/acceptance-history-durability.test.ts` passed: four files, six tests. The PostgreSQL tests used disposable localhost:55465 data. The witness test uses a generated test Ed25519 key and mocked settlement; it is not a real-route demonstration. Counterfactual tampering is rejected.

G0/G1 remain **HOLD**: no genuine executor output or independently finalized external proof for a real route, no independently reviewed signer deployment registry, no public external manifest mirror, and no measured improvement series. No production writes, transfers or deployment occurred.
