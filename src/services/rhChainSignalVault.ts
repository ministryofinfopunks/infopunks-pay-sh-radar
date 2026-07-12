import pg from 'pg';
import type { RhChainLaunchContext, RhChainReviewItem, RhChainReviewState, RhChainRiskState, RhChainSignalLabel, RhChainSignalSubmissionInput } from '../data/rhChain';

export type RhChainSubmissionStatus = RhChainReviewState;
export type RhChainSubmissionSource = 'seeded' | 'manual' | 'community_submission' | 'persisted';

export type RhChainReviewAuditEvent = {
  event_id: string;
  occurred_at: string;
  action: 'submitted' | 'status_updated';
  from_status?: RhChainSubmissionStatus;
  to_status: RhChainSubmissionStatus;
  note?: string;
};

export type RhChainSignalSubmission = {
  submission_id: string;
  submitted_at: string;
  updated_at: string;
  token_contract: string;
  ticker: string;
  chain: string;
  links: { x: string | null; website: string | null; liquidity: string | null; explorer: string | null };
  deployer_notes: string | null;
  submitter_notes: string | null;
  disclosure_confirmed: boolean;
  source_type: 'community_submission';
  data_mode: 'persisted' | 'community_submission';
  review_status: RhChainSubmissionStatus;
  reviewer_note?: string;
  evidence_summary?: string;
  missing_evidence?: string[];
  risk_state?: RhChainRiskState;
  signal_state?: RhChainSignalLabel;
  infopunks_verdict?: string;
  launch_context?: RhChainLaunchContext;
  audit_events: RhChainReviewAuditEvent[];
};

export type RhChainPersistedReviewItem = RhChainReviewItem & {
  submission_id: string;
  data_mode: 'persisted' | 'community_submission';
  audit_events: RhChainReviewAuditEvent[];
};

export interface RhChainSubmissionStore {
  readonly adapter: 'memory' | 'postgres' | 'unconfigured';
  readonly durable: boolean;
  save(submission: RhChainSignalSubmission): Promise<RhChainSignalSubmission>;
  list(): Promise<RhChainSignalSubmission[]>;
  updateStatus(submissionId: string, status: RhChainSubmissionStatus, reviewerNote?: string): Promise<RhChainSignalSubmission | null>;
  close?(): Promise<void>;
}

export class InMemoryRhChainSubmissionStore implements RhChainSubmissionStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly entries = new Map<string, RhChainSignalSubmission>();

  async save(submission: RhChainSignalSubmission) {
    this.entries.set(submission.submission_id, structuredClone(submission));
    return structuredClone(submission);
  }

  async list() {
    return [...this.entries.values()].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).map((entry) => structuredClone(entry));
  }

  async updateStatus(submissionId: string, status: RhChainSubmissionStatus, reviewerNote?: string) {
    const current = this.entries.get(submissionId);
    if (!current) return null;
    const updated = updateRhChainSubmissionStatus(current, status, reviewerNote);
    this.entries.set(submissionId, updated);
    return structuredClone(updated);
  }
}

export class UnconfiguredRhChainSubmissionStore implements RhChainSubmissionStore {
  readonly adapter = 'unconfigured' as const;
  readonly durable = false;
  async save(): Promise<RhChainSignalSubmission> { throw new Error('rh_chain_submission_storage_not_configured'); }
  async list() { return []; }
  async updateStatus(_submissionId: string, _status: RhChainSubmissionStatus, _reviewerNote?: string): Promise<RhChainSignalSubmission | null> { throw new Error('rh_chain_submission_storage_not_configured'); }
}

export class PostgresRhChainSubmissionStore implements RhChainSubmissionStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString: string) { this.pool = new pg.Pool({ connectionString }); }

  async save(submission: RhChainSignalSubmission) {
    await this.ensureSchema();
    await this.pool.query('insert into rh_chain_signal_submissions (submission_id, submitted_at, updated_at, payload) values ($1, $2, $3, $4::jsonb)', [submission.submission_id, submission.submitted_at, submission.updated_at, JSON.stringify(submission)]);
    return submission;
  }

  async list() {
    await this.ensureSchema();
    const result = await this.pool.query<{ payload: RhChainSignalSubmission }>('select payload from rh_chain_signal_submissions order by submitted_at desc');
    return result.rows.map((row) => row.payload);
  }

  async updateStatus(submissionId: string, status: RhChainSubmissionStatus, reviewerNote?: string) {
    await this.ensureSchema();
    const existing = await this.pool.query<{ payload: RhChainSignalSubmission }>('select payload from rh_chain_signal_submissions where submission_id = $1 for update', [submissionId]);
    if (!existing.rows[0]) return null;
    const updated = updateRhChainSubmissionStatus(existing.rows[0].payload, status, reviewerNote);
    await this.pool.query('update rh_chain_signal_submissions set updated_at = $2, payload = $3::jsonb where submission_id = $1', [submissionId, updated.updated_at, JSON.stringify(updated)]);
    return updated;
  }

  async close() { await this.pool.end(); }

  private async ensureSchema() {
    if (!this.schemaReady) this.schemaReady = this.pool.query(`create table if not exists rh_chain_signal_submissions (submission_id text primary key, submitted_at timestamptz not null, updated_at timestamptz not null, payload jsonb not null); create index if not exists rh_chain_signal_submissions_submitted_at_idx on rh_chain_signal_submissions (submitted_at desc);`).then(() => undefined);
    return this.schemaReady;
  }
}

function optional(value: string | undefined) { const trimmed = value?.trim(); return trimmed || null; }

function claimedLaunchContext(input: RhChainSignalSubmissionInput, observedAt: string): RhChainLaunchContext | undefined {
  if (!input.launch_source && !input.launch_surface_url && !input.pair_address && !input.deployer_address && !input.lp_status_claim) return undefined;
  return { launch_source: input.launch_source ?? 'unknown_manual', launch_source_type: input.launch_source === 'noxa_fun' ? 'launchpad' : input.launch_source === '20lab_erc20' ? 'token_generator' : input.launch_source === 'pump_fun_routed_rh_chain' ? 'routed_launchpad' : input.launch_source === 'uniswap_direct_pool' ? 'direct_dex_pool' : input.launch_source === 'hardhat_foundry_custom' ? 'custom_deployment' : 'unknown_manual', launch_surface_url: optional(input.launch_surface_url), contract_verified: 'unknown', liquidity_route: input.pair_address ? 'submitter-claimed pair route' : null, pair_address: optional(input.pair_address), lp_status: input.lp_status_claim ?? 'unknown', deployer_address: optional(input.deployer_address), creator_address: null, deployer_observed_at: input.deployer_address ? observedAt : null, source_notes: 'Submitter-provided launch context. Unverified until human receipt review.', evidence_links: [{ label: 'Submitter launch context', url: optional(input.launch_surface_url), note: 'Claim only; not an approval or safety determination.', observed_at: observedAt }], confidence_level: 'low', data_mode: 'community_submission', observed_at: observedAt, updated_at: observedAt };
}

export function createRhChainSignalSubmission(input: RhChainSignalSubmissionInput, submittedAt = new Date().toISOString(), dataMode: RhChainSignalSubmission['data_mode'] = 'persisted'): RhChainSignalSubmission {
  const ticker = input.ticker.trim().toUpperCase();
  const safeTicker = ticker.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signal';
  const stamp = submittedAt.replace(/[^0-9]/g, '').slice(0, 14);
  const submission_id = `rh-chain-${safeTicker}-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    submission_id, submitted_at: submittedAt, updated_at: submittedAt,
    token_contract: input.token_contract.trim(), ticker, chain: input.chain?.trim() || 'Robinhood Chain',
    links: { x: optional(input.x_twitter_link), website: optional(input.website_link), liquidity: optional(input.liquidity_link), explorer: null },
    deployer_notes: optional(input.deployer_notes), submitter_notes: optional(input.submitter_notes), disclosure_confirmed: input.disclosure_confirmed,
    source_type: 'community_submission', data_mode: dataMode, review_status: 'queued_for_manual_review',
    evidence_summary: 'Community submission received. Receipt review has not yet been completed.',
    missing_evidence: ['manual receipt review'], risk_state: 'source_required', signal_state: 'fresh_signal',
    infopunks_verdict: 'Submission is not endorsement. Review is not financial advice. Inclusion is not safety.', launch_context: claimedLaunchContext(input, submittedAt),
    audit_events: [{ event_id: `${submission_id}:submitted`, occurred_at: submittedAt, action: 'submitted', to_status: 'queued_for_manual_review', note: 'Signal received and saved to the review ledger.' }]
  };
}

export function updateRhChainSubmissionStatus(submission: RhChainSignalSubmission, status: RhChainSubmissionStatus, reviewerNote?: string, updatedAt = new Date().toISOString()): RhChainSignalSubmission {
  return { ...submission, updated_at: updatedAt, review_status: status, reviewer_note: reviewerNote ?? submission.reviewer_note, audit_events: [...submission.audit_events, { event_id: `${submission.submission_id}:${updatedAt}`, occurred_at: updatedAt, action: 'status_updated', from_status: submission.review_status, to_status: status, note: reviewerNote }] };
}

/** Service-level manual-review operation. Deliberately not exposed as a public route. */
export function reviewRhChainSubmission(store: RhChainSubmissionStore, submissionId: string, status: RhChainSubmissionStatus, reviewerNote?: string) {
  return store.updateStatus(submissionId, status, reviewerNote);
}

export function asRhChainPersistedReviewItem(submission: RhChainSignalSubmission): RhChainPersistedReviewItem {
  return { review_id: submission.submission_id, submission_id: submission.submission_id, review_state: submission.review_status, submitted_at: submission.submitted_at, updated_at: submission.updated_at, ticker: submission.ticker, token_contract: submission.token_contract, chain: submission.chain, source_type: 'community_submission', data_mode: submission.data_mode, links: submission.links, evidence_summary: submission.evidence_summary ?? 'Community submission awaiting receipt review.', missing_evidence: submission.missing_evidence ?? ['manual receipt review'], risk_state: submission.risk_state ?? 'source_required', signal_state: submission.signal_state ?? 'fresh_signal', infopunks_verdict: submission.infopunks_verdict ?? 'Submission is not endorsement. Review is not financial advice. Inclusion is not safety.', reviewer_note: submission.reviewer_note ?? 'No reviewer note yet. This item is awaiting manual review.', next_step: 'Manual review only. This submission is not added to the 4663 Index.', source: { source_name: 'RH Chain Signal Vault', source_url: null, observed_at: submission.submitted_at, updated_at: submission.updated_at, data_mode: submission.data_mode, confidence_level: 'low', note: 'Community-submitted packet retained in the review ledger; not independently verified.' }, launch_context: submission.launch_context, audit_events: submission.audit_events };
}
