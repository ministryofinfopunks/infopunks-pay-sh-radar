import type pg from 'pg';
import {
  RH_4663_GENESIS_POLICY_HASH,
  Rh4663RotationOptionSchema,
  Rh4663ServiceError,
  getRh4663PulseWindow,
  hashRh4663Canonical,
  resolveRh4663Consensus,
  serializeRh4663Canonical,
  type Hex,
  type Rh4663CallReceipt,
  type Rh4663NormalizedEvent,
  type Rh4663PulseWindow,
  type Rh4663RotationOption,
  type Rh4663Store
} from './rh4663Service';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export const RH_4663_RESOLUTION_VERSION = 'infopunks.rh-pulse.resolution.v1' as const;
export const RH_4663_MERKLE_VERSION = 'infopunks.rh-pulse.acceptance-merkle.v1' as const;
export const RH_4663_ANCHOR_VERSION = 'infopunks.rh-pulse.anchor.v1' as const;
export const RH_4663_CHAIN_ID = 4_663 as const;
export const RH_4663_PROOF_PROFILE_VERSION = 'infopunks.rh-pulse.proof-profile.v1' as const;
export const RH_4663_HIGH_CONFIDENCE_THRESHOLD = 75 as const;
export const RH_4663_PROOF_CATEGORY_MIN_RESOLVED = 2 as const;

const rotationOrder = Rh4663RotationOptionSchema.options;
const categoryRules = {
  version: 'infopunks.rh-pulse.category-rules.v1',
  mapping: { meme: 'MEMES', stock_token: 'STOCK_TOKENS', defi: 'RWA_DEFI', liquidity: 'STABLES' },
  ignored_categories: ['nft_culture', 'utility', 'agent', 'wallet', 'risk', 'integration', 'other']
} as const;
const sourceManifest = {
  version: 'infopunks.rh-pulse.source-manifest.v1',
  source: 'persisted_rh_4663_normalized_events',
  required_publication_state: 'public',
  required_lifecycle_state: 'confirmed',
  primary_source_statuses: ['fresh'],
  fallback: { enabled: true, source_statuses: ['stale'], activate_only_when_primary_empty: true },
  rejected_source_statuses: ['degraded', 'unavailable'],
  excluded_event_type_prefixes: ['rh_pulse.', 'rh_4663.signal_'],
  synchronous_provider_requests: false
} as const;
const thresholds = {
  version: 'infopunks.rh-pulse.thresholds.v1',
  minimum_qualified_observations_per_category: 1,
  minimum_category_significance_total: 60,
  score: 'sum_significance_score',
  tie_break: 'phase1_option_order_v1',
  no_qualified_outcome: 'NO_QUALIFIED_ROTATION'
} as const;
const resolutionCodeCommitment = serializeRh4663Canonical({
  version: RH_4663_RESOLUTION_VERSION,
  algorithm: 'filter_window_then_primary_or_fallback_then_sum_significance_then_threshold_then_option_order',
  observation_order: 'detected_at,event_id',
  observation_window: 'pulse_window_half_open_utc_day'
});

export const RH_4663_RESOLUTION_DEPENDENCIES = {
  category_rules_version: categoryRules.version,
  category_rules_hash: hashObject(categoryRules),
  source_manifest_version: sourceManifest.version,
  source_manifest_hash: hashObject(sourceManifest),
  thresholds_version: thresholds.version,
  thresholds_hash: hashObject(thresholds),
  resolution_version: RH_4663_RESOLUTION_VERSION,
  resolution_code_hash: hashRh4663Canonical(resolutionCodeCommitment),
  genesis_policy_hash: RH_4663_GENESIS_POLICY_HASH
} as const;

export type Rh4663WindowState = 'open' | 'closed' | 'resolved' | 'published';
export type Rh4663AnchorState = 'not_submitted' | 'submitting' | 'submitted' | 'confirmed' | 'failed';

export type Rh4663AcceptanceCommitment = {
  version: typeof RH_4663_MERKLE_VERSION;
  window_id: string;
  root: Hex;
  receipt_count: number;
  leaf_rule: 'sha256(domain || lowercase_call_payload_hash)';
  ordering: 'call_payload_hash_ascending';
  duplicate_rule: 'reject_duplicate_call_payload_hash';
  odd_node_rule: 'duplicate_last';
  internal_node_rule: 'sha256(domain || left || right)';
  created_at: string;
};

export type Rh4663AnchorRecord = {
  version: typeof RH_4663_ANCHOR_VERSION;
  chain_id: typeof RH_4663_CHAIN_ID;
  window_id: string;
  acceptance_root: Hex;
  receipt_count: number;
  commitment_timestamp: string;
  state: Rh4663AnchorState;
  transaction_hash: Hex | null;
  block_number: string | null;
  block_hash: Hex | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
};

export type Rh4663ResolutionObservation = {
  event_id: string;
  detected_at: string;
  category: string;
  resolved_rotation: Exclude<Rh4663RotationOption, 'NO_QUALIFIED_ROTATION'>;
  significance_score: number;
  source_confidence: number;
  source_status: Rh4663NormalizedEvent['source_status'];
  observation_hash: Hex;
};

export type Rh4663WindowResolution = {
  version: typeof RH_4663_RESOLUTION_VERSION;
  window_id: string;
  state: 'resolved' | 'published';
  pulse_window: Rh4663PulseWindow;
  observation_window: { opens_at: string; closes_at: string; closes_at_exclusive: true };
  resolved_category: Rh4663RotationOption;
  category_scores: Record<Rh4663RotationOption, { observation_count: number; significance_total: number; qualified: boolean }>;
  determination: { method: 'highest_qualified_significance_total'; tie: boolean; tied_categories: Rh4663RotationOption[]; tie_break_reason: 'phase1_option_order_v1' | 'not_required'; fallback_used: boolean; no_qualified_reason: string | null };
  observations: Rh4663ResolutionObservation[];
  observation_set_hash: Hex;
  provider_state: { accepted: number; fresh: number; stale: number; degraded: number; unavailable: number; rejected: number };
  dependencies: typeof RH_4663_RESOLUTION_DEPENDENCIES;
  acceptance: Rh4663AcceptanceCommitment;
  anchor: Rh4663AnchorRecord;
  consensus: ReturnType<typeof resolveRh4663Consensus> & { percentages: Record<Rh4663RotationOption, number>; tie_break_reason: 'option_order_v1' | 'not_required' };
  resolved_at: string;
  published_at: string | null;
  immutable_after_publication: true;
};

export type Rh4663ResolutionReceipt = {
  receipt_id: `IP-RES-${string}`;
  receipt_kind: 'PROTOCOL_RECEIPT';
  protocol_receipt_type: 'RESOLUTION';
  immutable: true;
  created_at: string;
  wallet: `0x${string}`;
  window_id: string;
  call_receipt_id: string;
  call_receipt_hash: Hex;
  called_category: Rh4663RotationOption;
  resolved_category: Rh4663RotationOption;
  outcome: 'CORRECT' | 'INCORRECT';
  confidence: number;
  observation_window: Rh4663WindowResolution['observation_window'];
  dependencies: typeof RH_4663_RESOLUTION_DEPENDENCIES;
  acceptance_root: Hex;
  canonical_payload: Record<string, unknown>;
  canonical_serialization: string;
  payload_hash: Hex;
  signature: Hex;
  signature_verified: true;
  resolution_signer: `0x${string}`;
  signer_key_id: string;
  publication_state: 'published';
  resolved_at: string;
};

export type Rh4663ProofReceiptLink = {
  receipt_id: string;
  receipt_url: string;
  resolution_receipt_id: string | null;
  resolution_receipt_url: string | null;
};

export type Rh4663ProofCategory = {
  calls: number;
  resolved: number;
  correct: number;
  incorrect: number;
  unresolved: number;
  accuracy: number | null;
  sample_status: 'MEANINGFUL' | 'INSUFFICIENT_SAMPLE';
  receipt_links: Rh4663ProofReceiptLink[];
};

export type Rh4663ProofProfile = {
  object_type: 'PROOF_PROFILE';
  profile_version: typeof RH_4663_PROOF_PROFILE_VERSION;
  wallet: `0x${string}`;
  display_name: string;
  calls: number;
  resolved: number;
  correct: number;
  incorrect: number;
  unresolved: number;
  accuracy: number | null;
  high_confidence_accuracy: number | null;
  high_confidence: {
    threshold: typeof RH_4663_HIGH_CONFIDENCE_THRESHOLD;
    resolved: number;
    correct: number;
    incorrect: number;
    unresolved: number;
    accuracy: number | null;
    methodology_version: typeof RH_4663_PROOF_PROFILE_VERSION;
    receipt_links: Rh4663ProofReceiptLink[];
  };
  category_breakdown: Record<Rh4663RotationOption, Rh4663ProofCategory>;
  best_supported_category: { category: Rh4663RotationOption; accuracy: number; resolved: number; receipt_links: Rh4663ProofReceiptLink[] } | { category: null; accuracy: null; resolved: 0; status: 'INSUFFICIENT_SAMPLE' };
  genesis: { ordinal: number; call_receipt_id: string; receipt_url: string } | null;
  genesis_receipt: { ordinal: number; call_receipt_id: string; receipt_url: string } | null;
  recent_calls: Array<{
    window_id: string;
    call_receipt_id: string;
    call_receipt_url: string;
    resolution_receipt_id: string | null;
    resolution_receipt_url: string | null;
    called_category: Rh4663RotationOption;
    resolved_category: Rh4663RotationOption | null;
    confidence: number;
    submitted_at: string;
    outcome: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  }>;
  streak: { current_correct: number; methodology_version: typeof RH_4663_PROOF_PROFILE_VERSION };
  methodology: {
    accuracy: 'correct / resolved; unresolved calls are excluded';
    high_confidence_threshold: typeof RH_4663_HIGH_CONFIDENCE_THRESHOLD;
    category_min_resolved: typeof RH_4663_PROOF_CATEGORY_MIN_RESOLVED;
    version: typeof RH_4663_PROOF_PROFILE_VERSION;
  };
  receipt_links: Rh4663ProofReceiptLink[];
};

export type Rh4663MerkleProof = {
  version: typeof RH_4663_MERKLE_VERSION;
  receipt_id: string;
  call_receipt_hash: Hex;
  leaf_hash: Hex;
  leaf_index: number;
  receipt_count: number;
  acceptance_root: Hex;
  proof: Array<{ hash: Hex; position: 'left' | 'right' }>;
  verified: boolean;
  anchor: Rh4663AnchorRecord;
};

export interface Rh4663ResolutionSigner {
  readonly available: boolean;
  readonly keyId: string;
  address(): Promise<`0x${string}` | null>;
  sign(serialization: string): Promise<Hex>;
}

export class PrivateKeyRh4663ResolutionSigner implements Rh4663ResolutionSigner {
  readonly available = true;
  readonly keyId: string;
  constructor(private readonly privateKey: Hex, keyId = 'rh4663-resolution-v1') { this.keyId = keyId; }
  async address() { const { privateKeyToAccount } = await import('viem/accounts'); return privateKeyToAccount(this.privateKey).address.toLowerCase() as `0x${string}`; }
  async sign(serialization: string) { const { privateKeyToAccount } = await import('viem/accounts'); return privateKeyToAccount(this.privateKey).signMessage({ message: serialization }); }
}

export class UnavailableRh4663ResolutionSigner implements Rh4663ResolutionSigner {
  readonly available = false; readonly keyId = 'unconfigured';
  async address() { return null; }
  async sign(): Promise<Hex> { throw new Rh4663ServiceError('resolution_signer_not_configured', 503); }
}

export interface Rh4663AnchorAdapter {
  readonly available: boolean;
  submit(commitment: Rh4663AcceptanceCommitment): Promise<{ transaction_hash: Hex }>;
  confirmation(transactionHash: Hex): Promise<{ state: 'submitted' | 'confirmed' | 'failed'; block_number?: string; block_hash?: Hex; failure_code?: string }>;
}

export class DisabledRh4663AnchorAdapter implements Rh4663AnchorAdapter {
  readonly available = false;
  async submit(): Promise<{ transaction_hash: Hex }> { throw new Rh4663ServiceError('anchor_signer_not_configured', 503); }
  async confirmation(): Promise<{ state: 'submitted' }> { return { state: 'submitted' }; }
}

const RH_4663_ANCHOR_ABI = [{ type: 'function', name: 'commitPulseWindow', stateMutability: 'nonpayable', inputs: [{ name: 'windowHash', type: 'bytes32' }, { name: 'acceptanceRoot', type: 'bytes32' }, { name: 'receiptCount', type: 'uint256' }, { name: 'committedAt', type: 'uint64' }], outputs: [] }] as const;

/** Production adapter for a configured, deployed RH Chain commitment contract. */
export class ViemRh4663AnchorAdapter implements Rh4663AnchorAdapter {
  readonly available = true;
  constructor(private readonly rpcUrl: string, private readonly contract: Hex, private readonly privateKey: Hex, private readonly confirmations = 2) {
    if (!/^https:\/\//.test(rpcUrl)) throw new Error('RH_4663_ANCHOR_RPC_URL must use https');
  }
  async submit(commitment: Rh4663AcceptanceCommitment) {
    const [{ createWalletClient, defineChain, encodeFunctionData, http }, { privateKeyToAccount }] = await Promise.all([import('viem'), import('viem/accounts')]);
    const chain = defineChain({ id: RH_4663_CHAIN_ID, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [this.rpcUrl] } } }); const account = privateKeyToAccount(this.privateKey); const walletClient = createWalletClient({ account, chain, transport: http(this.rpcUrl, { timeout: 5_000, retryCount: 1 }) });
    const data = encodeFunctionData({ abi: RH_4663_ANCHOR_ABI, functionName: 'commitPulseWindow', args: [hashRh4663Canonical(commitment.window_id), commitment.root, BigInt(commitment.receipt_count), BigInt(Math.floor(Date.parse(commitment.created_at) / 1_000))] });
    const transaction_hash = await walletClient.sendTransaction({ account, chain, to: this.contract, data, value: 0n });
    return { transaction_hash };
  }
  async confirmation(transactionHash: Hex) {
    try {
      const { createPublicClient, defineChain, http } = await import('viem'); const chain = defineChain({ id: RH_4663_CHAIN_ID, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [this.rpcUrl] } } }); const publicClient = createPublicClient({ chain, transport: http(this.rpcUrl, { timeout: 5_000, retryCount: 1 }) });
      const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
      if (receipt.status === 'reverted') return { state: 'failed' as const, failure_code: 'anchor_transaction_reverted' };
      const head = await publicClient.getBlockNumber(); const depth = head >= receipt.blockNumber ? Number(head - receipt.blockNumber + 1n) : 0;
      if (depth < this.confirmations) return { state: 'submitted' as const };
      return { state: 'confirmed' as const, block_number: receipt.blockNumber.toString(), block_hash: receipt.blockHash };
    } catch (error) {
      if (error instanceof Error && /not found|could not be found/i.test(error.message)) return { state: 'submitted' as const };
      throw error;
    }
  }
}

export class DeterministicTestRh4663AnchorAdapter implements Rh4663AnchorAdapter {
  readonly available = true;
  private readonly confirmed: boolean;
  submissions = 0;
  constructor(confirmed = true) { this.confirmed = confirmed; }
  async submit(commitment: Rh4663AcceptanceCommitment) { this.submissions += 1; return { transaction_hash: hashRh4663Canonical(`test-anchor:${commitment.window_id}:${commitment.root}`) }; }
  async confirmation(transactionHash: Hex) { return this.confirmed ? { state: 'confirmed' as const, block_number: '1', block_hash: hashRh4663Canonical(`test-block:${transactionHash}`) } : { state: 'submitted' as const }; }
}

export interface Rh4663ResolutionStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  getResolution(windowId: string): Promise<Rh4663WindowResolution | null>;
  saveResolution(resolution: Rh4663WindowResolution): Promise<Rh4663WindowResolution>;
  publishResolution(windowId: string, receipts: Rh4663ResolutionReceipt[], publishedAt: string): Promise<Rh4663WindowResolution>;
  getReceipt(receiptId: string): Promise<Rh4663ResolutionReceipt | null>;
  getReceiptForCall(callReceiptId: string): Promise<Rh4663ResolutionReceipt | null>;
  listReceiptsByWallet(wallet: string): Promise<Rh4663ResolutionReceipt[]>;
  claimAnchorSubmission(windowId: string, claimedAt: string): Promise<Rh4663AnchorRecord | null>;
  saveAnchor(anchor: Rh4663AnchorRecord): Promise<Rh4663AnchorRecord>;
  close?(): Promise<void>;
}

export class InMemoryRh4663ResolutionStore implements Rh4663ResolutionStore {
  readonly adapter = 'memory' as const; readonly durable = false;
  private resolutions = new Map<string, Rh4663WindowResolution>();
  private receipts = new Map<string, Rh4663ResolutionReceipt>();
  async getResolution(id: string) { return clone(this.resolutions.get(id) ?? null); }
  async saveResolution(value: Rh4663WindowResolution) {
    const prior = this.resolutions.get(value.window_id);
    if (prior) {
      if (resolutionMaterialHash(prior) !== resolutionMaterialHash(value)) throw new Rh4663ServiceError('conflicting_resolution', 409);
      return clone(prior);
    }
    this.resolutions.set(value.window_id, clone(value)); return clone(value);
  }
  async publishResolution(windowId: string, receipts: Rh4663ResolutionReceipt[], publishedAt: string) {
    const resolution = this.resolutions.get(windowId); if (!resolution) throw new Rh4663ServiceError('resolution_not_found', 404);
    for (const receipt of receipts) {
      const prior = [...this.receipts.values()].find((item) => item.call_receipt_id === receipt.call_receipt_id);
      if (prior && prior.payload_hash !== receipt.payload_hash) throw new Rh4663ServiceError('conflicting_resolution_receipt', 409);
      this.receipts.set(receipt.receipt_id, clone(receipt));
    }
    if (resolution.state === 'published') return clone(resolution);
    const published = { ...resolution, state: 'published' as const, published_at: publishedAt };
    this.resolutions.set(windowId, clone(published)); return clone(published);
  }
  async getReceipt(id: string) { return clone(this.receipts.get(id) ?? null); }
  async getReceiptForCall(id: string) { return clone([...this.receipts.values()].find((item) => item.call_receipt_id === id) ?? null); }
  async listReceiptsByWallet(wallet: string) { return [...this.receipts.values()].filter((item) => item.wallet.toLowerCase() === wallet.toLowerCase()).sort((a, b) => a.observation_window.opens_at.localeCompare(b.observation_window.opens_at)).map(clone); }
  async claimAnchorSubmission(windowId: string, claimedAt: string) { const resolution = this.resolutions.get(windowId); if (!resolution) return null; const anchor = resolution.anchor; const staleClaim = anchor.state === 'submitting' && anchor.submitted_at && Date.parse(claimedAt) - Date.parse(anchor.submitted_at) >= 5 * 60_000; if (!['not_submitted', 'failed'].includes(anchor.state) && !staleClaim) return null; const claimed = { ...anchor, state: 'submitting' as const, submitted_at: claimedAt, failed_at: null, failure_code: null }; this.resolutions.set(windowId, { ...resolution, anchor: claimed }); return clone(claimed); }
  async saveAnchor(anchor: Rh4663AnchorRecord) {
    const resolution = this.resolutions.get(anchor.window_id); if (!resolution) throw new Rh4663ServiceError('resolution_not_found', 404);
    const current = resolution.anchor; const regressesBroadcast = ['submitted', 'confirmed'].includes(current.state) && ['not_submitted', 'submitting', 'failed'].includes(anchor.state); const authoritative = regressesBroadcast ? current : anchor;
    const next = { ...resolution, anchor: clone(authoritative) }; this.resolutions.set(anchor.window_id, next); return clone(authoritative);
  }
  async close() { /* no resources */ }
}

export class PostgresRh4663ResolutionStore implements Rh4663ResolutionStore {
  readonly adapter = 'postgres' as const; readonly durable = true;
  private readonly pool: pg.Pool; private readonly ownsPool: boolean;
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  private async ready() {
    const result = await this.pool.query<{ missing: string | null }>(`select string_agg(name, ',') as missing from unnest(array['rh_4663_pulse_window_resolutions','rh_4663_resolution_receipts','rh_4663_window_anchors']) name where to_regclass(name) is null`);
    if (result.rows[0]?.missing) throw new Rh4663ServiceError('phase2_migration_not_applied', 503);
  }
  async getResolution(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663WindowResolution }>('select payload from rh_4663_pulse_window_resolutions where window_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async saveResolution(value: Rh4663WindowResolution) {
    await this.ready(); const client = await this.pool.connect();
    try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-resolution:' || $1))", [value.window_id]);
      const prior = await client.query<{ payload: Rh4663WindowResolution }>('select payload from rh_4663_pulse_window_resolutions where window_id=$1', [value.window_id]);
      if (prior.rows[0]) { if (resolutionMaterialHash(prior.rows[0].payload) !== resolutionMaterialHash(value)) throw new Rh4663ServiceError('conflicting_resolution', 409); await client.query('commit'); return prior.rows[0].payload; }
      await client.query('insert into rh_4663_pulse_window_resolutions (window_id, state, resolved_at, payload) values ($1,$2,$3,$4::jsonb)', [value.window_id, value.state, value.resolved_at, JSON.stringify(value)]);
      await client.query('insert into rh_4663_window_anchors (window_id, state, transaction_hash, updated_at, payload) values ($1,$2,$3,$4,$5::jsonb)', [value.window_id, value.anchor.state, value.anchor.transaction_hash, value.resolved_at, JSON.stringify(value.anchor)]); await client.query('commit'); return value;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async publishResolution(windowId: string, receipts: Rh4663ResolutionReceipt[], publishedAt: string) {
    await this.ready(); const client = await this.pool.connect();
    try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-resolution:' || $1))", [windowId]);
      const result = await client.query<{ payload: Rh4663WindowResolution }>('select payload from rh_4663_pulse_window_resolutions where window_id=$1 for update', [windowId]); const prior = result.rows[0]?.payload; if (!prior) throw new Rh4663ServiceError('resolution_not_found', 404);
      for (const receipt of receipts) await client.query('insert into rh_4663_resolution_receipts (receipt_id, call_receipt_id, wallet, window_id, created_at, payload) values ($1,$2,$3,$4,$5,$6::jsonb) on conflict (call_receipt_id) do nothing', [receipt.receipt_id, receipt.call_receipt_id, receipt.wallet, receipt.window_id, receipt.created_at, JSON.stringify(receipt)]);
      const stored = await client.query<{ payload: Rh4663ResolutionReceipt }>('select payload from rh_4663_resolution_receipts where window_id=$1', [windowId]);
      const expected = new Map(receipts.map((item) => [item.call_receipt_id, item.payload_hash])); for (const row of stored.rows) if (expected.get(row.payload.call_receipt_id) !== row.payload.payload_hash) throw new Rh4663ServiceError('conflicting_resolution_receipt', 409);
      const published = prior.state === 'published' ? prior : { ...prior, state: 'published' as const, published_at: publishedAt };
      await client.query('update rh_4663_pulse_window_resolutions set state=$2, published_at=$3, payload=$4::jsonb where window_id=$1', [windowId, 'published', published.published_at, JSON.stringify(published)]); await client.query('commit'); return published;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async getReceipt(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663ResolutionReceipt }>('select payload from rh_4663_resolution_receipts where receipt_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async getReceiptForCall(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663ResolutionReceipt }>('select payload from rh_4663_resolution_receipts where call_receipt_id=$1', [id]); return result.rows[0]?.payload ?? null; }
  async listReceiptsByWallet(wallet: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663ResolutionReceipt }>('select payload from rh_4663_resolution_receipts where lower(wallet)=lower($1) order by window_id', [wallet]); return result.rows.map((row) => row.payload); }
  async claimAnchorSubmission(windowId: string, claimedAt: string) { await this.ready(); const client = await this.pool.connect(); try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-anchor:' || $1))", [windowId]); const row = await client.query<{ payload: Rh4663AnchorRecord }>('select payload from rh_4663_window_anchors where window_id=$1 for update', [windowId]); const anchor = row.rows[0]?.payload; if (!anchor) { await client.query('rollback'); return null; } const staleClaim = anchor.state === 'submitting' && anchor.submitted_at && Date.parse(claimedAt) - Date.parse(anchor.submitted_at) >= 5 * 60_000; if (!['not_submitted', 'failed'].includes(anchor.state) && !staleClaim) { await client.query('rollback'); return null; } const claimed = { ...anchor, state: 'submitting' as const, submitted_at: claimedAt, failed_at: null, failure_code: null }; await client.query('update rh_4663_window_anchors set state=$2, updated_at=$3, payload=$4::jsonb where window_id=$1', [windowId, claimed.state, claimedAt, JSON.stringify(claimed)]); const resolution = await client.query<{ payload: Rh4663WindowResolution }>('select payload from rh_4663_pulse_window_resolutions where window_id=$1 for update', [windowId]); if (resolution.rows[0]) await client.query('update rh_4663_pulse_window_resolutions set payload=$2::jsonb where window_id=$1', [windowId, JSON.stringify({ ...resolution.rows[0].payload, anchor: claimed })]); await client.query('commit'); return claimed; } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); } }
  async saveAnchor(anchor: Rh4663AnchorRecord) {
    await this.ready(); const client = await this.pool.connect();
    try {
      await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-anchor:' || $1))", [anchor.window_id]);
      const stored = await client.query<{ payload: Rh4663AnchorRecord }>('select payload from rh_4663_window_anchors where window_id=$1 for update', [anchor.window_id]);
      const current = stored.rows[0]?.payload; if (!current) throw new Rh4663ServiceError('anchor_not_found', 404);
      const regressesBroadcast = ['submitted', 'confirmed'].includes(current.state) && ['not_submitted', 'submitting', 'failed'].includes(anchor.state);
      const authoritative = current.state === 'confirmed' || regressesBroadcast ? current : anchor;
      if (authoritative === anchor) await client.query('update rh_4663_window_anchors set state=$2, transaction_hash=$3, updated_at=now(), payload=$4::jsonb where window_id=$1', [anchor.window_id, anchor.state, anchor.transaction_hash, JSON.stringify(anchor)]);
      const resolution = await client.query<{ payload: Rh4663WindowResolution }>('select payload from rh_4663_pulse_window_resolutions where window_id=$1 for update', [anchor.window_id]);
      if (resolution.rows[0] && resolution.rows[0].payload.anchor !== authoritative) await client.query('update rh_4663_pulse_window_resolutions set payload=$2::jsonb where window_id=$1', [anchor.window_id, JSON.stringify({ ...resolution.rows[0].payload, anchor: authoritative })]);
      await client.query('commit'); return authoritative;
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async close() { if (this.ownsPool) await this.pool.end(); }
}

export class Rh4663ResolutionService {
  private readonly counters = new Map<string, number>();
  constructor(
    readonly phase1: Rh4663Store,
    readonly store: Rh4663ResolutionStore,
    private readonly signer: Rh4663ResolutionSigner = new UnavailableRh4663ResolutionSigner(),
    private readonly anchor: Rh4663AnchorAdapter = new DisabledRh4663AnchorAdapter(),
    private readonly now: () => Date = () => new Date(),
    private readonly log: (entry: Record<string, unknown>) => void = (entry) => console.log(JSON.stringify(entry))
  ) {}

  metrics() { return Object.fromEntries(this.counters); }

  async window(windowId: string) {
    const window = parseWindow(windowId); const calls = await this.phase1.listCalls(windowId, 100_000); const resolution = await this.store.getResolution(windowId);
    const consensus = consensusWithPercentages(calls, windowId);
    const state: Rh4663WindowState = resolution?.state ?? (this.now().getTime() < Date.parse(window.closes_at) ? 'open' : 'closed');
    return { window, state, consensus, acceptance: resolution?.acceptance ?? null, anchor: resolution?.anchor ?? null, resolution: resolution?.state === 'published' ? resolution : null, storage: { adapter: this.store.adapter, durable: this.store.durable } };
  }

  async publicResolution(windowId: string) { const value = await this.store.getResolution(windowId); if (!value || value.state !== 'published') throw new Rh4663ServiceError('published_resolution_not_found', 404); return value; }

  async resolve(windowId: string) {
    const window = parseWindow(windowId); if (this.now().getTime() < Date.parse(window.closes_at)) throw new Rh4663ServiceError('cannot_resolve_open_window', 409);
    const prior = await this.store.getResolution(windowId); if (prior) return prior;
    this.emit('resolution_started', { window_id: windowId });
    try {
      const [calls, allEvents] = await Promise.all([this.phase1.listCalls(windowId, 100_000), this.phase1.listEvents(100_000)]);
      const acceptance = buildRh4663AcceptanceCommitment(calls, this.now().toISOString(), windowId);
      this.emit('window_closed', { window_id: windowId, receipt_count: calls.length }); this.emit('window_root_created', { window_id: windowId, acceptance_root: acceptance.root, receipt_count: calls.length });
      const calculated = calculateResolution(window, allEvents);
      const anchor = initialAnchor(acceptance);
      const resolution: Rh4663WindowResolution = { version: RH_4663_RESOLUTION_VERSION, window_id: windowId, state: 'resolved', pulse_window: window,
        observation_window: { opens_at: window.opens_at, closes_at: window.closes_at, closes_at_exclusive: true }, ...calculated,
        dependencies: RH_4663_RESOLUTION_DEPENDENCIES, acceptance, anchor, consensus: consensusWithPercentages(calls, windowId), resolved_at: this.now().toISOString(), published_at: null, immutable_after_publication: true };
      const saved = await this.store.saveResolution(resolution); this.emit('resolution_completed', { window_id: windowId, resolved_category: saved.resolved_category, observation_count: saved.observations.length }); return saved;
    } catch (error) { this.emit('resolution_failed', { window_id: windowId, error_code: operationalCode(error) }); throw error; }
  }

  async publish(windowId: string) {
    const resolution = await this.store.getResolution(windowId); if (!resolution) throw new Rh4663ServiceError('resolution_not_ready', 409);
    const calls = await this.phase1.listCalls(windowId, 100_000);
    let receipts = await Promise.all(calls.map(async (call) => (await this.store.getReceiptForCall(call.receipt_id)) ?? this.buildReceipt(call, resolution)));
    const publishedAt = resolution.published_at ?? this.now().toISOString(); const published = await this.store.publishResolution(windowId, receipts, publishedAt);
    this.emit('resolution_receipts_created', { window_id: windowId, receipt_count: receipts.length }); this.emit('resolution_published', { window_id: windowId, receipt_count: receipts.length });
    const anchored = await this.progressAnchor(published.anchor).catch((error) => { this.emit('anchor_failed', { window_id: windowId, error_code: operationalCode(error) }); return published.anchor; });
    if (anchored.state !== 'submitting' && (anchored.state !== published.anchor.state || anchored.transaction_hash !== published.anchor.transaction_hash)) await this.store.saveAnchor(anchored);
    receipts = await Promise.all(calls.map(async (call) => (await this.store.getReceiptForCall(call.receipt_id))!));
    const authoritativeAnchor = (await this.store.getResolution(windowId))?.anchor ?? anchored;
    return { resolution: { ...published, anchor: authoritativeAnchor }, receipts, anchor: authoritativeAnchor };
  }

  async receipt(receiptId: string) { const resolution = await this.store.getReceipt(receiptId); if (resolution) return resolution; const call = await this.phase1.getCall(receiptId); if (call) return call; throw new Rh4663ServiceError('protocol_receipt_not_found', 404); }

  async proof(callReceiptId: string): Promise<Rh4663MerkleProof> {
    const call = await this.phase1.getCall(callReceiptId); if (!call) throw new Rh4663ServiceError('call_receipt_not_found', 404);
    const resolution = await this.store.getResolution(call.window_id); if (!resolution) throw new Rh4663ServiceError('acceptance_commitment_not_found', 404);
    const calls = await this.phase1.listCalls(call.window_id, 100_000); const tree = buildRh4663MerkleTree(calls); const ordered = orderedUniqueCalls(calls); const index = ordered.findIndex((item) => item.receipt_id === callReceiptId); if (index < 0) throw new Rh4663ServiceError('receipt_not_in_acceptance_set', 409);
    const proof = merkleProof(tree.levels, index); const verified = verifyRh4663MerkleProof(call.payload_hash, proof, tree.root);
    return { version: RH_4663_MERKLE_VERSION, receipt_id: callReceiptId, call_receipt_hash: call.payload_hash, leaf_hash: merkleLeaf(call.payload_hash), leaf_index: index, receipt_count: ordered.length, acceptance_root: tree.root, proof, verified, anchor: resolution.anchor };
  }

  async reputation(wallet: string) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Rh4663ServiceError('valid_evm_wallet_required', 400);
    const calls = await this.phase1.listCallsByWallet(wallet, 10_000); const receipts = await this.store.listReceiptsByWallet(wallet);
    const byCall = new Map(receipts.map((item) => [item.call_receipt_id, item]));
    const evidence = calls.sort((a, b) => a.canonical_payload.window_opens_at.localeCompare(b.canonical_payload.window_opens_at)).map((call) => ({ window_id: call.window_id, call_receipt_id: call.receipt_id, resolution_receipt_id: byCall.get(call.receipt_id)?.receipt_id ?? null, called_category: call.rotation, resolved_category: byCall.get(call.receipt_id)?.resolved_category ?? null, outcome: byCall.get(call.receipt_id)?.outcome ?? 'UNRESOLVED', confidence: call.confidence, call_created_at: call.created_at, genesis_ordinal: call.genesis_ordinal }));
    let streak = 0; for (const item of evidence) { if (item.outcome === 'CORRECT') streak += 1; else if (item.outcome === 'INCORRECT') streak = 0; }
    const resolved = evidence.filter((item) => item.outcome !== 'UNRESOLVED'); const correct = resolved.filter((item) => item.outcome === 'CORRECT'); const genesis = calls.find((item) => item.genesis_ordinal !== null)?.genesis_ordinal ?? null;
    return { wallet: wallet.toLowerCase(), calls: calls.length, resolved_calls: resolved.length, correct_calls: correct.length, accuracy: resolved.length ? Number((correct.length / resolved.length).toFixed(4)) : null, current_streak: streak, genesis_position: genesis, first_call_date: evidence[0]?.window_id.slice(-10) ?? null, last_call_date: evidence.at(-1)?.window_id.slice(-10) ?? null, definitions: { accuracy: 'correct_calls / resolved_calls; unresolved calls are excluded', current_streak: 'consecutive correctly resolved calls ordered by Pulse window; unresolved calls do not break the streak; an incorrect result resets it' }, evidence: evidence.reverse() };
  }

  /**
   * Builds the public-safe identity surface from immutable CALL receipts and
   * published RESOLUTION receipts. This is deliberately a read model: it
   * never writes, scores, rewards, or changes either protocol receipt.
   */
  async proofProfile(wallet: string): Promise<Rh4663ProofProfile> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Rh4663ServiceError('valid_evm_wallet_required', 400);
    const calls = [...await this.phase1.listCallsByWallet(wallet, 10_000)].sort((a, b) => a.canonical_payload.window_opens_at.localeCompare(b.canonical_payload.window_opens_at) || a.receipt_id.localeCompare(b.receipt_id));
    const resolutions = await this.store.listReceiptsByWallet(wallet);
    const byCall = new Map(resolutions.map((receipt) => [receipt.call_receipt_id, receipt]));
    const records = calls.map((call) => {
      const resolution = byCall.get(call.receipt_id) ?? null;
      const callReceiptUrl = `/4663/proof/${encodeURIComponent(call.receipt_id)}`;
      const resolutionReceiptUrl = resolution ? `/4663/resolution/${encodeURIComponent(resolution.receipt_id)}` : null;
      return {
        call,
        resolution,
        outcome: resolution?.outcome ?? 'UNRESOLVED' as const,
        links: { receipt_id: call.receipt_id, receipt_url: callReceiptUrl, resolution_receipt_id: resolution?.receipt_id ?? null, resolution_receipt_url: resolutionReceiptUrl }
      };
    });
    const resolved = records.filter((record) => record.resolution);
    const correct = resolved.filter((record) => record.outcome === 'CORRECT');
    const incorrect = resolved.filter((record) => record.outcome === 'INCORRECT');
    const unresolved = records.filter((record) => !record.resolution);
    const accuracy = ratio(correct.length, resolved.length);
    const highConfidence = records.filter((record) => record.call.confidence >= RH_4663_HIGH_CONFIDENCE_THRESHOLD);
    const highConfidenceResolved = highConfidence.filter((record) => record.resolution);
    const highConfidenceCorrect = highConfidenceResolved.filter((record) => record.outcome === 'CORRECT');
    const categories = Object.fromEntries(rotationOrder.map((category) => {
      const categoryRecords = records.filter((record) => record.call.rotation === category);
      const categoryResolved = categoryRecords.filter((record) => record.resolution);
      const categoryCorrect = categoryResolved.filter((record) => record.outcome === 'CORRECT');
      return [category, {
        calls: categoryRecords.length,
        resolved: categoryResolved.length,
        correct: categoryCorrect.length,
        incorrect: categoryResolved.length - categoryCorrect.length,
        unresolved: categoryRecords.length - categoryResolved.length,
        accuracy: ratio(categoryCorrect.length, categoryResolved.length),
        sample_status: categoryResolved.length >= RH_4663_PROOF_CATEGORY_MIN_RESOLVED ? 'MEANINGFUL' as const : 'INSUFFICIENT_SAMPLE' as const,
        receipt_links: categoryRecords.map((record) => record.links)
      }];
    })) as Record<Rh4663RotationOption, Rh4663ProofCategory>;
    const supported = rotationOrder.map((category) => ({ category, data: categories[category] })).filter((item) => item.data.sample_status === 'MEANINGFUL');
    supported.sort((left, right) => right.data.resolved - left.data.resolved || (right.data.accuracy ?? 0) - (left.data.accuracy ?? 0) || rotationOrder.indexOf(left.category) - rotationOrder.indexOf(right.category));
    const bestSupportedCategory = supported[0] ? { category: supported[0].category, accuracy: supported[0].data.accuracy ?? 0, resolved: supported[0].data.resolved, receipt_links: supported[0].data.receipt_links } : { category: null, accuracy: null, resolved: 0 as const, status: 'INSUFFICIENT_SAMPLE' as const };
    let currentCorrect = 0;
    for (const record of records) { if (record.outcome === 'CORRECT') currentCorrect += 1; else if (record.outcome === 'INCORRECT') currentCorrect = 0; }
    const links = records.map((record) => record.links);
    const genesisRecord = [...records].sort((left, right) => (left.call.genesis_ordinal ?? Number.MAX_SAFE_INTEGER) - (right.call.genesis_ordinal ?? Number.MAX_SAFE_INTEGER))[0];
    const genesis = genesisRecord?.call.genesis_ordinal ? { ordinal: genesisRecord.call.genesis_ordinal, call_receipt_id: genesisRecord.call.receipt_id, receipt_url: genesisRecord.links.receipt_url } : null;
    const recentCalls = records.slice(-10).reverse().map((record) => ({ window_id: record.call.window_id, call_receipt_id: record.call.receipt_id, call_receipt_url: record.links.receipt_url, resolution_receipt_id: record.links.resolution_receipt_id, resolution_receipt_url: record.links.resolution_receipt_url, called_category: record.call.rotation, resolved_category: record.resolution?.resolved_category ?? null, confidence: record.call.confidence, submitted_at: record.call.created_at, outcome: record.outcome }));
    return {
      object_type: 'PROOF_PROFILE', profile_version: RH_4663_PROOF_PROFILE_VERSION, wallet: wallet.toLowerCase() as `0x${string}`, display_name: shortProofWallet(wallet),
      calls: records.length, resolved: resolved.length, correct: correct.length, incorrect: incorrect.length, unresolved: unresolved.length, accuracy,
      high_confidence_accuracy: ratio(highConfidenceCorrect.length, highConfidenceResolved.length),
      high_confidence: { threshold: RH_4663_HIGH_CONFIDENCE_THRESHOLD, resolved: highConfidenceResolved.length, correct: highConfidenceCorrect.length, incorrect: highConfidenceResolved.length - highConfidenceCorrect.length, unresolved: highConfidence.length - highConfidenceResolved.length, accuracy: ratio(highConfidenceCorrect.length, highConfidenceResolved.length), methodology_version: RH_4663_PROOF_PROFILE_VERSION, receipt_links: highConfidence.map((record) => record.links) },
      category_breakdown: categories, best_supported_category: bestSupportedCategory, genesis, genesis_receipt: genesis, recent_calls: recentCalls,
      streak: { current_correct: currentCorrect, methodology_version: RH_4663_PROOF_PROFILE_VERSION },
      methodology: { accuracy: 'correct / resolved; unresolved calls are excluded', high_confidence_threshold: RH_4663_HIGH_CONFIDENCE_THRESHOLD, category_min_resolved: RH_4663_PROOF_CATEGORY_MIN_RESOLVED, version: RH_4663_PROOF_PROFILE_VERSION },
      receipt_links: links
    };
  }

  async share(callReceiptId: string) {
    const call = await this.phase1.getCall(callReceiptId); if (!call) throw new Rh4663ServiceError('call_receipt_not_found', 404); const receipt = await this.store.getReceiptForCall(callReceiptId); const reputation = await this.reputation(call.wallet);
    const object_type: 'pending_call' | 'resolved_correct_call' | 'resolved_incorrect_call' = receipt ? (receipt.outcome === 'CORRECT' ? 'resolved_correct_call' : 'resolved_incorrect_call') : 'pending_call';
    return { object_version: 'infopunks.rh-pulse.share.v1', object_type, call: { receipt_id: call.receipt_id, rotation: call.rotation, confidence: call.confidence, window_id: call.window_id }, resolution: receipt ? { receipt_id: receipt.receipt_id, resolved_category: receipt.resolved_category, outcome: receipt.outcome } : null, genesis_position: call.genesis_ordinal, record: { correct: reputation.correct_calls, resolved: reputation.resolved_calls }, proof_url: `/4663/proof/${encodeURIComponent(call.receipt_id)}`, call_receipt_url: `/v1/4663/receipts/${encodeURIComponent(call.receipt_id)}`, resolution_receipt_url: receipt ? `/v1/4663/receipts/${encodeURIComponent(receipt.receipt_id)}` : null, inclusion_proof_url: `/v1/4663/pulse/receipts/${encodeURIComponent(call.receipt_id)}/proof`, images: { landscape: `/og/4663/pulse/${encodeURIComponent(call.receipt_id)}.png`, square: `/og/4663/pulse/${encodeURIComponent(call.receipt_id)}.png?format=square`, portrait: `/og/4663/pulse/${encodeURIComponent(call.receipt_id)}.png?format=portrait` }, verified_property: receipt ? 'The linked canonical CALL and RESOLUTION receipts are published by Infopunks.' : 'The linked canonical CALL receipt is stored by Infopunks.' };
  }

  async windowShare(windowId: string) {
    const view = await this.window(windowId); const resolution = view.resolution; const category = resolution?.resolved_category ?? view.consensus.leading_rotation;
    return { object_version: 'infopunks.rh-pulse.share.v1', object_type: resolution ? 'window_result' as const : 'window_consensus' as const, window_id: windowId, total_calls: view.consensus.total_calls, consensus_category: view.consensus.leading_rotation, consensus_percentage: view.consensus.leading_rotation ? view.consensus.percentages[view.consensus.leading_rotation] : 0, resolved_category: resolution?.resolved_category ?? null, consensus_correct: resolution ? view.consensus.leading_rotation === resolution.resolved_category : null, primary_category: category, proof_url: resolution ? `/v1/4663/pulse/windows/${encodeURIComponent(windowId)}/resolution` : `/v1/4663/pulse/windows/${encodeURIComponent(windowId)}`, images: { landscape: `/og/4663/pulse/window/${encodeURIComponent(windowId)}.png`, square: `/og/4663/pulse/window/${encodeURIComponent(windowId)}.png?format=square`, portrait: `/og/4663/pulse/window/${encodeURIComponent(windowId)}.png?format=portrait` }, verified_property: resolution ? 'The linked deterministic window resolution is published by Infopunks.' : 'The linked participant consensus is reconstructed from accepted CALL receipts.' };
  }

  async todayPulse(date: string) {
    const windowId = `rh4663:${date}`; const calls = await this.phase1.listCalls(windowId, 100_000); const consensus = consensusWithPercentages(calls, windowId);
    const priorDate = new Date(`${date}T00:00:00.000Z`); priorDate.setUTCDate(priorDate.getUTCDate() - 1); const priorId = `rh4663:${priorDate.toISOString().slice(0, 10)}`; const priorCalls = await this.phase1.listCalls(priorId, 100_000); const priorConsensus = consensusWithPercentages(priorCalls, priorId); const priorResolution = await this.store.getResolution(priorId);
    return { current: consensus, prior: { consensus: priorConsensus, resolution: priorResolution?.state === 'published' ? { window_id: priorId, resolved_category: priorResolution.resolved_category, consensus_correct: priorConsensus.leading_rotation === priorResolution.resolved_category, resolution_path: `/v1/4663/pulse/windows/${encodeURIComponent(priorId)}/resolution` } : null }, precision_notice: consensus.total_calls < 10 ? 'Small sample. Counts are authoritative; percentages are descriptive.' : null };
  }

  private async buildReceipt(call: Rh4663CallReceipt, resolution: Rh4663WindowResolution): Promise<Rh4663ResolutionReceipt> {
    const signerAddress = await this.signer.address(); if (!this.signer.available || !signerAddress) throw new Rh4663ServiceError('resolution_signer_not_configured', 503);
    const outcome: 'CORRECT' | 'INCORRECT' = call.rotation === resolution.resolved_category ? 'CORRECT' : 'INCORRECT';
    const payload = { version: RH_4663_RESOLUTION_VERSION, call_receipt_id: call.receipt_id, call_receipt_hash: call.payload_hash, pulse_window_id: call.window_id, observation_window: resolution.observation_window, resolved_category: resolution.resolved_category, called_category: call.rotation, outcome, confidence: call.confidence, dependencies: resolution.dependencies, acceptance_root: resolution.acceptance.root, resolved_at: resolution.resolved_at, publication_state: 'published', resolution_signer: signerAddress, signer_key_id: this.signer.keyId };
    const canonical_serialization = serializeRh4663Canonical(payload); const payload_hash = hashRh4663Canonical(canonical_serialization); const signature = await this.signer.sign(canonical_serialization); const { recoverMessageAddress } = await import('viem'); const recovered = await recoverMessageAddress({ message: canonical_serialization, signature }); if (recovered.toLowerCase() !== signerAddress) throw new Rh4663ServiceError('resolution_signature_verification_failed', 500);
    return { receipt_id: `IP-RES-${payload_hash.slice(2, 14).toUpperCase()}`, receipt_kind: 'PROTOCOL_RECEIPT', protocol_receipt_type: 'RESOLUTION', immutable: true, created_at: this.now().toISOString(), wallet: call.wallet, window_id: call.window_id, call_receipt_id: call.receipt_id, call_receipt_hash: call.payload_hash, called_category: call.rotation, resolved_category: resolution.resolved_category, outcome: payload.outcome, confidence: call.confidence, observation_window: resolution.observation_window, dependencies: resolution.dependencies, acceptance_root: resolution.acceptance.root, canonical_payload: payload, canonical_serialization, payload_hash, signature, signature_verified: true, resolution_signer: signerAddress, signer_key_id: this.signer.keyId, publication_state: 'published', resolved_at: resolution.resolved_at };
  }

  private async progressAnchor(current: Rh4663AnchorRecord) {
    if (!this.anchor.available) return current;
    if (current.state === 'submitted' && current.transaction_hash) {
      const status = await this.anchor.confirmation(current.transaction_hash); if (status.state === 'submitted') return current;
      if (status.state === 'failed') { const failed = { ...current, state: 'failed' as const, failed_at: this.now().toISOString(), failure_code: status.failure_code ?? 'anchor_transaction_failed' }; this.emit('anchor_failed', { window_id: current.window_id, transaction_hash: current.transaction_hash, failure_code: failed.failure_code }); return failed; }
      const confirmed = { ...current, state: 'confirmed' as const, block_number: status.block_number ?? null, block_hash: status.block_hash ?? null, confirmed_at: this.now().toISOString(), failure_code: null, failed_at: null }; this.emit('anchor_confirmed', { window_id: current.window_id, transaction_hash: current.transaction_hash, block_number: confirmed.block_number }); return confirmed;
    }
    if (current.state === 'confirmed') return current;
    const claimed = await this.store.claimAnchorSubmission(current.window_id, this.now().toISOString()); if (!claimed) return (await this.store.getResolution(current.window_id))?.anchor ?? current;
    try {
      const submitted = await this.anchor.submit({ version: RH_4663_MERKLE_VERSION, window_id: claimed.window_id, root: claimed.acceptance_root, receipt_count: claimed.receipt_count, leaf_rule: 'sha256(domain || lowercase_call_payload_hash)', ordering: 'call_payload_hash_ascending', duplicate_rule: 'reject_duplicate_call_payload_hash', odd_node_rule: 'duplicate_last', internal_node_rule: 'sha256(domain || left || right)', created_at: claimed.commitment_timestamp });
      const next = { ...claimed, state: 'submitted' as const, transaction_hash: submitted.transaction_hash, submitted_at: this.now().toISOString(), failed_at: null, failure_code: null }; this.emit('anchor_submitted', { window_id: current.window_id, transaction_hash: next.transaction_hash }); return next;
    } catch (error) {
      const failed = { ...claimed, state: 'failed' as const, failed_at: this.now().toISOString(), failure_code: operationalCode(error) }; await this.store.saveAnchor(failed); this.emit('anchor_failed', { window_id: current.window_id, failure_code: failed.failure_code }); return failed;
    }
  }

  private emit(event: string, fields: Record<string, unknown>) { this.counters.set(event, (this.counters.get(event) ?? 0) + 1); this.log({ event, service: 'rh_4663_resolution', ...fields }); }
}

export function calculateResolution(window: Rh4663PulseWindow, events: Rh4663NormalizedEvent[]) {
  const within = events.filter((event) => event.detected_at >= window.opens_at && event.detected_at < window.closes_at && event.publication_state === 'public' && event.lifecycle_state === 'confirmed' && !sourceManifest.excluded_event_type_prefixes.some((prefix) => event.type.startsWith(prefix)));
  const eligible = within.filter((event) => event.category in categoryRules.mapping);
  const primary = eligible.filter((event) => sourceManifest.primary_source_statuses.includes(event.source_status as 'fresh'));
  const fallback = primary.length ? [] : eligible.filter((event) => sourceManifest.fallback.source_statuses.includes(event.source_status as 'stale'));
  const selected = (primary.length ? primary : fallback).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.event_id.localeCompare(b.event_id));
  const observations: Rh4663ResolutionObservation[] = selected.map((event) => { const resolved_rotation = categoryRules.mapping[event.category as keyof typeof categoryRules.mapping]; const material = { event_id: event.event_id, detected_at: event.detected_at, category: event.category, resolved_rotation, significance_score: event.significance_score, source_confidence: event.source_confidence, source_status: event.source_status }; return { ...material, observation_hash: hashObject(material) }; });
  const category_scores = Object.fromEntries(rotationOrder.map((option) => [option, { observation_count: 0, significance_total: 0, qualified: option === 'NO_QUALIFIED_ROTATION' }])) as Rh4663WindowResolution['category_scores'];
  for (const observation of observations) { const score = category_scores[observation.resolved_rotation]; score.observation_count += 1; score.significance_total += observation.significance_score; }
  for (const option of rotationOrder.filter((item) => item !== 'NO_QUALIFIED_ROTATION')) { const score = category_scores[option]; score.qualified = score.observation_count >= thresholds.minimum_qualified_observations_per_category && score.significance_total >= thresholds.minimum_category_significance_total; }
  const qualified = rotationOrder.filter((option) => option !== 'NO_QUALIFIED_ROTATION' && category_scores[option].qualified); const bestScore = qualified.length ? Math.max(...qualified.map((option) => category_scores[option].significance_total)) : -1; const tied = qualified.filter((option) => category_scores[option].significance_total === bestScore); const resolved_category = tied[0] ?? 'NO_QUALIFIED_ROTATION';
  return { resolved_category, category_scores, determination: { method: 'highest_qualified_significance_total' as const, tie: tied.length > 1, tied_categories: tied, tie_break_reason: tied.length > 1 ? 'phase1_option_order_v1' as const : 'not_required' as const, fallback_used: fallback.length > 0, no_qualified_reason: resolved_category === 'NO_QUALIFIED_ROTATION' ? (eligible.length ? 'no_category_met_frozen_thresholds' : 'no_accepted_observations') : null }, observations, observation_set_hash: hashObject(observations.map((item) => item.observation_hash)), provider_state: { accepted: observations.length, fresh: within.filter((item) => item.source_status === 'fresh').length, stale: within.filter((item) => item.source_status === 'stale').length, degraded: within.filter((item) => item.source_status === 'degraded').length, unavailable: within.filter((item) => item.source_status === 'unavailable').length, rejected: within.length - observations.length } };
}

export function buildRh4663AcceptanceCommitment(calls: Rh4663CallReceipt[], createdAt: string, windowId = calls[0]?.window_id ?? 'empty') { const tree = buildRh4663MerkleTree(calls); return { version: RH_4663_MERKLE_VERSION, window_id: windowId, root: tree.root, receipt_count: calls.length, leaf_rule: 'sha256(domain || lowercase_call_payload_hash)' as const, ordering: 'call_payload_hash_ascending' as const, duplicate_rule: 'reject_duplicate_call_payload_hash' as const, odd_node_rule: 'duplicate_last' as const, internal_node_rule: 'sha256(domain || left || right)' as const, created_at: createdAt }; }

export function buildRh4663MerkleTree(calls: Rh4663CallReceipt[]) {
  const ordered = orderedUniqueCalls(calls); let level = ordered.map((call) => merkleLeaf(call.payload_hash)); if (!level.length) level = [hashRh4663Canonical(`${RH_4663_MERKLE_VERSION}:empty`)]; const levels: Hex[][] = [level];
  while (level.length > 1) { const next: Hex[] = []; for (let index = 0; index < level.length; index += 2) next.push(merkleNode(level[index], level[index + 1] ?? level[index])); level = next; levels.push(level); }
  return { root: level[0], levels, ordered_receipt_ids: ordered.map((item) => item.receipt_id) };
}

export function verifyRh4663MerkleProof(callHash: Hex, proof: Rh4663MerkleProof['proof'], expectedRoot: Hex) { let current = merkleLeaf(callHash); for (const item of proof) current = item.position === 'left' ? merkleNode(item.hash, current) : merkleNode(current, item.hash); return current === expectedRoot; }

function orderedUniqueCalls(calls: Rh4663CallReceipt[]) { const sorted = [...calls].sort((a, b) => a.payload_hash.localeCompare(b.payload_hash) || a.receipt_id.localeCompare(b.receipt_id)); for (let index = 1; index < sorted.length; index += 1) if (sorted[index - 1].payload_hash.toLowerCase() === sorted[index].payload_hash.toLowerCase()) throw new Rh4663ServiceError('duplicate_call_payload_hash', 409); return sorted; }
function merkleLeaf(hash: Hex): Hex { return hashRh4663Canonical(`${RH_4663_MERKLE_VERSION}:leaf:${hash.toLowerCase()}`); }
function merkleNode(left: Hex, right: Hex): Hex { return hashRh4663Canonical(`${RH_4663_MERKLE_VERSION}:node:${left.toLowerCase()}:${right.toLowerCase()}`); }
function merkleProof(levels: Hex[][], leafIndex: number) { const proof: Rh4663MerkleProof['proof'] = []; let index = leafIndex; for (let depth = 0; depth < levels.length - 1; depth += 1) { const level = levels[depth]; const siblingIndex = index % 2 ? index - 1 : index + 1; proof.push({ hash: level[siblingIndex] ?? level[index], position: index % 2 ? 'left' : 'right' }); index = Math.floor(index / 2); } return proof; }
function initialAnchor(commitment: Rh4663AcceptanceCommitment): Rh4663AnchorRecord { return { version: RH_4663_ANCHOR_VERSION, chain_id: RH_4663_CHAIN_ID, window_id: commitment.window_id, acceptance_root: commitment.root, receipt_count: commitment.receipt_count, commitment_timestamp: commitment.created_at, state: 'not_submitted', transaction_hash: null, block_number: null, block_hash: null, submitted_at: null, confirmed_at: null, failed_at: null, failure_code: null }; }
function parseWindow(windowId: string) { const match = /^rh4663:(\d{4}-\d{2}-\d{2})$/.exec(windowId); if (!match) throw new Rh4663ServiceError('invalid_pulse_window_id', 400); const date = new Date(`${match[1]}T12:00:00.000Z`); if (Number.isNaN(date.getTime()) || getRh4663PulseWindow(date).window_id !== windowId) throw new Rh4663ServiceError('invalid_pulse_window_id', 400); return getRh4663PulseWindow(date); }
function consensusWithPercentages(calls: Rh4663CallReceipt[], windowId: string) { const consensus = resolveRh4663Consensus(calls, windowId); const max = Math.max(...Object.values(consensus.counts)); const tied = consensus.total_calls ? rotationOrder.filter((item) => consensus.counts[item] === max) : []; return { ...consensus, percentages: Object.fromEntries(rotationOrder.map((option) => [option, consensus.total_calls ? Number((consensus.counts[option] / consensus.total_calls * 100).toFixed(1)) : 0])) as Record<Rh4663RotationOption, number>, tie_break_reason: tied.length > 1 ? 'option_order_v1' as const : 'not_required' as const }; }
function ratio(numerator: number, denominator: number) { return denominator ? Number((numerator / denominator).toFixed(4)) : null; }
function shortProofWallet(wallet: string) { return `${wallet.slice(0, 8)}…${wallet.slice(-6)}`; }
function resolutionMaterialHash(value: Rh4663WindowResolution) { return hashObject({ version: value.version, window_id: value.window_id, resolved_category: value.resolved_category, category_scores: value.category_scores, determination: value.determination, observations: value.observations, observation_set_hash: value.observation_set_hash, dependencies: value.dependencies, acceptance: value.acceptance }); }
function hashObject(value: unknown): Hex { return hashRh4663Canonical(serializeRh4663Canonical(value)); }
function clone<T>(value: T): T { return value === null || value === undefined ? value : structuredClone(value); }
function operationalCode(error: unknown) { return error instanceof Rh4663ServiceError ? error.code : error instanceof Error ? error.name : 'unknown_error'; }
