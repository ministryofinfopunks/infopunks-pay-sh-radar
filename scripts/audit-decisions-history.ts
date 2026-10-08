import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { z } from 'zod';
import { createJudgmentIssuer, JudgmentIssuerKeySchema } from '../src/security/judgmentIssuer';
import { auditHistoricalReceipts, type HistoricalReceipts } from '../src/services/decisionsEvidenceAudit';

const Tables = {
  observation: { table: 'observation_receipts', id: 'observation_id' },
  judgment: { table: 'judgment_receipts', id: 'judgment_id' },
  execution: { table: 'execution_receipts', id: 'execution_id' },
  evaluation: { table: 'evaluation_receipts', id: 'evaluation_id' }
} as const;
const TrustFile = z.object({ issuer: z.string().min(1), keys: z.array(JudgmentIssuerKeySchema).min(1) }).strict();
const DEFAULT_MAX_ROWS = 10000;

function parseArgs(args: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || values.has(key)) throw new Error('invalid_arguments');
    values.set(key, value);
  }
  if (!values.has('--output') || [...values.keys()].some(key => !['--output', '--schema', '--max-rows', '--issuer-trust'].includes(key))) throw new Error('invalid_arguments');
  const schema = values.get('--schema') ?? 'public';
  const maxRows = Number(values.get('--max-rows') ?? DEFAULT_MAX_ROWS);
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema) || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 100000) throw new Error('invalid_limits');
  return { output: resolve(values.get('--output')!), schema, maxRows, trustPath: values.get('--issuer-trust') ? resolve(values.get('--issuer-trust')!) : null };
}
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }

/** The only database statements in this command are read-only transaction control and SELECTs. */
export async function readHistoricalReceipts(url: string, schema: string, maxRows: number) {
  const client = new pg.Client({ connectionString: url, application_name: 'decisions_history_readonly', statement_timeout: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const context = await client.query<{ read_only: string; database_name: string; snapshot_id: string }>(
      "SELECT current_setting('transaction_read_only') AS read_only, current_database() AS database_name, txid_current_snapshot()::text AS snapshot_id"
    );
    if (context.rows[0]?.read_only !== 'on') throw new Error('read_only_transaction_required');
    const records = { observation: [], judgment: [], execution: [], evaluation: [] } as HistoricalReceipts;
    for (const [kind, meta] of Object.entries(Tables) as Array<[keyof typeof Tables, (typeof Tables)[keyof typeof Tables]]>) {
      const relation = `${schema}.${meta.table}`;
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        const result = await client.query<{ allowed: boolean }>('SELECT has_table_privilege(current_user, $1, $2) AS allowed', [relation, privilege]);
        if (result.rows[0]?.allowed) throw new Error('dedicated_read_only_role_required');
      }
      const result = await client.query<{ receipt: unknown }>(`SELECT receipt FROM "${schema}"."${meta.table}" ORDER BY "${meta.id}" LIMIT $1`, [maxRows + 1]);
      if (result.rows.length > maxRows) throw new Error('receipt_row_cap_exceeded');
      records[kind] = result.rows.map(row => row.receipt);
    }
    await client.query('ROLLBACK');
    return { records, source_fingerprint_sha256: sha256(`${context.rows[0].database_name}/${schema}`), snapshot_id: context.rows[0].snapshot_id };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { await client.end(); }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const flags = parseArgs(args);
  const url = environment.DECISIONS_HISTORY_READONLY_DATABASE_URL;
  let report: unknown;
  if (!url) {
    report = {
      schema_version: 'decisions-history-inventory.v1', data_access_status: 'unavailable',
      source: 'canonical_postgres_not_connected', receipt_counts: null, execution_states: null,
      verified_outcome_count: null, blocker: 'DECISIONS_HISTORY_READONLY_DATABASE_URL_absent',
      note: 'Unknown historical counts are not zero. No synthetic fixture was substituted for a historical receipt.'
    };
  } else {
    const trust = flags.trustPath ? TrustFile.parse(JSON.parse(readFileSync(flags.trustPath, 'utf8'))) : null;
    const judgmentTrust = trust ? createJudgmentIssuer({ issuer: trust.issuer, keys: trust.keys, requireSigned: true }) : undefined;
    const source = await readHistoricalReceipts(url, flags.schema, flags.maxRows);
    const audit = await auditHistoricalReceipts(source.records, { judgmentTrust });
    report = {
      schema_version: 'decisions-history-inventory.v1', data_access_status: 'audited',
      source: 'direct_readonly_postgres', source_fingerprint_sha256: source.source_fingerprint_sha256,
      snapshot_id: source.snapshot_id, trust_keys_provided: Boolean(judgmentTrust),
      execution_and_outcome_external_verifiers_provided: false,
      audit
    };
  }
  const fd = openSync(flags.output, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(report, null, 2) + '\n'); }
  finally { closeSync(fd); }
  process.stdout.write(`Decisions history inventory written: ${flags.output}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch(() => { process.stderr.write('decisions_history_audit_failed; inspect read-only access and output path without printing credentials\n'); process.exitCode = 1; });
}
