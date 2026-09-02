import { InMemoryIpxPltrSimulationStore, IpxPltrPreflightSimulatorService, PLTR_PREFLIGHT_DEMO_FIXTURE, PLTR_PREFLIGHT_DEMO_OBSERVATION_ID } from '../src/services/ipxPltrPreflightSimulatorService';

const shared = {
  asset_owner: 'INFOPUNKS' as const, first_party_asset: true as const, ipx_decimals: 18,
  hypothetical_total_supply: '100000000', hypothetical_circulating_supply_at_launch: '10000000', initial_price_pltr_per_ipx: '0.01',
  other_first_party_ipx_linked_pltr_holdings: [], v4_fee: 3000, tick_spacing: 200, hook_configuration: { kind: 'ZERO_HOOK' as const },
  reserve_policy_metadata: { withdrawal_policy_descriptor: 'Illustrative disclosure only; no withdrawals simulated.', custody_descriptor: 'Hypothetical first-party custody state.', acquisition_policy_descriptor: 'No reserve purchase or acquisition cadence is simulated.' },
  reference_trade_notionals_usd: ['1000', '5000', '10000', '25000', '50000', '100000']
};
const position = (pltr: string, ipx: string) => [{ position_id: 'canonical-wide-range', tick_lower: -60000, tick_upper: -30000, pltr_principal: pltr, ipx_principal: ipx }];
const configurations = [
  { ...shared, simulation_name: 'ILLUSTRATIVE ONLY // PLTR NATIVE', architecture: 'PLTR_NATIVE' as const, pltr_allocated_to_ipx_pltr_liquidity: '400', ipx_allocated_to_ipx_pltr_liquidity: '40000', pltr_allocated_to_first_party_reserve: '0', liquidity_positions: position('400', '40000'), hypothetical_usdg_execution_market_exists: false, hypothetical_weth_execution_market_exists: false, hypothetical_capital_allocation_pct: { pltr: '100', usdg: '0', weth: '0' } },
  { ...shared, simulation_name: 'ILLUSTRATIVE ONLY // PLTR ANCHOR', architecture: 'PLTR_ANCHOR' as const, pltr_allocated_to_ipx_pltr_liquidity: '250', ipx_allocated_to_ipx_pltr_liquidity: '25000', pltr_allocated_to_first_party_reserve: '0', liquidity_positions: position('250', '25000'), hypothetical_usdg_execution_market_exists: true, hypothetical_weth_execution_market_exists: true, hypothetical_capital_allocation_pct: { pltr: '50', usdg: '30', weth: '20' } },
  { ...shared, simulation_name: 'ILLUSTRATIVE ONLY // PLTR RESERVE ANCHOR', architecture: 'PLTR_RESERVE_ANCHOR' as const, pltr_allocated_to_ipx_pltr_liquidity: '100', ipx_allocated_to_ipx_pltr_liquidity: '10000', pltr_allocated_to_first_party_reserve: '300', liquidity_positions: position('100', '10000'), hypothetical_usdg_execution_market_exists: true, hypothetical_weth_execution_market_exists: true, hypothetical_capital_allocation_pct: { pltr: '25', usdg: '45', weth: '30' } }
];

async function run() {
  const service = new IpxPltrPreflightSimulatorService(async (id) => id === PLTR_PREFLIGHT_DEMO_OBSERVATION_ID ? structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE) : null, new InMemoryIpxPltrSimulationStore());
  const comparison = await service.compare({ state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, hypothetical_configurations: configurations });
  process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
}
run().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; });
