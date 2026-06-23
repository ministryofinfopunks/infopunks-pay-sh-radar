import { describe, expect, it } from 'vitest';
import { createInMemoryLoopRepository } from '../src/repositories/loopRepository';
import { createLoopService } from '../src/services/loopService';

describe('loop service', () => {
  it('lists seeded loops', () => {
    const service = createLoopService(createInMemoryLoopRepository());
    const loops = service.listLoops();

    expect(loops.some((loop) => loop.id === 'loop_provider_trust')).toBe(true);
  });

  it('creates deterministic route-linked loop checks', () => {
    const service = createLoopService(createInMemoryLoopRepository([]));
    const result = service.createLoopCheck({ input: 'Pre-spend route loop for pay.sh checks.' });

    expect(result.decision_state).toBe('caution');
    expect(result.linked_check_id).toBe('check_route_pay_sh_seed');
  });

  it('creates failure-memory loops for under-evidenced inputs', () => {
    const service = createLoopService(createInMemoryLoopRepository([]));
    const result = service.createLoopCheck({ input: 'Unknown autonomy loop with no proof.' });

    expect(result.decision_state).toBe('do_not_use_yet');
    expect(result.proof_state).toBe('failure_recorded');
  });
});
