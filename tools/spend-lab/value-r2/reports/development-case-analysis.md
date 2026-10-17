# Original 20-case reviewer ledger

**HOLD. Toy utility only. All original cases retained; no proposed authority is derived from an economic label.** Economic false blocks mean foregone positive utility, not necessarily a protocol error. A veto or absent sufficient evidence still prohibits execution.

| Case | Canonical decision | No Radar net | Full Radar net | Judgment fee | Loss prevented | Gain missed | Outcome |
|---|---|---:|---:|---:|---:|---:|---|
| sum-ledger | proceed | 30 | 29 | 1 | 0 | 0 | profitable delivery retained |
| mean-telemetry | do_not_spend | 27 | -1 | 1 | 0 | 27 | economic false block |
| sort-prices | proceed | -9 | -10 | 1 | 0 | 0 | missed loss |
| dedup-addresses | insufficient_evidence | 21 | 0 | 0 | 0 | 21 | economic false block |
| csv-quoted | do_not_spend | -9 | -1 | 1 | 9 | 0 | correct abstention |
| json-path | proceed | 19 | 18 | 1 | 0 | 0 | profitable delivery retained |
| timestamp-offset | proceed | 21 | 20 | 1 | 0 | 0 | profitable delivery retained |
| sha256-bytes | do_not_spend | -8 | -1 | 1 | 8 | 0 | correct abstention |
| unicode-count | proceed | -4 | -5 | 1 | 0 | 0 | missed loss |
| currency-minor | proceed | 15 | 14 | 1 | 0 | 0 | profitable delivery retained |
| url-query | insufficient_evidence | -6 | 0 | 0 | 6 | 0 | correct abstention |
| interval-overlap | do_not_spend | -7 | -1 | 1 | 7 | 0 | correct abstention |
| text-tokenize | insufficient_evidence | 14 | 0 | 0 | 0 | 14 | economic false block |
| unit-conversion | proceed | 20 | 19 | 1 | 0 | 0 | profitable delivery retained |
| inventory-join | do_not_spend | -9 | -1 | 1 | 9 | 0 | correct abstention |
| markdown-title | proceed | -6 | -7 | 1 | 0 | 0 | missed loss |
| postal-validation | proceed | 18 | 17 | 1 | 0 | 0 | profitable delivery retained |
| service-unavailable | proceed | -13 | -14 | 1 | 0 | 0 | missed loss |
| slow-render | proceed | -6 | -7 | 1 | 0 | 0 | missed loss |
| percentile-nearest | do_not_spend | -7 | -1 | 1 | 7 | 0 | correct abstention |

Three economic false blocks: **mean-telemetry (27)**, **dedup-addresses (21)** and **text-tokenize (14)** missed net units, total **62**. The first is a paid hard veto; the other two are free insufficient-evidence assessments. These cases do not justify softening vetoes or granting spending permission on unknown evidence.

Six correct abstentions prevent **46** units: mean is not among them; CSV 9, exact hash 8, repeated URL values 6, half-open intervals 7, left join 9 and p90 7. Five qualified vetoes incur one judgment unit each; the URL insufficiency is free. Five unfavorable accepted deliveries lose **38** units before judgment fees; they remain in the report.

Fees: **17 paid judgments = 11 proceeds + 6 vetoes**; **3 insufficient assessments are free**. The paid veto fees include the one false mean veto. No fee is treated as execution permission. Original service charges/fees: no Radar **135 + 22**, full Radar **79 + 13**. Full Radar saves 65 in service charges/fees but forgoes 81 in gross task value, a 16-unit deficit before its 17 judgment fees. Audit-provider/setup cost was 157 authored units, disclosed separately rather than passed off as measured steady-state cost. Actual money/infra costs remain unknown.

**Reconciliation: 101 + 46 − 62 − 17 = 68; paired difference −33. Even a zero judgment fee leaves −16 incremental units.**

Case-by-case causes and safe next evidence:

- **sum-ledger**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **mean-telemetry**: Economic false block: mean-floor happens to return the correct 7 for [2,8,11]. A hard veto was supplied. Preserve it; independently reobserve/reattest the provider before any new decision, never override because this one output was good.
- **sort-prices**: Missed loss: lexical sort is not numeric sort; supplied evidence was favorable.
- **dedup-addresses**: Economic false abstention: normalization output matches the reference, but evidence is insufficient. Profit is foregone by design; obtain new sufficient scoped evidence rather than lowering the evidence requirement.
- **csv-quoted**: Correct veto: naive splitting breaks a quoted comma; service cost/fee would be lost.
- **json-path**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **timestamp-offset**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **sha256-bytes**: Correct veto: lowercasing input changes the exact case-sensitive byte hash.
- **unicode-count**: Missed loss: UTF-16 code units differ from Unicode codepoints; favorable evidence did not catch it.
- **currency-minor**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **url-query**: Correct abstention: only one query value is returned when the contract requires all q values; insufficient evidence remains free.
- **interval-overlap**: Correct veto: closed-endpoint overlap contradicts the half-open reference contract.
- **text-tokenize**: Economic false abstention: whitespace tokenization is correct, but evidence is insufficient. Independently refresh evidence; no execution on the existing assessment.
- **unit-conversion**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **inventory-join**: Correct veto: inner join drops the unmatched left row required by the left-join contract.
- **markdown-title**: Missed loss: correct output has negative declared value after price and fee; a static margin check catches this.
- **postal-validation**: Correct and timely local reference output; positive declared task utility after service price/fee. A favorable outcome does not establish a real provider market value or independent authority.
- **service-unavailable**: Missed loss: error response still incurs the declared price and fee; cheap reachability metadata catches this.
- **slow-render**: Missed loss: correct output arrives after the deadline; charge and fee remain; a bounded latency probe catches this.
- **percentile-nearest**: Correct veto: median differs from nearest-rank p90.
