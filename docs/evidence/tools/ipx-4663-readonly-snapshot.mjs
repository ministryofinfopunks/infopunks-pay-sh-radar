import { createHash } from 'node:crypto';

const rpcUrl = process.env.IPX_READONLY_RPC_URL;
if (!rpcUrl) throw new Error('IPX_READONLY_RPC_URL is required');

const addresses = {
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  pltr: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A',
  poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
  quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
  stateView: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
  universalRouter: '0x204FAca1764B154221e35c0d20aBb3c525710498'
};
const poolId = '0xee430ee1003e1985e1828a01b9a20dad67ad4302994fe2abb4a173de4ac54623';
const key = {
  currency0: addresses.usdg.toLowerCase(),
  currency1: addresses.pltr.toLowerCase(),
  fee: 10_000,
  tickSpacing: 200,
  hooks: '0x0000000000000000000000000000000000000000'
};
const pad = value => BigInt(value).toString(16).padStart(64, '0');
const wordAddress = value => value.toLowerCase().slice(2).padStart(64, '0');
const quoteData = (zeroForOne, amount) => `0xaa9d21cb${pad(32)}${wordAddress(key.currency0)}${wordAddress(key.currency1)}${pad(key.fee)}${pad(key.tickSpacing)}${wordAddress(key.hooks)}${pad(zeroForOne ? 1 : 0)}${pad(amount)}${pad(256)}${pad(0)}`;
const slot0Data = `0xc815641c${poolId.slice(2)}`;
const liquidityData = `0xfa6793d5${poolId.slice(2)}`;
const rpc = async (method, params) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${method}: ${response.status} ${JSON.stringify(body.error ?? body)}`);
  return body.result;
};

const capturedAt = new Date().toISOString();
const blockTag = process.env.IPX_BLOCK_TAG ?? 'latest';
const head = await rpc('eth_getBlockByNumber', [blockTag, false]);
const blockParameter = { blockHash: head.hash, requireCanonical: true };
const requests = [];
const addCall = (label, to, data) => requests.push({ label, method: 'eth_call', params: [{ to, data }, blockParameter] });
for (const [label, address] of Object.entries(addresses)) requests.push({ label: `code:${label}`, method: 'eth_getCode', params: [address, blockParameter] });
addCall('usdg:decimals', addresses.usdg, '0x313ce567');
addCall('usdg:symbol', addresses.usdg, '0x95d89b41');
addCall('pltr:decimals', addresses.pltr, '0x313ce567');
addCall('pltr:symbol', addresses.pltr, '0x95d89b41');
addCall('pool:slot0', addresses.stateView, slot0Data);
addCall('pool:liquidity', addresses.stateView, liquidityData);
for (const amount of [1_000_000n, 10_000_000n, 100_000_000n]) addCall(`quote:usdg_to_pltr:${amount}`, addresses.quoter, quoteData(true, amount));
for (const amount of [10_000_000_000_000_000n, 100_000_000_000_000_000n, 1_000_000_000_000_000_000n]) addCall(`quote:pltr_to_usdg:${amount}`, addresses.quoter, quoteData(false, amount));

const batchResponse = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(requests.map((request, index) => ({ jsonrpc: '2.0', id: index + 1, method: request.method, params: request.params })))
});
const batchBody = await batchResponse.json();
const responseById = new Map(batchBody.map(item => [item.id, item]));
const results = requests.map((request, index) => {
  const response = responseById.get(index + 1);
  if (response?.error) return { label: request.label, error: response.error };
  const result = response?.result;
  if (request.label.startsWith('code:') && typeof result === 'string') {
    return { label: request.label, byte_length: Math.max(0, (result.length - 2) / 2), bytecode_sha256: createHash('sha256').update(Buffer.from(result.slice(2), 'hex')).digest('hex'), bytecode: result };
  }
  return { label: request.label, result };
});
const headAfter = await rpc('eth_getBlockByNumber', ['latest', false]);
const finalized = await rpc('eth_getBlockByNumber', ['finalized', false]);
process.stdout.write(`${JSON.stringify({
  schema: 'ipx.rh4663.readonly-snapshot.v1',
  captured_at_utc: capturedAt,
  rpc_url: rpcUrl,
  chain_id: await rpc('eth_chainId', []),
  snapshot_block: { number: head.number, hash: head.hash, timestamp: head.timestamp },
  head_after: { number: headAfter.number, hash: headAfter.hash, timestamp: headAfter.timestamp },
  finalized_block_header: { number: finalized.number, hash: finalized.hash, timestamp: finalized.timestamp },
  same_head_before_after: head.number === headAfter.number && head.hash === headAfter.hash,
  addresses,
  pool_key: key,
  pool_id: poolId,
  requests,
  results
}, null, 2)}\n`);
