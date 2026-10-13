---
version: alpha
name: Infopunks 4663 Front Door
description: Source-linked market evidence in a restrained financial research terminal.
colors:
  background: "#090a0b"
  surface: "#111315"
  text: "#f4f5f6"
  secondary: "#a8adb4"
  primary: "#9dd9ff"
typography:
  sans:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif'
  mono:
    fontFamily: 'ui-monospace, monospace'
rounded:
  md: "1.125rem"
spacing:
  card: "1.5rem"
  gap: "1rem"
  content: "76rem"
components:
  category:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
---

# Infopunks 4663 Front Door

## Overview

This records the existing `/4663` visual language, rather than introducing a rebrand. Humans investigate Robinhood Chain evidence on desktop and mobile; applications consume the same public read models. The signature is an evidence ledger: every measured movement leads to its exact source, timestamp and unresolved input. Product register, English interface, UTC market times; no Japan-market scope is inferred. The product decision comes from the current request and the public/private boundary in `docs/rh4663-frontdoor-contract.md`.

Avoid promotional price charts, verdict badges for unreviewed observations, and category scores that imply investment returns. Keep CALL after market investigation. Existing Signal Desk research pages retain their terminal typography.

## Colors

Runtime ownership is Model B: `src/web/rh4663.css` owns `--fd-*` tokens; this file mirrors accepted values. Background/surface/text/secondary/primary map to `--fd-bg`, `--fd-surface`, `--fd-text`, `--fd-text-secondary`, `--fd-accent`. Category disclosures consume those variables. OBSERVED uses accent and an explicit text label; color alone never conveys evidence status.

## Typography

The sans stack maps to `.fd-shell`; mono maps to `.fd-category-contract`. Headlines use the established scale, not a new display face. Exact contracts wrap; symbols never replace contract identity. Observation times include UTC.

## Layout

Cards consume `--fd-space-4` (card), `--fd-space-3` (gap), and the shell's `--fd-content`. Categories use two columns, collapsing below 720px. Document scrolling owns the workflow; no fixed-height panel or nested vertical scroller is added. Show at most three findings per category and a route to all bounded results. Stock Tokens open first; the other four lanes remain equally accessible.

## Elevation & Depth

Reuse the existing flat research surfaces and borders. No new shadows, gradients or animated score counters.

## Shapes

Category surfaces consume `--fd-radius-md`. Focus follows the shared `.fd-shell` outline rule.

## Components

`src/web/marketIntelligence/rh4663MarketCategories.tsx` owns category disclosures; native details/summary provide keyboard behavior. `rh4663FrontdoorRead.ts` owns anonymous ETag reads and reuses `rhChainMarketRevalidation.ts`. Existing NowCard, WatchCard, OpenLoopCard and ResearchLink remain canonical. New links use the shared hover/focus/active treatment. No visual token changed; documentation captures existing ownership.

## Do's and Don'ts

Expose incomplete, empty, stale and unavailable evidence in text. Scores are scoped to their category and version. Never show missing corporate actions, reserve evidence or paid attention as zero. No category disclosure writes classifications, publishes receipts or authorizes execution. Reduced motion inherits the existing `.fd-shell` media rule.

## Daily editions and return state

The UTC-day observation card reuses the Front Door card, ResearchLink, EvidenceBadge and native details owners. It presents sample endpoints with explicit incomplete coverage, never an investment return. Market WATCH cards expose the same sources as NOW. Loop labels distinguish resolved input coverage from reviewed judgment. The accepted portrait is `public/artwork/signal-punk.webp`, reused unchanged from `codex/unified-radar` at `205e3c9`; this imports the artwork only, not that branch's application logic. The hero reserves image dimensions on both desktop and mobile. Front Door headings, status accents and scrollbars consume existing cyan tokens explicitly to prevent legacy global green styles from leaking.
