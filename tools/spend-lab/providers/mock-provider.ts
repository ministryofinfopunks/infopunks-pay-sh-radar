import type {
  EconomicExecutor,
  ExecutorOutcome,
} from "../../../src/services/economicJudgmentEngine";
import type { ExecutionAuthorization } from "../../../src/schemas/economicEngine";
import {
  canonicalSerialize,
  hashCanonical,
} from "../../../src/services/receiptIntegrityService";
import type { ExecutionAuthorizationIssuer } from "../../../src/security/executionAuthorization";
import { LabDatabase } from "../harness/storage";
import { PROFILE } from "../agents/roles";
export type Delivery = {
  authorization_id: string;
  operation_hash: string;
  deliverable: { simulation: true; answer: string };
  outcome: ExecutorOutcome;
};
export function mockProvider(
  db: LabDatabase,
  verifier: Pick<ExecutionAuthorizationIssuer, "verify">,
  now: () => Date,
  mode: string,
): EconomicExecutor {
  const lookup = (auth: ExecutionAuthorization): Delivery | null => {
    const row = db.db
      .prepare("SELECT body FROM deliveries WHERE id=?")
      .get(auth.payload.authorization_id);
    return row ? JSON.parse(row.body as string) : null;
  };
  return {
    profile_id: PROFILE,
    preflight: async () => mode !== "provider-failure",
    async execute(op, auth) {
      if (
        !verifier.verify(auth, now()) ||
        canonicalSerialize(op) !== canonicalSerialize(auth.payload.operation) ||
        op.profile_id !== PROFILE ||
        op.chain_id !== "lab:simulation" ||
        op.recipient !== "lab-provider"
      )
        throw new Error("mock_boundary_denied");
      const prior = lookup(auth);
      if (prior) return prior.outcome;
      const deliverable = {
        simulation: true as const,
        answer: mode === "bad-deliverable" ? "wrong" : "local-verified-result",
      };
      const outcome: ExecutorOutcome = {
        finalized: true,
        settlement_ref: "lab-settlement/" + auth.payload.authorization_id,
        response_hash: hashCanonical(deliverable),
        status: "succeeded",
        amount_atomic: op.amount_atomic,
        fee_atomic: "500",
        artifact_refs: ["lab-artifact/" + auth.payload.authorization_id],
      };
      db.db
        .prepare("INSERT INTO deliveries VALUES(?,?)")
        .run(
          auth.payload.authorization_id,
          JSON.stringify({
            authorization_id: auth.payload.authorization_id,
            operation_hash: hashCanonical(op),
            deliverable,
            outcome,
          }),
        );
      if (mode === "settlement-timeout" || mode === "crash-recovery")
        throw new Error("simulated_response_lost_after_commit");
      return mode === "forged-proof"
        ? { ...outcome, response_hash: hashCanonical("forged") }
        : outcome;
    },
    async verify(op, auth, outcome) {
      const delivery = lookup(auth);
      return (
        !!delivery &&
        delivery.operation_hash === hashCanonical(op) &&
        hashCanonical(delivery.deliverable) === outcome.response_hash &&
        canonicalSerialize(delivery.outcome) === canonicalSerialize(outcome)
      );
    },
    reconcile: async (_op, auth) => lookup(auth)?.outcome ?? null,
  };
}
