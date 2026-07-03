import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { HermesRun } from '../src/data/hermesDesk';
import { convertHermesRunToReceipt } from '../src/services/hermesReceiptConverter';
import { getHermesPreSpendDecisionExample } from '../src/services/hermesPreSpendDecision';
import { getDefaultHermesSpendPolicy, getHermesSpendPolicyExampleCheck } from '../src/services/hermesSpendPolicy';
import { previewHermesPolicyReconciliation } from '../src/services/hermesPolicyReconciliation';
import { buildHermesWalletAuditTrail } from '../src/services/hermesWalletAuditTrail';
import { buildHermesWalletRiskScore } from '../src/services/hermesWalletRiskScore';

describe('Hermes Desk API', () => {
  const originalHermesEnv = {
    HERMES_ENABLED: process.env.HERMES_ENABLED,
    HERMES_MODE: process.env.HERMES_MODE,
    HERMES_BASE_URL: process.env.HERMES_BASE_URL,
    HERMES_API_KEY: process.env.HERMES_API_KEY
  };

  beforeEach(() => {
    delete process.env.HERMES_ENABLED;
    delete process.env.HERMES_MODE;
    delete process.env.HERMES_BASE_URL;
    delete process.env.HERMES_API_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalHermesEnv)) {
      if (typeof value === 'string') process.env[key] = value;
      else delete process.env[key];
    }
  });

  it('returns the Hermes Desk summary in mock-safe mode', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.title).toBe('Hermes Desk');
    expect(body.data.hero_copy).toBe('Agentic investigations before money moves.');
    expect(body.data.explanation).toBe('Hermes runs the loop. Infopunks keeps the receipts.');
    expect(body.data.sidecar.live_http_allowed).toBe(false);
    expect(body.data.runs.length).toBeGreaterThanOrEqual(3);
    expect(body.data.skills.map((skill: any) => skill.label)).toEqual(expect.arrayContaining([
      'pre-spend route check',
      'provider risk check',
      'receipt validator',
      'claim dispute review',
      'signal hunt analyst',
      'carbon credit instrument check'
    ]));

    await app.close();
  });

  it('returns the primary Hermes Skill Pack manifest and seeded skills', async () => {
    const app = await createApp();

    const pack = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack' });
    const skills = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack/skills' });
    const skill = await app.inject({ method: 'GET', url: '/v1/hermes/skill-pack/skills/receipt-validator' });

    expect(pack.statusCode).toBe(200);
    expect(pack.json().data).toEqual(expect.objectContaining({
      id: 'infopunks-pre-spend-skill-pack',
      title: 'Infopunks Pre-Spend Skill Pack',
      summary: 'A skill pack for agentic investigations before money moves.',
      tagline: 'Hermes runs the investigation. Infopunks keeps the receipts.',
      version: '0.1.0'
    }));
    expect(pack.json().data.doctrine_rules.map((rule: any) => rule.title)).toEqual(expect.arrayContaining([
      'No receipt, no trust.',
      'Separate claim from evidence.',
      'Unknown is a valid state.',
      'Prefer do_not_use_yet over fake confidence.'
    ]));
    expect(skills.statusCode).toBe(200);
    expect(skills.json().data.count).toBe(6);
    expect(skills.json().data.skills.map((item: any) => item.id)).toEqual(expect.arrayContaining([
      'pre-spend-route-check',
      'provider-risk-check',
      'receipt-validator',
      'claim-dispute-review',
      'signal-hunt-analyst',
      'carbon-credit-instrument-check'
    ]));
    expect(skill.statusCode).toBe(200);
    expect(skill.json().data).toEqual(expect.objectContaining({
      id: 'receipt-validator',
      title: 'Receipt Validator'
    }));

    await app.close();
  });

  it('converts a seeded Hermes run into a receipt and claim candidate', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/receipt' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.run_id).toBe('hermes_pay_sh_route_pre_spend_check');
    expect(body.data.receipt).toEqual(expect.objectContaining({
      id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
      source_run_id: 'hermes_pay_sh_route_pre_spend_check',
      decision: 'caution',
      confidence: 82,
      evidence_count: 2,
      receipt_kind: 'agent_run_receipt',
      source: 'hermes'
    }));
    expect(body.data.claim_candidate).toEqual(expect.objectContaining({
      id: 'claim_candidate_hermes_hermes_pay_sh_route_pre_spend_check',
      source_receipt_id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
      status: 'candidate',
      confidence: 82
    }));
    expect(body.data.claim_candidate.claim).toContain('limited or test spend');
    expect(body.data.conversion.status).toBe('converted');

    await app.close();
  });

  it('promotes a seeded Hermes claim candidate into a reviewed claim', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/claim/promote' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.run_id).toBe('hermes_pay_sh_route_pre_spend_check');
    expect(body.data.promoted_claim).toEqual(expect.objectContaining({
      id: 'claim_hermes_promoted_hermes_pay_sh_route_pre_spend_check',
      source: 'hermes_agent_run',
      source_run_id: 'hermes_pay_sh_route_pre_spend_check',
      source_receipt_id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
      review_state: 'needs_more_evidence',
      decision: 'caution',
      confidence: 82,
      evidence_count: 2
    }));
    expect(body.data.promoted_claim.reputation_impact).toEqual(expect.objectContaining({
      direction: 'watch',
      magnitude: 0.82
    }));
    expect(body.data.review).toEqual(expect.objectContaining({
      state: 'needs_more_evidence',
      reviewer: 'infopunks_mock_reviewer'
    }));
    expect(body.data.conversion.status).toBe('promoted');

    await app.close();
  });

  it('accepts a valid review_state override during claim promotion', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/runs/hermes_pay_sh_route_pre_spend_check/claim/promote',
      payload: { review_state: 'accepted' }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.promoted_claim.review_state).toBe('accepted');
    expect(body.data.review.state).toBe('accepted');

    await app.close();
  });

  it('returns 404 for missing Hermes run claim promotion', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/not-real/claim/promote' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_run_not_found'
    }));

    await app.close();
  });

  it('returns 404 for missing Hermes run receipt conversion', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/v1/hermes/runs/not-real/receipt' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_run_not_found'
    }));

    await app.close();
  });

  it('keeps receipt conversion safe when a run has no artifacts', () => {
    const conversion = convertHermesRunToReceipt({
      id: 'hermes_no_artifacts',
      title: 'No Artifact Test',
      objective: 'Check missing artifacts.',
      state: 'completed',
      decision: 'unproven',
      confidence: 44,
      summary: 'No artifacts were attached.',
      risk_factors: [],
      artifacts: [],
      linked_receipt_id: null,
      linked_claim_id: null,
      linked_loop_id: null,
      created_at: '2026-07-03T00:00:00.000Z',
      completed_at: '2026-07-03T00:01:00.000Z'
    } satisfies HermesRun);

    expect(conversion.receipt.evidence_count).toBe(0);
    expect(conversion.claim_candidate.claim).toContain('remains unproven');
    expect(conversion.conversion.notes.join(' ')).toContain('No artifacts were attached');
  });

  it('lists and retrieves seeded Hermes runs', async () => {
    const app = await createApp();

    const list = await app.inject({ method: 'GET', url: '/v1/hermes/runs' });
    const listBody = list.json();
    const runId = 'hermes_pay_sh_route_pre_spend_check';
    const detail = await app.inject({ method: 'GET', url: `/v1/hermes/runs/${runId}` });
    const detailBody = detail.json();

    expect(list.statusCode).toBe(200);
    expect(listBody.data.count).toBeGreaterThanOrEqual(3);
    expect(listBody.data.runs.map((run: any) => run.title)).toEqual(expect.arrayContaining([
      'Pay.sh Route Pre-Spend Check',
      'Agentic Market Provider Risk Review',
      'Signal Hunt Narrative Scan'
    ]));
    expect(detail.statusCode).toBe(200);
    expect(detailBody.data).toEqual(expect.objectContaining({
      id: runId,
      decision: 'caution',
      linked_receipt_id: 'receipt_001',
      linked_claim_id: 'claim_001',
      linked_loop_id: 'loop_pre_spend_route'
    }));

    await app.close();
  });

  it('returns the Hermes Reputation Ledger summary', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/reputation-ledger' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.entry_count).toBeGreaterThanOrEqual(3);
    expect(body.data.provider_count).toBeGreaterThanOrEqual(1);
    expect(body.data.route_count).toBeGreaterThanOrEqual(1);
    expect(body.data.entries.map((entry: any) => entry.target_type)).toEqual(expect.arrayContaining(['provider', 'route', 'service']));

    await app.close();
  });

  it('returns the wallet audit trail summary', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-audit-trail' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.trail_count).toBeGreaterThanOrEqual(1);
    expect(body.data.trails[0]).toEqual(expect.objectContaining({
      title: 'Autonomous Wallet Audit Trail'
    }));
    expect(body.data.trails[0].events.map((event: any) => event.kind)).toEqual([
      'spend_intent',
      'pre_spend_decision',
      'decision_receipt',
      'policy_check',
      'policy_receipt',
      'wallet_outcome',
      'reconciliation',
      'feedback'
    ]);

    await app.close();
  });

  it('returns one deterministic wallet audit trail by id', async () => {
    const app = await createApp();
    const trail = buildHermesWalletAuditTrail();

    const response = await app.inject({ method: 'GET', url: `/v1/hermes/wallet-audit-trail/${encodeURIComponent(trail.id)}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      id: trail.id,
      source_check_id: trail.source_check_id
    }));

    await app.close();
  });

  it('returns 404 for an unknown wallet audit trail id', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-audit-trail/not-real' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_wallet_audit_trail_not_found'
    }));

    await app.close();
  });

  it('returns the wallet risk score summary', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-risk-score' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.score_count).toBeGreaterThanOrEqual(1);
    expect(body.data.scores[0]).toEqual(expect.objectContaining({
      risk_score: expect.any(Number),
      safety_rating: expect.any(String),
      required_next_action: expect.any(String)
    }));
    expect(body.data.scores[0].top_risks.length).toBeGreaterThanOrEqual(1);
    expect(body.data.scores[0].positive_controls.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('returns one deterministic wallet risk score by id', async () => {
    const app = await createApp();
    const score = buildHermesWalletRiskScore();

    const response = await app.inject({ method: 'GET', url: `/v1/hermes/wallet-risk-score/${encodeURIComponent(score.id)}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      id: score.id,
      source_trail_id: score.source_trail_id
    }));

    await app.close();
  });

  it('returns 404 for an unknown wallet risk score id', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/wallet-risk-score/not-real' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_wallet_risk_score_not_found'
    }));

    await app.close();
  });

  it('returns the Hermes Agent Memory Loop summary', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/memory-loop' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.generated_at).toBe('2026-07-03T00:00:00.000Z');
    expect(body.data.loop_count).toBeGreaterThanOrEqual(1);
    expect(body.data.loops[0].source_run_id).toBe('hermes_pay_sh_route_pre_spend_check');
    expect(body.data.loops[0].stages.map((stage: any) => stage.label)).toEqual([
      'Run',
      'Receipt',
      'Claim',
      'Review',
      'Reputation',
      'Decision',
      'Outcome',
      'Feedback'
    ]);

    await app.close();
  });

  it('returns seeded Hermes spend policies', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/spend-policy' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.count).toBeGreaterThanOrEqual(2);
    expect(body.data.policies.map((policy: any) => policy.id)).toContain(getDefaultHermesSpendPolicy().id);
    expect(body.data.rules.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('returns a deterministic Hermes spend policy example', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/spend-policy/example' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.policy.id).toBe(getDefaultHermesSpendPolicy().id);
    expect(body.data.references.map((item: any) => item.kind)).toEqual(expect.arrayContaining(['policy', 'pre_spend_decision']));

    await app.close();
  });

  it('returns one Hermes Agent Memory Loop by id', async () => {
    const app = await createApp();
    const loopId = 'hermes_memory_loop_hermes_pay_sh_route_pre_spend_check';

    const response = await app.inject({ method: 'GET', url: `/v1/hermes/memory-loop/${loopId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      id: loopId,
      title: 'Agent Memory Loop',
      source_run_id: 'hermes_pay_sh_route_pre_spend_check'
    }));

    await app.close();
  });

  it('returns 404 for unknown Hermes Agent Memory Loop ids', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/memory-loop/not-real' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_memory_loop_not_found'
    }));

    await app.close();
  });

  it('returns a pre-spend decision for seeded Hermes IDs', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-decision',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'base'
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.input.route_id).toBe('route_pay_sh_market_research_01');
    expect(body.data.input.provider_id).toBe('provider_pay_sh_lattice');
    expect(body.data.reputation_inputs.length).toBeGreaterThanOrEqual(1);
    expect(body.data.claim_inputs.length).toBeGreaterThanOrEqual(1);
    expect(body.data.decision).toBe('do_not_spend');

    await app.close();
  });

  it('returns insufficient evidence for unknown pre-spend decision ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-decision',
      payload: {
        route_id: 'route_unknown',
        provider_id: 'provider_unknown',
        service_id: 'service_unknown'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      decision: 'insufficient_evidence',
      required_action: 'request_more_evidence',
      confidence: 0.35
    }));

    await app.close();
  });

  it('requires a more cautious action for high amount pre-spend decisions', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-decision',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 1250,
        payment_rail: 'x402',
        chain: 'base'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.required_action).toBe('manual_review_required');

    await app.close();
  });

  it('returns a deterministic pre-spend decision example', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/pre-spend-decision/example' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      input: expect.objectContaining({
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25
      }),
      generated_at: '2026-07-03T00:00:00.000Z'
    }));

    await app.close();
  });

  it('returns a spend policy check for seeded Hermes input', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/spend-policy/check',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'base'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      policy: expect.objectContaining({ id: getDefaultHermesSpendPolicy().id }),
      pre_spend_decision: expect.objectContaining({ id: expect.any(String) }),
      references: expect.any(Array)
    }));

    await app.close();
  });

  it('blocks unsupported chain in the spend policy check', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/spend-policy/check',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'ethereum'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.decision).toBe('block');

    await app.close();
  });

  it('requires manual review or block for higher-amount spend policy checks', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/spend-policy/check',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 1250,
        payment_rail: 'x402',
        chain: 'base'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(['require_manual_review', 'block']).toContain(response.json().data.decision);

    await app.close();
  });

  it('returns a policy receipt preview for the deterministic example check', async () => {
    const app = await createApp();
    const check = getHermesSpendPolicyExampleCheck();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/receipt-preview`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      check_id: check.id,
      receipt: expect.objectContaining({
        source_check_id: check.id,
        receipt_kind: 'spend_policy_decision_receipt'
      })
    }));

    await app.close();
  });

  it('returns a policy receipt conversion for the deterministic example check', async () => {
    const app = await createApp();
    const check = getHermesSpendPolicyExampleCheck();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/receipt`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.receipt).toEqual(expect.objectContaining({
      source_check_id: check.id,
      source_policy_id: getDefaultHermesSpendPolicy().id,
      audit_trail: expect.objectContaining({
        events: expect.any(Array)
      })
    }));

    await app.close();
  });

  it('returns a reconciliation preview for the deterministic example check', async () => {
    const app = await createApp();
    const check = getHermesSpendPolicyExampleCheck();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/reconciliation-preview`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      check_id: check.id,
      policy_receipt_id: previewHermesPolicyReconciliation(check).policy_receipt_id,
      feedback: expect.objectContaining({ status: 'preview' })
    }));

    await app.close();
  });

  it('returns a reconciliation result for outcome POST', async () => {
    const app = await createApp();
    const check = getHermesSpendPolicyExampleCheck();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/outcome`,
      payload: {
        outcome_state: 'blocked_as_required',
        outcome_summary: 'Wallet stayed blocked after policy denied autonomous spend.',
        spend_happened: false,
        amount_usd: 25,
        observed_latency_ms: 1800,
        evidence_artifacts: []
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      check_id: check.id,
      outcome: expect.objectContaining({ outcome_state: 'blocked_as_required' }),
      feedback: expect.objectContaining({ status: 'recorded' })
    }));

    await app.close();
  });

  it('returns non_compliant when spent_despite_block is posted for the example block check', async () => {
    const app = await createApp();
    const check = getHermesSpendPolicyExampleCheck();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/outcome`,
      payload: {
        outcome_state: 'spent_despite_block',
        spend_happened: true,
        amount_usd: 25,
        evidence_artifacts: []
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      compliance_state: 'non_compliant',
      findings: expect.arrayContaining([expect.objectContaining({ label: 'Spent despite block' })])
    }));

    await app.close();
  });

  it('returns 404 for unknown policy receipt preview check ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/hermes/spend-policy/check/not-real/receipt-preview'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_spend_policy_check_not_found'
    }));

    await app.close();
  });

  it('returns 404 for unknown policy reconciliation preview check ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/hermes/spend-policy/check/not-real/reconciliation-preview'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_spend_policy_check_not_found'
    }));

    await app.close();
  });

  it('returns 404 for unknown policy receipt check ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/spend-policy/check/not-real/receipt'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_spend_policy_check_not_found'
    }));

    await app.close();
  });

  it('returns 404 for unknown policy outcome check ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/spend-policy/check/not-real/outcome',
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_spend_policy_check_not_found'
    }));

    await app.close();
  });

  it('returns a decision receipt for the deterministic example decision', async () => {
    const app = await createApp();
    const decision = getHermesPreSpendDecisionExample();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/pre-spend-decision/${encodeURIComponent(decision.id)}/receipt`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      decision_id: decision.id,
      receipt: expect.objectContaining({
        source_decision_id: decision.id,
        receipt_kind: 'pre_spend_decision_receipt'
      })
    }));

    await app.close();
  });

  it('returns a feedback result for the deterministic example decision', async () => {
    const app = await createApp();
    const decision = getHermesPreSpendDecisionExample();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/pre-spend-decision/${encodeURIComponent(decision.id)}/outcome`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      decision_id: decision.id,
      receipt: expect.objectContaining({
        source_decision_id: decision.id
      }),
      outcome: expect.objectContaining({
        source_decision_id: decision.id
      }),
      reputation_feedback: expect.objectContaining({
        direction: expect.any(String)
      })
    }));

    await app.close();
  });

  it('returns 404 for unknown decision receipt ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-decision/not-real/receipt'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_pre_spend_decision_not_found'
    }));

    await app.close();
  });

  it('returns 404 for unknown decision outcome ids', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-decision/not-real/outcome'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_pre_spend_decision_not_found'
    }));

    await app.close();
  });

  it('accepts a valid outcome override on the decision outcome endpoint', async () => {
    const app = await createApp();
    const decision = getHermesPreSpendDecisionExample();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/hermes/pre-spend-decision/${encodeURIComponent(decision.id)}/outcome`,
      payload: {
        outcome_state: 'successful',
        outcome_summary: 'Provider completed the service within expected bounds.',
        spend_happened: true,
        amount_usd: 25,
        observed_latency_ms: 1800,
        evidence_artifacts: []
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.outcome.outcome_state).toBe('successful');
    expect(response.json().data.outcome.spend_happened).toBe(true);

    await app.close();
  });

  it('returns Hermes provider reputation entries', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/reputation-ledger/providers' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.count).toBeGreaterThanOrEqual(1);
    expect(body.data.entries.every((entry: any) => entry.target_type === 'provider')).toBe(true);
    expect(body.data.entries.map((entry: any) => entry.target_id)).toContain('provider_pay_sh_lattice');

    await app.close();
  });

  it('returns Hermes route reputation entries', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/reputation-ledger/routes' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.count).toBeGreaterThanOrEqual(1);
    expect(body.data.entries.every((entry: any) => entry.target_type === 'route')).toBe(true);
    expect(body.data.entries.map((entry: any) => entry.target_id)).toContain('route_pay_sh_market_research_01');

    await app.close();
  });

  it('returns one seeded Hermes reputation entry by target', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/hermes/reputation-ledger/provider/provider_pay_sh_lattice'
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice'
    }));
    expect(body.data.decision_history.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('returns 404 for missing Hermes reputation entries', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/reputation-ledger/provider/not-real' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(expect.objectContaining({
      error: 'hermes_reputation_entry_not_found'
    }));

    await app.close();
  });

  it('creates a mock pre-spend run without requiring Hermes sidecar', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/hermes/pre-spend-run',
      payload: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        spend_context: {
          intent: 'buy_market_research',
          budget_usd: 25
        }
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      title: 'Mock Hermes Pre-Spend Run',
      state: 'completed',
      decision: 'caution',
      linked_loop_id: 'loop_pre_spend_route',
      source: 'mock'
    }));
    expect(body.data.summary).toContain('No live Hermes sidecar call was made');
    expect(body.data.artifacts.length).toBeGreaterThanOrEqual(2);
    expect(body.data.lifecycle_events.map((event: any) => event.state)).toEqual([
      'queued',
      'mock_investigation_started',
      'mock_receipt_generated',
      'completed'
    ]);

    await app.close();
  });

  it('returns Hermes bridge health in mock mode when Hermes is disabled', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'GET', url: '/v1/hermes/health' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      enabled: false,
      mode: 'mock',
      status: 'mock'
    }));
    expect(body.data.error ?? null).toBeNull();

    await app.close();
  });
});
