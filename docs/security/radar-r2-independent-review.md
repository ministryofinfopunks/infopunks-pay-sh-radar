# Radar R2 independent security and migration review

**Candidate:** `codex/radar-release-integration-r2` (PR #11)
**Candidate source SHA:** `00d847379a1530848a8789f33cc075bd0a25095e`
**Review state:** PENDING — no independent review is represented by this packet.
**Scope:** review the combined implementation and its exact final source SHA. Do not treat test results as approval.

## Required reviewer findings

For each item, record PASS, FAIL, or BLOCKED with the reviewed SHA, files/lines, attack or migration cases considered, and reviewer identity. Any source change invalidates the candidate qualification until rerun.

| Area | Reviewer question | Evidence requested |
|---|---|---|
| Tenant authorization | Are paid Judgment requests bound to verified tenant and agent claims? Can a caller-controlled `agent_id`, receipt ID, idempotency key, or wallet address establish ownership? | Owner, cross-tenant, wrong-agent, expired/invalid credential, missing identity configuration and operator cases. |
| Private ancestry | Are receipts, private proof recovery, decision contexts, execution and Evaluation reads tenant-private? | Direct HTTP status/body assertions for owner and denied callers; no existence leaks. |
| Encoded paths | Can percent-encoding, repeated encoding, separators, dot segments, query aliases, or path normalization bypass private route policy? | Adversarial request corpus against the compiled server and router. |
| Original-proof recovery | Is the original proof held in protected storage, matched to the original request, replayed idempotently, and prevented from double settlement? | Timeout, cancellation, expiry, concurrency, wrong-proof, retry and durable-restart traces. |
| Wallet approval | Does explicit payment authorization bound amount, asset, network, and recipient? Can browser Check or SDK defaults initiate payment or execution? | UI and SDK call traces showing explicit consent and one Judgment request; no automatic wallet transaction. |
| Settlement reconciliation | Does settlement require independent verification and preserve pending/failed state when the verifier is unavailable? | Reconciliation provenance, negative and retry evidence; no inference from client response. |
| Immutable authority | Are Observation → Judgment → Execution → Evaluation links canonical, immutable, and verifiable? | Receipt signatures, hashes, ancestry verification and mutation rejection. |
| Historical migrations | Are 017 and 020 adoption checks exact and fail closed, including the historical schema mismatch cases? Are migration bytes, IDs and checksums unchanged? | Clean install, baseline adoption, concurrent runners, checksum drift, repeat and backup/restore/replay. |
| Migration 022 | Is 022 compatible with both supported historical baselines and the selected publication boundaries? | Schema-before/after comparison and 017/020 upgrade result. |
| Billing provenance | Is paid use attributable to independently verified billing and settlement records rather than caller claims? | Data lineage from authorization through reconciliation and immutable receipts. |
| RPC-only recovery | Is recovery constrained to approved RPC evidence and prevented from accepting caller-supplied fabricated state? | Provider failure, malformed response, chain mismatch and replay cases. |

## Reviewer conclusion

- Reviewer: **PENDING**
- Reviewed source SHA: **PENDING — request review against `00d847379a1530848a8789f33cc075bd0a25095e`**
- Security outcome: **PENDING**
- Migration outcome: **PENDING**
- Required changes: **PENDING**
- Approval URL or review record: **PENDING**

PR #11 remains draft and release HOLD until the repository's required independent reviews and approvals exist on the final candidate.
