import type { RhPulseFreshness } from '../../shared/rhPulse';

const FRESHNESS_LABELS: Record<RhPulseFreshness, string> = {
  live: 'Live',
  delayed: 'Delayed',
  stale: 'Stale',
  unavailable: 'Unavailable'
};

export function RhPulseHeader({
  freshness,
  loading = false,
  homeHref = '/rh-pulse'
}: {
  freshness: RhPulseFreshness;
  loading?: boolean;
  homeHref?: string;
}) {
  return <header className="rh-pulse-header">
    <a className="rh-pulse-wordmark" href={homeHref} aria-label="RH Pulse home">
      <span className="rh-pulse-wordmark-mark" aria-hidden="true">IP</span>
      <span>INFOPUNKS / RH PULSE</span>
    </a>
    <div
      className={`rh-pulse-freshness rh-pulse-freshness-${freshness}`}
      role="status"
      aria-label={`Evidence freshness: ${loading ? 'checking' : FRESHNESS_LABELS[freshness]}`}
    >
      <span aria-hidden="true" />
      {loading ? 'Checking evidence' : FRESHNESS_LABELS[freshness]}
    </div>
  </header>;
}
