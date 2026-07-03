import { describe, expect, it } from 'vitest';
import type { HermesRun } from '../src/data/hermesDesk';
import { buildHermesMemoryLoop, buildHermesMemoryLoopSummary, type HermesMemoryLoopStageState } from '../src/services/hermesMemoryLoop';

const expectedStageLabels = ['Run', 'Receipt', 'Claim', 'Review', 'Reputation', 'Decision', 'Outcome', 'Feedback'];
const validStates = new Set<HermesMemoryLoopStageState>(['complete', 'ready', 'watch', 'blocked', 'missing']);

describe('Hermes Agent Memory Loop', () => {
  it('returns a deterministic full loop from the canonical seeded Hermes run', () => {
    const first = buildHermesMemoryLoop();
    const second = buildHermesMemoryLoop();

    expect(first).toEqual(second);
    expect(first.id).toBe('hermes_memory_loop_hermes_pay_sh_route_pre_spend_check');
    expect(first.generated_at).toBe('2026-07-03T00:00:00.000Z');
    expect(first.source_run_id).toBe('hermes_pay_sh_route_pre_spend_check');
    expect(first.thesis).toBe('Agents do not need chat history. Agents need memory that changes future action.');
  });

  it('includes all expected stages in the exact dashboard order', () => {
    const loop = buildHermesMemoryLoop();

    expect(loop.stages.map((stage) => stage.label)).toEqual(expectedStageLabels);
    expect(loop.stages.map((stage) => stage.primitive)).toEqual([
      'hermes_run',
      'agent_run_receipt',
      'claim_candidate',
      'reviewed_claim',
      'reputation_entry',
      'pre_spend_decision',
      'spend_outcome',
      'reputation_feedback'
    ]);
    expect(loop.summary.stage_count).toBe(expectedStageLabels.length);
  });

  it('connects memory edges in order', () => {
    const loop = buildHermesMemoryLoop();

    expect(loop.edges.map((edge) => edge.label)).toEqual([
      'run_to_receipt',
      'receipt_to_claim',
      'claim_to_review',
      'review_to_reputation',
      'reputation_to_decision',
      'decision_to_outcome',
      'outcome_to_feedback'
    ]);

    for (const [index, edge] of loop.edges.entries()) {
      expect(edge.from).toBe(loop.stages[index].id);
      expect(edge.to).toBe(loop.stages[index + 1].id);
    }
  });

  it('includes the expected memory loop signals', () => {
    const loop = buildHermesMemoryLoop();

    expect(loop.signals.map((signal) => signal.id)).toEqual(expect.arrayContaining([
      'source_run',
      'evidence_count',
      'claim_review_state',
      'reputation_state',
      'pre_spend_decision',
      'required_action',
      'outcome_state',
      'feedback_direction'
    ]));
    expect(loop.signals.find((signal) => signal.id === 'evidence_count')?.value).toBe(2);
    expect(loop.signals.find((signal) => signal.id === 'claim_review_state')?.value).toBe('needs_more_evidence');
    expect(loop.signals.find((signal) => signal.id === 'pre_spend_decision')?.value).toBe('do_not_spend');
    expect(loop.signals.find((signal) => signal.id === 'required_action')?.value).toBe('do_not_use_provider');
  });

  it('uses only valid stage states', () => {
    const loop = buildHermesMemoryLoop();

    for (const stage of loop.stages) {
      expect(validStates.has(stage.state)).toBe(true);
    }
    expect(loop.summary.watch_count + loop.summary.blocked_count + loop.summary.missing_count + loop.summary.complete_count).toBe(loop.summary.stage_count);
  });

  it('does not crash when optional source run data is missing', () => {
    const loop = buildHermesMemoryLoop({
      id: 'hermes_no_memory_data',
      title: 'Missing Memory Data',
      objective: 'Exercise deterministic missing data behavior.',
      state: 'completed',
      decision: 'unproven',
      confidence: 0,
      summary: 'No artifacts were attached.',
      risk_factors: [],
      artifacts: [],
      linked_receipt_id: null,
      linked_claim_id: null,
      linked_loop_id: null,
      created_at: '2026-07-03T00:00:00.000Z',
      completed_at: '2026-07-03T00:00:00.000Z'
    } satisfies HermesRun);

    expect(loop.source_run_id).toBe('hermes_no_memory_data');
    expect(loop.stages.map((stage) => stage.label)).toEqual(expectedStageLabels);
    expect(loop.stages.some((stage) => stage.state === 'missing')).toBe(true);
  });

  it('wraps the loop in a deterministic summary', () => {
    const summary = buildHermesMemoryLoopSummary();

    expect(summary.generated_at).toBe('2026-07-03T00:00:00.000Z');
    expect(summary.loop_count).toBe(1);
    expect(summary.loops).toHaveLength(1);
    expect(summary.loops[0].stages.map((stage) => stage.label)).toEqual(expectedStageLabels);
  });
});
