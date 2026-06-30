import { describe, expect, it } from 'vitest';
import { getNarrativeMetadataForPath } from '../src/shared/narrativeMetadata';

describe('narrative metadata helper', () => {
  it('returns metadata for /narratives', () => {
    expect(getNarrativeMetadataForPath('/narratives')).toEqual({
      title: 'Infopunks Narrative Asset Intelligence',
      description: 'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
      canonicalPath: '/narratives',
      ogTitle: 'Infopunks Narrative Asset Intelligence',
      ogDescription: 'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
      ogImageUrl: 'https://radar.infopunks.fun/og/narratives.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Narrative Asset Intelligence',
      twitterDescription: 'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/narratives.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for /signals/black-bull', () => {
    expect(getNarrativeMetadataForPath('/signals/black-bull')).toEqual({
      title: 'Infopunks Signal Report: $ANSEM / The Black Bull',
      description: 'A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.',
      canonicalPath: '/signals/black-bull',
      ogTitle: 'Infopunks Signal Report: $ANSEM / The Black Bull',
      ogDescription: 'A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Signal Report: $ANSEM / The Black Bull',
      twitterDescription: 'A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for a seeded dispatch permalink', () => {
    expect(getNarrativeMetadataForPath('/signals/black-bull/updates/seu_black_bull_006')).toEqual({
      title: 'Infopunks Desk Dispatch: Verdict Change',
      description: 'ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.',
      canonicalPath: '/signals/black-bull/updates/seu_black_bull_006',
      ogTitle: 'Infopunks Desk Dispatch: Verdict Change',
      ogDescription: 'ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_006.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Desk Dispatch: Verdict Change',
      twitterDescription: 'ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_006.png',
      twitterCard: 'summary_large_image'
    });
  });
});
