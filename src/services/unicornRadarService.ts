import {
  getUnicornRadarCandidate,
  listUnicornRadarCandidates,
  listUnicornRadarRevenueReceipts
} from '../data/unicornRadar';
import {
  UnicornRadarCandidateListSchema,
  UnicornRadarEvaluationRequestResponseSchema,
  UnicornRadarSectorSchema,
  UnicornRadarStatusSchema,
  UnicornRadarSubmissionResponseSchema,
  UnicornRadarSummarySchema,
  UnicornRadarVerdictSchema,
  type UnicornRadarCandidate,
  type UnicornRadarCandidateList,
  type UnicornRadarEvaluationRequestInput,
  type UnicornRadarEvaluationRequestResponse,
  type UnicornRadarRevenueReceipt,
  type UnicornRadarSubmissionInput,
  type UnicornRadarSubmissionResponse,
  type UnicornRadarSummary
} from '../schemas/entities';

export const UNICORN_RADAR_COPY = {
  title: 'Infopunks Unicorn Radar',
  tagline: 'Finding serious low-cap Solana projects before consensus does.',
  subline: 'Retail doesn’t need less risk. Retail needs better signal before taking risk.',
  trust_line: 'Projects can buy evaluation, not conviction.',
  doctrine_line: 'Influencers sell certainty. Infopunks sells legible uncertainty.'
} as const;

export const UNICORN_RADAR_REQUIREMENTS = [
  'Proof of shipping: product, repo, demo, API, user flow, or live artifact.',
  'Attention quality: who is paying attention and whether they can explain the project without price talk.',
  'Token survivability: why the token still matters if incentives cool down.',
  'Risk flags: concentration, liquidity, security, disclosure, regulatory, or KOL dependency.',
  'Receipts: links, screenshots, docs, on-chain records, changelogs, or user evidence.'
];

const GENERATED_AT = '2026-07-06T08:30:00.000Z';

function emptyStatusCounts() {
  return Object.fromEntries(UnicornRadarStatusSchema.options.map((status) => [status, 0])) as Record<UnicornRadarCandidate['status'], number>;
}

function emptyVerdictCounts() {
  return Object.fromEntries(UnicornRadarVerdictSchema.options.map((verdict) => [verdict, 0])) as Record<UnicornRadarCandidate['verdict'], number>;
}

function emptySectorCounts() {
  return Object.fromEntries(UnicornRadarSectorSchema.options.map((sector) => [sector, 0])) as Record<UnicornRadarCandidate['sector'], number>;
}

export function buildUnicornRadarSummary(): UnicornRadarSummary {
  const candidates = listUnicornRadarCandidates();
  const byStatus = emptyStatusCounts();
  const byVerdict = emptyVerdictCounts();
  const bySector = emptySectorCounts();

  for (const candidate of candidates) {
    byStatus[candidate.status] += 1;
    byVerdict[candidate.verdict] += 1;
    bySector[candidate.sector] += 1;
  }

  return UnicornRadarSummarySchema.parse({
    generated_at: GENERATED_AT,
    ...UNICORN_RADAR_COPY,
    counts: {
      total: candidates.length,
      by_status: byStatus,
      by_verdict: byVerdict,
      by_sector: bySector
    },
    candidates,
    revenue_receipts: listUnicornRadarRevenueReceipts()
  });
}

export function buildUnicornRadarCandidateList(): UnicornRadarCandidateList {
  const candidates = listUnicornRadarCandidates();
  return UnicornRadarCandidateListSchema.parse({
    generated_at: GENERATED_AT,
    count: candidates.length,
    candidates
  });
}

export function resolveUnicornRadarCandidate(candidateId: string): UnicornRadarCandidate | null {
  return getUnicornRadarCandidate(candidateId) ?? null;
}

export function buildUnicornRadarRevenueReceipts(): UnicornRadarRevenueReceipt[] {
  return listUnicornRadarRevenueReceipts();
}

function stableId(prefix: string, parts: string[]) {
  const raw = parts.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${prefix}_${raw || 'request'}_${GENERATED_AT.slice(0, 10).replace(/-/g, '')}`;
}

export function createUnicornRadarSubmission(input: UnicornRadarSubmissionInput): UnicornRadarSubmissionResponse {
  return UnicornRadarSubmissionResponseSchema.parse({
    submission_id: stableId('urs', [input.project, input.ticker ?? '']),
    status: 'staged_for_review',
    candidate_preview: {
      project: input.project,
      ticker: input.ticker ?? 'TBD',
      sector: input.sector,
      market_cap_range: input.market_cap_range ?? 'not provided',
      thesis: input.thesis
    },
    default_requirements: UNICORN_RADAR_REQUIREMENTS,
    disclosure: 'Community submissions are intake only. Infopunks may investigate, ignore, reject, or promote based on receipts.',
    submitted_at: GENERATED_AT
  });
}

export function requestUnicornRadarEvaluation(input: UnicornRadarEvaluationRequestInput): UnicornRadarEvaluationRequestResponse {
  return UnicornRadarEvaluationRequestResponseSchema.parse({
    request_id: stableId('ure', [input.project, input.contact]),
    status: 'evaluation_requested',
    project: input.project,
    disclosure: 'Paid evaluation requests are disclosed publicly when a candidate enters the Radar. Payment buys evaluation time, not conviction, ranking, or a favorable verdict.',
    doctrine: UNICORN_RADAR_COPY.trust_line,
    next_steps: [
      'Infopunks requests receipts before assigning conviction.',
      'Paid status is shown beside the candidate if the project enters the public Radar.',
      'Risk flags and negative verdicts remain publishable.'
    ],
    requested_at: GENERATED_AT
  });
}
