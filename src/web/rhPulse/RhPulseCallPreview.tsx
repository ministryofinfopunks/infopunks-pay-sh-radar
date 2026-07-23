import type { RhPulseCallOption } from './rhPulseTypes';

export function RhPulseCallPreview({
  selected,
  callsEnabled,
  acceptingCalls,
  onSign
}: {
  selected: RhPulseCallOption;
  callsEnabled: boolean;
  acceptingCalls: boolean;
  onSign: () => void;
}) {
  return <aside className="rh-pulse-call-preview" aria-label="Selected call preview">
    <div className="rh-pulse-call-preview-copy">
      <span>YOUR CALL / PRESERVED</span>
      <strong>{selected.label}</strong>
    </div>
    <button
      type="button"
      disabled={!callsEnabled || !acceptingCalls}
      onClick={onSign}
    >
      {callsEnabled && acceptingCalls ? 'Sign My Call' : callsEnabled ? 'Call window not open' : 'Call window opening soon'}
    </button>
  </aside>;
}
