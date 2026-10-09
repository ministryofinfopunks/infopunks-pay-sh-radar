import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const Ref = z.string().min(1).nullable();
const RunFreeze = z.object({
  schema_version: z.literal('decisions-e1-run-freeze.v1'),
  run_id: z.string().min(1),
  dispatch_enabled: z.literal(false),
  external_requests_enabled: z.literal(false),
  financial_settlement_enabled: z.literal(false),
  openai_decisions_authorization_enabled: z.literal(false),
  provider: z.object({
    name: z.string().min(1), endpoint: z.string().url(), method: z.literal('GET'), station: z.string().min(1),
    network: z.literal('eip155:8453'), asset: z.literal('USDC'), maximum_service_amount: z.string().min(1),
    required_quote_mode: z.literal('live_telemetry'),
    response_schema_sha256: Ref, provider_request_id_field: Ref,
    provider_side_record_verification_method: Ref, provider_identity_independent_verification_ref: Ref
  }).strict(),
  task: z.object({ reviewer_acceptance_of_source_overlap_ref: Ref }).passthrough(),
  policy: z.object({ deterministic_policy_commit: Ref, configuration_digest: Ref, evidence_freshness_limit_seconds: z.number().positive().nullable() }).passthrough(),
  environment: z.object({
    isolated_staging_ref: Ref, dedicated_postgres_ref: Ref, backup_restore_verification_ref: Ref,
    test_judgment_issuer_id: Ref, test_judgment_public_key_registry_sha256: Ref,
    production_key_separation_review_ref: Ref, base_rpc_verification_ref: Ref, judgment_rail_facilitator_ref: Ref
  }).strict(),
  approvals: z.object({
    operator_identity_ref: Ref, operator_run_approval_ref: Ref, financial_approval_ref: Ref,
    provider_request_approval_ref: Ref, settlement_approval_ref: Ref,
    independent_blinded_reviewer_ref: Ref, independent_outcome_reviewer_ref: Ref
  }).strict(),
  freeze: z.object({
    frozen_at: Ref, freeze_content_sha256: Ref, signed_by_operator_ref: Ref, signed_by_independent_reviewer_ref: Ref
  }).passthrough()
}).passthrough();

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function at(root: JsonRecord, ...path: string[]): unknown {
  let value: unknown = root;
  for (const segment of path) value = isRecord(value) ? value[segment] : undefined;
  return value;
}
function requiredRefs(root: JsonRecord): string[] {
  const paths = [
    ['provider', 'response_schema_sha256'], ['provider', 'provider_request_id_field'],
    ['provider', 'provider_side_record_verification_method'], ['provider', 'provider_identity_independent_verification_ref'],
    ['task', 'reviewer_acceptance_of_source_overlap_ref'], ['policy', 'deterministic_policy_commit'],
    ['policy', 'configuration_digest'], ['policy', 'evidence_freshness_limit_seconds'],
    ...(['isolated_staging_ref', 'dedicated_postgres_ref', 'backup_restore_verification_ref', 'test_judgment_issuer_id',
      'test_judgment_public_key_registry_sha256', 'production_key_separation_review_ref', 'base_rpc_verification_ref'].map(key => ['environment', key])),
    ...(['operator_identity_ref', 'operator_run_approval_ref', 'financial_approval_ref', 'provider_request_approval_ref',
      'settlement_approval_ref', 'independent_blinded_reviewer_ref', 'independent_outcome_reviewer_ref'].map(key => ['approvals', key])),
    ...(['frozen_at', 'freeze_content_sha256', 'signed_by_operator_ref', 'signed_by_independent_reviewer_ref'].map(key => ['freeze', key]))
  ];
  return paths.filter(path => {
    const value = at(root, ...path);
    return value === null || value === undefined || value === '';
  }).map(path => path.join('.'));
}

export function inspectE1RunFreeze(raw: unknown) {
  const parsed = RunFreeze.safeParse(raw);
  if (!parsed.success) return { valid: false as const, blockers: ['run_freeze_schema_or_safety_flags_invalid'] };
  const value = parsed.data as unknown as JsonRecord;
  const blockers = requiredRefs(value);
  const endpoint = String(at(value, 'provider', 'endpoint'));
  if (endpoint !== 'https://runwayoracle.com/v1/oracle/v3/ord-edge') blockers.push('provider_endpoint_not_pinned');
  return { valid: true as const, run_id: parsed.data.run_id, dispatch_enabled: false as const, blockers };
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('usage: prepare-e1-run <run-freeze-json>');
  const input = JSON.parse(readFileSync(resolve(args[0]), 'utf8')) as unknown;
  const result = inspectE1RunFreeze(input);
  if (!result.valid) {
    process.stdout.write(`E1 preflight blocked: ${result.blockers.join(', ')}\n`);
    process.exitCode = 2;
    return result;
  }
  process.stdout.write(`E1 preflight ${result.blockers.length ? 'blocked' : 'references_complete_for_external_review'}: ${result.blockers.length} gate references missing; dispatch remains disabled; signatures and approval authenticity are not verified; no network, database, or payment action was attempted.\n`);
  for (const blocker of result.blockers) process.stdout.write(`- ${blocker}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { process.stderr.write('E1 preflight failed; no external action was attempted\n'); process.exitCode = 1; }
}
