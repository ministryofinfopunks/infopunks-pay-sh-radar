# Causal replay report

The new PostgreSQL integration test builds signed J1 → test-fixture verified-classified execution → independently classified Evaluation → paid J2, reloads from PostgreSQL, verifies J2's frozen decision context and builds/offline-verifies the causal witness. With the Evaluation fixed in context, J2 is `do_not_spend`; the same current request/evidence with the designated Evaluation removed replays to `proceed`. The witness sets `real_route_verified=false` and `improvement_measured=false`. Tamper rejection is covered by the existing offline witness tests.

This proves deterministic causal replay for synthetic fixtures. It does not establish independently reviewed real execution or statistically meaningful learning. Production learning metrics must exclude local/mock outcomes. Late/future boundary and unsupported eligibility cases are covered by the PostgreSQL acceptance-history and eligibility tests.
