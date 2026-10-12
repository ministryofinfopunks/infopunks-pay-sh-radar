# Terminal identity recovery: audit before implementation

2026-10-12. Supplied PNG confirmed visually and preserved unchanged in `../references/infopunks-radar-canonical-cyan-terminal.png`.

| Port | Process | Exact checkout / branch / HEAD | Homepage and CSS |
| --- | --- | --- | --- |
| 5178 | PID 8901, Vite development | `/Users/ahdilm/.codex/worktrees/radar-design-system/Infopunks Pay.sh Intelligence Terminal`, `codex/radar-design-system`, `068df2356834a97eecf8c5192b16a5036dca1a09` | `main.tsx` → `RadarAppShell` → green `UniversalHomepage`; imports `homepage.css`, `radarTokens.css`, `radarDesignSystem.css`, lazy `styles.css` |
| 8799 | PID 84644, built Fastify application | `/Users/ahdilm/.codex/worktrees/unified-radar/Infopunks Pay.sh Intelligence Terminal`, `codex/unified-radar`, `205e3c9` (full SHA in manifest) | built `UniversalHomepage` cyan; `/assets/index-D0nnPZGN.js`, `/assets/index-DB9tUcI9.css`; source `homepage.css` imports a second `designTokens.css`, lazy workflow CSS |

Both worktrees are clean. Main is clean at dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f. Earlier requested commit and branch exist. Their common baseline is dfe089b. Different entry source and independent builds, not an environment-driven color switch, cause the conflict. Both use the same exported component name. The earlier constitution/qualification explicitly preserved the green editorial manifesto because the screenshot was absent. The unified branch later implemented the approved portrait terminal but did not integrate with the earlier universal shell/route qualification. Initial HTML still contains the older green boot styling even in the cyan build.

Recovery baseline: 068df23 for its universal shell context, route inventory, accessible data tables and explicit evidence states. Reuse only the cyan visual implementation/assets from 205e3c9. Do not merge the unified branch's backend, migrations, policy or security changes. Its release certificate remains HOLD and is not an integration authorization. Branches/worktrees remain preserved; no merge or deployment.

Route coverage: TypeScript AST dispatcher inventory, currently 129 patterns, with aliases/details generated from actual patterns. Existing route sweeps are historical evidence and must be rerun after recovery. Homepage and route checkpoints require independent screenshot review; generated images are review candidates, never automatically approved references.

Guidance read: installed Apple design skill; official Apple HIG Accessibility/Layout (JSON documentation content fetched because HTML is JS-only); Google web.dev Web Vitals and Learn Accessibility. Apply hierarchy, agency, immediate feedback, text scaling and reduced motion to the supplied terminal. Do not apply translucency/native iOS styling against the user's explicit visual constitution.
