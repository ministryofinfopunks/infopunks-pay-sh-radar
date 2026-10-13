# UI-INT3 commit attribution

- Application candidate: `e0315314264fff395f8e84b37bb6f1984d6b39e7` — unchanged.
- Approved source used for paired rebuild: `35f2e54a288311d1df0f8820dacb216c27175791` — identical runtime/tests/assets.
- Approval evidence parent: `d3d0a445ec20e8c55170c2fc1f52aff220b2a851` — docs/screenshots only, direct child of application candidate.
- Qualification-code commit: `b7f477cff624404a230c2a9ea921f09c2ca2dcd5` — original harness output isolation and new frozen-response/bounded-tile Solana qualifier only.
- Delivery evidence commit: the subsequent docs-only commit on `codex/radar-ui-int3-qualification`; resolve with `git rev-parse codex/radar-ui-int3-qualification`. This file does not try to embed its own commit hash.

No new application SHA is introduced. Local delivery branch/evidence HEAD is not a substitute deployment candidate. The original integration branch remains at d3d0a44 and the shared main checkout remains untouched. No remote push, PR mutation, merge or deployment.
