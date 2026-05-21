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
