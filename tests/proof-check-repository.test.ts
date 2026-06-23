import { describe, expect, it } from 'vitest';
import { createInMemoryProofCheckRepository } from '../src/repositories/proofCheckRepository';

describe('proof check repository', () => {
  it('ships seeded proof checks spanning multiple decision states', () => {
    const repository = createInMemoryProofCheckRepository();
    const checks = repository.listProofChecks();
    const decisions = new Set(checks.map((check) => check.decision_state));

    expect(checks.length).toBeGreaterThanOrEqual(6);
    expect(decisions.has('trust')).toBe(true);
    expect(decisions.has('caution')).toBe(true);
    expect(decisions.has('do_not_use_yet')).toBe(true);
    expect(decisions.has('unproven')).toBe(true);
    expect(decisions.has('disputed')).toBe(true);
  });
});
