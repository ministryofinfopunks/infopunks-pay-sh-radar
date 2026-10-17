import { join } from "node:path";
import {
  freePort,
  startHttpLab,
  seedHttpEvidence,
} from "../successor/http-client";
import type { Offer, Preference } from "./types";
/** Real localhost canonical SDK + simulated x402 check; no service execution or wallet. */
export async function validateHttpReplay(
  offers: Offer[],
  decisions: Preference[],
  directory: string,
) {
  let lab = await startHttpLab(
    join(directory, "judgment.sqlite"),
    await freePort(),
  );
  const rows = [];
  try {
    for (const [index, o] of offers.entries()) {
      if (index && index % 5 === 0) {
        const port = Number(new URL(lab.origin).port);
        await lab.close();
        lab = await startHttpLab(join(directory, "judgment.sqlite"), port);
      }
      // Missing/stale/absent-authority cannot be upgraded by transport validation.
      // HTTP seed API models these as insufficient, while pure replay retains exact provenance/freshness negatives.
      const input = await seedHttpEvidence(lab, "lab-value-" + o.id, {
        confidence: o.evidence.confidence,
        veto: o.evidence.veto,
        sufficient:
          o.evidence.quality === "fresh" &&
          o.evidence.sufficient &&
          o.evidence.authority_explicit,
      });
      const started = performance.now();
      const result = await lab
        .client()
        .judge(input, { idempotencyKey: "value-" + o.id });
      const expected = decisions.find(
        (d) => d.id === o.id && d.strategy === "full_paid_radar",
      )!;
      if (
        result.decision !== expected.canonical_decision ||
        result.payment_required !== expected.paid_judgment ||
        (result.payment_required &&
          (result.state !== "RECEIPT_VERIFIED" ||
            result.verification?.issuer !== "verified")) ||
        (!result.payment_required &&
          (result.receipt !== null || result.cost.amount !== "0"))
      )
        throw new Error("http_replay_mismatch_" + o.id);
      rows.push({
        latency_ms: performance.now() - started,
        id: o.id,
        decision: result.decision,
        sdk_state: result.state,
        simulated_paid: result.payment_required,
        receipt_verified: result.payment_required
          ? result.verification?.issuer === "verified"
          : null,
        fee_atomic: result.payment_required ? "10000" : "0",
        wire_fee_currency: "USDC_METADATA_SIMULATION_ONLY",
        real_settlement: false,
      });
    }
    const count = await lab.counts();
    if (count !== rows.filter((r) => r.simulated_paid).length)
      throw new Error("simulated_payment_reconciliation_failed");
    return {
      cases: rows.length,
      simulated_payments: count,
      mismatches: 0,
      real_payments: 0,
      rows,
    };
  } finally {
    await lab.close();
  }
}
