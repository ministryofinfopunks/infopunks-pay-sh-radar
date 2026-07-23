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
  twitterCard: 'summary';
  themeColor: string;
  structuredData: Record<string, unknown>;
};

export type RhPulseCallMetadataRecord = {
  publicCallNumber: number;
  selectedOutcomeLabel: string;
  walletDisplay: string;
  recordedAt: string;
};

export function getRhPulseMetadata(
  resolution: RhPulseRequestResolution,
  callRecord?: RhPulseCallMetadataRecord | null
): RhPulseMetadata | null {
  if (resolution.surface !== 'rh-pulse' || !resolution.route) return null;
  const base = `https://${resolution.publicHost}`;
  const route = resolution.route;
  const title = route.kind === 'home'
    ? RH_PULSE_PRODUCT_TITLE
    : route.kind === 'methodology'
      ? 'RH Pulse Methodology | Infopunks'
      : route.kind === 'call'
        ? callRecord
          ? `${callRecord.selectedOutcomeLabel} | RH Pulse Call #${String(callRecord.publicCallNumber).padStart(4, '0')}`
          : `RH Pulse Call ${route.id} | Infopunks`
        : route.kind === 'receipt'
          ? `RH Pulse Receipt ${route.id} | Infopunks`
          : 'RH Pulse | Infopunks';
  const description = route.kind === 'home'
    ? RH_PULSE_PRODUCT_DESCRIPTION
    : route.kind === 'methodology'
      ? 'How RH Pulse separates reviewed overlap, activity coupling, narrative movement and insufficient evidence without calling correlation capital flow.'
      : route.kind === 'call'
        ? callRecord
          ? `${callRecord.walletDisplay} signed ${callRecord.selectedOutcomeLabel}. Verified public prediction; resolution remains pending.`
          : 'Verified RH Pulse call receipt. Public call details load only when an immutable signed record exists.'
        : route.kind === 'receipt'
          ? 'Immutable RH Pulse signed-call receipt and reproducible verification hash.'
          : RH_PULSE_PRODUCT_DESCRIPTION;
  const canonicalUrl = `${base}${route.canonicalPath}`;
  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonicalUrl,
    twitterTitle: title,
    twitterDescription: description,
    twitterCard: 'summary',
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
      } : {})
    }
  };
}
