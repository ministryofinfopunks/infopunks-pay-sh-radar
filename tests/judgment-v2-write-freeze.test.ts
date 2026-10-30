import { generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService, ReceiptAuthorityError } from '../src/services/receiptAuthorityService';
import { hashCanonical, sealReceipt } from '../src/services/receiptIntegrityService';
import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';
import { judgmentInput, observationInput } from './helpers/canonicalReceipts';
import { setupJudgment, request, legacy } from './helpers/judgments';
import { createJudgmentService, JudgmentError } from '../src/services/judgmentService';
import { PostgresJudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { verifyReceiptChain } from '../src/services/receiptAuthorityService';
import type { JudgmentReceipt } from '../src/schemas/receipts';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;

describe('v2 receipt write freeze', () => {
  it('rejects pre-spend writes before quote creation while the journal stays untouched', async () => {
    const fixture = await setupJudgment();
    const service = createJudgmentService({ store: fixture.store, journal: fixture.journal, gateway: fixture.gateway,
      legacyCheck: () => legacy, observations: async () => [fixture.observation], threshold: 80, ttlMs: 60_000,
      amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z'), v2ReceiptsEnabled: false });
    await expect(service.check(request, 'write-freeze')).rejects.toMatchObject({ statusCode: 503, code: 'judgment_v2_receipts_frozen' } satisfies Partial<JudgmentError>);
    expect(await fixture.journal.get('sha256:' + hashCanonical({ agent: request.agent_id, key: 'write-freeze' }).slice(7))).toBeNull();
  });

  it.skipIf(!url)('blocks v2 context and judgment writes at the PostgreSQL boundary while retaining v1 writes', async () => {
    const prior = [
      '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness',
      '20261007_014_derived_score_projection', '20261008_018_decision_context', '20261008_019_execution_score_eligibility',
      '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts', '20261008_022_publication_boundaries'
    ];
    const database = await createCanonicalTestDatabase(url!, 'v2_freeze', prior);
    const pair = generateKeyPairSync('ed25519');
    const issuer = createJudgmentIssuer({ issuer: 'synthetic-v2-freeze', activeKeyId: 'freeze-key',
      privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      keys: [{ key_id: 'freeze-key', public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z', revoked: false }] });
    try {
      const frozen = new PostgresCanonicalReceiptStore(database.pool, 80, issuer, false);
      const authority = createReceiptAuthorityService(frozen, 80, issuer);
      const fixture = await setupJudgment({}, {}, {}, issuer);
      const enabled = new PostgresCanonicalReceiptStore(database.pool, 80, issuer, true);
      await enabled.append('observation', fixture.observation);
      const journal = new PostgresJudgmentRequestRepository(database.pool);
      const service = createJudgmentService({ store: enabled, journal, gateway: fixture.gateway,
        issuer, legacyCheck: () => legacy, observations: async () => [fixture.observation], threshold: 80, ttlMs: 60_000,
        amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
      const idempotencyKey = 'frozen-fallback-seed';
      const issued = await service.check(request, idempotencyKey, fixture.signature);
      const v2 = issued.response.receipt;
      expect(v2?.schema_version).toBe('canonical-receipts.v2');
      expect(await frozen.get('judgment', v2!.judgment_id)).toEqual(v2);
      expect(await verifyReceiptChain('judgment', v2!, frozen, 80)).toBe(true);
      const frozenReplay = createJudgmentService({ store: frozen, journal, gateway: fixture.gateway, issuer,
        legacyCheck: () => legacy, observations: async () => [fixture.observation], threshold: 80, ttlMs: 60_000,
        amount: '0.01', v2ReceiptsEnabled: false });
      const replayed = await frozenReplay.check(request, idempotencyKey, fixture.signature);
      expect(replayed.response.receipt?.receipt_hash).toBe(v2!.receipt_hash);
      const observation = await authority.appendObservation(observationInput('freeze-observation'));
      const v1 = await authority.appendJudgment({ ...judgmentInput(['freeze-observation']), judgment_id: 'freeze-v1' });
      expect(v1.schema_version).toBe('canonical-receipts.v1');
      await expect(frozen.appendDecisionContext({} as never)).rejects.toMatchObject({ code: 'judgment_v2_receipts_frozen' } satisfies Partial<ReceiptAuthorityError>);
      const unsigned = sealReceipt('judgment', { ...judgmentInput(['freeze-observation']), judgment_id: 'freeze-v2',
        schema_version: 'canonical-receipts.v2' as const, policy_version: 'receipt-authority.v2', proceed_confidence_threshold: 80,
        decision_context_hash: hashCanonical({ synthetic: 'context' }), parent_hashes: [observation.receipt_hash] }) as JudgmentReceipt;
      await expect(frozen.append('judgment', issuer.sign(unsigned))).rejects.toMatchObject({ code: 'judgment_v2_receipts_frozen' } satisfies Partial<ReceiptAuthorityError>);
      expect(await frozen.get('judgment', 'freeze-v1')).toMatchObject({ schema_version: 'canonical-receipts.v1' });
      expect(await frozen.get('judgment', 'freeze-v2')).toBeNull();
    } finally { await database.close(); }
  });
});
