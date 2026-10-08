import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { IndependentReviewBundleSchema } from '../src/schemas/decisionsIndependentReview';

const Packet = z.object({ schema_version: z.literal('decisions-blinded-review-packet.v1'),
  cases: z.array(z.object({ review_case_id: z.string(), stimulus_sha256: z.string(),
    source_class: z.enum(['synthetic_fixture', 'historical_canonical']) }).passthrough()).min(1)
}).passthrough();
function digest(text: string) { return createHash('sha256').update(text).digest('hex'); }

export function freezeReviewBundle(packetText: string, reviewsText: string) {
  const packet = Packet.parse(JSON.parse(packetText));
  const reviews = IndependentReviewBundleSchema.parse(JSON.parse(reviewsText));
  if (reviews.packet_sha256 !== digest(packetText) || reviews.records.length !== packet.cases.length) throw new Error('review_packet_mismatch');
  if (new Set(packet.cases.map(value => value.source_class)).size !== 1) throw new Error('mixed_source_class_not_allowed');
  const packetCases = new Map(packet.cases.map(value => [value.review_case_id, value.stimulus_sha256]));
  for (const record of reviews.records) {
    if (packetCases.get(record.review_case_id) !== record.stimulus_sha256) throw new Error('review_stimulus_mismatch');
  }
  return {
    schema_version: 'decisions-frozen-review-bundle.v1',
    source_class: packet.cases[0].source_class, status: 'structure_validated_external_identity_pending',
    packet_sha256: digest(packetText), review_bundle_sha256: digest(reviewsText),
    reviewer_roster_attestation_sha256: reviews.reviewer_roster_attestation_sha256,
    case_count: reviews.records.length, records: reviews.records
  };
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 6 || args[0] !== '--packet' || args[2] !== '--reviews' || args[4] !== '--output-dir') throw new Error('invalid_arguments');
  const packetPath = resolve(args[1]), reviewPath = resolve(args[3]), outputDir = resolve(args[5]);
  const frozen = freezeReviewBundle(readFileSync(packetPath, 'utf8'), readFileSync(reviewPath, 'utf8'));
  const frozenText = JSON.stringify(frozen, null, 2) + '\n';
  const output = join(outputDir, `decisions-review-${digest(frozenText)}.json`);
  const fd = openSync(output, 'wx', 0o600);
  try { writeFileSync(fd, frozenText); }
  finally { closeSync(fd); }
  process.stdout.write(`Content-addressed review bundle written: ${output}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { process.stderr.write('decisions_review_freeze_failed; inspect packet, assessments and output directory\n'); process.exitCode = 1; }
}
