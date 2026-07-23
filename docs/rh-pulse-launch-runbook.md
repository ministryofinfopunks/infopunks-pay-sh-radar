# RH Pulse controlled launch runbook

This is the operator runbook for `RH Pulse: Call the Rotation`. It does not authorize a launch by itself. Production calls remain disabled until every readiness check and the separately recorded physical-device wallet gate pass.

## Immutable launch rules

- Use the existing Radar Render Web Service, shared backend and shared Postgres database.
- Deploy application code and attach the Pulse domain before enabling calls.
- Never fabricate an open window, source evidence, community calls or a resolution.
- Never run a destructive down migration after public signed calls or Rotation Receipts exist.
- Never delete accepted calls. Emergency actions disable participation and close/cancel window authority while preserving provenance.
- `RH_PULSE_CALLS_ENABLED=false` and `RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=false` are the safe defaults.

## Domain and TLS

1. Attach `pulse.infopunks.fun` as an additional custom domain on the existing Radar Render Web Service.
2. Configure the DNS record to the exact target Render supplies after domain attachment. Do not guess or hard-code the target in this repository.
3. Wait for Render-managed TLS to become valid.
4. Verify:

   ```text
   https://pulse.infopunks.fun/
   https://pulse.infopunks.fun/methodology
   https://radar.infopunks.fun/
   https://radar.infopunks.fun/rh-pulse
   ```

5. Confirm the Pulse host has Pulse title/canonical/OG metadata and the Radar root retains Radar metadata.

## Environment authority

| Variable | Exposure | Read-only mode | Required before production calls |
|---|---|---:|---:|
| `DATABASE_URL` | server only | optional for static/read-only development; required for durable public history in production | yes |
| `PULSE_PUBLIC_HOST=pulse.infopunks.fun` | server configuration | yes | yes |
| `RH_PULSE_CALLS_ENABLED=false` | server configuration | safe default | must be changed deliberately |
| `RH_PULSE_CHALLENGE_TTL_SECONDS=300` | server configuration | optional | yes |
| `RH_PULSE_INTERNAL_TOKEN` | server secret, 32+ chars | required for internal operations | yes |
| `RH_PULSE_RATE_LIMIT_SECRET` | server secret, 32+ chars | optional | yes |
| `RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=false` | server-only operator attestation | safe default | must be explicitly `true` only after the recorded manual matrix passes |
| `VITE_WALLETCONNECT_PROJECT_ID` | intentionally browser-exposed public project ID | optional | yes |

Do not prefix internal or rate-limit secrets with `VITE_`. Do not put database URLs, bearer tokens, HMAC secrets, seed phrases, signatures or WalletConnect session material in build arguments or client assets.

## Migration procedure

The production migration operator must:

1. Back up Postgres and record the restore point.
2. Record the current `infopunks_schema_migrations` ledger.
3. Compute and record SHA-256 hashes for the checked-in migration files.
4. Apply missing up migrations in filename order using the established production migration mechanism and `ON_ERROR_STOP` semantics:

   ```text
   20260723_007_rh_pulse_signed_calls.up.sql
   20260723_008_rh_pulse_rotation_resolutions.up.sql
   20260723_009_rh_pulse_launch_throttles.up.sql
   ```

5. Verify the ledger filenames and hashes match the deployed source.
6. Verify the expected tables, triggers and indexes:

   ```text
   rh_pulse_windows
   rh_pulse_call_challenges
   rh_pulse_calls
   rh_pulse_call_receipts
   rh_pulse_counters
   rh_pulse_audit_events
   rh_pulse_resolution_runs
   rh_pulse_rotation_receipts
   rh_pulse_rate_limit_buckets
   ```

7. Verify `rh_pulse_windows_one_open_idx`, both receipt immutability triggers, and `rh_pulse_rate_limit_buckets_expiry_idx`.

Do not use the local Postgres gate migration command against production; it deliberately accepts only the isolated `127.0.0.1:55463/rh_pulse_gate` database.

Migration `009` contains disposable HMAC-keyed throttle buckets and can be removed by its down migration if required. Migrations `007` and `008` are provenance-bearing: after signed calls or Rotation Receipts exist, their down migrations intentionally refuse. Production recovery is flag-first and fix-forward.

## Read-only deployment

1. Deploy with:

   ```env
   RH_PULSE_CALLS_ENABLED=false
   RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=false
   ```

2. Verify the Pulse home, methodology, historic public calls, historic Rotation Receipts, default OG image and any existing receipt-derived share images.
3. Verify `/v1/rh-pulse/calls/challenge` and `/v1/rh-pulse/calls` reject participation while public reads remain available.
4. Verify Radar routes and metadata remain unchanged.
5. Run the production-readiness inspection with the internal bearer token:

   ```bash
   curl -fsS https://pulse.infopunks.fun/internal/rh-pulse/production-readiness \
     -H "Authorization: Bearer $RH_PULSE_INTERNAL_TOKEN"
   ```

   Status remains `disabled` while the feature flag is false, but every infrastructure check still reports pass/fail. Do not continue with unresolved blockers.

## Physical-device gate

Execute [rh-pulse-wallet-launch-gate.md](rh-pulse-wallet-launch-gate.md) using no-funds test wallets and a staging or isolated pilot window. Record device, OS, browser/wallet versions, result and receipt IDs. Only after every mandatory row passes may the operator set:

```env
RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=true
```

This variable is an operator attestation, not an automated test. It is false in repository defaults and was not attested during Phase 3B.

## Safe Genesis first-window sequence

The safest order avoids both an unintentionally open-but-hidden window and an enabled endpoint with an accepting window:

1. Keep calls disabled.
2. Create the Genesis window in `not_open` state through the authenticated internal API.
3. Inspect the exact window timestamps, methodology `rh-pulse-v1.0`, source health and audit metadata.
4. Complete and record the physical-wallet gate.
5. Confirm migrations, renderer, secrets, trusted host and WalletConnect configuration.
6. Set the physical-wallet attestation true and set `RH_PULSE_CALLS_ENABLED=true` in one reviewed environment change; restart.
7. Confirm startup succeeds and `/internal/rh-pulse/production-readiness` returns `ready`. With no open window, challenge creation must still reject.
8. Open the already-reviewed Genesis window.
9. Submit one controlled no-funds canary call. Verify exact EIP-191 text, one call, one receipt, public number, share image and public metadata.
10. Monitor the first submission cohort before announcing broader access.
11. At the deadline, close the window through the authenticated route. Database/server time and the locked window remain authority.
12. Inspect resolution readiness, preview, draft, approve and publish according to the Phase 3A procedure.
13. Verify correct/incorrect public calls and the immutable Rotation Receipt artifacts.
14. Disable calls after the pilot if continued participation is not explicitly approved.

No automatic window or resolution scheduler exists.

## First-window monitoring

Watch the existing bounded logs/metrics for:

- challenge requests/rejections;
- signature successes, invalid signatures, duplicates and replays;
- accepted call count and counter failures;
- Postgres transaction latency/rollback;
- rate-limit decisions by bucket type only;
- receipt creation and public receipt-page reads;
- SVG/PNG render success, fallback and latency;
- X/native/copy/download actions through bounded client events;
- resolution readiness, approval/publication and conflicts.

Operational records must not contain raw signatures, full messages, nonces, raw IPs/origins, full wallet addresses, bearer tokens, HMAC secrets or WalletConnect session secrets.

## Emergency operations

### Stop participation

1. Set `RH_PULSE_CALLS_ENABLED=false` and restart all instances.
2. Confirm new challenges and submissions stop.
3. Keep public calls, receipts, resolutions and images readable.

### Close an accidentally open valid window

After disabling calls, call the authenticated close endpoint. Closing preserves accepted calls and permits later reviewed resolution.

### Cancel a malformed window

After disabling calls, use the authenticated cancel endpoint with a bounded reason. Cancellation preserves any accepted provenance and rejects future calls. Do not cancel merely to change a result.

### Database outage

- Before a challenge: issue no challenge and present the recoverable unavailable state.
- During submission: rely on transaction rollback; no public number, Genesis rank, call, receipt or challenge-use update may survive.
- After restore: inspect the database and audit state before retrying. Use an existing challenge only if it remains unused and unexpired; otherwise create a new challenge.

### Artifact renderer outage

Calls and Rotation Receipts remain valid. Public pages continue to load, dynamic image endpoints emit bounded failure logs and serve the non-claiming generic Pulse fallback where possible. Restore the renderer and verify the receipt-derived ETag before announcing recovery.

### Internal token rotation

Rotate the server-only value and restart all instances. The old token must fail; public APIs remain unaffected. Do not rotate the rate-limit HMAC secret casually—changing its version starts distinct privacy buckets and must be recorded.

## Application rollback

1. Disable calls first.
2. Preserve signed calls, call receipts, resolution runs and Rotation Receipts.
3. Roll application code back only to a version compatible with the already applied additive migrations.
4. Do not run migration `007` down after a signed call or `008` down after a published Rotation Receipt.
5. Leave `009` in place unless an operator specifically needs to remove disposable buckets and the target application does not reference the table.
6. Record the incident, environment changes, window action, database inspection and recovery approval.

No operation in this runbook deletes an accepted call.
