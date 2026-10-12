# Radar R2.2 isolated Railway staging readiness package

**Repository:** `ministryofinfopunks/infopunks-pay-sh-radar`
**Candidate:** PR #11, `codex/radar-release-integration-r2`
**Application source:** `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90`
**PR head observed before this evidence follow-up:** `4bcaf5731cdadf1d5229ab93faea3a90fa9b17de`; final head and CI must be copied from PR #11 after push.
**Deployment performed:** None. This is a readiness checklist, not a Railway deployment or an authorization to create billable resources.

## Guarded staging profile

Prepare a separate Railway project/environment and private PostgreSQL service. No production database, domain, key, payment account or project binding may be reused. Keep ingress restricted to named reviewers/testers until the access test passes. Keep these capabilities disabled and verify the effective process environment after deploy authorization:

```text
JUDGMENT_PAYMENT_ENABLED=false
MACHINE_EXECUTION_ENABLED=false
MACHINE_DEMO_SEED=false
IPX_PLTR_SHADOW_OBSERVATION_ENABLED=false
IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED=false
RH_CHAIN_AUTOMATION_ENABLED=false
RH_4663_PHASE2_ENABLED=false
RH_4663_PHASE3_ENABLED=false
RH_4663_PHASE3_PUBLICATION_ENABLED=false
RH_4663_AUTO_PUBLICATION_ENABLED=false
RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
RH_4663_CAMPAIGN_REHEARSAL_ENABLED=false
MONITOR_ENABLED=false
MONITOR_ALLOW_PAID_ENDPOINTS=false
```

Do not bind Judgment issuer signing keys, facilitator URL, payment recipient, funded wallet, token-operation keys, IPX launch keys, execution signing keys, production RPC credentials or production secrets. No x402 payment attempt is permitted in this profile. An unsigned or unqualified Judgment must remain unavailable/fail-closed. The existing controlled-staging guards reject forbidden bindings/flags and restrict writes; retain those checks and test them against the rendered configuration rather than relying on this example alone.

## Operator readiness checklist

Every item remains **OPEN** until an authorized operator records evidence. Use the evidence cells; do not mark planned controls as provisioned controls.

| Area | Required isolated-staging control and evidence | Current status |
|---|---|---|
| Railway boundary | New isolated project/environment, access list, region, private service discovery, no production project/service bindings; record project/environment IDs and reviewers | OPEN — not provisioned |
| PostgreSQL | Operator-pinned supported PostgreSQL major/minor; private networking; TLS; dedicated least-privilege app and migration roles; app pool/connection caps; no public DB ingress; record actual `SHOW server_version` | OPEN — not provisioned |
| Migration history | 22-migration inventory; inspect existing ledger/schema; take backup first; operator-only one-off migration job with migration role; verify 017 and 020 adoption logic and 022 boundaries; never run DDL automatically during app deploy | OPEN — package only; CI evidence must bind to final candidate |
| Backup / restore | Set retention and RPO/RTO; prove point-in-time or snapshot backup; restore to a new isolated DB; validate migration ledger and durable receipt/ancestry replay; keep source DB unchanged | OPEN — no Railway backup/restore performed |
| Tenant credentials | Provision synthetic, short-lived, tenant/agent-bound credentials out of band; give each reviewer only their tenant; test owner/cross-tenant/wrong-agent/expired/invalid/missing-identity cases; prohibit shared operator or caller-selected ownership | OPEN — no staging credential provisioned |
| Signing keys | No Judgment signing key in this readiness profile. If an authorized future test requires signing, use a staging-only KMS/HSM-managed, narrowly permissioned and rotatable key after independent review; do not export private key material to build logs or CI | OPEN / intentionally absent |
| Catalog freshness | Select an operator-approved HTTPS catalog origin; verify source identity, freshness and cache/stale policy; no fixture fallback in production-like staging; no production API credentials unless explicitly reviewed and isolated | OPEN — catalog source not bound |
| RPC trust | Pin approved read-only RPC endpoints, TLS/egress policy, chain ID and confirmation/finality assumptions; test stale, malformed, wrong-chain, unavailable and disagreeing provider behavior; recovery may rely only on verified RPC evidence | OPEN — RPC bindings absent |
| x402 facilitator | No facilitator binding or live payment in this staging scope. If later authorized, use a sandbox/mock facilitator and synthetic balance only; validate recipient, asset, chain, amount, resource, proof retention, replay, timeout, reconciliation provenance and no double settlement; record facilitator settlement evidence separately from app health | OPEN — no facilitator configured; no settlement evidence |
| Proxy / ingress | Restrict ingress; configure only known proxy hops; verify forwarded IP/proto headers cannot be caller-forged; HTTPS origin and cookie/header behavior; request/body limits | OPEN — no Railway proxy path qualified |
| Rate limiting | Confirm effective shared/distributed limits at ingress and app; test burst, concurrency, tenant isolation, proxy identity and restart reset behavior; monitor 429s without logging credentials | OPEN — production topology unknown |
| Monitoring | Health/readiness, DB pool/circuit, catalog age, signing/payment disabled state, error rates, latency, disk/connection saturation; synthetic alerts; no payment/secret payloads in telemetry | OPEN — alert routes not configured |
| Incident response | Named operator and escalation path; access revocation; credential/key rotation; preserve immutable logs without secrets; database snapshot procedure; incident severity/runbook and rollback authority | OPEN — no operator roster/runbook contacts recorded |
| Rollback | Pin candidate image digest and prior guarded image; stop traffic on failed boot; do not reverse destructive migrations in place; restore into a new isolated DB and replay/validate; record rollback owner and decision threshold | OPEN — image digest and rehearsal absent |
| Product boundary | Public market intelligence stays read-only; no token operations, wallet connections, autonomous execution, IPX activation, production secrets or paid Judgment | READY AS POLICY; runtime recheck pending |
| Access / privacy | Confirm anonymous routes do not request private wallet/history/reputation; test tenant-private receipts and ancestry through the actual deployment proxy; inspect logs and browser storage | OPEN — local/CI evidence exists on predecessor candidate; staging HTTP absent |

## Authorization sequence

1. Keep PR #11 draft. Bind the exact final head to successful GitHub checks.
2. Obtain independent Security and Migration reviews recorded against that exact head.
3. Complete human accessibility review: VoiceOver or NVDA, keyboard-only traversal, native 200%/400% browser zoom, and manual review of measured contrast limitations.
4. Have the repository/environment owner approve a bounded isolated staging experiment, costs, access list, retention and rollback owner.
5. Provision only isolated managed PostgreSQL and synthetic tenant credentials; start with payment, signing, token, and execution capabilities disabled.
6. Apply migrations only after backup and reviewed schema-history/adoption evidence; rehearse restore to a separate database.
7. Run authenticated and anonymous HTTP tests through the actual Railway proxy; inspect effective configuration and logs. Do not infer payment settlement from a mock or healthy container.

### Decision

**Authorization to begin isolated staging: HOLD.** Independent security/migration approvals, complete human accessibility sign-off, final-head CI and an operator-owned isolation/rollback plan are not yet recorded. The package is ready for those reviews; Railway resources have not been provisioned.

**Public paid launch: HOLD.** No production authorization, live payment, x402 settlement, independent live reconciliation, production signing-key control, token operation or execution qualification is represented by this package.
