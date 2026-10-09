# E1 provider qualification: Runway KORD

Audit performed 2026-10-09. Status: **NOT QUALIFIED FOR A PAID RUN**. No paid provider endpoint, payment challenge, payment, or NWS endpoint was called. Only the provider's catalog-declared free routes were fetched.

## Non-billable public checks

At `2026-10-09T10:02:17.825Z`, the following exact free routes returned HTTP 200:

| Route | Bytes | SHA-256 |
|---|---:|---|
| `https://runwayoracle.com/` | 15,795 | `034e2b0bca68702939d1482277b20feeed5cea224a6de3dd29ed0de36d70d89f` |
| `https://runwayoracle.com/catalog.json` | 15,797 | `03269e9547f27d8c3b9e8a03c4d06407d68ec3409641190c34b10b8bcf21148c` |
| `https://runwayoracle.com/llms.txt` | 9,414 | `ef895b18a14b751addac921d348a33a750ef9b12db4c45f4629061449de3f971` |
| `https://runwayoracle.com/healthz` | 333 | `6ec86f66698f4c4c6da3dea7f574618d754f974b69f65d4803872644a0747528` |

The first-party catalog currently identifies Runway Weather Oracle, `eip155:8453`, Base USDC; it lists `GET https://runwayoracle.com/v1/oracle/v3/ord-edge`, Chicago O'Hare/KORD, live telemetry at $0.05 and degraded fallback at $0.01. The free material says requests receive HTTP 402 requirements and are retried with `X-PAYMENT`. These are provider-published claims, not independently verified service guarantees. See [catalog](https://runwayoracle.com/catalog.json), [landing page](https://runwayoracle.com/), and [LLM summary](https://runwayoracle.com/llms.txt).

## Qualification matrix

| Property | Finding |
|---|---|
| Current public catalog and KORD route | **PASS for discoverability only.** Current public catalog includes the endpoint. This does not qualify paid response delivery. |
| Public service terms, privacy/retention commitments, dispute/refund terms | **UNKNOWN.** No formal terms or privacy/service guarantee was identified in the free first-party resources checked. |
| Paid response JSON schema and required fields | **UNKNOWN.** Catalog lists summary and optional `strikeF`; it does not document the response body schema. |
| Provider-generated stable request ID | **UNKNOWN.** Not documented in the catalog, landing page, or `llms.txt`. |
| Provider-side delivery record, signature, retrieval API, or independently verifiable response binding | **UNKNOWN.** No documented method found. |
| Provider identity and endpoint ownership independently authenticated | **UNKNOWN.** TLS/domain reachability and catalog presence are not evidence of provider signing identity or delivered-result provenance. |
| Current operational health of the paid route | **UNKNOWN.** Free `/healthz` returned 200; no paid route or 402 challenge was requested. |
| x402 settlement evidence format | **Protocol-level, not provider-specific.** The official x402 HTTP transport describes `PAYMENT-RESPONSE` as a base64 settlement response with settlement fields; it proves the payment protocol's reported settlement, not that the HTTP body is authentic or bound to that transfer. See [x402 HTTP transport specification](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md). Independently verify the Base transaction and separately authenticate delivery. |
| Runway settlement behavior, recipient, exact quote, facilitator/gas allocation | **UNKNOWN.** Must inspect and approve a live 402 quote in a separate no-payment gate before signing anything. |
| NWS lineage independence | **Not independent.** Runway states measurements use the exact NWS stations used for market settlement. The proposed NWS reference shares the source family; the benchmark tests delivery and bounded contemporaneous agreement, not independent forecast skill. See [Runway landing page](https://runwayoracle.com/) and [NWS API documentation](https://www.weather.gov/documentation/services-web-api). |

## Decision

Runway is a **provisional candidate**, not an execution-qualified provider. Keep the endpoint pinned only as a candidate. Do not authorize payment until the provider publishes or supplies a response schema, request ID and independently reviewable delivery evidence, the operator has independently checked identity/terms and the actual quote/recipient, and an independent reviewer accepts the NWS-lineage limitation. If those requirements cannot be evidenced, abandon this candidate and select a task with independently inspectable delivery proof. The current run freeze remains blocked and disables all dispatch/payment flags.
