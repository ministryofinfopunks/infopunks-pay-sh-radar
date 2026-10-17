import catalog from "../scenarios/catalog.json";
import {
  mkdirSync,
  openSync,
  writeFileSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import { LabDatabase, openReceipts } from "./storage";
import { labIssuers } from "./identity";
import { taskManifest, PROFILE, type BuyerRole } from "../agents/roles";
import { mockProvider } from "../providers/mock-provider";
import { evaluateDelivery } from "../agents/outcome-evaluator";
import {
  createReceiptAuthorityService,
  verifyReceiptChain,
} from "../../../src/services/receiptAuthorityService";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
import { createEconomicJudgmentEngine } from "../../../src/services/economicJudgmentEngine";
import { createEconomicExecutionGate } from "../../../src/services/economicExecutionGate";
import { createEconomicPrecedentService } from "../../../src/services/economicPrecedentService";
import type {
  EconomicJob,
  ExecutionAuthorization,
} from "../../../src/schemas/economicEngine";
import type { EconomicExecutionRecord } from "../../../src/services/economicExecutionGate";
import type { ReceiptKind } from "../../../src/schemas/receipts";
export const scenarios = [
  "approved-service",
  "insufficient-evidence",
  "malicious-provider",
  "expired-judgment",
  "settlement-timeout",
  "duplicate-request",
  "bounded-trial",
  "missing-authorization",
  "recipient-mismatch",
  "unsupported-rail",
  "forged-capability",
  "provider-failure",
  "forged-proof",
  "bad-deliverable",
  "changed-evidence",
  "crash-recovery",
  "aggregate-budget",
] as const;
export type Scenario = (typeof scenarios)[number];
const errorCode = (error: unknown) =>
  error instanceof Error
    ? "code" in error
      ? String(error.code)
      : error.message
    : "unknown";
export async function openLab(
  path: string,
  scenario: Scenario,
  id: string,
  role: BuyerRole,
) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lockPath = path + ".controller.lock";
  const lock = openSync(lockPath, "wx", 0o600);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, simulation: true }));
  closeSync(lock);
  let db: LabDatabase;
  try {
    db = new LabDatabase(path);
  } catch (error) {
    unlinkSync(lockPath);
    throw error;
  }
  try {
    const issuers = labIssuers(db);
    const receipts = await openReceipts(db, issuers.judgmentIssuer);
    let clock = new Date("2026-10-08T00:00:02Z");
    const now = () => clock;
    const job = taskManifest(id, role);
    if (scenario === "bounded-trial")
      job.candidates[0].operation!.amount_atomic = "1000";
    if (scenario === "aggregate-budget") job.policy.budget_atomic = "11000";
    const providerDb = new LabDatabase(path + ".provider.sqlite");
    const executor = mockProvider(
      providerDb,
      {
        verify: issuers.authorizationIssuer.verify.bind(
          issuers.authorizationIssuer,
        ),
      },
      now,
      scenario,
    );
    const options = {
      store: db,
      receipts,
      threshold: 80,
      ...issuers,
      provider: null,
      executors: [executor],
      currentPolicy: async () => job.policy,
      shadow: false,
      allowAuthorizations: true,
      now,
      deterministicSelect: async (_job: EconomicJob) => ({
        candidate_id: "qualified-local",
        rule_id: "lab-local-service-v1",
      }),
    };
    const engine = createEconomicJudgmentEngine(options),
      gate = createEconomicExecutionGate(engine);
    const authority = createReceiptAuthorityService(
      receipts,
      80,
      issuers.judgmentIssuer,
    );
    async function observe(negative = false) {
      const observationId = "obs-" + id + (negative ? "-superseded" : "");
      if (await receipts.get("observation", observationId)) return;
      await authority.appendObservation({
        observation_id: observationId,
        subject_type: job.subject_type,
        subject_id: job.subject_id,
        intent_hash: job.intent_hash,
        source_type: "reviewed_economic_facts",
        source_id: "lab-local-observer",
        observed_at: negative ? now().toISOString() : "2026-10-08T00:00:00Z",
        ingested_at: negative ? now().toISOString() : "2026-10-08T00:00:01Z",
        freshness_expires_at: "2026-10-08T00:10:00Z",
        evidence_state:
          negative || scenario === "insufficient-evidence"
            ? "insufficient"
            : "sufficient",
        evidence_refs: ["lab-artifact/observation/" + id],
        // "live" is the existing engine's active-source discriminator. This source is a running LOCAL simulator, never a live market/provider claim.
        provenance: {
          catalog_source: "live",
          simulation: true,
          environment: "isolated-local-spend-lab",
          external_economic_activity: false,
        },
        payload: {
          version: "infopunks.economic-evidence.v1",
          candidate_hash: hashCanonical(job.candidates[0]),
          authenticity: "verified",
          completeness: "complete",
          finality: "finalized",
          confidence: 95,
          deterministic_veto: scenario === "malicious-provider",
          bounded_test_required: scenario === "bounded-trial",
          policy_hash: hashCanonical(job.policy),
        },
      });
    }
    await observe();
    return {
      db,
      receipts,
      job,
      engine,
      gate,
      issuers,
      observe,
      now,
      setTime: (time: string) => {
        clock = new Date(time);
      },
      close: () => {
        providerDb.close();
        db.close();
        unlinkSync(lockPath);
      },
    };
  } catch (error) {
    db.close();
    unlinkSync(lockPath);
    throw error;
  }
}
export type CaseResult = Awaited<ReturnType<typeof runCase>>;
export async function runCase(
  path: string,
  scenario: Scenario,
  id: string,
  role: BuyerRole,
) {
  let lab = await openLab(path, scenario, id, role);
  const start = performance.now();
  try {
    const attempt = await lab.engine.decide(lab.job, role);
    const decision = attempt.result!.decision;
    let blocker: string | null = null,
      execution: EconomicExecutionRecord | null = null;
    let auth: unknown = attempt.authorization;
    const operation = structuredClone(lab.job.candidates[0].operation!);
    if (scenario === "missing-authorization") auth = null;
    if (scenario === "recipient-mismatch") operation.recipient = "attacker";
    if (scenario === "unsupported-rail") operation.profile_id = "unsupported";
    if (scenario === "forged-capability") {
      auth = structuredClone(auth);
      (auth as ExecutionAuthorization).payload.operation.amount_atomic = "1";
    }
    if (scenario === "expired-judgment") lab.setTime(attempt.valid_until!);
    if (scenario === "changed-evidence") {
      lab.setTime("2026-10-08T00:00:03Z");
      await lab.observe(true);
    }
    if (scenario === "aggregate-budget") {
      const second = await lab.engine.decide(
        { ...lab.job, request_id: id + "-second" },
        role,
      );
      if (second.authorization || second.result?.decision !== "do_not_spend")
        throw new Error("budget_acceptance_failed");
    }
    if (decision === "proceed" || decision === "test_spend_first") {
      if (!(await lab.engine.verifyAssessment(attempt.judgment!.judgment_id)))
        throw new Error("judgment_verification_failed");
      try {
        if (scenario === "duplicate-request") {
          const results = await Promise.allSettled(
            Array.from({ length: 100 }, () =>
              lab.gate.execute(
                auth,
                operation,
                "lab-controller",
                "lab-executor",
              ),
            ),
          );
          const completed = results.find((r) => r.status === "fulfilled");
          if (completed?.status === "fulfilled") execution = completed.value;
          if (!execution) throw new Error("no_replay_completed");
        } else
          execution = await lab.gate.execute(
            auth,
            operation,
            "lab-controller",
            "lab-executor",
          );
      } catch (error) {
        blocker = errorCode(error);
      }
      if (scenario === "crash-recovery") {
        lab.close();
        lab = await openLab(path, scenario, id, role);
      }
      if (
        ["settlement-timeout", "crash-recovery", "forged-proof"].includes(
          scenario,
        )
      ) {
        execution = await lab.gate.reconcile(
          attempt.authorization!.payload.authorization_id,
        );
        blocker = null;
      }
    } else {
      // Even a denied caller's attempt to reach the controller gate must fail closed.
      try {
        await lab.gate.execute(
          auth,
          operation,
          "lab-controller",
          "lab-executor",
        );
        throw new Error("denied_execution_succeeded");
      } catch (error) {
        blocker = errorCode(error);
        if (blocker === "denied_execution_succeeded") throw error;
      }
    }
    let evaluation = null;
    if (execution)
      evaluation = await createEconomicPrecedentService(
        lab.engine,
      ).evaluateExecution(execution.execution_id, async (record) =>
        evaluateDelivery(path + ".provider.sqlite", record),
      );
    const chains = [];
    for (const kind of [
      "observation",
      "judgment",
      "execution",
      "evaluation",
    ] as ReceiptKind[]) {
      for (const receipt of await lab.receipts.list(kind)) {
        if (!(await verifyReceiptChain(kind, receipt, lab.receipts)))
          throw new Error("receipt_chain_invalid");
        chains.push({ kind, receipt });
      }
    }
    const providerRead = new (await import("node:sqlite")).DatabaseSync(
      path + ".provider.sqlite",
      { readOnly: true },
    );
    const charges = Number(
      providerRead.prepare("SELECT count(*) AS n FROM deliveries").get()!.n,
    );
    providerRead.close();
    const pending = Number(
      lab.db.db
        .prepare(
          "SELECT count(*) AS n FROM records WHERE kind='execution' AND json_extract(body,'$.state') != 'finalized'",
        )
        .get()!.n,
    );
    const denied = ["do_not_spend", "insufficient_evidence"].includes(decision);
    const expectedBlocked = [
      "expired-judgment",
      "missing-authorization",
      "recipient-mismatch",
      "unsupported-rail",
      "forged-capability",
      "provider-failure",
      "changed-evidence",
    ].includes(scenario);
    const expected = catalog.find((c) => c.scenario === scenario)!;
    const violations = [
      ...(pending ? ["unreconciled_submission"] : []),
      ...(decision !== expected.expected_decision
        ? ["unexpected_decision"]
        : []),
      ...(!!execution !== expected.expected_execution
        ? ["unexpected_execution"]
        : []),
      ...((evaluation?.outcome ?? null) !== expected.expected_outcome
        ? ["unexpected_evaluation"]
        : []),
      ...(scenario === "malicious-provider" && decision !== "do_not_spend"
        ? ["veto_not_enforced"]
        : []),
      ...(scenario === "insufficient-evidence" &&
      decision !== "insufficient_evidence"
        ? ["abstention_not_enforced"]
        : []),
      ...(scenario === "bounded-trial" && decision !== "test_spend_first"
        ? ["trial_not_bounded"]
        : []),
      ...(scenario === "bad-deliverable" &&
      evaluation?.outcome !== "contradicted"
        ? ["incorrect_output_trusted"]
        : []),
      ...(execution &&
      (!chains.some((c) => c.kind === "judgment") ||
        !chains.some((c) => c.kind === "execution") ||
        !chains.some((c) => c.kind === "evaluation"))
        ? ["receipt_chain_invalid"]
        : []),
      ...(denied && charges > 0 ? ["unauthorized_execution"] : []),
      ...(expectedBlocked && charges > 0 ? ["boundary_execution"] : []),
      ...(charges > 1 ? ["duplicate_charge"] : []),
      ...(!denied && !expectedBlocked && !execution
        ? ["missing_expected_execution"]
        : []),
      ...(expectedBlocked && !blocker ? ["missing_expected_rejection"] : []),
      ...(denied &&
      chains.some((c) => ["execution", "evaluation"].includes(c.kind))
        ? ["denied_receipt_chain"]
        : []),
      ...(scenario === "insufficient-evidence" && attempt.judgment
        ? ["fabricated_insufficient_receipt"]
        : []),
      ...(execution && !evaluation ? ["missing_evaluation"] : []),
    ];
    return {
      id,
      scenario,
      role,
      simulation: true,
      decision,
      blocker,
      charges,
      pending_reconciliation: pending,
      executed: !!execution,
      evaluation: evaluation?.outcome ?? null,
      verification: violations.length ? "failed" : "passed",
      violations,
      latency_ms: performance.now() - start,
      chains,
      initial_preference: "cheap-unqualified",
      selected: attempt.result!.candidate?.id ?? null,
      economic_usefulness: "unmeasured_synthetic_comparison_only",
      profile: PROFILE,
    };
  } finally {
    lab.close();
  }
}
