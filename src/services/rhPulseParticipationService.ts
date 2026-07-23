import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAddress, verifyMessage, type Hex } from 'viem';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  RhPulseCallOptionIdSchema,
  type RhPulsePredictionWindow,
  type RhPulseReadModel
} from '../shared/rhPulse';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RH_PULSE_CHAIN_ID,
  RH_PULSE_GENESIS_LIMIT,
  RH_PULSE_RECEIPT_VERSION,
  RH_PULSE_SIGNATURE_SCHEME,
  RH_PULSE_TRUST_COPY,
  RhPulseAuditEventSchema,
  RhPulseCallChallengePayloadSchema,
  RhPulseCallChallengeRecordSchema,
  RhPulseCallChallengeRequestSchema,
  RhPulseCallReceiptPayloadSchema,
  RhPulseCallReceiptRecordSchema,
  RhPulseCallRecordSchema,
  RhPulseCallSubmissionPayloadSchema,
  RhPulseCallSubmissionRequestSchema,
  RhPulseCommunityDistributionSchema,
  RhPulseInternalCreateWindowSchema,
  RhPulseInternalWindowActionSchema,
  RhPulseInternalWindowCancelSchema,
  RhPulsePublicCallPayloadSchema,
  RhPulsePublicCallSchema,
  RhPulsePublicReceiptPayloadSchema,
  RhPulseWindowRecordSchema,
  type RhPulseAuditEvent,
  type RhPulseCallChallengeRecord,
  type RhPulseCallOutcome,
  type RhPulseCallReceiptPayload,
  type RhPulseCallReceiptRecord,
  type RhPulseCallRecord,
  type RhPulseCommunityDistribution,
  type RhPulsePublicCall,
  type RhPulseWindowRecord
} from '../shared/rhPulseCalls';
import { DEFAULT_PULSE_PUBLIC_HOST, normalizePublicHostname } from '../shared/rhPulseRouting';
import type {
  RhPulseAcceptedArtifacts,
  RhPulseParticipationStore
} from './rhPulseParticipationStore';

const OUTCOME_LABELS: Record<RhPulseCallOutcome, string> = {
  agents_to_rwas: 'Agents → RWAs',
  memes_to_agents: 'Memes → Agents',
  memes_to_rwas: 'Memes → RWAs',
  no_qualified_rotation: 'No Qualified Rotation'
};

export type RhPulseParticipationServiceOptions = {
  store: RhPulseParticipationStore;
  callsEnabled: boolean;
  publicHost?: string;
  challengeTtlSeconds?: number;
  readModel: () => Promise<RhPulseReadModel>;
  now?: () => Date;
  id?: () => string;
  nonce?: () => string;
  verify?: typeof verifyMessage;
  challengeRateLimit?: {
    walletMax?: number;
    originMax?: number;
    windowMs?: number;
    maxEntries?: number;
  };
};

export class RhPulseParticipationError extends Error {
  constructor(
    readonly code:
      | 'calls_disabled'
      | 'no_active_window'
      | 'window_not_found'
      | 'window_not_open'
      | 'window_not_started'
      | 'window_closed'
      | 'window_cancelled'
      | 'open_window_exists'
      | 'window_conflict'
      | 'challenge_not_found'
      | 'challenge_expired'
      | 'challenge_used'
      | 'challenge_tampered'
      | 'signature_invalid'
      | 'contract_wallet_signature_unsupported'
      | 'duplicate_call'
      | 'call_not_found'
      | 'receipt_not_found'
      | 'rate_limited'
      | 'invalid_transition',
    readonly publicMessage = 'RH Pulse could not record this call.',
    readonly retryAfterSeconds?: number
  ) {
    super(code);
  }
}

export class RhPulseParticipationService {
  readonly store: RhPulseParticipationStore;
  readonly callsEnabled: boolean;
  readonly publicHost: string;
  readonly canonicalUri: string;
  private readonly challengeTtlMs: number;
  private readonly readModel: () => Promise<RhPulseReadModel>;
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly nonce: () => string;
  private readonly verify: typeof verifyMessage;
  private readonly walletLimiter: BoundedFixedWindowLimiter;
  private readonly originLimiter: BoundedFixedWindowLimiter;

  constructor(options: RhPulseParticipationServiceOptions) {
    this.store = options.store;
    this.callsEnabled = options.callsEnabled;
    this.publicHost = normalizePublicHostname(options.publicHost) ?? DEFAULT_PULSE_PUBLIC_HOST;
    this.canonicalUri = `https://${this.publicHost}/`;
    this.challengeTtlMs = Math.max(60, Math.min(options.challengeTtlSeconds ?? 300, 900)) * 1_000;
    this.readModel = options.readModel;
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
    this.nonce = options.nonce ?? (() => randomBytes(32).toString('base64url'));
    this.verify = options.verify ?? verifyMessage;
    const limit = options.challengeRateLimit ?? {};
    this.walletLimiter = new BoundedFixedWindowLimiter(
      limit.walletMax ?? 3,
      limit.windowMs ?? 5 * 60_000,
      limit.maxEntries ?? 2_000,
      () => this.now().getTime()
    );
    this.originLimiter = new BoundedFixedWindowLimiter(
      limit.originMax ?? 12,
      limit.windowMs ?? 5 * 60_000,
      limit.maxEntries ?? 2_000,
      () => this.now().getTime()
    );
  }

  async getCurrentWindow(): Promise<RhPulsePredictionWindow> {
    const window = await this.store.getCurrentWindow();
    return window ? publicWindow(window, this.callsEnabled, this.now()) : previewWindow(this.callsEnabled);
  }

  async createChallenge(input: unknown, requestOrigin: string) {
    this.requireCallsEnabled();
    const parsed = RhPulseCallChallengeRequestSchema.parse(input);
    let wallet: `0x${string}`;
    try {
      wallet = getAddress(parsed.wallet_address);
    } catch {
      throw new RhPulseParticipationError('challenge_tampered', 'Use a valid Ethereum wallet address.');
    }

    const originHash = sha256(requestOrigin || 'unknown');
    const walletHash = sha256(wallet.toLowerCase());
    const walletLimit = this.walletLimiter.consume(walletHash);
    const originLimit = this.originLimiter.consume(originHash);
    if (!walletLimit.allowed || !originLimit.allowed) {
      const retryAfterSeconds = Math.max(walletLimit.retryAfterSeconds, originLimit.retryAfterSeconds);
      await this.audit('abuse_check_triggered', {
        walletHash,
        requestOriginHash: originHash,
        payload: { scope: !walletLimit.allowed ? 'wallet' : 'request_origin', retry_after_seconds: retryAfterSeconds }
      });
      throw new RhPulseParticipationError(
        'rate_limited',
        'Too many signing requests. Wait briefly and try again.',
        retryAfterSeconds
      );
    }

    const now = this.now();
    const window = await this.store.getCurrentWindow();
    try {
      this.assertWindowAccepting(window, now);
    } catch (error) {
      await this.audit('challenge_rejected', {
        windowId: window?.id ?? null,
        walletHash,
        requestOriginHash: originHash,
        payload: {
          reason: error instanceof RhPulseParticipationError ? error.code : 'window_authority_rejected'
        }
      });
      throw error;
    }
    const duplicate = (await this.store.listVerifiedCalls(window!.id))
      .find((call) => call.wallet_address === wallet);
    if (duplicate) {
      await this.audit('duplicate_call_rejected', {
        windowId: window!.id,
        callId: duplicate.id,
        walletHash,
        requestOriginHash: originHash,
        payload: { stage: 'challenge' }
      });
      throw new RhPulseParticipationError('duplicate_call', 'This wallet already has a verified call in the current window.');
    }

    const issuedAt = now.toISOString();
    const expiresAt = new Date(Math.min(
      now.getTime() + this.challengeTtlMs,
      Date.parse(window!.call_submission_closes_at)
    )).toISOString();
    const nonce = this.nonce();
    const challengeId = `rhp_challenge_${this.id()}`;
    const signedMessage = buildRhPulseCallMessage({
      domain: this.publicHost,
      uri: this.canonicalUri,
      wallet,
      selectedOutcome: parsed.selected_outcome,
      window: window!,
      nonce,
      issuedAt,
      expiresAt
    });
    const challenge = RhPulseCallChallengeRecordSchema.parse({
      id: challengeId,
      window_id: window!.id,
      wallet_address: wallet,
      selected_outcome: parsed.selected_outcome,
      nonce_hash: sha256(nonce),
      signed_message: signedMessage,
      domain: this.publicHost,
      uri: this.canonicalUri,
      chain_id: RH_PULSE_CHAIN_ID,
      methodology_version: window!.methodology_version,
      issued_at: issuedAt,
      expires_at: expiresAt,
      used_at: null,
      created_at: issuedAt
    });
    await this.store.createChallenge(challenge, this.auditEvent('challenge_created', {
      windowId: window!.id,
      challengeId,
      walletHash,
      requestOriginHash: originHash,
      payload: { selected_outcome: parsed.selected_outcome, expires_at: expiresAt }
    }, issuedAt));
    return RhPulseCallChallengePayloadSchema.parse({
      challenge_id: challenge.id,
      message: challenge.signed_message,
      window: publicWindowSummary(window!, this.callsEnabled, now),
      expires_at: challenge.expires_at,
      signature_scheme: RH_PULSE_SIGNATURE_SCHEME,
      trust_copy: RH_PULSE_TRUST_COPY
    });
  }

  async submitCall(input: unknown, requestOrigin: string) {
    this.requireCallsEnabled();
    const parsed = RhPulseCallSubmissionRequestSchema.parse(input);
    const challenge = await this.store.getChallenge(parsed.challenge_id);
    const originHash = sha256(requestOrigin || 'unknown');
    if (!challenge) {
      await this.audit('signature_rejected', {
        challengeId: null,
        requestOriginHash: originHash,
        payload: { reason: 'challenge_not_found', challenge_reference_hash: sha256(parsed.challenge_id) }
      });
      throw new RhPulseParticipationError('challenge_not_found', 'The signing request is no longer available.');
    }
    const walletHash = sha256(challenge.wallet_address.toLowerCase());
    const now = this.now();
    if (challenge.used_at) {
      await this.rejectChallenge(challenge, originHash, 'challenge_used');
      throw new RhPulseParticipationError('challenge_used', 'This signing request has already been used.');
    }
    if (Date.parse(challenge.expires_at) <= now.getTime()) {
      await this.rejectChallenge(challenge, originHash, 'challenge_expired');
      throw new RhPulseParticipationError('challenge_expired', 'The signing request expired. Create a new one.');
    }
    const window = await this.store.getWindow(challenge.window_id);
    this.assertWindowAccepting(window, now);
    if (!window || !this.challengeMatchesAuthority(challenge, window)) {
      await this.rejectChallenge(challenge, originHash, 'challenge_tampered');
      throw new RhPulseParticipationError('challenge_tampered', 'The signing request did not match RH Pulse authority.');
    }

    const nonce = nonceFromMessage(challenge.signed_message);
    if (!nonce || sha256(nonce) !== challenge.nonce_hash) {
      await this.rejectChallenge(challenge, originHash, 'challenge_tampered');
      throw new RhPulseParticipationError('challenge_tampered', 'The signing request did not match its stored receipt.');
    }
    const expectedMessage = buildRhPulseCallMessage({
      domain: this.publicHost,
      uri: this.canonicalUri,
      wallet: challenge.wallet_address as `0x${string}`,
      selectedOutcome: challenge.selected_outcome,
      window,
      nonce,
      issuedAt: challenge.issued_at,
      expiresAt: challenge.expires_at
    });
    if (challenge.signed_message !== expectedMessage) {
      await this.rejectChallenge(challenge, originHash, 'challenge_tampered');
      throw new RhPulseParticipationError('challenge_tampered', 'The signing request did not match its stored receipt.');
    }
    if (parsed.signature.length !== 132) {
      await this.rejectChallenge(challenge, originHash, 'signature_invalid');
      throw new RhPulseParticipationError('signature_invalid', 'The wallet signature could not be verified.');
    }

    let verified = false;
    try {
      verified = await this.verify({
        address: challenge.wallet_address as `0x${string}`,
        message: challenge.signed_message,
        signature: parsed.signature as Hex
      });
    } catch {
      verified = false;
    }
    if (!verified) {
      await this.rejectChallenge(challenge, originHash, 'signature_invalid');
      throw new RhPulseParticipationError('signature_invalid', 'The wallet signature could not be verified.');
    }

    const model = await this.readModel();
    const snapshot = {
      strongest_current_signal: model.strongest_current_signal.connection_id,
      connection_under_watch: 'agents_to_rwas' as const,
      generated_at: model.generated_at,
      source_health: model.source_health.overall
    };
    const acceptedAt = now.toISOString();
    const result = await this.store.acceptCall({
      challengeId: challenge.id,
      acceptedAt,
      expectedChallenge: {
        window_id: challenge.window_id,
        wallet_address: challenge.wallet_address,
        selected_outcome: challenge.selected_outcome,
        signed_message: challenge.signed_message,
        domain: challenge.domain,
        uri: challenge.uri,
        chain_id: challenge.chain_id,
        methodology_version: challenge.methodology_version
      },
      buildArtifacts: (publicCallNumber, lockedChallenge, lockedWindow, lockedRecordedAt) => (
        this.buildAcceptedArtifacts(
          publicCallNumber,
          lockedChallenge,
          lockedWindow,
          parsed.signature,
          snapshot,
          originHash,
          lockedRecordedAt
        )
      )
    });
    if (!result.accepted) {
      if (result.code === 'duplicate_call') {
        await this.audit('duplicate_call_rejected', {
          windowId: challenge.window_id,
          challengeId: challenge.id,
          callId: result.existingCall?.id ?? null,
          walletHash,
          requestOriginHash: originHash,
          payload: { stage: 'atomic_acceptance' }
        });
        throw new RhPulseParticipationError('duplicate_call', 'This wallet already has a verified call in the current window.');
      }
      const code = result.code === 'window_not_open' ? 'window_not_open'
        : result.code === 'window_closed' ? 'window_closed'
          : result.code === 'challenge_mismatch' ? 'challenge_tampered'
          : result.code;
      throw new RhPulseParticipationError(code, acceptanceFailureMessage(code));
    }

    const publicCall = this.publicCall(result.call, window, result.receipt);
    const community = communityDistribution(result.calls, result.call.recorded_at);
    return RhPulseCallSubmissionPayloadSchema.parse({
      call: publicCall,
      receipt: result.receipt,
      community_distribution: community,
      distribution_observed_at: community.observed_at,
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    });
  }

  async getPublicCall(callIdOrSlug: string) {
    const call = await this.store.getCall(callIdOrSlug);
    if (!call) throw new RhPulseParticipationError('call_not_found', 'No verified RH Pulse call exists at this address.');
    const [window, receipt] = await Promise.all([
      this.store.getWindow(call.window_id),
      this.store.getReceiptForCall(call.id)
    ]);
    if (!window) throw new RhPulseParticipationError('window_not_found', 'The call window is unavailable.');
    if (!receipt) throw new RhPulseParticipationError('receipt_not_found', 'The immutable call receipt is unavailable.');
    return RhPulsePublicCallPayloadSchema.parse({
      call: this.publicCall(call, window, receipt),
      structural_snapshot: receipt.receipt_payload.structural_snapshot,
      receipt_hash: receipt.receipt_hash,
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    });
  }

  async getPublicReceipt(callIdOrSlug: string) {
    const call = await this.store.getCall(callIdOrSlug);
    if (!call) throw new RhPulseParticipationError('call_not_found', 'No verified RH Pulse call exists at this address.');
    const [window, receipt] = await Promise.all([
      this.store.getWindow(call.window_id),
      this.store.getReceiptForCall(call.id)
    ]);
    if (!window) throw new RhPulseParticipationError('window_not_found', 'The call window is unavailable.');
    if (!receipt) throw new RhPulseParticipationError('receipt_not_found', 'The immutable call receipt is unavailable.');
    return RhPulsePublicReceiptPayloadSchema.parse({
      receipt,
      call: this.publicCall(call, window, receipt),
      immutable: true,
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    });
  }

  async createWindow(input: unknown) {
    const parsed = RhPulseInternalCreateWindowSchema.parse(input);
    const now = this.now().toISOString();
    return this.store.createWindow(
      (sequenceNumber) => RhPulseWindowRecordSchema.parse({
        id: `rhp_window_${this.id()}`,
        sequence_number: sequenceNumber,
        opens_at: parsed.opens_at,
        closes_at: parsed.closes_at,
        call_submission_closes_at: parsed.call_submission_closes_at,
        status: 'not_open',
        methodology_version: parsed.methodology_version,
        source_health: parsed.source_health,
        audit_metadata: { created_by: 'internal_pilot', audit_note: parsed.audit_note },
        created_at: now,
        updated_at: now,
        closed_at: null,
        resolved_at: null,
        cancelled_at: null,
        cancellation_reason: null
      }),
      (window) => this.auditEvent('window_created', {
        windowId: window.id,
        payload: { sequence_number: window.sequence_number, audit_note: parsed.audit_note }
      }, now)
    );
  }

  async openWindow(windowId: string, input: unknown) {
    const parsed = RhPulseInternalWindowActionSchema.parse(input);
    const now = this.now();
    try {
      const result = await this.store.transitionWindow(windowId, (current) => {
        if (current.status === 'open') return {
          window: current,
          audit: this.auditEvent('window_opened', {
            windowId: current.id,
            payload: { idempotent: true, audit_note: parsed.audit_note }
          }, now.toISOString())
        };
        if (current.status !== 'not_open') {
          throw new RhPulseParticipationError('invalid_transition', 'Only a not-open window can be opened.');
        }
        if (now.getTime() < Date.parse(current.opens_at)) {
          throw new RhPulseParticipationError('window_not_started', 'This pilot window has not reached its opening time.');
        }
        if (now.getTime() >= Date.parse(current.call_submission_closes_at)) {
          throw new RhPulseParticipationError('window_closed', 'This pilot window is already past its call deadline.');
        }
        const window = RhPulseWindowRecordSchema.parse({
          ...current,
          status: 'open',
          updated_at: now.toISOString(),
          audit_metadata: { ...current.audit_metadata, last_audit_note: parsed.audit_note }
        });
        return {
          window,
          audit: this.auditEvent('window_opened', {
            windowId: current.id,
            payload: { idempotent: false, audit_note: parsed.audit_note }
          }, now.toISOString())
        };
      });
      if (!result) throw new RhPulseParticipationError('window_not_found', 'The pilot window was not found.');
      return result;
    } catch (error) {
      if (error instanceof RhPulseParticipationError) throw error;
      if (isErrorCode(error, 'open_window_exists')) {
        throw new RhPulseParticipationError('open_window_exists', 'Another RH Pulse window is already open.');
      }
      throw error;
    }
  }

  async closeWindow(windowId: string, input: unknown) {
    const parsed = RhPulseInternalWindowActionSchema.parse(input);
    const now = this.now().toISOString();
    const result = await this.store.transitionWindow(windowId, (current) => {
      if (current.status === 'closed') return {
        window: current,
        audit: this.auditEvent('window_closed', {
          windowId: current.id,
          payload: { idempotent: true, audit_note: parsed.audit_note }
        }, now)
      };
      if (current.status !== 'open') {
        throw new RhPulseParticipationError('invalid_transition', 'Only an open window can be closed.');
      }
      const window = RhPulseWindowRecordSchema.parse({
        ...current,
        status: 'closed',
        updated_at: now,
        closed_at: now,
        audit_metadata: { ...current.audit_metadata, last_audit_note: parsed.audit_note }
      });
      return {
        window,
        audit: this.auditEvent('window_closed', {
          windowId: current.id,
          payload: { idempotent: false, audit_note: parsed.audit_note }
        }, now)
      };
    });
    if (!result) throw new RhPulseParticipationError('window_not_found', 'The pilot window was not found.');
    return result;
  }

  async cancelWindow(windowId: string, input: unknown) {
    const parsed = RhPulseInternalWindowCancelSchema.parse(input);
    const now = this.now().toISOString();
    const result = await this.store.transitionWindow(windowId, (current) => {
      if (current.status === 'cancelled') return {
        window: current,
        audit: this.auditEvent('window_cancelled', {
          windowId: current.id,
          payload: { idempotent: true, audit_note: parsed.audit_note }
        }, now)
      };
      if (!['not_open', 'open'].includes(current.status)) {
        throw new RhPulseParticipationError('invalid_transition', 'Only a pending or open window can be cancelled.');
      }
      const window = RhPulseWindowRecordSchema.parse({
        ...current,
        status: 'cancelled',
        updated_at: now,
        cancelled_at: now,
        cancellation_reason: parsed.cancellation_reason,
        closed_at: current.status === 'open' ? now : current.closed_at,
        audit_metadata: { ...current.audit_metadata, last_audit_note: parsed.audit_note }
      });
      return {
        window,
        audit: this.auditEvent('window_cancelled', {
          windowId: current.id,
          payload: {
            idempotent: false,
            audit_note: parsed.audit_note,
            cancellation_reason: parsed.cancellation_reason
          }
        }, now)
      };
    });
    if (!result) throw new RhPulseParticipationError('window_not_found', 'The pilot window was not found.');
    return result;
  }

  async listWindows() {
    return {
      windows: await this.store.listWindows(),
      storage: { adapter: this.store.adapter, durable: this.store.durable }
    };
  }

  private buildAcceptedArtifacts(
    publicCallNumber: number,
    challenge: RhPulseCallChallengeRecord,
    window: RhPulseWindowRecord,
    signature: string,
    structuralSnapshot: RhPulseCallReceiptPayload['structural_snapshot'],
    requestOriginHash: string,
    recordedAt: string
  ): RhPulseAcceptedArtifacts {
    const callId = `rhp_call_${this.id()}`;
    const suffix = sha256(`${challenge.id}:${signature}`).slice(0, 12);
    const padded = String(publicCallNumber).padStart(6, '0');
    const publicSlug = `call-${padded}-${suffix}`;
    const receiptSlug = `receipt-${padded}-${suffix}`;
    const genesisRank = publicCallNumber <= RH_PULSE_GENESIS_LIMIT ? publicCallNumber : null;
    const call = RhPulseCallRecordSchema.parse({
      id: callId,
      public_call_number: publicCallNumber,
      window_id: window.id,
      wallet_address: challenge.wallet_address,
      selected_outcome: challenge.selected_outcome,
      signature,
      signed_message_hash: sha256(challenge.signed_message),
      recorded_at: recordedAt,
      verification_status: 'verified',
      abuse_status: 'clear',
      genesis_rank: genesisRank,
      public_slug: publicSlug,
      methodology_version: window.methodology_version,
      created_at: recordedAt
    });
    const payload = RhPulseCallReceiptPayloadSchema.parse({
      receipt_type: 'rh_pulse_signed_call',
      receipt_version: RH_PULSE_RECEIPT_VERSION,
      call_id: call.id,
      public_call_number: call.public_call_number,
      genesis_rank: call.genesis_rank,
      window: {
        id: window.id,
        sequence_number: window.sequence_number,
        opens_at: window.opens_at,
        closes_at: window.closes_at
      },
      wallet: {
        address: call.wallet_address,
        display_address: displayAddress(call.wallet_address)
      },
      selected_outcome: call.selected_outcome,
      selected_outcome_label: OUTCOME_LABELS[call.selected_outcome],
      recorded_at: call.recorded_at,
      methodology_version: call.methodology_version,
      signature_scheme: RH_PULSE_SIGNATURE_SCHEME,
      verification_status: 'verified',
      structural_snapshot: structuralSnapshot
    });
    const receipt = RhPulseCallReceiptRecordSchema.parse({
      id: `rhp_receipt_${this.id()}`,
      call_id: call.id,
      receipt_version: RH_PULSE_RECEIPT_VERSION,
      public_slug: receiptSlug,
      receipt_payload: payload,
      receipt_hash: `sha256:${sha256(canonicalJson(payload))}`,
      supersedes_receipt_id: null,
      created_at: recordedAt
    });
    const walletHash = sha256(challenge.wallet_address.toLowerCase());
    return {
      call,
      receipt,
      auditEvents: [
        this.auditEvent('signature_verified', {
          windowId: window.id,
          challengeId: challenge.id,
          callId: call.id,
          walletHash,
          requestOriginHash,
          payload: { signature_scheme: RH_PULSE_SIGNATURE_SCHEME }
        }, recordedAt),
        this.auditEvent('call_accepted', {
          windowId: window.id,
          challengeId: challenge.id,
          callId: call.id,
          walletHash,
          requestOriginHash,
          payload: {
            public_call_number: call.public_call_number,
            selected_outcome: call.selected_outcome,
            genesis_rank: call.genesis_rank
          }
        }, recordedAt),
        this.auditEvent('receipt_created', {
          windowId: window.id,
          challengeId: challenge.id,
          callId: call.id,
          walletHash,
          requestOriginHash,
          payload: { receipt_id: receipt.id, receipt_hash: receipt.receipt_hash }
        }, recordedAt)
      ]
    };
  }

  private publicCall(
    call: RhPulseCallRecord,
    window: RhPulseWindowRecord,
    receipt: RhPulseCallReceiptRecord
  ): RhPulsePublicCall {
    const publicUrl = `https://${this.publicHost}/calls/${encodeURIComponent(call.id)}`;
    return RhPulsePublicCallSchema.parse({
      call_id: call.id,
      public_call_number: call.public_call_number,
      public_slug: call.public_slug,
      wallet_display: displayAddress(call.wallet_address),
      selected_outcome: call.selected_outcome,
      selected_outcome_label: OUTCOME_LABELS[call.selected_outcome],
      recorded_at: call.recorded_at,
      window: publicWindowSummary(window, this.callsEnabled, this.now()),
      verification_status: call.verification_status,
      genesis: {
        is_genesis: call.genesis_rank !== null,
        rank: call.genesis_rank,
        limit: RH_PULSE_GENESIS_LIMIT,
        label: call.genesis_rank === null
          ? null
          : `GENESIS CALL #${String(call.genesis_rank).padStart(4, '0')} / ${RH_PULSE_GENESIS_LIMIT}`
      },
      receipt_url: `${publicUrl}#receipt`,
      public_url: publicUrl,
      resolution_status: 'unresolved',
      methodology_version: call.methodology_version
    });
  }

  private assertWindowAccepting(window: RhPulseWindowRecord | null, now: Date): asserts window is RhPulseWindowRecord {
    if (!window) throw new RhPulseParticipationError('no_active_window', 'No RH Pulse call window is open.');
    if (window.status === 'cancelled') throw new RhPulseParticipationError('window_cancelled', 'This RH Pulse call window was cancelled.');
    if (window.status !== 'open') throw new RhPulseParticipationError('window_not_open', 'The RH Pulse call window is not open.');
    if (now.getTime() < Date.parse(window.opens_at)) {
      throw new RhPulseParticipationError('window_not_started', 'The RH Pulse call window has not opened yet.');
    }
    if (now.getTime() >= Date.parse(window.call_submission_closes_at)) {
      throw new RhPulseParticipationError('window_closed', 'The RH Pulse call deadline has passed.');
    }
  }

  private challengeMatchesAuthority(challenge: RhPulseCallChallengeRecord, window: RhPulseWindowRecord) {
    return challenge.window_id === window.id
      && challenge.domain === this.publicHost
      && challenge.uri === this.canonicalUri
      && challenge.chain_id === RH_PULSE_CHAIN_ID
      && challenge.methodology_version === window.methodology_version
      && challenge.methodology_version === RH_PULSE_CALL_METHODOLOGY_VERSION
      && RhPulseCallOptionIdSchema.safeParse(challenge.selected_outcome).success;
  }

  private requireCallsEnabled() {
    if (!this.callsEnabled) {
      throw new RhPulseParticipationError('calls_disabled', 'Signed calls are not open yet.');
    }
  }

  private async rejectChallenge(
    challenge: RhPulseCallChallengeRecord,
    requestOriginHash: string,
    reason: string
  ) {
    await this.audit('signature_rejected', {
      windowId: challenge.window_id,
      challengeId: challenge.id,
      walletHash: sha256(challenge.wallet_address.toLowerCase()),
      requestOriginHash,
      payload: { reason }
    });
  }

  private async audit(
    eventType: RhPulseAuditEvent['event_type'],
    input: AuditInput
  ) {
    await this.store.appendAudit(this.auditEvent(eventType, input, this.now().toISOString()));
  }

  private auditEvent(
    eventType: RhPulseAuditEvent['event_type'],
    input: AuditInput,
    createdAt: string
  ) {
    return RhPulseAuditEventSchema.parse({
      id: `rhp_audit_${this.id()}`,
      event_type: eventType,
      window_id: input.windowId ?? null,
      challenge_id: input.challengeId ?? null,
      call_id: input.callId ?? null,
      wallet_hash: input.walletHash ?? null,
      request_origin_hash: input.requestOriginHash ?? null,
      payload: input.payload,
      created_at: createdAt
    });
  }
}

type AuditInput = {
  windowId?: string | null;
  challengeId?: string | null;
  callId?: string | null;
  walletHash?: string | null;
  requestOriginHash?: string | null;
  payload: Record<string, unknown>;
};

export function buildRhPulseCallMessage(input: {
  domain: string;
  uri: string;
  wallet: string;
  selectedOutcome: RhPulseCallOutcome;
  window: Pick<RhPulseWindowRecord, 'id' | 'opens_at' | 'closes_at' | 'methodology_version'>;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}) {
  return [
    'RH Pulse: Call the Rotation',
    '',
    `Domain: ${input.domain}`,
    `URI: ${input.uri}`,
    `Chain ID: ${RH_PULSE_CHAIN_ID}`,
    `Wallet: ${input.wallet}`,
    `Call: ${OUTCOME_LABELS[input.selectedOutcome]}`,
    `Call ID: ${input.selectedOutcome}`,
    `Window ID: ${input.window.id}`,
    `Window Opens: ${input.window.opens_at}`,
    `Window Closes: ${input.window.closes_at}`,
    `Methodology: ${input.window.methodology_version}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
    '',
    'This signature records a public prediction.',
    'It cannot move funds or approve transactions.'
  ].join('\n');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function communityDistribution(calls: RhPulseCallRecord[], observedAt: string): RhPulseCommunityDistribution {
  const outcomes = RhPulseCallOptionIdSchema.options;
  const verified = calls.filter((call) => call.verification_status === 'verified');
  const counts = new Map(outcomes.map((outcome) => [outcome, 0]));
  for (const call of verified) counts.set(call.selected_outcome, (counts.get(call.selected_outcome) ?? 0) + 1);
  const total = verified.length;
  if (!total) {
    return RhPulseCommunityDistributionSchema.parse({
      total_verified_calls: 0,
      outcomes: outcomes.map((outcome) => ({ outcome, count: 0, percentage: 0 })),
      observed_at: observedAt
    });
  }

  const exact = outcomes.map((outcome) => ({
    outcome,
    count: counts.get(outcome) ?? 0,
    units: ((counts.get(outcome) ?? 0) / total) * 10_000
  }));
  const floors = exact.map((item) => Math.floor(item.units));
  let remainder = 10_000 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((item, index) => ({ index, fraction: item.units - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let cursor = 0; remainder > 0; cursor += 1, remainder -= 1) floors[order[cursor % order.length].index] += 1;
  return RhPulseCommunityDistributionSchema.parse({
    total_verified_calls: total,
    outcomes: exact.map((item, index) => ({
      outcome: item.outcome,
      count: item.count,
      percentage: floors[index] / 100
    })),
    observed_at: observedAt
  });
}

export function receiptHash(payload: RhPulseCallReceiptPayload) {
  return `sha256:${sha256(canonicalJson(RhPulseCallReceiptPayloadSchema.parse(payload)))}`;
}

function publicWindow(window: RhPulseWindowRecord, callsEnabled: boolean, now: Date): RhPulsePredictionWindow {
  const accepting = callsEnabled
    && window.status === 'open'
    && now.getTime() >= Date.parse(window.opens_at)
    && now.getTime() < Date.parse(window.call_submission_closes_at);
  const durationHours = (Date.parse(window.closes_at) - Date.parse(window.opens_at)) / 3_600_000;
  return {
    id: window.id,
    sequence_number: window.sequence_number,
    state: window.status,
    label: `RH Pulse Window ${String(window.sequence_number).padStart(3, '0')}`,
    duration_hours: durationHours,
    opens_at: window.opens_at,
    closes_at: window.closes_at,
    call_submission_closes_at: window.call_submission_closes_at,
    calls_enabled: callsEnabled,
    accepting_calls: accepting,
    methodology_version: window.methodology_version,
    source_health: window.source_health,
    notice: !callsEnabled
      ? 'Signed calls are disabled by configuration.'
      : accepting
        ? 'The signed call window is open. Server time and durable window state are authoritative.'
        : window.status === 'open'
          ? 'The stored window is open, but server time does not permit new calls.'
          : `This window is ${window.status.replace('_', ' ')}.`
  };
}

function publicWindowSummary(window: RhPulseWindowRecord, callsEnabled: boolean, now: Date) {
  const publicValue = publicWindow(window, callsEnabled, now);
  return {
    id: publicValue.id,
    sequence_number: publicValue.sequence_number,
    state: publicValue.state,
    opens_at: publicValue.opens_at,
    closes_at: publicValue.closes_at,
    call_submission_closes_at: publicValue.call_submission_closes_at,
    accepting_calls: publicValue.accepting_calls,
    methodology_version: publicValue.methodology_version
  };
}

function previewWindow(callsEnabled: boolean): RhPulsePredictionWindow {
  return {
    id: 'rh_pulse_preview_24h',
    sequence_number: null,
    state: 'preview',
    label: 'Twenty-four hour call preview',
    duration_hours: 24,
    opens_at: null,
    closes_at: null,
    call_submission_closes_at: null,
    calls_enabled: callsEnabled,
    accepting_calls: false,
    methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION,
    source_health: {
      state: 'unavailable',
      observed_at: null,
      detail: 'No durable public call window is available.'
    },
    notice: callsEnabled
      ? 'No durable pilot window is open. RH Pulse will not fabricate one.'
      : 'Call window opening soon. Signed calls remain disabled by default.'
  };
}

function displayAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function nonceFromMessage(message: string) {
  return message.match(/^Nonce: (.+)$/m)?.[1] ?? null;
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function acceptanceFailureMessage(code: string) {
  if (code === 'challenge_expired') return 'The signing request expired. Create a new one.';
  if (code === 'challenge_used') return 'This signing request has already been used.';
  if (code === 'window_closed') return 'The RH Pulse call deadline has passed.';
  if (code === 'window_not_open') return 'The RH Pulse call window is not open.';
  return 'RH Pulse could not record this call.';
}

function isErrorCode(error: unknown, code: string) {
  return error instanceof Error && (
    error.message === code
    || ('code' in error && (error as { code?: unknown }).code === code)
  );
}

class BoundedFixedWindowLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number
  ) {}

  consume(key: string) {
    const now = this.now();
    const previous = this.entries.get(key);
    const entry = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : previous;
    entry.count += 1;
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune(now);
    return {
      allowed: entry.count <= this.max,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000))
    };
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }
}
