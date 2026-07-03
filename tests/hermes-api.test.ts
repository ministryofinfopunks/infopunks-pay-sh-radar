import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';

describe('Hermes Desk API', () => {
  const originalHermesEnv = {
    HERMES_ENABLED: process.env.HERMES_ENABLED,
    HERMES_MODE: process.env.HERMES_MODE,
    HERMES_BASE_URL: process.env.HERMES_BASE_URL,
    HERMES_API_KEY: process.env.HERMES_API_KEY
  };

  beforeEach(() => {
    delete process.env.HERMES_ENABLED;
    delete process.env.HERMES_MODE;
    delete process.env.HERMES_BASE_URL;
    delete process.env.HERMES_API_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalHermesEnv)) {
      if (typeof value === 'string') process.env[key] = value;
      else delete process.env[key];
    }
  });

  it('returns the Hermes Desk summary in mock-safe mode', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.title).toBe('Hermes Desk');
    expect(body.data.hero_copy).toBe('Agentic investigations before money moves.');
    expect(body.data.explanation).toBe('Hermes runs the loop. Infopunks keeps the receipts.');
    expect(body.data.sidecar.live_http_allowed).toBe(false);
    expect(body.data.runs.length).toBeGreaterThanOrEqual(3);
    expect(body.data.skills.map((skill: any) => skill.label)).toEqual(expect.arrayContaining([
      'pre-spend route check',
      'provider risk check',
      'receipt validator',
      'claim dispute review',
      'signal hunt analyst'
    ]));

    await app.close();
  });

  it('lists and retrieves seeded Hermes runs', async () => {
    const app = await createApp();

    const list = await app.inject({ method: 'GET', url: '/v1/hermes/runs' });
    const listBody = list.json();
    const runId = 'hermes_pay_sh_route_pre_spend_check';
    const detail = await app.inject({ method: 'GET', url: `/v1/hermes/runs/${runId}` });
    const detailBody = detail.json();

    expect(list.statusCode).toBe(200);
    expect(listBody.data.count).toBeGreaterThanOrEqual(3);
    expect(listBody.data.runs.map((run: any) => run.title)).toEqual(expect.arrayContaining([
      'Pay.sh Route Pre-Spend Check',
      'Agentic Market Provider Risk Review',
      'Signal Hunt Narrative Scan'
    ]));
    expect(detail.statusCode).toBe(200);
    expect(detailBody.data).toEqual(expect.objectContaining({
      id: runId,
      decision: 'caution',
      linked_receipt_id: 'receipt_001',
      linked_claim_id: 'claim_001',
      linked_loop_id: 'loop_pre_spend_route'
    }));

    await app.close();
  });

  it('creates a mock pre-spend run without requiring Hermes sidecar', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-run',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        spend_context: {
          intent: 'buy_market_research',
          budget_usd: 25
        }
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      title: 'Mock Hermes Pre-Spend Run',
      state: 'completed',
      decision: 'caution',
      linked_loop_id: 'loop_pre_spend_route',
      source: 'mock'
    }));
    expect(body.data.summary).toContain('No live Hermes sidecar call was made');
    expect(body.data.artifacts.length).toBeGreaterThanOrEqual(2);
    expect(body.data.lifecycle_events.map((event: any) => event.state)).toEqual([
      'queued',
      'mock_investigation_started',
      'mock_receipt_generated',
      'completed'
    ]);

    await app.close();
  });

  it('returns Hermes bridge health in mock mode when Hermes is disabled', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/health' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      enabled: false,
      mode: 'mock',
      status: 'mock'
    }));
    expect(body.data.error ?? null).toBeNull();

    await app.close();
  });
});
