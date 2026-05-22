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

describe('machine execution anytrans translation route', () => {
  const envSnapshot = { ...process.env };

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...envSnapshot, NODE_ENV: 'test' };
    delete process.env.MACHINE_EXECUTION_ENABLED;
    delete process.env.PAY_SH_TRANSLATION_URL;
    delete process.env.PAY_SH_TRANSLATION_AUTH_MODE;
    delete process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER;
    delete process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE;
    delete process.env.PAY_SH_TRANSLATION_TIMEOUT_MS;
    await clearMachinePreflightReceiptsForTests();
  });

  it('cloud-translation execution endpoint is deprecated and fail-closed', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/cloud-translation', payload });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('catalog_endpoint_unavailable');
    expect(response.json().execution_occurred).toBe(false);
    await app.close();
  });

  it('denies unsupported service execution', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/translation',
      payload: { ...payload, service_id: 'cloud-translation' }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('unsupported_service_execution');
    await app.close();
  });

  it('fails closed when MACHINE_EXECUTION_ENABLED is not true', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('allow');
    expect(body.preflight_receipt_id).toMatch(/^mrx_/);
    expect(body.execution_receipt_id).toMatch(/^mrx_exec_/);
    expect(body.execution_status).toBe('failed');
    expect(body.service_id).toBe('anytrans');
    expect(body.execution_occurred).toBe(false);
    expect(body.payment_occurred).toBe(false);
    expect(body.evidence_stage_after).toBe('policy-mapped');
    expect(body.caveats.join(' ')).toContain('Machine execution is disabled.');

    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent?limit=20' });
    const receipts = recent.json().data.receipts;
    const preflight = receipts.find((row: any) => row.receipt_id === body.preflight_receipt_id);
    const execution = receipts.find((row: any) => row.receipt_id === body.execution_receipt_id);
    expect(preflight?.receipt_type).toBe('machine_preflight');
    expect(execution?.receipt_type).toBe('machine_execution');
    expect(execution?.execution_error).toBe('execution_disabled');
    await app.close();
  });

  it('fails closed when PAY_SH_TRANSLATION_URL is missing', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'x402';
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    const body = response.json().data;
    expect(body.execution_status).toBe('failed');
    expect(body.execution_occurred).toBe(false);
    expect(body.evidence_stage_after).toBe('policy-mapped');
    expect(body.caveats.join(' ')).toContain('AnyTrans execution URL is not configured.');
    await app.close();
  });

  it('fails closed in x402 mode without server-side x402 execution implementation', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_URL = 'https://anytrans.alibaba.gateway-402.com/anytrans/translate/text';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'x402';
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    const body = response.json().data;
    expect(body.execution_status).toBe('failed');
    expect(body.execution_occurred).toBe(false);
    expect(body.caveats.join(' ')).toContain('Runnable Pay.sh endpoint identified, but server-side x402 execution is not configured.');
    await app.close();
  });

  it('review preflight does not execute without human approval', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/translation',
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

  it('records successful mocked AnyTrans execution receipt with payment false', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_URL = 'https://anytrans.alibaba.gateway-402.com/anytrans/translate/text';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'x402';
    process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER = 'X-PAYMENT';
    process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE = 'proof-token';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ translated_text: 'Las máquinas no deberían gastar a ciegas.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.execution_status).toBe('succeeded');
    expect(body.execution_occurred).toBe(true);
    expect(body.execution_receipt_id).toMatch(/^mrx_exec_/);
    expect(body.payment_occurred).toBe(false);
    expect(body.payment_evidence).toBeNull();
    expect(body.evidence_stage_after).toBe('execution-tested');
    expect(body.service_id).toBe('anytrans');
    expect(body.fqn).toBe('solana-foundation/alibaba/anytrans');
    await app.close();
  });

  it('Google Cloud Translation remains not execution-tested while AnyTrans is candidate', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_URL = 'https://anytrans.alibaba.gateway-402.com/anytrans/translate/text';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'x402';
    process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER = 'X-PAYMENT';
    process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE = 'proof-token';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ translated_text: 'x' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const app = await createApp(emptyIntelligenceStore());
    await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });

    const services = await app.inject({ method: 'GET', url: '/v1/machine-market/services' });
    const rows = services.json().data.services;
    const cloudTranslation = rows.find((service: any) => service.id === 'cloud-translation');
    expect(cloudTranslation?.evidence_stage).not.toBe('execution-tested');
    expect(rows.some((service: any) => service.id !== 'anytrans' && service.evidence_stage === 'execution-tested')).toBe(false);
    await app.close();
  });

  it('records attempted execution with 402 challenge but no payment claim', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_URL = 'https://anytrans.alibaba.gateway-402.com/anytrans/translate/text';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'http_direct';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ challenge: 'payment_required' }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    }));
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    const body = response.json().data;
    expect(body.execution_status).toBe('failed');
    expect(body.execution_occurred).toBe(true);
    expect(body.payment_occurred).toBe(false);
    expect(body.evidence_stage_after).toBe('policy-mapped');
    expect(body.caveats.join(' ')).toContain('Pay.sh payment challenge received; payment settlement was not completed by this server.');
    await app.close();
  });

  it('records failed execution receipt on non-2xx response', async () => {
    process.env.MACHINE_EXECUTION_ENABLED = 'true';
    process.env.PAY_SH_TRANSLATION_URL = 'https://anytrans.alibaba.gateway-402.com/anytrans/translate/text';
    process.env.PAY_SH_TRANSLATION_AUTH_MODE = 'http_direct';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'upstream unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }));
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'POST', url: '/v1/machine-execution/translation', payload });
    const body = response.json().data;
    expect(body.execution_status).toBe('failed');
    expect(body.execution_occurred).toBe(true);
    expect(body.execution_receipt_id).toMatch(/^mrx_exec_/);
    expect(body.payment_occurred).toBe(false);
    expect(body.evidence_stage_after).toBe('policy-mapped');
    await app.close();
  });
});
