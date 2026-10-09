# E1 operator authorization packet v1 — NOT AUTHORIZED

This is a review packet for one prospective staging experiment. It is **not** approval to make an external request, pay, deploy, or write production data. No provider request or payment has been made. All signature/approval fields remain blank.

## Proposed single task

- Provider: Runway Weather Oracle, provisional and not qualified.
- Method/endpoint: one `GET https://runwayoracle.com/v1/oracle/v3/ord-edge` request for KORD, no optional query parameters.
- Settlement asset/network: at most **0.05 USDC on Base (`eip155:8453`)** for live telemetry. Stop if quote is degraded, exceeds the cap, uses a different asset/network, or identifies an unapproved recipient.
- Judgment monetization: **$0.00**. Judgment is a free, unpaid receipt written only to isolated staging. RH/USDG is outside this E1 task.
- Expected HTTP sequence once separately authorized: at most one initial quote/challenge request without payment, then at most one paid retry after separate settlement approval. Exactly one paid request; zero retries. The initial request is not authorized by this packet until the request approver signs.
- OpenAI Decisions: disabled. No model output can authorize or modify spend.
- Writes: disposable staging only; no production database, deployment, signing authority, billing, reputation mutation, or settlement outside the single approved Base payment.

## Maximum aggregate outlay

| Item | Absolute ceiling |
|---|---:|
| Runway service | 0.05 USDC (approximately $0.05 at par; final denomination must be checked in the approved quote) |
| Base network/facilitator/wallet fees combined | $0.10 USD equivalent |
| Free staging Judgment | $0.00 |
| **Maximum all-in** | **$0.15 USD equivalent** |

No staging infrastructure cost is authorized under this cap. Use an already-provisioned disposable environment. If an infrastructure, facilitator, conversion, or other fee would be charged, stop and seek a new approval with a revised all-in cap. Do not round fees outside the cap.

## Wallet and signing controls

- Use one isolated, one-purpose staging payer wallet with no production association and no more than 0.05 USDC available for this task. Fund only after approvals.
- Native Base gas balance may cover only this single transfer; its total fee must remain at or below $0.10 USD equivalent. Wallet funding itself must be included in the approved total.
- No unlimited allowance, no token approval, no wallet delegation to a model, no private-key transfer to the provider, and no key or signing capability in OpenAI/Runway request context.
- Inspect and record the exact 402 quote, recipient, asset contract, amount, network, facilitator, expiry, and payment scheme before signing. Reject if any field is missing or differs from the frozen authorization. Have the independent reviewer verify quote and recipient. Settlement approval must be renewed if quote changes or expires.
- Preserve transaction proof in restricted evidence storage. Ordinary logs/reports must redact payment signatures and secrets.

## Abort conditions

Abort before payment if any of the following applies: provider qualification remains incomplete; reviewer rejects the NWS lineage limitation; provider identity, response schema, request ID, or delivery-proof mechanism is unresolved; quote is absent, degraded, stale, malformed, over cap, or names a different network/asset/recipient; gas/facilitator charges exceed cap; staging or test issuer isolation is unproven; source observation is stale or unavailable; request would reach production; one request has already been attempted; timeout/rate limit/5xx/refusal/schema mismatch occurs; payment/response status is ambiguous; or any reviewer/operator signature is missing.

After a payment, do not retry, compensate, settle again, or create Evaluation if delivery or outcome is ambiguous. Preserve the actual evidence as pending/failed for independent review. Never fabricate an Execution or Evaluation to complete the chain.

## Separate approval gates (all blank)

| Gate | Approver / reference | Decision |
|---|---|---|
| Runway identity, terms, schema, request ID and provider delivery-proof qualification | ____________________ | ☐ approve ☐ reject |
| Disposable staging, DB, test issuer and key isolation | ____________________ | ☐ approve ☐ reject |
| Frozen task/rubric, policy/configuration hashes and source-lineage acceptance | ____________________ | ☐ approve ☐ reject |
| Non-payment quote request: exact endpoint and one attempt | ____________________ | ☐ approve ☐ reject |
| Exact Base settlement: 0.05 USDC maximum + fees within all-in $0.15 | ____________________ | ☐ approve ☐ reject |
| Independent blinded pre-spend review | ____________________ | ☐ approve ☐ reject |
| Independent outcome review before Evaluation append | ____________________ | ☐ approve ☐ reject |

Approvals do not enable Decisions spend influence, RH/USDG Judgment monetization, production writes, reputation mutation, or deployment.
