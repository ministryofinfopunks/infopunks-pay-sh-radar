import type { RhPulseReadModel } from '../../shared/rhPulse';
import { EMPTY_RH_PULSE_CONNECTIONS, type RhPulseConnectionView } from './rhPulseTypes';

const PATHS: Record<RhPulseConnectionView['id'], string> = {
  memes_to_rwas: 'M 93 188 Q 108 112 164 72',
  agents_to_rwas: 'M 267 188 Q 252 112 196 72',
  memes_to_agents: 'M 104 211 Q 180 242 256 211'
};

const LABEL_POSITIONS: Record<RhPulseConnectionView['id'], { x: number; y: number }> = {
  memes_to_rwas: { x: 102, y: 124 },
  agents_to_rwas: { x: 258, y: 124 },
  memes_to_agents: { x: 180, y: 238 }
};

function evidenceLabel(connection: RhPulseConnectionView) {
  if (connection.evidence_type === 'verified') return 'Verified overlap';
  if (connection.evidence_type === 'activity_coupling') return 'Activity coupling';
  if (connection.evidence_type === 'narrative') return 'Narrative';
  return 'Insufficient';
}

function edgeWidth(connection: RhPulseConnectionView) {
  return connection.relative_strength === null ? 2 : 2 + (connection.relative_strength / 100) * 2.25;
}

export function RhPulseLayerFlowMap({
  connections = EMPTY_RH_PULSE_CONNECTIONS,
  strongest
}: {
  connections?: RhPulseConnectionView[];
  strongest?: RhPulseReadModel['strongest_current_signal'];
}) {
  const strongestConnection = connections.find((connection) => connection.is_strongest_current_signal);
  const evidenceExplanation = strongestConnection?.explanation
    ?? connections.find((connection) => connection.supporting_observation_count > 0)?.explanation
    ?? 'No qualifying reviewed overlap is available. Connection strength is withheld.';

  return <section className="rh-pulse-map-section" aria-labelledby="rh-pulse-map-title">
    <div className="rh-pulse-map-heading">
      <div>
        <p className="rh-pulse-kicker">Lightweight Layer Flow Map</p>
        <h2 id="rh-pulse-map-title">Three layers. Evidence before direction.</h2>
      </div>
      <span>24H PREVIEW</span>
    </div>

    <div className="rh-pulse-map-frame">
      <svg
        className="rh-pulse-flow-map"
        viewBox="0 0 360 270"
        role="img"
        aria-labelledby="rh-pulse-flow-title rh-pulse-flow-description"
      >
        <title id="rh-pulse-flow-title">RH Pulse layer connection map</title>
        <desc id="rh-pulse-flow-description">
          RWAs are positioned at the top, Memes at the lower left, and Agents at the lower right.
          Edge patterns distinguish verified evidence, activity coupling, narrative movement, and insufficient evidence.
          Agents to RWAs is marked connection under watch without being assigned strongest status.
        </desc>
        <defs>
          <filter id="rh-pulse-watch-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <g className="rh-pulse-flow-edges">
          {connections.map((connection) => <g key={connection.id} aria-label={`${connection.label}: ${evidenceLabel(connection)}, confidence ${connection.confidence}, freshness ${connection.freshness}`}>
            <title>{`${connection.label}. ${connection.explanation}`}</title>
            {connection.under_watch && <path
              className="rh-pulse-flow-watch-outline"
              d={PATHS[connection.id]}
              pathLength="100"
              filter="url(#rh-pulse-watch-glow)"
              aria-hidden="true"
            />}
            <path
              className={`rh-pulse-flow-edge rh-pulse-flow-edge-${connection.evidence_type}${connection.is_strongest_current_signal ? ' is-strongest' : ''}`}
              d={PATHS[connection.id]}
              pathLength="100"
              style={{ strokeWidth: edgeWidth(connection) }}
              vectorEffect="non-scaling-stroke"
            />
            <text
              className={`rh-pulse-flow-label rh-pulse-flow-label-${connection.evidence_type}`}
              x={LABEL_POSITIONS[connection.id].x}
              y={LABEL_POSITIONS[connection.id].y}
              textAnchor="middle"
            >
              {evidenceLabel(connection)}
            </text>
          </g>)}
        </g>

        <g className="rh-pulse-flow-node rh-pulse-flow-node-rwas" role="group" aria-label="RWAs: structural destination">
          <circle cx="180" cy="50" r="39" />
          <circle className="rh-pulse-flow-node-core" cx="180" cy="50" r="31" />
          <text x="180" y="48" textAnchor="middle">RWAs</text>
          <text className="rh-pulse-flow-node-detail" x="180" y="63" textAnchor="middle">STRUCTURE</text>
        </g>
        <g className="rh-pulse-flow-node rh-pulse-flow-node-memes" role="group" aria-label="Memes: liquidity and coordination">
          <circle cx="72" cy="210" r="39" />
          <circle className="rh-pulse-flow-node-core" cx="72" cy="210" r="31" />
          <text x="72" y="208" textAnchor="middle">Memes</text>
          <text className="rh-pulse-flow-node-detail" x="72" y="223" textAnchor="middle">LIQUIDITY</text>
        </g>
        <g className="rh-pulse-flow-node rh-pulse-flow-node-agents" role="group" aria-label="Agents: coordination and market formation">
          <circle cx="288" cy="210" r="43" />
          <circle className="rh-pulse-flow-node-core" cx="288" cy="210" r="35" />
          <text x="288" y="208" textAnchor="middle">Agents</text>
          <text className="rh-pulse-flow-node-detail" x="288" y="223" textAnchor="middle">COORDINATION</text>
          <circle className="rh-pulse-flow-watch-orbit" cx="288" cy="164" r="2.5" aria-hidden="true" />
        </g>

        <g className="rh-pulse-flow-watch-label" aria-label="Agents to RWAs connection under watch">
          <rect x="211" y="82" width="134" height="21" rx="10.5" />
          <text x="278" y="96" textAnchor="middle">CONNECTION UNDER WATCH</text>
        </g>
      </svg>

      <ul className="rh-pulse-sr-only">
        {connections.map((connection) => <li key={connection.id}>
          {connection.label}: {evidenceLabel(connection)}. Relative strength {connection.relative_strength ?? 'withheld'}.
          {connection.under_watch ? ' Connection under watch.' : ''}
        </li>)}
      </ul>
    </div>

    <div className="rh-pulse-map-summary" aria-label="Layer Flow Map summary">
      <div>
        <span>STRONGEST CURRENT SIGNAL</span>
        <strong>{strongest?.label ?? 'Checking reviewed evidence'}</strong>
      </div>
      <div>
        <span>CONNECTION UNDER WATCH</span>
        <strong>Agents ↔ RWAs</strong>
      </div>
      <div className="rh-pulse-map-summary-evidence">
        <span>EVIDENCE STATE</span>
        <p>{evidenceExplanation}</p>
      </div>
    </div>
  </section>;
}
