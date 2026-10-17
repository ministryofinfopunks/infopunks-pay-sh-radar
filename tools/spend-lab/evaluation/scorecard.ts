import type { CaseResult } from "../harness/task-runner";
export function scorecard(results: CaseResult[], concurrency: number) {
  const times = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const executions = results.filter((r) => r.executed);
  const failures = results.filter((r) => r.violations.length);
  return {
    version: "infopunks.spend-lab-report.v1",
    simulation: true,
    external_purchases: 0,
    release_decision: "HOLD",
    audited_reference_sha: "9a5a5b7658a3d85e0db20ecffcdd4246ed0f8bbc",
    cases: results.length,
    distinct_scenarios: new Set(results.map((r) => r.scenario)).size,
    configured_concurrency: concurrency,
    failed_cases: failures.length,
    violations: failures.map((r) => ({ id: r.id, violations: r.violations })),
    unauthorized_execution: results.filter((r) =>
      r.violations.some((v) =>
        ["unauthorized_execution", "boundary_execution"].includes(v),
      ),
    ).length,
    duplicate_simulated_charges: results.reduce(
      (n, r) => n + Math.max(0, r.charges - 1),
      0,
    ),
    unreconciled_submissions: results.reduce(
      (sum, r) => sum + r.pending_reconciliation,
      0,
    ),
    completed_cases: executions.length,
    completed_receipt_verification_rate: executions.length
      ? executions.filter((r) => r.verification === "passed").length /
        executions.length
      : null,
    abstention_rate:
      results.filter((r) => r.decision === "insufficient_evidence").length /
      results.length,
    latency_ms: {
      p50: times[Math.floor(times.length * 0.5)],
      p95: times[Math.floor(times.length * 0.95)],
      scope: "local case including SQLite and signature verification",
    },
    outcome_counts: {
      confirmed: results.filter((r) => r.evaluation === "confirmed").length,
      contradicted: results.filter((r) => r.evaluation === "contradicted")
        .length,
    },
    real_provider_outcomes: null,
    judgment_accuracy: null,
    decision_fee: null,
    infrastructure_cost_per_verified_judgment: null,
    evaluator_independence:
      "separate read-only evidence path; same operator and process; independent release review pending",
    missing_parent_receipts: results.filter((r) =>
      r.violations.includes("receipt_chain_invalid"),
    ).length,
    results: results.map(({ chains, ...result }) => result),
  };
}
