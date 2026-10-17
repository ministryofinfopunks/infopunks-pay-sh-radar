import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  runCase,
  openLab,
  scenarios,
} from "../tools/spend-lab/harness/task-runner";
import { buyerRoles, intentTool } from "../tools/spend-lab/agents/roles";
import { evaluateDelivery } from "../tools/spend-lab/agents/outcome-evaluator";
import { createEconomicPrecedentService } from "../src/services/economicPrecedentService";
import {
  hashCanonical,
  sealReceipt,
} from "../src/services/receiptIntegrityService";
async function temporary(work: (path: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "spend-lab-"));
  try {
    await work(join(dir, "lab.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe("isolated Spend Lab", () => {
  it.each(scenarios)(
    "enforces %s against stored provider evidence",
    async (scenario) =>
      temporary(async (path) => {
        const result = await runCase(path, scenario, "case", buyerRoles[0]);
        expect(result.violations).toEqual([]);
        expect(result.charges).toBeLessThanOrEqual(1);
        if (result.executed)
          expect([...new Set(result.chains.map((c) => c.kind))]).toEqual([
            "observation",
            "judgment",
            "execution",
            "evaluation",
          ]);
        if (scenario === "bad-deliverable")
          expect(result.evaluation).toBe("contradicted");
        if (scenario === "insufficient-evidence")
          expect(result.chains.map((c) => c.kind)).toEqual(["observation"]);
      }),
  );
  it.each(buyerRoles)(
    "%s exposes intent only and requests judgment",
    async (role) => {
      let calls = 0;
      const tool = intentTool(async (manifest) => {
        calls++;
        expect(manifest.principal_id).toBe(role);
        return {};
      }, role);
      expect(Object.keys(tool).sort()).toEqual([
        "description",
        "invoke",
        "name",
      ]);
      await tool.invoke("task");
      expect(calls).toBe(1);
    },
  );
  it("recovers a terminated controller from disk without another charge", async () =>
    temporary(async (path) => {
      const child = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          resolve("tools/spend-lab/harness/crash-worker.ts"),
          path,
        ],
        { encoding: "utf8", env: {}, timeout: 20000 },
      );
      expect(child.status, child.stderr).toBe(73);
      await expect(
        openLab(
          path,
          "crash-recovery",
          "actual-process-crash",
          "research-buyer",
        ),
      ).rejects.toThrow("EEXIST");
      // Child has exited; an operator may now remove its stale controller lock.
      rmSync(path + ".controller.lock");
      const lab = await openLab(
        path,
        "crash-recovery",
        "actual-process-crash",
        "research-buyer",
      );
      try {
        const attempt = await lab.engine.decide(lab.job, "research-buyer");
        await expect(
          lab.gate.execute(
            attempt.authorization,
            lab.job.candidates[0].operation!,
            "lab-controller",
            "lab-executor",
          ),
        ).rejects.toMatchObject({ code: "execution_pending_reconciliation" });
        const result = await lab.gate.reconcile(
          attempt.authorization!.payload.authorization_id,
        );
        expect(result.state).toBe("finalized");
        const again = await lab.gate.reconcile(
          attempt.authorization!.payload.authorization_id,
        );
        expect(again.receipt?.receipt_hash).toBe(result.receipt?.receipt_hash);
        const provider = new DatabaseSync(path + ".provider.sqlite", {
          readOnly: true,
        });
        expect(
          provider.prepare("SELECT count(*) AS n FROM deliveries").get()!.n,
        ).toBe(1);
        provider.close();
        expect(
          evaluateDelivery(path + ".provider.sqlite", result)?.outcome,
        ).toBe("confirmed");
      } finally {
        lab.close();
      }
    }));
  it("serializes 100 callers against one aggregate budget", async () =>
    temporary(async (path) => {
      const lab = await openLab(
        path,
        "aggregate-budget",
        "shared-budget",
        "research-buyer",
      );
      try {
        const attempts = await Promise.all(
          Array.from({ length: 100 }, (_, i) =>
            lab.engine.decide(
              { ...lab.job, request_id: "shared-" + i },
              "research-buyer",
            ),
          ),
        );
        expect(attempts.filter((a) => a.authorization)).toHaveLength(1);
        expect(
          attempts.filter((a) => a.result?.decision === "do_not_spend"),
        ).toHaveLength(99);
      } finally {
        lab.close();
      }
    }));
  it("rejects a conflicting decision replay", async () =>
    temporary(async (path) => {
      const lab = await openLab(
        path,
        "approved-service",
        "conflict",
        "tool-buyer",
      );
      try {
        await lab.engine.decide(lab.job, "tool-buyer");
        await expect(
          lab.engine.decide(
            { ...lab.job, state: { changed: true } },
            "tool-buyer",
          ),
        ).rejects.toMatchObject({ code: "decision_idempotency_conflict" });
      } finally {
        lab.close();
      }
    }));
  it("rejects corrupt control records on reopen/use", async () =>
    temporary(async (path) => {
      let lab = await openLab(
        path,
        "approved-service",
        "corrupt",
        "tool-buyer",
      );
      await lab.engine.decide(lab.job, "tool-buyer");
      lab.close();
      const db = new DatabaseSync(path);
      db.prepare(
        "UPDATE records SET hash='invalid' WHERE kind='attempt'",
      ).run();
      db.close();
      lab = await openLab(path, "approved-service", "corrupt", "tool-buyer");
      try {
        await expect(lab.engine.decide(lab.job, "tool-buyer")).rejects.toThrow(
          "lab_record_corruption",
        );
      } finally {
        lab.close();
      }
    }));
  it("does not accept an invented buyer output hash as independent proof", async () =>
    temporary(async (path) => {
      const lab = await openLab(
        path,
        "approved-service",
        "forgery",
        "research-buyer",
      );
      try {
        const attempt = await lab.engine.decide(lab.job, "research-buyer");
        const execution = await lab.gate.execute(
          attempt.authorization,
          lab.job.candidates[0].operation!,
          "lab-controller",
          "lab-executor",
        );
        const forged = structuredClone(execution);
        forged.outcome!.response_hash = hashCanonical("buyer success");
        expect(evaluateDelivery(path + ".provider.sqlite", forged)).toBeNull();
        await expect(
          createEconomicPrecedentService(lab.engine).evaluateExecution(
            execution.execution_id,
            async () => null,
          ),
        ).rejects.toMatchObject({ code: "evaluation_outcome_unproven" });
      } finally {
        lab.close();
      }
    }));
  it("preserves a receipt when a concurrent control transaction rolls back", async () =>
    temporary(async (path) => {
      let lab = await openLab(
        path,
        "approved-service",
        "rollback",
        "research-buyer",
      );
      let release!: () => void;
      let started!: () => void;
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const rolledBack = lab.db.transaction(async () => {
        started();
        await barrier;
        throw new Error("rollback-probe");
      });
      const rejected = expect(rolledBack).rejects.toThrow("rollback-probe");
      await began;
      const original = (await lab.receipts.list("observation"))[0];
      const extra = sealReceipt("observation", {
        ...original,
        observation_id: "rollback-extra",
      });
      const publishing = lab.receipts.append(
        "observation",
        extra as typeof original,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      release();
      await rejected;
      await publishing;
      lab.close();
      lab = await openLab(
        path,
        "approved-service",
        "rollback",
        "research-buyer",
      );
      try {
        expect(
          await lab.receipts.get("observation", "rollback-extra"),
        ).not.toBeNull();
      } finally {
        lab.close();
      }
    }));
});
