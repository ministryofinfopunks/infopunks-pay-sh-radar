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

  it('rejects unauthenticated artifact ingest', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/anytrans/artifacts',
      payload: {
        machine_id: payload.machine_id,
        service_id: 'anytrans',
        fqn: 'solana-foundation/alibaba/anytrans',
        source_market: 'pay.sh',
        chain: 'solana',
        execution_status: 'failed',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { source_language: 'en', target_language: 'es' },
        response_summary: null,
        executor: { name: 'infopunks-pay-sh-agent-harness', mode: 'x402' }
      }
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('admin_token_required');
    await app.close();
  });

  it('rejects wrong fqn/source/chain or unsupported service_id on artifact ingest', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/anytrans/artifacts',
      headers: { authorization: 'Bearer secret' },
      payload: {
        machine_id: payload.machine_id,
        service_id: 'cloud-translation',
        fqn: 'wrong/fqn',
        source_market: 'robotic.sh',
        chain: 'base',
        execution_status: 'failed',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { source_language: 'en', target_language: 'es' },
        response_summary: null,
        executor: { name: 'infopunks-pay-sh-agent-harness', mode: 'x402' }
      }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_anytrans_execution_artifact');
    await app.close();
  });

  it('rejects benchmark or winner claim fields on artifact ingest', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/anytrans/artifacts',
      headers: { authorization: 'Bearer secret' },
      payload: {
        machine_id: payload.machine_id,
        service_id: 'anytrans',
        fqn: 'solana-foundation/alibaba/anytrans',
        source_market: 'pay.sh',
        chain: 'solana',
        execution_status: 'failed',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { source_language: 'en', target_language: 'es' },
        response_summary: null,
        executor: { name: 'infopunks-pay-sh-agent-harness', mode: 'x402' },
        winner_claim: true
      }
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('records failed artifact without execution-tested', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/anytrans/artifacts',
      headers: { authorization: 'Bearer secret' },
      payload: {
        machine_id: payload.machine_id,
        service_id: 'anytrans',
        fqn: 'solana-foundation/alibaba/anytrans',
        source_market: 'pay.sh',
        chain: 'solana',
        execution_status: 'failed',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { source_language: 'en', target_language: 'es', text_preview: payload.text },
        response_summary: { error: 'payment_required' },
        executor: { name: 'infopunks-pay-sh-agent-harness', mode: 'pay_cli', version: '0.0.1' }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.accepted).toBe(true);
    expect(body.execution_status).toBe('failed');
    expect(body.evidence_stage_after).toBe('policy-mapped');
    expect(body.payment_occurred).toBe(false);
    await app.close();
  });

  it('records successful artifact as machine_execution receipt and links preflight when present', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    const app = await createApp(emptyIntelligenceStore());
    const preflight = await app.inject({
      method: 'POST',
      url: '/v1/machine-preflight',
      payload: {
        machine_id: payload.machine_id,
        intent: 'translate text from en to es',
        category: 'translation',
        max_cost_usd: 0.05,
        allowed_markets: ['pay.sh'],
        allowed_chains: ['solana'],
        policy_id: payload.policy_id
      }
    });
    const preflightReceiptId = preflight.json().data.receipt_id;
    const response = await app.inject({
      method: 'POST',
      url: '/v1/machine-execution/anytrans/artifacts',
      headers: { authorization: 'Bearer secret' },
      payload: {
        machine_id: payload.machine_id,
        service_id: 'anytrans',
        fqn: 'solana-foundation/alibaba/anytrans',
        source_market: 'pay.sh',
        chain: 'solana',
        preflight_receipt_id: preflightReceiptId,
        execution_status: 'succeeded',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { source_language: 'en', target_language: 'es', text_preview: payload.text },
        response_summary: { translated_text_preview: 'Las máquinas no deberían gastar a ciegas.', target_language: 'es' },
        executor: { name: 'infopunks-pay-sh-agent-harness', mode: 'x402', version: '1.0.0' },
        artifact_signature: null
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.accepted).toBe(true);
    expect(body.execution_status).toBe('succeeded');
    expect(body.execution_occurred).toBe(true);
    expect(body.evidence_stage_after).toBe('execution-tested');
    expect(body.payment_occurred).toBe(false);

    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent?service_id=anytrans&limit=20' });
    const receipt = recent.json().data.receipts.find((row: any) => row.receipt_id === body.receipt_id);
    expect(receipt.receipt_type).toBe('machine_execution');
    expect(receipt.preflight_receipt_id).toBe(preflightReceiptId);
    expect(receipt.execution_executor_name).toBe('infopunks-pay-sh-agent-harness');
    expect(receipt.execution_executor_mode).toBe('x402');
    await app.close();
  });
});
