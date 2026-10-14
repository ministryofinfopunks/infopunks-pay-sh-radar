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
const LazyDecisionView = lazy(() => import('./intelligentDecisionPage').then(module => ({ default: module.IntelligentDecisionPage })));
const LazyCanonicalReceipt = lazy(() => import('./canonicalReceiptPage'));
const Lazy4663Router = lazy(() => import('./rh4663Router'));
const LazyRadarApp = lazy(() => import('./radarApp'));

export function App() {
  const decision = /^\/radar\/decisions\/([^/]+)\/?$/.exec(window.location.pathname);
  if (decision || window.location.pathname === '/radar/intelligent-ui') {
    let id: string | null = null;
    try { id = decision ? decodeURIComponent(decision[1]) : null; } catch { /* Keep local authenticated lookup available for a malformed identifier. */ }
    return <RadarAppShell><Suspense fallback={<main role="status">Opening private Decision View…</main>}><LazyDecisionView id={id} /></Suspense></RadarAppShell>;
  }
  const receipt = typeof window !== 'undefined' ? /^\/proof\/(observation|judgment|execution|evaluation)\/([^/]+)\/?$/.exec(window.location.pathname) : null;
  if (receipt) {
    try { decodeURIComponent(receipt[2]); } catch { return <RadarAppShell><main><h1>Receipt address is invalid.</h1><a href="/receipts">Return to proof archive ↗</a></main></RadarAppShell>; }
  }
  if (receipt) return <RadarAppShell><Suspense fallback={<main role="status">Opening authenticated receipt…</main>}><LazyCanonicalReceipt kind={receipt[1] as 'observation' | 'judgment' | 'execution' | 'evaluation'} id={decodeURIComponent(receipt[2])} /></Suspense></RadarAppShell>;
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <RadarAppShell><UniversalHomepage /></RadarAppShell>;
  if (typeof window !== 'undefined' && /^\/spend-terminal\/?$/.test(window.location.pathname)) return <RadarAppShell><Suspense fallback={<main role="status">Opening Spend Check…</main>}><LazySpendTerminal /></Suspense></RadarAppShell>;
  if (window.location.pathname === '/4663' || window.location.pathname.startsWith('/4663/')) return <RadarAppShell><Suspense fallback={<main role="status">Opening Robinhood intelligence…</main>}><Lazy4663Router /></Suspense></RadarAppShell>;
  return <RadarAppShell><Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar surface…</main>}><LazyRadarApp /></Suspense></RadarAppShell>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
