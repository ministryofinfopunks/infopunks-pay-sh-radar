import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEncryptedJudgmentSessionStore } from '../../../src/sdk/protectedSessionStore';
import { randomBytes } from 'node:crypto';
import { hashCanonical } from '../../../src/services/receiptIntegrityService';
import { verifyReceiptChain } from '../../../src/services/receiptAuthorityService';
import { tasks, runProvider, type Delivery, type Task } from './profiles';
import { radarSdkAssessment } from '../integrations/radar-sdk';
import { startHttpLab, freePort, seedHttpEvidence } from './http-client';
import { startEvaluator } from './evaluator';
import { boundedIntentTool, openController } from './controller';
import type { PreflightResult } from './preflight';
import type { JudgmentResult } from '../../../src/sdk/judgmentClient';

const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
export async function runBenchmark(
  directory: string,
  options: { preflight?: (task: Task) => PreflightResult } = {},
) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const auditDirectory = join(directory, 'audit');
  mkdirSync(auditDirectory, { mode: 0o700 });
  const evaluator = await startEvaluator(join(directory, 'evaluator'));
  let lab = await startHttpLab(join(directory, 'http.sqlite'), await freePort()).catch(
    async (error) => {
      await evaluator.close();
      throw error;
    },
  );
  let controller = await openController(join(directory, 'controller'), lab);
  try {
    // All specs are frozen and audited before the decision function sees the catalog.
    // The evaluator sees neither probes nor decisions when calculating ground truth.
    for (const t of tasks)
      save(join(auditDirectory, t.id + '.json'), {
        ...(await runProvider(t)),
        input_hash: hashCanonical(t.input),
      });
    const specs = tasks.map(({ probe, implementation, ...spec }) => spec);
    const commitment = await evaluator.request({ kind: 'commit', specs, auditDirectory });
    save(join(directory, 'label-commitment.json'), commitment);
    const trust = await evaluator.request({
      kind: 'configure',
      judgment: lab.trustedIssuer,
      execution: controller.publicKeys,
    });
    save(join(directory, 'trust.json'), {
      ...trust,
      evaluator_public_key: evaluator.publicKey,
      judgment: lab.trustedIssuer,
      execution: controller.publicKeys,
    });
    const results = new Map<string, JudgmentResult>();
    const sessionKey = randomBytes(32),
      sessionDirectory = join(directory, 'sessions');
    const client = radarSdkAssessment(lab, {
      sessionStore: createEncryptedJudgmentSessionStore({
        directory: sessionDirectory,
        encryptionKey: sessionKey,
      }),
    });
    const allowlist = new Map(tasks.map((t) => [t.id, t]));
    const intentTool = boundedIntentTool(allowlist, async (t: Task) => {
      const input = await seedHttpEvidence(lab, 'lab-' + t.id, t.probe);
      return client.requestJudgment(input, { idempotencyKey: 'benchmark-' + t.id });
    });
    const decisions = [];
    for (const [taskIndex, t] of tasks.entries()) {
      if (taskIndex > 0 && taskIndex % 5 === 0) {
        const port = Number(new URL(lab.origin).port);
        await lab.close();
        lab = await startHttpLab(join(directory, 'http.sqlite'), port);
      }
      const start = performance.now();
      // Both arms use exactly this budget/offer policy; the treatment adds only Radar's veto/abstention gate.
      const baseline = t.price_units + t.fee_units <= 50;
      const preliminary = options.preflight?.(t);
      if (
        preliminary &&
        (preliminary.execution_authorized !== false ||
          !['no_spend', 'full_judgment_required'].includes(preliminary.route) ||
          (preliminary.route === 'no_spend' &&
            !['do_not_spend', 'insufficient_evidence'].includes(preliminary.decision ?? '')) ||
          (preliminary.route === 'full_judgment_required' && preliminary.decision !== null))
      )
        throw new Error('preflight_execution_bypass_forbidden');
      const result =
        preliminary?.route === 'no_spend'
          ? null
          : ((await intentTool.invoke(t.id)) as JudgmentResult);
      if (result) results.set(t.id, result);
      decisions.push({
        task_id: t.id,
        baseline_spend: baseline,
        radar_spend:
          baseline && result?.decision === 'proceed' && result.state === 'RECEIPT_VERIFIED',
        radar_decision: result?.decision ?? preliminary!.decision!,
        ...(preliminary
          ? {
              preflight: preliminary,
              decision_authority: result ? 'canonical_judgment' : 'preflight_no_spend',
            }
          : {}),
        judgment_fee_units: result?.payment_required ? 1 : 0,
        judgment_fee_atomic: result?.payment_required ? '10000' : '0',
        radar_latency_ms: performance.now() - start,
        judgment_id: result?.judgment_id ?? null,
        judgment_hash: result?.receipt?.receipt_hash ?? null,
      });
    }
    const decisionsPath = join(directory, 'frozen-decisions.json');
    save(decisionsPath, decisions);
    const decisionsHash = hashCanonical(decisions);
    // Freeze decisions before the scoring process reveals any labels.
    const reveal = await evaluator.request({ kind: 'reveal', decisionsPath, decisionsHash });
    save(join(directory, 'labels.json'), reveal);
    if (
      reveal.body.commitment !== commitment.body.commitment ||
      reveal.body.decisions_hash !== decisionsHash
    )
      throw new Error('blinding_commitment_mismatch');
    const rows: Array<Record<string, unknown>> = [];
    const traces = [];
    for (const [index, t] of tasks.entries()) {
      const d = decisions[index],
        label = reveal.body.labels.find((l: any) => l.task_id === t.id);
      if (!label) throw new Error('missing_independent_label');
      let baselineDelivery: Delivery | null = null,
        radarDelivery: Delivery | null = null,
        attestation = null,
        archive = null;
      const baselineStart = performance.now();
      if (d.baseline_spend)
        baselineDelivery = { ...(await runProvider(t)), input_hash: hashCanonical(t.input) };
      const baselineLatency = performance.now() - baselineStart;
      const radarStart = performance.now();
      if (d.radar_spend) {
        const issued = await controller.issue(results.get(t.id)!, t);
        radarDelivery = await controller.execute(issued.capability, t);
        archive = await controller.receipt(issued, t, radarDelivery);
        attestation = await evaluator.request({
          kind: 'attest',
          archivePath: join(directory, 'controller', t.id + '.archive.json'),
          deliveryPath: join(directory, 'controller', t.id + '.delivery.json'),
          deadlineMs: t.deadline_ms,
        });
        if (
          attestation.body.execution_hash !== archive.execution.receipt_hash ||
          attestation.body.judgment_hash !== archive.judgment.receipt_hash ||
          attestation.body.capability_hash !== archive.capability.payload_hash
        )
          throw new Error('evaluator_lineage_binding_invalid');
        await issued.receipts.append('evaluation', attestation.body.evaluation_receipt);
        if (
          !(await verifyReceiptChain(
            'evaluation',
            attestation.body.evaluation_receipt,
            issued.receipts,
          ))
        )
          throw new Error('complete_lineage_invalid');
      }
      // Actual arm outcomes use independently specified reference output hashes and measured deadlines.
      const score = (delivery: Delivery | null) =>
        delivery
          ? (delivery.status === 'ok' &&
            hashCanonical(delivery.output) === label.output_hash &&
            label.correct &&
            delivery.elapsed_ms <= t.deadline_ms
              ? t.value_units
              : 0) -
            delivery.charged_units -
            delivery.fee_units
          : 0;
      const baselineNet = score(baselineDelivery),
        radarGrossNet = score(radarDelivery),
        radarNet = radarGrossNet - d.judgment_fee_units;
      const prevented = !d.radar_spend && d.baseline_spend && label.net_units < 0;
      rows.push({
        ...d,
        family: t.family,
        label_should_spend: label.should_spend,
        baseline_net_units: baselineNet,
        radar_net_units: radarNet,
        baseline_correct_abstention: !d.baseline_spend && !label.should_spend,
        radar_correct_abstention: !d.radar_spend && !label.should_spend,
        prevented_loss_units: prevented ? -label.net_units : 0,
        false_block: !d.radar_spend && label.should_spend,
        missed_gain_units: !d.radar_spend && label.should_spend ? label.net_units : 0,
        baseline_provider_fee_units: baselineDelivery?.fee_units ?? 0,
        radar_provider_fee_units: radarDelivery?.fee_units ?? 0,
        baseline_provider_cost_units: baselineDelivery?.charged_units ?? 0,
        radar_provider_cost_units: radarDelivery?.charged_units ?? 0,
        baseline_latency_ms: baselineLatency,
        radar_total_latency_ms: d.radar_latency_ms + performance.now() - radarStart,
        baseline_delivery: baselineDelivery,
        radar_delivery: radarDelivery,
      });
      traces.push({ task_id: t.id, archive, evaluator_attestation: attestation });
    }
    save(join(directory, 'lineage.json'), traces);
    const sum = (field: string) => rows.reduce((a, r) => a + Number((r as any)[field]), 0);
    const latency = (field: string) => {
      const values = rows.map((r) => Number(r[field])).sort((a, b) => a - b);
      return {
        mean_ms: sum(field) / values.length,
        p50_ms: values[Math.ceil(values.length * 0.5) - 1],
        p95_ms: values[Math.ceil(values.length * 0.95) - 1],
      };
    };
    const metrics = {
      version: 'spend-lab.blinded-comparison.v1',
      status: 'HOLD',
      provenance: 'LOCAL_SIMULATION_ONLY',
      real_spending_authorized: false,
      label_authority: 'separate_process_independent_task_oracle_same_operator_not_external_review',
      economic_usefulness: 'NOT_ESTABLISHED',
      unique_tasks: tasks.length,
      unique_families: new Set(tasks.map((t) => t.family)).size,
      unique_provider_implementations: new Set(tasks.map((t) => t.implementation)).size,
      repetitions_per_task: 1,
      decisions_hash: decisionsHash,
      label_commitment: commitment.body.commitment,
      assumptions: {
        unit: 'toy_utility_unit_not_currency',
        judgment_fee_units_per_paid_decision: 1,
        usdc_wire_metadata: 'simulation_only_no_wallet_no_chain',
        value_source: 'predeclared_task_spec_not_independently_procured_market_value',
        audit_provider_cost_units: tasks.reduce((n, t) => n + t.price_units + t.fee_units, 0),
        actual_monetary_cost: null,
        inference_cost: null,
        cpu_monetary_cost: null,
      },
      baseline: {
        net_units: sum('baseline_net_units'),
        correct_abstentions: sum('baseline_correct_abstention'),
        provider_fees_units: sum('baseline_provider_fee_units'),
        provider_cost_units: sum('baseline_provider_cost_units'),
        total_latency_ms: sum('baseline_latency_ms'),
        latency: latency('baseline_latency_ms'),
      },
      radar: {
        net_units: sum('radar_net_units'),
        correct_abstentions: sum('radar_correct_abstention'),
        prevented_losses_units: sum('prevented_loss_units'),
        false_blocks: sum('false_block'),
        missed_gains_units: sum('missed_gain_units'),
        judgment_fees_units: sum('judgment_fee_units'),
        provider_fees_units: sum('radar_provider_fee_units'),
        provider_cost_units: sum('radar_provider_cost_units'),
        total_latency_ms: sum('radar_total_latency_ms'),
        latency: latency('radar_total_latency_ms'),
      },
      paired_net_difference_units: sum('radar_net_units') - sum('baseline_net_units'),
      simulated_judgment_payments: await lab.counts(),
      rows,
    };
    save(join(directory, 'comparison-metrics.json'), metrics);
    return metrics;
  } finally {
    controller.close();
    await lab.close();
    await evaluator.close();
  }
}
