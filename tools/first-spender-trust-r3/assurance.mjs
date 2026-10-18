// Offline review candidate. Never imported by src/ and never grants authority.
import { createHash, createPublicKey, verify } from 'node:crypto';

export const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function encode(value, historical = false, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && (historical ? Number.isFinite(value) : Number.isSafeInteger(value))) return JSON.stringify(value);
  requireThat(value && typeof value === 'object' && !ancestors.has(value), 'noncanonical_value');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + Array.from(value, v => encode(v, historical, ancestors)).join(',') + ']';
    requireThat(Object.getPrototypeOf(value) === Object.prototype || (historical && Object.getPrototypeOf(value) === null), 'noncanonical_value');
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + encode(value[k], historical, ancestors)).join(',') + '}';
  } finally { ancestors.delete(value); }
}
export const canonical = value => encode(value);
// Preserve the existing receipt algorithm, which permits finite JSON fractions.
// New signed contract amounts use integer strings; historical bytes are never rewritten.
export const historicalHash = value => digest(encode(value, true));
export const hash = value => digest(canonical(value));
export function requireThat(ok, reason) { if (!ok) throw Error(reason); }
export function exact(value, keys) {
  requireThat(value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort().join('|') === keys.split(' ').sort().join('|'), 'contract_fields');
}
export function text(value) { requireThat(typeof value === 'string' && value.length > 0 && value.length <= 4096, 'text_required'); }
export function sha(value) { requireThat(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), 'digest_required'); }
export function time(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'utc_time_required');
  return Date.parse(value);
}
export function scope(value) {
  exact(value, 'tenant_id principal_id subject_type subject_id network recipient route_id intent_hash candidate_hash policy_hash');
  for (const [k, v] of Object.entries(value)) k.endsWith('_hash') ? sha(v) : text(v);
}

// Registry hash is pinned by an independent custodian OUTSIDE the submitted bundle.
// Hash matching establishes integrity of that pin, not independent identity by itself.
export function registryAt(registry, pinnedHash, at) {
  sha(pinnedHash);
  requireThat(hash(registry) === pinnedHash, 'registry_pin_mismatch');
  exact(registry, 'version issued_at expires_at keys');
  requireThat(registry.version === 'infopunks.review-trust.v1', 'registry_version');
  requireThat(time(registry.issued_at) <= at && at < time(registry.expires_at), 'registry_expired');
  requireThat(Array.isArray(registry.keys) && registry.keys.length > 0, 'trusted_keys_required');
  const ids = new Set();
  for (const k of registry.keys) {
    exact(k, 'key_id public_key_pem organization_id identity_evidence_hash role grant_hash not_before not_after revoked');
    for (const f of ['key_id', 'public_key_pem', 'organization_id', 'role']) text(k[f]);
    sha(k.identity_evidence_hash); sha(k.grant_hash);
    time(k.not_before); time(k.not_after);
    requireThat(typeof k.revoked === 'boolean' && !ids.has(k.key_id), 'registry_key_invalid');
    ids.add(k.key_id);
  }
  return registry;
}
export function signed(body, signature, role, grant, registry, at) {
  exact(signature, 'key_id signature_base64');
  const k = registry.keys.find(k => k.key_id === signature.key_id);
  requireThat(k && !k.revoked && k.role === role && k.grant_hash === hash(grant) &&
    time(k.not_before) <= at && at < time(k.not_after), 'untrusted_or_expired_signer');
  requireThat(typeof signature.signature_base64 === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(signature.signature_base64), 'signature_encoding');
  requireThat(Buffer.from(signature.signature_base64, 'base64').toString('base64') === signature.signature_base64, 'signature_encoding');
  const key = createPublicKey(k.public_key_pem);
  requireThat(key.asymmetricKeyType === 'ed25519' && verify(null,
    Buffer.from('INFOPUNKS-R3/' + role + '/v1\n' + canonical(body)), key,
    Buffer.from(signature.signature_base64, 'base64')), 'signature_invalid');
  return k;
}

export function liveEvidence(raw, policy, registry, now, observation, artifactBytes) {
  try {
    const at = time(now);
    exact(policy, 'registry_hash scope source_id source_contract_hash collection_method max_age_ms');
    scope(policy.scope); sha(policy.source_contract_hash); text(policy.source_id);
    requireThat(Number.isSafeInteger(policy.max_age_ms) && policy.max_age_ms > 0, 'age_policy');
    registryAt(registry, policy.registry_hash, at);
    exact(raw, 'version observation_id receipt_hash artifact_hash source_id collector_id source_contract_hash collection_method environment fixture simulation authority permitted_use spending_authority external_economic_activity scope observed_at ingested_at expires_at source_signature collector_signature review_signature');
    requireThat(raw.version === 'infopunks.live-evidence.v1', 'unsupported_live_contract');
    scope(raw.scope); text(raw.observation_id); text(raw.collector_id); sha(raw.receipt_hash); sha(raw.artifact_hash);
    requireThat(raw.environment === 'production' && raw.fixture === false && raw.simulation === false &&
      raw.authority === 'reviewed_live' && raw.spending_authority === 'none' && raw.external_economic_activity === true &&
      canonical(raw.permitted_use) === canonical(['new_judgment_evidence']), 'explicit_authority_required');
    requireThat(raw.source_id === policy.source_id && raw.source_contract_hash === policy.source_contract_hash &&
      raw.collection_method === 'ed25519_source_and_collector' && raw.collection_method === policy.collection_method &&
      hash(raw.scope) === hash(policy.scope), 'source_or_scope_mismatch');
    const observed = time(raw.observed_at), ingested = time(raw.ingested_at), expires = time(raw.expires_at);
    requireThat(observed <= ingested && ingested <= at && at < expires &&
      at - observed < policy.max_age_ms && expires - observed <= policy.max_age_ms, 'evidence_stale_or_future');
    requireThat(Buffer.isBuffer(artifactBytes) && digest(artifactBytes) === raw.artifact_hash, 'source_artifact_missing_or_changed');
    exact(observation, 'schema_version observation_id subject_type subject_id intent_hash source_type source_id observed_at ingested_at freshness_expires_at evidence_state evidence_refs provenance payload payload_hash receipt_hash');
    const { receipt_hash, ...receiptBody } = observation ?? {};
    requireThat(receipt_hash === raw.receipt_hash && historicalHash({ kind: 'observation', payload: receiptBody }) === receipt_hash &&
      observation.schema_version === 'canonical-receipts.v1' && observation.observation_id === raw.observation_id &&
      observation.payload_hash === historicalHash(observation.payload) && observation.source_id === raw.source_id &&
      ['reviewed_judgment_facts', 'reviewed_economic_facts'].includes(observation.source_type) &&
      observation.subject_type === raw.scope.subject_type && observation.subject_id === raw.scope.subject_id &&
      observation.intent_hash === raw.scope.intent_hash && observation.observed_at === raw.observed_at &&
      observation.ingested_at === raw.ingested_at && observation.freshness_expires_at === raw.expires_at &&
      observation.evidence_state === 'sufficient' && Array.isArray(observation.evidence_refs) && observation.evidence_refs.length > 0 &&
      observation.evidence_refs.every(r => typeof r === 'string' && r.length > 0 && r.length <= 256),
      'observation_missing_changed_or_unbound');
    const prior = observation.provenance;
    requireThat(prior && Object.getPrototypeOf(prior) === Object.prototype &&
      !['simulation', 'fixture'].includes(prior.catalog_source) && prior.fixture !== true && prior.simulation !== true &&
      prior.evidence_class !== 'local_simulation' && prior.environment !== 'isolated-local-spend-lab', 'simulation_or_fixture_not_live');
    const { source_signature, collector_signature, review_signature, ...body } = raw;
    const grant = { scope: policy.scope, source_id: policy.source_id, source_contract_hash: policy.source_contract_hash,
      collection_method: policy.collection_method, permitted_use: raw.permitted_use, max_age_ms: policy.max_age_ms };
    const source = signed(body, source_signature, 'source', grant, registry, at);
    const collector = signed(body, collector_signature, 'collector', grant, registry, at);
    requireThat(raw.collector_id === collector.key_id, 'collector_identity_mismatch');
    const reviewer = signed({ body, source_signature, collector_signature }, review_signature, 'provenance-reviewer', grant, registry, at);
    requireThat(new Set([source.organization_id, collector.organization_id, reviewer.organization_id]).size === 3,
      'independent_provenance_review_required');
    return { status: 'CANDIDATE_EVIDENCE_ONLY', contract: raw.version, evidence_hash: hash(raw), execution_authorized: false, hold: true };
  } catch (e) {
    return { status: 'QUARANTINE_FOR_NEW_DECISIONS', reason: e.message, execution_authorized: false, hold: true };
  }
}
