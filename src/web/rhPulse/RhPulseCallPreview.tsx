import type { RhPulseCallOption } from './rhPulseTypes';

export function RhPulseCallPreview({
  selected,
  onMakePublic
}: {
  selected: RhPulseCallOption;
  onMakePublic: () => void;
}) {
  return <aside className="rh-pulse-call-preview" aria-label="Selected call preview">
    <div className="rh-pulse-call-preview-copy">
      <span>YOUR CALL</span>
      <strong>{selected.label}</strong>
      <small>Saved privately on this device.<br />Not published. No wallet connected.</small>
    </div>
    <button
      type="button"
      onClick={onMakePublic}
    >
      Make This Public
    </button>
  </aside>;
}
