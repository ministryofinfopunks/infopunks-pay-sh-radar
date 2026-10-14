# D2 — reproducible economic scenarios and conservation proof

**Status:** review tool only. Every scenario is synthetic; no live price, liquidity, reserve, trade, burn, funding, or approval is asserted.

`src/services/ipxEconomicScenarioService.ts` implements the exact-input formulas from `ipx-pltr-economic-mechanism-v1.md` with decimal-free atomic integers and floor rounding:

```text
buy_fee = floor(gross_buy × buy_levy_bps / 10,000)
reserve_credit = floor(buy_fee × reserve_share_bps / 10,000)
sell_fee = floor(gross_sell × sell_levy_bps / 10,000)
burn = floor(sell_fee × burn_share_bps / 10,000)
lock = floor(sell_fee × lock_share_bps / 10,000)
```

It rejects invalid basis-point values, a burn-plus-lock split above 10,000 bps, non-atomic amounts, and exact-output economics. Exact-output inversion and ceiling rules remain an unreviewed Model A dependency.

For Model B, it computes `N = G − C` and `floor(max(N, 0) × contribution_bps / 10,000)`. Unknown costs produce `BLOCKED_UNKNOWN_COSTS` with a zero allocation. A negative contribution is visible and has a zero budget.

The scenario catalog covers shallow/deep liquidity, normal/low activity, one-way flow, repeated round trips, alternate-route bypass, MEV, stale quotes, restrictions/freezes, USDG interruption, gas spikes, late refunds/losses, LP withdrawal, signing/accountant outage, and router failure. It labels all rows `SCENARIO_ONLY` to prevent them from being treated as observations.

The conservation proof operates per source and per asset unit. It rejects duplicate source IDs, liabilities plus reservations over funded assets, and any failed execution carrying a reservation. It does not sum USDG, PLTR, and IPX or infer cross-asset value.

## D3/D4 approval package remaining

| Package item | D3 Model A | D4 Model B |
| --- | --- | --- |
| Written model and parameter approval | Required | Required |
| Independent financial/accounting review | Required | Required |
| Live asset, venue, router and quote evidence | Required | Required |
| Legal owner/custody/refund/incident terms | Required | Required |
| Deployment or economic activation | Blocked | Blocked |

This evidence demonstrates arithmetic and fail-closed review behavior only. It cannot clear any economic or release gate.
