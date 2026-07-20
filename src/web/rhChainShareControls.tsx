import React, { useState } from 'react';
import { buildRhChainShareCopy, type RhChainShareObject } from '../shared/rhChainSharing';

type ShareEvent = 'copy_insight' | 'copy_receipt_link' | 'native_share' | 'fallback_share';

/**
 * Privacy-preserving local instrumentation. Consumers may listen for this event;
 * no wallet, reviewer, submitter, evidence, or query-string data is emitted.
 */
export function trackRhChainShareEvent(event: ShareEvent, share: RhChainShareObject) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('infopunks:rh-chain-share', {
    detail: { event, object_type: share.object_type, receipt_id: share.receipt_id, canonical_url: share.canonical_url }
  }));
}

async function copy(value: string) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Small reusable control surface; product pages retain their own editorial layout. */
export function RhChainShareControls({ share, className = '', shareAriaLabel, copyInsightAriaLabel, trailingAction, hideReceiptLink = false }: { share: RhChainShareObject; className?: string; shareAriaLabel?: string; copyInsightAriaLabel?: string; trailingAction?: React.ReactNode; hideReceiptLink?: boolean }) {
  const [feedback, setFeedback] = useState('');
  const shareCopy = buildRhChainShareCopy(share);
  const copyInsight = async () => {
    const copied = await copy(shareCopy);
    if (copied) { trackRhChainShareEvent('copy_insight', share); setFeedback('Insight copied to clipboard.'); }
    else setFeedback('Clipboard access is unavailable. Copy the canonical link instead.');
  };
  const copyReceipt = async () => {
    const copied = await copy(share.canonical_url);
    if (copied) { trackRhChainShareEvent('copy_receipt_link', share); setFeedback('Canonical receipt link copied to clipboard.'); }
    else setFeedback('Clipboard access is unavailable. Open the canonical link to copy it.');
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: share.public_title, text: shareCopy, url: share.canonical_url });
        trackRhChainShareEvent('native_share', share);
        setFeedback('Native share sheet opened.');
        return;
      } catch {
        // Cancellation and unsupported share targets intentionally fall back without an error surface.
      }
    }
    const copied = await copy(shareCopy);
    if (copied) { trackRhChainShareEvent('fallback_share', share); setFeedback('Native share is unavailable; insight copied to clipboard.'); }
    else setFeedback('Native share and clipboard access are unavailable.');
  };
  return <section className={`rh-chain-share-controls ${className}`.trim()} aria-label={`Share ${share.public_title}`}>
    <div className="panel-actions" role="group" aria-label="Share controls">
      <button type="button" className="execute compact" onClick={() => void nativeShare()} aria-label={shareAriaLabel ?? `Share ${share.public_title}`}>Share</button>
      <button type="button" className="execute compact secondary" onClick={() => void copyInsight()} aria-label={copyInsightAriaLabel ?? `Copy insight for ${share.public_title}`}>Copy Insight</button>
      {!hideReceiptLink && <button type="button" className="execute compact secondary" onClick={() => void copyReceipt()} aria-label={`Copy canonical ${share.receipt_id ? 'receipt ' : ''}link`}>{share.receipt_id ? 'Copy Receipt Link' : 'Copy Canonical Link'}</button>}
      {trailingAction}
    </div>
    <p className="sr-only" aria-live="polite" role="status">{feedback}</p>
  </section>;
}

export function RhChainShareSummary({ share }: { share: RhChainShareObject }) {
  return <aside className="panel rh-chain-share-summary" aria-label="Shareable intelligence summary">
    {share.supersession_state === 'superseded' && <p className="rh-chain-disclaimer" role="status"><strong>Superseded receipt.</strong> A correction and replacement are linked below; the original remains public for auditability.</p>}
    <p className="section-kicker">Share record</p>
    <h3>{share.deterministic_headline}</h3>
    <p>{share.principal_finding}</p>
    <dl className="rh-chain-provenance-grid">
      <div><dt>Freshness</dt><dd>{share.freshness.replaceAll('_', ' ')}</dd></div>
      <div><dt>Confidence</dt><dd>{share.confidence}</dd></div>
      <div><dt>Method</dt><dd>{share.methodology_version}</dd></div>
      <div><dt>Sources</dt><dd>{share.source_summary}</dd></div>
      {share.receipt_id && <div><dt>Receipt</dt><dd>{share.receipt_id}</dd></div>}
      {share.integrity_hash && <div><dt>Integrity</dt><dd><code>{share.integrity_hash}</code></dd></div>}
    </dl>
    <p className="rh-chain-disclaimer"><strong>Material caveat:</strong> {share.material_caveat}</p>
    {share.supersession_state === 'superseded' && <p><a href={share.correction_link ?? share.canonical_url}>Correction history</a>{share.replacement_receipt_link && <> · <a href={share.replacement_receipt_link}>Replacement receipt</a></>}</p>}
  </aside>;
}
