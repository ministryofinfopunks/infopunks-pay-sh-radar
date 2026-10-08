import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildReviewPacket } from '../../scripts/build-decisions-review-packet';
import { buildGateBaseline } from '../../scripts/report-decisions-real-evidence';

it('freezes all 19 synthetic stimuli into opaque, label-free review cards', () => {
  const text = readFileSync(new URL('../fixtures/decisions-qualification-cases.json', import.meta.url), 'utf8');
  const { packet, coordinator } = buildReviewPacket(JSON.parse(text), createHash('sha256').update(text).digest('hex'));
  expect(packet.cases).toHaveLength(19);
  expect(coordinator.cases).toHaveLength(19);
  expect(new Set(packet.cases.map(item => item.review_case_id)).size).toBe(19);
  const serialized = JSON.stringify(packet);
  expect(serialized).not.toContain('policy_replay_label');
  expect(serialized).not.toContain('valid_scoped_approval');
  expect(serialized).not.toContain('source_category');
  expect(packet.cases.every(item => item.source_class === 'synthetic_fixture' && !item.historical_receipt)).toBe(true);
  expect(packet.cases.every(item => !('expected' in item) && !('provider_answer' in item))).toBe(true);
  expect(readFileSync(new URL('../../docs/decisions-blinded-review-packet-v1.json', import.meta.url), 'utf8'))
    .toBe(JSON.stringify(packet, null, 2) + '\n');
  expect(readFileSync(new URL('../fixtures/decisions-review-coordinator-map-v1.json', import.meta.url), 'utf8'))
    .toBe(JSON.stringify(coordinator, null, 2) + '\n');
});

it('keeps unavailable historical counts and unreviewed quality metrics unknown', () => {
  const corpus = readFileSync(new URL('../fixtures/decisions-qualification-cases.json', import.meta.url), 'utf8');
  const inventory = readFileSync(new URL('../../docs/decisions-history-inventory-2026-10-09.json', import.meta.url), 'utf8');
  const packet = readFileSync(new URL('../../docs/decisions-blinded-review-packet-v1.json', import.meta.url), 'utf8');
  const report = buildGateBaseline(corpus, inventory, packet);
  expect(report.data_status.historical_receipt_counts).toBeNull();
  expect(report.data_status.verified_historical_outcomes).toBeNull();
  expect(report.independent_quality.policy_accuracy).toBeNull();
  expect(report.independent_quality.policy_false_allow_count).toBeNull();
  expect(report.verified_outcome_quality.outcome_verified_count).toBeNull();
  expect(report.live_provider.request_count).toBe(0);
  expect(report.recommendation).toBe('NO_GO');
  expect(readFileSync(new URL('../../docs/decisions-real-evidence-baseline-2026-10-09.json', import.meta.url), 'utf8'))
    .toBe(JSON.stringify(report, null, 2) + '\n');
  const blocked = JSON.parse(readFileSync(new URL('../../docs/decisions-reviewed-benchmark-blocked-v1.json', import.meta.url), 'utf8')) as {
    source_inventory_sha256: string; materialized_case_count: number; live_runner_eligible: boolean; cases: unknown[]
  };
  expect(blocked.source_inventory_sha256).toBe(createHash('sha256').update(inventory).digest('hex'));
  expect(blocked.materialized_case_count).toBe(0);
  expect(blocked.live_runner_eligible).toBe(false);
  expect(blocked.cases).toEqual([]);
});
