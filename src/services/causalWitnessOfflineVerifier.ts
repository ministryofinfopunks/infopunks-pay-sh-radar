import { createJudgmentIssuer } from '../security/judgmentIssuer';
import type { DecisionContext } from '../schemas/decisionContext';
import type { ReceiptKind } from '../schemas/receipts';
import { createCausalWitnessService } from './causalWitnessService';
import { hashCanonical } from './receiptIntegrityService';
import type { ReceiptAppendStore, ReceiptRecord } from './receiptAuthorityService';

/** Rebuilds the bounded bundle without network access or a private key. */
export async function verifyCausalWitnessOffline(raw: unknown): Promise<{ valid: boolean; category_changed: boolean; real_route_verified: false }> {
  try {
    const witness = raw as Awaited<ReturnType<ReturnType<typeof createCausalWitnessService>['build']>>;
    const { witness_hash, signed_at, signature, signer_registry, ...body } = witness;
    if (!signed_at || !signature || !signer_registry || hashCanonical(body) !== witness_hash) throw new Error('hash_mismatch');
    const trust = createJudgmentIssuer({ issuer: signer_registry.issuer, keys: signer_registry.keys, requireSigned: true });
    if (!trust.verifyWitness?.(witness_hash, signed_at, signature) || !trust.verify(witness.j1) || !trust.verify(witness.j2)) throw new Error('signature_invalid');
    const records = new Map<string, ReceiptRecord>();
    const insert = (kind: ReceiptKind, id: string, receipt: ReceiptRecord) => records.set(kind + ':' + id, receipt);
    for (const observation of witness.observations) insert('observation', observation.observation_id, observation);
    insert('judgment', witness.j1.judgment_id, witness.j1);
    insert('judgment', witness.j2.judgment_id, witness.j2);
    insert('execution', witness.execution.execution_id, witness.execution);
    insert('evaluation', witness.evaluation.evaluation_id, witness.evaluation);
    const contexts = new Map<string, DecisionContext>([[witness.j1.judgment_id, witness.context1], [witness.j2.judgment_id, witness.context2]]);
    const store: ReceiptAppendStore = {
      judgmentTrust: trust,
      get: async (kind, id) => records.get(kind + ':' + id) ?? null,
      list: async kind => [...records.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([,value]) => value),
      append: async () => { throw new Error('offline_read_only'); },
      getDecisionContext: async id => contexts.get(id) ?? null,
      getAcceptance: async (kind,id) => kind === 'evaluation' && id === witness.evaluation.evaluation_id ? witness.evaluation_acceptance : null,
      acceptanceBoundary: async () => ({ sequence: witness.context2.projection_boundary.accepted_sequence ?? 0,
        accepted_at: witness.context2.projection_boundary.accepted_at ?? witness.context2.assessed_at })
    };
    const replay = await createCausalWitnessService(store).build(witness.j1.judgment_id, witness.evaluation.evaluation_id, witness.j2.judgment_id);
    if (replay.witness_hash !== witness_hash || !replay.counterfactual.category_changed) throw new Error('counterfactual_invalid');
    return { valid: true, category_changed: true, real_route_verified: false };
  } catch { return { valid: false, category_changed: false, real_route_verified: false }; }
}
