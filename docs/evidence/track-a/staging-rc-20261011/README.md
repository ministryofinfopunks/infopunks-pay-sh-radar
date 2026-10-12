# Track A controlled staging release packet — HOLD

One isolated candidate branch: `codex/track-a-staging-rc-20261011`.

- [Release decision and exact blockers](release-manifest.json)
- [Commit-level integration ledger](integration-ledger.md)
- [Validation results and raw evidence](validation-results.md)
- [Railway deployment manifest](../../../../deployment/railway-staging-manifest.json)
- [Railway staging runbook and rollback](railway-staging-runbook.md)

The source freeze is `f061ab4f3cda984e17e62cedb961fe2cbd752075`. Resolve the final evidence-only branch tip with `git rev-parse codex/track-a-staging-rc-20261011`; its runtime/source tree must match the source freeze. A final tip verification certificate is written separately under the ignored `output/frozen-verification` directory to avoid a self-referential commit SHA. No remote push, merge, deployment, payment/execution activation, production secret access or IPX/PLTR financial deployment occurred.
