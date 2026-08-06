import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { AppErrorBoundary } from './appErrorBoundary';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './homepage.css';

const LazyRadarApp = lazy(() => import('./radarApp'));

export function App() {
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <UniversalHomepage />;
  return <Suspense fallback={<main className="radar-route-loading" role="status" aria-live="polite">Opening Radar surface…</main>}><LazyRadarApp /></Suspense>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
