import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { RhPulseParticipationService } from '../src/services/rhPulseParticipationService';
import { InMemoryRhPulseParticipationStore } from '../src/services/rhPulseParticipationStore';
import { RhPulseResolutionService } from '../src/services/rhPulseResolutionService';
import { InMemoryRhPulseResolutionStore } from '../src/services/rhPulseResolutionStore';
import { RhPulseService } from '../src/services/rhPulseService';
import {
  RhPulsePublicCallResponseSchema,
  RhPulseCallChallengeResponseSchema,
  RhPulseCallSubmissionResponseSchema
} from '../src/shared/rhPulseCalls';
import {
  RhPulseResolutionResponseSchema,
  RhPulseRotationReceiptResponseSchema
} from '../src/shared/rhPulseResolution';
import { RESOLUTION_WINDOW, resolutionManifest } from './fixtures/rhPulseResolution';

const TOKEN = 'rh-pulse-resolution-api-token';
const account = privateKeyToAccount('0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8416088b20b6de5a8d');
const priorEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  RH_PULSE_CALLS_ENABLED: process.env.RH_PULSE_CALLS_ENABLED,
  RH_PULSE_INTERNAL_TOKEN: process.env.RH_PULSE_INTERNAL_TOKEN
};

afterEach(() => {
  restore('NODE_ENV', priorEnv.NODE_ENV);
  restore('DATABASE_URL', priorEnv.DATABASE_URL);
  restore('RH_PULSE_CALLS_ENABLED', priorEnv.RH_PULSE_CALLS_ENABLED);
  restore('RH_PULSE_INTERNAL_TOKEN', priorEnv.RH_PULSE_INTERNAL_TOKEN);
});

describe('RH Pulse resolution APIs', () => {
  it('keeps drafts private, requires independent approval and updates public call correctness only after publication', async () => {
    const harness = await apiHarness();
    try {
      expect((await harness.app.inject({
        method: 'GET',
        url: `/internal/rh-pulse/windows/${RESOLUTION_WINDOW.id}/resolution-readiness`
      })).statusCode).toBe(401);

      const windowId = await createAndOpenWindow(harness);
      const challengeResponse = await harness.app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls/challenge',
        payload: {
          wallet_address: account.address,
          selected_outcome: 'memes_to_agents'
        }
      });
      const challenge = RhPulseCallChallengeResponseSchema.parse(challengeResponse.json());
      const signature = await account.signMessage({ message: challenge.data.message });
      const submissionResponse = await harness.app.inject({
        method: 'POST',
        url: '/v1/rh-pulse/calls',
        payload: { challenge_id: challenge.data.challenge_id, signature }
      });
      const submission = RhPulseCallSubmissionResponseSchema.parse(submissionResponse.json());
      const callId = submission.data.call.call_id;

      harness.setNow('2026-07-24T12:00:01.000Z');
      expect((await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/windows/${windowId}/close`,
        headers: internalHeaders(),
        payload: { audit_note: 'Close after the call deadline.' }
      })).statusCode).toBe(200);

      const manifest = resolutionManifest({ strong: 'memes_to_agents' });
      const preview = await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/windows/${windowId}/resolution-preview`,
        headers: internalHeaders(),
        payload: { manifest, audit_note: 'Preview exact reviewed fixtures.' }
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.json().data.preview).toMatchObject({
        persisted: false,
        calculation: { proposed_outcome: 'memes_to_agents' }
      });
      expect((await harness.app.inject({
        method: 'GET',
        url: `/v1/rh-pulse/resolutions/${windowId}`
      })).statusCode).toBe(404);

      const draftResponse = await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/windows/${windowId}/resolution-drafts`,
        headers: internalHeaders(),
        payload: { manifest, audit_note: 'Persist exact reviewed fixtures.' }
      });
      expect(draftResponse.statusCode).toBe(200);
      const runId = draftResponse.json().data.run.id as string;
      expect((await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/resolution-runs/${runId}/publish`,
        headers: internalHeaders(),
        payload: { audit_note: 'Must require approval.' }
      })).statusCode).toBe(409);
      expect((await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/resolution-runs/${runId}/approve`,
        headers: internalHeaders(),
        payload: { audit_note: 'Missing reviewer.' }
      })).statusCode).toBe(400);

      const approve = await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/resolution-runs/${runId}/approve`,
        headers: { ...internalHeaders(), 'x-rh-pulse-reviewer-id': 'reviewer-api-fixture' },
        payload: { audit_note: 'Reviewed methodology and manifest.' }
      });
      expect(approve.statusCode).toBe(200);
      const publish = await harness.app.inject({
        method: 'POST',
        url: `/internal/rh-pulse/resolution-runs/${runId}/publish`,
        headers: internalHeaders(),
        payload: { audit_note: 'Publish approved deterministic result.' }
      });
      expect(publish.statusCode).toBe(200);
      expect(publish.json().data).toMatchObject({
        receipt: { winning_outcome: 'memes_to_agents' },
        public_resolution: {
          outcome: 'memes_to_agents',
          community: {
            total_verified_calls: 1,
            correct_calls: 1,
            correct_percentage: 100
          }
        }
      });

      const publicResolutionResponse = await harness.app.inject({
        method: 'GET',
        url: `/v1/rh-pulse/resolutions/${windowId}`
      });
      expect(publicResolutionResponse.headers['cache-control']).toContain('public');
      const publicResolution = RhPulseResolutionResponseSchema.parse(publicResolutionResponse.json());
      expect(publicResolution.data.supporting_evidence[0]?.url).toContain('radar.infopunks.fun');
      const publicReceipt = RhPulseRotationReceiptResponseSchema.parse((await harness.app.inject({
        method: 'GET',
        url: `/v1/rh-pulse/rotation-receipts/${publicResolution.data.receipt_id}`
      })).json());
      expect(publicReceipt.data).toMatchObject({ immutable: true });

      const publicCall = RhPulsePublicCallResponseSchema.parse((await harness.app.inject({
        method: 'GET',
        url: `/v1/rh-pulse/calls/${callId}`
      })).json());
      expect(publicCall.data.call).toMatchObject({
        resolution_status: 'correct',
        resolution: {
          winning_outcome: 'memes_to_agents',
          confidence: 'high'
        }
      });
      expect(JSON.stringify(publicCall)).not.toContain(account.address);
    } finally {
      await harness.app.close();
    }
  });
});

async function apiHarness() {
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  process.env.RH_PULSE_CALLS_ENABLED = 'true';
  process.env.RH_PULSE_INTERNAL_TOKEN = TOKEN;
  let now = new Date(RESOLUTION_WINDOW.opens_at);
  let id = 0;
  const participationStore = new InMemoryRhPulseParticipationStore({ initialWindowSequence: 11 });
  const resolutionStore = new InMemoryRhPulseResolutionStore(participationStore, {
    now: () => now
  });
  const resolution = new RhPulseResolutionService({
    store: resolutionStore,
    now: () => now,
    id: () => `api_fixture_${String(++id).padStart(8, '0')}`
  });
  let participation!: RhPulseParticipationService;
  const evidence = new RhPulseService({
    crossLayer: async () => ({
      entries: [],
      captured_at: now.toISOString(),
      freshness: 'partial',
      confidence: 'low',
      warnings: ['Fixture uses no inferred live connection.']
    }),
    callsEnabled: true,
    now: () => now,
    currentWindow: () => participation.getCurrentWindow()
  });
  participation = new RhPulseParticipationService({
    store: participationStore,
    callsEnabled: true,
    now: () => now,
    id: () => id++ === 0 ? 'resolution_fixture' : `api_fixture_${String(id).padStart(8, '0')}`,
    nonce: () => 'resolution_api_fixture_nonce',
    readModel: () => evidence.getReadModel(),
    resolutionForCall: (call) => resolution.resolutionStateForCall(call),
    challengeRateLimit: { walletMax: 20, originMax: 20 }
  });
  const app = await createApp(emptyIntelligenceStore(), undefined, {
    rhPulseService: evidence,
    rhPulseParticipationStore: participationStore,
    rhPulseParticipationService: participation,
    rhPulseResolutionStore: resolutionStore,
    rhPulseResolutionService: resolution
  });
  return {
    app,
    setNow(value: string) { now = new Date(value); }
  };
}

async function createAndOpenWindow(harness: Awaited<ReturnType<typeof apiHarness>>) {
  const created = await harness.app.inject({
    method: 'POST',
    url: '/internal/rh-pulse/windows',
    headers: internalHeaders(),
    payload: {
      opens_at: RESOLUTION_WINDOW.opens_at,
      closes_at: RESOLUTION_WINDOW.closes_at,
      call_submission_closes_at: RESOLUTION_WINDOW.call_submission_closes_at,
      methodology_version: 'rh-pulse-v1.0',
      source_health: {
        state: 'live',
        observed_at: RESOLUTION_WINDOW.opens_at,
        detail: 'Deterministic API fixture source health.'
      },
      audit_note: 'Create deterministic resolution window.'
    }
  });
  expect(created.statusCode).toBe(200);
  const windowId = created.json().data.window.id as string;
  expect(windowId).toBe(RESOLUTION_WINDOW.id);
  expect((await harness.app.inject({
    method: 'POST',
    url: `/internal/rh-pulse/windows/${windowId}/open`,
    headers: internalHeaders(),
    payload: { audit_note: 'Open deterministic resolution window.' }
  })).statusCode).toBe(200);
  return windowId;
}

function internalHeaders() {
  return { authorization: `Bearer ${TOKEN}` };
}

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
