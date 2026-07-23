import { useEffect, useState } from 'react';
import { RH_PULSE_INDEPENDENCE_DISCLAIMER } from '../../shared/rhPulse';
import {
  RhPulseResolutionResponseSchema,
  RhPulseRotationReceiptResponseSchema,
  type RhPulsePublicResolution
} from '../../shared/rhPulseResolution';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import { RhPulseHeader } from './RhPulseHeader';

export function RhPulsePublicResolutionPage({
  recordId,
  recordKind,
  homeHref,
  methodologyHref
}: {
  recordId: string;
  recordKind: 'resolution' | 'rotation_receipt';
  homeHref: string;
  methodologyHref: string;
}) {
  const [resolution, setResolution] = useState<RhPulsePublicResolution | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = recordKind === 'resolution'
      ? `/v1/rh-pulse/resolutions/${encodeURIComponent(recordId)}`
      : `/v1/rh-pulse/rotation-receipts/${encodeURIComponent(recordId)}`;
    fetch(toApiUrl(getApiBaseUrl(), endpoint), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error('resolution_not_found');
      const json = await response.json();
      const parsed = recordKind === 'resolution'
        ? RhPulseResolutionResponseSchema.parse(json).data
        : RhPulseRotationReceiptResponseSchema.parse(json).data.public_resolution;
      setResolution(parsed);
      document.title = `${parsed.outcome_label} | RH Pulse Rotation Receipt ${String(parsed.window.sequence_number).padStart(3, '0')}`;
    }).catch(() => {
      if (!controller.signal.aborted) setUnavailable(true);
    });
    return () => controller.abort();
  }, [recordId, recordKind]);

  if (unavailable) return <RhPulseResolutionUnavailable homeHref={homeHref} />;
  if (!resolution) return <div className="rh-pulse-app">
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness="unavailable" loading homeHref={homeHref} />
      <section className="rh-pulse-public-call-loading" aria-live="polite">
        <p className="rh-pulse-kicker">ROTATION RECEIPT</p>
        <h1>Reading the published evidence.</h1>
        <p>No result is inferred while the immutable record is loading.</p>
      </section>
    </main>
  </div>;

  const sequence = String(resolution.window.sequence_number).padStart(3, '0');
  const visibleSupportingEvidence = resolution.supporting_evidence.slice(0, 8);
  const hiddenSupportingEvidenceCount = resolution.supporting_evidence.length - visibleSupportingEvidence.length;
  return <div className="rh-pulse-app">
    <div className="rh-pulse-ambient" aria-hidden="true" />
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness={resolution.source_health} homeHref={homeHref} />
      <article className="rh-pulse-resolution">
        <header className="rh-pulse-resolution-hero">
          <p className="rh-pulse-kicker">RH PULSE ROTATION RECEIPT {sequence}</p>
          <span className="rh-pulse-verified-state"><span aria-hidden="true">✓</span> PUBLISHED / IMMUTABLE</span>
          <p className="rh-pulse-resolution-label">
            {resolution.outcome === 'no_qualified_rotation' ? 'RESULT' : 'WINNING ROTATION'}
          </p>
          <h1>{resolution.outcome_label}</h1>
          <p>{resolution.outcome_explanation}</p>
          <dl className="rh-pulse-resolution-hero-facts">
            <div><dt>Confidence</dt><dd>{titleCase(resolution.confidence)}</dd></div>
            <div><dt>Published</dt><dd>{formatUtc(resolution.published_at)}</dd></div>
            <div><dt>Window</dt><dd>{formatUtc(resolution.window.opens_at!)} → {formatUtc(resolution.window.closes_at!)}</dd></div>
          </dl>
        </header>

        <section className="rh-pulse-resolution-evidence" aria-label="Resolution evidence">
          <EvidenceBlock title="What moved" items={resolution.evidence.what_moved} />
          <EvidenceBlock title="What connected" items={resolution.evidence.what_connected} />
          <EvidenceBlock title="What proved it" items={resolution.evidence.what_proved_it} />
        </section>

        <section className="rh-pulse-resolution-scores" aria-labelledby="rh-pulse-candidate-scores">
          <p className="rh-pulse-kicker">DETERMINISTIC COMPARISON</p>
          <h2 id="rh-pulse-candidate-scores">Directional candidate scores</h2>
          <p>Each direction uses 40% cross-layer evidence, 35% activity acceleration and 25% narrative momentum. Narrative cannot qualify a result by itself.</p>
          <div className="rh-pulse-resolution-score-list">
            {resolution.candidate_scores.map((candidate) => <article key={candidate.outcome}>
              <div>
                <h3>{outcomeLabel(candidate.outcome)}</h3>
                <strong>{candidate.weighted_score === null ? 'Unknown' : `${candidate.weighted_score.toFixed(2)} / 100`}</strong>
              </div>
              <meter
                min="0"
                max="100"
                value={candidate.weighted_score ?? 0}
                aria-label={`${outcomeLabel(candidate.outcome)} weighted score ${candidate.weighted_score ?? 'unavailable'} out of 100`}
              />
              <dl>
                <div><dt>Cross-layer</dt><dd>{score(candidate.cross_layer_score)}</dd></div>
                <div><dt>Activity</dt><dd>{score(candidate.market_activity_score)}</dd></div>
                <div><dt>Narrative</dt><dd>{score(candidate.narrative_momentum_score)}</dd></div>
              </dl>
              <p>{candidate.qualification_status.replaceAll('_', ' ')}</p>
            </article>)}
          </div>
        </section>

        <section className="rh-pulse-resolution-community" aria-labelledby="rh-pulse-community-accuracy">
          <p className="rh-pulse-kicker">COMMUNITY ACCURACY</p>
          <h2 id="rh-pulse-community-accuracy">{resolution.community.total_verified_calls === 0
            ? 'No verified calls in this window.'
            : `${formatPercentage(resolution.community.correct_percentage)} called the rotation.`}</h2>
          <p>{resolution.community.total_verified_calls === 0
            ? 'The immutable publication snapshot contains zero accepted calls; no accuracy percentage is inferred.'
            : `${resolution.community.correct_calls} correct of ${resolution.community.total_verified_calls} verified calls. Wallet balance and trading volume carry no weight.`}</p>
          <dl>
            {resolution.community.distribution.outcomes.map((item) => <div key={item.outcome}>
              <dt>{outcomeLabel(item.outcome)}</dt>
              <dd>{item.count} · {formatPercentage(item.percentage)}</dd>
            </div>)}
          </dl>
        </section>

        <section className="rh-pulse-resolution-limitations" aria-labelledby="rh-pulse-resolution-limitations">
          <p className="rh-pulse-kicker">KNOWN LIMITATIONS</p>
          <h2 id="rh-pulse-resolution-limitations">What the receipt does not claim</h2>
          {resolution.evidence.limitations.length
            ? <ul>{resolution.evidence.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            : <p>No material limitations beyond the published methodology were recorded.</p>}
          <p>Correlation is not capital flow. Narrative evidence remains narrative evidence. Agent-token trading is not proof of autonomous agent execution.</p>
        </section>

        <section className="rh-pulse-public-hash" aria-labelledby="rh-pulse-rotation-hash">
          <p className="rh-pulse-kicker">ROTATION RECEIPT / SHA-256</p>
          <h2 id="rh-pulse-rotation-hash">Immutable publication proof</h2>
          <code>{resolution.receipt_hash}</code>
          <dl>
            <div><dt>Methodology</dt><dd>{resolution.methodology_version}</dd></div>
            <div><dt>Input manifest</dt><dd><code>{resolution.input_manifest_hash}</code></dd></div>
          </dl>
        </section>

        <section className="rh-pulse-resolution-support" aria-labelledby="rh-pulse-supporting-evidence">
          <p className="rh-pulse-kicker">SUPPORTING RADAR EVIDENCE</p>
          <h2 id="rh-pulse-supporting-evidence">Identified observations</h2>
          <ul>
            {visibleSupportingEvidence.map((item) => <li key={item.reference}>
              {item.url
                ? <a href={item.url} rel="noreferrer">{item.reference}</a>
                : <span>{item.reference}</span>}
            </li>)}
          </ul>
          {hiddenSupportingEvidenceCount > 0 && <p>
            The immutable input manifest preserves {hiddenSupportingEvidenceCount} additional identified references.
          </p>}
        </section>

        <nav className="rh-pulse-public-call-links" aria-label="RH Pulse resolution links">
          <a href={homeHref}>Read current Pulse</a>
          <a href={methodologyHref}>Read methodology</a>
          <a href={resolution.receipt_url}>Open Rotation Receipt</a>
        </nav>
      </article>
      <footer className="rh-pulse-footer">
        <div><span>RH PULSE / INFOPUNKS</span><a href={methodologyHref}>Methodology</a></div>
        <p>{RH_PULSE_INDEPENDENCE_DISCLAIMER}</p>
      </footer>
    </main>
  </div>;
}

function EvidenceBlock({ title, items }: { title: string; items: string[] }) {
  return <section>
    <h2>{title}</h2>
    {items.length
      ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      : <p>No public claim was made for this evidence class.</p>}
  </section>;
}

function RhPulseResolutionUnavailable({ homeHref }: { homeHref: string }) {
  return <div className="rh-pulse-app">
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness="unavailable" homeHref={homeHref} />
      <section className="rh-pulse-reserved-route">
        <p className="rh-pulse-kicker">RESOLUTION NOT PUBLISHED</p>
        <h1>No immutable market result exists here.</h1>
        <p>A delayed or blocked resolution never becomes “No Qualified Rotation.” RH Pulse publishes no winner until the evidence standard is met.</p>
        <a href={homeHref}>Return to Call the Rotation</a>
      </section>
    </main>
  </div>;
}

function score(value: number | null) {
  return value === null ? 'Unknown' : value.toFixed(2);
}

function outcomeLabel(outcome: string) {
  return {
    agents_to_rwas: 'Agents → RWAs',
    memes_to_agents: 'Memes → Agents',
    memes_to_rwas: 'Memes → RWAs',
    no_qualified_rotation: 'No Qualified Rotation'
  }[outcome] ?? outcome;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPercentage(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}%`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value)) + ' UTC';
}
