# Judgment DX-1 developer guide

`createInfopunksClient` obtains an assessment and handles a caller-authorized Judgment fee. It never executes the proposed task or trade. Insufficient evidence remains a free successful response with no paid receipt. The original `createInfopunksPreSpendClient` / `checkPreSpend` entry points and compatibility envelope remain available; supply an Authorization header on authenticated deployments.

## One call

```typescript
import { createInfopunksClient, createX402WalletPayment } from "infopunks-pay-sh-radar/sdk";
import { createEncryptedJudgmentSessionStore } from "infopunks-pay-sh-radar/sdk/session-store";

// signer is an existing standard EVM signer: address + signTypedData.
// approveFee is your explicit human or delegated-budget authorization policy.
const payment = createX402WalletPayment({
  signer,
  policy: {
    network: "eip155:4663",
    asset: "USDG",
    payTo: process.env.INFOPUNKS_MERCHANT!,
    maxAmountAtomic: "10000" // 0.01 USDG; six decimal places
  },
  approve: approveFee
});
const radar = createInfopunksClient({
  apiKey: process.env.INFOPUNKS_API_KEY!,
  payment,
  sessionStore: createEncryptedJudgmentSessionStore({
    directory: "/private/radar-sessions",
    encryptionKey: Buffer.from(process.env.INFOPUNKS_SESSION_KEY!, "base64")
  }),
  trustedIssuer: independentlyPinnedIssuerRegistry,
  onTransition: event => recordWorkflowState(event)
});
const result = await radar.judge({
  intent: "buy market research",
  budget: 0.20,
  subject: "route:market-research"
}, { idempotencyKey: job.assessmentId });
```

The signer, approval callback, business-job ID, credentials, protected directory/key and pinned issuer registry come from your application. The merchant/network/asset must match the operator's actual reviewed rail; the example is not a claim of deployed USDG settlement. Only EIP-3009 is supported by the supplied signer adapter. Permit2 approval/sponsoring flows are refused. The SDK caps the fee against both `budget` and the explicit atomic fee ceiling, checks the exact merchant/token/network, and calls the signer only after approval. The SDK source is in this repository; no npm publication is claimed.

The short call may omit the explicit key, session store and pinned registry for a process-local integration: the client generates a UUID, persists it in memory before the first assessment, and returns `sessionId`. **For crash recovery, use a persistent protected store and retain its encryption key.** Memory storage ends with the process. The Node store uses AES-256-GCM, private directory/file permissions, atomic publication, fsync and an immutable first-proof pin. Browser persistence adapters are refused; the browser default is memory only. Credentials and payment signatures are never emitted in workflow events.

## Recovery and errors

```typescript
try {
  const result = await radar.judge(input, { idempotencyKey: assessmentId, signal });
} catch (error) {
  if (error instanceof InfopunksJudgmentError) {
    // Persist the non-secret session ID, not a signature or credential.
    // An explicit later recovery first inspects the authenticated journal.
    const result = await radar.resume(error.sessionId);
  }
}
```

Import `InfopunksJudgmentError` from the same SDK. Do not turn the example into an unconditional retry loop. `PAYMENT_PENDING_RECONCILIATION` means stop and wait for operator confirmation. A transport failure after proof submission never triggers automatic resubmission. Resume checks the journal: `settling` stops; `quoted` proves no settlement claim occurred and permits the original authorized submission; `settled`/`complete` permit proof-bound recovery without another settlement. An absent submitted record remains pending. Resume never replaces a missing original proof.

States are `REQUESTED`, `ASSESSED_FREE`, `PAYMENT_REQUIRED`, `PAYMENT_AUTHORIZED`, `PAYMENT_SUBMITTED`, `SETTLED`, `RECEIPT_VERIFIED`. A free result finishes in `INSUFFICIENT_EVIDENCE`. Typed failures also include `INVALID_REQUEST`, `UNAUTHORIZED`, `PAYMENT_DECLINED`, `PAYMENT_PENDING_RECONCILIATION`, `PAYMENT_VERIFICATION_FAILED`, `QUOTE_EXPIRED`, `SERVICE_UNAVAILABLE`, `RECEIPT_VERIFICATION_FAILED` and `CANCELLED`. Errors expose fixed state/code, session ID and a next action; raw wallet/network errors are not attached. State observers cannot mutate authority or payment behavior. Authentication/input preflight failures are observable as typed rejections; persisted workflow transitions use `onTransition`.

Same key/same request is recovery. Same key/different request is a conflict. A new assessment after collecting evidence needs a fresh key. Concurrent identical calls within one client are coalesced; server compare-and-set and payment/settlement uniqueness remain the final payment guard. Do not use secrets as idempotency keys.

## Identity and private evidence

An operator generates a random opaque API key and configures **only its SHA-256 hex digest** with trusted tenant/agent bindings:

```json
[
  {
    "tenant_id": "your-tenant",
    "agent_id": "your-agent",
    "key_sha256": "<64 lowercase hex characters>"
  }
]
```

Set this JSON as `JUDGMENT_API_KEYS_JSON`. Generate keys with at least 32 random bytes encoded as base64url; never ship demo keys. Keys are not self-issued by the public API. Never reuse a credential for another tenant, and never issue the operator admin credential as a tenant key. Rotate/revoke by changing the operator registry and restarting; retain/migrate protected client sessions deliberately when rotating credentials. Malformed/duplicate bindings and operator-key reuse fail sanitized runtime validation. Without tenant authority, private endpoints remain closed. Enabling production payments additionally requires a configured identity registry; this change does not enable payments.

`GET /v1/judgment/session` resolves the trusted agent, so the three-field SDK call does not guess `agent_id`. A raw request's `agent_id` must match that binding. Request keys include tenant identity. Owner reads additionally require the same agent binding; knowing an agent ID, receipt ID or idempotency key grants no access.

- `/v1/judgments/requests/:key`: state discovery only; no proof, paid receipt or payment reference.
- `/v1/judgments/history`: bounded owner-only history, at most 100 paid and 100 free entries.
- `/v1/receipt-spine/{kind}/{id}` and Judgment context/verify: owner-bound receipt ancestry or operator access.
- Global causal tapes, free-attempt feeds, witnesses, score detail, revenue and attribution: operator-only.
- Production unowned legacy receipt feeds, receipt-bearing detail/graph/check/run exports: operator-only until an approved public projection or owner model exists.
- Production `/4663/me/*`, wallet proof/reputation profiles, profile HTML and OG images: operator-only. A wallet query/header is not authentication; no trusted tenant-to-wallet binding is available. Existing published market-resolution/share projections stay separate from paid Judgment records.
- Issuer/execution-authorization public-key discovery and ordinary catalog/market telemetry remain metadata discovery, not authority to read private records.

Historical unowned receipts remain operator-only; they are not assigned to whoever presents an ID or old payment proof. A reviewed historical ownership migration is required before promising tenant replay of pre-DX purchases. Receipt bytes/signatures and existing migration files are unchanged.

## Integrity and presentation

The SDK binds the result to the authenticated tenant, agent, session key and complete request; checks receipt hash, parent hashes/payload hashes, and the committed decision-context hash; and verifies an Ed25519 issuer signature when an independently pinned registry is supplied. `verification.issuer="unverified"` is explicit when no trust root is pinned. Fetching keys from the same endpoint is discovery, not independent trust. Expired paid receipts replay as history without renewed validity or execution permission.

`presentation.version="judgment-presentation.v1"` is optional and non-authoritative. It explains decision, blockers and next action outside immutable hashes. Fee settlement, task execution and an independently verified outcome are different facts. A paid Judgment cannot itself authorize or prove execution.

RPC-only recovered payments omit the optional `facilitator_attested` billing tag, because no successful facilitator settlement response was received. Confirmed payment reference/charge remain sealed; private `payment_confirmation.version="judgment-payment-confirmation.v1"` exposes the independently checked journal witness outside receipt hashes. Automated economic revenue recognition for these receipts remains closed pending a reviewed versioned billing-provenance profile. No false facilitator attestation or new immutable field is introduced.

Token/market/pool subjects, token addresses, tokenized settlement preferences and token/market observation kinds cannot use the service-provider policy. A separately qualified market policy is required. The SDK shorthand currently supports route/provider/service subjects only.
