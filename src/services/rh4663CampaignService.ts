/**
 * Phase 9 campaign orchestration.
 *
 * A campaign is deliberately a small presentation record.  It owns neither a
 * market observation nor a conclusion: every visible evidence value is
 * resolved from the already assembled public Front Door read model.
 */
import { z } from 'zod';
import pg from 'pg';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { FrontdoorEvidenceState, FrontdoorOpenLoopState, FrontdoorSourceRef, OpenLoop, Rh4663FrontdoorState } from './rh4663FrontdoorService';
import type { Rh4663ShareObject } from './rh4663ShareObjectService';

export const RH_4663_CAMPAIGN = 'RH_4663_CAMPAIGN' as const;
export const RH_4663_CAMPAIGN_PRESENTATION_SNAPSHOT = 'CAMPAIGN_PRESENTATION_SNAPSHOT' as const;
export const RH_4663_CAMPAIGN_STATES = ['DRAFT', 'SCHEDULED', 'LIVE', 'RESOLVING', 'COMPLETE', 'ARCHIVED', 'CANCELLED'] as const;
export type Rh4663CampaignState = typeof RH_4663_CAMPAIGN_STATES[number];
export type CampaignEvidenceState = FrontdoorEvidenceState | 'FALSIFIED' | 'ALLOW';

const text = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[<>\u0000-\u001f\u007f]/.test(value), 'campaign_text_must_be_plain_text');
const optionalText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[<>\u0000-\u001f\u007f]/.test(value), 'campaign_text_must_be_plain_text').optional();
const id = z.string().trim().min(1).max(180).regex(/^[a-zA-Z0-9:._-]+$/, 'campaign_id_invalid');
const internalPath = z.string().max(500).regex(/^\/(?:4663|v1\/4663)(?:\/|$)/, 'campaign_source_must_be_an_internal_public_path');
const SourceRefSchema = z.object({ source_type: id, source_id: id, href: internalPath, observed_at: z.string().datetime().nullable().optional() }).strict();

export const Rh4663CampaignCreateSchema = z.object({
  campaign_id: id,
  title: text(120),
  short_title: text(48),
  priority: z.number().int().min(1).max(100),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable().optional(),
  hero_subject_type: id,
  hero_subject_id: id,
  // This copy frames a canonical object; it is not an independently asserted
  // research finding.  hero_evidence_state is intentionally not writable.
  hero_statement: text(280),
  primary_source_ref: SourceRefSchema,
  primary_open_loop_ids: z.array(id).max(4).default([]),
  primary_watch_case_ids: z.array(id).max(4).default([]),
  primary_share_object_ids: z.array(id).max(6).default([]),
  primary_call_window_id: id.nullable().optional(),
  why_it_matters: optionalText(420),
  action_label: optionalText(48)
}).strict().superRefine((value, ctx) => {
  if (value.ends_at && Date.parse(value.ends_at) < Date.parse(value.starts_at)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ends_at'], message: 'campaign_ends_before_start' });
  if (/\b(?:buy|sell|ape|launching|coming soon|ready)\b/i.test(value.action_label ?? '')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['action_label'], message: 'campaign_action_is_not_permitted' });
});
export type Rh4663CampaignCreate = z.infer<typeof Rh4663CampaignCreateSchema>;

export type Rh4663Campaign = Omit<Rh4663CampaignCreate, 'ends_at' | 'primary_call_window_id' | 'why_it_matters' | 'action_label'> & {
  object_type: typeof RH_4663_CAMPAIGN;
  campaign_version: number;
  state: Rh4663CampaignState;
  ends_at: string | null;
  /** Always null in storage; evidence is derived at projection time. */
  hero_evidence_state: null;
  primary_call_window_id: string | null;
  why_it_matters: string | null;
  action_label: string | null;
  created_at: string;
  updated_at: string;
  presentation_version: number;
};

export type CampaignHero = {
  statement: string; primary_metric: string | null; evidence_state: CampaignEvidenceState;
  source_freshness: string | null; source_ref: FrontdoorSourceRef; deep_link: string;
  why_it_matters: string; next_checkpoint: { label: string; deep_link: string } | null;
  action: { label: string; href: string; kind: 'VIEW_EVIDENCE' | 'FOLLOW_OPEN_LOOP' | 'MAKE_CALL' };
};
export type Rh4663CampaignProjection = {
  active: boolean; campaign_id: string | null; state: 'LIVE' | 'RESOLVING' | null;
  hero: CampaignHero | null; open_loop: Pick<OpenLoop, 'loop_id' | 'question' | 'state' | 'deep_link'> | null;
  call_ref: { window_id: string; deep_link: string } | null; share_ref: string | null;
  degraded_reason?: 'CAMPAIGN_SOURCE_UNAVAILABLE' | null;
};
export type CampaignPresentationSnapshot = {
  object_type: typeof RH_4663_CAMPAIGN_PRESENTATION_SNAPSHOT; snapshot_id: string; campaign_id: string;
  stage: 'LIVE_START' | 'RESOLUTION' | 'COMPLETE'; created_at: string; presentation: Rh4663CampaignProjection;
};

export interface Rh4663CampaignStore {
  list(): Promise<Rh4663Campaign[]>;
  get(campaignId: string): Promise<Rh4663Campaign | null>;
  put(campaign: Rh4663Campaign): Promise<void>;
  snapshots(campaignId: string): Promise<CampaignPresentationSnapshot[]>;
  addSnapshot(snapshot: CampaignPresentationSnapshot): Promise<void>;
}

export class InMemoryRh4663CampaignStore implements Rh4663CampaignStore {
  private readonly campaigns = new Map<string, Rh4663Campaign>();
  private readonly history = new Map<string, CampaignPresentationSnapshot[]>();
  async list() { return [...this.campaigns.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(copy); }
  async get(campaignId: string) { const campaign = this.campaigns.get(campaignId); return campaign ? copy(campaign) : null; }
  async put(campaign: Rh4663Campaign) { this.campaigns.set(campaign.campaign_id, copy(campaign)); }
  async snapshots(campaignId: string) { return (this.history.get(campaignId) ?? []).map(copy); }
  async addSnapshot(snapshot: CampaignPresentationSnapshot) { const entries = this.history.get(snapshot.campaign_id) ?? []; if (!entries.some((item) => item.stage === snapshot.stage)) entries.push(copy(snapshot)); this.history.set(snapshot.campaign_id, entries); }
}

/** Durable campaign history for production. Canonical evidence remains in its
 * own stores; this table contains presentation references and snapshots only. */
export class PostgresRh4663CampaignStore implements Rh4663CampaignStore {
  private readonly pool: pg.Pool; private initialized: Promise<void> | null = null;
  constructor(source: PostgresPoolSource) { this.pool = resolvePostgresPool(source).pool; }
  async list() { await this.ensure(); const result = await this.pool.query<{ campaign: Rh4663Campaign }>('select campaign from rh4663_campaigns order by updated_at desc'); return result.rows.map((row) => copy(row.campaign)); }
  async get(campaignId: string) { await this.ensure(); const result = await this.pool.query<{ campaign: Rh4663Campaign }>('select campaign from rh4663_campaigns where campaign_id = $1', [campaignId]); return result.rows[0] ? copy(result.rows[0].campaign) : null; }
  async put(campaign: Rh4663Campaign) { await this.ensure(); await this.pool.query('insert into rh4663_campaigns (campaign_id, campaign, updated_at) values ($1, $2::jsonb, $3) on conflict (campaign_id) do update set campaign = excluded.campaign, updated_at = excluded.updated_at', [campaign.campaign_id, JSON.stringify(campaign), campaign.updated_at]); }
  async snapshots(campaignId: string) { await this.ensure(); const result = await this.pool.query<{ snapshot: CampaignPresentationSnapshot }>('select snapshot from rh4663_campaign_snapshots where campaign_id = $1 order by created_at asc, snapshot_id asc', [campaignId]); return result.rows.map((row) => copy(row.snapshot)); }
  async addSnapshot(snapshot: CampaignPresentationSnapshot) { await this.ensure(); await this.pool.query('insert into rh4663_campaign_snapshots (snapshot_id, campaign_id, stage, snapshot, created_at) values ($1,$2,$3,$4::jsonb,$5) on conflict (campaign_id, stage) do nothing', [snapshot.snapshot_id, snapshot.campaign_id, snapshot.stage, JSON.stringify(snapshot), snapshot.created_at]); }
  private ensure() { if (!this.initialized) this.initialized = this.pool.query("create table if not exists rh4663_campaigns (campaign_id text primary key, campaign jsonb not null, updated_at timestamptz not null); create table if not exists rh4663_campaign_snapshots (snapshot_id text primary key, campaign_id text not null references rh4663_campaigns(campaign_id) on delete cascade, stage text not null, snapshot jsonb not null, created_at timestamptz not null, unique(campaign_id, stage)); create index if not exists rh4663_campaigns_updated_idx on rh4663_campaigns(updated_at desc); create index if not exists rh4663_campaign_snapshots_history_idx on rh4663_campaign_snapshots(campaign_id, created_at asc)").then(() => undefined).catch((error) => { this.initialized = null; throw error; }); return this.initialized; }
}

export class Rh4663CampaignError extends Error {
  constructor(readonly code: string, readonly statusCode = 400) { super(code); }
}

export class Rh4663CampaignService {
  constructor(private readonly store: Rh4663CampaignStore = new InMemoryRh4663CampaignStore(), private readonly now: () => Date = () => new Date()) {}

  async list() { return this.store.list(); }
  async get(campaignId: string) { return this.store.get(campaignId); }
  async history(campaignId: string) { const campaign = await this.store.get(campaignId); if (!campaign) throw new Rh4663CampaignError('campaign_not_found', 404); return { campaign, snapshots: await this.store.snapshots(campaignId) }; }
  async create(input: unknown): Promise<Rh4663Campaign> {
    const parsed = Rh4663CampaignCreateSchema.parse(input);
    if (await this.store.get(parsed.campaign_id)) throw new Rh4663CampaignError('campaign_already_exists', 409);
    const at = this.now().toISOString();
    const campaign: Rh4663Campaign = { ...parsed, object_type: RH_4663_CAMPAIGN, campaign_version: 1, presentation_version: 1, state: 'DRAFT', ends_at: parsed.ends_at ?? null, hero_evidence_state: null, primary_call_window_id: parsed.primary_call_window_id ?? null, why_it_matters: parsed.why_it_matters ?? null, action_label: parsed.action_label ?? null, created_at: at, updated_at: at };
    await this.store.put(campaign); return campaign;
  }
  async activate(campaignId: string, frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]): Promise<Rh4663Campaign> {
    const campaign = await this.require(campaignId);
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.state)) throw new Rh4663CampaignError('campaign_cannot_be_activated', 409);
    if (Date.parse(campaign.starts_at) > this.now().getTime()) throw new Rh4663CampaignError('campaign_start_not_reached', 409);
    this.validate(campaign, frontdoor, shares);
    const conflicts = (await this.store.list()).filter((item) => item.campaign_id !== campaignId && ['LIVE', 'RESOLVING'].includes(item.state));
    if (conflicts.length) throw new Rh4663CampaignError('primary_live_campaign_exists', 409);
    const next = await this.transition(campaign, 'LIVE');
    await this.snapshot(next, 'LIVE_START', frontdoor, shares); return next;
  }
  async complete(campaignId: string, frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]): Promise<Rh4663Campaign> {
    const campaign = await this.require(campaignId);
    if (!['LIVE', 'RESOLVING'].includes(campaign.state)) throw new Rh4663CampaignError('campaign_cannot_be_completed', 409);
    const next = await this.transition(campaign, 'COMPLETE'); await this.snapshot(next, 'COMPLETE', frontdoor, shares); return next;
  }
  async schedule(campaignId: string) { const campaign = await this.require(campaignId); if (campaign.state !== 'DRAFT') throw new Rh4663CampaignError('campaign_cannot_be_scheduled', 409); return this.transition(campaign, 'SCHEDULED'); }
  async cancel(campaignId: string) { const campaign = await this.require(campaignId); if (['COMPLETE', 'ARCHIVED', 'CANCELLED'].includes(campaign.state)) throw new Rh4663CampaignError('campaign_cannot_be_cancelled', 409); return this.transition(campaign, 'CANCELLED'); }

  /** Called only by the cached Front Door. It never reads providers or chains. */
  async project(frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]): Promise<Rh4663CampaignProjection> {
    const active = (await this.store.list()).filter((item) => item.state === 'LIVE' || item.state === 'RESOLVING').sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))[0];
    if (!active) return inactive();
    const campaign = await this.autoAdvance(active, frontdoor, shares);
    if (!['LIVE', 'RESOLVING'].includes(campaign.state)) return inactive();
    return projection(campaign, frontdoor, shares);
  }

  validate(campaign: Rh4663Campaign, frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]) {
    const canonical = findCanonical(campaign, frontdoor);
    if (!canonical) throw new Rh4663CampaignError('campaign_source_missing');
    if (!canonical.source.href.startsWith('/')) throw new Rh4663CampaignError('campaign_source_not_public_safe');
    if (campaign.primary_open_loop_ids.some((loopId) => !frontdoor.open_loops.some((loop) => loop.loop_id === loopId))) throw new Rh4663CampaignError('campaign_open_loop_missing');
    if (campaign.primary_watch_case_ids.some((caseId) => !frontdoor.watch_cards.some((card) => card.source_ref.source_id === caseId || card.id === caseId))) throw new Rh4663CampaignError('campaign_watch_case_missing');
    if (campaign.primary_share_object_ids.some((shareId) => !shares.some((share) => share.share_object_id === shareId))) throw new Rh4663CampaignError('campaign_share_object_missing');
    if (campaign.primary_call_window_id && frontdoor.current_call.window_id !== campaign.primary_call_window_id) throw new Rh4663CampaignError('campaign_call_window_missing');
  }

  private async autoAdvance(campaign: Rh4663Campaign, frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]) {
    const loop = campaign.primary_open_loop_ids.map((id) => frontdoor.open_loops.find((item) => item.loop_id === id)).find(Boolean);
    const explicitResolution = Boolean(campaign.primary_call_window_id && campaign.primary_call_window_id === frontdoor.current_call.window_id && ['published', 'resolved'].includes(frontdoor.current_call.resolution_state ?? ''));
    const explicitLoopResolution = Boolean(loop && ['PARTIALLY_RESOLVED', 'RESOLVED', 'FALSIFIED'].includes(loop.state));
    if (campaign.state === 'LIVE' && (explicitResolution || explicitLoopResolution)) {
      const resolving = await this.transition(campaign, 'RESOLVING'); await this.snapshot(resolving, 'RESOLUTION', frontdoor, shares); return resolving;
    }
    if (campaign.state === 'RESOLVING' && explicitResolution) {
      const complete = await this.transition(campaign, 'COMPLETE'); await this.snapshot(complete, 'COMPLETE', frontdoor, shares); return complete;
    }
    return campaign;
  }
  private async require(campaignId: string) { const campaign = await this.store.get(campaignId); if (!campaign) throw new Rh4663CampaignError('campaign_not_found', 404); return campaign; }
  private async transition(campaign: Rh4663Campaign, state: Rh4663CampaignState) { const next = { ...campaign, state, campaign_version: campaign.campaign_version + 1, presentation_version: campaign.presentation_version + 1, updated_at: this.now().toISOString() }; await this.store.put(next); return next; }
  private async snapshot(campaign: Rh4663Campaign, stage: CampaignPresentationSnapshot['stage'], frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]) { const presentation = projection(campaign, frontdoor, shares); await this.store.addSnapshot({ object_type: RH_4663_CAMPAIGN_PRESENTATION_SNAPSHOT, snapshot_id: `${campaign.campaign_id}:${stage}:${campaign.presentation_version}`, campaign_id: campaign.campaign_id, stage, created_at: this.now().toISOString(), presentation }); }
}

function projection(campaign: Rh4663Campaign, frontdoor: Rh4663FrontdoorState, shares: readonly Rh4663ShareObject[]): Rh4663CampaignProjection {
  const canonical = findCanonical(campaign, frontdoor);
  if (!canonical) return { active: true, campaign_id: campaign.campaign_id, state: campaign.state as 'LIVE' | 'RESOLVING', hero: degradedHero(campaign), open_loop: null, call_ref: null, share_ref: null, degraded_reason: 'CAMPAIGN_SOURCE_UNAVAILABLE' };
  const loop = campaign.primary_open_loop_ids.map((id) => frontdoor.open_loops.find((item) => item.loop_id === id)).find(Boolean) ?? frontdoor.open_loops.find((item) => item.source_ref.source_type === campaign.primary_source_ref.source_type && item.source_ref.source_id === campaign.primary_source_ref.source_id) ?? null;
  const call = campaign.primary_call_window_id === frontdoor.current_call.window_id ? { window_id: frontdoor.current_call.window_id, deep_link: frontdoor.current_call.deep_link } : null;
  const share = campaign.primary_share_object_ids.find((id) => shares.some((item) => item.share_object_id === id)) ?? null;
  const action = call ? { label: campaign.action_label ?? 'MAKE CALL', href: call.deep_link, kind: 'MAKE_CALL' as const } : loop ? { label: campaign.action_label ?? 'FOLLOW OPEN LOOP', href: loop.deep_link, kind: 'FOLLOW_OPEN_LOOP' as const } : { label: campaign.action_label ?? 'VIEW EVIDENCE', href: canonical.deep_link, kind: 'VIEW_EVIDENCE' as const };
  return { active: true, campaign_id: campaign.campaign_id, state: campaign.state as 'LIVE' | 'RESOLVING', hero: { statement: campaign.hero_statement, primary_metric: canonical.metric, evidence_state: canonical.evidence_state, source_freshness: canonical.freshness, source_ref: canonical.source, deep_link: canonical.deep_link, why_it_matters: campaign.why_it_matters ?? canonical.summary, next_checkpoint: loop ? { label: loop.expected_checkpoint_at ? `NEXT CHECKPOINT ${loop.expected_checkpoint_at}` : loop.next_evidence_needed, deep_link: loop.deep_link } : null, action }, open_loop: loop ? { loop_id: loop.loop_id, question: loop.question, state: loop.state, deep_link: loop.deep_link } : null, call_ref: call, share_ref: share, degraded_reason: null };
}
function inactive(): Rh4663CampaignProjection { return { active: false, campaign_id: null, state: null, hero: null, open_loop: null, call_ref: null, share_ref: null }; }
function degradedHero(campaign: Rh4663Campaign): CampaignHero { return { statement: campaign.hero_statement, primary_metric: null, evidence_state: 'DEGRADE', source_freshness: null, source_ref: { ...campaign.primary_source_ref, observed_at: campaign.primary_source_ref.observed_at ?? null }, deep_link: campaign.primary_source_ref.href, why_it_matters: 'The canonical source is temporarily unavailable. No campaign conclusion is inferred.', next_checkpoint: null, action: { label: 'VIEW EVIDENCE', href: campaign.primary_source_ref.href, kind: 'VIEW_EVIDENCE' } }; }
function findCanonical(campaign: Rh4663Campaign, frontdoor: Rh4663FrontdoorState): { source: FrontdoorSourceRef; evidence_state: CampaignEvidenceState; freshness: string | null; metric: string | null; summary: string; deep_link: string } | null {
  const matches = (source: FrontdoorSourceRef) => source.source_type === campaign.primary_source_ref.source_type && source.source_id === campaign.primary_source_ref.source_id;
  const card = [...frontdoor.now_cards, ...frontdoor.watch_cards].find((item) => matches(item.source_ref));
  if (card) return { source: card.source_ref, evidence_state: card.evidence_state, freshness: card.freshness, metric: card.primary_metric, summary: card.summary, deep_link: card.deep_link };
  const loop = frontdoor.open_loops.find((item) => matches(item.source_ref) || campaign.primary_open_loop_ids.includes(item.loop_id));
  if (loop) return { source: loop.source_ref, evidence_state: loopEvidence(loop.state), freshness: loop.last_changed_at, metric: loop.progress.label, summary: loop.short_context, deep_link: loop.deep_link };
  if (campaign.primary_call_window_id === frontdoor.current_call.window_id && matches(frontdoor.current_call.source_ref)) return { source: frontdoor.current_call.source_ref, evidence_state: frontdoor.current_call.resolution_state ? 'VERIFIED' : 'WATCH', freshness: frontdoor.current_call.source_ref.observed_at, metric: `${frontdoor.current_call.total_calls} calls`, summary: 'Canonical Pulse window state and receipt semantics are unchanged.', deep_link: frontdoor.current_call.deep_link };
  return null;
}
function loopEvidence(state: FrontdoorOpenLoopState): CampaignEvidenceState { if (state === 'FALSIFIED') return 'FALSIFIED'; if (state === 'BLOCKED_BY_DATA') return 'BLOCK'; if (state === 'STALE') return 'DEGRADE'; if (state === 'PARTIALLY_RESOLVED' || state === 'RESOLVED') return 'MIXED'; return 'WATCH'; }
function copy<T>(value: T): T { return structuredClone(value); }
