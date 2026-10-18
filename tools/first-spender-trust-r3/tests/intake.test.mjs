import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, register, freezeDecisions, arms } from '../intake.mjs';
import { hash } from '../assurance.mjs';
import { now, h, clone, evaluationFixture } from './fixtures.mjs';
const run = f => evaluate(f.bundle, f.pin, now, f.readArtifact);
test('all cases/arms, unknown counterfactuals and costs remain explicit; deterministic report', () => {
  const f = evaluationFixture(), report = run(f);
  assert.deepEqual(report, run(f)); assert.equal(report.rows.length, arms.length);
  assert.equal(report.status, 'HOLD'); assert.equal(report.execution_authorized, false);
  assert.equal(report.economic_usefulness, 'NOT_ESTABLISHED');
  for (const r of report.rows) {
    assert.equal(r.missing_counterfactual, true); assert.equal(r.costs.length, 12);
    assert.equal(r.net_minor, r.arm === 'abstention' ? '0' : null);
  }
  assert.equal(report.paired[0].incremental_vs.preflight, null);
});
test('registration and decision freeze run without any outcome reveal', () => {
  const f = evaluationFixture(); delete f.bundle.reveal;
  assert.ok(register(f.bundle.registration, f.registry, f.pin, now, f.readArtifact).registration_hash);
  assert.ok(freezeDecisions(f.bundle.registration, f.bundle.freeze, f.registry, f.pin, now, f.readArtifact).freeze_hash);
});
test('unknown cost never becomes zero or a known net', () => {
  const f = evaluationFixture(); f.truth.rows[0].costs[0] = { kind: 'service', amount_minor: null,
    evidence_hash: null, missing_reason: 'not independently measured' }; f.bundle = f.reseal();
  const report = run(f); assert.equal(report.rows[0].net_minor, null);
  assert.equal(report.summaries.find(s => s.split === 'heldout' && s.arm === 'abstention').unknown_costs, 1);
});
test('exact integer accounting keeps service, judgment, overhead, refund and value separate', () => {
  const f = evaluationFixture(), t = f.truth.rows.find(r => r.arm === 'full_radar');
  Object.assign(t, { outcome: 'verified_success', outcome_evidence_hash: f.a, value_evidence_hash: f.a,
    earned_minor: '100000000000000000001', downside_minor: '7' });
  t.costs.find(c => c.kind === 'service').amount_minor = '10';
  t.costs.find(c => c.kind === 'judgment').amount_minor = '3';
  t.costs.find(c => c.kind === 'verification').amount_minor = '2';
  t.costs.find(c => c.kind === 'refund').amount_minor = '1';
  f.bundle = f.reseal(); const row = run(f).rows.find(r => r.arm === 'full_radar');
  assert.equal(row.total_cost_minor, '14'); assert.equal(row.net_minor, '99999999999999999980');
});
for (const mutate of [
  f => { delete f.bundle.registration.signatures.curator; },
  f => { f.bundle.registration.body.cases[0].outcome = 'success'; },
  f => { f.bundle.freeze.body.rows.pop(); },
  f => { f.bundle.freeze.body.rows[1] = clone(f.bundle.freeze.body.rows[0]); },
  f => { f.bundle.freeze.body.rows[0].execution_authorized = true; },
  f => { f.bundle.freeze.body.rows[1].strategy_hash = h; },
  f => { f.bundle.freeze.body.rows.at(-1).full_verdict = 'do_not_spend'; },
  f => { f.bundle.freeze.body.created_at = '2026-10-18T06:00:21.000Z'; },
  f => { f.bundle.reveal.body.revealed_at = '2026-10-18T06:00:09.000Z'; },
  f => { f.bundle.reveal.body.salt = 'b'.repeat(64); },
  f => { f.bundle.reveal.body.truth.rows[0].costs.pop(); },
  f => { f.registry.keys[0].revoked = true; f.pin = hash(f.registry); },
  f => { f.registry.keys[3].organization_id = f.registry.keys[0].organization_id; f.pin = hash(f.registry); },
  f => { f.registry.keys[4].organization_id = f.registry.keys[3].organization_id; f.pin = hash(f.registry); },
  f => { f.pin = h; },
  f => { f.readArtifact = () => Buffer.from('changed bytes'); },
]) test('reject malformed/tampered intake ' + String(mutate), () => {
  const f = evaluationFixture(); mutate(f); assert.throws(() => run(f));
});
for (const mutate of [
  f => { f.rb.cases[0].available_at = now; },
  f => { f.rb.cases.push({ ...f.rb.cases[0], case_id: 'other', split: 'development' }); },
  f => { f.truth.rows[0].costs[0].amount_minor = '-1'; },
  f => { f.truth.rows[0].costs[0].evidence_hash = null; },
  f => { f.truth.rows[0].outcome = 'verified_success'; },
  f => { f.truth.rows[0].earned_minor = '1'; },
  f => { f.truth.rows[0].costs[0].amount_minor = 0; },
]) test('even newly signed inconsistent evidence fails ' + String(mutate), () => {
  const f = evaluationFixture(); mutate(f); f.bundle = f.reseal(); assert.throws(() => run(f));
});
