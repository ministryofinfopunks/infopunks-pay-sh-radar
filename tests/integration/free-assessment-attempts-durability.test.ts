import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { request, legacy } from '../helpers/judgments';
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('free assessment attempt durability', () => {
  it('keeps same-key output after restart and refuses mutation', async () => {
    const db = await createCanonicalTestDatabase(url!, 'free_attempt', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261008_021_free_assessment_attempts']);
    try {
      const first = new PostgresJudgmentRequestRepository(db.pool);
      const input = { request_key: hashCanonical({ key: 'one' }), request_hash: hashCanonical(request), assessed_at: '2026-10-07T00:00:02Z', legacy,
        response: { judgment_id: 'free-1', decision: 'insufficient_evidence' as const, confidence: 0, issued_at: '2026-10-07T00:00:02Z',
          valid_until: '2026-10-07T00:00:02Z', reasons: ['missing evidence'], cited_observations: [], cost: { amount: '0', asset: 'USDC' as const },
          payment_required: false, receipt: null } };
      const saved = await first.recordFreeAttempt(input);
      const restored = new PostgresJudgmentRequestRepository(db.pool);
      expect(await restored.getFreeAttempt(input.request_key)).toEqual(saved);
      expect(await restored.recordFreeAttempt({ ...input, assessed_at: '2026-10-08T00:00:00Z' })).toEqual(saved);
      await expect(db.pool.query('delete from free_assessment_attempts')).rejects.toMatchObject({ code: '55000' });
    } finally { await db.close(); }
  });
});
