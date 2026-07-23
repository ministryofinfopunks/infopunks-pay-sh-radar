import { useEffect, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import {
  buildRhPulseXIntentUrl,
  buildRhPulseXShareCopy,
  trackRhPulseShareEvent,
  type RhPulseShareDescriptor
} from './rhPulseShare';

export function RhPulseShareActions({
  descriptor,
  resolvedCorrect = false,
  resolvedIncorrect = false,
  resolution = false
}: {
  descriptor: RhPulseShareDescriptor;
  resolvedCorrect?: boolean;
  resolvedIncorrect?: boolean;
  resolution?: boolean;
}) {
  const [status, setStatus] = useState('Sharing requires an explicit action.');
  const landscapeUrl = toApiUrl(getApiBaseUrl(), descriptor.landscapePath);
  const portraitUrl = toApiUrl(getApiBaseUrl(), descriptor.portraitPath);
  const xLabel = resolvedCorrect
    ? 'Post “I Called It” to X'
    : resolution
      ? 'Post Result to X'
      : resolvedIncorrect
        ? 'Share Resolved Call on X'
        : 'Post to X';

  useEffect(() => {
    trackRhPulseShareEvent('rh_pulse_share_card_viewed', descriptor, 'success');
  }, [descriptor.artifactType, descriptor.canonicalUrl]);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(descriptor.canonicalUrl);
      trackRhPulseShareEvent('rh_pulse_receipt_link_copied', descriptor, 'success');
      setStatus(resolution ? 'Resolution link copied.' : 'Receipt link copied.');
    } catch {
      trackRhPulseShareEvent('rh_pulse_receipt_link_copied', descriptor, 'failure');
      setStatus('Clipboard access is unavailable. Open the public link to copy it.');
    }
  };

  const nativeShare = async () => {
    const shareData: ShareData = {
      title: shareTitle(descriptor),
      text: buildRhPulseXShareCopy(descriptor, false),
      url: descriptor.canonicalUrl
    };
    if (!navigator.share) {
      setStatus('Native sharing is unavailable. Use Post to X or copy the receipt link.');
      trackRhPulseShareEvent('rh_pulse_native_share_opened', descriptor, 'failure');
      return;
    }
    try {
      const response = await fetch(portraitUrl, { headers: { Accept: 'image/png' } });
      if (response.ok) {
        const file = new File([await response.blob()], descriptor.portraitFilename, {
          type: 'image/png'
        });
        if (navigator.canShare?.({ files: [file] })) shareData.files = [file];
      }
    } catch {
      // Text and the canonical URL remain shareable when artifact rendering is unavailable.
    }
    try {
      await navigator.share(shareData);
      trackRhPulseShareEvent('rh_pulse_native_share_opened', descriptor, 'success');
      if (resolution) trackRhPulseShareEvent('rh_pulse_resolution_shared', descriptor, 'success');
      setStatus(shareData.files ? 'Native share sheet opened with the card.' : 'Native share sheet opened.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('Share cancelled. Your receipt remains available.');
      } else {
        trackRhPulseShareEvent('rh_pulse_native_share_opened', descriptor, 'failure');
        setStatus('Native sharing did not open. Use Post to X or copy the receipt link.');
      }
    }
  };

  const download = (format: 'landscape' | 'portrait') => {
    trackRhPulseShareEvent('rh_pulse_share_card_downloaded', descriptor, 'attempt');
    setStatus(`${format === 'portrait' ? 'Portrait' : 'Landscape'} card download requested.`);
  };

  return <section className="rh-pulse-share-actions" aria-labelledby="rh-pulse-share-actions-title">
    <div>
      <p className="rh-pulse-kicker">PUBLIC ARTIFACT</p>
      <h2 id="rh-pulse-share-actions-title">Carry the receipt.</h2>
      <p>Every claim on the card comes from the immutable public record.</p>
    </div>
    <div className="rh-pulse-share-action-grid" role="group" aria-label="Share RH Pulse receipt">
      <a
        className="rh-pulse-share-primary"
        href={buildRhPulseXIntentUrl(descriptor)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackRhPulseShareEvent('rh_pulse_x_share_opened', descriptor, 'attempt');
          setStatus('X opened with editable receipt copy.');
        }}
      >{xLabel}</a>
      <button type="button" onClick={() => void nativeShare()}>Share</button>
      <a
        href={landscapeUrl}
        download={descriptor.landscapeFilename}
        onClick={() => download('landscape')}
      >{resolvedCorrect ? 'Save Called It Card' : resolution ? 'Save Rotation Receipt' : 'Save Card'}</a>
      <button type="button" onClick={() => void copyLink()}>
        {resolution ? 'Copy Resolution Link' : 'Copy Receipt Link'}
      </button>
    </div>
    <details>
      <summary>Card formats</summary>
      <div className="rh-pulse-share-downloads">
        <a href={landscapeUrl} download={descriptor.landscapeFilename} onClick={() => download('landscape')}>
          Save Landscape Card · 1200 × 630
        </a>
        <a href={portraitUrl} download={descriptor.portraitFilename} onClick={() => download('portrait')}>
          Save Portrait Card · 1080 × 1350
        </a>
      </div>
    </details>
    <p className="rh-pulse-share-status" role="status" aria-live="polite">{status}</p>
  </section>;
}

function shareTitle(descriptor: RhPulseShareDescriptor) {
  if (descriptor.artifactType === 'correct_call') return `I Called ${descriptor.callOutcomeLabel} | RH Pulse`;
  if (descriptor.artifactType === 'incorrect_call') return `Call Resolved | RH Pulse`;
  if (descriptor.artifactType === 'rotation_result' || descriptor.artifactType === 'no_qualified_rotation') {
    return `${descriptor.winningOutcomeLabel} | RH Pulse`;
  }
  if (descriptor.artifactType === 'resolution_delayed') return 'Resolution Delayed | RH Pulse';
  return `${descriptor.callOutcomeLabel} | RH Pulse Call`;
}
