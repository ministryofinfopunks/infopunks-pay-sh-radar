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

  it('returns metadata for /narratives/attention-market-watch', () => {
    expect(getNarrativeMetadataForPath('/narratives/attention-market-watch')).toEqual({
      title: 'Infopunks Attention Market Watch',
      description: 'Classification engine for persona-backed markets, influencer coins, receipts, control risk, and narrative coherence.',
      canonicalPath: '/narratives/attention-market-watch',
      ogTitle: 'Infopunks Attention Market Watch',
      ogDescription: 'Classification engine for persona-backed markets, influencer coins, receipts, control risk, and narrative coherence.',
      ogImageUrl: 'https://radar.infopunks.fun/og/attention-market-watch.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Attention Market Watch',
      twitterDescription: 'Classification engine for persona-backed markets, influencer coins, receipts, control risk, and narrative coherence.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/attention-market-watch.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for /attention-market-watch/ansem', () => {
    expect(getNarrativeMetadataForPath('/attention-market-watch/ansem')).toEqual({
      title: 'Infopunks Attention Market Watch: $ANSEM',
      description: 'Attention market classification for $ANSEM, including source, control risk, coherence, receipts, fragmentation, and verdict.',
      canonicalPath: '/attention-market-watch/ansem',
      ogTitle: 'Infopunks Attention Market Watch: $ANSEM',
      ogDescription: 'Attention market classification for $ANSEM, including source, control risk, coherence, receipts, fragmentation, and verdict.',
      ogImageUrl: 'https://radar.infopunks.fun/og/attention-market-watch/ansem.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Attention Market Watch: $ANSEM',
      twitterDescription: 'Attention market classification for $ANSEM, including source, control risk, coherence, receipts, fragmentation, and verdict.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/attention-market-watch/ansem.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for /signals/troll', () => {
    expect(getNarrativeMetadataForPath('/signals/troll')).toEqual({
      title: 'Infopunks Signal Report: $TROLL / The Re-Indexed Archetype',
      description: 'A Narrative Asset Intelligence report on old internet culture reactivated as a Solana-native community asset.',
      canonicalPath: '/signals/troll',
      ogTitle: 'Infopunks Signal Report: $TROLL / The Re-Indexed Archetype',
      ogDescription: 'A Narrative Asset Intelligence report on old internet culture reactivated as a Solana-native community asset.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/troll.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Signal Report: $TROLL / The Re-Indexed Archetype',
      twitterDescription: 'A Narrative Asset Intelligence report on old internet culture reactivated as a Solana-native community asset.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/signals/troll.png',
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

  it('returns metadata for the TROLL dispatch permalink', () => {
    expect(getNarrativeMetadataForPath('/signals/troll/updates/seu_troll_002')).toEqual({
      title: 'Infopunks Desk Dispatch: Durable Re-index',
      description: 'The Re-Indexed Archetype signal update. The signal is not novelty. The signal is survival.',
      canonicalPath: '/signals/troll/updates/seu_troll_002',
      ogTitle: 'Infopunks Desk Dispatch: Durable Re-index',
      ogDescription: 'The Re-Indexed Archetype signal update. The signal is not novelty. The signal is survival.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/troll/updates/seu_troll_002.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Desk Dispatch: Durable Re-index',
      twitterDescription: 'The Re-Indexed Archetype signal update. The signal is not novelty. The signal is survival.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/signals/troll/updates/seu_troll_002.png',
      twitterCard: 'summary_large_image'
    });
  });
});
