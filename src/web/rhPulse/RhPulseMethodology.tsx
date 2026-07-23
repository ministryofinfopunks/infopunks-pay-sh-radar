import type { RhPulseMethodology as RhPulseMethodologyModel, RhPulseSourceHealth } from '../../shared/rhPulse';

const DEFINITION_LABELS = {
  verified: 'Verified overlap',
  activity_coupling: 'Activity coupling',
  narrative: 'Narrative movement',
  insufficient_evidence: 'Insufficient evidence'
} as const;

export function RhPulseMethodology({
  methodology,
  sourceHealth,
  expanded = false
}: {
  methodology: RhPulseMethodologyModel;
  sourceHealth: RhPulseSourceHealth;
  expanded?: boolean;
}) {
  return <section className="rh-pulse-section rh-pulse-methodology" aria-labelledby="rh-pulse-methodology-title">
    <details open={expanded}>
      <summary>
        <span>
          <span className="rh-pulse-kicker">Methodology {methodology.version}</span>
          <strong id="rh-pulse-methodology-title">How RH Pulse separates signal from story.</strong>
        </span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="rh-pulse-methodology-body">
        <div className="rh-pulse-methodology-grid">
          <article>
            <h3>Layers</h3>
            {Object.entries(methodology.layer_definitions).map(([id, definition]) => <p key={id}>
              <strong>{id}</strong>
              <span>{definition}</span>
            </p>)}
          </article>
          <article>
            <h3>Evidence</h3>
            {Object.entries(methodology.evidence_definitions).map(([id, definition]) => <p key={id}>
              <strong>{DEFINITION_LABELS[id as keyof typeof DEFINITION_LABELS]}</strong>
              <span>{definition}</span>
            </p>)}
          </article>
          <article>
            <h3>Freshness</h3>
            {Object.entries(methodology.freshness_definitions).map(([id, definition]) => <p key={id}>
              <strong>{id}</strong>
              <span>{definition}</span>
            </p>)}
          </article>
          <article>
            <h3>Confidence</h3>
            {Object.entries(methodology.confidence_definitions).map(([id, definition]) => <p key={id}>
              <strong>{id}</strong>
              <span>{definition}</span>
            </p>)}
          </article>
        </div>

        <div className="rh-pulse-methodology-doctrine">
          <p><strong>Why Agents ↔ RWAs is under watch</strong><span>{methodology.under_watch_policy}</span></p>
          <p><strong>Measured strength</strong><span>{methodology.strength_policy}</span></p>
          <p><strong>Correlation boundary</strong><span>{methodology.correlation_warning}</span></p>
        </div>

        <div className="rh-pulse-methodology-doctrine" aria-label="Rotation resolution methodology">
          <p><strong>Resolution weights</strong><span>Every directional candidate uses 40% reviewed cross-layer evidence, 35% market-activity acceleration and 25% narrative momentum.</span></p>
          <p><strong>Qualification</strong><span>A direction needs at least 60 points, a five-point lead, Medium confidence, acceptable critical-source health and qualified cross-layer evidence.</span></p>
          <p><strong>No Qualified Rotation</strong><span>A valid market result used only when evidence is complete and healthy but no direction qualifies or separates. It does not mean nothing happened.</span></p>
          <p><strong>Unable to Resolve</strong><span>A system state caused by missing, stale or inconsistent critical evidence. It publishes no winner and never makes No Qualified Rotation correct.</span></p>
          <p><strong>Observation tolerances</strong><span>Baseline observations must fall from 15 minutes before to five minutes after open. Closing observations must fall from five minutes before to 15 minutes after close.</span></p>
          <p><strong>Approval boundary</strong><span>Calculation produces a reviewable draft. A separate approval is required before an immutable Rotation Receipt can be published.</span></p>
        </div>

        <div className="rh-pulse-source-health" aria-labelledby="rh-pulse-source-health-title">
          <div className="rh-pulse-source-health-heading">
            <h3 id="rh-pulse-source-health-title">Source health</h3>
            <span className={`rh-pulse-source-health-overall rh-pulse-freshness-${sourceHealth.overall}`}>{sourceHealth.overall}</span>
          </div>
          <div className="rh-pulse-source-health-list">
            {sourceHealth.items.map((item) => <article key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span className={`rh-pulse-state-dot rh-pulse-state-dot-${item.freshness}`}>{item.freshness}</span>
              </div>
              <p>{item.detail}</p>
              {item.observed_at && <time dateTime={item.observed_at}>{new Date(item.observed_at).toLocaleString('en', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</time>}
            </article>)}
          </div>
        </div>

        <p className="rh-pulse-methodology-disclaimer">{methodology.disclaimer}</p>
      </div>
    </details>
  </section>;
}
