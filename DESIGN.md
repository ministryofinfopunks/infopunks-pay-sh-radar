---
version: alpha
colors:
  canvas: "#050b0c"
  panel: "#081113"
  raised: "#102024"
  text: "#f1f0e5"
  muted: "#a0c2d0"
  border: "#4e737d"
  primary: "#00eee4"
  judgment: "#dc91ff"
  warning: "#f6d06f"
  danger: "#ff9393"
typography:
  ui:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
rounded:
  control: ".25rem"
  surface: ".25rem"
  panel: ".25rem"
spacing:
  xs: ".25rem"
  sm: ".5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "3rem"
components:
  terminalPanel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "{spacing.md}"
  primaryControl:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    height: "44px"
---

# Infopunks Radar design context

## Overview

One Radar. Two economies. One standard of proof. A restrained cyan intelligence terminal for agents and people inspecting evidence before acting. Solana concerns service spending; Robinhood Chain concerns public market observation. Neither appearance nor a favorable observation grants execution authority.

The detailed maintained contract is [the visual constitution](docs/design-system/constitution.md). This file mirrors its accepted values for discovery; it does not create a new system or supersede that contract. The user confirmed the cyan homepage screenshot and selected existing integration source `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. The retired green homepage is not a design source for new work.

## Colors

**Runtime ownership model B:** `src/web/radarTokens.css` owns every canonical value. This document mirrors that file; no token generation or duplicate theme is introduced. Cyan identifies actions and selection, violet policy-relative Judgment, amber caution, red failures. Green success never follows from availability, freshness or record existence alone. Preserve explicit missing, unknown, stale and unverified text.

## Typography

System monospace carries the homepage's headings, technical metadata, evidence and identifiers. System sans remains available for existing workflow copy. The headline grammar is 800 weight, `clamp(2rem, 3.55vw, 3.4375rem)`, 1.08 leading and -.055em tracking; mobile `clamp(1.875rem, 8.2vw, 2.625rem)`. Section titles use 1.4375rem/1.2 and -.045em tracking. Technical copy is at least .75rem, with 1.6–1.7 leading; mobile inputs use 1rem.

## Layout

The existing `RadarAppShell` owns global navigation, indexed route identity and footer. Maximum width is 1560px; desktop outer gutter 16px, phone 10px. Home-style section frames use 14px gaps, 16px padding and fine borders. Split evidence layouts stack at 680px; intermediate grids adapt below 1024px. Tables scroll within named, keyboard-focusable regions. Preserve natural document scrolling, complete evidence and accessible controls at 200%/400% zoom.

## Elevation & Depth

Panels are flat, near-black surfaces with no shadows, gradients or glow. Borders and alignment establish hierarchy. Existing popovers retain distinct solid surfaces and focus behavior. No decorative telemetry or new animation.

## Shapes

Controls and panels use the canonical .25rem corner radius. Identifiers wrap; preformatted text and wide tables retain local overflow.

## Components

| Role | Canonical runtime owner | Subpage consumer |
|---|---|---|
| Canvas, text, action, caution | `radarTokens.css`: `--bg`, `--text`, `--muted`, `--signal-action`, `--amber` | `--radar-*` aliases in both subpage stylesheets |
| Font roles | `--font-ui`, `--font-mono` → `--radar-font`, `--radar-mono` | Solana hero/directory/evidence, RH hero/receipt/cards |
| Corners and borders | `--radius-control/surface/panel`, `--line`, `--radar-line-soft` | Panels, controls, evidence rows |
| Page shell / global navigation | `RadarAppShell`, `ProductHeader`, `ProductFooter` | All routes share the global six-item navigation and indexed framing |
| Indexed labels | `RadarSectionHeader` | Directory and RH section labels |
| Evidence framing | Homepage `.terminal-panel`, `.terminal-panel-heading`, `.terminal-state` | Solana real coverage panel, RH Today/receipt panels |
| Actions / input | Existing `.execute` and homepage action/input geometry | Original CTAs and contract check |
| Semantic status | Existing raw evidence labels, `RadarStatus` where already used | Unknown, fixture, stale and risk labels remain literal |

`radarSubpages.css` composes only the Solana homepage and shared subpage focus treatment. `rhChainTerminal.css` composes only the Signal Desk homepage. Existing `styles.css` V2 rules retain their original specificity through a zero-specificity scope condition on other suite routes. Homepage source, stylesheet, shell, token values and shared components remain unchanged.

## Do's and Don'ts

- Reuse runtime tokens, existing controls and source-bound evidence. Preserve all labels, links, filters, loading/error states, provenance and authorization rules.
- Keep market observation distinct from pre-spend intelligence. Status appearance must never invent a proof claim.
- Keep the canonical homepage visually stable. Compare actual browser screenshots; a build cannot qualify visual consistency.
- Respect reduced motion, visible focus, labeled inputs and native keyboard behavior. Never hide content to make a screenshot cleaner.
- Do not add another root palette, component library, wallet requirement, payment execution, release automation or approval state.
