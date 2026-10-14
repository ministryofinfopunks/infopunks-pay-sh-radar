import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createJudgmentIdentity } from '../security/judgmentIdentity';
import type { JudgmentOwner } from '../security/judgmentIdentity';
import type { JudgmentRequestRepository } from '../repositories/judgmentRequestRepository';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
import { JudgmentReceiptSchema, type ReceiptKind } from '../schemas/receipts';
import { DecisionContextSchema } from '../schemas/decisionContext';
import { judgmentAccessPolicy } from '../security/judgmentAccessPolicy';

export function registerJudgmentPrivateAccess(app: FastifyInstance, identity: ReturnType<typeof createJudgmentIdentity>,
  journal: JudgmentRequestRepository, store: ReceiptAppendStore, admin: (authorization?: string) => boolean, production = false) {
  const owners = new WeakMap<FastifyRequest, JudgmentOwner>();
  // Private receipts and legacy personal wallet views stay default-deny in all
  // modes until a public projection or wallet ownership model is reviewed.
  app.addHook('onSend', async (req, reply, payload) => {
    const path = req.routeOptions.url === '/*' ? req.url.split('?')[0] : req.routeOptions.url ?? req.url.split('?')[0];
    if (judgmentAccessPolicy(path, req.method, production) !== 'public') reply.header('Cache-Control', 'private, no-store');
    return payload;
  });
  // A root owner is not enough: every disclosed reference must have the same
  // credential-bound tenant and agent. Missing legacy bindings remain denied.
  async function owns(kind: ReceiptKind, id: string, owner: JudgmentOwner,
    visited = new Set<string>()): Promise<boolean> {
    const key = kind + ':' + id;
    if (visited.has(key) || visited.size >= 128) return false;
    visited.add(key);
    try {
      if (kind === 'observation') return await journal.ownsObservation?.(owner, id) ?? false;
      if (kind === 'judgment') {
        if (!/^judgment_[a-f0-9]{64}$/.test(id)) return false;
        const record = await journal.get('sha256:' + id.slice(9));
        if (record?.response.judgment_id !== id || record.owner?.tenant_id !== owner.tenant_id || record.owner.agent_id !== owner.agent_id) return false;
        const parsedReceipt = JudgmentReceiptSchema.safeParse(await store.get('judgment', id));
        if (!parsedReceipt.success) return false;
        const receipt = parsedReceipt.data;
        for (const observationId of receipt.cited_observation_ids) {
          if (!await owns('observation', observationId, owner, visited)) return false;
        }
        if (receipt.schema_version === 'canonical-receipts.v2') {
          const context = DecisionContextSchema.safeParse(await store.getDecisionContext?.(id));
          if (!context.success || context.data.assessment_id !== id) return false;
          for (const ref of context.data.observation_refs) {
            if (!await owns('observation', ref.observation_id, owner, visited)) return false;
          }
          for (const ref of context.data.evaluation_refs) {
            if (!await owns('evaluation', ref.evaluation_id, owner, visited)) return false;
          }
        }
        return true;
      }
      const receipt = await store.get(kind, id);
      if (!receipt) return false;
      if (kind === 'execution' && 'judgment_id' in receipt) return owns('judgment', receipt.judgment_id, owner, visited);
      if (kind === 'evaluation' && 'execution_id' in receipt) return owns('execution', receipt.execution_id, owner, visited);
      return false;
    } finally { visited.delete(key); }
  }
  app.addHook('preHandler', async (req, reply) => {
    const path = req.routeOptions.url === '/*' ? req.url.split('?')[0] : req.routeOptions.url ?? req.url.split('?')[0];
    const executionIntake = path === '/v1/execute-proof';
    const access = judgmentAccessPolicy(path, req.method, production);
    if (access === 'public') return;
    const globalPrivate = access === 'operator';
    reply.header('Cache-Control', 'private, no-store');
    if (admin(req.headers.authorization)) return;
    if (globalPrivate && req.method === 'POST') return reply.code(401).send({ error:'operator_authority_required' });
    const owner = identity.authenticate(req.headers.authorization);
    if (!owner) return reply.code(identity.configured ? 401 : 503).send({ error: identity.configured ? 'judgment_authentication_required' : 'judgment_identity_unavailable' });
    if (executionIntake) {
      const parent = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).judgment_id : undefined;
      if (typeof parent === 'string' && await owns('judgment', parent, owner)) return;
      return reply.code(404).send({ error: 'private_receipt_not_found' });
    }
    const params = req.params as { kind?: string; id?: string };
    const kind = path.startsWith('/v1/receipt-spine/judgment/') || path.startsWith('/v1/decision-views/') ? 'judgment' : params.kind;
    try {
      if (!globalPrivate && params.id && ['observation', 'judgment', 'execution', 'evaluation'].includes(kind ?? '') && await owns(kind as ReceiptKind, params.id, owner)) {
        owners.set(req, owner); return;
      }
    } catch {
      // Repository failure must not expose ancestry or surface database details.
      return reply.code(503).send({ error: 'private_receipt_unavailable' });
    }
    // Global tapes, witnesses, scores and unowned historical records remain operator-only.
    return reply.code(404).send({ error: 'private_receipt_not_found' });
  });
  return { owns, owner: (req: FastifyRequest) => owners.get(req) };
}
