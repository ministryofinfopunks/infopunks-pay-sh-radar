import { z } from 'zod';
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => value.toLowerCase() as `0x${string}`);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase() as `0x${string}`);
export const atomicAmount = z.string().regex(/^(0|[1-9][0-9]*)$/).refine(value => BigInt(value) < 2n ** 256n, 'uint256_required');
export const IpxLaunchPolicySchema = z.object({
  version: z.literal('ipx.launch.v2'), chain_id: z.literal(4663), constitution_sha256: hash,
  total_supply_atomic: atomicAmount, decimals: z.literal(18),
  allocations: z.object({ genesis_wallets: atomicAmount, genesis_calls: atomicAmount, treasury: atomicAmount, liquidity: atomicAmount, ecosystem: atomicAmount, burned: atomicAmount }).strict(),
  allocation_recipients: z.object({ genesis_wallets: address, genesis_calls: address, treasury: address, liquidity: address, ecosystem: address, burned: address }).strict(),
  execution_authorities: z.object({ cohort_sealer: address, accountant: address, operations: address, router: address, usdg_pltr_fee: z.number().int().min(1).max(16777215), pltr_ipx_fee: z.number().int().min(1).max(16777215) }).strict(),
  token_contract: address, genesis_distributor: address, contribution_vault: address, canonical_pltr: address,
  opens_at: z.string().datetime(), closes_at: z.string().datetime(),
  contribution_burn_bps: z.number().int().min(1).max(10000),
  minimum_confirmations: z.number().int().min(2),
  call_limit: z.literal(4663), distinct_wallet_limit: z.literal(4663),
  one_economic_call_per_wallet: z.literal(true), quote_is_backing: z.literal(false)
}).strict().superRefine((policy, context) => {
  if (Object.values(policy.allocations).reduce((sum, amount) => sum + BigInt(amount), 0n) !== BigInt(policy.total_supply_atomic)) context.addIssue({ code: 'custom', message: 'allocation_sum_mismatch' });
  if (BigInt(policy.allocations.genesis_calls) < 4663n) context.addIssue({ code: 'custom', message: 'economic_call_allocation_required' });
  if (policy.allocation_recipients.genesis_calls !== policy.genesis_distributor || !/^0x0+$/.test(policy.allocation_recipients.burned)) context.addIssue({ code: 'custom', message: 'allocation_recipient_mismatch' });
  for (const key of ['genesis_wallets','genesis_calls','treasury','liquidity','ecosystem'] as const) if (BigInt(policy.allocations[key]) > 0n && /^0x0+$/.test(policy.allocation_recipients[key])) context.addIssue({ code: 'custom', message: 'funded_recipient_required' });
  if (Object.values(policy.execution_authorities).some(value => typeof value === 'string' && /^0x0+$/.test(value))) context.addIssue({ code: 'custom', message: 'execution_authority_required' });
  if (Date.parse(policy.closes_at) <= Date.parse(policy.opens_at)) context.addIssue({ code: 'custom', message: 'invalid_campaign_window' });
  if ([policy.constitution_sha256, policy.token_contract, policy.genesis_distributor, policy.contribution_vault, policy.canonical_pltr].some(value => /^0x0+$/.test(value))) context.addIssue({ code: 'custom', message: 'deployed_identity_required' });
});
export type IpxLaunchPolicy = z.infer<typeof IpxLaunchPolicySchema>;
export const IpxCallRequestSchema = z.object({ wallet: address, rotation: z.enum(['MEMES', 'STOCK_TOKENS', 'RWA_DEFI', 'STABLES', 'NO_QUALIFIED_ROTATION']), confidence: z.number().int().min(1).max(100), evidence_digest: hash.nullable(), window_id: z.string().optional() }).strict();
