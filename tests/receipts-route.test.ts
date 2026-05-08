import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('receipt route API', () => {
  it('returns a valid public receipt payload for an existing event', async () => {
    const app = await createApp();
    const events = await app.inject({ method: 'GET', url: '/v1/events/recent' });
    const eventId = events.json().data[0]?.id as string;
    expect(eventId).toBeTruthy();

    const receipt = await app.inject({ method: 'GET', url: `/v1/receipts/${eventId}` });
    expect(receipt.statusCode).toBe(200);
    const payload = receipt.json().data;
    expect(payload.event_id).toBe(eventId);
    expect(payload.event_type).toEqual(expect.any(String));
    expect(payload.observed_at).toEqual(expect.any(String));
    expect(payload.links).toHaveProperty('provider_dossier');
    await app.close();
  });

  it('returns not found for a missing receipt id', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/v1/receipts/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('receipt_not_found');
    await app.close();
  });

  it('handles partial evidence fields without failing', async () => {
    const app = await createApp();
    const events = await app.inject({ method: 'GET', url: '/v1/events/recent' });
    const event = events.json().data.find((item: { id: string; endpoint_id?: string | null; provider_id?: string | null }) => item.endpoint_id == null || item.provider_id == null)
      ?? events.json().data[0];
    const response = await app.inject({ method: 'GET', url: `/v1/receipts/${event.id}` });
    expect(response.statusCode).toBe(200);
    const payload = response.json().data;
    expect(payload).toHaveProperty('provider_id');
    expect(payload).toHaveProperty('endpoint_id');
    expect(payload).toHaveProperty('catalog_generated_at');
    expect(payload).toHaveProperty('ingested_at');
    expect(['critical', 'warning', 'informational', 'unknown']).toContain(payload.severity);
    await app.close();
  });
});
