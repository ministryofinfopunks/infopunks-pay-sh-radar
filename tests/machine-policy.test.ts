import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { getMachineMarketServiceById, MachineMarketService } from '../src/services/machineMarketService';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import {
  compareEvidenceStage,
  evaluateMachinePolicy,
  getMachinePolicyTemplateById,
  MachinePolicy
} from '../src/services/machinePolicyService';

function service(id: string) {
  const match = getMachineMarketServiceById(id);
  if (!match) throw new Error(`missing service ${id}`);
  return match;
}

function policy(id: string) {
  const match = getMachinePolicyTemplateById(id);
  if (!match) throw new Error(`missing policy ${id}`);
  return match;
}

function withPolicy(policy: MachinePolicy, overrides: Partial<MachinePolicy>) {
  return { ...policy, ...overrides };
}

function withService(service: MachineMarketService, overrides: Partial<MachineMarketService>) {
  return { ...service, ...overrides };
}

describe('machine policy templates and evaluation', () => {
  it('policy templates endpoint returns all templates', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/machine-policies/templates' });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(body.count).toBe(5);
    expect(body.templates.map((item: any) => item.id)).toEqual([
      'delivery-robot',
      'warehouse-camera',
      'autonomous-research-agent',
      'depin-sensor',
      'field-maintenance-bot'
    ]);
    expect(body.positioning.authority).toBe('Bounded authority needs receipts.');

    await app.close();
  });

  it('policy template detail endpoint returns one template', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/machine-policies/delivery-robot' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(response.json().data.policy.name).toBe('Delivery Robot');

    await app.close();
  });

  it('evidence stage ordering works', () => {
    expect(compareEvidenceStage('listed', 'classified')).toBeLessThan(0);
    expect(compareEvidenceStage('policy-mapped', 'classified')).toBeGreaterThan(0);
    expect(compareEvidenceStage('benchmark-recorded', 'execution-tested')).toBeGreaterThan(0);
  });

  it('blocked service denies', () => {
    const result = evaluateMachinePolicy(service('2captcha'), policy('delivery-robot'), { requested_cost_usd: 0.01, receipt_required: true });

    expect(result.status).toBe('fail');
    expect(result.violations).toContain('service_not_blocked');
  });

  it('blocked chain denies', () => {
    const result = evaluateMachinePolicy(
      service('bigquery'),
      withPolicy(policy('delivery-robot'), { blocked_chains: ['solana'] }),
      { requested_cost_usd: 0.001, receipt_required: true }
    );

    expect(result.status).toBe('fail');
    expect(result.violations).toContain('chain_not_blocked');
  });

  it('high risk under low tolerance returns review', () => {
    const result = evaluateMachinePolicy(
      withService(service('bigquery'), { policy_risk: 'High policy risk: sensitive operational data may be exposed.' }),
      policy('delivery-robot'),
      { requested_cost_usd: 0.001, receipt_required: true }
    );

    expect(result.status).toBe('review');
    expect(result.review_reasons).toContain('risk_tolerance_compatible');
  });

  it('above approval threshold returns review', () => {
    const result = evaluateMachinePolicy(
      service('bigquery'),
      withPolicy(policy('delivery-robot'), { per_call_budget_usd: 0.25, approval_required_above_usd: 0.05 }),
      { requested_cost_usd: 0.06, receipt_required: true }
    );

    expect(result.status).toBe('review');
    expect(result.review_reasons).toContain('approval_threshold_respected');
  });

  it('normal matching service returns pass', () => {
    const result = evaluateMachinePolicy(service('exa'), policy('delivery-robot'), { requested_cost_usd: 0.001, receipt_required: true });

    expect(result.status).toBe('pass');
    expect(result.violations).toEqual([]);
    expect(result.review_reasons).toEqual([]);
  });

  it('setup-stage service returns review without explicit human approval', () => {
    const result = evaluateMachinePolicy(service('qvac'), policy('depin-sensor'), { requested_cost_usd: 0.01, receipt_required: true });

    expect(result.status).toBe('review');
    expect(result.review_reasons).toContain('setup_stage_requires_review');
  });

  it('setup-stage service can pass with explicit human approval override', () => {
    const result = evaluateMachinePolicy(service('qvac'), policy('depin-sensor'), { requested_cost_usd: 0.01, receipt_required: true, human_approved: true });

    expect(result.status).toBe('pass');
    expect(result.review_reasons).not.toContain('setup_stage_requires_review');
  });
});
