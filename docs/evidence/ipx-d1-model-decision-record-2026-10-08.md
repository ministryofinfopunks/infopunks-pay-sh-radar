# D1 — IPX/PLTR model decision record

**Date:** 2026-10-08
**Status:** awaiting written owner approval; no chain writes, financial deployment, parameter selection, or economic activation occurred.

## Decision required

Select exactly one scoped direction, or reject all directions for launch:

| Candidate | Current implementation | New financial code / external proof required | Principal obligations and bypass risk |
| --- | --- | --- | --- |
| Model A: venue fee and PLTR reserve | Not implemented. `IPX.sol` has no transfer tax; no reviewed fee hook, reserve custodian, or permanent lock exists. | Venue-specific hook or execution boundary, exact-output design, custody/lock contracts, independently reviewed actual venue compatibility and deployed-code proof. | Alternate pools and direct transfers can bypass a venue fee. A reserve needs a chosen custody policy, legal owner, signer limits, timelock/pause/recovery disclosures, and reconciled movements. |
| Model B: USDG service contribution purchase and burn | Candidate artifacts exist: `IpxRevenueLedger`, `IPXContributionVault`, and the USDG/PLTR/IPX route. | Approved contribution ratio, all-cost and refund policy, funded receipt-to-vault reconciliation, canonical route/pool evidence, quote safeguards, finality evidence and independent accountant review. | Accountant cost evidence, refunds after burn, route availability, price manipulation, and immutable-authority replacement all need documented controls. |
| Neither | Technically possible: retain intelligence services with no economic mechanism. | No economic contract or pool. | Does not authorize an implied token economy or reserve claim. |
| Separately reviewed hybrid | Not implemented or approved. | A separate allocation policy and review proving per-source conservation and no double attribution. | A service source cannot fund both Model B purchase budget and Model A reserve credit unless a reviewed allocation binds every atomic unit. |

## Findings

1. Model B `burnBps` is a fraction of positive verified service contribution. It is **not** a trading fee. Its PLTR swap hop does **not** create a PLTR reserve.
2. Model A and Model B describe separate mechanisms. The source documents do not authorize combining them, selecting parameters, or treating either as live.
3. The current repository does not contain an owner-approved model selection, policy hash, rate schedule, canonical PLTR confirmation, verified pool/router, deployment identities, legal scope, financial-contract audit, or independent accounting review.

## D3 / D4 readiness decision

**D3 is blocked.** Model A requires written selection, an actual compatible venue, disclosed reserve custody choice, exact-output architecture, and independent financial-contract review before implementation or deployment.

**D4 is blocked from activation.** Model B implementation preparation exists, but launch requires written selection, approved values, full-cost/refund/holdback policy, evidence-backed funding reconciliation, live route proof, safeguarded quote policy, independent accountant review, and an incident plan.

This record does not satisfy G2, G3, G4, G5, or G6.
