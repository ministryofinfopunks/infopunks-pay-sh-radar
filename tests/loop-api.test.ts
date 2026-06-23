import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('loop API', () => {
  it('lists seeded loops and returns loop detail', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = await app.inject({ method: 'GET', url: '/v1/loops' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.loops.some((loop: any) => loop.id === 'loop_pre_spend_route')).toBe(true);

    const detail = await app.inject({ method: 'GET', url: '/v1/loops/loop_provider_trust' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.linked_check_id).toBe('check_provider_reliability_seed');

    const missing = await app.inject({ method: 'GET', url: '/v1/loops/loop_missing' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('creates deterministic loop checks', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/loops/check',
      payload: {
        input: 'Machine service loop for DePIN route readiness.'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toMatch(/^loop_/);
    expect(response.json().data.linked_check_id).toBe('check_machine_market_seed');
    await app.close();
  });
});
