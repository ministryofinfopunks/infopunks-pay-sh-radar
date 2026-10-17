import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const frozen = '7605310bce2b6d3adf193b9f97395c5251e0ad4f';
const head = git('rev-parse', 'HEAD');
if (process.version !== 'v24.21.0') throw new Error('qualification_requires_node_24_21_0');
if (process.env.FIRST_SPENDER_EXPECTED_SHA && process.env.FIRST_SPENDER_EXPECTED_SHA !== head)
  throw new Error('exact_head_mismatch');
git('merge-base', '--is-ancestor', frozen, head);
if (git('status', '--porcelain', '--untracked-files=no'))
  throw new Error('qualification_requires_clean_tracked_source');
if (
  git(
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'src',
    'tools/spend-lab',
    'tests',
    '.github/workflows',
  )
)
  throw new Error('qualification_requires_committed_sources');
const frozenPaths = ['tools/spend-lab/reports', 'docs/evidence', 'docs/qualification'];
git('diff', '--exit-code', frozen, head, '--', ...frozenPaths);
const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const paths = git('ls-files', '-z')
  .split('\0')
  .filter(Boolean)
  .filter(
    (p) =>
      p.startsWith('src/') ||
      p.startsWith('tools/spend-lab/') ||
      p.startsWith('tests/') ||
      p.startsWith('.github/workflows/') ||
      [
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'tsconfig.server.json',
        'AGENTS.md',
      ].includes(p),
  );
const sources = Object.fromEntries(paths.sort().map((p) => [p, digest(readFileSync(p))]));
const preservation = Object.fromEntries(
  frozenPaths.map((p) => [p, git('rev-parse', frozen + ':' + p)]),
);
const manifest = {
  version: 'spend-lab.exact-head-source.v1',
  head,
  tree: git('rev-parse', 'HEAD^{tree}'),
  base: frozen,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  status: 'HOLD',
  real_spending_authorized: false,
  source_set_hash: digest(Buffer.from(JSON.stringify(sources))),
  sources,
  frozen_tree_digests: preservation,
};
const output = resolve(process.argv[2] ?? '.data/spend-lab/source-manifest.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    head,
    files: paths.length,
    source_set_hash: manifest.source_set_hash,
    status: 'HOLD',
    output,
  }),
);
