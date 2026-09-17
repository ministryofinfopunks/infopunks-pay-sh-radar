import { z } from 'zod';
import type { BlockscoutProvider } from '../providers/blockscoutProvider';
import type { RhChainCloneRadarPayload } from '../data/rhChain';
import type { CanonicalStockAsset, MissionPair, ReflexiveSnapshot } from './rhChainReflexiveRadarService';
import type { RhChainAttentionAssessment } from './rhChainAttentionQualityService';
import { measureHolderConcentration, measureTransferActivity } from './rhChainSpendMeasurements';
import { sealSpendReceipt, type RhChainSpendReceiptStore, type RhChainSpendReceipt } from './rhChainSpendReceiptStore';

const contractAddress = z.string().regex(/^0x[\da-f]{40}$/i).transform((value) => value.toLowerCase()).refine((value) => !/^0x0{40}$/.test(value));
const poolAddress = z.string().regex(/^0x(?:[\da-f]{40}|[\da-f]{64})$/i).transform((value) => value.toLowerCase());
export const rhChainSpendInput = z.object({
  subject: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('contract'), chain_id: z.literal(4663).default(4663), address: contractAddress }).strict(),
    z.object({ kind: z.literal('pool'), chain_id: z.literal(4663).default(4663), address: poolAddress }).strict()
  ]),
  action: z.object({ kind: z.literal('swap'), amount_usd: z.number().finite().positive().max(1e12) }).strict().optional(),
  pool: poolAddress.optional()
}).strict();
export type RhChainSpendInput = z.infer<typeof rhChainSpendInput>;
export const RH_SPEND_POLICY = {
  version: 'rh-spend-v1', max_evidence_age_ms: 15 * 60_000,
  top_10_block_pct: 50, top_10_degrade_pct: 25,
  amount_to_liquidity_block: 0.1, amount_to_liquidity_degrade: 0.01,
  attention_block_below: 35, attention_degrade_below: 55
} as const;
export type RhChainSpendOptions = {
  snapshot: () => Promise<ReflexiveSnapshot>;
  clones: () => Promise<RhChainCloneRadarPayload>;
  attention: (contract: string) => Promise<RhChainAttentionAssessment>;
  onchain: Pick<BlockscoutProvider, 'getToken' | 'getTokenHolders' | 'getTokenTransfers'>;
  receipts: RhChainSpendReceiptStore;
  now?: () => Date;
};
const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const latest = <T extends { observed_at: string }>(items: T[]) => [...items].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] ?? null;
const matchesPool = (pair: MissionPair, value: string) => same(pair.pool_id, value) || same(pair.pool_address, value);
const positiveRaw = (value: string | null | undefined) => typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) > 0n;
const cloneItems = (radar: RhChainCloneRadarPayload | null) => radar
  ? [...new Map([...radar.active_warnings, ...radar.duplicate_ticker_watch, ...radar.liquidity_watch].map((item) => [item.id, item])).values()] : [];
function fresh(at: string | null | undefined, now: Date) {
  const age = now.getTime() - Date.parse(at ?? '');
  return Number.isFinite(age) && age >= 0 && age <= RH_SPEND_POLICY.max_evidence_age_ms;
}
function active(asset: CanonicalStockAsset) { return ['ACTIVE', 'ASSET_STATUS_ACTIVE'].includes(asset.status.toUpperCase()); }
// Provider calls are already timeout-bounded; this also bounds persisted source reads.
async function source<T>(name: string, read: () => Promise<T>, failures: string[]): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('source_timeout')), 5_000); })]); }
  catch { failures.push(name); return null; }
  finally { clearTimeout(timer); }
}

export class RhChainSpendPreflightService {
  constructor(private readonly options: RhChainSpendOptions) {}
  private now() { return (this.options.now ?? (() => new Date()))(); }
  private async publish<T extends Record<string, unknown>>(record_type: RhChainSpendReceipt['record_type'], result: T, evidence_inventory: Record<string, unknown>, now: Date) {
    // Receipt storage failure is a request failure: never return a spend verdict with a phantom receipt.
    const receipt = await this.options.receipts.create(sealSpendReceipt({ record_type, created_at: now.toISOString(),
      methodology_version: RH_SPEND_POLICY.version, immutable: true, durable: this.options.receipts.durable, result, evidence_inventory }));
    return { ...receipt.result as T, receipt_id: receipt.receipt_id, integrity_hash: receipt.integrity_hash,
      receipt_url: `/v1/rh-chain/preflight/receipts/${receipt.receipt_id}`, receipt_durable: receipt.durable };
  }
  receipt(id: string) { return this.options.receipts.get(id); }

  async asset(tickerInput: string) {
    const ticker = z.string().trim().min(1).max(32).regex(/^[\w.-]+$/).parse(tickerInput).toUpperCase();
    const failures: string[] = [];
    const [snapshot, clones] = await Promise.all([
      source('canonical_registry', this.options.snapshot, failures), source('clone_radar', this.options.clones, failures)
    ]);
    const now = this.now();
    const candidates = snapshot?.assets.filter((asset) => asset.chain_id === 4663 && asset.ticker.toUpperCase() === ticker) ?? [];
    const contracts = new Set(candidates.map((asset) => asset.canonical_contract.toLowerCase()));
    const asset = contracts.size === 1 ? latest(candidates) : null;
    const lookalikes = cloneItems(clones).filter((item) => item.suspected_ticker.toUpperCase() === ticker && !same(item.token_contract, asset?.canonical_contract));
    const state = !snapshot ? 'UNAVAILABLE' : contracts.size > 1 ? 'AMBIGUOUS_CANONICAL_IDENTITY' : !asset ? 'NOT_FOUND' : !fresh(asset.observed_at, now) ? 'STALE_CANONICAL_IDENTITY' : !active(asset) ? 'CANONICAL_ASSET_INACTIVE' : 'VERIFIED_CANONICAL';
    return this.publish('RH_ASSET_IDENTITY', { ticker, chain_id: 4663, canonical_contract: asset?.canonical_contract ?? null,
      canonical: Boolean(asset), source: asset ? 'robinhood_rhj' : null, pairing_state: state,
      observed_at: asset?.observed_at ?? null, lookalikes, lookalike_coverage: clones ? 'REVIEW_MEMORY_ONLY' : 'UNAVAILABLE',
      source_failures: failures.sort(), rule_version: RH_SPEND_POLICY.version,
      meaning: 'Canonical identity only. Pool verification and spend eligibility require preflight.'
    }, { canonical_assets: candidates, clone_observations: lookalikes }, now);
  }

  async preflight(raw: unknown) {
    const input = rhChainSpendInput.parse(raw);
    const failures: string[] = [];
    const [snapshot, clones] = await Promise.all([
      source('reflexive_snapshot', this.options.snapshot, failures), source('clone_radar', this.options.clones, failures)
    ]);
    const address = input.subject.address;
    const candidates = (snapshot?.pairs ?? []).filter((pair) => pair.chain_id === 4663 && (input.subject.kind === 'pool'
      ? matchesPool(pair, address) : same(pair.mission_contract, address) || same(pair.quote_contract, address)))
      .filter((pair) => !input.pool || matchesPool(pair, input.pool));
    const pair = candidates.length === 1 ? candidates[0] : null;
    const contract = input.subject.kind === 'contract' ? address : pair?.mission_contract.toLowerCase() ?? null;
    const [token, holders, transfers, attention] = contract ? await Promise.all([
      source('token', () => this.options.onchain.getToken(contract), failures),
      source('holders', () => this.options.onchain.getTokenHolders(contract), failures),
      source('transfers', () => this.options.onchain.getTokenTransfers(contract), failures),
      source('attention_quality', () => this.options.attention(contract), failures)
    ]) : [null, null, null, null];
    const now = this.now();
    const assets = snapshot?.assets.filter((asset) => asset.chain_id === 4663) ?? [];
    const asset = latest(assets.filter((item) => same(item.canonical_contract, contract)));
    const quote = latest(assets.filter((item) => same(item.canonical_contract, pair?.quote_contract)));
    const observation = latest(snapshot?.observations.filter((item) => item.pair_id === pair?.pair_id) ?? []);
    const position = latest(snapshot?.position_identities.filter((item) => item.mission_pair_id === pair?.pair_id) ?? []);
    const proof = latest(snapshot?.position_state_proofs.filter((item) => item.mission_pair_id === pair?.pair_id && item.token_id === position?.token_id) ?? []);
    const inventory = latest(snapshot?.inventory_observations.filter((item) => item.mission_pair_id === pair?.pair_id && item.token_id === position?.token_id) ?? []);
    const concentration = measureHolderConcentration(token && same(token.address, contract) ? token : null, holders);
    const activity = measureTransferActivity(contract ?? '', transfers, now);
    const warnings = cloneItems(clones).filter((item) => same(item.token_contract, contract));
    const riskPatterns = clones?.vampire_copycat_watch.filter((item) => same(item.contract, contract)) ?? [];
    const ticker = token?.symbol ?? (pair && same(pair.mission_contract, contract) ? pair.mission_symbol : asset?.ticker);
    const tickerMismatch = !asset && Boolean(ticker && assets.some((item) => item.ticker.toUpperCase() === ticker.toUpperCase()));
    const reasons: Array<{ code: string; severity: 'BLOCK' | 'DEGRADE' }> = [];
    const block = (code: string) => reasons.push({ code, severity: 'BLOCK' });
    const degrade = (code: string) => reasons.push({ code, severity: 'DEGRADE' });
    if (!snapshot) block('REGISTRY_UNAVAILABLE');
    if (!pair) block(candidates.length > 1 ? 'EXPLICIT_POOL_REQUIRED' : 'SUPPORTED_POOL_NOT_FOUND');
    if (!contract || !token || !same(token.address, contract)) block('EXACT_TOKEN_UNAVAILABLE');
    if (tickerMismatch) block('CANONICAL_TICKER_CONTRACT_MISMATCH');
    if (warnings.length || riskPatterns.length) block('CLONE_REVIEW_REQUIRED');
    if (!clones) block('CLONE_MEMORY_UNAVAILABLE');
    if (asset && (!fresh(asset.observed_at, now) || !active(asset))) block('SUBJECT_CANONICAL_IDENTITY_STALE_OR_INACTIVE');
    if (!quote || !fresh(quote.observed_at, now) || !active(quote)) block('CANONICAL_QUOTE_UNAVAILABLE_OR_STALE');
    if (quote && new Set(assets.filter((item) => item.ticker.toUpperCase() === quote.ticker.toUpperCase()).map((item) => item.canonical_contract.toLowerCase())).size !== 1) block('AMBIGUOUS_QUOTE_IDENTITY');
    if (asset && new Set(assets.filter((item) => item.ticker === asset.ticker).map((item) => item.canonical_contract.toLowerCase())).size !== 1) block('AMBIGUOUS_SUBJECT_IDENTITY');
    const verified = Boolean(pair && pair.canonicality === 'verified' && pair.verification.verification_status === 'VERIFIED'
      && !pair.verification.failure_reasons.length && pair.verification.pool_key && pair.verification.launch_provenance_method === 'launchpad_registry_and_receipt'
      && [pair.verification.pool_key.currency0, pair.verification.pool_key.currency1].some((value) => same(value, pair.mission_contract))
      && [pair.verification.pool_key.currency0, pair.verification.pool_key.currency1].some((value) => same(value, pair.quote_contract))
      && fresh(pair.verification.verified_at, now) && fresh(pair.verification.state_observed_at, now));
    if (!verified) block('POOL_VERIFICATION_UNAVAILABLE_OR_STALE');
    const locked = Boolean(position && proof && inventory && same(position.pool_id, pair?.pool_id) && same(proof.pool_id, pair?.pool_id)
      && position.position_identity_id && proof.proof_id && Number.isSafeInteger(position.observed_block) && position.observed_block >= 0
      && pair?.verification.position_verification_status === 'VERIFIED_LOCKER_POSITION' && pair.verification.position_token_id === position.token_id
      && position.lock_status === 'VERIFIED_LOCKED' && proof.match_status === 'POSITIONMANAGER_CORE_MATCH'
      && same(position.nft_owner, position.expected_locker) && same(proof.owner_locker, position.expected_locker)
      && positiveRaw(proof.position_manager_liquidity_raw) && proof.position_manager_liquidity_raw === proof.v4_core_liquidity_raw
      && inventory.status === 'AVAILABLE' && inventory.accounting_classification === 'VERIFIED_POSITION_ACCOUNTING'
      && inventory.position_identity_id === position.position_identity_id && inventory.position_state_proof_id === proof.proof_id
      && same(inventory.stock_contract, pair?.quote_contract) && position.observed_block === proof.observed_block && proof.observed_block === inventory.observed_block
      && fresh(position.observed_at, now) && fresh(proof.observed_at, now) && fresh(inventory.observed_at, now));
    if (!locked) block('LOCKED_POSITION_PROOF_UNAVAILABLE_OR_STALE');
    if (inventory?.range_state !== 'IN_RANGE') block('TRACKED_LOCKED_POSITION_NOT_IN_RANGE');
    const liquidity = observation?.fresh && fresh(observation.observed_at, now) && Number.isFinite(observation.liquidity_usd) && observation.liquidity_usd! > 0 ? observation.liquidity_usd : null;
    if (!liquidity || !positiveRaw(observation?.active_liquidity)) block('ACTIVE_LIQUIDITY_UNAVAILABLE_OR_STALE');
    if (concentration.state !== 'COMPLETE') block('HOLDER_DISTRIBUTION_INCOMPLETE');
    if (concentration.top_10_pct !== null && concentration.top_10_pct >= RH_SPEND_POLICY.top_10_block_pct) block('HIGH_HOLDER_CONCENTRATION');
    else if (concentration.top_10_pct !== null && concentration.top_10_pct >= RH_SPEND_POLICY.top_10_degrade_pct) degrade('ELEVATED_HOLDER_CONCENTRATION');
    const attentionValid = attention && same(attention.contract, contract) && attention.chain === 'robinhood' && attention.assessment_state === 'measurable'
      && attention.freshness === 'fresh' && fresh(attention.captured_at, now) && Number.isFinite(attention.attention_quality_score)
      && (same(attention.canonical_pair, pair?.pool_address) || same(attention.canonical_pair, pair?.pool_id));
    if (!attentionValid) degrade('ACTIVITY_PERSISTENCE_NOT_MEASURABLE');
    else if (attention.attention_quality_score! < RH_SPEND_POLICY.attention_block_below) block('LOW_ACTIVITY_PERSISTENCE');
    else if (attention.attention_quality_score! < RH_SPEND_POLICY.attention_degrade_below) degrade('WEAK_ACTIVITY_PERSISTENCE');
    // A bounded transfer sample cannot establish full-day activity integrity.
    degrade('ACTIVITY_INTEGRITY_COVERAGE_INCOMPLETE');
    const amountRatio = input.action && liquidity ? input.action.amount_usd / liquidity : null;
    if (!input.action) degrade('SPEND_AMOUNT_UNSPECIFIED');
    if (amountRatio !== null && amountRatio >= RH_SPEND_POLICY.amount_to_liquidity_block) block('SPEND_EXCEEDS_LIQUIDITY_POLICY');
    else if (amountRatio !== null && amountRatio >= RH_SPEND_POLICY.amount_to_liquidity_degrade) degrade('SPEND_NEAR_LIQUIDITY_POLICY');
    const decision = reasons.some((reason) => reason.severity === 'BLOCK') ? 'DO_NOT_SPEND' : reasons.length ? 'SIZE_SMALL' : 'CLEAR';
    const result = { subject: input.subject, resolved_contract: contract, action: input.action ?? null,
      identity: { state: asset ? 'CANONICAL_STOCK_TOKEN' : token && same(token.address, contract) ? 'EXACT_CONTRACT_OBSERVED' : 'UNRESOLVED', canonical_contract: asset?.canonical_contract ?? null },
      spoof_risk: { state: tickerMismatch ? 'CANONICAL_MISMATCH' : warnings.length || riskPatterns.length ? 'REVIEW_REQUIRED' : clones ? 'NO_REVIEW_FLAGS' : 'UNKNOWN', scope: 'REVIEW_MEMORY_ONLY' },
      holder_concentration: concentration,
      liquidity: { state: verified ? 'VERIFIED' : 'UNVERIFIED', pool_id: pair?.pool_id ?? null, usd: liquidity,
        lock_state: locked ? 'VERIFIED_LOCKED' : 'UNRESOLVED', lock_scope: 'TRACKED_POSITION_ONLY', amount_to_liquidity: amountRatio },
      activity_integrity: { ...activity, organic_persistence: attentionValid ? attention!.attention_quality_score : null,
        promotion_dependence: attentionValid ? attention!.components.filter((item) => ['boost_dependence', 'paid_order_dependence'].includes(item.key)) : [],
        volume_to_liquidity: liquidity && Number.isFinite(observation?.volume_24h_usd) && observation!.volume_24h_usd! >= 0 ? observation!.volume_24h_usd! / liquidity : null,
        methodology: 'rh_activity_integrity_transfer_sample_v1', wash_trading_attribution: 'NOT_SUPPORTED' },
      decision, reasons, source_failures: failures.sort(), rule_version: RH_SPEND_POLICY.version, assessed_at: now.toISOString(),
      policy: RH_SPEND_POLICY, transaction_capability: 'NONE', limitations: [
        'CLEAR is withheld in v1 until complete swap-level activity coverage is available.',
        'SIZE_SMALL is a policy degradation, not a calculated safe trade size. Liquidity ratios are not executable quotes or slippage estimates.',
        'Holder distribution uses raw supply, includes LPs/contracts/burn addresses, and is explorer-indexed rather than block-pinned.',
        'Blockscout responses may be cached under the configured provider TTL; retrieval time is not chain observation time.',
        'SHA-256 establishes record integrity, not truth or token safety.'
      ] };
    return this.publish('RH_SPEND_PREFLIGHT', result, { request: input, canonical_asset: asset, canonical_quote: quote, pair, observation, position, proof, inventory,
      token, holders, transfers, attention, clone_observations: warnings, risk_patterns: riskPatterns, retrieved_at: now.toISOString() }, now);
  }
}
