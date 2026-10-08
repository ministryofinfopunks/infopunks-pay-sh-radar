import { describe, expect, it } from 'vitest';
import { SCORE_POLICY_V1 } from '../../src/services/evaluationScorePolicy';
describe('versioned deterministic evaluation policy', () => {
  it.each([['confirmed', 5], ['weakened', -2], ['contradicted', -15]] as const)('%s is deterministic and explainable', (outcome, delta) => {
    expect(SCORE_POLICY_V1.version).toBe('score-policy.v1');
    expect(SCORE_POLICY_V1.scoreDeltaForOutcome(outcome)).toBe(delta);
    expect(SCORE_POLICY_V1.scoreDeltaForOutcome(outcome)).toBe(delta);
  });
});
