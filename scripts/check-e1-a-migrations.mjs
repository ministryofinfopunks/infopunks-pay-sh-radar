import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? 'docs/evidence/e1-a/qualification');
mkdirSync(output, { recursive: true });
const trackA = 'f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79';
const gitRaw = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const git = (...args) => gitRaw(...args).trim();
const sha256 = input => 'sha256:' + createHash('sha256').update(input).digest('hex');
const describe = file => ({ file, number: Number(file.split('_')[1]), sha256: sha256(readFileSync(file)) });
const branch = readdirSync('migrations').filter(file => file.endsWith('.up.sql')).sort().map(file => describe('migrations/' + file));
const track = git('ls-tree', '-r', '--name-only', trackA, '--', 'migrations').split('\n').filter(file => file.endsWith('.up.sql'))
  .map(file => ({ file, number: Number(file.split('_')[1]), sha256: sha256(gitRaw('show', trackA + ':' + file)) }));
const collisions = branch.flatMap(left => track.filter(right => left.number === right.number && left.file !== right.file).map(right => ({ number: left.number, branch_file: left.file, track_a_file: right.file })));
const changedShared = branch.filter(left => track.some(right => left.file === right.file && left.sha256 !== right.sha256));
const current018 = branch.find(file => file.number === 18);
const baseline018 = gitRaw('show', 'b9597fc:' + current018.file);
const localRefs = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n');
const reservations = new Map();
for (const ref of localRefs) for (const file of git('ls-tree', '-r', '--name-only', ref, '--', 'migrations').split('\n').filter(file => file.endsWith('.up.sql'))) {
  const number = Number(file.split('_')[1]);
  if (number >= 18) {
    const entry = reservations.get(file) ?? { number, file, refs: [] };
    entry.refs.push(ref); reservations.set(file, entry);
  }
}
const report = { schema_version: 'e1-a-migration-compatibility.v1', baseline: 'b9597fc0388d5f08ea1a611b50e12fcab7102fd9', track_a_commit: trackA,
  branch, track_a: track, branch_number_uniqueness: new Set(branch.map(file => file.number)).size === branch.length,
  up_down_pairs_present: branch.every(file => { try { readFileSync(file.file.replace('.up.sql', '.down.sql')); return true; } catch { return false; } }),
  shared_001_017_unchanged: changedShared.length === 0, migration_018_preserved: current018.sha256 === sha256(baseline018),
  numbering_collisions: collisions, concurrent_reservations: [...reservations.values()].sort((a, b) => a.number - b.number),
  reserved_gaps: [19, 20, 21, 22], follow_up: '20261011_023_evaluation_review_guardrails',
  integration_decision: collisions.length ? 'NO_GO' : 'REQUIRES_APPLICATION_REVIEW',
  application_conflicts: ['Track A canonical-receipts.v2/decision-context authority', 'Track A receipt acceptance ledger and score eligibility', 'Evaluation reviewer trust/sidecar/policy must be explicitly reconciled with Track A; successful DDL coexistence is insufficient'],
  required_owner: 'Track A / receipt-authority integration maintainer', production_changes: false };
writeFileSync(join(output, 'migration-compatibility.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Branch migration inventory: ' + (report.branch_number_uniqueness && report.up_down_pairs_present && report.migration_018_preserved && report.shared_001_017_unchanged ? 'PASS' : 'FAIL'));
console.log('Track A integration: ' + report.integration_decision + ' (duplicate migration 018; divergent receipt authority)');
process.exitCode = report.branch_number_uniqueness && report.up_down_pairs_present && report.migration_018_preserved && report.shared_001_017_unchanged ? 0 : 1;
