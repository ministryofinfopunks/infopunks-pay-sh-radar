# RH Chain Attention Quality v2

Attention Quality answers a bounded evidence question: did observed paid visibility lead to durable market participation, or did activity fade after promotion ended? It is not a safety score, legitimacy finding, agent-activity claim, or financial advice.

## Rollout and request boundary

`RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED=false` preserves the existing Attention Quality routes and UI exactly. When enabled, public Attention Quality reads use only persisted RH Chain market snapshots, reviewed classification memory, and stored receipt artifacts. They make zero provider requests.

The bounded public universe is reviewed exact contracts with retained snapshot history; it is not complete Robinhood Chain accounting.

## Identity and classification precedence

Exact contract identity is required. Precedence is: curated reviewed memory, durable approved active classification, provider context, then unknown. Provider context can describe boosts, paid orders, profiles, advertisements, takeovers, socials, and market state. It cannot establish identity, approve a classification, prove organic demand, agent activity, or legitimacy.

If curated and durable reviewed classifications materially disagree, curated memory remains public authority, the assessment is `disputed`, and no score is shown. Both records remain restricted to the established authenticated review surface.

## Methodology and score gates

Methodology version: `rh_chain_attention_quality_v2`.

Components expose raw and normalized values, weights, window, confidence, source, caveat, and missing-data state:

- Organic volume retention (20)
- Liquidity persistence (20)
- Transaction persistence (15; transaction counts are never described as wallets or holders)
- Post-promotion continuity (15)
- Boost dependence (10)
- Paid-order dependence (5)
- Canonical-pair stability (5)
- Market-data completeness (10)
- Narrative persistence is explicitly not applicable until reviewed narrative evidence exists

A 0–100 score exists only in `measurable`: exact reviewed identity, no material classification conflict, at least three baseline observations over 12 hours, a persisted promotion event, at least three post-promotion observations over 12 hours, at least 80% required market-field coverage, and a latest snapshot within six hours. Missing inputs are never turned into zero or a midpoint.

States remain distinct: `insufficient_data`, `baseline_forming`, `promotion_detected`, `post_promotion_observing`, `measurable`, `stale`, `unavailable`, and `disputed`.

## Receipt lifecycle

An authenticated reviewer may create an idempotent draft receipt from an assessment. Drafts are immutable artifacts; publication and rejection use the existing Review Console authentication and reviewer audit convention. A correction creates a new draft and supersedes, rather than overwrites, the previously published receipt. Public receipt reads expose only published artifacts.

Migration `20260719_004_rh_chain_attention_quality_receipts` is reversible and must be applied through the normal migration process; application startup does not run it.

## Known limits

DEX Screener-derived boost and paid-order context is captured market context only. The system does not infer paid attention from price or volume alone, does not use wallet/holder terminology without wallet-level data, and does not claim future performance or investment quality.
