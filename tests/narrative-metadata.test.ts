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
      description: 'A living Narrative Asset Intelligence report on $ANSEM evolving from persona attention into community coordination.',
      canonicalPath: '/signals/black-bull',
      ogTitle: 'Infopunks Signal Report: $ANSEM / The Black Bull',
      ogDescription: 'A living Narrative Asset Intelligence report on $ANSEM evolving from persona attention into community coordination.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Signal Report: $ANSEM / The Black Bull',
      twitterDescription: 'A living Narrative Asset Intelligence report on $ANSEM evolving from persona attention into community coordination.',
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
    expect(getNarrativeMetadataForPath('/signals/black-bull/updates/seu_black_bull_007')).toEqual({
      title: 'Infopunks Desk Dispatch: Coordination Market Emerging',
      description: 'Black Bull signal update. Persona attention is evolving into community coordination.',
      canonicalPath: '/signals/black-bull/updates/seu_black_bull_007',
      ogTitle: 'Infopunks Desk Dispatch: Coordination Market Emerging',
      ogDescription: 'Black Bull signal update. Persona attention is evolving into community coordination.',
      ogImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_007.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Desk Dispatch: Coordination Market Emerging',
      twitterDescription: 'Black Bull signal update. Persona attention is evolving into community coordination.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_007.png',
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

  it('returns production metadata for /unicorn-radar', () => {
    expect(getNarrativeMetadataForPath('/unicorn-radar')).toEqual({
      title: 'Infopunks Unicorn Radar',
      description: 'Finding serious low-cap Solana projects before consensus does.',
      canonicalPath: '/unicorn-radar',
      ogTitle: 'Infopunks Unicorn Radar',
      ogDescription: 'Finding serious low-cap Solana projects before consensus does.',
      ogImageUrl: 'https://radar.infopunks.fun/og/unicorn-radar.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Unicorn Radar',
      twitterDescription: 'Finding serious low-cap Solana projects before consensus does.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/unicorn-radar.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for /evaluation-request', () => {
    expect(getNarrativeMetadataForPath('/evaluation-request')).toEqual({
      title: 'Request an Infopunks Evaluation',
      description: 'Submit receipts for paid evaluation. Payment buys evaluation, not conviction.',
      canonicalPath: '/evaluation-request',
      ogTitle: 'Request an Infopunks Evaluation',
      ogDescription: 'Submit receipts for paid evaluation. Payment buys evaluation, not conviction.',
      ogImageUrl: 'https://radar.infopunks.fun/og/evaluation-request.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Request an Infopunks Evaluation',
      twitterDescription: 'Submit receipts for paid evaluation. Payment buys evaluation, not conviction.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/evaluation-request.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns candidate metadata for Unicorn Radar detail pages', () => {
    expect(getNarrativeMetadataForPath('/unicorn-radar/ur_ai_rig_complex')).toEqual({
      title: 'Infopunks Unicorn Radar: AI Rig Complex / ARC',
      description: 'AI Rig Complex (ARC) is an AI / Agent Rails candidate on Infopunks Unicorn Radar, currently marked watchlist with verdict real_product_weak_attention.',
      canonicalPath: '/unicorn-radar/ur_ai_rig_complex',
      ogTitle: 'Infopunks Unicorn Radar: AI Rig Complex / ARC',
      ogDescription: 'AI Rig Complex (ARC) is an AI / Agent Rails candidate on Infopunks Unicorn Radar, currently marked watchlist with verdict real_product_weak_attention.',
      ogImageUrl: 'https://radar.infopunks.fun/og/unicorn-radar/ur_ai_rig_complex.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Unicorn Radar: AI Rig Complex / ARC',
      twitterDescription: 'AI Rig Complex (ARC) is an AI / Agent Rails candidate on Infopunks Unicorn Radar, currently marked watchlist with verdict real_product_weak_attention.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/unicorn-radar/ur_ai_rig_complex.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns metadata for /revenue-receipts', () => {
    expect(getNarrativeMetadataForPath('/revenue-receipts')).toEqual({
      title: 'Infopunks Revenue Receipts',
      description: 'Public ledger for paid evaluations, bounties, listings, reports, studio work, and API access.',
      canonicalPath: '/revenue-receipts',
      ogTitle: 'Infopunks Revenue Receipts',
      ogDescription: 'Public ledger for paid evaluations, bounties, listings, reports, studio work, and API access.',
      ogImageUrl: 'https://radar.infopunks.fun/og/revenue-receipts.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Revenue Receipts',
      twitterDescription: 'Public ledger for paid evaluations, bounties, listings, reports, studio work, and API access.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/revenue-receipts.png',
      twitterCard: 'summary_large_image'
    });
  });

  it('returns detail metadata for Revenue Receipt pages', () => {
    expect(getNarrativeMetadataForPath('/revenue-receipts/rr_open_evaluation_slot')).toEqual({
      title: 'Infopunks Revenue Receipt: Open Slot / Open Unicorn Radar Evaluation Slot',
      description: 'Public receipt for Open, sponsored_radar_evaluation, USD 100, with disclosure and independence statement.',
      canonicalPath: '/revenue-receipts/rr_open_evaluation_slot',
      ogTitle: 'Infopunks Revenue Receipt: Open Slot / Open Unicorn Radar Evaluation Slot',
      ogDescription: 'Public receipt for Open, sponsored_radar_evaluation, USD 100, with disclosure and independence statement.',
      ogImageUrl: 'https://radar.infopunks.fun/og/revenue-receipts/rr_open_evaluation_slot.png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      twitterTitle: 'Infopunks Revenue Receipt: Open Slot / Open Unicorn Radar Evaluation Slot',
      twitterDescription: 'Public receipt for Open, sponsored_radar_evaluation, USD 100, with disclosure and independence statement.',
      twitterImageUrl: 'https://radar.infopunks.fun/og/revenue-receipts/rr_open_evaluation_slot.png',
      twitterCard: 'summary_large_image'
    });
  });
});
