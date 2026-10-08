import { AccountingCostInputSchema, type SettledRevenue } from '../schemas/economicAccounting';
import type { EconomicAccountingStore } from '../persistence/economicAccountingStore';
import type { ReceiptAppendStore } from './receiptAuthorityService';
import { assertReceiptAuthority } from './receiptAuthorityService';
import { hashCanonical } from './receiptIntegrityService';
import type { JudgmentReceipt } from '../schemas/receipts';
import type { JudgmentRequestRepository } from '../repositories/judgmentRequestRepository';
import { ECONOMIC_RAILS, type EconomicNetwork } from '../security/economicRails';
import { verifyFinalizedTokenTransfer } from '../security/finalizedTokenTransfer';
import type { BaseProofRpc } from '../security/settlementProofVerifier';

const accountingHash = (record: Record<string, unknown>) => { const { receipt_hash: ignored, ...payload } = record; return hashCanonical(payload); };
export function createEconomicAccountingService(options: {
  store: EconomicAccountingStore; receipts: ReceiptAppendStore; journal: JudgmentRequestRepository;
  clients: Partial<Record<EconomicNetwork, BaseProofRpc>>; merchant: string | null;
}) {
  return {
    async reconcile(judgmentId: string): Promise<SettledRevenue> {
      const { parseUnits } = await import('viem');
      const judgment = await options.receipts.get('judgment', judgmentId) as JudgmentReceipt | null;
      if (!judgment) throw new Error('judgment_not_found');
      await assertReceiptAuthority('judgment', judgment, options.receipts);
      if (!options.receipts.judgmentTrust?.verify(judgment)) throw new Error('signed_judgment_required');
      const payment = judgment.payment;
      if (!judgment.payment_required || !payment || !payment.payer || !judgment.payment_receipt_ref || !options.merchant || payment.pay_to.toLowerCase() !== options.merchant.toLowerCase()) throw new Error('verified_merchant_payment_required');
      const rail = ECONOMIC_RAILS[payment.network];
      if (payment.asset !== rail.asset || payment.token.toLowerCase() !== rail.token || BigInt(payment.amount_atomic) !== parseUnits(judgment.charge, 6)) throw new Error('revenue_payment_mismatch');
      const key = 'sha256:' + judgmentId.slice('judgment_'.length);
      const journal = await options.journal.get(key);
      if (!journal || journal.state !== 'complete' || journal.response.receipt?.receipt_hash !== judgment.receipt_hash || journal.settlement?.transaction.toLowerCase() !== judgment.payment_receipt_ref.toLowerCase() || journal.settlement.network !== payment.network) throw new Error('revenue_settlement_journal_mismatch');
      const client = options.clients[payment.network];
      if (!client) throw new Error('settlement_rpc_unavailable');
      const transfer = await verifyFinalizedTokenTransfer(client, { network: payment.network, transaction: judgment.payment_receipt_ref,
        payer: payment.payer, payTo: payment.pay_to, amountAtomic: payment.amount_atomic, notBefore: judgment.issued_at });
      const payload = { version: 'settled-revenue.v1' as const, revenue_id: 'revenue_' + hashCanonical({ judgment_id: judgmentId, network: payment.network }).slice(7),
        judgment_id: judgmentId, judgment_hash: judgment.receipt_hash, network: payment.network, asset: payment.asset, token: rail.token,
        amount_atomic: payment.amount_atomic, payer: payment.payer.toLowerCase(), pay_to: payment.pay_to.toLowerCase(),
        ...transfer, verification: 'rpc_finalized_transfer' as const };
      return options.store.appendRevenue({ ...payload, receipt_hash: hashCanonical(payload) });
    },
    async recordCost(raw: unknown) {
      const input = AccountingCostInputSchema.parse(raw);
      if (input.judgment_id && !await options.receipts.get('judgment', input.judgment_id)) throw new Error('cost_judgment_not_found');
      const payload = { ...input, version: 'recorded-cost.v1' as const, recorded_by: 'canonical-admin' as const };
      return options.store.appendCost({ ...payload, receipt_hash: hashCanonical(payload) });
    },
    async ledger() {
      const [revenues, costs] = await Promise.all([options.store.revenues(), options.store.costs()]);
      for (const record of [...revenues, ...costs]) if (record.receipt_hash !== accountingHash(record)) throw new Error('accounting_integrity_invalid');
      const totals = Object.entries(ECONOMIC_RAILS).map(([network, rail]) => {
        const gross = revenues.filter(r => r.network === network).reduce((sum, r) => sum + BigInt(r.amount_atomic), 0n);
        const recordedCosts = costs.filter(r => r.network === network).reduce((sum, r) => sum + BigInt(r.amount_atomic), 0n);
        return { network, asset: rail.asset, decimals: 6, revenue_atomic: gross.toString(), recorded_costs_atomic: recordedCosts.toString(),
          net_after_recorded_costs_atomic: (gross - recordedCosts).toString(), cost_coverage: 'operator_recorded_partial', distributable_surplus_atomic: null };
      });
      return { source: 'settlement-backed-ledger', templates_included: false, totals, revenues, costs };
    }
  };
}
