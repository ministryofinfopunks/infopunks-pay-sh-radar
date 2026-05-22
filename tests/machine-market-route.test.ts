import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('machine market routes', () => {
  it('returns the 12 robotic.sh service mirror records', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/machine-market/services' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(body.count).toBe(12);
    expect(body.services).toHaveLength(12);
    expect(body.services.every((service: any) => service.observed_source === 'robotic.sh')).toBe(true);
    expect(body.services.every((service: any) => service.phase_scope === 'phase_2_pay_sh_robotic_sh')).toBe(true);

    await app.close();
  });

  it('summarizes totals, categories, sources, and chains', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/machine-market/summary' });

    expect(response.statusCode).toBe(200);
    const summary = response.json().data;
    expect(summary.total_services).toBe(12);
    expect(summary.categories).toEqual({
      compute: 1,
      inference: 4,
      web: 4,
      vision: 1,
      storage: 1,
      translation: 1
    });
    expect(summary.source_markets).toMatchObject({
      'pay.sh': 5,
      'agentic.market': 6,
      'robotic.sh': 1
    });
    expect(summary.chains).toMatchObject({
      solana: 5,
      base: 6,
      peaq: 1
    });
    expect(summary.ready_count).toBe(11);
    expect(summary.setup_count).toBe(1);
    expect(summary.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(summary.positioning.module).toBe('A new Radar module for machine-economy intelligence.');

    await app.close();
  });

  it('does not overstate execution or benchmark evidence', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/machine-market/services' });

    expect(response.statusCode).toBe(200);
    const services = response.json().data.services;
    expect(services.some((service: any) => service.evidence_stage === 'execution-tested')).toBe(false);
    expect(services.some((service: any) => service.evidence_stage === 'benchmark-recorded')).toBe(false);
    expect(services.every((service: any) => ['scaffold', 'listed'].includes(service.evidence_health))).toBe(true);

    await app.close();
  });
});
