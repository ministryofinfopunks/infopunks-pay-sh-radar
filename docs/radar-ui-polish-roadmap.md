# Radar UI polish roadmap

## Product context

Radar has grown from a Solana provider and route intelligence terminal into a multi-surface evidence system. The current product includes Attention Market Watch, Signal Graph, LoopLab, receipts, claims, routes, providers and pre-spend intelligence, alongside RH Chain market memory, claims, receipts and review tools. The recent build has focused on the economic judgment and canonical receipt spine, paid decision context, evidence eligibility, causal tape replay, and release qualification. The interface must make those trust boundaries clear while helping an operator move quickly.

The repo already has a unified network-aware navigation system, command palette, view controls, reduced-motion handling, evidence-state styling, and an established dark glass visual foundation. The main inconsistency is that the universal homepage, the shared Radar shell, the machine-market surfaces, and RH Chain feature pages were polished at different times and use different levels of density and visual emphasis.

## Work sequence

### 1. Establish the shared visual contract

- Keep one type system: SF-style system text for reading, monospace only for identifiers, timestamps, provenance, and technical values.
- Standardize spacing, radii, borders, elevation, focus states, and motion timing through shared tokens.
- Keep status meaning consistent: verified, watch, blocked, disputed, and unavailable must remain distinct and readable without color alone.
- Preserve network identity as a restrained accent rather than a separate design language.
- Audit sticky chrome, menus, command palette, drawers, and responsive navigation together.

### 2. Make entry and orientation effortless

- Align the universal homepage and Solana/RH Chain entry pages around the thesis: intelligence before an agent spends.
- Reduce repeated introductory copy and make the first useful action obvious.
- Give every screen a clear page title, one sentence of context, and a stable location in the product.
- Ensure large feature catalogs are discoverable without turning the primary navigation into a dense link list.

### 3. Polish the core intelligence workflows

- Attention Market Watch: make signal strength, freshness, and source quality scannable.
- Signal Graph: prioritize the graph canvas and selected evidence, with detail panels that stay legible at tablet and mobile sizes.
- LoopLab: show the observe → evaluate → act → receipt memory cycle as one understandable flow.
- Pre-spend: present route/provider comparison, blockers, and the final decision as a calm, auditable sequence.
- Receipts, claims, routes, and providers: use consistent evidence provenance, state labels, and next actions.

### 4. Bring secondary surfaces into the same system

- Apply the same hierarchy to machine-market dossiers, readiness matrices, review consoles, RH Chain desks, and campaign pages.
- Remove one-off card treatments only where they do not carry product meaning; preserve intentional source, chain, and proof-state distinctions.
- Tune dense tables and technical JSON so the default view is readable and raw detail stays available on demand.

### 5. Validate the whole application

- Review representative screens from every product family at desktop, tablet, and phone widths.
- Check keyboard navigation, focus visibility, reduced motion, contrast, loading/error/empty states, and long identifiers.
- Confirm evidence wording and claims remain unchanged when visual hierarchy changes.
- Use screenshots and route-level review to catch regressions across shared and specialized styles.

## Applied

- Reworked the universal homepage with system typography, quieter surfaces, rounded chain entry cards, deliberate action states, and reduced-motion-safe interactions.
- Promoted the design foundation to an application-wide contract: native system text, shared spacing and radius tokens, neutral layered surfaces, predictable focus rings, calmer sticky navigation and menus, and consistent responsive shell sizing.
- Refined the pre-spend terminal scan path, decision result hierarchy, LoopLab counters, Signal Graph canvas and scrollable detail rails, and Attention Market Watch surfaces. Explicit proof and decision states keep their semantic treatment.
- Kept the RH Chain and machine-market shell-specific visual systems intact where they intentionally carry network or domain context.

## Remaining review

- Walk every route at desktop, tablet, and phone widths and inspect screenshots for local overrides that defeat the shared contract.
- Review empty, loading, error, and unusually long identifier states across route, provider, claim, receipt, and RH Chain detail pages.
- Check keyboard flows, contrast, reduced motion, reduced transparency, and browser rendering in the actual application.
- Make route-specific corrections where the shared layer exposes a real layout or readability problem; avoid changing evidence wording or decision behavior during visual polish.
