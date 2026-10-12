import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { UniversalHomepage } from './homepage';
import { installDevelopmentPerformanceSummary, markHtmlShellReady } from './performanceSummary';
import './radarTokens.css';
import './radarDesignSystem.css';
import './homepage.css';
import { RadarAppShell } from './radarAppShell';
import { RadarAsyncState } from './radarDesignSystem';

const LazyRadarApp = lazy(() => import('./radarApp'));
const LazySpendTerminal = lazy(() => import('./spendTerminalEntry'));

export function App() {
  if (typeof window !== 'undefined' && /^\/$/.test(window.location.pathname)) return <RadarAppShell><UniversalHomepage /></RadarAppShell>;
  const Surface = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/spend-terminal' ? LazySpendTerminal : LazyRadarApp;
  return <RadarAppShell><Suspense fallback={<main><RadarAsyncState kind="loading" title="Opening Radar surface…" /></main>}><Surface /></Suspense></RadarAppShell>;
}

markHtmlShellReady();
installDevelopmentPerformanceSummary();
const rootElement = typeof document === 'undefined' ? null : document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
