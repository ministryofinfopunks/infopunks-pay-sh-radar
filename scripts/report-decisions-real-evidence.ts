import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QualificationCorpus } from './benchmark-decisions-live';

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function buildGateBaseline(corpusText: string, inventoryText: string, packetText: string) {
  const corpus = QualificationCorpus.parse(JSON.parse(corpusText));
  const inventory = JSON.parse(inventoryText) as { schema_version?: string; data_access_status?: string; receipt_counts?: unknown; verified_outcome_count?: unknown };
  const packet = JSON.parse(packetText) as { schema_version?: string; cases?: unknown[]; reviewer_status?: string };
  if (inventory.schema_version !== 'decisions-history-inventory.v1' || packet.schema_version !== 'decisions-blinded-review-packet.v1' ||
      packet.cases?.length !== corpus.cases.length || packet.reviewer_status !== 'awaiting_independent_assessments') throw new Error('invalid_evidence_inputs');
  const policyDistribution = Object.fromEntries(['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence']
    .map(value => [value, corpus.cases.filter(item => item.expected.decision === value).length]));
  return {
    schema_version: 'decisions-real-evidence-baseline.v1',
    source_hashes: { synthetic_corpus_sha256: digest(corpusText), inventory_sha256: digest(inventoryText),
      blinded_packet_sha256: digest(packetText) },
    data_status: { historical_database_access: inventory.data_access_status, historical_receipt_counts: inventory.receipt_counts ?? null,
      verified_historical_outcomes: inventory.verified_outcome_count ?? null, independent_labels_received: 0 },
    synthetic_policy_replay: { case_count: corpus.cases.length, distribution: policyDistribution,
      expected_replay_agreement: { numerator: corpus.cases.length, denominator: corpus.cases.length,
        interpretation: 'Labels were authored from the policy and verified by regression tests; this is not independent accuracy.' },
      policy_false_allows_against_independent_labels: null },
    independent_quality: { reviewed_case_count: 0, policy_accuracy: null, policy_false_allow_count: null,
      policy_false_allow_rate: null, model_accuracy: null, model_false_approval_rate: null },
    verified_outcome_quality: { eligible_execution_count: null, outcome_verified_count: null,
      policy_proceed_on_contradicted_outcome_count: null, model_proceed_on_contradicted_outcome_count: null },
    live_provider: { request_count: 0, latency_p50_ms: null, latency_p95_ms: null, latency_p99_ms: null,
      reliability: null, token_usage: null, actual_provider_cost_usd: null },
    recommendation: 'NO_GO',
    reason: 'No independently reviewed labels, historical receipt access, verified outcomes, dedicated API credentials, or staging environment.'
  };
}
export function main(args = process.argv.slice(2)) {
  if (args.length !== 8 || args[0] !== '--corpus' || args[2] !== '--inventory' || args[4] !== '--packet' || args[6] !== '--output') throw new Error('invalid_arguments');
  const paths = [args[1], args[3], args[5], args[7]].map(path => resolve(path));
  if (new Set(paths).size !== paths.length) throw new Error('distinct_paths_required');
  const report = buildGateBaseline(readFileSync(paths[0], 'utf8'), readFileSync(paths[1], 'utf8'), readFileSync(paths[2], 'utf8'));
  const fd = openSync(paths[3], 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(report, null, 2) + '\n'); }
  finally { closeSync(fd); }
  process.stdout.write(`Real-evidence baseline report written: ${paths[3]}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { process.stderr.write('decisions_real_evidence_report_failed; inspect input artifacts\n'); process.exitCode = 1; }
}
