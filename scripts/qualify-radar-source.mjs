/** Bind qualification to the exact source rather than a PR merge ref or a borrowed report. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const expected = process.env.RADAR_CANDIDATE_SHA;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(expected ?? '') || expected !== actual) throw Error('qualification_source_sha_mismatch');
if (process.version !== 'v24.21.0') throw Error('qualification_requires_node_24_21_0');
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim()) throw Error('qualification_requires_clean_source');
const output = resolve(process.env.RADAR_SOURCE_OUTPUT_DIR ?? 'output/ci-source');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'source.json'), JSON.stringify({ source_sha: actual, expected_sha: expected,
  node_version: process.version, platform: process.platform, architecture: process.arch,
  workflow_run_id: process.env.GITHUB_RUN_ID ?? null, workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  workflow_sha: process.env.GITHUB_WORKFLOW_SHA ?? null, event: process.env.GITHUB_EVENT_NAME ?? 'local' }, null, 2) + '\n');
console.log('Qualified source binding: ' + actual);
