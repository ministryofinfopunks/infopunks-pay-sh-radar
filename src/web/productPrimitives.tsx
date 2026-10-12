import { PRODUCT_LINKS } from './radarNavigationCatalog';
import { useId, useRef, useState } from 'react';
import { TerminalIcon } from './terminalIcon';
import { radarNetworkForPath } from './bootContext';

export function ProductWayfinding({ current = '/', id }: { current?: string; id?: string }) {
  return <nav id={id} className="product-wayfinding" aria-label="Infopunks product navigation">
    {PRODUCT_LINKS.map(link => <a key={link.href} href={link.href} aria-current={(link.href === '/' ? current === '/' : link.href === '/rh-chain-signal-desk' ? /^(\/4663|\/rh-chain|\/internal\/rh-chain|\/narratives\/robinhood-chain)/.test(current) : link.href === '/receipts' ? /^(\/receipts|\/proof|\/revenue-receipts)/.test(current) : link.href === '/solana' ? radarNetworkForPath(current) === 'solana' && !/^(\/receipts|\/proof|\/revenue-receipts|\/developers)/.test(current) : current.startsWith(link.href)) ? 'page' : undefined}>{link.label}</a>)}
  </nav>;
}
export function ProductHeader({ current = '/', embedded = false }: { current?: string; embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const Header = embedded ? 'div' : 'header';
  return <Header className={`product-header${open ? ' is-open' : ''}`} onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <a className="product-brand" href="/" aria-label="Infopunks Radar home"><TerminalIcon name="skull" /><span>INFOPUNKS<small>RADAR / INTELLIGENCE TERMINAL</small></span></a>
    <button className="product-menu-toggle" ref={toggle} type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><TerminalIcon name={open ? 'close' : 'menu'} /></button>
    <ProductWayfinding current={current} id={id} />
    <span className="product-header-note">ONE RADAR. TWO ECONOMIES. ONE STANDARD OF PROOF.</span>
  </Header>;
}
export function EvidenceScope({ kind }: { kind: 'service' | 'market' }) {
  return <p className="product-evidence-scope" role="note">{kind === 'service'
    ? 'Advisory assessment. Execution requires separate authorization. Subject network and fee settlement are independent.'
    : 'Read-only market inspection. Verified existence does not establish trade suitability. Trading authorization is unavailable.'}</p>;
}

export function ProductFooter() {
  return <footer className="radar-home-footer"><a href="/">INFOPUNKS RADAR <span>// THE INTELLIGENCE TERMINAL</span></a><span>ONE RADAR. TWO ECONOMIES. ONE STANDARD OF PROOF.</span><a href="/openapi.json">API CONTRACT <TerminalIcon name="arrow" /></a></footer>;
}
