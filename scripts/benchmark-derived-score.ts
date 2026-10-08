import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import type { FacilitatorClient } from '@x402/core/server';
import { createCanonicalTestDatabase } from '../tests/helpers/canonicalPostgres';
import { executionChain, evaluationRequest } from '../tests/helpers/evaluations';
import { executionInput, observationInput } from '../tests/helpers/canonicalReceipts';
import { request, facts, legacy } from '../tests/helpers/judgmentFixtures';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { createEvaluationService } from '../src/services/evaluationService';
import { createDerivedScoreService } from '../src/services/derivedScoreService';
import { createJudgmentService } from '../src/services/judgmentService';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import { ObservationReceiptSchema } from '../src/schemas/receipts';
import { createX402JudgmentGateway } from '../src/middleware/x402JudgmentMiddleware';

const samples = 300, warmups = 30;
function concurrentWorkloads() {
  return execFileSync('ps', ['-eo', 'pid,command'], { encoding: 'utf8' }).split('\n')
    .filter(line => /node_modules\/\.bin\/(?:tsc|vitest)|vite build|npm (?:run|exec) (?:test|build|lint|typecheck|vitest)/.test(line));
}
function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { sample_count: sorted.length, warmup_count: warmups,
    p50_ms: sorted[Math.ceil(sorted.length * 0.5) - 1], p95_ms: sorted[Math.ceil(sorted.length * 0.95) - 1], max_ms: sorted.at(-1)! };
}
async function main() {
  const url = process.env.CANONICAL_RECEIPT_TEST_URL;
  if (!url) throw new Error('CANONICAL_RECEIPT_TEST_URL_required');
  const endpoint = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('benchmark_requires_local_disposable_postgres');
  assert.deepEqual(concurrentWorkloads(), [], 'stop concurrent test/compiler workloads before benchmarking');
  const database = await createCanonicalTestDatabase(url, 'phase41_benchmark', [
    '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests',
    '20261007_013_execution_proof_uniqueness', '20261007_014_derived_score_projection'
  ]);
  try {
    const queries = new Map<string, { text: string; values: unknown[] }>();
    const pool = new Proxy(database.pool, { get(target, property, receiver) {
      if (property !== 'query') return Reflect.get(target, property, receiver);
      return (...args: unknown[]) => {
        if (typeof args[0] === 'string' && /^select\b/i.test(args[0].trim()) && !queries.has(args[0])) {
          queries.set(args[0], { text: args[0], values: Array.isArray(args[1]) ? structuredClone(args[1]) : [] });
        }
        return Reflect.apply(target.query, target, args);
      };
    } });
    const store = new PostgresCanonicalReceiptStore(pool);
    await executionChain(store);
    const authority = createReceiptAuthorityService(store);
    const evaluations = createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:04Z'));
    for (let i = 0; i < 100; i++) {
      const execution_id = 'history_' + i;
      await authority.appendExecution({ ...executionInput(), execution_id });
      await evaluations.submit({ ...evaluationRequest, execution_receipt_id: execution_id, outcome: 'confirmed', idempotency_key: execution_id }, 'canonical-admin');
    }
    await authority.appendObservation({ ...observationInput('current_facts'), intent_hash: hashCanonical(request),
      source_type: 'reviewed_judgment_facts', provenance: { catalog_source: 'live' }, payload: facts });
    let settlements = 0;
    const facilitator: FacilitatorClient = {
      getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' as const }], extensions: [], signers: {} }),
      verify: async () => ({ isValid: true, payer: '0x' + '1'.repeat(40) }),
      settle: async () => ({ success: true, transaction: '0x' + (++settlements).toString(16).padStart(64, '0'), network: 'eip155:8453' as const, payer: '0x' + '1'.repeat(40) })
    };
    const gateway = await createX402JudgmentGateway({ facilitator, facilitatorUrl: 'https://facilitator.invalid', payTo: '0x' + '2'.repeat(40), amount: '0.01', resourceUrl: 'https://radar.infopunks.fun/v1/pre-spend/check' });
    let timing: { local_ms: number; payment_ms: number; total_ms: number } | undefined;
    const judgments = createJudgmentService({ store, journal: new PostgresJudgmentRequestRepository(pool), gateway, legacyCheck: () => legacy,
      threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:05Z'), onTiming: value => { timing = value; },
      observations: async (subject, intentHash) => (await pool.query("select receipt from observation_receipts where subject_id=$1 and receipt->>'intent_hash'=$2 order by observed_at desc, observation_id desc limit 1", [subject, intentHash])).rows.map(row => ObservationReceiptSchema.parse(row.receipt))
    });
    await pool.query('analyze');
    const scores = createDerivedScoreService(store);
    const scoreSamples: number[] = [], judgmentSamples: number[] = [], evaluationSamples: number[] = [];
    for (let i = 0; i < warmups + samples; i++) {
      const started = performance.now();
      const score = await scores.project('provider', 'provider_test');
      const elapsed = performance.now() - started;
      assert.equal(score.evaluation_count, 100);
      if (i >= warmups) scoreSamples.push(elapsed);
    }
    for (let i = 0; i < warmups + samples; i++) {
      const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: gateway.requirements[0], payload: { signature: 'benchmark-only', authorization: { nonce: 'benchmark_' + i } } });
      const result = await judgments.check(request, 'benchmark_' + i, signature);
      assert.equal(result.response.decision, 'proceed'); assert.ok(result.response.receipt);
      if (i >= warmups) judgmentSamples.push(timing!.local_ms);
    }
    await pool.query('analyze');
    // Explain the actual production read statements, with their captured bound parameters.
    const plans = [];
    for (const query of queries.values()) {
      const explained = await pool.query('explain (analyze, buffers, format json) ' + query.text, query.values);
      plans.push({ ...query, plan: explained.rows[0]['QUERY PLAN'] });
    }
    for (let i = 0; i < warmups + samples; i++) {
      const execution_id = 'write_' + i;
      await authority.appendExecution({ ...executionInput(), execution_id });
      const started = performance.now();
      const receipt = await evaluations.submit({ ...evaluationRequest, execution_receipt_id: execution_id, outcome: 'confirmed', idempotency_key: execution_id }, 'canonical-admin');
      const elapsed = performance.now() - started;
      assert.equal(receipt.policy_version, 'score-policy.v1');
      if (i >= warmups) evaluationSamples.push(elapsed);
    }
    assert.deepEqual(concurrentWorkloads(), [], 'concurrent workload appeared during benchmark; measurements invalid');
    const indexes = (await pool.query('select tablename,indexname,indexdef from pg_indexes where schemaname=current_schema() order by tablename,indexname')).rows;
    const result = {
      database: 'local PostgreSQL / disposable isolated schema', postgres_version: (await pool.query('show server_version')).rows[0].server_version,
      history_evaluation_count: 100, sample_count: samples, warmup_count: warmups, concurrent_workload_present: false,
      judgment_path: 'fresh paid judgment: PostgreSQL observation lookup, verified projection, policy, idempotency journal and canonical receipt persistence',
      external_latency: 'official x402 gateway with deterministic local facilitator; verify/settle time excluded using service local_ms; no blockchain or Pay.sh calls',
      score_lookup: summarize(scoreSamples), judgment: summarize(judgmentSamples), evaluation_write: summarize(evaluationSamples),
      judgment_gate_passed: summarize(judgmentSamples).p95_ms < 100
    };
    mkdirSync('output/phase4.1', { recursive: true });
    writeFileSync('output/phase4.1/performance.json', JSON.stringify(result, null, 2) + '\n');
    writeFileSync('output/phase4.1/query-plans.json', JSON.stringify({ plans, indexes }, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    assert.ok(result.judgment_gate_passed, 'internal judgment p95 must be <100ms');
  } finally { await database.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
