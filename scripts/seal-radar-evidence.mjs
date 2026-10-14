import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sha !== process.env.RADAR_CANDIDATE_SHA) throw Error('evidence_source_sha_mismatch');
const artifacts = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error('evidence_symlink_forbidden');
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && entry.name !== 'artifact-manifest.json') artifacts.push({ path: file,
      bytes: (await stat(file)).size, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
  }
}
for (const directory of process.argv.slice(2)) await walk(resolve(directory));
if (!artifacts.length) throw Error('evidence_artifacts_missing');
await writeFile(join(resolve(process.argv[2]), 'artifact-manifest.json'), JSON.stringify({ source_sha: sha,
  workflow_run_id: process.env.GITHUB_RUN_ID ?? null, job_status: process.env.RADAR_JOB_STATUS ?? 'unclassified',
  artifacts }, null, 2) + '\n');
