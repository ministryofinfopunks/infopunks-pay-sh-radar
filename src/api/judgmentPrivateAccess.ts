import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { JudgmentOwner } from '../security/judgmentIdentity';
import { createJudgmentIdentity } from '../security/judgmentIdentity';
import type { JudgmentRequestRepository } from '../repositories/judgmentRequestRepository';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
import type { ReceiptKind } from '../schemas/receipts';
import { judgmentAccessPolicy } from '../security/judgmentAccessPolicy';

export function registerJudgmentPrivateAccess(app: FastifyInstance, identity: ReturnType<typeof createJudgmentIdentity>,
  journal: JudgmentRequestRepository, store: ReceiptAppendStore, admin: (authorization?: string) => boolean) {
  const owners = new WeakMap<FastifyRequest, JudgmentOwner>();
  const production = process.env.NODE_ENV === 'production';
  app.addHook('onSend', async (req, reply, payload) => {
    const path = req.routeOptions.url === '/*' ? req.url.split('?')[0] : req.routeOptions.url ?? req.url.split('?')[0];
    if (judgmentAccessPolicy(path, req.method, production) !== 'public') reply.header('Cache-Control', 'private, no-store');
    return payload;
  });
  async function owns(kind: ReceiptKind, id: string, owner: JudgmentOwner): Promise<boolean> {
    if (kind === 'judgment') {
      if (!/^judgment_[a-f0-9]{64}$/.test(id)) return false;
      const record = await journal.get('sha256:' + id.slice(9));
      return record?.response.judgment_id === id && record.owner?.tenant_id === owner.tenant_id && record.owner.agent_id === owner.agent_id;
    }
    if (kind === 'observation') return await journal.ownsObservation?.(owner, id) ?? false;
    const receipt = await store.get(kind, id);
    if (!receipt) return false;
    if (kind === 'execution' && 'judgment_id' in receipt) return owns('judgment', receipt.judgment_id, owner);
    if (kind === 'evaluation' && 'execution_id' in receipt) return owns('execution', receipt.execution_id, owner);
    return false;
  }
  app.addHook('preHandler', async (req, reply) => {
    const path = req.routeOptions.url === '/*' ? req.url.split('?')[0] : req.routeOptions.url ?? req.url.split('?')[0];
    const isCanonical = path.startsWith('/v1/receipt-spine/');
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
    const kind = path.startsWith('/v1/receipt-spine/judgment/') ? 'judgment' : params.kind;
    if (!globalPrivate && params.id && ['observation', 'judgment', 'execution', 'evaluation'].includes(kind ?? '') && await owns(kind as ReceiptKind, params.id, owner)) {
      owners.set(req, owner); return;
    }
    // Global tapes, witnesses, scores and unowned historical records remain operator-only.
    return reply.code(404).send({ error: 'private_receipt_not_found' });
  });
  return { owns, owner: (req: FastifyRequest) => owners.get(req) };
}
