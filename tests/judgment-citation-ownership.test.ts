import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryJudgmentRequestRepository, PostgresJudgmentRequestRepository, type JudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';
import { setupJudgment, request } from './helpers/judgments';
import { judgmentRequestKey } from '../src/repositories/judgmentRequestRepository';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const a = { tenant_id: 'tenant-a', agent_id: request.agent_id };
const b = { tenant_id: 'tenant-b', agent_id: request.agent_id };
async function recordFixture() {
  const f = await setupJudgment();
  await f.service.check(request, 'template');
  return (await f.journal.get(judgmentRequestKey(request.agent_id, 'template')))!;
}
async function repository(mode: string): Promise<{ journal: JudgmentRequestRepository; close: () => Promise<void> }> {
  if (mode === 'memory') return { journal: new MemoryJudgmentRequestRepository(), close: async () => {} };
  const db = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'citation_owner', [
    '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests'
  ]);
  return { journal: new PostgresJudgmentRequestRepository(db.pool), close: db.close };
}
for (const mode of ['memory', 'postgres']) {
  describe.skipIf(mode === 'postgres' && !process.env.CANONICAL_RECEIPT_TEST_URL)(mode + ' scoped citation ownership', () => {
    it('serializes concurrent same-agent citations from different tenants without granting both owners', async () => {
      const f = await repository(mode); const base = await recordFixture();
      try {
        const results = await Promise.allSettled([
          f.journal.quote('tenant-a', { ...base, owner: a }),
          f.journal.quote('tenant-b', { ...base, owner: b })
        ]);
        expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find(row => row.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason.message).toBe('judgment_observation_ownership_conflict');
        const winners = [await f.journal.ownsObservation!(a, base.response.cited_observations[0]),
          await f.journal.ownsObservation!(b, base.response.cited_observations[0])];
        expect(winners.filter(Boolean)).toHaveLength(1);
      } finally { await f.close(); }
    });

    it('rejects owner, request, judgment identity and citation rebinding while allowing settlement metadata updates', async () => {
      const f = await repository(mode); const base = { ...await recordFixture(), owner: a };
      try {
        await f.journal.quote('owned', base);
        const changed = [
          { ...base, owner: b }, { ...base, request_hash: 'sha256:' + '0'.repeat(64) },
          { ...base, response: { ...base.response, judgment_id: 'foreign-judgment' } },
          { ...base, response: { ...base.response, cited_observations: ['foreign-observation'] } }
        ];
        for (const row of changed) {
          await expect(f.journal.save('owned', row)).rejects.toThrow('judgment_ownership_immutable');
          expect(await f.journal.get('owned')).toEqual(base);
        }
        await f.journal.save('owned', { ...base, state: 'settling' });
        expect((await f.journal.get('owned'))?.owner).toEqual(a);
      } finally { await f.close(); }
    });

    it('does not convert an unbound historical citation into tenant ownership', async () => {
      const f = await repository(mode); const base = await recordFixture();
      try {
        await f.journal.quote('historical-unbound', base);
        expect(await f.journal.ownsObservation!(a, base.response.cited_observations[0])).toBe(false);
        await expect(f.journal.quote('new-owner', { ...base, owner: a })).rejects.toThrow('judgment_observation_ownership_conflict');
        expect(await f.journal.get('new-owner')).toBeNull();
      } finally { await f.close(); }
    });
  });
}

it('fails closed before a quote or settlement when another tenant already cites the same observation', async () => {
  const f = await setupJudgment();
  await f.service.check(request, 'a', undefined, a);
  await expect(f.service.check(request, 'b', undefined, b)).rejects.toMatchObject({ statusCode: 503, code: 'judgment_evidence_ownership_unavailable' });
  expect(f.facilitator.verify).not.toHaveBeenCalled(); expect(f.facilitator.settle).not.toHaveBeenCalled();
  expect(await f.journal.get(judgmentRequestKey(request.agent_id, 'b', b))).toBeNull();
});
