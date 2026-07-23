import {
  RH_PULSE_PRODUCT_DESCRIPTION,
  RH_PULSE_PRODUCT_TITLE
} from './rhPulse';
import type { RhPulseRequestResolution } from './rhPulseRouteCore';

export {
  DEFAULT_PULSE_PUBLIC_HOST,
  RADAR_PUBLIC_HOST,
  RADAR_RENDER_HOSTS,
  getRhPulseClientResolution,
  normalizePublicHostname,
  parseRhPulseRoute,
  resolveRhPulseRequest
} from './rhPulseRouteCore';
export type {
  RhPulseBootContext,
  RhPulseRequestResolution,
  RhPulseRoute
} from './rhPulseRouteCore';

export type RhPulseMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterCard: 'summary' | 'summary_large_image';
  ogImageUrl: string | null;
  ogImageWidth: number | null;
  ogImageHeight: number | null;
  ogImageAlt: string | null;
  twitterImageUrl: string | null;
  themeColor: string;
  structuredData: Record<string, unknown>;
};

export type RhPulseCallMetadataRecord = {
  publicCallNumber: number;
  selectedOutcomeLabel: string;
  walletDisplay: string;
  recordedAt: string;
  resolutionStatus?: 'unresolved' | 'correct' | 'incorrect';
  winningOutcomeLabel?: string | null;
  resolutionDelayed?: boolean;
};

export type RhPulseResolutionMetadataRecord = {
  windowSequenceNumber: number;
  outcomeLabel: string;
  confidence: string;
  publishedAt: string;
};

export function getRhPulseMetadata(
  resolution: RhPulseRequestResolution,
  callRecord?: RhPulseCallMetadataRecord | null,
  resolutionRecord?: RhPulseResolutionMetadataRecord | null
): RhPulseMetadata | null {
  if (resolution.surface !== 'rh-pulse' || !resolution.route) return null;
  const base = `https://${resolution.publicHost}`;
  const route = resolution.route;
  const resolvedCall = callRecord?.resolutionStatus === 'correct'
    || callRecord?.resolutionStatus === 'incorrect';
  const title = route.kind === 'home'
    ? RH_PULSE_PRODUCT_TITLE
    : route.kind === 'methodology'
      ? 'RH Pulse Methodology | Infopunks'
      : route.kind === 'call'
        ? callRecord
          ? callRecord.resolutionStatus === 'correct'
            ? `I Called ${callRecord.selectedOutcomeLabel} | RH Pulse`
            : callRecord.resolutionStatus === 'incorrect'
              ? `Call Resolved | RH Pulse Call #${String(callRecord.publicCallNumber).padStart(4, '0')}`
              : callRecord.resolutionDelayed
                ? `Resolution Delayed | RH Pulse Call #${String(callRecord.publicCallNumber).padStart(4, '0')}`
                : `${callRecord.selectedOutcomeLabel} | RH Pulse Call #${String(callRecord.publicCallNumber).padStart(4, '0')}`
          : `RH Pulse Call ${route.id} | Infopunks`
        : route.kind === 'receipt'
          ? `RH Pulse Receipt ${route.id} | Infopunks`
          : route.kind === 'resolution'
            ? resolutionRecord
              ? resolutionRecord.outcomeLabel === 'No Qualified Rotation'
                ? `No Qualified Rotation | RH Pulse Receipt ${String(resolutionRecord.windowSequenceNumber).padStart(3, '0')}`
                : `${resolutionRecord.outcomeLabel} Won | RH Pulse Rotation Receipt ${String(resolutionRecord.windowSequenceNumber).padStart(3, '0')}`
              : `RH Pulse Resolution ${route.id} | Infopunks`
            : route.kind === 'rotation_receipt'
              ? resolutionRecord
                ? resolutionRecord.outcomeLabel === 'No Qualified Rotation'
                  ? `No Qualified Rotation | RH Pulse Receipt ${String(resolutionRecord.windowSequenceNumber).padStart(3, '0')}`
                  : `${resolutionRecord.outcomeLabel} Won | RH Pulse Rotation Receipt ${String(resolutionRecord.windowSequenceNumber).padStart(3, '0')}`
                : `RH Pulse Rotation Receipt ${route.id} | Infopunks`
          : 'RH Pulse | Infopunks';
  const description = route.kind === 'home'
    ? RH_PULSE_PRODUCT_DESCRIPTION
    : route.kind === 'methodology'
      ? 'How RH Pulse separates reviewed overlap, activity coupling, narrative movement and insufficient evidence without calling correlation capital flow.'
      : route.kind === 'call'
        ? callRecord
          ? resolvedCall
            ? callRecord.resolutionStatus === 'correct'
              ? `Call #${String(callRecord.publicCallNumber).padStart(4, '0')} matched RH Pulse Rotation Receipt ${callRecord.winningOutcomeLabel ?? 'published result'}.`
              : `${callRecord.walletDisplay} signed ${callRecord.selectedOutcomeLabel}. The published result was ${callRecord.winningOutcomeLabel ?? 'preserved in the Rotation Receipt'}; the original call remains on the record.`
            : callRecord.resolutionDelayed
              ? `${callRecord.walletDisplay} signed ${callRecord.selectedOutcomeLabel}. Resolution is delayed; no winner has been published.`
              : 'A signed public call on the next structural rotation on Robinhood Chain.'
          : 'Verified RH Pulse call receipt. Public call details load only when an immutable signed record exists.'
        : route.kind === 'receipt'
          ? 'Immutable RH Pulse signed-call receipt and reproducible verification hash.'
          : route.kind === 'resolution' || route.kind === 'rotation_receipt'
            ? resolutionRecord
              ? `${resolutionRecord.outcomeLabel} resolved RH Pulse window ${String(resolutionRecord.windowSequenceNumber).padStart(3, '0')} with ${resolutionRecord.confidence} confidence. Evidence, limitations and community accuracy are preserved in an immutable Rotation Receipt.`
              : 'Published RH Pulse evidence-based resolution and immutable Rotation Receipt.'
          : RH_PULSE_PRODUCT_DESCRIPTION;
  const canonicalUrl = `${base}${route.canonicalPath}`;
  const dynamicOgImageUrl = route.kind === 'call' && callRecord
    ? `${base}/v1/rh-pulse/calls/${encodeURIComponent(route.id)}/share.png`
    : (route.kind === 'resolution' || route.kind === 'rotation_receipt') && resolutionRecord
      ? route.kind === 'resolution'
        ? `${base}/v1/rh-pulse/resolutions/${encodeURIComponent(route.id)}/share.png`
        : `${base}/v1/rh-pulse/rotation-receipts/${encodeURIComponent(route.id)}/share.png`
      : null;
  const ogImageUrl = dynamicOgImageUrl ?? `${base}/og/rh-pulse.png`;
  const ogImageAlt = route.kind === 'call' && callRecord
    ? `${title}. Verified RH Pulse public call artifact.`
    : (route.kind === 'resolution' || route.kind === 'rotation_receipt') && resolutionRecord
      ? `${title}. Immutable RH Pulse Rotation Receipt artifact.`
      : 'RH Pulse: Call the Rotation. Independent public intelligence by Infopunks.';
  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonicalUrl,
    twitterTitle: title,
    twitterDescription: description,
    twitterCard: 'summary_large_image',
    ogImageUrl,
    ogImageWidth: 1_200,
    ogImageHeight: 630,
    ogImageAlt,
    twitterImageUrl: ogImageUrl,
    themeColor: '#050807',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RH Pulse',
      alternateName: 'Call the Rotation',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: `${base}/`,
      description: RH_PULSE_PRODUCT_DESCRIPTION,
      creator: {
        '@type': 'Organization',
        name: 'Infopunks',
        url: 'https://infopunks.fun/'
      },
      publisher: {
        '@type': 'Organization',
        name: 'Infopunks',
        url: 'https://infopunks.fun/'
      },
      isPartOf: {
        '@type': 'WebSite',
        name: 'Infopunks',
        url: 'https://infopunks.fun/'
      },
      ...(callRecord ? {
        mainEntity: {
          '@type': 'Claim',
          appearance: canonicalUrl,
          dateCreated: callRecord.recordedAt,
          author: {
            '@type': 'Person',
            name: callRecord.walletDisplay
          },
          text: callRecord.selectedOutcomeLabel
        }
      } : resolutionRecord ? {
        mainEntity: {
          '@type': 'Report',
          headline: resolutionRecord.outcomeLabel,
          datePublished: resolutionRecord.publishedAt,
          about: 'Robinhood Chain structural rotation'
        }
      } : {})
    }
  };
}
