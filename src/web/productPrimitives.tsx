import { PRODUCT_LINKS } from './productCatalog';

export function ProductWayfinding({ current = '/' }: { current?: string }) {
  return <nav className="product-wayfinding" aria-label="Infopunks product navigation">
    {PRODUCT_LINKS.map(link => <a key={link.href} href={link.href} aria-current={current === link.href ? 'page' : undefined}>{link.label}</a>)}
  </nav>;
}
export function EvidenceScope({ kind }: { kind: 'service' | 'market' }) {
  return <p className="product-evidence-scope" role="note">{kind === 'service'
    ? 'Advisory assessment. Execution requires separate authorization. Subject network and fee settlement are independent.'
    : 'Read-only market inspection. Verified existence does not establish trade suitability. Trading authorization is unavailable.'}</p>;
}
