import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createRhChainDailyReceipt, getRhChainDailyReceipts, sortRhChainDailyReceiptsByDate, type RhChainDailyReceipt, type RhChainDailyReceiptsPayload, type RhChainDailyReceiptSection, type RhChainDailyReceiptSource } from '../data/rhChain';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { assembleRhChainCloneRadar } from './rhChainCloneRadarService';
import type { RhChainChainPulseService } from './rhChainChainPulseService';
import type { RhChainMemePulseSnapshotService } from './rhChainMemePulseSnapshotService';
import type { RhChainLaunchpadSnapshotService } from './rhChainLaunchpadSnapshotService';
import type { RhChainLiveSnapshotService } from './rhChainLiveSnapshotService';
import type { RhChainSubmissionStore } from './rhChainSignalVault';

export type RhChainDailyReceiptDraftStatus = 'draft_generated' | 'under_review' | 'published' | 'rejected';
export type RhChainDailyReceiptDraft = {
  draft_id: string;
  suggested_receipt_id: string;
  period_start: string;
  period_end: string;
  status: RhChainDailyReceiptDraftStatus;
  generated_at: string;
  generated_from_sources: string[];
  chain_pulse_summary: string;
  meme_pulse_summary: string;
  launchpad_surface_summary: string;
  rwa_pulse_summary: string;
  risk_wall_summary: string;
  narrative_mutation_summary: string;
  suggested_infopunks_verdict: string;
  confidence_level: 'low' | 'medium' | 'high';
  source_notes: string[];
  missing_evidence: string[];
  reviewer_edits?: Partial<Record<'chain_pulse_summary' | 'meme_pulse_summary' | 'launchpad_surface_summary' | 'rwa_pulse_summary' | 'risk_wall_summary' | 'narrative_mutation_summary' | 'suggested_infopunks_verdict', string>>;
  audit_events: Array<{ event_id: string; occurred_at: string; action: 'generated' | 'published' | 'rejected'; reviewer_id?: string; note: string }>;
};

export interface RhChainDailyReceiptDraftStore {
  readonly adapter: 'memory' | 'postgres'; readonly durable: boolean;
  saveDraft(draft: RhChainDailyReceiptDraft): Promise<void>;
  getDraft(id: string): Promise<RhChainDailyReceiptDraft | null>;
  listDrafts(): Promise<RhChainDailyReceiptDraft[]>;
  savePublished(receipt: RhChainDailyReceipt): Promise<void>;
  publishedReceipts(): Promise<RhChainDailyReceipt[]>;
  close?(): Promise<void>;
}

export class InMemoryRhChainDailyReceiptDraftStore implements RhChainDailyReceiptDraftStore {
  readonly adapter = 'memory' as const; readonly durable = false;
  private readonly drafts = new Map<string, RhChainDailyReceiptDraft>(); private readonly receipts = new Map<string, RhChainDailyReceipt>();
  async saveDraft(draft: RhChainDailyReceiptDraft) { this.drafts.set(draft.draft_id, structuredClone(draft)); }
  async getDraft(id: string) { const draft = this.drafts.get(id); return draft ? structuredClone(draft) : null; }
  async listDrafts() { return [...this.drafts.values()].sort((a, b) => b.generated_at.localeCompare(a.generated_at)).map((draft) => structuredClone(draft)); }
  async savePublished(receipt: RhChainDailyReceipt) { this.receipts.set(receipt.receipt_id, structuredClone(receipt)); }
  async publishedReceipts() { return [...this.receipts.values()].map((receipt) => structuredClone(receipt)); }
}

export class PostgresRhChainDailyReceiptDraftStore implements RhChainDailyReceiptDraftStore {
  readonly adapter = 'postgres' as const; readonly durable = true;
  private readonly pool: pg.Pool; private readonly ownsPool: boolean; private readonly schema = new RetryablePostgresSchema('rh_chain_daily_receipt_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async saveDraft(draft: RhChainDailyReceiptDraft) { await this.ready(); await this.pool.query('insert into rh_chain_daily_receipt_drafts (draft_id, generated_at, status, payload) values ($1,$2,$3,$4::jsonb) on conflict (draft_id) do update set status=excluded.status, payload=excluded.payload', [draft.draft_id, draft.generated_at, draft.status, JSON.stringify(draft)]); await this.pool.query("delete from rh_chain_daily_receipt_drafts where status = 'rejected' and generated_at < now() - interval '10 days'"); }
  async getDraft(id: string) { await this.ready(); const result = await this.pool.query<{ payload: RhChainDailyReceiptDraft }>('select payload from rh_chain_daily_receipt_drafts where draft_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async listDrafts() { await this.ready(); const result = await this.pool.query<{ payload: RhChainDailyReceiptDraft }>('select payload from rh_chain_daily_receipt_drafts order by generated_at desc'); return result.rows.map((row) => row.payload); }
  async savePublished(receipt: RhChainDailyReceipt) { await this.ready(); await this.pool.query('insert into rh_chain_published_daily_receipts (receipt_id, generated_at, payload) values ($1,$2,$3::jsonb) on conflict (receipt_id) do update set payload=excluded.payload', [receipt.receipt_id, receipt.generated_at, JSON.stringify(receipt)]); }
  async publishedReceipts() { await this.ready(); const result = await this.pool.query<{ payload: RhChainDailyReceipt }>('select payload from rh_chain_published_daily_receipts order by generated_at desc'); return result.rows.map((row) => row.payload); }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ready() { return this.schema.ensure(this.pool, 'create table if not exists rh_chain_daily_receipt_drafts (draft_id text primary key, generated_at timestamptz not null, status text not null, payload jsonb not null); create table if not exists rh_chain_published_daily_receipts (receipt_id text primary key, generated_at timestamptz not null, payload jsonb not null);'); }
}

export class RhChainDailyReceiptDraftService {
  private readonly now: () => Date;
  constructor(private readonly store: RhChainDailyReceiptDraftStore, private readonly chainPulse: RhChainChainPulseService, private readonly memePulse: RhChainMemePulseSnapshotService, private readonly launchpad: RhChainLaunchpadSnapshotService, private readonly live: RhChainLiveSnapshotService, private readonly submissions: Pick<RhChainSubmissionStore, 'list'>, now?: () => Date) { this.now = now ?? (() => new Date()); }
  async generateDraft() {
    const generated_at = this.now().toISOString();
    const [chain, meme, launchpad, live, submissions] = await Promise.all([this.chainPulse.getLatest(), this.memePulse.getLatest(), this.launchpad.getLatest(), this.live.getLiveSnapshot(), this.submissions.list()]);
    const clone = assembleRhChainCloneRadar();
    const missing_evidence = [!chain && 'Chain Pulse snapshot unavailable.', !meme && 'Meme Pulse snapshot unavailable.', !launchpad && 'Launchpad Observatory snapshot unavailable.', live.cache_status !== 'fresh' && 'Live provider context is stale or unavailable.', submissions.some((submission) => submission.review_status !== 'approved_signal') && 'Review Queue contains unresolved submissions.'].filter(Boolean) as string[];
    const sources = ['Chain Pulse', 'Meme Pulse', 'Launchpad Observatory', 'Clone Radar', 'Token Dossiers', 'Review Queue', 'Live Snapshot'];
    const draft: RhChainDailyReceiptDraft = { draft_id: randomUUID(), suggested_receipt_id: `rh_daily_auto_${generated_at.slice(0, 10).replaceAll('-', '')}`, period_start: new Date(this.now().getTime() - 24 * 60 * 60 * 1000).toISOString(), period_end: generated_at, status: 'draft_generated', generated_at, generated_from_sources: sources,
      chain_pulse_summary: chain ? `Chain Pulse is ${chain.freshness_state}; TVL context ${value(chain.tvl)}, DEX volume context ${value(chain.dex_volume_24h)}.` : 'Chain Pulse snapshot is unavailable; no exact chain metric is asserted.',
      meme_pulse_summary: meme ? `Meme Pulse has ${meme.pulse.top_attention_assets.length} contextual entries; reviewed memory remains ahead of auto-observed context.` : 'Meme Pulse snapshot is unavailable.',
      launchpad_surface_summary: launchpad ? `${launchpad.observatory.surfaces.filter((surface) => surface.status === 'degraded').map((surface) => surface.name).join(', ') || 'No degraded surface is asserted'}; competitor claims remain source_required.` : 'Launchpad Observatory snapshot is unavailable.',
      rwa_pulse_summary: 'RWA and stock-token themes remain narrative context until source-linked usage or route evidence is reviewed.',
      risk_wall_summary: clone.active_warnings.length ? `${clone.active_warnings.length} clone-risk cues remain review prompts, not misconduct findings.` : 'No clone-risk cue is promoted from absence.',
      narrative_mutation_summary: meme?.pulse.snapshot.strongest_narrative_mutation ?? 'Narrative mutation requires current receipt context.',
      suggested_infopunks_verdict: 'Draft only: review sources and missing evidence before publication. This is not endorsement, safety verification, or financial advice.', confidence_level: missing_evidence.length ? 'low' : 'medium', source_notes: ['Automation assembled this draft from contextual snapshots and reviewed memory.', 'Only a reviewer can publish a Daily Receipt.'], missing_evidence,
      audit_events: [{ event_id: randomUUID(), occurred_at: generated_at, action: 'generated', note: 'Automation generated a receipt draft; no public receipt was created.' }] };
    await this.store.saveDraft(draft); return draft;
  }
  async listDrafts() { return this.store.listDrafts(); }
  async getDraft(id: string) { return this.store.getDraft(id); }
  async reject(id: string, reviewer_id: string) { const draft = await this.requireDraft(id); if (draft.status === 'published') throw new Error('published_draft_cannot_be_rejected'); const updated = { ...draft, status: 'rejected' as const, audit_events: [...draft.audit_events, { event_id: randomUUID(), occurred_at: this.now().toISOString(), action: 'rejected' as const, reviewer_id, note: 'Reviewer rejected this internal draft.' }] }; await this.store.saveDraft(updated); return updated; }
  async publish(id: string, reviewer_id: string, reviewer_edits?: RhChainDailyReceiptDraft['reviewer_edits']) {
    const draft = await this.requireDraft(id); if (draft.status === 'rejected') throw new Error('rejected_draft_cannot_be_published'); if (draft.status === 'published') throw new Error('draft_already_published');
    const edited = { ...draft, reviewer_edits: { ...draft.reviewer_edits, ...reviewer_edits } }; const now = this.now().toISOString(); const text = (key: keyof NonNullable<typeof edited.reviewer_edits>, fallback: string) => edited.reviewer_edits?.[key] ?? fallback;
    const sources = edited.generated_from_sources.map((name): RhChainDailyReceiptSource => ({ name, source_name: name, source_url: null, url: null, note: 'Reviewer-published receipt source.', observed_at: edited.period_end, updated_at: now, data_mode: 'manual', confidence_level: edited.confidence_level }));
    const sections: RhChainDailyReceiptSection[] = [
      ['chain_pulse', 'Chain Pulse', text('chain_pulse_summary', edited.chain_pulse_summary)], ['meme_pulse', 'Meme Pulse', text('meme_pulse_summary', edited.meme_pulse_summary)], ['leadership_narrative_pulse', 'Leadership Narrative Pulse', 'Leadership, RWA, tokenized-asset, and agentic-economy context remains source_required until a reviewer attaches primary links.'], ['launchpad_stress_test', 'Launchpad Surface', text('launchpad_surface_summary', edited.launchpad_surface_summary)], ['risk_wall', 'Risk Wall', text('risk_wall_summary', edited.risk_wall_summary)], ['narrative_mutation', 'Narrative Mutation', text('narrative_mutation_summary', edited.narrative_mutation_summary)], ['infopunks_verdict', 'Infopunks Verdict', text('suggested_infopunks_verdict', edited.suggested_infopunks_verdict)]
    ].map(([section_id, title, summary]) => ({ section_id: section_id as RhChainDailyReceiptSection['section_id'], title, summary, fields: [] }));
    const receipt = createRhChainDailyReceipt({ receipt_id: edited.suggested_receipt_id, receipt_type: 'daily_market_memory', date: now.slice(0, 10), period: `${edited.period_start} – ${edited.period_end}`, generated_at: now, observed_at: edited.period_end, chain: 'Robinhood Chain', headline: 'RH Chain Daily Receipt · reviewer-published memory', summary: text('chain_pulse_summary', edited.chain_pulse_summary), top_signal: text('meme_pulse_summary', edited.meme_pulse_summary), biggest_risk: text('risk_wall_summary', edited.risk_wall_summary), strongest_narrative: text('narrative_mutation_summary', edited.narrative_mutation_summary), liquidity_note: text('chain_pulse_summary', edited.chain_pulse_summary), stock_token_spillover_note: text('rwa_pulse_summary', edited.rwa_pulse_summary), solana_base_migration_note: 'No cross-chain route claim is promoted without reviewed evidence.', deployer_watch_note: text('launchpad_surface_summary', edited.launchpad_surface_summary), infopunks_verdict: text('suggested_infopunks_verdict', edited.suggested_infopunks_verdict), watchlist: [], do_not_touch_yet: edited.missing_evidence.map((item) => ({ item, reason: 'Missing evidence remains visible after publication.', risk_state: 'source_required' as const, next_thing_to_verify: 'Attach source-linked evidence.' })), sources, confidence_level: edited.confidence_level, status: 'manual', data_mode: 'manual', source_notes: edited.source_notes.join(' '), manual_context: `Published by ${reviewer_id}.`, receipt_sections: sections });
    await this.store.savePublished(receipt); const published = { ...edited, status: 'published' as const, audit_events: [...edited.audit_events, { event_id: randomUUID(), occurred_at: now, action: 'published' as const, reviewer_id, note: `Reviewer published ${receipt.receipt_id}.` }] }; await this.store.saveDraft(published); return { draft: published, receipt };
  }
  async publicFeed(): Promise<RhChainDailyReceiptsPayload> { const base = getRhChainDailyReceipts(); const receipts = sortRhChainDailyReceiptsByDate([...base.receipts, ...await this.store.publishedReceipts()]); const latest = receipts[0] ?? base.latest_receipt; return { ...base, generated_at: latest.generated_at, latest_receipt: latest, receipts }; }
  async publicReceipt(id: string) { return (await this.store.publishedReceipts()).find((receipt) => receipt.receipt_id === id) ?? getRhChainDailyReceipts().receipts.find((receipt) => receipt.receipt_id === id) ?? null; }
  private async requireDraft(id: string) { const draft = await this.store.getDraft(id); if (!draft) throw new Error('rh_chain_daily_receipt_draft_not_found'); return draft; }
}
function value(input: number | null) { return typeof input === 'number' ? `$${Math.round(input).toLocaleString()}` : 'source required'; }
