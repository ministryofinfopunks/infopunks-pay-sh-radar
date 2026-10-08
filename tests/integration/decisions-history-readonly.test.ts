import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { readHistoricalReceipts } from '../../scripts/audit-decisions-history';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { auditHistoricalReceipts } from '../../src/services/decisionsEvidenceAudit';
import { appendChain } from '../helpers/canonicalReceipts';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('Decisions read-only historical inventory', () => {
  it('reads canonical rows through a SELECT-only role and rejects the writable owner', async () => {
    const adminUrl = process.env.CANONICAL_RECEIPT_TEST_URL!;
    const db = await createCanonicalTestDatabase(adminUrl, 'decisions_history', [
      '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_014_derived_score_projection'
    ]);
    const admin = new pg.Pool({ connectionString: adminUrl });
    const role = 'decisions_reader_' + randomUUID().replaceAll('-', '');
    try {
      await appendChain(new PostgresCanonicalReceiptStore(db.pool));
      await admin.query(`CREATE ROLE ${role} LOGIN`);
      await admin.query(`GRANT USAGE ON SCHEMA ${db.schema} TO ${role}`);
      await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${db.schema} TO ${role}`);
      const readonlyUrl = new URL(adminUrl);
      readonlyUrl.username = role;
      readonlyUrl.password = '';
      const source = await readHistoricalReceipts(readonlyUrl.toString(), db.schema, 10);
      expect(Object.fromEntries(Object.entries(source.records).map(([kind, rows]) => [kind, rows.length]))).toEqual({
        observation: 1, judgment: 1, execution: 1, evaluation: 1
      });
      const audit = await auditHistoricalReceipts(source.records);
      expect(audit.source_receipt_counts).toEqual({ observation: 1, judgment: 1, execution: 1, evaluation: 1 });
      expect(audit.state_counts.unverified_authority).toBe(1);
      await expect(readHistoricalReceipts(adminUrl, db.schema, 10)).rejects.toThrow('dedicated_read_only_role_required');
      await expect(readHistoricalReceipts(readonlyUrl.toString(), db.schema, 0)).rejects.toThrow('receipt_row_cap_exceeded');
    } finally {
      await db.close();
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
      await admin.end();
    }
  });
});
