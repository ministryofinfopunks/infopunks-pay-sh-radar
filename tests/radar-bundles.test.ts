import { describe, expect, it } from 'vitest';
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
});
