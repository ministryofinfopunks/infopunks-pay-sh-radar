import { ECONOMIC_RAILS } from '../security/economicRails';
import type { SettledRevenue } from '../schemas/economicAccounting';
import { ipxEconomyDocument } from '../web/ipxEconomyDocument';
import { IpxSolanaIndexer, solanaEvidenceRpc } from '../services/ipxSolanaIndexer';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { readFileSync } from 'node:fs';
type Hex = `0x${string}`;
import { z } from 'zod';
import { IpxCallRequestSchema, IpxLaunchPolicySchema } from '../schemas/ipxLaunch';
import { IpxGenesisService, PostgresIpxGenesisStore, buildEntitlementTree, verifyGenesisReceipt } from '../services/ipxGenesisService';
import { ipxSha256 } from '../services/ipxJcs';
import { verifyIdentityMapping } from '../services/ipxIdentityMapping';
import { IpxRevenueLedger } from '../services/ipxRevenueLedger';
import { loadIpxIssuanceManifest } from '../services/ipxIssuanceManifest';
import { rhProofClient } from '../security/settlementProofVerifier';
/** Registration is additive and isolated from CALL v1 and historical paid journals. */
export async function registerIpxLaunchRoutes(app: FastifyInstance, options: { pool: pg.Pool | null; rpc: string | null; payTo: string | null; adminToken: string | null; reconcile: (judgmentId: string) => Promise<SettledRevenue> }) {
  const { createPublicClient, http, parseAbi } = await import('viem');
  const path = process.env.IPX_LAUNCH_POLICY_PATH;
  const policy = path ? IpxLaunchPolicySchema.parse(JSON.parse(readFileSync(path, 'utf8'))) : null;
  const client = options.rpc ? createPublicClient({ transport: http(options.rpc, { timeout: 5000, retryCount: 0 }) }) : null;
  const verify = async () => {
    if (!policy || !client) throw new Error('deployment_verifier_required');
    const { manifest } = loadIpxIssuanceManifest(process.env.IPX_ISSUANCE_MANIFEST_PATH, policy);
    if (await client.getChainId() !== 4663) throw new Error('ipx_chain_mismatch');
    const finalized = await client.getBlock({ blockTag: 'finalized' });
    if (finalized.number === null || !finalized.hash) throw new Error('ipx_finalized_deployment_required');
    const blockNumber = BigInt(manifest.finalized_block_number);
    if (blockNumber > finalized.number || (await client.getBlock({ blockNumber })).hash?.toLowerCase() !== manifest.finalized_block_hash) throw new Error('ipx_manifest_block_mismatch');
    const code = await Promise.all([policy.token_contract, policy.genesis_distributor, policy.contribution_vault, policy.canonical_pltr].map(address => client.getCode({ address, blockNumber })));
    if (code.some(value => !value || value === '0x')) throw new Error('ipx_finalized_deployment_required');
    const abi = parseAbi(['function constitutionSha256() view returns (bytes32)', 'function initialSupply() view returns (uint256)', 'function token() view returns (address)', 'function allocation() view returns (uint256)', 'function allocationAmount(uint256) view returns (uint256)', 'function allocationRecipient(uint256) view returns (address)', 'function sealer() view returns (address)']);
    const [constitution, supply, token, allocation, bucket, recipient] = await Promise.all([
      client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'constitutionSha256' }),
      client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'initialSupply' }),
      client.readContract({ blockNumber, address: policy.genesis_distributor, abi, functionName: 'token' }),
      client.readContract({ blockNumber, address: policy.genesis_distributor, abi, functionName: 'allocation' }),
      client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'allocationAmount', args: [1n] }),
      client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'allocationRecipient', args: [1n] })
    ]);
    if (constitution !== policy.constitution_sha256 || supply !== BigInt(policy.total_supply_atomic) || token.toLowerCase() !== policy.token_contract || allocation !== BigInt(policy.allocations.genesis_calls) || bucket !== allocation || recipient.toLowerCase() !== policy.genesis_distributor) throw new Error('ipx_deployment_policy_mismatch');
    const bucketNames = ['genesis_wallets','genesis_calls','treasury','liquidity','ecosystem','burned'] as const;
    const amounts = await Promise.all(bucketNames.map((_name, index) => client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'allocationAmount', args: [BigInt(index)] })));
    if (amounts.some((amount, index) => amount !== BigInt(policy.allocations[bucketNames[index]]))) throw new Error('ipx_allocation_policy_mismatch');
    const recipients = await Promise.all(bucketNames.map((_name, index) => client.readContract({ blockNumber, address: policy.token_contract, abi, functionName: 'allocationRecipient', args: [BigInt(index)] })));
    const sealer = await client.readContract({ blockNumber, address: policy.genesis_distributor, abi, functionName: 'sealer' });
    if (recipients.some((address, index) => address.toLowerCase() !== policy.allocation_recipients[bucketNames[index]]) || sealer.toLowerCase() !== policy.execution_authorities.cohort_sealer) throw new Error('ipx_custody_policy_mismatch');
    const vaultAbi = parseAbi(['function ipx() view returns (address)', 'function pltr() view returns (address)', 'function burnBps() view returns (uint256)', 'function USDG() view returns (address)', 'function accountant() view returns (address)', 'function operations() view returns (address)', 'function router() view returns (address)', 'function usdgPltrFee() view returns (uint24)', 'function pltrIpxFee() view returns (uint24)']);
    const [vaultIpx, vaultPltr, burnBps] = await Promise.all([
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'ipx' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'pltr' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'burnBps' })
    ]);
    if (vaultIpx.toLowerCase() !== policy.token_contract || vaultPltr.toLowerCase() !== policy.canonical_pltr || burnBps !== BigInt(policy.contribution_burn_bps)) throw new Error('ipx_vault_policy_mismatch');
    const [usdg, accountant, operations, router, firstFee, secondFee] = await Promise.all([
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'USDG' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'accountant' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'operations' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'router' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'usdgPltrFee' }),
      client.readContract({ blockNumber, address: policy.contribution_vault, abi: vaultAbi, functionName: 'pltrIpxFee' })
    ]);
    const authority = policy.execution_authorities;
    if (usdg.toLowerCase() !== ECONOMIC_RAILS['eip155:4663'].token.toLowerCase() || accountant.toLowerCase() !== authority.accountant || operations.toLowerCase() !== authority.operations || router.toLowerCase() !== authority.router || firstFee !== authority.usdg_pltr_fee || secondFee !== authority.pltr_ipx_fee) throw new Error('ipx_execution_policy_mismatch');
    if ((await client.getBlock({ blockNumber })).hash?.toLowerCase() !== manifest.finalized_block_hash) throw new Error('ipx_deployment_block_changed');
    if (!options.pool) throw new Error('storage_required');
    await options.pool.query('insert into ipx_launch_policies(policy_hash,token_contract,genesis_distributor,policy) values($1,$2,$3,$4) on conflict do nothing', [ipxSha256(policy), policy.token_contract, policy.genesis_distributor, policy]);
    const registered = (await options.pool.query('select policy_hash from ipx_launch_policies where token_contract=$1 and genesis_distributor=$2', [policy.token_contract, policy.genesis_distributor])).rows[0];
    if (registered?.policy_hash !== ipxSha256(policy)) throw new Error('ipx_policy_already_frozen');
  };
  const genesis = policy && options.pool ? new IpxGenesisService(policy, new PostgresIpxGenesisStore(options.pool), verify) : null;
  const ledger = policy && options.pool && options.rpc && options.payTo ? new IpxRevenueLedger(options.pool, await rhProofClient(options.rpc), options.reconcile, policy.contribution_burn_bps, { ipx: policy.token_contract, vault: policy.contribution_vault }, policy.minimum_confirmations) : null;
  const ready = () => { if (!genesis) throw new Error('ipx_launch_policy_and_storage_required'); return genesis; };
  const reviewer = (authorization?: string) => Boolean(options.adminToken && authorization === `Bearer ${options.adminToken}`);
  const fail = (reply: { code(status: number): { send(body: unknown): unknown } }, error: unknown) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_ipx_request' });
    const message = error instanceof Error ? error.message : '';
    const known = ['genesis_window_not_open','genesis_window_changed','economic_wallet_already_called','genesis_cohort_full','genesis_signature_invalid','complete_verified_cohort_required','economic_receipt_conflict','paid_judgment_required','verified_usdg_judgment_required','revenue_receipt_required','identity_mapping_conflict','identity_mapping_expired'];
    return reply.code(known.includes(message) ? 409 : 503).send({ error: known.includes(message) ? message : 'ipx_launch_not_ready' });
  };
  app.get('/ipx/economy', async (_req, reply) => reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(ipxEconomyDocument));
  app.post('/internal/ipx/evidence/solana/scan', async (req, reply) => {
    if (!reviewer(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    try {
      if (!options.pool || !process.env.IPX_SOLANA_RPC_URL) throw new Error('solana_evidence_not_configured');
      const input = z.object({ address: z.string().min(32).max(44), page_size: z.number().int().min(1).max(100).default(20) }).strict().parse(req.body);
      const allow = JSON.parse(process.env.IPX_SOLANA_WATCH_ADDRESSES ?? '[]') as unknown;
      if (!Array.isArray(allow) || !allow.includes(input.address)) return reply.code(403).send({ error: 'solana_watch_not_registered' });
      const indexer = new IpxSolanaIndexer(options.pool, solanaEvidenceRpc(process.env.IPX_SOLANA_RPC_URL));
      return { data: await indexer.scan(input.address, input.page_size) };
    } catch (error) { return fail(reply, error); }
  });
  app.get('/v1/ipx/launch', async () => {
    let manifestHash: string | null = null;
    if (policy) { try { manifestHash = loadIpxIssuanceManifest(process.env.IPX_ISSUANCE_MANIFEST_PATH, policy).manifest_hash; } catch { /* incomplete terms remain visible as a blocked state */ } }
    return { data: { protocol_version: 'ipx.launch.v2', chain_id: 4663, payment_asset: 'USDG', quote_asset: 'PLTR', quote_is_backing: false, historical_calls_preserved: true, call_limit: 4663, distinct_wallet_limit: 4663, economic_entitlement: 'FIXED_IPX_ALLOCATION_PER_VERIFIED_V2_CALL', state: !policy ? 'AWAITING_ALLOCATION_AND_DEPLOYMENT' : !manifestHash ? 'AWAITING_ISSUANCE_MANIFEST' : 'CONFIGURED_REQUIRES_DEPLOYMENT_VERIFICATION', policy, policy_hash: policy ? ipxSha256(policy) : null, issuance_manifest_hash: manifestHash, economic_flywheel_operational: false } };
  });
  app.post('/v1/ipx/genesis/payload', async (req, reply) => { try { return { data: ready().payload(req.body) }; } catch (error) { return fail(reply, error); } });
  app.post('/v1/ipx/genesis/calls', async (req, reply) => {
    try { const service = ready(); loadIpxIssuanceManifest(process.env.IPX_ISSUANCE_MANIFEST_PATH, service.policy); const input = IpxCallRequestSchema.extend({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) }).parse(req.body); const { signature, ...call } = input; return reply.code(201).send({ data: await service.call(call, signature as Hex) }); } catch (error) { return fail(reply, error); }
  });
  app.get('/v1/ipx/genesis/cohort', async (_req, reply) => { try { const receipts = await ready().cohort(); return { data: { count: receipts.length, limit: 4663, receipts } }; } catch (error) { return fail(reply, error); } });
  app.post('/v1/ipx/genesis/identity-mapping', async (req, reply) => {
    try {
      const service = ready(); if (!options.pool) throw new Error('storage_required');
      const input = z.object({ payload: z.unknown(), evm_signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/), solana_signature: z.string().max(100) }).strict().parse(req.body);
      const receipt = await verifyIdentityMapping(input.payload, input.evm_signature as Hex, input.solana_signature, service.policyHash);
      await verify();
      if (Date.parse(receipt.payload.expires_at) <= Date.now()) throw new Error('identity_mapping_expired');
      // Every one-to-one key is an idempotency boundary. Do not surface a raw
      // unique-constraint failure for a conflicting Solana wallet or nonce.
      await options.pool.query('insert into ipx_identity_mappings(policy_hash,evm_wallet,solana_wallet,nonce,payload_hash,receipt) values($1,$2,$3,$4,$5,$6) on conflict do nothing', [service.policyHash, receipt.payload.evm_wallet, receipt.payload.solana_wallet, receipt.payload.nonce, receipt.payload_hash, receipt]);
      const prior = (await options.pool.query('select receipt from ipx_identity_mappings where policy_hash=$1 and evm_wallet=$2', [service.policyHash, receipt.payload.evm_wallet])).rows[0]?.receipt;
      if (!prior || prior.payload_hash !== receipt.payload_hash) throw new Error('identity_mapping_conflict');
      return { data: prior };
    } catch (error) { return fail(reply, error); }
  });
  app.get('/internal/ipx/genesis/commitment', async (req, reply) => {
    if (!reviewer(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    try { const service = ready(); const receipts = await service.cohort(); for (const receipt of receipts) await verifyGenesisReceipt(service.policy, receipt); const tree = buildEntitlementTree(service.policy, receipts); return { data: { root: tree.root, count: receipts.length, policy_hash: service.policyHash, transaction_executed: false } }; } catch (error) { return fail(reply, error); }
  });
  app.get('/v1/ipx/economy/receipts', async (_req, reply) => { try { if (!ledger) throw new Error('ledger_unavailable'); return { data: await ledger.list() }; } catch (error) { return fail(reply, error); } });
  app.get('/v1/ipx/economy/summary', async (_req, reply) => { try { if (!ledger) throw new Error('ledger_unavailable'); return { data: await ledger.summary() }; } catch (error) { return fail(reply, error); } });
  app.post('/internal/ipx/economy/revenue', async (req, reply) => { if (!reviewer(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' }); try { if (!ledger) throw new Error('ledger_unavailable'); const { judgment_id } = z.object({ judgment_id: z.string().min(1) }).strict().parse(req.body); return { data: await ledger.revenue(judgment_id) }; } catch (error) { return fail(reply, error); } });
  app.post('/internal/ipx/economy/contribution', async (req, reply) => { if (!reviewer(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' }); try { if (!ledger) throw new Error('ledger_unavailable'); const input = z.object({ revenue_id: z.string().min(1), costs: z.unknown() }).strict().parse(req.body); return { data: await ledger.account(input.revenue_id, input.costs) }; } catch (error) { return fail(reply, error); } });
  app.post('/internal/ipx/economy/burn-proof', async (req, reply) => { if (!reviewer(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' }); try { if (!ledger) throw new Error('ledger_unavailable'); const input = z.object({ contribution_id: z.string().min(1), transaction: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).strict().parse(req.body); await verify(); return { data: await ledger.burn(input.contribution_id, input.transaction as Hex) }; } catch (error) { return fail(reply, error); } });
}
