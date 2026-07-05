import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import {
  buildWalletSafetyIntegrationReadinessReport,
  buildWalletSafetyIntegrationRegistry,
  getWalletSafetyIntegrationById,
  listWalletSafetyReadyIntegrations
} from '../src/services/walletSafetyIntegrationRegistry';

describe('Wallet Safety Integration Registry service', () => {
  it('builds a deterministic seeded registry summary', () => {
    const left = buildWalletSafetyIntegrationRegistry();
    const right = buildWalletSafetyIntegrationRegistry();

    expect(left).toEqual(right);
    expect(left.integrations.map((integration) => integration.integration_id)).toEqual(expect.arrayContaining([
      'agent_wallet_demo',
      'pay_sh_route_guard',
      'x402_service_router',
      'autonomous_research_agent'
    ]));
    expect(left.integration_count).toBe(4);
    expect(left.ready_count).toBe(2);
    expect(left.testing_count).toBe(0);
    expect(left.needs_receipts_count).toBe(1);
    expect(left.watch_count).toBe(1);
    expect(left.not_ready_count).toBe(0);
  });

  it('returns seeded profiles by id and undefined for unknown ids', () => {
    expect(getWalletSafetyIntegrationById('agent_wallet_demo')).toEqual(expect.objectContaining({
      integration_id: 'agent_wallet_demo',
      name: 'Agent Wallet Demo',
      readiness_state: 'ready'
    }));
    expect(getWalletSafetyIntegrationById('missing_integration')).toBeUndefined();
  });

  it('only marks fully compliant integrations as ready', () => {
    const ready = listWalletSafetyReadyIntegrations();

    expect(ready.length).toBe(2);
    for (const integration of ready) {
      expect(integration.uses_wallet_safety_check).toBe(true);
      expect(integration.writes_integration_receipts).toBe(true);
      expect(integration.fail_closed_behavior).toBe(true);
    }
  });

  it('builds a readiness report for agent_wallet_demo with strong readiness', () => {
    const report = buildWalletSafetyIntegrationReadinessReport('agent_wallet_demo');

    expect(report).toEqual(expect.objectContaining({
      integration_id: 'agent_wallet_demo',
      readiness_state: 'ready'
    }));
    expect(report?.readiness_score).toBeGreaterThanOrEqual(95);
    expect(report?.requirements.map((item) => item.label)).toEqual(expect.arrayContaining([
      'Wallet Safety API usage',
      'Integration receipt writing',
      'Fail-closed behavior',
      'Supported chain declaration',
      'Supported payment rail declaration',
      'Receipt field completeness'
    ]));
  });

  it('marks x402_service_router as missing receipt requirements', () => {
    const report = buildWalletSafetyIntegrationReadinessReport('x402_service_router');

    expect(report?.readiness_state).toBe('needs_receipts');
    expect(report?.missing_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'integration_receipt_writing',
        status: 'missing'
      })
    ]));
  });

  it('marks autonomous_research_agent as watch because fail-closed behavior needs work', () => {
    const report = buildWalletSafetyIntegrationReadinessReport('autonomous_research_agent');

    expect(report?.readiness_state).toBe('watch');
    expect(report?.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'fail_closed_behavior',
        status: 'watch'
      })
    ]));
  });

  it('returns undefined readiness report for unknown integrations', () => {
    expect(buildWalletSafetyIntegrationReadinessReport('unknown_integration')).toBeUndefined();
  });
});

describe('Wallet Safety Integration Registry API', () => {
  it('returns the registry summary and seeded profiles', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/integrations' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.integration_count).toBe(4);
    expect(body.data.integrations.map((integration: any) => integration.integration_id)).toContain('agent_wallet_demo');

    await app.close();
  });

  it('returns one registry profile by integration id', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/integrations/agent_wallet_demo' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      integration_id: 'agent_wallet_demo',
      name: 'Agent Wallet Demo'
    }));

    await app.close();
  });

  it('returns one readiness report by integration id', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/integrations/agent_wallet_demo/readiness' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      integration_id: 'agent_wallet_demo'
    }));
    expect(body.data.readiness_score).toBeGreaterThan(0);
    expect(body.data.requirements.length).toBeGreaterThan(0);

    await app.close();
  });

  it('returns 404 for unknown registry profiles', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/integrations/not-real' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'wallet_safety_integration_not_found'
    }));

    await app.close();
  });

  it('returns 404 for unknown readiness reports', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-safety/integrations/not-real/readiness' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'wallet_safety_integration_not_found'
    }));

    await app.close();
  });
});
