# Infopunks //4663 Phase 3 — Make the Chain Speak

Phase 3 is one evidence-first intelligence engine with multiple read lenses. It extends the Phase 1 `rh_4663_events` normalized layer and does not change the frozen RH Pulse categories, Phase 2 resolution inputs, receipt semantics, or anchor rules.

## Pipeline and identity

The durable path is:

`provider/community observation → normalized event → candidate → publication policy → immutable Signal Card publication → web/API/Today/share/archive`

Raw observations retain compact metric evidence, provider identity, provider reference, source URL, timestamps, confidence, freshness, optional baseline, and a payload hash. Arbitrary provider payloads are not canonical events.

An event fingerprint is SHA-256 over:

`subject type | normalized subject ID | event type | metric dimension | UTC heuristic time bucket`

The default bucket is one hour. Identity events such as `NEW_CONTRACT` and `NEW_PAIR` use a permanent subject identity instead of a recurring time bucket. Provider name is deliberately excluded. A database advisory lock protects event upserts; provider observations from the same real-world event merge as evidence on one deterministic `rh4663_evt_*` record.

Candidates use the deterministic event identity and `event_fingerprint` has a unique database constraint. Publications have a unique `candidate_id`. Daily editions remain unique by date. Reruns and process restarts therefore cannot create duplicate public memory.

## Scoring and policy

The default heuristic is `infopunks.rh4663.heuristics.v1`. It persists with every event, candidate, and publication. Published objects are never rescored when a later heuristic version ships.

Significance is a transparent 0–100 weighted result over magnitude, velocity, persistence, market impact, attention impact, cross-provider confirmation, historical rarity, subject importance, and source quality. Anomaly is a separate 0–100 z-score-derived measure and requires at least five baseline samples with nonzero variance. Insufficient history produces `0` plus `insufficient_history_no_anomaly_inference`; it never becomes a malicious-activity assertion.

Low-risk numeric observations can become `auto_publishable` only with fresh complete evidence, at least two sources, minimum source confidence, and the configured significance threshold. Medium interpretive signals require review. Security/reputational language and `EXPLOIT_INDICATOR` or `CONTRACT_RISK` are high risk, use uncertainty-preserving copy, require the existing RH Chain reviewer bearer token, and require at least three sources. Provider data has no publication authority.

Generated text uses deterministic evidence templates. No unconstrained LLM is in the factual path.

## Migration and irreversible boundary

Migration `20260814_009_infopunks_4663_make_the_chain_speak` adds observations, candidates, immutable publications, operational distribution state, additive corrections, and provider health. It does not modify migrations 007 or 008.

The down migration refuses to run after any published Signal, correction, or community finder attribution exists. Once that boundary is crossed, disable Phase 3 and remediate forward. Never delete historical market memory to roll back application code.

## Feature gates

All Phase 3 flags default off. External distribution remains off unless explicitly enabled; this build does not post to X or any other external network.

```sh
RH_4663_PHASE3_ENABLED=false
RH_4663_PHASE3_INGESTION_ENABLED=false
RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED=false
RH_4663_PHASE3_PUBLICATION_ENABLED=false
RH_4663_AUTO_PUBLICATION_ENABLED=false
RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
RH_4663_PHASE3_SHADOW_MODE=true
RH_4663_PHASE3_INTERVAL_MS=600000
RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=false
```

In production, publication additionally requires `RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=true`, a configured reviewer token, database durability, and enabled Phase 2. This marker is an operator attestation after the proof checklist below; the application never assumes it from deployment.

## Required Phase 2 production proof

Do not set the proof marker until every item is verified against real production artifacts:

1. Phase 2 application deployed.
2. Migration 007 applied.
3. Controlled real CALL verified.
4. Migration 008 applied.
5. Resolution signer configured.
6. 4663 commitment contract configured.
7. Controlled closed window resolved.
8. First `IP-RES` receipt verified.
9. Merkle inclusion proof verified.
10. Real Robinhood Chain anchor confirmed.
11. Share renderer verified.
12. Today consumes Pulse correctly.

No repository test substitutes for this external proof.

## Exact dark-launch sequence

Run from the deployed release directory. Secrets and real values remain operator-supplied.

```sh
npm ci
npm run lint
npm test
npm run build

export RH_4663_PHASE3_ENABLED=false
export RH_4663_PHASE3_INGESTION_ENABLED=false
export RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED=false
export RH_4663_PHASE3_PUBLICATION_ENABLED=false
export RH_4663_AUTO_PUBLICATION_ENABLED=false
export RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
export RH_4663_PHASE3_SHADOW_MODE=true
export RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=false
```

Deploy the code with those values, then verify Phase 1 and Phase 2 before applying 009:

```sh
NODE_ENV=production npm run rh-chain:migration-status -- --environment=production
RADAR_SMOKE_BASE_URL="https://radar.infopunks.fun" npm run smoke:production
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260814_009_infopunks_4663_make_the_chain_speak.up.sql
NODE_ENV=production npm run rh-chain:migration-status -- --environment=production --require-ready
```

Enable ingestion only and redeploy/restart through the normal platform workflow:

```sh
export RH_4663_PHASE3_ENABLED=true
export RH_4663_PHASE3_INGESTION_ENABLED=true
export RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED=false
export RH_4663_PHASE3_PUBLICATION_ENABLED=false
export RH_4663_AUTO_PUBLICATION_ENABLED=false
export RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
export RH_4663_PHASE3_SHADOW_MODE=true
```

Inspect protected activation, candidates, metrics, provider health, and a no-write replay:

```sh
curl -fsS -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  "https://radar.infopunks.fun/internal/4663/intelligence/activation"

curl -fsS -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  "https://radar.infopunks.fun/internal/4663/intelligence/metrics"

curl -fsS -X POST \
  -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  -H "X-RH-Chain-Reviewer-Id: operator" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://radar.infopunks.fun/internal/4663/intelligence/backtest"
```

After false-positive review and backtesting, enable candidate generation while keeping publication off:

```sh
export RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED=true
export RH_4663_PHASE3_PUBLICATION_ENABLED=false
export RH_4663_AUTO_PUBLICATION_ENABLED=false
export RH_4663_PHASE3_SHADOW_MODE=true
```

Only after the full Phase 2 proof checklist is complete, set the proof marker and permit reviewer-selected first publications:

```sh
export RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=true
export RH_4663_PHASE3_PUBLICATION_ENABLED=true
export RH_4663_AUTO_PUBLICATION_ENABLED=false
export RH_4663_PHASE3_SHADOW_MODE=false
```

Publish a selected candidate through the authenticated action route, then verify its card, evidence, share formats, archive, and Today:

```sh
curl -fsS -X POST \
  -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  -H "X-RH-Chain-Reviewer-Id: operator" \
  -H "Content-Type: application/json" \
  -d '{"action":"publish","note":"Evidence and public copy verified."}' \
  "https://radar.infopunks.fun/internal/4663/intelligence/candidates/$CANDIDATE_ID/action"

curl -fsS "https://radar.infopunks.fun/v1/4663/signals/$SIGNAL_ID"
curl -fsS "https://radar.infopunks.fun/v1/4663/signals/$SIGNAL_ID/evidence"
curl -fsS "https://radar.infopunks.fun/v1/4663/today"
curl -fsS -o /dev/null "https://radar.infopunks.fun/og/4663/signals/$SIGNAL_ID.png?format=square"
```

Only after reviewing selected publications may low-risk auto-publication be enabled:

```sh
export RH_4663_AUTO_PUBLICATION_ENABLED=true
```

Keep high-risk claims reviewer-gated. Keep external distribution off:

```sh
export RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
```

## Provider reuse and degraded behavior

The scheduler reuses the existing DEX Screener market snapshot service, Blockscout token registry, persisted DefiLlama chain metrics, and persisted //4663 Signal Hunt store. Existing provider timeout, retry, rate-limit, cache, and isolation behavior remains in force; Phase 3 adds a bounded adapter deadline and provider health memory. A failed provider records degraded health and cannot fail a public read route. Public Signal, lens, Today, evidence, share, and archive routes read only persisted objects.

## External distribution

Publications carry deterministic share URLs and `not_queued | queued | sent | failed` distribution state. The default is `not_queued`. No external posting integration is invoked in Phase 3.
