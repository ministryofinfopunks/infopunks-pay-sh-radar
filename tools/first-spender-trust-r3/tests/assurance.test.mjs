import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, historicalHash, liveEvidence } from '../assurance.mjs';
import { now, h, clone, provenanceFixture } from './fixtures.mjs';
const check = f => liveEvidence(f.raw, f.policy, f.registry, now, f.observation, f.artifact);
test('valid detached assertion is evidence-only and leaves immutable historical bytes intact', () => {
  const f = provenanceFixture(), before = JSON.stringify(f.observation);
  assert.equal(check(f).status, 'CANDIDATE_EVIDENCE_ONLY');
  assert.equal(check(f).execution_authorized, false); assert.equal(check(f).hold, true);
  assert.equal(JSON.stringify(f.observation), before);
});
test('legacy live label without independently authenticated declarations quarantines', () => {
  const f = provenanceFixture(); f.raw = { catalog_source: 'live' };
  assert.equal(check(f).status, 'QUARANTINE_FOR_NEW_DECISIONS');
});
test('historical finite fractional payloads retain their original canonical hashes', () => {
  const f = provenanceFixture(); f.observation.payload.price = 0.01;
  f.observation.payload_hash = historicalHash(f.observation.payload);
  const { receipt_hash: _, ...body } = f.observation;
  f.observation.receipt_hash = historicalHash({ kind: 'observation', payload: body });
  f.body.receipt_hash = f.observation.receipt_hash; f.raw = f.seal(f.body);
  const before = JSON.stringify(f.observation);
  assert.equal(check(f).status, 'CANDIDATE_EVIDENCE_ONLY'); assert.equal(JSON.stringify(f.observation), before);
});
for (const field of ['authority', 'environment', 'fixture', 'simulation', 'permitted_use', 'source_signature',
  'collector_signature', 'review_signature', 'spending_authority', 'source_contract_hash', 'expires_at']) {
  for (const kind of ['absent', 'null']) test(`${kind} ${field} fails closed`, () => {
    const f = provenanceFixture(); if (kind === 'absent') delete f.raw[field]; else f.raw[field] = null;
    assert.equal(check(f).status, 'QUARANTINE_FOR_NEW_DECISIONS');
  });
}
for (const field of ['tenant_id', 'principal_id', 'subject_type', 'subject_id', 'network', 'recipient', 'route_id', 'intent_hash', 'candidate_hash', 'policy_hash']) {
  test(`cross-scope ${field} fails despite valid signatures`, () => {
    const f = provenanceFixture(); f.body.scope[field] = field.endsWith('_hash') ? hash('other') : 'other';
    f.raw = f.seal(f.body); assert.equal(check(f).status, 'QUARANTINE_FOR_NEW_DECISIONS');
  });
}
for (const mutate of [
  f => { f.registry.keys[0].revoked = true; f.policy.registry_hash = hash(f.registry); },
  f => { f.registry.keys[0].not_after = now; f.policy.registry_hash = hash(f.registry); },
  f => { f.registry.expires_at = now; f.policy.registry_hash = hash(f.registry); },
  f => { f.registry.keys[2].organization_id = f.registry.keys[0].organization_id; f.policy.registry_hash = hash(f.registry); },
  f => { f.registry.keys[0].grant_hash = h; f.policy.registry_hash = hash(f.registry); },
  f => { f.policy.registry_hash = h; },
  f => { f.raw.source_signature = f.raw.collector_signature; },
  f => { f.raw.source_signature.signature_base64 = 'A'.repeat(86) + '=='; },
  f => { f.body.collector_id = 'wrong'; f.raw = f.seal(f.body); },
  f => { f.raw.unreviewed = true; },
  f => { f.body.expires_at = now; f.raw = f.seal(f.body); },
  f => { f.body.observed_at = '2026-10-18T06:00:31.000Z'; f.raw = f.seal(f.body); },
  f => { f.body.expires_at = '2026-10-18T06:02:00.000Z'; f.raw = f.seal(f.body); },
  f => { f.observation.payload.fictional = false; },
  f => { f.artifact = Buffer.from('changed'); },
  f => { f.observation = null; },
  f => { f.policy.max_age_ms = 0; },
]) test('adversarial provenance boundary ' + String(mutate), () => {
  const f = provenanceFixture(); mutate(f); assert.equal(check(f).status, 'QUARANTINE_FOR_NEW_DECISIONS');
});
test('signed fixture/simulation evidence cannot be promoted to live', () => {
  const f = provenanceFixture(); f.observation.provenance.simulation = true;
  const { receipt_hash: _, ...body } = f.observation;
  f.observation.receipt_hash = hash({ kind: 'observation', payload: body });
  f.body.receipt_hash = f.observation.receipt_hash; f.raw = f.seal(f.body);
  assert.equal(check(f).reason, 'simulation_or_fixture_not_live');
});
