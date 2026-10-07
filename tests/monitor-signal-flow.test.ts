import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { resetSignalHuntStoreForTests } from '../src/data/signalHunt';

const monitorSignal = {
  headline: '$MONITOR pumping on Robinhood vs tokenized PLTR',
  source: 'https://x.com/monitoringmeme',
  category: 'narrative_market',
  assets: ['MONITOR', 'PLTR'],
  linked_check_id: ''
};

const monitorPreSpend = {
  agent_id: 'infopunks_launch_surface',
  intent: 'allocate_to_pltr_paired_narrative_token',
  subject_id: 'monitor',
  budget: 25,
  risk_tolerance: 'low',
  preferred_settlement: 'tokenized_pltr',
  required_confidence: 75,
  linked_check_id: 'check_monitor'
};

describe('MONITOR Signal Hunt to LoopLab flow', () => {
  afterEach(() => {
    resetSignalHuntStoreForTests();
  });

  it('keeps the signal, Proof Feed, pre-spend decision, and LoopLab fixture joinable by IDs', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const signalResponse = await app.inject({
        method: 'POST',
        url: '/v1/signal-hunt/submit',
        payload: monitorSignal
      });
      expect(signalResponse.statusCode).toBe(200);
      const signal = signalResponse.json().data;
      expect(signal).toEqual(expect.objectContaining({
        id: 'hunt_monitor_narrative_pltr',
        category: 'narrative_market',
        linked_check_ids: ['check_monitor'],
        linked_loop_ids: ['monitor-narrative-pre-spend']
      }));

      const checkResponse = await app.inject({ method: 'GET', url: '/v1/checks/check_monitor' });
      expect(checkResponse.statusCode).toBe(200);
      expect(checkResponse.json().data).toEqual(expect.objectContaining({
        check_id: 'check_monitor',
        subject_id: 'subject_monitor',
        decision_state: 'caution',
        missing_receipts: expect.arrayContaining(['audit', 'team_dox', 'utility_commitment', 'paid_route_benchmark'])
      }));

      const preSpendResponse = await app.inject({
        method: 'POST',
        url: '/v1/pre-spend/check',
        payload: monitorPreSpend
      });
      expect(preSpendResponse.statusCode).toBe(200);
      expect(preSpendResponse.json().data).toEqual(expect.objectContaining({
        subject: 'monitor',
        intent: monitorPreSpend.intent,
        decision: 'use_with_caution',
        required_confidence: 75,
        linked_check_id: 'check_monitor',
        proof_check_reference: '/check/monitor',
        known_blockers: expect.arrayContaining([
          'The target is unaudited; no audit receipt is attached.',
          'No Pay.sh paid route benchmark is attached for this spend target.',
          'Utility is explicitly disclaimed or otherwise not substantiated by a utility commitment receipt.',
          'The PLTR pair establishes existence, not pool depth or volatility safety; treat liquidity as thin or volatile until evidenced.',
          'Narrative heat currently outruns evidence-ledger coverage.'
        ])
      }));
      const preSpend = preSpendResponse.json().data;
      expect(['approved', 'approved_with_warning']).not.toContain(preSpend.decision);
      expect(preSpend.judgment).toEqual(expect.objectContaining({
        receipt_id: 'judgment_monitor_allocate_to_pltr_paired_narrative_token_check_monitor',
        subject: 'monitor',
        decision: 'DEGRADE',
        confidence: 0,
        outcome_status: 'NOT_VERIFIED',
        evidence_references: expect.arrayContaining(['check_monitor', '/check/monitor'])
      }));
      expect(preSpend.judgment.decision).not.toBe('ALLOW');
      expect(['ALLOW', 'DEGRADE', 'BLOCK']).toContain(preSpend.judgment.decision);
      expect(['NOT_VERIFIED', 'PENDING', 'VERIFIED']).toContain(preSpend.judgment.outcome_status);
      expect(preSpend.judgment.outcome_status).toBe('NOT_VERIFIED');
      expect(preSpend.judgment.primary_reason).toBeTruthy();
      expect(preSpend.judgment.reasons.length).toBeGreaterThan(0);

      const loopResponse = await app.inject({ method: 'GET', url: '/v1/loops/monitor-narrative-pre-spend' });
      expect(loopResponse.statusCode).toBe(200);
      expect(loopResponse.json().data).toEqual(expect.objectContaining({
        id: 'monitor-narrative-pre-spend',
        linked_check_id: 'check_monitor',
        proof_state: 'unproven',
        decision_state: 'caution',
        failure_reason: 'No payment executed; outcome remains NOT_VERIFIED.',
        evidence_artifacts: expect.arrayContaining([
          'artifact://signal-hunt/hunt_monitor_narrative_pltr',
          'artifact://proof-feed/check_monitor',
          'artifact://pre-spend/check_monitor'
        ])
      }));
    } finally {
      await app.close();
    }
  });

  it('does not duplicate the deterministic MONITOR Signal Hunt fixture on repeat submission', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const first = await app.inject({ method: 'POST', url: '/v1/signal-hunt/submit', payload: monitorSignal });
      const second = await app.inject({ method: 'POST', url: '/v1/signal-hunt/submit', payload: monitorSignal });
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(second.json().data.id).toBe(first.json().data.id);
      expect((await app.inject({ method: 'GET', url: '/v1/signal-hunt' })).json().data.counts.total).toBe(6);
    } finally {
      await app.close();
    }
  });
});
