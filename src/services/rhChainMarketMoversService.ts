import { createHash } from 'node:crypto';
import { createRhChainSource, type RhChainSource } from '../data/rhChain';
import type { RhChainMarketSnapshot, RhChainMarketSnapshotStore } from './rhChainMarketSnapshotService';

export const RH_MARKET_MOVERS_VERSION = 'rh-market-significance-v1';
export const RH_MARKET_MOVERS_POLICY = { chain_id: 4663, freshness_ms: 15 * 60_000, window_ms: 60 * 60_000,
  baseline_tolerance_ms: 10 * 60_000, maximum_gap_ms: 20 * 60_000, minimum_samples: 6,
  minimum_liquidity_usd: 10000, minimum_volume_24h_usd: 1000, minimum_transactions_24h: 10,
  maximum_contracts: 300, weights: { volume: 25, liquidity: 20, transactions: 20, price: 15, persistence: 10, evidence: 10 },
  delta_saturation_pct: { volume: 200, liquidity: 30, transactions: 100, price: 20 } } as const;
type Freshness = { state: 'fresh' | 'stale' | 'unavailable'; observed_at: string | null; fetched_at: string | null; age_ms: number | null; time_basis: 'provider_observation' | 'provider_fetch' };
export type RhChainMarketMover = {
  rank: number; chain_id: 4663; token_contract: string; pair_address: string; ticker: string; name: string;
  lane: 'stock_token' | 'market_discovery'; observation_id: string; baseline_observation_id: string;
  observation_ids: string[]; observed_at: string; source: RhChainSource; freshness: Freshness;
  evidence_state: 'QUALIFIED_OBSERVATION'; coverage: { sample_count: number; elapsed_ms: number; maximum_gap_ms: number; provider_timestamp_count: number; state: 'complete' };
  metrics: { price_usd: number; liquidity_usd: number; rolling_volume_1h_usd: number; rolling_volume_24h_usd: number; rolling_transactions_24h: number;
    price_delta_pct: number; liquidity_delta_pct: number; volume_delta_pct: number; transactions_delta_pct: number; persistence_ratio: number };
  significance_score: number; score_components: Record<keyof typeof RH_MARKET_MOVERS_POLICY.weights, number>;
  score_version: typeof RH_MARKET_MOVERS_VERSION; investigation_href: string; history_href: string;
  judgment_state: 'unreviewed_observation'; execution_authorized: false;
};
export type RhChainMarketResearch = { token_contract: string; pair_address: string | null; observation_id: string | null;
  freshness: Freshness; evidence_state: 'INSUFFICIENT_DATA'; reasons: string[] };
export type RhChainMarketMoversPayload = { object_type: 'RH_MARKET_MOVERS'; chain_id: 4663; calculation_version: typeof RH_MARKET_MOVERS_VERSION;
  canonical_path: '/v1/rh-chain/market/movers'; projection_id: string; generated_at: string; data_mode: 'persisted';
  storage_status: 'available' | 'unavailable'; state: 'available' | 'partial' | 'empty' | 'unavailable';
  source_policy: string; disclaimer: string; policy: typeof RH_MARKET_MOVERS_POLICY; assets: RhChainMarketMover[]; research: RhChainMarketResearch[];
  coverage: { contract_count: number; ranked_count: number; research_count: number; universe_truncated: boolean; universe_scope: 'RETAINED_RAW_OBSERVATIONS' };
  failures: string[]; execution_authorized: false;
  storage?: { adapter: 'memory' | 'postgres'; durable: boolean };
  source_health?: { market_storage: 'available' | 'unavailable'; stock_registry: 'available' | 'unavailable' | 'not_configured' } };

const address = (s: string) => typeof s === 'string' && /^0x[0-9a-f]{40}$/i.test(s) && !/^0x0{40}$/i.test(s);
const pairAddress = (s: string | null) => Boolean(s && /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(s) && !/^0x0+$/i.test(s));
const lower = (s: unknown) => typeof s === 'string' ? s.toLowerCase() : '';
const identifier = (s: RhChainMarketSnapshot) => typeof s.snapshot_id === 'string' ? s.snapshot_id : '';
const label = (s: unknown) => typeof s === 'string' ? s.trim() : '';
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const time = (s: string | null | undefined) => s && /(?:Z|[+-]\d{2}:\d{2})$/i.test(s) ? Date.parse(s) : NaN;
const observedTime = (s: RhChainMarketSnapshot) => time(s.provider_timestamp ?? s.captured_at);
const round = (n: number) => Math.abs(n) >= 1e14 ? n : Math.round(n * 100) / 100;
const delta = (current: number, prior: number) => (current / prior - 1) * 100;
function sourceUrl(value: string | null) {
  try { const url = new URL(value ?? ''); if (url.protocol !== 'https:' || url.hostname !== 'dexscreener.com' || !url.pathname.startsWith('/robinhood/') || url.username || url.password) return null;
    url.search = ''; url.hash = ''; return url.toString(); } catch { return null; }
}
function freshness(sample: RhChainMarketSnapshot | null, now: Date): Freshness {
  const observed = sample ? observedTime(sample) : NaN, fetched = time(sample?.captured_at);
  const age = now.getTime() - observed, fetchAge = now.getTime() - fetched;
  const invalid = !Number.isFinite(age) || !Number.isFinite(fetchAge) || age < -60_000 || fetchAge < -60_000 || observed > fetched + 60_000;
  return { state: invalid ? 'unavailable' : age > RH_MARKET_MOVERS_POLICY.freshness_ms || fetchAge > RH_MARKET_MOVERS_POLICY.freshness_ms
    || sample?.freshness_state === 'stale' || typeof sample?.cache_status === 'string' && sample.cache_status.includes('stale') ? 'stale' : 'fresh',
  observed_at: Number.isFinite(observed) ? new Date(observed).toISOString() : null, fetched_at: sample?.captured_at ?? null,
  age_ms: invalid ? null : Math.max(0, age), time_basis: sample?.provider_timestamp ? 'provider_observation' : 'provider_fetch' };
}
function metrics(sample: RhChainMarketSnapshot) {
  if (!positive(sample.price_usd) || !positive(sample.liquidity_usd) || !nonnegative(sample.volume_h1) || !nonnegative(sample.volume_h24)
    || !nonnegative(sample.txns_h24_buys) || !nonnegative(sample.txns_h24_sells) || !Number.isSafeInteger(sample.txns_h24_buys) || !Number.isSafeInteger(sample.txns_h24_sells)) return null;
  const transactions = sample.txns_h24_buys + sample.txns_h24_sells;
  if (!Number.isSafeInteger(transactions)) return null;
  return { price: sample.price_usd, liquidity: sample.liquidity_usd, volume: sample.volume_h1, volume24: sample.volume_h24, transactions };
}
function validation(sample: RhChainMarketSnapshot, contract: string) {
  const reasons = [];
  if (!identifier(sample)) reasons.push('OBSERVATION_ID_REQUIRED');
  if (sample.chain_id !== 'robinhood' || sample.provider !== 'dexscreener') reasons.push('MAINNET_PROVIDER_IDENTITY_REQUIRED');
  if (!address(contract) || lower(sample.token_address) !== contract || lower(sample.base_token?.address) !== contract
    || !sample.quote_token?.address || !address(sample.quote_token.address) || lower(sample.quote_token.address) === contract) reasons.push('EXACT_BASE_QUOTE_IDENTITY_REQUIRED');
  if (!pairAddress(sample.pair_address)) reasons.push('EXACT_PAIR_IDENTITY_REQUIRED');
  if (sample.data_mode !== 'live_cached' || !sourceUrl(sample.source_url)) reasons.push('SOURCED_PROVIDER_OBSERVATION_REQUIRED');
  if (!Number.isFinite(observedTime(sample)) || !Number.isFinite(time(sample.captured_at))) reasons.push('INVALID_OBSERVATION_TIME');
  if (!metrics(sample)) reasons.push('METRIC_COVERAGE_INCOMPLETE');
  return reasons;
}
const signature = (s: RhChainMarketSnapshot) => JSON.stringify([lower(s.token_address), lower(s.base_token?.address), lower(s.quote_token?.address),
  s.price_usd, s.liquidity_usd, s.volume_h1, s.volume_h24, s.txns_h24_buys, s.txns_h24_sells, sourceUrl(s.source_url), s.data_mode, s.freshness_state ?? 'fresh', s.cache_status ?? '']);

/** Pure replay of stored evidence. No classifier, publication, provider, wallet or receipt authority is invoked. */
export function deriveRhChainMarketMovers(histories: Record<string, RhChainMarketSnapshot[]>, now: Date,
  stockContracts: readonly string[] = [], options: { universeTruncated?: boolean; failures?: string[] } = {}): RhChainMarketMoversPayload {
  const assets: RhChainMarketMover[] = [], research: RhChainMarketResearch[] = [];
  const normalized: Record<string, RhChainMarketSnapshot[]> = {};
  for (const [key, samples] of Object.entries(histories)) normalized[key.toLowerCase()] = [...normalized[key.toLowerCase()] ?? [], ...samples];
  histories = normalized;
  const contracts = Object.keys(histories).sort(), owners = new Map<string, Set<string>>();
  for (const [contract, samples] of Object.entries(histories)) for (const sample of samples) if (pairAddress(sample.pair_address)) {
    const key = sample.pair_address!.toLowerCase(); const set = owners.get(key) ?? new Set<string>(); set.add(contract.toLowerCase()); owners.set(key, set);
  }
  for (const input of contracts) {
    const contract = input.toLowerCase(); const pools = new Map<string, RhChainMarketSnapshot[]>();
    for (const sample of histories[input]) { const key = sample.pair_address?.toLowerCase() ?? ''; pools.set(key, [...pools.get(key) ?? [], sample]); }
    if (!pools.size) research.push({ token_contract: contract, pair_address: null, observation_id: null, freshness: freshness(null, now), evidence_state: 'INSUFFICIENT_DATA', reasons: ['RETAINED_RAW_HISTORY_UNAVAILABLE'] });
    const eligible: RhChainMarketMover[] = [];
    for (const [pair, raw] of [...pools].sort(([a], [b]) => a.localeCompare(b))) {
      const sorted = raw.slice().sort((a, b) => (time(b.captured_at) || 0) - (time(a.captured_at) || 0) || identifier(a).localeCompare(identifier(b)));
      const newest = sorted[0]; const age = freshness(newest, now); const reasons = validation(newest, contract);
      if (raw.some((s) => !Number.isFinite(time(s.captured_at)) || !Number.isFinite(observedTime(s)))) reasons.push('INVALID_OBSERVATION_TIME');
      if (options.universeTruncated) reasons.push('UNIVERSE_LIMIT_EXCEEDED');
      if ((owners.get(pair)?.size ?? 0) > 1) reasons.push('PAIR_CONTRACT_COLLISION');
      if (age.state !== 'fresh') reasons.push(age.state === 'stale' ? 'STALE_OBSERVATION' : 'INVALID_OR_FUTURE_TIME');
      const end = observedTime(newest), buckets = new Map<number, RhChainMarketSnapshot[]>();
      const inWindow = raw.filter((s) => observedTime(s) >= end - RH_MARKET_MOVERS_POLICY.window_ms - RH_MARKET_MOVERS_POLICY.baseline_tolerance_ms && observedTime(s) <= end);
      for (const sample of inWindow) { const at = observedTime(sample); buckets.set(at, [...buckets.get(at) ?? [], sample]); }
      const unique = [...buckets].sort(([a], [b]) => a - b).map(([, samples]) => {
        if (new Set(samples.map(signature)).size > 1) reasons.push('PROVIDER_PAIR_DISAGREEMENT');
        if (samples.some((s) => validation(s, contract).length || freshness(s, new Date(Math.max(observedTime(s), time(s.captured_at)))).state !== 'fresh')) reasons.push('HISTORY_IDENTITY_OR_COVERAGE_INVALID');
        return samples.slice().sort((a, b) => time(b.captured_at) - time(a.captured_at) || identifier(a).localeCompare(identifier(b)))[0];
      });
      const candidates = unique.filter((s) => Math.abs(observedTime(s) - (end - RH_MARKET_MOVERS_POLICY.window_ms)) <= RH_MARKET_MOVERS_POLICY.baseline_tolerance_ms);
      const baseline = candidates.sort((a, b) => Math.abs(observedTime(a) - (end - RH_MARKET_MOVERS_POLICY.window_ms)) - Math.abs(observedTime(b) - (end - RH_MARKET_MOVERS_POLICY.window_ms)) || identifier(a).localeCompare(identifier(b)))[0];
      const samples = baseline ? unique.filter((s) => observedTime(s) >= observedTime(baseline)) : unique;
      const gaps = samples.slice(1).map((s, i) => observedTime(s) - observedTime(samples[i]));
      const maxGap = gaps.length ? Math.max(...gaps) : 0;
      if (!baseline || samples.length < RH_MARKET_MOVERS_POLICY.minimum_samples || maxGap > RH_MARKET_MOVERS_POLICY.maximum_gap_ms) reasons.push('INSUFFICIENT_WINDOW_COVERAGE');
      const current = metrics(newest), prior = baseline ? metrics(baseline) : null;
      if (current && (current.liquidity < RH_MARKET_MOVERS_POLICY.minimum_liquidity_usd || current.volume24 < RH_MARKET_MOVERS_POLICY.minimum_volume_24h_usd || current.transactions < RH_MARKET_MOVERS_POLICY.minimum_transactions_24h)) reasons.push('INSUFFICIENT_MARKET_ACTIVITY');
      if (prior && (!positive(prior.volume) || !positive(prior.transactions))) reasons.push('ZERO_BASELINE');
      const changes = current && prior ? { price: delta(current.price, prior.price), liquidity: delta(current.liquidity, prior.liquidity),
        volume: delta(current.volume, prior.volume), transactions: delta(current.transactions, prior.transactions) } : null;
      if (changes && Object.values(changes).some((n) => !Number.isFinite(n))) reasons.push('NONFINITE_DELTA');
      if (reasons.length || !baseline || !current || !prior || !changes) {
        research.push({ token_contract: contract, pair_address: pair || null, observation_id: newest.snapshot_id, freshness: age,
          evidence_state: 'INSUFFICIENT_DATA', reasons: [...new Set(reasons)].sort() }); continue;
      }
      const components = Object.fromEntries((['volume', 'liquidity', 'transactions', 'price'] as const).map((key) =>
        [key, round(Math.min(1, Math.abs(changes[key]) / RH_MARKET_MOVERS_POLICY.delta_saturation_pct[key]) * RH_MARKET_MOVERS_POLICY.weights[key])])) as Pick<RhChainMarketMover['score_components'], 'volume' | 'liquidity' | 'transactions' | 'price'>;
      const dominant = (['volume', 'liquidity', 'transactions', 'price'] as const).slice().sort((a, b) => components[b] - components[a])[0];
      const persistence = changes[dominant] === 0 ? 0 : samples.slice(1).filter((s) => {
        const change = delta(metrics(s)![dominant], prior[dominant]); return Math.sign(change) === Math.sign(changes[dominant]) && Math.abs(change) >= Math.abs(changes[dominant]) / 2;
      }).length / (samples.length - 1);
      const providerTimes = samples.filter((s) => Boolean(s.provider_timestamp)).length;
      const scores = { ...components, persistence: round(persistence * 10), evidence: round(5 + 5 * providerTimes / samples.length) };
      const observed = age.observed_at!;
      eligible.push({ rank: 0, chain_id: 4663, token_contract: contract, pair_address: pair,
        ticker: label(newest.base_token?.symbol) || label(newest.ticker) || contract.slice(0, 10), name: label(newest.base_token?.name) || contract,
        lane: stockContracts.map((s) => s.toLowerCase()).includes(contract) ? 'stock_token' : 'market_discovery',
        observation_id: newest.snapshot_id, baseline_observation_id: baseline.snapshot_id, observation_ids: samples.map((s) => s.snapshot_id), observed_at: observed,
        source: createRhChainSource({ source_name: 'Persisted DEX Screener exact-pair observation', source_url: sourceUrl(newest.source_url),
          observed_at: observed, updated_at: new Date(time(newest.captured_at)).toISOString(), data_mode: 'persisted', confidence_level: 'low',
          note: 'One provider pool; missing provider timestamps use explicitly labeled fetch time. Observation significance only; rolling metrics are not capital flows, investment returns, reviewed classifications or executable capacity.' }),
        freshness: age, evidence_state: 'QUALIFIED_OBSERVATION', coverage: { sample_count: samples.length, elapsed_ms: end - observedTime(baseline), maximum_gap_ms: maxGap, provider_timestamp_count: providerTimes, state: 'complete' },
        metrics: { price_usd: current.price, liquidity_usd: current.liquidity, rolling_volume_1h_usd: current.volume, rolling_volume_24h_usd: current.volume24,
          rolling_transactions_24h: current.transactions, price_delta_pct: round(changes.price), liquidity_delta_pct: round(changes.liquidity), volume_delta_pct: round(changes.volume), transactions_delta_pct: round(changes.transactions), persistence_ratio: round(persistence) },
        significance_score: round(Object.values(scores).reduce((a, b) => a + b, 0)), score_components: scores, score_version: RH_MARKET_MOVERS_VERSION,
        investigation_href: `/rh-chain-signal-desk/tokens/${contract}?observation_id=${encodeURIComponent(newest.snapshot_id)}`,
        history_href: `/v1/rh-chain/market/snapshots/${contract}`, judgment_state: 'unreviewed_observation', execution_authorized: false });
    }
    // One eligible pool per exact token. Never sum multiple pools or inherit a baseline from another pool.
    eligible.sort((a, b) => b.metrics.liquidity_usd - a.metrics.liquidity_usd || b.metrics.rolling_volume_24h_usd - a.metrics.rolling_volume_24h_usd || a.pair_address.localeCompare(b.pair_address));
    if (eligible[0]) assets.push(eligible[0]);
  }
  assets.sort((a, b) => b.significance_score - a.significance_score || Math.abs(b.metrics.volume_delta_pct) - Math.abs(a.metrics.volume_delta_pct)
    || b.metrics.liquidity_usd - a.metrics.liquidity_usd || a.token_contract.localeCompare(b.token_contract) || a.pair_address.localeCompare(b.pair_address));
  assets.forEach((row, i) => { row.rank = i + 1; }); research.sort((a, b) => a.token_contract.localeCompare(b.token_contract) || (a.pair_address ?? '').localeCompare(b.pair_address ?? ''));
  const id = createHash('sha256').update(JSON.stringify({ version: RH_MARKET_MOVERS_VERSION, assets: assets.map(({ freshness: _freshness, ...row }) => row), research: research.map(({ freshness: f, ...row }) => ({ ...row, freshness_state: f.state })), failures: options.failures ?? [] })).digest('hex');
  return { object_type: 'RH_MARKET_MOVERS', chain_id: 4663, calculation_version: RH_MARKET_MOVERS_VERSION, canonical_path: '/v1/rh-chain/market/movers', projection_id: `rh-movers:${id}`,
    generated_at: now.toISOString(), data_mode: 'persisted', storage_status: options.failures?.length ? 'unavailable' : 'available', state: options.failures?.length ? 'unavailable' : assets.length ? research.length ? 'partial' : 'available' : research.length ? 'partial' : 'empty',
    source_policy: 'Deterministic replay of retained exact-contract/pair observations. No collection or reviewed publication occurs on public reads.',
    disclaimer: 'Observed market significance is not investment return, capital flow, a safety verdict or spending authority.', policy: RH_MARKET_MOVERS_POLICY,
    assets, research, coverage: { contract_count: contracts.length, ranked_count: assets.length, research_count: research.length, universe_truncated: options.universeTruncated ?? false, universe_scope: 'RETAINED_RAW_OBSERVATIONS' }, failures: options.failures ?? [], execution_authorized: false };
}

export class RhChainMarketMoversService {
  constructor(private readonly store: RhChainMarketSnapshotStore, private readonly options: { now?: () => Date; stockContracts?: () => Promise<string[]>; requireDurable?: boolean } = {}) {}
  async read() {
    const now = (this.options.now ?? (() => new Date()))();
    const storage = { adapter: this.store.adapter, durable: this.store.durable };
    const failed = (reason: string): RhChainMarketMoversPayload => ({ ...deriveRhChainMarketMovers({}, now, [], { failures: [reason] }), storage, source_health: { market_storage: 'unavailable', stock_registry: 'not_configured' } });
    try {
      if (this.options.requireDurable && !storage.durable) return failed('DURABLE_MARKET_STORE_REQUIRED');
      if (!this.store.listObservedContracts) return failed('STORE_UNIVERSE_UNSUPPORTED');
      const universe = await this.store.listObservedContracts(301);
      const contracts = universe.slice(0, 300), since = new Date(now.getTime() - 2 * 60 * 60_000).toISOString();
      const histories = this.store.listMany ? await this.store.listMany(contracts, since)
        : Object.fromEntries(await Promise.all(contracts.map(async (c) => [c, await this.store.list(c)] as const)));
      let stocks: string[] = [], registry: 'available' | 'unavailable' | 'not_configured' = 'not_configured';
      if (this.options.stockContracts) { try { stocks = await this.options.stockContracts(); registry = 'available'; } catch { registry = 'unavailable'; } }
      const result = deriveRhChainMarketMovers(histories, now, stocks, { universeTruncated: universe.length > 300 });
      return { ...result, storage, source_health: { market_storage: 'available' as const, stock_registry: registry }, state: registry === 'unavailable' && result.state === 'available' ? 'partial' as const : result.state };
    } catch { return failed('OBSERVATION_STORAGE_UNAVAILABLE'); }
  }
}
