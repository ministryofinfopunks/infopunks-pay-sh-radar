# D1 economic model decision record

Date: 2026-10-08. Baseline: `c56ca7e60efafb68a792223a173c2840cd274c50`. Status: **AWAITING WRITTEN OWNER SELECTION**. This is decision support, not economic authorization.

| Option | Present code | Added obligations | Bypass and custody questions |
| --- | --- | --- | --- |
| A: venue buy levy to PLTR reserve; venue sell levy to IPX burn/lock | No venue levy, segregated reserve or reviewed permanent lock. `IPX.sol` has no transfer tax. | Actual hook-compatible venue, exact-input/output and multihop design, fee recipient policy, reviewed reserve/lock contracts, independent contract review. | Alternate pools and transfers bypass a venue levy. Choose permanently retained or controlled reserve; name legal owner, signers, debit rights and incident powers. A lock requires proof of no withdrawal/approval/upgrade escape. |
| B: positive USDG service contribution buys PLTR then IPX and burns | `IPXContributionVault.sol` and `ipxRevenueLedger.ts` are candidate artifacts, without production route or funding proof. | Approved contribution BPS and full-cost/refund/holdback policy; revenue-to-vault reconciliation; verified router/pools and guarded executable quotes; independent accounting and security review. | Late refunds, frozen assets, manipulated quotes, accountant powers and immutable-authority replacement require an incident policy. |
| Neither | Intelligence service may continue without activating a token economy. | Explicit decision on any non-economic product release. | No reserve, burn or backing claim follows from this choice. |
| Hybrid | No approved allocation or integrated implementation. | Separate policy allocating each atomic source once across mechanisms and an independent audit of custody and overlap. | One service receipt cannot simultaneously fund both full B purchase budget and A reserve credit. |

`burnBps` in the vault is the fraction of **positive service contribution** used for a USDG purchase budget. It is not a trading fee. PLTR is an intermediate swap asset in B, not a reserve credit. The present code does not select a model, fee, supply, allocation, custody policy, venue, legal scope or operator.

## Approval record to complete

The owner must write and sign: selected option and scope; policy version/hash; permitted assets/chain/deployment; exact BPS and recipients; supply/six allocations and rights; reserve or holdback/refund rule; legal owner and signer powers; measurement basis and operating limits. Independent financial-contract and accounting review must bind the same policy and deployment. No values are inferred here.

D3 implementation/deployment is conditional on A selection and review. D4 economic activation is conditional on B selection and review. Both are **BLOCKED** pending that record. G2, G3, G4 and G6 remain HOLD. No chain write or live economic action is authorized by this document.
