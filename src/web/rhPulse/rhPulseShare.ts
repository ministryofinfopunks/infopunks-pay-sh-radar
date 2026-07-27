import type { RhPulseCallOutcome } from '../../shared/rhPulseCalls';
import type { RhPulseShareArtifactType } from '../../shared/rhPulseShareArtifacts';

export type RhPulseShareDescriptor = {
  artifactType: RhPulseShareArtifactType;
  callOutcome: RhPulseCallOutcome | null;
  callOutcomeLabel: string | null;
  winningOutcome: RhPulseCallOutcome | null;
  winningOutcomeLabel: string | null;
  publicCallNumber: number | null;
  windowSequenceNumber: number;
  communityCorrectPercentage: number | null;
  communityTotalVerifiedCalls: number | null;
  canonicalUrl: string;
  landscapePath: string;
  portraitPath: string;
  landscapeFilename: string;
  portraitFilename: string;
  genesis: boolean;
};

export type RhPulseShareEventName =
  | 'rh_pulse_share_card_viewed'
  | 'rh_pulse_share_card_downloaded'
  | 'rh_pulse_x_share_opened'
  | 'rh_pulse_native_share_opened'
  | 'rh_pulse_receipt_link_copied'
  | 'rh_pulse_resolution_shared';

export function buildRhPulseXShareCopy(
  descriptor: RhPulseShareDescriptor,
  includeHashtag = true
) {
  const suffix = includeHashtag ? '\n\n#RHPulse' : '';
  if (descriptor.artifactType === 'correct_call') {
    return `I called the rotation.\n\n${descriptor.callOutcomeLabel}\n\nThe receipt is public.\n\n${descriptor.canonicalUrl}${suffix}`;
  }
  if (descriptor.artifactType === 'incorrect_call') {
    return `My call is still on the record.\n\nMy call: ${descriptor.callOutcomeLabel}\nWinning rotation: ${descriptor.winningOutcomeLabel}\n\n${descriptor.canonicalUrl}${suffix}`;
  }
  if (descriptor.artifactType === 'rotation_result' || descriptor.artifactType === 'no_qualified_rotation') {
    const accuracy = descriptor.communityTotalVerifiedCalls
      ? `\n\n${formatPercentage(descriptor.communityCorrectPercentage ?? 0)} called the rotation.`
      : '';
    return `RH Pulse resolved:\n\n${descriptor.winningOutcomeLabel}${accuracy}\n\n${descriptor.canonicalUrl}${suffix}`;
  }
  if (descriptor.artifactType === 'resolution_delayed') {
    return `RH Pulse resolution is delayed.\n\nNo winner has been published.\n\n${descriptor.canonicalUrl}${suffix}`;
  }
  return `The destination is becoming consensus.\n\nThe route is not.\n\nI’m calling:\n${descriptor.callOutcomeLabel}\n\nMy call is signed and on the record.\n\n${descriptor.canonicalUrl}${suffix}`;
}

export function buildRhPulseXIntentUrl(
  descriptor: RhPulseShareDescriptor,
  includeHashtag = true
) {
  const intent = new URL('https://x.com/intent/post');
  intent.searchParams.set('text', buildRhPulseXShareCopy(descriptor, includeHashtag));
  return intent.toString();
}

export function trackRhPulseShareEvent(
  event: RhPulseShareEventName,
  descriptor: RhPulseShareDescriptor,
  success: 'success' | 'failure' | 'attempt' = 'attempt'
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('infopunks:rh-pulse-share', {
    detail: {
      event,
      artifact_type: descriptor.artifactType,
      call_outcome: descriptor.callOutcome,
      resolution_outcome: descriptor.winningOutcome,
      genesis: descriptor.genesis,
      public_window_sequence: descriptor.windowSequenceNumber,
      viewport_category: window.innerWidth < 600 ? 'mobile' : 'desktop',
      success
    }
  }));
}

function formatPercentage(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}%`;
}
