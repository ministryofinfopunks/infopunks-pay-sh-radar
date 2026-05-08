import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('public interpretation page', () => {
  it('renders a valid interpretation page for a known interpretation id', async () => {
    const app = await createApp();
    const summary = await app.inject({ method: 'GET', url: '/v1/pulse/summary' });
    expect(summary.statusCode).toBe(200);
    const interpretationId = summary.json().data.interpretations[0].interpretation_id;

    const response = await app.inject({ method: 'GET', url: `/interpretations/${interpretationId}` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Public Interpretation Artifact');
    expect(response.body).toContain('Why this matters');
    expect(response.body).toContain('Methodology');
    expect(response.body).toContain('copy-share-url');
    expect(response.body).toContain('og:title');
    expect(response.body).toContain('twitter:card');
    await app.close();
  });

  it('returns not-found state for a missing interpretation id', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/interpretations/interpretation-missing-id' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Interpretation Not Found');
    await app.close();
  });

  it('renders supporting receipt links that point to event receipts', async () => {
    const app = await createApp();
    const summary = await app.inject({ method: 'GET', url: '/v1/pulse/summary' });
    const interpretation = summary.json().data.interpretations[0];
    const response = await app.inject({ method: 'GET', url: `/interpretations/${interpretation.interpretation_id}` });

    if (interpretation.supporting_event_ids.length > 0) {
      const firstEventId = interpretation.supporting_event_ids[0];
      expect(response.body).toContain(`/v1/events/${firstEventId}`);
      const eventResponse = await app.inject({ method: 'GET', url: `/v1/events/${firstEventId}` });
      expect(eventResponse.statusCode).toBe(200);
      expect(eventResponse.json().data.id).toBe(firstEventId);
    } else {
      expect(response.body).toContain('Supporting receipt links');
    }

    await app.close();
  });
});
