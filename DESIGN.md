---
version: alpha
name: "Infopunks Radar"
description: "Evidence-native cyan terminal for intelligence before agent spend."
colors:
  primary: "#00eee4"
  background: "#050b0c"
  panel: "#081113"
  text: "#f1f0e5"
  muted: "#a0c2d0"
  border: "#4e737d"
  judgment: "#dc91ff"
typography:
  sans:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
rounded:
  DEFAULT: ".25rem"
  sm: ".25rem"
spacing:
  section-gap: "24px"
  page-max: "1560px"
components:
  button: {}
  panel: {}
  field: {}
  status: {}
  lifecycle: {}
---

# Infopunks Radar Design System

## Overview

### Creative North Star

The canonical cyan intelligence terminal defined in [constitution](docs/design-system/constitution.md). Aligned evidence rows, bounded authority, and inspectable provenance carry the identity. The frozen supplied reference remains authoritative; this remediation does not update approved references.

### Product context and register

Product/tool register. People and agents inspect observations and private judgments before spending. English is the maintained UI language; no Japan-specific market or locale scope is established. Desktop and mobile access require readable evidence and explicit uncertainty. Indexed route families provide the signature; restrained shared panels carry recoverable tasks. Retired green editorial presentation, decorative telemetry, and fictional verification are anti-references.

**Token ownership/runtime mapping:** This document mirrors `src/web/radarTokens.css`, the canonical runtime source. `radarDesignSystem.css` and existing workflow styles consume its aliases. `node scripts/radar-design-inventory.mjs --check` enforces the palette and prohibits additional root token owners. This document generates no CSS.

## Colors

The primary cyan token denotes action and selection. Judgment purple denotes policy-relative assessment. Verified success uses the existing `--ok`; pending and denied states use labeled semantic warning/danger tokens. Text and provenance remain visible independently of color. High-contrast and reduced-transparency preferences retain solid surfaces.

## Typography

The sans and mono stacks mirror `--font-ui` and `--font-mono`. UI tasks use sans; identifiers, times, and source facts use mono. Existing line height and tracking remain runtime-owned. Long identifiers wrap; source JSON scrolls locally.

## Layout

Use the runtime page-max and rem spatial scale. One entry-level shell owns global navigation and footer. Natural document scrolling keeps forms reachable; wide tables and source JSON own local overflow. Loading/error/help regions preserve recoverable controls. No remediation introduces fixed viewport sizing.

## Elevation & Depth

Fine terminal borders and cool surfaces establish hierarchy. Panels have no ornamental shadow. Existing floating menus retain their bounded shadow and focus behavior.

## Shapes

Use the runtime control, surface, and panel radii, all .25rem. No parallel rounded theme or dashboard framework is introduced.

## Components

### Foundational visual states

`RadarAsyncState` owns loading, unavailable, error, empty, and denial recovery. `RadarStatus` separates reported records, verified evidence, missing evidence, and pending outcome. `RadarReceiptLifecycle` requires explicit independent stage records.

### Buttons and actions

Reuse `.execute`, native buttons, and links. Cyan actions are separate from verified outcome. Busy/disabled controls cannot dispatch again; corrective focus moves after the credential field is re-enabled.

### Navigation and data display

`RadarAppShell` owns global chrome; route details preserve owning network and local navigation. `RadarDataTable` and existing specialist tables preserve all evidence columns in local scroll regions. No new dataset navigation policy is introduced.

### Forms and overlays

`TenantKeyField` and `FieldFeedback` own memory-only masked credentials, reveal controls, described errors, and operator access guidance. Product forms use noValidate. Native select popup geometry remains platform-owned under the existing constitution. Private records load only after explicit submission and clear when credentials change.

### Iconography

Reuse `TerminalIcon`; icons supplement visible labels. This task introduces no new icon vocabulary.

### Motion

Reuse the existing press/menu durations and reduced-motion rules. No new animation communicates unverified success.

### Content and data visualization

Recovery names what failed and the available correction. Invalid successful HTTP responses are errors, not empty evidence. Public share projections validate their complete contract before rendering or telemetry. Decision View is an assessment and always denies execution authority.

## Do's and Don'ts

- Do reuse the canonical shell, tokens, fields, async states, and receipt inspector.
- Do retain the owning network for malformed share addresses and reader errors.
- Don't infer verified outcomes from availability, settlement, or a favorable judgment.
- Don't update approved screenshot references automatically.

## Verification and remaining gates

Runtime evidence is retained outside application source and binds source SHA plus artifact hashes. Automated component/browser checks cannot certify independent human review, physical mobile keyboard behavior, VoiceOver/NVDA, or native 200%/400% browser zoom. Those release gates remain HOLD.
