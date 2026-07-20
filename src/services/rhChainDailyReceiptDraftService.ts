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
import type { RhChainAttentionQualityHistory } from './rhChainMarketSnapshotService';
import { resolveRhChainContractIntelligence } from './rhChainContractIntelligenceService';
import type { RhChainDailyReviewSummary } from './rhChainReviewPipelineService';

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
  attention_quality_context?: Array<Pick<RhChainAttentionQualityHistory, 'contract' | 'state' | 'snapshot_count' | 'latest_snapshot_at' | 'paid_attention_context'>>;
  contract_intelligence_context?: Array<{ contract: string; source: string; display_name: string | null; review_status: string; claim_status: 'source_required_for_claims' | 'reviewed' }>;
  review_cycle_summary?: RhChainDailyReviewSummary;
  review_cycle_receipt?: RhChainDailyReceipt;
  market_structure_receipt?: RhChainDailyReceipt;
  agentic_market_structure_receipt?: RhChainDailyReceipt;
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
  constructor(private readonly store: RhChainDailyReceiptDraftStore, private readonly chainPulse: RhChainChainPulseService, private readonly memePulse: RhChainMemePulseSnapshotService, private readonly launchpad: RhChainLaunchpadSnapshotService, private readonly live: RhChainLiveSnapshotService, private readonly submissions: Pick<RhChainSubmissionStore, 'list'>, private readonly attentionHistory?: { summarizeKnownWatchlistAttention(): Promise<RhChainAttentionQualityHistory[]> }, now?: () => Date) { this.now = now ?? (() => new Date()); }
  async generateDraft() {
    const generated_at = this.now().toISOString();
    const [chain, meme, launchpad, live, submissions, attention] = await Promise.all([this.chainPulse.getLatest(), this.memePulse.getLatest(), this.launchpad.getLatest(), this.live.getLiveSnapshot(), this.submissions.list(), this.attentionHistory?.summarizeKnownWatchlistAttention() ?? Promise.resolve([])]);
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
      suggested_infopunks_verdict: 'Draft only: review sources and missing evidence before publication. This is not endorsement, safety verification, or financial advice.', confidence_level: missing_evidence.length ? 'low' : 'medium', source_notes: ['Automation assembled this draft from contextual snapshots and reviewed memory.', 'Attention history, when present, is provider context only; a reviewer decides whether to cite it.', 'Only a reviewer can publish a Daily Receipt.'], missing_evidence, attention_quality_context: attention.map(({ contract, state, snapshot_count, latest_snapshot_at, paid_attention_context }) => ({ contract, state, snapshot_count, latest_snapshot_at, paid_attention_context })),
      contract_intelligence_context: attention.map(({ contract }) => { const intelligence = resolveRhChainContractIntelligence(contract); return { contract: intelligence.contract, source: intelligence.source, display_name: intelligence.display_name, review_status: intelligence.review_status, claim_status: intelligence.claim_status }; }),
      audit_events: [{ event_id: randomUUID(), occurred_at: generated_at, action: 'generated', note: 'Automation generated a receipt draft; no public receipt was created.' }] };
    await this.store.saveDraft(draft); return draft;
  }
  /** Builds the operational #007 receipt from Review Pipeline summary data. It remains internal until a reviewer publishes it. */
  async generateReviewCycleDraft(summary: RhChainDailyReviewSummary) {
    const generated_at = this.now().toISOString();
    const receipt = createRhChainReviewCycleReceipt(summary, generated_at, `rh_review_cycle_template_${summary.day.replaceAll('-', '')}`);
    const draft: RhChainDailyReceiptDraft = {
      draft_id: randomUUID(), suggested_receipt_id: receipt.receipt_id, period_start: `${summary.day}T00:00:00.000Z`, period_end: `${summary.day}T23:59:59.999Z`,
      status: 'under_review', generated_at, generated_from_sources: ['Review Pipeline daily summary', 'DEX Screener Provider', 'Blockscout Registry', 'Snapshot History', 'Discovery Queue', 'Market Structure'],
      chain_pulse_summary: receipt.top_signal, meme_pulse_summary: attentionSummary(summary), launchpad_surface_summary: 'Discovery flow is organized through exact-contract review; provider context remains context only.',
      rwa_pulse_summary: 'RWA and agent claims remain source_required unless backed by primary or operational on-chain evidence.', risk_wall_summary: receipt.biggest_risk,
      narrative_mutation_summary: receipt.strongest_narrative, suggested_infopunks_verdict: receipt.infopunks_verdict, confidence_level: 'medium',
      source_notes: ['Review Pipeline daily summary is the primary context for this operational draft.', 'Provider data remains context only and never outranks reviewed memory.', 'This draft is human-reviewable and unpublished; only a reviewer can publish a Daily Receipt.'],
      missing_evidence: reviewCycleMissingEvidence(summary), review_cycle_summary: structuredClone(summary), review_cycle_receipt: receipt,
      audit_events: [{ event_id: randomUUID(), occurred_at: generated_at, action: 'generated', note: `Generated ${receipt.receipt_id} from the Review Pipeline daily summary; no public receipt was created.` }]
    };
    await this.store.saveDraft(draft); return draft;
  }
  /** Builds the reviewed Market Structure #007 receipt as an internal draft. Publishing remains a separate reviewer action. */
  async generateMarketStructureDraft() {
    const generated_at = this.now().toISOString();
    const receipt = createRhChainMarketStructureReceipt(generated_at);
    const draft: RhChainDailyReceiptDraft = {
      draft_id: randomUUID(), suggested_receipt_id: receipt.receipt_id, period_start: '2026-07-19T00:00:00.000Z', period_end: '2026-07-19T23:59:59.999Z',
      status: 'under_review', generated_at, generated_from_sources: ['Market Structure', 'Daily Receipt #006', 'DEX Screener Provider', 'Blockscout Registry', 'Snapshot History', 'Attention Quality'],
      chain_pulse_summary: receipt.top_signal, meme_pulse_summary: receipt.receipt_sections?.find((section) => section.section_id === 'meme_pulse')?.summary ?? '', launchpad_surface_summary: receipt.receipt_sections?.find((section) => section.section_id === 'infrastructure_pulse')?.summary ?? '',
      rwa_pulse_summary: receipt.receipt_sections?.find((section) => section.section_id === 'rwa_pulse')?.summary ?? '', risk_wall_summary: receipt.biggest_risk,
      narrative_mutation_summary: receipt.strongest_narrative, suggested_infopunks_verdict: receipt.infopunks_verdict, confidence_level: 'medium',
      source_notes: ['Market Structure is the primary reviewed context for this draft.', 'Provider data remains context only and never outranks reviewed memory.', 'This draft is under review and does not alter public receipt, Today, or Relay pointers.'],
      missing_evidence: ['RWA, agent, infrastructure, and cross-layer claims remain source_required unless primary or operational on-chain evidence is attached.'], market_structure_receipt: receipt,
      audit_events: [{ event_id: randomUUID(), occurred_at: generated_at, action: 'generated', note: 'Generated Market Structure Daily Receipt #007 as an unpublished internal draft.' }]
    };
    await this.store.saveDraft(draft); return draft;
  }
  /** Builds Daily Receipt #008 as an internal, approval-gated agentic Market Structure draft. */
  async generateAgenticMarketStructureDraft() {
    const generated_at = this.now().toISOString();
    const receipt = createRhChainAgenticMarketStructureReceipt(generated_at);
    const draft: RhChainDailyReceiptDraft = {
      draft_id: randomUUID(), suggested_receipt_id: receipt.receipt_id, period_start: '2026-07-19T00:00:00.000Z', period_end: '2026-07-20T23:59:59.999Z',
      status: 'under_review', generated_at, generated_from_sources: ['Robinhood Agentic Trading product page', 'Robinhood Agentic Trading Help Center', 'Robinhood Trading with your agent Help Center', 'Market Structure', 'Daily Receipt #007'],
      chain_pulse_summary: receipt.top_signal, meme_pulse_summary: receipt.receipt_sections?.find((section) => section.section_id === 'meme_pulse')?.summary ?? '', launchpad_surface_summary: receipt.receipt_sections?.find((section) => section.section_id === 'infrastructure_pulse')?.summary ?? '',
      rwa_pulse_summary: receipt.receipt_sections?.find((section) => section.section_id === 'rwa_pulse')?.summary ?? '', risk_wall_summary: receipt.biggest_risk,
      narrative_mutation_summary: receipt.strongest_narrative, suggested_infopunks_verdict: receipt.infopunks_verdict, confidence_level: 'medium',
      source_notes: ['Primary Robinhood product and Help Center pages establish the Agentic Trading product surface and currently documented order scope.', 'This draft remains under review: it does not make Agentic Trading evidence of RH Chain adoption or update public receipt, Today, or Relay pointers.'],
      missing_evidence: ['Crypto support remains source_required unless exact current support is verified from primary Robinhood documentation.', 'RH Chain-specific agent adoption, wallet activity, capital migration, and cross-layer execution remain under_receipt_check until source-linked operational receipts exist.'], agentic_market_structure_receipt: receipt,
      audit_events: [{ event_id: randomUUID(), occurred_at: generated_at, action: 'generated', note: 'Generated Agentic Market Structure Daily Receipt #008 as an unpublished internal draft.' }]
    };
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
    const preparedReceipt = edited.agentic_market_structure_receipt ?? edited.market_structure_receipt ?? edited.review_cycle_receipt;
    const receipt = preparedReceipt
      ? { ...preparedReceipt, generated_at: now, observed_at: edited.period_end, manual_context: `Published by ${reviewer_id}. ${edited.agentic_market_structure_receipt ? 'Agentic Market Structure remained the primary reviewed context.' : edited.market_structure_receipt ? 'Market Structure remained the primary reviewed context.' : 'Review Pipeline summary remained the primary context.'}`, status: 'manual' as const, data_mode: 'manual' as const }
      : createRhChainDailyReceipt({ receipt_id: edited.suggested_receipt_id, receipt_type: 'daily_market_memory', date: now.slice(0, 10), period: `${edited.period_start} – ${edited.period_end}`, generated_at: now, observed_at: edited.period_end, chain: 'Robinhood Chain', headline: 'RH Chain Daily Receipt · reviewer-published memory', summary: text('chain_pulse_summary', edited.chain_pulse_summary), top_signal: text('meme_pulse_summary', edited.meme_pulse_summary), biggest_risk: text('risk_wall_summary', edited.risk_wall_summary), strongest_narrative: text('narrative_mutation_summary', edited.narrative_mutation_summary), liquidity_note: text('chain_pulse_summary', edited.chain_pulse_summary), stock_token_spillover_note: text('rwa_pulse_summary', edited.rwa_pulse_summary), solana_base_migration_note: 'No cross-chain route claim is promoted without reviewed evidence.', deployer_watch_note: text('launchpad_surface_summary', edited.launchpad_surface_summary), infopunks_verdict: text('suggested_infopunks_verdict', edited.suggested_infopunks_verdict), watchlist: [], do_not_touch_yet: edited.missing_evidence.map((item) => ({ item, reason: 'Missing evidence remains visible after publication.', risk_state: 'source_required' as const, next_thing_to_verify: 'Attach source-linked evidence.' })), sources, confidence_level: edited.confidence_level, status: 'manual', data_mode: 'manual', source_notes: edited.source_notes.join(' '), manual_context: `Published by ${reviewer_id}.`, receipt_sections: sections });
    await this.store.savePublished(receipt); const published = { ...edited, status: 'published' as const, audit_events: [...edited.audit_events, { event_id: randomUUID(), occurred_at: now, action: 'published' as const, reviewer_id, note: `Reviewer published ${receipt.receipt_id}.` }] }; await this.store.saveDraft(published); return { draft: published, receipt };
  }
  async publicFeed(): Promise<RhChainDailyReceiptsPayload> { const base = getRhChainDailyReceipts(); const receipts = sortRhChainDailyReceiptsByDate([...base.receipts, ...await this.store.publishedReceipts()]); const latest = receipts[0] ?? base.latest_receipt; return { ...base, generated_at: latest.generated_at, latest_receipt: latest, receipts }; }
  async publicReceipt(id: string) { return (await this.store.publishedReceipts()).find((receipt) => receipt.receipt_id === id) ?? getRhChainDailyReceipts().receipts.find((receipt) => receipt.receipt_id === id) ?? null; }
  private async requireDraft(id: string) { const draft = await this.store.getDraft(id); if (!draft) throw new Error('rh_chain_daily_receipt_draft_not_found'); return draft; }
}
function value(input: number | null) { return typeof input === 'number' ? `$${Math.round(input).toLocaleString()}` : 'source required'; }

export function createRhChainReviewCycleReceipt(summary: RhChainDailyReviewSummary, generated_at: string, receipt_id = 'rh_review_cycle_template'): RhChainDailyReceipt {
  const empty = reviewCycleIsEmpty(summary);
  const marketStructure = summary.promoted_market_structure_candidates.length
    ? summary.promoted_market_structure_candidates.map((item) => `${item.token_name}${item.symbol ? ` (${item.symbol})` : ''} · ${item.market_structure_layer}`).join('; ')
    : 'No new reviewed candidates were promoted in this cycle.';
  const attention = attentionSummary(summary);
  const outcomes = summary.outcome_checks.length
    ? summary.outcome_checks.map((item) => `${item.token_name}${item.symbol ? ` (${item.symbol})` : ''} · ${item.contract} · ${item.outcome_check_at}`).join('; ')
    : 'No outcome checks scheduled yet.';
  const summaryText = empty
    ? 'System-readiness receipt: the Review Pipeline is ready to route discovery through exact-contract review, but this cycle has no reviewed activity to turn into a market verdict.'
    : 'Operational review-cycle receipt: Discovery flow is being converted into source-bound, exact-contract market memory without treating provider context as judgment.';
  return createRhChainDailyReceipt({
    receipt_id, receipt_type: 'daily_market_memory', date: summary.day, period: `Review cycle · ${summary.day} UTC`, generated_at, observed_at: generated_at, chain: 'Robinhood Chain',
    headline: '4663 begins converting RH Chain discovery flow into reviewed market memory', summary: summaryText,
    top_signal: 'Discovery flow is now being routed through exact-contract review instead of ticker-based attention.',
    biggest_risk: 'Token velocity, duplicate tickers, paid attention, and narrative claims can overwhelm reviewers unless source-required states and outcome checks remain strict.',
    strongest_narrative: 'RH Chain is becoming too fast to track manually; the edge is no longer just detecting tokens, but deciding which discovered signals deserve memory.',
    liquidity_note: 'Provider liquidity and attention observations remain context only; reviewed memory determines what is retained.', stock_token_spillover_note: 'RWA narrative remains source_required unless backing proof is attached.', solana_base_migration_note: 'AI narrative does not establish agent activity.', deployer_watch_note: 'Exact-contract review is required before discovery can become reviewed memory.',
    infopunks_verdict: 'The market moves every minute. 4663 reviews what mattered.',
    manual_context: 'Operational review-cycle draft. Human review is required before publication; no public receipt, Relay packet, or Today card is changed by this draft.',
    source_notes: 'Primary context: Review Pipeline daily summary. DEX Screener and Blockscout context feed discovery but remain context only. Provider data never outranks reviewed memory. This draft does not imply endorsement or a safety determination.',
    receipt_sections: [
      { section_id: 'narrative_mutation', title: 'Review Cycle Summary', summary: empty ? 'No review activity was available; this is a system-readiness receipt.' : 'Review Pipeline daily-summary counts for this cycle.', fields: reviewCycleCountFields(summary) },
      { section_id: 'chain_pulse', title: 'Discovery Pulse', summary: 'DEX Screener and Blockscout context now feed the Discovery Queue through exact contracts.', fields: [{ label: 'Provider boundary', value: 'Provider data remains context only and never outranks reviewed memory.' }] },
      { section_id: 'launchpad_stress_test', title: 'Review Pipeline Pulse', summary: 'Tokens move through a controlled review path rather than ticker-only attention.', fields: [{ label: 'Flow', value: 'auto_discovered → needs_review → source_required / watch_only / promoted candidate / daily draft / outcome check' }] },
      { section_id: 'leadership_narrative_pulse', title: 'Market Structure Pulse', summary: marketStructure, fields: [{ label: 'Promotion rule', value: 'Only daily-summary promotions are listed; no promotion is inferred from discovery context.' }] },
      { section_id: 'meme_pulse', title: 'Attention Quality Pulse', summary: attention, fields: [{ label: 'History rule', value: 'Attention quality remains history-gated when sufficient snapshot history is unavailable.' }] },
      { section_id: 'risk_wall', title: 'Risk Wall', summary: 'Review discipline protects memory from velocity and surface-level signals.', fields: [{ label: 'Identity risk', value: 'duplicate ticker risk and clone/pair confusion.' }, { label: 'Attention risk', value: 'paid attention mistaken for conviction.' }, { label: 'Narrative risk', value: 'RWA narrative without backing proof and AI narrative mistaken for agent activity.' }, { label: 'Market and desk risk', value: 'liquidity fragmentation, source gaps, and review overload.' }] },
      { section_id: 'outcome_checks', title: 'Outcome Checks', summary: outcomes, fields: [{ label: 'Review horizon', value: 'Scheduled outcome checks are assessed seven days after review.' }] },
      { section_id: 'infopunks_verdict', title: 'Infopunks Verdict', summary: 'The market moves every minute. 4663 reviews what mattered.', fields: [{ label: 'Verdict', value: 'The market moves every minute. 4663 reviews what mattered.' }] }
    ],
    watchlist: [], do_not_touch_yet: [], sources: [{ name: 'Review Pipeline daily summary', source_name: 'Review Pipeline daily summary', source_url: '/v1/rh-chain/review-pipeline/daily-summary', url: '/v1/rh-chain/review-pipeline/daily-summary', note: 'Primary operational context for this unpublished review-cycle draft.', observed_at: generated_at, updated_at: generated_at, data_mode: 'manual', confidence_level: 'medium' }], confidence_level: 'medium', status: 'manual', data_mode: 'manual'
  });
}

export function createRhChainMarketStructureReceipt(generated_at: string): RhChainDailyReceipt {
  const ranking = [
    ['Memes', 'Very High', 'Slightly cooling in relative narrative control', 'Volume and onboarding', 'Still dominant in raw attention, but no longer controls the entire RH Chain story.', 'Medium', 'Meme dominance is based on visible market activity and reviewed context, not complete chain accounting.'],
    ['RWAs', 'Rising Fast', 'Strongly gaining narrative power', 'Leadership messaging and tokenized-asset thesis', 'Gaining institutional and structural weight, but RWA claims remain source_required until backed by primary/onchain evidence.', 'Medium', 'Narrative momentum does not verify asset backing.'],
    ['Agents', 'Emerging', 'Gaining from a small base', 'Agentic economy messaging and early reported activity', 'Highest forward narrative momentum, but operational agent activity must remain source_required without wallet/activity receipts.', 'Low to Medium', 'AI narrative does not prove agent activity.'],
    ['Infrastructure', 'Fragmented', 'Rebuilding', 'Post-NOXA launchpad fragmentation, direct pools, analytics and tooling', 'The infrastructure winner may control the rails between memes, RWAs and agents.', 'Medium', 'Launchpad share and infrastructure claims require provider/source receipts.'],
    ['Cross-Layer Flows', 'Nascent but important', 'Accelerating as a thesis', 'Rotation signals and assets combining multiple narratives', 'The real structure forms where meme distribution meets RWA, agent, DeFi or infrastructure claims.', 'Low to Medium', 'Actual capital migration requires snapshot history and wallet-flow evidence.']
  ];
  return createRhChainDailyReceipt({
    receipt_id: 'rh_daily_007', receipt_type: 'market_structure_memory', date: '2026-07-19', period: 'July 19, 2026 UTC', generated_at, observed_at: generated_at, chain: 'Robinhood Chain',
    headline: 'RH Chain shifts from meme monopoly to multi-layer market structure',
    summary: 'Market Structure-led layer-flow memory for July 19, 2026 UTC. Layer Power Ranking is a reviewed market-structure estimate, not complete chain accounting.',
    top_signal: 'Memes remain the strongest liquidity and onboarding layer, but RWAs, agents, infrastructure and cross-layer assets are gaining relative narrative power.',
    biggest_risk: 'Market participants may mistake narrative momentum for verified adoption. RWA, agent, infrastructure and cross-layer claims still require receipts, not labels.',
    strongest_narrative: 'Robinhood Chain is evolving from a single-layer meme market into a multi-layer system where memes distribute attention, RWAs create credibility, agents create automation, and infrastructure connects the flows.',
    liquidity_note: 'No exact volume-share percentages or wallet rotation are asserted. Provider data remains context only.', stock_token_spillover_note: 'RWA claims remain source_required unless backed by primary/onchain evidence.', solana_base_migration_note: 'Cross-layer thesis does not establish actual capital migration without snapshot history and wallet-flow evidence.', deployer_watch_note: 'Launchpad and infrastructure claims require provider/source receipts; no launchpad ranking is asserted.',
    infopunks_verdict: 'The chain is not cooling. It is sorting. The next signal is not just which token moves, but which layer gains power.',
    manual_context: 'Reviewed Market Structure draft. Human approval is required before this receipt becomes public or updates Today on 4663 and Receipt Relay.',
    source_notes: 'Market Structure classifications and reviewed Daily Receipt #006 are authoritative. DEX Screener, Blockscout, Snapshot History, and Attention Quality provide context only. This receipt does not imply endorsement, affiliation, or investment advice.',
    receipt_sections: [
      { section_id: 'layer_power_ranking', title: 'Layer Power Ranking', summary: 'Layer Power Ranking is a reviewed market-structure estimate, not complete chain accounting.', fields: ranking.map(([layer, power, direction, driver, flow, confidence, caveat]) => ({ label: layer, value: [power, direction, driver, flow, confidence, caveat].join(' | ') })) },
      { section_id: 'chain_pulse', title: 'Layer Context', summary: 'This receipt reads relative layer power rather than exact chain-wide market metrics.', fields: [{ label: 'Metrics rule', value: 'No exact volume-share percentages or complete chain accounting are asserted.' }] },
      { section_id: 'meme_pulse', title: 'Meme Layer', summary: 'Memes remain the highest raw-power layer. CASHCAT remains the benchmark attention asset in reviewed memory, while the layer moves from narrative monopoly to contested engine.', fields: [{ label: 'Boundary', value: 'Reviewed attention context does not establish complete chain accounting.' }] },
      { section_id: 'rwa_pulse', title: 'RWA Layer', summary: 'RWAs are gaining the most institutional and narrative gravity. The Index remains an under_receipt_check RWA x DeFi candidate in Market Structure.', fields: [{ label: 'Evidence rule', value: 'RWA claims remain source_required unless backed by primary/onchain evidence.' }, { label: 'Boundary', value: 'No asset backing or safety conclusion is implied.' }] },
      { section_id: 'agent_pulse', title: 'Agent Layer', summary: 'Agents are emerging from a smaller base with strong forward momentum.', fields: [{ label: 'Evidence rule', value: 'Agentic-economy claims require source links, operational wallet behavior, or activity receipts.' }, { label: 'Activity rule', value: 'AI narrative does not equal verified agent activity.' }] },
      { section_id: 'infrastructure_pulse', title: 'Infrastructure Layer', summary: 'NOXA disruption continues to push infrastructure fragmentation. New launchpads, direct pools, analytics and tooling are becoming more important.', fields: [{ label: 'Ranking rule', value: 'No launchpad is ranked without provider receipts.' }] },
      { section_id: 'launchpad_stress_test', title: 'Launchpad Structure Boundary', summary: 'Post-NOXA launchpad fragmentation is infrastructure context, not a market-share ranking.', fields: [{ label: 'Evidence rule', value: 'Launchpad share and infrastructure claims require provider/source receipts.' }] },
      { section_id: 'cross_layer_flows', title: 'Cross-Layer Flows', summary: 'Cross-layer flows are the protagonist: the highest-signal assets may not live in one clean category.', fields: [{ label: 'Categories', value: 'Meme × RWA; DeFi × RWA; Agent × RWA; Meme × Infrastructure; Infrastructure × RWA.' }, { label: 'The Index', value: 'The Index is DeFi × RWA under_receipt_check.' }, { label: 'GROKIUS', value: 'GROKIUS is Meme × AI narrative; not verified Agent × Meme without operational evidence.' }, { label: 'Flow rule', value: 'Actual capital migration requires snapshot history and wallet-flow evidence.' }] },
      { section_id: 'leadership_narrative_pulse', title: 'Market Structure Implication', summary: 'Robinhood Chain is moving from attention-driven to structure-driven. The next edge is not chasing candles, but understanding which layer is gaining power and which flows are becoming durable.', fields: [{ label: 'Structure boundary', value: 'Narrative momentum remains separate from verified adoption.' }] },
      { section_id: 'risk_wall', title: 'Risk Wall', summary: 'Structure analysis remains source-bound.', fields: [{ label: 'Adoption risk', value: 'narrative momentum mistaken for adoption; RWA labels without backing proof; AI labels mistaken for agent activity.' }, { label: 'Identity and attention risk', value: 'duplicate ticker confusion; paid attention mistaken for conviction; clone/pair confusion.' }, { label: 'Market and desk risk', value: 'liquidity fragmentation; launchpad fragmentation; review overload; source gaps.' }] },
      { section_id: 'narrative_mutation', title: 'Sorting State', summary: 'The chain is not cooling. It is sorting.', fields: [{ label: 'Layer read', value: 'Power is distributing across memes, RWAs, agents, infrastructure, and cross-layer flows.' }] },
      { section_id: 'infopunks_verdict', title: 'Infopunks Verdict', summary: 'Memes distribute attention. RWAs create gravity. Agents create automation. Infrastructure connects the rails. Cross-layer flows reveal what Robinhood Chain is becoming.', fields: [{ label: 'Verdict', value: 'Memes distribute attention. RWAs create gravity. Agents create automation. Infrastructure connects the rails. Cross-layer flows reveal what Robinhood Chain is becoming.' }] }
    ],
    watchlist: [{ item: 'The Index', reason: 'DeFi × RWA candidate under_receipt_check in Market Structure.', risk_state: 'source_required', next_thing_to_verify: 'Primary RWA or DeFi evidence and operational on-chain activity.' }, { item: 'GROKIUS', reason: 'Meme × AI narrative context; operational agent activity is not verified.', risk_state: 'source_required', next_thing_to_verify: 'Source links and operational wallet or activity receipts.' }],
    do_not_touch_yet: [{ item: 'Cross-layer labels without evidence', reason: 'Narrative combinations do not establish adoption, capital migration, or durability.', risk_state: 'source_required', next_thing_to_verify: 'Snapshot history, wallet-flow evidence, primary sources, and human review.' }],
    sources: [{ name: 'Infopunks Market Structure reviewed memory', source_name: 'Infopunks Market Structure reviewed memory', source_url: '/v1/rh-chain/market-structure', url: '/v1/rh-chain/market-structure', note: 'Primary reviewed context for this Market Structure draft.', observed_at: generated_at, updated_at: generated_at, data_mode: 'manual', confidence_level: 'medium' }], confidence_level: 'medium', status: 'manual', data_mode: 'manual'
  });
}

/** Source-bound #008. Its platform evidence is explicit; RH Chain adoption remains under receipt check. */
export function createRhChainAgenticMarketStructureReceipt(generated_at: string): RhChainDailyReceipt {
  const layerPower = [
    ['Memes', 'Very High', 'Stable / slight relative dip', 'Volume and new launches', 'Still the main liquidity and onboarding engine', 'Medium', 'Meme dominance is based on visible market activity and reviewed context, not complete chain accounting.'],
    ['RWAs', 'Low to Medium', 'Stable but strategically important', 'Tokenized-asset thesis and leadership positioning', 'Still more narrative-led than volume-led', 'Low to Medium', 'RWA labels and stock-token narratives require primary/onchain evidence before stronger classification.'],
    ['Agents', 'Rising Fast', 'Strongly gaining', 'Robinhood Agentic Trading and MCP account integration', 'Biggest structural winner of the window', 'Medium for platform-level agent infrastructure, low for RH Chain-specific adoption', 'Agentic brokerage access does not prove on-chain agent activity.'],
    ['Infrastructure', 'Rising', 'Gaining', 'MCP rails, data layers, launchpads, direct pools and tooling', 'Building connective tissue between platform agents and on-chain markets', 'Low to Medium', 'Infrastructure claims require source/provider receipts.'],
    ['Cross-Layer Flows', 'Nascent but increasingly important', 'Accelerating as a thesis', 'Potential bridge between brokerage agents, tokenized assets, DeFi and RH Chain markets', 'The main thing 4663 must monitor next', 'Low', 'Actual capital migration requires snapshot history, wallet-flow evidence, and receipts.']
  ];
  const primarySources: RhChainDailyReceiptSource[] = [
    { name: 'Robinhood Agentic Trading product page', source_name: 'Robinhood Agentic Trading product page', source_url: 'https://robinhood.com/us/en/agentic-trading/', url: 'https://robinhood.com/us/en/agentic-trading/', note: 'Primary product page: MCP connection, dedicated Agentic Account and budget, notifications, activity visibility, and disconnect control.', observed_at: generated_at, updated_at: generated_at, data_mode: 'manual', confidence_level: 'high' },
    { name: 'Robinhood Help Center · Agentic Trading overview', source_name: 'Robinhood Help Center · Agentic Trading overview', source_url: 'https://robinhood.com/us/en/support/articles/agentic-trading-overview/', url: 'https://robinhood.com/us/en/support/articles/agentic-trading-overview/', note: 'Primary Help Center documentation for the Robinhood Trading MCP and dedicated Agentic Account.', observed_at: generated_at, updated_at: generated_at, data_mode: 'manual', confidence_level: 'high' },
    { name: 'Robinhood Help Center · Trading with your agent', source_name: 'Robinhood Help Center · Trading with your agent', source_url: 'https://robinhood.com/us/en/support/articles/trading-with-your-agent/', url: 'https://robinhood.com/us/en/support/articles/trading-with-your-agent/', note: 'Primary Help Center documentation: agents currently place long equities and options orders; more assets are planned.', observed_at: generated_at, updated_at: generated_at, data_mode: 'manual', confidence_level: 'high' }
  ];
  return createRhChainDailyReceipt({
    receipt_id: 'rh_daily_008', receipt_type: 'agentic_market_structure_memory', date: '2026-07-20', period: 'July 19 → July 20, 2026 UTC', generated_at, observed_at: generated_at, chain: 'Robinhood Chain',
    headline: 'Robinhood opens the agent rail as RH Chain’s agent layer gains structural power',
    summary: 'Approval-gated Agentic Market Structure memory for July 19 → July 20, 2026 UTC. Primary Robinhood documentation establishes a formal Agentic Trading product surface; it does not establish agent adoption on RH Chain.',
    top_signal: 'Robinhood’s Agentic Trading surface gives AI agents a formal execution path through dedicated Agentic Accounts and MCP integration, strengthening the agent layer beyond on-chain narrative alone.',
    biggest_risk: 'Agent visibility, MCP access, and brokerage execution can be mistaken for verified agent adoption on RH Chain. The bridge from main-platform agents to on-chain RWAs, DeFi, and tokenized assets still requires receipts.',
    strongest_narrative: 'Robinhood is no longer only building a chain for tokenized assets. It is building a broader agentic finance stack where agents can research, allocate, execute, and eventually interact with on-chain markets.',
    liquidity_note: 'No agent usage metric, wallet rotation, or capital migration is asserted. Provider data remains context only.',
    stock_token_spillover_note: 'Tokenized-stock and RWA connections remain source_required until primary and operational evidence establishes an actual route or activity.',
    solana_base_migration_note: 'Brokerage-agent activity is not RH Chain activity. Any bridge into DeFi, RWAs, or tokenized assets remains under_receipt_check.',
    deployer_watch_note: 'MCP rails, data layers, launchpads, direct pools, and tooling require source/provider receipts before stronger infrastructure claims.',
    infopunks_verdict: 'This upgrades the agent layer from narrative to platform-level infrastructure. The next signal is whether agent activity remains inside brokerage accounts or starts flowing into Robinhood Chain’s RWA, DeFi, and infrastructure layers.',
    manual_context: 'Agentic Market Structure draft. Human approval is required before this receipt becomes public or updates Today on 4663 and Receipt Relay.',
    source_notes: 'Robinhood primary product and Help Center documentation establish the Agentic Trading product surface and its currently documented order scope. Reviewed memory remains authoritative. Crypto support remains source_required unless exact current primary documentation verifies it. This receipt does not imply endorsement, safety, affiliation, or investment advice.',
    receipt_sections: [
      { section_id: 'agentic_trading_pulse', title: 'Agentic Trading Pulse', summary: 'Robinhood now has a formal Agentic Trading surface. A user connects a third-party AI agent through the Robinhood Trading MCP and opens a dedicated Agentic Account with a dedicated budget. Activity is visible, notifications are available, and the user can disconnect the agent.', fields: [
        { label: 'MCP connection', value: 'AI agents can connect through Robinhood’s MCP server.' },
        { label: 'Account boundary', value: 'The agent operates in a dedicated Agentic Account funded with a dedicated budget.' },
        { label: 'Controls', value: 'Users can monitor activity, receive notifications, and disconnect the agent.' },
        { label: 'Current documented scope', value: 'Robinhood Help Center says agents can currently place long equities and options orders; more tools and assets are planned.' },
        { label: 'Crypto', value: 'source_required unless exact current primary documentation verifies support.' }
      ] },
      { section_id: 'layer_power_ranking', title: 'Layer Power Update', summary: 'A reviewed structure estimate for this window, not complete chain accounting or verified cross-layer capital migration.', fields: layerPower.map(([layer, power, momentum, driver, flow, confidence, caveat]) => ({ label: layer, value: [power, momentum, driver, flow, confidence, caveat].join(' | ') })) },
      { section_id: 'agent_pulse', title: 'Main-Platform Agent Rail', summary: 'This is not only an RH Chain event. It is a Robinhood platform event that can eventually affect RH Chain.', fields: [
        { label: 'Platform read', value: 'Dedicated Agentic Accounts and MCP integration create a possible bridge from traditional brokerage activity into tokenized, RWA, and on-chain markets.' },
        { label: 'Boundary', value: 'A possible bridge is not evidence that funds, users, or strategies have reached RH Chain.' }
      ] },
      { section_id: 'rwa_pulse', title: 'RH Chain Implication', summary: 'Agents are now more than an on-chain narrative wrapper. RH Chain becomes more interesting if agents begin interacting with tokenized stocks, DeFi routes, prediction or event markets, or infrastructure contracts.', fields: [
        { label: 'Current state', value: 'The bridge from Agentic Trading to RH Chain remains under_receipt_check.' },
        { label: 'Evidence needed', value: 'Primary route documentation, operational activity, and source-linked receipts.' }
      ] },
      { section_id: 'cross_layer_flows', title: 'Cross-Layer Flow Watch', summary: 'Track these flows as source_required. They are the test of whether platform-level agent infrastructure becomes RH Chain market structure.', fields: [
        { label: 'Brokerage agent → tokenized stock interest', value: 'source_required' }, { label: 'Agent research → RH Chain RWA activity', value: 'source_required' }, { label: 'Agent-managed portfolio → on-chain DeFi route', value: 'source_required' }, { label: 'Meme liquidity → agent strategy', value: 'source_required' }, { label: 'Agent infrastructure → RWA execution', value: 'source_required' }, { label: 'MCP tooling → RH Chain contract interaction', value: 'source_required' }
      ] },
      { section_id: 'infrastructure_pulse', title: 'Infrastructure Layer', summary: 'MCP rails add a formal connection layer between agents and Robinhood’s brokerage surface. On-chain infrastructure claims still need provider and operational receipts.', fields: [{ label: 'Infrastructure boundary', value: 'MCP access does not establish RH Chain contract interaction.' }] },
      { section_id: 'launchpad_stress_test', title: 'Launchpad and Tooling Boundary', summary: 'Launchpads, direct pools, and tooling can become part of a future agent route, but no launch surface or contract interaction is inferred from Agentic Trading.', fields: [{ label: 'Evidence rule', value: 'Any MCP-to-launchpad or MCP-to-contract claim remains source_required until a provider or operational receipt is attached.' }] },
      { section_id: 'meme_pulse', title: 'Meme Layer', summary: 'Memes remain the main liquidity and onboarding engine while their relative narrative control has a slight dip.', fields: [{ label: 'Boundary', value: 'Visible market activity and reviewed context do not equal complete chain accounting.' }] },
      { section_id: 'risk_wall', title: 'Risk Wall', summary: 'The new product rail sharpens the difference between visible agent capability and verified agent behavior.', fields: [
        { label: 'Adoption risk', value: 'agent visibility mistaken for agent usage; MCP access mistaken for adoption; brokerage execution mistaken for on-chain activity; AI narrative mistaken for operational agent behavior.' },
        { label: 'Evidence risk', value: 'RWA labels without backing proof; off-chain activity not visible in wallet data; privacy limits around agent-managed accounts; source gaps.' },
        { label: 'Execution risk', value: 'compliance and execution risk; review overload.' }
      ] },
      { section_id: 'narrative_mutation', title: 'Market Structure Takeaway', summary: 'Robinhood just gave agents an account. 4663 now has to track what agents do with it.', fields: [{ label: 'Next test', value: 'Separate platform capability, visible activity, operational usage, and RH Chain adoption with receipts.' }] },
      { section_id: 'chain_pulse', title: 'Chain Boundary', summary: 'This receipt strengthens the platform-level agent thesis without asserting a change in verified RH Chain agent activity.', fields: [{ label: 'No leap', value: 'Agentic brokerage access does not become RH Chain adoption without receipts.' }] },
      { section_id: 'leadership_narrative_pulse', title: 'Narrative Boundary', summary: 'A formal product surface is stronger than general AI narrative, but it still does not prove on-chain execution or capital migration.', fields: [{ label: 'Authority', value: 'Primary Robinhood documentation supports the product-surface claim; reviewed memory governs market-structure judgment.' }] },
      { section_id: 'infopunks_verdict', title: 'Infopunks Verdict', summary: 'Memes distribute attention. RWAs create gravity. Agents now have platform rails. Infrastructure connects the system. Cross-layer receipts will prove whether the agentic thesis reaches RH Chain.', fields: [{ label: 'Verdict', value: 'Memes distribute attention. RWAs create gravity. Agents now have platform rails. Infrastructure connects the system. Cross-layer receipts will prove whether the agentic thesis reaches RH Chain.' }] }
    ],
    watchlist: [{ item: 'Brokerage-agent to RH Chain bridge', reason: 'Platform-level agent infrastructure is now documented, but RH Chain adoption is not.', risk_state: 'source_required', next_thing_to_verify: 'Source-linked route, operational on-chain activity, and snapshot history.' }],
    do_not_touch_yet: [{ item: 'Crypto-support or RH Chain-adoption claims', reason: 'Current primary documentation establishes long equities and options order scope, not an RH Chain flow.', risk_state: 'source_required', next_thing_to_verify: 'Exact current primary documentation and operational receipts.' }],
    sources: primarySources, confidence_level: 'medium', status: 'manual', data_mode: 'manual'
  });
}
function reviewCycleCountFields(summary: RhChainDailyReviewSummary) {
  const counts = [
    ['reviewed_count', summary.reviewed_count], ['promoted_to_market_structure_count', summary.promoted_to_market_structure_count], ['promoted_to_100_receipts_count', summary.promoted_to_100_receipts_count], ['source_required_count', summary.source_required_count], ['watch_only_count', summary.watch_only_count], ['ignored_count', summary.ignored_count], ['duplicate_ticker_warnings', summary.duplicate_ticker_warnings.length], ['paid_attention_detected', summary.paid_attention_detected], ['cross_layer_candidates', summary.cross_layer_candidates.length]
  ].map(([label, value]) => ({ label: String(label), value: String(value) }));
  return summary.duplicate_ticker_warnings.length ? [...counts, { label: 'duplicate_ticker_warning_detail', value: summary.duplicate_ticker_warnings.map((warning) => `${warning.contract} ↔ ${warning.duplicate_ticker_contracts.join(', ')}`).join('; ') }] : counts;
}
function reviewCycleIsEmpty(summary: RhChainDailyReviewSummary) { return summary.reviewed_count === 0 && summary.promoted_to_market_structure_count === 0 && summary.promoted_to_100_receipts_count === 0 && summary.source_required_count === 0 && summary.watch_only_count === 0 && summary.ignored_count === 0 && !summary.paid_attention_detected && summary.duplicate_ticker_warnings.length === 0 && summary.cross_layer_candidates.length === 0 && summary.outcome_checks.length === 0; }
function attentionSummary(summary: RhChainDailyReviewSummary) { const historical = summary.attention_quality_context.filter((item) => item.snapshot_count > 0); return historical.length ? historical.map((item) => `${item.token_name} · ${item.snapshot_count} snapshot(s) · ${item.attention_quality_state}`).join('; ') : 'Attention quality remains history-gated.'; }
function reviewCycleMissingEvidence(summary: RhChainDailyReviewSummary) { return [summary.reviewed_count === 0 && 'No reviewed activity is available for a market-verdict receipt.', summary.attention_quality_context.every((item) => item.snapshot_count === 0) && 'Attention quality remains history-gated.', summary.paid_attention_detected && 'Paid-attention context requires source review before it can be treated as conviction.'].filter(Boolean) as string[]; }
