import type { RhPulseReadModel } from '../../shared/rhPulse';

export function RhPulseStructureStrip({
  statements
}: {
  statements: RhPulseReadModel['structural_statements'];
}) {
  return <section className="rh-pulse-section rh-pulse-structure" aria-labelledby="rh-pulse-structure-title">
    <div className="rh-pulse-section-heading">
      <p className="rh-pulse-kicker">Structural readings</p>
      <h2 id="rh-pulse-structure-title">What the reviewed memory can support.</h2>
    </div>
    <div className="rh-pulse-structure-grid">
      {statements.map((statement) => <article key={statement.id} className="rh-pulse-structure-card">
        <div className="rh-pulse-structure-card-topline">
          <span>{statement.label}</span>
          <span className={`rh-pulse-state-dot rh-pulse-state-dot-${statement.freshness}`}>
            {statement.freshness}
          </span>
        </div>
        <h3>{statement.state}</h3>
        <p>{statement.detail}</p>
        <div className="rh-pulse-structure-meta">
          <span>Confidence</span>
          <strong>{statement.confidence}</strong>
        </div>
      </article>)}
    </div>
  </section>;
}
