/** Recompute first, then compare the entire retained report set, never just a winning subtotal. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
const directory = resolve(process.argv[2] ?? ".data/value-r2/evaluation");
const files = [
  ["summary.json", "local-summary.json"],
  ["development-comparison.json", "development-case-ledger.json"],
  ["holdout-comparison.json", "holdout-case-ledger.json"],
  ["provenance-audit.json", "local-provenance-vectors.json"],
];
for (const [fresh, retained] of files) {
  const actual = JSON.parse(readFileSync(resolve(directory, fresh), "utf8"));
  const expected = JSON.parse(
    readFileSync(resolve(__dirname, "reports", retained), "utf8"),
  );
  if (hashCanonical(actual) !== hashCanonical(expected))
    throw new Error("retained_evidence_mismatch_" + retained);
}
console.log(
  JSON.stringify({
    reports: files.length,
    retained_evidence: "MATCH",
    status: "HOLD",
    economic_usefulness: "NOT_ESTABLISHED",
  }),
);
