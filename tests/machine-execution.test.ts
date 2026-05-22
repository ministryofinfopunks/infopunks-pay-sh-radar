import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { clearMachinePreflightReceiptsForTests } from '../src/services/machinePreflightService';

const payload = {
  machine_id: 'did:peaq:translation-bot-01',
  policy_id: 'field-maintenance-bot',
  text: 'Machines should not spend blind.',
  source_language: 'en',
  target_language: 'es',
  max_cost_usd: 0.05
};

describe('machine execution cloud translation route', () => {
  const envSnapshot = { ...process.env };

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...envSnapshot, NODE_ENV: 'test' };
    delete process.env.MACHINE_EXECUTION_ENABLED;
    delete process.env.PAY_SH_CLOUD_TRANSLATION_URL;
    delete process.env.PAY_SH_CLOUD_TRANSLATION_AUTH;
    await clearMachinePreflightReceiptsForTests();
  });

  it('denies unsupported service execution', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/cloud-translation',
      payload: { ...payload, service_id: 'document-ai' }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('unsupported_service_execution');
    await app.close();
  });

  it('runs preflight first and fails closed when config is missing', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/cloud-translation', payload });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('allow');
    expect(body.preflight_receipt_id).toMatch(/^mrx_/);
    expect(body.execution_receipt_id).toMatch(/^mrx_exec_/);
    expect(body.execution_status).toBe('failed');
    expect(body.execution_occurred).toBe(false);
    expect(body.payment_occurred).toBe(false);
    expect(body.evidence_stage_after).toBe('policy-mapped');

    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent?service_id=cloud-translation&limit=10' });
    const receipts = recent.json().data.receipts;
    const preflight = receipts.find((row: any) => row.receipt_id === body.preflight_receipt_id);
    const execution = receipts.find((row: any) => row.receipt_id === body.execution_receipt_id);
    expect(preflight?.receipt_type).toBe('machine_preflight');
    expect(execution?.receipt_type).toBe('machine_execution');
    expect(execution?.execution_error).toBe('configuration_missing');
    await app.close();
  });

  it('review preflight does not execute without human approval', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/cloud-translation',
      payload: { ...payload, minimum_evidence_stage: 'preflight-ready' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('review');
    expect(body.execution_status).toBe('not_attempted');
    expect(body.execution_receipt_id).toBeNull();
    expect(body.execution_occurred).toBe(false);
    await app.close();
  });

  it('records successful mocked execution receipt with payment false', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_CLOUD_TRANSLATION_URL = 'https://example.test/translate';
    process.env.PAY_SH_CLOUD_TRANSLATION_AUTH = 'Bearer fake';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ translated_text: 'Las máquinas no deberían gastar a ciegas.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/cloud-translation', payload });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.execution_status).toBe('succeeded');
    expect(body.execution_occurred).toBe(true);
    expect(body.payment_occurred).toBe(false);
    expect(body.payment_evidence).toBeNull();
    expect(body.evidence_stage_after).toBe('execution-tested');
    expect(body.service_id).toBe('cloud-translation');
    await app.close();
  });

  it('does not mark non-cloud-translation services as execution-tested', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_CLOUD_TRANSLATION_URL = 'https://example.test/translate';
    process.env.PAY_SH_CLOUD_TRANSLATION_AUTH = 'Bearer fake';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ translated_text: 'x' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const app = await createApp(emptyIntelligenceStore());
    await app.inject({ method: 'POST', url: '/v1/machine-execution/cloud-translation', payload });

    const services = await app.inject({ method: 'GET', url: '/v1/machine-market/services' });
    const rows = services.json().data.services;
    expect(rows.some((service: any) => service.id !== 'cloud-translation' && service.evidence_stage === 'execution-tested')).toBe(false);
    await app.close();
  });
});
