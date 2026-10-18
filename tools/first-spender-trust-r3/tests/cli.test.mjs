import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluationFixture, now } from './fixtures.mjs';
const cli = resolve('tools/first-spender-trust-r3/intake.mjs');
function sandbox(run) {
  const dir = mkdtempSync(join(tmpdir(), 'r3-structural-test-'));
  try {
    const f = evaluationFixture(), archive = join(dir, 'archive'); mkdirSync(archive);
    writeFileSync(join(archive, f.a.slice(7)), f.readArtifact(f.a));
    const invoke = (mode, data, name) => {
      const input = join(dir, name + '.input.json'), output = join(dir, name + '.output.json');
      writeFileSync(input, JSON.stringify(data));
      const result = spawnSync(process.execPath, [cli, mode, input, f.pin, now, archive, output], { encoding: 'utf8' });
      return { ...result, output };
    };
    run({ f, dir, archive, invoke });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('CLI registration/freeze have no reveal and output cannot be overwritten', () => sandbox(({ f, invoke }) => {
  const { registry, registration, freeze } = f.bundle;
  const first = invoke('register', { registry, registration }, 'registration'); assert.equal(first.status, 0, first.stderr);
  assert.equal(statSync(first.output).mode & 0o777, 0o600);
  const before = readFileSync(first.output, 'utf8');
  const second = invoke('register', { registry, registration }, 'registration'); assert.equal(second.status, 1);
  assert.equal(readFileSync(first.output, 'utf8'), before);
  assert.equal(invoke('freeze', { registry, registration, freeze }, 'freeze').status, 0);
}));
test('CLI incomplete signatures fail closed without an accepted report', () => sandbox(({ f, invoke }) => {
  delete f.bundle.reveal.signatures['value-reviewer'];
  const result = invoke('evaluate', f.bundle, 'blocked'); assert.equal(result.status, 1);
  assert.equal(existsSync(result.output), false); assert.equal(JSON.parse(result.stderr).status, 'HOLD');
}));
test('CLI changed private artifact blocks intake; complete structural fixture keeps HOLD', () => sandbox(({ f, archive, invoke }) => {
  const result = invoke('evaluate', f.bundle, 'accepted-vector'); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(result.output, 'utf8')).status, 'HOLD');
  writeFileSync(join(archive, f.a.slice(7)), 'changed');
  const blocked = invoke('evaluate', f.bundle, 'changed'); assert.equal(blocked.status, 1);
  assert.equal(existsSync(blocked.output), false);
}));
