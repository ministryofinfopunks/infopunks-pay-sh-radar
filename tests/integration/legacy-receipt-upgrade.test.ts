import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { canonicalSerialize, hashCanonical, sealReceipt, verifyReceiptIntegrity } from '../../src/services/receiptIntegrityService';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { judgmentInput, observationInput } from '../helpers/canonicalReceipts';
import type { JudgmentReceipt } from '../../src/schemas/receipts';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('upgrade from supported migration 017 history', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => { await close?.(); close = undefined; });

  it('preserves a signed v1 judgment and legacy CALL payload through migrations 018–021', async () => {
    const prior = readdirSync('migrations').filter((file) => file.endsWith('.up.sql') && Number(file.match(/_(\d{3})_/)?.[1]) <= 17)
      .sort().map((file) => file.replace(/\.up\.sql$/, ''));
    const database = await createCanonicalTestDatabase(url!, 'legacy_upgrade', prior);
    close = database.close;
    const pair = generateKeyPairSync('ed25519');
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const issuer = createJudgmentIssuer({ issuer: 'legacy-upgrade-test', activeKeyId: 'historic-v1', privateKeyPem: privateKey,
      keys: [{ key_id: 'historic-v1', public_key_pem: publicKey, valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z', revoked: false }] });
    const rawObservation = observationInput();
    const observation = sealReceipt('observation', { ...rawObservation, schema_version: 'canonical-receipts.v1' as const, payload_hash: hashCanonical(rawObservation.payload) });
    const unsigned = sealReceipt('judgment', { ...judgmentInput(), schema_version: 'canonical-receipts.v1' as const,
      policy_version: 'receipt-authority.v1', proceed_confidence_threshold: 80, parent_hashes: [observation.receipt_hash] });
    const signed = issuer.sign(unsigned as JudgmentReceipt);
    const legacyCall = { receipt_id: 'IP-CALL-LEGACY-UPGRADE', protocol_receipt_type: 'CALL', domain: 'infopunks.4663.call.v1',
      signature: 'historical-signature-bytes', payload_hash: 'sha256:' + 'c'.repeat(64), window_id: 'rh4663:2026-08-13' };
    const client = await database.pool.connect();
    try {
      await client.query('begin');
      await client.query('insert into observation_receipts(observation_id,observed_at,receipt_hash,receipt,subject_type,subject_id) values($1,$2,$3,$4::jsonb,$5,$6)',
        [observation.observation_id, observation.observed_at, observation.receipt_hash, canonicalSerialize(observation), observation.subject_type, observation.subject_id]);
      await client.query('insert into judgment_receipts(judgment_id,issued_at,receipt_hash,receipt,subject_type,subject_id) values($1,$2,$3,$4::jsonb,$5,$6)',
        [signed.judgment_id, signed.issued_at, signed.receipt_hash, canonicalSerialize(signed), signed.subject_type, signed.subject_id]);
      await client.query('insert into judgment_observations(judgment_id,observation_id) values($1,$2)', [signed.judgment_id, observation.observation_id]);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    await database.pool.query('insert into rh_4663_pulse_calls(receipt_id,wallet,window_id,created_at,payload) values($1,$2,$3,$4,$5::jsonb)',
      [legacyCall.receipt_id, '0x' + '1'.repeat(40), legacyCall.window_id, '2026-08-13T12:00:00Z', canonicalSerialize(legacyCall)]);
    const before = await database.pool.query('select receipt from judgment_receipts where judgment_id=$1', [signed.judgment_id]);
    const callBefore = await database.pool.query('select payload from rh_4663_pulse_calls where receipt_id=$1', [legacyCall.receipt_id]);

    for (const migration of ['20261008_018_decision_context', '20261008_019_execution_score_eligibility', '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts']) {
      await database.pool.query(readFileSync(`migrations/${migration}.up.sql`, 'utf8'));
    }
    const after = await database.pool.query('select receipt from judgment_receipts where judgment_id=$1', [signed.judgment_id]);
    const callAfter = await database.pool.query('select payload from rh_4663_pulse_calls where receipt_id=$1', [legacyCall.receipt_id]);
    expect(canonicalSerialize(after.rows[0].receipt)).toBe(canonicalSerialize(before.rows[0].receipt));
    expect(after.rows[0].receipt.receipt_hash).toBe(signed.receipt_hash);
    expect(after.rows[0].receipt.issuer_signature).toEqual(signed.issuer_signature);
    expect(issuer.verify(after.rows[0].receipt)).toBe(true);
    expect(verifyReceiptIntegrity('judgment', after.rows[0].receipt)).toBe(true);
    expect(canonicalSerialize(callAfter.rows[0].payload)).toBe(canonicalSerialize(callBefore.rows[0].payload));
  });
});
