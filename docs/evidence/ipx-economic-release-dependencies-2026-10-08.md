# Economic release dependency register

Baseline: `c56ca7e60efafb68a792223a173c2840cd274c50`. Every item below is a dependency, not evidence of completion. Status is **HOLD** unless an exact candidate, policy and deployment are independently verified.

| Package | Prerequisite and required evidence | Approval/authority boundary | Gate |
| --- | --- | --- | --- |
| D1 | Written selection of A, B, neither or separately reviewed hybrid, with exact policy hash and owners | Owner selection required | G2 |
| D2 | Conservative simulations with approved rates plus measured venue, activity, cost and liability assumptions; independent arithmetic review | Rate and risk-limit approval required | G2 |
| D3 | A selection; actual compatible venue; reviewed exact-output/multihop/bypass, reserve custody and permanent-lock architecture | Independent contract/legal review and explicit deployment approval | G2–G4 |
| D4 | B selection; all-cost/refund/holdback evidence; unique source-to-vault funding; executable quote, route and supply-burn proofs | Independent accounting/security review and activation approval | G2–G4 |
| D5 | Read-only public ledger with full parent closure, cursor pages, finalized roots, model/policy hashes, custody/obligations and visible gaps. Reserve is null unless independently verified; report burns separately from locks and budgets. | Reviewed legal rights, jurisdiction/participant scope, operator and signer powers, material finding closure | G4 |
| B3 | Finalized USDG merchant receipt through SERVICE→REVENUE→CONTRIBUTION→PURCHASE→BURN, dedupe and cost evidence, with negative/retry cases | No transfer or burn until authorized | G2/G3 |
| B4 | Machine-validated launch manifest with explicit TBDs, approved values, on-chain getters/bytecode at a finalized block | Human policy and production acceptance approval | G2/G3 |
| C6 | B approval and verified deployment followed by bounded real paid judgment, funded contribution, purchase and canonical burn with complete receipts and negative/pending outcomes | Separate live transfer/operator approval | G3/G5 |

G6 requires G0–G5 evidence against **one** frozen code SHA, approved policy hash, deployment and launch limits. D5 publication must not assert PLTR backing, guaranteed price support, permanent lock or universal trade fees without proof. Missing external evidence blocks only its dependent gate; it does not convert synthetic D2 output into observed economics.
