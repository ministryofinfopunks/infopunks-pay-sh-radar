import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QualificationCorpus } from './benchmark-decisions-live';
import { request, facts, legacy } from '../tests/helpers/judgmentFixtures';
import { observationInput } from '../tests/helpers/canonicalReceipts';
import { hashCanonical } from '../src/services/receiptIntegrityService';

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function writeNew(path: string, value: unknown) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); }
  finally { closeSync(fd); }
}

export function buildReviewPacket(raw: unknown, corpusSha256: string) {
  const corpus = QualificationCorpus.parse(raw);
  const ordered = [...corpus.cases].sort((a, b) => sha256('decisions-review-v1:' + a.id).localeCompare(sha256('decisions-review-v1:' + b.id)));
  const packetCases = ordered.map((item, index) => {
    const reviewId = `review_${String(index + 1).padStart(3, '0')}`;
    const observation = {
      ...observationInput(), intent_hash: hashCanonical(request), source_type: 'reviewed_judgment_facts',
      provenance: { catalog_source: 'live' }, payload: { ...facts, ...item.overrides.policy },
      ...item.overrides.observation
    };
    const intake = { ...legacy, ...item.overrides.legacy };
    const stimulus = { request, observation,
      legacy_constraints: { recommended_route: intake.recommended_route, requires_human_approval: intake.requires_human_approval,
        known_blockers: intake.known_blockers, do_not_use: intake.do_not_use },
      decision_clock: corpus.fixed_clock };
    return { review_case_id: reviewId, source_class: 'synthetic_fixture' as const,
      historical_receipt: false as const, stimulus_sha256: sha256(JSON.stringify(stimulus)), stimulus };
  });
  const packet = {
    schema_version: 'decisions-blinded-review-packet.v1', source_corpus_sha256: corpusSha256,
    instructions: 'Assess each case from the supplied facts. Do not use policy labels, model answers, or later outcomes. Synthetic fixtures are never historical proof.',
    reviewer_status: 'awaiting_independent_assessments', cases: packetCases
  };
  const coordinator = {
    schema_version: 'decisions-review-coordinator-map.v1', source_corpus_sha256: corpusSha256,
    packet_sha256: sha256(JSON.stringify(packet)),
    access: 'coordinator_only_do_not_distribute_with_blinded_packet',
    cases: ordered.map((item, index) => ({ review_case_id: packetCases[index].review_case_id,
      source_case_id: item.id, source_category: item.category, policy_replay_label: item.expected.decision,
      source_case_sha256: sha256(JSON.stringify(item)) }))
  };
  return { packet, coordinator };
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 6 || args[0] !== '--corpus' || args[2] !== '--packet' || args[4] !== '--coordinator-map') throw new Error('invalid_arguments');
  const corpusPath = resolve(args[1]), packetPath = resolve(args[3]), mapPath = resolve(args[5]);
  if (new Set([corpusPath, packetPath, mapPath]).size !== 3) throw new Error('distinct_paths_required');
  const corpusText = readFileSync(corpusPath, 'utf8');
  const result = buildReviewPacket(JSON.parse(corpusText), sha256(corpusText));
  writeNew(packetPath, result.packet);
  writeNew(mapPath, result.coordinator);
  process.stdout.write(`Blinded review packet and coordinator map written; ${result.packet.cases.length} synthetic cases.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch { process.stderr.write('decisions_review_packet_failed; inspect inputs and output paths\n'); process.exitCode = 1; }
}
