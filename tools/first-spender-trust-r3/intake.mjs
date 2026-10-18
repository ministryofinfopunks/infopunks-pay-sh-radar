// External evidence intake and accounting only. No policies, payments or providers run.
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, digest, hash, exact, text, sha, time, requireThat, registryAt, signed } from './assurance.mjs';

export const arms = ['abstention', 'no_radar', 'static', 'cheap_checks', 'preflight', 'full_radar'];
export const costKinds = ['service', 'judgment', 'cheap_check', 'preflight', 'inference', 'verification',
  'payment', 'gas', 'infrastructure', 'latency', 'recovery', 'refund'];
const amount = v => requireThat(v === null || (typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v)), 'minor_units_required');
const unique = (rows, key) => requireThat(new Set(rows.map(key)).size === rows.length, 'duplicate_row');
function artifacts(hashes, readArtifact) {
  requireThat(typeof readArtifact === 'function', 'private_evidence_archive_required');
  for (const h of new Set(hashes)) {
    sha(h); const bytes = readArtifact(h);
    requireThat(Buffer.isBuffer(bytes) && digest(bytes) === h, 'evidence_artifact_missing_or_changed');
  }
}
const complete = (rows, ids) => {
  requireThat(Array.isArray(rows) && rows.length === ids.length * arms.length, 'all_cases_and_arms_required');
  unique(rows, r => r.case_id + '/' + r.arm);
  requireThat(rows.every(r => ids.includes(r.case_id) && arms.includes(r.arm)), 'unknown_case_or_arm');
};
function document(doc, roles, registry, grant, at) {
  exact(doc, 'body signatures'); exact(doc.signatures, roles.join(' '));
  const eventAt = time(doc.body.created_at ?? doc.body.revealed_at);
  return roles.map(role => {
    const k = signed(doc.body, doc.signatures[role], role, grant, registry, at);
    requireThat(time(k.not_before) <= eventAt && eventAt < time(k.not_after), 'signer_invalid_at_document_time');
    return k;
  });
}

export function register(registration, registry, pinnedHash, now, readArtifact) {
  const at = time(now); registryAt(registry, pinnedHash, at);
  const b = registration.body;
  exact(b, 'version bundle_id created_at decision_cutoff source_revision protocol_hash sample_plan_hash valuation_rule_hash cost_rule_hash currency unit_scale strategy_hashes cases truth_commitment');
  requireThat(b.version === 'infopunks.external-eval.registration.v1', 'registration_version');
  text(b.bundle_id); requireThat(/^[a-f0-9]{40}$/.test(b.source_revision), 'exact_source_revision_required');
  for (const k of ['protocol_hash', 'sample_plan_hash', 'valuation_rule_hash', 'cost_rule_hash', 'truth_commitment']) sha(b[k]);
  requireThat(/^[A-Z]{3}$/.test(b.currency) && Number.isInteger(b.unit_scale) && b.unit_scale >= 0 && b.unit_scale <= 18, 'currency_required');
  requireThat(time(b.created_at) <= at && time(b.created_at) < time(b.decision_cutoff), 'registration_time');
  exact(b.strategy_hashes, arms.join(' ')); for (const v of Object.values(b.strategy_hashes)) sha(v);
  requireThat(Array.isArray(b.cases) && b.cases.length > 0, 'external_cases_required');
  unique(b.cases, c => c.case_id);
  for (const c of b.cases) {
    exact(c, 'case_id provider_id cluster_id split available_at admissible quote_evidence_hash observation_evidence_hash cheap_features_hash full_features_hash valuation_evidence_hash');
    for (const k of ['case_id', 'provider_id', 'cluster_id']) text(c[k]);
    requireThat(['development', 'heldout'].includes(c.split) && typeof c.admissible === 'boolean', 'case_contract');
    requireThat(time(c.available_at) <= time(b.created_at), 'feature_hindsight');
    for (const [k, v] of Object.entries(c)) if (k.endsWith('_hash')) sha(v);
  }
  artifacts([b.protocol_hash, b.sample_plan_hash, b.valuation_rule_hash, b.cost_rule_hash,
    ...Object.values(b.strategy_hashes), ...b.cases.flatMap(c => Object.entries(c).filter(([k]) => k.endsWith('_hash')).map(([, v]) => v))], readArtifact);
  const clusters = new Map();
  for (const c of b.cases) {
    requireThat(!clusters.has(c.cluster_id) || clusters.get(c.cluster_id) === c.split, 'cluster_split_leakage');
    clusters.set(c.cluster_id, c.split);
  }
  const signers = document(registration, ['curator', 'methodology-reviewer', 'custodian'], registry, { bundle_id: b.bundle_id }, at);
  requireThat(new Set(signers.map(s => s.organization_id)).size === signers.length, 'independent_registration_required');
  return { body: b, signers, registration_hash: hash(registration) };
}

export function freezeDecisions(registration, freeze, registry, pinnedHash, now, readArtifact) {
  const registered = register(registration, registry, pinnedHash, now, readArtifact), b = registered.body, f = freeze.body;
  exact(f, 'version bundle_id registration_hash created_at rows');
  requireThat(f.version === 'infopunks.external-eval.decisions.v1' && f.bundle_id === b.bundle_id &&
    f.registration_hash === registered.registration_hash, 'freeze_binding');
  requireThat(time(b.created_at) < time(f.created_at) && time(f.created_at) <= time(b.decision_cutoff) && time(f.created_at) <= time(now), 'freeze_time');
  complete(f.rows, b.cases.map(c => c.case_id));
  for (const r of f.rows) {
    exact(r, 'case_id arm preference reason strategy_hash evidence_hash full_verdict execution_authorized');
    text(r.reason); sha(r.evidence_hash);
    requireThat(r.execution_authorized === false && ['abstain', 'select'].includes(r.preference) &&
      r.strategy_hash === b.strategy_hashes[r.arm], 'nonexecutable_frozen_policy_required');
    const c = b.cases.find(c => c.case_id === r.case_id);
    requireThat((c.admissible || r.preference === 'abstain') && (r.arm !== 'abstention' || r.preference === 'abstain'), 'inadmissible_selection');
    if (r.arm === 'full_radar') {
      requireThat(['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence'].includes(r.full_verdict), 'full_verdict_required');
      // A bounded-test verdict is not a full-purchase selection in this protocol.
      requireThat(r.preference !== 'select' || r.full_verdict === 'proceed', 'full_judgment_veto');
    } else requireThat(r.full_verdict === null, 'verdict_scope');
  }
  artifacts(f.rows.map(r => r.evidence_hash), readArtifact);
  const signers = document(freeze, ['decision-producer', 'custodian'], registry, { bundle_id: b.bundle_id }, time(now));
  const custodian = registered.signers[2];
  requireThat(signers[1].key_id === custodian.key_id &&
    registered.signers.every(s => s.organization_id !== signers[0].organization_id), 'decision_custody_independence');
  return { ...registered, freeze_hash: hash(freeze), decision_signers: signers };
}

export function evaluate(bundle, pinnedHash, now, readArtifact) {
  exact(bundle, 'registry registration freeze reveal');
  const { registry, registration, freeze, reveal } = bundle;
  const locked = freezeDecisions(registration, freeze, registry, pinnedHash, now, readArtifact), b = locked.body, r = reveal.body;
  exact(r, 'version bundle_id registration_hash freeze_hash revealed_at salt truth');
  requireThat(r.version === 'infopunks.external-eval.reveal.v1' && r.bundle_id === b.bundle_id &&
    r.registration_hash === locked.registration_hash && r.freeze_hash === locked.freeze_hash, 'reveal_binding');
  requireThat(time(freeze.body.created_at) < time(r.revealed_at) && time(r.revealed_at) <= time(now), 'reveal_time');
  requireThat(typeof r.salt === 'string' && /^[a-f0-9]{64}$/.test(r.salt) &&
    hash({ salt: r.salt, truth: r.truth }) === b.truth_commitment, 'truth_commitment_mismatch');
  exact(r.truth, 'rows'); complete(r.truth.rows, b.cases.map(c => c.case_id));
  const signers = document(reveal, ['outcome-assessor', 'value-reviewer', 'cost-reviewer', 'custodian'], registry,
    { bundle_id: b.bundle_id }, time(now));
  requireThat(signers[3].key_id === locked.signers[2].key_id &&
    new Set(signers.map(s => s.organization_id)).size === signers.length &&
    signers.slice(0, 3).every(s => s.organization_id !== locked.decision_signers[0].organization_id &&
      s.organization_id !== locked.signers[0].organization_id), 'independent_truth_required');
  const rows = r.truth.rows.map(t => {
    exact(t, 'case_id arm outcome outcome_evidence_hash earned_minor downside_minor value_evidence_hash costs');
    requireThat(['verified_success', 'verified_failure', 'disputed', 'missing_counterfactual'].includes(t.outcome), 'delivery_outcome');
    for (const k of ['outcome_evidence_hash', 'value_evidence_hash']) if (t[k] !== null) sha(t[k]);
    amount(t.earned_minor); amount(t.downside_minor);
    const verified = ['verified_success', 'verified_failure'].includes(t.outcome);
    requireThat(!verified || (t.outcome_evidence_hash && t.value_evidence_hash && t.earned_minor !== null && t.downside_minor !== null), 'verified_outcome_evidence_required');
    requireThat(verified || (t.earned_minor === null && t.downside_minor === null), 'unverified_value_forbidden');
    requireThat(Array.isArray(t.costs) && t.costs.length === costKinds.length, 'all_cost_categories_required');
    unique(t.costs, c => c.kind);
    for (const c of t.costs) {
      exact(c, 'kind amount_minor evidence_hash missing_reason');
      requireThat(costKinds.includes(c.kind), 'unknown_cost'); amount(c.amount_minor);
      if (c.amount_minor === null) { text(c.missing_reason); requireThat(c.evidence_hash === null, 'missing_cost_evidence'); }
      else { sha(c.evidence_hash); requireThat(c.missing_reason === null, 'cost_evidence_required'); }
    }
    const decision = freeze.body.rows.find(d => d.case_id === t.case_id && d.arm === t.arm);
    const c = b.cases.find(c => c.case_id === t.case_id);
    const known = t.costs.every(c => c.amount_minor !== null);
    const total = known ? t.costs.reduce((n, c) => n + (c.kind === 'refund' ? -1n : 1n) * BigInt(c.amount_minor), 0n) : null;
    const net = total === null || (decision.preference === 'select' && !verified) ? null :
      ((decision.preference === 'abstain' ? 0n : BigInt(t.earned_minor) - BigInt(t.downside_minor)) - total).toString();
    return { case_id: t.case_id, split: c.split, provider_id: c.provider_id, cluster_id: c.cluster_id,
      arm: t.arm, preference: decision.preference, full_verdict: decision.full_verdict, outcome: t.outcome,
      missing_counterfactual: t.outcome === 'missing_counterfactual', outcome_evidence_hash: t.outcome_evidence_hash,
      earned_minor: t.earned_minor, downside_minor: t.downside_minor, value_evidence_hash: t.value_evidence_hash,
      costs: t.costs, total_cost_minor: total?.toString() ?? null, net_minor: net, execution_authorized: false };
  });
  const summaries = ['development', 'heldout'].flatMap(split => arms.map(arm => {
    const group = rows.filter(r => r.arm === arm && r.split === split);
    return { split, arm, cases: group.length, missing_outcomes: group.filter(r => r.missing_counterfactual).length,
      unknown_costs: group.reduce((n, r) => n + r.costs.filter(c => c.amount_minor === null).length, 0),
      net_minor: !group.length || group.some(r => r.net_minor === null) ? null : group.reduce((n, r) => n + BigInt(r.net_minor), 0n).toString() };
  }));
  const paired = b.cases.map(c => {
    const full = rows.find(r => r.case_id === c.case_id && r.arm === 'full_radar');
    return { case_id: c.case_id, split: c.split, incremental_vs: Object.fromEntries(arms.filter(a => a !== 'full_radar').map(a => {
      const comparator = rows.find(r => r.case_id === c.case_id && r.arm === a);
      return [a, full.net_minor === null || comparator.net_minor === null ? null : (BigInt(full.net_minor) - BigInt(comparator.net_minor)).toString()];
    })) };
  });
  artifacts(r.truth.rows.flatMap(t => [t.outcome_evidence_hash, t.value_evidence_hash,
    ...t.costs.map(c => c.evidence_hash)].filter(h => h !== null)), readArtifact);
  return { version: 'infopunks.external-eval.report.v1', status: 'HOLD', economic_usefulness: 'NOT_ESTABLISHED',
    execution_authorized: false, registry_hash: pinnedHash, registration_hash: locked.registration_hash,
    freeze_hash: locked.freeze_hash, reveal_hash: hash(reveal), currency: b.currency, unit_scale: b.unit_scale,
    rows, summaries, paired, approval: 'INDEPENDENT_REVIEW_REQUIRED' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Inputs stay local; the out-of-band registry pin and review time are mandatory.
  // Exclusive output creation prevents silently replacing a frozen result.
  try {
    const [mode, input, pin, now, archive, output] = process.argv.slice(2);
    requireThat(['register', 'freeze', 'evaluate'].includes(mode) && input && archive && output, 'usage: intake.mjs register|freeze|evaluate input.json registry-sha256 UTC-time private-archive output.json');
    const readArtifact = h => {
      sha(h); const p = resolve(archive, h.slice(7));
      requireThat(lstatSync(p).isFile() && !lstatSync(p).isSymbolicLink(), 'regular_evidence_file_required');
      return readFileSync(p);
    };
    const bundle = JSON.parse(readFileSync(input, 'utf8'));
    let result;
    if (mode === 'evaluate') result = evaluate(bundle, pin, now, readArtifact);
    else {
      exact(bundle, mode === 'register' ? 'registry registration' : 'registry registration freeze');
      const lock = mode === 'register' ? register(bundle.registration, bundle.registry, pin, now, readArtifact) :
        freezeDecisions(bundle.registration, bundle.freeze, bundle.registry, pin, now, readArtifact);
      result = { status: 'HOLD', execution_authorized: false, registration_hash: lock.registration_hash,
        ...(lock.freeze_hash ? { freeze_hash: lock.freeze_hash } : {}) };
    }
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'HOLD', output_digest: digest(readFileSync(output)), execution_authorized: false }));
  } catch (e) { console.error(JSON.stringify({ status: 'HOLD', error: e.message, execution_authorized: false })); process.exitCode = 1; }
}
