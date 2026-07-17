import type { RhChainMarketSnapshot, RhChainPaidOrder } from '../providers/dexscreenerProvider';

export type RhChainAttentionState = 'organic_persistence' | 'boosted_but_retaining' | 'paid_attention_dominant' | 'attention_decay' | 'liquidity_decay' | 'source_required';
export type RhChainAttentionContext = {
  active_boosts: number;
  paid_orders: RhChainPaidOrder[];
  attention_state: RhChainAttentionState;
  observed_at: string;
  caveats: string[];
};

/** Holds only provider observations. It is intentionally not a scoring or classification engine. */
export class RhChainAttentionService {
  private readonly observations = new Map<string, RhChainMarketSnapshot[]>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  assess(snapshot: RhChainMarketSnapshot): RhChainAttentionContext {
    const key = snapshot.tokenAddress.toLowerCase();
    const history = this.observations.get(key) ?? [];
    const prior = history.slice(-2);
    const next = [...history, structuredClone(snapshot)].slice(-12);
    this.observations.set(key, next);
    const active_boosts = snapshot.activeBoosts;
    const paid_orders = snapshot.paidOrders;
    const observed_at = snapshot.capturedAt || this.now().toISOString();
    const caveats = ['Paid-attention context only. Paid visibility is not misconduct, and boosted status is not organic conviction.'];
    if (prior.length < 2) {
      caveats.push('Before/during/after snapshots are required before attention persistence can be assessed.');
      return { active_boosts, paid_orders, attention_state: 'source_required', observed_at, caveats };
    }
    const baseline = prior[0];
    const previous = prior[1];
    const liquidityDropped = percentDrop(baseline.liquidityUsd, snapshot.liquidityUsd) >= 0.35;
    const volumeDropped = percentDrop(baseline.volume.h24, snapshot.volume.h24) >= 0.5;
    const retaining = !liquidityDropped && !volumeDropped && (snapshot.volume.h24 ?? 0) >= (previous.volume.h24 ?? 0) * 0.7;
    if (liquidityDropped) return { active_boosts, paid_orders, attention_state: 'liquidity_decay', observed_at, caveats };
    if (active_boosts > 0 && paid_orders.length > 0 && !retaining) return { active_boosts, paid_orders, attention_state: 'paid_attention_dominant', observed_at, caveats };
    if (active_boosts > 0 && retaining) return { active_boosts, paid_orders, attention_state: 'boosted_but_retaining', observed_at, caveats };
    if (volumeDropped) return { active_boosts, paid_orders, attention_state: 'attention_decay', observed_at, caveats };
    return { active_boosts, paid_orders, attention_state: 'organic_persistence', observed_at, caveats };
  }
}

function percentDrop(before: number | null, after: number | null) {
  if (before === null || after === null || before <= 0) return 0;
  return Math.max(0, (before - after) / before);
}
