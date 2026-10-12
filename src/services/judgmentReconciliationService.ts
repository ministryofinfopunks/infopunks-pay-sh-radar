import { z } from 'zod';
import type { JudgmentRequestRepository } from '../repositories/judgmentRequestRepository';
import { ECONOMIC_RAILS, EconomicNetworkSchema, type EconomicNetwork } from '../security/economicRails';
import { verifyFinalizedTokenTransfer } from '../security/finalizedTokenTransfer';
import type { BaseProofRpc } from '../security/settlementProofVerifier';

export class JudgmentReconciliationError extends Error {
  constructor(readonly code: string, readonly statusCode = 409) { super(code); }
}
/** An operator supplies a transaction hint. It is evidence only after a read-only finalized RPC verification. */
export function createJudgmentReconciliationService(journal: JudgmentRequestRepository, clients: Partial<Record<EconomicNetwork, BaseProofRpc>>) {
  return {
    async reconcile(judgmentId: string, raw: unknown) {
      const input = z.object({ transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).strict().safeParse(raw);
      if (!input.success || !/^judgment_[a-f0-9]{64}$/.test(judgmentId)) throw new JudgmentReconciliationError('invalid_reconciliation_request', 400);
      const key = 'sha256:' + judgmentId.slice('judgment_'.length);
      const record = await journal.get(key);
      if (!record || record.response.judgment_id !== judgmentId) throw new JudgmentReconciliationError('judgment_not_found', 404);
      if (record.state === 'settled' || record.state === 'complete') {
        if (record.settlement?.transaction.toLowerCase() !== input.data.transaction_hash.toLowerCase()) throw new JudgmentReconciliationError('reconciliation_conflict');
        return { state: record.state, changed: false };
      }
      const binding = record.payment_authorization;
      if (record.state !== 'settling' || !record.payment_hash || !binding || !journal.confirmSettlement) throw new JudgmentReconciliationError('verified_payment_binding_required');
      const network = EconomicNetworkSchema.safeParse(binding.network);
      if (!network.success || binding.token !== ECONOMIC_RAILS[network.data].token) throw new JudgmentReconciliationError('settlement_network_mismatch');
      const requirement = record.challenge.accepts.find(r => r.network === binding.network && r.asset.toLowerCase() === binding.token && r.payTo.toLowerCase() === binding.pay_to && r.amount === binding.amount_atomic);
      if (!requirement) throw new JudgmentReconciliationError('payment_requirements_mismatch');
      const client = clients[network.data];
      if (!client) throw new JudgmentReconciliationError('settlement_rpc_unavailable', 503);
      try {
        const { parseAbi, parseEventLogs } = await import('viem');
        const transfer = await verifyFinalizedTokenTransfer(client, { network: network.data, transaction: input.data.transaction_hash,
          payer: binding.payer, payTo: binding.pay_to, amountAtomic: binding.amount_atomic, notBefore: record.response.issued_at });
        const settledSeconds = BigInt(Math.floor(Date.parse(transfer.settled_at) / 1000));
        if (settledSeconds <= BigInt(binding.valid_after) || settledSeconds >= BigInt(binding.valid_before)) throw new Error();
        // Exact EIP-3009 nonce binding prevents attributing an unrelated same-price transfer to this payment.
        const receipt = await client.getTransactionReceipt({ hash: transfer.transaction_hash as `0x${string}` });
        const events = parseEventLogs({ abi: parseAbi(['event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)']),
          logs: receipt.logs.filter(log => !log.removed && log.address.toLowerCase() === binding.token &&
            log.blockHash?.toLowerCase() === transfer.block_hash.toLowerCase() && log.transactionHash?.toLowerCase() === transfer.transaction_hash && log.blockNumber?.toString() === transfer.block_number) });
        if (events.filter(e => e.args.authorizer.toLowerCase() === binding.payer && e.args.nonce.toLowerCase() === binding.nonce).length !== 1) throw new Error();
        const evidence = { version: 'judgment-reconciliation.v1' as const, payment_hash: record.payment_hash, ...transfer,
          verified_at: new Date().toISOString(), verification: 'rpc_finalized_eip3009_transfer' as const };
        const changed = await journal.confirmSettlement(key, record.payment_hash, { success: true, transaction: transfer.transaction_hash, network: network.data, payer: binding.payer }, evidence);
        const current = await journal.get(key);
        if (!current || !['settled', 'complete'].includes(current.state) || current.settlement?.transaction.toLowerCase() !== transfer.transaction_hash) throw new JudgmentReconciliationError('reconciliation_conflict');
        return { state: current.state, changed, verification: evidence.verification };
      } catch (error) {
        if (error instanceof JudgmentReconciliationError) throw error;
        // Missing, reverted, unfinalized, mismatched and unavailable RPC evidence all preserve settling and the hash.
        throw new JudgmentReconciliationError('settlement_not_independently_confirmed');
      }
    }
  };
}
