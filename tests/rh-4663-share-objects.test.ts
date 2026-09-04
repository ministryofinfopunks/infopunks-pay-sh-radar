import { describe, expect, it } from 'vitest';
import { buildRh4663CallShareObject, buildRh4663FrontdoorShareObjects, RH_4663_SHARE_VERSION } from '../src/services/rh4663ShareObjectService';
import { renderRh4663SocialCardSvg } from '../src/shared/rh4663Share';
import type { Rh4663FrontdoorState } from '../src/services/rh4663FrontdoorService';

const observedAt = '2026-09-08T12:00:00.000Z';
const ref = { source_type: 'rmm_census', source_id: 'census-1', href: '/v1/4663/reflexive/census', observed_at: observedAt };
const state: Rh4663FrontdoorState = {
  object_type: 'RH_4663_FRONTDOOR_STATE', generated_at: observedAt, freshness: { state: 'VERIFIED', source_observed_at: observedAt }, frontdoor_version: { object_type: 'FRONTDOOR_VERSION', version: 3, changed: ['census'], generated_at: observedAt }, frontdoor_version_durability: 'PERSISTENT',
  now_cards: [{ id: 'census-1', topic: 'RMM CATEGORY CENSUS', headline: 'Radar verified direct markets.', summary: 'A <script>claim</script> is not a verified market.', primary_metric: '18 DIRECT MARKETS', delta: null, evidence_state: 'VERIFIED', freshness: 'FRESH', source_type: 'rmm_census', source_ref: ref, deep_link: '/4663/reflexive/census', priority_reason: 'test' }],
  watch_cards: [{ id: 'watch-hims', topic: 'HIMS', headline: 'Possible float stress.', summary: 'Historical state is unavailable.', primary_metric: 'NEXT PROOF', delta: null, evidence_state: 'WATCH', freshness: 'RECENT', source_type: 'reflexive_watch', source_ref: { ...ref, source_type: 'reflexive_watch', source_id: 'watch-hims' }, deep_link: '/4663/reflexive/watch/watch-hims', priority_reason: 'test' }],
  open_loops: [{ loop_id: 'loop:AI_NVDA', question: 'Will AI/NVDA retain its capital anchor through D7?', short_context: 'Same-block inventory is required.', source_type: 'AI_NVDA_CAPITAL_VS_FLOW', source_ref: ref, state: 'FALSIFIED', opened_at: observedAt, last_changed_at: observedAt, expected_checkpoint_at: observedAt, expected_resolution_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: 'FALSIFIED', next_evidence_needed: 'No additional claim.', resolution_condition: 'Persisted inventory.', falsification_condition: 'No persistence.', deep_link: '/4663/reflexive/watch/ai-nvda', priority_reason: 'test' }],
  change_events: [], current_call: { window_id: 'rh4663:2026-09-08', state: 'open', leading_rotation: null, total_calls: 0, opens_at: observedAt, closes_at: observedAt, deep_link: '/4663/pulse', source_ref: ref }, proof_summary: { total_calls: 0, resolved_calls: null, note: 'test', deep_link: '/4663/receipts', source_ref: ref }, system_status: { state: 'available', source_health: { census: { status: 'available', observed_at: observedAt }, watch: { status: 'available', observed_at: observedAt }, preflight: { status: 'available', observed_at: observedAt }, pulse: { status: 'available', observed_at: observedAt }, signals: { status: 'available', observed_at: observedAt } } }, source_refs: [ref]
};

describe('RH_4663_SHARE_OBJECT registry', () => {
  it('projects only public frontdoor evidence into source-bound social objects', () => {
    const objects = buildRh4663FrontdoorShareObjects(state, 'https://radar.infopunks.fun');
    const census = objects.find((item) => item.share_type === 'RMM_CENSUS_OBSERVATION')!;
    expect(census).toMatchObject({ share_version: RH_4663_SHARE_VERSION, privacy_state: 'PUBLIC', canonical_subject_id: 'census-1', deep_link: '/4663/reflexive/census', canonical_url: 'https://radar.infopunks.fun/4663/reflexive/census', evidence_state: 'VERIFIED' });
    expect(census.primary_statement).not.toContain('<script>');
    expect(census.og_image_url).toContain('/og/4663/census/census-1.png');
    expect(objects.find((item) => item.share_type === 'RADAR_FALSIFICATION')).toMatchObject({ evidence_state: 'FALSIFIED', immutability_state: 'IMMUTABLE' });
  });

  it('preserves canonical receipt identity and freezes receipt shares', () => {
    const object = buildRh4663CallShareObject({ receipt_id: 'IP-RES-123', created_at: observedAt, resolved_at: observedAt, window_id: 'rh4663:2026-09-08', called_category: 'STOCK_TOKENS', resolved_category: 'RWA_DEFI', outcome: 'INCORRECT', confidence: 74, immutable: true });
    expect(object).toMatchObject({ share_type: 'RESOLUTION_RECEIPT', canonical_subject_id: 'IP-RES-123', immutability_state: 'IMMUTABLE', privacy_state: 'PUBLIC', deep_link: '/4663/resolution/IP-RES-123', evidence_state: 'FALSIFIED' });
    const card = renderRh4663SocialCardSvg(object);
    expect(card).toContain('FALSIFIED');
    for (const question of ['WHAT HAPPENED?', 'WHY DOES IT MATTER?', 'HOW CERTAIN ARE WE?', 'WHERE IS THE PROOF?']) expect(card).toContain(question);
  });
});
