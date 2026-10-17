import { DatabaseSync } from "node:sqlite";
import {
  hashCanonical,
  canonicalSerialize,
} from "../../../src/services/receiptIntegrityService";
import type { EconomicExecutionRecord } from "../../../src/services/economicExecutionGate";
import type { Delivery } from "../providers/mock-provider";
/** Read-only independent observation path. No buyer success argument or signing API. */
export function evaluateDelivery(
  databasePath: string,
  record: EconomicExecutionRecord,
) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = db
      .prepare("SELECT body FROM deliveries WHERE id=?")
      .get(record.authorization_id);
    if (!row || !record.outcome) return null;
    const delivery = JSON.parse(row.body as string) as Delivery;
    if (
      delivery.authorization_id !== record.authorization_id ||
      delivery.operation_hash !== record.operation_hash ||
      hashCanonical(delivery.deliverable) !== record.outcome.response_hash ||
      canonicalSerialize(delivery.outcome) !==
        canonicalSerialize(record.outcome)
    )
      return null;
    return {
      outcome:
        delivery.deliverable.answer === "local-verified-result"
          ? ("confirmed" as const)
          : ("contradicted" as const),
      evidence_refs: [
        ...record.outcome.artifact_refs,
        record.outcome.response_hash,
      ],
    };
  } finally {
    db.close();
  }
}
