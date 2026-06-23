import { describe, expect, it } from 'vitest';
import { createInMemoryLoopRepository } from '../src/repositories/loopRepository';

describe('loop repository', () => {
  it('returns seeded loops with linked proof checks', () => {
    const repository = createInMemoryLoopRepository();
    const loops = repository.listLoops();

    expect(loops.length).toBeGreaterThanOrEqual(5);
    expect(loops.some((loop) => loop.id === 'loop_pre_spend_route' && loop.linked_check_id === 'check_route_pay_sh_seed')).toBe(true);
    expect(loops.some((loop) => loop.failure_reason)).toBe(true);
  });
});
