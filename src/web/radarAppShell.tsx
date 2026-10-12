import React, { useEffect } from 'react';
import { RadarProductNavigation } from './radarNetworks';
import { RadarShellContext } from './radarShellContext';
import { radarNetworkForPath } from './bootContext';
import { radarPageIdentity, radarPageLabel } from './radarPageIdentity';
import { RadarSectionHeader, RadarReceiptLifecycle } from './radarDesignSystem';
import { ProductHeader, ProductFooter } from './productPrimitives';
import { AppErrorBoundary } from './appErrorBoundary';

export function RadarAppShell({ children, path = typeof window === 'undefined' ? '/' : window.location.pathname }: { children: React.ReactNode; path?: string }) {
  const identity = radarPageIdentity(path);
  const context = path.startsWith('/4663') ? 'robinhood-chain' : radarNetworkForPath(path);
  const home = path === '/';
  useEffect(() => { document.title = `${identity.title} / ${radarPageLabel(path)} · Infopunks Radar`; }, [identity.title, path]);
  return <RadarShellContext.Provider value={true}><div className="radar-app-shell" data-radar-family={identity.index} data-radar-home={home ? '' : undefined}>
    <a className="radar-app-skip" href="#radar-page-content">Skip to content</a>
    <div className="radar-app-header"><ProductHeader current={path} /></div>
    {!home && <details className="radar-specialized-nav"><summary>{context === 'robinhood-chain' ? 'Robinhood Chain' : context === 'solana' ? 'Solana' : 'Radar'} / destinations and network context</summary><div className="radar-app-header"><RadarProductNavigation context={context} current={path} shellOwner /></div></details>}
    {!home && <div className="radar-page-heading">
      <nav className="radar-breadcrumbs" aria-label="Breadcrumb"><a href="/">Radar</a><span aria-hidden="true">/</span><a href={context === 'robinhood-chain' ? '/rh-chain-signal-desk' : '/solana'}>{context === 'robinhood-chain' ? 'Robinhood Chain' : 'Solana'}</a><span aria-hidden="true">/</span><span aria-current="page">{radarPageLabel(path)}</span></nav>
      <RadarSectionHeader {...identity} level="label" />
    </div>}
    <div className="radar-route-content" id="radar-page-content" tabIndex={-1}><AppErrorBoundary>{children}</AppErrorBoundary></div>
    {!home && <details className="radar-protocol-reference"><summary>Observation → Judgment → Execution → Evaluation</summary><RadarReceiptLifecycle reference /></details>}
    <ProductFooter />
  </div></RadarShellContext.Provider>;
}
