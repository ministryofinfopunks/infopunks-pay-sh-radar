import Fastify from 'fastify';
import { encodeAbiParameters, encodeEventTopics, parseAbi, verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { BASE_USDC } from '../../src/security/settlementProofVerifier';
import type { PaymentRequirements } from '@x402/core/types';

// Publicly known, disposable fixture key. Kept in the external adapter, never configured in Radar.
const payer = privateKeyToAccount(('0x' + '1'.repeat(64)) as `0x${string}`);
export const recipient = ('0x' + '2'.repeat(40)) as `0x${string}`;
const types = { TransferWithAuthorization: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }
] } as const;
function domain(required: PaymentRequirements) {
  return { name: String(required.extra?.name ?? 'USD Coin'), version: String(required.extra?.version ?? '2'), chainId: 8453, verifyingContract: required.asset as `0x${string}` };
}
export async function localInfrastructure() {
  const app = Fastify();
  const events: unknown[] = [];
  const used = new Set<string>();
  const transfers = new Map<string, { timestamp: number }>();
  const blockHash = ('0x' + 'b'.repeat(64)) as `0x${string}`;
  const authorization = (required: PaymentRequirements, nonce: string) => ({ from: payer.address, to: required.payTo as `0x${string}`, value: required.amount,
    validAfter: '0', validBefore: '2000000000', nonce: ('0x' + hashCanonical(nonce).slice(7)) as `0x${string}` });
  const validate = async (body: any) => {
    try {
      const { paymentPayload: payment, paymentRequirements: required } = body;
      const a = payment.payload.authorization;
      return required.network === 'eip155:8453' && required.asset.toLowerCase() === BASE_USDC && required.payTo.toLowerCase() === recipient && required.amount === '10000'
        && a.from.toLowerCase() === payer.address.toLowerCase() && a.to.toLowerCase() === recipient && a.value === required.amount
        && await verifyTypedData({ address: payer.address, domain: domain(required), types, primaryType: 'TransferWithAuthorization',
          message: { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) }, signature: payment.payload.signature });
    } catch { return false; }
  };
  app.get('/supported', async () => ({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' }], extensions: [], signers: {} }));
  app.post('/verify', async req => { const isValid = await validate(req.body); events.push({ boundary: 'verify', isValid }); return { isValid, payer: payer.address, ...(!isValid ? { invalidReason: 'invalid_fixture_signature' } : {}) }; });
  app.post('/settle', async req => {
    const body = req.body as any;
    const nonce = body.paymentPayload.payload.authorization.nonce;
    const success = await validate(body) && !used.has(nonce);
    if (success) used.add(nonce);
    events.push({ boundary: 'settle', success, nonce });
    return { success, transaction: '0x' + hashCanonical({ fee: nonce }).slice(7), network: 'eip155:8453', payer: payer.address,
      ...(!success ? { errorReason: 'invalid_or_replayed_payment' } : {}) };
  });
  app.post('/external-settle', async req => {
    const { timestamp, reference } = req.body as { timestamp: number; reference: string };
    const transaction = '0x' + hashCanonical({ external: reference }).slice(7);
    transfers.set(transaction, { timestamp });
    events.push({ boundary: 'external-settle', classification: 'LOCAL', transaction });
    return { transaction, classification: 'LOCAL', payer: payer.address, recipient, amount_atomic: '100000' };
  });
  const hex = (n: number) => '0x' + n.toString(16);
  app.post('/rpc', async req => {
    const { method, params, id } = req.body as any;
    events.push({ boundary: 'rpc', method });
    let result: unknown = null;
    if (method === 'eth_chainId') result = '0x2105';
    if (method === 'eth_getTransactionReceipt') {
      const transaction = params[0];
      if (transfers.has(transaction)) result = { transactionHash: transaction, transactionIndex: '0x0', blockHash, blockNumber: '0x1', from: payer.address, to: BASE_USDC,
        cumulativeGasUsed: '0x1', gasUsed: '0x1', effectiveGasPrice: '0x1', contractAddress: null, logsBloom: '0x' + '0'.repeat(512), status: '0x1', type: '0x2',
        logs: [{ address: BASE_USDC, data: encodeAbiParameters([{ type: 'uint256' }], [100000n]),
          topics: encodeEventTopics({ abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']), eventName: 'Transfer', args: { from: payer.address, to: recipient } }),
          removed: false, blockHash, blockNumber: '0x1', transactionHash: transaction, transactionIndex: '0x0', logIndex: '0x0' }] };
    }
    if (method === 'eth_getBlockByNumber') result = { hash: blockHash, number: '0x1', timestamp: hex([...transfers.values()][0]?.timestamp ?? 1791417603), transactions: [],
      parentHash: blockHash, nonce: '0x0000000000000000', sha3Uncles: blockHash, logsBloom: '0x' + '0'.repeat(512), transactionsRoot: blockHash, stateRoot: blockHash,
      receiptsRoot: blockHash, miner: recipient, difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', size: '0x1', gasLimit: '0x100000', gasUsed: '0x1', uncles: [], baseFeePerGas: '0x1' };
    return { jsonrpc: '2.0', id, result };
  });
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  return { url, signer: payer.address, events, close: () => app.close(),
    async payment(required: PaymentRequirements, nonce: string) {
      const a = authorization(required, nonce);
      const signature = await payer.signTypedData({ domain: domain(required), types, primaryType: 'TransferWithAuthorization', message: { ...a, value: BigInt(a.value), validAfter: 0n, validBefore: 2000000000n } });
      return { x402Version: 2, accepted: required, payload: { signature, authorization: a } };
    },
    sign: (message: string) => payer.signMessage({ message }) };
}
