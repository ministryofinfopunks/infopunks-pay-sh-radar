# Radar R2.2 independent review packet

**Repository:** `ministryofinfopunks/infopunks-pay-sh-radar`
**Candidate:** PR #11, `codex/radar-release-integration-r2` (keep draft)
**Application source under review:** `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90`
**Previous qualified application/browser source:** `095b3b43365fb0bf890568b891074eceaeff74fe`
**PR head observed before this R2.2 follow-up:** `4bcaf5731cdadf1d5229ab93faea3a90fa9b17de`
**Review state:** PENDING. No independent review or approval is represented here.

The source commit above contains the narrow market-label contrast correction. Reviewers must fetch PR #11 after the follow-up is pushed, record the exact PR head they examined, and confirm it contains this application source. A review against an earlier PR head does not approve the final candidate. Do not treat automated tests or this packet as an approval.

## Security review checklist — independent reviewer required

For every row, record PASS, FAIL, or BLOCKED, examined requests/attack cases, evidence links and findings. A blank field is not a pass.

| Control | Required cases to examine | Reviewer result / findings |
|---|---|---|
| Credential-bound tenant and agent authority | Anonymous, same tenant/agent, same tenant/wrong agent, cross tenant, invalid and expired credential, missing identity configuration; spoofed `agent_id`, receipt ID, idempotency key and wallet | PENDING |
| Private receipt and ancestry access | Original Judgment, private receipt/proof recovery, parent/child ancestry, decision contexts, Execution and Evaluation; owner and denied callers; compare status, body and side channels for existence leakage | PENDING |
| Encoded-path policy | Percent-encoded slash/backslash, repeated encoding, dot segments, path normalization, query aliases, mixed case and router/proxy normalization | PENDING |
| Original-proof recovery | Protected storage, request/proof binding, timeout, cancellation, expiry, concurrent recovery, restart/durable retry, wrong proof, replay and no double settlement | PENDING |
| SDK payment authorization | Explicit consent; amount, asset, network and recipient bounds; no payment through browser Check; exactly one Judgment request; safe cancellation and timeout recovery | PENDING |
| Settlement verification | Independent verifier provenance, pending/failed state on verifier outage, chain/asset/recipient/amount matching, idempotent reconciliation and rejection of client assertions | PENDING |
| Canonical authority and immutability | Observation → Judgment → Execution → Evaluation references; signature/hash verification; mutation and invalid ancestry rejection; Judgment cannot imply execution/outcome | PENDING |
| Unsigned/unqualified issuance | Production with no signing key, invalid key, expired key, missing trust registry, unqualified evidence and disabled payment; issuance must fail closed | PENDING |
| RPC-only recovery | Approved RPC source, provider outage, malformed response, wrong chain, stale/fabricated caller state and replay | PENDING |
| Proxy and rate-limit trust | Spoofed forwarding headers, untrusted proxy path, direct ingress, per-process/shared limit assumptions and abuse response | PENDING |
| Secrets and observability | Credentials/proofs absent from URLs, local storage, browser logs, server logs, artifacts and CI; error redaction | PENDING |

### Security reviewer record

- Reviewer name and organization/role: **PENDING**
- Independence / conflict declaration: **PENDING**
- Exact PR head SHA reviewed: **PENDING — copy from PR #11 after fetch**
- Application source SHA reviewed: **PENDING — verify `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90` is contained**
- Files/commits examined: **PENDING**
- Attack cases actually executed (distinguish read from executed): **PENDING**
- Findings with severity and remediation: **PENDING**
- Outcome: **PENDING — PASS / FAIL / BLOCKED**
- Approval evidence (GitHub review URL and approved commit/head): **PENDING**
- Reviewer date: **PENDING**

## Migration review checklist — independent reviewer required

Preserve historical migration bytes, IDs and checksums. Do not waive schema validation or edit historical ledgers to obtain a pass.

| Migration control | Required cases to examine | Reviewer result / findings |
|---|---|---|
| Inventory and immutable history | Ordered 001–022 inventory, IDs/checksums, historical file byte comparisons, runner selection/publication boundaries | PENDING |
| Clean installation | Empty supported PostgreSQL database; apply all 22 migrations, inspect schema and migration ledger | PENDING |
| Historical baseline 017 | Reproduce the original `historical_baseline_schema_mismatch` from PR #9; validate schema state vs runner expectations; adopt 017 and apply the remaining migrations | PENDING |
| Historical baseline 020 | Reproduce the original mismatch; adopt 020; prove 021/022 apply with expected publication boundaries | PENDING |
| Migration 022 compatibility | Compare before/after schema for clean, 017-adopted and 020-adopted databases; check data preservation and constraints | PENDING |
| Concurrent runners | Multiple runners against the same target; prove serialization/idempotence and no partial ledger state | PENDING |
| Drift and invalid history | Modified checksum, missing/unknown migration, wrong baseline and schema mismatch must reject without mutation | PENDING |
| Repeat / recovery | Re-run after success; backup, restore to a new database, validate and replay durable receipts/ancestry | PENDING |
| Operational boundaries | Migration role least privilege, backup before apply, operator-run one-off job, no automatic deploy DDL | PENDING |

### Migration reviewer record

- Reviewer name and organization/role: **PENDING**
- Independence / conflict declaration: **PENDING**
- Exact PR head SHA reviewed: **PENDING — copy from PR #11 after fetch**
- Application source SHA reviewed: **PENDING — verify `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90` is contained**
- PostgreSQL version and runtime used: **PENDING**
- Historical mismatch reproductions / SQL evidence: **PENDING**
- Findings with severity and remediation: **PENDING**
- Outcome: **PENDING — PASS / FAIL / BLOCKED**
- Approval evidence (GitHub review URL and approved commit/head): **PENDING**
- Reviewer date: **PENDING**

## Release rule

Security and migration approvals must be separate, independent review records on the final PR head. No self-approval. Keep PR #11 draft and do not merge while either record, the human accessibility assessment, or any required CI check is pending or failing.
