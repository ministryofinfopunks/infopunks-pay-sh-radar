import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { AppErrorBoundary } from './appErrorBoundary';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './homepage.css';
import './radarTokens.css';
import './radarDesignSystem.css';
import { RadarAppShell } from './radarAppShell';
import { RadarAsyncState } from './radarDesignSystem';

const LazyRadarApp = lazy(() => import('./radarApp'));

export function App() {
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <RadarAppShell><UniversalHomepage /></RadarAppShell>;
  return <RadarAppShell><Suspense fallback={<main><RadarAsyncState kind="loading" title="Opening Radar surface…" /></main>}><LazyRadarApp /></Suspense></RadarAppShell>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
