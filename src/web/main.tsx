import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { AppErrorBoundary } from './appErrorBoundary';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './radarTokens.css';
import './radarDesignSystem.css';
import './homepage.css';
import { RadarAppShell } from './radarAppShell';

const LazySpendTerminal = lazy(() => import('./spendTerminalPage').then(module => ({ default: module.SpendTerminalPage })));
const LazyCanonicalReceipt = lazy(() => import('./canonicalReceiptPage'));
const LazyRadarApp = lazy(() => import('./radarApp'));

export function App() {
  const receipt = typeof window !== 'undefined' ? /^\/proof\/(observation|judgment|execution|evaluation)\/([^/]+)\/?$/.exec(window.location.pathname) : null;
  if (receipt) return <RadarAppShell><Suspense fallback={<main role="status">Opening authenticated receipt…</main>}><LazyCanonicalReceipt kind={receipt[1] as 'observation' | 'judgment' | 'execution' | 'evaluation'} id={decodeURIComponent(receipt[2])} /></Suspense></RadarAppShell>;
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <RadarAppShell><UniversalHomepage /></RadarAppShell>;
  if (typeof window !== 'undefined' && /^\/spend-terminal\/?$/.test(window.location.pathname)) return <RadarAppShell><Suspense fallback={<main role="status">Opening Spend Check…</main>}><LazySpendTerminal /></Suspense></RadarAppShell>;
  return <RadarAppShell><Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar surface…</main>}><LazyRadarApp /></Suspense></RadarAppShell>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
