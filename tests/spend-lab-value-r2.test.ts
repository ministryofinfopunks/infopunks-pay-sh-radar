import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { hashCanonical } from "../src/services/receiptIntegrityService";
import {
  loadDevelopment,
  loadHoldoutOffers,
  loadHoldoutTruth,
  validateDataset,
  root,
} from "../tools/spend-lab/value-r2/data";
import { decide } from "../tools/spend-lab/value-r2/strategies";
import { canonicalAssessment } from "../tools/spend-lab/value-r2/canonical";
import {
  evaluation,
  preferencesForSetting,
} from "../tools/spend-lab/value-r2/analysis/compare";
import { score } from "../tools/spend-lab/value-r2/analysis/scoring";
import {
  baseSetting,
  type EvidenceMode,
} from "../tools/spend-lab/value-r2/types";
import {
  auditProvenance,
  explicitReviewedProvenance,
} from "../tools/spend-lab/value-r2/provenance-audit";
import {
  eligibleEvidenceProvenance,
  localSimulationProvenance,
} from "../src/security/evidenceProvenance";
import {
  freezeDecisions,
  assertFrozenDecisions,
} from "../tools/spend-lab/value-r2/frozen-evaluation";
import { validateHttpReplay } from "../tools/spend-lab/value-r2/http-validation";
import { setupJudgment, request } from "./helpers/judgments";
import protocol from "../tools/spend-lab/value-r2/preregistration.json";
async function temporary(work: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "radar-value-"));
  try {
    await work(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const dev = loadDevelopment(),
  offers = loadHoldoutOffers(),
  truth = loadHoldoutTruth();
describe("economic dataset integrity", () => {
  it("preserves pre-evaluation labels, independent reference contracts and split isolation", () => {
    const c = JSON.parse(
      readFileSync(join(root, "datasets/holdout/commitment.json"), "utf8"),
    );
    expect(hashCanonical(truth.labels)).toBe(c.labels_hash);
    expect(hashCanonical(offers)).toBe(c.offers_hash);
    expect(hashCanonical(truth.artifacts)).toBe(c.artifacts_hash);
    validateDataset(offers, truth.labels, truth.artifacts);
    validateDataset(dev.offers, dev.labels, dev.artifacts);
    expect(offers).toHaveLength(96);
    expect(new Set(offers.map((o) => o.family)).size).toBe(8);
    expect(
      offers.some((h) =>
        dev.offers.some(
          (d) =>
            d.id === h.id || hashCanonical(d.input) === hashCanonical(h.input),
        ),
      ),
    ).toBe(false);
    const old = execFileSync(
      "git",
      [
        "show",
        protocol.holdout_freeze_sha +
          ":tools/spend-lab/value-r2/datasets/holdout/labels.json",
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(old)).toEqual(truth.labels);
    expect(() =>
      execFileSync(
        "git",
        [
          "cat-file",
          "-e",
          protocol.holdout_freeze_sha +
            ":tools/spend-lab/value-r2/strategies.ts",
        ],
        { stdio: "ignore" },
      ),
    ).toThrow();
  });
  it("rejects missing/duplicate labels, outcome tampering, wrong answer keys and hash changes", () => {
    expect(() =>
      validateDataset(offers, truth.labels.slice(1), truth.artifacts),
    ).toThrow("dataset_coverage_invalid");
    const corrupt = structuredClone(truth);
    corrupt.artifacts[0].output = "forged";
    expect(() =>
      validateDataset(offers, corrupt.labels, corrupt.artifacts),
    ).toThrow("dataset_binding_invalid");
    const wrong = structuredClone(truth);
    wrong.labels[0].expected_output = 999;
    expect(() =>
      validateDataset(offers, wrong.labels, wrong.artifacts),
    ).toThrow();
    const label = structuredClone(truth);
    label.labels[0].net_units++;
    expect(() =>
      validateDataset(offers, label.labels, label.artifacts),
    ).toThrow("label_economic_identity_invalid");
  });
  it("refuses outcome/label properties at the strategy boundary", () => {
    expect(() => decide({ ...offers[0], should_spend: true })).toThrow();
    expect(() => decide({ ...offers[0], expected_output: 38 })).toThrow();
    const code = readFileSync(join(root, "strategies.ts"), "utf8");
    expect(code).not.toMatch(/from ['"].*(data|oracle|labels|scoring)/);
  });
  it("freezes offers-only child decisions before scoring and detects edits", async () =>
    temporary(async (dir) => {
      const path = join(dir, "frozen.json"),
        decisions = await freezeDecisions(offers.slice(0, 3), path);
      assertFrozenDecisions(path, decisions);
      const altered = JSON.parse(readFileSync(path, "utf8"));
      altered.decisions[0].prefer_spend = !altered.decisions[0].prefer_spend;
      writeFileSync(path, JSON.stringify(altered));
      expect(() => assertFrozenDecisions(path, decisions)).toThrow(
        "frozen_decisions_changed",
      );
    }));
});
describe("complete economic accounting", () => {
  it("reproduces all original cases, including three false blocks and six correct abstentions", () => {
    const r = evaluation(
      dev.offers,
      dev.labels,
      dev.artifacts,
      dev.offers.flatMap((o) => decide(o)),
      baseSetting,
    );
    expect(r.totals.no_radar.net_units).toBe(101);
    expect(r.totals.full_paid_radar.net_units).toBe(68);
    expect(r.totals.full_paid_radar).toMatchObject({
      delta_vs_no_radar: -33,
      false_blocks: 3,
      correct_abstentions: 6,
      prevented_losses_units: 46,
      missed_gains_units: 62,
      judgment_fees_units: 17,
    });
    expect(
      r.rows
        .filter((r) => r.strategy === "full_paid_radar" && r.false_block)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["dedup-addresses", "mean-telemetry", "text-tokenize"]);
    for (const t of Object.values(r.totals))
      expect(t.delta_vs_no_radar).toBeCloseTo(
        t.prevented_losses_units -
          t.missed_gains_units -
          t.judgment_fees_units -
          t.modeled_check_cost_units,
      );
    expect(r.rows).toHaveLength(100);
  });
  it("keeps the holdout negative and accounts for every case, not only prevented losses", () => {
    const r = evaluation(
      offers,
      truth.labels,
      truth.artifacts,
      offers.flatMap((o) => decide(o)),
      baseSetting,
    );
    expect(r.rows).toHaveLength(96 * 5);
    expect(r.totals.full_paid_radar.delta_vs_no_radar).toBeLessThan(0);
    expect(r.totals.full_paid_radar.net_units).toBeLessThan(
      r.totals.cheap_preflight.net_units,
    );
    for (const t of Object.values(r.totals))
      expect(t.delta_vs_no_radar).toBeCloseTo(
        t.prevented_losses_units -
          t.missed_gains_units -
          t.judgment_fees_units -
          t.modeled_check_cost_units,
      );
  });
  it("charges paid blocks, keeps insufficient evidence free and retains failed delivery costs", () => {
    const o = dev.offers.find((o) => o.id === "mean-telemetry")!,
      i = dev.offers.indexOf(o),
      p = decide(o).find((p) => p.strategy === "full_paid_radar")!;
    const r = score(o, dev.labels[i], dev.artifacts[i], p, baseSetting);
    expect(r.net_units).toBe(-1);
    expect(r.judgment_fee_units).toBe(1);
    const unknown = decide(
      dev.offers.find((o) => o.id === "text-tokenize")!,
    ).find((p) => p.strategy === "full_paid_radar")!;
    expect(unknown.paid_judgment).toBe(false);
    const index = dev.offers.findIndex((o) => o.id === "service-unavailable");
    const row = score(
      dev.offers[index],
      dev.labels[index],
      dev.artifacts[index],
      decide(dev.offers[index])[0],
      baseSetting,
    );
    expect(row.net_units).toBe(-13);
  });
  it("fee sensitivity uses every paid judgment and never turns fees into permission", () => {
    const ps = dev.offers.flatMap((o) => decide(o));
    const free = evaluation(dev.offers, dev.labels, dev.artifacts, ps, {
      ...baseSetting,
      judgment_fee: 0,
    }).totals.full_paid_radar;
    expect(free.delta_vs_no_radar).toBe(-16);
    const expensive = evaluation(dev.offers, dev.labels, dev.artifacts, ps, {
      ...baseSetting,
      judgment_fee: 5,
    }).totals.full_paid_radar;
    expect(free.net_units - expensive.net_units).toBe(17 * 5);
    expect(ps.every((p) => p.execution_authorized === false)).toBe(true);
  });
});
describe("reject-only optimization invariants", () => {
  it.each(protocol.evidence_grid as EvidenceMode[])(
    "preserves sufficient evidence and vetoes under %s",
    (mode) => {
      const ps = preferencesForSetting([...dev.offers, ...offers], {
        ...baseSetting,
        evidence: mode,
      });
      for (const p of ps.filter((p) => p.strategy === "staged_safe_radar")) {
        const full = ps.find(
          (f) => f.id === p.id && f.strategy === "full_paid_radar",
        )!;
        expect(p.execution_authorized).toBe(false);
        if (p.prefer_spend) {
          expect(full.prefer_spend).toBe(true);
          expect(p.canonical_decision).toBe("proceed");
        }
        if (full.canonical_decision !== "proceed")
          expect(p.prefer_spend).toBe(false);
      }
    },
  );
  it("does not lift economic false blocks, lower confidence thresholds or use stale evidence", () => {
    for (const original of offers) {
      for (const evidence of [
        { ...original.evidence, veto: true },
        { ...original.evidence, confidence: 79 },
        { ...original.evidence, quality: "stale" as const },
        { ...original.evidence, sufficient: false },
        { ...original.evidence, authority_explicit: false },
      ]) {
        const o = { ...original, evidence };
        expect(canonicalAssessment(o)).not.toBe("proceed");
        expect(
          decide(o).find((p) => p.strategy === "staged_safe_radar")!
            .prefer_spend,
        ).toBe(false);
      }
    }
  });
  it("retains exact scope restrictions even for profitable provider outputs", () => {
    const o = offers.find((o) => o.id.endsWith("--qualified"))!;
    for (const staticFields of [
      { ...o.static, recipient_allowlisted: false },
      { ...o.static, rail_supported: false },
      { ...o.static, budget_units: 1 },
    ])
      expect(
        decide({ ...o, static: staticFields }).every((p) => !p.prefer_spend),
      ).toBe(true);
  });
  it(
    "matches the actual SDK and simulated paid HTTP path including free insufficiency",
    async () =>
      temporary(async (dir) => {
        const selected = offers.slice(0, 12),
          ps = selected.flatMap((o) => decide(o));
        const r = await validateHttpReplay(selected, ps, dir);
        expect(r.mismatches).toBe(0);
        expect(r.real_payments).toBe(0);
        expect(r.cases).toBe(12);
      }),
    60000,
  );
});
describe("production provenance audit, without production policy changes", () => {
  it("exposes legacy absent-field acceptance instead of silently asserting strict authority", async () => {
    expect(eligibleEvidenceProvenance({ catalog_source: "live" })).toBe(true);
    expect(explicitReviewedProvenance({ catalog_source: "live" })).toBe(false);
    const f = await setupJudgment();
    const quote = await f.service.check(request, "legacy-provenance-audit");
    expect(quote.response.decision).toBe("proceed");
    expect(quote.status).toBe(402);
    expect(auditProvenance().application_policy_changed).toBe(false);
  });
  it("keeps malformed/simulated authority excluded and absent authority visible to reviewers", () => {
    expect(eligibleEvidenceProvenance({ ...localSimulationProvenance })).toBe(
      false,
    );
    expect(
      eligibleEvidenceProvenance({
        catalog_source: "live",
        spending_authority: null,
      }),
    ).toBe(false);
    expect(
      eligibleEvidenceProvenance({
        catalog_source: "live",
        simulation: "false",
      }),
    ).toBe(false);
    expect(
      auditProvenance().permissive_relative_to_explicit_diagnostic,
    ).toContain("spending_authority-absent");
    expect(auditProvenance().production_record_count).toBeNull();
  });
});
