import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { JsonlMachinePreflightReceiptStorageAdapter } from '../src/services/machinePreflightReceiptStorage';
import { clearMachinePreflightReceiptsForTests } from '../src/services/machinePreflightService';

const preflightPayload = {
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

describe('machine receipt storage readiness', () => {
  const envSnapshot = { ...process.env };

  beforeEach(async () => {
    process.env = { ...envSnapshot, NODE_ENV: 'test' };
    delete process.env.DATABASE_URL;
    delete process.env.MACHINE_RECEIPTS_JSONL_PATH;
    await clearMachinePreflightReceiptsForTests();
  });

  it('health exposes machine receipt storage status', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const health = await app.inject({ method: 'GET', url: '/health' });

    expect(health.statusCode).toBe(200);
    const storage = health.json().machine_receipts_storage;
    expect(storage.adapter).toBe('memory');
    expect(storage.mode).toBe('test');
    expect(storage.durable).toBe(false);
    expect(typeof storage.demo_seed_enabled).toBe('boolean');

    await app.close();
  });

  it('production jsonl returns explicit warning in health', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'machine-health-jsonl-'));
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8787';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    process.env.MACHINE_RECEIPTS_JSONL_PATH = join(dir, 'receipts.jsonl');

    const app = await createApp(emptyIntelligenceStore());
    const health = await app.inject({ method: 'GET', url: '/health' });

    expect(health.statusCode).toBe(200);
    expect(health.json().machine_receipts_storage.adapter).toBe('jsonl');
    expect(health.json().machine_receipts_storage.warning).toContain('Configure DATABASE_URL for Postgres-backed durability');

    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('selects postgres adapter when DATABASE_URL is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8787';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'secret';
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';

    const app = await createApp(emptyIntelligenceStore());
    const health = await app.inject({ method: 'GET', url: '/health' });

    expect(health.statusCode).toBe(200);
    expect(health.json().machine_receipts_storage.adapter).toBe('postgres');

    await app.close();
  });

  it('machine endpoints include storage metadata including dossier', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const post = await app.inject({ method: 'POST', url: '/v1/machine-preflight', payload: preflightPayload });
    const recent = await app.inject({ method: 'GET', url: '/v1/machine-preflight/receipts/recent' });
    const detail = await app.inject({ method: 'GET', url: `/v1/machine-preflight/receipts/${post.json().data.receipt_id}` });
    const dossier = await app.inject({ method: 'GET', url: `/v1/machine-dossier/${encodeURIComponent(preflightPayload.machine_id)}` });

    expect(post.json().data.storage).toMatchObject({ mode: 'test', adapter: 'memory', durable: false });
    expect(recent.json().data.storage).toMatchObject({ mode: 'test', adapter: 'memory', durable: false });
    expect(detail.json().data.storage).toMatchObject({ mode: 'test', adapter: 'memory', durable: false });
    expect(dossier.json().data.storage).toMatchObject({ mode: 'test', adapter: 'memory', durable: false });

    await app.close();
  });

  it('jsonl adapter creates missing directory/file and skips malformed lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'machine-jsonl-adapter-'));
    const nestedDir = join(dir, 'nested', 'receipts');
    const filePath = join(nestedDir, 'machine.jsonl');
    const adapter = new JsonlMachinePreflightReceiptStorageAdapter({ filePath });

    await adapter.appendMachinePreflightReceipt({
      receipt_id: 'mrx_20260522000000000_0001',
      receipt_type: 'machine_preflight',
      demo_mode: false,
      execution_occurred: false,
      payment_occurred: false,
      execution_status: 'not_attempted',
      execution_service_id: null,
      execution_provider: null,
      execution_started_at: null,
      execution_completed_at: null,
      execution_latency_ms: null,
      execution_request_summary: null,
      execution_response_summary: null,
      execution_error: null,
      payment_evidence: null,
      preflight_receipt_id: null,
      execution_run_id: null,
      machine_id: 'did:peaq:delivery-bot-01',
      policy_id: null,
      intent: 'test',
      requested_category: 'vision',
      selected_service_id: null,
      selected_service_name: null,
      source_market: null,
      chain: null,
      decision: 'allow',
      reason: 'test',
      policy_checks: [],
      violations: [],
      review_reasons: [],
      caveats: [],
      max_cost_usd: null,
      evidence_stage: null,
      evidence_health: null,
      phase_scope: 'phase_2_pay_sh_robotic_sh',
      created_at: '2026-05-22T00:00:00.000Z'
    });

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf8')).toContain('mrx_20260522000000000_0001');
    writeFileSync(filePath, '{bad json line}\n', 'utf8');
    const listed = await adapter.listMachinePreflightReceipts({});
    const diagnostics = await adapter.getDiagnostics?.();
    expect(listed).toEqual([]);
    expect(diagnostics?.warning).toContain('malformed JSONL');
    rmSync(dir, { recursive: true, force: true });
  });
});
