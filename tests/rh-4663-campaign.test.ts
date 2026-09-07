import { describe, expect, it } from 'vitest';
import { InMemoryRh4663CampaignStore, Rh4663CampaignError, Rh4663CampaignService } from '../src/services/rh4663CampaignService';
import type { Rh4663FrontdoorState } from '../src/services/rh4663FrontdoorService';

const at = '2026-09-07T12:00:00.000Z';
function frontdoor(evidence: 'VERIFIED' | 'BLOCK' | 'DEGRADE' = 'VERIFIED'): Rh4663FrontdoorState {
  const source = { source_type: 'pltr_preflight', source_id: 'pltr-1', href: '/v1/4663/reflexive/stocks/PLTR/preflight?observation_id=pltr-1', observed_at: at };
  return {
    object_type: 'RH_4663_FRONTDOOR_STATE', generated_at: at, freshness: { state: 'VERIFIED', source_observed_at: at }, frontdoor_version: { object_type: 'FRONTDOOR_VERSION', version: 1, changed: [], generated_at: at }, frontdoor_version_durability: 'EPHEMERAL',
    now_cards: [{ id: 'pltr-preflight', topic: 'PLTR PREFLIGHT', headline: 'PLTR is blocked for preflight.', summary: 'Canonical prerequisites are still missing.', primary_metric: '0 verified mission markets', delta: '1 gap', evidence_state: evidence, freshness: at, source_type: source.source_type, source_ref: source, deep_link: '/4663/reflexive/preflight/ipx-pltr', priority_reason: 'boundary' }],
    watch_cards: [], open_loops: [{ loop_id: 'loop:pltr', question: 'Can the preflight boundary close?', short_context: 'A canonical question.', source_type: source.source_type, source_ref: source, state: 'OPEN', opened_at: at, last_changed_at: at, expected_checkpoint_at: null, expected_resolution_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: 'Not ready.', next_evidence_needed: 'Persisted preflight closure.', resolution_condition: 'Canonical observation closes the gap.', falsification_condition: null, deep_link: '/4663/reflexive/preflight/ipx-pltr', priority_reason: 'boundary' }], change_events: [],
    current_call: { window_id: 'pulse-1', state: 'open', leading_rotation: null, total_calls: 0, opens_at: at, closes_at: '2026-09-08T12:00:00.000Z', deep_link: '/4663/pulse', source_ref: { source_type: 'pulse_window', source_id: 'pulse-1', href: '/v1/4663/pulse/windows/pulse-1', observed_at: at } }, proof_summary: { total_calls: 0, resolved_calls: null, note: 'proof', deep_link: '/4663/receipts', source_ref: source },
    system_status: { state: 'available', source_health: { census: { status: 'available', observed_at: at }, watch: { status: 'available', observed_at: at }, preflight: { status: 'available', observed_at: at }, pulse: { status: 'available', observed_at: at }, signals: { status: 'available', observed_at: at } } }, source_refs: [source]
  };
}
function input() { return { campaign_id: 'pltr-boundary', title: 'PLTR boundary', short_title: 'PLTR', priority: 90, starts_at: '2026-09-07T00:00:00.000Z', hero_subject_type: 'PREFLIGHT', hero_subject_id: 'PLTR', hero_statement: 'PLTR preflight remains a source-bound readiness check.', primary_source_ref: { source_type: 'pltr_preflight', source_id: 'pltr-1', href: '/v1/4663/reflexive/stocks/PLTR/preflight?observation_id=pltr-1' }, primary_open_loop_ids: ['loop:pltr'] }; }

describe('RH_4663_CAMPAIGN', () => {
  it('keeps drafts and schedules out of the public projection, then permits one LIVE campaign', async () => {
    const service = new Rh4663CampaignService(new InMemoryRh4663CampaignStore(), () => new Date(at)); const draft = await service.create(input());
    expect(draft.state).toBe('DRAFT'); expect((await service.project(frontdoor(), [])).active).toBe(false);
    expect((await service.schedule(draft.campaign_id)).state).toBe('SCHEDULED');
    expect((await service.activate(draft.campaign_id, frontdoor(), [])).state).toBe('LIVE'); expect((await service.project(frontdoor(), [])).state).toBe('LIVE');
  });

  it('inherits BLOCK, DEGRADE, and falsification from canonical state; configuration cannot write hero evidence', async () => {
    const service = new Rh4663CampaignService(new InMemoryRh4663CampaignStore(), () => new Date(at)); const draft = await service.create(input()); await service.activate(draft.campaign_id, frontdoor('BLOCK'), []);
    expect((await service.project(frontdoor('BLOCK'), [])).hero?.evidence_state).toBe('BLOCK');
    expect((await service.project(frontdoor('DEGRADE'), [])).hero?.evidence_state).toBe('DEGRADE');
    await expect(service.create({ ...input(), campaign_id: 'forged-state', hero_evidence_state: 'READY' })).rejects.toBeInstanceOf(Error);
    const falsifiedFrontdoor = frontdoor(); falsifiedFrontdoor.now_cards = []; falsifiedFrontdoor.open_loops[0] = { ...falsifiedFrontdoor.open_loops[0], state: 'FALSIFIED' };
    const falsified = new Rh4663CampaignService(new InMemoryRh4663CampaignStore(), () => new Date(at)); const loopDraft = await falsified.create({ ...input(), campaign_id: 'falsified-loop', primary_source_ref: { source_type: 'pltr_preflight', source_id: 'pltr-1', href: '/v1/4663/reflexive/preflight/ipx-pltr' } }); await falsified.activate(loopDraft.campaign_id, falsifiedFrontdoor, []);
    expect((await falsified.project(falsifiedFrontdoor, [])).hero?.evidence_state).toBe('FALSIFIED');
  });

  it('enforces the IPX/Preflight hard boundary and rejects a second primary LIVE campaign', async () => {
    const store = new InMemoryRh4663CampaignStore(); const service = new Rh4663CampaignService(store, () => new Date(at)); const first = await service.create(input()); await service.activate(first.campaign_id, frontdoor('BLOCK'), []);
    expect((await service.project(frontdoor('BLOCK'), [])).hero).toMatchObject({ evidence_state: 'BLOCK' });
    const second = await service.create({ ...input(), campaign_id: 'second-boundary' });
    await expect(service.activate(second.campaign_id, frontdoor(), [])).rejects.toMatchObject({ code: 'primary_live_campaign_exists' } satisfies Partial<Rh4663CampaignError>);
  });

  it('refuses malformed source, missing canonical source, invalid shares, and snapshots meaningful stages', async () => {
    const service = new Rh4663CampaignService(new InMemoryRh4663CampaignStore(), () => new Date(at));
    await expect(service.create({ ...input(), campaign_id: 'bad-source', primary_source_ref: { ...input().primary_source_ref, href: 'https://example.test' } })).rejects.toBeInstanceOf(Error);
    const draft = await service.create(input()); await expect(service.activate(draft.campaign_id, { ...frontdoor(), now_cards: [], open_loops: [] }, [])).rejects.toMatchObject({ code: 'campaign_source_missing' });
    const shared = await service.create({ ...input(), campaign_id: 'share-missing', primary_share_object_ids: ['now_finding:missing'] }); await expect(service.activate(shared.campaign_id, frontdoor(), [])).rejects.toMatchObject({ code: 'campaign_share_object_missing' });
    await service.activate(draft.campaign_id, frontdoor(), []); await service.complete(draft.campaign_id, frontdoor(), []);
    expect((await service.history(draft.campaign_id)).snapshots.map((item) => item.stage)).toEqual(['LIVE_START', 'COMPLETE']);
  });
});
