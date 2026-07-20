# Unified RH Chain sharing

The Unified Viral Sharing Layer is a public-only projection over existing RH Chain intelligence. It does not create receipts, publish drafts, promote records, or call providers. It uses the existing canonical URL, receipt integrity hash, freshness, confidence, methodology, and supersession records.

## Supported objects

`market_pulse`, `cross_layer_insight`, `attention_quality`, `project_claim_verdict`, `project_intelligence_receipt`, `daily_receipt`, and `signal_4663` use `rh_chain_share.v1` and deterministic copy template `rh_chain_share_copy.v1`. Future `future_capital_graduation` and `future_agent_activity` are modeled only; they have no routes or UI.

The model requires a canonical public URL, public title, principal finding, material caveat, observation window, captured timestamp, freshness, confidence, methodology version, source summary, publication state, and `not_financial_advice: true`. Project sharing keeps `PROJECT SAYS` separate from `INFOPUNKS VERDICT`.

## Publication and privacy rules

Only `published` and explicitly `superseded` public records validate as share objects. Drafts, rejected drafts, reviewer identities, reviewer notes, submitter contacts, internal audit entries, inaccessible private evidence, and bearer material are never fields in the model and therefore cannot enter share copy or cards.

Superseded records remain shareable only with an explicit superseded label, correction link, and replacement receipt link. The original canonical link remains available for auditability. A public dispute remains labeled as disputed; it is not converted to corroborated content by sharing.

## Deterministic copy

Copy is generated synchronously from the validated public object, without an LLM. Each template includes a finding, evidence state, window, confidence, material caveat, canonical link, and receipt identifier where present. It excludes trading language, predictions, urgency, chain/token endorsement, and superlatives.

## Social metadata and cards

Existing Market Pulse, Cross-Layer, and Attention Quality cards remain route-specific. Published Project Intelligence Receipts receive a server-rendered card at:

`/og/rh-chain/share/:receipt_id.png`

The route only resolves an existing public `published` or `superseded` receipt and has public immutable-style CDN caching (`s-maxage=86400`, stale-while-revalidate). It never reads a provider. The existing metadata utility maps receipt detail URLs to this card and provides canonical, Open Graph, and X metadata server-side.

## Distribution Pack

Eligibility is separate from promotion. A candidate must be public and published, have a canonical URL, available confidence, and source summary, and may not be a draft, rejected record, or non-public dispute. Superseded candidates require the correction/replacement links and retain a superseded label.

The current pack exposes eligibility for the existing reviewer-published Daily Receipt only. It does not auto-promote Project Intelligence Receipts or every public record; those remain behind the existing reviewer publication boundary.

## Analytics and accessibility

Share controls emit a local `infopunks:rh-chain-share` event for copy insight, copy receipt link, native share, and fallback share. The event contains only object type, receipt ID, and canonical URL—never wallet data, reviewer identities, contacts, notes, tokens, or query data. The host may consume this event through its existing analytics plumbing; no third-party dependency is added.

Controls are native buttons with visible focus behavior, keyboard support, and `aria-live` feedback. Native Web Share falls back to clipboard. The canonical page keeps the complete content available independently of its screenshot card, and no motion is required.

## Rollout and rollback

Deploy with the existing product flags unchanged. Verify the production-readiness endpoint and feature-specific public read routes before enabling any underlying RH Chain product. Sharing follows those flags: a disabled product does not expose its detail card or public share payload.

To roll back, disable the affected underlying product flag. This removes the public source and its share card while preserving immutable published records and correction history. No sharing-specific flag or migration is required.
