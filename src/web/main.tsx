import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { AppErrorBoundary } from './appErrorBoundary';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './homepage.css';

const LazySpendTerminal = lazy(() => import('./spendTerminalPage').then(module => ({ default: module.SpendTerminalPage })));
const LazyRadarApp = lazy(() => import('./radarApp'));

export function App() {
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <UniversalHomepage />;
  if (typeof window !== 'undefined' && /^\/spend-terminal\/?$/.test(window.location.pathname)) return <Suspense fallback={<main role="status">Opening Spend Check…</main>}><LazySpendTerminal /></Suspense>;
  return <Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar surface…</main>}><LazyRadarApp /></Suspense>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
