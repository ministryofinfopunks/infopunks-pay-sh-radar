import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { HermesRun } from '../src/data/hermesDesk';
import { convertHermesRunToReceipt } from '../src/services/hermesReceiptConverter';

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
      'signal hunt analyst',
      'carbon credit instrument check'
    ]));

    await app.close();
  });

  it('returns the primary Hermes Skill Pack manifest and seeded skills', async () => {
    const app = await createApp();

    const pack = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack' });
    const skills = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack/skills' });
    const skill = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack/skills/receipt-validator' });

    expect(pack.statusCode).toBe(200);
    expect(pack.json().data).toEqual(expect.objectContaining({
      id: 'infopunks-pre-spend-skill-pack',
      title: 'Infopunks Pre-Spend Skill Pack',
      summary: 'A skill pack for agentic investigations before money moves.',
      tagline: 'Hermes runs the investigation. Infopunks keeps the receipts.',
      version: '0.1.0'
    }));
    expect(pack.json().data.doctrine_rules.map((rule: any) => rule.title)).toEqual(expect.arrayContaining([
      'No receipt, no trust.',
      'Separate claim from evidence.',
      'Unknown is a valid state.',
      'Prefer do_not_use_yet over fake confidence.'
    ]));
    expect(skills.statusCode).toBe(200);
    expect(skills.json().data.count).toBe(6);
    expect(skills.json().data.skills.map((item: any) => item.id)).toEqual(expect.arrayContaining([
      'pre-spend-route-check',
      'provider-risk-check',
      'receipt-validator',
      'claim-dispute-review',
      'signal-hunt-analyst',
      'carbon-credit-instrument-check'
    ]));
    expect(skill.statusCode).toBe(200);
    expect(skill.json().data).toEqual(expect.objectContaining({
      id: 'receipt-validator',
      title: 'Receipt Validator'
    }));

    await app.close();
  });

  it('converts a seeded Hermes run into a receipt and claim candidate', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/receipt' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.run_id).toBe('hermes_pay_sh_route_pre_spend_check');
    expect(body.data.receipt).toEqual(expect.objectContaining({
      id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
      source_run_id: 'hermes_pay_sh_route_pre_spend_check',
      decision: 'caution',
      confidence: 82,
      evidence_count: 2,
      receipt_kind: 'agent_run_receipt',
      source: 'hermes'
    }));
    expect(body.data.claim_candidate).toEqual(expect.objectContaining({
      id: 'claim_candidate_hermes_hermes_pay_sh_route_pre_spend_check',
      source_receipt_id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
      status: 'candidate',
      confidence: 82
    }));
    expect(body.data.claim_candidate.claim).toContain('limited or test spend');
    expect(body.data.conversion.status).toBe('converted');

    await app.close();
  });

  it('returns 404 for missing Hermes run receipt conversion', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/not-real/receipt' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_run_not_found'
    }));

    await app.close();
  });

  it('keeps receipt conversion safe when a run has no artifacts', () => {
    const conversion = convertHermesRunToReceipt({
      id: 'hermes_no_artifacts',
      title: 'No Artifact Test',
      objective: 'Check missing artifacts.',
      state: 'completed',
      decision: 'unproven',
      confidence: 44,
      summary: 'No artifacts were attached.',
      risk_factors: [],
      artifacts: [],
      linked_receipt_id: null,
      linked_claim_id: null,
      linked_loop_id: null,
      created_at: '2026-07-03T00:00:00.000Z',
      completed_at: '2026-07-03T00:01:00.000Z'
    } satisfies HermesRun);

    expect(conversion.receipt.evidence_count).toBe(0);
    expect(conversion.claim_candidate.claim).toContain('remains unproven');
    expect(conversion.conversion.notes.join(' ')).toContain('No artifacts were attached');
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
