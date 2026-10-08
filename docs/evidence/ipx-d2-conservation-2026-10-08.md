# D2 scenario and conservation evidence

Baseline: `c56ca7e60efafb68a792223a173c2840cd274c50`. Source: `docs/ipx-pltr-economic-mechanism-v1.md`. Status: local arithmetic and review evidence only. **Every output is a hypothetical scenario, not a measured market observation, verified reserve, purchase or burn.**

`src/services/ipxEconomicScenarioService.ts` accepts unsigned policy variables only as inputs. No rate is approved. All calculations use atomic integer amounts, floor rounding and 10,000 basis-point denominator. PLTR buy units and IPX sell units are conserved independently. A's fee is assigned to swap input, reserve share and explicit other fee; the sell fee is assigned to swap input, burn, lock and other fee. Exact-output is rejected pending audited inversion and ceiling rules. Actual reserve/burn credit remains zero until external custody and canonical supply evidence is verified.

For B, the simulation calculates signed `N = G − C` and `floor(max(N,0) × contributionBps / 10000)`. Unknown costs block allocation, while a reported zero is only a claim pending cost-evidence review. The source proof rejects duplicate source identity (including reuse under another asset), unfunded liabilities/reservations, credits before settlement and failed executions with a retained reservation. Each position is checked in its own atomic asset units; the simulation does not add USDG, PLTR and IPX together or assume an exchange rate.

The scenario catalog covers shallow/deep liquidity, normal/low activity, one-way flow, repeated round trips, alternate-pool bypass, MEV/sandwich, stale quote, asset freeze, USDG interruption, gas spike, loss/late refund, LP withdrawal, accountant/signer outage and router failure. The catalog defines stress cases; it does not fabricate numerical liquidity, market impact, gas or order flow. Those outputs need an actual venue, measured quotes and policy assumptions before an economic decision.

## Reproduction

The package worktree ran `./node_modules/.bin/vitest run tests/ipx-economic-scenarios.test.ts` (1 file, 6 tests passed) and `npm run typecheck` (exit 0). The test uses 500 deterministic input/rate combinations plus invalid-input, duplicate, unknown-cost and scenario-label checks. The worktree started at the stated baseline; integration must repeat checks on its exact frozen candidate. No local test can clear G2 or establish operational solvency without measured assets, liabilities and approvals.
