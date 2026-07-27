import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { renderRhPulseSharePng } from '../src/server/rhPulseSharePng';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import {
  RhPulseShareArtifactError,
  RhPulseShareArtifactService,
  rhPulseShareArtifactEtag
} from '../src/services/rhPulseShareArtifactService';
import { RhPulseResolutionError } from '../src/services/rhPulseResolutionService';
import {
  RH_PULSE_SHARE_LANDSCAPE,
  RH_PULSE_SHARE_PORTRAIT,
  RhPulseShareArtifactDataSchema,
  renderRhPulseShareSvg,
  type RhPulseShareArtifactData,
  type RhPulseShareArtifactType
} from '../src/shared/rhPulseShareArtifacts';

const ARTIFACT_TYPES: RhPulseShareArtifactType[] = [
  'signed_call',
  'genesis_signed_call',
  'correct_call',
  'incorrect_call',
  'rotation_result',
  'no_qualified_rotation',
  'resolution_delayed'
];

describe('RH Pulse deterministic share artifacts', () => {
  it.each(ARTIFACT_TYPES)('renders an accessible, receipt-bound %s SVG', (artifactType) => {
    const artifact = artifactFixture(artifactType);
    const first = renderRhPulseShareSvg(artifact, RH_PULSE_SHARE_LANDSCAPE);
    const second = renderRhPulseShareSvg(artifact, RH_PULSE_SHARE_LANDSCAPE);
    expect(second).toBe(first);
    expect(first).toContain('width="1200" height="630"');
    expect(first).toContain('<title id="rh-pulse-share-title">');
    expect(first).toContain('<desc id="rh-pulse-share-description">');
    expect(first).toContain(`data-artifact-type="${artifactType}"`);
    expect(first).toContain('data-renderer-version="rh-pulse-share-v1.0"');
    expect(first).toContain('INFOPUNKS / RH PULSE');
    expect(first).toContain('METHODOLOGY RH-PULSE-V1.0');
  });

  it('renders the two approved PNG dimensions with a valid PNG signature', () => {
    const artifact = artifactFixture('correct_call');
    const landscape = renderRhPulseSharePng(artifact, RH_PULSE_SHARE_LANDSCAPE);
    const portrait = renderRhPulseSharePng(artifact, RH_PULSE_SHARE_PORTRAIT);
    expect(landscape.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(landscape.readUInt32BE(16)).toBe(1_200);
    expect(landscape.readUInt32BE(20)).toBe(630);
    expect(portrait.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(portrait.readUInt32BE(16)).toBe(1_080);
    expect(portrait.readUInt32BE(20)).toBe(1_350);
  });

  it('escapes markup, removes Unicode controls and bounds long evidence prose', () => {
    const artifact = artifactFixture('rotation_result', {
      primary_line: 'RESULT <reviewed> & final',
      summary: `<script>alert("x")</script>\u202E${'evidence '.repeat(100)}`.slice(0, 360),
      evidence_lines: ['Reviewed <cohort> & verified overlap.']
    });
    const svg = renderRhPulseShareSvg(artifact, RH_PULSE_SHARE_LANDSCAPE);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('\u202E');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('RESULT &lt;reviewed&gt; &amp; final');
  });

  it('uses stable state-, renderer-, dimension- and format-bound ETags', () => {
    const artifact = artifactFixture('correct_call');
    const landscape = rhPulseShareArtifactEtag(artifact, RH_PULSE_SHARE_LANDSCAPE, 'png');
    expect(rhPulseShareArtifactEtag(
      structuredClone(artifact),
      RH_PULSE_SHARE_LANDSCAPE,
      'png'
    )).toBe(landscape);
    expect(rhPulseShareArtifactEtag(artifact, RH_PULSE_SHARE_PORTRAIT, 'png'))
      .not.toBe(landscape);
    expect(rhPulseShareArtifactEtag(artifact, RH_PULSE_SHARE_LANDSCAPE, 'svg'))
      .not.toBe(landscape);
  });

  it('does not expose draft or unapproved resolution artifacts', async () => {
    const service = new RhPulseShareArtifactService({
      participation: {
        getPublicReceipt: async () => {
          throw new Error('not_found');
        }
      },
      resolution: {
        getPublicResolution: async () => {
          throw new Error('draft_only');
        },
        getPublicRotationReceipt: async () => {
          throw new Error('unapproved');
        },
        getPublicDelayedResolution: async () => {
          throw new Error('no_public_blocked_run');
        }
      }
    });
    await expect(service.getResolutionArtifact('rhp_window_sharefixture'))
      .rejects.toMatchObject({ code: 'artifact_source_unavailable' });
    await expect(service.getRotationReceiptArtifact('rhp_rotation_receipt_sharefixture'))
      .rejects.toMatchObject({ code: 'artifact_unpublished' });
  });

  it('derives unresolved and Genesis artifacts only from immutable signed-call receipts', async () => {
    const signedReceipt = {
      call: {
        call_id: 'rhp_call_sharefixture001',
        public_call_number: 482,
        public_slug: 'call-000482-sharefixture',
        wallet_display: '0x1234…5678',
        selected_outcome: 'agents_to_rwas',
        selected_outcome_label: 'Agents → RWAs',
        recorded_at: '2026-07-23T12:14:00.000Z',
        window: {
          id: 'rhp_window_sharefixture001',
          sequence_number: 12,
          closes_at: '2026-07-24T12:00:00.000Z'
        },
        verification_status: 'verified',
        genesis: {
          is_genesis: true,
          rank: 482,
          limit: 4_663,
          label: 'GENESIS CALL #0482 / 4663'
        },
        resolution_status: 'unresolved',
        resolution: null,
        methodology_version: 'rh-pulse-v1.0'
      },
      receipt: {
        id: 'rhp_receipt_sharefixture001',
        receipt_hash: `sha256:${'4'.repeat(64)}`,
        created_at: '2026-07-23T12:14:00.000Z',
        receipt_payload: {
          structural_snapshot: {
            strongest_current_signal: 'memes_to_agents',
            connection_under_watch: 'agents_to_rwas',
            generated_at: '2026-07-23T12:13:00.000Z',
            source_health: 'delayed'
          }
        }
      }
    };
    const service = new RhPulseShareArtifactService({
      participation: {
        getPublicReceipt: async () => signedReceipt as never
      },
      resolution: {
        getPublicResolution: async () => {
          throw new RhPulseResolutionError('resolution_not_found', 'Not published.');
        },
        getPublicRotationReceipt: async () => {
          throw new RhPulseResolutionError('rotation_receipt_not_found', 'Not published.');
        },
        getPublicDelayedResolution: async () => {
          throw new RhPulseResolutionError('resolution_not_found', 'Not delayed.');
        }
      },
      publicHost: 'pulse.infopunks.fun'
    });
    await expect(service.getCallArtifact(signedReceipt.call.call_id)).resolves.toMatchObject({
      artifact_type: 'genesis_signed_call',
      generated_at: signedReceipt.receipt.created_at,
      canonical_url: 'https://pulse.infopunks.fun/calls/rhp_call_sharefixture001',
      source_records: [{
        kind: 'signed_call_receipt',
        id: signedReceipt.receipt.id,
        hash: signedReceipt.receipt.receipt_hash
      }],
      winning_outcome: null,
      public_call_number: 482,
      genesis_rank: 482
    });
  });

  it('binds a delayed call artifact to the durable blocked run as well as its signed receipt', async () => {
    const signedReceipt = {
      call: {
        call_id: 'rhp_call_delayedfixture001',
        public_call_number: 483,
        selected_outcome: 'memes_to_agents',
        selected_outcome_label: 'Memes → Agents',
        recorded_at: '2026-07-23T12:15:00.000Z',
        window: {
          id: 'rhp_window_delayedfixture001',
          sequence_number: 13,
          closes_at: '2026-07-24T12:00:00.000Z'
        },
        genesis: { is_genesis: true, rank: 483 },
        resolution: {
          status: 'delayed',
          blocked_reason: 'Critical closing observations remain unavailable.'
        },
        methodology_version: 'rh-pulse-v1.0'
      },
      receipt: {
        id: 'rhp_receipt_delayedfixture001',
        receipt_hash: `sha256:${'4'.repeat(64)}`,
        created_at: '2026-07-23T12:15:00.000Z',
        receipt_payload: {
          structural_snapshot: {
            strongest_current_signal: null
          }
        }
      }
    };
    const service = new RhPulseShareArtifactService({
      participation: {
        getPublicReceipt: async () => signedReceipt as never
      },
      resolution: {
        getPublicResolution: async () => {
          throw new RhPulseResolutionError('resolution_not_found', 'Not published.');
        },
        getPublicRotationReceipt: async () => {
          throw new RhPulseResolutionError('rotation_receipt_not_found', 'Not published.');
        },
        getPublicDelayedResolution: async () => ({
          window: signedReceipt.call.window,
          run_id: 'rhp_resolution_run_delayedfixture001',
          input_manifest_hash: `sha256:${'5'.repeat(64)}`,
          blocked_reason: 'Critical closing observations remain unavailable.',
          calculated_at: '2026-07-24T12:04:00.000Z',
          methodology_version: 'rh-pulse-v1.0'
        }) as never
      }
    });
    await expect(service.getCallArtifact(signedReceipt.call.call_id)).resolves.toMatchObject({
      artifact_type: 'resolution_delayed',
      generated_at: '2026-07-24T12:04:00.000Z',
      source_records: [
        { kind: 'signed_call_receipt', id: signedReceipt.receipt.id },
        {
          kind: 'blocked_resolution_run',
          id: 'rhp_resolution_run_delayedfixture001',
          hash: `sha256:${'5'.repeat(64)}`
        }
      ],
      winning_outcome: null
    });
  });
});

describe('RH Pulse public image routes', () => {
  it('serves immutable PNG/SVG artifacts and honors conditional requests', async () => {
    const artifact = artifactFixture('correct_call');
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhPulseShareArtifactService: artifactServiceStub(artifact)
    });
    try {
      const png = await app.inject({
        method: 'GET',
        url: '/v1/rh-pulse/calls/rhp_call_sharefixture001/share.png'
      });
      expect(png.statusCode).toBe(200);
      expect(png.headers['content-type']).toContain('image/png');
      expect(png.headers['cache-control']).toContain('immutable');
      expect(png.headers['x-rh-pulse-artifact-type']).toBe('correct_call');
      expect(png.rawPayload.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const conditional = await app.inject({
        method: 'GET',
        url: '/v1/rh-pulse/calls/rhp_call_sharefixture001/share.png',
        headers: { 'if-none-match': String(png.headers.etag) }
      });
      expect(conditional.statusCode).toBe(304);
      expect(conditional.rawPayload).toHaveLength(0);

      const svg = await app.inject({
        method: 'GET',
        url: '/v1/rh-pulse/calls/rhp_call_sharefixture001/share.svg'
      });
      expect(svg.statusCode).toBe(200);
      expect(svg.headers['content-type']).toContain('image/svg+xml');
      expect(svg.body).toContain('role="img"');

      const generic = await app.inject({ method: 'GET', url: '/og/rh-pulse.png' });
      expect(generic.statusCode).toBe(200);
      expect(generic.headers['content-type']).toContain('image/png');
      expect(generic.rawPayload.readUInt32BE(16)).toBe(1_200);
      expect(generic.rawPayload.readUInt32BE(20)).toBe(630);
    } finally {
      await app.close();
    }
  });

  it('fails safely without changing receipt validity and rejects unsafe identifiers', async () => {
    const unavailable = artifactServiceStub(artifactFixture('signed_call'), true);
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhPulseShareArtifactService: unavailable
    });
    try {
      const invalid = await app.inject({
        method: 'GET',
        url: '/v1/rh-pulse/calls/..%2Fetc%2Fpasswd/share.png'
      });
      expect(invalid.statusCode).toBe(400);

      const failed = await app.inject({
        method: 'GET',
        url: '/v1/rh-pulse/calls/rhp_call_sharefixture001/share.png'
      });
      expect(failed.statusCode).toBe(200);
      expect(failed.headers['content-type']).toContain('image/png');
      expect(failed.headers['cache-control']).toBe('no-store');
      expect(failed.headers['x-rh-pulse-artifact-fallback']).toBe('generic');
      expect(failed.rawPayload.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    } finally {
      await app.close();
    }
  });
});

function artifactFixture(
  artifactType: RhPulseShareArtifactType,
  overrides: Partial<RhPulseShareArtifactData> = {}
) {
  const isResolution = ['rotation_result', 'no_qualified_rotation'].includes(artifactType);
  const isDelayed = artifactType === 'resolution_delayed';
  const isIncorrect = artifactType === 'incorrect_call';
  const callOutcome = isResolution || isDelayed ? null : 'agents_to_rwas';
  const winningOutcome = artifactType === 'no_qualified_rotation'
    ? 'no_qualified_rotation'
    : isResolution || artifactType === 'correct_call' || isIncorrect
      ? 'memes_to_agents'
      : null;
  return RhPulseShareArtifactDataSchema.parse({
    artifact_type: artifactType,
    artifact_schema_version: '1.0',
    renderer_version: 'rh-pulse-share-v1.0',
    source_records: [{
      kind: isResolution ? 'rotation_receipt' : isDelayed ? 'blocked_resolution_run' : 'signed_call_receipt',
      id: 'rhp_receipt_sharefixture001',
      hash: `sha256:${'1'.repeat(64)}`
    }],
    source_identity_hash: `sha256:${'2'.repeat(64)}`,
    generated_at: '2026-07-24T12:31:00.000Z',
    canonical_url: 'https://pulse.infopunks.fun/calls/rhp_call_sharefixture001',
    primary_line: artifactType.replaceAll('_', ' ').toUpperCase(),
    call_outcome: callOutcome,
    call_outcome_label: callOutcome ? 'Agents → RWAs' : null,
    winning_outcome: winningOutcome,
    winning_outcome_label: winningOutcome === 'no_qualified_rotation'
      ? 'No Qualified Rotation'
      : winningOutcome
        ? 'Memes → Agents'
        : null,
    summary: isDelayed
      ? 'Critical closing observations remain unavailable. No winner has been published.'
      : 'Reviewed cross-layer participation established the public receipt claim.',
    evidence_lines: ['Reviewed participant overlap increased.'],
    public_call_number: callOutcome ? 482 : null,
    genesis_rank: artifactType === 'genesis_signed_call' ? 482 : null,
    window_sequence_number: 12,
    recorded_at: callOutcome ? '2026-07-23T12:14:00.000Z' : null,
    window_closes_at: '2026-07-24T12:00:00.000Z',
    published_at: winningOutcome ? '2026-07-24T12:31:00.000Z' : null,
    confidence: winningOutcome ? 'medium' : null,
    community_correct_percentage: isResolution ? 25 : null,
    community_total_verified_calls: isResolution ? 100 : null,
    receipt_label: isResolution ? 'ROTATION RECEIPT 012' : 'CALL #0482',
    receipt_hash: `sha256:${'3'.repeat(64)}`,
    methodology_version: 'rh-pulse-v1.0',
    image_alt: 'RH Pulse immutable public receipt artifact.',
    ...overrides
  });
}

function artifactServiceStub(artifact: RhPulseShareArtifactData, fail = false) {
  const load = async () => {
    if (fail) {
      throw new RhPulseShareArtifactError(
        'artifact_source_unavailable',
        'The immutable receipt remains valid.'
      );
    }
    return artifact;
  };
  return {
    getCallArtifact: load,
    getResolutionArtifact: load,
    getRotationReceiptArtifact: load
  } as unknown as RhPulseShareArtifactService;
}
