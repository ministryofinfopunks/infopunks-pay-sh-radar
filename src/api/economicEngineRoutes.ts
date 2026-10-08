import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { EconomicPolicySchema, EconomicJobSchema, ExecutionAuthorizationSchema, EconomicOperationSchema, EngineId } from '../schemas/economicEngine';
import { MemoryEconomicEngineStore, PostgresEconomicEngineStore } from '../persistence/economicEngineStore';
import { executionAuthorizationIssuerFromEnv } from '../security/executionAuthorization';
import { createJevHttpProvider } from '../services/jevWitness';
import { createEconomicJudgmentEngine, EconomicEngineError, type EconomicEngineOptions } from '../services/economicJudgmentEngine';
import { createEconomicExecutionGate } from '../services/economicExecutionGate';
import { createEconomicPrecedentService } from '../services/economicPrecedentService';

export type EconomicEngineOverrides = Partial<Omit<EconomicEngineOptions, 'receipts' | 'threshold' | 'judgmentIssuer'>> & { enabled?: boolean };
const flag = (name: string, fallback: boolean) => {
  const value = process.env[name];
  if (value !== undefined && value !== 'true' && value !== 'false') throw new Error('invalid_' + name.toLowerCase());
  return value === undefined ? fallback : value === 'true';
};
export async function registerEconomicEngineRoutes(app: FastifyInstance, defaults: Pick<EconomicEngineOptions, 'receipts' | 'threshold' | 'judgmentIssuer'> & {
  pool: pg.Pool | null; isProduction: boolean; adminToken: string | null;
}, overrides: EconomicEngineOverrides = {}) {
  const enabled = overrides.enabled ?? flag('ECONOMIC_ENGINE_ENABLED', false);
  if (!enabled) return;
  const policies = z.array(EconomicPolicySchema).max(64).parse(JSON.parse(process.env.ECONOMIC_ENGINE_POLICIES_JSON ?? '[]'));
  if (new Set(policies.map(p => p.principal_id)).size !== policies.length) throw new Error('duplicate_economic_engine_principal');
  const currentPolicy = overrides.currentPolicy ?? (async (principal: string) => policies.find(p => p.principal_id === principal) ?? null);
  const store = overrides.store ?? (defaults.pool ? new PostgresEconomicEngineStore(defaults.pool) : new MemoryEconomicEngineStore());
  const shadow = overrides.shadow ?? flag('ECONOMIC_ENGINE_SHADOW_MODE', true);
  const allowAuthorizations = overrides.allowAuthorizations ?? flag('ECONOMIC_ENGINE_AUTHORIZATION_ENABLED', false);
  const authorizationIssuer = overrides.authorizationIssuer ?? executionAuthorizationIssuerFromEnv(process.env);
  const jevEnabled = flag('ECONOMIC_ENGINE_JEV_ENABLED', false);
  const provider = overrides.provider ?? (jevEnabled ? createJevHttpProvider(process.env.TYPESAFE_API_KEY ?? '') : null);
  const executors = overrides.executors ?? [];
  if (!defaults.adminToken) throw new Error('economic_engine_admin_authentication_required');
  if (allowAuthorizations && (shadow || !authorizationIssuer || !executors.length || (defaults.isProduction && !store.durable))) throw new Error('economic_engine_authorization_configuration_incomplete');
  if (defaults.pool) await defaults.pool.query('select kind,id from economic_engine_records limit 0');
  const engine = createEconomicJudgmentEngine({ ...defaults, store, currentPolicy, authorizationIssuer, provider, executors, shadow, allowAuthorizations,
    now: overrides.now, inferenceTimeoutMs: overrides.inferenceTimeoutMs, deterministicSelect: overrides.deterministicSelect,
    executorTimeoutMs: overrides.executorTimeoutMs });
  const execution = createEconomicExecutionGate(engine), precedent = createEconomicPrecedentService(engine);
  const hits = new Map<string, { count: number; expires: number }>();
  const authenticate = (header: string | undefined) => {
    const supplied = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : '');
    const expected = Buffer.from(defaults.adminToken!);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };
  // Every economic write is an authenticated host operation. The public paid
  // decision facade accepts only existing assessment request fields.
  await app.register(async protectedApp => {
    protectedApp.addHook('preHandler', async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!authenticate(req.headers.authorization)) return reply.code(401).send({ error: 'economic_engine_host_authentication_required' });
      const time = Date.now(), old = hits.get(req.ip);
      const hit = !old || old.expires <= time ? { count: 0, expires: time + 60000 } : old;
      hit.count++; hits.set(req.ip, hit);
      for (const [ip, record] of hits) if (record.expires <= time) hits.delete(ip);
      if (hit.count > 60) return reply.code(429).header('Retry-After', '60').send({ error: 'economic_engine_rate_limited' });
    });
    protectedApp.setErrorHandler((error, _req, reply) => {
      if (error instanceof EconomicEngineError) return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_economic_engine_request' });
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413) return reply.code(413).send({ error: 'economic_engine_body_too_large' });
      return reply.code(503).send({ error: 'economic_engine_unavailable' });
    });
    protectedApp.post('/internal/economic-engine/decide', { bodyLimit: 131072 }, async req => {
      const job = EconomicJobSchema.parse(req.body);
      return { data: await engine.decide(job, job.principal_id) };
    });
    protectedApp.get<{ Params: { id: string } }>('/internal/economic-engine/attempts/:id', async (req, reply) => {
      const attempt = await engine.getAttempt(EngineId.parse(req.params.id));
      return attempt ? { data: attempt } : reply.code(404).send({ error: 'attempt_not_found' });
    });
    protectedApp.post('/internal/economic-engine/recover-assessment', { bodyLimit: 1024 }, async req => {
      const input = z.object({ attempt_id: EngineId }).strict().parse(req.body);
      return { data: await engine.recoverAssessment(input.attempt_id) };
    });
    protectedApp.post('/internal/economic-engine/execute', { bodyLimit: 16384 }, async req => {
      const input = z.object({ authorization: ExecutionAuthorizationSchema, operation: EconomicOperationSchema, delegate_id: EngineId, audience: EngineId }).strict().parse(req.body);
      return { data: await execution.execute(input.authorization, input.operation, input.delegate_id, input.audience) };
    });
    protectedApp.post('/internal/economic-engine/reconcile', { bodyLimit: 1024 }, async req => {
      const input = z.object({ authorization_id: EngineId }).strict().parse(req.body);
      return { data: await execution.reconcile(input.authorization_id) };
    });
    protectedApp.post('/internal/economic-engine/revoke', { bodyLimit: 2048 }, async req => {
      const input = z.object({ authorization_id: EngineId.optional(), profile_id: EngineId.optional(), reason: EngineId }).strict().parse(req.body);
      return { data: await execution.revoke(input) };
    });
    protectedApp.post('/internal/economic-engine/trace-events', { bodyLimit: 16384 }, async req => {
      const input = z.object({ principal_id: EngineId, event: z.unknown() }).strict().parse(req.body);
      return { data: await precedent.recordEvent(input.event, input.principal_id) };
    });
    protectedApp.get<{ Params: { principal: string; trace: string; run: string } }>('/internal/economic-engine/traces/:principal/:trace/:run', async req => ({
      data: await precedent.inspectTrace(EngineId.parse(req.params.principal), EngineId.parse(req.params.trace), EngineId.parse(req.params.run))
    }));
    protectedApp.get('/internal/economic-engine/summary', async () => ({ data: await precedent.summary(), shadow, authorization_enabled: allowAuthorizations,
      profiles: executors.map(e => e.profile_id), ipx_payments_enabled: false, treasury_execution_enabled: false }));
    protectedApp.get<{ Params: { attempt: string; asset: string } }>('/internal/economic-engine/economics/:attempt/:asset', async req => ({
      data: await precedent.economics(EngineId.parse(req.params.attempt), EngineId.parse(req.params.asset))
    }));
  });
  app.get('/v1/execution-authorization/keys', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return authorizationIssuer ? { data: authorizationIssuer.publicKeys() } : reply.code(503).send({ error: 'execution_authorization_issuer_unavailable' });
  });
}
