import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { clearMachinePreflightReceiptsForTests } from '../src/services/machinePreflightService';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const deliveryVisionRequest = {
  machine_id: 'did:peaq:delivery-bot-01',
  intent: 'parse an invoice image into structured fields',
  category: 'vision',
  max_cost_usd: 0.05,
  allowed_markets: ['pay.sh'],
  allowed_chains: ['solana'],
  risk_tolerance: 'low',
  requires_receipt: true,
  policy_id: 'template_delivery_robot'
};

async function postPreflight(payload: Record<string, unknown>) {
  const app = await createApp(emptyIntelligenceStore());
  const response = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload });
  await app.close();
  return response;
}

describe('machine preflight API', () => {
  const envSnapshot = { ...process.env };

  beforeEach(async () => {
    process.env = { ...envSnapshot, NODE_ENV: 'test' };
    await clearMachinePreflightReceiptsForTests();
  });

  it('allows delivery robot vision request and selects Document AI', async () => {
    const response = await postPreflight(deliveryVisionRequest);

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('allow');
    expect(body.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(body.storage.mode).toBe('test');
    expect(body.storage.adapter).toBe('memory');
    expect(body.storage.durable).toBe(false);
    expect(body.recommended_service.name).toBe('Document AI');
    expect(body.source_market).toBe('pay.sh');
    expect(body.chain).toBe('solana');
    expect(body.receipt_id).toMatch(/^mrx_/);
  });

  it('allows translation request and selects Cloud Translation', async () => {
    const response = await postPreflight({
      ...deliveryVisionRequest,
      intent: 'translate field report labels',
      category: 'translation'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('allow');
    expect(body.recommended_service.name).toBe('Cloud Translation');
  });

  it('denies blocked chain', async () => {
    const response = await postPreflight({
      ...deliveryVisionRequest,
      allowed_chains: ['base']
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('deny');
    expect(body.violations).toContain('chain_allowed');
  });

  it('denies unknown category', async () => {
    const response = await postPreflight({
      ...deliveryVisionRequest,
      category: 'maps'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('deny');
    expect(body.recommended_service).toBeNull();
    expect(body.reason).toContain('No robotic.sh service is listed');
  });

  it('reviews 2Captcha under low risk tolerance', async () => {
    const response = await postPreflight({
      machine_id: 'did:peaq:research-agent-01',
      intent: 'solve captcha challenge',
      category: 'web',
      max_cost_usd: 0.01,
      allowed_markets: ['agentic.market'],
      allowed_chains: ['base'],
      risk_tolerance: 'low',
      requires_receipt: true
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('review');
    expect(body.recommended_service.name).toBe('2Captcha');
    expect(body.review_reasons).toContain('risk_tolerance_compatible');
  });

  it('reviews evidence below required threshold', async () => {
    const response = await postPreflight({
      ...deliveryVisionRequest,
      minimum_evidence_stage: 'preflight-ready'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('review');
    expect(body.review_reasons).toContain('evidence_stage_meets_minimum');
  });

  it('creates receipt for allow, deny, and review', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const allow = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: deliveryVisionRequest });
    const deny = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, allowed_chains: ['base'] } });
    const review = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, minimum_evidence_stage: 'preflight-ready' } });
    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });

    expect(allow.json().data.receipt_id).toMatch(/^mrx_/);
    expect(deny.json().data.receipt_id).toMatch(/^mrx_/);
    expect(review.json().data.receipt_id).toMatch(/^mrx_/);
    expect(recent.statusCode).toBe(200);
    expect(recent.json().data.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(recent.json().data.storage.mode).toBe('test');
    expect(recent.json().data.receipts.map((receipt: any) => receipt.decision).sort()).toEqual(['allow', 'deny', 'review']);

    await app.close();
  });

  it('recent receipts returns newest first', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const first = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: deliveryVisionRequest });
    const second = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, intent: 'translate field report labels', category: 'translation' } });
    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });

    expect(recent.statusCode).toBe(200);
    const receipts = recent.json().data.receipts;
    expect(receipts[0].receipt_id).toBe(second.json().data.receipt_id);
    expect(receipts[1].receipt_id).toBe(first.json().data.receipt_id);

    await app.close();
  });

  it('filters recent receipts and returns receipt detail', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const allow = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: deliveryVisionRequest });
    await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, allowed_chains: ['base'] } });

    const filtered = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent?decision=allow&source_market=pay.sh&chain=solana&limit=10' });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.receipts).toHaveLength(1);
    expect(filtered.json().data.receipts[0].decision).toBe('allow');

    const detail = await app.inject({ method: 'GET', url: `/v1/machine-preflight/receipts/${allow.json().data.receipt_id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(detail.json().data.storage.mode).toBe('test');
    expect(detail.json().data.receipt.selected_service.name).toBe('Document AI');
    expect(detail.json().data.receipt.policy_summary.name).toBe('Delivery Robot');

    await app.close();
  });

  it('coverage run evaluates all 12 services and records decision receipts only', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const run = await app.inject({ method: 'POST', url: '/v1/machine-preflight/coverage-run' });

    expect(run.statusCode).toBe(200);
    const body = run.json().data;
    expect(body.services_total).toBe(12);
    expect(body.preflight_evaluated).toBe(12);
    expect(body.receipts_recorded).toBe(12);
    expect(body.execution_occurred).toBe(false);
    expect(body.payment_occurred).toBe(false);
    expect(body.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(body.caveats).toContain('Coverage run records decision receipts only.');
    expect(body.caveats).toContain('No service execution occurred.');
    expect(body.caveats).toContain('No Pay.sh, robotic.sh, or Agentic.Market call was made.');
    expect(body.caveats).toContain('No payment occurred.');
    expect(body.caveats).toContain('This is not a benchmark artifact.');
    expect(body.service_results).toHaveLength(12);
    const qvac = body.service_results.find((row: any) => row.service_id === 'qvac');
    const captcha = body.service_results.find((row: any) => row.service_id === '2captcha');
    expect(qvac?.decision).toBe('review');
    expect(captcha?.decision).toBe('deny');
    expect(body.review_count).toBeGreaterThanOrEqual(1);
    expect(body.service_results.every((row: any) => row.execution_occurred === false)).toBe(true);
    expect(body.service_results.every((row: any) => row.payment_occurred === false)).toBe(true);

    const recentRuns = await app.inject({ method: 'GET', url: '/v1/machine-preflight/coverage-runs/recent?limit=1' });
    expect(recentRuns.statusCode).toBe(200);
    expect(recentRuns.json().data.runs).toHaveLength(1);
    const runId = recentRuns.json().data.runs[0].run_id;
    const detail = await app.inject({ method: 'GET', url: `/v1/machine-preflight/coverage-runs/${runId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.services_total).toBe(12);
    expect(detail.json().data.service_results.find((row: any) => row.service_id === 'qvac')?.decision).toBe('review');
    expect(detail.json().data.service_results.find((row: any) => row.service_id === '2captcha')?.decision).toBe('deny');

    const receipts = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent?limit=25' });
    expect(receipts.statusCode).toBe(200);
    const coverageReceipts = receipts.json().data.receipts.filter((receipt: any) => receipt.coverage_run_id === runId);
    expect(coverageReceipts).toHaveLength(12);
    expect(coverageReceipts.every((receipt: any) => receipt.receipt_type === 'machine_preflight')).toBe(true);
    expect(coverageReceipts.every((receipt: any) => receipt.execution_occurred === false)).toBe(true);
    expect(coverageReceipts.every((receipt: any) => receipt.payment_occurred === false)).toBe(true);
    expect(coverageReceipts.find((receipt: any) => receipt.selected_service_id === 'qvac')?.decision).toBe('review');
    expect(coverageReceipts.find((receipt: any) => receipt.selected_service_id === 'qvac')?.reason).toBe('Setup-stage service requires review before execution.');
    expect(coverageReceipts.find((receipt: any) => receipt.selected_service_id === '2captcha')?.decision).toBe('deny');
    expect(coverageReceipts.some((receipt: any) => /service execution|payment receipt|benchmark|winner/i.test(receipt.reason))).toBe(false);

    await app.close();
  });

  it('returns empty and observed machine dossiers', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const empty = await app.inject({ method: 'GET', url: '/v1/machine-dossier/did%3Apeaq%3Aempty-bot' });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data.phase_scope).toBe('phase_2_pay_sh_robotic_sh');
    expect(empty.json().data.status).toBe('no_activity');
    expect(empty.json().data.summary.total_receipts).toBe(0);
    expect(empty.json().data.suggested_next_action).toContain('Run machine preflight');

    await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: deliveryVisionRequest });
    await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, allowed_chains: ['base'] } });
    await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, minimum_evidence_stage: 'preflight-ready' } });
    const dossier = await app.inject({ method: 'GET', url: `/v1/machine-dossier/${encodeURIComponent(deliveryVisionRequest.machine_id)}` });

    expect(dossier.statusCode).toBe(200);
    expect(dossier.json().data.status).toBe('observed');
    expect(dossier.json().data.summary.total_receipts).toBe(3);
    expect(dossier.json().data.summary.allow_count).toBe(1);
    expect(dossier.json().data.summary.deny_count).toBe(1);
    expect(dossier.json().data.summary.review_count).toBe(1);
    expect(dossier.json().data.caveats.join(' ')).toContain('Radar-observed machine preflight decisions only');

    await app.close();
  });

  it('does not seed demo receipts in production mode unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8787';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    delete process.env.MACHINE_DEMO_SEED;
    const app = await createApp(emptyIntelligenceStore());

    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(recent.statusCode).toBe(200);
    expect(recent.json().data.receipts).toHaveLength(0);

    await app.close();
  });

  it('seeds safe demo preflight receipts when explicitly enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.MACHINE_DEMO_SEED = 'true';
    const app = await createApp(emptyIntelligenceStore());

    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(recent.statusCode).toBe(200);
    expect(recent.json().data.receipts).toHaveLength(5);
    expect(recent.json().data.receipts.every((receipt: any) => receipt.demo_mode === true)).toBe(true);
    expect(recent.json().data.receipts.every((receipt: any) => receipt.execution_occurred === false)).toBe(true);
    expect(recent.json().data.receipts.every((receipt: any) => receipt.payment_occurred === false)).toBe(true);
    expect(recent.json().data.receipts.every((receipt: any) => receipt.phase_scope === 'phase_2_pay_sh_robotic_sh')).toBe(true);
    expect(recent.json().data.receipts.every((receipt: any) => receipt.receipt_type === 'machine_preflight')).toBe(true);
    expect(recent.json().data.receipts.some((receipt: any) => receipt.caveats.includes('Demo preflight receipt. No service execution occurred.'))).toBe(true);
    expect(recent.json().data.receipts.some((receipt: any) => /executed|payment receipt|benchmark|winner/i.test(receipt.reason))).toBe(false);

    const secondRecent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(secondRecent.json().data.receipts).toHaveLength(5);

    const dossier = await app.inject({ method: 'GET', url: '/v1/machine-dossier/did%3Apeaq%3Adelivery-bot-01' });
    expect(dossier.statusCode).toBe(200);
    expect(dossier.json().data.caveats).toContain('This dossier includes demo preflight receipts. It does not verify physical-world machine activity.');

    await app.close();
  });

  it('persists allow/deny/review receipts across adapter re-instantiation in durable mode', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'machine-preflight-'));
    const filePath = join(tempDir, 'receipts.jsonl');
    process.env.NODE_ENV = 'development';
    process.env.MACHINE_DEMO_SEED = 'false';
    process.env.MACHINE_RECEIPTS_JSONL_PATH = filePath;

    const app1 = await createApp(emptyIntelligenceStore());
    const allow = await app1.inject({ method: 'POST', url: '/v1/machine-preflight', payload: deliveryVisionRequest });
    const deny = await app1.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, allowed_chains: ['base'] } });
    const review = await app1.inject({ method: 'POST', url: '/v1/machine-preflight', payload: { ...deliveryVisionRequest, minimum_evidence_stage: 'preflight-ready' } });
    await app1.close();

    const app2 = await createApp(emptyIntelligenceStore());
    const recent = await app2.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(recent.json().data.storage.mode).toBe('durable');
    expect(recent.json().data.storage.adapter).toBe('jsonl');
    expect(recent.json().data.storage.durable).toBe(true);
    expect(recent.json().data.receipts.map((r: any) => r.decision).sort()).toEqual(['allow', 'deny', 'review']);

    const detail = await app2.inject({ method: 'GET', url: `/v1/machine-preflight/receipts/${allow.json().data.receipt_id}` });
    expect(detail.statusCode).toBe(200);
    const dossier = await app2.inject({ method: 'GET', url: `/v1/machine-dossier/${encodeURIComponent(deliveryVisionRequest.machine_id)}` });
    expect(dossier.json().data.summary.total_receipts).toBe(3);

    expect([allow.json().data.receipt_id, deny.json().data.receipt_id, review.json().data.receipt_id]).toContain(detail.json().data.receipt.receipt_id);

    await app2.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('does not duplicate durable demo seed records across adapter re-instantiation', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'machine-preflight-demo-'));
    const filePath = join(tempDir, 'receipts.jsonl');
    process.env.NODE_ENV = 'development';
    process.env.MACHINE_DEMO_SEED = 'true';
    process.env.MACHINE_RECEIPTS_JSONL_PATH = filePath;

    const app1 = await createApp(emptyIntelligenceStore());
    const recent1 = await app1.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(recent1.json().data.receipts).toHaveLength(5);
    await app1.close();

    const app2 = await createApp(emptyIntelligenceStore());
    const recent2 = await app2.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    expect(recent2.json().data.receipts).toHaveLength(5);
    await app2.close();

    rmSync(tempDir, { recursive: true, force: true });
  });
});
