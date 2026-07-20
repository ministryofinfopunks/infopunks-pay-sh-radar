import { z } from 'zod';
import { NARRATIVE_PUBLIC_HOST } from './narrativeMetadata';

/**
 * Public-only, versioned contract for RH Chain share surfaces.  This is not a
 * second receipt model: receipt identifiers, integrity, freshness, and
 * supersession are carried from the published source record.
 */
export const RH_CHAIN_SHARE_MODEL_VERSION = 'rh_chain_share.v1' as const;
export const RH_CHAIN_SHARE_TEMPLATE_VERSION = 'rh_chain_share_copy.v1' as const;

export const RH_CHAIN_SHARE_OBJECT_TYPES = [
  'market_pulse',
  'cross_layer_insight',
  'attention_quality',
  'project_claim_verdict',
  'project_intelligence_receipt',
  'daily_receipt',
  'signal_4663',
  'future_capital_graduation',
  'future_agent_activity'
] as const;

export type RhChainShareObjectType = typeof RH_CHAIN_SHARE_OBJECT_TYPES[number];

const absolutePublicUrl = z.string().url().refine((value) => value.startsWith(NARRATIVE_PUBLIC_HOST), 'canonical URL must use the public Infopunks host');
const isoTimestamp = z.string().datetime({ offset: true });

export const RhChainShareObjectSchema = z.object({
  schema_version: z.literal(RH_CHAIN_SHARE_MODEL_VERSION),
  template_version: z.literal(RH_CHAIN_SHARE_TEMPLATE_VERSION),
  object_type: z.enum(RH_CHAIN_SHARE_OBJECT_TYPES),
  canonical_url: absolutePublicUrl,
  public_title: z.string().min(1).max(180),
  deterministic_headline: z.string().min(1).max(280),
  principal_finding: z.string().min(1).max(900),
  material_caveat: z.string().min(1).max(900),
  observation_window: z.string().min(1).max(240),
  captured_at: isoTimestamp.nullable(),
  freshness: z.enum(['fresh', 'partial', 'stale', 'unavailable', 'source_required', 'baseline_forming', 'insufficient_history']),
  confidence: z.enum(['low', 'medium', 'high', 'unavailable']),
  methodology_version: z.string().min(1).max(120),
  source_summary: z.string().min(1).max(900),
  receipt_id: z.string().min(1).max(160).nullable(),
  integrity_hash: z.string().min(16).max(256).nullable(),
  publication_state: z.enum(['published', 'superseded', 'provisional', 'unavailable', 'disputed']),
  supersession_state: z.enum(['none', 'current', 'superseded']),
  correction_link: absolutePublicUrl.nullable(),
  replacement_receipt_link: absolutePublicUrl.nullable(),
  identity: z.object({
    project_id: z.string().min(1).max(160).nullable(),
    project_name: z.string().min(1).max(240).nullable(),
    asset_name: z.string().min(1).max(240).nullable(),
    exact_contract: z.string().min(1).max(160).nullable()
  }),
  evidence_state: z.enum(['supported', 'partially_supported', 'unverified', 'contradicted', 'disputed', 'provisional', 'measurable', 'baseline_forming', 'insufficient_history', 'stale', 'unavailable', 'source_required']),
  project_says: z.string().min(1).max(900).nullable(),
  not_financial_advice: z.literal(true)
}).superRefine((value, context) => {
  if (value.publication_state !== 'published' && value.publication_state !== 'superseded') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'only public published or explicitly superseded objects can be shared' });
  }
  if (value.supersession_state === 'superseded' && (!value.correction_link || !value.replacement_receipt_link)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'superseded share objects require visible correction and replacement links' });
  }
  if (value.receipt_id && !value.integrity_hash && value.object_type === 'project_intelligence_receipt') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'published project receipts require an integrity hash' });
  }
});

export type RhChainShareObject = z.infer<typeof RhChainShareObjectSchema>;

export type RhChainShareInput = Omit<RhChainShareObject, 'schema_version' | 'template_version' | 'canonical_url'> & { canonical_url: string };

function canonicalUrl(value: string) {
  if (value.startsWith('/')) return `${NARRATIVE_PUBLIC_HOST}${value}`;
  return value;
}

/** Creates a safe public projection. Callers may only supply public fields. */
export function createRhChainShareObject(input: RhChainShareInput): RhChainShareObject {
  return RhChainShareObjectSchema.parse({
    ...input,
    canonical_url: canonicalUrl(input.canonical_url),
    schema_version: RH_CHAIN_SHARE_MODEL_VERSION,
    template_version: RH_CHAIN_SHARE_TEMPLATE_VERSION
  });
}

/** Stable serialization makes receipts/cards/test fixtures deterministic across runtimes. */
export function serializeRhChainShareObject(value: RhChainShareObject) {
  const parsed = RhChainShareObjectSchema.parse(value);
  return JSON.stringify({
    schema_version: parsed.schema_version, template_version: parsed.template_version, object_type: parsed.object_type,
    canonical_url: parsed.canonical_url, public_title: parsed.public_title, deterministic_headline: parsed.deterministic_headline,
    principal_finding: parsed.principal_finding, material_caveat: parsed.material_caveat, observation_window: parsed.observation_window,
    captured_at: parsed.captured_at, freshness: parsed.freshness, confidence: parsed.confidence,
    methodology_version: parsed.methodology_version, source_summary: parsed.source_summary, receipt_id: parsed.receipt_id,
    integrity_hash: parsed.integrity_hash, publication_state: parsed.publication_state, supersession_state: parsed.supersession_state,
    correction_link: parsed.correction_link, replacement_receipt_link: parsed.replacement_receipt_link, identity: parsed.identity,
    evidence_state: parsed.evidence_state, project_says: parsed.project_says, not_financial_advice: parsed.not_financial_advice
  });
}

function productLabel(type: RhChainShareObjectType) {
  return ({
    market_pulse: 'MARKET PULSE', cross_layer_insight: 'CROSS-LAYER INSIGHT', attention_quality: 'ATTENTION QUALITY',
    project_claim_verdict: 'PROJECT CLAIM', project_intelligence_receipt: 'INTELLIGENCE RECEIPT', daily_receipt: 'DAILY RECEIPT',
    signal_4663: '4663 SIGNAL INDEX', future_capital_graduation: 'CAPITAL GRADUATION', future_agent_activity: 'AGENT ACTIVITY'
  })[type];
}

function evidenceLabel(value: RhChainShareObject['evidence_state']) {
  return value.replaceAll('_', ' ').toUpperCase();
}

/** No LLM or time-dependent content: all output is a versioned template over the public record. */
export function buildRhChainShareCopy(value: RhChainShareObject) {
  const item = RhChainShareObjectSchema.parse(value);
  const lines = [`INFOPUNKS / ${productLabel(item.object_type)}`];
  if (item.object_type === 'project_claim_verdict' && item.project_says) lines.push(`PROJECT SAYS: ${item.project_says}`);
  if (item.object_type === 'project_claim_verdict') lines.push(`INFOPUNKS VERDICT: ${item.deterministic_headline}`);
  else lines.push(`FINDING: ${item.deterministic_headline}`);
  lines.push(`EVIDENCE: ${item.principal_finding}`);
  lines.push(`EVIDENCE STATE: ${evidenceLabel(item.evidence_state)}`);
  lines.push(`WINDOW: ${item.observation_window}`);
  lines.push(`CONFIDENCE: ${item.confidence.toUpperCase()}`);
  lines.push(`OPEN QUESTION: ${item.material_caveat}`);
  if (item.receipt_id) lines.push(`RECEIPT: ${item.receipt_id}`);
  if (item.supersession_state === 'superseded') lines.push('CORRECTION: This receipt is superseded; use the linked replacement.');
  lines.push(item.canonical_url, 'Not financial advice.');
  return lines.join('\n');
}

export type RhChainDistributionEligibility = { eligible: boolean; reason: string | null; requires_supersession_label: boolean };

/** Eligibility is deliberately separate from promotion. A reviewer-controlled pack can opt in later. */
export function getRhChainDistributionEligibility(value: RhChainShareObject): RhChainDistributionEligibility {
  const item = RhChainShareObjectSchema.safeParse(value);
  if (!item.success) return { eligible: false, reason: 'invalid_or_nonpublic_share_object', requires_supersession_label: false };
  if (!item.data.source_summary || item.data.confidence === 'unavailable') return { eligible: false, reason: 'source_or_confidence_required', requires_supersession_label: false };
  if (item.data.publication_state === 'disputed' || item.data.publication_state === 'provisional') return { eligible: false, reason: 'nonfinal_publication_state', requires_supersession_label: false };
  if (item.data.supersession_state === 'superseded') return { eligible: Boolean(item.data.correction_link && item.data.replacement_receipt_link), reason: item.data.correction_link && item.data.replacement_receipt_link ? null : 'supersession_links_required', requires_supersession_label: true };
  return { eligible: true, reason: null, requires_supersession_label: false };
}

/** Returns candidates only; callers must retain the existing reviewer publication boundary before promotion. */
export function selectRhChainDistributionCandidates(values: readonly RhChainShareObject[]) {
  return values.flatMap((share) => {
    const eligibility = getRhChainDistributionEligibility(share);
    return eligibility.eligible ? [{ share, ...eligibility }] : [];
  });
}

export function rhChainShareOgPath(value: RhChainShareObject) {
  const encoded = encodeURIComponent(value.receipt_id ?? value.object_type);
  return `/og/rh-chain/share/${encoded}.png`;
}
