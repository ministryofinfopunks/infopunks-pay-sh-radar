import { z } from 'zod';
import { atomicAmount } from '../schemas/ipxLaunch';
const sampleSchema = z.object({ chain_id: z.literal(4663), pool_id: z.string().min(1), pltr_contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/), observed_at: z.string().datetime(), expires_at: z.string().datetime(), observed_block: z.number().int().nonnegative(), block_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), buy_depth_pltr_atomic: atomicAmount, sell_depth_pltr_atomic: atomicAmount, slippage_bps: z.number().int().min(1).max(10000), source: z.literal('VERIFIED_ONCHAIN_EXECUTION_QUOTES'), evidence_refs: z.array(z.string().min(1)).min(1) }).strict();
export type ExecutablePltrSample = z.infer<typeof sampleSchema>;
/** Left-held observations, bounded by expiry and maximum gap. Inventory and volume never substitute for execution quotes. */
export function executablePltrMarketHours(raw: ExecutablePltrSample[], input: { pool_id: string; pltr_contract: string; slippage_bps: number; start: string; end: string; max_gap_ms: number }) {
  const start = Date.parse(input.start); const end = Date.parse(input.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isSafeInteger(input.max_gap_ms) || input.max_gap_ms <= 0 || input.max_gap_ms > 3600000) throw new Error('invalid_market_hours_window');
  const samples = raw.map(sample => sampleSchema.parse(sample)).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const times = new Set<number>();
  for (const sample of samples) {
    const at = Date.parse(sample.observed_at);
    if (times.has(at) || Date.parse(sample.expires_at) <= at || sample.pool_id !== input.pool_id || sample.pltr_contract.toLowerCase() !== input.pltr_contract.toLowerCase() || sample.slippage_bps !== input.slippage_bps) throw new Error('incomparable_execution_depth');
    times.add(at);
  }
  let integral = 0n; let covered = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]; const at = Date.parse(sample.observed_at);
    const from = Math.max(start, at); const to = Math.min(end, samples[i + 1] ? Date.parse(samples[i + 1].observed_at) : end, Date.parse(sample.expires_at), at + input.max_gap_ms);
    if (to <= from) continue;
    const depth = BigInt(sample.buy_depth_pltr_atomic) < BigInt(sample.sell_depth_pltr_atomic) ? BigInt(sample.buy_depth_pltr_atomic) : BigInt(sample.sell_depth_pltr_atomic);
    integral += depth * BigInt(to - from); covered += to - from;
  }
  return { methodology: 'IPX_EXECUTABLE_PLTR_MARKET_HOURS_V1', integral_atomic_milliseconds: String(integral), market_hours_atomic_numerator: String(integral), market_hours_denominator: '3600000', covered_ms: covered, missing_ms: end - start - covered, state: covered === end - start ? 'COMPLETE' : covered ? 'PARTIAL' : 'INSUFFICIENT_DATA', slippage_bps: input.slippage_bps, pool_id: input.pool_id, inputs: samples.map(sample => ({ observed_block: sample.observed_block, block_hash: sample.block_hash, evidence_refs: sample.evidence_refs })), causal_attribution: 'NOT_ASSERTED' };
}
