import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('radar bundle registry', () => {
  it('serves read-only bundle registry with expected invariants', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/bundles' });
    expect(listResponse.statusCode).toBe(200);
    const listData = listResponse.json().data;

    expect(listData.count).toBe(3);
    expect(listData.bundles).toHaveLength(3);
    expect(listData.bundles.every((bundle: { winner_claimed: boolean }) => bundle.winner_claimed === false)).toBe(true);
    expect(listData.bundles.every((bundle: { steps: Array<{ execution_boundary?: string }> }) => bundle.steps.every((step) => typeof step.execution_boundary === 'string'))).toBe(true);

    const morning = await app.inject({ method: 'GET', url: '/v1/radar/bundles/morning-briefing' });
    expect(morning.statusCode).toBe(200);
    expect(morning.json().data.bundle_id).toBe('morning-briefing');

    const market = await app.inject({ method: 'GET', url: '/v1/radar/bundles/market-research' });
    expect(market.statusCode).toBe(200);
    expect(market.json().data.status).toBe('research_only_pending_billing_review');
    expect(market.json().data.known_caveats.join(' ')).toContain('billing-boundary ambiguity');

    const talent = await app.inject({ method: 'GET', url: '/v1/radar/bundles/talent-market-scanner' });
    expect(talent.statusCode).toBe(200);
    expect(talent.json().data.status).toBe('recipe_scaffold');

    expect(morning.json().data.evidence_dependencies).toEqual(expect.arrayContaining(['data-web-search-results']));
    expect(market.json().data.evidence_dependencies).toEqual(expect.arrayContaining(['finance-data-token-search', 'finance-data-token-metadata']));

    const serialized = JSON.stringify(listData).toLowerCase();
    expect(serialized).not.toContain('best route');
    expect(serialized).not.toContain('top route');
    expect(serialized).not.toContain('winner route');
    expect(serialized).not.toContain('loser route');
    expect(serialized).not.toContain('superiority');

    const evidenceBrief = await app.inject({ method: 'GET', url: '/v1/radar/evidence-ledger/brief' });
    expect(evidenceBrief.statusCode).toBe(200);
    expect(evidenceBrief.json().data.winner_claimed).toBe(false);

    await app.close();
  });

  it('returns 404 for unknown bundle id', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/bundles/not-a-bundle' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('bundle_not_found');
    await app.close();
  });

  it('serves morning-briefing bundle run ledger summary and detail as read-only Harness proof', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called by bundle run ledger');
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;
    try {
      const listResponse = await app.inject({ method: 'GET', url: '/v1/radar/bundles/morning-briefing/runs' });
      expect(listResponse.statusCode).toBe(200);
      const list = listResponse.json().data;
      expect(list.count).toBe(1);
      expect(list.runs).toHaveLength(1);
      expect(list.winner_claimed).toBe(false);
      expect(list.runs[0].status).toBe('controlled_live_run');
      expect(list.runs[0].evidence_health).toBe('caveated');
      expect(list.runs[0].winner_claimed).toBe(false);
      expect(list.runs[0].executed_step_count).toBe(3);
      expect(list.runs[0].skipped_step_count).toBe(2);
      expect(list.runs[0].blocked_step_count).toBe(0);
      expect(list.runs[0].source_count).toBe(9);
      expect(list.runs[0].observed_cost_usd).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      const detailResponse = await app.inject({ method: 'GET', url: '/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-075521-pay-cli' });
      expect(detailResponse.statusCode).toBe(200);
      const detail = detailResponse.json().data;
      expect(detail.executed_steps).toHaveLength(3);
      expect(detail.executed_steps.map((step: { step_id: string }) => step.step_id)).toEqual(expect.arrayContaining(['world_news_search', 'ai_news_search', 'crypto_market_scan']));
      expect(detail.skipped_steps.map((step: { step_id: string }) => step.step_id)).toEqual(expect.arrayContaining(['top_story_selection', 'deep_dive_synthesis']));
      expect(detail.caveat_objects.map((item: { code: string }) => item.code)).toEqual(expect.arrayContaining(['status_code_unavailable', 'observed_cost_unavailable']));
      expect(detail.source_map).toHaveLength(9);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = originalFetch;
      await app.close();
    }
  });

  it('returns bundle_run_not_found for unknown run id and bundle_not_found for unknown runs bundle', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const unknownRun = await app.inject({ method: 'GET', url: '/v1/radar/bundles/morning-briefing/runs/unknown' });
    expect(unknownRun.statusCode).toBe(404);
    expect(unknownRun.json().error).toBe('bundle_run_not_found');

    const unknownBundleRuns = await app.inject({ method: 'GET', url: '/v1/radar/bundles/unknown/runs' });
    expect(unknownBundleRuns.statusCode).toBe(404);
    expect(unknownBundleRuns.json().error).toBe('bundle_not_found');
    await app.close();
  });

  it('builds a non-executing route plan for morning-briefing and preserves constraints behavior', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called by bundle planner');
    });
    // Planner must be registry/evidence-derived only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/radar/bundles/morning-briefing/plan',
        payload: {
          topic: 'AI, crypto, world news',
          constraints: {
            max_cost_usd: 0.05,
            allow_billing_unclear: false,
            allow_scaffold_routes: false
          }
        }
      });
      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data.route_plan).toBeTruthy();
      expect(Array.isArray(data.route_plan)).toBe(true);
      expect(data.blocked_steps).toBeTruthy();
      expect(Array.isArray(data.blocked_steps)).toBe(true);
      expect(data.winner_claimed).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();

      const planByStep = new Map<string, { plan_status: string }>(data.route_plan.map((step: { step_id: string; plan_status: string }) => [step.step_id, step]));
      expect(planByStep.get('world_news_search')?.plan_status).toBe('included');
      expect(planByStep.get('ai_news_search')?.plan_status).toBe('included');
      expect(planByStep.get('crypto_market_scan')?.plan_status).toBe('included');
      expect(['review_required', 'blocked']).toContain(planByStep.get('top_story_selection')?.plan_status);
      expect(['review_required', 'blocked']).toContain(planByStep.get('deep_dive_synthesis')?.plan_status);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = originalFetch;
      await app.close();
    }
  });

  it('allows billing_unclear steps when allow_billing_unclear=true without executing routes', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/bundles/morning-briefing/plan',
      payload: {
        topic: 'AI, crypto, world news',
        constraints: {
          allow_billing_unclear: true
        }
      }
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    const billingUnclearSteps = data.route_plan.filter((step: { execution_boundary: string }) => step.execution_boundary === 'billing_unclear');
    expect(billingUnclearSteps.length).toBeGreaterThan(0);
    expect(billingUnclearSteps.every((step: { plan_status: string }) => ['included', 'review_required'].includes(step.plan_status))).toBe(true);
    await app.close();
  });

  it('blocks billable_probe_observed steps for market-research with default constraints', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/bundles/market-research/plan',
      payload: {
        topic: 'market research'
      }
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.status).toBe('research_only_pending_billing_review');
    const billableProbeSteps = data.route_plan.filter((step: { execution_boundary: string }) => step.execution_boundary === 'billable_probe_observed');
    expect(billableProbeSteps.length).toBeGreaterThan(0);
    expect(billableProbeSteps.every((step: { plan_status: string }) => step.plan_status === 'blocked')).toBe(true);
    await app.close();
  });

  it('blocks scaffold/blocked talent-market-scanner steps with default constraints', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/bundles/talent-market-scanner/plan',
      payload: {
        topic: 'talent market'
      }
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.route_plan.length).toBeGreaterThan(0);
    expect(data.route_plan.every((step: { plan_status: string }) => step.plan_status === 'blocked')).toBe(true);
    await app.close();
  });

  it('returns 404 bundle_not_found for unknown planner bundle id', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/bundles/not-a-bundle/plan',
      payload: { topic: 'anything' }
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('bundle_not_found');
    await app.close();
  });

  it('planner payload and copy do not include banned ranking/superiority phrases', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/bundles/morning-briefing/plan',
      payload: { topic: 'AI, crypto, world news' }
    });
    expect(response.statusCode).toBe(200);
    const serialized = JSON.stringify(response.json().data).toLowerCase();
    for (const phrase of ['best route', 'top route', 'winner route', 'loser route', 'superiority proof', 'ranking authority', 'guaranteed trust']) {
      expect(serialized).not.toContain(phrase);
    }
    await app.close();
  });
});
