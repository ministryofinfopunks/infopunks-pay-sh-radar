import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { digest, hash, requireThat } from './assurance.mjs';

export const root = 'tools/first-spender-trust-r3/';
export const baselineHeads = {
  '16': 'd6b77e573f9939d4af70bdbd9416619001bf3cf9',
  '17': 'd859c5dc13948f312c3652539704cea06d903cd3',
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trim();
export function inventory(head) {
  const entries = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', head], { maxBuffer: 128 * 1024 * 1024 })
    .toString().split('\0').filter(Boolean).map(row => {
      const tab = row.indexOf('\t'), [mode, kind, oid] = row.slice(0, tab).split(' ');
      requireThat(kind === 'blob', 'unsupported_git_object');
      return { path: row.slice(tab + 1), mode, oid };
    });
  // One batch preserves exact blob bytes, including binary artifacts and symlink text.
  const batch = execFileSync('git', ['cat-file', '--batch'], {
    input: entries.map(e => e.oid).join('\n') + '\n', maxBuffer: 512 * 1024 * 1024,
  });
  let offset = 0;
  const files = {};
  for (const e of entries) {
    const end = batch.indexOf(10, offset), [oid, kind, size] = batch.subarray(offset, end).toString().split(' ');
    requireThat(oid === e.oid && kind === 'blob', 'git_object_mismatch');
    offset = end + 1; const bytes = batch.subarray(offset, offset + Number(size)); offset += Number(size) + 1;
    files[e.path] = { mode: e.mode, git_blob: e.oid, size_bytes: Number(size), sha256: digest(bytes) };
  }
  return { head, tree: git('rev-parse', head + '^{tree}'), parents: git('show', '-s', '--format=%P', head).split(' ').filter(Boolean),
    file_count: entries.length, files_hash: hash(files), files };
}

// Capture requires a fresh exact-head metadata file from read-only GitHub API.
if (process.argv[2] === '--capture-baselines') {
  const metadata = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  for (const [pr, head] of Object.entries(baselineHeads)) {
    const info = metadata[pr];
    requireThat(info.head_sha === head && info.draft === true && info.merged === false, 'remote_baseline_drift');
    const manifest = { version: 'infopunks.distinct-evidence-baseline.v1', status: 'HOLD',
      captured_at: metadata.captured_at, independent_approval: false, qualification: 'original PR claims only; not independently requalified by R3',
      pr_metadata: info, ...inventory(head) };
    writeFileSync(root + `baselines/pr-${pr}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  }
  console.log('Captured separate exact-head baselines. HOLD.');
} else {
  requireThat(process.version === 'v24.21.0', 'node_24_21_required');
  const head = git('rev-parse', 'HEAD');
  requireThat(!process.env.FIRST_SPENDER_R3_EXPECTED_SHA || process.env.FIRST_SPENDER_R3_EXPECTED_SHA === head, 'exact_head_mismatch');
  requireThat(!git('status', '--porcelain', '--untracked-files=all'), 'clean_committed_checkout_required');
  git('merge-base', '--is-ancestor', baselineHeads['17'], head);
  const changed = git('diff', '--name-only', baselineHeads['17'], head).split('\n').filter(Boolean);
  const workflow = '.github/workflows/first-spender-trust-r3.yml';
  requireThat(changed.every(p => p.startsWith(root) || p === workflow), 'baseline_or_production_changed');
  const baselines = {};
  for (const [pr, pinned] of Object.entries(baselineHeads)) {
    const retainedBytes = readFileSync(root + `baselines/pr-${pr}.manifest.json`);
    const retained = JSON.parse(retainedBytes);
    const current = inventory(pinned);
    requireThat(retained.head === pinned && retained.tree === current.tree && retained.files_hash === current.files_hash &&
      hash(retained.files) === current.files_hash && retained.file_count === current.file_count &&
      retained.pr_metadata.head_sha === pinned && retained.pr_metadata.draft === true && !retained.pr_metadata.merged, 'baseline_manifest_mismatch');
    baselines[pr] = { head: pinned, tree: current.tree, file_count: current.file_count, files_hash: current.files_hash,
      retained_manifest_hash: digest(retainedBytes) };
  }
  const packagePaths = git('ls-files', '-z', '--', root, workflow).split('\0').filter(Boolean);
  const sources = Object.fromEntries(packagePaths.sort().map(p => [p, digest(readFileSync(p))]));
  const preservation = Object.fromEntries(['src', 'migrations', 'tests', 'tools/spend-lab', 'docs', 'package.json', 'package-lock.json'].map(p => {
    const before = git('rev-parse', baselineHeads['17'] + ':' + p), after = git('rev-parse', head + ':' + p);
    requireThat(before === after, 'historical_tree_changed:' + p); return [p, { baseline: before, candidate: after }];
  }));
  const output = resolve(process.argv[2] ?? '.data/trust-r3/exact-head.json'); mkdirSync(dirname(output), { recursive: true });
  const manifest = { version: 'infopunks.trust-r3.exact-head.v1', status: 'HOLD', execution_authorized: false,
    independent_approval: false, economic_usefulness: 'NOT_ESTABLISHED', head, tree: git('rev-parse', 'HEAD^{tree}'),
    node: process.version, baselines, changed, preservation, source_set_hash: hash(sources), sources };
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ head, source_set_hash: manifest.source_set_hash, status: 'HOLD', output }));
}
