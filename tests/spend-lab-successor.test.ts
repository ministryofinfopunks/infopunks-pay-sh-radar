import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { localFetch } from '../tools/spend-lab/successor/local-fetch';
import {
  startHttpLab,
  freePort,
  seedHttpEvidence,
  localApiKey,
} from '../tools/spend-lab/successor/http-client';
import { openController, boundedIntentTool } from '../tools/spend-lab/successor/controller';
import { tasks } from '../tools/spend-lab/successor/profiles';
import { runBenchmark } from '../tools/spend-lab/successor/benchmark';
import { startEvaluator, verifyAttestation } from '../tools/spend-lab/successor/evaluator';
import { radarSdkAssessment } from '../tools/spend-lab/integrations/radar-sdk';
import { createEncryptedJudgmentSessionStore } from '../src/sdk/protectedSessionStore';
import {
  eligibleEvidenceProvenance,
  localSimulationProvenance,
  localSimulationDomain,
  isLocalSimulationDomain,
  LocalSimulationProvenanceSchema,
} from '../src/security/evidenceProvenance';
import { economicFixture, jevChoice } from './helpers/economicEngine';
import { buildDecisionEnvelope, validateJevResponse } from '../src/services/jevWitness';
import { judgeEconomicDecision } from '../src/services/judge';
import { sealReceipt, hashCanonical } from '../src/services/receiptIntegrityService';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { issuerFixture } from './helpers/judgmentIssuer';
import type { ExecutionAuthorization } from '../src/schemas/economicEngine';
import type { LocalSimulationDomain } from '../src/security/evidenceProvenance';
import { DatabaseSync } from 'node:sqlite';
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader } from '@x402/core/http';
import { createJudgmentService } from '../src/services/judgmentService';
import { setupJudgment } from './helpers/judgments';

afterEach(() => vi.unstubAllEnvs());

async function temp(work: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'spender-successor-'));
  try {
    await work(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('typed simulation provenance boundary', () => {
  it('rejects live/simulated cross-domain evidence and serialized or forged domain objects', () => {
    const domain = localSimulationDomain();
    expect(isLocalSimulationDomain(domain)).toBe(true);
    expect(eligibleEvidenceProvenance({ ...localSimulationProvenance }, domain)).toBe(true);
    expect(eligibleEvidenceProvenance({ ...localSimulationProvenance })).toBe(false);
    expect(eligibleEvidenceProvenance({ catalog_source: 'live', simulation: true })).toBe(false);
    expect(eligibleEvidenceProvenance({ catalog_source: 'live', simulation: 'true' })).toBe(false);
    expect(eligibleEvidenceProvenance({ catalog_source: 'live' }, domain)).toBe(false);
    expect(
      eligibleEvidenceProvenance({ ...localSimulationProvenance }, {
        kind: 'local-simulation',
        real_spending: false,
      } as LocalSimulationDomain),
    ).toBe(false);
    expect(
      LocalSimulationProvenanceSchema.safeParse({
        ...localSimulationProvenance,
        catalog_source: 'live',
      }).success,
    ).toBe(false);
    // @ts-expect-error A deserialized flag is not the host-only branded domain.
    const invalid: LocalSimulationDomain = { kind: 'local-simulation', real_spending: false };
    expect(isLocalSimulationDomain(invalid)).toBe(false);
  });
  it('cannot authorize a real chain operation even with fully bound simulated evidence', async () => {
    const f = await economicFixture(),
      job = f.job,
      now = new Date('2026-10-08T00:00:02Z'),
      envelope = buildDecisionEnvelope(job, now);
    const observation = sealReceipt('observation', {
      ...f.observation,
      provenance: { ...localSimulationProvenance },
    });
    const result = judgeEconomicDecision({
      job,
      envelope,
      witness: validateJevResponse(job, envelope, jevChoice(), now),
      observations: [observation],
      authenticatedPrincipal: job.principal_id,
      enabledProfiles: [job.candidates[0].operation!.profile_id],
      now,
      evidenceDomain: localSimulationDomain(),
    });
    expect(result.decision).toBe('do_not_spend');
    expect(result.rules).toEqual(['simulation_real_spending_forbidden']);
    expect(
      judgeEconomicDecision({
        job,
        envelope,
        witness: validateJevResponse(job, envelope, jevChoice(), now),
        observations: [observation],
        authenticatedPrincipal: job.principal_id,
        enabledProfiles: [job.candidates[0].operation!.profile_id],
        now,
      }).decision,
    ).toBe('insufficient_evidence');
  });
  it('rejects simulated canonical evidence in a normal judgment service', async () => {
    const f = await setupJudgment({}, { provenance: { ...localSimulationProvenance } });
    const result = await f.service.check(
      (await import('./helpers/judgmentFixtures')).request,
      'simulation-in-production',
    );
    expect(result.response.decision).toBe('insufficient_evidence');
    expect(f.facilitator.settle).not.toHaveBeenCalled();
  });
  it('refuses to pair simulated storage with a live gateway', async () => {
    const f = await setupJudgment(),
      { legacy } = await import('./helpers/judgmentFixtures');
    expect(() =>
      createJudgmentService({
        store: Object.assign(f.store, { evidenceDomain: localSimulationDomain() }),
        journal: f.journal,
        gateway: f.gateway,
        legacyCheck: () => legacy,
        observations: async () => [f.observation],
        threshold: 80,
        ttlMs: 60000,
        amount: '0.01',
      }),
    ).toThrow('simulation_gateway_required');
  });
});

it('refuses simulation domains in production issuance', async () => {
  const f = await setupJudgment(),
    { legacy } = await import('./helpers/judgmentFixtures');
  const domain = localSimulationDomain();
  vi.stubEnv('NODE_ENV', 'production');
  expect(() =>
    createJudgmentService({
      store: Object.assign(f.store, { evidenceDomain: domain }),
      journal: f.journal,
      gateway: { ...f.gateway, evidenceDomain: domain },
      legacyCheck: () => legacy,
      observations: async () => [f.observation],
      threshold: 80,
      ttlMs: 60000,
      amount: '0.01',
    }),
  ).toThrow('simulation_production_forbidden');
});

describe('localhost canonical HTTP lifecycle', () => {
  it('bounds transports and agent intent before any I/O', async () => {
    const transport = vi.fn();
    expect(() => localFetch('https://radar.infopunks.fun', transport)).toThrow(
      'local_origin_required',
    );
    const fetch = localFetch('http://127.0.0.1:1234', transport);
    await expect(fetch('https://example.com')).rejects.toThrow('remote_transport_hold');
    await expect(fetch('http://127.0.0.1:9999')).rejects.toThrow('remote_transport_hold');
    expect(transport).not.toHaveBeenCalled();
    const submit = vi.fn(),
      tool = boundedIntentTool(new Map([[tasks[0].id, tasks[0]]]), submit);
    expect(() => tool.invoke({ task: tasks[0].id, wallet: 'injected' })).toThrow(
      'bounded_intent_denied',
    );
    expect(() => tool.invoke('unknown')).toThrow('bounded_intent_denied');
    expect(submit).not.toHaveBeenCalled();
  });
  it(
    'uses one simulated payment, reconciles encrypted SDK state across SIGKILL, then gates and recovers the local provider',
    () =>
      temp(async (dir) => {
        const port = await freePort(),
          database = join(dir, 'http.sqlite');
        let lab = await startHttpLab(database, port);
        let controller = await openController(join(dir, 'controller'), lab);
        try {
          const input = await seedHttpEvidence(lab, 'lab-' + tasks[0].id, tasks[0].probe),
            encryptionKey = randomBytes(32),
            directory = join(dir, 'sessions');
          const events: string[] = [];
          const client = lab.client({
            sessionStore: createEncryptedJudgmentSessionStore({ directory, encryptionKey }),
            onTransition: (e) => events.push(e.to),
            fetch: async (...args) => {
              const r = await lab.transport(...args);
              if (new Headers(args[1]?.headers).has('payment-signature'))
                throw new Error('simulated_lost_http_response');
              return r;
            },
          });
          await expect(client.judge(input, { idempotencyKey: 'crashed' })).rejects.toMatchObject({
            state: 'PAYMENT_PENDING_RECONCILIATION',
          });
          expect(events).toContain('PAYMENT_REQUIRED');
          expect(await lab.counts()).toBe(1);
          expect(lab.authorizations).toBe(1);
          controller.close();
          await lab.close(true);
          lab = await startHttpLab(database, port);
          controller = await openController(join(dir, 'controller'), lab);
          const sdk = radarSdkAssessment(lab, {
            sessionStore: createEncryptedJudgmentSessionStore({ directory, encryptionKey }),
          });
          const resumed = await sdk.resumeJudgment('crashed');
          expect(resumed.verification).toMatchObject({
            issuer: 'verified',
            integrity: true,
            execution_authorized: false,
          });
          expect((await sdk.resumeJudgment('crashed')).receipt).toEqual(resumed.receipt);
          expect(await lab.counts()).toBe(1);
          expect(lab.authorizations).toBe(0);
          await expect(
            controller.issue(
              { ...resumed, verification: { ...resumed.verification!, issuer: 'unverified' } },
              tasks[0],
            ),
          ).rejects.toThrow('verified_assessment_required');
          await expect(
            controller.issue(
              { ...resumed, valid_until: new Date(Date.now() + 86400000).toISOString() },
              tasks[0],
            ),
          ).rejects.toThrow('verified_assessment_required');
          const issued = await controller.issue(resumed, tasks[0]);
          expect(() =>
            controller.check(issued.capability, tasks[0], new Date(resumed.valid_until)),
          ).toThrow('local_provider_capability_denied');
          expect(() =>
            controller.check(resumed.receipt as unknown as ExecutionAuthorization, tasks[0]),
          ).toThrow('local_provider_capability_denied');
          const forged = structuredClone(issued.capability);
          forged.payload.operation.recipient = 'attacker';
          expect(() => controller.check(forged, tasks[0])).toThrow(
            'local_provider_capability_denied',
          );
          expect(() => controller.check(issued.capability, { ...tasks[0], input: [999] })).toThrow(
            'local_provider_capability_denied',
          );
          await expect(controller.execute(issued.capability, tasks[0], true)).rejects.toThrow(
            'simulated_provider_response_lost',
          );
          expect(controller.charges()).toBe(1);
          controller.close();
          controller = await openController(join(dir, 'controller'), lab);
          const recovered = controller.reconcile(issued.capability, tasks[0]);
          expect(recovered.output).toBe(11);
          const replays = await Promise.all(
            Array.from({ length: 20 }, () => controller.execute(issued.capability, tasks[0])),
          );
          expect(new Set(replays.map(hashCanonical)).size).toBe(1);
          expect(controller.charges()).toBe(1);
          const archive = await controller.receipt(issued, tasks[0], recovered);
          expect(archive.execution.parent_hash).toBe(resumed.receipt!.receipt_hash);
          expect(archive.judgment.payment_receipt_ref).toMatch(/^simulation:x402\//);
          const noProof = await lab.transport(lab.origin + '/v1/pre-spend/check', {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + localApiKey,
              'content-type': 'application/json',
              'idempotency-key': 'crashed',
            },
            body: JSON.stringify(input),
          });
          expect(noProof.status).toBe(401);
          const quote = await lab.transport(lab.origin + '/v1/pre-spend/check', {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + localApiKey,
              'content-type': 'application/json',
              'idempotency-key': 'real-proof-denied',
            },
            body: JSON.stringify(input),
          });
          expect(quote.status).toBe(402);
          const challenge = decodePaymentRequiredHeader(quote.headers.get('payment-required')!);
          const proof = encodePaymentSignatureHeader({
            x402Version: 2,
            accepted: challenge.accepts[0],
            payload: {
              signature: '0x' + 'a'.repeat(130),
              authorization: { nonce: '0x' + 'b'.repeat(64) },
            },
          });
          const denied = await lab.transport(lab.origin + '/v1/pre-spend/check', {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + localApiKey,
              'content-type': 'application/json',
              'idempotency-key': 'real-proof-denied',
              'payment-signature': proof,
            },
            body: JSON.stringify(input),
          });
          expect(denied.status).not.toBe(200);
          expect(await lab.counts()).toBe(1);
          const slow = tasks.find((t) => t.id === 'slow-render')!,
            slowInput = await seedHttpEvidence(lab, 'lab-' + slow.id, slow.probe),
            slowResult = await lab
              .client()
              .judge(slowInput, { idempotencyKey: 'parallel-provider' }),
            slowIssued = await controller.issue(slowResult, slow);
          const contenders = await Promise.allSettled(
            Array.from({ length: 20 }, () => controller.execute(slowIssued.capability, slow)),
          );
          expect(contenders.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
          expect(controller.charges()).toBe(2);
          const providerDb = new DatabaseSync(join(dir, 'controller', 'controller.sqlite'));
          providerDb
            .prepare("UPDATE local_deliveries SET body='{}' WHERE id=?")
            .run(issued.capability.payload.authorization_id);
          providerDb.close();
          expect(() => controller.reconcile(issued.capability, tasks[0])).toThrow(
            'local_delivery_corruption',
          );
          const keys = createJudgmentIssuer(issuerFixture()).publicKeys();
          await expect(
            lab.client({ trustedIssuer: keys }).judge(input, { idempotencyKey: 'wrong-issuer' }),
          ).rejects.toMatchObject({ state: 'RECEIPT_VERIFICATION_FAILED' });
        } finally {
          controller.close();
          await lab.close();
        }
      }),
    30000,
  );
  it(
    'refuses a corrupted durable HTTP journal on restart',
    () =>
      temp(async (dir) => {
        const port = await freePort(),
          database = join(dir, 'corrupt.sqlite');
        const lab = await startHttpLab(database, port);
        try {
          const input = await seedHttpEvidence(lab, 'lab-' + tasks[0].id, tasks[0].probe);
          await lab.client().judge(input, { idempotencyKey: 'corrupt' });
        } finally {
          await lab.close();
        }
        const db = new DatabaseSync(database);
        db.prepare(
          "UPDATE http_events SET body='{}' WHERE seq=(SELECT min(seq) FROM http_events)",
        ).run();
        db.close();
        await expect(startHttpLab(database, port)).rejects.toThrow('http_event_corruption');
      }),
    30000,
  );
});

describe('blinded paired benchmark and separate evaluator', () => {
  it(
    'labels actual task outputs before decisions, reports negative net results and verifies signed complete lineage',
    () =>
      temp(async (dir) => {
        const output = join(dir, 'benchmark'),
          metrics = await runBenchmark(output);
        expect(metrics.unique_tasks).toBe(20);
        expect(metrics.unique_families).toBe(20);
        expect(metrics.unique_provider_implementations).toBe(20);
        expect(metrics.repetitions_per_task).toBe(1);
        expect(metrics.status).toBe('HOLD');
        expect(metrics.economic_usefulness).toBe('NOT_ESTABLISHED');
        expect(metrics.paired_net_difference_units).toBeLessThan(0);
        expect(metrics.radar.false_blocks).toBeGreaterThan(0);
        expect(metrics.radar.correct_abstentions).toBeGreaterThan(0);
        expect(metrics.radar.prevented_losses_units).toBeGreaterThan(0);
        expect(metrics.radar.net_units - metrics.baseline.net_units).toBe(
          metrics.paired_net_difference_units,
        );
        expect(
          metrics.radar.prevented_losses_units -
            metrics.radar.missed_gains_units -
            metrics.radar.judgment_fees_units,
        ).toBe(metrics.paired_net_difference_units);
        const trust = JSON.parse(readFileSync(join(output, 'trust.json'), 'utf8')),
          commitment = JSON.parse(readFileSync(join(output, 'label-commitment.json'), 'utf8')),
          reveal = JSON.parse(readFileSync(join(output, 'labels.json'), 'utf8'));
        expect(verifyAttestation(commitment, trust.evaluator_public_key)).toBe(true);
        expect(verifyAttestation(reveal, trust.evaluator_public_key)).toBe(true);
        expect(hashCanonical(reveal.body.labels)).toBe(commitment.body.commitment);
        const lineage = JSON.parse(readFileSync(join(output, 'lineage.json'), 'utf8'));
        expect(lineage.filter((x: any) => x.archive).length).toBeGreaterThan(0);
        for (const item of lineage.filter((x: any) => x.archive))
          expect(verifyAttestation(item.evaluator_attestation, trust.evaluator_public_key)).toBe(
            true,
          );
        expect(
          lineage.find((x: any) => x.task_id === 'sort-prices').evaluator_attestation.body.outcome,
        ).toBe('contradicted');
        const copied = lineage.find((x: any) => x.archive).archive;
        const liveStore = new MemoryCanonicalReceiptStore(80, createJudgmentIssuer(trust.judgment));
        for (const observation of copied.observations)
          await liveStore.append('observation', observation);
        await liveStore.appendDecisionContext(copied.context);
        await expect(liveStore.append('judgment', copied.judgment)).rejects.toThrow(
          'simulation_receipt_domain_required',
        );
        const original = lineage.find((x: any) => x.archive).evaluator_attestation,
          forged = structuredClone(original);
        forged.body.outcome = 'contradicted';
        expect(verifyAttestation(forged, trust.evaluator_public_key)).toBe(false);
        const controllerKey = generateKeyPairSync('ed25519');
        forged.signature = sign(
          null,
          Buffer.from(JSON.stringify(forged.body)),
          controllerKey.privateKey,
        ).toString('base64');
        expect(verifyAttestation(forged, trust.evaluator_public_key)).toBe(false);
        const evaluator = await startEvaluator(join(dir, 'adversarial-evaluator'));
        try {
          await expect(evaluator.request({ kind: 'attest', outcome: 'confirmed' })).rejects.toThrow(
            'evaluator_trust_not_pinned',
          );
          await evaluator.request({
            kind: 'configure',
            judgment: trust.judgment,
            execution: trust.execution,
          });
          await expect(
            evaluator.request({
              kind: 'configure',
              judgment: trust.judgment,
              execution: trust.execution,
            }),
          ).rejects.toThrow('evaluator_trust_already_pinned');
          const specs = tasks.map(({ probe, implementation, ...spec }) => spec);
          await evaluator.request({ kind: 'commit', specs, auditDirectory: join(output, 'audit') });
          const badPath = join(dir, 'bad-decisions.json');
          writeFileSync(badPath, '[]');
          await expect(
            evaluator.request({
              kind: 'reveal',
              decisionsPath: badPath,
              decisionsHash: 'sha256:' + '0'.repeat(64),
            }),
          ).rejects.toThrow('decisions_changed');
          const item = lineage.find((x: any) => x.archive),
            archive = structuredClone(item.archive);
          archive.execution.response_hash = 'sha256:' + '0'.repeat(64);
          const archivePath = join(dir, 'forged-archive.json');
          writeFileSync(archivePath, JSON.stringify(archive));
          await expect(
            evaluator.request({
              kind: 'attest',
              archivePath,
              deliveryPath: join(output, 'controller', item.task_id + '.delivery.json'),
            }),
          ).rejects.toThrow('attestation_lineage_invalid');
        } finally {
          await evaluator.close();
        }
      }),
    60000,
  );
});
