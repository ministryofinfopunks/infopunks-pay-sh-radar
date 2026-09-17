import type { BlockscoutPage, BlockscoutToken } from '../providers/blockscoutProvider';

type Row = Record<string, unknown>;
const address = (value: unknown): string | null => {
  const raw = typeof value === 'string' ? value : value && typeof value === 'object' ? (value as Row).hash : null;
  return typeof raw === 'string' && /^0x[\da-f]{40}$/i.test(raw) ? raw.toLowerCase() : null;
};
const uint = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
const pct = (value: bigint, total: bigint) => Number(value * 1_000_000n / total) / 10_000;

/** Raw supply denominator, including contracts, LPs and burn addresses. No guessed exclusions. */
export function measureHolderConcentration(token: BlockscoutToken | null, page: BlockscoutPage<Row> | null) {
  const unavailable = { state: 'UNAVAILABLE' as const, top_1_pct: null, top_10_pct: null, sampled_supply_pct: null, holders_observed: 0, total_supply_raw: token?.totalSupply ?? null, methodology: 'raw_supply_all_addresses_v1' as const };
  const supply = uint(token?.totalSupply);
  if (!page || !supply || !page.items.length) return unavailable;
  const balances = new Map<string, bigint>();
  for (const row of page.items) {
    const holder = address(row.address); const value = uint(row.value);
    if (!holder || value === null || balances.has(holder)) return unavailable;
    balances.set(holder, value);
  }
  const sorted = [...balances.values()].sort((a, b) => a > b ? -1 : a < b ? 1 : 0);
  const sampled = sorted.reduce((a, b) => a + b, 0n);
  if (sampled > supply) return unavailable;
  // The provider caps a page locally. Count and supply reconciliation prevent a truncated
  // or inconsistent page being advertised as the full distribution.
  const complete = !page.nextPageParams && token?.holdersCount === balances.size && sampled === supply;
  return { state: complete ? 'COMPLETE' as const : 'PARTIAL_LOWER_BOUND' as const,
    top_1_pct: pct(sorted[0], supply), top_10_pct: pct(sorted.slice(0, 10).reduce((a, b) => a + b, 0n), supply),
    sampled_supply_pct: pct(sampled, supply), holders_observed: balances.size,
    total_supply_raw: String(supply), methodology: 'raw_supply_all_addresses_v1' as const };
}

/** Descriptive transfer sample only: these events are neither attributed swaps nor wash trades. */
export function measureTransferActivity(contract: string, page: BlockscoutPage<Row> | null, now: Date) {
  const unavailable = { state: 'UNAVAILABLE' as const, sample_size: 0, wallet_concentration: null, counterparty_concentration: null, round_trip_intensity: null, burstiness: null };
  if (!page) return { ...unavailable, scope: 'OBSERVED_TRANSFERS_WITHIN_24H' as const };
  const edges: Array<{ from: string; to: string; at: number }> = [];
  const ids = new Set<string>();
  for (const row of page.items) {
    const from = address(row.from); const to = address(row.to);
    const token = row.token && typeof row.token === 'object' ? row.token as Row : null;
    const at = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : NaN;
    if (address(token?.address_hash) !== contract.toLowerCase() || !from || !to || !Number.isFinite(at) || at > now.getTime()) continue;
    if (at < now.getTime() - 86_400_000 || /^0x0{40}$/.test(from) || /^0x0{40}$/.test(to)) continue;
    if (typeof row.transaction_hash !== 'string' || row.log_index === undefined || row.log_index === null) continue;
    const id = `${row.transaction_hash}:${row.log_index}`;
    if (ids.has(id)) continue;
    ids.add(id); edges.push({ from, to, at });
  }
  if (!edges.length) return { ...unavailable, scope: 'OBSERVED_TRANSFERS_WITHIN_24H' as const };
  const wallets = new Map<string, number>(); const pairs = new Map<string, number>(); const hours = new Map<number, number>();
  const directed = new Set(edges.map((edge) => `${edge.from}:${edge.to}`));
  for (const edge of edges) {
    for (const wallet of [edge.from, edge.to]) wallets.set(wallet, (wallets.get(wallet) ?? 0) + 1);
    const pair = [edge.from, edge.to].sort().join(':'); pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    const hour = Math.floor(edge.at / 3_600_000); hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const ratio = (n: number, d: number) => Number((n / d).toFixed(4));
  return { state: 'SAMPLE_ONLY' as const, scope: 'OBSERVED_TRANSFERS_WITHIN_24H' as const, sample_size: edges.length,
    wallet_concentration: ratio(Math.max(...wallets.values()), edges.length * 2),
    counterparty_concentration: ratio(Math.max(...pairs.values()), edges.length),
    round_trip_intensity: ratio(edges.filter((edge) => edge.from !== edge.to && directed.has(`${edge.to}:${edge.from}`)).length, edges.length),
    burstiness: ratio(Math.max(...hours.values()), edges.length) };
}
