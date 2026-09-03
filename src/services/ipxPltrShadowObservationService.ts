import type { PltrPreflightState } from './rhChainPltrPreflightService';
import {
  type CandidateName,
  type IpxPltrShadowLabService,
  type MarketCapacitySweep,
  type PinnedCandidateConfiguration,
  type ShadowSeriesPoint,
  type ShadowTransition,
  SHADOW_MINIMUM_EVIDENCE_POLICY
} from './ipxPltrShadowLabService';

export const IPX_PLTR_SHADOW_OBSERVATION_WORKER_VERSION = 'ipx-pltr-shadow-observation-worker-v0.5.1-op';
export const SHADOW_EVIDENCE_POLICY_HASH = 'sha256:c7a67c48217864f2ec273e250608eba652b042ec5e6a660efce1e367c2aa9ccd';
const CANDIDATE_ORDER: CandidateName[] = ['CANDIDATE_NATIVE_V1', 'CANDIDATE_ANCHOR_V1', 'CANDIDATE_RESERVE_ANCHOR_V1'];

export type IpxPltrShadowObservationStatus = {
  object_type: 'IPX_PLTR_SHADOW_OBSERVATION_STATUS';
  worker_version: typeof IPX_PLTR_SHADOW_OBSERVATION_WORKER_VERSION;
  worker_enabled: boolean;
  capacity_sweep_enabled: boolean;
  latest_ready_snapshot: null | { observation_id: string; observed_at: string | null; observed_block: number | null; readiness: 'READY_FOR_SIMULATION' };
  last_refresh_at: string | null;
  last_replay_at: string | null;
  last_error: null | { stage: 'REFRESH' | 'REPLAY' | 'STATUS' | 'CAPACITY_SWEEP'; code: string; at: string };
  candidates: Record<CandidateName, {
    candidate_id: CandidateName;
    hash: string;
    architecture: string;
    verdict: ShadowSeriesPoint['draft_verdict'] | null;
    previous_verdict: ShadowSeriesPoint['draft_verdict'] | null;
    transition: ShadowTransition['transition'] | null;
    ready_snapshot_count: number;
  }>;
  identity_market_efficiency: null | {
    source: 'LATEST_CAPACITY_SWEEP';
    sweep_id: string;
    candidate_id: CandidateName;
    best: string | null;
    latest_points: Array<{ scenario_id: string; pltr_lp_principal: string; concentration_pct: string; modeled_usable_capacity_usd: string; usable_capacity_usd_per_pltr_concentration_pct: string | null }>;
  };
  ready_snapshot_count: number;
  elapsed_evidence_days: number;
  evidence_policy_hash: typeof SHADOW_EVIDENCE_POLICY_HASH;
  evidence_window: {
    policy_version: typeof SHADOW_MINIMUM_EVIDENCE_POLICY.version;
    satisfied: boolean;
    minimum_ready_snapshots: typeof SHADOW_MINIMUM_EVIDENCE_POLICY.minimum_ready_snapshots;
    target_calendar_days: typeof SHADOW_MINIMUM_EVIDENCE_POLICY.target_calendar_days;
  };
  next_action: 'OBSERVE' | 'V0_5_2_POLICY_FREEZE_ELIGIBLE';
  transaction_capability: 'NONE_STATUS_ONLY';
  configurations_touched: false;
};

type LastRun = {
  last_refresh_at: string | null;
  last_replay_at: string | null;
  last_ready_snapshot: IpxPltrShadowObservationStatus['latest_ready_snapshot'];
  last_error: IpxPltrShadowObservationStatus['last_error'];
  latest_capacity_sweep: MarketCapacitySweep | null;
};

export class IpxPltrShadowObservationService {
  private readonly state: LastRun = { last_refresh_at: null, last_replay_at: null, last_ready_snapshot: null, last_error: null, latest_capacity_sweep: null };
  private running = false;

  constructor(private readonly input: {
    enabled: boolean;
    capacitySweepEnabled: boolean;
    refreshPltrPreflight: () => Promise<PltrPreflightState | null>;
    shadowLab: IpxPltrShadowLabService;
    now?: () => Date;
  }) {}

  async observeOnce() {
    if (this.running) return this.status();
    this.running = true;
    try {
      const refreshedAt = this.now();
      this.state.last_refresh_at = refreshedAt;
      const snapshot = await this.input.refreshPltrPreflight();
      if (!snapshot || snapshot.state_type !== 'PLTR_PREFLIGHT_STATE' || snapshot.readiness.status !== 'READY_FOR_SIMULATION') return this.status();
      this.state.last_ready_snapshot = { observation_id: snapshot.observation_id, observed_at: snapshot.observation?.observed_at ?? null, observed_block: snapshot.observation?.observed_block ?? null, readiness: 'READY_FOR_SIMULATION' };
      const runs = await this.input.shadowLab.replay(snapshot.observation_id);
      const candidates = await this.input.shadowLab.candidates();
      assertFrozenCandidates(candidates);
      const returned = new Set(runs.map((run) => run.configuration_hash));
      if (!candidates.every((candidate) => returned.has(candidate.configuration_hash))) throw new Error('FROZEN_CANDIDATE_REPLAY_INCOMPLETE');
      this.state.last_replay_at = this.now();
      if (this.input.capacitySweepEnabled) this.state.latest_capacity_sweep = await this.input.shadowLab.capacitySweep(snapshot.observation_id, 'CANDIDATE_ANCHOR_V1');
      this.state.last_error = null;
      return this.status();
    } catch (error) {
      this.state.last_error = { stage: error instanceof Error && error.message === 'FROZEN_CANDIDATE_REPLAY_INCOMPLETE' ? 'REPLAY' : 'REFRESH', code: error instanceof Error ? error.message : String(error), at: this.now() };
      return this.status();
    } finally {
      this.running = false;
    }
  }

  async status(): Promise<IpxPltrShadowObservationStatus> {
    try {
      const candidates = await this.input.shadowLab.candidates();
      assertFrozenCandidates(candidates);
      const rows = await Promise.all(CANDIDATE_ORDER.map(async (candidate_id) => {
        const candidate = candidates.find((item) => item.candidate_id === candidate_id)!;
        const [series, transitions] = await Promise.all([this.input.shadowLab.series(candidate.configuration_hash), this.input.shadowLab.transitions(candidate.configuration_hash)]);
        const latest = series.at(-1) ?? null; const previous = series.at(-2) ?? null; const transition = transitions.at(-1) ?? null;
        return [candidate_id, { candidate_id, hash: candidate.configuration_hash, architecture: candidate.architecture, verdict: latest?.draft_verdict ?? null, previous_verdict: previous?.draft_verdict ?? null, transition: transition?.transition ?? null, ready_snapshot_count: series.length }] as const;
      }));
      const readySnapshotCount = Math.max(0, ...rows.map(([, row]) => row.ready_snapshot_count));
      const elapsedEvidenceDays = await this.elapsedEvidenceDays(candidates);
      const evidenceSatisfied = readySnapshotCount >= SHADOW_MINIMUM_EVIDENCE_POLICY.minimum_ready_snapshots && elapsedEvidenceDays >= SHADOW_MINIMUM_EVIDENCE_POLICY.target_calendar_days[0];
      return {
        object_type: 'IPX_PLTR_SHADOW_OBSERVATION_STATUS',
        worker_version: IPX_PLTR_SHADOW_OBSERVATION_WORKER_VERSION,
        worker_enabled: this.input.enabled,
        capacity_sweep_enabled: this.input.capacitySweepEnabled,
        latest_ready_snapshot: this.state.last_ready_snapshot,
        last_refresh_at: this.state.last_refresh_at,
        last_replay_at: this.state.last_replay_at,
        last_error: this.state.last_error,
        candidates: Object.fromEntries(rows) as IpxPltrShadowObservationStatus['candidates'],
        identity_market_efficiency: summarizeIme(this.state.latest_capacity_sweep),
        ready_snapshot_count: readySnapshotCount,
        elapsed_evidence_days: elapsedEvidenceDays,
        evidence_policy_hash: SHADOW_EVIDENCE_POLICY_HASH,
        evidence_window: { policy_version: SHADOW_MINIMUM_EVIDENCE_POLICY.version, satisfied: evidenceSatisfied, minimum_ready_snapshots: SHADOW_MINIMUM_EVIDENCE_POLICY.minimum_ready_snapshots, target_calendar_days: SHADOW_MINIMUM_EVIDENCE_POLICY.target_calendar_days },
        next_action: evidenceSatisfied ? 'V0_5_2_POLICY_FREEZE_ELIGIBLE' : 'OBSERVE',
        transaction_capability: 'NONE_STATUS_ONLY',
        configurations_touched: false
      };
    } catch (error) {
      this.state.last_error = { stage: 'STATUS', code: error instanceof Error ? error.message : String(error), at: this.now() };
      throw error;
    }
  }

  private async elapsedEvidenceDays(candidates: PinnedCandidateConfiguration[]) {
    const native = candidates.find((item) => item.candidate_id === 'CANDIDATE_NATIVE_V1');
    if (!native) return 0;
    const series = await this.input.shadowLab.series(native.configuration_hash);
    const times = series.map((row) => Date.parse(row.snapshot_time)).filter(Number.isFinite);
    if (times.length < 2) return 0;
    return Math.floor((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1;
  }

  private now() { return (this.input.now?.() ?? new Date()).toISOString(); }
}

function assertFrozenCandidates(candidates: PinnedCandidateConfiguration[]) {
  const ids = candidates.map((item) => item.candidate_id).sort();
  if (ids.join('|') !== [...CANDIDATE_ORDER].sort().join('|')) throw new Error('FROZEN_CANDIDATE_SET_MISMATCH');
  if (!candidates.every((item) => item.immutable && item.status === 'SHADOW_ONLY' && item.no_launch_authorization && item.configuration_hash.startsWith('sha256:'))) throw new Error('FROZEN_CANDIDATE_INVARIANT_FAILED');
}

function summarizeIme(sweep: MarketCapacitySweep | null): IpxPltrShadowObservationStatus['identity_market_efficiency'] {
  if (!sweep) return null;
  const points = sweep.scenarios.filter((scenario) => !scenario.rejected && scenario.range_family === 'WIDE' && scenario.supply_growth === 'CURRENT' && scenario.direct_market_depth_growth === 'CONSTANT');
  const scored = points.map((scenario) => Number(scenario.identity_market_efficiency.usable_capacity_usd_per_pltr_concentration_pct)).filter(Number.isFinite);
  return {
    source: 'LATEST_CAPACITY_SWEEP',
    sweep_id: sweep.sweep_id,
    candidate_id: 'CANDIDATE_ANCHOR_V1',
    best: scored.length ? Math.max(...scored).toFixed(2) : null,
    latest_points: points.map((scenario) => ({ scenario_id: scenario.scenario_id, pltr_lp_principal: scenario.pltr_lp_principal, concentration_pct: scenario.first_party_concentration_pct, modeled_usable_capacity_usd: scenario.modeled_usable_capacity_usd, usable_capacity_usd_per_pltr_concentration_pct: scenario.identity_market_efficiency.usable_capacity_usd_per_pltr_concentration_pct }))
  };
}
