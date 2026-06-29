import { getSignalSurfaceBySlug } from '../data/narrativeIntel';
import { getSignalUpdate } from '../data/signalUpdates';
import { narrativeOgImageUrl, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, signalUpdateTypeLabel } from './narrativeOg';

export type NarrativeMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  ogImageWidth: number;
  ogImageHeight: number;
  twitterTitle: string;
  twitterDescription: string;
  twitterImageUrl: string | null;
  twitterCard: 'summary_large_image' | 'summary';
};

export const NARRATIVE_PUBLIC_HOST = 'https://radar.infopunks.fun';

function decodePathPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildMetadata(title: string, description: string, canonicalPath: string): NarrativeMetadata {
  const ogImagePath = narrativeOgImageUrl(canonicalPath);
  const absoluteOgImageUrl = ogImagePath ? `${NARRATIVE_PUBLIC_HOST}${ogImagePath}` : null;
  return {
    title,
    description,
    canonicalPath,
    ogTitle: title,
    ogDescription: description,
    ogImageUrl: absoluteOgImageUrl,
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    twitterTitle: title,
    twitterDescription: description,
    twitterImageUrl: absoluteOgImageUrl,
    twitterCard: 'summary_large_image'
  };
}

export function getNarrativeMetadataForPath(pathname: string): NarrativeMetadata | null {
  if (/^\/narratives\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Narrative Asset Intelligence',
      'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
      '/narratives'
    );
  }

  if (/^\/narratives\/attention-markets\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Attention Markets Thesis',
      'Personas become liquidity, memes become coordination rails, and narratives become markets.',
      '/narratives/attention-markets'
    );
  }

  if (/^\/signals\/ansem\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Source: Ansem',
      'A Narrative Asset Intelligence profile mapping Ansem as a Solana-native signal source.',
      '/signals/ansem'
    );
  }

  if (/^\/signals\/black-bull\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Report: $ANSEM / The Black Bull',
      'A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.',
      '/signals/black-bull'
    );
  }

  const updateMatch = pathname.match(/^\/signals\/([^/]+)\/updates\/([^/]+)\/?$/);
  if (updateMatch) {
    const slug = decodePathPart(updateMatch[1]);
    const updateId = decodePathPart(updateMatch[2]);
    const surface = getSignalSurfaceBySlug(slug);
    const update = getSignalUpdate(slug, updateId);
    if (!surface || !update) return null;
    const signalName = surface.asset ? `${surface.asset.ticker} / ${surface.asset.name}` : surface.title;
    return buildMetadata(
      `Infopunks Desk Dispatch: ${signalUpdateTypeLabel(update.update_type)}`,
      `${signalName} signal update. Reports are not final. Signals mutate.`,
      `/signals/${encodeURIComponent(slug)}/updates/${encodeURIComponent(updateId)}`
    );
  }

  return null;
}
