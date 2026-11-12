import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { AppErrorBoundary } from './appErrorBoundary';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './radarTokens.css';
import './radarDesignSystem.css';
import './homepage.css';
import { RadarAppShell } from './radarAppShell';

const LazyRadarApp = lazy(() => import('./radarApp'));
const LazyEconomicOS = lazy(() => import('./economicOSPage').then(module => ({ default: module.EconomicOSPage })));
const LazyFrontdoorBasicPage = lazy(() => import('./frontdoorBasicPages').then(module => ({ default: module.FrontdoorBasicPage })));

const frontdoorBasicPagePath = (path: string) => /^\/(?:narratives|abundance|narratives\/(?:abundance-desk|attention-markets|attention-market-watch)|attention-market-watch(?:\/(?:ansem|tjr|luke|superman))?|signals\/(?:ansem|black-bull|troll))\/?$/.test(path);

export function App() {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  const profile = typeof document === 'undefined' ? 'full-stack' : document.querySelector<HTMLMetaElement>('meta[name="radar-operating-profile"]')?.content ?? 'full-stack';
  if (path === '/') return <RadarAppShell><UniversalHomepage /></RadarAppShell>;
  if (/^\/economic-os(?:\/|$)/.test(path)) return <RadarAppShell><Suspense fallback={<main role="status">Opening Economic OS…</main>}><LazyEconomicOS /></Suspense></RadarAppShell>;
  if (profile === 'frontdoor-only' && frontdoorBasicPagePath(path)) return <RadarAppShell><Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar archive…</main>}><LazyFrontdoorBasicPage path={path} /></Suspense></RadarAppShell>;
  return <RadarAppShell><Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar surface…</main>}><LazyRadarApp /></Suspense></RadarAppShell>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
