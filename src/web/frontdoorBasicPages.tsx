import React from 'react';
import {
  AbundanceDeskPage,
  AttentionMarketWatchPage,
  AttentionMarketWatchProfilePage,
  AttentionMarketsPage,
  NarrativeSignalReportPage,
  NarrativesIndexPage,
  SignalSourcePage
} from './narrativePages';

const archivalNotice: React.CSSProperties = {
  margin: '0 auto 18px',
  maxWidth: 1180,
  padding: '10px 14px',
  border: '1px solid rgba(0, 229, 255, .28)',
  borderRadius: 8,
  background: 'rgba(0, 229, 255, .055)',
  color: '#c9f7fb',
  fontSize: 12,
  lineHeight: 1.55
};

function selectedPage(path: string) {
  if (/^\/narratives\/?$/.test(path)) return <NarrativesIndexPage />;
  if (/^\/narratives\/attention-markets\/?$/.test(path)) return <AttentionMarketsPage />;
  if (/^\/(?:narratives\/attention-market-watch|attention-market-watch)\/?$/.test(path)) return <AttentionMarketWatchPage />;
  if (/^\/narratives\/abundance-desk\/?$/.test(path)) return <AbundanceDeskPage narrativeRoute />;
  if (/^\/abundance\/?$/.test(path)) return <AbundanceDeskPage />;
  const attention = path.match(/^\/attention-market-watch\/(ansem|tjr|luke|superman)\/?$/);
  if (attention) return <AttentionMarketWatchProfilePage slug={attention[1]!} />;
  const signal = path.match(/^\/signals\/(ansem|black-bull|troll)\/?$/);
  if (signal?.[1] === 'ansem') return <SignalSourcePage slug={signal[1]} />;
  if (signal) return <NarrativeSignalReportPage slug={signal[1]!} />;
  return <main><h1>Surface unavailable</h1><p>This path is not part of the front-door read-only profile.</p></main>;
}

export function FrontdoorBasicPage({ path }: { path: string }) {
  return <>
    <aside role="note" aria-label="Data availability" style={archivalNotice}>
      ARCHIVE READ · Source material is dated through July 2026. Live market feeds, provider catalog refresh,
      submissions and consequential actions are unavailable in this operating profile.
    </aside>
    {selectedPage(path)}
  </>;
}
