import type { RhChainMarketSnapshot, RhChainPaidOrder } from '../providers/dexscreenerProvider';

export type RhChainAttentionState = 'source_required' | 'newly_observed' | 'insufficient_history' | 'paid_attention_detected' | 'organic_persistence' | 'boosted_but_retaining' | 'paid_attention_dominant' | 'attention_decay' | 'liquidity_decay';
export type RhChainAttentionContext = {
  active_boosts: number;
  paid_orders: RhChainPaidOrder[];
  attention_state: RhChainAttentionState;
  observed_at: string;
  caveats: string[];
};
export type RhChainAttentionHistorySnapshot = {
  captured_at: string;
  liquidity_usd: number | null;
  volume_h24: number | null;
  txns_h24_buys: number | null;
  txns_h24_sells: number | null;
  active_boosts: number;
  paid_order_types: string[];
};

/** Holds only provider observations. It is intentionally not a scoring or classification engine. */
export class RhChainAttentionService {
  private readonly observations = new Map<string, RhChainMarketSnapshot[]>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  assess(snapshot: RhChainMarketSnapshot): RhChainAttentionContext {
    const key = snapshot.tokenAddress.toLowerCase();
    const history = this.observations.get(key) ?? [];
    const next = [...history, structuredClone(snapshot)].slice(-12);
    this.observations.set(key, next);
    const assessment = this.assessSnapshotHistory(next.map((item) => ({ captured_at: item.capturedAt, liquidity_usd: item.liquidityUsd, volume_h24: item.volume.h24, txns_h24_buys: item.txns.h24.buys, txns_h24_sells: item.txns.h24.sells, active_boosts: item.activeBoosts, paid_order_types: item.paidOrders.map((order) => order.type).filter((type): type is string => Boolean(type)) })));
    return { active_boosts: snapshot.activeBoosts, paid_orders: snapshot.paidOrders, attention_state: assessment.attention_state, observed_at: snapshot.capturedAt || this.now().toISOString(), caveats: assessment.caveats };
  }

  assessSnapshotHistory(input: RhChainAttentionHistorySnapshot[]): Pick<RhChainAttentionContext, 'attention_state' | 'caveats'> {
    const snapshots = [...input].sort((left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at));
    const caveats = ['Paid-attention context only. Paid visibility is not misconduct, and boosted status is not organic conviction.'];
    if (snapshots.length < 3) return { attention_state: 'insufficient_history', caveats: [...caveats, 'At least three snapshots are required for before/during/after attention assessment.'] };
    const latest = snapshots.at(-1)!;
    const paidIndex = snapshots.map((snapshot, index) => ({ snapshot, index })).filter(({ snapshot }) => snapshot.active_boosts > 0 || snapshot.paid_order_types.length > 0).at(-1)?.index;
    if (paidIndex === snapshots.length - 1) return { attention_state: 'paid_attention_detected', caveats: [...caveats, 'Paid attention was observed, but no after-window is available yet.'] };
    const baseline = snapshots[Math.max(0, (paidIndex ?? 1) - 1)];
    const liquidityRetained = retained(baseline.liquidity_usd, latest.liquidity_usd, 0.65);
    const volumeRetained = retained(baseline.volume_h24, latest.volume_h24, 0.5);
    const tradersRetained = retained(traders(baseline), traders(latest), 0.7);
    const liquidityDropped = dropped(baseline.liquidity_usd, latest.liquidity_usd, 0.35);
    const volumeDropped = dropped(baseline.volume_h24, latest.volume_h24, 0.5);
    if (liquidityDropped) return { attention_state: 'liquidity_decay', caveats };
    if (volumeDropped) return { attention_state: 'attention_decay', caveats };
    if (paidIndex !== undefined) return { attention_state: liquidityRetained && tradersRetained ? 'boosted_but_retaining' : 'paid_attention_dominant', caveats };
    if (liquidityRetained && volumeRetained && tradersRetained) return { attention_state: 'organic_persistence', caveats };
    return { attention_state: 'attention_decay', caveats };
  }
}
function retained(before: number | null, after: number | null, threshold: number) { return before !== null && after !== null && before > 0 && after >= before * threshold; }
function dropped(before: number | null, after: number | null, threshold: number) { return before !== null && after !== null && before > 0 && (before - after) / before >= threshold; }
function traders(snapshot: RhChainAttentionHistorySnapshot) { const buys = snapshot.txns_h24_buys; const sells = snapshot.txns_h24_sells; return buys === null && sells === null ? null : (buys ?? 0) + (sells ?? 0); }
