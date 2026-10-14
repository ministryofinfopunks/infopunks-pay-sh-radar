import React, { lazy, Suspense } from 'react';
import { RadarAsyncState } from './radarDesignSystem';
import './styles.css';

const Readers = lazy(() => import('./rh4663Pages').then(module => ({ default: module.Rh4663Page })));
const Reflexive = lazy(() => import('./rhChainReflexiveRadarPage').then(module => ({ default: module.ReflexiveRadarPage })));
const Pltr = lazy(() => import('./ipxPltrPreflightLabPage').then(module => ({ default: module.IpxPltrPreflightLabPage })));

/** Existing read-only family boundary; never falls through to another economy. */
export default function Rh4663Router() {
  const path = window.location.pathname;
  let page: React.ReactNode;
  if (/^\/4663\/reflexive\/preflight\/ipx-pltr\/?$/.test(path)) page = <Pltr />;
  else if (/^\/4663\/reflexive(?:\/(?:pair\/[^/]+|stock\/[^/]+|watch(?:\/[^/]+)?|census))?\/?$/.test(path)) page = <Reflexive />;
  else if (/^\/4663(?:\/(?:pulse|today|signals|receipts)|\/(?:print|call|resolution|consensus|signals|proof|campaign|share)\/[^/]+)?\/?$/.test(path)) page = <Readers />;
  else page = <main className="shell"><h1>Robinhood evidence unavailable</h1><RadarAsyncState kind="unavailable" title="This destination is unsupported."><a href="/4663">Return to Robinhood research ↗</a></RadarAsyncState></main>;
  return <Suspense fallback={<main className="shell" role="status"><h1>Opening Robinhood intelligence…</h1></main>}>{page}</Suspense>;
}
