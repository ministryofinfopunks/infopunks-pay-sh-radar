import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { InMemoryIpxPltrSimulationStore, PLTR_PREFLIGHT_DEMO_FIXTURE, PLTR_PREFLIGHT_DEMO_OBSERVATION_ID } from '../src/services/ipxPltrPreflightSimulatorService';

const hypothetical_configuration = {
  simulation_name: 'API fixture', architecture: 'PLTR_ANCHOR', asset_owner: 'INFOPUNKS', first_party_asset: true, ipx_decimals: 18,
  hypothetical_total_supply: '100000000', hypothetical_circulating_supply_at_launch: '10000000', initial_price_pltr_per_ipx: '0.01',
  pltr_allocated_to_ipx_pltr_liquidity: '100', ipx_allocated_to_ipx_pltr_liquidity: '10000', pltr_allocated_to_first_party_reserve: '0', other_first_party_ipx_linked_pltr_holdings: [],
  v4_fee: 3000, tick_spacing: 200, hook_configuration: { kind: 'ZERO_HOOK' }, liquidity_positions: [{ position_id: 'p1', tick_lower: -60000, tick_upper: -30000, pltr_principal: '100', ipx_principal: '10000' }],
  hypothetical_usdg_execution_market_exists: true, hypothetical_weth_execution_market_exists: true, hypothetical_capital_allocation_pct: { pltr: '50', usdg: '30', weth: '20' },
  reserve_policy_metadata: { withdrawal_policy_descriptor: 'hypothetical', custody_descriptor: 'hypothetical', acquisition_policy_descriptor: 'none' }, reference_trade_notionals_usd: ['1000']
};

describe('IPX / PLTR Preflight Lab API', () => {
  const apps: Array<Awaited<ReturnType<typeof createApp>>> = []; afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
  it('creates and retrieves a deterministic simulation record', async () => {
    const app = await createApp(undefined, undefined, { ipxPltrSimulationStore: new InMemoryIpxPltrSimulationStore(), ipxPltrSnapshotResolver: async (id) => id === PLTR_PREFLIGHT_DEMO_OBSERVATION_ID ? structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE) : null }); apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/v1/4663/reflexive/preflight/ipx-pltr/simulate', payload: { state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, hypothetical_configuration } }); expect(created.statusCode).toBe(201); const record = created.json().data; expect(record).toMatchObject({ record_type: 'PREFLIGHT_SIMULATION_RECORD', state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, immutable: true });
    const fetched = await app.inject(`/v1/4663/reflexive/preflight/ipx-pltr/simulations/${record.simulation_id}`); expect(fetched.statusCode).toBe(200); expect(fetched.json().data).toEqual(record);
  });
  it('fails closed for absent, latest, missing, and PARTIAL snapshot state', async () => {
    const partial = structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE); partial.readiness.status = 'PARTIAL'; const app = await createApp(undefined, undefined, { ipxPltrSnapshotResolver: async (id) => id === 'partial' ? { ...partial, observation_id: 'partial' } : null }); apps.push(app);
    const post = (payload: object) => app.inject({ method: 'POST', url: '/v1/4663/reflexive/preflight/ipx-pltr/simulate', payload });
    expect((await post({ hypothetical_configuration })).json().error).toBe('EXPLICIT_SNAPSHOT_REQUIRED'); expect((await post({ state_snapshot_id: 'latest', hypothetical_configuration })).json().error).toBe('LATEST_NOT_ALLOWED'); expect((await post({ state_snapshot_id: 'missing', hypothetical_configuration })).statusCode).toBe(404); expect((await post({ state_snapshot_id: 'partial', hypothetical_configuration })).json().error).toBe('STATE_NOT_READY');
  });
  it('documents research-only shadow and capacity operations—no execution endpoint', async () => {
    const app = await createApp(); apps.push(app); const spec = (await app.inject('/openapi.json')).json(); const prefix = '/v1/4663/reflexive/preflight/ipx-pltr'; expect(spec.paths[`${prefix}/simulate`]?.post).toBeTruthy(); expect(spec.paths[`${prefix}/simulations/{id}`]?.get).toBeTruthy(); expect(spec.paths[`${prefix}/shadow/candidates`]?.get).toBeTruthy(); expect(spec.paths[`${prefix}/shadow/status`]?.get).toBeTruthy(); expect(spec.paths[`${prefix}/shadow/replay`]?.post).toBeTruthy(); expect(spec.paths[`${prefix}/shadow/series/{configuration_hash}`]?.get).toBeTruthy(); expect(spec.paths[`${prefix}/capacity-sweeps`]?.post).toBeTruthy(); const paths = Object.keys(spec.paths).filter((path) => path.startsWith(prefix)); expect(paths.join(' ')).not.toMatch(/deploy|approve|swap|trade|reserve|transaction/i);
  });
});
