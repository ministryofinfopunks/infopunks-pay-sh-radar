import { createHash } from 'node:crypto';

/** Provider/indexer market context. It is deliberately not position accounting. */
export const QUOTE_PERSISTENCE_METHOD_VERSION = 'rmm-v0.4.2-quote-persistence-v1';
export const QUOTE_PERSISTENCE_ELIGIBILITY = {
  methodology_version: QUOTE_PERSISTENCE_METHOD_VERSION,
  minimum_liquidity_usd: 10_000,
  minimum_rolling_24h_volume_usd: 10_000,
  maximum_observation_skew_ms: 5 * 60_000,
  volume_window: 'ROLLING_24H' as const
} as const;

export type QuoteClass = 'CANONICAL_STOCK_TOKEN' | 'WETH' | 'STABLECOIN' | 'OTHER_CRYPTO' | 'MISSION_TOKEN' | 'DERIVATIVE_EQUITY_TOKEN';
export type QuoteMarket = {
  market_id: string; pool_identity: string; chain_id: number; protocol: string; dex: string | null; pool_id: string;
  mission_contract: string; mission_symbol: string; quote_contract: string; quote_symbol: string | null; quote_class: QuoteClass;
  canonicality: 'CANONICAL_STOCK_CONTRACT_VERIFIED' | 'NOT_APPLICABLE'; verification_state: 'PROVIDER_INDEXED_CONTEXT';
  liquidity_usd: number | null; volume_usd: number | null; volume_window: 'ROLLING_24H' | null; transaction_count: number | null;
  observed_at: string; source: string; source_url: string | null; freshness: 'fresh' | 'stale' | 'unavailable';
  eligible: boolean; exclusion_reasons: Array<'STALE' | 'MISSING_LIQUIDITY' | 'INSUFFICIENT_LIQUIDITY' | 'MISSING_VOLUME' | 'INSUFFICIENT_VOLUME'>;
  methodology_version: typeof QUOTE_PERSISTENCE_METHOD_VERSION; immutable: true;
};
export type QuotePersistenceObservation = {
  observation_id: string; mission_contract: string; mission_symbol: string; observed_at: string; window: 'ROLLING_24H';
  eligible_market_ids: string[]; excluded_market_ids: Array<{ market_id: string; reasons: QuoteMarket['exclusion_reasons'] }>;
  stock_quote_market_ids: string[]; stock_quote_volume_usd: number | null; total_eligible_volume_usd: number | null; stock_quote_volume_share: number | null;
  stock_quote_liquidity_usd: number | null; total_eligible_liquidity_usd: number | null; stock_quote_liquidity_share: number | null;
  capital_flow_divergence: number | null; quote_regime: QuoteRegime; source_alignment: 'ALIGNED' | 'UNAVAILABLE'; methodology_version: typeof QUOTE_PERSISTENCE_METHOD_VERSION; immutable: true;
};
export type QuoteRegime = 'STOCK_CAPITAL_AND_FLOW_DOMINANT' | 'STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED' | 'BALANCED_QUOTE_ECONOMY' | 'CRYPTO_CAPITAL_AND_FLOW_DOMINANT' | 'INSUFFICIENT_DATA';
export type QuoteLifecycleCheckpoint = { checkpoint_id: string; mission_contract: string; checkpoint: 'T0' | 'T6H' | 'D1' | 'D3' | 'D7' | 'D30'; target_at: string; state: 'PENDING' | 'OBSERVED' | 'PROSPECTIVE_ONLY'; observation_id: string | null; new_market_ids: string[]; dead_market_ids: string[]; methodology_version: typeof QUOTE_PERSISTENCE_METHOD_VERSION; immutable: true };
export type RawQuoteMarket = { pool_id: string; protocol: string; dex: string | null; mission_contract: string; mission_symbol: string; base_contract: string; quote_contract: string; quote_symbol: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; transaction_count: number | null; observed_at: string; source_url: string | null; freshness: 'fresh' | 'stale' | 'unavailable' };
export type QuoteTaxonomy = { canonical_stock_contracts: readonly string[]; weth_contracts: readonly string[]; stablecoin_contracts: readonly string[]; mission_contracts?: readonly string[]; derivative_equity_contracts?: readonly string[] };

const lower = (value: string) => value.toLowerCase();
const id = (...parts: string[]) => createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
const includes = (items: readonly string[] | undefined, address: string) => Boolean(items?.some((item) => lower(item) === lower(address)));
export function classifyQuoteContract(contract: string, taxonomy: QuoteTaxonomy): QuoteClass {
  if (includes(taxonomy.canonical_stock_contracts, contract)) return 'CANONICAL_STOCK_TOKEN';
  if (includes(taxonomy.weth_contracts, contract)) return 'WETH';
  if (includes(taxonomy.stablecoin_contracts, contract)) return 'STABLECOIN';
  if (includes(taxonomy.mission_contracts, contract)) return 'MISSION_TOKEN';
  if (includes(taxonomy.derivative_equity_contracts, contract)) return 'DERIVATIVE_EQUITY_TOKEN';
  return 'OTHER_CRYPTO';
}
export function quoteMarketFromRaw(raw: RawQuoteMarket, taxonomy: QuoteTaxonomy): QuoteMarket {
  const reasons: QuoteMarket['exclusion_reasons'] = [];
  if (raw.freshness !== 'fresh') reasons.push('STALE');
  if (raw.liquidity_usd === null) reasons.push('MISSING_LIQUIDITY'); else if (raw.liquidity_usd < QUOTE_PERSISTENCE_ELIGIBILITY.minimum_liquidity_usd) reasons.push('INSUFFICIENT_LIQUIDITY');
  if (raw.volume_24h_usd === null) reasons.push('MISSING_VOLUME'); else if (raw.volume_24h_usd < QUOTE_PERSISTENCE_ELIGIBILITY.minimum_rolling_24h_volume_usd) reasons.push('INSUFFICIENT_VOLUME');
  const quote = lower(raw.quote_contract); const pool = lower(raw.pool_id); const quoteClass = classifyQuoteContract(quote, taxonomy);
  return { market_id: id('quote-market', raw.protocol, pool), pool_identity: `${raw.protocol.toLowerCase()}:${pool}`, chain_id: 4663, protocol: raw.protocol, dex: raw.dex, pool_id: pool, mission_contract: lower(raw.mission_contract), mission_symbol: raw.mission_symbol, quote_contract: quote, quote_symbol: raw.quote_symbol, quote_class: quoteClass, canonicality: quoteClass === 'CANONICAL_STOCK_TOKEN' ? 'CANONICAL_STOCK_CONTRACT_VERIFIED' : 'NOT_APPLICABLE', verification_state: 'PROVIDER_INDEXED_CONTEXT', liquidity_usd: raw.liquidity_usd, volume_usd: raw.volume_24h_usd, volume_window: raw.volume_24h_usd === null ? null : 'ROLLING_24H', transaction_count: raw.transaction_count, observed_at: raw.observed_at, source: 'DexScreener token-pairs index', source_url: raw.source_url, freshness: raw.freshness, eligible: reasons.length === 0, exclusion_reasons: reasons, methodology_version: QUOTE_PERSISTENCE_METHOD_VERSION, immutable: true };
}
export function dedupeQuoteMarkets(markets: QuoteMarket[]) { return markets.filter((market, index, all) => all.findIndex((other) => other.pool_identity === market.pool_identity && other.observed_at === market.observed_at) === index); }
export function quotePersistence(markets: QuoteMarket[]): QuotePersistenceObservation | null {
  if (!markets.length) return null; const latest = Math.max(...markets.map((market) => Date.parse(market.observed_at))); const aligned = markets.every((market) => Math.abs(Date.parse(market.observed_at) - latest) <= QUOTE_PERSISTENCE_ELIGIBILITY.maximum_observation_skew_ms && market.volume_window === 'ROLLING_24H');
  const eligible = markets.filter((market) => market.eligible); const stock = eligible.filter((market) => market.quote_class === 'CANONICAL_STOCK_TOKEN');
  const canVolume = aligned && eligible.length > 0 && eligible.every((market) => market.volume_usd !== null); const canLiquidity = aligned && eligible.length > 0 && eligible.every((market) => market.liquidity_usd !== null);
  const stockVolume = canVolume ? stock.reduce((sum, market) => sum + market.volume_usd!, 0) : null; const totalVolume = canVolume ? eligible.reduce((sum, market) => sum + market.volume_usd!, 0) : null;
  const stockLiquidity = canLiquidity ? stock.reduce((sum, market) => sum + market.liquidity_usd!, 0) : null; const totalLiquidity = canLiquidity ? eligible.reduce((sum, market) => sum + market.liquidity_usd!, 0) : null;
  const volumeShare = stockVolume !== null && totalVolume && totalVolume > 0 ? stockVolume / totalVolume : null; const liquidityShare = stockLiquidity !== null && totalLiquidity && totalLiquidity > 0 ? stockLiquidity / totalLiquidity : null;
  return { observation_id: id('quote-persistence', markets[0].mission_contract, new Date(latest).toISOString(), ...eligible.map((market) => market.market_id).sort()), mission_contract: markets[0].mission_contract, mission_symbol: markets[0].mission_symbol, observed_at: new Date(latest).toISOString(), window: 'ROLLING_24H', eligible_market_ids: eligible.map((market) => market.market_id).sort(), excluded_market_ids: markets.filter((market) => !market.eligible).map((market) => ({ market_id: market.market_id, reasons: market.exclusion_reasons })), stock_quote_market_ids: stock.map((market) => market.market_id).sort(), stock_quote_volume_usd: stockVolume, total_eligible_volume_usd: totalVolume, stock_quote_volume_share: volumeShare, stock_quote_liquidity_usd: stockLiquidity, total_eligible_liquidity_usd: totalLiquidity, stock_quote_liquidity_share: liquidityShare, capital_flow_divergence: liquidityShare === null || volumeShare === null ? null : liquidityShare - volumeShare, quote_regime: quoteRegime(liquidityShare, volumeShare), source_alignment: aligned ? 'ALIGNED' : 'UNAVAILABLE', methodology_version: QUOTE_PERSISTENCE_METHOD_VERSION, immutable: true };
}
/** Fixed before evaluating data: >=60% is dominant; <=40% is non-dominant. */
export function quoteRegime(capitalShare: number | null, flowShare: number | null): QuoteRegime {
  if (capitalShare === null || flowShare === null) return 'INSUFFICIENT_DATA';
  if (capitalShare >= .6 && flowShare >= .6) return 'STOCK_CAPITAL_AND_FLOW_DOMINANT';
  if (capitalShare >= .6 && flowShare <= .4) return 'STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED';
  if (capitalShare <= .4 && flowShare <= .4) return 'CRYPTO_CAPITAL_AND_FLOW_DOMINANT';
  return 'BALANCED_QUOTE_ECONOMY';
}
export function resolveQuoteLifecycle(launchAt: string, missionContract: string, observations: QuotePersistenceObservation[], existing: QuoteLifecycleCheckpoint[], now: string): QuoteLifecycleCheckpoint[] {
  const offsets: Array<[QuoteLifecycleCheckpoint['checkpoint'], number]> = [['T0', 0], ['T6H', 6 * 3600_000], ['D1', 24 * 3600_000], ['D3', 3 * 24 * 3600_000], ['D7', 7 * 24 * 3600_000], ['D30', 30 * 24 * 3600_000]]; const output = [...existing];
  for (const [checkpoint, offset] of offsets) { const checkpointId = id('quote-lifecycle', missionContract, checkpoint); if (output.some((item) => item.checkpoint_id === checkpointId)) continue; const target = Date.parse(launchAt) + offset; const candidates = observations.filter((item) => item.mission_contract === lower(missionContract)).map((item) => ({ item, distance: Math.abs(Date.parse(item.observed_at) - target) })).filter((item) => item.distance <= 60 * 60_000).sort((a, b) => a.distance - b.distance); const chosen = candidates[0]; const prior = observations.filter((item) => item.mission_contract === lower(missionContract) && Date.parse(item.observed_at) < (chosen ? Date.parse(chosen.item.observed_at) : target)).sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]; const marketIds = chosen?.item.eligible_market_ids ?? []; output.push({ checkpoint_id: checkpointId, mission_contract: lower(missionContract), checkpoint, target_at: new Date(target).toISOString(), state: chosen ? 'OBSERVED' : Date.parse(now) >= target ? 'PROSPECTIVE_ONLY' : 'PENDING', observation_id: chosen?.item.observation_id ?? null, new_market_ids: chosen ? marketIds.filter((market) => !prior?.eligible_market_ids.includes(market)) : [], dead_market_ids: chosen && prior ? prior.eligible_market_ids.filter((market) => !marketIds.includes(market)) : [], methodology_version: QUOTE_PERSISTENCE_METHOD_VERSION, immutable: true }); }
  return output;
}
