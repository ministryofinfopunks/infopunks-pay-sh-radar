import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { createEvaluationReviewerTrust } from '../src/security/evaluationReviewerTrust';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { verifyReceiptChain } from '../src/services/receiptAuthorityService';
import { canonicalSerialize } from '../src/services/receiptIntegrityService';
import { EvaluationReceiptSchema } from '../src/schemas/receipts';

async function main() {
  const connectionString = process.env.CANONICAL_RECEIPT_TEST_URL;
  const output = process.env.E1_A_ARTIFACT_DIR;
  if (process.env.E1_A_DISPOSABLE_CLUSTER !== 'true' || !connectionString || !output) throw new Error('disposable_cluster_only');
  const address = new URL(connectionString);
  if (address.hostname !== '127.0.0.1' || address.username !== 'e1a_app' || address.pathname !== '/e1a_qualification') throw new Error('isolated_test_database_required');
  const bundle = JSON.parse(readFileSync(join(output, 'synthetic-durability-bundle.json'), 'utf8'));
  if (bundle.schema_version !== 'e1-a-synthetic-durability-bundle.v1' || !/^e1_a_[a-f0-9]{32}$/.test(bundle.test_schema)) throw new Error('synthetic_test_bundle_required');
  const trust = createEvaluationReviewerTrust(bundle.reviewer_registry);
  const issuer = createJudgmentIssuer({ issuer: bundle.judgment_public_keys.issuer, keys: bundle.judgment_public_keys.keys, requireSigned: true });
  const pool = new pg.Pool({ connectionString, options: '-c search_path=' + bundle.test_schema });
  try {
    const store = new PostgresCanonicalReceiptStore(pool, 80, issuer, trust);
    const evaluation = EvaluationReceiptSchema.parse(bundle.receipts[3]);
    const stored = await store.get('evaluation', evaluation.evaluation_id);
    const sidecar = await store.getEvaluationReviewerAttestation(evaluation.evaluator!.signature_ref!);
    const receiptUnchanged = canonicalSerialize(stored) === canonicalSerialize(evaluation);
    const sidecarUnchanged = canonicalSerialize(sidecar) === canonicalSerialize(bundle.attestation);
    const replayValid = stored !== null && await verifyReceiptChain('evaluation', stored, store);
    const report = { schema_version: 'e1-a-post-restart-replay.v1', evidence_class: bundle.evidence_class,
      server_restart_performed_by_runner: true, test_schema: bundle.test_schema, evaluation_id: evaluation.evaluation_id,
      checks: { receipt_unchanged: receiptUnchanged, sidecar_unchanged: sidecarUnchanged, registry_digest_unchanged: trust.registrySha256 === bundle.reviewer_registry_sha256, entire_chain_replay: replayValid },
      independent_verifier_checks: bundle.checks, real_world_outcome_verified: false };
    writeFileSync(join(output, 'post-restart-replay.json'), JSON.stringify(report, null, 2) + '\n');
    if (!Object.values(report.checks).every(Boolean)) throw new Error('post_restart_replay_failed');
    console.log('Persisted test chain and reviewer attestation replay: PASS');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Disposable PostgreSQL replay failed; see qualification artifacts.'); process.exitCode = 1; });
