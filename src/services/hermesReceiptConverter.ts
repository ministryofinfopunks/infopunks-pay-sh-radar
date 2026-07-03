import type { HermesArtifact, HermesDecisionState, HermesRun } from '../data/hermesDesk';

export type HermesRunReceipt = {
  id: string;
  source_run_id: string;
  title: string;
  summary: string;
  decision: HermesDecisionState;
  confidence: number;
  artifacts: HermesArtifact[];
  evidence_count: number;
  created_at: string;
  receipt_kind: 'agent_run_receipt';
  source: 'hermes';
};

export type HermesClaimCandidate = {
  id: string;
  source_receipt_id: string;
  title: string;
  claim: string;
  status: 'candidate';
  confidence: number;
  evidence_summary: string;
  risk_notes: string[];
  created_at: string;
};

export type HermesRunReceiptConversion = {
  run_id: string;
  receipt: HermesRunReceipt;
  claim_candidate: HermesClaimCandidate;
  conversion: {
    status: 'converted' | 'already_converted' | 'failed';
    notes: string[];
  };
};

const fallbackCreatedAt = '2026-07-03T00:00:00.000Z';

function slugifyRunId(runId: string): string {
  const slug = runId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'unknown_run';
}

function normalizeDecision(decision: unknown): HermesDecisionState {
  if (
    decision === 'trust' ||
    decision === 'caution' ||
    decision === 'do_not_use_yet' ||
    decision === 'unproven' ||
    decision === 'disputed'
  ) {
    return decision;
  }
  return 'unproven';
}

function normalizeConfidence(confidence: unknown): number {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

function normalizeArtifactType(type: unknown): HermesArtifact['type'] {
  if (
    type === 'receipt' ||
    type === 'claim' ||
    type === 'loop_run' ||
    type === 'risk_note' ||
    type === 'narrative_scan' ||
    type === 'skill_trace'
  ) {
    return type;
  }
  return 'risk_note';
}

function copyArtifacts(artifacts: unknown): HermesArtifact[] {
  if (!Array.isArray(artifacts)) return [];
  return artifacts.flatMap((artifact): HermesArtifact[] => {
    if (!artifact || typeof artifact !== 'object') return [];
    const candidate = artifact as Partial<HermesArtifact>;
    return [{
      artifact_id: String(candidate.artifact_id ?? 'artifact_unknown'),
      label: String(candidate.label ?? 'Hermes artifact'),
      type: normalizeArtifactType(candidate.type),
      summary: String(candidate.summary ?? 'No artifact summary supplied.'),
      uri: String(candidate.uri ?? '#')
    }];
  });
}

function decisionClaim(decision: HermesDecisionState, title: string): { title: string; claim: string } {
  if (decision === 'trust') {
    return {
      title: `${title} trust candidate`,
      claim: `${title} is supported for use by the attached Hermes investigation artifacts.`
    };
  }
  if (decision === 'caution') {
    return {
      title: `${title} limited-use candidate`,
      claim: `${title} may be used only with limited or test spend while caveats remain active.`
    };
  }
  if (decision === 'do_not_use_yet') {
    return {
      title: `${title} warning candidate`,
      claim: `${title} should not be used yet because Hermes found spend-blocking risk or insufficient validation.`
    };
  }
  if (decision === 'disputed') {
    return {
      title: `${title} disputed-evidence candidate`,
      claim: `${title} has disputed evidence and should not update market reputation until review resolves.`
    };
  }
  return {
    title: `${title} evidence-insufficient candidate`,
    claim: `${title} remains unproven because the available Hermes evidence is not enough for trust.`
  };
}

export function convertHermesRunToReceipt(run: HermesRun): HermesRunReceiptConversion {
  const rawRun = (run ?? {}) as Partial<HermesRun>;
  const runId = String(rawRun.id ?? 'unknown_run');
  const runSlug = slugifyRunId(runId);
  const title = String(rawRun.title ?? 'Hermes investigation');
  const decision = normalizeDecision(rawRun.decision);
  const confidence = normalizeConfidence(rawRun.confidence);
  const artifacts = copyArtifacts(rawRun.artifacts);
  const createdAt = String(rawRun.completed_at ?? rawRun.created_at ?? fallbackCreatedAt);
  const receiptId = `receipt_hermes_${runSlug}`;
  const claim = decisionClaim(decision, title);
  const notes: string[] = [
    'Converted HermesRun into a ProofReceipt-compatible agent run receipt.',
    'Generated claim candidate is not persisted and does not update market memory yet.'
  ];

  if (artifacts.length === 0) {
    notes.push('No artifacts were attached; evidence_count is 0 and claim candidate must remain evidence-insufficient until artifacts arrive.');
  }

  if (!rawRun.id) notes.push('Run id was missing; fallback deterministic id segment was used.');
  if (!rawRun.summary) notes.push('Run summary was missing; fallback summary text was used.');

  const receipt: HermesRunReceipt = {
    id: receiptId,
    source_run_id: runId,
    title: `Hermes Agent Run Receipt: ${title}`,
    summary: String(rawRun.summary ?? 'Hermes run did not include a summary.'),
    decision,
    confidence,
    artifacts,
    evidence_count: artifacts.length,
    created_at: createdAt,
    receipt_kind: 'agent_run_receipt',
    source: 'hermes'
  };

  const riskNotes = Array.isArray(rawRun.risk_factors)
    ? rawRun.risk_factors.filter((risk): risk is string => typeof risk === 'string' && risk.trim().length > 0)
    : [];

  return {
    run_id: runId,
    receipt,
    claim_candidate: {
      id: `claim_candidate_hermes_${runSlug}`,
      source_receipt_id: receiptId,
      title: claim.title,
      claim: claim.claim,
      status: 'candidate',
      confidence,
      evidence_summary: artifacts.length
        ? `${artifacts.length} Hermes artifact(s) attached: ${artifacts.map((artifact) => artifact.label).join(', ')}.`
        : 'No Hermes artifacts are attached to this run receipt.',
      risk_notes: riskNotes.length ? riskNotes : ['No risk notes supplied by Hermes.'],
      created_at: createdAt
    },
    conversion: {
      status: 'converted',
      notes
    }
  };
}
