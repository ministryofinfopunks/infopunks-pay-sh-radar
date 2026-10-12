import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RhChainStockEvidenceService } from '../services/rhChainStockEvidenceService';

const params = z.object({ contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }).strict();
const query = z.object({ route: z.enum(['market_context', 'pltr_uniswap_v4_simulation']).default('market_context'),
  pool_id: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional() }).strict().refine(
  (input) => input.route === 'pltr_uniswap_v4_simulation' ? Boolean(input.pool_id) : input.pool_id === undefined,
  'pool_id_required_for_simulation_route_only');

export async function registerRhChainStockEvidenceRoutes(app: FastifyInstance, service: RhChainStockEvidenceService) {
  await app.register(async publicApp => {
    // Freshness ages advance on reads. There is no user-specific state or shared response cache.
    publicApp.addHook('onRequest', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
    publicApp.get('/v1/4663/stock-tokens', async (req, reply) => {
      if (!z.object({}).strict().safeParse(req.query).success) return reply.code(400).send({ error: 'invalid_stock_evidence_query' });
      try { return { data: await service.universe() }; }
      catch { return reply.code(503).send({ error: 'stock_evidence_storage_unavailable' }); }
    });
    publicApp.get<{ Params: { contract: string } }>('/v1/4663/stock-tokens/:contract/evidence', async (req, reply) => {
      const parsedParams = params.safeParse(req.params), parsedQuery = query.safeParse(req.query);
      if (!parsedParams.success || !parsedQuery.success) return reply.code(400).send({ error: 'invalid_stock_evidence_query' });
      try {
        const evidence = await service.evidence(parsedParams.data.contract, parsedQuery.data.route, parsedQuery.data.pool_id);
        return evidence ? { data: evidence } : reply.code(404).send({ error: 'canonical_stock_contract_not_found' });
      } catch { return reply.code(503).send({ error: 'stock_evidence_storage_unavailable' }); }
    });
  });
}
