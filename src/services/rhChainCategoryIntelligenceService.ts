import { createHash } from 'node:crypto';
import type { RhChainMarketMover, RhChainMarketMoversPayload } from './rhChainMarketMoversService';
import type { RhChainMarketSnapshot } from './rhChainMarketSnapshotService';
import type { RhChainStockEvidenceService } from './rhChainStockEvidenceService';

export const RH_CATEGORY_VERSION = 'rh-category-evidence-v1';
export const RH_INTELLIGENCE_CATEGORIES = ['stock_tokens', 'rwa_defi', 'memes', 'stables', 'market_discovery'] as const;
export type RhIntelligenceCategory = typeof RH_INTELLIGENCE_CATEGORIES[number];
export const RH_CATEGORY_POLICIES = {
  stock_tokens: { label: 'Stock Tokens', score_version: 'stock-reference-dislocation-v1', required: ['exact_identity', 'issuer_registry', 'open_market_session', 'adjusted_reference', 'corporate_action_history', 'issuer_terms'], scoring: 'Withheld until issuer terms, corporate-action history and aligned adjusted references are available.' },
  rwa_defi: { label: 'RWA/DeFi', score_version: 'rwa-mechanism-coverage-v1', required: ['exact_identity', 'reviewed_category', 'mechanism_evidence', 'asset_or_protocol_reference', 'redemption_or_protocol_constraints'], scoring: 'Withheld until the specific asset or protocol mechanism and constraints are observed.' },
  memes: { label: 'Memes', score_version: 'meme-market-activity-v1', required: ['exact_identity', 'reviewed_category', 'paid_attention_window'], scoring: 'Absolute liquidity change 30%, rolling volume change 30%, transaction change 25%, persistence 10%, paid-attention coverage 5%. Price and paid promotion size earn no points.' },
  stables: { label: 'Stables', score_version: 'stable-reference-coverage-v1', required: ['exact_identity', 'issuer_registry', 'peg_reference', 'reserve_evidence', 'redemption_constraints'], scoring: 'Withheld until a verified issuer, observed peg reference, reserves and redemption constraints are available.' },
  market_discovery: { label: 'Market discovery', score_version: 'rh-market-significance-v1', required: ['exact_identity'], scoring: 'Stored market activity only; no asset-class financial interpretation.' }
} as const;
export type RhCategoryIdentity = { contract: string; category: Exclude<RhIntelligenceCategory, 'market_discovery'>; source_id: string; href: string; observed_at: string };
type StockEvidence = Awaited<ReturnType<RhChainStockEvidenceService['evidence']>>;
export type RhCategoryFinding = {
  token_contract: string; pair_address: string; ticker: string; category: RhIntelligenceCategory;
  identity_source: RhCategoryIdentity | null; observation: RhChainMarketMover;
  evidence: { state: 'INPUTS_PRESENT' | 'INCOMPLETE'; inputs: Record<string, boolean>; missing_inputs: string[] };
  category_score: { value: number; version: string; scope: 'OBSERVED_ACTIVITY_ONLY'; components: Record<string, number> } | null;
  evidence_href: string; judgment_state: 'unreviewed_observation'; execution_authorized: false;
};
export type RhCategoryIntelligence = {
  object_type: 'RH_CATEGORY_INTELLIGENCE'; chain_id: 4663; methodology_version: typeof RH_CATEGORY_VERSION;
  projection_id: string; market_projection_id: string; generated_at: string; observed_at: string | null; last_observed_at: string | null;
  state: RhChainMarketMoversPayload['state']; source_health: Record<'market' | 'category_identity' | 'category_evidence', 'available' | 'unavailable'>;
  categories: Array<{ category: RhIntelligenceCategory; label: string; policy: typeof RH_CATEGORY_POLICIES[RhIntelligenceCategory]; findings: RhCategoryFinding[]; observed_count: number; scored_count: number; coverage: 'EMPTY' | 'INCOMPLETE' | 'INPUTS_PRESENT' }>;
  research: RhChainMarketMoversPayload['research']; universe_truncated: boolean;
  canonical_market_href: '/v1/rh-chain/market/movers'; disclaimer: string; execution_authorized: false;
};
const validContract = (s: string) => /^0x[0-9a-f]{40}$/i.test(s) && !/^0x0{40}$/i.test(s);
const validTime = (s: string, now: Date) => Number.isFinite(Date.parse(s)) && Date.parse(s) <= now.getTime() + 60_000;
const round = (n: number) => Math.round(n * 100) / 100;
function validHref(s: string) { return /^\/v1\/(?:rh-chain\/(?:classifications|market-structure)|4663\/stock-tokens\/0x[0-9a-f]{40}\/evidence)$/.test(s); }
function paidWindow(row: RhChainMarketMover, samples: RhChainMarketSnapshot[]) {
  // Every scored sample must have explicit paid coverage, including samples that
  // share a pair/time with the canonical sample. A contradictory duplicate cannot
  // manufacture a clean paid-attention window.
  const baseline = samples.find(s => s.snapshot_id === row.baseline_observation_id);
  const baselineTime = Date.parse(baseline?.provider_timestamp ?? baseline?.captured_at ?? '');
  const window = samples.filter(s => s.token_address.toLowerCase() === row.token_contract && s.pair_address?.toLowerCase() === row.pair_address
    && Date.parse(s.provider_timestamp ?? s.captured_at) >= baselineTime
    && Date.parse(s.provider_timestamp ?? s.captured_at) <= Date.parse(row.observed_at));
  const paidSignatures = new Map<string, Set<string>>();
  if (window.some(s => !Array.isArray(s.paid_order_types) || !Array.isArray(s.paid_order_statuses))) return false;
  for (const s of window) {
    const at = new Date(Date.parse(s.provider_timestamp ?? s.captured_at)).toISOString();
    const signatures = paidSignatures.get(at) ?? new Set<string>();
    signatures.add(JSON.stringify([s.paid_attention_available, s.active_boosts, [...s.paid_order_types].sort(), [...s.paid_order_statuses].sort()])); paidSignatures.set(at, signatures);
  }
  return [...paidSignatures.values()].every(signatures => signatures.size === 1) && row.observation_ids.every(id => window.some(s => s.snapshot_id === id)) && window.length > 0 && window.every(s => s.chain_id === 'robinhood'
    && s.provider === 'dexscreener' && s.base_token?.address.toLowerCase() === row.token_contract && s.paid_attention_available === true
    && Number.isSafeInteger(s.active_boosts) && s.active_boosts! >= 0 && Array.isArray(s.paid_order_types) && Array.isArray(s.paid_order_statuses));
}
function memePersistence(row: RhChainMarketMover, snapshots: RhChainMarketSnapshot[]) {
  const samples = row.observation_ids.map(id => snapshots.find(s => s.snapshot_id === id)).filter((s): s is RhChainMarketSnapshot => Boolean(s));
  const baseline = samples.find(s => s.snapshot_id === row.baseline_observation_id);
  if (!baseline || samples.length < 2) return 0;
  const value = (s: RhChainMarketSnapshot, key: 'liquidity' | 'volume' | 'transactions') => key === 'liquidity' ? s.liquidity_usd! : key === 'volume' ? s.volume_h1! : s.txns_h24_buys! + s.txns_h24_sells!;
  const changes = { liquidity: row.metrics.liquidity_delta_pct, volume: row.metrics.volume_delta_pct, transactions: row.metrics.transactions_delta_pct };
  const weights = { liquidity: 30, volume: 30, transactions: 25 }, caps = { liquidity: 30, volume: 200, transactions: 100 };
  const dominant = (Object.keys(changes) as Array<keyof typeof changes>).sort((a, b) => Math.min(Math.abs(changes[b]) / caps[b], 1) * weights[b] - Math.min(Math.abs(changes[a]) / caps[a], 1) * weights[a] || a.localeCompare(b))[0];
  if (changes[dominant] === 0) return 0;
  const later = samples.filter(s => s.snapshot_id !== row.baseline_observation_id);
  return later.filter(s => { const change = (value(s, dominant) / value(baseline, dominant) - 1) * 100;
    return Math.sign(change) === Math.sign(changes[dominant]) && Math.abs(change) >= Math.abs(changes[dominant]) / 2; }).length / later.length;
}
function finding(row: RhChainMarketMover, identity: RhCategoryIdentity | null, stock: StockEvidence, samples: RhChainMarketSnapshot[], conflict: boolean, identityAvailable: boolean): RhCategoryFinding {
  const category = identity?.category ?? 'market_discovery';
  const inputs: Record<string, boolean> = { exact_identity: true, category_identity_unambiguous: !conflict, category_identity_available: identityAvailable };
  if (category === 'memes') Object.assign(inputs, { reviewed_category: true, paid_attention_window: paidWindow(row, samples) });
  if (category === 'rwa_defi') Object.assign(inputs, { reviewed_category: true, mechanism_evidence: false, asset_or_protocol_reference: false, redemption_or_protocol_constraints: false });
  if (category === 'stables') Object.assign(inputs, { issuer_registry: false, peg_reference: false, reserve_evidence: false, redemption_constraints: false });
  if (category === 'stock_tokens') {
    const matched = stock?.chain_id === 4663 && stock.identity.contract === row.token_contract && stock.identity.registry_source_url === 'https://api.robinhood.com/rhj/assets';
    Object.assign(inputs, { issuer_registry: Boolean(matched && stock.coverage.inputs.registry),
      open_market_session: Boolean(matched && stock.issuer_reference?.current_session === 'OPEN' && stock.issuer_reference.underlying_session_at_observation === 'OPEN'),
      adjusted_reference: Boolean(matched && stock.coverage.inputs.issuer_reference && stock.coverage.inputs.multiplier_metadata && stock.route_evidence.basis?.status === 'AVAILABLE'
        && stock.market_context?.pair_id?.toLowerCase() === row.pair_address && stock.market_context.snapshot_id === row.observation_id),
      corporate_action_history: Boolean(matched && stock.coverage.inputs.full_corporate_action_history), issuer_terms: Boolean(matched && stock.coverage.inputs.issuer_terms) });
  }
  const missing = Object.keys(inputs).filter(key => !inputs[key]);
  const score = category === 'memes' && !missing.length ? {
    liquidity: round(Math.min(Math.abs(row.metrics.liquidity_delta_pct) / 30, 1) * 30),
    volume: round(Math.min(Math.abs(row.metrics.volume_delta_pct) / 200, 1) * 30),
    transactions: round(Math.min(Math.abs(row.metrics.transactions_delta_pct) / 100, 1) * 25),
    persistence: round(memePersistence(row, samples) * 10), paid_coverage: 5
  } : category === 'market_discovery' && !missing.length ? row.score_components : null;
  return { token_contract: row.token_contract, pair_address: row.pair_address, ticker: category === 'stock_tokens' && stock?.identity.contract === row.token_contract ? stock.identity.ticker : row.ticker, category, identity_source: identity, observation: row,
    evidence: { state: missing.length ? 'INCOMPLETE' : 'INPUTS_PRESENT', inputs, missing_inputs: missing },
    category_score: score ? { value: round(Object.values(score).reduce((a, b) => a + b, 0)), version: RH_CATEGORY_POLICIES[category].score_version, scope: 'OBSERVED_ACTIVITY_ONLY', components: score } : null,
    evidence_href: category === 'stock_tokens' ? `/v1/4663/stock-tokens/${row.token_contract}/evidence` : row.history_href,
    judgment_state: 'unreviewed_observation', execution_authorized: false };
}

/** Common observations, distinct evidence contracts. No provider, wallet or publisher dependency. */
export class RhChainCategoryIntelligenceService {
  constructor(private readonly deps: { movers: () => Promise<RhChainMarketMoversPayload>; identities: () => Promise<RhCategoryIdentity[]>;
    snapshots: (contracts: string[], since: string) => Promise<Record<string, RhChainMarketSnapshot[]>>;
    stockEvidence: (contract: string) => Promise<StockEvidence>; now?: () => Date }) {}
  async read(): Promise<RhCategoryIntelligence> {
    const now = (this.deps.now ?? (() => new Date()))(), market = await this.deps.movers();
    const identitiesResult = await Promise.allSettled([this.deps.identities()]);
    const identities = identitiesResult[0].status === 'fulfilled' ? identitiesResult[0].value.filter(i => validContract(i.contract) && validTime(i.observed_at, now)
      && typeof i.source_id === 'string' && i.source_id.length > 0 && i.source_id.length <= 200
      && RH_INTELLIGENCE_CATEGORIES.includes(i.category) && validHref(i.href)).map(i => ({ contract: i.contract.toLowerCase(), category: i.category, source_id: i.source_id, href: i.href, observed_at: i.observed_at })) : [];
    const selected = market.assets.slice(0, 300), samples = await Promise.allSettled([this.deps.snapshots(selected.map(r => r.token_contract), new Date(now.getTime() - 2 * 3600000).toISOString())]);
    let evidenceUnavailable = samples[0].status === 'rejected';
    const history = samples[0].status === 'fulfilled' ? samples[0].value : {};
    const findings: RhCategoryFinding[] = [];
    // Bounded sequential evidence reads: no unbounded fanout on public requests.
    for (const row of selected) {
      const matches = identities.filter(i => i.contract === row.token_contract), categories = new Set(matches.map(i => i.category));
      const identity = categories.size === 1 ? matches.sort((a, b) => a.source_id.localeCompare(b.source_id))[0] : null;
      let stock: StockEvidence = null;
      if (identity?.category === 'stock_tokens') try { stock = await this.deps.stockEvidence(row.token_contract); } catch { evidenceUnavailable = true; }
      findings.push(finding(row, identity, stock, history[row.token_contract] ?? [], categories.size > 1, identitiesResult[0].status === 'fulfilled'));
    }
    const categories = RH_INTELLIGENCE_CATEGORIES.map(category => {
      const rows = findings.filter(f => f.category === category).sort((a, b) => (b.category_score?.value ?? -1) - (a.category_score?.value ?? -1)
        || a.token_contract.localeCompare(b.token_contract) || a.pair_address.localeCompare(b.pair_address));
      return { category, label: RH_CATEGORY_POLICIES[category].label, policy: RH_CATEGORY_POLICIES[category], findings: rows,
        observed_count: rows.length, scored_count: rows.filter(r => r.category_score !== null).length,
        coverage: !rows.length ? 'EMPTY' as const : rows.some(r => r.evidence.state === 'INCOMPLETE') ? 'INCOMPLETE' as const : 'INPUTS_PRESENT' as const };
    });
    const health = { market: market.storage_status === 'available' ? 'available' as const : 'unavailable' as const,
      category_identity: identitiesResult[0].status === 'fulfilled' ? 'available' as const : 'unavailable' as const,
      category_evidence: evidenceUnavailable ? 'unavailable' as const : 'available' as const };
    // Age and request time do not move the shared semantic version. Eligibility,
    // observation identity, metric changes and evidence state do.
    const semantic = categories.map(c => ({ ...c, findings: c.findings.map(f => ({ ...f, observation: { ...f.observation, freshness: { ...f.observation.freshness, age_ms: null } } })) }));
    const hash = createHash('sha256').update(JSON.stringify({ version: RH_CATEGORY_VERSION, market: market.projection_id, categories: semantic, health })).digest('hex');
    const observedAt = selected.map(r => r.observed_at).sort().at(-1) ?? null;
    const retainedTimes = market.research.filter(r => !r.reasons.some(reason => /IDENTITY|DISAGREEMENT|COLLISION|INVALID|SOURCED|MAINNET/.test(reason)))
      .map(r => r.freshness.observed_at).filter((s): s is string => Boolean(s && validTime(s, now)));
    const lastObservedAt = [...retainedTimes, ...(observedAt ? [observedAt] : [])].sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
    return { object_type: 'RH_CATEGORY_INTELLIGENCE', chain_id: 4663, methodology_version: RH_CATEGORY_VERSION, projection_id: `rh-categories:${hash}`,
      market_projection_id: market.projection_id, generated_at: now.toISOString(), observed_at: observedAt, last_observed_at: lastObservedAt,
      state: Object.values(health).includes('unavailable') ? 'partial' : market.state, source_health: health, categories,
      research: market.research, universe_truncated: market.coverage.universe_truncated, canonical_market_href: '/v1/rh-chain/market/movers',
      disclaimer: 'Category scores describe observations within their own methodology. They cannot be compared across asset classes and confer no reviewed judgment or execution authority.', execution_authorized: false };
  }
}
