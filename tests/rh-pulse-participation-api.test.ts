import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { RhPulseParticipationService } from '../src/services/rhPulseParticipationService';
import { InMemoryRhPulseParticipationStore } from '../src/services/rhPulseParticipationStore';
import { RhPulseService } from '../src/services/rhPulseService';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RhPulseCallChallengeResponseSchema,
  RhPulseCallSubmissionResponseSchema,
  RhPulsePublicCallResponseSchema,
  RhPulsePublicReceiptResponseSchema
} from '../src/shared/rhPulseCalls';

const NOW = new Date('2026-07-23T12:00:00.000Z');
const INTERNAL_TOKEN = 'test-rh-pulse-internal-token';
const account = privateKeyToAccount('0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8416088b20b6de5a8d');
const priorEnv = {
  NODE_ENV: process.env.NODE_ENV,
  RH_PULSE_CALLS_ENABLED: process.env.RH_PULSE_CALLS_ENABLED,
  RH_PULSE_INTERNAL_TOKEN: process.env.RH_PULSE_INTERNAL_TOKEN
};

afterEach(() => {
  restore('NODE_ENV', priorEnv.NODE_ENV);
  restore('RH_PULSE_CALLS_ENABLED', priorEnv.RH_PULSE_CALLS_ENABLED);
  restore('RH_PULSE_INTERNAL_TOKEN', priorEnv.RH_PULSE_INTERNAL_TOKEN);
});

async function apiHarness(callsEnabled = true) {
  process.env.NODE_ENV = 'test';
  process.env.RH_PULSE_CALLS_ENABLED = callsEnabled ? 'true' : 'false';
  process.env.RH_PULSE_INTERNAL_TOKEN = INTERNAL_TOKEN;
  const store = new InMemoryRhPulseParticipationStore();
  let participation!: RhPulseParticipationService;
  const evidence = new RhPulseService({
    crossLayer: async () => ({
      entries: [],
      captured_at: '2026-07-23T11:55:00.000Z',
      freshness: 'partial',
      confidence: 'low',
      warnings: ['No qualifying reviewed overlap.']
    }),
    callsEnabled,
    now: () => NOW,
    cacheTtlMs: 60_000,
    currentWindow: () => participation.getCurrentWindow()
  });
  participation = new RhPulseParticipationService({
    store,
    callsEnabled,
    now: () => NOW,
    readModel: () => evidence.getReadModel(),
    challengeRateLimit: { walletMax: 20, originMax: 20 }
  });
  const app = await createApp(emptyIntelligenceStore(), undefined, {
    rhPulseService: evidence,
    rhPulseParticipationStore: store,
    rhPulseParticipationService: participation
  });
  return { app, store };
}

async function openPilot(app: Awaited<ReturnType<typeof createApp>>) {
  const create = await app.inject({
    method: 'POST',
    url: '/internal/rh-pulse/windows',
    headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
    payload: {
      opens_at: NOW.toISOString(),
      closes_at: '2026-07-24T12:00:00.000Z',
      call_submission_closes_at: '2026-07-24T12:00:00.000Z',
      methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION,
      source_health: {
        state: 'delayed',
        observed_at: NOW.toISOString(),
        detail: 'Pilot source health is intentionally delayed.'
      },
      audit_note: 'Create local API pilot.'
    }
  });
  expect(create.statusCode).toBe(200);
  const windowId = create.json().data.window.id as string;
  const open = await app.inject({
    method: 'POST',
    url: `/internal/rh-pulse/windows/${windowId}/open`,
    headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
    payload: { audit_note: 'Open local API pilot.' }
  });
  expect(open.statusCode).toBe(200);
  return windowId;
}

describe('RH Pulse signed-call API', () => {
  it('creates a challenge, atomically accepts a signature and serves public call and receipt responses', async () => {
    const { app } = await apiHarness();
    try {
      const previewRead = await app.inject({ method: 'GET', url: '/v1/rh-pulse' });
      expect(previewRead.json().data.current_window).toMatchObject({
        state: 'preview',
        accepting_calls: false
      });

      const windowId = await openPilot(app);
      const preSubmissionRead = await app.inject({ method: 'GET', url: '/v1/rh-pulse' });
      expect(JSON.stringify(preSubmissionRead.json())).not.toContain('community_distribution');
      expect(preSubmissionRead.json().data.current_window).toMatchObject({
        id: windowId,
        state: 'open',
        accepting_calls: true,
        calls_enabled: true
      });

      const challengeResponse = await app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls/challenge',
        payload: {
          wallet_address: account.address,
          selected_outcome: 'agents_to_rwas'
        }
      });
      expect(challengeResponse.statusCode).toBe(200);
      expect(challengeResponse.headers['cache-control']).toBe('no-store');
      const challenge = RhPulseCallChallengeResponseSchema.parse(challengeResponse.json());
      const signature = await account.signMessage({ message: challenge.data.message });

      const submissionResponse = await app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls',
        payload: {
          challenge_id: challenge.data.challenge_id,
          signature
        }
      });
      expect(submissionResponse.statusCode).toBe(200);
      expect(submissionResponse.headers['cache-control']).toBe('no-store');
      const submission = RhPulseCallSubmissionResponseSchema.parse(submissionResponse.json());
      expect(submission.data.community_distribution).toMatchObject({
        total_verified_calls: 1,
        outcomes: [
          { outcome: 'agents_to_rwas', count: 1, percentage: 100 },
          { outcome: 'memes_to_agents', count: 0, percentage: 0 },
          { outcome: 'memes_to_rwas', count: 0, percentage: 0 },
          { outcome: 'no_qualified_rotation', count: 0, percentage: 0 }
        ]
      });
      expect(JSON.stringify(submission.data)).not.toContain(signature);

      const callId = submission.data.call.call_id;
      const publicCallResponse = await app.inject({ method: 'GET', url: `/v1/rh-pulse/calls/${callId}` });
      expect(publicCallResponse.statusCode).toBe(200);
      expect(() => RhPulsePublicCallResponseSchema.parse(publicCallResponse.json())).not.toThrow();
      expect(JSON.stringify(publicCallResponse.json())).not.toContain(signature);

      const receiptResponse = await app.inject({ method: 'GET', url: `/v1/rh-pulse/calls/${callId}/receipt` });
      expect(receiptResponse.statusCode).toBe(200);
      expect(() => RhPulsePublicReceiptResponseSchema.parse(receiptResponse.json())).not.toThrow();
      expect(receiptResponse.json().data).toMatchObject({ immutable: true });
    } finally {
      await app.close();
    }
  });

  it('keeps internal window controls authenticated and safely idempotent', async () => {
    const { app } = await apiHarness();
    try {
      const unauthorized = await app.inject({
        method: 'GET',
        url: '/internal/rh-pulse/windows'
      });
      expect(unauthorized.statusCode).toBe(401);
      expect(unauthorized.json().error).toBe('rh_pulse_internal_token_required');

      const windowId = await openPilot(app);
      const close = async () => app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/windows/${windowId}/close`,
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        payload: { audit_note: 'Close pilot idempotently.' }
      });
      expect((await close()).json().data.window.status).toBe('closed');
      expect((await close()).json().data.window.status).toBe('closed');
      const list = await app.inject({
        method: 'GET',
        url: '/internal/rh-pulse/windows',
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` }
      });
      expect(list.json().data).toMatchObject({
        storage: { adapter: 'memory', durable: false }
      });
      expect(list.json().data.windows).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('returns stable machine-readable disabled, replay and duplicate states', async () => {
    const disabled = await apiHarness(false);
    try {
      const response = await disabled.app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls/challenge',
        payload: {
          wallet_address: account.address,
          selected_outcome: 'agents_to_rwas'
        }
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'calls_disabled' });
    } finally {
      await disabled.app.close();
    }

    const enabled = await apiHarness(true);
    try {
      await openPilot(enabled.app);
      const challengeResponse = await enabled.app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls/challenge',
        payload: { wallet_address: account.address, selected_outcome: 'memes_to_rwas' }
      });
      const challenge = RhPulseCallChallengeResponseSchema.parse(challengeResponse.json()).data;
      const signature = await account.signMessage({ message: challenge.message });
      const payload = { challenge_id: challenge.challenge_id, signature };
      expect((await enabled.app.inject({ method: 'POST', url: '/v1/rh-pulse/calls', payload })).statusCode).toBe(200);
      const replay = await enabled.app.inject({ method: 'POST', url: '/v1/rh-pulse/calls', payload });
      expect(replay.statusCode).toBe(409);
      expect(replay.json().error).toBe('challenge_used');
      const duplicate = await enabled.app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls/challenge',
        payload: { wallet_address: account.address, selected_outcome: 'agents_to_rwas' }
      });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json().error).toBe('duplicate_call');
    } finally {
      await enabled.app.close();
    }
  });
});

function restore(name: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
