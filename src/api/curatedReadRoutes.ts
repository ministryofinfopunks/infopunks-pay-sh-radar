import type { FastifyInstance, FastifyReply } from 'fastify';
import { abundanceClaimsFeed, getAbundanceDeskPayload, machineWorkReceipts } from '../data/abundanceDesk';
import { getAttentionMarketSignalBySlug, getAttentionMarketWatchIndex, getAttentionMarketIntakeRequirements } from '../data/attentionMarketWatch';
import { getCandidateSignal, listCandidateSignals } from '../data/candidateSignals';
import { getNarrativeAssetBySlug, listNarrativeAssets, getSignalSurfaceBySlug, listSignalSurfaces } from '../data/narrativeIntel';
import { getSignalDeskIndex } from '../data/signalDesk';
import { getLatestSignalUpdate, getSignalUpdate, getSignalUpdateSummary, listSignalUpdates } from '../data/signalUpdates';

const attentionSlugs = '(?:ansem|tjr|luke|superman)';
const signalSlugs = '(?:ansem|black-bull|troll)';
const signalUpdateIds = '(?:seu_black_bull_00[1-7]|seu_troll_00[1-2])';
const candidateIds = '(?:candidate_troll_reindex|candidate_sol_persona_attention|candidate_agentic_meme_repeat_mentions|candidate_depin_machine_payments|candidate_ai_wallet_coordination|candidate_article6_carbon|candidate_solana_trench_myth)';
const narrativeReadPaths = [
  new RegExp(`^/v1/narratives(?:/${signalSlugs})?$`),
  new RegExp(`^/v1/signals(?:/${signalSlugs}(?:/updates(?:/${signalUpdateIds})?)?)?$`),
  new RegExp(`^/v1/attention-market-watch(?:/intake/requirements|/${attentionSlugs})?$`),
  new RegExp(`^/v1/signal-desk(?:/candidates(?:/${candidateIds})?)?$`),
  /^\/v1\/abundance(?:\/(?:claims|receipts))?$/
];

export function isCuratedReadPath(path: string) {
  return narrativeReadPaths.some((pattern) => pattern.test(path));
}

export function isCuratedReadPagePath(path: string) {
  return /^\/(?:narratives|abundance|narratives\/abundance-desk|narratives\/attention-markets|narratives\/attention-market-watch|attention-market-watch(?:\/(?:ansem|tjr|luke|superman))?|signals\/(?:ansem|black-bull|troll))\/?$/.test(path);
}

function archivalHeaders(reply: FastifyReply, dates: Array<string | null | undefined>) {
  const validDates = dates.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!))).sort();
  const latest = validDates.at(-1) ?? null;
  reply.header('X-Radar-Data-Class', 'curated-archive');
  reply.header('X-Radar-Data-Freshness', 'stale');
  if (latest) reply.header('X-Radar-Source-Updated-At', latest);
  reply.header('Cache-Control', 'public, max-age=60');
}

export function registerCuratedReadRoutes(app: FastifyInstance) {
  app.get('/v1/narratives', async (_req, reply) => {
    const data = listNarrativeAssets();
    archivalHeaders(reply, data.map((item) => item.last_updated));
    return { data };
  });
  app.get<{ Params: { slug: string } }>('/v1/narratives/:slug', async (req, reply) => {
    const data = getNarrativeAssetBySlug(req.params.slug);
    if (!data) return reply.code(404).send({ error: 'narrative_not_found' });
    archivalHeaders(reply, [data.last_updated]);
    return { data };
  });
  app.get('/v1/signals', async (_req, reply) => {
    const data = listSignalSurfaces();
    archivalHeaders(reply, data.map((item) => item.last_updated));
    return { data };
  });
  app.get<{ Params: { slug: string } }>('/v1/signals/:slug', async (req, reply) => {
    const data = getSignalSurfaceBySlug(req.params.slug);
    if (!data) return reply.code(404).send({ error: 'signal_surface_not_found' });
    archivalHeaders(reply, [data.last_updated]);
    return { data };
  });
  app.get<{ Params: { slug: string } }>('/v1/signals/:slug/updates', async (req, reply) => {
    const signal = getSignalSurfaceBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'signal_surface_not_found' });
    const updates = listSignalUpdates(req.params.slug);
    archivalHeaders(reply, [signal.last_updated, ...updates.map((item) => item.timestamp)]);
    return {
      data: {
        signal_slug: req.params.slug,
        count: updates.length,
        updates,
        latest_update: getLatestSignalUpdate(req.params.slug),
        summary: getSignalUpdateSummary(req.params.slug)
      }
    };
  });
  app.get<{ Params: { slug: string; updateId: string } }>('/v1/signals/:slug/updates/:updateId', async (req, reply) => {
    const signal = getSignalSurfaceBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'signal_surface_not_found' });
    const update = getSignalUpdate(req.params.slug, req.params.updateId);
    if (!update) return reply.code(404).send({ error: 'signal_update_not_found' });
    archivalHeaders(reply, [signal.last_updated, update.timestamp]);
    return { data: { signal_slug: req.params.slug, update } };
  });
  app.get('/v1/attention-market-watch', async (_req, reply) => {
    const data = getAttentionMarketWatchIndex();
    archivalHeaders(reply, [data.generated_at]);
    return { data };
  });
  app.get('/v1/attention-market-watch/intake/requirements', async (_req, reply) => {
    archivalHeaders(reply, [getAttentionMarketWatchIndex().generated_at]);
    return { data: getAttentionMarketIntakeRequirements() };
  });
  app.get<{ Params: { slug: string } }>('/v1/attention-market-watch/:slug', async (req, reply) => {
    const signal = getAttentionMarketSignalBySlug(req.params.slug);
    if (!signal) return reply.code(404).send({ error: 'attention_market_signal_not_found' });
    archivalHeaders(reply, [signal.updated_at]);
    return { data: { signal } };
  });
  app.get('/v1/signal-desk', async (_req, reply) => {
    const data = getSignalDeskIndex();
    archivalHeaders(reply, [data.generated_at]);
    return { data };
  });
  app.get('/v1/signal-desk/candidates', async (_req, reply) => {
    const candidates = listCandidateSignals();
    archivalHeaders(reply, candidates.map((item) => item.updated_at));
    return { data: { count: candidates.length, candidates } };
  });
  app.get<{ Params: { candidateId: string } }>('/v1/signal-desk/candidates/:candidateId', async (req, reply) => {
    const candidate = getCandidateSignal(req.params.candidateId);
    if (!candidate) return reply.code(404).send({ error: 'candidate_signal_not_found' });
    archivalHeaders(reply, [candidate.updated_at]);
    return { data: { candidate } };
  });
  app.get('/v1/abundance', async (_req, reply) => {
    const data = getAbundanceDeskPayload();
    archivalHeaders(reply, [data.generated_at]);
    return { data };
  });
  app.get('/v1/abundance/claims', async (_req, reply) => {
    const generatedAt = getAbundanceDeskPayload().generated_at;
    archivalHeaders(reply, [generatedAt]);
    return { data: { generated_at: generatedAt, source: 'infopunks-pay-sh-radar', module: 'abundance-desk', count: abundanceClaimsFeed.length, claims: abundanceClaimsFeed } };
  });
  app.get('/v1/abundance/receipts', async (_req, reply) => {
    const generatedAt = getAbundanceDeskPayload().generated_at;
    archivalHeaders(reply, [generatedAt]);
    return { data: { generated_at: generatedAt, source: 'infopunks-pay-sh-radar', module: 'abundance-desk', count: machineWorkReceipts.length, receipts: machineWorkReceipts } };
  });
}
