import { z } from 'zod';
export const EconomicNetworkSchema = z.enum(['eip155:8453', 'eip155:4663']);
export type EconomicNetwork = z.infer<typeof EconomicNetworkSchema>;
export const ECONOMIC_RAILS = {
  'eip155:8453': { chainId: 8453, asset: 'USDC', token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6, profile: 'base_usdc_external.v1', rail: 'base-usdc', provenance: 'base_rpc_finalized_usdc_transfer' },
  'eip155:4663': { chainId: 4663, asset: 'USDG', token: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', decimals: 6, profile: 'rh_usdg_external.v1', rail: 'rh-usdg', provenance: 'rh_rpc_finalized_usdg_transfer' }
} as const;
