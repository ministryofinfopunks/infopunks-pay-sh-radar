import { expect, it, vi } from 'vitest';
import { createSolanaEconomicTelemetryAdapter, qualifyRwaInstrument } from '../src/ingestion/economicEvidenceAdapters';
import { hashCanonical } from '../src/services/receiptIntegrityService';
const now = new Date('2026-10-08T00:00:02Z');

it('extracts finalized Solana amounts deterministically and checks network/program/owner bindings', async () => {
  const signature = '1'.repeat(88);
  const transaction = { slot: 50, blockTime: Math.floor(now.getTime() / 1000) - 1,
    transaction: { signatures: [signature], message: { accountKeys: ['payer', 'vault'], instructions: [{ programId: 'program' }] } },
    meta: { err: null, fee: 5000, preBalances: [10000, 0], postBalances: [4999, 1], preTokenBalances: [], postTokenBalances: [] } };
  const rpc = vi.fn(async (method: string) => method === 'getGenesisHash' ? 'genesis'
    : method === 'getSignatureStatuses' ? { value: [{ slot: 50, err: null, confirmationStatus: 'finalized' }] }
    : method === 'getTransaction' ? transaction : { context: { slot: 51 }, value: [{ owner: 'program' }] });
  const adapter = createSolanaEconomicTelemetryAdapter({ rpc, expectedGenesisHash: 'genesis', now: () => now, maxAgeMs: 60000 });
  const observed = await adapter.observe(signature, ['program'], { vault: 'program' });
  expect(observed).toMatchObject({ status: 'verified_telemetry', fee_lamports: '5000', liquidity_authenticity: 'not_evaluated', execution_authorized: false });
  expect(observed.status === 'verified_telemetry' && observed.native_balance_deltas[0].delta_lamports).toBe('-5001');
  expect(await adapter.observe(signature, ['evil-program'], { vault: 'program' })).toMatchObject({ status: 'unproven' });
  expect(await adapter.observe(signature, ['program'], { vault: 'evil-owner' })).toMatchObject({ status: 'unproven' });
  transaction.meta.postBalances[0] = Number.MAX_SAFE_INTEGER + 1;
  expect(await adapter.observe(signature, ['program'], { vault: 'program' })).toMatchObject({ status: 'unproven' });
});
it('fails closed for missing/forked/unfinalized Solana receipts and unavailable RPC', async () => {
  const signature = '1'.repeat(88);
  const wrongNetwork = createSolanaEconomicTelemetryAdapter({ rpc: async () => 'other-genesis', expectedGenesisHash: 'genesis', now: () => now, maxAgeMs: 60000 });
  expect(await wrongNetwork.observe(signature, ['program'], { vault: 'program' })).toMatchObject({ reason: 'solana_network_mismatch' });
  const failed = createSolanaEconomicTelemetryAdapter({ rpc: async () => { throw new Error(); }, expectedGenesisHash: 'genesis', now: () => now, maxAgeMs: 60000 });
  expect(await failed.observe(signature, ['program'], { vault: 'program' })).toMatchObject({ reason: 'solana_telemetry_unavailable' });
});
it('qualifies exact RWA identity, transfer restrictions, terms, source proof and fresh oracle bounds', async () => {
  const policy = { chain_id: 'eip155:4663', asset_id: 'exact-contract', issuer_id: 'issuer', instrument_id: 'instrument',
    terms_hash: hashCanonical('terms'), backing_evidence_hash: hashCanonical('backing'), redemption_evidence_hash: hashCanonical('redemption'),
    oracle_id: 'oracle', max_oracle_age_ms: 60000, max_deviation_bps: 100, allowed_principals: ['agent'], allowed_routers: ['router'] };
  const snapshot = { chain_id: policy.chain_id, asset_id: policy.asset_id, issuer_id: policy.issuer_id, instrument_id: policy.instrument_id,
    terms_hash: policy.terms_hash, backing_evidence_hash: policy.backing_evidence_hash, redemption_evidence_hash: policy.redemption_evidence_hash,
    oracle_id: 'oracle', oracle_observed_at: now.toISOString(), oracle_value_atomic: '100', reference_value_atomic: '100',
    principal_id: 'agent', router: 'router', transfer_allowed: true, finalized_block_hash: hashCanonical('finalized-block'), observed_at: now.toISOString() };
  expect(await qualifyRwaInstrument(snapshot, policy, async () => true, now)).toMatchObject({ status: 'qualified_instrument', execution_authorized: false });
  expect(await qualifyRwaInstrument({ ...snapshot, asset_id: 'PLTR' }, policy, async () => true, now)).toMatchObject({ reason: 'rwa_exact_instrument_binding_invalid' });
  expect(await qualifyRwaInstrument({ ...snapshot, transfer_allowed: false }, policy, async () => true, now)).toMatchObject({ reason: 'rwa_transfer_restricted' });
  expect(await qualifyRwaInstrument(snapshot, policy, async () => false, now)).toMatchObject({ reason: 'rwa_source_unverified' });
  expect(await qualifyRwaInstrument({ ...snapshot, oracle_value_atomic: '102' }, policy, async () => true, now)).toMatchObject({ reason: 'rwa_oracle_deviation' });
  expect(await qualifyRwaInstrument(snapshot, policy, async () => true, new Date(now.getTime() + 60000))).toMatchObject({ reason: 'rwa_oracle_stale' });
});
