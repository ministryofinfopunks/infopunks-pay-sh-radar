import { z } from 'zod';
import { AtomicAmountSchema, EngineId, EconomicEvidenceFactsSchema, type EconomicCandidate, type EconomicPolicy } from '../schemas/economicEngine';
import { ReceiptHashSchema, ReceiptTimeSchema } from '../schemas/receipts/common';
import { hashCanonical } from '../services/receiptIntegrityService';

type JsonRpc = (method: string, params: unknown[]) => Promise<unknown>;
const accountKey = z.union([z.string(), z.object({ pubkey: z.string(), signer: z.boolean(), writable: z.boolean() }).passthrough()]);
const TokenBalanceSchema = z.object({ accountIndex: z.number().int().nonnegative(), mint: z.string(), owner: z.string().optional(),
  uiTokenAmount: z.object({ amount: AtomicAmountSchema, decimals: z.number().int().min(0).max(18) }).passthrough() }).passthrough();
const SolanaTransactionSchema = z.object({ slot: z.number().int().nonnegative().safe(), blockTime: z.number().int().nonnegative().safe(),
  transaction: z.object({ signatures: z.array(z.string()), message: z.object({ accountKeys: z.array(accountKey),
    instructions: z.array(z.object({ programId: z.string() }).passthrough()) }).passthrough() }).passthrough(),
  meta: z.object({ err: z.null(), fee: z.number().int().nonnegative().safe(),
    preBalances: z.array(z.number().int().nonnegative().safe()), postBalances: z.array(z.number().int().nonnegative().safe()),
    preTokenBalances: z.array(TokenBalanceSchema), postTokenBalances: z.array(TokenBalanceSchema) }).passthrough()
}).passthrough();

/** Polling adapter for finalized Solana telemetry. RPC trust remains explicit;
 * transaction telemetry does not establish DEX liquidity or authorize spend.
 */
export function createSolanaEconomicTelemetryAdapter(config: { rpc: JsonRpc; expectedGenesisHash: string; now?: () => Date; maxAgeMs: number }) {
  const now = config.now ?? (() => new Date());
  return {
    async observe(signature: string, expectedPrograms: string[], expectedAccountOwners: Record<string, string>) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) || !expectedPrograms.length || !Object.keys(expectedAccountOwners).length) return { status: 'unproven' as const, reason: 'solana_exact_identifiers_required' };
      try {
        const genesis = await config.rpc('getGenesisHash', []);
        if (genesis !== config.expectedGenesisHash) return { status: 'unproven' as const, reason: 'solana_network_mismatch' };
        const statuses = z.object({ value: z.array(z.object({ err: z.null(), slot: z.number().int().safe(), confirmationStatus: z.literal('finalized') }).passthrough().nullable()) }).passthrough()
          .safeParse(await config.rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]));
        const parsed = SolanaTransactionSchema.safeParse(await config.rpc('getTransaction', [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]));
        if (!parsed.success || !statuses.success || statuses.data.value.length !== 1 || !statuses.data.value[0]) return { status: 'unproven' as const, reason: 'solana_finalized_transaction_required' };
        const tx = parsed.data, status = statuses.data.value[0];
        if (tx.transaction.signatures[0] !== signature || tx.slot !== status.slot) return { status: 'unproven' as const, reason: 'solana_transaction_binding_invalid' };
        const age = now().getTime() - tx.blockTime * 1000;
        if (age < 0 || age >= config.maxAgeMs) return { status: 'unproven' as const, reason: 'solana_transaction_stale' };
        const keys = tx.transaction.message.accountKeys.map(k => typeof k === 'string' ? k : k.pubkey);
        if (tx.meta.preBalances.length !== keys.length || tx.meta.postBalances.length !== keys.length
          || expectedPrograms.some(p => !tx.transaction.message.instructions.some(i => i.programId === p))
          || Object.keys(expectedAccountOwners).some(key => !keys.includes(key))) return { status: 'unproven' as const, reason: 'solana_program_or_accounts_missing' };
        const accounts = z.object({ context: z.object({ slot: z.number().int().safe() }).passthrough(), value: z.array(z.object({ owner: z.string() }).passthrough().nullable()) }).passthrough()
          .parse(await config.rpc('getMultipleAccounts', [Object.keys(expectedAccountOwners), { encoding: 'base64', commitment: 'finalized', minContextSlot: tx.slot }]));
        if (accounts.context.slot < tx.slot || accounts.value.length !== Object.keys(expectedAccountOwners).length
          || accounts.value.some((a, i) => !a || a.owner !== Object.values(expectedAccountOwners)[i])) return { status: 'unproven' as const, reason: 'solana_account_owner_invalid' };
        return { status: 'verified_telemetry' as const, signature, slot: tx.slot, finality: 'finalized' as const,
          provenance: 'configured_solana_rpc' as const, genesis_hash: genesis, artifact_hash: hashCanonical(tx),
          observed_at: new Date(tx.blockTime * 1000).toISOString(), captured_at: now().toISOString(), owner_state_slot: accounts.context.slot,
          fee_lamports: String(tx.meta.fee), native_balance_deltas: keys.map((account, i) => ({ account, delta_lamports: (BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i])).toString() })),
          token_balances: { before: tx.meta.preTokenBalances, after: tx.meta.postTokenBalances },
          liquidity_authenticity: 'not_evaluated' as const, execution_authorized: false };
      } catch { return { status: 'unproven' as const, reason: 'solana_telemetry_unavailable' }; }
    }
  };
}

export function createAllowlistedSolanaRpc(url: string, allowedOrigin: string, timeoutMs = 3000, fetchImpl: typeof fetch = fetch): JsonRpc {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.origin !== allowedOrigin || endpoint.username || endpoint.password) throw new Error('solana_rpc_not_allowlisted');
  let id = 0;
  return async (method, params) => {
    const requestId = ++id;
    const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 1048576) throw new Error('solana_rpc_unavailable');
    const reader = response.body?.getReader(); if (!reader) throw new Error('solana_rpc_empty');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength;
      if (bytes > 1048576) { await reader.cancel(); throw new Error('solana_rpc_response_too_large'); } chunks.push(chunk.value); } }
    finally { reader.releaseLock(); }
    const parsed = z.object({ jsonrpc: z.literal('2.0'), id: z.literal(requestId), result: z.unknown() }).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    return parsed.result;
  };
}

export const RwaInstrumentPolicySchema = z.object({
  chain_id: EngineId, asset_id: EngineId, issuer_id: EngineId, instrument_id: EngineId,
  terms_hash: ReceiptHashSchema, backing_evidence_hash: ReceiptHashSchema, redemption_evidence_hash: ReceiptHashSchema,
  oracle_id: EngineId, max_oracle_age_ms: z.number().int().positive().max(3600000), max_deviation_bps: z.number().int().min(0).max(10000),
  allowed_principals: z.array(EngineId).min(1), allowed_routers: z.array(EngineId).min(1)
}).strict();
export const RwaSnapshotSchema = z.object({
  chain_id: EngineId, asset_id: EngineId, issuer_id: EngineId, instrument_id: EngineId,
  terms_hash: ReceiptHashSchema, backing_evidence_hash: ReceiptHashSchema, redemption_evidence_hash: ReceiptHashSchema,
  oracle_id: EngineId, oracle_observed_at: ReceiptTimeSchema, oracle_value_atomic: AtomicAmountSchema, reference_value_atomic: AtomicAmountSchema,
  principal_id: EngineId, router: EngineId, transfer_allowed: z.boolean(), finalized_block_hash: ReceiptHashSchema, observed_at: ReceiptTimeSchema
}).strict();
/** The trusted adapter verifies source signatures/chain state first. A submitted
 * snapshot saying "verified" is never accepted as verification itself. */
export async function qualifyRwaInstrument(raw: unknown, registry: z.infer<typeof RwaInstrumentPolicySchema>,
  verifySource: (snapshot: z.infer<typeof RwaSnapshotSchema>) => Promise<boolean>, now: Date) {
  const parsed = RwaSnapshotSchema.safeParse(raw), policy = RwaInstrumentPolicySchema.parse(registry);
  const unproven = (reason: string) => ({ status: 'unproven' as const, reason, execution_authorized: false });
  if (!parsed.success) return unproven('rwa_snapshot_incomplete');
  const s = parsed.data;
  for (const field of ['chain_id', 'asset_id', 'issuer_id', 'instrument_id', 'terms_hash', 'backing_evidence_hash', 'redemption_evidence_hash', 'oracle_id'] as const) {
    if (s[field] !== policy[field]) return unproven('rwa_exact_instrument_binding_invalid');
  }
  if (!policy.allowed_principals.includes(s.principal_id) || !policy.allowed_routers.includes(s.router) || !s.transfer_allowed) return unproven('rwa_transfer_restricted');
  const age = now.getTime() - Date.parse(s.oracle_observed_at), snapshotAge = now.getTime() - Date.parse(s.observed_at);
  if (age < 0 || age >= policy.max_oracle_age_ms || snapshotAge < 0 || snapshotAge >= policy.max_oracle_age_ms) return unproven('rwa_oracle_stale');
  const value = BigInt(s.oracle_value_atomic), ref = BigInt(s.reference_value_atomic), difference = value > ref ? value - ref : ref - value;
  if (value === 0n || ref === 0n || difference * 10000n > ref * BigInt(policy.max_deviation_bps)) return unproven('rwa_oracle_deviation');
  try { if (!await verifySource(s)) return unproven('rwa_source_unverified'); } catch { return unproven('rwa_source_unavailable'); }
  return { status: 'qualified_instrument' as const, snapshot_hash: hashCanonical(s), instrument_id: s.instrument_id, execution_authorized: false };
}

/** Only reviewed adapters may publish these facts; qualification is not inferred
 * from Jev confidence, token symbols, or telemetry extraction alone. */
export function economicFactsForCandidate(candidate: EconomicCandidate, policy: EconomicPolicy, qualification: {
  confidence: number; deterministic_veto: boolean; bounded_test_required: boolean;
}) {
  return EconomicEvidenceFactsSchema.parse({ version: 'infopunks.economic-evidence.v1', candidate_hash: hashCanonical(candidate), policy_hash: hashCanonical(policy),
    authenticity: 'verified', completeness: 'complete', finality: 'finalized', ...qualification });
}
