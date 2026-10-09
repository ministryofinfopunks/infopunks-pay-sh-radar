import type { FastifyInstance } from 'fastify';
import { ReceiptIdSchema } from '../schemas/receipts/common';
import type { DecisionViewService } from '../services/decisionViewService';

/** Redacted projection, no raw payloads, authorization tokens, or write paths. */
export function registerDecisionViewRoutes(app: FastifyInstance, service: DecisionViewService,
  rateLimiter: { consume(key: string): { allowed: boolean; retryAfterMs: number } }): void {
  app.get<{ Params: { id: string } }>('/v1/decision-views/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const rate = rateLimiter.consume(req.ip);
    if (!rate.allowed) return reply.code(429).header('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000))).send({ error: 'decision_view_rate_limited' });
    const parsed = ReceiptIdSchema.safeParse(req.params.id);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_judgment_id' });
    try {
      const view = await service.get(parsed.data);
      if (!view) return reply.code(404).send({ error: 'canonical_judgment_not_found' });
      return { data: view };
    } catch {
      // Fail closed; do not provide an incomplete or fabricated verdict.
      return reply.code(503).send({ error: 'decision_view_unavailable' });
    }
  });
}
