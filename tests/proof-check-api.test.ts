import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('proof check API', () => {
  it('creates a structured proof check', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: {
        input: 'Autonomous agent can route and settle everything now.'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.check_id).toMatch(/^check_/);
    expect(response.json().data.decision_state).toBe('do_not_use_yet');
    await app.close();
  });

  it('lists seeded and created proof checks and returns detail', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const create = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: {
        input: 'Provider reliability validated and verified across receipt parsing runs.'
      }
    });
    const createdId = create.json().data.check_id;

    const list = await app.inject({ method: 'GET', url: '/v1/checks' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.checks.some((check: any) => check.check_id === 'check_provider_reliability_seed')).toBe(true);
    expect(list.json().data.checks.some((check: any) => check.check_id === createdId)).toBe(true);

    const detail = await app.inject({ method: 'GET', url: `/v1/checks/${createdId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.check_id).toBe(createdId);

    const missing = await app.inject({ method: 'GET', url: '/v1/checks/check_missing' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
