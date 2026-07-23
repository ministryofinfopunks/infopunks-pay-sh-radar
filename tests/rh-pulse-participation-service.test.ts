import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { RhPulseService } from '../src/services/rhPulseService';
import {
  buildRhPulseCallMessage,
  canonicalJson,
  communityDistribution,
  receiptHash,
  RhPulseParticipationError,
  RhPulseParticipationService
} from '../src/services/rhPulseParticipationService';
import {
  InMemoryRhPulseParticipationStore,
  type RhPulseParticipationStore
} from '../src/services/rhPulseParticipationStore';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RhPulseCallReceiptRecordSchema
} from '../src/shared/rhPulseCalls';

const FIRST_PRIVATE_KEY = '0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8416088b20b6de5a8d';
const SECOND_PRIVATE_KEY = '0x8b3a350cf5c34c9194ca3a545d42f60962d609833088fdf8f7b87a94a899af6a';
const firstAccount = privateKeyToAccount(FIRST_PRIVATE_KEY);
const secondAccount = privateKeyToAccount(SECOND_PRIVATE_KEY);
const START = new Date('2026-07-23T12:00:00.000Z');

function harness(options: {
  store?: RhPulseParticipationStore;
  enabled?: boolean;
  start?: Date;
} = {}) {
  let now = new Date(options.start ?? START);
  let id = 0;
  const store = options.store ?? new InMemoryRhPulseParticipationStore();
  const evidence = new RhPulseService({
    crossLayer: async () => ({
      entries: [],
      captured_at: '2026-07-23T11:55:00.000Z',
      freshness: 'partial',
      confidence: 'low',
      warnings: ['No qualifying reviewed overlap.']
    }),
    now: () => now,
    cacheTtlMs: 0
  });
  const service = new RhPulseParticipationService({
    store,
    callsEnabled: options.enabled ?? true,
    now: () => now,
    id: () => `id_${String(++id).padStart(6, '0')}`,
    nonce: () => `nonce_${String(id).padStart(6, '0')}`,
    readModel: () => evidence.getReadModel(),
    challengeRateLimit: { walletMax: 50, originMax: 100, maxEntries: 100 }
  });
  return {
    service,
    store,
    now: () => now,
    advance(ms: number) { now = new Date(now.getTime() + ms); },
    async createWindow(hours = 24) {
      return service.createWindow({
        opens_at: now.toISOString(),
        closes_at: new Date(now.getTime() + hours * 3_600_000).toISOString(),
        call_submission_closes_at: new Date(now.getTime() + hours * 3_600_000).toISOString(),
        methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION,
        source_health: {
          state: 'delayed',
          observed_at: now.toISOString(),
          detail: 'Test evidence is intentionally partial.'
        },
        audit_note: 'Open deterministic test window.'
      });
    },
    async openWindow() {
      const window = await this.createWindow();
      return service.openWindow(window.id, { audit_note: 'Open deterministic test window.' });
    }
  };
}

async function signedSubmission(
  service: RhPulseParticipationService,
  account = firstAccount,
  outcome: 'agents_to_rwas' | 'memes_to_agents' | 'memes_to_rwas' | 'no_qualified_rotation' = 'agents_to_rwas',
  origin = 'test-origin'
) {
  const challenge = await service.createChallenge({
    wallet_address: account.address,
    selected_outcome: outcome
  }, origin);
  const signature = await account.signMessage({ message: challenge.message });
  return {
    challenge,
    signature,
    submit: () => service.submitCall({
      challenge_id: challenge.challenge_id,
      signature
    }, origin)
  };
}

describe('RH Pulse signature authority', () => {
  it('serializes the exact human-readable EIP-191 message deterministically', async () => {
    const h = harness();
    const window = await h.openWindow();
    const challenge = await h.service.createChallenge({
      wallet_address: firstAccount.address,
      selected_outcome: 'agents_to_rwas'
    }, 'origin-a');

    expect(challenge.message).toBe([
      'RH Pulse: Call the Rotation',
      '',
      'Domain: pulse.infopunks.fun',
      'URI: https://pulse.infopunks.fun/',
      'Chain ID: 4663',
      `Wallet: ${firstAccount.address}`,
      'Call: Agents → RWAs',
      'Call ID: agents_to_rwas',
      `Window ID: ${window.id}`,
      'Window Opens: 2026-07-23T12:00:00.000Z',
      'Window Closes: 2026-07-24T12:00:00.000Z',
      'Methodology: rh-pulse-v1.0',
      'Nonce: nonce_000003',
      'Issued At: 2026-07-23T12:00:00.000Z',
      'Expires At: 2026-07-23T12:05:00.000Z',
      '',
      'This signature records a public prediction.',
      'It cannot move funds or approve transactions.'
    ].join('\n'));
  });

  it('accepts a valid EOA signature and rejects replay without consuming another number', async () => {
    const h = harness();
    await h.openWindow();
    const signed = await signedSubmission(h.service);
    const accepted = await signed.submit();
    expect(accepted.call).toMatchObject({
      public_call_number: 1,
      selected_outcome: 'agents_to_rwas',
      verification_status: 'verified',
      genesis: { is_genesis: true, rank: 1, limit: 4663 }
    });
    expect(accepted.receipt.receipt_hash).toBe(receiptHash(accepted.receipt.receipt_payload));
    await expect(signed.submit()).rejects.toMatchObject({ code: 'challenge_used' });
    expect((await h.store.listVerifiedCalls(accepted.call.window.id))).toHaveLength(1);
  });

  it('rejects the wrong wallet signature, modified challenge fields and invalid formats', async () => {
    const h = harness();
    await h.openWindow();
    const challenge = await h.service.createChallenge({
      wallet_address: firstAccount.address,
      selected_outcome: 'memes_to_agents'
    }, 'origin-a');
    const wrongSignature = await secondAccount.signMessage({ message: challenge.message });
    await expect(h.service.submitCall({
      challenge_id: challenge.challenge_id,
      signature: wrongSignature
    }, 'origin-a')).rejects.toMatchObject({ code: 'signature_invalid' });

    const invalidFormat = {
      challenge_id: challenge.challenge_id,
      signature: '0x1234'
    };
    await expect(h.service.submitCall(invalidFormat, 'origin-a')).rejects.toMatchObject({
      code: 'signature_invalid'
    });

    for (const field of ['domain', 'uri', 'methodology_version', 'signed_message', 'selected_outcome'] as const) {
      const fresh = await signedSubmission(h.service, secondAccount, 'memes_to_rwas', `origin-${field}`);
      const tamperingStore = new Proxy(h.store, {
        get(target, property, receiver) {
          if (property !== 'getChallenge') return Reflect.get(target, property, receiver);
          return async (id: string) => {
            const stored = await target.getChallenge(id);
            if (!stored) return null;
            if (field === 'domain') return { ...stored, domain: 'attacker.example' };
            if (field === 'uri') return { ...stored, uri: 'https://attacker.example/' };
            if (field === 'methodology_version') return { ...stored, methodology_version: 'rh-pulse-v0.9' };
            if (field === 'signed_message') return { ...stored, signed_message: `${stored.signed_message}\nModified` };
            return { ...stored, selected_outcome: 'agents_to_rwas' };
          };
        }
      }) as RhPulseParticipationStore;
      const tamperingService = new RhPulseParticipationService({
        store: tamperingStore,
        callsEnabled: true,
        now: h.now,
        readModel: () => new RhPulseService({ crossLayer: async () => ({ entries: [] }) }).getReadModel()
      });
      await expect(tamperingService.submitCall({
        challenge_id: fresh.challenge.challenge_id,
        signature: fresh.signature
      }, `origin-${field}`)).rejects.toMatchObject({ code: 'challenge_tampered' });
    }
  });

  it('rejects expired, closed-window, duplicate and disabled calls explicitly', async () => {
    const h = harness();
    const window = await h.openWindow();
    const expired = await signedSubmission(h.service);
    h.advance(5 * 60_000);
    await expect(expired.submit()).rejects.toMatchObject({ code: 'challenge_expired' });

    const second = await signedSubmission(h.service, secondAccount);
    await h.service.closeWindow(window.id, { audit_note: 'Close test window.' });
    await expect(second.submit()).rejects.toMatchObject({ code: 'window_not_open' });

    const duplicateHarness = harness();
    await duplicateHarness.openWindow();
    await (await signedSubmission(duplicateHarness.service)).submit();
    await expect(signedSubmission(duplicateHarness.service)).rejects.toMatchObject({ code: 'duplicate_call' });

    const disabled = harness({ enabled: false });
    await expect(disabled.service.createChallenge({
      wallet_address: firstAccount.address,
      selected_outcome: 'agents_to_rwas'
    }, 'origin')).rejects.toMatchObject({ code: 'calls_disabled' });
  });

  it('throttles challenge creation by wallet and stores only hashed abuse provenance', async () => {
    let id = 0;
    const store = new InMemoryRhPulseParticipationStore();
    const evidence = new RhPulseService({ crossLayer: async () => ({ entries: [] }), now: () => START });
    const service = new RhPulseParticipationService({
      store,
      callsEnabled: true,
      now: () => START,
      id: () => `limit_${String(++id).padStart(8, '0')}`,
      readModel: () => evidence.getReadModel(),
      challengeRateLimit: { walletMax: 1, originMax: 10, windowMs: 300_000, maxEntries: 10 }
    });
    const window = await service.createWindow({
      opens_at: START.toISOString(),
      closes_at: new Date(START.getTime() + 86_400_000).toISOString(),
      call_submission_closes_at: new Date(START.getTime() + 86_400_000).toISOString(),
      methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION as 'rh-pulse-v1.0',
      source_health: { state: 'delayed', observed_at: START.toISOString(), detail: 'Test evidence.' },
      audit_note: 'Create throttling window.'
    });
    await service.openWindow(window.id, { audit_note: 'Open throttling window.' });
    await service.createChallenge({
      wallet_address: firstAccount.address,
      selected_outcome: 'agents_to_rwas'
    }, '203.0.113.42');
    await expect(service.createChallenge({
      wallet_address: firstAccount.address,
      selected_outcome: 'memes_to_agents'
    }, '203.0.113.42')).rejects.toMatchObject({ code: 'rate_limited' });
    const audit = await store.listAuditEvents();
    expect(audit.some((event) => event.event_type === 'abuse_check_triggered')).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('203.0.113.42');
    expect(JSON.stringify(audit)).not.toContain(firstAccount.address);
  });
});

describe('RH Pulse window and atomic persistence authority', () => {
  it('permits only one open window and supports idempotent close and cancellation', async () => {
    const h = harness();
    const first = await h.openWindow();
    const second = await h.createWindow();
    await expect(h.service.openWindow(second.id, { audit_note: 'Conflicting open.' }))
      .rejects.toMatchObject({ code: 'open_window_exists' });
    const closed = await h.service.closeWindow(first.id, { audit_note: 'Close once.' });
    expect(closed.status).toBe('closed');
    expect((await h.service.closeWindow(first.id, { audit_note: 'Close twice.' })).status).toBe('closed');
    const cancelled = await h.service.cancelWindow(second.id, {
      audit_note: 'Cancel pending pilot.',
      cancellation_reason: 'Test window no longer needed.'
    });
    expect(cancelled).toMatchObject({ status: 'cancelled', cancellation_reason: 'Test window no longer needed.' });
  });

  it('allocates unique public numbers under concurrency and allows the same wallet in a later window', async () => {
    const h = harness();
    const firstWindow = await h.openWindow();
    const first = await signedSubmission(h.service, firstAccount, 'agents_to_rwas', 'origin-1');
    const second = await signedSubmission(h.service, secondAccount, 'memes_to_rwas', 'origin-2');
    const accepted = await Promise.all([first.submit(), second.submit()]);
    expect(accepted.map((value) => value.call.public_call_number).sort((a, b) => a - b)).toEqual([1, 2]);

    await h.service.closeWindow(firstWindow.id, { audit_note: 'Close first window.' });
    const secondWindow = await h.openWindow();
    const later = await (await signedSubmission(h.service, firstAccount, 'no_qualified_rotation', 'origin-3')).submit();
    expect(later.call.window.id).toBe(secondWindow.id);
    expect(later.call.public_call_number).toBe(3);
  });

  it('keeps duplicate concurrent submissions to one committed call', async () => {
    const h = harness();
    await h.openWindow();
    const signed = await signedSubmission(h.service);
    const results = await Promise.allSettled([signed.submit(), signed.submit()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await h.store.listVerifiedCalls(signed.challenge.window.id)).toHaveLength(1);
  });

  it('assigns Genesis ranks at 4663 and not 4664', async () => {
    const store = new InMemoryRhPulseParticipationStore({ initialPublicCallNumber: 4_662 });
    const h = harness({ store });
    await h.openWindow();
    const genesis = await (await signedSubmission(h.service, firstAccount, 'agents_to_rwas', 'origin-1')).submit();
    const postGenesis = await (await signedSubmission(h.service, secondAccount, 'memes_to_agents', 'origin-2')).submit();
    expect(genesis.call).toMatchObject({ public_call_number: 4663, genesis: { is_genesis: true, rank: 4663 } });
    expect(postGenesis.call).toMatchObject({ public_call_number: 4664, genesis: { is_genesis: false, rank: null } });
  });

  it('does not consume a public number or challenge when the transaction rolls back', async () => {
    let shouldFail = true;
    const store = new InMemoryRhPulseParticipationStore({
      beforeCommit: () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('simulated_commit_failure');
        }
      }
    });
    const h = harness({ store });
    await h.openWindow();
    const signed = await signedSubmission(h.service);
    await expect(signed.submit()).rejects.toThrow('simulated_commit_failure');
    const accepted = await signed.submit();
    expect(accepted.call.public_call_number).toBe(1);
    expect(accepted.call.genesis.rank).toBe(1);
  });

  it('keeps receipt hashes reproducible and returned records isolated from mutation', async () => {
    const h = harness();
    await h.openWindow();
    const accepted = await (await signedSubmission(h.service)).submit();
    const expectedCanonical = canonicalJson(accepted.receipt.receipt_payload);
    expect(expectedCanonical).toBe(canonicalJson(JSON.parse(JSON.stringify(accepted.receipt.receipt_payload))));
    expect(accepted.receipt.receipt_hash).toBe(receiptHash(accepted.receipt.receipt_payload));

    accepted.receipt.receipt_payload.selected_outcome_label = 'MUTATED';
    const stored = await h.store.getReceiptForCall(accepted.call.call_id);
    expect(stored?.receipt_payload.selected_outcome_label).toBe('Agents → RWAs');
    expect(() => RhPulseCallReceiptRecordSchema.parse({
      ...stored,
      id: 'rhp_receipt_superseding',
      public_slug: 'receipt-000001-superseding',
      supersedes_receipt_id: stored?.id
    })).not.toThrow();
  });
});

describe('RH Pulse community conviction', () => {
  it('uses verified calls only and largest-remainder rounding that totals 100', () => {
    const records = ['agents_to_rwas', 'memes_to_agents', 'memes_to_rwas'] as const;
    const calls = records.map((selected_outcome, index) => ({
      id: `rhp_call_test_000${index}`,
      public_call_number: index + 1,
      window_id: 'rhp_window_test_0001',
      wallet_address: `0x${String(index + 1).padStart(40, '0')}`,
      selected_outcome,
      signature: `0x${'11'.repeat(65)}`,
      signed_message_hash: 'a'.repeat(64),
      recorded_at: START.toISOString(),
      verification_status: 'verified' as const,
      abuse_status: 'clear' as const,
      genesis_rank: index + 1,
      public_slug: `call-00000${index + 1}-abcdef0${index}`,
      methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION as 'rh-pulse-v1.0',
      created_at: START.toISOString()
    }));
    const distribution = communityDistribution(calls, START.toISOString());
    expect(distribution.total_verified_calls).toBe(3);
    expect(distribution.outcomes.map((row) => row.percentage)).toEqual([33.34, 33.33, 33.33, 0]);
    expect(distribution.outcomes.reduce((sum, row) => sum + row.percentage, 0)).toBe(100);
    expect(communityDistribution([], START.toISOString()).outcomes.every((row) => row.percentage === 0)).toBe(true);
  });
});

describe('RH Pulse message builder authority', () => {
  it('does not derive domain or URI from request input', () => {
    const message = buildRhPulseCallMessage({
      domain: 'pulse.infopunks.fun',
      uri: 'https://pulse.infopunks.fun/',
      wallet: firstAccount.address,
      selectedOutcome: 'no_qualified_rotation',
      window: {
        id: 'rhp_window_test_0001',
        opens_at: START.toISOString(),
        closes_at: new Date(START.getTime() + 86_400_000).toISOString(),
        methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION
      },
      nonce: 'nonce',
      issuedAt: START.toISOString(),
      expiresAt: new Date(START.getTime() + 300_000).toISOString()
    });
    expect(message).toContain('Domain: pulse.infopunks.fun');
    expect(message).toContain('URI: https://pulse.infopunks.fun/');
    expect(message).toContain('Call ID: no_qualified_rotation');
    expect(message).not.toContain('agent_tokens_keep_cooking');
  });
});
