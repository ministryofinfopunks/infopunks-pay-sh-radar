import { useEffect, useState } from 'react';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER
} from '../../shared/rhPulse';
import { RhPulsePublicCallResponseSchema } from '../../shared/rhPulseCalls';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import { RhPulseHeader } from './RhPulseHeader';
import { RhPulseShareActions } from './RhPulseShareActions';
import { applyRhPulseDocumentMetadata } from './rhPulseMetadata';
import type { RhPulseShareDescriptor } from './rhPulseShare';

type PublicPayload = ReturnType<typeof RhPulsePublicCallResponseSchema.parse>['data'];

export function RhPulsePublicCallPage({
  callId,
  homeHref,
  methodologyHref
}: {
  callId: string;
  homeHref: string;
  methodologyHref: string;
}) {
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(toApiUrl(getApiBaseUrl(), `/v1/rh-pulse/calls/${encodeURIComponent(callId)}`), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error('call_not_found');
      const parsed = RhPulsePublicCallResponseSchema.parse(await response.json());
      setPayload(parsed.data);
      applyRhPulseDocumentMetadata({
        publicCallNumber: parsed.data.call.public_call_number,
        selectedOutcomeLabel: parsed.data.call.selected_outcome_label,
        walletDisplay: parsed.data.call.wallet_display,
        recordedAt: parsed.data.call.recorded_at,
        resolutionStatus: parsed.data.call.resolution_status,
        winningOutcomeLabel: parsed.data.call.resolution?.status === 'correct'
          || parsed.data.call.resolution?.status === 'incorrect'
          ? parsed.data.call.resolution.winning_outcome_label
          : null,
        resolutionDelayed: parsed.data.call.resolution?.status === 'delayed'
      });
    }).catch(() => {
      if (!controller.signal.aborted) setNotFound(true);
    });
    return () => controller.abort();
  }, [callId]);

  if (notFound) return <RhPulsePublicCallMissing homeHref={homeHref} />;
  if (!payload) return <div className="rh-pulse-app">
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness="unavailable" loading homeHref={homeHref} />
      <section className="rh-pulse-public-call-loading" aria-live="polite">
        <p className="rh-pulse-kicker">VERIFIED CALL RECEIPT</p>
        <h1>Reading the immutable record.</h1>
        <p>No call details are inferred while the receipt is loading.</p>
      </section>
    </main>
  </div>;

  const call = payload.call;
  const snapshot = payload.structural_snapshot;
  const resolved = call.resolution?.status === 'correct' || call.resolution?.status === 'incorrect'
    ? call.resolution
    : null;
  const delayed = call.resolution?.status === 'delayed' ? call.resolution : null;
  const correct = call.resolution_status === 'correct';
  return <div className="rh-pulse-app">
    <div className="rh-pulse-ambient" aria-hidden="true" />
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness={snapshot.source_health} homeHref={homeHref} />
      <article className="rh-pulse-public-call">
        <header>
          <p className="rh-pulse-kicker">RH PULSE / PUBLIC CALL #{String(call.public_call_number).padStart(4, '0')}</p>
          <span className="rh-pulse-verified-state"><span aria-hidden="true">✓</span> EIP-191 VERIFIED</span>
          <h1>{resolved
            ? (correct ? 'I Called the Rotation' : 'Call Resolved')
            : delayed
              ? 'Resolution delayed'
              : call.selected_outcome_label}</h1>
          {resolved && <p className={`rh-pulse-call-resolution-state rh-pulse-call-resolution-${call.resolution_status}`}>
            <strong>{correct ? 'Correct call' : 'Incorrect call'}</strong>
            <span>Your call: {call.selected_outcome_label}</span>
            <span>Published result: {resolved.winning_outcome_label}</span>
          </p>}
          <p>{outcomeThesis(call.selected_outcome)}</p>
        </header>

        {call.genesis.is_genesis && <section className="rh-pulse-public-genesis" aria-label="Genesis call status">
          <span>GENESIS CALL</span>
          <strong>#{String(call.genesis.rank).padStart(4, '0')} / 4663</strong>
          <p>Permanent public sequence status. It implies no token, reward, eligibility or financial benefit.</p>
        </section>}

        <section className="rh-pulse-public-call-facts" aria-labelledby="rh-pulse-call-facts-title">
          <h2 id="rh-pulse-call-facts-title">On the record</h2>
          <dl>
            <div><dt>Wallet</dt><dd>{call.wallet_display}</dd></div>
            <div><dt>Recorded</dt><dd>{formatUtc(call.recorded_at)}</dd></div>
            <div><dt>Window</dt><dd>#{String(call.window.sequence_number).padStart(3, '0')}</dd></div>
            <div><dt>Window closes</dt><dd>{call.window.closes_at ? formatUtc(call.window.closes_at) : 'Unavailable'}</dd></div>
            <div><dt>Methodology</dt><dd>{call.methodology_version}</dd></div>
            <div><dt>Resolution</dt><dd>{resolved ? (correct ? 'Correct' : 'Incorrect') : delayed ? 'Delayed' : 'Pending'}</dd></div>
            {resolved && <div><dt>Resolution confidence</dt><dd>{resolved.confidence}</dd></div>}
            {resolved && <div><dt>Published</dt><dd>{formatUtc(resolved.published_at)}</dd></div>}
          </dl>
          {delayed && <p><strong>Resolution delayed.</strong> {delayed.blocked_reason} No winner has been published; the approved methodology permits a later retry.</p>}
          {!resolved && !delayed && <p>Resolution pending. No result is inferred before an approved Rotation Receipt is published.</p>}
          {resolved && <p>
            The original prediction remains on the record. <a href={resolved.rotation_receipt_url}>Read the Rotation Receipt.</a>
          </p>}
        </section>

        <section className="rh-pulse-public-snapshot" aria-labelledby="rh-pulse-snapshot-title">
          <p className="rh-pulse-kicker">STRUCTURAL SNAPSHOT AT CALL TIME</p>
          <h2 id="rh-pulse-snapshot-title">What RH Pulse could support.</h2>
          <dl>
            <div>
              <dt>Strongest current signal</dt>
              <dd>{snapshot.strongest_current_signal ? connectionLabel(snapshot.strongest_current_signal) : 'Insufficient evidence'}</dd>
            </div>
            <div>
              <dt>Connection under watch</dt>
              <dd>Agents ↔ RWAs</dd>
            </div>
            <div>
              <dt>Source health</dt>
              <dd>{snapshot.source_health}</dd>
            </div>
            <div>
              <dt>Observed</dt>
              <dd>{formatUtc(snapshot.generated_at)}</dd>
            </div>
          </dl>
          <p>Editorial importance and measured strength remain separate. Correlation is not capital flow.</p>
        </section>

        <section className="rh-pulse-public-hash" id="receipt" aria-labelledby="rh-pulse-receipt-hash-title">
          <p className="rh-pulse-kicker">IMMUTABLE RECEIPT</p>
          <h2 id="rh-pulse-receipt-hash-title">SHA-256</h2>
          <code>{payload.receipt_hash}</code>
          <p>The canonical receipt payload is insert-only. Any future correction must preserve this record and create a superseding receipt.</p>
        </section>

        <RhPulseShareActions
          descriptor={callShareDescriptor(payload)}
          resolvedCorrect={correct}
          resolvedIncorrect={call.resolution_status === 'incorrect'}
        />

        <nav className="rh-pulse-public-call-links" aria-label="RH Pulse receipt links">
          <a href={homeHref}>Read current Pulse</a>
          <a href={methodologyHref}>Read methodology</a>
        </nav>
      </article>
      <footer className="rh-pulse-footer">
        <div><span>RH PULSE / INFOPUNKS</span><a href={methodologyHref}>Methodology</a></div>
        <p>{RH_PULSE_INDEPENDENCE_DISCLAIMER}</p>
      </footer>
    </main>
  </div>;
}

function RhPulsePublicCallMissing({ homeHref }: { homeHref: string }) {
  return <div className="rh-pulse-app">
    <main className="rh-pulse-shell">
      <RhPulseHeader freshness="unavailable" homeHref={homeHref} />
      <section className="rh-pulse-reserved-route">
        <p className="rh-pulse-kicker">RECEIPT NOT FOUND</p>
        <h1>No verified call exists here.</h1>
        <p>RH Pulse does not invent missing calls, signatures or receipt hashes.</p>
        <a href={homeHref}>Return to Call the Rotation</a>
      </section>
    </main>
  </div>;
}

function outcomeThesis(outcome: string) {
  return {
    agents_to_rwas: 'Agent coordination becomes the next bridge into reviewed real-world-asset markets.',
    memes_to_agents: 'Meme liquidity rotates into agent coordination and new market formation.',
    memes_to_rwas: 'Speculative liquidity seeks reviewed tokenized-finance structure.',
    no_qualified_rotation: 'No connection clears the evidence standard for a structural rotation.'
  }[outcome] ?? 'A verified RH Pulse public prediction.';
}

function connectionLabel(connection: string) {
  return {
    agents_to_rwas: 'Agents ↔ RWAs',
    memes_to_agents: 'Memes ↔ Agents',
    memes_to_rwas: 'Memes ↔ RWAs'
  }[connection] ?? connection;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value)) + ' UTC';
}

function callShareDescriptor(payload: PublicPayload): RhPulseShareDescriptor {
  const { call } = payload;
  const resolved = call.resolution?.status === 'correct' || call.resolution?.status === 'incorrect'
    ? call.resolution
    : null;
  const delayed = call.resolution?.status === 'delayed';
  const artifactType = resolved
    ? resolved.status === 'correct' ? 'correct_call' as const : 'incorrect_call' as const
    : delayed
      ? 'resolution_delayed' as const
      : call.genesis.is_genesis
        ? 'genesis_signed_call' as const
        : 'signed_call' as const;
  const number = String(call.public_call_number).padStart(4, '0');
  const filenameStem = resolved?.status === 'correct'
    ? `rh-pulse-called-it-${number}`
    : resolved?.status === 'incorrect'
      ? `rh-pulse-call-${number}-resolved`
      : `rh-pulse-call-${number}`;
  return {
    artifactType,
    callOutcome: call.selected_outcome,
    callOutcomeLabel: call.selected_outcome_label,
    winningOutcome: resolved?.winning_outcome ?? null,
    winningOutcomeLabel: resolved?.winning_outcome_label ?? null,
    publicCallNumber: call.public_call_number,
    windowSequenceNumber: call.window.sequence_number!,
    communityCorrectPercentage: null,
    communityTotalVerifiedCalls: null,
    canonicalUrl: call.public_url,
    landscapePath: `/v1/rh-pulse/calls/${encodeURIComponent(call.call_id)}/share.png`,
    portraitPath: `/v1/rh-pulse/calls/${encodeURIComponent(call.call_id)}/share-portrait.png`,
    landscapeFilename: `${filenameStem}.png`,
    portraitFilename: `${filenameStem}-portrait.png`,
    genesis: call.genesis.is_genesis
  };
}
