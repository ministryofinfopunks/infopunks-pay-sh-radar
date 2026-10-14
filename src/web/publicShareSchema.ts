import { z } from 'zod';

// Validate the complete public projection before rendering or emitting telemetry.
// Private state and unsupported link schemes never enter the share surface.
const internalPath = z.string().regex(/^\/(?!\/)[^\s\\]*$/);
const publicLink = z.string().refine(value => internalPath.safeParse(value).success || /^https:\/\/[^\s\\]+$/.test(value));
const nullableText = z.string().nullable();
export const publicShareSchema = z.object({
  share_object_id: z.string().min(1),
  share_type: z.enum(['NOW_FINDING', 'WATCH_CASE', 'OPEN_LOOP', 'CALL_RECEIPT', 'RESOLUTION_RECEIPT', 'PROOF_PROFILE', 'RMM_CENSUS_OBSERVATION', 'RADAR_VERIFICATION', 'RADAR_FALSIFICATION', 'AI_NVDA_CHECKPOINT', 'PLTR_SHADOW_OBSERVATION', 'FRONTDOOR_CHANGE_EVENT']),
  canonical_subject_id: z.string().min(1), title: z.string(), primary_statement: z.string(),
  secondary_statement: nullableText, primary_metric: nullableText,
  evidence_state: z.enum(['VERIFIED', 'MIXED', 'WATCH', 'UNRESOLVED', 'BLOCK', 'FALSIFIED', 'INSUFFICIENT_DATA', 'DEGRADE']),
  observed_at: nullableText, source_freshness: nullableText,
  source_ref: z.object({ source_type: z.string(), source_id: z.string(), href: publicLink, observed_at: nullableText }).strict(),
  deep_link: internalPath, canonical_url: publicLink, og_image_url: publicLink, share_text: z.string(),
  share_version: z.literal('rh4663.share.v1'),
  immutability_state: z.enum(['IMMUTABLE', 'VERSIONED_CURRENT']), privacy_state: z.literal('PUBLIC')
}).strict();
