import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { InMemoryIpxPltrSimulationStore, PLTR_PREFLIGHT_DEMO_FIXTURE } from '../src/services/ipxPltrPreflightSimulatorService';
import { InMemoryIpxPltrShadowLabStore, IpxPltrShadowLabService } from '../src/services/ipxPltrShadowLabService';
import { IpxPltrShadowObservationService, SHADOW_EVIDENCE_POLICY_HASH } from '../src/services/ipxPltrShadowObservationService';

function snapshot(id: string, readiness: 'READY_FOR_SIMULATION' | 'PARTIAL' = 'READY_FOR_SIMULATION') {
  const state = structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE);
  state.observation_id = id;
  state.readiness.status = readiness;
  state.observation!.observed_at = '2026-09-03T07:45:09.000Z';
  return state;
}

describe('IPX / PLTR Shadow Observation worker', () => {
  it('skips non-ready refresh output and exposes read-only status', async () => {
    const simulatorStore = new InMemoryIpxPltrSimulationStore();
    const shadowLab = new IpxPltrShadowLabService(async (id) => snapshot(id, 'PARTIAL'), simulatorStore, new InMemoryIpxPltrShadowLabStore());
    const worker = new IpxPltrShadowObservationService({ enabled: true, capacitySweepEnabled: false, refreshPltrPreflight: async () => snapshot('partial-refresh', 'PARTIAL'), shadowLab, now: () => new Date('2026-09-03T08:00:00.000Z') });

    const status = await worker.observeOnce();

    expect(status.latest_ready_snapshot).toBeNull();
    expect(status.last_replay_at).toBeNull();
    expect(status.evidence_policy_hash).toBe(SHADOW_EVIDENCE_POLICY_HASH);
    expect(status.transaction_capability).toBe('NONE_STATUS_ONLY');
    expect(status.configurations_touched).toBe(false);
    expect(status.next_action).toBe('OBSERVE');
  });

  it('runs protected-refresh output through explicit READY snapshot replay and builds status', async () => {
    const ready = snapshot('pltr-preflight-52406505-20260903074509000');
    const states = new Map([[ready.observation_id, ready]]);
    const simulatorStore = new InMemoryIpxPltrSimulationStore();
    const shadowLab = new IpxPltrShadowLabService(async (id) => states.get(id) ?? null, simulatorStore, new InMemoryIpxPltrShadowLabStore());
    const worker = new IpxPltrShadowObservationService({ enabled: true, capacitySweepEnabled: false, refreshPltrPreflight: async () => ready, shadowLab, now: () => new Date('2026-09-03T08:00:00.000Z') });

    const status = await worker.observeOnce();

    expect(status.latest_ready_snapshot?.observation_id).toBe(ready.observation_id);
    expect(status.last_replay_at).toBe('2026-09-03T08:00:00.000Z');
    expect(Object.keys(status.candidates).sort()).toEqual(['CANDIDATE_ANCHOR_V1', 'CANDIDATE_NATIVE_V1', 'CANDIDATE_RESERVE_ANCHOR_V1']);
    expect(status.candidates.CANDIDATE_NATIVE_V1.hash).toBe('sha256:b1cda6abe5ddf48bbed092f14c3df21a188fb6d405101d1914932506a6fd7505');
    expect(status.candidates.CANDIDATE_NATIVE_V1.verdict).not.toBeNull();
    expect(status.ready_snapshot_count).toBe(1);
    expect(status.evidence_window.satisfied).toBe(false);
    expect(status.identity_market_efficiency).toBeNull();
  }, 30_000);

  it('exposes public status without requiring admin credentials', async () => {
    const app = await createApp(undefined, undefined, { ipxPltrSimulationStore: new InMemoryIpxPltrSimulationStore(), ipxPltrShadowLabStore: new InMemoryIpxPltrShadowLabStore() });

    const response = await app.inject('/v1/4663/reflexive/preflight/ipx-pltr/shadow/status');

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ object_type: 'IPX_PLTR_SHADOW_OBSERVATION_STATUS', evidence_policy_hash: SHADOW_EVIDENCE_POLICY_HASH, next_action: 'OBSERVE', transaction_capability: 'NONE_STATUS_ONLY', configurations_touched: false });
    await app.close();
  });
});
