import pg from 'pg';
import { getRhChainDailyReceipts, type RhChainLaunchpadObservatoryPayload } from '../data/rhChain';
import { assembleRhChainCloneRadar } from './rhChainCloneRadarService';
import { assembleRhChainLaunchpadObservatory } from './rhChainLaunchpadObservatoryService';
import type { RhChainSubmissionStore } from './rhChainSignalVault';

export type RhChainLaunchpadObservatorySnapshot = {
  snapshot_id: string;
  refreshed_at: string;
  data_mode: 'manual' | 'cached';
  observatory: RhChainLaunchpadObservatoryPayload;
};

export interface RhChainLaunchpadSnapshotStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  save(snapshot: RhChainLaunchpadObservatorySnapshot): Promise<void>;
  latest(): Promise<RhChainLaunchpadObservatorySnapshot | null>;
  close?(): Promise<void>;
}

export class InMemoryRhChainLaunchpadSnapshotStore implements RhChainLaunchpadSnapshotStore {
  readonly adapter = 'memory' as const; readonly durable = false;
  private current: RhChainLaunchpadObservatorySnapshot | null = null;
  async save(snapshot: RhChainLaunchpadObservatorySnapshot) { this.current = structuredClone(snapshot); }
  async latest() { return this.current ? structuredClone(this.current) : null; }
}

export class PostgresRhChainLaunchpadSnapshotStore implements RhChainLaunchpadSnapshotStore {
  readonly adapter = 'postgres' as const; readonly durable = true;
  private readonly pool: pg.Pool; private schemaReady: Promise<void> | null = null;
  constructor(connectionString: string) { this.pool = new pg.Pool({ connectionString }); }
  async save(snapshot: RhChainLaunchpadObservatorySnapshot) { await this.ensureSchema(); await this.pool.query('insert into rh_chain_launchpad_observatory_snapshots (snapshot_id, refreshed_at, payload) values ($1,$2,$3::jsonb)', [snapshot.snapshot_id, snapshot.refreshed_at, JSON.stringify(snapshot)]); }
  async latest() { await this.ensureSchema(); const result = await this.pool.query<{ payload: RhChainLaunchpadObservatorySnapshot }>('select payload from rh_chain_launchpad_observatory_snapshots order by refreshed_at desc limit 1'); return result.rows[0]?.payload ?? null; }
  async close() { await this.pool.end(); }
  private ensureSchema() { this.schemaReady ??= this.pool.query('create table if not exists rh_chain_launchpad_observatory_snapshots (snapshot_id text primary key, refreshed_at timestamptz not null, payload jsonb not null); create index if not exists rh_chain_launchpad_observatory_snapshots_refreshed_at_idx on rh_chain_launchpad_observatory_snapshots (refreshed_at desc);').then(() => undefined); return this.schemaReady; }
}

/** Snapshot assembly is read-only: it preserves source-required claims and never creates launch functionality. */
export class RhChainLaunchpadSnapshotService {
  private readonly now: () => Date;
  constructor(private readonly store: RhChainLaunchpadSnapshotStore, private readonly submissions: Pick<RhChainSubmissionStore, 'list'>, now?: () => Date) { this.now = now ?? (() => new Date()); }
  async getLatest() { return this.store.latest(); }
  async refresh() {
    const [submissions, base] = await Promise.all([this.submissions.list(), Promise.resolve(assembleRhChainLaunchpadObservatory())]);
    const refreshed_at = this.now().toISOString();
    const receipts = getRhChainDailyReceipts().receipts;
    const cloneRadar = assembleRhChainCloneRadar();
    const observatory: RhChainLaunchpadObservatoryPayload = {
      ...base,
      generated_at: refreshed_at,
      surfaces: base.surfaces.map((surface) => {
        const related = submissions.filter((submission) => observatorySurfaceId(submission.launch_context?.launch_source) === surface.surface_id);
        const receiptText = `${surface.name} ${surface.notable_claims.join(' ')}`.toLowerCase();
        const related_receipts = receipts.filter((receipt) => receiptText.includes(receipt.receipt_id.toLowerCase()) || `${receipt.summary} ${receipt.headline}`.toLowerCase().includes(surface.name.toLowerCase())).map((receipt) => receipt.receipt_id);
        const cloneNotes = cloneRadar.active_warnings.filter((item) => item.launch_context?.launch_source === surface.surface_id).map((item) => item.evidence_summary);
        const source_required = surface.status === 'source_required' || related.some((submission) => submission.review_status !== 'approved_signal');
        return {
          ...surface,
          last_observed_at: related.reduce((latest, submission) => submission.updated_at > latest ? submission.updated_at : latest, surface.last_observed_at),
          notable_claims: [...surface.notable_claims, ...related.map((submission) => `Submitted launch context for ${submission.ticker}; source_required until manual review.`)],
          risk_notes: [...surface.risk_notes, ...cloneNotes],
          related_receipts,
          related_submissions: related.map((submission) => submission.submission_id),
          source_required,
          // Community/X-style submissions are source-required by construction; no status is upgraded here.
          status: source_required && surface.status === 'active' && related.length ? 'source_required' : surface.status,
          status_confidence: source_required && related.length ? 'low' : surface.status_confidence
        };
      }),
      claim_ledger: [...base.claim_ledger, ...submissions.filter((submission) => submission.launch_context).map((submission) => ({ claim_id: `submission-launch:${submission.submission_id}`, claim_type: 'notable_token_claim' as const, surface_id: observatorySurfaceId(submission.launch_context!.launch_source), claim: `${submission.ticker} submitted a launch-context claim. It remains source_required until primary evidence and manual review.`, status: 'source_required' as const, source_notes: 'Community-submitted context; not a verified operational, origin, or safety claim.', last_observed_at: submission.updated_at }))]
    };
    const snapshot: RhChainLaunchpadObservatorySnapshot = { snapshot_id: `rh-launchpad-observatory-${refreshed_at.replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`, refreshed_at, data_mode: 'manual', observatory };
    await this.store.save(snapshot);
    return snapshot;
  }
}

function observatorySurfaceId(source: string | undefined): RhChainLaunchpadObservatoryPayload['surfaces'][number]['surface_id'] {
  if (source === 'uniswap_direct_pool') return 'uniswap_direct_launches';
  if (source === 'pump_fun_routed_rh_chain') return 'pump_fun_routed_rh_chain';
  if (source === 'noxa_fun' || source === 'flap_sh' || source === 'trensh_today' || source === 'bankr' || source === 'tokeny_fun' || source === 'vlad_fun' || source === 'robindotmarket') return source;
  return 'unknown_manual';
}
