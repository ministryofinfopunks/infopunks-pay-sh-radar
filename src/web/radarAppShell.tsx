import React, { useEffect } from 'react';
import { RadarProductNavigation } from './radarNetworks';
import { RadarShellContext } from './radarShellContext';
import { radarNetworkForPath } from './bootContext';
import { radarPageIdentity, radarPageLabel } from './radarPageIdentity';
import { RadarSectionHeader } from './radarDesignSystem';

export function RadarAppShell({ children, path = typeof window === 'undefined' ? '/' : window.location.pathname }: { children: React.ReactNode; path?: string }) {
  const identity = radarPageIdentity(path);
  const context = path.startsWith('/4663') ? 'robinhood-chain' : radarNetworkForPath(path);
  useEffect(() => { document.title = `${identity.title} / ${radarPageLabel(path)} · Infopunks Radar`; }, [identity.title, path]);
  return <RadarShellContext.Provider value={true}><div className="radar-app-shell" data-radar-family={identity.index}>
    <a className="radar-app-skip" href="#radar-page-content">Skip to content</a>
    <header className="radar-app-header"><RadarProductNavigation context={context} current={path} shellOwner /></header>
    <div className="radar-page-heading">
      {path !== '/' && <nav className="radar-breadcrumbs" aria-label="Breadcrumb"><a href="/">Radar</a><span aria-hidden="true">/</span><a href={context === 'robinhood-chain' ? '/4663' : '/solana'}>{context === 'robinhood-chain' ? 'Robinhood Chain' : 'Solana'}</a><span aria-hidden="true">/</span><span aria-current="page">{radarPageLabel(path)}</span></nav>}
      <RadarSectionHeader {...identity} level="label" />
    </div>
    <div className="radar-route-content" id="radar-page-content" tabIndex={-1}>{children}</div>
    <footer className="radar-app-footer"><strong>NO RECEIPT. NO TRUST.</strong><span>Intelligence before action. Proof after execution.</span><a href="/developers">Documentation</a><a href="/openapi.json">OpenAPI</a></footer>
  </div></RadarShellContext.Provider>;
}
