import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { resetSignalHuntStoreForTests } from '../src/data/signalHunt';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('signal hunt api', () => {
  beforeEach(() => {
    resetSignalHuntStoreForTests();
  });

  afterEach(() => {
    resetSignalHuntStoreForTests();
  });

  it('returns the seeded Signal Hunt board and detail records', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/signal-hunt' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.objectContaining({
        counts: expect.objectContaining({
          total: 5,
          fresh_signal: 1,
          under_review: 1,
          verified_signal: 1,
          noise: 1,
          disputed: 1
        }),
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: 'hunt_black_bull_coordination',
            proof_state: 'validated',
            hunt_state: 'verified_signal',
            decision_state: 'signal',
            linked_check_ids: ['check_route_pay_sh_seed']
          }),
          expect.objectContaining({
            id: 'hunt_disputed_provider_rep',
            proof_state: 'challenged',
            hunt_state: 'disputed'
          })
        ])
      }));

      const detail = await app.inject({ method: 'GET', url: '/v1/signal-hunt/hunt_troll_reindex' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        id: 'hunt_troll_reindex',
        title: expect.stringContaining('TROLL'),
        linked_signal_ids: ['troll'],
        decision_state: 'review'
      }));
    } finally {
      await app.close();
    }
  });

  it('creates and verifies Signal Hunt submissions', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/signal-hunt/submit',
        payload: {
          title: 'Provider quality story is forming before the receipts are clean',
          handle_or_source: '@opswatch',
          category: 'provider_reputation',
          thesis: 'The public loop is front-running the proof layer.',
          why_it_matters: 'Signal Hunt should catch provider reputation drift before spend decisions inherit bad myths.',
          evidence: ['Screenshots are circulating faster than receipts.'],
          submitted_by: 'community',
          tags: ['provider-reputation', 'watch']
        }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().data).toEqual(expect.objectContaining({
        id: expect.stringMatching(/^hunt_/),
        hunt_state: 'fresh_signal',
        proof_state: 'receipts_attached',
        decision_state: 'review'
      }));

      const signalId = created.json().data.id as string;
      const verified = await app.inject({
        method: 'POST',
        url: `/v1/signal-hunt/${encodeURIComponent(signalId)}/verify`,
        payload: {
          verifier: 'desk',
          verdict: 'verified_signal',
          proof_state: 'validated',
          decision_note: 'Linked proof and loop memory now support promotion.',
          linked_check_ids: ['check_route_pay_sh_seed'],
          linked_loop_ids: ['loop_pre_spend_route'],
          linked_signal_ids: ['black-bull'],
          linked_route_ids: ['route_pay_sh_market_research_01']
        }
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.json().data).toEqual(expect.objectContaining({
        id: signalId,
        hunt_state: 'verified_signal',
        proof_state: 'validated',
        decision_state: 'signal',
        linked_check_ids: expect.arrayContaining(['check_route_pay_sh_seed']),
        linked_loop_ids: expect.arrayContaining(['loop_pre_spend_route'])
      }));
      expect(verified.json().data.evidence.at(-1)).toContain('Linked proof and loop memory now support promotion.');
    } finally {
      await app.close();
    }
  });

  it('validates Signal Hunt submit and verify payloads', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const invalidSubmit = await app.inject({
        method: 'POST',
        url: '/v1/signal-hunt/submit',
        payload: {
          title: '',
          handle_or_source: '',
          category: '',
          thesis: '',
          why_it_matters: '',
          evidence: [],
          submitted_by: ''
        }
      });
      expect(invalidSubmit.statusCode).toBe(400);

      const invalidVerify = await app.inject({
        method: 'POST',
        url: '/v1/signal-hunt/hunt_black_bull_coordination/verify',
        payload: {
          verifier: '',
          verdict: 'not-real',
          decision_note: ''
        }
      });
      expect(invalidVerify.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('returns not found for unknown Signal Hunt ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const detail = await app.inject({ method: 'GET', url: '/v1/signal-hunt/not-real' });
      expect(detail.statusCode).toBe(404);
      expect(detail.json()).toEqual({ error: 'signal_hunt_not_found' });

      const verify = await app.inject({
        method: 'POST',
        url: '/v1/signal-hunt/not-real/verify',
        payload: { verifier: 'desk', verdict: 'noise', decision_note: 'No proof.' }
      });
      expect(verify.statusCode).toBe(404);
      expect(verify.json()).toEqual({ error: 'signal_hunt_not_found' });
    } finally {
      await app.close();
    }
  });
});
