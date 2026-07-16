import pg from 'pg';
import { createRhChainSource, type RhChainMemePulseAsset, type RhChainMemePulsePayload, type RhChainSource } from '../data/rhChain';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { assembleRhChainCloneRadar } from './rhChainCloneRadarService';
import { assembleRhChainLaunchpadObservatory } from './rhChainLaunchpadObservatoryService';
import { assembleRhChainMemePulseScreen } from './rhChainMemePulseService';
import type { RhChainLiveSnapshotService, RhChainProviderSnapshot } from './rhChainLiveSnapshotService';
import type { RhChainFreshnessState } from './rhChainTruthGuards';
import { isRhChainIdentityContract } from './rhChainTruthGuards';
import type { RhChainSubmissionStore } from './rhChainSignalVault';

export type RhChainMemePulseSnapshot = {
  snapshot_id: string;
  refreshed_at: string;
  freshness_state: RhChainFreshnessState;
  data_mode: 'cached' | 'manual' | 'unavailable';
  provider_status: RhChainProviderSnapshot[];
  pulse: RhChainMemePulsePayload;
};

export interface RhChainMemePulseSnapshotStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  save(snapshot: RhChainMemePulseSnapshot): Promise<void>;
  latest(): Promise<RhChainMemePulseSnapshot | null>;
  close?(): Promise<void>;
}

export class InMemoryRhChainMemePulseSnapshotStore implements RhChainMemePulseSnapshotStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private current: RhChainMemePulseSnapshot | null = null;
  async save(snapshot: RhChainMemePulseSnapshot) { this.current = structuredClone(snapshot); }
  async latest() { return this.current ? structuredClone(this.current) : null; }
}

export class PostgresRhChainMemePulseSnapshotStore implements RhChainMemePulseSnapshotStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly schema = new RetryablePostgresSchema('rh_chain_meme_pulse_snapshot_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async save(snapshot: RhChainMemePulseSnapshot) { await this.ensureSchema(); await this.pool.query('insert into rh_chain_meme_pulse_snapshots (snapshot_id, refreshed_at, payload) values ($1,$2,$3::jsonb)', [snapshot.snapshot_id, snapshot.refreshed_at, JSON.stringify(snapshot)]); await this.pool.query("delete from rh_chain_meme_pulse_snapshots where snapshot_id in (select snapshot_id from (select snapshot_id, row_number() over (order by refreshed_at desc) as row_number, refreshed_at from rh_chain_meme_pulse_snapshots) retained where retained.refreshed_at < now() - interval '7 days' or retained.row_number > 300)"); }
  async latest() { await this.ensureSchema(); const result = await this.pool.query<{ payload: RhChainMemePulseSnapshot }>('select payload from rh_chain_meme_pulse_snapshots order by refreshed_at desc limit 1'); return result.rows[0]?.payload ?? null; }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ensureSchema() { return this.schema.ensure(this.pool, 'create table if not exists rh_chain_meme_pulse_snapshots (snapshot_id text primary key, refreshed_at timestamptz not null, payload jsonb not null); create index if not exists rh_chain_meme_pulse_snapshots_refreshed_at_idx on rh_chain_meme_pulse_snapshots (refreshed_at desc);'); }
}

/** Contextual meme ranking. It has no access to index, review, or receipt mutation functions. */
export class RhChainMemePulseSnapshotService {
  private readonly now: () => Date;
  constructor(private readonly store: RhChainMemePulseSnapshotStore, private readonly live: RhChainLiveSnapshotService, now?: () => Date, private readonly submissions?: Pick<RhChainSubmissionStore, 'list'>) { this.now = now ?? (() => new Date()); }
  async getLatest() { return this.store.latest(); }
  async refresh() {
    const [live, pairs, submissions] = await Promise.all([this.live.getLiveSnapshot(), this.live.getMemePairContext(), this.submissions?.list() ?? Promise.resolve([])]);
    const refreshed_at = this.now().toISOString();
    const provider_status = [...live.provider_statuses.filter((item) => item.provider_name === 'CoinGecko'), pairs.provider_status];
    const freshness_state = providerFreshness(provider_status);
    const base = assembleRhChainMemePulseScreen(live);
    const reviewed = base.top_attention_assets.map((asset) => ({ ...asset, context_origin: 'reviewed_memory' as const }));
    const reviewedSubmissions = submissions.filter((submission) => isRhChainIdentityContract(submission.token_contract)).map((submission) => ({
      ticker: submission.ticker, name: submission.ticker, narrative_class: [], signal_score: null, risk_state: submission.risk_state ?? 'source_required', launch_surface: submission.launch_context?.launch_source ?? null, infopunks_verdict: 'Review Queue memory only. Submission is not approval, safety verification, or identity proof.', receipt_state: submission.review_status, contract: submission.token_contract, context_origin: 'reviewed_memory' as const,
      source: createRhChainSource({ source_name: 'RH Chain Review Queue', source_url: null, observed_at: submission.submitted_at, updated_at: submission.updated_at, data_mode: submission.data_mode, confidence_level: 'low', note: 'Reviewed-memory priority denotes queue memory, not an automated approval.' })
    } satisfies RhChainMemePulseAsset));
    const provider = providerAssets(live, pairs.pairs, refreshed_at);
    const cloneRadar = assembleRhChainCloneRadar();
    const observatory = assembleRhChainLaunchpadObservatory();
    const pulse: RhChainMemePulsePayload = {
      ...base,
      generated_at: refreshed_at,
      last_updated: refreshed_at,
      refreshed_at,
      freshness_state,
      top_attention_assets: [...reviewed, ...reviewedSubmissions, ...provider].slice(0, 12),
      snapshot: { ...base.snapshot, last_updated: `${refreshed_at} · ${freshness_state === 'fresh' ? 'Provider context attached; reviewed memory remains first.' : 'Provider context is stale or unavailable; reviewed memory remains first.'}` },
      launchpad_stress: [
        ...base.launchpad_stress.filter((item) => item.id === 'launchpad-economics'),
        ...observatory.surfaces.filter((surface) => surface.status !== 'active').slice(0, 4).map((surface) => ({ id: `launchpad-${surface.surface_id}`, title: surface.name, summary: surface.source_notes[0] ?? 'Launchpad context is source-required.', risk_state: surface.status === 'degraded' ? 'medium_watch' as const : 'source_required' as const }))
      ],
      risk_strip: [...base.risk_strip, ...cloneRadar.active_warnings.slice(0, 3).map((item) => ({ id: item.id, title: item.suspected_ticker, summary: item.evidence_summary, risk_state: item.risk_state }))].slice(0, 8)
    };
    const snapshot: RhChainMemePulseSnapshot = { snapshot_id: `rh-meme-pulse-${refreshed_at.replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`, refreshed_at, freshness_state, data_mode: freshness_state === 'fresh' ? 'cached' : freshness_state === 'unavailable' ? 'unavailable' : 'manual', provider_status, pulse };
    await this.store.save(snapshot);
    return snapshot;
  }
}

function providerAssets(live: Awaited<ReturnType<RhChainLiveSnapshotService['getLiveSnapshot']>>, pairs: Awaited<ReturnType<RhChainLiveSnapshotService['getMemePairContext']>>['pairs'], refreshedAt: string): RhChainMemePulseAsset[] {
  const assets: RhChainMemePulseAsset[] = [];
  const seen = new Set<string>();
  const add = (key: string, asset: RhChainMemePulseAsset) => { if (!seen.has(key)) { seen.add(key); assets.push(asset); } };
  for (const asset of live.meme_category.top_assets) {
    const source = providerSource('CoinGecko meme-category context', live.meme_category.source_timestamp ?? refreshedAt, refreshedAt, live.meme_category.freshness === 'live_cached' ? 'cached' : 'unavailable');
    add(`coingecko:${asset.symbol}`, { ticker: asset.symbol, name: asset.name, narrative_class: [], signal_score: null, risk_state: 'source_required', launch_surface: null, infopunks_verdict: 'Provider context only. A ticker does not establish identity, safety, or approval.', receipt_state: 'source_required', contract: null, context_origin: 'auto_observed', source });
  }
  for (const pair of pairs) {
    const contract = isRhChainIdentityContract(pair.contract) ? pair.contract : null;
    const source = providerSource('DexScreener top-pair context', pair.source_timestamp ?? refreshedAt, refreshedAt, contract ? 'cached' : 'unavailable');
    add(`dex:${contract ?? `${pair.ticker}:${pair.pair_address ?? 'unknown'}`}`, { ticker: pair.ticker, name: pair.name, narrative_class: [], signal_score: null, risk_state: 'source_required', launch_surface: null, infopunks_verdict: contract ? 'Auto-observed pair context only. Exact contract is displayed, but review is still required.' : 'Provider pair context lacks an exact usable contract and remains source-required.', receipt_state: 'source_required', contract, context_origin: 'auto_observed', source });
  }
  return assets;
}

function providerSource(source_name: string, observed_at: string, updated_at: string, data_mode: 'cached' | 'unavailable'): RhChainSource {
  return createRhChainSource({ source_name, source_url: source_name.startsWith('CoinGecko') ? 'https://www.coingecko.com' : 'https://dexscreener.com', observed_at, updated_at, data_mode, confidence_level: 'low', note: 'Auto-observed provider context. It is not review, approval, identity proof, safety verification, or a recommendation.' });
}

function providerFreshness(statuses: RhChainProviderSnapshot[]): RhChainFreshnessState {
  if (statuses.some((status) => status.status === 'fresh')) return 'fresh';
  if (statuses.some((status) => status.status === 'stale')) return 'stale';
  if (statuses.some((status) => status.status === 'disabled')) return 'source_required';
  return 'unavailable';
}
