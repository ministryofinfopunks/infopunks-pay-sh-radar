// Ephemeral in-memory software vectors ONLY. No provider, purchase or economic evidence.
import { generateKeyPairSync, sign } from 'node:crypto';
import { hash, digest, canonical } from '../assurance.mjs';
import { arms, costKinds } from '../intake.mjs';
export const now = '2026-10-18T06:00:30.000Z';
export const h = hash('fictional structural fixture');
export const clone = value => JSON.parse(JSON.stringify(value));
export function trust(roles, grant) {
  const privateKeys = {};
  const registry = { version: 'infopunks.review-trust.v1', issued_at: '2026-10-18T00:00:00.000Z',
    expires_at: '2026-10-19T00:00:00.000Z', keys: roles.map(role => {
      const { privateKey, publicKey } = generateKeyPairSync('ed25519'); privateKeys[role] = privateKey;
      return { key_id: role, public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
        organization_id: role + '-fictional-organization', identity_evidence_hash: h, role, grant_hash: hash(grant),
        not_before: '2026-10-18T00:00:00.000Z', not_after: '2026-10-19T00:00:00.000Z', revoked: false };
    }) };
  const signature = (role, body) => ({ key_id: role, signature_base64: sign(null,
    Buffer.from('INFOPUNKS-R3/' + role + '/v1\n' + canonical(body)), privateKeys[role]).toString('base64') });
  const doc = (body, roles) => ({ body, signatures: Object.fromEntries(roles.map(r => [r, signature(r, body)])) });
  return { registry, signature, doc };
}
export function provenanceFixture() {
  const scope = { tenant_id: 'fictional-tenant', principal_id: 'fictional-principal', subject_type: 'route',
    subject_id: 'fictional-route', network: 'fictional-network', recipient: 'fictional-recipient',
    route_id: 'fictional-route', intent_hash: h, candidate_hash: h, policy_hash: h };
  const grant = { scope, source_id: 'fictional-source', source_contract_hash: h,
    collection_method: 'ed25519_source_and_collector', permitted_use: ['new_judgment_evidence'], max_age_ms: 60000 };
  const auth = trust(['source', 'collector', 'provenance-reviewer'], grant);
  const policy = { registry_hash: hash(auth.registry), scope, source_id: grant.source_id,
    source_contract_hash: h, collection_method: grant.collection_method, max_age_ms: 60000 };
  const receiptBody = { schema_version: 'canonical-receipts.v1', observation_id: 'fictional-observation',
    source_id: grant.source_id, source_type: 'reviewed_judgment_facts', subject_type: scope.subject_type,
    subject_id: scope.subject_id, intent_hash: scope.intent_hash, observed_at: '2026-10-18T06:00:00.000Z',
    ingested_at: '2026-10-18T06:00:01.000Z', freshness_expires_at: '2026-10-18T06:01:00.000Z',
    payload: { fictional: true }, payload_hash: hash({ fictional: true }), evidence_state: 'sufficient',
    evidence_refs: ['fictional-software-vector'], provenance: { catalog_source: 'live' } };
  const observation = { ...receiptBody, receipt_hash: hash({ kind: 'observation', payload: receiptBody }) };
  const artifact = Buffer.from('fictional source artifact; not a measurement');
  const body = { version: 'infopunks.live-evidence.v1', observation_id: observation.observation_id,
    receipt_hash: observation.receipt_hash, artifact_hash: digest(artifact), source_id: grant.source_id,
    collector_id: 'collector', source_contract_hash: h, collection_method: grant.collection_method,
    environment: 'production', fixture: false, simulation: false, authority: 'reviewed_live',
    permitted_use: grant.permitted_use, spending_authority: 'none', external_economic_activity: true,
    scope, observed_at: observation.observed_at, ingested_at: observation.ingested_at, expires_at: observation.freshness_expires_at };
  const seal = (body = clone(bodyOriginal)) => {
    const source_signature = auth.signature('source', body), collector_signature = auth.signature('collector', body);
    return { ...body, source_signature, collector_signature,
      review_signature: auth.signature('provenance-reviewer', { body, source_signature, collector_signature }) };
  };
  const bodyOriginal = clone(body);
  return { ...auth, policy, observation, artifact, body, seal, raw: seal(body) };
}

export function evaluationFixture() {
  const auth = trust(['curator', 'methodology-reviewer', 'custodian', 'decision-producer',
    'outcome-assessor', 'value-reviewer', 'cost-reviewer'], { bundle_id: 'FICTIONAL-SOFTWARE-VECTOR' });
  const archiveBytes = Buffer.from('fictional opaque archive bytes, not real evidence');
  const a = digest(archiveBytes);
  const truth = { rows: arms.map(arm => ({ case_id: 'fictional-case', arm, outcome: 'missing_counterfactual',
    outcome_evidence_hash: null, earned_minor: null, downside_minor: null, value_evidence_hash: null,
    costs: costKinds.map(kind => ({ kind, amount_minor: '0', evidence_hash: a, missing_reason: null })) })) };
  const salt = 'a'.repeat(64);
  const rb = { version: 'infopunks.external-eval.registration.v1', bundle_id: 'FICTIONAL-SOFTWARE-VECTOR',
    created_at: '2026-10-18T06:00:00.000Z', decision_cutoff: '2026-10-18T06:00:20.000Z', source_revision: 'a'.repeat(40),
    protocol_hash: a, sample_plan_hash: a, valuation_rule_hash: a, cost_rule_hash: a,
    currency: 'XXX', unit_scale: 2, strategy_hashes: Object.fromEntries(arms.map(arm => [arm, a])),
    cases: [{ case_id: 'fictional-case', provider_id: 'fictional-provider', cluster_id: 'fictional-cluster', split: 'heldout',
      available_at: '2026-10-18T05:59:00.000Z', admissible: true, quote_evidence_hash: a,
      observation_evidence_hash: a, cheap_features_hash: a, full_features_hash: a, valuation_evidence_hash: a }],
    truth_commitment: hash({ salt, truth }) };
  let registration, freeze, reveal;
  const reseal = () => {
    rb.truth_commitment = hash({ salt, truth });
    registration = auth.doc(rb, ['curator', 'methodology-reviewer', 'custodian']);
    const fb = { version: 'infopunks.external-eval.decisions.v1', bundle_id: rb.bundle_id,
      registration_hash: hash(registration), created_at: '2026-10-18T06:00:10.000Z', rows: arms.map(arm => ({
        case_id: 'fictional-case', arm, preference: arm === 'abstention' ? 'abstain' : 'select', reason: 'fictional vector',
        strategy_hash: a, evidence_hash: a, full_verdict: arm === 'full_radar' ? 'proceed' : null, execution_authorized: false })) };
    freeze = auth.doc(fb, ['decision-producer', 'custodian']);
    reveal = auth.doc({ version: 'infopunks.external-eval.reveal.v1', bundle_id: rb.bundle_id,
      registration_hash: hash(registration), freeze_hash: hash(freeze), revealed_at: '2026-10-18T06:00:25.000Z', salt, truth },
    ['outcome-assessor', 'value-reviewer', 'cost-reviewer', 'custodian']);
    return { registry: auth.registry, registration, freeze, reveal };
  };
  return { ...auth, rb, truth, reseal, bundle: reseal(), pin: hash(auth.registry), a,
    readArtifact: digest => digest === a ? archiveBytes : null };
}
