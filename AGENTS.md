# Infopunks Radar Launch Video Instructions

This repo powers radar.infopunks.fun, the Infopunks intelligence terminal.

When generating a launch video:
- Position Radar as the intelligence refinery for the agentic economy.
- Core thesis: before an agent spends, it checks Infopunks.
- Show Radar as signal extraction from market noise.
- Highlight: Attention Market Watch, Signal Graph, LoopLab, Receipts, Claims, Routes, Providers, Pre-Spend Intelligence.
- Tone: cyberpunk, premium, terminal-native, Apple-level restraint.
- Avoid generic SaaS language.
- Use minimal text.
- Prefer short cinematic copy:
  - "Most see noise."
  - "Infopunks finds signal."
  - "Before agents spend, they remember."
  - "radar.infopunks.fun"

# Radar product interface

Read `docs/design-system/constitution.md` before frontend changes. `src/web/radarTokens.css` owns global tokens; do not introduce a second theme or new root definitions in workflow stylesheets. `main.tsx` provides `RadarAppShell` for every UI page. Reuse navigation, indexed headers, explicit status vocabulary and `RadarReceiptLifecycle`. Preserve canonical decisions, permissions and receipt boundaries. Availability or freshness is not verification. Demonstrations must be labeled. Add route inventory and responsive coverage for new pages. Critical mobile usability failures block UI migration qualification; never claim completion using screenshots or tests that were not executed.
