# E1 disposable staging checklist v1

Status: **not provisioned; no production access or writes**. Do not run until each prerequisite is evidenced and the separate operator authorization packet is signed.

## Environment and issuer

- Provision one disposable PostgreSQL instance in a dedicated test project/account. Record provider, instance ID, region, database name, TLS mode, owner, and expiration/deletion plan. Never point the harness at production or a shared staging database.
- Create a dedicated least-privilege DB role for the E1 harness. Scope writes to the staging receipt tables and reads to the rows needed for replay. Use a separate admin/migration role for setup; remove it after provisioning.
- Confirm production hostnames, production `DATABASE_URL`, and production issuer keys are absent from the run environment. Add an egress/allowlist rule that rejects production database and API hostnames. Capture the review artifact without connection strings or secret values.
- Apply only the migration versions necessary for the receipt spine in this disposable database. Record migration list and schema digest; preserve repository migration numbering and do not add or renumber production migrations for E1.
- Generate a test-only Judgment issuer key in an isolated secret manager. Record the issuer ID and public key; do not export the private key to logs, files, model providers, or the benchmark packet. Ensure the test issuer is not present in the production trust registry and cannot sign as a production issuer.
- Pin and hash a test-only public-key registry. Verify signature creation and validation against the test key, and verify that the same receipt is rejected when validated against the production registry.
- Judgment is **free and unpaid** in this run: `payment_required=false`, null payment receipt, zero charge. Use only the authenticated internal staging receipt path. Do not provision RH/USDG facilitator, paid Judgment challenge, or billing configuration.

## Archive and replay

- Before any run, export the empty initialized database and document restore procedure. After the run, take a transaction-consistent snapshot/export and separately archive original provider/NWS artifacts and their hashes.
- Encrypt archives at rest, restrict access to named reviewers, record access and export time, and keep an immutable/read-only copy. Redact secrets and `X-PAYMENT`/`PAYMENT-SIGNATURE` values from ordinary reports; preserve protocol evidence in a restricted encrypted artifact only if needed for audit.
- Restore the archive to a second disposable instance. Validate receipt content hashes and signatures, issuer registry digest, all exact parent pointers, subject/intent links, monotonic timestamps and state transitions, provider request/response hashes, finalized Base transfer proof, reviewer authorization, and replay report.
- Recompute Judgment from the frozen Observation, policy commit, configuration digest, and decision time. Byte-different or policy-different replay fails qualification and must be explained; never edit a receipt to make replay pass.
- Keep reputation projection disabled in the E1 staging environment as well as production. The current Evaluation service requires an Execution parent and nonempty evidence references, but does not authenticate the truth of those references or independently signed reviewer acceptance. Before appending E, a separate dual-control procedure must validate the reviewer signature and the bound artifact hashes; preserve its validation result with the archive. Do not infer independent verification from the generic internal Evaluation route.
- At teardown, revoke test credentials, retire the test issuer, retain the immutable evidence archive under approved retention policy, and delete the disposable database only after restore/replay artifacts are signed.

## Network and payment controls

- Configure a separate one-purpose Base wallet with at most 0.05 USDC plus native-token gas whose independently estimated value does not exceed $0.10. No production keys, broad token approvals, unrelated assets, or reusable allowance.
- Configure a read-only Base RPC verifier separate from the payment client. Pin network ID `eip155:8453`, the official USDC contract, finality policy, payer, recipient, token amount, transaction hash and block evidence in the run packet.
- Payment authorization is a distinct operator action after a prior approved no-payment quote request and independent inspection of the 402 requirements. Use a one-use authorization/nonce with narrow expiry if the x402 scheme supports it; unsupported wallet restrictions are **UNKNOWN** and must be resolved before signing.
- No retries. If request outcome is ambiguous, first reconcile provider logs and chain settlement; do not issue another paid request.
- Enforce outbound allowlisting to the pinned Runway endpoint, the selected NWS API resource, and the independent Base RPC. Deny production hosts and all other destinations.
