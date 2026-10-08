import { describe, expect, it, vi } from 'vitest';
import { setupRhUsdG, merchant, executionTx } from './helpers/rhUsdG';
import { createX402JudgmentGateway } from '../src/middleware/x402JudgmentMiddleware';
import { MemoryEconomicAccountingStore } from '../src/persistence/economicAccountingStore';
import { createEconomicAccountingService } from '../src/services/economicAccountingService';
import { createReceiptAttributionService } from '../src/services/receiptAttributionService';
import { createRhSettlementProofVerifier } from '../src/security/settlementProofVerifier';
import { createExecutionProofService } from '../src/services/executionProofService';
import { executionProofSigningMessage } from '../src/security/payloadSignatureVerifier';
import { account } from './helpers/executions';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import type { ExecuteProofRequest } from '../src/schemas/executeProof';
import { createEvaluationService } from '../src/services/evaluationService';

describe('RH USDG settlement and economics', () => {
  it('quotes canonical USDG and signs the billing identity without mixing payment with external execution', async () => {
    const f = await setupRhUsdG();
    expect(f.gateway.requirements[0]).toMatchObject({ network: 'eip155:4663', amount: '10000', asset: '0x5fc5360d0400a0fd4f2af552add042d716f1d168' });
    const quoted = await f.service.check(f.request, 'rh'); expect(quoted.status).toBe(402); expect(quoted.response.cost.asset).toBe('USDG');
    const paid = await f.service.check(f.request, 'rh', f.signature);
    expect(f.issuer.verify(paid.response.receipt!)).toBe(true);
    expect(paid.response.receipt!.payment).toMatchObject({ asset: 'USDG', network: 'eip155:4663', amount_atomic: '10000', verification: 'facilitator_attested' });
    expect((await f.service.check(f.request, 'rh', f.signature)).response.receipt).toEqual(paid.response.receipt);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('recognizes finalized merchant revenue once and keeps partial cost accounting explicit', async () => {
    const f = await setupRhUsdG(); const paid = await f.service.check(f.request, 'revenue', f.signature);
    const ledger = new MemoryEconomicAccountingStore();
    const accounting = createEconomicAccountingService({ store: ledger, receipts: f.store, journal: f.journal, clients: { 'eip155:4663': f.rpc }, merchant });
    expect((await accounting.ledger()).revenues).toHaveLength(0);
    const finalized = await accounting.reconcile(paid.response.judgment_id);
    expect(await accounting.reconcile(paid.response.judgment_id)).toEqual(finalized);
    await accounting.recordCost({ cost_id: 'rpc-cost', network: 'eip155:4663', asset: 'USDG', amount_atomic: '1000', category: 'infrastructure', judgment_id: paid.response.judgment_id, incurred_at: '2026-10-07T00:00:03Z', evidence_refs: ['artifact://rpc-invoice'] });
    expect((await accounting.ledger()).totals[1]).toMatchObject({ revenue_atomic: '10000', recorded_costs_atomic: '1000', net_after_recorded_costs_atomic: '9000', distributable_surplus_atomic: null });
    expect((await ledger.revenues())).toHaveLength(1);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('refuses soft-confirmed, wrong-network and wrong-token revenue', async () => {
    const f = await setupRhUsdG(); const paid = await f.service.check(f.request, 'pending', f.signature);
    const ledger = new MemoryEconomicAccountingStore(); const accounting = createEconomicAccountingService({ store: ledger, receipts: f.store, journal: f.journal, clients: { 'eip155:4663': f.rpc }, merchant });
    vi.mocked(f.rpc.getBlock).mockImplementation(async input => ({ hash: ('0x'+'c'.repeat(64)) as `0x${string}`, number: 'blockTag' in input ? 80n : 90n, timestamp: 1791331203n }));
    await expect(accounting.reconcile(paid.response.judgment_id)).rejects.toThrow('settlement_not_finalized');
    vi.mocked(f.rpc.getChainId).mockResolvedValue(8453);
    await expect(accounting.reconcile(paid.response.judgment_id)).rejects.toThrow('settlement_network_mismatch');
    vi.mocked(f.rpc.getChainId).mockResolvedValue(4663); vi.mocked(f.rpc.getBlock).mockResolvedValue({ hash: ('0x'+'c'.repeat(64)) as `0x${string}`, number: 100n, timestamp: 1791331203n });
    const get = f.rpc.getTransactionReceipt; const original = await get({ hash: paid.response.receipt!.payment_receipt_ref! as `0x${string}` });
    vi.mocked(get).mockResolvedValue({ ...original, logs: original.logs.map(log => ({ ...log, address: ('0x'+'0'.repeat(40)) as `0x${string}` })) });
    await expect(accounting.reconcile(paid.response.judgment_id)).rejects.toThrow('settlement_transfer_mismatch');
    expect(await ledger.revenues()).toHaveLength(0);
  });
  it('closes the RH observation/judgment/execution/evaluation chain and reports only observed attribution', async () => {
    const f = await setupRhUsdG(); const paid = await f.service.check(f.request, 'attribution', f.signature); const parent = paid.response.receipt!;
    const proof: ExecuteProofRequest = { judgment_id: parent.judgment_id, settlement: { rail: 'rh-usdg', transaction_hash: executionTx }, request_hash: f.profile.request_hash, response_hash: hashCanonical({ result: 'quote' }), latency_ms: 10, status: 'succeeded', cost: { amount: '0.1', asset: 'USDG' }, executed_at: '2026-10-07T00:00:04Z', idempotency_key: 'rh-execution' };
    const signed = { ...proof, payload_signature: await account.signMessage({ message: executionProofSigningMessage(proof, parent) }) };
    const service = createExecutionProofService({ store: f.store, threshold: 80, verifier: null, rhVerifier: createRhSettlementProofVerifier(f.rpc), now: () => new Date('2026-10-07T00:00:05Z') });
    const execution = await service.submit(signed);
    expect(execution.verification).toMatchObject({ profile: 'rh_usdg_external.v1', settlement: { network: 'eip155:4663', verified: true } });
    await createEvaluationService(f.store).createEvaluation({ evaluation_id: 'rh-evaluation', execution_id: execution.execution_id, evaluated_at: '2026-10-07T00:00:05Z', outcome: 'contradicted', reasons: ['Measured outcome contradicted expected policy result'], evidence_refs: ['artifact://evaluated-outcome'], outcome_labels: ['false_allow'] });
    const report = await createReceiptAttributionService(f.store).report();
    expect(report.judgments[0].coverage).toBe('evaluated'); expect(report.policy_metrics[0]).toMatchObject({ evaluated: 1, contradicted: 1, explicit_false_allow_labels: 1 });
    expect(report.false_block_rate).toBeNull();
    const wrong: ExecuteProofRequest = { ...proof, settlement: { rail: 'base-usdc', transaction_hash: executionTx }, idempotency_key: 'wrong-rail' };
    await expect(service.submit({ ...wrong, payload_signature: await account.signMessage({ message: executionProofSigningMessage(wrong, parent) }) })).rejects.toThrow('execution_network_mismatch');
  });
  it('rejects RH facilitators without explicit support and unverified domain metadata', async () => {
    const f = await setupRhUsdG(); vi.mocked(f.facilitator.getSupported).mockResolvedValue({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' }], extensions: [], signers: {} });
    const input = { network: 'eip155:4663' as const, facilitator: f.facilitator, facilitatorUrl: 'https://test.invalid', payTo: merchant, amount: '0.01', resourceUrl: 'https://test.invalid/check' };
    await expect(createX402JudgmentGateway(input)).rejects.toThrow('verified_usdg_domain_required');
    await expect(createX402JudgmentGateway({ ...input, usdGDomain: { name: 'Global Dollar', version: '1' } })).rejects.toThrow('x402_rh_not_supported_by_facilitator');
  });
});
