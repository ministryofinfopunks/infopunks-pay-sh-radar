import React, { useState } from 'react';

export type RhChainPortableCardProps = {
  type: string;
  label: string;
  finding: string;
  caveat: string;
  timestamp: string;
  reference: string;
  deskHref: string;
};

/** A deliberately compact artifact: one finding, one caveat, one receipt reference. */
export function RhChainPortableCard({ type, label, finding, caveat, timestamp, reference, deskHref }: RhChainPortableCardProps) {
  const [copied, setCopied] = useState(false);
  async function copyDeskLink() {
    try {
      await navigator.clipboard.writeText(new URL(deskHref, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <article className="rh-chain-portable-card" aria-label={`${type} share card`}>
    <header><span>INFOPUNKS</span><strong>{type}</strong></header>
    <p className="rh-chain-portable-label">{label}</p>
    <div className="rh-chain-portable-finding"><span>Finding</span><p>{finding}</p></div>
    <div className="rh-chain-portable-caveat"><span>Risk caveat</span><p>{caveat}</p></div>
    <footer><span>{timestamp}</span><span>{reference}</span></footer>
    <div className="rh-chain-portable-actions"><a href={deskHref}>Open desk ↗</a><button type="button" onClick={copyDeskLink}>{copied ? 'Link copied' : 'Copy link'}</button></div>
  </article>;
}
