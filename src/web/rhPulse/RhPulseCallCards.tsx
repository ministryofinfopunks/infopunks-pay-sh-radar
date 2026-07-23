import type { RhPulseCallOption } from './rhPulseTypes';

export function RhPulseCallCards({
  options,
  selectedId,
  onSelect
}: {
  options: RhPulseCallOption[];
  selectedId: RhPulseCallOption['id'] | null;
  onSelect: (id: RhPulseCallOption['id']) => void;
}) {
  return <section className="rh-pulse-section rh-pulse-call-section" aria-labelledby="rh-pulse-call-title">
    <div className="rh-pulse-section-heading">
      <p className="rh-pulse-kicker">Call the Rotation</p>
      <h2 id="rh-pulse-call-title">What leads the next twenty-four hours?</h2>
      <p>Select a thesis locally. Every option carries equal interaction weight; no answer is preselected.</p>
    </div>
    <div className="rh-pulse-call-grid" role="radiogroup" aria-label="RH Pulse call options">
      {options.map((option, index) => {
        const selected = selectedId === option.id;
        return <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          className={`rh-pulse-call-card${selected ? ' is-selected' : ''}`}
          onClick={() => onSelect(option.id)}
        >
          <span className="rh-pulse-call-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="rh-pulse-call-card-copy">
            <span className="rh-pulse-call-card-topline">
              <strong>{option.label}</strong>
              {option.under_watch && <span>UNDER WATCH</span>}
            </span>
            <span className="rh-pulse-call-thesis">{option.thesis}</span>
            <span className="rh-pulse-call-observations">
              {option.supporting_observations.map((observation) => <span key={observation}>{observation}</span>)}
            </span>
          </span>
          <span className="rh-pulse-call-selector" aria-hidden="true">
            <span />
          </span>
        </button>;
      })}
    </div>
  </section>;
}
